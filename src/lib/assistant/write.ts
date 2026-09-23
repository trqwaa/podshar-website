import 'server-only';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

import { prisma } from '@/lib/db';
import { authConfigured } from '@/lib/auth/config';
import { zurichMidnight } from '@/lib/calendar/events';
import { ZONE, dayKey } from '@/lib/calendar/scales';
import { DEFAULT_COLOR, DEFAULT_PIN, NOTE_H, NOTE_W, freeSpot } from '@/lib/todos/notes';

/**
 * Что мопсу позволено записать.
 *
 * Отдельно от `lookup.ts`, и граница проведена не по аккуратности. Чтение —
 * это ответ, который можно проигнорировать; запись остаётся на доске и в общем
 * календаре после того, как разговор закрыли. Поэтому здесь другие правила, и
 * они собраны в одном файле, чтобы их было видно все разом:
 *
 * **Только создавать.** Ни править, ни удалять мопс не умеет, и инструментов
 * для этого нет. Созданное лишнее снимается в два клика любым из троих; стёртое
 * по ошибке не возвращается ничем. Ассиметрия намеренная.
 *
 * **Автор — тот, кто попросил.** `createdById` берётся из сессии, как и везде.
 * Записка, повешенная мопсом, подписана человеком: иначе на доске появляются
 * вещи, за которые некому отвечать.
 *
 * **Формат проверяется, а не угадывается.** Дата приходит строкой `2026-09-24`
 * и сверяется тем же выражением, что в форме календаря; не сошлось — отказ, а
 * не попытка разобрать «в следующий вторник». Модель, которой позволено
 * писать даты словами, однажды напишет их неправильно, и разбирать это будет
 * уже некому.
 *
 * **Время цюрихское**, и считается `zurichMidnight` — той же функцией, что у
 * формы. Своя арифметика здесь означала бы, что событие, заведённое голосом, и
 * событие, заведённое руками, попадают в разные часы.
 */

/** `2026-09-24`, как в форме календаря. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** `18:30`, как в форме календаря. */
const CLOCK = /^\d{2}:\d{2}$/;

export const PIN_NOTE_TOOL: Anthropic.Beta.BetaTool = {
  name: 'pin_note',
  description:
    'Pin a new sticky note to the todo board. Only when they actually ask for ' +
    'something to be written down — never to be helpful on your own.',
  input_schema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'What the note says. Their words, not a tidied-up version of them.'
      },
      which: {
        type: 'string',
        enum: ['shared', 'mine'],
        description: 'The board all three share, or this person’s own private one.'
      }
    },
    required: ['text', 'which'],
    additionalProperties: false
  },
  strict: true
};

export const ADD_EVENT_TOOL: Anthropic.Beta.BetaTool = {
  name: 'add_event',
  description:
    'Put a new event in the shared calendar. Only when they actually ask for it. ' +
    'All three of them will see it, so do not invent one to be helpful.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'What it is, in their words.' },
      day: {
        type: 'string',
        description:
          'The date as exactly YYYY-MM-DD, e.g. 2026-09-24. Work it out from the ' +
          'date you were given; never write it in words. If you are not sure which ' +
          'day they mean, ask instead of guessing.'
      },
      time: {
        type: 'string',
        description:
          'Zurich time as exactly HH:MM on a 24-hour clock, e.g. 18:30. ' +
          'An empty string means it lasts all day.'
      }
    },
    required: ['title', 'day', 'time'],
    additionalProperties: false
  },
  strict: true
};

export const WRITE_TOOLS = [PIN_NOTE_TOOL, ADD_EVENT_TOOL];

const WRITE_NAMES = new Set(WRITE_TOOLS.map((tool) => tool.name));

export const isWrite = (name: string) => WRITE_NAMES.has(name);

const Note = z.object({
  text: z.string().trim().min(1).max(200),
  which: z.enum(['shared', 'mine'])
});

const Event = z.object({
  title: z.string().trim().min(1).max(120),
  day: z.string().trim().refine((v) => DAY.test(v)),
  // Пустая строка — «весь день», как и в форме: человек, не назвавший часа, и
  // имел в виду весь день.
  time: z.string().trim().refine((v) => v === '' || CLOCK.test(v))
});

