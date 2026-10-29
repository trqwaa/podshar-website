import 'server-only';

import { prisma } from '@/lib/db';
import { authConfigured } from '@/lib/auth/config';
import { birthdayOf } from '@/lib/birthdays';
import { zurichMidnight } from '@/lib/calendar/events';
import { shiftDay } from '@/lib/calendar/scales';
import { kindOf, oneRepMax } from './exercises';
import {
  DEFAULTS,
  PARTS,
  ageFrom,
  isActivity,
  isGoal,
  isPart,
  isSex,
  targetsFor,
  type Activity,
  type Goal,
  type Part,
  type Sex,
  type Targets
} from './norms';

/**
 * Зал: что читают страницы.
 *
 * Дневник у каждого свой, а смотреть можно любой из трёх — `who` в адресе.
 * Писать — только в свой, и это решают действия по сессии (`actions.ts`), а не
 * то, чей дневник открыт: открытый чужой дневник просто не даёт полей ввода.
 *
 * Без базы всё отвечает пустотой, как доска задач: в гостевом режиме страница
 * рисуется, но дневника нет.
 */

export type GymMember = {
  id: string;
  handle: string;
  displayName: string;
  avatarPreset: string | null;
};

export async function gymMembers(): Promise<GymMember[]> {
  if (!authConfigured()) return [];
  return prisma.user.findMany({
    select: { id: true, handle: true, displayName: true, avatarPreset: true },
    orderBy: { createdAt: 'asc' }
  });
}

/**
 * Чей дневник открыт: по хендлу из адреса, иначе свой. Чужой хендл, которого
 * нет, — тоже свой: ссылка на уехавшего человека не должна ронять страницу.
 */
export function pickMember(members: GymMember[], who: string | undefined, selfId: string | null) {
  const asked = who ? members.find((m) => m.handle.toLowerCase() === who.toLowerCase()) : undefined;
  const self = members.find((m) => m.id === selfId) ?? null;
  const member = asked ?? self;
  return { member, mine: Boolean(member && selfId && member.id === selfId) };
}

// ─── Профиль и нормы ────────────────────────────────────────────────────────

export type GymProfileView = {
  goal: Goal;
  heightCm: number | null;
  sex: Sex;
  activity: Activity;
  bornYear: number | null;
  /** Возраст по дню рождения из профиля сайта или по году отсюда; null — не знаем. */
  age: number | null;
  /** Последний замер веса. */
  weightKg: number | null;
  targets: Targets;
};

export async function gymProfile(userId: string, today: string): Promise<GymProfileView> {
  const [row, weight, birthday] = authConfigured()
    ? await Promise.all([
        prisma.gymProfile.findUnique({ where: { userId } }),
        prisma.bodyMeasure.findFirst({
          where: { userId, part: 'weight' },
          orderBy: [{ takenOn: 'desc' }, { createdAt: 'desc' }],
          select: { value: true }
        }),
        birthdayOf(userId).catch(() => null)
      ])
    : [null, null, null];

  const goal = isGoal(row?.goal) ? row.goal : 'hypertrophy';
  const sex = isSex(row?.sex) ? row.sex : 'male';
  const activity = isActivity(row?.activity) ? row.activity : 'mid';
  const age = ageFrom(today, birthday?.born ?? null, row?.bornYear ?? null);
  const weightKg = weight?.value ?? null;

  return {
    goal,
    heightCm: row?.heightCm ?? null,
    sex,
    activity,
    bornYear: row?.bornYear ?? null,
    age,
    weightKg,
    targets: targetsFor({
      weightKg: weightKg ?? DEFAULTS.weightKg,
      heightCm: row?.heightCm ?? DEFAULTS.heightCm,
      age: age ?? DEFAULTS.age,
      sex,
      activity,
      goal
    })
  };
}

// ─── План на доске ──────────────────────────────────────────────────────────

export type PlanItemView = { id: string; exercise: string; sets: number; reps: number; weight: number | null; seconds: number | null };
export type PlanDayView = { id: string; weekday: number; title: string; items: PlanItemView[] };

export async function planOf(userId: string): Promise<PlanDayView[]> {
  if (!authConfigured()) return [];
  const days = await prisma.gymPlanDay.findMany({
    where: { userId },
    orderBy: { weekday: 'asc' },
    include: { items: { orderBy: { position: 'asc' } } }
  });
  return days.map((d) => ({
    id: d.id,
    weekday: d.weekday,
    title: d.title,
    items: d.items.map((i) => ({ id: i.id, exercise: i.exercise, sets: i.sets, reps: i.reps, weight: i.weight, seconds: i.seconds }))
  }));
}

