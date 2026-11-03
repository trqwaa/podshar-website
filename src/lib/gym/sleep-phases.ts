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

export function nightFrom(samples: Sample[]): Night | null {
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
  if (!base.length) return null;

  const pieces = union(base, GAP);
  const main = pieces.reduce((best, piece) => (minutesIn(base, piece) > minutesIn(base, best) ? piece : best));
  const staged = by.deep.length + by.rem.length > 0;
  return {
    bedAt: new Date(main[0]),
    wakeAt: new Date(main[1]),
    minutes: minutesIn(base, main),
    deep: staged ? minutesIn(by.deep, main) : null,
    rem: staged ? minutesIn(by.rem, main) : null
  };
}
