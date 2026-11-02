import 'server-only';

import type Anthropic from '@anthropic-ai/sdk';

import type { Locale } from '@/i18n/routing';
import { authConfigured } from '@/lib/auth/config';
import { ZONE, dayKey, shiftDay } from '@/lib/calendar/scales';
import {
  activeWorkout,
  foodDay,
  foodTotals,
  goalsOf,
  gymProfile,
  measuresOf,
  planOf,
  recentWorkouts,
  recordsOf,
  sleepRange,
  weekdayOf,
  type GoalView,
  type PlanDayView,
  type WorkoutView
} from '@/lib/gym/data';
import {
  MEALS,
  addFoodsFor,
  addGoalFor,
  addMeasureFor,
  addSleepFor,
  logWorkoutFor,
  removeFoodsFor,
  removeGoalFor,
  removeMeasureFor,
  removeSleepFor,
  removeWorkoutFor,
  saveProfileFor,
  setPlanDaysFor
} from '@/lib/gym/diary';
import { EXERCISES, exerciseName, kindOf } from '@/lib/gym/exercises';
import { PARTS, isPart, sleepNormFor, unitOf } from '@/lib/gym/norms';

/**
 * Мопс-тренер: что он видит в дневнике зала и что может в него записать.
 *
 * Как календарь и доска (`lookup.ts`, `write.ts`), но с одним отличием,
 * решённым владельцем 2 ноября 2026: **в дневнике зала мопс может и править, и
 * удалять** — по одной записи и только по прямой просьбе. Дневник личный: всё
 * здесь пишется и стирается только у человека из сессии, чужой дневник
 * инструменту назвать нечем. Общие доска и календарь остаются «только создать».
 *
 * Пишет он через `gym/diary.ts` — те же функции, что зовут кнопки на
 * страницах, с теми же проверками: чего не запишет кнопка, того не запишет и
 * мопс. Вернуть он обязан то, что легло в базу, — и прочитать это вслух.
 *
 * Строгая схема (`strict`) — только у чтения. У API потолок на размер
 * грамматики всех строгих инструментов запроса, и восемь вложенных схем
 * записи его пробили: 400 «compiled grammar is too large», и мопс молча падал
 * в запасной словарь. Запись проверяет вход сама — разбором ниже и тем же zod,
 * что у кнопок, в `diary.ts`. «Не трогать» — `keep` или 0, а не `null`.
 */

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

const EXERCISE_FIELD = {
  type: 'string',
  description: 'The exercise, by its usual name in any language (e.g. "жим штанги лёжа", "bench press") or its catalog id.'
} as const;

export const GYM_DIARY_TOOL: Anthropic.Beta.BetaTool = {
  name: 'gym_diary',
  description:
    "Look in this person's own gym diary. Use it before any advice about their training, food, sleep or body, " +
    'and whenever they ask what they wrote, ate, lifted or slept — never guess at their numbers. ' +
    'The ids it shows are what remove_gym_entry takes.',
  input_schema: {
    type: 'object',
    properties: {
      what: {
        type: 'string',
        enum: ['overview', 'food', 'training', 'sleep', 'body'],
        description:
          'overview: goal, body data, daily targets, goals, the weekly plan and today in short. ' +
          'food: one day of meals with totals against the targets, plus the last seven days. ' +
          'training: the workout in progress, recent workouts with their sets, records, the plan. ' +
          'sleep: the last fourteen nights. body: measurements and goals.'
      },
      day: { type: 'string', description: 'Only for food: YYYY-MM-DD worked out from today. Empty string means today.' }
    },
    required: ['what', 'day'],
    additionalProperties: false
  },
  strict: true
};

const SET_PROFILE: Anthropic.Beta.BetaTool = {
  name: 'set_gym_profile',
  description:
    'Change their goal or the body data their daily targets are computed from. Only what they told you; ' +
    '"keep" or 0 leaves a field as it is. Body weight is not here — that is a measurement, use log_measure.',
  input_schema: {
    type: 'object',
    properties: {
      goal: { type: 'string', enum: ['hypertrophy', 'strength', 'cut', 'keep'], description: 'hypertrophy = mass, strength, cut = lose fat.' },
      height_cm: { type: 'integer', description: '0 leaves it.' },
      sex: { type: 'string', enum: ['male', 'female', 'keep'] },
      activity: {
        type: 'string',
        enum: ['low', 'mid', 'high', 'keep'],
        description: 'Movement outside the gym: low = sits most of the day, mid = on foot part of the day, high = on foot all day or sport besides the gym.'
      },
      born_year: { type: 'integer', description: '0 leaves it.' }
    },
    required: ['goal', 'height_cm', 'sex', 'activity', 'born_year'],
    additionalProperties: false
  }
};

