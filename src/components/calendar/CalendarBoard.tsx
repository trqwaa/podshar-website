import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';
import {
  ZONE,
  dayKey,
  monthGrid,
  shiftMonth,
  zurichMidnight,
  type CalendarEvent
} from '@/lib/calendar/events';

/** Сколько названий помещается в клетку, прежде чем остаток свернётся в «ещё N». */
const IN_CELL = 2;

/**
 * Сетка месяца.
 *
 * Серверный компонент целиком: месяц и выбранный день живут в адресной строке,
 * а не в состоянии React. Это не упрощение ради упрощения — ссылку на день можно
 * бросить в чат, «назад» в браузере возвращает туда, где был, и ничего не надо
 * восстанавливать после перезагрузки.
 *
 * Клетки соседних месяцев остаются в сетке приглушёнными: без них у крайних
 * недель появляются дыры, и строка перестаёт читаться как неделя.
 */
export async function CalendarBoard({
  locale,
  month,
  selected,
  byDay
}: {
  locale: Locale;
  month: string;
  selected: string;
  byDay: Record<string, CalendarEvent[]>;
}) {
  const t = await getTranslations('calendar');
  const grid = monthGrid(month);
  const today = dayKey(new Date());

  const label = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: ZONE
  }).format(zurichMidnight(`${month}-01`));

  // Названия дней недели берутся у Intl, а не из каталогов: их и так знают все
  // четыре языка, а семь лишних ключей на язык — это двадцать восемь строк,
  // которые кто-нибудь однажды переведёт с ошибкой.
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const heads = Array.from({ length: 7 }, (_, i) =>
    weekday.format(new Date(Date.UTC(2024, 0, 1 + i)))
  );

  return (
    <section className="block-card animate-rise-in flex flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        {/* `capitalize` поднимает регистр у каждого слова, и «сентябрь 2026 г.»
            превращается в «Сентябрь 2026 Г.». Нужна ровно первая буква. */}
        <h2 className="text-xl font-semibold leading-tight text-ink first-letter:uppercase sm:text-2xl">
          {label}
        </h2>

        <nav className="flex items-center gap-1">
          <Step href={`?m=${shiftMonth(month, -1)}`} label={t('prevMonth')} glyph="‹" />
          <Link
            href={`?m=${dayKey(new Date()).slice(0, 7)}&d=${today}`}
            className="ps-label rounded border-2 border-rule px-3 py-2 transition-colors hover:bg-sunk"
          >
            {t('today')}
          </Link>
          <Step href={`?m=${shiftMonth(month, 1)}`} label={t('nextMonth')} glyph="›" />
        </nav>
      </header>

      <div>
        <div className="grid grid-cols-7 gap-1">
          {heads.map((head) => (
            <p key={head} className="ps-label pb-1 text-center">
              {head}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((key) => {
            const events = byDay[key] ?? [];
            const outside = !key.startsWith(month);

            return (
              <Link
                key={key}
                href={`?m=${month}&d=${key}`}
                aria-current={key === selected ? 'date' : undefined}
                className={`flex min-h-[3rem] flex-col gap-1 rounded border-2 p-1 text-left transition-colors sm:min-h-[5.5rem] sm:p-2 ${
                  key === selected
                    ? 'border-ink bg-sunk'
                    : 'border-transparent hover:border-rule hover:bg-sunk'
                } ${outside ? 'opacity-40' : ''}`}
              >
                <span
                  className={`text-center text-sm tabular-nums sm:text-left ${
                    key === today ? 'font-bold text-reactor' : 'font-medium text-ink-muted'
                  }`}
                >
                  {Number(key.slice(8))}
                </span>

                {/* Две записи одного и того же, потому что в клетку шириной
                    в сорок пикселей название не влезает, а знать, что день занят,
                    нужно и там. Точки для телефона, названия для экрана. */}
                {events.length > 0 ? (
                  <span
                    aria-hidden="true"
                    className="flex justify-center gap-0.5 sm:hidden"
                  >
                    {events.slice(0, 3).map((event) => (
                      <span key={event.id} className="h-1 w-1 rounded-full bg-reactor" />
                    ))}
                  </span>
                ) : null}

                <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                  {events.slice(0, IN_CELL).map((event) => (
                    <span
                      key={event.id}
                      className="truncate rounded-sm bg-reactor/10 px-1 text-[0.6875rem] leading-tight text-ink"
                    >
                      {event.title}
                    </span>
                  ))}
                  {events.length > IN_CELL ? (
                    <span className="px-1 text-[0.6875rem] leading-tight text-ink-faint">
                      {t('more', { count: events.length - IN_CELL })}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Step({ href, label, glyph }: { href: string; label: string; glyph: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded border-2 border-rule text-lg leading-none text-ink-muted transition-colors hover:bg-sunk hover:text-ink"
    >
      <span aria-hidden="true">{glyph}</span>
    </Link>
  );
}
