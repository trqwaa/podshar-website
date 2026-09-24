import 'server-only';

import { prisma } from '@/lib/db';
import { authConfigured } from '@/lib/auth/config';
import { zurichMidnight } from '@/lib/calendar/events';
import { dayKey } from '@/lib/calendar/scales';
import { activeAccount, fromBrawlSnapshot, fromSnapshot, lastSnapshot } from '@/lib/games';
import type { BrawlProfile, DotaProfile } from '@/lib/types';

/**
 * Что читает доска игр. Только база — наружу отсюда не ходит ничего.
 *
 * Матчи и снимки туда кладёт синхронизация (`/api/games/sync`), которую
 * страница зовёт уже после того, как отрисовалась. То же правило, что у шторки:
 * медленный OpenDota не имеет права держать страницу.
 */

/**
 * Сколько MMR приносит рейтинговый матч, в среднем.
 *
 * Оценка, а не факт: настоящее число Valve не отдаёт никому, и на экране оно
 * всегда идёт со знаком «≈». Двадцать пять — то, что получает откалиброванный
 * игрок за обычную игру; в начале сезона и при высокой неуверенности бывает
 * больше. Лучше честная оценка с подписью, чем пустая колонка там, где вопрос
 * был именно «кто сколько поднял».
 */
export const DOTA_MMR_PER_GAME = 25;

export type BoardMatch = {
  id: string;
  at: Date;
  result: 'WIN' | 'LOSS' | 'DRAW';
  /** Номер героя в доте, номер бравлера в Brawl Stars. */
  character: string | null;
  ratingDelta: number | null;
  payload: Record<string, unknown>;
};

type Account = { id: string; externalId: string; tag: string | null };

async function matchesOf(accountId: string, since?: Date, take = 12): Promise<BoardMatch[]> {
  const rows = await prisma.matchRecord.findMany({
    where: { accountId, ...(since ? { playedAt: { gte: since } } : {}) },
    orderBy: { playedAt: 'desc' },
    take: since ? undefined : take,
    select: {
      id: true,
      playedAt: true,
      result: true,
      character: true,
      ratingDelta: true,
      payload: true
    }
  });
  return rows.map((r) => ({
    id: r.id,
    at: r.playedAt,
    result: r.result,
    character: r.character,
    ratingDelta: r.ratingDelta,
    payload: (r.payload as Record<string, unknown>) ?? {}
  }));
}

export type GameSide<P> = {
  linked: boolean;
  account: Account | null;
  profile: P | null;
  recent: BoardMatch[];
};

async function side<P>(
  userId: string,
  game: 'DOTA2' | 'BRAWL_STARS',
  read: (payload: unknown) => P | null
): Promise<GameSide<P>> {
  const account = await activeAccount(userId, game);
  if (!account) return { linked: false, account: null, profile: null, recent: [] };
  const [{ payload }, recent] = await Promise.all([
    lastSnapshot(account.id),
    matchesOf(account.id)
  ]);
  return { linked: true, account, profile: read(payload), recent };
}

/** Обзор для одного человека: обе игры, последний снимок и последние матчи. */
export async function boardFor(userId: string) {
  if (!authConfigured()) {
    const empty = { linked: false, account: null, profile: null, recent: [] };
    return { dota: empty as GameSide<DotaProfile>, brawl: empty as GameSide<BrawlProfile> };
  }
  const [dota, brawl] = await Promise.all([
    side(userId, 'DOTA2', fromSnapshot),
    side(userId, 'BRAWL_STARS', fromBrawlSnapshot)
  ]);
  return { dota, brawl };
}

export type DayTotals = {
  wins: number;
  losses: number;
  /** Дота: рейтинговые сегодня. Бравл: то же, что и все. */
  rankedWins: number;
  rankedLosses: number;
  /** Дота — оценка (см. `DOTA_MMR_PER_GAME`), бравл — точная сумма кубков. */
  delta: number | null;
  estimated: boolean;
};

export function totals(matches: BoardMatch[], game: 'DOTA2' | 'BRAWL_STARS'): DayTotals {
  const wins = matches.filter((m) => m.result === 'WIN').length;
  const losses = matches.filter((m) => m.result === 'LOSS').length;
  if (game === 'DOTA2') {
    const ranked = matches.filter((m) => m.payload.ranked === true);
    const rw = ranked.filter((m) => m.result === 'WIN').length;
    const rl = ranked.filter((m) => m.result === 'LOSS').length;
    return {
      wins,
      losses,
      rankedWins: rw,
      rankedLosses: rl,
      delta: ranked.length ? (rw - rl) * DOTA_MMR_PER_GAME : null,
      estimated: true
    };
  }
  const known = matches.filter((m) => m.ratingDelta !== null);
  return {
    wins,
    losses,
    rankedWins: wins,
    rankedLosses: losses,
    delta: known.length ? known.reduce((sum, m) => sum + (m.ratingDelta ?? 0), 0) : null,
    estimated: false
  };
}

