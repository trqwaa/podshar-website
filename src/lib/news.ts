import 'server-only';

import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { authConfigured } from '@/lib/auth/config';
import { rangeEvents, zurichMidnight, type CalendarEvent } from '@/lib/calendar/events';
import { ZONE, dayKey, shiftDay } from '@/lib/calendar/scales';
import { BUILD } from '@/lib/build';
import { prisma } from '@/lib/db';
import { PATCHES } from '@/lib/patches';

/**
 * Новости сайта на главной: что скоро в календаре и что нового у остальных.
 *
 * Сделано по образцу рабочего портала владельца: «дальше в календаре»
 * отдельной карточкой и под ней лента, как входящие, — только одной плиткой,
 * которая листается. Плитка — `NewsTile` и `NewsPanel`.
 *
 * Всё считается здесь, на сервере, и уезжает в браузер готовыми строками: и
 * «вчера, 16:07», и «в календарь: «ужин» · пт 23.10». Строка, посчитанная на
 * сервере и отданная пропом, при гидратации совпадает сама с собой, а «вчера»,
 * посчитанное в браузере, около полуночи разошлось бы с серверным.
 *
 * **Новое приложение сайта — новый источник.** Источник — функция, которая
 * отдаёт свои записи ленты; добавить её в `SOURCES`, и лента возьмёт её
 * записи, отсортирует по времени вместе с остальными и пометит непрочитанное.
 * Так сюда приедет, например, учёт питания.
 */

/** Сколько назад смотрит лента. Две недели: дольше — уже не новости. */
const FEED_DAYS = 14;
/** На сколько вперёд смотрит календарь. Неделя — горизонт «скоро». */
const AHEAD_DAYS = 7;
/** Записей в ленте окна. Больше двадцати за две недели — это уже архив. */
const FEED_LIMIT = 20;

export type NewsPerson = { name: string; avatarPreset: string | null };

export type NewsEntry = {
  id: string;
  /** Когда случилось, мс. По нему сортировка и «непрочитано». */
  at: number;
  who: NewsPerson | null;
  /** Своё действие не бывает «новым» для себя. */
  mine: boolean;
  text: string;
  /** «вчера, 16:07» — посчитано на сервере. */
  when: string;
  href: string;
};

export type NewsNext = { title: string; when: string; where: string | null; href: string };

export type NewsDay = { label: string; items: { id: string; time: string; title: string; href: string }[] };

