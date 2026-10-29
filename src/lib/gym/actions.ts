'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth/session';
import { zurichAt } from '@/lib/calendar/events';
import { dayKey, shiftDay } from '@/lib/calendar/scales';
import { routing } from '@/i18n/routing';
import { isExercise } from './exercises';
import { foodOf, junkByName, macrosFor } from './foods';
import { ACTIVITIES, GOALS, GOAL_KINDS, PARTS, SEXES, isPart } from './norms';
import { programOf } from './programs';
import { parseSleepCsv } from './sleep-import';
import { previousSets, weekdayOf } from './data';

/**
 * Всё, что зал может менять.
 *
 * Договор тот же, что у доски и календаря: наружу `{ error: <ключ> }` или
 * `{ ok: true }`, фразы лежат в каталогах на странице.
 *
 * **Писать можно только в свой дневник.** Каждое действие берёт человека из
 * сессии и проверяет, что строка его, — браузер может прислать любой id, а
 * действие — это открытый POST. Чужой дневник открывается на чтение, и только.
 */

export type GymResult = { ok?: boolean; error?: string; id?: string; count?: number; skipped?: number; empty?: boolean };

const Id = z.string().trim().min(1).max(40);
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Все страницы зала на всех языках: дневник меняется — меняется и подвал, и критик. */
const refresh = () => revalidatePath('/[locale]/(app)/gym', 'layout');

async function me(): Promise<string | null> {
  const session = await readSession();
  return session?.userId ?? null;
}

/** Не дальше завтрашнего дня по Цюриху: записать обед в будущее — это опечатка, а не план. */
const notFuture = (day: string) => day <= shiftDay(dayKey(new Date()), 1);

// ─── Цель и профиль ─────────────────────────────────────────────────────────

export async function saveProfile(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z
    .object({
      goal: z.enum(GOALS).optional(),
      heightCm: z.coerce.number().min(120).max(230).nullable().optional(),
      sex: z.enum(SEXES).optional(),
      activity: z.enum(ACTIVITIES).optional(),
      bornYear: z.coerce.number().int().min(1950).max(2020).nullable().optional()
    })
    .safeParse(input);
  if (!parsed.success) return { error: 'invalid' };

  await prisma.gymProfile.upsert({
    where: { userId },
    update: parsed.data,
    create: { userId, ...parsed.data }
  });
  refresh();
  return { ok: true };
}

const MAX_GOALS = 12;

export async function addGoal(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z
    .object({
      kind: z.enum(GOAL_KINDS),
      subject: z.string().trim().max(40).nullable().optional(),
      target: z.coerce.number().positive().max(1000),
      deadline: Day.nullable().optional()
    })
    .safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { kind, target, deadline } = parsed.data;
  const subject = kind === 'bodyweight' ? null : (parsed.data.subject ?? null);
  if (kind === 'lift' && !(subject && isExercise(subject))) return { error: 'invalid' };
  if (kind === 'measure' && !(subject && isPart(subject))) return { error: 'invalid' };

  if ((await prisma.gymGoal.count({ where: { userId } })) >= MAX_GOALS) return { error: 'tooMany' };
  const created = await prisma.gymGoal.create({
    data: { userId, kind, subject, target, deadline: deadline ?? null },
    select: { id: true }
  });
  refresh();
  return { ok: true, id: created.id };
}

export async function removeGoal(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const id = Id.safeParse((input as { id?: unknown })?.id);
  if (!id.success) return { error: 'invalid' };
  await prisma.gymGoal.deleteMany({ where: { id: id.data, userId } });
  refresh();
  return { ok: true };
}

// ─── План на доске ──────────────────────────────────────────────────────────

const Weekday = z.coerce.number().int().min(0).max(6);
const MAX_PLAN_ITEMS = 15;

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

const Sets = z.coerce.number().int().min(1).max(12);
const Reps = z.coerce.number().int().min(1).max(100);
const Weight = z.coerce.number().min(0).max(600);
/** Подход на время — до суток, кардио — до тысячи километров: больше — опечатка. */
const Seconds = z.coerce.number().int().min(0).max(86_400);
const Distance = z.coerce.number().min(0).max(1000);

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
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const id = Id.safeParse((input as { id?: unknown })?.id);
  if (!id.success) return { error: 'invalid' };
  await prisma.gymSession.deleteMany({ where: { id: id.data, userId } });
  refresh();
  return { ok: true };
}

// ─── Замеры ─────────────────────────────────────────────────────────────────

/** Где кончается правдоподобное: бицепс 400 см — это опечатка, а не прогресс. */
const RANGE: Record<(typeof PARTS)[number], [number, number]> = {
  weight: [30, 250],
  bodyfat: [2, 60],
  neck: [20, 70],
  shoulders: [70, 180],
  chest: [60, 170],
  biceps: [15, 70],
  forearm: [15, 55],
  waist: [45, 160],
  hips: [60, 170],
  thigh: [30, 100],
  calf: [20, 65]
};

export async function addMeasure(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z.object({ part: z.enum(PARTS), value: z.coerce.number(), takenOn: Day }).safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { part, value, takenOn } = parsed.data;
  const [lo, hi] = RANGE[part];
  if (value < lo || value > hi) return { error: 'range' };
  if (!notFuture(takenOn)) return { error: 'future' };
  const created = await prisma.bodyMeasure.create({
    data: { userId, part, value: Math.round(value * 10) / 10, takenOn },
    select: { id: true }
  });
  refresh();
  return { ok: true, id: created.id };
}

