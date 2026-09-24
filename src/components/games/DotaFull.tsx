import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { HeroIcon, MEDALS, Pct, Segmented, metaRankName } from '@/components/games/bits';
import { Link } from '@/i18n/routing';
import { percent } from '@/components/games/format';
import type { Locale } from '@/i18n/routing';
import {
  ALWAYS_HONOURED,
  dotaBuild,
  dotaMeta,
  honourList,
  metaList,
  ownHeroes,
  shameList,
  type MetaHero
} from '@/lib/dota-meta';
import { dotaHero } from '@/lib/game-catalog';
import { boardFor, recentHistory } from '@/lib/games-board';
import { History } from '@/components/games/History';

export type Tab = 'meta' | 'shame' | 'honour';

/** С какого числа игр на герое ему можно выносить приговор. Меньше — это настроение, не статистика. */
const OWN_MIN = 5;

/**
 * Дота целиком: мета на ранге, позор, почёт, и своё — всё, что помогает апнуть.
 *
 * Ранг по умолчанию — свой: мета на Herald и на Immortal разная, и советовать
 * человеку героев чужого ранга значит советовать мимо. Переключается строкой
 * медалей сверху, и выбор живёт в адресе.
 */
export async function DotaFull({
  locale,
  userId,
  tab,
  rank
}: {
  locale: Locale;
  userId: string;
  tab: Tab;
  /** Из адреса: `all`, `1`–`8` или ничего — тогда свой. */
  rank: string | undefined;
}) {
  const [t, board] = await Promise.all([
    getTranslations({ locale, namespace: 'gamesBoard' }),
    boardFor(userId)
  ]);
  const own = board.dota.profile?.medal ?? null;
  const bracket = rank === 'all' ? null : rank && /^[1-8]$/.test(rank) ? Number(rank) : own;
  const href = (next: { tab?: Tab; rank?: string }) =>
    `/games?view=dota&tab=${next.tab ?? tab}${(next.rank ?? rank) ? `&rank=${next.rank ?? rank}` : ''}`;

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4">
      <section className="block-card animate-rise-in flex flex-col gap-4 p-6 [animation-delay:60ms]">
        <Segmented
          label={t('tabsLabel')}
          items={(['meta', 'shame', 'honour'] as Tab[]).map((x) => ({
            href: href({ tab: x }),
            text: t(`tabs.${x}`),
            active: x === tab
          }))}
        />
        {/* Ранг — мелкими пилюлями: их девять, и крупными они съели бы экран телефона. */}
        <nav aria-label={t('rankLabel')} className="flex flex-wrap gap-1.5">
          {[
            { v: 'all', text: t('allRanks'), n: null as number | null },
            ...MEDALS.map((m, i) => ({ v: String(i + 1), text: m, n: i + 1 }))
          ].map((r) => {
            const active = r.n === bracket;
            return (
              <Link
                key={r.v}
                href={href({ rank: r.v })}
                aria-current={active ? 'page' : undefined}
                className={`h-8 rounded border-2 px-3 text-sm normal-case leading-[1.75] transition-colors duration-drape ease-drape ${
                  active
                    ? 'border-ink bg-ink text-canvas'
                    : 'border-rule text-ink-muted hover:bg-sunk hover:text-ink'
                } ${r.n === own && !active ? 'border-ink/60' : ''}`}
              >
                {r.text}
              </Link>
            );
          })}
        </nav>
      </section>

      <Suspense fallback={<ListPending />}>
        <DotaLists
          locale={locale}
          tab={tab}
          bracket={bracket}
          accountId={board.dota.account?.externalId ?? null}
          profile={board.dota.profile}
          history={
            board.dota.account ? (
              <History
                game="DOTA2"
                recent={board.dota.recent}
                matches={await recentHistory(board.dota.account.id)}
                locale={locale}
              />
            ) : null
          }
        />
      </Suspense>
    </div>
  );
}

