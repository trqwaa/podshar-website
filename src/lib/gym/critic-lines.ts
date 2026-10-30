import type { Locale } from '@/i18n/routing';

/**
 * Что говорит мопс-критик, когда говорит без модели.
 *
 * В коде, а не в каталогах, — по той же причине, что словарь мопса в
 * `assistant/brief.ts`: каталоги уезжают в браузер, а это его реплики, и в
 * браузер уходит одна выбранная сервером строка. Пулы разного размера на разных
 * языках — русских больше, остальных по одной-две, — и каталоги этого не
 * вынесли бы: они обязаны совпадать ключами.
 *
 * Голос — тот же, что у мопса-навигатора: строчные, без восклицаний, мат
 * вполсилы и редко, эмодзи только из семи своих и только в конце. Бьёт по тому,
 * что человек делает — ест, спит, пропускает, — и никогда по тому, как он
 * выглядит: подколка, которая ранит в плохой день, — не та подколка.
 *
 * Числа подставляются с единицами (`ч`, `ккал`, `г`), а не со словами: так не
 * нужны три формы множественного числа, и «3 часов» не случится.
 */

type Pool = Record<Locale, string[]>;

export const LINES = {
  // ── Питание за неделю ───────────────────────────────────────────────────
  foodNone: {
    ru: [
      'за неделю ни одной записи о еде. либо ты фотосинтезируешь, либо врёшь дневнику',
      'дневник питания пустой. я не могу оценить то, чего ты мне не показал, но догадываюсь 🫩'
    ],
    en: ['not one meal logged all week. either you photosynthesise or you lie to your diary'],
    uk: ['за тиждень жодного запису про їжу. або ти фотосинтезуєш, або брешеш щоденнику'],
    de: ['die ganze woche keine mahlzeit eingetragen. entweder photosynthese oder du belügst dein tagebuch']
  },
  foodJunkHeavy: {
    ru: [
      '{junk} за одну неделю. это не питание, это крик о помощи 🥀',
      'я видел твой дневник. {junk}. мне до сих пор плохо, и мне — мопсу, который ест с пола',
      'это не дневник питания, это коллекция чеков из фастфуда. {junk}'
    ],
    en: ['{junk} in one week. that is not a diet, that is a cry for help 🥀'],
    uk: ['{junk} за один тиждень. це не харчування, це крик про допомогу 🥀'],
    de: ['{junk} in einer woche. das ist keine ernährung, das ist ein hilferuf 🥀']
  },
  foodJunkSome: {
    ru: ['видел я твой {junk}. в остальном терпимо, но осадочек остался', 'всё было почти прилично, пока не случился {junk}'],
    en: ['i saw your {junk}. the rest is tolerable, but i saw it'],
    uk: ['бачив я твій {junk}. решта терпимо, але осад лишився'],
    de: ['ich hab dein {junk} gesehen. der rest geht, aber ich hab es gesehen']
  },
  foodUnder: {
    ru: [
      'цель — масса, а ешь ты {kcal} ккал из {target}. мышцы из воздуха не растут',
      '{kcal} ккал в день при цели в {target}. ты не на массе, ты на голодовке'
    ],
    en: ['the goal is mass and you eat {kcal} of {target} kcal. muscle is not made of air'],
    uk: ['ціль — маса, а їси ти {kcal} ккал із {target}. м’язи з повітря не ростуть'],
    de: ['ziel ist masse und du isst {kcal} von {target} kcal. muskeln wachsen nicht aus luft']
  },
  foodOverCut: {
    ru: ['сушка — это когда меньше, а не когда «ну сегодня можно». {kcal} ккал при норме {target}'],
    en: ['a cut means less, not "today is an exception". {kcal} kcal against {target}'],
    uk: ['сушка — це коли менше, а не коли «ну сьогодні можна». {kcal} ккал при нормі {target}'],
    de: ['diät heisst weniger, nicht "heute ist ausnahme". {kcal} kcal bei {target}']
  },
  foodOver: {
    ru: ['масса — не значит доедать за всем подвалом. {kcal} ккал при норме {target}'],
    en: ['bulking does not mean finishing everyone else’s plate. {kcal} kcal against {target}'],
    uk: ['маса — не означає доїдати за всім підвалом. {kcal} ккал при нормі {target}'],
    de: ['aufbau heisst nicht, den ganzen keller leer zu essen. {kcal} kcal bei {target}']
  },
  foodLowProtein: {
    ru: ['белка {protein} г из {target}. без белка ты не качаешься, ты просто устаёшь', 'белок {protein} г в день. курица по тебе скучает'],
    en: ['{protein} g of protein out of {target}. without protein you are not training, just getting tired'],
    uk: ['білка {protein} г із {target}. без білка ти не качаєшся, ти просто втомлюєшся'],
    de: ['{protein} g eiweiss von {target}. ohne eiweiss trainierst du nicht, du wirst nur müde']
  },
  foodSparse: {
    ru: ['записано {days}/7 дней. остальные дни ты что, не ел'],
    en: ['{days}/7 days logged. did you not eat on the others'],
    uk: ['записано {days}/7 днів. в інші дні ти що, не їв'],
    de: ['{days}/7 tage eingetragen. an den anderen hast du nichts gegessen?']
  },
  foodGood: {
    ru: ['питание ровное, белок на месте. бесит, но придраться не к чему', 'ешь как по учебнику. скучно, зато работает 🥶'],
    en: ['food is on point, protein is there. annoying, nothing to pick at'],
    uk: ['харчування рівне, білок на місці. бісить, але причепитися нема до чого'],
    de: ['ernährung sitzt, eiweiss stimmt. nervig, nichts zu meckern']
  },

  // ── Тренировки за неделю ────────────────────────────────────────────────
  trainNoPlan: {
    ru: ['ни плана, ни тренировок. ты в зале только по адресу сайта', 'доска пустая, штанга пыльная. мопс разочарован 🥀'],
    en: ['no plan, no workouts. you are in the gym only by url'],
    uk: ['ні плану, ні тренувань. ти в залі тільки за адресою сайту'],
    de: ['kein plan, kein training. du bist nur per url im gym']
  },
  trainNone: {
    ru: ['в плане {planned}, сделано ноль. доска плачет мелом', 'план на доске красивый. жаль, что только на доске 👿'],
    en: ['{planned} planned, zero done. the board is crying chalk'],
    uk: ['у плані {planned}, зроблено нуль. дошка плаче крейдою'],
    de: ['{planned} geplant, null gemacht. die tafel weint kreide']
  },
  trainSkipped: {
    ru: ['{done} из {planned}. остальное ты пропустил с умным видом', '{done} тренировки из {planned}. полтренировки не считается за тренировку'],
    en: ['{done} of {planned}. the rest you skipped with a straight face'],
    uk: ['{done} із {planned}. решту ти пропустив з розумним виглядом'],
    de: ['{done} von {planned}. den rest hast du mit ernster miene geschwänzt']
  },
  trainFreestyle: {
    ru: ['тренируешься без плана — уже лучше, чем план без тренировок. но нарисуй его'],
    en: ['training without a plan beats a plan without training. still, draw one'],
    uk: ['тренуєшся без плану — вже краще, ніж план без тренувань. але намалюй його'],
    de: ['training ohne plan ist besser als plan ohne training. mal trotzdem einen']
  },
  trainGood: {
    ru: ['{done} из {planned}. ладно, уважаю. немного', 'всё по плану. я даже не знаю, к чему придраться, и меня это злит 😈'],
    en: ['{done} of {planned}. fine, respect. a little'],
    uk: ['{done} із {planned}. гаразд, поважаю. трохи'],
    de: ['{done} von {planned}. okay, respekt. ein bisschen']
  },
  trainNoLegs: {
    ru: ['в плане нет ног. день ног пропускают все, но не весь же месяц'],
    en: ['no legs in the plan. everyone skips leg day, not every day'],
    uk: ['у плані немає ніг. день ніг пропускають усі, але не весь же місяць'],
    de: ['keine beine im plan. jeder schwänzt den beintag, aber nicht jeden']
  },

  // ── Сон за неделю ───────────────────────────────────────────────────────
  sleepNone: {
    ru: ['ни одной ночи не записано. ты вообще спишь или только листаешь'],
    en: ['not one night logged. do you sleep or just scroll'],
    uk: ['жодної ночі не записано. ти взагалі спиш чи тільки гортаєш'],
    de: ['keine einzige nacht eingetragen. schläfst du oder scrollst du nur']
  },
  sleepShort: {
    ru: [
      'в среднем {hours} ч. тебе {age}, тебе надо {low}–{high}. мышцы растут во сне, а не в тиктоке',
      '{hours} ч за ночь. это не сон, это перезагрузка с ошибкой 🥀'
    ],
    en: ['{hours} h a night on average. you are {age}, you need {low}–{high}. muscle grows asleep, not on tiktok'],
    uk: ['в середньому {hours} год. тобі {age}, тобі треба {low}–{high}. м’язи ростуть уві сні, а не в тіктоці'],
    de: ['im schnitt {hours} h. du bist {age}, du brauchst {low}–{high}. muskeln wachsen im schlaf, nicht auf tiktok']
  },
  sleepLong: {
    ru: ['{hours} ч в среднем. это не сон, это спячка. медведь, иди в зал'],
    en: ['{hours} h on average. that is not sleep, that is hibernation'],
    uk: ['{hours} год у середньому. це не сон, це сплячка'],
    de: ['{hours} h im schnitt. das ist kein schlaf, das ist winterschlaf']
  },
  sleepChaos: {
    ru: ['ложишься то в одно время, то через два часа после. режим у тебя как у бравл-катки'],
    en: ['your bedtime jumps around by hours. that is not a schedule, that is a lottery'],
    uk: ['лягаєш то в один час, то на дві години пізніше. режим як у бравл-катки'],
    de: ['deine schlafenszeit springt um stunden. das ist kein rhythmus, das ist lotto']
  },
  sleepGood: {
    ru: ['{hours} ч, режим ровный. спишь лучше, чем тренируешься', 'со сном порядок. хоть где-то'],
    en: ['{hours} h, steady schedule. you sleep better than you train'],
    uk: ['{hours} год, режим рівний. спиш краще, ніж тренуєшся'],
    de: ['{hours} h, regelmässig. du schläfst besser als du trainierst']
  },

  // ── Итог ────────────────────────────────────────────────────────────────
  totalDisaster: {
    ru: ['это не дневник зала, это протокол вскрытия ☠️', 'я видел подвалы и почище. и мопсов поспортивнее'],
    en: ['this is not a gym diary, this is an autopsy report ☠️'],
    uk: ['це не щоденник залу, це протокол розтину ☠️'],
    de: ['das ist kein trainingstagebuch, das ist ein obduktionsbericht ☠️']
  },
  totalBad: {
    ru: ['есть куда расти. пока в основном вниз', 'плохо, но не безнадёжно. пока'],
    en: ['room to grow. mostly downwards so far'],
    uk: ['є куди рости. поки здебільшого вниз'],
    de: ['luft nach oben. bisher vor allem nach unten']
  },
  totalOk: {
    ru: ['средне. как этот подвал: работает, но пахнет', 'ни туда ни сюда. середина — это тоже выбор, и он так себе'],
    en: ['average. like this basement: it works, but it smells'],
    uk: ['середньо. як цей підвал: працює, але пахне'],
    de: ['mittelmässig. wie dieser keller: funktioniert, riecht aber']
  },
  totalGood: {
    ru: ['неплохо. не привыкай к похвале', 'хорошо идёшь. я сделаю вид, что не заметил'],
    en: ['not bad. do not get used to praise'],
    uk: ['непогано. не звикай до похвали'],
    de: ['nicht schlecht. gewöhn dich nicht an lob']
  },
  totalGreat: {
    ru: ['ладно. ягами арт. только не зазнавайся 🥶', 'придраться не к чему. впервые. запишу в календарь'],
    en: ['fine. genius. do not let it go to your head 🥶'],
    uk: ['гаразд. геній. тільки не зазнавайся 🥶'],
    de: ['okay. genie. bild dir nichts drauf ein 🥶']
  },

  // ── Реплика дня на странице питания ─────────────────────────────────────
  dayEmpty: {
    ru: ['сегодня ничего не записано. ты вообще ешь', 'пустая тарелка в дневнике. в жизни, надеюсь, нет'],
    en: ['nothing logged today. do you eat at all'],
    uk: ['сьогодні нічого не записано. ти взагалі їси'],
    de: ['heute nichts eingetragen. isst du überhaupt']
  },
  daySick: {
    ru: ['{junk}. мне физически плохо', 'ты съел {junk}, а тошнит меня', 'убери {junk} из дневника, я не могу на это смотреть'],
    en: ['{junk}. i am physically unwell'],
    uk: ['{junk}. мені фізично погано'],
    de: ['{junk}. mir ist körperlich schlecht']
  },
  dayAngry: {
    ru: ['{kcal} ккал. ты не набираешь массу, ты набираешь проблемы 👿', 'норма {target}, а у тебя {kcal}. я злой мопс'],
    en: ['{kcal} kcal. you are not bulking, you are collecting problems 👿'],
    uk: ['{kcal} ккал. ти не набираєш масу, ти набираєш проблеми 👿'],
    de: ['{kcal} kcal. das ist kein aufbau, das ist ein problem 👿']
  },
  dayHungry: {
    ru: ['белка {protein} г из {target}. я голодный, а я тут даже не ем', 'мало. доешь, а то мне за тебя грустно 🥲'],
    en: ['{protein} g of {target} protein. i am hungry just looking at it 🥲'],
    uk: ['білка {protein} г із {target}. я голодний, а я тут навіть не їм 🥲'],
    de: ['{protein} g von {target} eiweiss. ich werde vom zuschauen hungrig 🥲']
  },
  dayGood: {
    ru: ['кбжу в норме. дай пять. лапой', 'вот это тарелка. уважаю'],
    en: ['macros on target. paw five'],
    uk: ['кбжв у нормі. дай п’ять. лапою'],
    de: ['makros im ziel. pfote drauf']
  },
  dayOk: {
    ru: ['пока терпимо. день не закончился, не облажайся'],
    en: ['tolerable so far. the day is not over, do not blow it'],
    uk: ['поки терпимо. день не скінчився, не облажайся'],
    de: ['bisher okay. der tag ist nicht vorbei, vermassel es nicht']
  },

  // ── Реплика ночи на странице сна ────────────────────────────────────────
  nightNone: {
    ru: ['ночи не записаны. я не знаю, спал ли ты, и ты, похоже, тоже'],
    en: ['no nights logged. i do not know if you slept, and neither do you'],
    uk: ['ночі не записані. я не знаю, чи ти спав, і ти, схоже, теж'],
    de: ['keine nächte eingetragen. ich weiss nicht, ob du geschlafen hast, du auch nicht']
  },
  nightWrecked: {
    ru: ['{hours} ч. ты не выспался, ты просто моргнул подольше ☠️', 'с таким сном жим падает быстрее, чем ты на подушку'],
    en: ['{hours} h. that was not sleep, that was a long blink ☠️'],
    uk: ['{hours} год. ти не виспався, ти просто довше кліпнув ☠️'],
    de: ['{hours} h. das war kein schlaf, das war ein langes blinzeln ☠️']
  },
  nightSleepy: {
    ru: ['{hours} ч. меньше семи — я зеваю за тебя', 'недоспал. сегодня тренировка будет тяжелее, чем должна'],
    en: ['{hours} h. under seven — i am yawning for you'],
    uk: ['{hours} год. менше семи — я позіхаю за тебе'],
    de: ['{hours} h. unter sieben — ich gähne für dich']
  },
  nightOkay: {
    ru: ['{hours} ч. жить можно, расти — так себе. тебе надо {low}–{high}'],
    en: ['{hours} h. enough to live, not much to grow. you need {low}–{high}'],
    uk: ['{hours} год. жити можна, рости — так собі. тобі треба {low}–{high}'],
    de: ['{hours} h. reicht zum leben, kaum zum wachsen. du brauchst {low}–{high}']
  },
  nightFresh: {
    ru: ['{hours} ч. выспался как мопс. то есть идеально', 'вот это сон. теперь иди и потрать его на присед'],
    en: ['{hours} h. slept like a pug. that is, perfectly'],
    uk: ['{hours} год. виспався як мопс. тобто ідеально'],
    de: ['{hours} h. geschlafen wie ein mops. also perfekt']
  },
  nightOverslept: {
    ru: ['{hours} ч. ты не выспался, ты перележал. голова ватная, да', 'это уже не сон, а кома по расписанию 🫩'],
    en: ['{hours} h. that is not rest, that is oversleeping. foggy head, right'],
    uk: ['{hours} год. ти не виспався, ти переспав. голова ватна, так'],
    de: ['{hours} h. das ist nicht erholt, das ist verschlafen. watte im kopf, oder']
  },

  // ── Подвал: что мопс говорит со скамьи или из-под штанги ────────────────
  sceneBench: {
    ru: ['сегодня жим. двести. смотри и учись', 'лопатки сведены, ноги в пол. двести — это разминка'],
    en: ['bench day. two hundred. watch and learn'],
    uk: ['сьогодні жим. двісті. дивись і вчись'],
    de: ['heute bankdrücken. zweihundert. schau zu und lern']
  },
  sceneRow: {
    ru: ['тяга к поясу, сотка. спина сама себя не нарисует', 'тянем. локтями, а не бицухой'],
    en: ['barbell rows, a hundred. the back will not build itself'],
    uk: ['тяга до пояса, сотка. спина сама себе не намалює'],
    de: ['rudern, hundert kilo. der rücken baut sich nicht selbst']
  },
  sceneSquat: {
    ru: ['день ног. да, сегодня. да, тебе тоже', 'присед до параллели. ниже — ещё лучше'],
    en: ['leg day. yes, today. yes, you too'],
    uk: ['день ніг. так, сьогодні. так, тобі теж'],
    de: ['beintag. ja, heute. ja, du auch']
  },
  /** День отдыха: мопс в капюшоне, кулаки у рта, и его бесит, что сегодня не жмут. */
  sceneRest: {
    ru: ['отдых по плану. не трогай меня, я злой', 'день без штанги. руки чешутся, сижу и бешусь', 'вчера тренер наорал. сегодня я в капюшоне и думаю'],
    en: ['rest day by the plan. don’t talk to me', 'no bar today. my hands itch and i’m fuming'],
    uk: ['відпочинок за планом. не чіпай мене, я злий', 'день без штанги. руки сверблять, сиджу і шаленію'],
    de: ['ruhetag nach plan. sprich mich nicht an', 'heute keine stange. die hände jucken, ich koche']
  },
  sceneNoPlan: {
    ru: ['доска пустая. нарисуй план — и я покажу, как это делается'],
    en: ['the board is empty. draw a plan and i will show you how it is done'],
    uk: ['дошка порожня. намалюй план — і я покажу, як це робиться'],
    de: ['die tafel ist leer. mal einen plan und ich zeig dir, wie es geht']
  },
  sceneDone: {
    ru: ['сегодняшняя тренировка сделана. можешь гордиться, но молча'],
    en: ['today’s workout is done. be proud, quietly'],
    uk: ['сьогоднішнє тренування зроблене. можеш пишатися, але мовчки'],
    de: ['das heutige training ist erledigt. sei stolz, aber leise']
  },
  /**
   * С двух до четырёх ночи, под кровавой луной: кто в это время в зале, тому не
   * спится. Не длиннее двух строк на телефоне — третья ложится на доску.
   */
  sceneBlood: {
    ru: [
      'кровавая луна. все спят, а ты пялишься на штангу',
      'ночь, луна красная, а ты в подвале. сон — тоже подход, иди делай',
      'луна красная, час поздний. план никуда не денется, а сон денется'
    ],
    en: ['blood moon. everyone’s asleep and you’re staring at a barbell', 'night, a red moon, and you’re in the basement. sleep is a set too'],
    uk: ['кривавий місяць. усі сплять, а ти витріщаєшся на штангу', 'ніч, місяць червоний, а ти в підвалі. сон — теж підхід, іди роби'],
    de: ['blutmond. alle schlafen, und du starrst die stange an', 'nacht, roter mond, und du im keller. schlaf ist auch ein satz']
  },
  /**
   * Первый заход в зал: тренер сжёг резинку вместо ленточки, всё прогорело до
   * черноты, и в черноте — это. Жёстко: зал открывается один раз.
   */
  opening: {
    ru: [
      'отмазки сгорели первыми. дальше — ты',
      'всё лишнее сгорело. остались ты и железо',
      'это горела твоя зона комфорта. хорошо горела',
      'пепел — это твоё «начну с понедельника»',
      'назад дороги нет. я её сжёг',
      'добро пожаловать в подвал. слабость сюда не проходит — сгорает на входе'
    ],
    en: [
      'excuses burned first. you are next',
      'everything soft burned. what is left is you and the iron',
      'that was your comfort zone. it burned well',
      'no way back. i burned it'
    ],
    uk: [
      'відмовки згоріли першими. далі — ти',
      'усе зайве згоріло. лишилися ти і залізо',
      'це горіла твоя зона комфорту. добре горіла',
      'дороги назад нема. я її спалив'
    ],
    de: [
      'die ausreden sind zuerst verbrannt. du bist der nächste',
      'alles weiche ist verbrannt. übrig bleiben du und das eisen',
      'das war deine komfortzone. sie hat gut gebrannt',
      'es gibt keinen weg zurück. ich habe ihn verbrannt'
    ]
  },
  /** Человек бросает тренировку на середине: мопс в окне «бросить?» вместо системного «точно?». */
  discardPug: {
    ru: [
      'ты чё, серьёзно? штанга ещё тёплая',
      'бросить? а мышцы сами себя накачают, да?',
      'хули ты сливаешься на середине. доделывай',
      'отменяешь? я это запомню',
      'бросить на середине — это не отдых, это слив',
      'ещё один подход — и иди куда хочешь'
    ],
    en: [
      'you serious? the bar is still warm',
      'quit now? your muscles won’t grow themselves',
      'why the hell are you bailing halfway. finish it',
      'cancelling? i’ll remember this',
      'quitting halfway isn’t rest, it’s giving up',
      'one more set, then go wherever you want'
    ],
    uk: [
      'ти шо, серйозно? штанга ще тепла',
      'кинути? а м’язи самі себе накачають, так?',
      'якого біса ти зливаєшся на середині. доробляй',
      'скасовуєш? я це запам’ятаю',
      'кинути на середині — це не відпочинок, це злив',
      'ще один підхід — і йди куди хочеш'
    ],
    de: [
      'ernsthaft? die stange ist noch warm',
      'jetzt aufhören? die muskeln wachsen nicht von allein',
      'warum zum teufel steigst du mittendrin aus. mach fertig',
      'abbrechen? das merk ich mir',
      'mittendrin aufhören ist keine pause, das ist aufgeben',
      'noch ein satz, dann geh, wohin du willst'
    ]
  },
  /** Ткнули в мопса на сцене: одна реплика на тычок, по кругу. */
  scenePoke: {
    ru: [
      'не тыкай в меня. тыкай в штангу',
      'ещё раз ткнёшь — добавлю подход',
      'я тут работаю, а ты пальцем водишь',
      'хочешь поговорить — сначала разомнись',
      'трогать тренера можно после трёх подходов',
      'кликать ты умеешь. а приседать?',
      'блин, я на подходе. отойди',
      'это не кнопка лайка. это тренер'
    ],
    en: [
      'don’t poke me. poke the bar',
      'poke me again and you get another set',
      'i’m working here and you’re clicking around',
      'want to chat? warm up first',
      'touching the coach is allowed after three sets',
      'you can click. can you squat?',
      'damn, mid-set here. step back',
      'this is not a like button. this is your coach'
    ],
    uk: [
      'не тицяй у мене. тицяй у штангу',
      'ще раз тицьнеш — додам підхід',
      'я тут працюю, а ти пальцем водиш',
      'хочеш поговорити — спершу розімнися',
      'чіпати тренера можна після трьох підходів',
      'клікати ти вмієш. а присідати?',
      'блін, я на підході. відійди',
      'це не кнопка лайка. це тренер'
    ],
    de: [
      'stups mich nicht. stups die stange',
      'noch einmal stupsen, und es gibt einen satz extra',
      'ich arbeite hier, und du klickst herum',
      'reden? erst aufwärmen',
      'den trainer anfassen darfst du nach drei sätzen',
      'klicken kannst du. kannst du auch kniebeugen?',
      'mist, ich bin mitten im satz. geh zur seite',
      'das ist kein like-button. das ist dein trainer'
    ]
  }
} satisfies Record<string, Pool>;

