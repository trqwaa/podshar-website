/**
 * Ночь из образцов сна, которые шлёт быстрая команда айфона (1.55): часы
 * пишут в «Здоровье» сами или через приложение Google Health, а команда
 * отдаёт сюда каждый образец — начало, конец и что это было.
 *
 * Что было — словом на языке телефона («Глубокий сон», «Asleep REM», «Im
 * Bett») или числом, как его хранит «Здоровье» (0 в постели, 1 сон, 2
 * бодрствование, 3 основной, 4 глубокий, 5 быстрый). Слова узнаются по корням
 * на четырёх языках, а не по точному тексту: Apple переименовывает их от
 * версии к версии.
 *
 * Источников бывает два сразу — часы и телефон, — поэтому одинаковые отрезки
 * сливаются, а не складываются. Ночь — самый длинный кусок сна; разрывы
 * короче полутора часов его не делят, а дневной сон ночью не становится.
 *
 * Без `server-only` и без импортов: проверяется прямо из node.
 */

export type Sample = { start: string; end: string; value: string | number };
export type Night = { bedAt: Date; wakeAt: Date; minutes: number; deep: number | null; rem: number | null };

type Phase = 'bed' | 'awake' | 'deep' | 'rem' | 'core' | 'asleep';

const WORDS: [Phase, RegExp][] = [
  ['bed', /bed|постел|кроват|ліжк|bett/i],
  ['awake', /wake|бодр|просып|пробудж|неспан|wach/i],
  ['deep', /deep|глуб|глиб|tief/i],
  ['rem', /rem|быстр|швидк|traum/i],
  ['core', /core|light|основ|л[её]гк|легк|kern|leicht/i],
  ['asleep', /sleep|сон|schlaf/i]
];
const NUMBERS: Phase[] = ['bed', 'asleep', 'awake', 'core', 'deep', 'rem'];

export function phaseOf(value: string | number): Phase | null {
  const text = String(value).trim();
  if (/^[0-5]$/.test(text)) return NUMBERS[Number(text)];
  return WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
}

type Span = [number, number];

/** Слить пересекающиеся отрезки; `gap` — какой разрыв ещё считать одним куском. */
function union(spans: Span[], gap = 0): Span[] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  for (const [from, to] of sorted) {
    const last = out[out.length - 1];
    if (last && from <= last[1] + gap) last[1] = Math.max(last[1], to);
    else out.push([from, to]);
  }
  return out;
}

const minutesIn = (spans: Span[], [from, to]: Span) =>
  Math.round(union(spans).reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, to) - Math.max(a, from)), 0) / 60_000);

const GAP = 90 * 60_000;

/**
 * Образцы, как их прислала команда. Список словарей айфон отдаёт массивом,
 * если поле в теле запроса — массив, а если поле текстовое — склеивает
 * словари в текст, каждый JSON-ом. Принимаются оба вида: на телефоне это
 * разница в одном переключателе, и угадать его заранее нельзя. Словари
 * плоские, поэтому достаточно найти каждую пару фигурных скобок.
 */
export function samplesFrom(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  const text = input.trim();
  try {
    if (text.startsWith('[')) return JSON.parse(text);
    return (text.match(/\{[^{}]*\}/g) ?? []).map((one) => JSON.parse(one));
  } catch {
    return null;
  }
}

/**
 * Три списка вместо словарей: начала, концы и что это было (`starts`, `ends`,
 * `values`). Так команда обходится без повтора: «сведения об образцах» берёт
 * список целиком, и запуск занимает секунду, а не полминуты на сотне кусочков
 * сна — долгий фоновый запуск айфон обрывает. Списки приходят массивами или
 * текстом, по строке на кусочек; длины обязаны совпасть.
 */
export function samplesFromLists(starts: unknown, ends: unknown, values: unknown): unknown {
  const list = (v: unknown) =>
    Array.isArray(v)
      ? v.map(String)
      : typeof v === 'string'
        ? v
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        : null;
  const [a, b, c] = [list(starts), list(ends), list(values)];
  if (!a || !b || !c || a.length !== b.length || a.length !== c.length) return null;
  return a.map((start, i) => ({ start, end: b[i], value: c[i] }));
}

/** Короче — дневной сон, а не ночь: он не должен затирать настоящую ночь той же даты. */
const NIGHT = 120;
const wakeDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * Все ночи из образцов — по одной на дату подъёма в Цюрихе, самая длинная за
 * эту дату. Команда шлёт три последних дня, и ночь, пойманная наполовину
 * (проснулся в три, открыл телефон, уснул снова), перезаписывается целой при
 * любом следующем запуске — сегодня или завтра. Владелец нашёл эту дыру сам,
 * 3 ноября 2026: с одними сутками половинка оставалась навсегда.
 */
export function nightsFrom(samples: Sample[]): Night[] {
  const by: Record<Phase, Span[]> = { bed: [], awake: [], deep: [], rem: [], core: [], asleep: [] };
  for (const sample of samples) {
    const phase = phaseOf(sample.value);
    const from = Date.parse(sample.start);
    const to = Date.parse(sample.end);
    if (!phase || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) continue;
    by[phase].push([from, to]);
  }
  const sleeping = [...by.deep, ...by.rem, ...by.core, ...by.asleep];
  // Одно «в постели» без часов — телефон по расписанию сна: ночь без фаз.
  const base = sleeping.length ? sleeping : by.bed;

  const best = new Map<string, Span>();
  for (const piece of union(base, GAP)) {
    if (minutesIn(base, piece) < NIGHT) continue;
    const day = wakeDay.format(new Date(piece[1]));
    const other = best.get(day);
    if (!other || minutesIn(base, piece) > minutesIn(base, other)) best.set(day, piece);
  }
  return [...best.values()]
    .sort((a, b) => a[0] - b[0])
    .map((main) => {
      // Фазы — только если часы прислали их за эту ночь, иначе «нет данных», а не ноль.
      const staged = [...by.deep, ...by.rem].some(([from, to]) => to > main[0] && from < main[1]);
      return {
        bedAt: new Date(main[0]),
        wakeAt: new Date(main[1]),
        minutes: minutesIn(base, main),
        deep: staged ? minutesIn(by.deep, main) : null,
        rem: staged ? minutesIn(by.rem, main) : null
      };
    });
}
