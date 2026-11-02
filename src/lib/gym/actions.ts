'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth/session';
import { dayKey } from '@/lib/calendar/scales';
import { routing } from '@/i18n/routing';
import { isExercise } from './exercises';
import { foodOf, junkByName, macrosFor } from './foods';
import { programOf } from './programs';
import { parseFatsecretCsv } from './fatsecret-import';
import { parseSleepCsv } from './sleep-import';
import { parseStrongCsv } from './strong-import';
import { previousSets, weekdayOf } from './data';
import {
  Custom,
  Day,
  Distance,
  Id,
  MAX_FOOD_PER_DAY,
  MAX_PLAN_ITEMS,
  MEALS,
  Reps,
  Seconds,
  Sets,
  Weekday,
  Weight,
  addFoodsFor,
  addGoalFor,
  addMeasureFor,
  addSleepFor,
  customRow,
  notFuture,
  refresh,
  removeFoodsFor,
  removeGoalFor,
  removeMeasureFor,
  removeSleepFor,
  removeWorkoutFor,
  saveProfileFor,
  type FoodRow
} from './diary';

/**
 * Всё, что зал может менять.
 *
 * Договор тот же, что у доски и календаря: наружу `{ error: <ключ> }` или
 * `{ ok: true }`, фразы лежат в каталогах на странице.
 *
 * **Писать можно только в свой дневник.** Каждое действие берёт человека из
 * сессии и проверяет, что строка его, — браузер может прислать любой id, а
 * действие — это открытый POST. Чужой дневник открывается на чтение, и только.
 *
 * Запись, которую умеет и мопс, лежит в `diary.ts` и зовётся отсюда с
 * человеком из сессии: правила у кнопки и у мопса одни.
 */

export type GymResult = {
  ok?: boolean;
  error?: string;
  id?: string;
  count?: number;
  skipped?: number;
  empty?: boolean;
  /** Импорт: подходов, дней и упражнений, которых нет в справочнике. */
  sets?: number;
  days?: number;
  unknown?: number;
};

async function me(): Promise<string | null> {
  const session = await readSession();
  return session?.userId ?? null;
}

/** Действие от имени человека из сессии; без сессии — `signedOut`. */
const asMe =
  <A extends unknown[], R>(run: (userId: string, ...args: A) => Promise<R>) =>
  async (...args: A): Promise<R | GymResult> => {
    const userId = await me();
    return userId ? run(userId, ...args) : { error: 'signedOut' };
  };

const idOf = (input: unknown) => (input as { id?: unknown })?.id;

// ─── Цель и профиль ─────────────────────────────────────────────────────────

export async function saveProfile(input: unknown): Promise<GymResult> {
  return asMe(saveProfileFor)(input);
}

export async function addGoal(input: unknown): Promise<GymResult> {
  return asMe(addGoalFor)(input);
}

export async function removeGoal(input: unknown): Promise<GymResult> {
  return asMe(removeGoalFor)(idOf(input));
}

// ─── План на доске ──────────────────────────────────────────────────────────

export async function savePlanDay(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z.object({ weekday: Weekday, title: z.string().trim().max(40) }).safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { weekday, title } = parsed.data;
  await prisma.gymPlanDay.upsert({
    where: { userId_weekday: { userId, weekday } },
    update: { title },
    create: { userId, weekday, title }
  });
  refresh();
  return { ok: true };
}

/** Стереть день с доски — вместе с упражнениями: день без них и есть день отдыха. */
export async function removePlanDay(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const weekday = Weekday.safeParse((input as { weekday?: unknown })?.weekday);
  if (!weekday.success) return { error: 'invalid' };
  await prisma.gymPlanDay.deleteMany({ where: { userId, weekday: weekday.data } });
  refresh();
  return { ok: true };
}

export async function addPlanItem(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z
    .object({
      weekday: Weekday,
      exercise: z.string().refine(isExercise),
      sets: Sets,
      reps: Reps,
      weight: Weight.nullable().optional(),
      seconds: Seconds.nullable().optional()
    })
    .safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { weekday, exercise, sets, reps, weight, seconds } = parsed.data;

  const day = await prisma.gymPlanDay.upsert({
    where: { userId_weekday: { userId, weekday } },
    update: {},
    create: { userId, weekday, title: '' },
    select: { id: true, items: { select: { position: true }, orderBy: { position: 'desc' } } }
  });
  if (day.items.length >= MAX_PLAN_ITEMS) return { error: 'tooMany' };

  const created = await prisma.gymPlanItem.create({
    data: { dayId: day.id, exercise, sets, reps, weight: weight ?? null, seconds: seconds ?? null, position: (day.items[0]?.position ?? 0) + 1 },
    select: { id: true }
  });
  refresh();
  return { ok: true, id: created.id };
}