async function pinNote(input: unknown, userId: string): Promise<string> {
  const parsed = Note.safeParse(input ?? {});
  if (!parsed.success) return 'that note did not make sense — say you could not write it.';

  const { text, which } = parsed.data;
  const shared = which === 'shared';
  const where = shared ? { shared: true } : { shared: false, createdById: userId };

  // Место ищется по настоящим следам соседей, как и на самой доске: записка,
  // легшая поверх другой, выглядит как потерянная.
  const [taken, last] = await Promise.all([
    prisma.todoItem.findMany({ where, select: { x: true, y: true, w: true, h: true } }),
    prisma.todoItem.findFirst({ where, orderBy: { position: 'desc' }, select: { position: true } })
  ]);

  const spot = freeSpot(
    taken.flatMap((note) =>
      note.x === null || note.y === null
        ? []
        : [{ x: note.x, y: note.y, w: note.w ?? NOTE_W, h: note.h ?? NOTE_H }]
    )
  );

  await prisma.todoItem.create({
    data: {
      title: text,
      shared,
      x: spot.x,
      y: spot.y,
      color: DEFAULT_COLOR,
      pin: DEFAULT_PIN,
      position: (last?.position ?? 0) + 1,
      createdById: userId
    },
    select: { id: true }
  });

  revalidatePath('/todos');
  console.log(`[podshar] мопс повесил записку (${which}) для ${userId}: ${text}`);

  // Возвращается ровно то, что записано, и с прямым указанием прочитать это
  // вслух. Иначе он говорит «готово», а что именно готово — никто не видит до
  // следующего открытия доски, и ошибка живёт до тех пор же.
  return `Pinned to the ${shared ? 'shared' : 'private'} board: "${text}". Tell them exactly what it says.`;
}

async function addEvent(input: unknown, userId: string): Promise<string> {
  const parsed = Event.safeParse(input ?? {});
  if (!parsed.success) {
    return 'that date or time was not in a shape I can use — say you could not put it in, and ask them to say the day plainly.';
  }

  const { title, day, time } = parsed.data;

  // Здравый смысл поверх формата, и он тут не теоретический.
  //
  // Первая версия проверяла только вид даты, и мопс, не знавший года, завёл
  // зубного на 26 сентября **2025-го** — по формату безупречно, по смыслу мимо
  // на год, и такое событие не увидит никто никогда. Год теперь лежит в брифе,
  // а это вторая сеть под ним.
  //
  // Прошлое отвергается целиком. Задним числом событие заводят редко и руками;
  // а вот дата из головы почти всегда оказывается в прошлом, потому что модель
  // помнит год, в котором её учили. Отказ здесь стоит человеку одной фразы,
  // пропущенная ошибка — пропущенной встречи.
  const todayKey = dayKey(new Date());
  if (day < todayKey) {
    return (
      `${day} is in the past (today is ${todayKey}) — say you will not put it in, ` +
      `and that they should say the date again or add it themselves.`
    );
  }
  if (Number(day.slice(0, 4)) > Number(todayKey.slice(0, 4)) + 5) {
    return `${day} is not a year they can have meant — say you could not put it in.`;
  }

  const midnight = zurichMidnight(day);
  const [hours, minutes] = time ? time.split(':').map(Number) : [0, 0];
  if (hours > 23 || minutes > 59) return 'that clock time does not exist — say you could not put it in.';

  const startsAt = time ? new Date(midnight.getTime() + (hours * 60 + minutes) * 60_000) : midnight;

  await prisma.calendarEvent.create({
    data: { title, startsAt, endsAt: null, allDay: !time, createdById: userId },
    select: { id: true }
  });

  revalidatePath('/calendar');
  console.log(`[podshar] мопс завёл событие для ${userId}: ${day} ${time || 'весь день'} ${title}`);

  const when = time ? `${day} at ${time} (${ZONE})` : `${day}, all day`;
  return `Put in the shared calendar: "${title}" on ${when}. Read the day and the time back to them exactly — all three of them will see this.`;
}

/**
 * Выполнить запись и вернуть то, что уедет обратно модели.
 *
 * Без базы не пишем вовсе: в разработке её может не быть, и «записал» без базы
 * было бы враньём, которое заметят на следующей странице. Упавший запрос тоже
 * не роняет разговор — мопс получает строку, которую может произнести, а
 * причина уходит в лог.
 */
export async function runWrite(name: string, input: unknown, userId: string): Promise<string> {
  if (!authConfigured()) return 'there is no database here, so nothing was written — say so.';

  try {
    if (name === 'pin_note') return await pinNote(input, userId);
    return await addEvent(input, userId);
  } catch (error) {
    console.warn(`[podshar] запись ${name} не прошла:`, error);
    return 'it did not save — say so plainly, and do not pretend it did.';
  }
}