const ADD_GOAL: Anthropic.Beta.BetaTool = {
  name: 'add_gym_goal',
  description: 'Add a concrete goal: a body weight, a working weight in a lift, or a measurement. To change a goal, remove the old one and add the new one.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['bodyweight', 'lift', 'measure'] },
      subject: {
        type: 'string',
        description: `lift: the exercise (any language, or its id). measure: one of ${PARTS.join(', ')}. bodyweight: empty string.`
      },
      target: { type: 'number', description: 'kg for body weight and lifts, % for bodyfat, cm for the other measurements.' },
      deadline: { type: 'string', description: 'YYYY-MM-DD, or empty string for none.' }
    },
    required: ['kind', 'subject', 'target', 'deadline'],
    additionalProperties: false
  }
};

const SET_PLAN: Anthropic.Beta.BetaTool = {
  name: 'set_gym_plan',
  description:
    'Write days of their weekly plan on the board. Each listed day is replaced whole, title and exercises; ' +
    'a day with no title and no exercises becomes a rest day. Only when they ask for a plan or a change to it.',
  input_schema: {
    type: 'object',
    properties: {
      days: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            weekday: { type: 'string', enum: [...WEEKDAYS] },
            title: { type: 'string', description: 'What the day is called on the board, short, in their language — e.g. "грудь трицепс". Empty for a rest day.' },
            exercises: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  exercise: EXERCISE_FIELD,
                  sets: { type: 'integer' },
                  reps: { type: 'integer', description: 'Reps per set; 1 for timed exercises.' },
                  seconds: { type: 'integer', description: 'Seconds per set for timed exercises (plank), otherwise 0.' },
                  weight_kg: { type: 'number', description: 'Working weight, or 0 to leave it for them to fill in.' }
                },
                required: ['exercise', 'sets', 'reps', 'seconds', 'weight_kg'],
                additionalProperties: false
              }
            }
          },
          required: ['weekday', 'title', 'exercises'],
          additionalProperties: false
        }
      },
      replace_week: { type: 'boolean', description: 'true: the days you did not list become rest days. false: only the listed days change.' }
    },
    required: ['days', 'replace_week'],
    additionalProperties: false
  }
};

const LOG_FOOD: Anthropic.Beta.BetaTool = {
  name: 'log_food',
  description:
    'Write what they ate into their food diary. Grams from what they said, a normal portion when they did not; ' +
    "nutrition for those grams from standard food tables, or the chain's published values for fast food. Only when they ask you to log it.",
  input_schema: {
    type: 'object',
    properties: {
      day: { type: 'string', description: 'YYYY-MM-DD, or empty string for today.' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            meal: { type: 'string', enum: [...MEALS] },
            name: { type: 'string', description: 'Short, lowercase, in their language.' },
            grams: { type: 'number' },
            kcal: { type: 'number' },
            protein: { type: 'number' },
            fat: { type: 'number' },
            carbs: { type: 'number' },
            fast_food: { type: 'boolean' }
          },
          required: ['meal', 'name', 'grams', 'kcal', 'protein', 'fat', 'carbs', 'fast_food'],
          additionalProperties: false
        }
      }
    },
    required: ['day', 'items'],
    additionalProperties: false
  }
};

const LOG_WORKOUT: Anthropic.Beta.BetaTool = {
  name: 'log_workout',
  description:
    'Write sets they did. If a workout is in progress today, the exercises are added to it; otherwise a finished workout is saved for that day. ' +
    'Only what they say they did.',
  input_schema: {
    type: 'object',
    properties: {
      day: { type: 'string', description: 'YYYY-MM-DD, or empty string for today.' },
      title: { type: 'string', description: 'What the workout was, short, or empty.' },
      exercises: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            exercise: EXERCISE_FIELD,
            sets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  weight_kg: { type: 'number', description: '0 when there is no weight.' },
                  reps: { type: 'integer', description: '0 for timed sets and cardio.' },
                  seconds: { type: 'integer', description: '0 unless timed.' },
                  km: { type: 'number', description: '0 unless cardio with a distance.' }
                },
                required: ['weight_kg', 'reps', 'seconds', 'km'],
                additionalProperties: false
              }
            }
          },
          required: ['exercise', 'sets'],
          additionalProperties: false
        }
      }
    },
    required: ['day', 'title', 'exercises'],
    additionalProperties: false
  }
};

