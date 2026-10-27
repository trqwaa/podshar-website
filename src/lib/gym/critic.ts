import type { Locale } from '@/i18n/routing';
import { shiftDay } from '@/lib/calendar/scales';

import { exerciseOf } from './exercises';
import { ADVICE, LINES, SUPPLEMENTS, type AdviceKey, type LineKey, type SupplementKey } from './critic-lines';
import { DEFAULTS, sleepMoodOf, sleepNormFor, type Goal, type SleepMood, type Targets } from './norms';
import type { FoodDayTotal, PlanDayView, SleepView, WorkoutView, MeasureView } from './data';

/**
 * Мопс-критик на правилах: смотрит на неделю и выносит приговор.
 *
 * Работает всегда, ключ модели ему не нужен. Модель (`critic-model.ts`) — это
 * «разнести по-взрослому» поверх, и ей уходит то же самое досье, что считается
 * здесь, — поэтому разнос модели и разнос правил спорить о фактах не могут.
 *
 * Оценки — от 0 до 10 по трём областям. Нет данных — оценки нет, а в итог
 * такая область идёт двойкой: пустой дневник — тоже ответ, и не лучший.
 *
 * Реплика выбирается по номеру дня (`seed`), как приветствие на главной: у
 * троих в один день одна и та же, и F5 её не перебрасывает.
 */

export type Face = 'happy' | 'proud' | 'meh' | 'sad' | 'angry' | 'sick' | 'sleepy' | 'overslept' | 'shocked';

export type Dossier = {
  today: string;
  goal: Goal;
  age: number | null;
  weightKg: number | null;
  targets: Targets;
  plan: PlanDayView[];
  workouts: WorkoutView[];
  food: FoodDayTotal[];
  junkNames: string[];
  sleep: SleepView[];
  weights: MeasureView[];
};

export type Area = { score: number | null; face: Face; line: string };

export type Verdict = {
  food: Area;
  train: Area;
  sleep: Area;
  total: Area;
  advice: string[];
  supplements: { take: string[]; skip: string[] };
  /** Голые числа, на которых всё это стоит, — их же видит модель. */
  facts: Facts;
};

export type Facts = {
  goal: Goal;
  age: number;
  ageKnown: boolean;
  weightKg: number | null;
  targets: Targets;
  food: { days: number; avgKcal: number; avgProtein: number; junk: number; junkShare: number; junkNames: string[] };
  train: { hasPlan: boolean; planned: number; done: number; noLegs: boolean; avgReps: number | null; sets: number };
  sleep: { nights: number; avgHours: number | null; shortNights: number; longNights: number; spreadMin: number | null; avgBed: string | null };
  weightTrendPerWeek: number | null;
};

const clamp = (v: number, lo = 0, hi = 10) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export function pickLine(key: LineKey, locale: Locale, seed: number, values: Record<string, string | number> = {}) {
  const pool = LINES[key][locale];
  return fill(pool[((seed % pool.length) + pool.length) % pool.length], values);
}

const advice = (key: AdviceKey, locale: Locale, values: Record<string, string | number> = {}) => fill(ADVICE[key][locale], values);
const supplement = (key: SupplementKey, locale: Locale) => SUPPLEMENTS[key][locale];

/** Часы с одним знаком, по-местному: «6,5» по-русски, «6.5» по-английски. */
export const hoursOf = (minutes: number, locale: Locale) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(minutes / 60);

/** Минуты от полудня — чтобы «23:30» и «00:30» были соседями, а не концами суток. */
function bedMinutes(at: number): number {
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(at)
    .split(':')
    .map(Number);
  const m = clock[0] * 60 + clock[1];
  return m < 12 * 60 ? m + 24 * 60 : m;
}

