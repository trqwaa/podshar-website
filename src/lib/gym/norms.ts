/**
 * Нормы зала: цели, нормы питания, нормы сна и части тела для замеров.
 *
 * Без базы и без `server-only`: этим пользуются и страницы, и формы в браузере,
 * и мопс-критик. Формулы общепринятые и записаны рядом с источником; это
 * ориентиры для троих подростков, а не назначение врача, и критик так и говорит.
 */

export const GOALS = ['hypertrophy', 'strength', 'cut'] as const;
export type Goal = (typeof GOALS)[number];
export const isGoal = (v: unknown): v is Goal => typeof v === 'string' && (GOALS as readonly string[]).includes(v);

export const ACTIVITIES = ['low', 'mid', 'high'] as const;
export type Activity = (typeof ACTIVITIES)[number];
export const isActivity = (v: unknown): v is Activity =>
  typeof v === 'string' && (ACTIVITIES as readonly string[]).includes(v);

export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];
export const isSex = (v: unknown): v is Sex => typeof v === 'string' && (SEXES as readonly string[]).includes(v);

/** Что можно замерить. Вес — в килограммах, жир — в процентах, остальное — обхват в сантиметрах. */
export const PARTS = [
  'weight',
  'bodyfat',
  'neck',
  'shoulders',
  'chest',
  'biceps',
  'forearm',
  'waist',
  'hips',
  'thigh',
  'calf'
] as const;
export type Part = (typeof PARTS)[number];
export const isPart = (v: unknown): v is Part => typeof v === 'string' && (PARTS as readonly string[]).includes(v);
export const unitOf = (part: Part) => (part === 'weight' ? 'kg' : part === 'bodyfat' ? '%' : 'cm');

/**
 * Где на замерах «лучше» — больше или меньше. Талия у сушки должна уходить,
 * бицепс у массы — расти. Вес зависит от цели, поэтому здесь его нет.
 */
export const BIGGER_IS_BETTER: Partial<Record<Part, boolean>> = {
  bodyfat: false,
  waist: false,
  neck: true,
  shoulders: true,
  chest: true,
  biceps: true,
  forearm: true,
  hips: true,
  thigh: true,
  calf: true
};

export const GOAL_KINDS = ['bodyweight', 'lift', 'measure'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];
export const isGoalKind = (v: unknown): v is GoalKind =>
  typeof v === 'string' && (GOAL_KINDS as readonly string[]).includes(v);

/** Пока ничего не замерено, считаем на усреднённого семнадцатилетнего. И говорим об этом. */
export const DEFAULTS = { weightKg: 70, heightCm: 178, age: 17 };

const ACTIVITY_FACTOR: Record<Activity, number> = { low: 1.4, mid: 1.55, high: 1.75 };

/**
 * Поправка к расходу по цели. Масса — небольшой профицит (+10%: «чистый»
 * набор, а не «ешь всё»), сила — почти поддержка, сушка — дефицит 20%, при
 * котором ещё можно тренироваться тяжело.
 */
const GOAL_FACTOR: Record<Goal, number> = { hypertrophy: 1.1, strength: 1.05, cut: 0.8 };

/** Белок, г на кг веса: на сушке выше — он держит мышцы при дефиците. */
const PROTEIN_PER_KG: Record<Goal, number> = { hypertrophy: 1.8, strength: 1.8, cut: 2.2 };
const FAT_PER_KG: Record<Goal, number> = { hypertrophy: 0.9, strength: 0.9, cut: 0.8 };

export type Targets = { kcal: number; protein: number; fat: number; carbs: number };

/**
 * Дневная норма КБЖУ.
 *
 * Обмен — по Миффлину — Сан-Жеору, самой точной из простых формул для
 * здоровых людей; умножается на активность и на цель. Белок и жир — от веса,
 * углеводы — всё, что осталось от калорий.
 */
export function targetsFor({
  weightKg,
  heightCm,
  age,
  sex,
  activity,
  goal
}: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activity: Activity;
  goal: Goal;
}): Targets {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
  const kcal = Math.round((bmr * ACTIVITY_FACTOR[activity] * GOAL_FACTOR[goal]) / 10) * 10;
  const protein = Math.round(weightKg * PROTEIN_PER_KG[goal]);
  const fat = Math.round(weightKg * FAT_PER_KG[goal]);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs };
}

/** Сколько отдыхать между подходами — по цели. Таймер в тренировке стартует с этого. */
export const REST_SECONDS: Record<Goal, number> = { hypertrophy: 90, strength: 180, cut: 60 };

/**
 * Норма сна по возрасту — рекомендации American Academy of Sleep Medicine и
 * National Sleep Foundation: 13–17 лет — 8–10 часов, 18–25 — 7–9.
 *
 * Нижняя граница «невыспался» — 7 часов при любом возрасте: так попросил
 * владелец, и для подростка это и так уже недосып. Верхняя «переспал» —
 * сверх нормы с запасом: 10,5 часа до восемнадцати, 10 после.
 */
export type SleepNorm = { low: number; high: number; short: number; long: number };

export function sleepNormFor(age: number): SleepNorm {
  return age <= 17 ? { low: 8, high: 10, short: 7, long: 10.5 } : { low: 7, high: 9, short: 7, long: 10 };
}

export type SleepMood = 'wrecked' | 'sleepy' | 'okay' | 'fresh' | 'overslept';

/** Как выглядит мопс после ночи такой длины. */
export function sleepMoodOf(hours: number, norm: SleepNorm): SleepMood {
  if (hours < norm.short - 1) return 'wrecked';
  if (hours < norm.short) return 'sleepy';
  if (hours > norm.long) return 'overslept';
  if (hours < norm.low) return 'okay';
  return 'fresh';
}

/** Возраст в годах на сегодня, по дню рождения или хотя бы по году. */
export function ageFrom(today: string, born: { year: number; month: number; day: number } | null, bornYear: number | null) {
  const [y, m, d] = today.split('-').map(Number);
  if (born) return y - born.year - (m < born.month || (m === born.month && d < born.day) ? 1 : 0);
  if (bornYear) return y - bornYear;
  return null;
}
