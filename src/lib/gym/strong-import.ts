import 'server-only';

import { zurichAt } from '@/lib/calendar/events';
import { EXERCISES } from './exercises';
import { column, parseCsv, parseNumber } from './csv';

/**
 * Импорт тренировок из Strong.
 *
 * В приложении: настройки → «экспорт данных Strong» → CSV. Колонки такие
 * (старые версии добавляли «Weight Unit», «Distance Unit», «Workout Duration»):
 *
 *   Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Reps,
 *   Distance, Seconds, Notes, Workout Notes, RPE
 *
 * Строка — подход. Тренировка — все строки с одной датой и названием. «Set
 * Order» — номер подхода, «W» — разминочный, «D» и «F» — дроп и отказ.
 * Время без пояса читается по Цюриху, как всё на сайте; вес — в килограммах,
 * если выгрузка не сказала, что в фунтах.
 *
 * Упражнения Strong называет «Bench Press (Dumbbell)» — основа и снаряд в
 * скобках. Наш справочник собран из того же каталога, но по-английски пишет
 * иначе («dumbbell bench press»), поэтому сначала — словарь частых, потом
 * подбор: снаряд перед основой, основа без снаряда. Что не нашлось, ложится
 * под своим английским именем — подход переживёт незнакомое упражнение, и в
 * рекордах оно будет.
 */

export type ImportedSet = {
  exercise: string;
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  distance: number | null;
  warmup: boolean;
};

export type ImportedWorkout = { startedAt: Date; finishedAt: Date; title: string; sets: ImportedSet[] };

/** Пять лет по четыре тренировки в неделю — это тысяча; больше — не выгрузка Strong. */
export const MAX_WORKOUTS = 3000;

const normal = (name: string) =>
  name
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && /(ch|sh|x)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w))
    .join(' ');

