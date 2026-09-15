import { getTranslations } from 'next-intl/server';

import { CalendarBoard } from '@/components/calendar/CalendarBoard';
import { DayPanel, type DayEvent } from '@/components/calendar/DayPanel';
import { readSession } from '@/lib/auth/session';
import { dayKey, monthEvents, monthKey } from '@/lib/calendar/events';
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

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Общий календарь.
 *
 * Который месяц открыт и какой день выбран — в адресной строке, а не в
 * состоянии React: ссылку на день можно кинуть в чат, «назад» работает, и
 * перезагрузка ничего не теряет. Оба значения приходят из браузера, поэтому
 * проверяются по образцу: мусор в `?m=` не должен превращаться в `Invalid Date`
 * посреди рендера.
 *
 * Данные читаются одним запросом на весь месяц и раскладываются по дням здесь,
 * а не в компонентах: сетке и панели дня нужен один и тот же набор, и два
 * запроса за одним и тем же разъехались бы при первой же правке.
 */
export default async function CalendarPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ m?: string; d?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'calendar' });

  const today = dayKey(new Date());
  const selected = query.d && DAY.test(query.d) ? query.d : today;
  // Месяц по умолчанию — тот, в котором выбранный день, иначе ссылка на день
  // соседнего месяца открывала бы сетку без него.
  const month = query.m && MONTH.test(query.m) ? query.m : monthKey(new Date(`${selected}T12:00:00Z`));

  const [byDay, session] = await Promise.all([monthEvents(month), readSession()]);

  // Даты не переживают дорогу в клиентский компонент как объекты — только как
  // строки. ISO выбран потому, что из него обратно собирается ровно тот же
  // момент, а формат на экране всё равно решает `Intl` на той стороне.
  const events: DayEvent[] = (byDay[selected] ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    allDay: event.allDay,
    author: event.author
  }));

  return (
    <div className="grid grid-cols-1 content-start gap-3 p-3 sm:gap-4 sm:p-4">
      <section className="block-card animate-rise-in flex flex-col gap-1 px-6 py-6 sm:px-8">
        <h1 className="text-2xl font-semibold leading-tight text-ink sm:text-3xl">{t('title')}</h1>
        <p className="ps-label">{t('hint')}</p>
      </section>

      <CalendarBoard locale={locale} month={month} selected={selected} byDay={byDay} />

      <DayPanel day={selected} events={events} canEdit={Boolean(session)} />
    </div>
  );
}
