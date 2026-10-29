import type { Words } from './exercises';

/**
 * Готовые программы: неделя на доске одним нажатием.
 *
 * Схемы — те, что знают в любом зале: фулл-бади, тяни-толкай-ноги, сплит на
 * три дня (грудь с трицепсом, спина с бицепсом, ноги с плечами), верх-низ,
 * 5×5, сплит Арнольда и пятидневный сплит. Подходы и повторы — классические
 * для схемы; веса пустые — их знает только тот, кто будет жать. Дальше доска
 * правится как обычно: программа — начало, а не клетка.
 *
 * Упражнения — `id` из справочника (`exercises.ts`), дни — с понедельника, как
 * на доске. В коде, как справочник упражнений: названия на четырёх языках, и
 * в браузер это едет только на вкладку доски.
 */

export type ProgramItem = { exercise: string; sets: number; reps: number };
export type ProgramDay = { weekday: number; items: ProgramItem[] };
export type Program = { id: string; name: Words; about: Words; days: ProgramDay[] };

const x = (exercise: string, sets: number, reps: number): ProgramItem => ({ exercise, sets, reps });
const on = (weekdays: number[], items: ProgramItem[]): ProgramDay[] => weekdays.map((weekday) => ({ weekday, items }));

const fullA = [x('squat', 3, 8), x('bench-press', 3, 8), x('barbell-row', 3, 8), x('lateral-raise', 3, 12), x('crunch', 3, 15)];
const fullB = [x('deadlift', 3, 5), x('ohp', 3, 8), x('lat-pulldown', 3, 10), x('leg-press', 3, 10), x('biceps-curl', 3, 12), x('triceps-pushdown', 3, 12)];

const push = [x('bench-press', 4, 6), x('ohp', 3, 8), x('incline-db-bench', 3, 10), x('lateral-raise', 3, 15), x('triceps-pushdown', 3, 12), x('skull-crusher', 3, 10)];
const pull = [x('deadlift', 3, 5), x('pull-up', 3, 8), x('cable-row', 3, 10), x('face-pull', 3, 15), x('biceps-curl', 3, 12), x('hammer-curl', 3, 12)];
const legs = [x('squat', 4, 6), x('rdl', 3, 8), x('leg-press', 3, 10), x('leg-curl', 3, 12), x('leg-extension', 3, 12), x('calf-raise', 4, 15)];

const upper = [x('bench-press', 4, 6), x('barbell-row', 4, 6), x('ohp', 3, 8), x('lat-pulldown', 3, 10), x('biceps-curl', 3, 12), x('triceps-pushdown', 3, 12)];
const lower = [x('squat', 4, 6), x('rdl', 3, 8), x('leg-press', 3, 10), x('leg-curl', 3, 12), x('calf-raise', 4, 15), x('crunch', 3, 15)];

