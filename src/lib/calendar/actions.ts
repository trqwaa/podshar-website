'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth/session';
import { zurichMidnight } from '@/lib/calendar/events';

/**
 * Всё, что страница календаря умеет менять.
 *
 * Тот же договор, что у профиля: наружу уходит `{ error: <ключ перевода> }` или
 * `{ ok: true }`, но никогда готовая фраза — каталог лежит на странице, серверу
 * незачем знать, какой из четырёх языков сейчас на экране.
 *
 * Календарь **общий**: править и удалять может любой из троих, а не только
 * автор. Это не недосмотр — так он и задуман. Кто добавил, видно в списке, и
 * этого хватает, когда людей трое и они в одном чате; запрет же означал бы, что
 * уехавший на неделю человек оставляет запись, которую некому убрать.
 *
 * Кто спрашивает — решает кука, а не форма. Скрытое поле «пользователь 3» это
 * пожелание браузера.
 */

export type CalendarState = { error?: string; ok?: boolean };

/** `2026-09-16`, как отдаёт `<input type="date">`. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** `18:30`, как отдаёт `<input type="time">`. */
const CLOCK = /^\d{2}:\d{2}$/;

const Event = z
  .object({
    id: z.string().trim().max(40).optional(),
    title: z.string().trim().min(1, 'noTitle').max(120),
    day: z.string().trim().refine((v) => DAY.test(v), 'badDay'),
    endDay: z.string().trim().optional(),
    time: z.string().trim().optional(),
    endTime: z.string().trim().optional(),
    location: z.string().trim().max(120).optional(),
    description: z.string().trim().max(1000).optional()
  })
  .refine((v) => !v.time || CLOCK.test(v.time), { message: 'badTime', path: ['time'] })
  .refine((v) => !v.endTime || CLOCK.test(v.endTime), { message: 'badTime', path: ['endTime'] })
  .refine((v) => !v.endDay || DAY.test(v.endDay), { message: 'badDay', path: ['endDay'] });

/** Момент по цюрихским суткам и настенному времени. `18:30` — это 18:30 в Цюрихе. */
function moment(day: string, clock?: string): Date {
  const midnight = zurichMidnight(day);
  if (!clock) return midnight;
  const [hours, minutes] = clock.split(':').map(Number);
  return new Date(midnight.getTime() + (hours * 60 + minutes) * 60_000);
}

function read(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  return Event.safeParse(raw);
}

/** Добавить событие, или сохранить изменения, если пришёл `id`. */
export async function saveEvent(
  _prev: CalendarState,
  formData: FormData
): Promise<CalendarState> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };

  const parsed = read(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'invalid' };
  }

  const { id, title, day, endDay, time, endTime, location, description } = parsed.data;

  const startsAt = moment(day, time);
  // Конец есть, только если его указали. Событие без конца — это точка на оси,
  // а не отрезок нулевой длины, и сетка обращается с ними по-разному.
  const finishDay = endDay || (endTime ? day : undefined);
  const endsAt = finishDay ? moment(finishDay, endTime) : null;

  if (endsAt && endsAt < startsAt) return { error: 'endsBeforeStart' };

  const data = {
    title,
    description: description || null,
    location: location || null,
    startsAt,
    endsAt,
    // «Весь день» — это не галочка в форме, а отсутствие времени: человек,
    // который не написал час, и имел в виду весь день.
    allDay: !time
  };

  if (id) {
    // `updateMany`, а не `update`: событие могли удалить, пока форма была
    // открыта, и падать с пятисоткой на этом незачем.
    const changed = await prisma.calendarEvent.updateMany({ where: { id }, data });
    if (changed.count === 0) return { error: 'gone' };
  } else {
    await prisma.calendarEvent.create({
      data: { ...data, createdById: session.userId }
    });
  }

  revalidatePath('/calendar');
  return { ok: true };
}

/** Убрать событие. Может любой — календарь общий. */
export async function deleteEvent(
  _prev: CalendarState,
  formData: FormData
): Promise<CalendarState> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };

  const id = z.string().trim().min(1).max(40).safeParse(formData.get('id'));
  if (!id.success) return { error: 'invalid' };

  await prisma.calendarEvent.deleteMany({ where: { id: id.data } });

  revalidatePath('/calendar');
  return { ok: true };
}
