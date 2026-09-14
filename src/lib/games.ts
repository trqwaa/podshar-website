import 'server-only';

import { prisma } from '@/lib/db';
import type { DotaProfile } from '@/lib/types';

/**
 * Где кто в доте, и сколько у кого кубков.
 *
 * Пока только дота. OpenDota отвечает без ключа и без ограничений по адресу —
 * её можно спрашивать прямо отсюда. Brawl Stars ждёт ключа Supercell, и ключ там
 * привязан к IP-адресу, которого у Vercel нет: придётся идти через прокси
 * RoyaleAPI, у которого адрес постоянный. Проверено, что прокси отвечает; сам
 * ключ владелец ещё не завёл.
 *
 * Здесь два забора, а не один, как у погоды и поездов, и второй появился после
 * замера. Первый: спрашивать OpenDota разрешено только из браузера, через
 * `/api/games`, и никогда из рендера — `getQuickStats` ждёт **вся страница**
 * (он вызывается в `(app)/layout.tsx`), так что один медленный ответ подвесил
 * бы главную из-за плитки в закрытой шторке.
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
async function ask(url: string, revalidate: number, budget = TIMEOUT_MS) {
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
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; podshar/1.0)' }
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
      name: typeof who?.profile?.personaname === 'string' ? who.profile.personaname : null,
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
    name: typeof p.name === 'string' ? p.name : null,
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
  // Аккаунтов у человека может быть несколько — показывается отмеченный. Если
  // отметки нет ни на одном (старая запись), берётся самый свежий.
  const account = await prisma.gameAccount.findFirst({
    where: { userId, game: 'DOTA2' },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, externalId: true, tag: true }
  });
  if (!account) return { player: null, linked: false };

  const newest = await prisma.gameStatSnapshot.findFirst({
    where: { accountId: account.id },
    orderBy: { capturedAt: 'desc' },
    select: { capturedAt: true, payload: true }
  });
  const stored = newest ? fromSnapshot(newest.payload) : null;

  if (stored && Date.now() - newest!.capturedAt.getTime() < FRESH_MS) {
    return { player: stored, linked: true };
  }

  const fresh = await dotaProfile(account.externalId);
  if (!fresh) return { player: stored, linked: true };

  await rememberDota(account.id, fresh).catch((error) => {
    // Не показать из-за незаписанного снимка было бы глупо: значение у нас уже
    // в руках, а не сохранилось — значит просто сходим за ним ещё раз позже.
    console.warn('[podshar] dota snapshot not saved:', error);
  });

  // Ник заодно. Он нужен списку аккаунтов в профиле, а форме он не по карману:
  // у неё пять секунд, а у этого сервиса бывает шестнадцать. Здесь ответ уже в
  // руках, и записать имя стоит одного запроса к своей базе.
  if (fresh.name && fresh.name !== account.tag) {
    await prisma.gameAccount
      .update({ where: { id: account.id }, data: { tag: fresh.name } })
      .catch((error) => console.warn('[podshar] dota name not saved:', error));
  }

  return { player: fresh, linked: true };
}