const LOG_SLEEP: Anthropic.Beta.BetaTool = {
  name: 'log_sleep',
  description: 'Write a night of sleep. A second entry for the same night replaces the first.',
  input_schema: {
    type: 'object',
    properties: {
      night: { type: 'string', description: 'The morning they woke up, YYYY-MM-DD, or empty string for this morning.' },
      bed: { type: 'string', description: 'When they fell asleep, HH:MM, 24-hour clock.' },
      wake: { type: 'string', description: 'When they woke up, HH:MM, 24-hour clock.' }
    },
    required: ['night', 'bed', 'wake'],
    additionalProperties: false
  }
};

const LOG_MEASURE: Anthropic.Beta.BetaTool = {
  name: 'log_measure',
  description: 'Write a measurement: body weight, bodyfat or a girth.',
  input_schema: {
    type: 'object',
    properties: {
      part: { type: 'string', enum: [...PARTS] },
      value: { type: 'number', description: 'kg for weight, % for bodyfat, cm for the rest.' },
      day: { type: 'string', description: 'YYYY-MM-DD, or empty string for today.' }
    },
    required: ['part', 'value', 'day'],
    additionalProperties: false
  }
};

const REMOVE: Anthropic.Beta.BetaTool = {
  name: 'remove_gym_entry',
  description:
    'Remove one entry from their own diary by the id gym_diary showed you. Only when they ask for that entry to go. ' +
    'One entry per call — there is no "delete everything", and you do not offer one.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['food', 'goal', 'measure', 'sleep', 'workout'] },
      id: { type: 'string' }
    },
    required: ['kind', 'id'],
    additionalProperties: false
  }
};

export const GYM_LOOKUP_TOOLS = [GYM_DIARY_TOOL];
export const GYM_WRITE_TOOLS = [SET_PROFILE, ADD_GOAL, SET_PLAN, LOG_FOOD, LOG_WORKOUT, LOG_SLEEP, LOG_MEASURE, REMOVE];

const LOOKUP_NAMES = new Set(GYM_LOOKUP_TOOLS.map((tool) => tool.name));
const WRITE_NAMES = new Set(GYM_WRITE_TOOLS.map((tool) => tool.name));
export const isGymLookup = (name: string) => LOOKUP_NAMES.has(name);
export const isGymWrite = (name: string) => WRITE_NAMES.has(name);

// ─── Упражнение по имени ────────────────────────────────────────────────────

const plain = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const NAMES = EXERCISES.flatMap((e) => [e.id, ...Object.values(e.name)].map((n) => ({ id: e.id, words: plain(n).split(' ') })));

/** Как это зовут в зале, когда справочник пишет иначе. */
const ALIASES: Record<string, string> = {
  'тяга штанги в наклоне': 'barbell-row',
  'тяга в наклоне': 'barbell-row',
  'сгибания рук со штангой': 'biceps-curl',
  'сгибание рук со штангой': 'biceps-curl',
  'сгибания рук с гантелями': 'db-curl',
  'махи в стороны': 'lateral-raise',
  'махи гантелями в стороны': 'lateral-raise',
  'становая': 'deadlift'
};

/**
 * Одно слово — то же, если у них общее начало почти во всю длину: «сгибания»
 * и «сгибание», «гантелей» и «гантели». Русские окончания меняются, а модель
 * пишет упражнение так, как его говорят, а не как оно в справочнике.
 */
function sameWord(a: string, b: string) {
  if (a === b) return true;
  const short = Math.min(a.length, b.length);
  if (short < 4) return false;
  let n = 0;
  while (n < short && a[n] === b[n]) n += 1;
  return n >= Math.max(4, short - 2);
}

/**
 * Упражнение справочника по тому, как его назвала модель: «жим лёжа», «bench
 * press», `bench-press`. Все слова названного, кроме коротких предлогов,
 * должны найтись в имени; из подошедших берётся самое короткое имя — «жим
 * штанги лёжа» раньше «жима гантелей лёжа». Не нашлось — пять похожих, чтобы
 * модель выбрала сама, а не мы за неё.
 */
