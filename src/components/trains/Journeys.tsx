'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';

import { Modal } from '@/components/Modal';
import type { Journey } from '@/lib/types';

/**
 * Найденные поездки.
 *
 * Строки лежат прямо на странице, без своей белой карточки. Шесть одинаковых
 * карточек подряд читаются как лента, в которой ничего не различить, — а тут
 * и так шесть почти одинаковых строк, и единственное, что их отличает, это
 * время и пересадки. Пусть различает оно, а не рамка.
 *
 * Поездка раскрывается **окном поверх страницы**, а не гармошкой внутри
 * списка. Разворот на месте сдвигал всё, что ниже, и читать нитку маршрута
 * приходилось, придерживая глазами место, откуда она выехала. В окне нитка
 * получает целый экран, а список остаётся там, где его оставили.
 *
 * Часы пишутся по Цюриху и на сервере, и в браузере, поэтому «18:04» совпадает
 * и гидратация молчит. «Через семь минут» существует только после
 * монтирования: это другое число каждую минуту, и написанное на сервере оно
 * было бы ошибкой гидратации.
 */
export function Journeys({ list, serverNow }: { list: Journey[]; serverNow: number }) {
  const t = useTranslations('trains');
  const locale = useLocale();
  const [now, setNow] = useState(serverNow);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState<Journey | null>(null);

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
    return <p className="px-1 text-base font-medium text-ink-muted">{t('nothingFound')}</p>;
  }

  return (
    <>
      {/* Каждая поездка — свой блок, как на табло у SBB: сверху чем едешь,
          посередине время и нитка, снизу мелочи. Плоский список строк читался
          как таблица, в которой всё одинаковое; блок даёт поездке границу, а
          нитка внутри сразу показывает, сколько раз пересаживаться. */}
      <ul className="flex flex-col gap-2">
        {list.map((journey, index) => {
          const mins = Math.round((journey.departs + journey.delay * 60_000 - now) / 60_000);
          const leaving = mounted && mins >= 0 && mins < 90;
          const hours = Math.floor(journey.minutes / 60);

          return (
            <li key={`${journey.departs}-${index}`}>
              <button
                type="button"
                onClick={() => setShown(journey)}
                aria-haspopup="dialog"
                className="w-full rounded-block border-2 border-rule bg-canvas p-4 text-left transition-colors duration-drape ease-drape hover:border-ink hover:bg-sunk"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {journey.legs.map((leg, i) => (
                    <Badge key={`${leg.line}-${i}`}>{leg.line}</Badge>
                  ))}
                  {journey.legs[0]?.head ? (
                    <span className="min-w-0 truncate text-sm text-ink-muted">
                      {t('towards', { head: journey.legs[0].head })}
                    </span>
                  ) : null}
                  {journey.delay > 0 ? (
                    <span className="text-sm font-medium text-loss">{t('delay', { min: journey.delay })}</span>
                  ) : null}
                  {leaving ? (
                    <span className="ps-label ms-auto shrink-0 text-ink-faint">
                      {mins === 0 ? t('now') : t('leavesIn', { min: mins })}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <span className="text-2xl font-medium tabular-nums leading-none text-ink">
                    {clock.format(journey.departs)}
                  </span>
                  <MiniThread transfers={journey.transfers} />
                  <span className="text-2xl font-medium tabular-nums leading-none text-ink">
                    {clock.format(journey.arrives)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                  {journey.platform ? <span>{t('platform', { platform: journey.platform })}</span> : null}
                  <span>{t('transfers', { count: journey.transfers })}</span>
                  {index === 0 && leaving ? (
                    <span className="ps-label text-ink-faint">{t('soonest')}</span>
                  ) : null}
                  <span className="ms-auto shrink-0">
                    {hours > 0
                      ? t('ridesLong', { h: hours, min: journey.minutes % 60 })
                      : t('rides', { min: journey.minutes })}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Без `AnimatePresence` окно исчезает мгновенно и не отыгрывает уход —
          та же причина, по которой в неё завёрнуты патчи и погода. */}
      <AnimatePresence>
        {shown ? (
          <Modal
            key="trip"
            title={`${shown.legs[0]?.from ?? '?'} → ${shown.legs[shown.legs.length - 1]?.to ?? '?'}`}
            hint={t('tripHint', {
              from: clock.format(shown.departs),
              to: clock.format(shown.arrives),
              min: shown.minutes
            })}
            close={t('close')}
            onClose={() => setShown(null)}
          >
            <Thread journey={shown} clock={clock} />
          </Modal>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/**
 * Маршрут одной чертой: точка — линия — точка, и по пустой точке на каждую
 * пересадку. Это то же самое, что нитка в окне, ужатое до одной строки: сколько
 * раз выходить, видно, не открывая поездку.
 */
function MiniThread({ transfers }: { transfers: number }) {
  return (
    <span className="flex min-w-0 flex-1 items-center" aria-hidden="true">
      <Pip solid />
      {Array.from({ length: Math.max(0, transfers) }).map((_, i) => (
        <span key={i} className="flex min-w-0 flex-1 items-center">
          <Wire />
          <Pip />
        </span>
      ))}
      <Wire />
      <Pip solid />
    </span>
  );
}

function Pip({ solid = false }: { solid?: boolean }) {
  return (
    <span
      className={`block h-2 w-2 shrink-0 rounded-full border-2 border-ink ${solid ? 'bg-ink' : 'bg-canvas'}`}
    />
  );
}

function Wire() {
  return <span className="h-0.5 min-w-0 flex-1 bg-rule" />;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-rule px-1.5 py-0.5 text-xs font-medium text-ink-muted">
      {children}
    </span>
  );
}

/**
 * Нитка маршрута: точки станций, линия поезда между ними, разрывы на пересадках.
 *
 * Рисуется рамками и заливками, без теней — как и всё остальное на сайте.
 * Левая колонка фиксированной ширины держит вертикаль: без неё точки разъезжа-
 * ются, когда у станций разной длины названия.
 */
function Thread({ journey, clock }: { journey: Journey; clock: Intl.DateTimeFormat }) {
  const t = useTranslations('trains');

  return (
    <ol className="flex flex-col">
      {journey.legs.map((leg, index) => {
        const next = journey.legs[index + 1];
        // Сколько стоять на пересадке: от прибытия этого поезда до отправления
        // следующего. Это то число, из-за которого бегут по перрону.
        const wait = next ? Math.round((next.departs - leg.arrives) / 60_000) : 0;

        return (
          <li key={`${leg.line}-${index}`} className="flex flex-col">
            <Stop time={clock.format(leg.departs)} name={leg.from} platform={leg.platform} first />

            <div className="flex gap-4">
              <Rail solid />
              <div className="flex flex-wrap items-center gap-2 py-3">
                <Badge>{leg.line}</Badge>
                {leg.head ? (
                  <span className="text-sm text-ink-muted">{t('towards', { head: leg.head })}</span>
                ) : null}
                {leg.delay > 0 ? (
                  <span className="text-sm font-medium text-loss">{t('delay', { min: leg.delay })}</span>
                ) : null}
              </div>
            </div>

            <Stop time={clock.format(leg.arrives)} name={leg.to} platform={null} />

            {next ? (
              <div className="flex gap-4">
                <Rail />
                <p className="py-3 text-sm text-ink-faint">{t('wait', { min: Math.max(0, wait) })}</p>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Станция на нитке: точка, время, название. */
function Stop({
  time,
  name,
  platform,
  first = false
}: {
  time: string;
  name: string;
  platform: string | null;
  first?: boolean;
}) {
  const t = useTranslations('trains');

  return (
    <div className="flex items-center gap-4">
      <span className="flex w-3 shrink-0 justify-center" aria-hidden="true">
        <span
          className={`block h-3 w-3 rounded-full border-2 border-ink ${first ? 'bg-ink' : 'bg-canvas'}`}
        />
      </span>
      <span className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-base font-medium tabular-nums text-ink">{time}</span>
        <span className="text-base text-ink">{name}</span>
        {platform ? (
          <span className="text-sm text-ink-faint">{t('platform', { platform })}</span>
        ) : null}
      </span>
    </div>
  );
}

/** Отрезок вертикали слева: сплошной под поездом, пунктирный на пересадке. */
function Rail({ solid = false }: { solid?: boolean }) {
  return (
    <span className="flex w-3 shrink-0 justify-center" aria-hidden="true">
      <span
        className={`w-0.5 ${solid ? 'bg-ink' : 'border-l-2 border-dashed border-rule bg-transparent'}`}
      />
    </span>
  );
}
