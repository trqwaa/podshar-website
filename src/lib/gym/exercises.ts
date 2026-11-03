import type { Locale } from '@/i18n/routing';

/**
 * Справочник упражнений зала — в коде, как справочник героев доты.
 *
 * Список — весь встроенный каталог Strong, как просил владелец, со своими
 * названиями на четырёх языках. В базе у подхода лежит только `id` отсюда.
 * Названия живут здесь, а не в каталогах: каталоги обязаны совпадать ключами,
 * а справочник растёт неравномерно, и тащить его в браузер целиком ради
 * одного названия незачем — страница передаёт уже выбранное.
 *
 * `motion` — какое движение показывает мопс (`components/gym/pug-motions.ts`).
 * Движений меньше, чем упражнений: жим гантелей лёжа и жим штанги лёжа —
 * одно движение с разным снарядом. Новое упражнение с уже готовым движением —
 * одна строка здесь; новое движение — ещё и поза в `pug-motions.ts`.
 *
 * `kind` — что пишется в подходе, как категории Strong: вес и повторы, свой
 * вес (с отягощением или без), гравитрон (вычитаемый вес), время, кардио
 * (дистанция и время). `grip` — хват, его видно мопсу спереди.
 */

export type Words = Record<Locale, string>;

export type Motion =
  // грудь
  | 'bench'
  | 'incline'
  | 'decline'
  | 'floorPress'
  | 'fly'
  | 'inclineFly'
  | 'cableFly'
  | 'pecDeck'
  | 'chestPress'
  | 'pullover'
  | 'pushup'
  | 'kneePushup'
  | 'dip'
  | 'benchDip'
  // плечи
  | 'ohp'
  | 'seatedPress'
  | 'pushPress'
  | 'raise'
  | 'frontRaise'
  | 'reverseFly'
  | 'facePull'
  | 'uprightRow'
  | 'hspu'
  | 'shrug'
  // ноги
  | 'squat'
  | 'frontSquat'
  | 'goblet'
  | 'ohSquat'
  | 'bwSquat'
  | 'hackSquat'
  | 'pistol'
  | 'jumpSquat'
  | 'lunge'
  | 'bulgarian'
  | 'stepUp'
  | 'legPress'
  | 'legExt'
  | 'legCurl'
  | 'lyingLegCurl'
  | 'calf'
  | 'calfPress'
  | 'seatedCalf'
  | 'abduction'
  | 'adduction'
  // тяги и таз
  | 'deadlift'
  | 'sumo'
  | 'rackPull'
  | 'rdl'
  | 'goodMorning'
  | 'hipThrust'
  | 'bridge'
  | 'kickbackLeg'
  | 'backExt'
  | 'superman'
  // спина
  | 'row'
  | 'cableRow'
  | 'invertedRow'
  | 'pullup'
  | 'muscleUp'
  | 'pulldown'
  // руки
  | 'curl'
  | 'concentration'
  | 'preacher'
  | 'wristCurl'
  | 'pushdown'
  | 'overheadExt'
  | 'kickback'
  | 'skull'
  // пресс
  | 'plank'
  | 'sidePlank'
  | 'reversePlank'
  | 'crunch'
  | 'situp'
  | 'vUp'
  | 'legRaise'
  | 'reverseCrunch'
  | 'bicycle'
  | 'hangRaise'
  | 'hangKnee'
  | 'cableCrunch'
  | 'russianTwist'
  | 'twist'
  | 'sideBend'
  | 'abWheel'
  | 'climber'
  // всё тело
  | 'clean'
  | 'snatch'
  | 'thruster'
  | 'kbSwing'
  | 'getUp'
  | 'burpee'
  | 'boxJump'
  | 'jumpRope'
  | 'jumpingJack'
  | 'highKnees'
  | 'slam'
  | 'ropes'
  // кардио
  | 'run'
  | 'treadmill'
  | 'walk'
  | 'elliptical'
  | 'cycle'
  | 'rowErg'
  | 'swim'
  | 'skate'
  | 'yoga';

export type Gear = 'barbell' | 'dumbbell' | 'kettlebell' | 'cable' | 'machine' | 'smith' | 'band' | 'plate' | 'body' | 'cardio' | 'other';

/**
 * `weight` — кг × повторы; `body` — повторы и необязательный довес;
 * `assisted` — повторы и сколько кг помогает гравитрон; `time` — секунды;
 * `cardio` — километры и время.
 */
export type Kind = 'weight' | 'body' | 'assisted' | 'time' | 'cardio';
export type Grip = 'close' | 'wide';

export const MUSCLES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core', 'full', 'cardio'] as const;
export type Muscle = (typeof MUSCLES)[number];

export type Exercise = {
  id: string;
  motion: Motion;
  gear: Gear;
  muscle: Muscle;
  kind: Kind;
  grip?: Grip;
  name: Words;
};

const kindFor = (gear: Gear): Kind => (gear === 'body' ? 'body' : gear === 'cardio' ? 'cardio' : 'weight');

const ex = (
  id: string,
  motion: Motion,
  gear: Gear,
  muscle: Muscle,
  ru: string,
  en: string,
  uk: string,
  de: string,
  extra: { kind?: Kind; grip?: Grip } = {}
): Exercise => ({ id, motion, gear, muscle, kind: extra.kind ?? kindFor(gear), grip: extra.grip, name: { ru, en, uk, de } });

