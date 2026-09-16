'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth/session';
import { NOTE_COLORS, NOTE_PINS } from './notes';

/**
 * Всё, что доска задач может менять.
 *
 * Тот же договор, что у профиля и календаря: наружу уходит `{ error: <ключ> }`
 * или `{ ok: true }`, но не готовая фраза — каталог лежит на странице.
 *
 * **Личную записку трогает только её автор.** Общую — любой из троих, как и
 * события в календаре: они втроём и в одном чате. А вот личная на то и личная,
 * и проверка идёт по сессии, а не по тому, что прислал браузер.
 */

export type BoardState = { error?: string; ok?: boolean; id?: string };

const Id = z.string().trim().min(1).max(40);

/** Доля от ширины или высоты доски. За края не пускаем даже при кривом клиенте. */
const Fraction = z.coerce.number().min(0).max(1);

async function mayTouch(id: string, userId: string) {
  const note = await prisma.todoItem.findUnique({
    where: { id },
    select: { shared: true, createdById: true }
  });
  if (!note) return false;
  return note.shared || note.createdById === userId;
}

/** Новая записка. Место и вид приходят с доски — она одна знает, где свободно. */
export async function addNote(_prev: BoardState, formData: FormData): Promise<BoardState> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };

  const parsed = z
    .object({
      title: z.string().trim().min(1, 'empty').max(200),
      shared: z.enum(['true', 'false']),
      x: Fraction,
      y: Fraction,
      color: z.enum(NOTE_COLORS),
      pin: z.enum(NOTE_PINS)
    })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'invalid' };
  const { title, shared, x, y, color, pin } = parsed.data;

  // `position` держит порядок, в котором записки читаются с сервера, и остаётся
  // осмысленным, даже когда доску однажды покажут списком.
  const last = await prisma.todoItem.findFirst({
    where: shared === 'true' ? { shared: true } : { shared: false, createdById: session.userId },
    orderBy: { position: 'desc' },
    select: { position: true }
  });

  const created = await prisma.todoItem.create({
    data: {
      title,
      shared: shared === 'true',
      x,
      y,
      color,
      pin,
      position: (last?.position ?? 0) + 1,
      createdById: session.userId
    },
    select: { id: true }
  });

  revalidatePath('/todos');
  return { ok: true, id: created.id };
}

/** Текст записки. Пустую не храним — пустой листок на доске это мусор. */
export async function editNote(_prev: BoardState, formData: FormData): Promise<BoardState> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };

  const parsed = z
    .object({ id: Id, title: z.string().trim().max(200) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'invalid' };
  if (!(await mayTouch(parsed.data.id, session.userId))) return { error: 'notYours' };

  if (parsed.data.title.length === 0) {
    await prisma.todoItem.delete({ where: { id: parsed.data.id } }).catch(() => {});
  } else {
    await prisma.todoItem.update({
      where: { id: parsed.data.id },
      data: { title: parsed.data.title }
    });
  }

  revalidatePath('/todos');
  return { ok: true };
}

/** Переезд по доске и смена вида — всё, что меняется перетаскиванием и парой кнопок. */
export async function styleNote(_prev: BoardState, formData: FormData): Promise<BoardState> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };

  const parsed = z
    .object({
      id: Id,
      x: Fraction.optional(),
      y: Fraction.optional(),
      color: z.enum(NOTE_COLORS).optional(),
      pin: z.enum(NOTE_PINS).optional(),
      done: z.enum(['true', 'false']).optional()
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'invalid' };

  const { id, done, ...rest } = parsed.data;
  if (!(await mayTouch(id, session.userId))) return { error: 'notYours' };

  await prisma.todoItem.update({
    where: { id },
    data: {
      ...rest,
      ...(done === undefined
        ? {}
        : { done: done === 'true', doneAt: done === 'true' ? new Date() : null })
    }
  });

  revalidatePath('/todos');
  return { ok: true };
}

/** Снять записку с доски. */
export async function removeNote(_prev: BoardState, formData: FormData): Promise<BoardState> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };

  const parsed = Id.safeParse(formData.get('id'));
  if (!parsed.success) return { error: 'invalid' };
  if (!(await mayTouch(parsed.data, session.userId))) return { error: 'notYours' };

  await prisma.todoItem.delete({ where: { id: parsed.data } }).catch(() => {});

  revalidatePath('/todos');
  return { ok: true };
}
