/**
 * Опечатка в домене почты: `gamil.com` вместо `gmail.com`.
 *
 * Так и случилось 26 октября 2026: приглашение выписали на `…@gamil.com`, почта
 * перешла в аккаунт, и «забыл пароль» не работал — сброс ищет почту точь-в-точь,
 * а настоящий gmail в базе не находился. Хуже того: `gamil.com` — известный
 * домен-ловушка для таких опечаток, и письмо со ссылкой сброса ушло бы чужим.
 *
 * Поэтому почту, которую вводят в приглашении, в профиле и в «забыл пароль»,
 * сверяем с почтовыми сервисами, которыми тут пользуются: домен в одну-две буквы
 * от известного, но не он сам, — почти наверняка опечатка, и форма не уходит, а
 * предлагает исправленный адрес. Смотрим только на набранное, базу не трогаем:
 * подсказка ничего не говорит о том, есть ли такой аккаунт.
 *
 * Свой модуль без импортов — проверяется сам по себе.
 */

const KNOWN = [
  'gmail.com',
  'googlemail.com',
  'icloud.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'proton.me',
  'protonmail.com',
  'gmx.ch',
  'gmx.net',
  'gmx.de',
  'bluewin.ch',
  'sunrise.ch',
  'hispeed.ch',
  'web.de',
  't-online.de',
  'yandex.ru',
  'mail.ru',
  'inbox.ru',
  'rambler.ru',
  'ukr.net'
];

/**
 * Расстояние Дамерау — Левенштейна (в варианте «оптимального выравнивания»):
 * сколько вставок, удалений, замен и перестановок соседних букв отделяет одну
 * строку от другой. Перестановка — отдельно, потому что самая частая опечатка —
 * поменять две буквы местами: `gamil`.
 */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * Исправленный адрес, если в домене похоже на опечатку, иначе `null`.
 *
 * Порог — одна правка для коротких доменов (до семи букв) и две для длинных:
 * у коротких две правки превращают один настоящий домен в другой настоящий
 * (`gmx.ch` и `gmx.de`), у длинных — нет. Сам известный домен опечаткой не
 * бывает, даже если похож на соседний.
 */
export function likelyTypo(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (KNOWN.includes(domain)) return null;
  let best: { domain: string; score: number } | null = null;
  for (const known of KNOWN) {
    const score = distance(domain, known);
    const limit = known.length <= 7 ? 1 : 2;
    if (score <= limit && (!best || score < best.score)) best = { domain: known, score };
  }
  return best ? `${email.slice(0, at)}@${best.domain}` : null;
}
