'use client';

import { useCallback, useMemo, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';
import { SCALES, yearGrids, type Scale } from '@/lib/calendar/scales';
import { DayPanel, type DayEvent } from './DayPanel';
import { TimeGrid } from './TimeGrid';

const ZONE = 'Europe/Zurich';

/** Сколько названий помещается в клетку месяца, прежде чем остаток свернётся в «ещё N». */
const IN_MONTH = 2;
/** В неделе клетка выше, и названий влезает больше. */
const IN_WEEK = 6;

/** Полдень UTC: середина суток не съезжает в соседний день ни при каком смещении. */
const noon = (key: string) => new Date(`${key}T12:00:00Z`);

/**
 * Календарь целиком: тулбар, сетка выбранного масштаба и панель дня.
 *
 * Клиентский, и ровно из-за одной вещи — выбор дня должен быть мгновенным и
 * анимированным. Данные на весь видимый отрезок уже пришли с сервера, поэтому
 * переключение дня внутри него не требует ни запроса, ни перерисовки страницы:
 * меняется состояние, курсор переезжает, панель дня берёт другой ключ.
 *
 * Адресная строка при этом остаётся правдой. День пишется в неё через
 * `history.replaceState` — без похода на сервер, но ссылку по-прежнему можно
 * бросить в чат, а «назад» и перезагрузка попадают туда же, где были. А вот
 * смена масштаба или периода идёт обычной навигацией: там нужен другой отрезок
 * событий, и придумать его на клиенте не из чего.
 */
export function Calendar({
  locale,
  scale,
  anchor,
  days,
  byDay,
  canEdit
}: {
  locale: Locale;
  scale: Scale;
  anchor: string;
  days: string[];
  byDay: Record<string, DayEvent[]>;
  canEdit: boolean;
}) {
  const t = useTranslations('calendar');
  const router = useRouter();
  const still = useReducedMotion();
  const [selected, setSelected] = useState(anchor);

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date()),
    []
  );

  // Выбор дня не ходит на сервер: отрезок уже здесь. В адрес он всё равно
  // попадает, иначе перезагрузка теряла бы то, на что человек смотрит.
  const pick = useCallback(
    (day: string) => {
      setSelected(day);
      const url = new URL(window.location.href);
      url.searchParams.set('d', day);
      window.history.replaceState(null, '', url);
    },
    []
  );

  const go = (next: { scale?: Scale; day?: string }) => {
    const url = new URL(window.location.href);
    url.searchParams.set('v', next.scale ?? scale);
    url.searchParams.set('d', next.day ?? selected);
    router.push(`${url.pathname.replace(/^\/(en|ru|uk|de)/, '')}${url.search}`);
  };

  const step = (direction: 1 | -1) => go({ day: shift(scale, selected, direction) });

  const heading = periodLabel(locale, scale, selected, days);

  return (
    <>
      <section className="block-card animate-rise-in flex flex-col gap-4 p-4 sm:p-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-xl font-semibold leading-tight text-ink first-letter:uppercase sm:text-2xl">
            {heading}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Перемещение по периодам: три кнопки одной высоты и одной группой.
                «Сегодня» раньше была меньше стрелок и читалась как подпись,
                а не как то, чем управляют наравне с ними. */}
            <div className="flex items-center gap-1">
              <Step onClick={() => step(-1)} label={t('prev')} glyph="‹" />
              <button
                type="button"
                onClick={() => go({ day: today })}
                className="h-10 rounded border-2 border-rule px-4 text-base text-ink transition-colors duration-drape ease-drape hover:bg-sunk"
              >
                {t('today')}
              </button>
              <Step onClick={() => step(1)} label={t('next')} glyph="›" />
            </div>

            {/* Отступ заметный: это две разные вещи — куда смотрим и чем меряем. */}
              <div className="flex items-center gap-1 ms-3 lg:ms-6">
              {SCALES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => go({ scale: option })}
                  aria-pressed={option === scale}
                  className={`h-10 rounded border-2 px-3 text-base transition-colors duration-drape ease-drape ${
                    option === scale
                      ? 'border-ink bg-ink text-canvas'
                      : 'border-rule text-ink-muted hover:bg-sunk hover:text-ink'
                  }`}
                >
                  {t(`scales.${option}`)}
                </button>
              ))}
            </div>
          </div>
        </header>

        {scale === 'day' || scale === 'week' ? (
          <TimeGrid
            days={days}
            byDay={byDay}
            today={today}
            selected={selected}
            onPick={pick}
          />
        ) : (
          <LayoutGroup id="calendar">
            {scale === 'year' ? (
              <YearGrid
                locale={locale}
                year={selected.slice(0, 4)}
                byDay={byDay}
                today={today}
                onPick={(day) => go({ scale: 'month', day })}
              />
            ) : (
              <DaysGrid
                locale={locale}
                scale={scale}
                days={days}
                byDay={byDay}
                today={today}
                selected={selected}
                still={Boolean(still)}
                onPick={pick}
                moreLabel={(count) => t('more', { count })}
              />
            )}
          </LayoutGroup>
        )}
      </section>

      <DayPanel day={selected} events={byDay[selected] ?? []} canEdit={canEdit} />
    </>
  );
}