export const EXERCISES: Exercise[] = [
  // Грудь
  ex('bench-press', 'bench', 'barbell', 'chest', 'жим штанги лёжа', 'bench press', 'жим штанги лежачи', 'bankdrücken'),
  ex('db-bench', 'bench', 'dumbbell', 'chest', 'жим гантелей лёжа', 'dumbbell bench press', 'жим гантелей лежачи', 'kurzhantel-bankdrücken'),
  ex('smith-bench', 'bench', 'smith', 'chest', 'жим лёжа в смите', 'smith machine bench press', 'жим лежачи в тренажері сміта', 'bankdrücken an der multipresse'),
  ex('cable-bench', 'bench', 'cable', 'chest', 'жим лёжа на блоках', 'cable bench press', 'жим лежачи на блоках', 'bankdrücken am kabelzug'),
  ex('close-grip-bench', 'bench', 'barbell', 'arms', 'жим узким хватом', 'close-grip bench press', 'жим вузьким хватом', 'enges bankdrücken', { grip: 'close' }),
  ex('wide-grip-bench', 'bench', 'barbell', 'chest', 'жим широким хватом', 'wide-grip bench press', 'жим широким хватом', 'breites bankdrücken', { grip: 'wide' }),
  ex('incline-bench', 'incline', 'barbell', 'chest', 'жим на наклонной', 'incline bench press', 'жим на похилій лаві', 'schrägbankdrücken'),
  ex('incline-db-bench', 'incline', 'dumbbell', 'chest', 'жим гантелей на наклонной', 'incline dumbbell press', 'жим гантелей на похилій лаві', 'kurzhantel-schrägbankdrücken'),
  ex('incline-smith-bench', 'incline', 'smith', 'chest', 'жим на наклонной в смите', 'incline smith machine press', 'жим на похилій лаві в тренажері сміта', 'schrägbankdrücken an der multipresse'),
  ex('incline-cable-bench', 'incline', 'cable', 'chest', 'жим на наклонной на блоках', 'incline cable press', 'жим на похилій лаві на блоках', 'schrägbankdrücken am kabelzug'),
  ex('decline-bench', 'decline', 'barbell', 'chest', 'жим головой вниз', 'decline bench press', 'жим головою вниз', 'negativbankdrücken'),
  ex('decline-db-bench', 'decline', 'dumbbell', 'chest', 'жим гантелей головой вниз', 'decline dumbbell press', 'жим гантелей головою вниз', 'kurzhantel-negativbankdrücken'),
  ex('decline-smith-bench', 'decline', 'smith', 'chest', 'жим головой вниз в смите', 'decline smith machine press', 'жим головою вниз у тренажері сміта', 'negativbankdrücken an der multipresse'),
  ex('floor-press', 'floorPress', 'barbell', 'chest', 'жим лёжа с пола', 'floor press', 'жим лежачи з підлоги', 'bodendrücken'),
  ex('db-fly', 'fly', 'dumbbell', 'chest', 'разводка гантелей лёжа', 'dumbbell fly', 'розведення гантелей лежачи', 'kurzhantel-flys'),
  ex('incline-db-fly', 'inclineFly', 'dumbbell', 'chest', 'разводка на наклонной', 'incline dumbbell fly', 'розведення на похилій лаві', 'schrägbank-flys'),
  ex('cable-crossover', 'cableFly', 'cable', 'chest', 'сведение рук в кроссовере', 'cable crossover', 'зведення рук у кросовері', 'kabelziehen über kreuz'),
  ex('band-fly', 'cableFly', 'band', 'chest', 'сведение рук с резинкой', 'band chest fly', 'зведення рук з гумою', 'flys mit band'),
  ex('pec-deck', 'pecDeck', 'machine', 'chest', 'бабочка', 'pec deck', 'метелик', 'butterfly'),
  ex('chest-press-machine', 'chestPress', 'machine', 'chest', 'жим от груди в тренажёре', 'machine chest press', 'жим від грудей у тренажері', 'brustpresse'),
  ex('incline-chest-press-machine', 'chestPress', 'machine', 'chest', 'жим вверх в тренажёре', 'incline machine chest press', 'жим угору в тренажері', 'schräge brustpresse'),
  ex('iso-chest-press', 'chestPress', 'machine', 'chest', 'жим хаммер', 'iso-lateral chest press', 'жим хамер', 'iso-laterale brustpresse'),
  ex('band-chest-press', 'chestPress', 'band', 'chest', 'жим от груди с резинкой', 'band chest press', 'жим від грудей з гумою', 'brustdrücken mit band'),
  ex('push-up', 'pushup', 'body', 'chest', 'отжимания', 'push-ups', 'віджимання', 'liegestütze'),
  ex('knee-push-up', 'kneePushup', 'body', 'chest', 'отжимания с колен', 'knee push-ups', 'віджимання з колін', 'knieliegestütze'),
  ex('dips', 'dip', 'body', 'chest', 'отжимания на брусьях', 'dips', 'віджимання на брусах', 'dips'),
  ex('assisted-dips', 'dip', 'machine', 'chest', 'брусья в гравитроне', 'assisted dips', 'бруси в гравітроні', 'unterstützte dips', { kind: 'assisted' }),
  ex('db-pullover', 'pullover', 'dumbbell', 'chest', 'пуловер с гантелью', 'dumbbell pullover', 'пуловер з гантеллю', 'kurzhantel-überzüge'),
  ex('around-the-world', 'pullover', 'dumbbell', 'chest', 'вокруг света с гантелями', 'around the world', 'навколо світу з гантелями', 'around the world'),

  // Плечи
  ex('ohp', 'ohp', 'barbell', 'shoulders', 'жим стоя', 'overhead press', 'жим стоячи', 'schulterdrücken'),
  ex('db-ohp', 'ohp', 'dumbbell', 'shoulders', 'жим гантелей над головой', 'dumbbell shoulder press', 'жим гантелей над головою', 'kurzhantel-schulterdrücken'),
  ex('strict-press', 'ohp', 'barbell', 'shoulders', 'армейский жим', 'strict military press', 'армійський жим', 'military press'),
  ex('cable-ohp', 'ohp', 'cable', 'shoulders', 'жим над головой на блоках', 'cable overhead press', 'жим над головою на блоках', 'schulterdrücken am kabelzug'),
  ex('smith-ohp', 'seatedPress', 'smith', 'shoulders', 'жим над головой в смите', 'smith machine overhead press', 'жим над головою в тренажері сміта', 'schulterdrücken an der multipresse'),
  ex('seated-ohp', 'seatedPress', 'barbell', 'shoulders', 'жим штанги сидя', 'seated overhead press', 'жим штанги сидячи', 'schulterdrücken sitzend'),
  ex('seated-db-press', 'seatedPress', 'dumbbell', 'shoulders', 'жим гантелей сидя', 'seated dumbbell press', 'жим гантелей сидячи', 'kurzhantel-schulterdrücken sitzend'),
  ex('arnold-press', 'seatedPress', 'dumbbell', 'shoulders', 'жим арнольда', 'arnold press', 'жим арнольда', 'arnold press'),
  ex('shoulder-press-machine', 'seatedPress', 'machine', 'shoulders', 'жим на плечи в тренажёре', 'machine shoulder press', 'жим на плечі в тренажері', 'schulterpresse'),
  ex('shoulder-press-plate', 'seatedPress', 'machine', 'shoulders', 'жим на плечи в рычажном тренажёре', 'plate-loaded shoulder press', 'жим на плечі у важільному тренажері', 'hebel-schulterpresse'),
  ex('push-press', 'pushPress', 'barbell', 'shoulders', 'жимовой швунг', 'push press', 'жимовий швунг', 'schwungdrücken'),
  ex('lateral-raise', 'raise', 'dumbbell', 'shoulders', 'махи гантелями', 'lateral raises', 'махи гантелями', 'seitheben'),
  ex('cable-lateral-raise', 'raise', 'cable', 'shoulders', 'махи в стороны на блоке', 'cable lateral raise', 'махи в сторони на блоці', 'seitheben am kabel'),
  ex('machine-lateral-raise', 'raise', 'machine', 'shoulders', 'махи в стороны в тренажёре', 'machine lateral raise', 'махи в сторони в тренажері', 'seitheben an der maschine'),
  ex('band-lateral-raise', 'raise', 'band', 'shoulders', 'махи в стороны с резинкой', 'band lateral raise', 'махи в сторони з гумою', 'seitheben mit band'),
  ex('front-raise', 'frontRaise', 'dumbbell', 'shoulders', 'подъём гантелей перед собой', 'dumbbell front raise', 'підйом гантелей перед собою', 'frontheben'),
  ex('barbell-front-raise', 'frontRaise', 'barbell', 'shoulders', 'подъём штанги перед собой', 'barbell front raise', 'підйом штанги перед собою', 'frontheben mit langhantel'),
  ex('cable-front-raise', 'frontRaise', 'cable', 'shoulders', 'подъём перед собой на блоке', 'cable front raise', 'підйом перед собою на блоці', 'frontheben am kabel'),
  ex('plate-front-raise', 'frontRaise', 'plate', 'shoulders', 'подъём блина перед собой', 'plate front raise', 'підйом млинця перед собою', 'frontheben mit hantelscheibe'),
  ex('band-front-raise', 'frontRaise', 'band', 'shoulders', 'подъём перед собой с резинкой', 'band front raise', 'підйом перед собою з гумою', 'frontheben mit band'),
  ex('reverse-fly', 'reverseFly', 'dumbbell', 'shoulders', 'разводка в наклоне', 'dumbbell reverse fly', 'розведення в нахилі', 'reverse flys'),
  ex('cable-reverse-fly', 'reverseFly', 'cable', 'shoulders', 'разводка в наклоне на блоках', 'cable reverse fly', 'розведення в нахилі на блоках', 'reverse flys am kabel'),
  ex('reverse-pec-deck', 'reverseFly', 'machine', 'shoulders', 'обратная бабочка', 'reverse pec deck', 'зворотний метелик', 'reverse butterfly'),
  ex('face-pull', 'facePull', 'cable', 'shoulders', 'тяга к лицу', 'face pull', 'тяга до обличчя', 'face pulls'),
  ex('upright-row', 'uprightRow', 'barbell', 'shoulders', 'тяга штанги к подбородку', 'barbell upright row', 'тяга штанги до підборіддя', 'aufrechtes rudern'),
  ex('db-upright-row', 'uprightRow', 'dumbbell', 'shoulders', 'тяга гантелей к подбородку', 'dumbbell upright row', 'тяга гантелей до підборіддя', 'aufrechtes rudern mit kurzhanteln'),
  ex('cable-upright-row', 'uprightRow', 'cable', 'shoulders', 'тяга к подбородку на блоке', 'cable upright row', 'тяга до підборіддя на блоці', 'aufrechtes rudern am kabel'),
  ex('handstand-push-up', 'hspu', 'body', 'shoulders', 'отжимания в стойке на руках', 'handstand push-ups', 'віджимання в стійці на руках', 'handstand-liegestütze'),

  // Ноги
  ex('squat', 'squat', 'barbell', 'legs', 'присед со штангой', 'back squat', 'присідання зі штангою', 'kniebeuge'),
  ex('db-squat', 'squat', 'dumbbell', 'legs', 'присед с гантелями', 'dumbbell squat', 'присідання з гантелями', 'kniebeuge mit kurzhanteln'),
  ex('smith-squat', 'squat', 'smith', 'legs', 'присед в смите', 'smith machine squat', 'присідання в тренажері сміта', 'kniebeuge an der multipresse'),
  ex('band-squat', 'squat', 'band', 'legs', 'присед с резинкой', 'band squat', 'присідання з гумою', 'kniebeuge mit band'),
  ex('box-squat', 'squat', 'barbell', 'legs', 'присед на ящик', 'box squat', 'присідання на ящик', 'box-kniebeuge'),
  ex('bw-squat', 'bwSquat', 'body', 'legs', 'приседания без веса', 'bodyweight squat', 'присідання без ваги', 'kniebeuge ohne gewicht'),
  ex('machine-squat', 'hackSquat', 'machine', 'legs', 'присед в тренажёре', 'machine squat', 'присідання в тренажері', 'maschinenkniebeuge'),
  ex('front-squat', 'frontSquat', 'barbell', 'legs', 'фронтальный присед', 'front squat', 'фронтальні присідання', 'frontkniebeuge'),
  ex('zercher-squat', 'frontSquat', 'barbell', 'legs', 'присед цёрчера', 'zercher squat', 'присідання церчера', 'zercher-kniebeuge'),
  ex('overhead-squat', 'ohSquat', 'barbell', 'legs', 'присед со штангой над головой', 'overhead squat', 'присідання зі штангою над головою', 'überkopfkniebeuge'),
  ex('press-under', 'ohSquat', 'barbell', 'full', 'подсед под штангу', 'press under', 'підсід під штангу', 'press under'),
  ex('goblet-squat', 'goblet', 'kettlebell', 'legs', 'гоблет-присед', 'goblet squat', 'гоблет-присідання', 'goblet squat'),
  ex('hack-squat', 'hackSquat', 'machine', 'legs', 'гакк-присед', 'hack squat', 'гак-присідання', 'hackenschmidt-kniebeuge'),
  ex('barbell-hack-squat', 'deadlift', 'barbell', 'legs', 'гакк-присед со штангой сзади', 'barbell hack squat', 'гак-присідання зі штангою позаду', 'hackenschmidt mit langhantel'),
  ex('pistol-squat', 'pistol', 'body', 'legs', 'пистолетик', 'pistol squat', 'пістолетик', 'pistol squat'),
  ex('jump-squat', 'jumpSquat', 'body', 'legs', 'выпрыгивания из приседа', 'jump squats', 'вистрибування з присіду', 'sprungkniebeugen'),
  ex('leg-press', 'legPress', 'machine', 'legs', 'жим ногами', 'leg press', 'жим ногами', 'beinpresse'),
  ex('seated-leg-press', 'legPress', 'machine', 'legs', 'жим ногами сидя', 'seated leg press', 'жим ногами сидячи', 'sitzende beinpresse'),
  ex('lunge', 'lunge', 'dumbbell', 'legs', 'выпады с гантелями', 'dumbbell lunges', 'випади з гантелями', 'ausfallschritte'),
  ex('barbell-lunge', 'lunge', 'barbell', 'legs', 'выпады со штангой', 'barbell lunges', 'випади зі штангою', 'ausfallschritte mit langhantel'),
  ex('bw-lunge', 'lunge', 'body', 'legs', 'выпады без веса', 'bodyweight lunges', 'випади без ваги', 'ausfallschritte ohne gewicht'),
  ex('bulgarian-split-squat', 'bulgarian', 'dumbbell', 'legs', 'болгарские выпады', 'bulgarian split squat', 'болгарські випади', 'bulgarische kniebeuge'),
  ex('step-up', 'stepUp', 'dumbbell', 'legs', 'зашагивания на тумбу', 'step-ups', 'зашагування на тумбу', 'step-ups'),
  ex('leg-extension', 'legExt', 'machine', 'legs', 'разгибание ног', 'leg extension', 'розгинання ніг', 'beinstrecker'),
  ex('leg-curl', 'legCurl', 'machine', 'legs', 'сгибание ног сидя', 'seated leg curl', 'згинання ніг сидячи', 'beinbeuger sitzend'),
  ex('lying-leg-curl', 'lyingLegCurl', 'machine', 'legs', 'сгибание ног лёжа', 'lying leg curl', 'згинання ніг лежачи', 'liegender beinbeuger'),
  ex('glute-ham-raise', 'backExt', 'body', 'legs', 'ягодично-бедренный подъём', 'glute-ham raise', 'сіднично-стегновий підйом', 'glute-ham-raise'),
  ex('hip-abductor', 'abduction', 'machine', 'glutes', 'разведение ног в тренажёре', 'hip abductor', 'розведення ніг у тренажері', 'abduktorenmaschine'),
  ex('hip-adductor', 'adduction', 'machine', 'legs', 'сведение ног в тренажёре', 'hip adductor', 'зведення ніг у тренажері', 'adduktorenmaschine'),
  ex('calf-raise', 'calf', 'machine', 'legs', 'подъёмы на носки', 'calf raises', 'підйоми на носки', 'wadenheben'),
  ex('barbell-calf-raise', 'calf', 'barbell', 'legs', 'подъёмы на носки со штангой', 'standing barbell calf raise', 'підйоми на носки зі штангою', 'wadenheben mit langhantel'),
  ex('db-calf-raise', 'calf', 'dumbbell', 'legs', 'подъёмы на носки с гантелями', 'dumbbell calf raise', 'підйоми на носки з гантелями', 'wadenheben mit kurzhanteln'),
  ex('bw-calf-raise', 'calf', 'body', 'legs', 'подъёмы на носки без веса', 'bodyweight calf raise', 'підйоми на носки без ваги', 'wadenheben ohne gewicht'),
  ex('smith-calf-raise', 'calf', 'smith', 'legs', 'подъёмы на носки в смите', 'smith machine calf raise', 'підйоми на носки в тренажері сміта', 'wadenheben an der multipresse'),
  ex('leg-press-calf', 'calfPress', 'machine', 'legs', 'икры в жиме ногами', 'calf press on leg press', 'литки в жимі ногами', 'wadendrücken an der beinpresse'),
  ex('seated-leg-press-calf', 'calfPress', 'machine', 'legs', 'икры в жиме ногами сидя', 'calf press on seated leg press', 'литки в жимі ногами сидячи', 'wadendrücken an der sitzenden beinpresse'),
  ex('seated-calf-raise', 'seatedCalf', 'machine', 'legs', 'подъёмы на носки сидя', 'seated calf raise', 'підйоми на носки сидячи', 'wadenheben sitzend'),
  ex('plate-seated-calf-raise', 'seatedCalf', 'plate', 'legs', 'подъёмы на носки сидя с блином', 'plate-loaded seated calf raise', 'підйоми на носки сидячи з млинцем', 'sitzendes wadenheben mit scheibe'),

  // Тяги и таз
  ex('deadlift', 'deadlift', 'barbell', 'back', 'становая тяга', 'deadlift', 'станова тяга', 'kreuzheben'),
  ex('db-deadlift', 'deadlift', 'dumbbell', 'back', 'становая с гантелями', 'dumbbell deadlift', 'станова з гантелями', 'kreuzheben mit kurzhanteln'),
  ex('smith-deadlift', 'deadlift', 'smith', 'back', 'становая в смите', 'smith machine deadlift', 'станова в тренажері сміта', 'kreuzheben an der multipresse'),
  ex('band-deadlift', 'deadlift', 'band', 'back', 'становая с резинкой', 'band deadlift', 'станова з гумою', 'kreuzheben mit band'),
  ex('trap-bar-deadlift', 'deadlift', 'barbell', 'back', 'становая с трэп-грифом', 'trap bar deadlift', 'станова з трап-грифом', 'trap-bar-kreuzheben'),
  ex('deficit-deadlift', 'deadlift', 'barbell', 'back', 'становая с дефицитом', 'deficit deadlift', 'станова з дефіцитом', 'defizit-kreuzheben'),
  ex('sumo-deadlift', 'sumo', 'barbell', 'legs', 'становая сумо', 'sumo deadlift', 'станова сумо', 'sumo-kreuzheben'),
  ex('rack-pull', 'rackPull', 'barbell', 'back', 'тяга с плинтов', 'rack pull', 'тяга з плінтів', 'rack pulls'),
  ex('rdl', 'rdl', 'barbell', 'glutes', 'румынская тяга', 'romanian deadlift', 'румунська тяга', 'rumänisches kreuzheben'),
  ex('db-rdl', 'rdl', 'dumbbell', 'glutes', 'румынская тяга с гантелями', 'dumbbell romanian deadlift', 'румунська тяга з гантелями', 'rumänisches kreuzheben mit kurzhanteln'),
  ex('stiff-leg-deadlift', 'rdl', 'barbell', 'glutes', 'тяга на прямых ногах', 'stiff-leg deadlift', 'тяга на прямих ногах', 'kreuzheben mit gestreckten beinen'),
  ex('db-stiff-leg-deadlift', 'rdl', 'dumbbell', 'glutes', 'тяга на прямых ногах с гантелями', 'dumbbell stiff-leg deadlift', 'тяга на прямих ногах з гантелями', 'gestrecktes kreuzheben mit kurzhanteln'),
  ex('band-stiff-leg-deadlift', 'rdl', 'band', 'glutes', 'тяга на прямых ногах с резинкой', 'band straight-leg deadlift', 'тяга на прямих ногах з гумою', 'gestrecktes kreuzheben mit band'),
  ex('cable-pull-through', 'rdl', 'cable', 'glutes', 'протяжка на блоке между ног', 'cable pull-through', 'протяжка на блоці між ніг', 'cable pull-through'),
  ex('good-morning', 'goodMorning', 'barbell', 'back', 'гуд морнинг', 'good morning', 'гуд морнінг', 'good mornings'),
  ex('hip-thrust', 'hipThrust', 'barbell', 'glutes', 'ягодичный мост', 'hip thrust', 'сідничний міст', 'hip thrust'),
  ex('bw-hip-thrust', 'hipThrust', 'body', 'glutes', 'ягодичный мост без веса', 'bodyweight hip thrust', 'сідничний міст без ваги', 'hip thrust ohne gewicht'),
  ex('single-leg-bridge', 'bridge', 'body', 'glutes', 'мостик на одной ноге', 'single-leg glute bridge', 'місток на одній нозі', 'einbeinige glute bridge'),
  ex('glute-kickback-machine', 'kickbackLeg', 'machine', 'glutes', 'отведение ноги назад в тренажёре', 'machine glute kickback', 'відведення ноги назад у тренажері', 'glute kickback an der maschine'),
  ex('cable-glute-kickback', 'kickbackLeg', 'cable', 'glutes', 'отведение ноги назад на блоке', 'cable glute kickback', 'відведення ноги назад на блоці', 'glute kickback am kabel'),
  ex('back-extension', 'backExt', 'body', 'back', 'гиперэкстензия', 'back extension', 'гіперекстензія', 'rückenstrecken'),
  ex('machine-back-extension', 'backExt', 'machine', 'back', 'разгибание спины в тренажёре', 'machine back extension', 'розгинання спини в тренажері', 'rückenstrecker-maschine'),
  ex('superman', 'superman', 'body', 'back', 'супермен', 'superman', 'супермен', 'superman'),

  // Спина
  ex('barbell-row', 'row', 'barbell', 'back', 'тяга штанги к поясу', 'barbell row', 'тяга штанги до пояса', 'langhantelrudern'),
  ex('underhand-row', 'row', 'barbell', 'back', 'тяга штанги обратным хватом', 'underhand barbell row', 'тяга штанги зворотним хватом', 'rudern im untergriff'),
  ex('pendlay-row', 'row', 'barbell', 'back', 'тяга пендлея', 'pendlay row', 'тяга пендлея', 'pendlay-rudern'),
  ex('t-bar-row', 'row', 'barbell', 'back', 'тяга т-грифа', 't-bar row', 'тяга т-грифа', 't-bar-rudern', { grip: 'close' }),
  ex('db-row', 'row', 'dumbbell', 'back', 'тяга гантелей в наклоне', 'dumbbell row', 'тяга гантелей у нахилі', 'kurzhantelrudern'),
  ex('one-arm-db-row', 'row', 'dumbbell', 'back', 'тяга гантели одной рукой', 'one-arm dumbbell row', 'тяга гантелі однією рукою', 'einarmiges kurzhantelrudern'),
  ex('incline-db-row', 'row', 'dumbbell', 'back', 'тяга гантелей лёжа на наклонной', 'incline dumbbell row', 'тяга гантелей лежачи на похилій лаві', 'kurzhantelrudern auf der schrägbank'),
  ex('band-row', 'row', 'band', 'back', 'тяга резинки в наклоне', 'band bent-over row', 'тяга гуми в нахилі', 'vorgebeugtes rudern mit band'),
  ex('band-squat-row', 'row', 'band', 'back', 'присед с тягой резинки', 'band squat row', 'присідання з тягою гуми', 'kniebeuge mit rudern am band'),
  ex('cable-row', 'cableRow', 'cable', 'back', 'горизонтальная тяга', 'seated cable row', 'горизонтальна тяга', 'rudern am kabel'),
  ex('wide-cable-row', 'cableRow', 'cable', 'back', 'горизонтальная тяга широким хватом', 'seated wide-grip cable row', 'горизонтальна тяга широким хватом', 'breites rudern am kabel', { grip: 'wide' }),
  ex('machine-row', 'cableRow', 'machine', 'back', 'тяга в тренажёре сидя', 'seated machine row', 'тяга в тренажері сидячи', 'rudermaschine'),
  ex('iso-row', 'cableRow', 'machine', 'back', 'тяга хаммер', 'iso-lateral row', 'тяга хамер', 'iso-laterales rudern'),
  ex('inverted-row', 'invertedRow', 'body', 'back', 'австралийские подтягивания', 'inverted row', 'австралійські підтягування', 'australische klimmzüge'),
  ex('pull-up', 'pullup', 'body', 'back', 'подтягивания', 'pull-ups', 'підтягування', 'klimmzüge'),
  ex('wide-pull-up', 'pullup', 'body', 'back', 'подтягивания широким хватом', 'wide-grip pull-ups', 'підтягування широким хватом', 'breite klimmzüge', { grip: 'wide' }),
  ex('chin-up', 'pullup', 'body', 'back', 'подтягивания обратным хватом', 'chin-ups', 'підтягування зворотним хватом', 'chin-ups', { grip: 'close' }),
  ex('assisted-pull-up', 'pullup', 'machine', 'back', 'подтягивания в гравитроне', 'assisted pull-ups', 'підтягування в гравітроні', 'unterstützte klimmzüge', { kind: 'assisted' }),
  ex('assisted-chin-up', 'pullup', 'machine', 'back', 'подтягивания обратным хватом в гравитроне', 'assisted chin-ups', 'підтягування зворотним хватом у гравітроні', 'unterstützte chin-ups', { kind: 'assisted', grip: 'close' }),
  ex('band-pull-up', 'pullup', 'band', 'back', 'подтягивания с резинкой', 'band-assisted pull-ups', 'підтягування з гумою', 'klimmzüge mit band', { kind: 'assisted' }),
  ex('kipping-pull-up', 'pullup', 'body', 'back', 'кипинг-подтягивания', 'kipping pull-ups', 'кіпінг-підтягування', 'kipping-klimmzüge'),
  ex('muscle-up', 'muscleUp', 'body', 'back', 'выход силой', 'muscle-up', 'вихід силою', 'muscle-up'),
  ex('lat-pulldown', 'pulldown', 'cable', 'back', 'тяга верхнего блока', 'lat pulldown', 'тяга верхнього блока', 'latzug'),
  ex('wide-pulldown', 'pulldown', 'cable', 'back', 'тяга верхнего блока широким хватом', 'wide-grip lat pulldown', 'тяга верхнього блока широким хватом', 'breiter latzug', { grip: 'wide' }),
  ex('underhand-pulldown', 'pulldown', 'cable', 'back', 'тяга верхнего блока обратным хватом', 'underhand lat pulldown', 'тяга верхнього блока зворотним хватом', 'latzug im untergriff', { grip: 'close' }),
  ex('single-arm-pulldown', 'pulldown', 'cable', 'back', 'тяга верхнего блока одной рукой', 'single-arm lat pulldown', 'тяга верхнього блока однією рукою', 'einarmiger latzug'),
  ex('machine-pulldown', 'pulldown', 'machine', 'back', 'тяга сверху в тренажёре', 'machine lat pulldown', 'тяга зверху в тренажері', 'latzugmaschine'),
  ex('band-pulldown', 'pulldown', 'band', 'back', 'тяга резинки сверху на коленях', 'kneeling band pulldown', 'тяга гуми зверху на колінах', 'latzug mit band kniend'),
  ex('band-underhand-pulldown', 'pulldown', 'band', 'back', 'тяга резинки сверху обратным хватом', 'underhand band pulldown', 'тяга гуми зверху зворотним хватом', 'latzug mit band im untergriff', { grip: 'close' }),
  ex('machine-pullover', 'pullover', 'machine', 'back', 'пуловер в тренажёре', 'machine pullover', 'пуловер у тренажері', 'überzugmaschine'),
  ex('shrug', 'shrug', 'dumbbell', 'back', 'шраги', 'shrugs', 'шраги', 'shrugs'),
  ex('barbell-shrug', 'shrug', 'barbell', 'back', 'шраги со штангой', 'barbell shrugs', 'шраги зі штангою', 'langhantel-shrugs'),
  ex('machine-shrug', 'shrug', 'machine', 'back', 'шраги в тренажёре', 'machine shrugs', 'шраги в тренажері', 'shrugs an der maschine'),
  ex('smith-shrug', 'shrug', 'smith', 'back', 'шраги в смите', 'smith machine shrugs', 'шраги в тренажері сміта', 'shrugs an der multipresse'),

  // Руки
  ex('biceps-curl', 'curl', 'barbell', 'arms', 'подъём штанги на бицепс', 'barbell curl', 'підйом штанги на біцепс', 'langhantel-curls'),
  ex('db-curl', 'curl', 'dumbbell', 'arms', 'подъём гантелей на бицепс', 'dumbbell curl', 'підйом гантелей на біцепс', 'kurzhantel-curls'),
  ex('cable-curl', 'curl', 'cable', 'arms', 'сгибание рук на блоке', 'cable curl', 'згинання рук на блоці', 'kabel-curls'),
  ex('machine-curl', 'preacher', 'machine', 'arms', 'сгибание рук в тренажёре', 'machine curl', 'згинання рук у тренажері', 'bizepsmaschine'),
  ex('incline-curl', 'curl', 'dumbbell', 'arms', 'подъём гантелей сидя на наклонной', 'incline dumbbell curl', 'підйом гантелей сидячи на похилій лаві', 'schrägbank-curls'),
  ex('hammer-curl', 'curl', 'dumbbell', 'arms', 'молотки', 'hammer curls', 'молотки', 'hammer-curls'),
  ex('cable-hammer-curl', 'curl', 'cable', 'arms', 'молотки на блоке', 'cable hammer curl', 'молотки на блоці', 'hammer-curls am kabel'),
  ex('band-hammer-curl', 'curl', 'band', 'arms', 'молотки с резинкой', 'band hammer curl', 'молотки з гумою', 'hammer-curls mit band'),
  ex('concentration-curl', 'concentration', 'dumbbell', 'arms', 'концентрированный подъём', 'concentration curl', 'концентрований підйом', 'konzentrationscurls'),
  ex('reverse-concentration-curl', 'concentration', 'dumbbell', 'arms', 'концентрированный подъём обратным хватом', 'reverse-grip concentration curl', 'концентрований підйом зворотним хватом', 'konzentrationscurls im obergriff'),
  ex('preacher-curl', 'preacher', 'barbell', 'arms', 'сгибания на скамье скотта', 'preacher curl', 'згинання на лаві скотта', 'scottcurls'),
  ex('db-preacher-curl', 'preacher', 'dumbbell', 'arms', 'скотт с гантелью', 'dumbbell preacher curl', 'скотт з гантеллю', 'scottcurls mit kurzhantel'),
  ex('reverse-curl', 'curl', 'barbell', 'arms', 'подъём штанги обратным хватом', 'reverse barbell curl', 'підйом штанги зворотним хватом', 'reverse curls'),
  ex('db-reverse-curl', 'curl', 'dumbbell', 'arms', 'подъём гантелей обратным хватом', 'reverse dumbbell curl', 'підйом гантелей зворотним хватом', 'reverse curls mit kurzhanteln'),
  ex('band-reverse-curl', 'curl', 'band', 'arms', 'подъём резинки обратным хватом', 'reverse band curl', 'підйом гуми зворотним хватом', 'reverse curls mit band'),
  ex('wrist-curl', 'wristCurl', 'dumbbell', 'arms', 'сгибание запястий сидя', 'seated wrist curl', 'згинання зап’ясть сидячи', 'handgelenk-curls'),
  ex('wrist-roller', 'wristCurl', 'plate', 'arms', 'ролик для запястий', 'wrist roller', 'ролик для зап’ясть', 'handgelenkroller'),
  ex('triceps-pushdown', 'pushdown', 'cable', 'arms', 'разгибание на блоке', 'triceps pushdown', 'розгинання на блоці', 'trizepsdrücken am kabel'),
  ex('straight-bar-pushdown', 'pushdown', 'cable', 'arms', 'разгибание на блоке с прямой рукоятью', 'straight-bar pushdown', 'розгинання на блоці з прямим руків’ям', 'trizepsdrücken mit stange'),
  ex('machine-triceps-extension', 'pushdown', 'machine', 'arms', 'разгибание рук в тренажёре', 'machine triceps extension', 'розгинання рук у тренажері', 'trizepsmaschine'),
  ex('cable-overhead-extension', 'overheadExt', 'cable', 'arms', 'разгибание из-за головы на блоке', 'cable overhead triceps extension', 'розгинання з-за голови на блоці', 'überkopf-trizepsstrecken am kabel'),
  ex('db-overhead-extension', 'overheadExt', 'dumbbell', 'arms', 'разгибание гантели из-за головы', 'dumbbell overhead triceps extension', 'розгинання гантелі з-за голови', 'kurzhantel-trizepsstrecken über kopf'),
  ex('barbell-overhead-extension', 'overheadExt', 'barbell', 'arms', 'французский жим стоя', 'barbell overhead triceps extension', 'французький жим стоячи', 'stehendes french press'),
  ex('skull-crusher', 'skull', 'barbell', 'arms', 'французский жим', 'skull crushers', 'французький жим', 'french press'),
  ex('db-skull-crusher', 'skull', 'dumbbell', 'arms', 'французский жим с гантелями', 'dumbbell skull crushers', 'французький жим з гантелями', 'french press mit kurzhanteln'),
  ex('ez-skull-crusher', 'skull', 'barbell', 'arms', 'французский жим с изогнутым грифом', 'ez-bar skull crushers', 'французький жим з вигнутим грифом', 'french press mit sz-stange', { grip: 'close' }),
  ex('triceps-kickback', 'kickback', 'dumbbell', 'arms', 'разгибание гантели в наклоне', 'triceps kickback', 'розгинання гантелі в нахилі', 'trizeps-kickbacks'),
  ex('cable-triceps-kickback', 'kickback', 'cable', 'arms', 'разгибание на блоке в наклоне', 'cable triceps kickback', 'розгинання на блоці в нахилі', 'trizeps-kickbacks am kabel'),
  ex('bench-dip', 'benchDip', 'body', 'arms', 'обратные отжимания от скамьи', 'bench dips', 'зворотні віджимання від лави', 'bankdips'),
  ex('triceps-dip', 'dip', 'body', 'arms', 'брусья на трицепс', 'triceps dips', 'бруси на трицепс', 'trizeps-dips'),
  ex('assisted-triceps-dip', 'dip', 'machine', 'arms', 'брусья на трицепс в гравитроне', 'assisted triceps dips', 'бруси на трицепс у гравітроні', 'unterstützte trizeps-dips', { kind: 'assisted' }),

  // Пресс
  ex('plank', 'plank', 'body', 'core', 'планка', 'plank', 'планка', 'unterarmstütz', { kind: 'time' }),
  ex('side-plank', 'sidePlank', 'body', 'core', 'боковая планка', 'side plank', 'бічна планка', 'seitstütz', { kind: 'time' }),
  ex('reverse-plank', 'reversePlank', 'body', 'core', 'обратная планка', 'reverse plank', 'зворотна планка', 'umgekehrter stütz', { kind: 'time' }),
  ex('crunch', 'crunch', 'body', 'core', 'скручивания', 'crunches', 'скручування', 'crunches'),
  ex('machine-crunch', 'crunch', 'machine', 'core', 'скручивания в тренажёре', 'machine crunch', 'скручування в тренажері', 'bauchmaschine'),
  ex('ball-crunch', 'crunch', 'body', 'core', 'скручивания на фитболе', 'stability ball crunch', 'скручування на фітболі', 'crunches auf dem gymnastikball'),
  ex('decline-crunch', 'crunch', 'body', 'core', 'скручивания на наклонной скамье', 'decline crunch', 'скручування на похилій лаві', 'crunches auf der negativbank'),
  ex('oblique-crunch', 'crunch', 'body', 'core', 'косые скручивания', 'oblique crunch', 'косі скручування', 'seitliche crunches'),
  ex('cross-body-crunch', 'bicycle', 'body', 'core', 'скручивания локтем к колену', 'cross-body crunch', 'скручування ліктем до коліна', 'cross-body crunches'),
  ex('bicycle-crunch', 'bicycle', 'body', 'core', 'скручивания велосипед', 'bicycle crunch', 'скручування велосипед', 'fahrrad-crunches'),
  ex('reverse-crunch', 'reverseCrunch', 'body', 'core', 'обратные скручивания', 'reverse crunch', 'зворотні скручування', 'reverse crunches'),
  ex('cable-crunch', 'cableCrunch', 'cable', 'core', 'скручивания на блоке', 'cable crunch', 'скручування на блоці', 'kabelcrunches'),
  ex('sit-up', 'situp', 'body', 'core', 'подъём корпуса', 'sit-ups', 'підйом корпусу', 'sit-ups'),
  ex('jackknife-sit-up', 'vUp', 'body', 'core', 'складной нож', 'jackknife sit-up', 'складаний ніж', 'klappmesser'),
  ex('v-up', 'vUp', 'body', 'core', 'v-подъёмы', 'v-ups', 'v-підйоми', 'v-ups'),
  ex('lying-leg-raise', 'legRaise', 'body', 'core', 'подъём ног лёжа', 'lying leg raise', 'підйом ніг лежачи', 'beinheben liegend'),
  ex('lying-knee-raise', 'reverseCrunch', 'body', 'core', 'подъём коленей лёжа', 'lying knee raise', 'підйом колін лежачи', 'knieheben liegend'),
  ex('hanging-leg-raise', 'hangRaise', 'body', 'core', 'подъём ног в висе', 'hanging leg raises', 'підйом ніг у висі', 'hängendes beinheben'),
  ex('hanging-knee-raise', 'hangKnee', 'body', 'core', 'подъём коленей в висе', 'hanging knee raises', 'підйом колін у висі', 'hängendes knieheben'),
  ex('captains-chair', 'hangKnee', 'body', 'core', 'подъём коленей на брусьях', 'captain’s chair knee raise', 'підйом колін на брусах', 'knieheben am barren'),
  ex('toes-to-bar', 'hangRaise', 'body', 'core', 'носки к перекладине', 'toes to bar', 'носки до поперечини', 'toes to bar'),
  ex('knees-to-elbows', 'hangKnee', 'body', 'core', 'колени к локтям', 'knees to elbows', 'коліна до ліктів', 'knees to elbows'),
  ex('russian-twist', 'russianTwist', 'body', 'core', 'русский твист', 'russian twist', 'російський твіст', 'russian twist'),
  ex('cable-twist', 'twist', 'cable', 'core', 'повороты корпуса на блоке', 'cable twist', 'повороти корпусу на блоці', 'rotation am kabel'),
  ex('machine-torso-rotation', 'twist', 'machine', 'core', 'повороты корпуса в тренажёре', 'machine torso rotation', 'повороти корпусу в тренажері', 'rotationsmaschine'),
  ex('db-side-bend', 'sideBend', 'dumbbell', 'core', 'наклоны в сторону с гантелью', 'dumbbell side bend', 'нахили вбік з гантеллю', 'seitbeugen mit kurzhantel'),
  ex('cable-side-bend', 'sideBend', 'cable', 'core', 'наклоны в сторону на блоке', 'cable side bend', 'нахили вбік на блоці', 'seitbeugen am kabel'),
  ex('band-side-bend', 'sideBend', 'band', 'core', 'наклоны в сторону с резинкой', 'band side bend', 'нахили вбік з гумою', 'seitbeugen mit band'),
  ex('ab-wheel', 'abWheel', 'body', 'core', 'ролик для пресса', 'ab wheel', 'ролик для преса', 'bauchroller'),
  ex('mountain-climber', 'climber', 'body', 'core', 'скалолаз', 'mountain climbers', 'скелелаз', 'mountain climbers'),

  // Всё тело
  ex('clean', 'clean', 'barbell', 'full', 'взятие на грудь', 'clean', 'взяття на груди', 'umsetzen'),
  ex('power-clean', 'clean', 'barbell', 'full', 'взятие на грудь в стойку', 'power clean', 'взяття на груди в стійку', 'power clean'),
  ex('hang-clean', 'clean', 'barbell', 'full', 'взятие на грудь с виса', 'hang clean', 'взяття на груди з вису', 'hang clean'),
  ex('clean-and-jerk', 'clean', 'barbell', 'full', 'толчок', 'clean and jerk', 'поштовх', 'stoßen'),
  ex('split-jerk', 'pushPress', 'barbell', 'full', 'толчок в ножницы', 'split jerk', 'поштовх у ножиці', 'ausstoßen'),
  ex('deadlift-high-pull', 'clean', 'barbell', 'full', 'тяга к подбородку от пола', 'deadlift high pull', 'тяга до підборіддя від підлоги', 'hochziehen aus dem kreuzheben'),
  ex('sumo-high-pull', 'sumo', 'barbell', 'full', 'тяга сумо к подбородку', 'sumo deadlift high pull', 'тяга сумо до підборіддя', 'sumo-hochziehen'),
  ex('jump-shrug', 'shrug', 'barbell', 'full', 'шраги с выпрыгиванием', 'jump shrug', 'шраги з вистрибуванням', 'jump shrugs'),
  ex('snatch', 'snatch', 'barbell', 'full', 'рывок', 'snatch', 'ривок', 'reißen'),
  ex('power-snatch', 'snatch', 'barbell', 'full', 'рывок в стойку', 'power snatch', 'ривок у стійку', 'power snatch'),
  ex('hang-snatch', 'snatch', 'barbell', 'full', 'рывок с виса', 'hang snatch', 'ривок з вису', 'hang snatch'),
  ex('snatch-pull', 'snatch', 'barbell', 'full', 'рывковая тяга', 'snatch pull', 'ривкова тяга', 'reißzug'),
  ex('thruster', 'thruster', 'barbell', 'full', 'трастер', 'thruster', 'трастер', 'thruster'),
  ex('kb-thruster', 'thruster', 'kettlebell', 'full', 'трастер с гирями', 'kettlebell thruster', 'трастер з гирями', 'kettlebell-thruster'),
  ex('kb-swing', 'kbSwing', 'kettlebell', 'full', 'махи гирей', 'kettlebell swing', 'махи гирею', 'kettlebell swing'),
  ex('turkish-get-up', 'getUp', 'kettlebell', 'full', 'турецкий подъём', 'turkish get-up', 'турецький підйом', 'türkisches aufstehen'),
  ex('burpee', 'burpee', 'body', 'full', 'бёрпи', 'burpees', 'берпі', 'burpees'),
  ex('box-jump', 'boxJump', 'body', 'full', 'запрыгивания на тумбу', 'box jumps', 'застрибування на тумбу', 'box jumps'),
  ex('lateral-box-jump', 'boxJump', 'body', 'full', 'боковые запрыгивания на тумбу', 'lateral box jumps', 'бічні застрибування на тумбу', 'seitliche box jumps'),
  ex('ball-slam', 'slam', 'other', 'full', 'броски мяча в пол', 'ball slams', 'кидки м’яча в підлогу', 'ball slams'),
  ex('battle-ropes', 'ropes', 'other', 'full', 'канаты', 'battle ropes', 'канати', 'battle ropes', { kind: 'time' }),
  ex('stretching', 'yoga', 'body', 'full', 'растяжка', 'stretching', 'розтяжка', 'dehnen', { kind: 'time' }),
  ex('yoga', 'yoga', 'body', 'full', 'йога', 'yoga', 'йога', 'yoga', { kind: 'time' }),

  // Кардио
  ex('running', 'run', 'cardio', 'cardio', 'бег', 'running', 'біг', 'laufen'),
  ex('treadmill', 'treadmill', 'cardio', 'cardio', 'бег на дорожке', 'treadmill running', 'біг на доріжці', 'laufband'),
  ex('walking', 'walk', 'cardio', 'cardio', 'ходьба', 'walking', 'ходьба', 'gehen'),
  ex('hiking', 'walk', 'cardio', 'cardio', 'поход', 'hiking', 'похід', 'wandern'),
  ex('elliptical', 'elliptical', 'cardio', 'cardio', 'эллипс', 'elliptical', 'еліпс', 'crosstrainer'),
  ex('cycling', 'cycle', 'cardio', 'cardio', 'велосипед', 'cycling', 'велосипед', 'radfahren'),
  ex('indoor-cycling', 'cycle', 'cardio', 'cardio', 'велотренажёр', 'indoor cycling', 'велотренажер', 'indoor-cycling'),
  ex('rowing-machine', 'rowErg', 'cardio', 'cardio', 'гребной тренажёр', 'rowing machine', 'гребний тренажер', 'rudergerät'),
  ex('swimming', 'swim', 'cardio', 'cardio', 'плавание', 'swimming', 'плавання', 'schwimmen'),
  ex('skating', 'skate', 'cardio', 'cardio', 'коньки', 'skating', 'ковзани', 'eislaufen'),
  ex('skiing', 'skate', 'cardio', 'cardio', 'лыжи', 'skiing', 'лижі', 'skifahren'),
  ex('snowboarding', 'skate', 'cardio', 'cardio', 'сноуборд', 'snowboarding', 'сноуборд', 'snowboarden'),
  ex('jump-rope', 'jumpRope', 'other', 'cardio', 'скакалка', 'jump rope', 'скакалка', 'seilspringen', { kind: 'time' }),
  ex('jumping-jack', 'jumpingJack', 'body', 'cardio', 'джампинг джек', 'jumping jacks', 'джампінг джек', 'hampelmänner'),
  ex('high-knees', 'highKnees', 'body', 'cardio', 'бег с высоким подниманием колен', 'high knee skips', 'біг з високим підніманням колін', 'kniehebelauf'),
  ex('aerobics', 'jumpingJack', 'cardio', 'cardio', 'аэробика', 'aerobics', 'аеробіка', 'aerobic', { kind: 'time' })
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/**
 * Своё упражнение (1.53) — без таблицы в базе: группа и название живут в самом
 * id, `custom:<группа>:<название>`, и ложатся в план и подходы как любое
 * другое. Список своих — всё, что уже стоит у кого-то на доске или в
 * тренировке (`customExercises`), поэтому добавленное видят все трое. Показать
 * его мопсу нечем — он делает похожее движение той же группы, без «как делать».
 */
const CUSTOM = /^custom:([a-z]+):(.{1,40})$/u;
const LOOKS_LIKE: Record<Muscle, Motion> = {
  chest: 'bench',
  back: 'row',
  shoulders: 'ohp',
  arms: 'curl',
  legs: 'squat',
  glutes: 'hipThrust',
  core: 'crunch',
  full: 'burpee',
  cardio: 'jumpRope'
};
const CUSTOMS = new Map<string, Exercise>();

function customOf(id: string): Exercise | undefined {
  const known = CUSTOMS.get(id);
  if (known) return known;
  const match = CUSTOM.exec(id);
  const muscle = match?.[1] as Muscle | undefined;
  const name = match?.[2].trim();
  if (!muscle || !name || !(MUSCLES as readonly string[]).includes(muscle)) return undefined;
  const made: Exercise = { id, motion: LOOKS_LIKE[muscle], gear: 'other', muscle, kind: muscle === 'cardio' ? 'cardio' : 'weight', name: { ru: name, en: name, uk: name, de: name } };
  CUSTOMS.set(id, made);
  return made;
}

export const isCustom = (id: string) => id.startsWith('custom:');
export const customId = (muscle: Muscle, name: string) => `custom:${muscle}:${name.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 40)}`;

export const exerciseOf = (id: string): Exercise | undefined => BY_ID.get(id) ?? customOf(id);
export const isExercise = (id: string) => BY_ID.has(id) || customOf(id) !== undefined;

/** Название на языке страницы. Неизвестный id — как есть: подход переживёт выбывшее упражнение. */
export const exerciseName = (id: string, locale: Locale) => exerciseOf(id)?.name[locale] ?? id;

/** Что пишется в подходе. Неизвестное упражнение — по-старому, вес и повторы. */
export const kindOf = (id: string): Kind => exerciseOf(id)?.kind ?? 'weight';
/** Рекорд по Эпли и «объём» считаются только там, где вес — нагрузка, а не помощь. */
export const countsVolume = (kind: Kind) => kind === 'weight' || kind === 'body';

/**
 * Название дня или тренировки, которое никто не вписал, — из мышц, по
 * которым больше упражнений: «грудь · руки». Считается на языке страницы,
 * поэтому, в отличие от вписанного руками, переводится вместе с сайтом.
 */
export function musclesOf(ids: string[], limit = 2): Muscle[] {
  const count = new Map<Muscle, number>();
  for (const id of ids) {
    const m = exerciseOf(id)?.muscle;
    if (m) count.set(m, (count.get(m) ?? 0) + 1);
  }
  // При равенстве — в порядке дня (сортировка устойчивая, а `Map` помнит
  // порядок): первым идёт то, с чего день начинается, как и у упражнения дня
  // в подвале. По общему списку мышц день «присед, жим, тяга» назывался
  // «грудь · спина», а мопс в подвале в этот день приседал.
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([m]) => m);
}

