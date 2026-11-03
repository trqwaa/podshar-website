import 'server-only';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { zurichAt } from '@/lib/calendar/events';
import { dayKey, shiftDay } from '@/lib/calendar/scales';
import type { GymResult } from './actions';
import { isExercise } from './exercises';
import { junkByName } from './foods';
import { ACTIVITIES, GOALS, GOAL_KINDS, PARTS, SEXES, isPart } from './norms';

/**
 * Запись в дневник зала — с человеком, названным явно.
 *
 * Пишут сюда двое: кнопки на страницах (`actions.ts` берёт человека из сессии
 * и зовёт эти же функции) и мопс в чате (`assistant/gym.ts`, человек — из
 * сессии запроса к мопсу). Правила одни: что кнопка не может записать, того не
 * запишет и мопс.
 *
 * **Не `'use server'`.** Каждая экспортированная функция такого файла — открытый
 * POST, и функция с `userId` в аргументах дала бы любому браузеру писать в
 * чужой дневник. Здесь человек приходит только с сервера.
 */

export const Id = z.string().trim().min(1).max(40);
export const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const Clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const Weekday = z.coerce.number().int().min(0).max(6);
export const Sets = z.coerce.number().int().min(1).max(12);
export const Reps = z.coerce.number().int().min(1).max(100);
export const Weight = z.coerce.number().min(0).max(600);
/** Подход на время — до суток, кардио — до тысячи километров: больше — опечатка. */
export const Seconds = z.coerce.number().int().min(0).max(86_400);
export const Distance = z.coerce.number().min(0).max(1000);

/** Все страницы зала на всех языках: дневник меняется — меняется и подвал, и критик. */
export const refresh = () => revalidatePath('/[locale]/(app)/gym', 'layout');

/** Не дальше завтрашнего дня по Цюриху: записать обед в будущее — это опечатка, а не план. */
export const notFuture = (day: string) => day <= shiftDay(dayKey(new Date()), 1);

// ─── Цель и профиль ─────────────────────────────────────────────────────────