const clockOf = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function factsOf(d: Dossier): Facts {
  const from = shiftDay(d.today, -6);

  // Питание: дни с записями за последние семь. Среднее — по законченным
  // дням: сегодняшний к обеду всегда «голодовка», и критик орал бы на завтрак.
  // Сегодня в среднее идёт, только если других дней нет; фастфуд — всегда.
  const week = d.food.filter((f) => f.day >= from && f.day <= d.today);
  const done = week.filter((f) => f.day < d.today);
  const counted = done.length ? done : week;
  const days = week.length;
  const avgKcal = counted.length ? counted.reduce((s, f) => s + f.kcal, 0) / counted.length : 0;
  const avgProtein = counted.length ? counted.reduce((s, f) => s + f.protein, 0) / counted.length : 0;
  const junk = week.reduce((s, f) => s + f.junk, 0);
  // Доля фастфуда — по записям, а не по калориям: так её видно и в дневнике.
  const entries = week.reduce((s, f) => s + f.entries, 0);
  const junkShare = entries ? junk / entries : 0;

  // Тренировки: сделано за семь дней против дней плана в неделе.
  const sinceMs = Date.parse(`${from}T00:00:00Z`) - 3_600_000 * 2;
  const doneWeek = d.workouts.filter((w) => (w.finishedAt ?? 0) >= sinceMs);
  const planDays = d.plan.filter((p) => p.items.length > 0);
  const muscles = new Set(planDays.flatMap((p) => p.items.map((i) => exerciseOf(i.exercise)?.muscle)));
  const working = d.workouts.flatMap((w) => w.sets).filter((s) => s.done && !s.warmup && (s.reps ?? 0) > 0);
  const avgReps = working.length ? working.reduce((s, x) => s + (x.reps ?? 0), 0) / working.length : null;

  // Сон: последние семь ночей.
  const nights = d.sleep.filter((n) => n.night >= from && n.night <= d.today);
  const age = d.age ?? DEFAULTS.age;
  const norm = sleepNormFor(age);
  const avgMin = nights.length ? nights.reduce((s, n) => s + n.minutes, 0) / nights.length : null;
  const beds = nights.map((n) => bedMinutes(n.bedAt));
  const meanBed = beds.length ? beds.reduce((s, b) => s + b, 0) / beds.length : null;
  const spread = beds.length >= 3 && meanBed !== null ? Math.sqrt(beds.reduce((s, b) => s + (b - meanBed) ** 2, 0) / beds.length) : null;

  // Вес: наклон по замерам за последние четыре недели, кг в неделю.
  const recent = d.weights.filter((w) => w.takenOn >= shiftDay(d.today, -28));
  let trend: number | null = null;
  if (recent.length >= 2) {
    const first = recent[0];
    const last = recent[recent.length - 1];
    const spanDays = (Date.parse(last.takenOn) - Date.parse(first.takenOn)) / 86_400_000;
    if (spanDays >= 6) trend = round1(((last.value - first.value) / spanDays) * 7);
  }

  return {
    goal: d.goal,
    age,
    ageKnown: d.age !== null,
    weightKg: d.weightKg,
    targets: d.targets,
    food: { days, avgKcal: Math.round(avgKcal), avgProtein: Math.round(avgProtein), junk, junkShare: round1(junkShare), junkNames: d.junkNames },
    train: {
      hasPlan: planDays.length > 0,
      planned: planDays.length,
      done: doneWeek.length,
      noLegs: planDays.length > 0 && !muscles.has('legs') && !muscles.has('glutes'),
      avgReps: avgReps === null ? null : round1(avgReps),
      sets: working.length
    },
    sleep: {
      nights: nights.length,
      avgHours: avgMin === null ? null : round1(avgMin / 60),
      shortNights: nights.filter((n) => n.minutes < norm.short * 60).length,
      longNights: nights.filter((n) => n.minutes > norm.long * 60).length,
      spreadMin: spread === null ? null : Math.round(spread),
      avgBed: meanBed === null ? null : clockOf(meanBed)
    },
    weightTrendPerWeek: trend
  };
}

