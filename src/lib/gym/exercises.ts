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

export const exerciseOf = (id: string): Exercise | undefined => BY_ID.get(id);
export const isExercise = (id: string) => BY_ID.has(id);

/** Название на языке страницы. Неизвестный id — как есть: подход переживёт выбывшее упражнение. */
export const exerciseName = (id: string, locale: Locale) => BY_ID.get(id)?.name[locale] ?? id;

/** Что пишется в подходе. Неизвестное упражнение — по-старому, вес и повторы. */
export const kindOf = (id: string): Kind => BY_ID.get(id)?.kind ?? 'weight';
/** Подход, у которого есть повторы, а не время. */
export const hasReps = (kind: Kind) => kind === 'weight' || kind === 'body' || kind === 'assisted';
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
    const m = BY_ID.get(id)?.muscle;
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
    const motion = BY_ID.get(id)?.motion;
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

type Cue = Record<Locale, [string, string]>;

/** Близнецы по технике говорят одно и то же. */
const CUE_ALIAS: Partial<Record<Motion, Motion>> = {
  inclineFly: 'fly',
  calfPress: 'calf',
  hangKnee: 'hangRaise',
  treadmill: 'run',
  bridge: 'hipThrust'
};

/**
 * Техника, которую мопс проговаривает, показывая движение. Две строки на
 * движение — больше под анимацией не читают. Словами тренера, а не учебника.
 */
