import 'server-only';

import { dayKey } from '@/lib/calendar/scales';
import { prisma } from '@/lib/db';

/**
 * Дни рождения: у каждого свой, вписывается в профиле, и в этот день сайт
 * поздравляет (`Birthday`) — раз в год, на любом устройстве и любом адресе.
 * Решение владельца от 26 октября 2026: вместо разового поздравления одному —
 * всем, каждому в его день.
 *
 * Лежат в `countdowns`: таблица была в схеме с первого дня, и в ней один
 * «doomsday», — так обошлось без миграции общей базы, как с «кто тут трётся» и
 * поездами. День рождения и есть обратный отсчёт — до следующего. Ключи — по id
 * человека: он не меняется, в отличие от хендла.
 *
 *   birthday:<id>           дата рождения, полдень UTC — ни в каком поясе не
 *                           съедет на соседний день;
 *   birthday-greeted:<id>   когда поздравили последний раз.
 *
 * Отметка о поздравлении — в базе, а не в куке: кука живёт на одном устройстве
 * и одном адресе, и с ноутбука, телефона и нового домена поздравление
 * выскакивало бы трижды.
 *
 * Дата вписывается один раз и закрепляется: снять её может только владелец
 * сайта (`unlockBirthday`), и тогда человек впишет заново. Решение владельца:
 * иначе день рождения переезжал бы ради второго поздравления.
 */

export const bornKey = (userId: string) => `birthday:${userId}`;
export const greetedKey = (userId: string) => `birthday-greeted:${userId}`;

export type Born = { year: number; month: number; day: number };

/** Полдень UTC нужного дня. */
export const bornAt = ({ year, month, day }: Born) => new Date(Date.UTC(year, month - 1, day, 12));

const read = (at: Date): Born => ({ year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() });

/** Своя дата рождения и год, когда последний раз поздравили. Одним запросом. */
export async function birthdayOf(userId: string): Promise<{ born: Born | null; greeted: number | null }> {
  const rows = await prisma.countdown.findMany({
    where: { key: { in: [bornKey(userId), greetedKey(userId)] } },
    select: { key: true, targetAt: true }
  });
  const born = rows.find((row) => row.key === bornKey(userId));
  const greeted = rows.find((row) => row.key === greetedKey(userId));
  return {
    born: born ? read(born.targetAt) : null,
    // Год — по Цюриху, как «сегодня» у всего сайта: поздравили в новогоднюю ночь
    // по UTC — это всё ещё прошлый год.
    greeted: greeted ? Number(dayKey(greeted.targetAt).slice(0, 4)) : null
  };
}

/** Вписана ли дата — для напоминания над новостями. Сбой базы — «вписана»: лучше не напомнить, чем напоминать зря. */
export async function hasBirthday(userId: string): Promise<boolean> {
  const row = await prisma.countdown
    .findUnique({ where: { key: bornKey(userId) }, select: { key: true } })
    .catch(() => ({ key: '' }));
  return row !== null;
}

/** Даты рождения многих разом — владельцу, который их разблокирует. */
export async function birthdaysOf(userIds: string[]): Promise<Map<string, Born>> {
  const rows = await prisma.countdown.findMany({
    where: { key: { in: userIds.map(bornKey) } },
    select: { key: true, targetAt: true }
  });
  return new Map(rows.map((row) => [row.key.slice('birthday:'.length), read(row.targetAt)]));
}

/**
 * Сегодня ли день рождения. `today` — `ГГГГ-ММ-ДД` по Цюриху, как весь календарь
 * сайта. Родившийся 29 февраля в невисокосный год празднует 28-го: иначе три
 * года из четырёх сайт промолчал бы.
 */
export function isBirthday(born: Born, today: string): boolean {
  const [year, month, day] = today.split('-').map(Number);
  if (born.month === month && born.day === day) return true;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return born.month === 2 && born.day === 29 && !leap && month === 2 && day === 28;
}
