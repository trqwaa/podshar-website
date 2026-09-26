'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth/session';
import { stationById } from '@/lib/sbb';
import { nextPosition } from './saved';

/**
 * Всё, что раздел поездов может менять.
 *
 * Тот же договор, что у доски и календаря: наружу уходит `{ error: <ключ> }`
 * или `{ ok: true }`, а не готовая фраза — каталог лежит на странице.
 *
 * **Номер станции всегда проверяется у SBB, а имя берётся оттуда же.** Из
 * браузера приходит только номер: имя в скрытом поле можно подменить, и тогда
 * в списке маршрутов стояло бы «домой», а поезда показывались бы чужие. Это не
 * про злой умысел — так же ломается и просто устаревшая вкладка.
 *
 * Дорога личная, поэтому в каждом `where` стоит `userId` из сессии. Без него
 * чужой маршрут переименовывался бы подстановкой номера в запрос.
 */

export type TravelState = { error?: string; ok?: boolean; station?: string };

const Id = z.string().trim().min(1).max(40);
const Stop = z.string().trim().regex(/^\d{3,12}$/, 'stopBad');
/** Своё название дороги. Пустое допустимо — тогда показываем «откуда → куда». */
const Label = z.string().trim().max(40);

/** Проверить номер у SBB и вернуть настоящее имя станции. */
async function station(stop: string) {
  try {
    return await stationById(stop);
  } catch (error) {
    console.warn('[podshar] SBB не ответили про станцию:', error instanceof Error ? error.message : error);
    return undefined;
  }
}

/**
 * Домашняя станция.
 *
 * Переехала сюда из профиля вместе со всем поездным. Раньше это было поле, куда
 * писали название, а сайт брал первое совпадение и называл найденное вслух;
 * теперь станцию выбирают из списка, и угадывать нечего.
 *
 * `locations` — общая таблица: двое с одной станции показывают на одну строку,
 * а не заводят по копии. Пустой номер очищает станцию.
 */
export async function setHomeStation(
  _prev: TravelState,
  formData: FormData
): Promise<TravelState> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };

  const raw = String(formData.get('stop') ?? '').trim();

  if (!raw) {
    await prisma.user.update({ where: { id: session.userId }, data: { homeLocationId: null } });
    revalidatePath('/', 'layout');
    return { ok: true };
  }

  const stop = Stop.safeParse(raw);
  if (!stop.success) return { error: 'stopBad' };

  const found = await station(stop.data);
  if (found === undefined) return { error: 'stationLookup' };
  if (!found) return { error: 'stationNotFound' };

  const location =
    (await prisma.location.findFirst({ where: { stopId: found.id, label: found.name } })) ??
    (await prisma.location.create({
      data: {
        label: found.name,
        latitude: found.latitude,
        longitude: found.longitude,
        stopId: found.id
      }
    }));

  await prisma.user.update({
    where: { id: session.userId },
    data: { homeLocationId: location.id }
  });

  // Станция видна на главной, в шторке и в плитке поездов — перерисовать надо
  // весь шелл, а не одну страницу.
  revalidatePath('/', 'layout');
  return { ok: true, station: found.name };
}

/** Сохранить дорогу. Название необязательно: без него покажем «откуда → куда». */
export async function saveRoad(_prev: TravelState, formData: FormData): Promise<TravelState> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };

  const parsed = z
    .object({ from: Stop, to: Stop, label: Label })
    .safeParse({
      from: formData.get('from') ?? '',
      to: formData.get('to') ?? '',
      label: formData.get('label') ?? ''
    });
  if (!parsed.success) return { error: 'stopBad' };
  const { from, to, label } = parsed.data;
  if (from === to) return { error: 'sameStop' };

  const [a, b] = await Promise.all([station(from), station(to)]);
  if (a === undefined || b === undefined) return { error: 'stationLookup' };
  if (!a || !b) return { error: 'stationNotFound' };

  // Одна и та же дорога дважды — это не ошибка, а нажатая второй раз кнопка.
  const already = await prisma.savedRoute.findFirst({
    where: { userId: session.userId, fromId: a.id, toId: b.id },
    select: { id: true }
  });
  if (already) return { ok: true };

  await prisma.savedRoute.create({
    data: {
      userId: session.userId,
      label: label || null,
      fromId: a.id,
      fromName: a.name,
      toId: b.id,
      toName: b.name,
      position: await nextPosition(session.userId)
    }
  });

  revalidatePath('/trains');
  return { ok: true };
}

/** Переименовать дорогу. Пустое имя снимает название, а не удаляет маршрут. */
export async function renameRoad(_prev: TravelState, formData: FormData): Promise<TravelState> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };

  const parsed = z
    .object({ id: Id, label: Label })
    .safeParse({ id: formData.get('id') ?? '', label: formData.get('label') ?? '' });
  if (!parsed.success) return { error: 'invalid' };

  const changed = await prisma.savedRoute.updateMany({
    where: { id: parsed.data.id, userId: session.userId },
    data: { label: parsed.data.label || null }
  });
  if (changed.count === 0) return { error: 'notYours' };

  revalidatePath('/trains');
  return { ok: true };
}

/** Убрать дорогу. Только свою. */
export async function removeRoad(_prev: TravelState, formData: FormData): Promise<TravelState> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };

  const parsed = Id.safeParse(formData.get('id') ?? '');
  if (!parsed.success) return { error: 'invalid' };

  await prisma.savedRoute.deleteMany({ where: { id: parsed.data, userId: session.userId } });

  revalidatePath('/trains');
  return { ok: true };
}
