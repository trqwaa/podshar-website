import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';

import { rangeEvents } from '@/lib/calendar/events';
import { ZONE, dayKey, shiftDay, visibleDays } from '@/lib/calendar/scales';
import { boardNotes } from '@/lib/todos/board';

/**
 * Как мопс узнаёт, что у людей в календаре и на доске.
 *
 * Отдельный модуль, и отдельный он по одной причине: **эти данные не должны
 * попасть в бриф**. Бриф кешируется целиком и одинаков на каждом ходу — это вся
 * экономия фичи, кешированное чтение стоит десятую часть. Стоит дописать туда
 * что-то, меняющееся от запроса к запросу, и кеш перестаёт совпадать, цена
 * втрое, а мопс вдобавок начинает пересказывать вчерашний список как сегодняшний.
 * Поэтому данные приходят **ответом инструмента**, то есть в `messages`, уже за
 * точкой кеширования, и живут ровно один разговор.
 *
 * Второе, ради чего это здесь: личный список. Записки бывают общие и личные, и
 * выбирает их `boardNotes` **по человеку из сессии** — идентификатор приходит с
 * сервера, а не из того, что модель написала в аргументах. Модель не может
 * попросить чужой личный список, потому что ей нечем его назвать.
 */

/** Сколько строк отдаём максимум. Дальше это уже не ответ, а выгрузка базы. */
const MAX_ROWS = 40;

/**
 * Два инструмента, а не один с полем «что смотреть».
 *
 * У них разные вопросы: у календаря — какой отрезок, у доски — который из двух
 * списков. Слепленные в один инструмент, они дают схему, где половина полей
 * бессмысленна при любом вызове, а `strict` требует все обязательные поля разом.
 *
 * Перечисления — то же, ради чего они у `navigate`: модель, которой позволено
 * написать дату строкой, однажды напишет «следующий вторник», и это придётся
 * разбирать. Здесь выбирать можно только из того, что мы умеем посчитать.
 */
export const CALENDAR_TOOL: Anthropic.Beta.BetaTool = {
  name: 'calendar',
  description:
    'Look at the shared calendar. Use this whenever they ask what is happening, ' +
    'when something is, or whether they are free — never guess at it.',
  input_schema: {
    type: 'object',
    properties: {
      when: {
        type: 'string',
        enum: ['today', 'tomorrow', 'week', 'month'],
        description: 'Which stretch of the calendar to read.'
      }
    },
    required: ['when'],
    additionalProperties: false
  },
  strict: true
};

export const BOARD_TOOL: Anthropic.Beta.BetaTool = {
  name: 'board',
  description:
    'Look at the sticky notes on the todo board. Use this whenever they ask what ' +
    'they have to do, or what is on the board — never guess at it.',
  input_schema: {
    type: 'object',
    properties: {
      which: {
        type: 'string',
        enum: ['shared', 'mine'],
        description:
          'The board everyone shares, or this person’s own private one.'
      }
    },
    required: ['which'],
    additionalProperties: false
  },
  strict: true
};

export const LOOKUP_TOOLS = [CALENDAR_TOOL, BOARD_TOOL];

/** Есть ли у нас исполнитель под это имя. Всё прочее уходит `navigate`. */
export const isLookup = (name: string) => name === 'calendar' || name === 'board';

/**
 * Время суток в Цюрихе, словами, которые не надо разбирать.
 *
 * Календарь всего сайта живёт в цюрихских сутках — общий факт должен выглядеть
 * одинаково у всех троих, где бы они ни сидели. Мопс обязан считать так же,
 * иначе в половине двенадцатого ночи он будет спорить с сеткой о том, какой
 * сегодня день.
 */
function nowInZurich(): { key: string; line: string } {
  const now = new Date();
  const key = dayKey(now);
  const stamp = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
  return { key, line: `Right now it is ${key} ${stamp} in Zurich (${ZONE}).` };
}

/**
 * `2026-09-19 19:00-20:30 — зал · added by Trqwaa` — одна строка на событие.
 *
 * Имя подписано словами, а не скобками. Со скобками модель читала их как «чьё
 * это»: событие, которое завёл Trqwaa, в ответе становилось «борис в зале» —
 * имя из скобок она принимала за участника и подставляла не то. Кто завёл — это
 * всё, что мы знаем; так и написано.
 */
