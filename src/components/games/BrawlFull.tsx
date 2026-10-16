import { getTranslations } from 'next-intl/server';

import { BrawlerIcon, Pct, Segmented, TierBadge, winTone } from '@/components/games/bits';
import { brawlMode, percent } from '@/components/games/format';
import type { Tab } from '@/components/games/DotaFull';
import type { Locale } from '@/i18n/routing';
import {
  SEEMETA,
  brawlHonourList,
  brawlMeta,
  brawlMetaList,
  brawlShameList,
  mapNamer,
  mapsByMode,
  type BrawlMeta,
  type MetaBrawler,
  type TierBrawler
} from '@/lib/brawl-meta';
import { brawler } from '@/lib/game-catalog';
import { boardFor, ownBrawlers, recentHistory } from '@/lib/games-board';
import { History } from '@/components/games/History';

/** С какого числа боёв на бравлере его можно судить. Меньше, чем в доте: боёв у бравла больше и они короче. */
const OWN_MIN = 3;

/**
 * Бравл целиком: мета рангового и по картам, позор, почёт и своё.
 *
 * Мета — с SeeMeta (см. `lib/brawl-meta.ts`, почему не своя): общий тир-лист
 * ранкеда, а под ним каждая карта рангового со своими лучшими. В бравле
 * сильный бравлер — это сильный на карте: кто тащит ограбление, тот сливает
 * кристаллы, и одна общая таблица врёт про обе. Карта раскрывается
 * `<details>`, без единой строки JavaScript, как сборки у доты: карт три
 * десятка, а открывать будут ту, на которой сейчас играют.
 */