/**
 * Кто когда в зале — по доскам всех троих: на какой день недели у кого есть
 * упражнения, и кто сегодня уже был или прямо сейчас качается. Чтобы глянуть
 * и не спрашивать в группе.
 *
 * «Сейчас» — тренировка начата не раньше шести часов назад и не закончена:
 * забытая вчерашняя не должна держать человека в зале сутками.
 */
export type GymWeek = { days: string[][]; now: string[]; done: string[] };

/** Буква человека на доске — первая в последнем слове имени: «тест · соня» — «с», а не «т» у всех троих. */
export function initialOf(displayName: string): string {
  const words = displayName.split(/[\s·]+/).filter(Boolean);
  return (words[words.length - 1]?.[0] ?? '?').toLowerCase();
}

export async function gymWeek(memberIds: string[], today: string): Promise<GymWeek> {
  const empty: GymWeek = { days: Array.from({ length: 7 }, () => []), now: [], done: [] };
  if (!authConfigured() || memberIds.length === 0) return empty;
  const since = zurichMidnight(today);
  const [plans, sessions] = await Promise.all([
    prisma.gymPlanDay.findMany({ where: { userId: { in: memberIds }, items: { some: {} } }, select: { userId: true, weekday: true } }),
    prisma.gymSession.findMany({
      where: {
        userId: { in: memberIds },
        OR: [{ completedAt: { gte: since } }, { completedAt: null, scheduledFor: { gte: new Date(Date.now() - 6 * 3600_000) } }]
      },
      select: { userId: true, completedAt: true }
    })
  ]);
  for (const p of plans) if (p.weekday >= 0 && p.weekday < 7) empty.days[p.weekday].push(p.userId);
  // Порядок — как у троих в списке, а не как вернула база.
  for (const day of empty.days) day.sort((a, b) => memberIds.indexOf(a) - memberIds.indexOf(b));
  const now = new Set(sessions.filter((s) => s.completedAt === null).map((s) => s.userId));
  const done = new Set(sessions.filter((s) => s.completedAt !== null && !now.has(s.userId)).map((s) => s.userId));
  return { days: empty.days, now: memberIds.filter((id) => now.has(id)), done: memberIds.filter((id) => done.has(id)) };
}

/** День недели по ключу дня: понедельник — 0, как на доске. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

// ─── Тренировки ─────────────────────────────────────────────────────────────

export type SetView = {
  id: string;
  exercise: string;
  block: number;
  index: number;
  weight: number | null;
  reps: number | null;
  /** Упражнения на время и кардио: секунды и километры. */
  seconds: number | null;
  distance: number | null;
  warmup: boolean;
  done: boolean;
};

export type WorkoutView = {
  id: string;
  title: string;
  startedAt: number;
  finishedAt: number | null;
  sets: SetView[];
};

const toWorkout = (row: {
  id: string;
  focus: string | null;
  scheduledFor: Date;
  completedAt: Date | null;
  sets: SetView[];
}): WorkoutView => ({
  id: row.id,
  title: row.focus ?? '',
  startedAt: row.scheduledFor.getTime(),
  finishedAt: row.completedAt?.getTime() ?? null,
  sets: row.sets
});

const SET_FIELDS = {
  id: true,
  exercise: true,
  block: true,
  index: true,
  weight: true,
  reps: true,
  seconds: true,
  distance: true,
  warmup: true,
  done: true
} as const;

/** Тренировка, которая идёт: начата и не закончена. Одна на человека. */
export async function activeWorkout(userId: string): Promise<WorkoutView | null> {
  if (!authConfigured()) return null;
  const row = await prisma.gymSession.findFirst({
    where: { userId, completedAt: null },
    orderBy: { scheduledFor: 'desc' },
    include: { sets: { orderBy: [{ block: 'asc' }, { index: 'asc' }], select: SET_FIELDS } }
  });
  return row ? toWorkout(row) : null;
}

export async function recentWorkouts(userId: string, limit = 12): Promise<WorkoutView[]> {
  if (!authConfigured()) return [];
  const rows = await prisma.gymSession.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: limit,
    include: { sets: { orderBy: [{ block: 'asc' }, { index: 'asc' }], select: SET_FIELDS } }
  });
  return rows.map(toWorkout);
}

/**
 * «Прошлый раз» для колонки как в Strong: подходы этого упражнения из
 * последней законченной тренировки, где оно было.
 */
export type PastSet = { weight: number | null; reps: number | null; seconds: number | null; distance: number | null };

