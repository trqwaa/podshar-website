import { getTranslations } from 'next-intl/server';

import { BrawlerIcon, Pct, Segmented } from '@/components/games/bits';
import { ago, percent } from '@/components/games/format';
import type { Tab } from '@/components/games/DotaFull';
import type { Locale } from '@/i18n/routing';
import { brawlHonourList, brawlMeta, brawlMetaList, brawlShameList } from '@/lib/brawl-meta';
import { brawler } from '@/lib/game-catalog';
import { boardFor, ownBrawlers, recentHistory } from '@/lib/games-board';
import { History } from '@/components/games/History';

/** С какого числа боёв на бравлере его можно судить. Меньше, чем в доте: боёв у бравла больше и они короче. */
const OWN_MIN = 3;

/**
 * Бравл целиком: мета по топу мира, позор, почёт и своё.
 *
 * Мета тут наша — см. `lib/brawl-meta.ts`, почему взять её негде. Подпись под
 * заголовком всегда говорит, из скольких боёв она посчитана и когда: мета из
 * сорока боёв и мета из тысячи выглядят на экране одинаково, а весят по-разному.
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
  const [t, board, meta] = await Promise.all([
    getTranslations({ locale, namespace: 'gamesBoard' }),
    boardFor(userId),
    brawlMeta()
  ]);
  const [mine, week] = board.brawl.account
    ? await Promise.all([ownBrawlers(board.brawl.account.id), recentHistory(board.brawl.account.id)])
    : [[], []];

  const list = meta
    ? tab === 'meta'
      ? brawlMetaList(meta).slice(0, 15)
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
        <section className="block-card animate-rise-in flex flex-col gap-3 p-6 [animation-delay:120ms]">
          <div>
            <h2 className="text-xl font-semibold leading-tight text-ink">{t(`tabs.${tab}`)}</h2>
            <p className="ps-label mt-2 normal-case">
              {meta
                ? `${hint} · ${t('sampleBrawl', { battles: meta.battles, players: meta.players, when: ago(meta.at, locale) })}`
                : hint}
            </p>
          </div>
          {!meta ? (
            <p className="text-base text-ink-muted">{t('brawlMetaNone')}</p>
          ) : (
            <ol className="flex flex-col">
              {list.map((b, i) => (
                <li
                  key={b.id}
                  className={`flex items-center gap-3 py-2.5 ${i > 0 ? 'ps-rule' : ''}`}
                >
                  <span className="w-6 shrink-0 text-right text-sm tabular-nums text-ink-faint">
                    {i + 1}
                  </span>
                  <BrawlerIcon brawler={b} size={32} />
                  <span className="min-w-0 flex-1 truncate text-base font-medium normal-case leading-tight text-ink">
                    {b.name}
                  </span>
                  <span className="hidden w-16 text-right text-sm tabular-nums text-ink-muted sm:block">
                    {percent(b.pickRate, locale)}
                  </span>
                  <Pct locale={locale} value={b.winRate} className="w-16 text-right text-base" />
                </li>
              ))}
            </ol>
          )}
        </section>

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
