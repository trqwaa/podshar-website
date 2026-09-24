import 'server-only';

import { prisma } from '@/lib/db';
import { authConfigured } from '@/lib/auth/config';
import { BRAWL, ask, battleTime } from '@/lib/games';
import { brawler } from '@/lib/game-catalog';

/**
 * Мета Brawl Stars — посчитанная нами, потому что взять её негде.
 *
 * Готовой статистики нет ни у кого, кто отдаёт её серверу. Supercell меты не
 * публикует вовсе. Brawlify публикует, но `api.brawlify.com` отвечает серверам
 * 403 — он за защитой от ботов, — а старый адрес `api.brawlapi.com` отдаёт
 * пустые `stats` у всех 1300 карт (проверено 24 сентября 2026: `dataUpdated: 0`
 * везде). То есть любая «мета бравла» на нашем сайте была бы либо выдумана,
 * либо украдена со страницы, которая этого не разрешает.
 *
 * Поэтому считаем сами, из официального API: топ-50 мира и их журналы последних
 * боёв. Это около тысячи боёв и шести тысяч выходов бравлеров — честная выборка
 * «что играют и на чём выигрывают лучшие прямо сейчас». Не мета всех игроков,
 * а мета верха; на экране так и подписано.
 *
 * Считается не чаще раза в шесть часов, в фоне, и ложится в `meta_hero_stats` —
 * таблицу, которая стояла в схеме с первого дня. Страница читает только её.
 */

const TOP_PLAYERS = 50;
const EVERY_MS = 6 * 3600 * 1000;
/** Бои старше двух суток — уже не «сейчас»: баланс-патч мог выйти вчера. */
const WINDOW_MS = 48 * 3600 * 1000;
const BUDGET = 8000;
const BRACKET = 'top50';
/**
 * Служебная строка выборки. `pickRate` в ней — число боёв, `winRate` — число
 * опрошенных игроков. Отдельной таблицы под два числа не заводим: схема общая
 * на троих, а эти два числа нужны только чтобы честно подписать размер выборки.
 */
const SAMPLE_KEY = '_sample';

export const brawlMetaAvailable = () => Boolean(process.env.BRAWL_STARS_API_TOKEN);

type Brawler = { id: number; name: string; hasIcon: boolean };

/**
 * Пересчитать мету, если пора.
 *
 * Вызывается из фоновой синхронизации доски, после ответа. Сначала — «застолбить»
 * пересчёт под блокировкой: два человека, открывших доску одновременно, иначе
 * оба пошли бы опрашивать пятьдесят игроков, и Supercell увидел бы сто запросов
 * вместо пятидесяти.
 */