/** Частые названия Strong, которые у нас звучат иначе. Ключ — нормализованное имя целиком, со снарядом. */
const ALIAS: Record<string, string> = {
  'squat barbell': 'squat',
  'bent over row barbell': 'barbell-row',
  'bent over row dumbbell': 'db-row',
  'bent over one arm row dumbbell': 'one-arm-db-row',
  'bicep curl barbell': 'biceps-curl',
  'bicep curl dumbbell': 'db-curl',
  'bicep curl cable': 'cable-curl',
  'bicep curl machine': 'machine-curl',
  'bicep curl band': 'band-hammer-curl',
  'triceps pushdown cable straight bar': 'straight-bar-pushdown',
  'triceps pushdown cable rope': 'triceps-pushdown',
  'triceps pushdown': 'triceps-pushdown',
  'triceps extension cable': 'cable-overhead-extension',
  'triceps extension dumbbell': 'db-overhead-extension',
  'triceps extension barbell': 'barbell-overhead-extension',
  'triceps extension machine': 'machine-triceps-extension',
  'seated row cable': 'cable-row',
  'seated row machine': 'machine-row',
  'seated wide grip row cable': 'wide-cable-row',
  'lat pulldown cable': 'lat-pulldown',
  'lat pulldown machine': 'machine-pulldown',
  'lat pulldown wide grip cable': 'wide-pulldown',
  'lat pulldown underhand cable': 'underhand-pulldown',
  'lat pulldown single arm': 'single-arm-pulldown',
  'overhead press barbell': 'ohp',
  'overhead press dumbbell': 'db-ohp',
  'overhead press smith machine': 'smith-ohp',
  'overhead press cable': 'cable-ohp',
  'shoulder press machine': 'shoulder-press-machine',
  'shoulder press plate loaded': 'shoulder-press-plate',
  'seated overhead press barbell': 'seated-ohp',
  'seated overhead press dumbbell': 'seated-db-press',
  'strict military press barbell': 'strict-press',
  'lateral raise dumbbell': 'lateral-raise',
  'lateral raise cable': 'cable-lateral-raise',
  'lateral raise machine': 'machine-lateral-raise',
  'lateral raise band': 'band-lateral-raise',
  'front raise dumbbell': 'front-raise',
  'front raise barbell': 'barbell-front-raise',
  'front raise cable': 'cable-front-raise',
  'front raise plate': 'plate-front-raise',
  'chest fly dumbbell': 'db-fly',
  'chest fly band': 'band-fly',
  'chest fly machine': 'pec-deck',
  'incline chest fly dumbbell': 'incline-db-fly',
  'chest press machine': 'chest-press-machine',
  'chest press band': 'band-chest-press',
  'iso lateral chest press machine': 'iso-chest-press',
  'incline bench press barbell': 'incline-bench',
  'incline bench press dumbbell': 'incline-db-bench',
  'incline bench press smith machine': 'incline-smith-bench',
  'incline bench press cable': 'incline-cable-bench',
  'decline bench press barbell': 'decline-bench',
  'decline bench press dumbbell': 'decline-db-bench',
  'decline bench press smith machine': 'decline-smith-bench',
  'bench press barbell': 'bench-press',
  'bench press dumbbell': 'db-bench',
  'bench press smith machine': 'smith-bench',
  'bench press cable': 'cable-bench',
  'bench press close grip barbell': 'close-grip-bench',
  'bench press wide grip barbell': 'wide-grip-bench',
  'floor press barbell': 'floor-press',
  'deadlift barbell': 'deadlift',
  'deadlift dumbbell': 'db-deadlift',
  'deadlift smith machine': 'smith-deadlift',
  'deadlift band': 'band-deadlift',
  'deadlift trap bar': 'trap-bar-deadlift',
  'trap bar deadlift': 'trap-bar-deadlift',
  'sumo deadlift barbell': 'sumo-deadlift',
  'romanian deadlift barbell': 'rdl',
  'romanian deadlift dumbbell': 'db-rdl',
  'stiff leg deadlift barbell': 'stiff-leg-deadlift',
  'stiff leg deadlift dumbbell': 'db-stiff-leg-deadlift',
  'rack pull barbell': 'rack-pull',
  'good morning barbell': 'good-morning',
  'hip thrust barbell': 'hip-thrust',
  'hip thrust bodyweight': 'bw-hip-thrust',
  'glute kickback machine': 'glute-kickback-machine',
  'glute kickback cable': 'cable-glute-kickback',
  'leg press': 'leg-press',
  'leg press machine': 'leg-press',
  'leg extension machine': 'leg-extension',
  'lying leg curl machine': 'lying-leg-curl',
  'seated leg curl machine': 'leg-curl',
  'hip abductor machine': 'hip-abductor',
  'hip adductor machine': 'hip-adductor',
  'standing calf raise machine': 'calf-raise',
  'standing calf raise barbell': 'barbell-calf-raise',
  'standing calf raise dumbbell': 'db-calf-raise',
  'standing calf raise bodyweight': 'bw-calf-raise',
  'standing calf raise smith machine': 'smith-calf-raise',
  'seated calf raise machine': 'seated-calf-raise',
  'seated calf raise plate loaded': 'plate-seated-calf-raise',
  'calf press on leg press': 'leg-press-calf',
  'calf press on seated leg press': 'seated-leg-press-calf',
  'front squat barbell': 'front-squat',
  'goblet squat kettlebell': 'goblet-squat',
  'goblet squat dumbbell': 'goblet-squat',
  'hack squat': 'hack-squat',
  'hack squat machine': 'hack-squat',
  'hack squat barbell': 'barbell-hack-squat',
  'squat dumbbell': 'db-squat',
  'squat smith machine': 'smith-squat',
  'squat machine': 'machine-squat',
  'squat bodyweight': 'bw-squat',
  'air squat': 'bw-squat',
  'box squat barbell': 'box-squat',
  'overhead squat barbell': 'overhead-squat',
  'pistol squat': 'pistol-squat',
  'bulgarian split squat': 'bulgarian-split-squat',
  'bulgarian split squat dumbbell': 'bulgarian-split-squat',
  'lunge dumbbell': 'lunge',
  'lunge barbell': 'barbell-lunge',
  'lunge bodyweight': 'bw-lunge',
  'walking lunge dumbbell': 'lunge',
  'walking lunge': 'bw-lunge',
  'step up': 'step-up',
  'step up dumbbell': 'step-up',
  'face pull cable': 'face-pull',
  'shrug barbell': 'barbell-shrug',
  'shrug dumbbell': 'shrug',
  'shrug machine': 'machine-shrug',
  'shrug smith machine': 'smith-shrug',
  'upright row barbell': 'upright-row',
  'upright row dumbbell': 'db-upright-row',
  'upright row cable': 'cable-upright-row',
  'reverse fly dumbbell': 'reverse-fly',
  'reverse fly cable': 'cable-reverse-fly',
  'reverse fly machine': 'reverse-pec-deck',
  'rear delt fly machine': 'reverse-pec-deck',
  'hammer curl dumbbell': 'hammer-curl',
  'hammer curl cable': 'cable-hammer-curl',
  'hammer curl band': 'band-hammer-curl',
  'preacher curl barbell': 'preacher-curl',
  'preacher curl dumbbell': 'db-preacher-curl',
  'preacher curl machine': 'machine-curl',
  'concentration curl dumbbell': 'concentration-curl',
  'reverse curl barbell': 'reverse-curl',
  'reverse curl dumbbell': 'db-reverse-curl',
  'incline curl dumbbell': 'incline-curl',
  'wrist curl dumbbell': 'wrist-curl',
  'wrist curl barbell': 'wrist-curl',
  'skullcrusher barbell': 'skull-crusher',
  'skullcrusher dumbbell': 'db-skull-crusher',
  'skullcrusher ez bar': 'ez-skull-crusher',
  'triceps kickback dumbbell': 'triceps-kickback',
  'triceps kickback cable': 'cable-triceps-kickback',
  'triceps dip': 'triceps-dip',
  'triceps dip assisted': 'assisted-triceps-dip',
  'bench dip': 'bench-dip',
  'chest dip': 'dips',
  'chest dip assisted': 'assisted-dips',
  'dip': 'dips',
  'pull up': 'pull-up',
  'pull up assisted': 'assisted-pull-up',
  'pull up weighted': 'pull-up',
  'pull up band': 'band-pull-up',
  'wide pull up': 'wide-pull-up',
  'kipping pull up': 'kipping-pull-up',
  'chin up': 'chin-up',
  'chin up assisted': 'assisted-chin-up',
  'chin up weighted': 'chin-up',
  'muscle up': 'muscle-up',
  'push up': 'push-up',
  'push up knee': 'knee-push-up',
  'handstand push up': 'handstand-push-up',
  'inverted row': 'inverted-row',
  'inverted row bodyweight': 'inverted-row',
  't bar row': 't-bar-row',
  'pendlay row barbell': 'pendlay-row',
  'iso lateral row machine': 'iso-row',
  'pullover dumbbell': 'db-pullover',
  'pullover machine': 'machine-pullover',
  'around the world': 'around-the-world',
  'arnold press dumbbell': 'arnold-press',
  'push press barbell': 'push-press',
  'plank': 'plank',
  'side plank': 'side-plank',
  'crunch': 'crunch',
  'crunch machine': 'machine-crunch',
  'cable crunch': 'cable-crunch',
  'crunch cable': 'cable-crunch',
  'sit up': 'sit-up',
  'v up': 'v-up',
  'russian twist': 'russian-twist',
  'ab wheel': 'ab-wheel',
  'hanging leg raise': 'hanging-leg-raise',
  'hanging knee raise': 'hanging-knee-raise',
  'lying leg raise': 'lying-leg-raise',
  'toes to bar': 'toes-to-bar',
  'knees to elbow': 'knees-to-elbows',
  'mountain climber': 'mountain-climbers',
  'back extension': 'back-extension',
  'back extension machine': 'machine-back-extension',
  'clean barbell': 'clean',
  'power clean': 'power-clean',
  'hang clean barbell': 'hang-clean',
  'clean and jerk barbell': 'clean-and-jerk',
  'snatch barbell': 'snatch',
  'power snatch barbell': 'power-snatch',
  'thruster barbell': 'thruster',
  'running': 'running',
  'running treadmill': 'treadmill',
  'walking': 'walking',
  'hiking': 'hiking',
  'cycling': 'cycling',
  'cycling indoor': 'indoor-cycling',
  'elliptical trainer': 'elliptical',
  'rowing machine': 'rowing-machine',
  'swimming': 'swimming',
  'jump rope': 'jump-rope',
  'battle rope': 'battle-ropes',
  'stretching': 'stretching',
  'yoga': 'yoga'
};

