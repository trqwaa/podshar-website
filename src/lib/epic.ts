import 'server-only';

import de from '@/content/epic/de.json';
import en from '@/content/epic/en.json';
import ru from '@/content/epic/ru.json';
import uk from '@/content/epic/uk.json';
import type { Locale } from '@/i18n/routing';

/**
 * Эпос сайта: подпись под кнопкой ПХ, заставка кнопки и фраза дня при входе.
 * Решения владельца от 20 октября 2026: вместо «не нажимать» и реплик —
 * величие и мемы, много и без повторов.
 *
 * Фразы лежат не в каталогах `i18n/messages`, а в `content/epic`. Каталоги
 * обязаны совпадать ключами на всех четырёх языках, а пулы разные по размеру:
 * русских фраз для кнопки около тысячи, остальных по триста. И в браузер
 * уезжает одна выбранная строка, а не тысяча: сервер выбирает, страница
 * получает готовое, как с приветствием.
 *
 * Подпись и фраза дня — общие у троих на день, по номеру дня (`lib/day.ts`).
 * Их количества держать взаимно простыми с приветствиями (61) и цитатами
 * (240): подписей 77, фраз дня 367 у русского и 199 у остальных. Иначе подпись
 * всегда выпадала бы в паре с одной и той же цитатой.
 *
 * Фраза кнопки — у каждого своя: номер захода из куки, переставленный шагом,
 * взаимно простым с размером пула. Так пул проходится целиком без повторов, а у
 * троих порядок разный.
 */

type Pool = { first: string; captions: string[]; press: string[]; daily: string[] };

const POOLS: Record<Locale, Pool> = { ru, en, uk, de };

/** Простое число, больше любого пула: шаг перестановки, взаимно простой с его размером. */
const STEP = 7919;

const at = <T,>(list: T[], n: number): T => list[((n % list.length) + list.length) % list.length];

export const captionOf = (locale: Locale, day: number) => at(POOLS[locale].captions, day);

export const dailyLineOf = (locale: Locale, day: number) => at(POOLS[locale].daily, day);

/**
 * Самая первая фраза при входе — всегда «прикоснись к величию»: с неё человек
 * знакомится с сайтом, дальше фраза дня по кругу (решение владельца от 21
 * октября 2026). «Впервые» — значит, у браузера ещё нет куки фразы дня.
 */
export const firstLineOf = (locale: Locale) => POOLS[locale].first;

/** Строка в неотрицательное число (FNV-1a): чтобы у каждого был свой порядок фраз. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Фраза заставки для `n`-го захода того, кто `who` (id из сессии). */
export function pressLineOf(locale: Locale, n: number, who: string): string {
  const list = POOLS[locale].press;
  return at(list, (hash(who) % list.length) + n * STEP);
}