async function DotaLists({
  locale,
  tab,
  bracket,
  accountId,
  profile,
  history
}: {
  locale: Locale;
  tab: Tab;
  bracket: number | null;
  accountId: string | null;
  profile: { wins: number; losses: number } | null;
  /** Форма, неделя и герои недели — низ правой колонки. */
  history: React.ReactNode;
}) {
  const [t, meta, mine] = await Promise.all([
    getTranslations({ locale, namespace: 'gamesBoard' }),
    dotaMeta(bracket),
    accountId ? ownHeroes(accountId) : Promise.resolve(null)
  ]);

  if (!meta) {
    return (
      <section className="block-card p-6">
        <p className="text-base text-ink-muted">{t('metaMissing')}</p>
      </section>
    );
  }

  const list =
    tab === 'meta'
      ? metaList(meta).slice(0, 15)
      : tab === 'shame'
        ? shameList(meta)
        : honourList(meta);
  const hint = tab === 'meta' ? t('metaHint') : tab === 'shame' ? t('shameHint') : t('honourHint');
  const sample = bracket
    ? t('sampleDota', { matches: meta.matches, rank: metaRankName(bracket) })
    : t('sampleDotaAll', { matches: meta.matches });

  // Своё: сколько сыграно и на ком. Тащишь — от лучшего винрейта, сливаешь — от худшего.
  const judged = (mine ?? []).filter((h) => h.games >= OWN_MIN);
  const ownList =
    tab === 'shame'
      ? [...judged].sort((a, b) => a.wins / a.games - b.wins / b.games).slice(0, 5)
      : tab === 'honour'
        ? [...judged].sort((a, b) => b.wins / b.games - a.wins / a.games).slice(0, 5)
        : [...(mine ?? [])].sort((a, b) => b.games - a.games).slice(0, 5);
  const ownTitle =
    tab === 'shame' ? t('ownShame') : tab === 'honour' ? t('ownHonour') : t('yourStats');
  const played = profile ? profile.wins + profile.losses : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-[1fr_22rem]">
      <section className="block-card animate-rise-in flex flex-col gap-3 p-6 [animation-delay:120ms]">
        <div>
          <h2 className="text-xl font-semibold leading-tight text-ink">{t(`tabs.${tab}`)}</h2>
          {/* `normal-case`: строки каталога и так строчные, а медаль в выборке —
              имя собственное, как в шторке. `ps-label` сделал бы из Divine divine. */}
          <p className="ps-label mt-2 normal-case">
            {hint} · {sample}
          </p>
        </div>
        <ol className="flex flex-col">
          {list.map((h, i) => (
            <HeroRow
              key={h.id}
              hero={h}
              index={i}
              tab={tab}
              pinnedLabel={t('pinned')}
              buildLabel={t('build')}
              locale={locale}
            />
          ))}
        </ol>
      </section>

      <aside className="block-card animate-rise-in flex flex-col gap-3 self-start p-6 [animation-delay:180ms] lg:sticky lg:top-20">
        <h2 className="text-lg font-semibold leading-tight text-ink">{ownTitle}</h2>
        {tab === 'meta' && played ? (
          <p className="text-base text-ink">
            <span className="font-semibold tabular-nums">{t('ownGames', { games: played })}</span>
            <span className="text-ink-muted"> · </span>
            <Pct locale={locale} value={profile!.wins / played} />
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
          <p className="text-base text-ink-faint">{accountId ? t('ownNone') : t('notLinked')}</p>
        ) : (
          <ul className="flex flex-col">
            {ownList.map((h, i) => {
              const hero = dotaHero(h.id);
              return (
                <li key={h.id} className={`flex items-center gap-3 py-2 ${i > 0 ? 'ps-rule' : ''}`}>
                  <HeroIcon hero={hero} size={28} />
                  <span className="min-w-0 flex-1 truncate text-base font-medium normal-case text-ink">
                    {hero.name}
                  </span>
                  <span className="text-sm tabular-nums text-ink-muted">
                    {t('ownGames', { games: h.games })}
                  </span>
                  <Pct locale={locale} value={h.wins / h.games} className="text-sm" />
                </li>
              );
            })}
          </ul>
        )}
        {history}
      </aside>
    </div>
  );
}

/**
 * Строка героя. Раскрывается в сборку — `<details>`, без единой строки
 * JavaScript: список длинный, а открывать будут один-два.
 */
function HeroRow({
  hero,
  index,
  tab,
  pinnedLabel,
  buildLabel,
  locale
}: {
  hero: MetaHero;
  index: number;
  tab: Tab;
  pinnedLabel: string;
  buildLabel: string;
  locale: Locale;
}) {
  const pinned = tab === 'honour' && (ALWAYS_HONOURED as readonly number[]).includes(hero.id);
  return (
    <li className={index > 0 ? 'ps-rule' : ''}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <span className="w-6 shrink-0 text-right text-sm tabular-nums text-ink-faint">
            {index + 1}
          </span>
          <HeroIcon hero={hero} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-medium normal-case leading-tight text-ink">
              {hero.name}
            </span>
            {pinned ? <span className="ps-label block text-ink">{pinnedLabel}</span> : null}
          </span>
          <span className="hidden w-16 text-right text-sm tabular-nums text-ink-muted sm:block">
            {percent(hero.pickRate, locale)}
          </span>
          <Pct locale={locale} value={hero.winRate} className="w-16 text-right text-base" />
          <span
            aria-hidden="true"
            className="w-4 text-ink-faint transition-transform duration-drape ease-drape group-open:rotate-90"
          >
            ›
          </span>
        </summary>
        <div className="pb-3 pl-9 sm:pl-[4.25rem]">
          <Suspense
            fallback={<span className="inline-block h-4 w-40 animate-pulse rounded-sm bg-sunk" />}
          >
            <BuildFor heroId={hero.id} locale={locale} label={buildLabel} />
          </Suspense>
        </div>
      </details>
    </li>
  );
}

async function BuildFor({
  heroId,
  locale,
  label
}: {
  heroId: number;
  locale: Locale;
  label: string;
}) {
  const [t, build] = await Promise.all([
    getTranslations({ locale, namespace: 'gamesBoard' }),
    dotaBuild(heroId)
  ]);
  if (!build) return <p className="text-sm text-ink-faint">{t('buildMissing')}</p>;
  const phases: [string, string[]][] = [
    [t('start'), build.start],
    [t('early'), build.early],
    [t('mid'), build.mid],
    [t('late'), build.late]
  ];
  return (
    <div aria-label={label} className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {phases.map(([name, items]) =>
        items.length ? (
          <p key={name} className="text-sm leading-snug">
            <span className="ps-label mr-2">{name}</span>
            {/* Имена предметов — собственные, как у героев: строчить их нельзя. */}
            <span className="normal-case text-ink">{items.join(' · ')}</span>
          </p>
        ) : null
      )}
    </div>
  );
}

function ListPending() {
  return (
    <section className="block-card flex flex-col gap-3 p-6">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="h-9 animate-pulse rounded-sm bg-sunk" />
      ))}
    </section>
  );
}
