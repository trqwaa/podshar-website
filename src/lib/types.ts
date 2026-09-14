/**
 * Shapes shared between server data access and client components.
 *
 * These live here rather than in a component file so `session.ts` (which is
 * `server-only`) never has to import from a `'use client'` module to get a type.
 */

export type MemberProfile = {
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  /** One of the built-in marks, or null for initials. */
  avatarPreset?: string | null;
};

/**
 * Где человек стоит в доте.
 *
 * Числового MMR здесь нет и быть не может: Valve не отдаёт его наружу никому —
 * ни нам, ни Dotabuff, ни OpenDota. Настоящие величины — медаль со звёздами и,
 * только у Immortal, место в таблице.
 */
export type DotaProfile = {
  /** Номер аккаунта. Нужен ссылке наружу — на Stratz и Dotabuff. */
  accountId: string;
  /** Ник в Steam — чтобы было видно, что нашёлся тот человек. */
  name: string | null;
  /** Аватарка из Steam. Меняется вместе со стимовской, потому и адрес, а не файл. */
  avatar: string | null;
  /** 1–8: Herald … Immortal. `null` — ранга нет, аккаунт не откалиброван. */
  medal: number | null;
  /** 0–5. У Immortal звёзд не бывает. */
  stars: number;
  /** Место в таблице. Есть только у Immortal. */
  leaderboard: number | null;
  wins: number;
  losses: number;
  /**
   * Последние матчи, свежий первым: `true` — выиграл.
   *
   * Массив, а не пара чисел, потому что смысл тут в порядке: «в в п в п»
   * говорит, как идёт сегодня, а «338 / 339» — как шло всегда. Пустой, если
   * список матчей не доехал; на экране тогда просто нет полоски.
   */
  recent: boolean[];
};

/** One person, as the "who is here" tile sees them. */
export type PresenceEntry = {
  handle: string;
  displayName: string;
  avatarPreset: string | null;
  /** Epoch milliseconds, or null for someone not seen since this was built. */
  lastSeen: number | null;
};

/** One way home from Zürich HB, as SBB reports it. */
export type Departure = {
  /** What is written on the train: "S11", "IC 5". */
  line: string;
  /** Scheduled departure, epoch milliseconds. */
  departs: number;
  /** Minutes late as SBB reports it; 0 when on time or not known. */
  delay: number;
  platform: string | null;
  arrives: number;
  transfers: number;
};

/** One person's row in the train tile. */
export type TrainRow = {
  handle: string;
  displayName: string;
  avatarPreset: string | null;
  /** Their home station's name, or null if they have not set one. */
  station: string | null;
  /** Their station is Zürich HB itself — there is no train to catch. */
  atHB: boolean;
  /** The next few connections, soonest first. */
  departures: Departure[];
  /** SBB was asked and did not answer. */
  failed: boolean;
};

/**
 * Где человек в Brawl Stars.
 *
 * Кубки тут — это `trophies`, сумма по всем бравлерам; то самое число, которым
 * меряются. Ранг (`MYTHIC III`) — из режима ranked, он ближе всего к медали в
 * доте: не накапливается, а показывает, где ты сейчас.
 */
export type BrawlProfile = {
  /** Тег игрока без решётки. Нужен ссылке наружу. */
  tag: string;
  name: string | null;
  trophies: number;
  /** Личный рекорд по кубкам. Совпадает с текущими, пока не начнёшь падать. */
  highest: number;
  /** Название ранга, как его пишет игра. `null` — если в ranked не играл. */
  rank: string | null;
  /** Тот же ранг числом, 1–22. По нему выбирается значок. */
  rankTier: number | null;
  club: string | null;
  /** Последние бои, свежий первым. Пустой, если журнал не доехал. */
  recent: boolean[];
  /**
   * Победы и всего боёв — **по журналу последних боёв**, а не за всё время.
   *
   * За всё время посчитать нельзя: Supercell отдаёт победы (`3vs3Victories` и
   * прочие), но поражений не отдаёт вовсе. Журнал — единственное место, где
   * рядом лежат и те и другие. Поэтому число это про «как идёт сейчас», и
   * подпись под ним обязана это говорить.
   */
  recentWins: number;
  recentPlayed: number;
};