export function findExercise(asked: string): { id: string } | { close: string[] } {
  const said = plain(asked);
  if (ALIASES[said]) return { id: ALIASES[said] };
  const words = said.split(' ').filter((w) => w.length > 2);
  if (!words.length) return { close: [] };
  // При равенстве — у кого меньше лишних слов, потом порядок справочника:
  // «присед» — это «присед со штангой», а не «фронтальный присед».
  const scored = NAMES.map((n) => {
    const found = words.filter((w) => n.words.some((v) => sameWord(w, v))).length;
    const extra = n.words.filter((v) => v.length > 2 && !words.some((w) => sameWord(w, v))).length;
    return { id: n.id, extra, found };
  })
    .filter((n) => n.found > 0)
    .sort((a, b) => b.found - a.found || a.extra - b.extra);
  const best = scored[0];
  if (best && best.found === words.length) return { id: best.id };
  return { close: [...new Set(scored.map((n) => n.id))].slice(0, 5) };
}

/**
 * Упражнения из ввода: найденные — номерами, ненайденные — `null` и строкой для
 * модели с похожими. Не найденное одно не валит весь план: записывается
 * остальное, а модель говорит, что пропустила, — переписывать план из-за
 * одного упражнения стоило ей двух тысяч токенов и упиралось в потолок ответа.
 */
function resolveSome(asked: string[], locale: Locale): { ids: (string | null)[]; missed: string[] } {
  const missed: string[] = [];
  const ids = asked.map((name) => {
    const found = findExercise(name);
    if ('id' in found) return found.id;
    const close = found.close.map((id) => `"${exerciseName(id, locale)}"`).join(', ');
    missed.push(`"${name}"${close ? ` (closest: ${close})` : ''}`);
    return null;
  });
  return { ids, missed };
}

const leftOut = (missed: string[]) =>
  missed.length ? `\nNot in the exercise catalog, so left out: ${missed.join('; ')}. Tell them, and offer the closest one.` : '';

// ─── Чтение ─────────────────────────────────────────────────────────────────

const round = (v: number) => Math.round(v);
const clock = (at: number) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
const dayOfMs = (at: number) => dayKey(new Date(at));
const dayOrToday = (day: string, today: string) => (DAY.test(day.trim()) ? day.trim() : today);

function setLine(set: { weight: number | null; reps: number | null; seconds: number | null; distance: number | null }) {
  const parts: string[] = [];
  if (set.weight) parts.push(`${set.weight} kg`);
  if (set.reps) parts.push(`× ${set.reps}`);
  if (set.seconds) parts.push(`${set.seconds} s`);
  if (set.distance) parts.push(`${set.distance} km`);
  return parts.join(' ') || 'done';
}

function planLines(plan: PlanDayView[], locale: Locale) {
  return WEEKDAYS.map((name, weekday) => {
    const day = plan.find((d) => d.weekday === weekday);
    if (!day || (!day.title && !day.items.length)) return `- ${name}: rest`;
    const items = day.items
      .map((i) => `${exerciseName(i.exercise, locale)} ${i.sets}×${i.seconds ? `${i.seconds} s` : i.reps}${i.weight ? ` ${i.weight} kg` : ''}`)
      .join('; ');
    return `- ${name}: ${day.title ? `"${day.title}"` : '(no title)'}${items ? ` — ${items}` : ''}`;
  }).join('\n');
}

function goalLines(goals: GoalView[], locale: Locale) {
  if (!goals.length) return 'none';
  return goals
    .map((g) => {
      const what =
        g.kind === 'bodyweight' ? 'body weight' : g.kind === 'lift' ? exerciseName(g.subject ?? '', locale) : (g.subject ?? '');
      const unit = g.kind === 'measure' && isPart(g.subject) ? unitOf(g.subject) : 'kg';
      return `- [${g.id}] ${what} → ${g.target} ${unit}${g.deadline ? ` by ${g.deadline}` : ''}${g.achievedAt ? ' (reached)' : ''}`;
    })
    .join('\n');
}

function workoutLines(w: WorkoutView, locale: Locale) {
  const blocks = new Map<number, string[]>();
  for (const set of w.sets) {
    const list = blocks.get(set.block) ?? [];
    list.push(`${setLine(set)}${set.done ? '' : ' (not done yet)'}${set.warmup ? ' (warm-up)' : ''}`);
    blocks.set(set.block, list);
  }
  const exercise = (block: number) => w.sets.find((s) => s.block === block)?.exercise ?? '';
  return [...blocks.entries()].map(([block, sets]) => `  ${exerciseName(exercise(block), locale)}: ${sets.join(', ')}`).join('\n');
}

