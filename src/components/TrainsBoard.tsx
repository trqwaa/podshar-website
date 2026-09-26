'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { MemberAvatar } from './profile/MemberAvatar';
import type { Departure, TrainRow } from '@/lib/types';

/**
 * How to get away from HB: one row per person, with the next train to their own
 * station.
 *
 * The departure time is written in Zurich time on both sides, so the server and
 * the browser print the same "19:01". The minutes-to-go counter is the one
 * thing that exists only after mount — it is a different number every minute
 * and would be a hydration error written on the server. Until then the right
 * edge shows the clock time instead, which is also correct.
 *
 * The first connection still in the future is chosen here, not on the server:
 * the answer is cached for a minute, and by the time it is read the first train
 * in it may have left.
 */
export function TrainsBoard({
  rows,
  me,
  serverNow,
  className = ''
}: {
  rows: TrainRow[];
  me: string;
  serverNow: number;
  className?: string;
}) {
  const t = useTranslations('trains');
  const locale = useLocale();
  const [now, setNow] = useState(serverNow);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(tick);
  }, []);

  const clock = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Zurich'
      }),
    [locale]
  );

  // Your own row first: it is your train you came here for.
  const ordered = [...rows].sort((a, b) => (a.handle === me ? -1 : b.handle === me ? 1 : 0));

  return (
    <section
      className={`block-card animate-rise-in flex flex-col gap-4 p-6 [animation-delay:300ms] ${className}`}
    >
      {/* `normal-case`: `ps-label` lowercases everything, which turned HB into
          "hb". The catalogue copy is lowercase already; the station is not. */}
      {/* Подпись — дверь в раздел: плитка отвечает «когда ближайший», а за
          «а если не домой» человек идёт туда, где есть поиск. */}
      <Link
        href="/trains"
        className="ps-label normal-case w-fit transition-colors hover:text-ink"
      >
        {t('label')}
      </Link>

      {ordered.length === 0 ? (
        <p className="text-base font-medium text-ink-muted">{t('nobody')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rule-soft">
          {ordered.map((row) => (
            <Row key={row.handle} row={row} mine={row.handle === me} now={now} mounted={mounted} clock={clock} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({
  row,
  mine,
  now,
  mounted,
  clock
}: {
  row: TrainRow;
  mine: boolean;
  now: number;
  mounted: boolean;
  clock: Intl.DateTimeFormat;
}) {
  const t = useTranslations('trains');
  // A late train is still in the station until its delay has run out.
  const leaves = (d: Departure) => d.departs + d.delay * 60_000;
  const next = row.departures.find((d) => leaves(d) > now);

  let status: React.ReactNode = null;
  if (!row.station) {
    status = mine ? (
      <Link href="/trains#station" className="underline decoration-rule underline-offset-4 hover:text-ink">
        {t('noStationYou')}
      </Link>
    ) : (
      t('noStation')
    );
  } else if (row.atHB) status = t('atHB');
  else if (row.failed) status = t('unavailable');
  else if (!next) status = t('gone');

  const minutes = next ? Math.floor((leaves(next) - now) / 60_000) : 0;

  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <MemberAvatar preset={row.avatarPreset} displayName={row.displayName} className="h-9 w-9 shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold leading-tight text-ink">
          {row.displayName}
          {row.station ? <span className="font-medium text-ink-muted"> → {row.station}</span> : null}
        </p>
        {status || !next ? (
          <p className="text-sm text-ink-muted">{status}</p>
        ) : (
          <p className="truncate text-sm tabular-nums text-ink-muted">
            <span className="font-semibold text-ink">{next.line}</span> · {clock.format(next.departs)}
            {next.delay > 0 ? ` ${t('delay', { min: next.delay })}` : ''}
            {next.platform ? ` · ${t('platform', { platform: next.platform })}` : ''} ·{' '}
            {t('transfers', { count: next.transfers })}
          </p>
        )}
      </div>

      {next && !status ? (
        <p className="shrink-0 text-right text-lg font-semibold tabular-nums leading-tight text-ink">
          {mounted ? (minutes <= 0 ? t('now') : t('in', { min: minutes })) : clock.format(next.departs)}
        </p>
      ) : null}
    </li>
  );
}