export async function saveProfileFor(userId: string, input: unknown): Promise<GymResult> {
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

export async function addGoalFor(userId: string, input: unknown): Promise<GymResult> {
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

export async function removeGoalFor(userId: string, id: unknown): Promise<GymResult> {
  const parsed = Id.safeParse(id);
  if (!parsed.success) return { error: 'invalid' };
  const { count } = await prisma.gymGoal.deleteMany({ where: { id: parsed.data, userId } });
  refresh();
  return { ok: true, count };
}

// ─── План на доске ──────────────────────────────────────────────────────────

export const MAX_PLAN_ITEMS = 15;

export type PlanDayInput = {
  weekday: number;
  title: string;
  items: { exercise: string; sets: number; reps: number; weight: number | null; seconds: number | null }[];
};

const PlanDays = z
  .array(
    z.object({
      weekday: Weekday,
      title: z.string().trim().max(40),
      items: z
        .array(
          z.object({
            exercise: z.string().refine(isExercise),
            sets: Sets,
            reps: Reps,
            weight: Weight.nullable(),
            seconds: Seconds.nullable()
          })
        )
        .max(MAX_PLAN_ITEMS)
    })
  )
  .min(1)
  .max(7);

/**
 * Переписать дни доски целиком: название и упражнения. День без названия и без
 * упражнений стирается — это и есть день отдыха. `clearOthers` — неделя заново:
 * дни, которых нет в списке, тоже стираются.
 *
 * Одна транзакция, как у готовых программ: доска не остаётся наполовину
 * переписанной, если что-то упало посередине.
 */
export async function setPlanDaysFor(userId: string, days: PlanDayInput[], clearOthers: boolean): Promise<GymResult> {
  const parsed = PlanDays.safeParse(days);
  if (!parsed.success) return { error: 'invalid' };
  const listed = parsed.data.map((d) => d.weekday);

  await prisma.$transaction([
    prisma.gymPlanDay.deleteMany({ where: clearOthers ? { userId } : { userId, weekday: { in: listed } } }),
    ...parsed.data
      .filter((day) => day.title || day.items.length)
      .map((day) =>
        prisma.gymPlanDay.create({
          data: {
            userId,
            weekday: day.weekday,
            title: day.title,
            items: { create: day.items.map((item, i) => ({ ...item, position: i + 1 })) }
          }
        })
      )
  ]);
  refresh();
  return { ok: true, count: parsed.data.length };
}

// ─── Тренировка ─────────────────────────────────────────────────────────────

export type LoggedBlock = {
  exercise: string;
  sets: { weight: number | null; reps: number | null; seconds: number | null; distance: number | null }[];
};

const MAX_BLOCKS = 20;
const MAX_SETS_PER_BLOCK = 15;

const Blocks = z
  .array(
    z.object({
      exercise: z.string().refine(isExercise),
      sets: z
        .array(
          z.object({
            weight: Weight.nullable(),
            reps: z.coerce.number().int().min(0).max(1000).nullable(),
            seconds: Seconds.nullable(),
            distance: Distance.nullable()
          })
        )
        .min(1)
        .max(MAX_SETS_PER_BLOCK)
    })
  )
  .min(1)
  .max(MAX_BLOCKS);

/**
 * Записать сделанное: подходы ложатся отмеченными.
 *
 * Идёт тренировка — упражнения дописываются в неё, следующими блоками: человек
 * в зале с открытой тренировкой, и вторая рядом с ней была бы путаницей. Нет —
 * заводится законченная тренировка за этот день, в полдень по Цюриху, а
 * сегодняшняя — на текущий момент.
 */
export async function logWorkoutFor(userId: string, day: string, title: string, blocks: LoggedBlock[]): Promise<GymResult & { appended?: boolean }> {
  const parsedDay = Day.safeParse(day);
  const parsed = Blocks.safeParse(blocks);
  if (!parsedDay.success || !parsed.success) return { error: 'invalid' };
  const today = dayKey(new Date());
  if (parsedDay.data > today) return { error: 'future' };

  const rows = (sessionId: string, from: number, at: Date) =>
    parsed.data.flatMap((block, b) =>
      block.sets.map((set, index) => ({ sessionId, exercise: block.exercise, block: from + b, index, ...set, done: true, doneAt: at }))
    );

  const now = new Date();
  const open = parsedDay.data === today ? await prisma.gymSession.findFirst({ where: { userId, completedAt: null }, select: { id: true } }) : null;
  if (open) {
    const last = await prisma.gymSet.findFirst({ where: { sessionId: open.id }, orderBy: { block: 'desc' }, select: { block: true } });
    const from = (last?.block ?? -1) + 1;
    if (from + parsed.data.length > MAX_BLOCKS) return { error: 'tooMany' };
    await prisma.gymSet.createMany({ data: rows(open.id, from, now) });
    refresh();
    return { ok: true, id: open.id, appended: true };
  }

  const at = parsedDay.data === today ? now : zurichAt(parsedDay.data, '12:00');
  const created = await prisma.gymSession.create({
    data: { userId, scheduledFor: at, completedAt: at, focus: title.trim().slice(0, 60) || null },
    select: { id: true }
  });
  await prisma.gymSet.createMany({ data: rows(created.id, 0, at) });
  refresh();
  return { ok: true, id: created.id };
}

/** Бросить идущую тренировку или стереть из истории законченную. */
export async function removeWorkoutFor(userId: string, id: unknown): Promise<GymResult> {
  const parsed = Id.safeParse(id);
  if (!parsed.success) return { error: 'invalid' };
  const { count } = await prisma.gymSession.deleteMany({ where: { id: parsed.data, userId } });
  refresh();
  return { ok: true, count };
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

export async function addMeasureFor(userId: string, input: unknown): Promise<GymResult> {
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

export async function removeMeasureFor(userId: string, id: unknown): Promise<GymResult> {
  const parsed = Id.safeParse(id);
  if (!parsed.success) return { error: 'invalid' };
  const { count } = await prisma.bodyMeasure.deleteMany({ where: { id: parsed.data, userId } });
  refresh();
  return { ok: true, count };
}

// ─── Питание ────────────────────────────────────────────────────────────────

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const MAX_FOOD_PER_DAY = 60;

const Nutrient = (max: number) => z.coerce.number().min(0).max(max).nullable().optional();

/** Своя еда, еда с фото и от мопса: цифры приходят готовыми. */
export const Custom = z.object({
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
  /** Модель решила, что это фастфуд. Название проверяется ещё и словарём. */
  junk: z.boolean().optional(),
  estimated: z.boolean().optional()
});

export type FoodRow = {
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

export function customRow(data: z.infer<typeof Custom>): FoodRow | { error: string } {
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

/**
 * Несколько продуктов разом: тарелка с фото, строка «два яйца и тост», приём
 * пищи от мопса. Одно нажатие — одна запись в базу. Отдаёт номера записей,
 * чтобы их можно было отменить.
 */
export async function addFoodsFor(userId: string, input: unknown): Promise<GymResult & { ids?: string[] }> {
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
    const made = customRow({ estimated: true, ...item });
    if ('error' in made) return made;
    rows.push(made);
  }
  const created = await prisma.$transaction(
    rows.map((row) => prisma.foodEntry.create({ data: { userId, eatenOn: day, meal, ...row }, select: { id: true } }))
  );
  refresh();
  return { ok: true, count: rows.length, ids: created.map((c) => c.id) };
}

/** Убрать записи еды — одну крестиком или все, что легли одним нажатием («отменить»). */
export async function removeFoodsFor(userId: string, ids: unknown): Promise<GymResult> {
  const parsed = z.array(Id).min(1).max(12).safeParse(ids);
  if (!parsed.success) return { error: 'invalid' };
  const { count } = await prisma.foodEntry.deleteMany({ where: { id: { in: parsed.data }, userId } });
  refresh();
  return { ok: true, count };
}

/**
 * Убрать продукт из недавнего под «что съел?» (1.54) — записи дневника не
 * трогаются: недавнее из них только собирается. Без миграции, в `countdowns`:
 * `food-recent-hidden:<id>`, в `label` — что и когда убрано. Прячется то, что
 * записано до нажатия: съел снова — продукт вернулся сам. `*` — «убрать все».
 * Удаляя человека, убери и эту строку.
 */
export const recentHiddenKey = (userId: string) => `food-recent-hidden:${userId}`;

export async function hideRecentFor(userId: string, input: unknown): Promise<GymResult> {
  const parsed = z.object({ keys: z.array(z.string().trim().min(1).max(120)).min(1).max(20) }).safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const key = recentHiddenKey(userId);
  const row = await prisma.countdown.findUnique({ where: { key }, select: { label: true } });
  let hidden: Record<string, string> = {};
  try {
    hidden = row ? (JSON.parse(row.label) as Record<string, string>) : {};
  } catch {
    hidden = {};
  }
  const now = new Date().toISOString();
  for (const what of parsed.data.keys) hidden[what] = now;
  // Сотни убранного хватит: дальше старое забывается, а недавнее и так берёт 120 последних записей.
  const label = JSON.stringify(Object.fromEntries(Object.entries(hidden).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 100)));
  await prisma.countdown.upsert({ where: { key }, update: { label, targetAt: new Date() }, create: { key, label, targetAt: new Date() } });
  refresh();
  return { ok: true };
}

// ─── Сон ────────────────────────────────────────────────────────────────────

/**
 * Ночь руками: утро, когда проснулся, и два времени. Лёг «в 23:40» — значит
 * накануне; лёг «в 01:10» — в ту же дату, что и встал. Решает сравнение, а не
 * отдельная галочка: позже подъёма лечь в тот же день нельзя.
 */
export async function addSleepFor(userId: string, input: unknown): Promise<GymResult & { minutes?: number }> {
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
  return { ok: true, minutes };
}

export async function removeSleepFor(userId: string, id: unknown): Promise<GymResult> {
  const parsed = Id.safeParse(id);
  if (!parsed.success) return { error: 'invalid' };
  const { count } = await prisma.sleepEntry.deleteMany({ where: { id: parsed.data, userId } });
  refresh();
  return { ok: true, count };
}