/**
 * Упражнение дня в подвале — одно из трёх, как просил владелец: жмёт 200,
 * тянет 100 к поясу или приседает. Остальное сводится к ближайшему по смыслу:
 * всё, что толкает, — жим, всё, что тянет, — тяга, ноги и таз — присед.
 */
export type Showcase = 'bench' | 'row' | 'squat';

const PUSH: Motion[] = ['bench', 'incline', 'decline', 'floorPress', 'fly', 'inclineFly', 'cableFly', 'pecDeck', 'chestPress', 'pullover', 'pushup', 'kneePushup', 'dip', 'benchDip', 'ohp', 'seatedPress', 'pushPress', 'raise', 'frontRaise', 'hspu', 'pushdown', 'overheadExt', 'kickback', 'skull'];
const PULL: Motion[] = ['row', 'cableRow', 'invertedRow', 'pullup', 'muscleUp', 'pulldown', 'shrug', 'reverseFly', 'facePull', 'uprightRow', 'curl', 'concentration', 'preacher', 'wristCurl', 'deadlift', 'sumo', 'rackPull'];
const LEGS: Motion[] = ['squat', 'frontSquat', 'goblet', 'ohSquat', 'bwSquat', 'hackSquat', 'pistol', 'jumpSquat', 'lunge', 'bulgarian', 'stepUp', 'legPress', 'legExt', 'legCurl', 'lyingLegCurl', 'calf', 'calfPress', 'seatedCalf', 'abduction', 'adduction', 'rdl', 'goodMorning', 'hipThrust', 'bridge', 'kickbackLeg', 'backExt'];

