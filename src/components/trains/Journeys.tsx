'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Journey } from '@/lib/types';

/**
 * Найденные поездки.
 *
 * Часы пишутся по Цюриху и на сервере, и в браузере, поэтому «18:04» совпадает
 * и гидратация молчит. А вот «через 7 мин» существует только после монтирования:
 * это другое число каждую минуту, и написанное на сервере оно было бы ошибкой
 * гидратации. До монтирования на его месте стоит время — оно тоже верное.
 *
 * Отрезки поездки сложены: человеку, который едет без пересадок, разворачивать
 * нечего, а тому, у кого их две, важно знать, где выходить. Открывается по
 * нажатию на саму строку.
 */
export function Journeys({ list, serverNow }: { list: Journey[]; serverNow: number }) {
  const t = useTranslations('trains');
  const locale = useLocale();
  const [now, setNow] = useState(serverNow);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

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

  if (list.length === 0) {
    return <p className="text-base font-medium text-ink-muted">{t('nothingFound')}</p>;
  }

  return (
    <ul className="flex flex-col">
      {list.map((journey, index) => {
        const mins = Math.round((journey.departs + journey.delay * 60_000 - now) / 60_000);
        const showing = open === index;

        return (
          <li key={`${journey.departs}-${index}`} className="border-t border-rule first:border-t-0">
            <button
              type="button"
              onClick={() => setOpen(showing ? null : index)}
              aria-expanded={showing}
              className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 py-3 text-left transition-colors hover:bg-ink/4"
            >
              <span className="text-lg font-medium tabular-nums text-ink">
                {clock.format(journey.departs)}
              </span>
              <span aria-hidden="true" className="text-ink-faint">
                →
              </span>
              <span className="text-lg font-medium tabular-nums text-ink">
                {clock.format(journey.arrives)}
              </span>

              {journey.delay > 0 ? (
                <span className="text-sm font-medium text-loss">{t('delay', { min: journey.delay })}</span>
              ) : null}

              <span className="text-sm text-ink-muted">{t('rides', { min: journey.minutes })}</span>
              <span className="text-sm text-ink-muted">
                {t('transfers', { count: journey.transfers })}
              </span>
              {journey.platform ? (
                <span className="text-sm text-ink-muted">{t('platform', { platform: journey.platform })}</span>
              ) : null}

              <span className="ml-auto flex flex-wrap items-center gap-1">
                {journey.legs.map((leg, i) => (
                  <span
                    key={`${leg.line}-${i}`}
                    className="rounded border border-rule px-1.5 py-0.5 text-xs font-medium text-ink-muted"
                  >
                    {leg.line}
                  </span>
                ))}
                {mounted && mins >= 0 && mins < 90 ? (
                  <span className="ps-label normal-case ms-2 text-ink-faint">
                    {mins === 0 ? t('now') : t('in', { min: mins })}
                  </span>
                ) : null}
              </span>
            </button>

            {showing ? (
              <ol className="flex flex-col gap-2 pb-4 ps-1">
                {journey.legs.map((leg, i) => (
                  <li key={`${leg.line}-${i}-leg`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="rounded border border-rule px-1.5 py-0.5 text-xs font-medium text-ink">
                      {leg.line}
                    </span>
                    <span className="tabular-nums text-ink">{clock.format(leg.departs)}</span>
                    <span className="text-ink-muted">{leg.from}</span>
                    {leg.platform ? (
                      <span className="text-ink-faint">{t('platform', { platform: leg.platform })}</span>
                    ) : null}
                    <span aria-hidden="true" className="text-ink-faint">
                      →
                    </span>
                    <span className="tabular-nums text-ink">{clock.format(leg.arrives)}</span>
                    <span className="text-ink-muted">{leg.to}</span>
                    {/* Куда идёт сам поезд: на перроне ищут именно это слово. */}
                    {leg.head ? <span className="text-ink-faint">{t('towards', { head: leg.head })}</span> : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