export type LineKey = keyof typeof LINES;

/**
 * Совет: что именно сделать. Здесь мопс перестаёт хамить — разнос без
 * следующего шага ничего не стоит, и владелец просил дельных советов.
 */
export const ADVICE = {
  protein: {
    ru: 'добери белок: не хватает около {gap} г в день — это {cottage} г творога или {scoops} скупа протеина',
    en: 'close the protein gap: about {gap} g a day short — that is {cottage} g of cottage cheese or {scoops} scoops of whey',
    uk: 'добери білок: бракує близько {gap} г на день — це {cottage} г сиру або {scoops} скупа протеїну',
    de: 'eiweisslücke schliessen: etwa {gap} g pro tag fehlen — {cottage} g hüttenkäse oder {scoops} messlöffel whey'
  },
  kcalUp: {
    ru: 'ешь примерно на {gap} ккал больше: тарелка риса с курицей закрывает это почти целиком',
    en: 'eat about {gap} kcal more: a plate of rice and chicken nearly covers it',
    uk: 'їж приблизно на {gap} ккал більше: тарілка рису з куркою майже все закриває',
    de: 'iss etwa {gap} kcal mehr: ein teller reis mit poulet deckt das fast ab'
  },
  kcalDown: {
    ru: 'срежь около {gap} ккал: сначала сладкую воду и ночные перекусы, а не белок',
    en: 'cut about {gap} kcal: sugary drinks and late snacks first, never the protein',
    uk: 'зріж близько {gap} ккал: спершу солодку воду й нічні перекуси, а не білок',
    de: 'spar etwa {gap} kcal: zuerst süssgetränke und späte snacks, nie das eiweiss'
  },
  junk: {
    ru: 'фастфуд — не чаще раза в неделю и не в день тренировки. энергетики и колу — в ноль',
    en: 'fast food at most once a week and never on a training day. energy drinks and cola — zero',
    uk: 'фастфуд — не частіше разу на тиждень і не в день тренування. енергетики й колу — в нуль',
    de: 'fast food höchstens einmal pro woche und nie am trainingstag. energy drinks und cola — null'
  },
  logFood: {
    ru: 'записывай еду каждый день, хотя бы примерно: без цифр я могу только гадать, а гадаю я жёстко',
    en: 'log food every day, even roughly: without numbers i can only guess, and i guess harshly',
    uk: 'записуй їжу щодня, хоча б приблизно: без цифр я можу тільки гадати, а гадаю я жорстко',
    de: 'trag das essen jeden tag ein, wenigstens ungefähr: ohne zahlen rate ich, und ich rate hart'
  },
  drawPlan: {
    ru: 'нарисуй план на доске: три тренировки в неделю — верх, низ, всё тело. этого хватит',
    en: 'draw a plan on the board: three workouts a week — upper, lower, full body. enough',
    uk: 'намалюй план на дошці: три тренування на тиждень — верх, низ, все тіло. цього досить',
    de: 'mal einen plan an die tafel: drei trainings pro woche — oberkörper, beine, ganzkörper. reicht'
  },
  legs: {
    ru: 'добавь день ног: присед и румынская тяга, по 3×8',
    en: 'add a leg day: squats and romanian deadlifts, 3×8 each',
    uk: 'додай день ніг: присідання й румунська тяга, по 3×8',
    de: 'nimm einen beintag dazu: kniebeugen und rumänisches kreuzheben, je 3×8'
  },
  attend: {
    ru: 'ставь на доску столько тренировок, сколько реально сделаешь. три сделанные лучше пяти задуманных',
    en: 'put only as many workouts on the board as you will actually do. three done beat five planned',
    uk: 'став на дошку стільки тренувань, скільки реально зробиш. три зроблені кращі за п’ять задуманих',
    de: 'plan nur so viele trainings, wie du wirklich machst. drei gemachte schlagen fünf geplante'
  },
  progress: {
    ru: 'прогрессия: сделал все подходы по верхней границе повторов — добавь 2,5 кг',
    en: 'progression: hit the top of the rep range on every set — add 2.5 kg',
    uk: 'прогресія: зробив усі підходи по верхній межі повторів — додай 2,5 кг',
    de: 'progression: alle sätze am oberen wiederholungsende — 2,5 kg drauf'
  },
  repsHypertrophy: {
    ru: 'для массы держи 6–12 повторов и 10–20 рабочих подходов на мышцу в неделю',
    en: 'for size keep 6–12 reps and 10–20 working sets per muscle a week',
    uk: 'для маси тримай 6–12 повторів і 10–20 робочих підходів на м’яз на тиждень',
    de: 'für masse 6–12 wiederholungen und 10–20 arbeitssätze pro muskel und woche'
  },
  repsStrength: {
    ru: 'для силы база в 3–6 повторов и отдых 2–3 минуты. махи в 20 повторов силу не дают',
    en: 'for strength do the big lifts at 3–6 reps with 2–3 minutes rest',
    uk: 'для сили база в 3–6 повторів і відпочинок 2–3 хвилини',
    de: 'für kraft grundübungen mit 3–6 wiederholungen und 2–3 minuten pause'
  },
  cutLift: {
    ru: 'на сушке не снижай рабочие веса — снижай калории. тяжёлое держит мышцы',
    en: 'on a cut keep the weights heavy and cut calories instead. heavy lifting keeps the muscle',
    uk: 'на сушці не знижуй робочі ваги — знижуй калорії. важке тримає м’язи',
    de: 'in der diät die gewichte halten und kalorien kürzen. schweres hält die muskeln'
  },
  bedEarlier: {
    ru: 'ложись до {bed}: тебе нужно {low}–{high} ч, а не «ещё одно видео»',
    en: 'be in bed by {bed}: you need {low}–{high} h, not "one more video"',
    uk: 'лягай до {bed}: тобі треба {low}–{high} год, а не «ще одне відео»',
    de: 'um {bed} ins bett: du brauchst {low}–{high} h, nicht "noch ein video"'
  },
  bedRegular: {
    ru: 'одно время отбоя ±30 минут, даже в выходные. организм любит скучных',
    en: 'one bedtime ±30 minutes, weekends included. the body loves boring people',
    uk: 'один час відбою ±30 хвилин, навіть у вихідні. організм любить нудних',
    de: 'eine schlafenszeit ±30 minuten, auch am wochenende. der körper mag langweilige leute'
  },
  screens: {
    ru: 'телефон за час до сна — в другую комнату. да, серьёзно',
    en: 'phone in another room an hour before bed. yes, seriously',
    uk: 'телефон за годину до сну — в іншу кімнату. так, серйозно',
    de: 'handy eine stunde vor dem schlafen in ein anderes zimmer. ja, wirklich'
  },
  caffeine: {
    ru: 'кофе и энергетики — не позже 14:00, иначе ночь ты пролежишь, а не проспишь',
    en: 'coffee and energy drinks not after 2 pm, or you will lie awake instead of sleeping',
    uk: 'кава й енергетики — не пізніше 14:00, інакше ніч пролежиш, а не проспиш',
    de: 'kaffee und energy drinks nicht nach 14 uhr, sonst liegst du wach'
  },
  sleepLong: {
    ru: 'больше 10 часов подряд регулярно — проверь, не болеешь ли и не прячешься ли от дня',
    en: 'regularly over 10 hours — check you are not ill and not hiding from the day',
    uk: 'понад 10 годин поспіль регулярно — перевір, чи не хворієш і чи не ховаєшся від дня',
    de: 'regelmässig über 10 stunden — prüf, ob du krank bist oder dich vor dem tag versteckst'
  },
  weigh: {
    ru: 'взвешивайся раз в неделю утром натощак и записывай в замеры — без веса нормы считаются наугад',
    en: 'weigh in once a week, mornings before eating, and log it — without it the targets are a guess',
    uk: 'зважуйся раз на тиждень вранці натщесерце й записуй у заміри — без ваги норми навмання',
    de: 'einmal pro woche morgens nüchtern wiegen und eintragen — ohne gewicht sind die ziele geraten'
  },
  logSleep: {
    ru: 'записывай сон: руками в два клика или выгрузкой из zepp life — она внизу страницы сна',
    en: 'log your sleep: by hand in two taps or from a zepp life export — at the bottom of the sleep page',
    uk: 'записуй сон: руками у два кліки або вивантаженням із zepp life — внизу сторінки сну',
    de: 'trag deinen schlaf ein: von hand oder per zepp-life-export — unten auf der schlafseite'
  }
} satisfies Record<string, Record<Locale, string>>;