export async function removeMeasure(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const id = Id.safeParse((input as { id?: unknown })?.id);
  if (!id.success) return { error: 'invalid' };
  await prisma.bodyMeasure.deleteMany({ where: { id: id.data, userId } });
  refresh();
  return { ok: true };
}

// ─── Питание ────────────────────────────────────────────────────────────────

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MAX_FOOD_PER_DAY = 60;

const Nutrient = (max: number) => z.coerce.number().min(0).max(max).nullable().optional();

/** Своя еда и еда с фото: цифры приходят готовыми, справочник их не знает. */
const Custom = z.object({
  name: z.string().trim().max(80).nullable().optional(),
  grams: z.coerce.number().positive().max(3000).nullable().optional(),
  kcal: Nutrient(5000),
  protein: Nutrient(500),
  fat: Nutrient(500),
  carbs: Nutrient(800),
  fiber: Nutrient(200),
  sugar: Nutrient(500),
  satFat: Nutrient(300),
  sodium: Nutrient(20000),
  cholesterol: Nutrient(5000),
  potassium: Nutrient(20000),
  /** С фото: модель решила, что это фастфуд. Название проверяется ещё и словарём. */
  junk: z.boolean().optional(),
  estimated: z.boolean().optional()
});

type FoodRow = {
  food: string | null;
  name: string;
  grams: number | null;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
  sugar: number | null;
  satFat: number | null;
  sodium: number | null;
  cholesterol: number | null;
  potassium: number | null;
  junk: boolean;
  estimated: boolean;
};

function customRow(data: z.infer<typeof Custom>): FoodRow | { error: string } {
  const name = data.name?.trim();
  if (!name) return { error: 'empty' };
  if (data.kcal == null) return { error: 'noKcal' };
  return {
    food: null,
    name,
    grams: data.grams ?? null,
    kcal: Math.round(data.kcal),
    protein: data.protein ?? 0,
    fat: data.fat ?? 0,
    carbs: data.carbs ?? 0,
    fiber: data.fiber ?? null,
    sugar: data.sugar ?? null,
    satFat: data.satFat ?? null,
    sodium: data.sodium ?? null,
    cholesterol: data.cholesterol ?? null,
    potassium: data.potassium ?? null,
    junk: Boolean(data.junk) || junkByName(name),
    estimated: Boolean(data.estimated)
  };
}

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
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z
    .object({ day: Day, meal: z.enum(MEALS), items: z.array(Custom).min(1).max(12) })
    .safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { day, meal, items } = parsed.data;
  if (!notFuture(day)) return { error: 'future' };
  const already = await prisma.foodEntry.count({ where: { userId, eatenOn: day } });
  if (already + items.length > MAX_FOOD_PER_DAY) return { error: 'tooMany' };

  const rows: FoodRow[] = [];
  for (const item of items) {
    const made = customRow({ ...item, estimated: true });
    if ('error' in made) return made;
    rows.push(made);
  }
  await prisma.foodEntry.createMany({ data: rows.map((row) => ({ userId, eatenOn: day, meal, ...row })) });
  refresh();
  return { ok: true, count: rows.length };
}

export async function removeFood(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const id = Id.safeParse((input as { id?: unknown })?.id);
  if (!id.success) return { error: 'invalid' };
  await prisma.foodEntry.deleteMany({ where: { id: id.data, userId } });
  refresh();
  return { ok: true };
}

// ─── Сон ────────────────────────────────────────────────────────────────────

/**
 * Ночь руками: утро, когда проснулся, и два времени. Лёг «в 23:40» — значит
 * накануне; лёг «в 01:10» — в ту же дату, что и встал. Решает сравнение, а не
 * отдельная галочка: позже подъёма лечь в тот же день нельзя.
 */
export async function addSleep(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const parsed = z.object({ night: Day, bed: Clock, wake: Clock }).safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { night, bed, wake } = parsed.data;
  if (!notFuture(night)) return { error: 'future' };

  const wakeAt = zurichAt(night, wake);
  let bedAt = zurichAt(night, bed);
  if (bedAt >= wakeAt) bedAt = zurichAt(shiftDay(night, -1), bed);
  const minutes = Math.round((wakeAt.getTime() - bedAt.getTime()) / 60_000);
  if (minutes < 30 || minutes > 20 * 60) return { error: 'range' };

  await prisma.sleepEntry.upsert({
    where: { userId_night: { userId, night } },
    update: { bedAt, wakeAt, minutes, deep: null, rem: null, source: 'manual' },
    create: { userId, night, bedAt, wakeAt, minutes, source: 'manual' }
  });
  refresh();
  return { ok: true };
}

export async function removeSleep(input: unknown): Promise<GymResult> {
  const userId = await me();
  if (!userId) return { error: 'signedOut' };
  const id = Id.safeParse((input as { id?: unknown })?.id);
  if (!id.success) return { error: 'invalid' };
  await prisma.sleepEntry.deleteMany({ where: { id: id.data, userId } });
  refresh();
  return { ok: true };
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
