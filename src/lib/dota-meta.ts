import 'server-only';

import { ask } from '@/lib/games';
import { DOTA_HERO_ICONS } from '@/lib/game-catalog';

/**
 * Мета доты — из OpenDota, по рангам.
 *
 * `heroStats` отдаёт по каждому герою пики и победы отдельно для восьми рангов,
 * от Herald до Immortal. Отсюда мета считается **на твоём ранге**, а не вообще:
 * то, что тащит в Immortal, в Legend часто проигрывает, и совет «пикай то, что
 * играют про» — худший совет для того, кто хочет апнуть свои пятьсот птс.
 *
 * Ответ кешируется на шесть часов — мета за это время не меняется, — и берётся
 * из кеша Next, а не из нашей базы: считать тут нечего, это готовая таблица.
 * Страница ждёт её за `<Suspense>`, как погоду, и без неё остаётся целой.
 */

const API = 'https://api.opendota.com/api';
const META_TTL = 6 * 3600;
const BUILD_TTL = 24 * 3600;
const PLAYER_TTL = 3600;
const BUDGET = 9000;

/** Порядок из `rank_tier`: 1 — Herald, 8 — Immortal. */
export const BRACKETS = ['herald', 'guardian', 'crusader', 'archon', 'legend', 'ancient', 'divine', 'immortal'] as const;

/**
 * Герои вне меты. Всегда в почёте, что бы ни говорила статистика.
 * Shadow Fiend и Arc Warden — решение владельца, и обсуждению не подлежит.
 */
export const ALWAYS_HONOURED = [11, 113] as const;

export type MetaHero = {
  id: number;
  /** Имя файла иконки и короткое имя: `nevermore` у Shadow Fiend. */
  key: string;
  name: string;
  hasIcon: boolean;
  roles: string[];
  winRate: number;
  /** Доля матчей на этом ранге, где героя взяли. */
  pickRate: number;
  games: number;
};

export type DotaMeta = {
  /** 1–8, или `null` — все ранги вместе. */
  bracket: number | null;
  /** Сколько матчей в выборке, в штуках. Пиков вдесятеро больше: в матче десять героев. */
  matches: number;
  heroes: MetaHero[];
};

type HeroStat = Record<string, unknown> & { id: number; name: string; localized_name: string; roles?: string[] };

