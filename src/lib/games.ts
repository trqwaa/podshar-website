import 'server-only';

import { prisma } from '@/lib/db';
import type { BrawlProfile, DotaProfile } from '@/lib/types';

/**
 * Где кто в доте, и сколько у кого кубков.
 *
 * Два источника, и обращаться с ними надо по-разному. OpenDota отвечает без
 * ключа и без ограничений по адресу — её можно спрашивать прямо отсюда. Brawl
 * Stars требует ключ Supercell, а ключ привязан к IP-адресу, которого у Vercel
 * нет: поэтому туда мы ходим через прокси RoyaleAPI с постоянным адресом. См.
 * `brawlProfile`.
 *
 * Здесь два забора, а не один, как у погоды и поездов, и второй появился после
 * замера. Первый: спрашивать OpenDota разрешено только из браузера, через
 * `/api/games`, и никогда из рендера: всё, что вызывается в `(app)/layout.tsx`,
 * ждёт **каждая страница сайта**, так что один медленный ответ подвесил бы
 * главную из-за плитки в закрытой шторке.
 *
 * Второй забор — снимки в базе. OpenDota отвечает то за четверть секунды, то за
 * одиннадцать (см. `TIMEOUT_MS`), и ходить туда на каждый показ означало бы
 * плитку, которая ведёт себя по-разному каждый раз. Поэтому шторка читает
 * `game_stat_snapshots`, а наружу мы выходим раз в полчаса. Таблица под это и
 * заводилась: она дописывается, а не перезаписывается, так что заодно
 * накапливается история — когда кто куда поднялся.
 */

/** Сколько держим ответ про игрока. Медаль меняется раз в неделю, не чаще. */
const PLAYER_TTL = 900;
/** Ссылку «красивое имя → номер» можно держать долго: имена почти не меняют. */
const VANITY_TTL = 86_400;

/**
 * Сколько ждём OpenDota, прежде чем считать, что не дождались.
 *
 * Двенадцать секунд, и это не запас на всякий случай, а замер. Три подряд
 * запроса к одному и тому же адресу: 11381 мс, 4911 мс, 271 мс. Это бесплатный
 * публичный сервис под нагрузкой, и разброс у него такой всегда. Стояло четыре
 * секунды — на глаз, по образцу SBB, — и привязка аккаунта падала с «не
 * ответила» на совершенно живом API.
 *
 * Ровно из-за этого разброса значения и лежат снимками в базе: ждать чужой
 * сервер разрешено один раз в полчаса и только в фоне, а не каждый раз, когда
 * кто-то открыл шторку.
 *
 * Девять, а не двенадцать и не двадцать, — потому что выше нас есть свой предел:
 * функция на Vercel живёт считанные секунды и будет прибита вместе с нашим
 * ожиданием. Лучше сдаться самим и сказать об этом в лог, чем быть убитыми на
 * середине без объяснений. Промах при этом дёшев: `Promise.race` не отменяет
 * запрос, ответ доезжает и ложится в кеш Next, так что следующий заход обычно
 * получает его мгновенно.
 */
const TIMEOUT_MS = 9000;

/**
 * Сколько ждёт форма привязки.
 *
 * Короче, потому что тут перед экраном сидит человек и смотрит на кнопку. Двенадцать
 * секунд «секунду…» читаются как зависший сайт, а не как медленный чужой сервер.
 * Не успели — привязка всё равно сохраняется, а ранг доберёт плитка, которую
 * никто в этот момент не ждёт.
 */
export const FORM_BUDGET_MS = 5000;

/**
 * Сколько снимок считается свежим.
 *
 * Полчаса — потому что меняться там почти нечему: медаль переставляют раз в
 * неделю, счёт побед — за вечер на пару единиц. Всё, что чаще, — это трата
 * чужого бесплатного сервиса и нашего же времени ожидания.
 */
const FRESH_MS = 30 * 60 * 1000;

/** Сколько последних матчей показывает полоска. Пять — просьба владельца. */
const RECENT = 5;