async function ownsPlanItem(id: string, userId: string) {
  const item = await prisma.gymPlanItem.findUnique({ where: { id }, select: { day: { select: { userId: true } } } });
  return item?.day.userId === userId;
}

export async function updatePlanItem(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z
    .object({ id: Id, sets: Sets.optional(), reps: Reps.optional(), weight: Weight.nullable().optional(), seconds: Seconds.nullable().optional() })
    .safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { id, ...data } = parsed.data;
  if (!(await ownsPlanItem(id, userId))) return { error: 'notYours' };
  await prisma.gymPlanItem.update({ where: { id }, data });
  refresh();
  return { ok: true };
}

export async function removePlanItem(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const id = Id.safeParse((input as { id?: unknown })?.id);
  if (!id.success) return { error: 'invalid' };
  if (!(await ownsPlanItem(id.data, userId))) return { error: 'notYours' };
  await prisma.gymPlanItem.delete({ where: { id: id.data } });
  refresh();
  return { ok: true };
}

/**
 * Нарисовать на доске готовую программу. Прежний план стирается целиком, и
 * программа пишется той же транзакцией — доска не останется наполовину
 * стёртой, если что-то упадёт посередине. Веса пустые: их впишет человек.
 */
export async function applyProgram(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const id = z.string().max(40).safeParse((input as { program?: unknown })?.program);
  const program = id.success ? programOf(id.data) : null;
  if (!program) return { error: 'invalid' };
  await prisma.$transaction([
    prisma.gymPlanDay.deleteMany({ where: { userId } }),
    ...program.days.map((day) =>
      prisma.gymPlanDay.create({
        data: {
          userId,
          weekday: day.weekday,
          title: '',
          items: { create: day.items.map((item, i) => ({ exercise: item.exercise, sets: item.sets, reps: item.reps, position: i + 1 })) }
        }
      })
    )
  ]);
  refresh();
  return { ok: true };
}

// ─── Тренировка ─────────────────────────────────────────────────────────────

/** Подходов в новом упражнении, если план не сказал иначе. */
const DEFAULT_SETS = 3;
const MAX_BLOCKS = 20;
const MAX_SETS_PER_BLOCK = 15;

/**
 * Начать тренировку. Идущая уже есть — вернуть её: две открытые разом — это
 * забытая вчерашняя, а не план.
 *
 * Из плана — с подходами из доски, а вес берётся из плана или из прошлого
 * раза, как подставляет Strong: открыл тренировку — цифры уже стоят.
 */
export async function startWorkout(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const fromPlan = z.object({ fromPlan: z.boolean() }).safeParse(input);
  if (!fromPlan.success) return { error: 'invalid' };

  const open = await prisma.gymSession.findFirst({ where: { userId, completedAt: null }, select: { id: true } });
  if (open) return { ok: true, id: open.id };

  const today = dayKey(new Date());
  const day = fromPlan.data.fromPlan
    ? await prisma.gymPlanDay.findUnique({
        where: { userId_weekday: { userId, weekday: weekdayOf(today) } },
        include: { items: { orderBy: { position: 'asc' } } }
      })
    : null;

  const items = day?.items ?? [];
  const before = await previousSets(userId, [...new Set(items.map((i) => i.exercise))]);

  const created = await prisma.gymSession.create({
    data: {
      userId,
      scheduledFor: new Date(),
      focus: day?.title || null,
      sets: {
        create: items.flatMap((item, block) =>
          Array.from({ length: item.sets }, (_, index) => ({
            exercise: item.exercise,
            block,
            index,
            weight: item.weight ?? before[item.exercise]?.[index]?.weight ?? before[item.exercise]?.[0]?.weight ?? null,
            reps: item.reps,
            seconds: item.seconds ?? before[item.exercise]?.[index]?.seconds ?? before[item.exercise]?.[0]?.seconds ?? null,
            distance: before[item.exercise]?.[index]?.distance ?? before[item.exercise]?.[0]?.distance ?? null
          }))
        )
      }
    },
    select: { id: true }
  });
  refresh();
  return { ok: true, id: created.id };
}

async function openSession(sessionId: string, userId: string) {
  return prisma.gymSession.findFirst({ where: { id: sessionId, userId, completedAt: null }, select: { id: true } });
}