export async function previousSets(userId: string, exercises: string[]): Promise<Record<string, PastSet[]>> {
  if (!authConfigured() || exercises.length === 0) return {};
  const rows = await prisma.gymSet.findMany({
    where: { exercise: { in: exercises }, done: true, session: { userId, completedAt: { not: null } } },
    orderBy: [{ session: { completedAt: 'desc' } }, { index: 'asc' }],
    select: { exercise: true, sessionId: true, weight: true, reps: true, seconds: true, distance: true, warmup: true },
    take: 400
  });
  const out: Record<string, PastSet[]> = {};
  const sessionOf: Record<string, string> = {};
  for (const row of rows) {
    if (row.warmup) continue;
    sessionOf[row.exercise] ??= row.sessionId;
    if (sessionOf[row.exercise] !== row.sessionId) continue;
    (out[row.exercise] ??= []).push({ weight: row.weight, reps: row.reps, seconds: row.seconds, distance: row.distance });
  }
  return out;
}

/** Лучший подход по оценке максимума и самый тяжёлый рабочий вес — это разные подходы. */
export type BestLift = { e1rm: number; weight: number; reps: number; at: number; top: number };

/** Лучший подход в каждом упражнении — по оценке максимума. Цели «жим 100» меряются этим. */
export async function bestLifts(userId: string): Promise<Record<string, BestLift>> {
  if (!authConfigured()) return {};
  const rows = await prisma.gymSet.findMany({
    where: { done: true, warmup: false, weight: { gt: 0 }, reps: { gt: 0 }, session: { userId } },
    select: { exercise: true, weight: true, reps: true, doneAt: true }
  });
  const out: Record<string, BestLift> = {};
  for (const row of rows) {
    // Вес в гравитроне — помощь, а не нагрузка: рекордом он не бывает.
    if (kindOf(row.exercise) !== 'weight' && kindOf(row.exercise) !== 'body') continue;
    const weight = row.weight ?? 0;
    const e1rm = oneRepMax(weight, row.reps ?? 0);
    const top = Math.max(out[row.exercise]?.top ?? 0, weight);
    if (!out[row.exercise] || out[row.exercise].e1rm < e1rm) {
      out[row.exercise] = { e1rm, weight, reps: row.reps ?? 0, at: row.doneAt?.getTime() ?? 0, top };
    } else {
      out[row.exercise].top = top;
    }
  }
  return out;
}

// ─── Замеры и цели ──────────────────────────────────────────────────────────

export type MeasureView = { id: string; value: number; takenOn: string };

export async function measuresOf(userId: string): Promise<Partial<Record<Part, MeasureView[]>>> {
  if (!authConfigured()) return {};
  const rows = await prisma.bodyMeasure.findMany({
    where: { userId },
    orderBy: [{ takenOn: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, part: true, value: true, takenOn: true }
  });
  const out: Partial<Record<Part, MeasureView[]>> = {};
  for (const row of rows) {
    if (!isPart(row.part)) continue;
    (out[row.part] ??= []).push({ id: row.id, value: row.value, takenOn: row.takenOn });
  }
  return out;
}

export const MEASURE_ORDER = PARTS;

export type GoalView = {
  id: string;
  kind: 'bodyweight' | 'lift' | 'measure';
  subject: string | null;
  target: number;
  deadline: string | null;
  achievedAt: number | null;
};

export async function goalsOf(userId: string): Promise<GoalView[]> {
  if (!authConfigured()) return [];
  const rows = await prisma.gymGoal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind === 'lift' || r.kind === 'measure' ? r.kind : 'bodyweight',
    subject: r.subject,
    target: r.target,
    deadline: r.deadline,
    achievedAt: r.achievedAt?.getTime() ?? null
  }));
}

// ─── Питание ────────────────────────────────────────────────────────────────