/** Гонка вместо `abort`: медленный ответ всё равно доедет и ляжет в кеш. */
async function ask(
  url: string,
  revalidate: number,
  budget = TIMEOUT_MS,
  extra: Record<string, string> = {}
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      fetch(url, {
        next: { revalidate },
        // Представляемся — не потому, что этого кто-то требует, а потому что
        // ходим к двум чужим бесплатным сервисам и по-хорошему должны быть
        // узнаваемы в их логах. Проверено, что Steam отдаёт одну и ту же
        // страницу с этим заголовком, с браузерным и вовсе без него: никакого
        // «сокращённого ответа для не-браузеров» тут нет.
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; podshar/1.0)', ...extra }
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`нет ответа за ${budget}ms`)), budget);
      })
    ]);
    if (!response.ok) throw new Error(`ответ ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/** Из 64-битного Steam ID — 32-битный, которым живёт вся дота. */
const STEAM_BASE = 76561197960265728n;
const toAccountId = (steam64: string) => String(BigInt(steam64) - STEAM_BASE);

/**
 * Что человек вставил в поле — в номер аккаунта.
 *
 * Принимает всё, что реально копируется из адресной строки: ссылку на Steam
 * любого из двух видов, ссылку на Dotabuff или OpenDota, или голый номер. Люди
 * вставляют то, что у них открыто, а не то, что удобно нам, и заставлять их
 * искать «тот самый» номер — верный способ, чтобы поле осталось пустым.
 *
 * Красивая ссылка (`/id/NelleT`) разбирается без ключа Steam: настоящий номер
 * лежит в самой странице профиля. Ключ понадобился бы только ради того же
 * значения, и его пришлось бы заводить, хранить и однажды чинить.
 */
export async function resolveSteam(input: string): Promise<string | null> {
  const text = input.trim();
  if (!text) return null;

  // Dotabuff и OpenDota уже показывают 32-битный номер в адресе.
  const direct = text.match(/(?:dotabuff\.com|opendota\.com)\/players\/(\d{1,12})/i);
  if (direct) return direct[1];

  const numeric = text.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (numeric) return toAccountId(numeric[1]);

  const vanity = text.match(/steamcommunity\.com\/id\/([^/?#\s]+)/i);
  if (vanity) {
    try {
      const page = await ask(`https://steamcommunity.com/id/${vanity[1]}`, VANITY_TTL);
      const html = await page.text();
      const found = html.match(/"steamid":"(\d{17})"/);
      return found ? toAccountId(found[1]) : null;
    } catch (error) {
      console.warn('[podshar] steam vanity lookup failed:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  // Голый номер: семнадцать цифр — это Steam64, всё короче — уже аккаунт.
  const bare = text.match(/^(\d{1,17})$/);
  if (bare) return bare[1].length === 17 ? toAccountId(bare[1]) : bare[1];

  return null;
}

/**
 * Ранг и счёт побед. `null` — если OpenDota не ответила.
 *
 * Пустой `rank_tier` — не сбой: так выглядит аккаунт, который не откалиброван,
 * или тот, у кого в настройках доты выключено «Expose Public Match Data». Мы
 * этого со своей стороны не чиним и не прячем: `medal: null` доезжает до экрана
 * и там говорится честно.
 */
export async function dotaProfile(
  accountId: string,
  budget = TIMEOUT_MS
): Promise<DotaProfile | null> {
  try {
    const who = await ask(
      `https://api.opendota.com/api/players/${accountId}`,
      PLAYER_TTL,
      budget
    ).then((r) => r.json());

    // Счёт побед — отдельным запросом, отдельной попыткой и половиной срока.
    // Он приятен, но не обязателен: два запроса подряд с полным сроком каждый
    // удваивают и время ожидания, и шанс, что медаль не покажется вообще.
    let record: { win?: unknown; lose?: unknown } = {};
    try {
      record = await ask(
        `https://api.opendota.com/api/players/${accountId}/wl`,
        PLAYER_TTL,
        Math.round(budget / 2)
      ).then((r) => r.json());
    } catch {
      // Медаль важнее счёта. Покажем её без цифр.
    }

    // Последние пять — третьим запросом и той же необязательной попыткой.
    // Победа считается так: слоты 0–127 — Radiant, 128 и выше — Dire. То есть
    // «мой слот меньше 128» должно совпасть с «Radiant выиграли». Сверено на
    // живых матчах, включая те, где человек был за Dire и Dire проиграли.
    let recent: boolean[] = [];
    try {
      const games = await ask(
        `https://api.opendota.com/api/players/${accountId}/matches?limit=${RECENT}`,
        PLAYER_TTL,
        Math.round(budget / 2)
      ).then((r) => r.json());
      if (Array.isArray(games)) {
        recent = games
          .filter((g) => Number.isFinite(g?.player_slot) && typeof g?.radiant_win === 'boolean')
          .slice(0, RECENT)
          .map((g) => (g.player_slot < 128) === g.radiant_win);
      }
    } catch {
      // Полоски просто не будет. Медаль важнее.
    }

    const tier = Number.isFinite(who?.rank_tier) ? Number(who.rank_tier) : null;
    const medal = tier ? Math.floor(tier / 10) : null;

    return {
      recent,
      accountId,
      name: typeof who?.profile?.personaname === 'string' ? who.profile.personaname : null,
      // Адрес, а не файл у себя: аватарка меняется вместе со стимовской, и
      // копия у нас устарела бы в тот же день.
      avatar: typeof who?.profile?.avatarfull === 'string' ? who.profile.avatarfull : null,
      medal: medal && medal >= 1 && medal <= 8 ? medal : null,
      // У Immortal единицы всегда ноль, так что отдельного случая не нужно.
      stars: tier ? tier % 10 : 0,
      leaderboard: Number.isFinite(who?.leaderboard_rank) ? Number(who.leaderboard_rank) : null,
      wins: Number.isFinite(record?.win) ? Number(record.win) : 0,
      losses: Number.isFinite(record?.lose) ? Number(record.lose) : 0
    };
  } catch (error) {
    console.warn('[podshar] opendota did not answer:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Аккаунт, который сейчас показывается.
 *
 * Их может быть несколько — берётся отмеченный, а если отметки нет ни на одном
 * (запись из тех времён, когда аккаунт был один), то самый свежий.
 */
async function activeAccount(userId: string, game: 'DOTA2' | 'BRAWL_STARS') {
  return prisma.gameAccount.findFirst({
    where: { userId, game },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, externalId: true, tag: true }
  });
}

/** Последний снимок и не пора ли за новым. */
async function lastSnapshot(accountId: string) {
  const newest = await prisma.gameStatSnapshot.findFirst({
    where: { accountId },
    orderBy: { capturedAt: 'desc' },
    select: { capturedAt: true, payload: true }
  });
  return {
    payload: newest?.payload ?? null,
    fresh: Boolean(newest && Date.now() - newest.capturedAt.getTime() < FRESH_MS)
  };
}

/**
 * Запомнить ник, который узнали по дороге.
 *
 * Он нужен списку аккаунтов в профиле, а форме не по карману: у неё пять секунд,
 * а у этих сервисов бывает шестнадцать. Здесь ответ уже в руках.
 */
async function rememberName(accountId: string, was: string | null, now: string | null) {
  if (!now || now === was) return;
  await prisma.gameAccount
    .update({ where: { id: accountId }, data: { tag: now } })
    .catch((error) => console.warn('[podshar] game name not saved:', error));
}

/**
 * Снимок обратно в профиль.
 *
 * Целиком лежит в `payload` — поля `mmr`/`cups` в таблице заводились под числа,
 * которых у доты не оказалось. `rankTier` и `winRate` дублируются рядом
 * отдельными колонками не ради показа, а чтобы однажды можно было спросить базу
 * «когда он поднялся до Divine», не разбирая JSON в каждой строке.
 */
function fromSnapshot(payload: unknown): DotaProfile | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (!('stars' in p) || !('wins' in p)) return null;
  return {
    accountId: typeof p.accountId === 'string' ? p.accountId : '',
    name: typeof p.name === 'string' ? p.name : null,
    avatar: typeof p.avatar === 'string' ? p.avatar : null,
    medal: typeof p.medal === 'number' ? p.medal : null,
    stars: typeof p.stars === 'number' ? p.stars : 0,
    leaderboard: typeof p.leaderboard === 'number' ? p.leaderboard : null,
    wins: typeof p.wins === 'number' ? p.wins : 0,
    losses: typeof p.losses === 'number' ? p.losses : 0,
    // Снимки, снятые до появления полоски, этого поля не несут — пустой список
    // честнее, чем выдуманный.
    recent: Array.isArray(p.recent) ? p.recent.filter((v) => typeof v === 'boolean') : []
  };
}

/** Записать, что мы увидели. Таблица только дописывается — это история, не кеш. */
export async function rememberDota(accountId: string, player: DotaProfile) {
  const played = player.wins + player.losses;
  await prisma.gameStatSnapshot.create({
    data: {
      accountId,
      game: 'DOTA2',
      rankTier: player.medal ? String(player.medal * 10 + player.stars) : null,
      winRate: played ? player.wins / played : null,
      payload: { ...player }
    }
  });
}

/**
 * Где человек в доте — из нашей базы, и только изредка из OpenDota.
 *
 * Порядок тут и есть всё решение. Свежий снимок отдаётся сразу, без сети:
 * открыть шторку стоит одного запроса к своей же базе. Протух — идём наружу, но
 * ждать приходится тому, кто открыл шторку, а не всей странице.
 *
 * И главное: если OpenDota не ответила, отдаётся **прошлый** снимок, а не
 * пустота. Медаль недельной давности — это почти наверняка сегодняшняя медаль,
 * а «opendota молчит» на её месте было бы правдой про наш запрос и неправдой
 * про человека.
 */
export async function currentDota(
  userId: string
): Promise<{ player: DotaProfile | null; linked: boolean }> {
  const account = await activeAccount(userId, 'DOTA2');
  if (!account) return { player: null, linked: false };

  const { payload, fresh } = await lastSnapshot(account.id);
  const stored = fromSnapshot(payload);
  if (stored && fresh) return { player: stored, linked: true };

  const found = await dotaProfile(account.externalId);
  if (!found) return { player: stored, linked: true };

  await rememberDota(account.id, found).catch((error) => {
    // Не показать из-за незаписанного снимка было бы глупо: значение у нас уже
    // в руках, а не сохранилось — значит просто сходим за ним ещё раз позже.
    console.warn('[podshar] dota snapshot not saved:', error);
  });
  await rememberName(account.id, account.tag, found.name);
  return { player: found, linked: true };
}

/** То же для Brawl Stars: свежий снимок из базы, иначе один поход наружу. */
export async function currentBrawl(
  userId: string
): Promise<{ player: BrawlProfile | null; linked: boolean }> {
  const account = await activeAccount(userId, 'BRAWL_STARS');
  if (!account) return { player: null, linked: false };

  const { payload, fresh } = await lastSnapshot(account.id);
  const stored = fromBrawlSnapshot(payload);
  if (stored && fresh) return { player: stored, linked: true };

  const found = await brawlProfile(account.externalId);
  if (!found) return { player: stored, linked: true };

  await rememberBrawl(account.id, found).catch((error) => {
    console.warn('[podshar] brawl snapshot not saved:', error);
  });
  await rememberName(account.id, account.tag, found.name);
  return { player: found, linked: true };
}

/**
 * Brawl Stars — через прокси, и только через него.
 *
 * Ключ Supercell привязан к IP-адресу, а у Vercel постоянного адреса нет:
 * функция каждый раз выезжает с нового. RoyaleAPI держит прокси с постоянным
 * адресом ровно под этот случай, и в ключе разрешён именно он. Проверено обеими
 * сторонами: через прокси приходит 200, напрямую — 403 `accessDenied.invalidIp`.
 * То есть утёкший ключ работать откуда попало не будет, и это не предположение.
 */
const BRAWL = 'https://bsproxy.royaleapi.dev/v1';

/** True, когда есть чем представиться. Без ключа плитка честно молчит. */
export const brawlConfigured = () => Boolean(process.env.BRAWL_STARS_API_TOKEN);

/**
 * Тег игрока из того, что человек вставил.
 *
 * Решётку в игре показывают, а в адресе она значит другое, поэтому её тут и
 * снимают, и ставят обратно уже при запросе. Регистр приводится к верхнему:
 * теги пишутся заглавными, а копируют их как придётся.
 */
export function normalizeTag(input: string): string | null {
  const tag = input.trim().replace(/^[#%23]+/, '').toUpperCase();
  return /^[A-Z0-9]{3,15}$/.test(tag) ? tag : null;
}

/**
 * Выиграл ли бой.
 *
 * В командных режимах игра прямо говорит `victory` или `defeat`. В «выживании»
 * результата нет, есть место — и победой там считается попадание в верхнюю
 * половину, ровно как игра начисляет за него кубки. Ничьи и всё непонятное
 * выбрасываются: полоска должна отвечать «выиграл или нет», а не «было сложно».
 */
function battleWon(battle: Record<string, unknown> | undefined): boolean | null {
  if (!battle) return null;
  if (battle.result === 'victory') return true;
  if (battle.result === 'defeat') return false;
  if (typeof battle.rank === 'number') {
    return battle.rank <= (battle.mode === 'duoShowdown' ? 2 : 4);
  }
  return null;
}

/** Профиль и последние бои. `null` — если ключа нет или API не ответило. */
export async function brawlProfile(
  tag: string,
  budget = TIMEOUT_MS
): Promise<BrawlProfile | null> {
  const token = process.env.BRAWL_STARS_API_TOKEN;
  if (!token) return null;

  const headers = { authorization: `Bearer ${token}` };
  const at = (path: string) => `${BRAWL}/players/%23${encodeURIComponent(tag)}${path}`;

  try {
    const who = await ask(at(''), PLAYER_TTL, budget, headers).then((r) => r.json());

    // Журнал боёв — отдельной попыткой и половиной срока, как счёт побед в доте.
    // Кубки важнее полоски.
    let recent: boolean[] = [];
    let decided: boolean[] = [];
    try {
      const log = await ask(at('/battlelog'), PLAYER_TTL, Math.round(budget / 2), headers).then(
        (r) => r.json()
      );
      if (Array.isArray(log?.items)) {
        decided = log.items
          .map((x: { battle?: Record<string, unknown> }) => battleWon(x?.battle))
          .filter((v: boolean | null): v is boolean => v !== null);
        recent = decided.slice(0, RECENT);
      }
    } catch {
      // Без полоски и без винрейта, но с кубками.
    }

    return {
      tag,
      name: typeof who?.name === 'string' ? who.name : null,
      trophies: Number.isFinite(who?.trophies) ? Number(who.trophies) : 0,
      highest: Number.isFinite(who?.highestTrophies) ? Number(who.highestTrophies) : 0,
      rank: typeof who?.rankedRankName === 'string' ? who.rankedRankName : null,
      rankTier: Number.isFinite(who?.rankedRank) ? Number(who.rankedRank) : null,
      club: typeof who?.club?.name === 'string' && who.club.name ? who.club.name : null,
      recent,
      // Весь журнал, а не только пятёрка из полоски: винрейт по пяти боям
      // прыгает на двадцать процентов от одного матча и ничего не значит.
      recentWins: decided.filter(Boolean).length,
      recentPlayed: decided.length
    };
  } catch (error) {
    console.warn(
      '[podshar] brawl stars did not answer:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/** Снимок Brawl Stars обратно в профиль. Кубки продублированы колонкой: под них
 *  в таблице заведено отдельное поле, и однажды по нему захочется построить
 *  график, не разбирая JSON в каждой строке. */
function fromBrawlSnapshot(payload: unknown): BrawlProfile | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (!('trophies' in p)) return null;
  return {
    tag: typeof p.tag === 'string' ? p.tag : '',
    name: typeof p.name === 'string' ? p.name : null,
    trophies: typeof p.trophies === 'number' ? p.trophies : 0,
    highest: typeof p.highest === 'number' ? p.highest : 0,
    rank: typeof p.rank === 'string' ? p.rank : null,
    rankTier: typeof p.rankTier === 'number' ? p.rankTier : null,
    club: typeof p.club === 'string' ? p.club : null,
    recent: Array.isArray(p.recent) ? p.recent.filter((v) => typeof v === 'boolean') : [],
    recentWins: typeof p.recentWins === 'number' ? p.recentWins : 0,
    recentPlayed: typeof p.recentPlayed === 'number' ? p.recentPlayed : 0
  };
}

export async function rememberBrawl(accountId: string, player: BrawlProfile) {
  await prisma.gameStatSnapshot.create({
    data: {
      accountId,
      game: 'BRAWL_STARS',
      cups: player.trophies,
      highestCups: player.highest,
      rankTier: player.rank,
      payload: { ...player }
    }
  });
}