export async function refreshBrawlMeta(): Promise<void> {
  const token = process.env.BRAWL_STARS_API_TOKEN;
  if (!token) return;

  const now = Date.now();
  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('podshar:brawl-meta'))`;
    const last = await tx.metaHeroStat.findFirst({
      where: { game: 'BRAWL_STARS', heroKey: SAMPLE_KEY, bracket: BRACKET },
      orderBy: { capturedAt: 'desc' },
      select: { capturedAt: true }
    });
    if (last && now - last.capturedAt.getTime() < EVERY_MS) return false;
    // Застолбили: маркер с «сейчас» — пока выборка идёт, остальные её не начнут.
    await tx.metaHeroStat.create({
      data: {
        game: 'BRAWL_STARS',
        heroKey: SAMPLE_KEY,
        bracket: BRACKET,
        patch: `claim:${now}`,
        winRate: 0,
        pickRate: 0
      }
    });
    return true;
  });
  if (!claimed) return;

  // Не вышло — метку не оставляем на шесть часов, а сдвигаем так, чтобы повтор
  // был через полчаса. Иначе один неответивший Supercell (или протухший ключ)
  // оставлял бы доску без меты до вечера, а первая выборка на проде — до утра.
  const giveUp = async (why: string) => {
    console.warn(`[podshar] brawl meta: ${why}, повтор через полчаса`);
    await prisma.metaHeroStat
      .updateMany({
        where: {
          game: 'BRAWL_STARS',
          heroKey: SAMPLE_KEY,
          bracket: BRACKET,
          patch: `claim:${now}`
        },
        data: { capturedAt: new Date(now - EVERY_MS + 30 * 60_000) }
      })
      .catch(() => {});
  };

  const headers = { authorization: `Bearer ${token}` };
  const top = await ask(`${BRAWL}/rankings/global/players?limit=${TOP_PLAYERS}`, 0, BUDGET, headers)
    .then((r) => r.json())
    .catch(() => null);
  const tags: string[] = Array.isArray(top?.items)
    ? top.items
        .map((p: { tag?: unknown }) => p?.tag)
        .filter((t: unknown): t is string => typeof t === 'string')
    : [];
  if (!tags.length) return giveUp('топ игроков не пришёл');

  // По восемь одновременно: быстрее, чем по одному, и вежливее, чем все пятьдесят разом.
  const logs: unknown[] = [];
  for (let i = 0; i < tags.length; i += 8) {
    const batch = await Promise.all(
      tags.slice(i, i + 8).map((tag) =>
        ask(`${BRAWL}/players/${encodeURIComponent(tag)}/battlelog`, 0, BUDGET, headers)
          .then((r) => r.json())
          .then((log) => ({ tag, items: Array.isArray(log?.items) ? log.items : [] }))
          .catch(() => null)
      )
    );
    logs.push(...batch.filter(Boolean));
  }

  const seen = new Set<string>();
  const tally = new Map<number, { games: number; wins: number }>();
  let battles = 0;

  for (const log of logs as { tag: string; items: unknown[] }[]) {
    for (const item of log.items) {
      const x = item as { battleTime?: unknown; battle?: Record<string, unknown> };
      const at = battleTime(x?.battleTime);
      const battle = x?.battle;
      // Только командные бои с явным исходом: в «выживании» победитель один из
      // десяти, и винрейт там значит другое. Смешивать — значит врать про обоих.
      if (!at || now - at > WINDOW_MS || !battle || !Array.isArray(battle.teams)) continue;
      if (battle.result !== 'victory' && battle.result !== 'defeat') continue;

      const teams = battle.teams as { tag?: string; brawler?: { id?: number } }[][];
      // Один и тот же бой лежит в журналах у всех топов, которые в нём были.
      const key = `${at}:${teams
        .flat()
        .map((p) => p.tag)
        .sort()
        .join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      battles += 1;

      const mine = teams.findIndex((team) => team.some((p) => p.tag === log.tag));
      if (mine < 0) continue;
      teams.forEach((team, i) => {
        const won = (i === mine) === (battle.result === 'victory');
        for (const p of team) {
          const id = p?.brawler?.id;
          if (typeof id !== 'number') continue;
          const row = tally.get(id) ?? { games: 0, wins: 0 };
          row.games += 1;
          if (won) row.wins += 1;
          tally.set(id, row);
        }
      });
    }
  }
  if (!battles) return giveUp('ни одного подходящего боя');

  const patch = new Date(now).toISOString().slice(0, 13);
  await prisma.$transaction([
    // Держим неделю выборок — хватит, чтобы однажды нарисовать, кто как рос.
    prisma.metaHeroStat.deleteMany({
      where: {
        game: 'BRAWL_STARS',
        bracket: BRACKET,
        capturedAt: { lt: new Date(now - 7 * 86_400_000) }
      }
    }),
    prisma.metaHeroStat.deleteMany({
      where: {
        game: 'BRAWL_STARS',
        bracket: BRACKET,
        heroKey: SAMPLE_KEY,
        patch: { startsWith: 'claim:' }
      }
    }),
    prisma.metaHeroStat.createMany({
      skipDuplicates: true,
      data: [
        {
          game: 'BRAWL_STARS',
          heroKey: SAMPLE_KEY,
          bracket: BRACKET,
          patch,
          winRate: logs.length,
          pickRate: battles
        },
        ...[...tally].map(([id, t]) => ({
          game: 'BRAWL_STARS' as const,
          heroKey: String(id),
          bracket: BRACKET,
          patch,
          winRate: t.wins / t.games,
          // Доля боёв, где этот бравлер был хоть у кого-то из шестерых.
          pickRate: t.games / battles
        }))
      ]
    })
  ]);
  console.log(
    `[podshar] brawl meta: ${battles} боёв у ${logs.length} игроков, ${tally.size} бравлеров`
  );
}

export type MetaBrawler = Brawler & { winRate: number; pickRate: number; games: number };

export type BrawlMeta = { battles: number; players: number; at: Date; brawlers: MetaBrawler[] };

/** Последняя посчитанная выборка. `null` — ещё ни разу не считали. */
export async function brawlMeta(): Promise<BrawlMeta | null> {
  // Без базы — разработка без DATABASE_URL, где сайт нарочно открыт гостем.
  // Остальная доска там честно пустая, и мета не должна ронять её запросом в
  // базу, которой нет.
  if (!authConfigured()) return null;
  const sample = await prisma.metaHeroStat.findFirst({
    where: {
      game: 'BRAWL_STARS',
      bracket: BRACKET,
      heroKey: SAMPLE_KEY,
      NOT: { patch: { startsWith: 'claim:' } }
    },
    orderBy: { capturedAt: 'desc' }
  });
  if (!sample) return null;

  const rows = await prisma.metaHeroStat.findMany({
    where: {
      game: 'BRAWL_STARS',
      bracket: BRACKET,
      patch: sample.patch,
      NOT: { heroKey: SAMPLE_KEY }
    }
  });

  const battles = Math.round(sample.pickRate);
  return {
    battles,
    players: Math.round(sample.winRate),
    at: sample.capturedAt,
    brawlers: rows.map((r) => {
      const id = Number(r.heroKey);
      return {
        ...brawler(id),
        winRate: r.winRate,
        pickRate: r.pickRate,
        games: Math.round(r.pickRate * battles)
      };
    })
  };
}

/** Бравлеры, которых видели меньше чем в двадцати боях, в мету и в позор не попадают: это шум. */
const MIN_GAMES = 20;

export const brawlMetaList = (m: BrawlMeta) =>
  m.brawlers.filter((b) => b.games >= MIN_GAMES).sort((a, b) => b.winRate - a.winRate);

export const brawlShameList = (m: BrawlMeta, count = 12) =>
  m.brawlers
    .filter((b) => b.games >= MIN_GAMES)
    .sort((a, b) => a.winRate - b.winRate)
    .slice(0, count);

export const brawlHonourList = (m: BrawlMeta, count = 10) => brawlMetaList(m).slice(0, count);