export async function addExercise(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z.object({ sessionId: Id, exercise: z.string().refine(isExercise) }).safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { sessionId, exercise } = parsed.data;
  if (!(await openSession(sessionId, userId))) return { error: 'notYours' };

  const last = await prisma.gymSet.findFirst({ where: { sessionId }, orderBy: { block: 'desc' }, select: { block: true } });
  const block = (last?.block ?? -1) + 1;
  if (block >= MAX_BLOCKS) return { error: 'tooMany' };

  const before = (await previousSets(userId, [exercise]))[exercise] ?? [];
  const count = Math.max(DEFAULT_SETS, Math.min(before.length, 6));
  await prisma.gymSet.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      sessionId,
      exercise,
      block,
      index,
      weight: before[index]?.weight ?? before[0]?.weight ?? null,
      reps: before[index]?.reps ?? before[0]?.reps ?? null,
      seconds: before[index]?.seconds ?? before[0]?.seconds ?? null,
      distance: before[index]?.distance ?? before[0]?.distance ?? null
    }))
  });
  refresh();
  return { ok: true };
}

/** Ещё подход — копией последнего в этом упражнении: так в зале и записывают. */
export async function addSet(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z.object({ sessionId: Id, block: z.coerce.number().int().min(0).max(MAX_BLOCKS) }).safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { sessionId, block } = parsed.data;
  if (!(await openSession(sessionId, userId))) return { error: 'notYours' };

  const last = await prisma.gymSet.findFirst({ where: { sessionId, block }, orderBy: { index: 'desc' } });
  if (!last) return { error: 'invalid' };
  if (last.index + 1 >= MAX_SETS_PER_BLOCK) return { error: 'tooMany' };
  const created = await prisma.gymSet.create({
    data: { sessionId, exercise: last.exercise, block, index: last.index + 1, weight: last.weight, reps: last.reps, seconds: last.seconds, distance: last.distance },
    select: { id: true }
  });
  refresh();
  return { ok: true, id: created.id };
}

async function ownsSet(id: string, userId: string) {
  const row = await prisma.gymSet.findUnique({ where: { id }, select: { session: { select: { userId: true } } } });
  return row?.session.userId === userId;
}

export async function updateSet(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z
    .object({
      id: Id,
      weight: Weight.nullable().optional(),
      reps: z.coerce.number().int().min(0).max(1000).nullable().optional(),
      seconds: Seconds.nullable().optional(),
      distance: Distance.nullable().optional(),
      done: z.boolean().optional(),
      warmup: z.boolean().optional()
    })
    .safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { id, done, ...rest } = parsed.data;
  if (!(await ownsSet(id, userId))) return { error: 'notYours' };
  await prisma.gymSet.update({
    where: { id },
    data: { ...rest, ...(done === undefined ? {} : { done, doneAt: done ? new Date() : null }) }
  });
  refresh();
  return { ok: true };
}

export async function removeSet(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const id = Id.safeParse((input as { id?: unknown })?.id);
  if (!id.success) return { error: 'invalid' };
  if (!(await ownsSet(id.data, userId))) return { error: 'notYours' };
  await prisma.gymSet.delete({ where: { id: id.data } });
  refresh();
  return { ok: true };
}

export async function removeBlock(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z.object({ sessionId: Id, block: z.coerce.number().int().min(0).max(MAX_BLOCKS) }).safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  if (!(await openSession(parsed.data.sessionId, userId))) return { error: 'notYours' };
  await prisma.gymSet.deleteMany({ where: { sessionId: parsed.data.sessionId, block: parsed.data.block } });
  refresh();
  return { ok: true };
}

export async function renameWorkout(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z.object({ sessionId: Id, title: z.string().trim().max(60) }).safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  await prisma.gymSession.updateMany({
    where: { id: parsed.data.sessionId, userId },
    data: { focus: parsed.data.title || null }
  });
  refresh();
  return { ok: true };
}

/**
 * Закончить. Неотмеченные подходы не сохраняются — как в Strong: в историю
 * идёт сделанное, а не задуманное. Не отмечено ничего — тренировки не было.
 */
export async function finishWorkout(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z.object({ sessionId: Id }).safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { sessionId } = parsed.data;
  if (!(await openSession(sessionId, userId))) return { error: 'notYours' };

  await prisma.gymSet.deleteMany({ where: { sessionId, done: false } });
  const left = await prisma.gymSet.count({ where: { sessionId } });
  if (left === 0) {
    await prisma.gymSession.delete({ where: { id: sessionId } });
    refresh();
    return { ok: true, empty: true };
  }
  await prisma.gymSession.update({ where: { id: sessionId }, data: { completedAt: new Date() } });
  refresh();
  return { ok: true };
}

