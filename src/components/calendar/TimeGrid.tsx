'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';

import { ZONE } from '@/lib/calendar/scales';
import type { Locale } from '@/i18n/routing';
import type { DayEvent } from './DayPanel';

/** Высота часа в пикселях. Ниже — события в полчаса перестают читаться. */
const HOUR = 48;
/** Событию без конца рисуется час: точка на оси не имеет высоты, а показать её надо. */
const DEFAULT_MINUTES = 60;
/** Как часто переставляется линия текущего времени. */
const TICK_MS = 30_000;

const minutesIn = (iso: string) => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONE
  })
    .format(new Date(iso))
    .split(':')
    .map(Number);
  return h * 60 + m;
};

type Placed = { event: DayEvent; top: number; height: number; column: number; columns: number };

/**
 * Раскладка событий одного дня по колонкам.
 *
 * Пересекающиеся по времени встают рядом, а не друг на друга: иначе то, что
 * снизу, не видно вовсе, и человек узнаёт о нём, только промахнувшись мимо
 * верхнего. Жадный алгоритм — событие занимает первую колонку, где оно никого не
 * задевает; ширина внутри группы делится поровну.
 */
function place(events: DayEvent[]): Placed[] {
  const timed = events
    .filter((event) => !event.allDay)
    .map((event) => {
      const top = minutesIn(event.startsAt);
      const end = event.endsAt ? minutesIn(event.endsAt) : top + DEFAULT_MINUTES;
      return { event, top, height: Math.max(end - top, 20) };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);

  const placed: Placed[] = [];
  let group: Placed[] = [];
  let groupEnd = -1;

  const closeGroup = () => {
    const columns = group.reduce((max, item) => Math.max(max, item.column + 1), 0);
    for (const item of group) item.columns = columns;
    group = [];
  };

  for (const item of timed) {
    // Группа кончилась там, где началось событие, не задевающее ни одного из
    // предыдущих: ширину делят только те, кто действительно пересекается.
    if (item.top >= groupEnd && group.length > 0) closeGroup();

    const taken = new Set(
      group.filter((other) => other.top + other.height > item.top).map((other) => other.column)
    );
    let column = 0;
    while (taken.has(column)) column += 1;

    const entry: Placed = { ...item, column, columns: 1 };
    group.push(entry);
    placed.push(entry);
    groupEnd = Math.max(groupEnd, item.top + item.height);
  }
  if (group.length > 0) closeGroup();

  return placed;
}

/**
 * День и неделя с осью часов, как в Outlook.
 *
 * Сетка клеток отвечает на вопрос «занят ли день», а ось часов — «во сколько и
 * насколько долго», и для одного-двух дней нужен именно второй. Отсюда же линия
 * текущего времени: она имеет смысл только там, где у часа есть своё место.
 *
 * События на весь день не попадают на ось — у них нет часа. Им отведена полоса
 * сверху, как и в любом другом календаре.
 */
export function TimeGrid({
  days,
  byDay,
  today,
  selected,
  onPick
}: {
  days: string[];
  byDay: Record<string, DayEvent[]>;
  today: string;
  selected: string;
  onPick: (day: string) => void;
}) {
  const locale = useLocale() as Locale;
  const scroller = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState<number | null>(null);

  // Линия ставится только после монтирования: время — факт браузера, и
  // отрисованное на сервере разошлось бы с ним на каждой загрузке.
  useEffect(() => {
    const read = () => {
      const [h, m] = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: ZONE
      })
        .format(new Date())
        .split(':')
        .map(Number);
      setNow(h * 60 + m);
    };
    read();
    const id = setInterval(read, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Подкрутить к текущему часу один раз: сутки целиком в карточку не влезают, а
  // начинать показ с полуночи значит показывать пустоту.
  useEffect(() => {
    if (now === null || !scroller.current) return;
    scroller.current.scrollTop = Math.max(0, (now / 60) * HOUR - HOUR * 2);
    // Только на первом появлении: дальше прокрутку двигает человек.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now !== null]);

  const dayName = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: ZONE });
  const clock = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONE
  });

  const allDay = useMemo(
    () => days.map((day) => (byDay[day] ?? []).filter((event) => event.allDay)),
    [days, byDay]
  );
  const hasAllDay = allDay.some((list) => list.length > 0);

  const template = { gridTemplateColumns: `3rem repeat(${days.length}, 1fr)` };

  return (
    <div className="flex flex-col">
      {/* Шапка дней нужна только неделе: там она и подписывает колонки, и выбирает
          день для панели снизу. В дневном масштабе дата уже стоит заголовком над
          сеткой, и повторять её третий раз незачем. */}
      <div hidden={days.length === 1} className="grid" style={template}>
        <span />
        {days.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onPick(day)}
            aria-current={day === selected ? 'date' : undefined}
            className={`flex flex-col items-center border-s border-rule-soft py-1 transition-colors hover:bg-sunk ${
              day === selected ? 'bg-sunk' : ''
            }`}
          >
            <span className="ps-label">{dayName.format(new Date(`${day}T12:00:00Z`))}</span>
            <span
              className={`text-base tabular-nums ${
                day === today ? 'font-bold text-reactor' : 'font-medium text-ink'
              }`}
            >
              {Number(day.slice(8))}
            </span>
          </button>
        ))}
      </div>

      {hasAllDay ? (
        <div className="grid border-t border-rule-soft" style={template}>
          <span className="ps-label self-center pe-1 text-end">24h</span>
          {allDay.map((list, index) => (
            <span
              key={days[index]}
              className="flex min-w-0 flex-col gap-0.5 border-s border-rule-soft p-0.5"
            >
              {list.map((event) => (
                <span
                  key={event.id}
                  className="truncate rounded-sm bg-reactor/10 px-1 text-[0.6875rem] leading-tight text-ink"
                >
                  {event.title}
                </span>
              ))}
            </span>
          ))}
        </div>
      ) : null}

      {/* Потолок высоты обязателен: без него прокручивается страница, а не сетка,
          и подкрутка к текущему часу ставит scrollTop элементу, который не
          прокручивается — неделя открывалась на полуночи. */}
      <div ref={scroller} className="scroll-quiet max-h-[26rem] overflow-y-auto border-t border-rule-soft">
        {/* Дни разделены по-настоящему: у каждого свой столбец с собственными
            часовыми линиями и границей слева. Пока засечки шли одним слоем на всю
            ширину, неделя читалась как один сплошной лист, а не как семь дней. */}
        <div className="grid" style={{ ...template, height: 24 * HOUR }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, hour) => (
              <span
                key={hour}
                className="ps-label absolute end-1 -translate-y-1/2 tabular-nums"
                style={{ top: hour * HOUR }}
              >
                {hour > 0 ? String(hour).padStart(2, '0') : ''}
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div key={day} className="relative border-s border-rule-soft">
              <span aria-hidden="true" className="pointer-events-none absolute inset-0">
                {Array.from({ length: 24 }, (_, hour) => (
                  <span
                    key={hour}
                    className="absolute inset-x-0 border-t border-rule-soft"
                    style={{ top: hour * HOUR }}
                  />
                ))}
              </span>

              {place(byDay[day] ?? []).map(({ event, top, height, column, columns }) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onPick(day)}
                  className="absolute overflow-hidden rounded-sm border border-reactor/30 bg-reactor/10 px-1 text-start text-[0.6875rem] leading-tight text-ink transition-colors hover:bg-reactor/20"
                  style={{
                    top: (top / 60) * HOUR,
                    height: Math.max((height / 60) * HOUR, 16),
                    left: `${(column / columns) * 100}%`,
                    width: `${(1 / columns) * 100}%`
                  }}
                >
                  <span className="block truncate font-medium">{event.title}</span>
                  <span className="block truncate text-ink-muted">
                    {clock.format(new Date(event.startsAt))}
                  </span>
                </button>
              ))}

              {/* Линия «сейчас» — только в колонке сегодняшнего дня.

                  Сама линия — блок в два пикселя, а не рамка сверху: у рамки
                  верх блока и середина штриха не совпадают, и точка вставала на
                  пиксель выше линии. Теперь обе центруются по одному и тому же. */}
              {day === today && now !== null ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-reactor"
                  style={{ top: (now / 60) * HOUR }}
                >
                  <span className="absolute -start-1 top-1/2 block h-2 w-2 -translate-y-1/2 rounded-full bg-reactor" />
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
