/**
 * Разбор двух страниц SeeMeta: «карты» и «тир-лист» Brawl Stars.
 *
 * Чистые функции над HTML, без сети, базы и `server-only`, — чтобы их можно
 * было прогнать на сохранённой странице прямо из скрипта и увидеть, что
 * разобралось. Куда и как часто мы ходим — в `brawl-meta.ts`.
 *
 * Почему HTML, а не их JSON: API у SeeMeta нет, а данные для фильтров на
 * их страницах грузятся скриптом, который режет безголовый браузер. Сами
 * страницы отдаются обычным запросом с нашим честным `user-agent` и разрешены
 * в их robots.txt. Разметка держится на `data-testid` (`bs-map-section`,
 * `bs-map-brawlers`, `bs-brawler-card`) — это якоря для их же тестов, и
 * меняются они реже классов. Если всё же поменяются, разбор вернёт пустоту,
 * и `brawl-meta.ts` скажет об этом в лог, а не нарисует пустую мету.
 */

export type SeeMetaRow = {
  /** Слаг SeeMeta: `shade`, `mr-p`, `8-bit`. */
  slug: string;
  name: string;
  /** Их буква: S, A, B, C, D, F. Считается из винрейта (80%) и доли пиков (20%). */
  tier: string;
  winRate: number;
  useRate: number;
  picks: number;
};

export type SeeMetaMap = {
  /** `gem-grab-gem-fort` — из `id` секции, уникален на странице. */
  slug: string;
  name: string;
  /** Режим так, как его пишет Supercell: `gemGrab`, `brawlBall`, `soloShowdown`. */
  mode: string;
  /**
   * Откуда цифры карты: «Ranked battles» — карта рангового, считано по
   * ранговым боям; «Trophy battles» — карта только боёв за кубки. С 17 октября
   * 2026 SeeMeta перечисляет на странице все карты ротации, а не только
   * ранговые, и отличить их можно только по этой подписи.
   */
  ranked: boolean;
  battles: number;
  /** Десять лучших на карте, в их порядке. */
  rows: SeeMetaRow[];
};

export type SeeMetaBrawler = SeeMetaRow & {
  /** «10 of 10» → 10. */
  score: number | null;
  modes: { name: string; tier: string; winRate: number }[];
  maps: { name: string; verdict: string; winRate: number }[];
};

export type SeeMetaHeader = {
  rankedBattles: number | null;
  /** «September 16, 2026 to October 16, 2026» → две даты, ISO. */
  from: string | null;
  to: string | null;
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'"
};

/** Текст фрагмента: без тегов, с раскрытыми `&amp;`, пробелы схлопнуты. */
export function text(fragment: string | undefined): string {
  if (!fragment) return '';
  return fragment
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** «55.9%» → 0.559. `NaN`, если там не процент. */
export const share = (value: string) => {
  const m = /(-?\d+(?:[.,]\d+)?)\s*%/.exec(value);
  return m ? Number(m[1].replace(',', '.')) / 100 : NaN;
};

/** «174 816» с любыми пробелами между разрядами → 174816. */
export const whole = (value: string) => {
  const digits = value.replace(/[\s\u00a0\u202f,.’']/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : NaN;
};

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
];

/** «October 16, 2026» → `2026-10-16`. */
function isoDate(value: string): string | null {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(value);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

function headerValue(html: string, key: string): string {
  const m = new RegExp(`id="page-header-detail-value-${key}"[^>]*>([\\s\\S]*?)</`).exec(html);
  return text(m?.[1]);
}

export function parseHeader(html: string): SeeMetaHeader {
  const period = headerValue(html, 'data-period');
  const [from, to] = period.split(/\s+to\s+/);
  const battles = whole(headerValue(html, 'ranked-battles'));
  return {
    rankedBattles: Number.isFinite(battles) ? battles : null,
    from: from ? isoDate(from) : null,
    to: to ? isoDate(to) : null
  };
}

/** Куски страницы от `<details id="<prefix>` до закрывающего `</details>`. */
function sections(html: string, prefix: string): { id: string; body: string }[] {
  const out: { id: string; body: string }[] = [];
  const marker = `<details id="${prefix}`;
  let at = html.indexOf(marker);
  while (at >= 0) {
    const idEnd = html.indexOf('"', at + marker.length);
    const end = html.indexOf('</details>', idEnd);
    if (idEnd < 0 || end < 0) break;
    out.push({ id: html.slice(at + marker.length, idEnd), body: html.slice(idEnd, end) });
    at = html.indexOf(marker, end);
  }
  return out;
}

/** Строка таблицы бравлеров: имя, буква, винрейт, доля, пики. */
function parseRow(row: string): SeeMetaRow | null {
  const slug = /#brawler-([a-z0-9-]+)"/.exec(row)?.[1];
  const name = text(/<a data-name[^>]*>([\s\S]*?)<\/a>/.exec(row)?.[1]);
  const tier = text(/<span data-badge[^>]*>([\s\S]*?)<\/span>/.exec(row)?.[1]);
  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1]));
  // Первая ячейка — буква, дальше винрейт, доля пиков и сами пики.
  const [, win, use, picks] = cells;
  const parsed = {
    slug: slug ?? '',
    name,
    tier,
    winRate: share(win ?? ''),
    useRate: share(use ?? ''),
    picks: whole(picks ?? '')
  };
  if (!parsed.slug || !parsed.name || !/^[SABCDF]$/.test(parsed.tier)) return null;
  if (![parsed.winRate, parsed.useRate, parsed.picks].every(Number.isFinite)) return null;
  return parsed;
}