function eventLine(
  span: string,
  event: Awaited<ReturnType<typeof rangeEvents>>[string][number]
) {
  const by = `added by ${event.author}`;
  if (event.allDay) return `${span} all day — ${event.title} · ${by}`;

  const clock = (at: Date) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(at);

  const hours = event.endsAt
    ? `${clock(event.startsAt)}-${clock(event.endsAt)}`
    : clock(event.startsAt);
  const where = event.location ? ` · at ${event.location}` : '';
  return `${span} ${hours} — ${event.title}${where} · ${by}`;
}

async function readCalendar(when: string): Promise<string> {
  const { key, line } = nowInZurich();

  const days =
    when === 'today'
      ? [key]
      : when === 'tomorrow'
        ? [shiftDay(key, 1)]
        : visibleDays(when === 'week' ? 'week' : 'month', key);

  const byDay = await rangeEvents(days);

  // Одна строка на событие, а не на день.
  //
  // `rangeEvents` раскладывает многодневное событие в каждый его день — сетке
  // так и надо, иначе поездка видна только в день отъезда. В пересказе это
  // читается как несколько разных событий: мопс увидел один день рождения в
  // двух клетках и спросил, зачем отмечать дважды. Здесь дни схлопываются
  // обратно в отрезок, и событие называется ровно один раз.
  const seen = new Map<string, { first: string; last: string; event: (typeof byDay)[string][number] }>();
  for (const day of days) {
    for (const event of byDay[day] ?? []) {
      const known = seen.get(event.id);
      if (known) known.last = day;
      else seen.set(event.id, { first: day, last: day, event });
    }
  }

  const rows = [...seen.values()].map(({ first, last, event }) =>
    eventLine(first === last ? first : `${first}…${last}`, event)
  );

  const range = days.length === 1 ? days[0] : `${days[0]} … ${days[days.length - 1]}`;
  const head = `${line}\nSHARED CALENDAR, ${range}:`;

  // Пусто — это ответ, и ответ важный. Без такой строки модель видит хвост
  // промпта без данных и дописывает правдоподобное: в прошлый раз ровно так
  // появлялись встречи, которых никто не заводил.
  if (rows.length === 0) return `${head}\nnothing at all in this range.`;

  const shown = rows.slice(0, MAX_ROWS);
  const rest = rows.length - shown.length;
  return `${head}\n${shown.join('\n')}${rest > 0 ? `\n(+${rest} more, not shown)` : ''}`;
}

async function readBoard(which: string, userId: string): Promise<string> {
  const shared = which !== 'mine';
  const notes = await boardNotes(userId, shared);
  const head = `${shared ? 'SHARED' : 'THEIR OWN PRIVATE'} BOARD:`;

  if (notes.length === 0) return `${head}\nnothing pinned to it.`;

  const shown = notes.slice(0, MAX_ROWS);
  const rest = notes.length - shown.length;
  const rows = shown.map(
    (note) => `- ${note.title}${note.done ? ' [done]' : ''} · added by ${note.author}`
  );
  return `${head}\n${rows.join('\n')}${rest > 0 ? `\n(+${rest} more, not shown)` : ''}`;
}

/**
 * Выполнить вызов и вернуть то, что уедет обратно модели.
 *
 * Ошибку не роняем наружу: упавший запрос к базе здесь — это мопс, который не
 * смог посмотреть, а не сломанный сайт. Он получает строку, которую может
 * произнести, и разговор продолжается. Но в лог она попадает: молчаливое
 * вырождение в «ничего не нашёл» неотличимо снаружи от пустого календаря.
 */
export async function runLookup(
  name: string,
  input: unknown,
  userId: string
): Promise<string> {
  const args = (input ?? {}) as { when?: string; which?: string };
  try {
    if (name === 'calendar') return await readCalendar(args.when ?? 'week');
    return await readBoard(args.which ?? 'shared', userId);
  } catch (error) {
    console.warn(`[podshar] инструмент ${name} не отработал:`, error);
    return 'could not read it this time — say so, do not make something up.';
  }
}