async function overview(userId: string, today: string, locale: Locale) {
  const from = shiftDay(today, -6);
  const [profile, goals, plan, food, workouts, active, sleep] = await Promise.all([
    gymProfile(userId, today),
    goalsOf(userId),
    planOf(userId),
    foodTotals(userId, from, today),
    recentWorkouts(userId, 8),
    activeWorkout(userId),
    sleepRange(userId, from, today)
  ]);
  const t = profile.targets;
  const eaten = food.find((d) => d.day === today);
  const logged = food.filter((d) => d.entries > 0);
  const week = workouts.filter((w) => dayOfMs(w.startedAt) >= from);
  const done = week.some((w) => dayOfMs(w.startedAt) === today);
  const hours = sleep.length ? sleep.reduce((s, n) => s + n.minutes, 0) / sleep.length / 60 : null;
  return [
    `Profile: goal ${profile.goal} · height ${profile.heightCm ?? 'not set'} cm · ${profile.sex} · activity ${profile.activity} · ` +
      `age ${profile.age ?? 'unknown'} · weight ${profile.weightKg ?? 'never measured'}${profile.weightKg ? ' kg (latest)' : ''}`,
    `Daily targets the site computed: ${t.kcal} kcal · protein ${t.protein} g · fat ${t.fat} g · carbs ${t.carbs} g`,
    `Goals:\n${goalLines(goals, locale)}`,
    `Weekly plan:\n${planLines(plan, locale)}`,
    `Today ${today} (${WEEKDAYS[weekdayOf(today)]}): eaten ${round(eaten?.kcal ?? 0)} / ${t.kcal} kcal, protein ${round(eaten?.protein ?? 0)} / ${t.protein} g; ` +
      `workout ${active ? 'in progress' : done ? 'done' : 'none yet'}`,
    `Last 7 days: ${week.length} workouts; food logged on ${logged.length} days` +
      (logged.length ? `, average ${round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length)} kcal` : '') +
      `; sleep ${hours === null ? 'not logged' : `${hours.toFixed(1)} h on average over ${sleep.length} nights`}`
  ].join('\n');
}

async function mealsOf(userId: string, day: string, today: string) {
  const from = shiftDay(today, -6);
  const [profile, entries, week] = await Promise.all([gymProfile(userId, today), foodDay(userId, day), foodTotals(userId, from, today)]);
  const t = profile.targets;
  const sum = entries.reduce((s, e) => ({ kcal: s.kcal + e.kcal, protein: s.protein + e.protein, fat: s.fat + e.fat, carbs: s.carbs + e.carbs }), {
    kcal: 0,
    protein: 0,
    fat: 0,
    carbs: 0
  });
  const meals = MEALS.map((meal) => {
    const list = entries.filter((e) => e.meal === meal);
    if (!list.length) return `${meal}: nothing`;
    return `${meal}:\n${list
      .map(
        (e) =>
          `- [${e.id}] ${e.name}${e.grams ? ` ${round(e.grams)} g` : ''} — ${round(e.kcal)} kcal, P ${round(e.protein)} F ${round(e.fat)} C ${round(e.carbs)}` +
          `${e.junk ? ' (fast food)' : ''}${e.estimated ? ' (estimate)' : ''}`
      )
      .join('\n')}`;
  }).join('\n');
  return [
    `${day} (${WEEKDAYS[weekdayOf(day)]}). Targets: ${t.kcal} kcal · P ${t.protein} · F ${t.fat} · C ${t.carbs}`,
    meals,
    `Total: ${round(sum.kcal)} kcal, P ${round(sum.protein)}, F ${round(sum.fat)}, C ${round(sum.carbs)} — ` +
      `${sum.kcal <= t.kcal ? `${round(t.kcal - sum.kcal)} kcal left` : `${round(sum.kcal - t.kcal)} kcal over`}, protein ${round(Math.max(0, t.protein - sum.protein))} g to go`,
    `Last 7 days, kcal: ${week.map((d) => `${d.day.slice(5)} ${round(d.kcal)}`).join(', ') || 'nothing logged'}`
  ].join('\n');
}