/** Бросить идущую тренировку или стереть из истории законченную. */
export async function removeWorkout(input: unknown): Promise<GymResult> {
  return asMe(removeWorkoutFor)(idOf(input));
}

// ─── Замеры ─────────────────────────────────────────────────────────────────

export async function addMeasure(input: unknown): Promise<GymResult> {
  return asMe(addMeasureFor)(input);
}

export async function removeMeasure(input: unknown): Promise<GymResult> {
  return asMe(removeMeasureFor)(idOf(input));
}

// ─── Питание ────────────────────────────────────────────────────────────────

export async function addFood(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = Custom.extend({
    day: Day,
    meal: z.enum(MEALS),
    locale: z.enum(routing.locales).default('ru'),
    food: z.string().max(40).nullable().optional()
  }).safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const data = parsed.data;
  if (!notFuture(data.day)) return { error: 'future' };
  if ((await prisma.foodEntry.count({ where: { userId, eatenOn: data.day } })) >= MAX_FOOD_PER_DAY) {
    return { error: 'tooMany' };
  }

  const item = data.food ? foodOf(data.food) : undefined;
  if (data.food && !item) return { error: 'invalid' };

  let row: FoodRow;
  if (item) {
    const grams = data.grams ?? item.portion.grams;
    row = { food: item.id, name: item.name[data.locale], grams, ...macrosFor(item, grams), junk: item.quality === 'junk', estimated: false };
  } else {
    const made = customRow(data);
    if ('error' in made) return made;
    row = made;
  }

  const created = await prisma.foodEntry.create({
    data: { userId, eatenOn: data.day, meal: data.meal, ...row },
    select: { id: true }
  });
  refresh();
  return { ok: true, id: created.id };
}

/** Всё с одного фото разом: тарелка — это несколько записей, но одно нажатие. */
export async function addFoods(input: unknown): Promise<GymResult> {
  return asMe(addFoodsFor)(input);
}

export async function removeFood(input: unknown): Promise<GymResult> {
  return asMe(removeFoodsFor)([idOf(input)]);
}

/** «Отменить» после записи словами: всё, что легло одним нажатием. */
export async function removeFoods(input: unknown): Promise<GymResult> {
  return asMe(removeFoodsFor)((input as { ids?: unknown })?.ids);
}

// ─── Сон ────────────────────────────────────────────────────────────────────

export async function addSleep(input: unknown): Promise<GymResult> {
  return asMe(addSleepFor)(input);
}

export async function removeSleep(input: unknown): Promise<GymResult> {
  return asMe(removeSleepFor)(idOf(input));
}

/** Файл больше этого — не выгрузка сна, а что-то другое. Год сна в CSV — десятки килобайт. */
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/**
 * Импорт сна из CSV (выгрузка Zepp Life или любая таблица с началом и концом).
 * Ночи, записанные руками, импорт не перетирает: что человек ввёл сам, то он и
 * имел в виду. Прошлый импорт — перетирает: свежая выгрузка точнее.
 */
export async function importSleep(formData: FormData): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'noFile' };
  if (file.size > MAX_IMPORT_BYTES) return { error: 'tooBig' };

  const { nights, format } = parseSleepCsv(await file.text());
  if (!format) return { error: 'format' };
  if (nights.length === 0) return { error: 'noNights' };

  const source = format === 'zepp' ? 'zepp' : 'csv';
  const existing = await prisma.sleepEntry.findMany({
    where: { userId, night: { in: nights.map((n) => n.night) } },
    select: { night: true, source: true }
  });
  const manual = new Set(existing.filter((e) => e.source === 'manual').map((e) => e.night));
  const known = new Set(existing.map((e) => e.night));

  const fresh = nights.filter((n) => !known.has(n.night));
  const redo = nights.filter((n) => known.has(n.night) && !manual.has(n.night));

  await prisma.$transaction([
    prisma.sleepEntry.createMany({
      data: fresh.map((n) => ({ userId, ...n, source })),
      skipDuplicates: true
    }),
    ...redo.map((n) =>
      prisma.sleepEntry.update({
        where: { userId_night: { userId, night: n.night } },
        data: { bedAt: n.bedAt, wakeAt: n.wakeAt, minutes: n.minutes, deep: n.deep, rem: n.rem, source }
      })
    )
  ]);
  refresh();
  return { ok: true, count: fresh.length + redo.length, skipped: manual.size };
}

// ─── Импорт из Strong и FatSecret ───────────────────────────────────────────