/** Самое частое из фастфуда за неделю — словами из дневника, по-человечески. */
function junkPhrase(names: string[], locale: Locale) {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name.toLowerCase(), (counts.get(name.toLowerCase()) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const and = { ru: ' и ', uk: ' і ', en: ' and ', de: ' und ' }[locale];
  return top.map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(and);
}

export function verdictOf(d: Dossier, locale: Locale, seed: number): Verdict {
  const f = factsOf(d);
  const t = f.targets;
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const tips: AdviceKey[] = [];
  const tipValues: Partial<Record<AdviceKey, Record<string, string | number>>> = {};
  const norm = sleepNormFor(f.age);

  // ── Питание ──
  let food: Area;
  if (f.food.days === 0) {
    food = { score: null, face: 'meh', line: pickLine('foodNone', locale, seed) };
    tips.push('logFood');
  } else {
    const kcalDev = (f.food.avgKcal - t.kcal) / t.kcal;
    const proteinRatio = f.food.avgProtein / t.protein;
    let score = 10;
    score -= clamp(Math.abs(kcalDev) * 10 - 1, 0, 4);
    score -= clamp((1 - proteinRatio) * 6, 0, 4);
    score -= clamp(f.food.junk * 0.7 + f.food.junkShare * 5, 0, 4.5);
    score -= (7 - f.food.days) * 0.35;
    score = round1(clamp(score));

    const values = { kcal: num.format(f.food.avgKcal), target: num.format(t.kcal), protein: num.format(f.food.avgProtein), days: f.food.days };
    const junkText = junkPhrase(f.food.junkNames, locale);
    let key: LineKey;
    let face: Face;
    if (f.food.junk >= 4 || f.food.junkShare >= 0.3) {
      key = 'foodJunkHeavy';
      face = f.food.junk >= 6 ? 'angry' : 'sick';
    } else if (d.goal === 'cut' && kcalDev > 0.05) {
      key = 'foodOverCut';
      face = 'angry';
    } else if (d.goal !== 'cut' && kcalDev < -0.2) {
      key = 'foodUnder';
      face = 'sad';
    } else if (kcalDev > 0.2) {
      key = 'foodOver';
      face = 'shocked';
    } else if (proteinRatio < 0.75) {
      key = 'foodLowProtein';
      face = 'sad';
    } else if (f.food.junk > 0) {
      key = 'foodJunkSome';
      face = 'sick';
    } else if (f.food.days < 4) {
      key = 'foodSparse';
      face = 'meh';
    } else {
      key = 'foodGood';
      face = score >= 8.5 ? 'proud' : 'happy';
    }
    food = { score, face, line: pickLine(key, locale, seed, { ...values, junk: junkText }) };

    if (proteinRatio < 0.9) {
      const gap = Math.max(10, Math.round((t.protein - f.food.avgProtein) / 5) * 5);
      tips.push('protein');
      tipValues.protein = { gap, cottage: Math.round(gap / 0.17 / 10) * 10, scoops: Math.max(1, Math.round(gap / 22)) };
    }
    if (d.goal !== 'cut' && kcalDev < -0.1) {
      tips.push('kcalUp');
      tipValues.kcalUp = { gap: num.format(Math.round((t.kcal - f.food.avgKcal) / 50) * 50) };
    }
    if (kcalDev > 0.1) {
      tips.push('kcalDown');
      tipValues.kcalDown = { gap: num.format(Math.round((f.food.avgKcal - t.kcal) / 50) * 50) };
    }
    if (f.food.junk > 0) tips.push('junk');
    if (f.food.days < 5) tips.push('logFood');
  }

  // ── Тренировки ──
  let train: Area;
  const tr = f.train;
  if (!tr.hasPlan && tr.done === 0) {
    train = { score: d.workouts.length ? 2 : null, face: 'angry', line: pickLine('trainNoPlan', locale, seed) };
    tips.push('drawPlan');
  } else if (!tr.hasPlan) {
    const score = clamp(3 + tr.done * 1.8);
    train = { score: round1(score), face: score >= 7 ? 'happy' : 'meh', line: pickLine('trainFreestyle', locale, seed) };
    tips.push('drawPlan');
  } else {
    const ratio = Math.min(1, tr.done / tr.planned);
    let score = 10 * ratio;
    if (tr.noLegs) score -= 1.5;
    if (d.goal === 'strength' && tr.avgReps !== null && tr.avgReps > 9) score -= 1;
    if (d.goal === 'hypertrophy' && tr.avgReps !== null && (tr.avgReps < 5 || tr.avgReps > 16)) score -= 1;
    score = round1(clamp(score));
    const values = { done: tr.done, planned: tr.planned };
    const key: LineKey = tr.done === 0 ? 'trainNone' : tr.done < tr.planned ? 'trainSkipped' : tr.noLegs ? 'trainNoLegs' : 'trainGood';
    const face: Face = tr.done === 0 ? 'angry' : tr.done < tr.planned ? 'meh' : 'proud';
    train = { score, face, line: pickLine(key, locale, seed, values) };
    if (tr.done < tr.planned) tips.push('attend');
    if (tr.noLegs) tips.push('legs');
    if (tr.done > 0) tips.push(d.goal === 'strength' ? 'repsStrength' : d.goal === 'cut' ? 'cutLift' : 'repsHypertrophy');
    if (tr.done >= tr.planned && tr.planned > 0) tips.push('progress');
  }

  // ── Сон ──
  let sleep: Area;
  const sl = f.sleep;
  if (sl.nights === 0 || sl.avgHours === null) {
    sleep = { score: null, face: 'meh', line: pickLine('sleepNone', locale, seed) };
    tips.push('logSleep');
  } else {
    const h = sl.avgHours;
    let score = 10;
    if (h < norm.low) score -= (norm.low - h) * 3;
    if (h < norm.short) score -= 2;
    if (h > norm.long) score -= (h - norm.long) * 3 + 1;
    if (sl.spreadMin !== null && sl.spreadMin > 90) score -= sl.spreadMin > 150 ? 3 : 1.5;
    score = round1(clamp(score));
    const values = { hours: hoursOf(h * 60, locale), age: f.age, low: norm.low, high: norm.high };
    let key: LineKey;
    let face: Face;
    if (h < norm.short) {
      key = 'sleepShort';
      face = 'sleepy';
    } else if (h > norm.long) {
      key = 'sleepLong';
      face = 'overslept';
    } else if (sl.spreadMin !== null && sl.spreadMin > 90) {
      key = 'sleepChaos';
      face = 'meh';
    } else {
      key = 'sleepGood';
      face = h >= norm.low ? 'happy' : 'meh';
    }
    sleep = { score, face, line: pickLine(key, locale, seed, values) };
    if (h < norm.low) {
      // Подъём — средний по неделе; отбой — норма назад от него.
      const wakes = d.sleep.slice(0, 7).map((n) => bedMinutes(n.wakeAt) - 24 * 60);
      const wake = wakes.length ? wakes.reduce((s, x) => s + x, 0) / wakes.length : 7 * 60;
      tips.push('bedEarlier');
      tipValues.bedEarlier = { bed: clockOf(wake - norm.low * 60), low: norm.low, high: norm.high };
      tips.push('screens');
    }
    if (sl.spreadMin !== null && sl.spreadMin > 60) tips.push('bedRegular');
    if (h < norm.short || f.food.junkNames.some((n) => /энерг|енерг|energy|red bull|кол|cola/i.test(n))) tips.push('caffeine');
    if (h > norm.long) tips.push('sleepLong');
  }

  if (f.weightKg === null) tips.push('weigh');

  // ── Итог: нет данных — двойка, пустой дневник тоже ответ ──
  const parts = [food.score, train.score, sleep.score].map((s) => s ?? 2);
  const totalScore = round1(parts.reduce((s, x) => s + x, 0) / parts.length);
  const totalKey: LineKey =
    totalScore < 3 ? 'totalDisaster' : totalScore < 5 ? 'totalBad' : totalScore < 7 ? 'totalOk' : totalScore < 9 ? 'totalGood' : 'totalGreat';
  const totalFace: Face = totalScore < 3 ? 'angry' : totalScore < 5 ? 'sad' : totalScore < 7 ? 'meh' : totalScore < 9 ? 'happy' : 'proud';

  // ── Добавки ──
  const take: SupplementKey[] = [];
  if (tr.done >= 2 && d.goal !== 'cut') take.push(f.age >= 18 ? 'creatine' : 'creatineTeen');
  if (f.food.days > 0 && f.food.avgProtein < t.protein * 0.9) take.push('whey');
  const month = Number(d.today.slice(5, 7));
  if (month >= 10 || month <= 3) take.push('vitaminD');
  take.push('omega');
  const skip: SupplementKey[] = ['skipBurners', 'skipPreworkout'];
  if (sl.avgHours !== null && sl.avgHours < norm.short) skip.push('skipMelatonin');

  return {
    food,
    train,
    sleep,
    total: { score: totalScore, face: totalFace, line: pickLine(totalKey, locale, seed) },
    advice: [...new Set(tips)].slice(0, 6).map((key) => advice(key, locale, tipValues[key] ?? {})),
    supplements: { take: take.map((k) => supplement(k, locale)), skip: skip.map((k) => supplement(k, locale)) },
    facts: f
  };
}

/** Лицо и реплика мопса над едой одного дня. */
export function foodDayFace(
  totals: { kcal: number; protein: number; entries: number; junkNames: string[] },
  targets: Targets,
  goal: Goal,
  locale: Locale,
  seed: number,
  isToday: boolean
): { face: Face; line: string } {
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const values = {
    kcal: num.format(totals.kcal),
    target: num.format(targets.kcal),
    protein: num.format(totals.protein),
    proteinTarget: num.format(targets.protein),
    junk: junkPhrase(totals.junkNames, locale)
  };
  if (totals.entries === 0) return { face: 'meh', line: pickLine('dayEmpty', locale, seed) };
  if (totals.junkNames.length >= 3) return { face: 'angry', line: pickLine('daySick', locale, seed, values) };
  if (totals.junkNames.length > 0) return { face: 'sick', line: pickLine('daySick', locale, seed, values) };
  const over = totals.kcal / targets.kcal;
  if (over > (goal === 'cut' ? 1.05 : 1.25)) return { face: 'angry', line: pickLine('dayAngry', locale, seed, values) };
  // Белок к концу дня. Утром мало — это не провал, это утро.
  if (!isToday || totals.kcal > targets.kcal * 0.6) {
    if (totals.protein < targets.protein * 0.7) {
      return { face: 'sad', line: pickLine('dayHungry', locale, seed, { ...values, target: values.proteinTarget }) };
    }
    if (over >= 0.85 && totals.protein >= targets.protein * 0.9) return { face: 'proud', line: pickLine('dayGood', locale, seed) };
  }
  return { face: 'happy', line: pickLine('dayOk', locale, seed) };
}

/** Лицо и реплика мопса после ночи. */
export function nightFace(minutes: number | null, age: number, locale: Locale, seed: number): { face: Face; mood: SleepMood | null; line: string } {
  const norm = sleepNormFor(age);
  if (minutes === null) return { face: 'meh', mood: null, line: pickLine('nightNone', locale, seed) };
  const mood = sleepMoodOf(minutes / 60, norm);
  const values = { hours: hoursOf(minutes, locale), low: norm.low, high: norm.high };
  const key: LineKey =
    mood === 'wrecked'
      ? 'nightWrecked'
      : mood === 'sleepy'
        ? 'nightSleepy'
        : mood === 'overslept'
          ? 'nightOverslept'
          : mood === 'okay'
            ? 'nightOkay'
            : 'nightFresh';
  const face: Face = mood === 'wrecked' || mood === 'sleepy' ? 'sleepy' : mood === 'overslept' ? 'overslept' : mood === 'okay' ? 'meh' : 'happy';
  return { face, mood, line: pickLine(key, locale, seed, values) };
}