/** Словарь в том же виде, что и входящее имя: «triceps» и «tricep» — одно и то же. */
const ALIASES = new Map(Object.entries(ALIAS).map(([key, id]) => [normal(key), id]));

/** Наш справочник по нормализованному английскому имени. */
const BY_NAME = new Map(EXERCISES.map((e) => [normal(e.name.en), e.id]));

/** Слово снаряда в нашем английском имени — так и пишем его впереди основы. */
const EQUIP_WORD: Record<string, string> = {
  dumbbell: 'dumbbell',
  cable: 'cable',
  machine: 'machine',
  'smith machine': 'smith machine',
  band: 'band',
  kettlebell: 'kettlebell',
  plate: 'plate',
  'plate loaded': 'plate loaded',
  assisted: 'assisted',
  bodyweight: 'bodyweight',
  'ez bar': 'ez bar'
};

/** Название Strong → id нашего справочника; не нашлось — само название. */
export function strongExercise(name: string): string {
  const full = normal(name);
  if (ALIASES.has(full)) return ALIASES.get(full)!;
  if (BY_NAME.has(full)) return BY_NAME.get(full)!;
  const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const base = normal(m ? m[1] : name).replace(/ (wide|close|underhand|single arm) grip$/, '');
  const equip = m ? normal(m[2].split(/\s+-\s+/)[0]) : '';
  const word = EQUIP_WORD[equip];
  const candidates = [word ? `${word} ${base}` : null, base, word ? `${base} ${word}` : null, equip === 'barbell' ? `barbell ${base}` : null].filter(Boolean) as string[];
  for (const c of candidates) {
    if (ALIASES.has(c)) return ALIASES.get(c)!;
    const id = BY_NAME.get(c);
    if (id) return id;
  }
  return name.trim().slice(0, 60);
}

