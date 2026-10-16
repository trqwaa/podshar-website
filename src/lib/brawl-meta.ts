import 'server-only';

import { unstable_cache } from 'next/cache';

import type { Locale } from '@/i18n/routing';
import { UK_MAP_NAMES } from '@/lib/brawl-maps-uk';
import { BRAWLERS, BRAWLER_ICONS } from '@/lib/game-catalog';
import { parseHeader, parseMapsPage, parseTierPage, type SeeMetaRow } from '@/lib/seemeta';

/**
 * Мета Brawl Stars — с SeeMeta: ранговые бои, по картам.
 *
 * Своя формула была дважды и дважды «не соответствовала действительности».
 * В 1.0.0 — журналы топ-50 мира за двое суток: тысяча боёв и шум. В пробной
 * 1.17 — обход журналов от наших аккаунтов и топов, честно со всех уровней, —
 * но мета в бравле живёт на картах, а не в среднем по всем: бравлер, который
 * тащит ограбление, сливает кристаллы, и общий винрейт врёт про обе карты.
 * Владелец попросил 16 октября 2026: мету по картам ранкеда, и не считать, а
 * взять там, где её уже посчитали.
 *
 * SeeMeta, потому что из проверенных он один подходит целиком: считает по
 * настоящему ранговому режиму (1,13 млн боёв за месяц на 16 октября), отдельно
 * по каждой карте, пересчитывает каждый день и пишет на странице, из скольких
 * боёв и за какой период. Brawlify и noff.gg отвечают обычному запросу 403,
 * у BrawlAPI статистика пустая, у Supercell её нет вовсе.
 *
 * Берём раз в шесть часов, в кеш Next, как мету доты с OpenDota: считать тут
 * нечего, это готовая таблица, и в нашу базу ей незачем. Две страницы, около
 * трёх мегабайт на всё, — сайту, который живёт на рекламе, это ничего не
 * стоит, а на доске стоит ссылка на источник.
 */

const SEEMETA_ROOT = 'https://seemeta.com';
export const SEEMETA = `${SEEMETA_ROOT}/en/brawl-stars`;
const TTL = 6 * 3600;
const BUDGET = 15_000;
/** Сколько не ходить снова после сбоя: страница на три мегабайта не должна качаться на каждый показ. */
const BACKOFF_MS = 10 * 60_000;

/**
 * Порядок режимов на доске. Какие карты ранговые, решает не этот список, а
 * подпись SeeMeta у карты («Ranked battles»): добавят в ранкед новый режим —
 * его карты появятся сами, в конце.
 */
const MODE_ORDER = ['gemGrab', 'brawlBall', 'heist', 'hotZone', 'knockout', 'bounty'];

export type MetaBrawler = {
  /** Наш номер из справочника. `0` — SeeMeta знает бравлера, которого у нас ещё нет. */
  id: number;
  slug: string;
  name: string;
  hasIcon: boolean;
  /** Буква SeeMeta: S, A, B, C, D, F. */
  tier: string;
  winRate: number;
  useRate: number;
  picks: number;
};

export type MetaMap = {
  slug: string;
  name: string;
  mode: string;
  battles: number;
  brawlers: MetaBrawler[];
};

export type TierBrawler = MetaBrawler & {
  score: number | null;
  /** `id` — режим так, как его пишет Supercell (`hotZone`): по нему он и переводится. */
  modes: { id: string; name: string; tier: string; winRate: number }[];
  maps: { name: string; verdict: string; winRate: number }[];
};

export type BrawlMeta = {
  battles: number | null;
  /** Период данных, `2026-09-16` — строками: кеш Next хранит JSON, а не `Date`. */
  from: string | null;
  to: string | null;
  fetchedAt: string;
  maps: MetaMap[];
  /** Весь тир-лист в порядке SeeMeta — по их оценке, лучший первым. */
  tier: TierBrawler[];
};

/**
 * Имя → наш номер. SeeMeta пишет имена по-английски, как сама игра, и
 * справочник тоже: сравниваем без регистра и знаков, чтобы «Mr. P», «8-Bit» и
 * «Larry & Lawrie» сошлись. Проверено на всех 107 бравлерах 16 октября.
 */