const SHOWCASE_OF = new Map<Motion, Showcase>([
  ...PUSH.map((m) => [m, 'bench'] as const),
  ...PULL.map((m) => [m, 'row'] as const),
  ...LEGS.map((m) => [m, 'squat'] as const)
]);

export const SHOWCASES: Showcase[] = ['bench', 'row', 'squat'];

/** Чего больше; при равенстве — то, с чего день начинается. Голосов нет — `null`. */
function vote(kinds: Showcase[]): Showcase | null {
  const votes: Record<Showcase, number> = { bench: 0, row: 0, squat: 0 };
  for (const kind of kinds) votes[kind] += 1;
  const best = Math.max(votes.bench, votes.row, votes.squat);
  if (best === 0) return null;
  const first = kinds[0];
  return votes[first] === best ? first : SHOWCASES.find((s) => votes[s] === best) ?? 'bench';
}

/**
 * Что показывать по списку упражнений дня: чего в нём больше. Пресс и кардио
 * голосом не считаются — день «пресс и кардио» выбирается по номеру дня,
 * одинаково у троих.
 */
export function showcaseFor(exerciseIds: string[], dayIndex: number): Showcase {
  const kinds = exerciseIds.flatMap((id) => {
    const motion = exerciseOf(id)?.motion;
    const kind = motion ? SHOWCASE_OF.get(motion) : undefined;
    return kind ? [kind] : [];
  });
  return vote(kinds) ?? SHOWCASES[((dayIndex % 3) + 3) % 3];
}