async function heroStats(): Promise<HeroStat[] | null> {
  try {
    const data = await ask(`${API}/heroStats`, META_TTL, BUDGET).then((r) => r.json());
    return Array.isArray(data) ? (data as HeroStat[]) : null;
  } catch (error) {
    console.warn('[podshar] opendota heroStats:', error instanceof Error ? error.message : error);
    return null;
  }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Мета на ранге. `null` — OpenDota не ответила. */
export async function dotaMeta(bracket: number | null): Promise<DotaMeta | null> {
  const stats = await heroStats();
  if (!stats) return null;

  // Immortal отдельно OpenDota не считает: `8_pick` у всех героев ноль
  // (проверено 24 сентября 2026). Для Immortal берётся Divine и выше, и
  // подписывается это как «Divine+», а не как Immortal — см. `metaRankName`.
  const tiers = bracket === 8 ? [7, 8] : bracket ? [bracket] : [1, 2, 3, 4, 5, 6, 7, 8];
  const rows = stats.map((h) => {
    const games = tiers.reduce((sum, t) => sum + num(h[`${t}_pick`]), 0);
    const wins = tiers.reduce((sum, t) => sum + num(h[`${t}_win`]), 0);
    const key = h.name.replace('npc_dota_hero_', '');
    return { id: h.id, key, name: h.localized_name, hasIcon: DOTA_HERO_ICONS.has(key), roles: h.roles ?? [], games, wins };
  });

  // Десять героев в матче, значит матчей вдесятеро меньше, чем пиков.
  const matches = Math.round(rows.reduce((sum, r) => sum + r.games, 0) / 10);
  if (!matches) return { bracket, matches: 0, heroes: [] };

  return {
    bracket,
    matches,
    heroes: rows.map(({ wins, ...r }) => ({
      ...r,
      winRate: r.games ? wins / r.games : 0,
      pickRate: r.games / matches
    }))
  };
}

/**
 * Кого считать метой.
 *
 * Не просто лучший винрейт: герой, которого берут в одном матче из трёхсот, с
 * винрейтом 58% — это статистический шум и три фанатика, а не мета. Поэтому
 * сначала отсекаются редкие (меньше 3% матчей), потом сортировка по винрейту.
 * Порог выбран так, чтобы в выборке оставалось около половины героев: и
 * метовые, и популярные-но-слабые, которым место в позоре.
 */
const META_MIN_PICK = 0.03;
const SHAME_MIN_PICK = 0.015;

export function metaList(meta: DotaMeta): MetaHero[] {
  return meta.heroes.filter((h) => h.pickRate >= META_MIN_PICK).sort((a, b) => b.winRate - a.winRate);
}

/** Худший винрейт среди тех, кого реально берут: позор — это не «никто не играет», а «играют и сливают». */
export function shameList(meta: DotaMeta, count = 12): MetaHero[] {
  return meta.heroes
    .filter((h) => h.pickRate >= SHAME_MIN_PICK)
    .sort((a, b) => a.winRate - b.winRate)
    .slice(0, count);
}

/** Почёт: Shadow Fiend и Arc Warden первыми, всегда, потом лучшие по мете. */
export function honourList(meta: DotaMeta, count = 10): MetaHero[] {
  const pinned = ALWAYS_HONOURED.map((id) => meta.heroes.find((h) => h.id === id)).filter(
    (h): h is MetaHero => Boolean(h)
  );
  const rest = metaList(meta).filter((h) => !ALWAYS_HONOURED.includes(h.id as 11 | 113));
  return [...pinned, ...rest.slice(0, count)];
}

export type Build = { start: string[]; early: string[]; mid: string[]; late: string[] };

type Item = { id: number; dname: string; cost: number };

/** Справочник предметов: номер → имя и цена. Нужен, чтобы из номеров в сборке сделать слова. */
async function itemIndex(): Promise<Map<number, Item & { key: string }> | null> {
  try {
    const data = (await ask(`${API}/constants/items`, BUILD_TTL, BUDGET).then((r) => r.json())) as Record<
      string,
      { id?: number; dname?: string; cost?: number }
    >;
    const index = new Map<number, Item & { key: string }>();
    for (const [key, item] of Object.entries(data)) {
      if (typeof item?.id === 'number' && typeof item.dname === 'string') {
        index.set(item.id, { id: item.id, dname: item.dname, cost: item.cost ?? 0, key });
      }
    }
    return index;
  } catch (error) {
    console.warn('[podshar] opendota items:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Что покупают на герое, по фазам игры.
 *
 * `itemPopularity` считает покупки по всем матчам героя, поэтому сверху всегда
 * танго и варды — их покупают все, и сборкой они не являются. Отсюда порог по
 * цене в каждой фазе и список того, что не считается никогда. Остаётся то, что
 * человек реально собирает: ботинки, ядро, ситуативку.
 */
const NEVER = /^(recipe_|tpscroll|ward_|smoke_of_deceit|dust|tango|clarity|flask|enchanted_mango|faerie_fire|blood_grenade|famango|aghanims_shard)/;

export async function dotaBuild(heroId: number): Promise<Build | null> {
  try {
    const [popular, items] = await Promise.all([
      ask(`${API}/heroes/${heroId}/itemPopularity`, BUILD_TTL, BUDGET).then((r) => r.json()),
      itemIndex()
    ]);
    if (!items || !popular) return null;

    const phase = (block: unknown, minCost: number, count: number) =>
      Object.entries((block ?? {}) as Record<string, number>)
        .map(([id, n]) => ({ item: items.get(Number(id)), n }))
        .filter((x): x is { item: Item & { key: string }; n: number } => Boolean(x.item))
        .filter((x) => !NEVER.test(x.item.key) && x.item.cost >= minCost)
        .sort((a, b) => b.n - a.n)
        .slice(0, count)
        .map((x) => x.item.dname);

    return {
      // Старт — наоборот, дешёвое: это и есть стартовые предметы.
      start: Object.entries((popular.start_game_items ?? {}) as Record<string, number>)
        .map(([id, n]) => ({ item: items.get(Number(id)), n }))
        .filter((x): x is { item: Item & { key: string }; n: number } => Boolean(x.item) && !/^recipe_/.test(x.item!.key))
        .sort((a, b) => b.n - a.n)
        .slice(0, 4)
        .map((x) => x.item.dname),
      early: phase(popular.early_game_items, 400, 3),
      mid: phase(popular.mid_game_items, 1800, 4),
      late: phase(popular.late_game_items, 2500, 3)
    };
  } catch (error) {
    console.warn(`[podshar] opendota build ${heroId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export type OwnHero = { id: number; games: number; wins: number };

/**
 * Свои герои за всё время: сколько сыграно и сколько выиграно на каждом.
 *
 * Отсюда личный почёт и личный позор — «на ком ты тащишь» и «на ком ты
 * сливаешь». Кешируется на час: за вечер счёт на герое меняется, но не так,
 * чтобы ради этого дёргать OpenDota на каждом открытии.
 */
export async function ownHeroes(accountId: string): Promise<OwnHero[] | null> {
  try {
    const data = await ask(`${API}/players/${accountId}/heroes`, PLAYER_TTL, BUDGET).then((r) => r.json());
    if (!Array.isArray(data)) return null;
    return data
      .map((h) => ({ id: Number(h?.hero_id), games: num(h?.games), wins: num(h?.win) }))
      .filter((h) => Number.isFinite(h.id) && h.games > 0);
  } catch (error) {
    console.warn('[podshar] opendota own heroes:', error instanceof Error ? error.message : error);
    return null;
  }
}
