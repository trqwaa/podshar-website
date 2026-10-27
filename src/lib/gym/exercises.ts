import type { Locale } from '@/i18n/routing';

/**
 * Справочник упражнений зала — в коде, как справочник героев доты.
 *
 * В базе у подхода лежит только `id` отсюда. Названия на четырёх языках живут
 * здесь, а не в каталогах: каталоги обязаны совпадать ключами, а справочник
 * растёт неравномерно, и тащить его в браузер целиком ради одного названия
 * незачем — страница передаёт уже выбранное.
 *
 * `motion` — какое движение показывает мопс (`components/gym/PugRig.tsx`).
 * Движений меньше, чем упражнений: жим гантелей лёжа и жим штанги лёжа —
 * одно движение с разным снарядом. Новое упражнение с уже готовым движением —
 * одна строка здесь; новое движение — ещё и поза в `PugRig`.
 */

export type Words = Record<Locale, string>;

export type Motion =
  | 'bench'
  | 'incline'
  | 'pushup'
  | 'dip'
  | 'ohp'
  | 'raise'
  | 'squat'
  | 'frontSquat'
  | 'legPress'
  | 'lunge'
  | 'legExt'
  | 'legCurl'
  | 'deadlift'
  | 'rdl'
  | 'hipThrust'
  | 'calf'
  | 'row'
  | 'cableRow'
  | 'pullup'
  | 'pulldown'
  | 'shrug'
  | 'curl'
  | 'pushdown'
  | 'skull'
  | 'plank'
  | 'crunch'
  | 'hangRaise';

export type Gear = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'body';

export const MUSCLES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core'] as const;
export type Muscle = (typeof MUSCLES)[number];

export type Exercise = {
  id: string;
  motion: Motion;
  gear: Gear;
  muscle: Muscle;
  name: Words;
};

const ex = (id: string, motion: Motion, gear: Gear, muscle: Muscle, ru: string, en: string, uk: string, de: string): Exercise => ({
  id,
  motion,
  gear,
  muscle,
  name: { ru, en, uk, de }
});

