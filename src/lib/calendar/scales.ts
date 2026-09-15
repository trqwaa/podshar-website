/**
 * Масштабы календаря и вся арифметика дат — отдельно от `events.ts`.
 *
 * `events.ts` помечен `server-only`, потому что ходит в базу. Тулбар, сетка и
 * выбор даты в форме — клиентские, а сетку месяца им надо строить ту же самую.
 * Импорт серверного модуля из клиентского роняет сборку, поэтому общее лежит
 * здесь: ни базы, ни `server-only`, ни единого импорта.
 *
 * Держать это в одном месте — не аккуратность ради аккуратности. Пока годовой
 * вид строил сетку сам, он резал плоский список по 42 дня, хотя месяц бывает и
 * на 35: половина месяцев разъезжалась, и React ругался на одинаковые ключи.
 */
export type Scale = 'day' | 'week' | 'month' | 'year';

export const SCALES: readonly Scale[] = ['day', 'week', 'month', 'year'];

export const isScale = (value: string | undefined): value is Scale =>
  Boolean(value) && (SCALES as readonly string[]).includes(value as string);

export const ZONE = 'Europe/Zurich';

/** `2026-09-16` для даты, в цюрихских сутках. Ключ, по которому события ложатся в сетку. */
export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Сдвиги считаются на полудне UTC.
 *
 * Полночь плюс сутки в стране с переводом часов иногда даёт тот же день или
 * пропускает следующий; середина суток от этого на двенадцать часов далека.
 */
export function shiftDay(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10);
}

export function shiftMonth(key: string, months: number): string {
  const [year, month, day] = key.split('-').map(Number);
  // 28-е есть в любом месяце: сдвиг с 31 января иначе улетает в март.
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, 28), 12))
    .toISOString()
    .slice(0, 10);
}

/** Понедельник недели, в которую попадает день. */
export function weekStart(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const weekday = (new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay() + 6) % 7;
  return shiftDay(key, -weekday);
}

/**
 * Сетка месяца: всегда полные недели, с понедельника.
 *
 * Возвращаются 35 или 42 дня — столько, сколько нужно, чтобы месяц уложился
 * целыми неделями. Дни соседних месяцев остаются в сетке: без них у крайних
 * строк появляются дыры, и глаз перестаёт читать их как неделю.
 */
export function monthGrid(month: string): string[] {
  const [year, mon] = month.split('-').map(Number);
  const weekday = (new Date(Date.UTC(year, mon - 1, 1, 12)).getUTCDay() + 6) % 7;
  const start = shiftDay(`${month.slice(0, 7)}-01`, -weekday);
  const inMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((weekday + inMonth) / 7) * 7 }, (_, i) =>
    shiftDay(start, i)
  );
}

/** Двенадцать месяцев года как есть, каждый своей сеткой. */
export const yearGrids = (year: string): string[][] =>
  Array.from({ length: 12 }, (_, i) => monthGrid(`${year}-${String(i + 1).padStart(2, '0')}`));

/**
 * Дни, которые видно в данном масштабе.
 *
 * Возвращается список, а не границы: сетке он нужен целиком, а считать его
 * дважды — в слое данных для запроса и в разметке для отрисовки — значит
 * однажды получить месяц, в котором запрошено на день меньше, чем показано.
 */
export function visibleDays(scale: Scale, anchor: string): string[] {
  if (scale === 'day') return [anchor];
  if (scale === 'week') {
    const start = weekStart(anchor);
    return Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  }
  if (scale === 'month') return monthGrid(anchor.slice(0, 7));
  return yearGrids(anchor.slice(0, 4)).flat();
}
