import 'server-only';

import { prisma } from '@/lib/db';
import { authConfigured } from '@/lib/auth/config';

/**
 * Общий календарь на троих: чтение и работа с датами.
 *
 * Весь календарь считается **в цюрихском времени**, а не в часовом поясе
 * зрителя. Это не мелочь: событие в 23:30 по Цюриху для человека в Киеве
 * попало бы на следующий день, и двое, глядя на одну и ту же сетку, спорили бы,
 * в какой день встреча. Общий факт должен выглядеть одинаково у всех — так же
 * решены дата на главной и номер дня у цитаты.
 *
 * В базе всё лежит в UTC, как и положено; цюрихскими здесь становятся только
 * границы суток и месяца.
 */

export const ZONE = 'Europe/Zurich';

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  author: string;
  authorId: string;
};

/** `2026-09-16` для даты, в цюрихских сутках. Ключ, по которому события ложатся в сетку. */
export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/** `2026-09` — месяц, которым живёт адресная строка. */
export const monthKey = (date: Date) => dayKey(date).slice(0, 7);

/**
 * Насколько Цюрих впереди UTC в конкретный момент, в минутах.
 *
 * Нужна, чтобы превратить «полночь в Цюрихе» в момент времени, не таща в проект
 * библиотеку часовых поясов. Считается через саму `Intl`: та же машина, что
 * знает про переход на летнее время, отвечает и здесь, поэтому 26 октября
 * граница суток сдвинется сама.
 */
function offsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    timeZoneName: 'longOffset'
  }).formatToParts(at);

  const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Момент, в который в Цюрихе наступает полночь указанного дня.
 *
 * Смещение берётся дважды: первый раз — приблизительно, по полуночи UTC, второй
 * — уже по найденному моменту. Одна итерация нужна ровно два раза в год, в ночь
 * перевода часов, когда смещение до и после полуночи разное.
 */
export function zurichMidnight(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const rough = offsetMinutes(new Date(utc));
  const exact = offsetMinutes(new Date(utc - rough * 60_000));
  return new Date(utc - exact * 60_000);
}

/** Сдвиг на `days` календарных суток от ключа дня. */
export function shiftDay(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return dayKey(new Date(Date.UTC(year, month - 1, day + days, 12)));
}

/** Сдвиг на `months` месяцев от ключа месяца. Число не переносим — нас интересует месяц целиком. */
export function shiftMonth(key: string, months: number): string {
  const [year, month] = key.split('-').map(Number);
  return `${new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 7)}`;
}

/**
 * Сетка месяца: всегда полные недели, с понедельника.
 *
 * Возвращаются 35 или 42 дня — столько, сколько нужно, чтобы месяц уложился
 * целыми неделями. Дни соседних месяцев остаются в сетке: без них у строки
 * появляются дыры, и глаз перестаёт читать её как неделю.
 */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  // `getUTCDay` на полудне UTC даёт тот же день недели, что и в Цюрихе.
  const [year, mon] = month.split('-').map(Number);
  const weekday = (new Date(Date.UTC(year, mon - 1, 1, 12)).getUTCDay() + 6) % 7;

  const start = shiftDay(first, -weekday);
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const cells = Math.ceil((weekday + daysInMonth) / 7) * 7;

  return Array.from({ length: cells }, (_, i) => shiftDay(start, i));
}

/**
 * События месяца, уже разложенные по дням сетки.
 *
 * Один запрос на всю страницу: границы берутся по краям сетки, а не по краям
 * месяца, иначе события в хвостах соседних месяцев видны в сетке как пустые
 * клетки. Многодневное событие попадает в каждый свой день — так его видно там,
 * где на него смотрят, а не только в день начала.
 */
export async function monthEvents(month: string): Promise<Record<string, CalendarEvent[]>> {
  if (!authConfigured()) return {};

  const grid = monthGrid(month);
  const from = zurichMidnight(grid[0]);
  const to = zurichMidnight(shiftDay(grid[grid.length - 1], 1));

  const rows = await prisma.calendarEvent.findMany({
    where: { startsAt: { lt: to }, OR: [{ endsAt: null }, { endsAt: { gte: from } }] },
    orderBy: [{ allDay: 'desc' }, { startsAt: 'asc' }],
    include: { createdBy: { select: { id: true, displayName: true } } }
  });

  const byDay: Record<string, CalendarEvent[]> = {};
  for (const row of rows) {
    if (row.startsAt < from) continue;

    const event: CalendarEvent = {
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      allDay: row.allDay,
      author: row.createdBy.displayName,
      authorId: row.createdBy.id
    };

    // Последний день многодневного события включительно: событие до 18:00
    // вторника идёт во вторник, а не до понедельника.
    const last = row.endsAt && row.endsAt > row.startsAt ? dayKey(row.endsAt) : dayKey(row.startsAt);
    for (let key = dayKey(row.startsAt); key <= last; key = shiftDay(key, 1)) {
      (byDay[key] ??= []).push(event);
    }
  }

  return byDay;
}