/** Выгрузка Strong за годы — мегабайты; больше этого — уже не она. */
const MAX_EXPORT_BYTES = 12 * 1024 * 1024;
/** Сколько строк в одном `createMany`: тысячи подходов за раз база примет, десятки тысяч — нет. */
const CHUNK = 1000;
const chunks = <T>(list: T[]) => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

/**
 * Тренировки из Strong — вся история разом, чтобы мопс знал тебя не с
 * сегодняшнего дня. Повторная выгрузка не задваивает: тренировка с той же
 * секундой начала у того же человека уже есть — пропускается.
 */
export async function importStrong(formData: FormData): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'noFile' };
  if (file.size > MAX_EXPORT_BYTES) return { error: 'fileTooBig' };

  const { workouts, unknown, format } = parseStrongCsv(await file.text());
  if (!format) return { error: 'strongFormat' };
  if (workouts.length === 0) return { error: 'noWorkouts' };

  const existing = await prisma.gymSession.findMany({
    where: { userId, scheduledFor: { in: workouts.map((w) => w.startedAt) } },
    select: { scheduledFor: true }
  });
  const known = new Set(existing.map((e) => e.scheduledFor.getTime()));
  const fresh = workouts.filter((w) => !known.has(w.startedAt.getTime()));

  const sessions = fresh.map((w) => ({ id: randomUUID(), userId, scheduledFor: w.startedAt, completedAt: w.finishedAt, focus: w.title || null, notes: 'strong' }));
  const sets = fresh.flatMap((w, i) => {
    // Упражнение — блок по порядку появления, подходы в нём — по порядку строк.
    const blockOf = new Map<string, number>();
    const next = new Map<number, number>();
    return w.sets.map((set) => {
      if (!blockOf.has(set.exercise)) blockOf.set(set.exercise, blockOf.size);
      const block = blockOf.get(set.exercise)!;
      const index = next.get(block) ?? 0;
      next.set(block, index + 1);
      return { sessionId: sessions[i].id, ...set, block, index, done: true, doneAt: w.finishedAt };
    });
  });

  await prisma.$transaction([...chunks(sessions).map((data) => prisma.gymSession.createMany({ data })), ...chunks(sets).map((data) => prisma.gymSet.createMany({ data }))]);
  refresh();
  return { ok: true, count: fresh.length, sets: sets.length, skipped: workouts.length - fresh.length, unknown: unknown.length };
}

/**
 * Пометка записей из FatSecret в поле `food`: такой еды в справочнике нет, а
 * повторная выгрузка заменяет именно эти строки за свои дни. Записанное руками
 * импорт не трогает.
 */
const FATSECRET = 'fatsecret';
const within = (v: number | null, max: number) => (v !== null && v >= 0 && v <= max ? v : null);

export async function importFatsecret(formData: FormData): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'noFile' };
  if (file.size > MAX_EXPORT_BYTES) return { error: 'fileTooBig' };

  const { foods, format } = parseFatsecretCsv(await file.text());
  if (!format) return { error: 'foodFormat' };
  const today = dayKey(new Date());
  const perDay = new Map<string, number>();
  const rows = foods.filter((f) => {
    if (f.day > today || f.kcal < 0 || f.kcal > 20000) return false;
    const n = (perDay.get(f.day) ?? 0) + 1;
    perDay.set(f.day, n);
    return n <= MAX_FOOD_PER_DAY;
  });
  if (rows.length === 0) return { error: 'noFood' };
  const days = [...perDay.keys()];

  await prisma.$transaction([
    prisma.foodEntry.deleteMany({ where: { userId, food: FATSECRET, eatenOn: { in: days } } }),
    ...chunks(rows).map((list) =>
      prisma.foodEntry.createMany({
        data: list.map((f) => ({
          userId,
          eatenOn: f.day,
          meal: f.meal,
          food: FATSECRET,
          name: f.name,
          grams: within(f.grams, 5000),
          kcal: f.kcal,
          protein: within(f.protein, 2000) ?? 0,
          fat: within(f.fat, 2000) ?? 0,
          carbs: within(f.carbs, 2000) ?? 0,
          fiber: within(f.fiber, 200),
          sugar: within(f.sugar, 500),
          satFat: within(f.satFat, 300),
          sodium: within(f.sodium, 20000),
          cholesterol: within(f.cholesterol, 5000),
          potassium: within(f.potassium, 20000),
          junk: junkByName(f.name),
          estimated: false
        }))
      })
    )
  ]);
  refresh();
  return { ok: true, count: rows.length, days: days.length };
}
