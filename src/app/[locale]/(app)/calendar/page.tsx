import { getTranslations } from 'next-intl/server';

import { Calendar } from '@/components/calendar/Calendar';
import type { DayEvent } from '@/components/calendar/DayPanel';
import { readSession } from '@/lib/auth/session';
import { rangeEvents } from '@/lib/calendar/events';
import { dayKey, isScale, visibleDays } from '@/lib/calendar/scales';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'calendar' });
  return { title: t('title') };
}

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Общий календарь.
 *
 * Масштаб и выбранный день приходят из адресной строки — ссылку на день можно
 * бросить в чат, «назад» работает, перезагрузка ничего не теряет. Оба значения
 * из браузера, поэтому проверяются по образцу: мусор в `?d=` не должен
 * превращаться в `Invalid Date` посреди рендера.
 *
 * Сервер отдаёт события сразу на весь видимый отрезок — от одного дня до года.
 * Дальше выбор дня внутри него делается на клиенте без единого запроса; сюда
 * возвращаются только за другим отрезком, то есть при смене масштаба или
 * периода.
 */
export default async function CalendarPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ v?: string; d?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'calendar' });

  const scale = isScale(query.v) ? query.v : 'month';
  const anchor = query.d && DAY.test(query.d) ? query.d : dayKey(new Date());

  const days = visibleDays(scale, anchor);
  const [found, session] = await Promise.all([rangeEvents(days), readSession()]);

  // Даты не переживают дорогу в клиентский компонент как объекты — только как
  // строки. ISO выбран потому, что из него собирается ровно тот же момент, а
  // формат на экране всё равно решает `Intl` на той стороне.
  const byDay: Record<string, DayEvent[]> = {};
  for (const [key, events] of Object.entries(found)) {
    byDay[key] = events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      allDay: event.allDay,
      author: event.author
    }));
  }

  return (
    <div className="grid grid-cols-1 content-start gap-3 p-3 sm:gap-4 sm:p-4">
      <section className="block-card animate-rise-in flex flex-col gap-1 px-6 py-6 sm:px-8">
        <h1 className="text-2xl font-semibold leading-tight text-ink sm:text-3xl">{t('title')}</h1>
        <p className="ps-label">{t('hint')}</p>
      </section>

      <Calendar
        locale={locale}
        scale={scale}
        anchor={anchor}
        days={days}
        byDay={byDay}
        canEdit={Boolean(session)}
      />
    </div>
  );
}