const CUES: Partial<Record<Motion, Cue>> = {
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
  decline: {
    ru: ['ноги зацеплены за валики, таз прижат', 'гриф опускай к низу груди, не к шее'],
    en: ['feet hooked under the rollers, hips down', 'lower the bar to the bottom of the chest, not the neck'],
    uk: ['ноги зачеплені за валики, таз притиснутий', 'гриф опускай до низу грудей, не до шиї'],
    de: ['füße unter den rollen, hüfte unten', 'stange zur unteren brust, nicht zum hals']
  },
  floorPress: {
    ru: ['опускай, пока локти мягко не лягут на пол', 'на полу пауза, потом жми без отбива'],
    en: ['lower until the elbows rest softly on the floor', 'pause there, then press without bouncing'],
    uk: ['опускай, поки лікті м’яко не ляжуть на підлогу', 'на підлозі пауза, потім тисни без відбиву'],
    de: ['runter, bis die ellbogen sanft am boden liegen', 'kurz halten, dann ohne abfedern drücken']
  },
  fly: {
    ru: ['локти чуть согнуты и не меняют угол', 'разводи до растяжения груди, не ниже плеч'],
    en: ['elbows slightly bent, the angle never changes', 'open until the chest stretches, not below the shoulders'],
    uk: ['лікті трохи зігнуті й не змінюють кута', 'розводь до розтягнення грудей, не нижче плечей'],
    de: ['ellbogen leicht gebeugt, der winkel bleibt', 'öffnen bis zur brustdehnung, nicht unter schulterhöhe']
  },
  cableFly: {
    ru: ['шаг вперёд, корпус чуть наклонён', 'своди руки дугой, как будто обнимаешь бочку'],
    en: ['step forward, lean the torso slightly', 'bring the hands together in an arc, like hugging a barrel'],
    uk: ['крок уперед, корпус трохи нахилений', 'зводь руки дугою, наче обіймаєш бочку'],
    de: ['schritt nach vorn, oberkörper leicht geneigt', 'hände im bogen zusammen, wie um ein fass']
  },
  pecDeck: {
    ru: ['спина прижата, грудь вперёд', 'своди медленно и сожми грудь в конце'],
    en: ['back against the pad, chest up', 'bring the arms in slowly and squeeze at the end'],
    uk: ['спина притиснута, груди вперед', 'зводь повільно й стисни груди в кінці'],
    de: ['rücken am polster, brust raus', 'langsam zusammenführen, am ende die brust anspannen']
  },
  chestPress: {
    ru: ['рукояти на уровне середины груди', 'лопатки сведены, локти не задирай'],
    en: ['handles level with the middle of the chest', 'shoulder blades back, do not flare the elbows high'],
    uk: ['руків’я на рівні середини грудей', 'лопатки зведені, лікті не задирай'],
    de: ['griffe auf höhe der brustmitte', 'schulterblätter zurück, ellbogen nicht hochziehen']
  },
  pullover: {
    ru: ['локти чуть согнуты, гантель за голову по дуге', 'таз не поднимай, рёбра вниз'],
    en: ['elbows soft, take the weight back over the head in an arc', 'hips stay down, ribs down'],
    uk: ['лікті трохи зігнуті, гантель за голову по дузі', 'таз не піднімай, ребра вниз'],
    de: ['ellbogen leicht gebeugt, gewicht im bogen hinter den kopf', 'hüfte bleibt unten, rippen unten']
  },
  pushup: {
    ru: ['тело — одна доска от пяток до макушки', 'грудь до пола, локти не в стороны'],
    en: ['one straight plank from heels to head', 'chest to the floor, elbows not flared'],
    uk: ['тіло — одна дошка від п’ят до маківки', 'груди до підлоги, лікті не в сторони'],
    de: ['ein brett von den fersen bis zum kopf', 'brust zum boden, ellbogen nicht ausstellen']
  },
  kneePushup: {
    ru: ['от колен до макушки — прямая линия', 'грудь к полу, таз не оттопыривай'],
    en: ['a straight line from knees to head', 'chest to the floor, hips do not stick up'],
    uk: ['від колін до маківки — пряма лінія', 'груди до підлоги, таз не відкопилюй'],
    de: ['gerade linie von den knien bis zum kopf', 'brust zum boden, hüfte nicht hochstrecken']
  },
  dip: {
    ru: ['опускайся, пока плечо не станет параллельно полу', 'плечи вниз, от ушей подальше'],
    en: ['go down until the upper arm is parallel to the floor', 'shoulders down, away from the ears'],
    uk: ['опускайся, поки плече не стане паралельно підлозі', 'плечі вниз, подалі від вух'],
    de: ['runter, bis der oberarm parallel zum boden ist', 'schultern runter, weg von den ohren']
  },
  benchDip: {
    ru: ['спина вплотную к скамье', 'опускайся до прямого угла в локтях, не ниже'],
    en: ['keep the back close to the bench', 'lower to a right angle at the elbows, no deeper'],
    uk: ['спина впритул до лави', 'опускайся до прямого кута в ліктях, не нижче'],
    de: ['rücken nah an der bank', 'runter bis zum rechten winkel im ellbogen, nicht tiefer']
  },
  ohp: {
    ru: ['ягодицы и пресс напряжены, поясница не прогибается', 'гриф идёт по прямой, голова уходит назад и возвращается'],
    en: ['glutes and abs tight, no arching the lower back', 'bar travels straight; move the head back, then through'],
    uk: ['сідниці й прес напружені, поперек не прогинається', 'гриф іде по прямій, голова відходить назад і повертається'],
    de: ['po und bauch fest, kein hohlkreuz', 'stange gerade hoch, kopf kurz zurück und wieder durch']
  },
  seatedPress: {
    ru: ['спина прижата к спинке, поясница не прогибается', 'вниз до уровня ушей, вверх без удара в замок'],
    en: ['back flat on the pad, no arching', 'down to ear level, up without slamming the lockout'],
    uk: ['спина притиснута до спинки, поперек не прогинається', 'вниз до рівня вух, угору без удару в замок'],
    de: ['rücken am polster, kein hohlkreuz', 'runter bis ohrhöhe, oben nicht hart durchdrücken']
  },
  pushPress: {
    ru: ['короткий подсед коленями, корпус вертикально', 'толкни ногами — и дожми руками'],
    en: ['short dip at the knees, torso upright', 'drive with the legs, finish with the arms'],
    uk: ['короткий підсід колінами, корпус вертикально', 'штовхни ногами — і дотисни руками'],
    de: ['kurz in die knie, oberkörper aufrecht', 'aus den beinen stoßen, mit den armen nachdrücken']
  },
  raise: {
    ru: ['локти чуть согнуты, ведёт локоть, а не кисть', 'до уровня плеч и без раскачки'],
    en: ['elbows soft, lead with the elbow, not the hand', 'up to shoulder height, no swinging'],
    uk: ['лікті трохи зігнуті, веде лікоть, а не кисть', 'до рівня плечей і без розгойдування'],
    de: ['ellbogen leicht gebeugt, der ellbogen führt', 'bis schulterhöhe, ohne schwung']
  },
  frontRaise: {
    ru: ['поднимай до уровня глаз, не выше', 'корпус не раскачивай, руки почти прямые'],
    en: ['raise to eye level, no higher', 'no swinging, arms almost straight'],
    uk: ['піднімай до рівня очей, не вище', 'корпус не розгойдуй, руки майже прямі'],
    de: ['bis augenhöhe heben, nicht höher', 'kein schwung, arme fast gestreckt']
  },
  reverseFly: {
    ru: ['наклон почти до параллели, спина ровная', 'разводи локтями назад, лопатки сводятся в конце'],
    en: ['hinge almost to parallel, back flat', 'lead with the elbows, squeeze the shoulder blades at the end'],
    uk: ['нахил майже до паралелі, спина рівна', 'розводь ліктями назад, лопатки зводяться в кінці'],
    de: ['fast parallel vorbeugen, rücken gerade', 'mit den ellbogen führen, am ende schulterblätter zusammen']
  },
  facePull: {
    ru: ['трос на уровне лица, тяни к глазам', 'локти высоко, в конце кисти расходятся к ушам'],
    en: ['cable at face height, pull toward the eyes', 'elbows high, hands finish beside the ears'],
    uk: ['трос на рівні обличчя, тягни до очей', 'лікті високо, у кінці кисті розходяться до вух'],
    de: ['seil auf gesichtshöhe, zu den augen ziehen', 'ellbogen hoch, hände enden neben den ohren']
  },
  uprightRow: {
    ru: ['ведут локти, гриф близко к телу', 'локти не выше плеч — плечам так спокойнее'],
    en: ['the elbows lead, bar close to the body', 'elbows no higher than the shoulders — easier on them'],
    uk: ['ведуть лікті, гриф близько до тіла', 'лікті не вище плечей — плечам так спокійніше'],
    de: ['ellbogen führen, stange nah am körper', 'ellbogen nicht über schulterhöhe, das schont die schultern']
  },
  hspu: {
    ru: ['руки чуть шире плеч, ладони под плечами', 'опускайся макушкой к полу медленно, корпус прямой'],
    en: ['hands just wider than the shoulders', 'lower the head to the floor slowly, body straight'],
    uk: ['руки трохи ширше плечей, долоні під плечима', 'опускайся маківкою до підлоги повільно, корпус прямий'],
    de: ['hände knapp schulterbreit', 'kopf langsam zum boden, körper gerade']
  },
  shrug: {
    ru: ['плечи строго вверх к ушам, без вращения', 'наверху пауза, вниз медленно'],
    en: ['shoulders straight up to the ears, no rolling', 'pause at the top, lower slowly'],
    uk: ['плечі строго вгору до вух, без обертання', 'нагорі пауза, вниз повільно'],
    de: ['schultern gerade zu den ohren, nicht kreisen', 'oben halten, langsam runter']
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
  goblet: {
    ru: ['гиря у груди, локти между коленями внизу', 'садись глубоко, пятки в полу'],
    en: ['weight at the chest, elbows inside the knees at the bottom', 'sit deep, heels down'],
    uk: ['гиря біля грудей, лікті між колінами внизу', 'сідай глибоко, п’яти в підлозі'],
    de: ['gewicht an der brust, ellbogen unten zwischen den knien', 'tief sitzen, fersen unten']
  },
  ohSquat: {
    ru: ['гриф над серединой стопы, руки прямые и в замке', 'хват широкий, подмышки смотрят вперёд'],
    en: ['bar over mid-foot, arms locked', 'wide grip, armpits facing forward'],
    uk: ['гриф над серединою стопи, руки прямі й у замку', 'хват широкий, пахви дивляться вперед'],
    de: ['stange über der fußmitte, arme durchgestreckt', 'breiter griff, achseln zeigen nach vorn']
  },
  bwSquat: {
    ru: ['руки вперёд для баланса, вес на пятках', 'колени по носкам, садись как на стул'],
    en: ['arms forward for balance, weight on the heels', 'knees track the toes, sit back like into a chair'],
    uk: ['руки вперед для балансу, вага на п’ятах', 'коліна по шкарпетках, сідай як на стілець'],
    de: ['arme nach vorn, gewicht auf den fersen', 'knie über den zehen, wie auf einen stuhl setzen']
  },
  hackSquat: {
    ru: ['спина и таз прижаты к спинке', 'стопы на середине платформы, колени не сводятся'],
    en: ['back and hips stay on the pad', 'feet mid-platform, knees do not cave in'],
    uk: ['спина й таз притиснуті до спинки', 'стопи посередині платформи, коліна не зводяться'],
    de: ['rücken und hüfte am polster', 'füße mittig, knie fallen nicht nach innen']
  },
  pistol: {
    ru: ['свободная нога вперёд, руки вперёд для баланса', 'пятка опорной ноги не отрывается'],
    en: ['free leg forward, arms forward for balance', 'the standing heel stays down'],
    uk: ['вільна нога вперед, руки вперед для балансу', 'п’ята опорної ноги не відривається'],
    de: ['freies bein nach vorn, arme zum ausgleich vor', 'die ferse des standbeins bleibt unten']
  },
  jumpSquat: {
    ru: ['приземляйся мягко, сразу в присед', 'выпрыгивай взрывом, руки помогают'],
    en: ['land softly, straight back into the squat', 'jump explosively, swing the arms'],
    uk: ['приземляйся м’яко, одразу в присід', 'вистрибуй вибухово, руки допомагають'],
    de: ['weich landen, direkt in die hocke', 'explosiv abspringen, arme schwingen mit']
  },
  lunge: {
    ru: ['шаг широкий, заднее колено почти касается пола', 'корпус прямо, переднее колено над стопой'],
    en: ['long step, back knee nearly touches the floor', 'torso upright, front knee over the foot'],
    uk: ['крок широкий, заднє коліно майже торкається підлоги', 'корпус прямо, переднє коліно над стопою'],
    de: ['langer schritt, hinteres knie fast am boden', 'oberkörper aufrecht, vorderes knie über dem fuß']
  },
  bulgarian: {
    ru: ['задняя нога на скамье, вес на передней', 'опускайся вертикально, колено над стопой'],
    en: ['back foot on the bench, weight on the front leg', 'drop straight down, knee over the foot'],
    uk: ['задня нога на лаві, вага на передній', 'опускайся вертикально, коліно над стопою'],
    de: ['hinterer fuß auf der bank, gewicht vorn', 'gerade runter, knie über dem fuß']
  },
  stepUp: {
    ru: ['вся стопа на тумбе, толкайся ей, а не задней', 'вниз медленно, под контролем'],
    en: ['whole foot on the box, drive through it, not the back leg', 'step down slowly, under control'],
    uk: ['уся стопа на тумбі, штовхайся нею, а не задньою', 'вниз повільно, під контролем'],
    de: ['ganzer fuß auf der box, damit hochdrücken', 'langsam und kontrolliert runter']
  },
  legPress: {
    ru: ['поясница прижата к спинке всю амплитуду', 'колени не выпрямляй до щелчка'],
    en: ['lower back stays on the pad the whole way', 'do not snap the knees straight at the top'],
    uk: ['поперек притиснутий до спинки всю амплітуду', 'коліна не випрямляй до клацання'],
    de: ['unterer rücken bleibt am polster', 'knie oben nicht durchdrücken']
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
  lyingLegCurl: {
    ru: ['таз прижат к скамье, не отрывай', 'сгибай до упора, разгибай медленно'],
    en: ['hips pinned to the bench', 'curl all the way up, lower slowly'],
    uk: ['таз притиснутий до лави, не відривай', 'згинай до упору, розгинай повільно'],
    de: ['hüfte bleibt auf der bank', 'ganz beugen, langsam strecken']
  },
  calf: {
    ru: ['внизу полное растяжение, пауза', 'наверху на самые носки, без пружинки'],
    en: ['full stretch at the bottom, pause', 'all the way onto the toes, no bouncing'],
    uk: ['внизу повне розтягнення, пауза', 'нагорі на самі носки, без пружинки'],
    de: ['unten volle dehnung, pause', 'oben ganz auf die zehen, nicht federn']
  },
  seatedCalf: {
    ru: ['валик на коленях, носки на краю платформы', 'внизу растяжение, наверху пауза'],
    en: ['pad over the knees, balls of the feet on the edge', 'stretch at the bottom, pause at the top'],
    uk: ['валик на колінах, носки на краю платформи', 'внизу розтягнення, нагорі пауза'],
    de: ['polster auf den knien, ballen an der kante', 'unten dehnen, oben halten']
  },
  abduction: {
    ru: ['спина прижата, разводи ноги без рывка', 'в крайней точке задержись на секунду'],
    en: ['back on the pad, push the legs out without jerking', 'hold the end position for a second'],
    uk: ['спина притиснута, розводь ноги без ривка', 'у крайній точці затримайся на секунду'],
    de: ['rücken am polster, beine ohne ruck öffnen', 'außen eine sekunde halten']
  },
  adduction: {
    ru: ['своди ноги медленно, без удара подушек', 'назад отпускай под контролем, до лёгкого растяжения'],
    en: ['bring the legs in slowly, do not slam the pads', 'let them back out under control to a light stretch'],
    uk: ['зводь ноги повільно, без удару подушок', 'назад відпускай під контролем, до легкого розтягнення'],
    de: ['beine langsam schließen, polster nicht zuschlagen', 'kontrolliert zurück bis zur leichten dehnung']
  },
  deadlift: {
    ru: ['гриф над серединой стопы и скользит по ногам', 'спина ровная, тянешь ногами, а не поясницей'],
    en: ['bar over mid-foot, dragging along the legs', 'flat back; push with the legs, not the lower back'],
    uk: ['гриф над серединою стопи й ковзає по ногах', 'спина рівна, тягнеш ногами, а не попереком'],
    de: ['stange über der fußmitte, nah am bein', 'rücken gerade, aus den beinen drücken']
  },
  sumo: {
    ru: ['стопы широко, носки врозь, хват внутри коленей', 'колени наружу, корпус вертикальнее, чем в классике'],
    en: ['wide stance, toes out, grip inside the knees', 'push the knees out, torso more upright than conventional'],
    uk: ['стопи широко, носки врозтіч, хват усередині колін', 'коліна назовні, корпус вертикальніший, ніж у класиці'],
    de: ['breiter stand, zehen nach außen, griff innerhalb der knie', 'knie nach außen, oberkörper aufrechter als klassisch']
  },
  rackPull: {
    ru: ['гриф чуть ниже колен, спина ровная', 'наверху выпрямись, не заваливайся назад'],
    en: ['bar just below the knees, back flat', 'stand tall at the top, no leaning back'],
    uk: ['гриф трохи нижче колін, спина рівна', 'нагорі випрямись, не завалюйся назад'],
    de: ['stange knapp unter den knien, rücken gerade', 'oben aufrichten, nicht nach hinten lehnen']
  },
  rdl: {
    ru: ['колени почти прямые, таз уходит назад', 'опускай до растяжения бицепса бедра, спина ровная'],
    en: ['knees soft, push the hips back', 'lower until the hamstrings stretch, back flat'],
    uk: ['коліна майже прямі, таз іде назад', 'опускай до розтягнення біцепса стегна, спина рівна'],
    de: ['knie leicht gebeugt, hüfte nach hinten', 'runter bis zur dehnung hinten, rücken gerade']
  },
  goodMorning: {
    ru: ['гриф на трапециях, колени чуть согнуты', 'наклоняйся тазом назад, спина ровная'],
    en: ['bar on the traps, knees soft', 'hinge by pushing the hips back, back flat'],
    uk: ['гриф на трапеціях, коліна трохи зігнуті', 'нахиляйся тазом назад, спина рівна'],
    de: ['stange auf dem trapez, knie leicht gebeugt', 'hüfte nach hinten schieben, rücken gerade']
  },
  hipThrust: {
    ru: ['подбородок к груди, рёбра вниз', 'наверху сожми ягодицы, не прогибай поясницу'],
    en: ['chin tucked, ribs down', 'squeeze the glutes at the top, no lower-back arch'],
    uk: ['підборіддя до грудей, ребра вниз', 'нагорі стисни сідниці, не прогинай поперек'],
    de: ['kinn zur brust, rippen unten', 'oben den po anspannen, kein hohlkreuz']
  },
  kickbackLeg: {
    ru: ['корпус неподвижен, работает только ягодица', 'наверху сожми, поясницу не прогибай'],
    en: ['torso still, only the glute works', 'squeeze at the top, do not arch the lower back'],
    uk: ['корпус нерухомий, працює тільки сідниця', 'нагорі стисни, поперек не прогинай'],
    de: ['oberkörper ruhig, nur der po arbeitet', 'oben anspannen, kein hohlkreuz']
  },
  backExt: {
    ru: ['валик под тазом, руки у груди', 'поднимайся до прямой линии, не выше'],
    en: ['pad under the hips, hands at the chest', 'rise to a straight line, no further'],
    uk: ['валик під тазом, руки біля грудей', 'піднімайся до прямої лінії, не вище'],
    de: ['polster unter der hüfte, hände an der brust', 'bis zur geraden linie heben, nicht weiter']
  },
  superman: {
    ru: ['поднимай руки и ноги одновременно', 'взгляд в пол, шею не задирай'],
    en: ['lift arms and legs together', 'eyes on the floor, do not crank the neck'],
    uk: ['піднімай руки й ноги одночасно', 'погляд у підлогу, шию не задирай'],
    de: ['arme und beine gleichzeitig heben', 'blick zum boden, nacken lang']
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
  invertedRow: {
    ru: ['тело прямое от пяток до плеч', 'тяни грудь к перекладине, лопатки сводятся'],
    en: ['body straight from heels to shoulders', 'pull the chest to the bar, squeeze the shoulder blades'],
    uk: ['тіло пряме від п’ят до плечей', 'тягни груди до поперечини, лопатки зводяться'],
    de: ['körper gerade von fersen bis schultern', 'brust zur stange ziehen, schulterblätter zusammen']
  },
  pullup: {
    ru: ['начинай с лопаток, потом руки', 'подбородок над перекладиной, вниз до прямых рук'],
    en: ['start with the shoulder blades, then the arms', 'chin over the bar, down to straight arms'],
    uk: ['починай з лопаток, потім руки', 'підборіддя над поперечиною, вниз до прямих рук'],
    de: ['erst die schulterblätter, dann die arme', 'kinn über die stange, runter bis die arme gestreckt sind']
  },
  muscleUp: {
    ru: ['мощная тяга к низу груди, а не к подбородку', 'переход через гриф быстрый, локти вперёд'],
    en: ['pull hard to the lower chest, not the chin', 'quick transition over the bar, elbows forward'],
    uk: ['потужна тяга до низу грудей, а не до підборіддя', 'перехід через гриф швидкий, лікті вперед'],
    de: ['kräftig zur unteren brust ziehen, nicht zum kinn', 'schneller übergang über die stange, ellbogen nach vorn']
  },
  pulldown: {
    ru: ['гриф к верху груди, не за голову', 'корпус чуть назад и неподвижен'],
    en: ['bar to the upper chest, never behind the neck', 'lean back slightly and stay still'],
    uk: ['гриф до верху грудей, не за голову', 'корпус трохи назад і нерухомий'],
    de: ['stange zur oberen brust, nie in den nacken', 'leicht zurücklehnen und ruhig bleiben']
  },
  curl: {
    ru: ['локти прижаты и стоят на месте', 'без раскачки корпусом, вниз под контролем'],
    en: ['elbows pinned and still', 'no body swing, control the way down'],
    uk: ['лікті притиснуті й стоять на місці', 'без розгойдування корпусом, вниз під контролем'],
    de: ['ellbogen fest am körper', 'kein schwung, kontrolliert ablassen']
  },
  concentration: {
    ru: ['локоть упирается во внутреннюю часть бедра', 'сгибай медленно, корпусом не помогай'],
    en: ['elbow braced on the inner thigh', 'curl slowly, the torso does not help'],
    uk: ['лікоть упирається у внутрішній бік стегна', 'згинай повільно, корпусом не допомагай'],
    de: ['ellbogen an der innenseite des oberschenkels', 'langsam beugen, der oberkörper hilft nicht']
  },
  preacher: {
    ru: ['плечи лежат на подушке всю амплитуду', 'внизу не разгибай до щелчка в локте'],
    en: ['upper arms stay on the pad the whole way', 'do not snap the elbows straight at the bottom'],
    uk: ['плечі лежать на подушці всю амплітуду', 'внизу не розгинай до клацання в лікті'],
    de: ['oberarme bleiben auf dem polster', 'unten den ellbogen nicht durchschnappen']
  },
  wristCurl: {
    ru: ['предплечья на бёдрах, работают только запястья', 'медленно вверх и вниз, без рывков'],
    en: ['forearms on the thighs, only the wrists move', 'slow up and down, no jerking'],
    uk: ['передпліччя на стегнах, працюють тільки зап’ястя', 'повільно вгору й униз, без ривків'],
    de: ['unterarme auf den oberschenkeln, nur die handgelenke', 'langsam hoch und runter, ohne ruck']
  },
  pushdown: {
    ru: ['локти прижаты к бокам', 'внизу дожимай до прямых рук'],
    en: ['elbows locked to the sides', 'finish with straight arms at the bottom'],
    uk: ['лікті притиснуті до боків', 'внизу дотискай до прямих рук'],
    de: ['ellbogen an den seiten', 'unten bis die arme gestreckt sind']
  },
  overheadExt: {
    ru: ['локти смотрят вверх и не расходятся', 'опускай за голову до растяжения трицепса'],
    en: ['elbows point up and stay narrow', 'lower behind the head until the triceps stretch'],
    uk: ['лікті дивляться вгору й не розходяться', 'опускай за голову до розтягнення трицепса'],
    de: ['ellbogen zeigen nach oben und bleiben eng', 'hinter den kopf bis zur trizepsdehnung']
  },
  kickback: {
    ru: ['плечо параллельно полу и неподвижно', 'разгибай до прямой руки, задержись наверху'],
    en: ['upper arm parallel to the floor and still', 'extend to a straight arm, pause at the top'],
    uk: ['плече паралельно підлозі й нерухоме', 'розгинай до прямої руки, затримайся нагорі'],
    de: ['oberarm parallel zum boden und ruhig', 'bis zum gestreckten arm, oben halten']
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
  sidePlank: {
    ru: ['локоть под плечом, тело одной линией', 'таз не опускается, держи бок напряжённым'],
    en: ['elbow under the shoulder, body in one line', 'hips do not drop, keep the side braced'],
    uk: ['лікоть під плечем, тіло однією лінією', 'таз не опускається, тримай бік напруженим'],
    de: ['ellbogen unter der schulter, körper in einer linie', 'hüfte sinkt nicht, seite fest']
  },
  reversePlank: {
    ru: ['опора на ладони и пятки, грудь вверх', 'таз поднят — от пяток до плеч прямая'],
    en: ['on hands and heels, chest up', 'hips lifted: a straight line from heels to shoulders'],
    uk: ['опора на долоні й п’яти, груди вгору', 'таз піднятий — від п’ят до плечей пряма'],
    de: ['auf händen und fersen, brust nach oben', 'hüfte oben: gerade linie von fersen bis schultern']
  },
  crunch: {
    ru: ['скручивайся, а не тяни шею руками', 'поясница остаётся на полу'],
    en: ['curl up, do not pull on the neck', 'lower back stays on the floor'],
    uk: ['скручуйся, а не тягни шию руками', 'поперек лишається на підлозі'],
    de: ['einrollen, nicht am nacken ziehen', 'unterer rücken bleibt am boden']
  },
  situp: {
    ru: ['стопы на полу, поднимайся скручиванием, а не рывком', 'вниз медленно, позвонок за позвонком'],
    en: ['feet on the floor, roll up rather than jerk up', 'lower slowly, one vertebra at a time'],
    uk: ['стопи на підлозі, піднімайся скручуванням, а не ривком', 'вниз повільно, хребець за хребцем'],
    de: ['füße am boden, aufrollen statt hochreißen', 'langsam ab, wirbel für wirbel']
  },
  vUp: {
    ru: ['руки и ноги поднимаются одновременно', 'тянись пальцами к носкам, вниз без падения'],
    en: ['arms and legs rise together', 'reach for the toes, lower without flopping'],
    uk: ['руки й ноги піднімаються одночасно', 'тягнися пальцями до носків, униз без падіння'],
    de: ['arme und beine gleichzeitig hoch', 'zu den zehen greifen, kontrolliert ablegen']
  },
  legRaise: {
    ru: ['поясница прижата к полу всё время', 'опускай ноги медленно, не бросай'],
    en: ['lower back pressed to the floor the whole time', 'lower the legs slowly, do not drop them'],
    uk: ['поперек притиснутий до підлоги весь час', 'опускай ноги повільно, не кидай'],
    de: ['unterer rücken bleibt am boden', 'beine langsam senken, nicht fallen lassen']
  },
  reverseCrunch: {
    ru: ['колени к груди, таз отрывается от пола', 'поднимай прессом, а не махом ног'],
    en: ['knees to the chest, hips curl off the floor', 'lift with the abs, not by swinging the legs'],
    uk: ['коліна до грудей, таз відривається від підлоги', 'піднімай пресом, а не махом ніг'],
    de: ['knie zur brust, hüfte rollt vom boden', 'mit dem bauch heben, nicht schwingen']
  },
  bicycle: {
    ru: ['локоть тянется к противоположному колену', 'поясница на полу, темп ровный'],
    en: ['elbow reaches for the opposite knee', 'lower back down, steady pace'],
    uk: ['лікоть тягнеться до протилежного коліна', 'поперек на підлозі, темп рівний'],
    de: ['ellbogen zum gegenüberliegenden knie', 'unterer rücken am boden, gleichmäßiges tempo']
  },
  hangRaise: {
    ru: ['не раскачивайся, поднимай ноги прессом', 'вниз медленно, без маятника'],
    en: ['no swinging, lift with the abs', 'lower slowly, no pendulum'],
    uk: ['не розгойдуйся, піднімай ноги пресом', 'вниз повільно, без маятника'],
    de: ['kein schwung, mit dem bauch heben', 'langsam runter, kein pendeln']
  },
  cableCrunch: {
    ru: ['таз неподвижен, скручивается только позвоночник', 'локти идут к коленям, голова не тянет'],
    en: ['hips still, only the spine curls', 'elbows travel to the knees, the head does not pull'],
    uk: ['таз нерухомий, скручується тільки хребет', 'лікті йдуть до колін, голова не тягне'],
    de: ['hüfte ruhig, nur die wirbelsäule rollt ein', 'ellbogen zu den knien, nicht mit dem kopf ziehen']
  },
  russianTwist: {
    ru: ['корпус отклонён назад, спина ровная', 'поворачивай плечи, а не только руки'],
    en: ['lean back with a straight back', 'turn the shoulders, not just the arms'],
    uk: ['корпус відхилений назад, спина рівна', 'повертай плечі, а не лише руки'],
    de: ['zurücklehnen, rücken gerade', 'die schultern drehen, nicht nur die arme']
  },
  twist: {
    ru: ['таз смотрит вперёд, поворачивается грудь', 'руки прямые, поворот без рывка'],
    en: ['hips face forward, the chest rotates', 'arms straight, rotate without jerking'],
    uk: ['таз дивиться вперед, повертаються груди', 'руки прямі, поворот без ривка'],
    de: ['hüfte zeigt nach vorn, die brust dreht', 'arme gestreckt, ohne ruck drehen']
  },
  sideBend: {
    ru: ['наклон строго в сторону, не вперёд', 'поднимайся за счёт противоположного бока'],
    en: ['bend straight to the side, not forward', 'come up using the opposite side'],
    uk: ['нахил строго вбік, не вперед', 'піднімайся за рахунок протилежного боку'],
    de: ['genau zur seite neigen, nicht nach vorn', 'mit der anderen seite aufrichten']
  },
  abWheel: {
    ru: ['пресс напряжён, поясница не проваливается', 'катись настолько далеко, насколько держишь спину'],
    en: ['abs braced, the lower back does not sag', 'roll out only as far as you can hold the back'],
    uk: ['прес напружений, поперек не провалюється', 'котись настільки далеко, наскільки тримаєш спину'],
    de: ['bauch fest, unterer rücken hängt nicht durch', 'nur so weit rollen, wie der rücken hält']
  },
  climber: {
    ru: ['плечи над кистями, таз не скачет', 'колени к груди по очереди, быстро'],
    en: ['shoulders over the hands, hips steady', 'drive the knees to the chest in turns, fast'],
    uk: ['плечі над кистями, таз не скаче', 'коліна до грудей по черзі, швидко'],
    de: ['schultern über den händen, hüfte ruhig', 'knie abwechselnd schnell zur brust']
  },
  clean: {
    ru: ['гриф идёт вплотную к телу', 'подрыв ногами и тазом, потом быстро подсесть под гриф'],
    en: ['the bar stays close to the body', 'extend hips and legs, then drop under the bar fast'],
    uk: ['гриф іде впритул до тіла', 'підрив ногами й тазом, потім швидко підсісти під гриф'],
    de: ['stange bleibt nah am körper', 'hüfte und beine strecken, dann schnell unter die stange']
  },
  snatch: {
    ru: ['хват широкий, гриф скользит по бёдрам', 'подрыв — и сразу уход под гриф на прямые руки'],
    en: ['wide grip, the bar brushes the thighs', 'explode, then drop under it onto straight arms'],
    uk: ['хват широкий, гриф ковзає по стегнах', 'підрив — і одразу під гриф на прямі руки'],
    de: ['breiter griff, stange streift die oberschenkel', 'explodieren, dann mit gestreckten armen darunter']
  },
  thruster: {
    ru: ['фронтальный присед и жим — одним движением', 'жми на инерции подъёма, не останавливайся'],
    en: ['front squat and press in one motion', 'press on the drive out of the squat, no pause'],
    uk: ['фронтальний присід і жим — одним рухом', 'тисни на інерції підйому, не зупиняйся'],
    de: ['frontkniebeuge und drücken in einer bewegung', 'den schwung aus der hocke nutzen, ohne pause']
  },
  kbSwing: {
    ru: ['это наклон тазом, а не присед', 'гирю бросает таз, руки только держат'],
    en: ['it is a hip hinge, not a squat', 'the hips throw the bell, the arms only hold it'],
    uk: ['це нахил тазом, а не присід', 'гирю кидає таз, руки тільки тримають'],
    de: ['hüftbeuge, keine kniebeuge', 'die hüfte wirft die kugel, die arme halten nur']
  },
  getUp: {
    ru: ['гиря над плечом всё время, рука прямая', 'взгляд на гирю, вставай по шагам без спешки'],
    en: ['bell stacked over the shoulder, arm straight', 'eyes on the bell, stand up step by step'],
    uk: ['гиря над плечем весь час, рука пряма', 'погляд на гирю, вставай по кроках без поспіху'],
    de: ['kugel immer über der schulter, arm gestreckt', 'blick zur kugel, schritt für schritt aufstehen']
  },
  burpee: {
    ru: ['в упоре тело прямое, грудь касается пола', 'выпрыгивай вверх с хлопком над головой'],
    en: ['straight plank at the bottom, chest touches the floor', 'jump up with a clap overhead'],
    uk: ['в упорі тіло пряме, груди торкаються підлоги', 'вистрибуй угору з оплеском над головою'],
    de: ['unten gerader stütz, brust berührt den boden', 'hochspringen mit klatschen über dem kopf']
  },
  boxJump: {
    ru: ['приземляйся мягко на всю стопу', 'спускайся шагом, а не прыжком назад'],
    en: ['land softly on the whole foot', 'step down, do not jump back'],
    uk: ['приземляйся м’яко на всю стопу', 'спускайся кроком, а не стрибком назад'],
    de: ['weich auf dem ganzen fuß landen', 'heruntersteigen, nicht zurückspringen']
  },
  jumpRope: {
    ru: ['крутят кисти, а не плечи', 'прыгай низко, на носках'],
    en: ['the wrists turn the rope, not the shoulders', 'jump low, on the balls of the feet'],
    uk: ['крутять кисті, а не плечі', 'стрибай низько, на носках'],
    de: ['die handgelenke drehen, nicht die schultern', 'flach springen, auf den ballen']
  },
  jumpingJack: {
    ru: ['руки и ноги расходятся одновременно', 'приземляйся на носки, колени мягкие'],
    en: ['arms and legs open together', 'land on the balls of the feet, knees soft'],
    uk: ['руки й ноги розходяться одночасно', 'приземляйся на носки, коліна м’які'],
    de: ['arme und beine gleichzeitig öffnen', 'auf den ballen landen, knie weich']
  },
  highKnees: {
    ru: ['колени до уровня таза', 'корпус прямо, руки работают в такт'],
    en: ['knees up to hip height', 'torso upright, arms in rhythm'],
    uk: ['коліна до рівня таза', 'корпус прямо, руки працюють у такт'],
    de: ['knie bis hüfthöhe', 'oberkörper aufrecht, arme im takt']
  },
  slam: {
    ru: ['мяч над головой, тянись всем телом', 'бросай в пол корпусом и тазом, а не руками'],
    en: ['ball overhead, reach with the whole body', 'slam with the torso and hips, not the arms'],
    uk: ['м’яч над головою, тягнися всім тілом', 'кидай у підлогу корпусом і тазом, а не руками'],
    de: ['ball über dem kopf, ganz strecken', 'mit rumpf und hüfte werfen, nicht mit den armen']
  },
  ropes: {
    ru: ['полуприсед, спина ровная', 'волны от плеч, ритм не сбивай'],
    en: ['half squat, flat back', 'waves from the shoulders, keep the rhythm'],
    uk: ['напівприсід, спина рівна', 'хвилі від плечей, ритм не збивай'],
    de: ['halbe hocke, rücken gerade', 'wellen aus den schultern, rhythmus halten']
  },
  run: {
    ru: ['стопа приземляется под тазом, а не далеко впереди', 'плечи расслаблены, руки под 90°'],
    en: ['the foot lands under the hips, not far ahead', 'relaxed shoulders, arms at 90°'],
    uk: ['стопа приземляється під тазом, а не далеко попереду', 'плечі розслаблені, руки під 90°'],
    de: ['der fuß landet unter der hüfte, nicht weit vorn', 'schultern locker, arme im 90°-winkel']
  },
  walk: {
    ru: ['шаг с пятки на носок', 'спина прямая, руки двигаются свободно'],
    en: ['roll from heel to toe', 'tall back, arms swing freely'],
    uk: ['крок із п’яти на носок', 'спина пряма, руки рухаються вільно'],
    de: ['von der ferse über den ballen abrollen', 'aufrecht gehen, arme schwingen locker']
  },
  elliptical: {
    ru: ['стопы целиком на педалях', 'корпус прямо, руки толкают и тянут поручни'],
    en: ['whole feet on the pedals', 'torso upright, arms push and pull the handles'],
    uk: ['стопи повністю на педалях', 'корпус прямо, руки штовхають і тягнуть поручні'],
    de: ['ganze füße auf den pedalen', 'oberkörper aufrecht, arme drücken und ziehen']
  },
  cycle: {
    ru: ['седло на высоте таза: внизу колено почти прямое', 'крути ровно, не раскачивай корпус'],
    en: ['saddle at hip height: knee almost straight at the bottom', 'pedal smoothly, do not rock the torso'],
    uk: ['сідло на висоті таза: внизу коліно майже пряме', 'крути рівно, не розгойдуй корпус'],
    de: ['sattel auf hüfthöhe: unten knie fast gestreckt', 'gleichmäßig treten, oberkörper ruhig']
  },
  rowErg: {
    ru: ['порядок: ноги, корпус, руки — обратно наоборот', 'толкай ногами, а не тяни спиной'],
    en: ['order: legs, body, arms — and back in reverse', 'drive with the legs, do not yank with the back'],
    uk: ['порядок: ноги, корпус, руки — назад навпаки', 'штовхай ногами, а не тягни спиною'],
    de: ['reihenfolge: beine, rumpf, arme — zurück umgekehrt', 'mit den beinen schieben, nicht mit dem rücken reißen']
  },
  swim: {
    ru: ['тело вытянуто у поверхности, лицо в воде', 'вдох в сторону на гребке, без подъёма головы'],
    en: ['body long at the surface, face in the water', 'breathe to the side with the stroke, do not lift the head'],
    uk: ['тіло витягнуте біля поверхні, обличчя у воді', 'вдих убік на гребку, без підйому голови'],
    de: ['körper lang an der oberfläche, gesicht im wasser', 'zur seite atmen, kopf nicht heben']
  },
  skate: {
    ru: ['колени согнуты, вес над серединой стопы', 'толчок в сторону-назад, руки в такт'],
    en: ['knees bent, weight over mid-foot', 'push out to the side and back, arms in rhythm'],
    uk: ['коліна зігнуті, вага над серединою стопи', 'поштовх убік-назад, руки в такт'],
    de: ['knie gebeugt, gewicht über der fußmitte', 'zur seite und nach hinten abdrücken, arme im takt']
  },
  yoga: {
    ru: ['дыши медленно и ровно', 'тянись до приятного напряжения, не до боли'],
    en: ['breathe slowly and evenly', 'stretch to a pleasant tension, never to pain'],
    uk: ['дихай повільно й рівно', 'тягнися до приємної напруги, не до болю'],
    de: ['langsam und gleichmäßig atmen', 'bis zu angenehmer spannung dehnen, nie bis zum schmerz']
  }
};

/** Две строки техники на языке страницы; у близнецов — общие. */
export const cuesOf = (motion: Motion, locale: Locale): [string, string] => (CUES[motion] ?? CUES[CUE_ALIAS[motion] ?? 'squat'] ?? CUES.squat!)[locale];

/** Оценка максимума на один раз по Эпли. Для сравнения подходов, не для заявок. */
export const oneRepMax = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));