export const EXERCISES: Exercise[] = [
  ex('bench-press', 'bench', 'barbell', 'chest', 'жим штанги лёжа', 'bench press', 'жим штанги лежачи', 'bankdrücken'),
  ex('incline-bench', 'incline', 'barbell', 'chest', 'жим на наклонной', 'incline bench press', 'жим на похилій лаві', 'schrägbankdrücken'),
  ex('db-bench', 'bench', 'dumbbell', 'chest', 'жим гантелей лёжа', 'dumbbell bench press', 'жим гантелей лежачи', 'kurzhantel-bankdrücken'),
  ex('push-up', 'pushup', 'body', 'chest', 'отжимания', 'push-ups', 'віджимання', 'liegestütze'),
  ex('dips', 'dip', 'body', 'chest', 'отжимания на брусьях', 'dips', 'віджимання на брусах', 'dips'),
  ex('ohp', 'ohp', 'barbell', 'shoulders', 'жим стоя', 'overhead press', 'жим стоячи', 'schulterdrücken'),
  ex('db-ohp', 'ohp', 'dumbbell', 'shoulders', 'жим гантелей над головой', 'dumbbell shoulder press', 'жим гантелей над головою', 'kurzhantel-schulterdrücken'),
  ex('lateral-raise', 'raise', 'dumbbell', 'shoulders', 'махи гантелями', 'lateral raises', 'махи гантелями', 'seitheben'),
  ex('squat', 'squat', 'barbell', 'legs', 'присед со штангой', 'back squat', 'присідання зі штангою', 'kniebeuge'),
  ex('front-squat', 'frontSquat', 'barbell', 'legs', 'фронтальный присед', 'front squat', 'фронтальні присідання', 'frontkniebeuge'),
  ex('leg-press', 'legPress', 'machine', 'legs', 'жим ногами', 'leg press', 'жим ногами', 'beinpresse'),
  ex('lunge', 'lunge', 'dumbbell', 'legs', 'выпады с гантелями', 'dumbbell lunges', 'випади з гантелями', 'ausfallschritte'),
  ex('leg-extension', 'legExt', 'machine', 'legs', 'разгибание ног', 'leg extension', 'розгинання ніг', 'beinstrecker'),
  ex('leg-curl', 'legCurl', 'machine', 'glutes', 'сгибание ног', 'leg curl', 'згинання ніг', 'beinbeuger'),
  ex('deadlift', 'deadlift', 'barbell', 'back', 'становая тяга', 'deadlift', 'станова тяга', 'kreuzheben'),
  ex('rdl', 'rdl', 'barbell', 'glutes', 'румынская тяга', 'romanian deadlift', 'румунська тяга', 'rumänisches kreuzheben'),
  ex('hip-thrust', 'hipThrust', 'barbell', 'glutes', 'ягодичный мост', 'hip thrust', 'сідничний міст', 'hip thrust'),
  ex('calf-raise', 'calf', 'machine', 'legs', 'подъёмы на носки', 'calf raises', 'підйоми на носки', 'wadenheben'),
  ex('barbell-row', 'row', 'barbell', 'back', 'тяга штанги к поясу', 'barbell row', 'тяга штанги до пояса', 'langhantelrudern'),
  ex('db-row', 'row', 'dumbbell', 'back', 'тяга гантелей в наклоне', 'dumbbell row', 'тяга гантелей у нахилі', 'kurzhantelrudern'),
  ex('cable-row', 'cableRow', 'cable', 'back', 'горизонтальная тяга', 'seated cable row', 'горизонтальна тяга', 'rudern am kabel'),
  ex('pull-up', 'pullup', 'body', 'back', 'подтягивания', 'pull-ups', 'підтягування', 'klimmzüge'),
  ex('lat-pulldown', 'pulldown', 'cable', 'back', 'тяга верхнего блока', 'lat pulldown', 'тяга верхнього блока', 'latzug'),
  ex('shrug', 'shrug', 'dumbbell', 'back', 'шраги', 'shrugs', 'шраги', 'shrugs'),
  ex('biceps-curl', 'curl', 'barbell', 'arms', 'подъём штанги на бицепс', 'barbell curl', 'підйом штанги на біцепс', 'langhantel-curls'),
  ex('hammer-curl', 'curl', 'dumbbell', 'arms', 'молотки', 'hammer curls', 'молотки', 'hammer-curls'),
  ex('triceps-pushdown', 'pushdown', 'cable', 'arms', 'разгибание на блоке', 'triceps pushdown', 'розгинання на блоці', 'trizepsdrücken am kabel'),
  ex('skull-crusher', 'skull', 'barbell', 'arms', 'французский жим', 'skull crushers', 'французький жим', 'french press'),
  ex('plank', 'plank', 'body', 'core', 'планка', 'plank', 'планка', 'unterarmstütz'),
  ex('crunch', 'crunch', 'body', 'core', 'скручивания', 'crunches', 'скручування', 'crunches'),
  ex('hanging-leg-raise', 'hangRaise', 'body', 'core', 'подъём ног в висе', 'hanging leg raises', 'підйом ніг у висі', 'hängendes beinheben')
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export const exerciseOf = (id: string): Exercise | undefined => BY_ID.get(id);
export const isExercise = (id: string) => BY_ID.has(id);

/** Название на языке страницы. Неизвестный id — как есть: подход переживёт выбывшее упражнение. */
export const exerciseName = (id: string, locale: Locale) => BY_ID.get(id)?.name[locale] ?? id;

/**
 * Упражнение дня в подвале — одно из трёх, как просил владелец: жмёт 200,
 * тянет 100 к поясу или приседает. Остальное сводится к ближайшему по смыслу:
 * всё, что толкает, — жим, всё, что тянет, — тяга, ноги и таз — присед.
 */
export type Showcase = 'bench' | 'row' | 'squat';

const SHOWCASE_OF: Record<Motion, Showcase | null> = {
  bench: 'bench',
  incline: 'bench',
  pushup: 'bench',
  dip: 'bench',
  ohp: 'bench',
  raise: 'bench',
  pushdown: 'bench',
  skull: 'bench',
  row: 'row',
  cableRow: 'row',
  pullup: 'row',
  pulldown: 'row',
  shrug: 'row',
  curl: 'row',
  deadlift: 'row',
  squat: 'squat',
  frontSquat: 'squat',
  legPress: 'squat',
  lunge: 'squat',
  legExt: 'squat',
  legCurl: 'squat',
  rdl: 'squat',
  hipThrust: 'squat',
  calf: 'squat',
  plank: null,
  crunch: null,
  hangRaise: null
};

export const SHOWCASES: Showcase[] = ['bench', 'row', 'squat'];

/**
 * Что показывать по списку упражнений дня: чего в нём больше. Пресс голосом не
 * считается — день «пресс и кардио» выбирается по номеру дня, одинаково у троих.
 */
export function showcaseFor(exerciseIds: string[], dayIndex: number): Showcase {
  const votes: Record<Showcase, number> = { bench: 0, row: 0, squat: 0 };
  let first: Showcase | null = null;
  for (const id of exerciseIds) {
    const motion = BY_ID.get(id)?.motion;
    const kind = motion ? SHOWCASE_OF[motion] : null;
    if (!kind) continue;
    votes[kind] += 1;
    first ??= kind;
  }
  const best = Math.max(votes.bench, votes.row, votes.squat);
  if (best === 0) return SHOWCASES[((dayIndex % 3) + 3) % 3];
  return first && votes[first] === best ? first : SHOWCASES.find((s) => votes[s] === best) ?? 'bench';
}

/**
 * Техника, которую мопс проговаривает, показывая движение. Две строки на
 * движение — больше под анимацией не читают. Словами тренера, а не учебника.
 */
export const CUES: Record<Motion, Record<Locale, [string, string]>> = {
  bench: {
    ru: ['лопатки сведены и прижаты, ноги в пол', 'гриф опускай на низ груди, локти под 45°'],
    en: ['shoulder blades pinched and down, feet planted', 'bar to the lower chest, elbows at about 45°'],
    uk: ['лопатки зведені й притиснуті, ноги в підлогу', 'гриф опускай на низ грудей, лікті під 45°'],
    de: ['schulterblätter zusammen und unten, füße fest am boden', 'stange zur unteren brust, ellbogen etwa 45°']
  },
  incline: {
    ru: ['наклон скамьи 30°, не больше', 'гриф к верху груди, под ключицы'],
    en: ['bench at 30°, no steeper', 'bar to the upper chest, just under the collarbones'],
    uk: ['нахил лави 30°, не більше', 'гриф до верху грудей, під ключиці'],
    de: ['bank auf 30°, nicht steiler', 'stange zur oberen brust, knapp unter die schlüsselbeine']
  },
  pushup: {
    ru: ['тело — одна доска от пяток до макушки', 'грудь до пола, локти не в стороны'],
    en: ['one straight plank from heels to head', 'chest to the floor, elbows not flared'],
    uk: ['тіло — одна дошка від п’ят до маківки', 'груди до підлоги, лікті не в сторони'],
    de: ['ein brett von den fersen bis zum kopf', 'brust zum boden, ellbogen nicht ausstellen']
  },
  dip: {
    ru: ['опускайся, пока плечо не станет параллельно полу', 'плечи вниз, от ушей подальше'],
    en: ['go down until the upper arm is parallel to the floor', 'shoulders down, away from the ears'],
    uk: ['опускайся, поки плече не стане паралельно підлозі', 'плечі вниз, подалі від вух'],
    de: ['runter, bis der oberarm parallel zum boden ist', 'schultern runter, weg von den ohren']
  },
  ohp: {
    ru: ['ягодицы и пресс напряжены, поясница не прогибается', 'гриф идёт по прямой, голова уходит назад и возвращается'],
    en: ['glutes and abs tight, no arching the lower back', 'bar travels straight; move the head back, then through'],
    uk: ['сідниці й прес напружені, поперек не прогинається', 'гриф іде по прямій, голова відходить назад і повертається'],
    de: ['po und bauch fest, kein hohlkreuz', 'stange gerade hoch, kopf kurz zurück und wieder durch']
  },
  raise: {
    ru: ['локти чуть согнуты, ведёт локоть, а не кисть', 'до уровня плеч и без раскачки'],
    en: ['elbows soft, lead with the elbow, not the hand', 'up to shoulder height, no swinging'],
    uk: ['лікті трохи зігнуті, веде лікоть, а не кисть', 'до рівня плечей і без розгойдування'],
    de: ['ellbogen leicht gebeugt, der ellbogen führt', 'bis schulterhöhe, ohne schwung']
  },
  squat: {
    ru: ['колени идут по носкам, пятки не отрываются', 'садись до параллели и ниже, спина ровная'],
    en: ['knees track over the toes, heels stay down', 'sit to parallel or below with a neutral back'],
    uk: ['коліна йдуть по шкарпетках, п’яти не відриваються', 'сідай до паралелі й нижче, спина рівна'],
    de: ['knie über den zehen, fersen bleiben unten', 'bis zur parallele oder tiefer, rücken neutral']
  },
  frontSquat: {
    ru: ['локти высоко, гриф лежит на плечах', 'корпус вертикальнее, чем в обычном приседе'],
    en: ['elbows high, the bar rests on the shoulders', 'torso more upright than in a back squat'],
    uk: ['лікті високо, гриф лежить на плечах', 'корпус вертикальніший, ніж у звичайному присіданні'],
    de: ['ellbogen hoch, die stange liegt auf den schultern', 'oberkörper aufrechter als bei der kniebeuge']
  },
  legPress: {
    ru: ['поясница прижата к спинке всю амплитуду', 'колени не выпрямляй до щелчка'],
    en: ['lower back stays on the pad the whole way', 'do not snap the knees straight at the top'],
    uk: ['поперек притиснутий до спинки всю амплітуду', 'коліна не випрямляй до клацання'],
    de: ['unterer rücken bleibt am polster', 'knie oben nicht durchdrücken']
  },
  lunge: {
    ru: ['шаг широкий, заднее колено почти касается пола', 'корпус прямо, переднее колено над стопой'],
    en: ['long step, back knee nearly touches the floor', 'torso upright, front knee over the foot'],
    uk: ['крок широкий, заднє коліно майже торкається підлоги', 'корпус прямо, переднє коліно над стопою'],
    de: ['langer schritt, hinteres knie fast am boden', 'oberkörper aufrecht, vorderes knie über dem fuß']
  },
  legExt: {
    ru: ['наверху задержись на секунду', 'опускай медленно, без броска'],
    en: ['pause for a second at the top', 'lower slowly, do not drop it'],
    uk: ['нагорі затримайся на секунду', 'опускай повільно, без кидка'],
    de: ['oben eine sekunde halten', 'langsam absenken, nicht fallen lassen']
  },
  legCurl: {
    ru: ['таз прижат, не помогай поясницей', 'вниз медленнее, чем вверх'],
    en: ['hips pinned, the lower back does not help', 'lower slower than you lift'],
    uk: ['таз притиснутий, не допомагай попереком', 'вниз повільніше, ніж угору'],
    de: ['hüfte fixiert, der rücken hilft nicht', 'langsamer runter als hoch']
  },
  deadlift: {
    ru: ['гриф над серединой стопы и скользит по ногам', 'спина ровная, тянешь ногами, а не поясницей'],
    en: ['bar over mid-foot, dragging along the legs', 'flat back; push with the legs, not the lower back'],
    uk: ['гриф над серединою стопи й ковзає по ногах', 'спина рівна, тягнеш ногами, а не попереком'],
    de: ['stange über der fußmitte, nah am bein', 'rücken gerade, aus den beinen drücken']
  },
  rdl: {
    ru: ['колени почти прямые, таз уходит назад', 'опускай до растяжения бицепса бедра, спина ровная'],
    en: ['knees soft, push the hips back', 'lower until the hamstrings stretch, back flat'],
    uk: ['коліна майже прямі, таз іде назад', 'опускай до розтягнення біцепса стегна, спина рівна'],
    de: ['knie leicht gebeugt, hüfte nach hinten', 'runter bis zur dehnung hinten, rücken gerade']
  },
  hipThrust: {
    ru: ['подбородок к груди, рёбра вниз', 'наверху сожми ягодицы, не прогибай поясницу'],
    en: ['chin tucked, ribs down', 'squeeze the glutes at the top, no lower-back arch'],
    uk: ['підборіддя до грудей, ребра вниз', 'нагорі стисни сідниці, не прогинай поперек'],
    de: ['kinn zur brust, rippen unten', 'oben den po anspannen, kein hohlkreuz']
  },
  calf: {
    ru: ['внизу полное растяжение, пауза', 'наверху на самые носки, без пружинки'],
    en: ['full stretch at the bottom, pause', 'all the way onto the toes, no bouncing'],
    uk: ['внизу повне розтягнення, пауза', 'нагорі на самі носки, без пружинки'],
    de: ['unten volle dehnung, pause', 'oben ganz auf die zehen, nicht federn']
  },
  row: {
    ru: ['корпус почти параллельно полу, спина ровная', 'тяни локтями к поясу, лопатки сводятся'],
    en: ['torso close to parallel, back flat', 'drive the elbows to the hips, squeeze the shoulder blades'],
    uk: ['корпус майже паралельно підлозі, спина рівна', 'тягни ліктями до пояса, лопатки зводяться'],
    de: ['oberkörper fast parallel, rücken gerade', 'ellbogen zur hüfte ziehen, schulterblätter zusammen']
  },
  cableRow: {
    ru: ['грудь вперёд, корпус не раскачивается', 'рукоять к животу, локти вдоль тела'],
    en: ['chest up, no rocking the torso', 'handle to the stomach, elbows close to the body'],
    uk: ['груди вперед, корпус не розгойдується', 'руків’я до живота, лікті вздовж тіла'],
    de: ['brust raus, oberkörper ruhig', 'griff zum bauch, ellbogen am körper']
  },
  pullup: {
    ru: ['начинай с лопаток, потом руки', 'подбородок над перекладиной, вниз до прямых рук'],
    en: ['start with the shoulder blades, then the arms', 'chin over the bar, down to straight arms'],
    uk: ['починай з лопаток, потім руки', 'підборіддя над поперечиною, вниз до прямих рук'],
    de: ['erst die schulterblätter, dann die arme', 'kinn über die stange, runter bis die arme gestreckt sind']
  },
  pulldown: {
    ru: ['гриф к верху груди, не за голову', 'корпус чуть назад и неподвижен'],
    en: ['bar to the upper chest, never behind the neck', 'lean back slightly and stay still'],
    uk: ['гриф до верху грудей, не за голову', 'корпус трохи назад і нерухомий'],
    de: ['stange zur oberen brust, nie in den nacken', 'leicht zurücklehnen und ruhig bleiben']
  },
  shrug: {
    ru: ['плечи строго вверх к ушам, без вращения', 'наверху пауза, вниз медленно'],
    en: ['shoulders straight up to the ears, no rolling', 'pause at the top, lower slowly'],
    uk: ['плечі строго вгору до вух, без обертання', 'нагорі пауза, вниз повільно'],
    de: ['schultern gerade zu den ohren, nicht kreisen', 'oben halten, langsam runter']
  },
  curl: {
    ru: ['локти прижаты и стоят на месте', 'без раскачки корпусом, вниз под контролем'],
    en: ['elbows pinned and still', 'no body swing, control the way down'],
    uk: ['лікті притиснуті й стоять на місці', 'без розгойдування корпусом, вниз під контролем'],
    de: ['ellbogen fest am körper', 'kein schwung, kontrolliert ablassen']
  },
  pushdown: {
    ru: ['локти прижаты к бокам', 'внизу дожимай до прямых рук'],
    en: ['elbows locked to the sides', 'finish with straight arms at the bottom'],
    uk: ['лікті притиснуті до боків', 'внизу дотискай до прямих рук'],
    de: ['ellbogen an den seiten', 'unten bis die arme gestreckt sind']
  },
  skull: {
    ru: ['плечо неподвижно, двигается только предплечье', 'гриф ко лбу медленно — название не просто так'],
    en: ['upper arm still, only the forearm moves', 'lower slowly to the forehead — the name is a warning'],
    uk: ['плече нерухоме, рухається тільки передпліччя', 'гриф до лоба повільно — назва не просто так'],
    de: ['oberarm ruhig, nur der unterarm bewegt sich', 'langsam zur stirn — der name ist eine warnung']
  },
  plank: {
    ru: ['ягодицы и пресс напряжены, таз не провисает', 'дыши, а не задерживай дыхание'],
    en: ['glutes and abs tight, hips do not sag', 'breathe, do not hold your breath'],
    uk: ['сідниці й прес напружені, таз не провисає', 'дихай, а не затримуй дихання'],
    de: ['po und bauch fest, hüfte hängt nicht durch', 'atmen, nicht die luft anhalten']
  },
  crunch: {
    ru: ['скручивайся, а не тяни шею руками', 'поясница остаётся на полу'],
    en: ['curl up, do not pull on the neck', 'lower back stays on the floor'],
    uk: ['скручуйся, а не тягни шию руками', 'поперек лишається на підлозі'],
    de: ['einrollen, nicht am nacken ziehen', 'unterer rücken bleibt am boden']
  },
  hangRaise: {
    ru: ['не раскачивайся, поднимай ноги прессом', 'вниз медленно, без маятника'],
    en: ['no swinging, lift with the abs', 'lower slowly, no pendulum'],
    uk: ['не розгойдуйся, піднімай ноги пресом', 'вниз повільно, без маятника'],
    de: ['kein schwung, mit dem bauch heben', 'langsam runter, kein pendeln']
  }
};

/** Оценка максимума на один раз по Эпли. Для сравнения подходов, не для заявок. */
export const oneRepMax = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));
