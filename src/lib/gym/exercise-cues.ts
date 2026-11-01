import type { Locale } from '@/i18n/routing';
import type { Motion } from './exercises';

/*
 * Техника — своим модулем, а не в каталоге: шестьсот строк на четырёх языках
 * нужны одному окну упражнения (`ExercisePicker`), а каталог (`exercises.ts`)
 * едет в браузер с каждой страницей зала. Окно подгружает этот модуль, когда
 * открывается, — и ни одна страница его не ждёт.
 */

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
