/**
 * Как доска игр говорит о времени и режимах. Без React — просто функции.
 */

/** «5 минут назад», «вчера» — на языке зрителя, силами самого браузерного `Intl`. */
export function ago(at: Date, locale: string, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const minutes = Math.round((at.getTime() - now) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
}

/**
 * `gemGrab` → `gem grab`. Supercell пишет режимы слитно в верблюжьем регистре;
 * переводить их не на что — так их зовут и в самой игре, — а строчными они
 * встают в тон остальным подписям.
 */
export const modeName = (mode: string | null | undefined) =>
  mode ? mode.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase() : '';

export const percent = (value: number) => `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
