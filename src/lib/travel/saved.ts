import 'server-only';

import { prisma } from '@/lib/db';
import { authConfigured } from '@/lib/auth/config';
import type { SavedRoad, Station } from '@/lib/types';

/**
 * Дороги, которыми человек ездит постоянно.
 *
 * Список личный: маршрут «в школу» у каждого свой, и показывать его троим
 * незачем. Выборка идёт по автору из сессии, а не по тому, что пришло из
 * браузера, — тот же порядок, что у личных записок на доске.
 *
 * Расписание тут не считается. Список рисуется из своих же строк и появляется
 * мгновенно, а к SBB идём только когда по маршруту нажали: иначе открытие
 * раздела означало бы пять запросов наружу разом, а человек смотрит один.
 */

/** Новая дорога ложится в конец: шаг дробного индекса. */
const STEP = 1000;

export async function savedRoads(userId: string): Promise<SavedRoad[]> {
  if (!authConfigured()) return [];

  const rows = await prisma.savedRoute.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
    select: { id: true, label: true, fromId: true, fromName: true, toId: true, toName: true }
  });

  return rows.map((row) => ({ ...row }));
}

/** Куда класть следующую дорогу, чтобы она встала последней. */
export async function nextPosition(userId: string): Promise<number> {
  const last = await prisma.savedRoute.findFirst({
    where: { userId },
    orderBy: { position: 'desc' },
    select: { position: true }
  });
  return (last?.position ?? 0) + STEP;
}

/** Домашняя станция человека — та, что он выбрал в разделе. */
export async function homeStation(userId: string): Promise<Station | null> {
  if (!authConfigured()) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { homeLocation: { select: { label: true, stopId: true } } }
  });

  const stop = user?.homeLocation?.stopId;
  const label = user?.homeLocation?.label;
  return stop && label ? { id: stop, name: label } : null;
}

/**
 * Станции остальных — чтобы «доехать к своим» было одним нажатием.
 *
 * Себя в списке нет: ехать к себе незачем. Тех, кто станцию не назвал, тоже —
 * строка «Борис (станции нет)», по которой нельзя нажать, это не помощь.
 */
export async function otherStations(
  userId: string
): Promise<{ name: string; station: Station }[]> {
  if (!authConfigured()) return [];

  const users = await prisma.user.findMany({
    where: { id: { not: userId }, homeLocationId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { displayName: true, homeLocation: { select: { label: true, stopId: true } } }
  });

  const out: { name: string; station: Station }[] = [];
  for (const user of users) {
    const stop = user.homeLocation?.stopId;
    const label = user.homeLocation?.label;
    if (stop && label) out.push({ name: user.displayName, station: { id: stop, name: label } });
  }
  return out;
}
