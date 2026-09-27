'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';

import { Modal } from '@/components/Modal';
import type { Journey } from '@/lib/types';

/**
 * Найденные поездки: список слева, расписанный путь справа.
 *
 * Раскладка взята у SBB, и по делу: выбранная поездка не прячется в окне, а
 * стоит рядом со списком, так что «а следующая как?» — это взгляд вбок, а не
 * закрыть-открыть. Список остаётся на месте, и видно, из чего выбираешь.
 *
 * Колонки появляются с `lg`. На телефоне их негде поставить, поэтому там то же
 * содержимое показывается окном поверх страницы. Ширина узнаётся после
 * монтирования, и это безопасно: до первого нажатия показывать нечего, значит
 * и расходиться серверной разметке не с чем.
 *
 * Часы пишутся по Цюриху на обеих сторонах, поэтому «18:04» совпадает. «Через
 * семь минут» живёт только после монтирования: это другое число каждую минуту,
 * и написанное на сервере оно было бы ошибкой гидратации.
 */
export function Journeys({ list, serverNow }: { list: Journey[]; serverNow: number }) {
  const t = useTranslations('trains');
  const locale = useLocale();
  const [now, setNow] = useState(serverNow);
  const [mounted, setMounted] = useState(false);
  const [wide, setWide] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 15_000);

    const media = window.matchMedia('(min-width: 1024px)');
    const follow = () => setWide(media.matches);
    follow();
    media.addEventListener('change', follow);

    return () => {
      clearInterval(tick);
      media.removeEventListener('change', follow);
    };
  }, []);

  // На широком экране правая колонка не должна пустовать: SBB тоже раскрывает
  // первую поездку сразу, и это верно — пустая колонка выглядит сломанной, а
  // не ждущей.
  useEffect(() => {
    if (wide && chosen === null && list.length) setChosen(0);
  }, [wide, chosen, list.length]);

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

  const shown = chosen === null ? null : (list[chosen] ?? null);
  const ride = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? t('ridesLong', { h: hours, min: minutes % 60 }) : t('rides', { min: minutes });
  };

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <ul className="flex flex-col gap-2">
          {list.map((journey, index) => {
            const mins = Math.round((journey.departs + journey.delay * 60_000 - now) / 60_000);
            const leaving = mounted && mins >= 0 && mins < 90;
            const open = wide && chosen === index;

            return (
              <li
                key={`${journey.departs}-${index}`}
                className="animate-rise-in"
                // Лесенкой, а не все разом: список так читается сверху вниз, а
                // не вспыхивает. Дальше десятой карточки задержку не растим —
                // ждать своей очереди полсекунды уже раздражает.
                style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
              >
                <button
                  type="button"
                  onClick={() => setChosen(index)}
                  aria-haspopup={wide ? undefined : 'dialog'}
                  aria-current={open ? 'true' : undefined}
                  className={`w-full rounded-block border-2 bg-canvas p-4 text-left transition-colors duration-drape ease-drape hover:bg-sunk ${
                    open ? 'border-ink' : 'border-rule hover:border-ink'
                  }`}
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
                    <span className="ms-auto shrink-0">{ride(journey.minutes)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Правая колонка. `sticky` — чтобы при длинном списке путь оставался
            перед глазами, а не уезжал вверх вместе с ним. */}
        {wide && shown ? (
          <aside
            // `key` по выбранной поездке — чтобы приезд отыгрывался заново на
            // каждый выбор, а не один раз за жизнь колонки.
            key={chosen}
            className="animate-slide-in rounded-block border-2 border-rule bg-canvas p-5 lg:sticky lg:top-24"
          >
            <p className="text-lg font-medium leading-tight text-ink">
              {shown.legs[0]?.from ?? '?'} → {shown.legs[shown.legs.length - 1]?.to ?? '?'}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {clock.format(shown.departs)} → {clock.format(shown.arrives)}, {ride(shown.minutes)}
            </p>
            <div className="mt-4 border-t border-rule-soft pt-4">
              <Thread journey={shown} clock={clock} />
            </div>
          </aside>
        ) : null}
      </div>

      {/* На телефоне колонку ставить некуда — там то же самое окном. */}
      <AnimatePresence>
        {!wide && shown ? (
          <Modal
            key="trip"
            title={`${shown.legs[0]?.from ?? '?'} → ${shown.legs[shown.legs.length - 1]?.to ?? '?'}`}
            hint={t('tripHint', {
              from: clock.format(shown.departs),
              to: clock.format(shown.arrives),
              min: shown.minutes
            })}
            close={t('close')}
            onClose={() => setChosen(null)}
          >
            <Thread journey={shown} clock={clock} />
          </Modal>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-rule px-1.5 py-0.5 text-xs font-medium text-ink-muted">
      {children}
    </span>
  );
}

/**
 * Маршрут одной чертой: точка — линия — точка, и по пустой точке на каждую
 * пересадку. Сколько раз выходить, видно, не открывая поездку.
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

/**
 * Нитка маршрута: точки станций, линия поезда между ними, разрывы на пересадках.
 *
 * Рисуется рамками и заливками, без теней — как и всё остальное на сайте.
 * Левая колонка фиксированной ширины держит вертикаль: без неё точки
 * разъезжаются, когда у станций разной длины названия.
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