/*
 * Название дня на доске, вписанное руками, главнее упражнений: написал
 * «грудь» — мопс жмёт, даже если первым в дне стоит присед и даже если
 * упражнений в дне ещё нет. Слова — начала слов на всех четырёх языках сразу:
 * доску пишут как привыкли, а не на языке страницы. Руки, пресс и кардио
 * голосом не считаются, как и в упражнениях. `спин(?!н)` — не «спиннинг»,
 * `lats?$` — не «lateral raise», это плечи.
 */
const TITLE_WORDS: [RegExp, Showcase | 'rest'][] = [
  [/^(груд|плеч|триц|дельт|жим|отжим|віджим|брус|верх|chest|pec|shoulder|delt|tricep|push|bench|press|dips?$|upper|brust|schulter|trizeps|dr(ü|ue)ck|bankdr|oberk(ö|oe)rper)/u, 'bench'],
  [/^(спин(?!н)|тяг|подтяг|підтяг|биц|біц|широч|трапец|станов|back|lats?$|bicep|pull|row|deadlift|chin|traps?$|r(ü|ue)cken|bizeps|zug|zieh|klimmz|kreuzheb|rudern|latzug)/u, 'row'],
  [/^(ног|ніг|присед|присід|бедр|стегн|ягодиц|сідниц|икр|литк|квадр|низ|выпад|випад|leg|squat|glute|quad|hamstr|calf|calv|lower|lunge|rdl$|bein|kniebeug|po$|ges(ä|ae)(ß|ss)|wade|oberschenkel|unterk(ö|oe)rper|ausfallschritt)/u, 'squat'],
  [/^(отдых|выходн|восстан|відпоч|вихідн|віднов|rest|off$|recover|ruhe|pause$|frei$|erhol)/u, 'rest']
];