export function parseMapsPage(html: string): SeeMetaMap[] {
  return sections(html, 'map-').flatMap(({ id, body }) => {
    const name = text(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(body)?.[1]);
    const mode = /tier-list\?mode=([A-Za-z0-9]+)/.exec(body)?.[1] ?? '';
    const counted = /(Ranked|Trophy) battles\s*([\d\s\u00a0\u202f,]+)</.exec(body);
    const battles = whole(counted?.[2] ?? '');
    const table = /<table data-testid="bs-map-brawlers"[\s\S]*?<\/table>/.exec(body)?.[0] ?? '';
    const rows = table
      .split('<tr')
      .filter((r) => r.includes('#brawler-'))
      .map(parseRow)
      .filter((r): r is SeeMetaRow => r !== null);
    if (!name || !mode || !rows.length) return [];
    return [
      {
        slug: id,
        name,
        mode,
        ranked: counted?.[1] === 'Ranked',
        battles: Number.isFinite(battles) ? battles : 0,
        rows
      }
    ];
  });
}

/** Значение из списка `<dt>…</dt><dd>…</dd>` карточки по подписи. */
function stat(body: string, label: string): string {
  const m = new RegExp(`<dt>${label}</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`).exec(body);
  return m ? m[1] : '';
}

function listOf(body: string, testid: string): string[] {
  const block = new RegExp(`data-testid="${testid}"[\\s\\S]*?</ul>`).exec(body)?.[0] ?? '';
  return [...block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
}

export function parseTierPage(html: string): SeeMetaBrawler[] {
  return sections(html, 'brawler-').flatMap(({ id, body }) => {
    const name = text(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(body)?.[1]);
    const tierCell = stat(body, 'Tier');
    const tier = text(/data-testid="bs-tier-badge"[^>]*>([\s\S]*?)<\/span>/.exec(tierCell)?.[1]);
    const score = /(\d+(?:\.\d+)?)\s+of\s+10/.exec(text(tierCell))?.[1];
    const winRate = share(text(stat(body, 'Win rate')));
    const useRate = share(text(stat(body, 'Use rate')));
    const picks = whole(text(stat(body, 'Picks')));
    if (!name || !/^[SABCDF]$/.test(tier) || !Number.isFinite(winRate) || !Number.isFinite(useRate)) {
      return [];
    }

    const modes = listOf(body, 'bs-brawler-modes').flatMap((li) => {
      const w = share(text(/<span data-num[^>]*>([\s\S]*?)<\/span>/.exec(li)?.[1]));
      const n = text(/<span data-name[^>]*>([\s\S]*?)<\/span>/.exec(li)?.[1]);
      const t = text(/<span data-badge[^>]*>([\s\S]*?)<\/span>/.exec(li)?.[1]);
      return n && Number.isFinite(w) ? [{ name: n, tier: t, winRate: w }] : [];
    });
    const maps = listOf(body, 'bs-brawler-maps').flatMap((li) => {
      const w = share(text(/<span data-num[^>]*>([\s\S]*?)<\/span>/.exec(li)?.[1]));
      const n = text(/<a data-name[^>]*>([\s\S]*?)<\/a>/.exec(li)?.[1]);
      // Между именем и числом — их словесная оценка: Amazing, Good.
      const verdict = text(/<\/a>\s*<span[^>]*>([\s\S]*?)<\/span>/.exec(li)?.[1]);
      return n && Number.isFinite(w) ? [{ name: n, verdict, winRate: w }] : [];
    });

    return [
      {
        slug: id,
        name,
        tier,
        score: score ? Number(score) : null,
        winRate,
        useRate,
        picks: Number.isFinite(picks) ? picks : 0,
        modes,
        maps
      }
    ];
  });
}