const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const BY_NAME = new Map(Object.entries(BRAWLERS).map(([id, b]) => [norm(b.name), Number(id)]));

function ours(row: SeeMetaRow): MetaBrawler {
  const id = BY_NAME.get(norm(row.name)) ?? BY_NAME.get(norm(row.slug)) ?? 0;
  return {
    id,
    slug: row.slug,
    name: row.name,
    hasIcon: id > 0 && BRAWLER_ICONS.has(id),
    tier: row.tier,
    winRate: row.winRate,
    useRate: row.useRate,
    picks: row.picks
  };
}

async function page(url: string): Promise<string> {
  const path = url.replace(SEEMETA_ROOT, '');
  const response = await fetch(url, {
    // Без кеша на самом запросе: страница тир-листа больше двух мегабайт, и
    // кеш Next её всё равно не возьмёт. Кешируется разобранное, ниже.
    cache: 'no-store',
    // Тот же честный заголовок, что везде. Обычный `curl` SeeMeta не пускает,
    // безголовый браузер тоже, а представившийся сайт — пускает.
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; podshar/1.0)' },
    signal: AbortSignal.timeout(BUDGET)
  });
  if (!response.ok) throw new Error(`${path}: ответ ${response.status}`);
  return response.text();
}

async function load(): Promise<BrawlMeta> {
  const [mapsHtml, tierHtml] = await Promise.all([
    page(`${SEEMETA}/maps`),
    page(`${SEEMETA}/tier-list`)
  ]);
  const header = parseHeader(tierHtml);
  // Только карты рангового: на странице с 17 октября и вся ротация боёв за
  // кубки, и новые режимы — у них подпись «Trophy battles». «Выживание»
  // отсекается ещё и по режиму: в ранкеде его не бывает, а 16 октября SeeMeta
  // подписывал его «Ranked battles», хотя считал по боям за кубки.
  const maps = parseMapsPage(mapsHtml).filter(
    (m) => m.ranked && m.battles > 0 && !/showdown/i.test(m.mode)
  );
  const tier = parseTierPage(tierHtml);

  // Разметка чужая и может поменяться. Тогда лучше честное «не пришло» и
  // строка в логе, чем доска с тремя картами, которая выглядит как настоящая.
  // «Hot Zone» из карточки бравлера → `hotZone` с карты: без пробелов и регистра.
  const rankedModes = new Map(maps.map((m) => [norm(m.mode), m.mode]));
  const rankedMaps = new Set(maps.map((m) => m.name));
  if (maps.length < 10 || tier.length < 50) {
    throw new Error(`разобралось ${maps.length} карт и ${tier.length} бравлеров — разметка поменялась?`);
  }

  return {
    battles: header.rankedBattles,
    from: header.from,
    to: header.to,
    fetchedAt: new Date().toISOString(),
    maps: maps.map((m) => ({
      slug: m.slug,
      name: m.name,
      mode: m.mode,
      battles: m.battles,
      brawlers: m.rows.map(ours)
    })),
    // «Лучшие режимы и карты» у SeeMeta — по всем боям, вместе с «выживанием»
    // и баскетом. Доска про ранкед, поэтому оставляем только его режимы и карты:
    // режим «Gem Grab» сверяется с `gemGrab` карт без пробелов и регистра.
    tier: tier.map((b) => ({
      ...ours(b),
      score: b.score,
      modes: b.modes.flatMap((x) => {
        const id = rankedModes.get(norm(x.name));
        return id ? [{ ...x, id }] : [];
      }),
      maps: b.maps.filter((x) => rankedMaps.has(x.name))
    }))
  };
}

const cached = unstable_cache(load, ['seemeta-brawl', 'v2'], { revalidate: TTL });

let failedAt = 0;