/** Что значит вписанное название: упражнение подвала, «отдых» или ничего. */
export function showcaseOfTitle(title: string): Showcase | 'rest' | null {
  const hits = title
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^\p{L}]+/u)
    .map((word) => TITLE_WORDS.find(([pattern]) => pattern.test(word))?.[1]);
  return vote(hits.filter((hit): hit is Showcase => hit !== undefined && hit !== 'rest')) ?? (hits.includes('rest') ? 'rest' : null);
}

/**
 * День в зале или нет: на доске есть упражнения или вписано название — и это
 * не «отдых». Одно название без упражнений — тоже день в зале: написал
 * «грудь» и ещё не расписал, что жать.
 */
export function trainsOn(title: string, exercises: number): boolean {
  return showcaseOfTitle(title) !== 'rest' && (exercises > 0 || /\p{L}/u.test(title));
}

/** Упражнение дня по дню доски: вписанное название главнее упражнений. */
export function showcaseOfDay(title: string, exerciseIds: string[], dayIndex: number): Showcase {
  const named = showcaseOfTitle(title);
  return named && named !== 'rest' ? named : showcaseFor(exerciseIds, dayIndex);
}

/** Оценка максимума на один раз по Эпли. Для сравнения подходов, не для заявок. */
/**
 * Подгруппы мышц для выбора упражнения: плечи — передняя, средняя и задняя
 * дельта, грудь — верх, середина и низ, и так далее (1.53, просьба владельца).
 * Выводятся из движения, а не вписаны в каждое из 252 упражнений: жим на
 * наклонной — верх груди, махи — средняя дельта, тяга лицом — задняя. Новое
 * упражнение со знакомым движением попадает в подгруппу само.
 */
