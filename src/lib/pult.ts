import 'server-only';

import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { brawlMeta } from '@/lib/brawl-meta';
import { rangeEvents, zurichMidnight } from '@/lib/calendar/events';
import { ZONE, dayKey } from '@/lib/calendar/scales';
import { PATCHES } from '@/lib/patches';
import { listPresence } from '@/lib/presence';
import { boardNotes } from '@/lib/todos/board';
import { getTrains } from '@/lib/trains';
import { getWeather, type Condition } from '@/lib/weather';

/**
 * Что пульт пишет справа от каждого раздела: одна строка живого ответа.
 *
 * Это и есть его отличие от любого поисковика: строка не только ведёт, она
 * сразу отвечает — когда поезд, что сегодня в календаре, сколько висит на
 * доске. Часто идти никуда не надо.
 *
 * Готовые фразы, а не числа: формулировка на языке страницы живёт здесь, в
 * одном месте, и в браузер не надо везти ни раздел `weather`, ни
 * календарную логику.
 *
 * Каждый источник — со своим потолком по времени и сам по себе: SBB думает
 * дольше базы, и молчащий SBB не должен держать строку календаря. Не успел или
 * упал — строки просто нет, раздел в списке остаётся.
 */

/** Потолок на один источник. Пульт открывается мгновенно, ответы доезжают следом. */
const BUDGET_MS = 1500;
/** Сколько человек считается «тут»: столько же, сколько у плитки на главной. */
const ONLINE_MS = 2 * 60_000;

export type PultAnswers = Partial<Record<string, string>>;

/**
 * Погода для неба пульта: что за окном и какой ветер, км/ч. Та же, что в
 * плитке на главной, и из того же кеша: в пульте идёт тот же дождь, что над
 * Цюрихом (решение владельца от 25 октября 2026).
 */
export type PultSky = { condition: Condition; wind: number | null };

async function within<T>(work: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), BUDGET_MS);
      })
    ]);
  } catch (error) {
    console.warn('[podshar] pult:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function pultAnswers({
  locale,
  userId,
  handle
}: {
  locale: Locale;
  userId: string;
  handle: string;
}): Promise<{ answers: PultAnswers; sky: PultSky | null }> {
  const [t, tWeather] = await Promise.all([
    getTranslations({ locale, namespace: 'pult.answers' }),
    getTranslations({ locale, namespace: 'weather' })
  ]);

  const now = Date.now();
  const clock = new Intl.DateTimeFormat(locale, {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const [trains, weather, people, today, shared, mine, meta] = await Promise.all([
    within(getTrains()),
    within(getWeather()),
    within(listPresence()),
    within(rangeEvents([dayKey(new Date(now))])),
    userId ? within(boardNotes(userId, true)) : null,
    userId ? within(boardNotes(userId, false)) : null,
    within(brawlMeta())
  ]);

  const answers: PultAnswers = {};

  // Поезда — домой с HB, как у мопса: ближайший, который ещё не ушёл.
  const row = trains?.find((r) => r.handle === handle);
  if (row) {
    if (!row.station) answers.trains = t('trainsNoStation');
    else if (row.atHB) answers.trains = t('trainsAtHB');
    else {
      const next = row.departures.find((d) => d.departs + d.delay * 60_000 > now);
      if (next) {
        // Ожидаемое время, а не по расписанию: «через N мин» считается с
        // опозданием, и время рядом обязано с ним сходиться. Иначе опоздавший
        // поезд показывал «в 18:05 · через 3 мин» в 18:07.
        const leaves = next.departs + next.delay * 60_000;
        const min = Math.round((leaves - now) / 60_000);
        answers.trains = t('trainsNext', { time: clock.format(leaves), min });
      }
    }
  }

  // Главная — это погода и кто тут: обе плитки живут на ней.
  if (weather || people) {
    const parts: string[] = [];
    if (weather) {
      const key = weather.condition === 'clear' && !weather.isDay ? 'clearNight' : weather.condition;
      parts.push(t('weather', { temp: Math.round(weather.temp), condition: tWeather(`conditions.${key}`) }));
    }
    if (people) {
      const here = people
        .filter((p) => p.handle !== handle && p.lastSeen !== null && now - p.lastSeen < ONLINE_MS)
        .map((p) => p.displayName.split(' ')[0]);
      parts.push(here.length ? t('here', { names: here.join(', ') }) : t('nobody'));
    }
    answers.home = parts.join(' · ');
  }

  // Календарь — сегодня. Многодневное событие лежит в каждом своём дне, поэтому
  // здесь, в одном дне, повторов нет.
  if (today) {
    const key = dayKey(new Date(now));
    const events = today[key] ?? [];
    if (events.length === 0) answers.calendar = t('calendarEmpty');
    else {
      // Многодневное событие, начавшееся раньше сегодняшней полуночи, для
      // сегодня — «весь день», а не «в 18:00»: время его начала было вчера.
      // Первым называется ближайшее событие со временем — оно и есть то, к
      // которому надо успеть; целодневные идут после.
      const midnight = zurichMidnight(key).getTime();
      const spans = (e: (typeof events)[number]) => e.allDay || e.startsAt.getTime() < midnight;
      // Фильтр — по концу, как и было: ночное кино до 00:30 к обеду уже
      // закончилось, хоть и началось вчера. `spans` — только подпись и порядок.
      const ahead = events
        .filter((e) => e.allDay || (e.endsAt ?? e.startsAt).getTime() > now)
        .sort((a, b) => Number(spans(a)) - Number(spans(b)) || a.startsAt.getTime() - b.startsAt.getTime());
      const first = ahead[0];
      if (!first) answers.calendar = t('calendarDone');
      else {
        const line = spans(first)
          ? t('calendarAllDay', { title: first.title })
          : t('calendarNext', { title: first.title, time: clock.format(first.startsAt) });
        answers.calendar = ahead.length > 1 ? t('calendarMore', { first: line, n: ahead.length - 1 }) : line;
      }
    }
  }

  if (shared && mine) {
    answers.todos = t('todos', {
      shared: shared.filter((n) => !n.done).length,
      mine: mine.filter((n) => !n.done).length
    });
  }

  const top = meta?.tier[0];
  if (top) answers.games = t('games', { name: top.name });

  const latest = PATCHES[0];
  answers.patches = t('patches', {
    version: latest.version,
    date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: ZONE }).format(
      new Date(latest.date)
    )
  });

  return { answers, sky: weather ? { condition: weather.condition, wind: weather.wind } : null };
}
