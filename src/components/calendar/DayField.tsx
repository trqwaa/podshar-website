'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/i18n/routing';

import { ZONE, monthGrid, shiftMonth } from '@/lib/calendar/scales';

const noon = (key: string) => new Date(`${key}T12:00:00Z`);

/**
 * Выбор даты в форме.
 *
 * Своя сетка, а не `<input type="date">`. Системный календарь мелкий, выглядит
 * как чужой элемент посреди страницы и в каждом браузере свой; здесь же он
 * открывается прямо в форме, тем же размером и теми же клетками, что и большой
 * календарь над ней.
 *
 * Дата почти всегда уже правильная: форма открывается на том дне, который выбран
 * в сетке. Поэтому по умолчанию видна просто строка с датой, а сетка
 * разворачивается, только если её действительно надо поменять.
 *
 * Значение уезжает на сервер скрытым полем в том же `YYYY-MM-DD`, что отдавал
 * системный ввод, так что действие на той стороне не заметило разницы.
 */
export function DayField({
  name,
  label,
  value,
  clearable = false
}: {
  name: string;
  label: string;
  value: string;
  /** Необязательное поле можно и опустошить — у «по» это единственный способ убрать конец. */
  clearable?: boolean;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale() as Locale;
  const [day, setDay] = useState(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value || new Date().toISOString().slice(0, 10));
  const box = useRef<HTMLDivElement | null>(null);
  const id = useId();

  // Клик мимо и Escape закрывают сетку. Слушатели на окне, а не на элементе:
  // клик «мимо» по определению происходит не на нём.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  const pretty = day
    ? new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        timeZone: ZONE
      }).format(noon(day))
    : t('noDate');

  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const heads = Array.from({ length: 7 }, (_, i) =>
    weekday.format(new Date(Date.UTC(2024, 0, 1 + i)))
  );
  const monthName = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: ZONE
  });

  return (
    <div className="flex flex-col gap-1" ref={box}>
      <span className="ps-label" id={id}>
        {label}
      </span>
      <input type="hidden" name={name} value={day} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setMonth(day || new Date().toISOString().slice(0, 10));
            setOpen((v) => !v);
          }}
          aria-labelledby={id}
          aria-expanded={open}
          className="flex-1 rounded border-2 border-rule bg-canvas px-3 py-2.5 text-start text-base text-ink transition-colors hover:bg-sunk focus:border-ink focus:outline-none"
        >
          <span className="first-letter:uppercase">{pretty}</span>
        </button>

        {clearable && day ? (
          <button
            type="button"
            onClick={() => setDay('')}
            aria-label={t('clear')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded border-2 border-rule text-base leading-none text-ink-muted transition-colors hover:bg-sunk hover:text-ink"
          >
            <span aria-hidden="true">&#215;</span>
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-1 rounded-block border-2 border-rule bg-surface p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-base font-semibold text-ink first-letter:uppercase">
              {monthName.format(noon(month))}
            </p>
            <span className="flex gap-1">
              <Arrow onClick={() => setMonth(shiftMonth(month, -1))} label={t('prev')} glyph="‹" />
              <Arrow onClick={() => setMonth(shiftMonth(month, 1))} label={t('next')} glyph="›" />
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {heads.map((head) => (
              <p key={head} className="ps-label pb-1 text-center">
                {head}
              </p>
            ))}
            {monthGrid(month.slice(0, 7)).map((key) => {
              const outside = !key.startsWith(month.slice(0, 7));
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setDay(key);
                    setOpen(false);
                  }}
                  className={`grid h-10 place-items-center rounded border-2 text-base tabular-nums transition-colors ${
                    key === day
                      ? 'border-ink bg-sunk font-semibold text-ink'
                      : 'border-transparent text-ink-muted hover:border-rule hover:bg-sunk'
                  } ${outside ? 'opacity-40' : ''}`}
                >
                  {Number(key.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Arrow({ onClick, label, glyph }: { onClick: () => void; label: string; glyph: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded border-2 border-rule text-lg leading-none text-ink-muted transition-colors hover:bg-sunk hover:text-ink"
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}