export const SUBGROUPS = {
  chest: ['upperChest', 'midChest', 'lowerChest'],
  shoulders: ['frontDelt', 'sideDelt', 'rearDelt'],
  back: ['lats', 'midBack', 'traps', 'lowerBack'],
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'calves', 'adductors']
} as const;
export type Subgroup = (typeof SUBGROUPS)[keyof typeof SUBGROUPS][number];
export const subgroupsOf = (muscle: Muscle | null): readonly Subgroup[] =>
  muscle && muscle in SUBGROUPS ? SUBGROUPS[muscle as keyof typeof SUBGROUPS] : [];

/** Одно движение у разных мышц — разное: жим лёжа у груди — середина, узким хватом у рук — трицепс. */
const BY_MOTION: Partial<Record<Muscle, Partial<Record<Motion, Subgroup>>>> = {
  chest: {
    bench: 'midChest', floorPress: 'midChest', fly: 'midChest', cableFly: 'midChest', pecDeck: 'midChest', chestPress: 'midChest',
    pushup: 'midChest', kneePushup: 'midChest', pullover: 'midChest', incline: 'upperChest', inclineFly: 'upperChest', decline: 'lowerChest', dip: 'lowerChest'
  },
  shoulders: {
    ohp: 'frontDelt', seatedPress: 'frontDelt', pushPress: 'frontDelt', frontRaise: 'frontDelt', hspu: 'frontDelt',
    raise: 'sideDelt', uprightRow: 'sideDelt', reverseFly: 'rearDelt', facePull: 'rearDelt'
  },
  back: {
    pullup: 'lats', muscleUp: 'lats', pulldown: 'lats', pullover: 'lats', row: 'midBack', cableRow: 'midBack', invertedRow: 'midBack',
    shrug: 'traps', deadlift: 'lowerBack', rackPull: 'lowerBack', goodMorning: 'lowerBack', backExt: 'lowerBack', superman: 'lowerBack'
  },
  arms: {
    curl: 'biceps', preacher: 'biceps', concentration: 'biceps', wristCurl: 'forearms', bench: 'triceps', pushdown: 'triceps',
    overheadExt: 'triceps', skull: 'triceps', kickback: 'triceps', benchDip: 'triceps', dip: 'triceps'
  },
  legs: {
    squat: 'quads', bwSquat: 'quads', hackSquat: 'quads', frontSquat: 'quads', ohSquat: 'quads', goblet: 'quads', deadlift: 'quads',
    pistol: 'quads', jumpSquat: 'quads', legPress: 'quads', lunge: 'quads', bulgarian: 'quads', stepUp: 'quads', legExt: 'quads',
    legCurl: 'hamstrings', lyingLegCurl: 'hamstrings', backExt: 'hamstrings', adduction: 'adductors', sumo: 'adductors',
    calf: 'calves', calfPress: 'calves', seatedCalf: 'calves'
  }
};

export function subgroupOf(e: Exercise): Subgroup | null {
  if (e.id === 'incline-chest-press-machine') return 'upperChest';
  // Обратный хват сгибаний нагружает в первую очередь предплечье.
  if (e.muscle === 'arms' && e.id.includes('reverse')) return 'forearms';
  return BY_MOTION[e.muscle]?.[e.motion] ?? null;
}

export const oneRepMax = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));
