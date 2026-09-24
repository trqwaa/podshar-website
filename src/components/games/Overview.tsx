import { Suspense } from 'react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { ActionLink, BrawlerIcon, Delta, HeroIcon, MEDALS, Pct, ResultChip, metaRankName } from '@/components/games/bits';
import { ago, modeName } from '@/components/games/format';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';
import { brawlMeta, brawlMetaList } from '@/lib/brawl-meta';
import { dotaMeta, metaList } from '@/lib/dota-meta';
import { brawler, dotaHero } from '@/lib/game-catalog';
import { boardFor, totals, type BoardMatch } from '@/lib/games-board';
import { zurichMidnight } from '@/lib/calendar/events';
import { dayKey } from '@/lib/calendar/scales';

/**
 * Обзор: две карточки рядом — дота и бравл, только про того, кто смотрит.
 *
 * В каждой три вещи в порядке важности, как просил владелец: чем кончились
 * последние игры, где аккаунт стоит сейчас, и одной строкой — что сейчас в мете.
 * Всё остальное — на полной странице игры, куда ведёт кнопка внизу карточки.
 */
export async function Overview({ locale, userId }: { locale: Locale; userId: string }) {
  const [t, board] = await Promise.all([
    getTranslations({ locale, namespace: 'gamesBoard' }),
    boardFor(userId)
  ]);
  const since = zurichMidnight(dayKey(new Date()));
  const today = (m: BoardMatch[]) => m.filter((x) => x.at >= since);

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
      {/* Дота */}
      <section className="block-card animate-rise-in flex flex-col gap-5 p-6 [animation-delay:60ms]">
        <CardHead label={t('views.dota')} name={board.dota.profile?.name ?? board.dota.account?.tag ?? null}>
          {board.dota.profile?.medal ? <Medal medal={board.dota.profile.medal} stars={board.dota.profile.stars} /> : null}
        </CardHead>

        {!board.dota.linked ? (
          <NotLinked text={t('notLinked')} link={t('linkIt')} anchor="dota" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Stat label={t('record', { wins: board.dota.profile?.wins ?? 0, losses: board.dota.profile?.losses ?? 0 })}>
                {board.dota.profile && board.dota.profile.wins + board.dota.profile.losses > 0 ? (
                  <Pct value={board.dota.profile.wins / (board.dota.profile.wins + board.dota.profile.losses)} className="text-2xl" />
                ) : (
                  <span className="text-2xl text-ink-faint">—</span>
                )}
              </Stat>
              <TodayStat
                label={t('today')}
                none={t('todayNone')}
                unit={t('mmr')}
                totals={totals(today(board.dota.recent), 'DOTA2')}
              />
            </div>

            <MatchList
              title={t('lastMatches')}
              empty={t('noMatches')}
              matches={board.dota.recent.slice(0, 8)}
              locale={locale}
              letters={[t('win'), t('loss'), t('draw')]}
              row={(m) => {
                const hero = dotaHero(Number(m.character));
                const p = m.payload as { kills?: number; deaths?: number; assists?: number; ranked?: boolean };
                return {
                  icon: <HeroIcon hero={hero} size={26} />,
                  name: hero.name,
                  detail: `${p.kills ?? 0}/${p.deaths ?? 0}/${p.assists ?? 0} · ${p.ranked ? t('ranked') : t('unranked')}`,
                  right: null
                };
              }}
            />
          </>
        )}

        <Suspense fallback={<PeekPending label={t('metaAllRanks')} />}>
          <DotaPeek locale={locale} medal={board.dota.profile?.medal ?? null} />
        </Suspense>

        <div className="mt-auto flex flex-wrap gap-2">
          <ActionLink href="/games?view=dota">{t('fullDota')}</ActionLink>
        </div>
      </section>

      {/* Бравл */}
      <section className="block-card animate-rise-in flex flex-col gap-5 p-6 [animation-delay:120ms]">
        <CardHead label={t('views.brawl')} name={board.brawl.profile?.name ?? board.brawl.account?.tag ?? null}>
          {board.brawl.profile?.rankTier ? (
            <Image
              src={`/brawl/rank-${board.brawl.profile.rankTier}.png`}
              alt=""
              width={96}
              height={96}
              className="h-12 w-12 shrink-0"
            />
          ) : null}
        </CardHead>

        {!board.brawl.linked ? (
          <NotLinked text={t('notLinked')} link={t('linkIt')} anchor="brawl" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Stat label={board.brawl.profile ? t('peak', { peak: board.brawl.profile.highest }) : ''}>
                <span className="text-2xl font-semibold tabular-nums text-ink">
                  {board.brawl.profile ? board.brawl.profile.trophies : '—'}
                </span>
                <span className="ml-1.5 text-base text-ink-muted">{t('trophies')}</span>
              </Stat>
              <TodayStat
                label={t('today')}
                none={t('todayNone')}
                unit={t('trophies')}
                totals={totals(today(board.brawl.recent), 'BRAWL_STARS')}
              />
            </div>

            <MatchList
              title={t('lastBattles')}
              empty={t('noMatches')}
              matches={board.brawl.recent.slice(0, 8)}
              locale={locale}
              letters={[t('win'), t('loss'), t('draw')]}
              row={(m) => {
                const b = brawler(Number(m.character));
                const p = m.payload as { mode?: string; map?: string };
                return {
                  icon: <BrawlerIcon brawler={b} size={26} />,
                  name: b.name,
                  detail: [modeName(p.mode), p.map].filter(Boolean).join(' · '),
                  right: m.ratingDelta !== null ? <Delta value={m.ratingDelta} /> : null
                };
              }}
            />
          </>
        )}

        <BrawlPeek label={t('metaTop50')} empty={t('brawlMetaNone')} />

        <div className="mt-auto flex flex-wrap gap-2">
          <ActionLink href="/games?view=brawl">{t('fullBrawl')}</ActionLink>
        </div>
      </section>
    </div>
  );
}

