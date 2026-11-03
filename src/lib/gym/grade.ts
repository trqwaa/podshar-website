/**
 * Оценка продукта в кладовке, от 1 до 100 (1.54, решение владельца от 3
 * ноября 2026): биооружие, хрящи, бурмалда, чётка и пища богов — слова
 * владельца, без мата. Правилами, без модели — бесплатно, сразу и одинаково
 * при каждом показе.
 *
 * Половина оценки — Nutri-Score, который Open Food Facts уже посчитал с
 * поправками на категорию: у напитков, жиров и воды свои пороги, и своими
 * силами их не повторить. Остальное — переработка (NOVA), добавки и белок на
 * калорию: это зал, и белок здесь весит больше, чем у Nutri-Score. Нет
 * Nutri-Score в базе — та же сумма баллов по таблицам 2023 года из цифр на
 * 100 г; нет и сахара с жирами — середина и пометка «на глаз».
 *
 * Считается при показе из того, что лежит в кладовке, а не хранится готовым:
 * поправил веса — переоценились все продукты разом.
 *
 * Без `server-only`: цвет шкалы нужен и браузеру.
 */

export type Kind = 'food' | 'drink' | 'fat' | 'water';
export type Letter = 'a' | 'b' | 'c' | 'd' | 'e';

/** Что нужно для оценки — подмножество продукта из кладовки. */
export type Gradable = {
  kind: Kind;
  per100: { kcal: number; protein: number; fiber: number | null; sugar: number | null; satFat: number | null; salt: number | null };
  nutri: { grade: Letter; score: number } | null;
  nova: 1 | 2 | 3 | 4 | null;
  additives: number | null;
};

export type Tier = 'trash' | 'bad' | 'mid' | 'good' | 'god';
export type Why = { key: 'protein' | 'fiber' | 'clean' | 'sugar' | 'satFat' | 'salt' | 'ultra' | 'additives'; good: boolean; n?: number };
export type Grade = { score: number; tier: Tier; why: Why[]; rough: boolean };

/** Где на шкале баллов Nutri-Score 2023 лежит каждая буква — у напитков и жиров свои пороги. */
const LETTERS: Record<'food' | 'drink' | 'fat', Record<Letter, [number, number]>> = {
  food: { a: [-10, 0], b: [1, 2], c: [3, 10], d: [11, 18], e: [19, 34] },
  fat: { a: [-16, -6], b: [-5, 2], c: [3, 10], d: [11, 18], e: [19, 34] },
  // A у напитков — только вода, она считается отдельно.
  drink: { a: [-10, 1], b: [-4, 2], c: [3, 6], d: [7, 9], e: [10, 18] }
};

/** Сколько из ста даёт каждая буква: внутри полосы — по баллам, лучшие ближе к верху. */
const BANDS: Record<Letter, [number, number]> = { a: [76, 100], b: [58, 76], c: [38, 58], d: [18, 38], e: [0, 18] };

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const points = (value: number, edges: number[]) => edges.filter((edge) => value > edge).length;