async function training(userId: string, locale: Locale) {
  const [active, workouts, records, plan] = await Promise.all([activeWorkout(userId), recentWorkouts(userId, 5), recordsOf(userId), planOf(userId)]);
  const top = records
    .slice(0, 10)
    .map((r) => `- ${exerciseName(r.exercise, locale)}: best ${setLine(r.best)} on ${dayOfMs(r.best.at)}${r.e1rm ? `, estimated 1RM ${round(r.e1rm)} kg` : ''}`)
    .join('\n');
  return [
    active ? `In progress [${active.id}], started ${clock(active.startedAt)}${active.title ? ` "${active.title}"` : ''}:\n${workoutLines(active, locale)}` : 'No workout in progress.',
    `Recent workouts:\n${
      workouts.map((w) => `- [${w.id}] ${dayOfMs(w.startedAt)}${w.title ? ` "${w.title}"` : ''}\n${workoutLines(w, locale)}`).join('\n') || 'none logged'
    }`,
    `Records:\n${top || 'none yet'}`,
    `Weekly plan:\n${planLines(plan, locale)}`
  ].join('\n');
}

async function sleepOf(userId: string, today: string) {
  const [profile, nights] = await Promise.all([gymProfile(userId, today), sleepRange(userId, shiftDay(today, -13), today)]);
  const norm = sleepNormFor(profile.age ?? 17);
  return [
    `Norm for their age: ${norm.low}–${norm.high} h; under ${norm.short} h is short.`,
    nights.map((n) => `- [${n.id}] woke ${n.night}: asleep ${clock(n.bedAt)}, up ${clock(n.wakeAt)} — ${(n.minutes / 60).toFixed(1)} h`).join('\n') ||
      'No nights logged in the last two weeks.'
  ].join('\n');
}

async function body(userId: string, locale: Locale) {
  const [measures, goals] = await Promise.all([measuresOf(userId), goalsOf(userId)]);
  const lines = PARTS.flatMap((part) => {
    const list = measures[part];
    if (!list?.length) return [];
    return [`- ${part}: ${list.slice(-4).map((m) => `[${m.id}] ${m.value} ${unitOf(part)} on ${m.takenOn}`).join(', ')}`];
  });
  return [`Measurements (latest last):\n${lines.join('\n') || 'none'}`, `Goals:\n${goalLines(goals, locale)}`].join('\n');
}

/**
 * Сводка дневника для хвоста брифа на страницах зала: то же, что
 * `gym_diary` → `overview`, но без отдельного вызова модели. Раньше на каждый
 * вопрос в зале мопс сначала ходил за ней инструментом — лишний круг стоил
 * полцента и пару секунд. Собирается к каждому сообщению заново, поэтому
 * свежая; в кешируемую часть брифа не попадает. Не вышло — `null`, и мопс
 * спросит инструментом, как раньше.
 */
export async function diaryNow(userId: string, locale: Locale): Promise<string | null> {
  if (!authConfigured()) return null;
  try {
    return await overview(userId, dayKey(new Date()), locale);
  } catch (error) {
    console.warn('[podshar] сводка дневника для брифа не собралась:', error);
    return null;
  }
}

export async function runGymLookup(name: string, input: unknown, userId: string, locale: Locale): Promise<string> {
  if (!authConfigured()) return 'There is no database here, so the diary cannot be read. Say so.';
  const { what, day } = (input ?? {}) as { what?: string; day?: string };
  const today = dayKey(new Date());
  try {
    if (what === 'food') return await mealsOf(userId, dayOrToday(day ?? '', today), today);
    if (what === 'training') return await training(userId, locale);
    if (what === 'sleep') return await sleepOf(userId, today);
    if (what === 'body') return await body(userId, locale);
    return await overview(userId, today, locale);
  } catch (error) {
    console.warn(`[podshar] дневник зала (${name}) не прочитался:`, error);
    return 'The diary could not be read just now. Say you could not see it — do not guess.';
  }
}

// ─── Запись ─────────────────────────────────────────────────────────────────

type In = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const positive = (v: unknown) => (num(v) > 0 ? num(v) : null);

/** Ключ ошибки из `diary.ts` — словами, которые модель может сказать человеку. */
const WHY: Record<string, string> = {
  invalid: 'the values did not pass the checks (a number out of range, or a date in the wrong shape)',
  future: 'that date is in the future',
  range: 'that number is not believable for this',
  tooMany: 'there are too many entries already',
  empty: 'a name was empty',
  noKcal: 'calories were missing'
};
const failed = (error: string | undefined) =>
  `nothing was written: ${WHY[error ?? ''] ?? 'it did not save'}. Say so plainly, and do not pretend it worked.`;