export const PROGRAMS: Program[] = [
  {
    id: 'full-body',
    name: { ru: 'фулл-бади', en: 'full body', uk: 'фул-боді', de: 'ganzkörper' },
    about: {
      ru: 'три дня, всё тело за раз: присед, жим, тяга. для начала и для тех, у кого мало времени',
      en: 'three days, the whole body each time: squat, press, pull. for starters and the busy',
      uk: 'три дні, все тіло за раз: присід, жим, тяга. для початку і для тих, у кого мало часу',
      de: 'drei tage, jedes mal der ganze körper: kniebeuge, drücken, ziehen. für den einstieg und für wenig zeit'
    },
    days: [...on([0, 4], fullA), ...on([2], fullB)]
  },
  {
    id: 'push-pull-legs',
    name: { ru: 'тяни-толкай-ноги', en: 'push / pull / legs', uk: 'тягни-штовхай-ноги', de: 'push / pull / beine' },
    about: {
      ru: 'шесть дней: жим, тяга, ноги — и по второму кругу',
      en: 'six days: push, pull, legs — and round again',
      uk: 'шість днів: жим, тяга, ноги — і по другому колу',
      de: 'sechs tage: drücken, ziehen, beine — und noch eine runde'
    },
    days: [...on([0, 3], push), ...on([1, 4], pull), ...on([2, 5], legs)]
  },
  {
    id: 'split-3',
    name: { ru: 'сплит на три дня', en: 'three-day split', uk: 'спліт на три дні', de: 'dreier-split' },
    about: {
      ru: 'грудь с трицепсом, спина с бицепсом, ноги с плечами',
      en: 'chest and triceps, back and biceps, legs and shoulders',
      uk: 'груди з трицепсом, спина з біцепсом, ноги з плечима',
      de: 'brust und trizeps, rücken und bizeps, beine und schultern'
    },
    days: [
      ...on([0], [x('bench-press', 4, 8), x('incline-db-bench', 3, 10), x('db-fly', 3, 12), x('dips', 3, 10), x('triceps-pushdown', 3, 12), x('skull-crusher', 3, 10)]),
      ...on([2], [x('pull-up', 4, 8), x('barbell-row', 4, 8), x('lat-pulldown', 3, 10), x('one-arm-db-row', 3, 10), x('biceps-curl', 3, 10), x('hammer-curl', 3, 12)]),
      ...on([4], [x('squat', 4, 8), x('leg-press', 3, 10), x('leg-curl', 3, 12), x('ohp', 4, 8), x('lateral-raise', 3, 15), x('calf-raise', 4, 15)])
    ]
  },
  {
    id: 'upper-lower',
    name: { ru: 'верх-низ', en: 'upper / lower', uk: 'верх-низ', de: 'ober- / unterkörper' },
    about: {
      ru: 'четыре дня: верх, низ, отдых, верх, низ',
      en: 'four days: upper, lower, rest, upper, lower',
      uk: 'чотири дні: верх, низ, відпочинок, верх, низ',
      de: 'vier tage: oben, unten, pause, oben, unten'
    },
    days: [...on([0, 3], upper), ...on([1, 4], lower)]
  },
  {
    id: 'five-by-five',
    name: { ru: '5×5', en: '5×5', uk: '5×5', de: '5×5' },
    about: {
      ru: 'три дня, три базовых упражнения, пять подходов по пять. сила в чистом виде',
      en: 'three days, three big lifts, five sets of five. strength, plain',
      uk: 'три дні, три базові вправи, п’ять підходів по п’ять. сила в чистому вигляді',
      de: 'drei tage, drei grundübungen, fünf sätze à fünf. kraft pur'
    },
    days: [...on([0, 4], [x('squat', 5, 5), x('bench-press', 5, 5), x('barbell-row', 5, 5)]), ...on([2], [x('squat', 5, 5), x('ohp', 5, 5), x('deadlift', 1, 5)])]
  },
  {
    id: 'arnold',
    name: { ru: 'сплит арнольда', en: 'arnold split', uk: 'спліт арнольда', de: 'arnold-split' },
    about: {
      ru: 'шесть дней: грудь со спиной, плечи с руками, ноги — дважды. для тех, кто уже не новичок',
      en: 'six days: chest and back, shoulders and arms, legs — twice. not for beginners',
      uk: 'шість днів: груди зі спиною, плечі з руками, ноги — двічі. для тих, хто вже не новачок',
      de: 'sechs tage: brust und rücken, schultern und arme, beine — zweimal. nichts für einsteiger'
    },
    days: [
      ...on([0, 3], [x('bench-press', 4, 8), x('incline-bench', 4, 10), x('db-fly', 3, 12), x('pull-up', 4, 8), x('barbell-row', 4, 8), x('db-pullover', 3, 12)]),
      ...on([1, 4], [x('arnold-press', 4, 10), x('lateral-raise', 3, 12), x('upright-row', 3, 10), x('biceps-curl', 4, 10), x('skull-crusher', 4, 10), x('hammer-curl', 3, 12)]),
      ...on([2, 5], [x('squat', 5, 8), x('leg-press', 4, 10), x('lunge', 3, 12), x('leg-curl', 4, 12), x('calf-raise', 5, 15)])
    ]
  },
  {
    id: 'split-5',
    name: { ru: 'сплит на пять дней', en: 'five-day split', uk: 'спліт на п’ять днів', de: 'fünfer-split' },
    about: {
      ru: 'каждой мышце свой день: грудь, спина, плечи, ноги, руки',
      en: 'a day for every muscle: chest, back, shoulders, legs, arms',
      uk: 'кожному м’язу свій день: груди, спина, плечі, ноги, руки',
      de: 'jeder muskel sein tag: brust, rücken, schultern, beine, arme'
    },
    days: [
      ...on([0], [x('bench-press', 4, 8), x('incline-db-bench', 4, 10), x('cable-crossover', 3, 12), x('dips', 3, 10)]),
      ...on([1], [x('deadlift', 3, 5), x('pull-up', 4, 8), x('barbell-row', 4, 8), x('lat-pulldown', 3, 12)]),
      ...on([2], [x('ohp', 4, 8), x('lateral-raise', 4, 12), x('reverse-fly', 3, 15), x('shrug', 3, 12)]),
      ...on([3], [x('squat', 4, 8), x('leg-press', 4, 10), x('rdl', 3, 10), x('leg-extension', 3, 12), x('calf-raise', 4, 15)]),
      ...on([4], [x('biceps-curl', 4, 10), x('skull-crusher', 4, 10), x('hammer-curl', 3, 12), x('triceps-pushdown', 3, 12), x('preacher-curl', 3, 12)])
    ]
  }
];

export const programOf = (id: string): Program | null => PROGRAMS.find((p) => p.id === id) ?? null;