/** Баллы Nutri-Score 2023 для обычной еды по цифрам на 100 г, без фруктов и овощей — их на этикетке нет. */
function nutriFromLabel(p: Gradable['per100']): { grade: Letter; score: number } {
  const bad =
    Math.min(10, Math.floor((p.kcal * 4.184) / 335)) +
    points(p.sugar ?? 0, [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51]) +
    points(p.satFat ?? 0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
    points(p.salt ?? 0, [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4]);
  const fiber = points(p.fiber ?? 0, [3, 4.1, 5.2, 6.3, 7.4]);
  // У вредного (11 баллов и больше) белок не засчитывается — так у Nutri-Score.
  const protein = bad >= 11 ? 0 : points(p.protein, [2.4, 4.8, 7.2, 9.6, 12, 14, 17]);
  const score = bad - fiber - protein;
  const grade: Letter = score <= 0 ? 'a' : score <= 2 ? 'b' : score <= 10 ? 'c' : score <= 18 ? 'd' : 'e';
  return { grade, score };
}

/** Польза по составу, 0–100. */
function nutrition(item: Gradable): { value: number; rough: boolean } {
  if (item.kind === 'water') return { value: 100, rough: false };
  const { per100: p } = item;
  if (!item.nutri && item.kind === 'drink') {
    // Напиток без Nutri-Score: решает сахар.
    return p.sugar === null ? { value: 50, rough: true } : { value: p.sugar <= 0.5 ? 80 : Math.max(0, 70 - 6 * p.sugar), rough: true };
  }
  if (!item.nutri && p.sugar === null && p.satFat === null) return { value: 50, rough: true };
  const nutri = item.nutri ?? nutriFromLabel(p);
  const [lo, hi] = LETTERS[item.kind === 'fat' ? 'fat' : item.kind === 'drink' ? 'drink' : 'food'][nutri.grade];
  const [from, to] = BANDS[nutri.grade];
  return { value: from + (to - from) * clamp((hi - nutri.score) / (hi - lo)), rough: !item.nutri };
}

const NOVA = { 1: 100, 2: 85, 3: 65, 4: 25 } as const;

export function gradeOf(item: Gradable): Grade {
  const { per100: p } = item;
  const { value: n, rough } = nutrition(item);
  const processing = item.nova ? NOVA[item.nova] : 60;
  const additives = item.additives === null ? 70 : Math.max(0, 100 - 12 * item.additives);
  // Белок — доля калорий: треть и больше — потолок. Вода и диетическая кола — нейтрально.
  const share = p.kcal >= 10 ? (p.protein * 4) / p.kcal : null;
  const protein = share === null ? 50 : clamp(share / 0.35) * 100;
  const score = Math.round(clamp(0.5 * n + 0.2 * processing + 0.1 * additives + 0.2 * protein, 1, 100));
  const tier: Tier = score < 20 ? 'trash' : score < 40 ? 'bad' : score < 60 ? 'mid' : score < 90 ? 'good' : 'god';

  // Почему — до трёх причин: у плохого сначала минусы, у хорошего плюсы.
  // Пороги «много» — как у светофора на британских этикетках, у напитков ниже.
  const drink = item.kind === 'drink' || item.kind === 'water';
  const minus: Why[] = [];
  if (p.sugar !== null && p.sugar > (drink ? 5 : 15)) minus.push({ key: 'sugar', good: false });
  if (item.nova === 4) minus.push({ key: 'ultra', good: false });
  if (item.additives !== null && item.additives >= 3) minus.push({ key: 'additives', good: false, n: item.additives });
  if (p.satFat !== null && p.satFat > (drink ? 1.5 : 5)) minus.push({ key: 'satFat', good: false });
  if (p.salt !== null && p.salt > (drink ? 0.5 : 1.5)) minus.push({ key: 'salt', good: false });
  const plus: Why[] = [];
  if (share !== null && share >= 0.25) plus.push({ key: 'protein', good: true });
  if (!drink && p.fiber !== null && p.fiber >= 6) plus.push({ key: 'fiber', good: true });
  if (item.nova === 1 && !item.additives) plus.push({ key: 'clean', good: true });
  const why = (score >= 60 ? [...plus, ...minus] : [...minus, ...plus]).slice(0, 3);

  return { score, tier, why, rough };
}

/**
 * Цвет оценки: уголь, красный, жёлтый, зелёный — опоры, всё между ними —
 * смесь в OKLab, как вода айсберга. Ближе к 90 зелёный теплеет к золоту
 * божества; от 90 рисует голограмма (`GradeRing`), а не этот цвет.
 */
const STOPS: [number, string][] = [
  [8, 'rgb(var(--grade-trash))'],
  [30, 'rgb(var(--grade-bad))'],
  [50, 'rgb(var(--grade-mid))'],
  [70, 'rgb(var(--grade-good))'],
  [89, 'color-mix(in oklab, rgb(var(--grade-god-a)) 45%, rgb(var(--grade-good)))']
];

export function gradeColor(score: number): string {
  if (score <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [to, color] = STOPS[i];
    if (score > to) continue;
    const [from, base] = STOPS[i - 1];
    return `color-mix(in oklab, ${color} ${Math.round(((score - from) / (to - from)) * 100)}%, ${base})`;
  }
  return STOPS[STOPS.length - 1][1];
}