async function setProfile(input: In, userId: string) {
  const patch: Record<string, unknown> = {};
  if (input.goal !== 'keep' && input.goal) patch.goal = input.goal;
  if (num(input.height_cm) > 0) patch.heightCm = num(input.height_cm);
  if (input.sex !== 'keep' && input.sex) patch.sex = input.sex;
  if (input.activity !== 'keep' && input.activity) patch.activity = input.activity;
  if (num(input.born_year) > 0) patch.bornYear = num(input.born_year);
  if (!Object.keys(patch).length) return 'nothing to change — every field was "keep". Ask what they want changed.';
  const result = await saveProfileFor(userId, patch);
  if (!result.ok) return failed(result.error);
  const today = dayKey(new Date());
  const { targets: t } = await gymProfile(userId, today);
  return `Saved to their profile: ${Object.entries(patch).map(([k, v]) => `${k} ${v}`).join(', ')}. Daily targets are now ${t.kcal} kcal · protein ${t.protein} g · fat ${t.fat} g · carbs ${t.carbs} g. Tell them what changed.`;
}

async function addGoal(input: In, userId: string, locale: Locale) {
  const kind = str(input.kind);
  let subject: string | null = null;
  if (kind === 'lift') {
    const found = resolveSome([str(input.subject)], locale);
    if (!found.ids[0]) return `nothing was written.${leftOut(found.missed)}`;
    subject = found.ids[0];
  } else if (kind === 'measure') {
    subject = str(input.subject);
  }
  const deadline = DAY.test(str(input.deadline)) ? str(input.deadline) : null;
  const result = await addGoalFor(userId, { kind, subject, target: num(input.target), deadline });
  if (!result.ok) return failed(result.error);
  const what = kind === 'bodyweight' ? 'body weight' : kind === 'lift' ? exerciseName(subject ?? '', locale) : subject;
  return `Goal added [${result.id}]: ${what} → ${num(input.target)}${deadline ? ` by ${deadline}` : ''}. Read it back to them.`;
}

async function setPlan(input: In, userId: string, locale: Locale) {
  const days = Array.isArray(input.days) ? (input.days as In[]) : [];
  const asked = days.flatMap((d) => (Array.isArray(d.exercises) ? (d.exercises as In[]).map((e) => str(e.exercise)) : []));
  const found = resolveSome(asked, locale);
  let at = 0;
  const parsed = days.map((d) => ({
    weekday: WEEKDAYS.indexOf(str(d.weekday) as (typeof WEEKDAYS)[number]),
    title: str(d.title).slice(0, 40),
    items: (Array.isArray(d.exercises) ? (d.exercises as In[]) : []).flatMap((e) => {
      const exercise = found.ids[at++];
      if (!exercise) return [];
      return [{ exercise, sets: Math.min(12, Math.max(1, num(e.sets))), reps: Math.min(100, Math.max(1, num(e.reps))), seconds: positive(e.seconds), weight: positive(e.weight_kg) }];
    })
  }));
  if (parsed.some((d) => d.weekday < 0)) return failed('invalid');
  const result = await setPlanDaysFor(userId, parsed, input.replace_week === true);
  if (!result.ok) return failed(result.error);
  const plan = await planOf(userId);
  return `The board now reads:\n${planLines(plan, locale)}${leftOut(found.missed)}\nTell them what you wrote, day by day.`;
}

async function logFood(input: In, userId: string) {
  const today = dayKey(new Date());
  const day = dayOrToday(str(input.day), today);
  const items = Array.isArray(input.items) ? (input.items as In[]) : [];
  if (!items.length) return 'nothing to log — the list was empty.';
  const written: string[] = [];
  for (const meal of MEALS) {
    const list = items.filter((i) => i.meal === meal);
    if (!list.length) continue;
    const result = await addFoodsFor(userId, {
      day,
      meal,
      items: list.map((i) => ({
        name: str(i.name),
        grams: positive(i.grams),
        kcal: num(i.kcal),
        protein: num(i.protein),
        fat: num(i.fat),
        carbs: num(i.carbs),
        junk: i.fast_food === true
      }))
    });
    if (!result.ok) return written.length ? `${written.join('\n')}\nThe rest did not save: ${failed(result.error)}` : failed(result.error);
    written.push(...list.map((i) => `${meal}: ${str(i.name)} ${round(num(i.grams))} g — ${round(num(i.kcal))} kcal, P ${round(num(i.protein))} F ${round(num(i.fat))} C ${round(num(i.carbs))}`));
  }
  const [entries, profile] = await Promise.all([foodDay(userId, day), gymProfile(userId, today)]);
  const kcal = entries.reduce((s, e) => s + e.kcal, 0);
  const protein = entries.reduce((s, e) => s + e.protein, 0);
  return `Logged for ${day}:\n${written.join('\n')}\nThat day now: ${round(kcal)} / ${profile.targets.kcal} kcal, protein ${round(protein)} / ${profile.targets.protein} g. Read back what you logged.`;
}