/** Сетка недели или месяца. Разница между ними — высота клетки и сколько строк. */
function DaysGrid({
  locale,
  scale,
  days,
  byDay,
  today,
  selected,
  still,
  onPick,
  moreLabel
}: {
  locale: Locale;
  scale: Scale;
  days: string[];
  byDay: Record<string, DayEvent[]>;
  today: string;
  selected: string;
  still: boolean;
  onPick: (day: string) => void;
  moreLabel: (count: number) => string;
}) {
  const inCell = scale === 'week' ? IN_WEEK : IN_MONTH;
  const month = selected.slice(0, 7);

  // Названия дней недели берутся у Intl, а не из каталогов: их и так знают все
  // четыре языка, а семь лишних ключей на язык — это двадцать восемь строк,
  // которые кто-нибудь однажды переведёт с ошибкой.
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const heads = Array.from({ length: 7 }, (_, i) =>
    weekday.format(new Date(Date.UTC(2024, 0, 1 + i)))
  );

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {heads.map((head) => (
          <p key={head} className="ps-label pb-1 text-center">
            {head}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((key) => {
          const events = byDay[key] ?? [];
          const outside = scale === 'month' && !key.startsWith(month);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              aria-current={key === selected ? 'date' : undefined}
              className={`relative flex flex-col gap-1 rounded p-1 text-left transition-colors sm:p-2 ${
                scale === 'week' ? 'min-h-[8rem] sm:min-h-[14rem]' : 'min-h-[3rem] sm:min-h-[5.5rem]'
              } ${key === selected ? '' : 'hover:bg-sunk'} ${outside ? 'opacity-40' : ''}`}
            >
              {/* Курсор — один элемент на всю сетку, переезжающий между клетками.
                  Так выбор читается как движение, а не как «погасло тут, зажглось
                  там». При `prefers-reduced-motion` он просто появляется на месте.

                  Заливка живёт на нём же, а не на клетке: иначе ехала бы одна
                  рамка, а фон моргал на месте. Это пробный вариант — смотрим,
                  не слишком ли он тяжёлый в движении. */}
              {key === selected ? (
                <motion.span
                  layoutId="calendar-cursor"
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded border-2 border-ink bg-sunk"
                  transition={
                    still ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }
                  }
                />
              ) : null}

              <span
                className={`relative text-center text-sm tabular-nums sm:text-left ${
                  key === today ? 'font-bold text-reactor' : 'font-medium text-ink-muted'
                }`}
              >
                {Number(key.slice(8))}
              </span>

              {/* Точки для телефона, названия для экрана: в клетку шириной сорок
                  пикселей название не влезает, а знать, что день занят, нужно и там. */}
              {events.length > 0 ? (
                <span aria-hidden="true" className="relative flex justify-center gap-0.5 sm:hidden">
                  {events.slice(0, 3).map((event) => (
                    <span key={event.id} className="h-1 w-1 rounded-full bg-reactor" />
                  ))}
                </span>
              ) : null}

              <span className="relative hidden min-w-0 flex-col gap-0.5 sm:flex">
                {events.slice(0, inCell).map((event) => (
                  <span
                    key={event.id}
                    className="truncate rounded-sm bg-reactor/10 px-1 text-[0.6875rem] leading-tight text-ink"
                  >
                    {event.title}
                  </span>
                ))}
                {events.length > inCell ? (
                  <span className="px-1 text-[0.6875rem] leading-tight text-ink-faint">
                    {moreLabel(events.length - inCell)}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Год: двенадцать сеток, где от дня осталась только занятость. */
function YearGrid({
  locale,
  year,
  byDay,
  today,
  onPick
}: {
  locale: Locale;
  year: string;
  byDay: Record<string, DayEvent[]>;
  today: string;
  onPick: (day: string) => void;
}) {
  // Сетки строятся заново из года, а не режутся из плоского списка: месяц бывает
  // и на 35 дней, и на 42, поэтому нарезка по 42 разъезжала половину года — и
  // давала одинаковые ключи, на которые React ругался пятьюдесятью строками.
  const months = useMemo(() => yearGrids(year), [year]);

  const name = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {months.map((cells, index) => {
        const own = `${year}-${String(index + 1).padStart(2, '0')}`;

        return (
          <div key={own} className="flex flex-col gap-1">
            <p className="ps-label first-letter:uppercase">
              {name.format(noon(`${own}-15`))}
            </p>
            <div className="grid grid-cols-7 gap-px">
              {cells.map((key) => {
                const busy = (byDay[key] ?? []).length > 0;
                const outside = !key.startsWith(own);

                return (
                  <button
                    key={`${index}-${key}`}
                    type="button"
                    onClick={() => onPick(key)}
                    className={`grid aspect-square place-items-center rounded-sm text-[0.6875rem] tabular-nums transition-colors hover:bg-sunk ${
                      outside ? 'text-ink-faint/40' : 'text-ink-muted'
                    } ${key === today ? 'font-bold text-reactor' : ''} ${
                      busy && !outside ? 'bg-reactor/15 font-semibold text-ink' : ''
                    }`}
                  >
                    {Number(key.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Step({ onClick, label, glyph }: { onClick: () => void; label: string; glyph: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded border-2 border-rule text-lg leading-none text-ink-muted transition-colors duration-drape ease-drape hover:bg-sunk hover:text-ink"
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

/** На сколько сдвигается период при нажатии на стрелку. */
function shift(scale: Scale, day: string, direction: 1 | -1): string {
  const [year, month, date] = day.split('-').map(Number);
  const moved =
    scale === 'day'
      ? Date.UTC(year, month - 1, date + direction, 12)
      : scale === 'week'
        ? Date.UTC(year, month - 1, date + 7 * direction, 12)
        : scale === 'month'
          ? Date.UTC(year, month - 1 + direction, Math.min(date, 28), 12)
          : Date.UTC(year + direction, month - 1, Math.min(date, 28), 12);

  return new Date(moved).toISOString().slice(0, 10);
}

/** Что написано над сеткой: день, отрезок недели, месяц или год. */
function periodLabel(locale: Locale, scale: Scale, day: string, days: string[]): string {
  if (scale === 'day') {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: ZONE
    }).format(noon(day));
  }

  if (scale === 'year') {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone: ZONE }).format(noon(day));
  }

  if (scale === 'month') {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: ZONE
    }).format(noon(day));
  }

  const short = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: ZONE });
  return `${short.format(noon(days[0]))} — ${short.format(noon(days[6]))}`;
}