function CardHead({ label, name, children }: { label: string; name: string | null; children?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="ps-label">{label}</p>
        {/* `normal-case`: ник — имя человека, строчить его нельзя. */}
        <p className="truncate text-2xl font-semibold normal-case leading-tight text-ink">{name ?? '—'}</p>
      </div>
      {children}
    </header>
  );
}

export function Medal({ medal, stars, size = 48 }: { medal: number; stars: number; size?: number }) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span style={{ width: size, height: size }} className="relative block" aria-hidden="true">
        <Image src={`/dota/medal-${medal}.png`} alt="" width={size * 2} height={size * 2} className="h-full w-full" />
        {stars > 0 ? (
          <Image src={`/dota/star-${stars}.png`} alt="" width={size * 2} height={size * 2} className="absolute inset-0 h-full w-full" />
        ) : null}
      </span>
      <span className="sr-only">
        {MEDALS[medal - 1]} {stars || ''}
      </span>
    </span>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-baseline">{children}</p>
      <p className="ps-label mt-1">{label}</p>
    </div>
  );
}

function TodayStat({
  label,
  none,
  unit,
  totals: day
}: {
  label: string;
  none: string;
  unit: string;
  totals: ReturnType<typeof totals>;
}) {
  const played = day.wins + day.losses;
  return (
    <div className="min-w-0">
      {played ? (
        <p className="flex items-baseline gap-2 text-2xl">
          <span className="font-semibold tabular-nums text-ink">
            {day.wins}–{day.losses}
          </span>
          {day.delta !== null ? (
            <span className="text-base">
              <Delta value={day.delta} estimated={day.estimated} /> <span className="text-ink-muted">{unit}</span>
            </span>
          ) : null}
        </p>
      ) : (
        <p className="text-base text-ink-faint">{none}</p>
      )}
      <p className="ps-label mt-1">{label}</p>
    </div>
  );
}