export type News = {
  next: NewsNext | null;
  days: NewsDay[];
  feed: NewsEntry[];
  /** Когда сервер собрал ленту, мс: всё, что было до него, зритель видел. */
  now: number;
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

type Context = {
  userId: string;
  locale: Locale;
  now: Date;
  since: Date;
  t: Translate;
  /** «сегодня, 16:07» / «вчера» / «пн 19.10» для момента в прошлом или будущем. */
  dayAt: (at: Date, withTime: boolean) => string;
};

type Source = (ctx: Context) => Promise<NewsEntry[]>;

const person = (user: { displayName: string; avatarPreset: string | null }): NewsPerson => ({
  name: user.displayName.split(' ')[0],
  avatarPreset: user.avatarPreset
});

const calendarHref = (key: string) => `/calendar?v=day&d=${key}`;

/**
 * Кто что завёл в календарь. Только другие: лента — это «что нового у
 * остальных», а своё событие новостью для себя не бывает.
 */
const eventsAdded: Source = async ({ userId, since, t, dayAt }) => {
  const rows = await prisma.calendarEvent.findMany({
    where: { createdAt: { gte: since }, createdById: { not: userId } },
    orderBy: { createdAt: 'desc' },
    take: FEED_LIMIT,
    include: { createdBy: { select: { id: true, displayName: true, avatarPreset: true } } }
  });
  return rows.map((row) => ({
    id: `event:${row.id}`,
    at: row.createdAt.getTime(),
    who: person(row.createdBy),
    mine: false,
    text: t('event', { title: row.title, when: dayAt(row.startsAt, !row.allDay) }),
    when: dayAt(row.createdAt, true),
    href: calendarHref(dayKey(row.startsAt))
  }));
};

/** Что другие прикрепили на общую доску. Личный список — не новости, его видит один. */
const notesPinned: Source = async ({ userId, since, t, dayAt }) => {
  const rows = await prisma.todoItem.findMany({
    where: { shared: true, createdAt: { gte: since }, createdById: { not: userId } },
    orderBy: { createdAt: 'desc' },
    take: FEED_LIMIT,
    include: { createdBy: { select: { id: true, displayName: true, avatarPreset: true } } }
  });
  return rows.map((row) => ({
    id: `note:${row.id}`,
    at: row.createdAt.getTime(),
    who: person(row.createdBy),
    mine: false,
    text: t('note', { title: row.title }),
    when: dayAt(row.createdAt, true),
    href: '/todos'
  }));
};

/**
 * Вышедшие патчи — новости сайта, поэтому все, и свои тоже; свой только не
 * помечается новым.
 *
 * Дата у патча без времени. Самый свежий вышел вместе с этой сборкой, и его
 * момент — время сборки: в полдне патч, выкаченный в 16:07, так и не стал бы
 * новым для того, кто заглядывал в час дня. Остальные — полдень своего дня по
 * Цюриху: в ленте патч встаёт посреди своего дня, а не первой записью суток.
 */
const patchesReleased: Source = async ({ userId, since, t, dayAt }) => {
  const fresh = PATCHES.filter((p) => zurichMidnight(p.date).getTime() >= since.getTime() - 86_400_000);
  if (fresh.length === 0) return [];
  const authors = await prisma.user.findMany({
    where: { handle: { in: [...new Set(fresh.map((p) => p.author))] } },
    select: { id: true, handle: true, displayName: true, avatarPreset: true }
  });
  const byHandle = new Map(authors.map((a) => [a.handle, a]));
  const built = BUILD.at && dayKey(BUILD.at) === PATCHES[0]?.date ? BUILD.at.getTime() : null;
  return fresh.map((p) => {
    const at = new Date(p === PATCHES[0] && built ? built : zurichMidnight(p.date).getTime() + 12 * 3600_000);
    const author = byHandle.get(p.author);
    // В ленту — первая фраза: она и есть заголовок, целиком текст на странице
    // патчей. Длинная первая фраза режется по слову, а не посреди него.
    const [lead] = p.note.split('. ');
    const note =
      p.note.length <= 90 ? p.note : lead.length <= 90 ? lead : `${p.note.slice(0, 90).replace(/\s+\S*$/, '')}…`;
    return {
      id: `patch:${p.version}`,
      at: at.getTime(),
      who: author ? person(author) : null,
      mine: author?.id === userId,
      text: t('patch', { version: p.version, note }),
      when: dayAt(at, false),
      href: '/patches'
    };
  });
};

/** Источники ленты. Новое приложение — новая функция выше и строчка здесь. */
const SOURCES: Source[] = [eventsAdded, notesPinned, patchesReleased];

export async function newsFor({ userId, locale }: { userId: string; locale: Locale }): Promise<News> {
  const t: Translate = await getTranslations({ locale, namespace: 'news' });
  const now = new Date();
  const todayKey = dayKey(now);

  const clock = new Intl.DateTimeFormat(locale, { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const short = new Intl.DateTimeFormat(locale, { timeZone: ZONE, weekday: 'short', day: '2-digit', month: '2-digit' });
  const long = new Intl.DateTimeFormat(locale, { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'long' });

  /**
   * «сегодня» / «завтра» / «вчера» по цюрихским суткам, иначе «пн 19.10».
   * Строчными: `Intl` пишет английские и немецкие дни с заглавной, а названия
   * на сайте — строчные. И без запятой после дня недели: «сб 24.10, 00:00», а
   * не «сб, 24.10, 00:00».
   */
  const dayWord = (key: string, fmt: Intl.DateTimeFormat, at: Date) =>
    key === todayKey
      ? t('today')
      : key === shiftDay(todayKey, 1)
        ? t('tomorrow')
        : key === shiftDay(todayKey, -1)
          ? t('yesterday')
          : fmt.format(at).replace(',', '').toLocaleLowerCase(locale);

  const dayAt = (at: Date, withTime: boolean) => {
    const day = dayWord(dayKey(at), short, at);
    return withTime ? t('at', { day, time: clock.format(at) }) : day;
  };

  if (!authConfigured()) return { next: null, days: [], feed: [], now: now.getTime() };

  // ── Скоро в календаре ──
  const keys = Array.from({ length: AHEAD_DAYS }, (_, i) => shiftDay(todayKey, i));
  const byDay = await rangeEvents(keys);
  const seen = new Set<string>();
  const days: NewsDay[] = [];
  let next: NewsNext | null = null;
  let nextAllDay: NewsNext | null = null;

  for (const key of keys) {
    const midnight = zurichMidnight(key).getTime();
    const noon = new Date(midnight + 12 * 3600_000);
    // Многодневное событие лежит в каждом своём дне — здесь оно называется
    // один раз, в первый видимый день, иначе отпуск занимал бы всю неделю.
    // Целодневное событие сегодня ещё идёт, хоть его начало — полночь — и в
    // прошлом; со временем — пока не кончилось.
    const events = (byDay[key] ?? []).filter(
      (e) => !seen.has(e.id) && (e.allDay || (e.endsAt ?? e.startsAt).getTime() > now.getTime())
    );
    events.forEach((e) => seen.add(e.id));
    if (events.length === 0) continue;

    const spans = (e: CalendarEvent) => e.allDay || e.startsAt.getTime() < midnight;
    const range = (e: CalendarEvent) =>
      spans(e)
        ? t('allDay')
        : e.endsAt
          ? `${clock.format(e.startsAt)}–${clock.format(e.endsAt)}`
          : clock.format(e.startsAt);

    days.push({
      label: dayWord(key, long, noon),
      items: events.map((e) => ({ id: e.id, time: range(e), title: e.title, href: calendarHref(key) }))
    });

    // Ближайшее — событие со временем: к нему надо успеть. Целодневное
    // становится «дальше», только если со временем на неделе ничего нет.
    for (const e of events) {
      const card = {
        title: e.title,
        when: `${dayWord(key, short, noon)}, ${range(e)}`,
        where: e.location,
        href: calendarHref(key)
      };
      if (!spans(e) && !next) next = card;
      if (spans(e) && !nextAllDay) nextAllDay = card;
    }
  }

  // ── Что нового ──
  const ctx: Context = { userId, locale, now, since: new Date(now.getTime() - FEED_DAYS * 86_400_000), t, dayAt };
  const parts = await Promise.all(
    SOURCES.map((source) =>
      source(ctx).catch((error) => {
        // Сломанный источник стоит ленте его записей, а не всей ленты.
        console.warn('[podshar] news source failed:', error instanceof Error ? error.message : error);
        return [] as NewsEntry[];
      })
    )
  );
  const feed = parts
    .flat()
    .sort((a, b) => b.at - a.at)
    .slice(0, FEED_LIMIT);

  return { next: next ?? nextAllDay, days, feed, now: now.getTime() };
}
