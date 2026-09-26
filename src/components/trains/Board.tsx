'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { BoardRow } from '@/lib/types';

/**
 * Вокзальное табло: что уходит с этой станции в ближайшее время.
 *
 * Отдельно от поиска, потому что это другой вопрос. Поиск отвечает «как мне
 * попасть отсюда туда», табло — «что вообще сейчас уходит»: так смотрят, когда
 * стоят на перроне и решают, бежать или нет.
 *
 * Время — по Цюриху на обеих сторонах; «через сколько» появляется только после
 * монтирования, как и везде на сайте.
 */
export function Board({ rows, serverNow }: { rows: BoardRow[]; serverNow: number }) {
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

  if (rows.length === 0) {
    return <p className="text-base font-medium text-ink-muted">{t('boardEmpty')}</p>;
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row, index) => {
        const mins = Math.round((row.departs + row.delay * 60_000 - now) / 60_000);

        return (
          <li
            key={`${row.line}-${row.departs}-${index}`}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-rule py-2.5 first:border-t-0"
          >
            <span className="w-14 shrink-0 text-base font-medium tabular-nums text-ink">
              {clock.format(row.departs)}
            </span>
            {row.delay > 0 ? (
              <span className="text-sm font-medium text-loss">{t('delay', { min: row.delay })}</span>
            ) : null}
            <span className="rounded border border-rule px-1.5 py-0.5 text-xs font-medium text-ink">
              {row.line}
            </span>
            <span className="min-w-0 flex-1 truncate text-base text-ink-muted">{row.head}</span>
            {row.platform ? (
              <span className="text-sm text-ink-faint">{t('platform', { platform: row.platform })}</span>
            ) : null}
            {mounted && mins >= 0 && mins < 90 ? (
              <span className="ps-label normal-case w-16 shrink-0 text-right text-ink-faint">
                {mins === 0 ? t('now') : t('in', { min: mins })}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