function NotLinked({ text, link, anchor }: { text: string; link: string; anchor: string }) {
  return (
    <p className="text-base text-ink-muted">
      {text}.{' '}
      <Link href={`/profile#${anchor}`} className="text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
        {link}
      </Link>
    </p>
  );
}

type Row = { icon: React.ReactNode; name: string; detail: string; right: React.ReactNode };

function MatchList({
  title,
  empty,
  matches,
  locale,
  letters,
  row
}: {
  title: string;
  empty: string;
  matches: BoardMatch[];
  locale: string;
  letters: [string, string, string];
  row: (m: BoardMatch) => Row;
}) {
  return (
    <div>
      <p className="ps-label mb-2">{title}</p>
      {matches.length === 0 ? (
        <p className="text-base text-ink-faint">{empty}</p>
      ) : (
        <ul className="flex flex-col">
          {matches.map((m, i) => {
            const r = row(m);
            return (
              <li key={m.id} className={`flex items-center gap-3 py-2 ${i > 0 ? 'ps-rule' : ''}`}>
                <ResultChip result={m.result} letter={m.result === 'WIN' ? letters[0] : m.result === 'LOSS' ? letters[1] : letters[2]} />
                {r.icon}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium normal-case leading-tight text-ink">{r.name}</p>
                  <p className="truncate text-sm tabular-nums text-ink-muted">{r.detail}</p>
                </div>
                {r.right ? <span className="text-sm">{r.right}</span> : null}
                <span className="shrink-0 text-sm text-ink-faint">{ago(m.at, locale)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PeekPending({ label }: { label: string }) {
  return (
    <div>
      <p className="ps-label mb-2">{label}</p>
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-9 flex-1 animate-pulse rounded-sm bg-sunk" />
        ))}
      </div>
    </div>
  );
}

/**
 * Три героя меты — на ранге того, кто смотрит, если ранг известен.
 *
 * Отдельным асинхронным куском за `<Suspense>`: это единственное на обзоре, что
 * ходит в OpenDota (из шестичасового кеша), и карточка не должна его ждать.
 */
async function DotaPeek({ locale, medal }: { locale: Locale; medal: number | null }) {
  const [t, meta] = await Promise.all([getTranslations({ locale, namespace: 'gamesBoard' }), dotaMeta(medal)]);
  const label = medal ? t('metaOn', { rank: metaRankName(medal) }) : t('metaAllRanks');
  if (!meta) return <Peek label={label} empty={t('metaMissing')} items={[]} />;
  return (
    <Peek
      label={label}
      empty={t('metaMissing')}
      items={metaList(meta).slice(0, 3).map((h) => ({ key: h.id, icon: <HeroIcon hero={h} size={26} />, name: h.name, winRate: h.winRate }))}
    />
  );
}

async function BrawlPeek({ label, empty }: { label: string; empty: string }) {
  const meta = await brawlMeta();
  return (
    <Peek
      label={label}
      empty={empty}
      items={
        meta
          ? brawlMetaList(meta).slice(0, 3).map((b) => ({ key: b.id, icon: <BrawlerIcon brawler={b} size={26} />, name: b.name, winRate: b.winRate }))
          : []
      }
    />
  );
}

function Peek({
  label,
  empty,
  items
}: {
  label: string;
  empty: string;
  items: { key: number; icon: React.ReactNode; name: string; winRate: number }[];
}) {
  return (
    <div>
      <p className="ps-label mb-2 normal-case">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-ink-faint">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {items.map((x) => (
            <li key={x.key} className="flex min-w-0 items-center gap-2 rounded-sm bg-sunk px-2 py-1.5">
              {x.icon}
              <span className="min-w-0 flex-1 truncate text-sm font-medium normal-case text-ink">{x.name}</span>
              <Pct value={x.winRate} className="text-sm" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
