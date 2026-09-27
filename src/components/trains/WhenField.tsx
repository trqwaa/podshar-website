'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { DayField } from '@/components/calendar/DayField';

/**
 * Когда ехать — одной кнопкой, как «Reisedatum» у SBB.
 *
 * До этого день, час и «выехать / приехать к» стояли тремя отдельными
 * контролами прямо в карточке поиска и занимали столько же места, сколько сам
 * маршрут. Владелец сказал про карточку верно: она должна читаться как визитка,
 * а не как панель приборов.
 *
 * Поэтому снаружи одна кнопка, и на ней написано то, что выбрано: «сейчас» или
 * «ср 30.09 · 19:46 · выехать». Всё остальное живёт в панели, которая
 * открывается по нажатию и закрывается, как только человек ткнул мимо.
 *
 * Час вернулся: сначала я убрал его как бессмысленный без дня, и это была
 * ошибка — расписание смотрят и на послезавтра, и на «к девяти утра». Он просто
 * не должен висеть пустым полем на виду.
 */
export function WhenField({
  day,
  clock,
  arrive,
  onChange
}: {
  /** «ГГГГ-ММ-ДД» или пусто — «сейчас». */
  day: string;
  /** «ЧЧ:ММ» или пусто — текущее время. */
  clock: string;
  arrive: boolean;
  onChange: (next: { day?: string; clock?: string; arrive?: boolean }) => void;
}) {
  const t = useTranslations('trains');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  // Сброс дня — это пересоздание поля календаря: день оно ведёт у себя, и
  // единственный честный способ вернуть его в «не выбрано» — собрать заново.
  const [round, setRound] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const pretty = day
    ? new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Europe/Zurich'
      }).format(new Date(`${day}T12:00:00Z`))
    : '';

  const label = day
    ? `${pretty} · ${clock || '--:--'} · ${arrive ? t('arriveBy') : t('leaveAt')}`
    : t('nowInstead');

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-11 items-center gap-2 rounded border-2 border-rule bg-canvas px-3 text-base text-ink transition-colors duration-drape ease-drape hover:bg-sunk"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 4.6V8l2.4 1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Строчными, как все подписи на сайте: `Intl` отдаёт день недели
            строчным сам, а поднимать первую букву руками — против тона. */}
        <span>{label}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t('when')}
          className="absolute start-0 top-full z-30 mt-1 flex w-[min(20rem,calc(100vw-2.5rem))] flex-col gap-3 rounded-block border-2 border-ink bg-surface p-3"
        >
          <DayField
            key={round}
            name="day"
            label={t('day')}
            value={day}
            onPick={(next) => onChange({ day: next })}
          />

          {/* Подпись часа — она же переключатель. Двумя кнопками «выехать» и
              «приехать к» это читалось как выбор из двух разных действий, а на
              деле это одно: во сколько считать. Нажал на слово — оно сменилось,
              как «ab / an» у SBB. */}
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onChange({ arrive: !arrive })}
              aria-pressed={arrive}
              className="ps-label flex w-fit items-center gap-1.5 text-ink-muted transition-colors duration-drape ease-drape hover:text-ink"
            >
              {arrive ? t('arriveBy') : t('leaveAt')}
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4.5 3v10M4.5 13 2.5 11M11.5 13V3M11.5 3l2 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <input
              type="time"
              value={clock}
              onChange={(event) => onChange({ clock: event.target.value })}
              // Браузер дорисовывает к полю времени свой крестик и стрелки:
              // очищается тут не час, а весь выбор, кнопкой «сейчас» ниже.
              className="h-11 rounded border-2 border-rule bg-canvas px-3 text-[1rem] text-ink outline-none transition-colors duration-drape ease-drape focus:border-ink sm:text-base [&::-webkit-clear-button]:hidden [&::-webkit-inner-spin-button]:hidden"
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-rule-soft pt-2">
            <button
              type="button"
              onClick={() => {
                onChange({ day: '', clock: '', arrive: false });
                setRound((n) => n + 1);
              }}
              className="ps-label text-ink-faint transition-colors hover:text-ink"
            >
              {t('nowInstead')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ps-label text-ink-faint transition-colors hover:text-ink"
            >
              {t('close')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