/** Мета рангового с SeeMeta. `null` — не ответил или не разобрался; причина в логе. */
export async function brawlMeta(): Promise<BrawlMeta | null> {
  if (Date.now() - failedAt < BACKOFF_MS) return null;
  try {
    return await cached();
  } catch (error) {
    failedAt = Date.now();
    console.warn('[podshar] seemeta:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Мета — верх их тир-листа, в их порядке: оценка уже учитывает и винрейт, и то, как часто берут. */
export const brawlMetaList = (m: BrawlMeta, count = 15) => m.tier.slice(0, count);

/**
 * Позор — худший винрейт среди тех, кого реально берут (от 1% боёв), и только
 * ниже половины: «играют и сливают», а не «никто не играет».
 */
export const brawlShameList = (m: BrawlMeta, count = 12) =>
  m.tier
    .filter((b) => b.useRate >= 0.01 && b.winRate < 0.5)
    .sort((a, b) => a.winRate - b.winRate)
    .slice(0, count);

/** Почёт — лучшие по их оценке, кто выигрывает чаще, чем проигрывает. */
export const brawlHonourList = (m: BrawlMeta, count = 10) =>
  m.tier.filter((b) => b.winRate > 0.5).slice(0, count);

/** Карты рангового по режимам, в порядке `MODE_ORDER`, внутри — по числу боёв. */
export function mapsByMode(m: BrawlMeta): { mode: string; maps: MetaMap[] }[] {
  const modes = [...new Set(m.maps.map((x) => x.mode))].sort((a, b) => {
    const at = (mode: string) => (MODE_ORDER.includes(mode) ? MODE_ORDER.indexOf(mode) : MODE_ORDER.length);
    return at(a) - at(b);
  });
  return modes.map((mode) => ({
    mode,
    maps: m.maps.filter((x) => x.mode === mode).sort((a, b) => b.battles - a.battles)
  }));
}

/**
 * Названия карт на языке страницы — как их видит в игре тот, кто её читает.
 *
 * Двое из троих играют на русском, один на английском, и «Hard Rock Mine» на
 * русской странице надо было переводить в голове в «Роковую шахту». Русские и
 * немецкие названия — официальные, со страниц SeeMeta на этих языках: секции
 * карт там с теми же `id`, что на английской, и сопоставляются один к одному.
 * Украинского в игре нет — его словарь наш, см. `brawl-maps-uk.ts`.
 *
 * Отдельный кеш на сутки: названия не меняются, меняется только список карт,
 * и три страницы раз в шесть часов ради них были бы лишними.
 */
type Names = Record<'ru' | 'de', Record<string, string>>;

async function loadNames(): Promise<Names> {
  const [en, ru, de] = await Promise.all(
    ['en', 'ru', 'de'].map((lang) => page(`${SEEMETA_ROOT}/${lang}/brawl-stars/maps`))
  );
  const english = new Map(parseMapsPage(en).map((m) => [m.slug, m.name]));
  const names: Names = { ru: {}, de: {} };
  for (const [lang, html] of [['ru', ru], ['de', de]] as const) {
    for (const m of parseMapsPage(html)) {
      const original = english.get(m.slug);
      if (original && m.name) names[lang][norm(original)] = m.name;
    }
  }
  if (Object.keys(names.ru).length < 20 || Object.keys(names.de).length < 20) {
    throw new Error(
      `названий карт: ${Object.keys(names.ru).length} по-русски, ${Object.keys(names.de).length} по-немецки — разметка поменялась?`
    );
  }
  return names;
}

const cachedNames = unstable_cache(loadNames, ['seemeta-map-names', 'v1'], {
  revalidate: 24 * 3600
});

const UK = new Map(Object.entries(UK_MAP_NAMES).map(([en, uk]) => [norm(en), uk]));

let namesFailedAt = 0;

/**
 * Функция «английское название → название на языке страницы». Не нашлось —
 * английское: это настоящее имя карты, а не пустое место.
 */
export async function mapNamer(
  locale: Locale
): Promise<(english: string | null | undefined) => string> {
  if (locale === 'en') return (english) => english ?? '';
  if (locale === 'uk') return (english) => (english ? (UK.get(norm(english)) ?? english) : '');

  let dict: Record<string, string> = {};
  if (Date.now() - namesFailedAt >= BACKOFF_MS) {
    try {
      dict = (await cachedNames())[locale];
    } catch (error) {
      namesFailedAt = Date.now();
      console.warn('[podshar] seemeta names:', error instanceof Error ? error.message : error);
    }
  }
  return (english) => (english ? (dict[norm(english)] ?? english) : '');
}
