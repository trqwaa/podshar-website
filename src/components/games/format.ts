/**
 * Как доска игр говорит о времени и режимах. Без React — просто функции.
 */

/**
 * «5 минут назад», «вчера» — на языке зрителя, силами самого `Intl`. Старше
 * недели — датой: «86 дн. назад» приходится пересчитывать в уме, «12 авг.»
 * читается сразу.
 */
export function ago(at: Date, locale: string, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const minutes = Math.round((at.getTime() - now) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) <= 6) return rtf.format(days, 'day');
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'Europe/Zurich' }).format(at);
}

/**
 * `gemGrab` → `gem grab`. Supercell пишет режимы слитно в верблюжьем регистре;
 * переводить их не на что — так их зовут и в самой игре, — а строчными они
 * встают в тон остальным подписям.
 */
export const modeName = (mode: string | null | undefined) =>
  mode ? mode.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase() : '';

export const percent = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: value < 0.1 ? 1 : 0
  }).format(value);

/** Число с разрядами по языку страницы: «31 420», «31,420», «31’420». */
export const count = (value: number, locale: string) => value.toLocaleString(locale);