async function logWorkout(input: In, userId: string, locale: Locale) {
  const today = dayKey(new Date());
  const day = dayOrToday(str(input.day), today);
  const exercises = Array.isArray(input.exercises) ? (input.exercises as In[]) : [];
  const found = resolveSome(exercises.map((e) => str(e.exercise)), locale);
  const blocks = exercises.flatMap((e, i) => {
    const exercise = found.ids[i];
    if (!exercise) return [];
    const sets = (Array.isArray(e.sets) ? (e.sets as In[]) : []).map((s) => ({
      weight: positive(s.weight_kg) ?? (kindOf(exercise) === 'weight' ? 0 : null),
      reps: positive(s.reps),
      seconds: positive(s.seconds),
      distance: positive(s.km)
    }));
    return [{ exercise, sets }];
  });
  if (!blocks.length) return `nothing was written.${leftOut(found.missed)}`;
  const result = await logWorkoutFor(userId, day, str(input.title), blocks);
  if (!result.ok) return failed(result.error);
  const lines = blocks.map((b) => `${exerciseName(b.exercise, locale)}: ${b.sets.map(setLine).join(', ')}`).join('\n');
  return `${result.appended ? 'Added to the workout in progress' : `Saved as a finished workout on ${day}`}:\n${lines}${leftOut(found.missed)}\nRead back what you wrote.`;
}

async function logSleep(input: In, userId: string) {
  const night = dayOrToday(str(input.night), dayKey(new Date()));
  const bed = str(input.bed);
  const wake = str(input.wake);
  if (!CLOCK.test(bed) || !CLOCK.test(wake)) return failed('invalid');
  const result = await addSleepFor(userId, { night, bed, wake });
  if (!result.ok) return failed(result.error);
  return `Saved the night that ended on ${night}: asleep ${bed}, up ${wake} — ${((result.minutes ?? 0) / 60).toFixed(1)} h. Read it back.`;
}

async function logMeasure(input: In, userId: string) {
  const part = str(input.part);
  const takenOn = dayOrToday(str(input.day), dayKey(new Date()));
  const result = await addMeasureFor(userId, { part, value: num(input.value), takenOn });
  if (!result.ok) return failed(result.error);
  return `Saved [${result.id}]: ${part} ${num(input.value)} ${isPart(part) ? unitOf(part) : ''} on ${takenOn}. Read it back.`;
}

async function remove(input: In, userId: string) {
  const id = str(input.id);
  const kind = str(input.kind);
  const result =
    kind === 'food'
      ? await removeFoodsFor(userId, [id])
      : kind === 'goal'
        ? await removeGoalFor(userId, id)
        : kind === 'measure'
          ? await removeMeasureFor(userId, id)
          : kind === 'sleep'
            ? await removeSleepFor(userId, id)
            : await removeWorkoutFor(userId, id);
  if (!result.ok) return failed(result.error);
  if (!result.count) return `nothing was removed: no ${kind} entry [${id}] in their diary. Look again with gym_diary before saying anything about it.`;
  console.log(`[podshar] мопс убрал из дневника ${userId}: ${kind} ${id}`);
  return `Removed the ${kind} entry [${id}]. Say exactly what is gone.`;
}

export async function runGymWrite(name: string, input: unknown, userId: string, locale: Locale): Promise<string> {
  if (!authConfigured()) return 'there is no database here, so nothing was written — say so.';
  const data = (input ?? {}) as In;
  try {
    if (name === 'set_gym_profile') return await setProfile(data, userId);
    if (name === 'add_gym_goal') return await addGoal(data, userId, locale);
    if (name === 'set_gym_plan') return await setPlan(data, userId, locale);
    if (name === 'log_food') return await logFood(data, userId);
    if (name === 'log_workout') return await logWorkout(data, userId, locale);
    if (name === 'log_sleep') return await logSleep(data, userId);
    if (name === 'log_measure') return await logMeasure(data, userId);
    return await remove(data, userId);
  } catch (error) {
    console.warn(`[podshar] запись в зал ${name} не прошла:`, error);
    return 'it did not save — say so plainly, and do not pretend it did.';
  }
}