/** «1h 5m», «45m», «1:05:00», «3600» → секунды. */
function durationOf(raw: string | undefined): number | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  const hms = v.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hms) return hms[3] ? +hms[1] * 3600 + +hms[2] * 60 + +hms[3] : +hms[1] * 60 + +hms[2];
  if (/^\d+$/.test(v)) return +v;
  const h = v.match(/(\d+)\s*h/);
  const m = v.match(/(\d+)\s*m(?!s)/);
  const s = v.match(/(\d+)\s*s/);
  if (!h && !m && !s) return null;
  return (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (s ? +s[1] : 0);
}

/** «2026-10-30 18:05:12» по Цюриху; ISO с поясом — как есть. */
function momentOf(raw: string | undefined): Date | null {
  if (!raw) return null;
  const v = raw.trim();
  const local = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (local) {
    const [, y, mo, d, h, mi, sec] = local;
    const at = zurichAt(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`, `${h.padStart(2, '0')}:${mi}`);
    return new Date(at.getTime() + (sec ? +sec * 1000 : 0));
  }
  const at = new Date(v);
  return Number.isNaN(at.getTime()) ? null : at;
}

const LB = 0.45359237;

/** Таблица Strong → тренировки. `format: false` — это не выгрузка Strong. */
export function parseStrongCsv(text: string): { workouts: ImportedWorkout[]; unknown: string[]; format: boolean } {
  const rows = parseCsv(text);
  const header = (rows[0] ?? []).map((h) => h.toLowerCase());
  const col = {
    date: column(header, [/^date$/, /date/]),
    title: column(header, [/workout name/]),
    duration: column(header, [/^duration$/, /workout duration/, /duration/]),
    exercise: column(header, [/exercise name/, /^exercise$/]),
    order: column(header, [/set order/, /^set$/]),
    weight: column(header, [/^weight$/, /weight/], /unit/),
    unit: column(header, [/weight unit/]),
    reps: column(header, [/^reps$/, /reps/]),
    distance: column(header, [/^distance$/, /distance/], /unit/),
    distanceUnit: column(header, [/distance unit/]),
    seconds: column(header, [/^seconds$/, /seconds/])
  };
  if (col.date < 0 || col.exercise < 0 || (col.weight < 0 && col.reps < 0 && col.seconds < 0)) return { workouts: [], unknown: [], format: false };

  const byKey = new Map<string, { startedAt: Date; title: string; duration: number | null; sets: ImportedSet[]; order: Map<string, number> }>();
  const unknown = new Set<string>();
  for (const row of rows.slice(1)) {
    const startedAt = momentOf(row[col.date]);
    const name = row[col.exercise]?.trim();
    if (!startedAt || !name) continue;
    const title = (col.title >= 0 ? row[col.title] : '')?.trim().slice(0, 60) ?? '';
    const key = `${startedAt.getTime()}|${title}`;
    let workout = byKey.get(key);
    if (!workout) {
      if (byKey.size >= MAX_WORKOUTS) break;
      workout = { startedAt, title, duration: durationOf(row[col.duration]), sets: [], order: new Map() };
      byKey.set(key, workout);
    }
    const lbs = col.unit >= 0 && /lb/i.test(row[col.unit] ?? '');
    const weightRaw = parseNumber(row[col.weight]);
    const distanceRaw = parseNumber(row[col.distance]);
    const distanceUnit = (row[col.distanceUnit] ?? '').toLowerCase();
    const set: ImportedSet = {
      exercise: strongExercise(name),
      weight: weightRaw === null || weightRaw === 0 ? null : Math.round((lbs ? weightRaw * LB : weightRaw) * 100) / 100,
      reps: (() => {
        const r = parseNumber(row[col.reps]);
        return r === null || r <= 0 ? null : Math.round(r);
      })(),
      seconds: (() => {
        const s = parseNumber(row[col.seconds]);
        return s === null || s <= 0 ? null : Math.round(s);
      })(),
      distance:
        distanceRaw === null || distanceRaw <= 0
          ? null
          : Math.round((distanceUnit.startsWith('mi') ? distanceRaw * 1.609344 : distanceUnit === 'm' ? distanceRaw / 1000 : distanceRaw) * 1000) / 1000,
      warmup: /^w/i.test(row[col.order] ?? '')
    };
    // Пустая строка Strong — таймер отдыха или заметка, а не подход.
    if (set.weight === null && set.reps === null && set.seconds === null && set.distance === null) continue;
    if (set.exercise === name.trim().slice(0, 60)) unknown.add(set.exercise);
    workout.sets.push(set);
  }

  const workouts = [...byKey.values()]
    .filter((w) => w.sets.length > 0)
    .map((w) => {
      // Нет длительности — по три минуты на подход: конец тренировки нужен истории и рекордам.
      const seconds = w.duration && w.duration > 0 ? w.duration : Math.max(20 * 60, w.sets.length * 180);
      return { startedAt: w.startedAt, finishedAt: new Date(w.startedAt.getTime() + seconds * 1000), title: w.title, sets: w.sets };
    });
  return { workouts, unknown: [...unknown], format: true };
}