export async function BrawlFull({
  locale,
  userId,
  tab
}: {
  locale: Locale;
  userId: string;
  tab: Tab;
}) {
  const [t, board, meta, mapName] = await Promise.all([
    getTranslations({ locale, namespace: 'gamesBoard' }),
    boardFor(userId),
    brawlMeta(),
    mapNamer(locale)
  ]);
  const modeLabel = (mode: string) => brawlMode(t, mode);
  const [mine, week] = board.brawl.account
    ? await Promise.all([ownBrawlers(board.brawl.account.id), recentHistory(board.brawl.account.id)])
    : [[], []];

  const list = meta
    ? tab === 'meta'
      ? brawlMetaList(meta)
      : tab === 'shame'
        ? brawlShameList(meta)
        : brawlHonourList(meta)
    : [];
  const hint = tab === 'meta' ? t('metaHint') : tab === 'shame' ? t('shameHint') : t('honourHint');

  const judged = mine.filter((b) => b.games >= OWN_MIN);
  const ownList =
    tab === 'shame'
      ? [...judged].sort((a, b) => a.wins / a.games - b.wins / b.games).slice(0, 5)
      : tab === 'honour'
        ? [...judged].sort((a, b) => b.wins / b.games - a.wins / a.games).slice(0, 5)
        : [...mine].sort((a, b) => b.games - a.games).slice(0, 5);
  const ownTitle =
    tab === 'shame' ? t('ownShame') : tab === 'honour' ? t('ownHonour') : t('yourStats');
  const seen = mine.reduce((sum, b) => sum + b.games, 0);
  const profile = board.brawl.profile;

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4">
      <section className="block-card animate-rise-in p-6 [animation-delay:60ms]">
        <Segmented
          label={t('tabsLabel')}
          items={(['meta', 'shame', 'honour'] as Tab[]).map((x) => ({
            href: `/games?view=brawl&tab=${x}`,
            text: t(`tabs.${x}`),
            active: x === tab
          }))}
        />
      </section>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
          <section className="block-card animate-rise-in flex flex-col gap-3 p-6 [animation-delay:120ms]">
            <div>
              <h2 className="text-xl font-semibold leading-tight text-ink">{t(`tabs.${tab}`)}</h2>
              <p className="ps-label mt-2 normal-case">
                {hint}
                {meta ? (
                  <>
                    {' · '}
                    <Source meta={meta} locale={locale} />
                  </>
                ) : null}
              </p>
            </div>
            {!meta ? (
              <p className="text-base text-ink-muted">{t('brawlMetaMissing')}</p>
            ) : (
              <ol className="flex flex-col">
                {list.map((b, i) => (
                  <TierRow
                    key={b.slug}
                    brawler={b}
                    index={i}
                    locale={locale}
                    tierLabel={t('tier')}
                    modesLabel={t('bestModes')}
                    mapsLabel={t('bestMaps')}
                    modeName={modeLabel}
                    mapName={mapName}
                  />
                ))}
              </ol>
            )}
          </section>

          {tab === 'meta' && meta ? <ByMap meta={meta} locale={locale} mapName={mapName} /> : null}
        </div>

        <aside className="block-card animate-rise-in flex flex-col gap-3 self-start p-6 [animation-delay:180ms] lg:sticky lg:top-20">
          <h2 className="text-lg font-semibold leading-tight text-ink">{ownTitle}</h2>
          {tab === 'meta' && profile ? (
            <p className="text-base text-ink">
              <span className="font-semibold tabular-nums">
                {profile.trophies.toLocaleString(locale)}
              </span>{' '}
              <span className="text-ink-muted">
                {t('trophiesUnit', { n: profile.trophies })} · {t('peak', { peak: profile.highest })}
              </span>
              {profile.recentPlayed ? (
                <>
                  <br />
                  <Pct locale={locale} value={profile.recentWins / profile.recentPlayed} />{' '}
                  <span className="text-sm text-ink-muted">
                    {t('recentWinrate', { played: profile.recentPlayed })}
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
          {tab !== 'meta' ? (
            <p className="ps-label">
              {tab === 'shame'
                ? t('ownShameHint', { min: OWN_MIN })
                : t('ownHonourHint', { min: OWN_MIN })}
            </p>
          ) : null}
          {ownList.length === 0 ? (
            <p className="text-base text-ink-faint">
              {board.brawl.account ? t('ownNone') : t('notLinked')}
            </p>
          ) : (
            <ul className="flex flex-col">
              {ownList.map((b, i) => {
                const known = brawler(b.id);
                return (
                  <li
                    key={b.id}
                    className={`flex items-center gap-3 py-2 ${i > 0 ? 'ps-rule' : ''}`}
                  >
                    <BrawlerIcon brawler={known} size={28} />
                    <span className="min-w-0 flex-1 truncate text-base font-medium normal-case text-ink">
                      {known.name}
                    </span>
                    <span className="text-sm tabular-nums text-ink-muted">
                      {t('ownGames', { games: b.games })}
                    </span>
                    <Pct locale={locale} value={b.wins / b.games} className="text-sm" />
                  </li>
                );
              })}
            </ul>
          )}
          {board.brawl.account ? (
            <History game="BRAWL_STARS" recent={board.brawl.recent} matches={week} locale={locale} />
          ) : null}
          {seen ? <p className="ps-label pt-2">{t('brawlOwnNote', { n: seen })}</p> : null}
        </aside>
      </div>
    </div>
  );
}

/**
 * Откуда цифры: SeeMeta, сколько ранговых боёв и за какой период. Со ссылкой —
 * данные чужие, и это должно быть видно, а не мелким шрифтом где-то внизу.
 */
async function Source({ meta, locale }: { meta: BrawlMeta; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'gamesBoard' });
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${iso}T12:00:00Z`)
    );
  const link = (chunks: React.ReactNode) => (
    <a
      href={`${SEEMETA}/maps`}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-rule underline-offset-2 transition-colors duration-drape ease-drape hover:text-ink"
    >
      {chunks}
    </a>
  );
  return meta.battles && meta.from && meta.to
    ? t.rich('brawlSource', { battles: meta.battles, from: day(meta.from), to: day(meta.to), link })
    : t.rich('brawlSourcePlain', { link });
}

/**
 * Строка бравлера в тир-листе. Раскрывается в его лучшие режимы и карты — то,
 * ради чего обычно и смотрят: «куда его брать».
 */
function TierRow({
  brawler: b,
  index,
  locale,
  tierLabel,
  modesLabel,
  mapsLabel,
  modeName,
  mapName
}: {
  brawler: TierBrawler;
  index: number;
  locale: Locale;
  tierLabel: string;
  modesLabel: string;
  mapsLabel: string;
  /** Режим и карта словами игры на языке страницы — см. `brawlMode`, `mapNamer`. */
  modeName: (mode: string) => string;
  mapName: (english: string) => string;
}) {
  const pct = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value);
  return (
    <li className={index > 0 ? 'ps-rule' : ''}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <span className="w-6 shrink-0 text-right text-sm tabular-nums text-ink-faint">
            {index + 1}
          </span>
          <BrawlerIcon brawler={b} size={32} />
          <span className="min-w-0 flex-1 truncate text-base font-medium normal-case leading-tight text-ink">
            {b.name}
          </span>
          <TierBadge tier={b.tier} label={tierLabel} />
          <span className="hidden w-14 text-right text-sm tabular-nums text-ink-muted sm:block">
            {percent(b.useRate, locale)}
          </span>
          <Pct locale={locale} value={b.winRate} className="w-16 text-right text-base" />
          <span
            aria-hidden="true"
            className="w-4 text-ink-faint transition-transform duration-drape ease-drape group-open:rotate-90"
          >
            ›
          </span>
        </summary>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 pb-3 pl-9 sm:grid-cols-2 sm:pl-[4.25rem]">
          {b.modes.length ? (
            <p className="text-sm leading-snug">
              <span className="ps-label mr-2">{modesLabel}</span>
              <span className="text-ink">
                {b.modes.map((m) => `${modeName(m.id)} ${pct(m.winRate)}`).join(' · ')}
              </span>
            </p>
          ) : null}
          {b.maps.length ? (
            <p className="text-sm leading-snug">
              <span className="ps-label mr-2">{mapsLabel}</span>
              {/* Имена карт — собственные, как у героев: строчить их нельзя. */}
              <span className="normal-case text-ink">
                {b.maps.map((m) => `${mapName(m.name)} ${pct(m.winRate)}`).join(' · ')}
              </span>
            </p>
          ) : null}
        </div>
      </details>
    </li>
  );
}

/**
 * Карты рангового по режимам. В строке карты — три лучших значком, чтобы
 * главное было видно, не раскрывая; внутри — десятка с буквой, долей пиков и
 * винрейтом, в порядке SeeMeta.
 *
 * Десятка — таблицей `.ps-map-table` с голыми ячейками, а значки — простым
 * `<img>`, а не `next/image`. Строк здесь триста, и каждая уходит в страницу
 * дважды: HTML и данными React. С классами на каждой ячейке и `next/image`
 * (это клиентский компонент — триста штук оживали бы в браузере) доска
 * весила 800 КБ. Картинки и так наши, из `public/`, и уже нужного размера.
 */
async function ByMap({
  meta,
  locale,
  mapName
}: {
  meta: BrawlMeta;
  locale: Locale;
  mapName: (english: string) => string;
}) {
  const t = await getTranslations({ locale, namespace: 'gamesBoard' });
  const tierLabel = t('tier');
  const win = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  return (
    <section className="block-card animate-rise-in flex flex-col gap-5 p-6 [animation-delay:150ms]">
      <div>
        <h2 className="text-xl font-semibold leading-tight text-ink">{t('byMap')}</h2>
        <p className="ps-label mt-2 normal-case">{t('byMapHint')}</p>
      </div>
      {mapsByMode(meta).map(({ mode, maps }) => (
        <div key={mode}>
          <h3 className="ps-label mb-1">{brawlMode(t, mode)}</h3>
          <ul>
            {maps.map((map, i) => (
              <li key={map.slug} className={i > 0 ? 'ps-rule' : ''}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1 truncate text-base font-medium normal-case leading-tight text-ink">
                      {mapName(map.name)}
                    </span>
                    <span className="flex shrink-0 gap-1" aria-hidden="true">
                      {map.brawlers.slice(0, 3).map((b) => (
                        <Face key={b.slug} brawler={b} size={24} />
                      ))}
                    </span>
                    <span className="hidden w-24 shrink-0 text-right text-sm tabular-nums text-ink-muted sm:block">
                      {t('mapBattles', { n: map.battles })}
                    </span>
                    <span
                      aria-hidden="true"
                      className="w-4 text-ink-faint transition-transform duration-drape ease-drape group-open:rotate-90"
                    >
                      ›
                    </span>
                  </summary>
                  <div className="pb-3">
                    <p className="ps-label pb-1 sm:hidden">{t('mapBattles', { n: map.battles })}</p>
                    <table className="ps-map-table">
                      <tbody>
                        {map.brawlers.map((b, j) => (
                          <tr key={b.slug}>
                            <td>{j + 1}</td>
                            <td>
                              <Face brawler={b} size={28} />
                            </td>
                            <td>{b.name}</td>
                            <td>
                              <span data-tier={b.tier} aria-label={`${tierLabel} ${b.tier}`}>
                                {b.tier}
                              </span>
                            </td>
                            <td>{percent(b.useRate, locale)}</td>
                            <td data-tone={winTone(b.winRate)}>{win.format(b.winRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * Значок бравлера простым `<img>` — для таблиц карт, где их сотни (см. выше).
 * Нет файла — две буквы имени, как у `BrawlerIcon`.
 */
function Face({ brawler: b, size }: { brawler: MetaBrawler; size: number }) {
  if (!b.hasIcon) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className="grid shrink-0 place-items-center rounded-sm bg-sunk text-[0.625rem] font-semibold normal-case text-ink-muted"
      >
        {b.name.slice(0, 2)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- сотни значков из public/, см. ByMap
    <img src={`/brawl/brawlers/${b.id}.png`} alt="" width={size} height={size} loading="lazy" />
  );
}