export type FoodView = {
  id: string;
  meal: string;
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

const FOOD_FIELDS = {
  id: true,
  meal: true,
  food: true,
  name: true,
  grams: true,
  kcal: true,
  protein: true,
  fat: true,
  carbs: true,
  fiber: true,
  sugar: true,
  satFat: true,
  sodium: true,
  cholesterol: true,
  potassium: true,
  junk: true,
  estimated: true
} as const;

export async function foodDay(userId: string, day: string): Promise<FoodView[]> {
  if (!authConfigured()) return [];
  return prisma.foodEntry.findMany({
    where: { userId, eatenOn: day },
    orderBy: { createdAt: 'asc' },
    select: FOOD_FIELDS
  });
}

export type FoodDayTotal = { day: string; kcal: number; protein: number; fat: number; carbs: number; junk: number; entries: number };

/** Итоги по дням за отрезок — для графика недели и для критика. */
export async function foodTotals(userId: string, from: string, to: string): Promise<FoodDayTotal[]> {
  if (!authConfigured()) return [];
  const rows = await prisma.foodEntry.findMany({
    where: { userId, eatenOn: { gte: from, lte: to } },
    select: { eatenOn: true, kcal: true, protein: true, fat: true, carbs: true, junk: true }
  });
  const byDay = new Map<string, FoodDayTotal>();
  for (const row of rows) {
    const t = byDay.get(row.eatenOn) ?? { day: row.eatenOn, kcal: 0, protein: 0, fat: 0, carbs: 0, junk: 0, entries: 0 };
    t.kcal += row.kcal;
    t.protein += row.protein;
    t.fat += row.fat;
    t.carbs += row.carbs;
    t.junk += row.junk ? 1 : 0;
    t.entries += 1;
    byDay.set(row.eatenOn, t);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Фастфуд за отрезок, названиями из дневника: критику нужно, чем именно ты провинился. */
export async function junkNames(userId: string, from: string, to: string): Promise<string[]> {
  if (!authConfigured()) return [];
  const rows = await prisma.foodEntry.findMany({
    where: { userId, junk: true, eatenOn: { gte: from, lte: to } },
    select: { name: true },
    orderBy: { createdAt: 'desc' },
    take: 40
  });
  return rows.map((r) => r.name);
}

/** Что человек ест чаще всего — для быстрой записи в один тап. */
export async function recentFoods(userId: string, limit = 8): Promise<FoodView[]> {
  if (!authConfigured()) return [];
  const rows = await prisma.foodEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 120,
    select: FOOD_FIELDS
  });
  const seen = new Set<string>();
  const out: FoodView[] = [];
  for (const row of rows) {
    const key = `${row.food ?? row.name.toLowerCase()}|${row.grams ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

// ─── Сон ────────────────────────────────────────────────────────────────────

export type SleepView = {
  id: string;
  night: string;
  bedAt: number;
  wakeAt: number;
  minutes: number;
  deep: number | null;
  rem: number | null;
  source: string;
};

export async function sleepRange(userId: string, from: string, to: string): Promise<SleepView[]> {
  if (!authConfigured()) return [];
  const rows = await prisma.sleepEntry.findMany({
    where: { userId, night: { gte: from, lte: to } },
    orderBy: { night: 'desc' }
  });
  return rows.map((r) => ({
    id: r.id,
    night: r.night,
    bedAt: r.bedAt.getTime(),
    wakeAt: r.wakeAt.getTime(),
    minutes: r.minutes,
    deep: r.deep,
    rem: r.rem,
    source: r.source
  }));
}

// ─── Неделя одним взглядом — для подвала, пульта и критика ──────────────────

export type WeekDigest = {
  today: string;
  plan: PlanDayView[];
  todayPlan: PlanDayView | null;
  active: WorkoutView | null;
  workouts: WorkoutView[];
  food: FoodDayTotal[];
  sleep: SleepView[];
  weights: MeasureView[];
};

/** Две недели, а не одна: критику нужна и эта неделя, и с чем её сравнить. */
export async function weekDigest(userId: string, today: string): Promise<WeekDigest> {
  const from = shiftDay(today, -13);
  const [plan, active, workouts, food, sleep, measures] = await Promise.all([
    planOf(userId),
    activeWorkout(userId),
    recentWorkouts(userId, 30),
    foodTotals(userId, from, today),
    sleepRange(userId, from, today),
    measuresOf(userId)
  ]);
  const weekday = weekdayOf(today);
  // Граница по UTC-полуночи с запасом в сутки: тренировка в 00:30 по Цюриху не
  // должна выпасть из окна из-за пояса.
  const since = Date.parse(`${from}T00:00:00Z`) - 86_400_000;
  return {
    today,
    plan,
    todayPlan: plan.find((d) => d.weekday === weekday && d.items.length > 0) ?? null,
    active,
    workouts: workouts.filter((w) => (w.finishedAt ?? 0) >= since),
    food,
    sleep,
    weights: measures.weight ?? []
  };
}

/**
 * Последний разнос модели — на языке страницы. Разнос пишется словами, его не
 * перевести: на другом языке сайта показывается последний, написанный на нём,
 * а если такого нет — разносы по правилам, которые переводятся сами.
 */
export async function latestVerdict(userId: string, locale: string): Promise<{ text: string; at: number; locale: string } | null> {
  if (!authConfigured()) return null;
  const row = await prisma.gymVerdict.findFirst({ where: { userId, locale }, orderBy: { createdAt: 'desc' } });
  return row ? { text: row.text, at: row.createdAt.getTime(), locale: row.locale } : null;
}