export type AdviceKey = keyof typeof ADVICE;

/** Добавки: что имеет смысл и чего не трогать. Мопс не врач и так и говорит. */
export const SUPPLEMENTS = {
  creatine: {
    ru: 'креатин моногидрат, 3–5 г каждый день, без загрузки — самая изученная добавка для силы и массы',
    en: 'creatine monohydrate, 3–5 g every day, no loading — the best-studied supplement for strength and size',
    uk: 'креатин моногідрат, 3–5 г щодня, без завантаження — найкраще вивчена добавка для сили й маси',
    de: 'kreatin-monohydrat, 3–5 g täglich, ohne ladephase — das best untersuchte supplement für kraft und masse'
  },
  creatineTeen: {
    ru: 'креатин — до 18 лет только после разговора с врачом. сначала еда и сон, они дают больше',
    en: 'creatine — under 18 only after talking to a doctor. food and sleep come first and give more',
    uk: 'креатин — до 18 років тільки після розмови з лікарем. спершу їжа й сон, вони дають більше',
    de: 'kreatin — unter 18 nur nach rücksprache mit dem arzt. essen und schlaf zuerst, die bringen mehr'
  },
  whey: {
    ru: 'протеин — это просто еда в порошке. скуп после тренировки, если белок не добирается едой',
    en: 'whey is just food in powder form. a scoop after training if food does not cover the protein',
    uk: 'протеїн — це просто їжа в порошку. скуп після тренування, якщо білок не добирається їжею',
    de: 'whey ist nur essen in pulverform. ein messlöffel nach dem training, wenn das eiweiss fehlt'
  },
  vitaminD: {
    ru: 'витамин D с октября по март: в Швейцарии зимой солнца для него не хватает почти никому. дозу — с врачом',
    en: 'vitamin d from october to march: swiss winter sun is not enough for almost anyone. dose with a doctor',
    uk: 'вітамін D з жовтня по березень: швейцарського зимового сонця майже нікому не вистачає. дозу — з лікарем',
    de: 'vitamin d von oktober bis märz: die schweizer wintersonne reicht fast niemandem. dosis mit dem arzt'
  },
  omega: {
    ru: 'омега-3, если рыбы меньше двух раз в неделю',
    en: 'omega-3 if you eat fish less than twice a week',
    uk: 'омега-3, якщо риби менше двох разів на тиждень',
    de: 'omega-3, wenn du weniger als zweimal pro woche fisch isst'
  },
  skipBurners: {
    ru: 'жиросжигатели, бустеры тестостерона, SARMs и прогормоны — нет. в лучшем случае деньги на ветер, в худшем — гормоны в минус',
    en: 'fat burners, test boosters, sarms and prohormones — no. best case wasted money, worst case wrecked hormones',
    uk: 'жироспалювачі, бустери тестостерону, SARMs і прогормони — ні. у кращому разі гроші на вітер, у гіршому — гормони в мінус',
    de: 'fatburner, testo-booster, sarms und prohormone — nein. bestenfalls geld weg, schlimmstenfalls hormone kaputt'
  },
  skipPreworkout: {
    ru: 'предтрен с лошадиной дозой кофеина в твоём возрасте не нужен. нужен сон',
    en: 'pre-workout with a horse dose of caffeine is not what you need at your age. sleep is',
    uk: 'передтрен з кінською дозою кофеїну у твоєму віці не потрібен. потрібен сон',
    de: 'pre-workout mit pferdedosis koffein brauchst du in deinem alter nicht. schlaf schon'
  },
  skipMelatonin: {
    ru: 'мелатонин без врача — нет. сначала режим и телефон из спальни',
    en: 'melatonin without a doctor — no. fix the schedule and get the phone out of the bedroom first',
    uk: 'мелатонін без лікаря — ні. спершу режим і телефон зі спальні',
    de: 'melatonin ohne arzt — nein. zuerst rhythmus und handy aus dem schlafzimmer'
  }
} satisfies Record<string, Record<Locale, string>>;

export type SupplementKey = keyof typeof SUPPLEMENTS;