export type MemberDay = {
  handle: string;
  displayName: string;
  avatarPreset: string | null;
  me: boolean;
  dota: { linked: boolean; profile: DotaProfile | null; today: BoardMatch[]; totals: DayTotals };
  brawl: { linked: boolean; profile: BrawlProfile | null; today: BoardMatch[]; totals: DayTotals };
};

/**
 * Сравнение: все трое, обе игры, только сегодняшнее.
 *
 * «Сегодня» — по цюрихским суткам, как всё на сайте, а не по часам того, кто
 * смотрит: иначе ночная катка в Киеве была бы у одного вчерашней, а у другого
 * сегодняшней, и спор «кто больше слил за день» не решался бы в принципе.
 */
export async function compareToday(
  viewerId: string
): Promise<{ since: Date; members: MemberDay[] }> {
  const since = zurichMidnight(dayKey(new Date()));
  if (!authConfigured()) return { since, members: [] };

  const users = await prisma.user.findMany({
    select: { id: true, handle: true, displayName: true, avatarPreset: true },
    orderBy: { createdAt: 'asc' }
  });

  const members = await Promise.all(
    users.map(async (u): Promise<MemberDay> => {
      const [dotaAcc, brawlAcc] = await Promise.all([
        activeAccount(u.id, 'DOTA2'),
        activeAccount(u.id, 'BRAWL_STARS')
      ]);
      const [dotaSnap, brawlSnap, dotaToday, brawlToday] = await Promise.all([
        dotaAcc ? lastSnapshot(dotaAcc.id) : null,
        brawlAcc ? lastSnapshot(brawlAcc.id) : null,
        dotaAcc ? matchesOf(dotaAcc.id, since) : [],
        brawlAcc ? matchesOf(brawlAcc.id, since) : []
      ]);
      return {
        handle: u.handle,
        displayName: u.displayName,
        avatarPreset: u.avatarPreset,
        me: u.id === viewerId,
        dota: {
          linked: Boolean(dotaAcc),
          profile: dotaSnap ? fromSnapshot(dotaSnap.payload) : null,
          today: dotaToday,
          totals: totals(dotaToday, 'DOTA2')
        },
        brawl: {
          linked: Boolean(brawlAcc),
          profile: brawlSnap ? fromBrawlSnapshot(brawlSnap.payload) : null,
          today: brawlToday,
          totals: totals(brawlToday, 'BRAWL_STARS')
        }
      };
    })
  );

  return { since, members };
}

/**
 * Всё, что аккаунт сыграл за последние дни, свежее первым. Для боковой колонки:
 * форма, неделя, режимы.
 */
export async function recentHistory(accountId: string, days = 7): Promise<BoardMatch[]> {
  if (!authConfigured()) return [];
  return matchesOf(accountId, new Date(Date.now() - days * 86_400_000));
}

/**
 * Свои бравлеры по накопленным боям — для личного почёта и позора.
 *
 * Supercell не отдаёт винрейт по бравлерам за всё время, только журнал
 * последних боёв. Поэтому считаем из того, что уже скопилось у нас в
 * `match_records`: с каждой синхронизацией история становится длиннее и
 * правдивее. Первую неделю цифры будут скромными, и на экране это видно по
 * числу боёв рядом с процентом.
 */
export async function ownBrawlers(accountId: string) {
  const rows = await prisma.matchRecord.groupBy({
    by: ['character', 'result'],
    where: { accountId, game: 'BRAWL_STARS', character: { not: null } },
    _count: { _all: true }
  });
  const byBrawler = new Map<number, { games: number; wins: number }>();
  for (const r of rows) {
    const id = Number(r.character);
    if (!Number.isFinite(id)) continue;
    const x = byBrawler.get(id) ?? { games: 0, wins: 0 };
    x.games += r._count._all;
    if (r.result === 'WIN') x.wins += r._count._all;
    byBrawler.set(id, x);
  }
  return [...byBrawler].map(([id, x]) => ({ id, ...x }));
}
