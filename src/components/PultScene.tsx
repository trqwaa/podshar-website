'use client';

import { useId, useLayoutEffect, useMemo, useRef } from 'react';

import type { PultSky } from '@/lib/pult';
import type { Mood } from '@/lib/sun';

/**
 * Айсберг пульта: геометрия, небо над ним, вода и трещина.
 *
 * Пульт — это айсберг. Строка ввода стоит на линии воды, над ней небо, под ней
 * разделы слоями льда: чем глубже, тем нишевее. Здесь всё, что рисуется, а не
 * нажимается; списком и клавишами занимается `Pult`.
 *
 * Сверху величие, снизу апатия — так попросил владелец 20 октября 2026, когда
 * рай с ангелами вышел детским и дешёвым. Над вершиной свет и кольца от
 * красного ядра: та же кнопка ПХ, только теперь она венчает весь сайт. В
 * глубине вода сереет, и в ней тонут слова рутины. Вечером и ночью всё темнеет
 * по настоящему закату над Цюрихом (`lib/sun.ts`).
 *
 * Небо — то же, что сейчас над Цюрихом (`lookOf`, решение владельца от 25
 * октября 2026): дождь идёт и рябит воду, туман ложится на воду и верхушку,
 * снег, гроза. Погоду приносит `/api/pult` вместе с ответами слоёв — рендер
 * страницы за ней не ходит.
 *
 * Числа здесь не на глаз, и у каждого есть причина — она записана рядом.
 */

type Point = [number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── Случайность, одинаковая у троих ────────────────────────────────────────

/**
 * Mulberry32: маленький генератор псевдослучайных чисел с зерном.
 *
 * Зерно — общий номер дня (`lib/day.ts`), поэтому айсберг меняет форму раз в
 * сутки, и в один день у всех троих он одинаковый — как приветствие и цитата.
 * `Math.random()` давал бы новую льдину на каждое открытие.
 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Глубина ─────────────────────────────────────────────────────────────────

/** Дно Марианской впадины, Бездна Челленджера: самое глубокое место океана. */
export const CHALLENGER_DEEP = 10_994;

/**
 * Глубина слоя в метрах — по логарифмической шкале.
 *
 * Слой `i` из `n` стоит на глубине 10 994^(i/(n−1)): первый — на метре, последний
 * ровно на дне Марианской впадины, а каждый следующий примерно в 1,86 раза
 * глубже предыдущего (при семнадцати слоях). Логарифм, а не прямая, потому что
 * нишевость так и растёт: между поездами и календарём разницы почти нет, между
 * мемами и «трэп-хаусом» — пропасть.
 *
 * Округляется до двух значащих цифр, как пишут глубины на картах: «−140 м», а
 * не «−143 м». Последний слой — точно, иначе пропадает шутка.
 */
export function depthOf(i: number, n: number): number {
  if (n <= 1) return 1;
  if (i >= n - 1) return CHALLENGER_DEEP;
  const raw = Math.pow(CHALLENGER_DEEP, i / (n - 1));
  if (raw < 10) return Math.round(raw);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / magnitude) * magnitude;
}

// ─── Цвет ────────────────────────────────────────────────────────────────────

/**
 * Насколько вечер притушил воду: 0 — день, ночью вода у поверхности уже на
 * две трети тёмная.
 *
 * Не своя палитра на ночь, а та же смесь двух токенов, сдвинутая к дну: своя
 * понадобилась бы каждому слою, а сдвиг работает на любой глубине сам.
 */
export const DIM: Record<Mood, number> = { day: 0, dusk: 0.4, night: 0.62, blood: 0.66 };

/** Доля дна в воде на глубине `t`. */
const deepShare = (t: number, dim: number) => t + (1 - t) * dim;
/** Доля льда в цвете льдины на глубине `t`, в процентах. */
const iceShare = (t: number, lift: number, dim: number) =>
  Math.max(0, Math.min(100, Math.round(100 - 58 * t - 40 * dim + lift)));

/**
 * Цвет воды на глубине `t` ∈ [0, 1] — смесь двух токенов в OKLab.
 *
 * Два цвета вместо палитры на каждый слой: поверхность и дно, а между ними
 * сколько угодно ступеней. OKLab, а не sRGB: в нём смесь темнеет равномерно для
 * глаза, а в sRGB середина выходит грязно-серой. Ступени, а не плавный
 * градиент, — как пояса глубин на морской карте.
 *
 * `wine` — доля кровавой луны у самой поверхности: в её час вода под ней
 * винная, и чем глубже, тем меньше — свет луны до дна не доходит.
 */
export const waterAt = (t: number, dim = 0, wine = 0) => {
  const water = `color-mix(in oklab, rgb(var(--deep)) ${Math.round(deepShare(t, dim) * 100)}%, rgb(var(--water)))`;
  const red = Math.round(wine * 100 * (1 - t) * (1 - t));
  return red > 0 ? `color-mix(in oklab, rgb(var(--blood)) ${red}%, ${water})` : water;
};

/** Лёд на глубине: светлее воды вокруг, но тоже уходит в глубину. */
export const iceAt = (t: number, lift = 0, dim = 0) =>
  `color-mix(in oklab, rgb(var(--ice)) ${iceShare(t, lift, dim)}%, ${waterAt(t, dim)})`;

/**
 * Светлота токенов в OKLab — льда, воды у поверхности и дна.
 *
 * Нужна, чтобы выбрать цвет текста на смеси, не меряя пиксели: в OKLab
 * светлота смеси — та же смесь светлот. Поменял токен в `globals.css` —
 * пересчитай здесь, иначе текст на слоях выберет не тот цвет.
 */
const LIGHTNESS = { ice: 0.98, water: 0.9, deep: 0.2 };

const waterLightness = (t: number, dim: number) => {
  const p = deepShare(t, dim);
  return LIGHTNESS.water * (1 - p) + LIGHTNESS.deep * p;
};

/**
 * Светлый ли текст нужен на воде и на льду этой глубины.
 *
 * Порог 0.6 — там, где тёмный текст и белый держат одинаковый контраст, около
 * 4:1 оба. Выше — тёмный, ниже — светлый.
 */
export const lightOnWater = (t: number, dim: number) => waterLightness(t, dim) < 0.6;
export const lightOnIce = (t: number, dim: number) => {
  const q = iceShare(t, 0, dim) / 100;
  return LIGHTNESS.ice * q + waterLightness(t, dim) * (1 - q) < 0.6;
};

// ─── Профиль айсберга ────────────────────────────────────────────────────────

/**
 * Ширина айсберга на глубине `t` ∈ [0, 1], в долях доступной ширины.
 *
 * Синус на подкрученной шкале: t^0.62 растягивает верх, поэтому айсберг быстро
 * раздаётся под водой и долго сужается ко дну, как настоящий. Множитель 0.94 не
 * даёт синусу вернуться в ноль — у айсберга тупое дно, а не игла. Минимум 0.56,
 * чтобы в самом узком слое помещалось название.
 */
function profile(t: number): number {
  return 0.56 + 0.44 * Math.sin(Math.PI * Math.pow(t, 0.62) * 0.94);
}

/** Слой льда: координаты в процентах коробки слоя, 0–100 по обеим осям. */
export type IceLayer = {
  /** Левый и правый край сверху, посередине и снизу: середина даёт грань. */
  left: [number, number, number];
  right: [number, number, number];
  /** Ребро между светлой и тёмной гранью: x сверху и x снизу. */
  ridge: [number, number];
};

export type Iceberg = {
  layers: IceLayer[];
  /**
   * Верхушка над водой: края основания и ребро — те же, что у первого слоя
   * под водой, чтобы айсберг шёл через линию воды одним телом, а не ступенькой.
   */
  tip: { left: number; right: number; ridge: number; peak: number; shoulder: number };
};

/**
 * Айсберг из `n` слоёв на сегодняшний день.
 *
 * Края считаются на границах слоёв (их n + 1), чтобы соседние слои совпадали
 * краями и айсберг читался одним телом, а не стопкой плашек. На каждый край —
 * немного дрожи и общий изгиб оси (синус по глубине): ровно симметричный
 * айсберг выглядит нарисованным циркулем.
 */
export function icebergFor(n: number, seed: number): Iceberg {
  const rand = seeded(seed);
  const jitter = (amount: number) => (rand() - 0.5) * 2 * amount;
  const phase = rand() * Math.PI * 2;

  const edges = Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n;
    const width = Math.min(1, profile(t) + jitter(0.035)) * 100;
    const centre = 50 + 3.2 * Math.sin(2.1 * Math.PI * t + phase);
    const l = Math.max(0, centre - width / 2);
    const r = Math.min(100, centre + width / 2);
    // Ребро между гранями — в правой трети и общее у соседних слоёв, как и
    // края: тогда грань тянется через весь айсберг одной плоскостью. Случайное
    // в каждом слое ребро складывалось в зигзаг через текст и читалось мусором.
    return { l, r, k: l + (r - l) * (0.74 + jitter(0.05)) };
  });

  const layers = Array.from({ length: n }, (_, i) => {
    const top = edges[i];
    const bottom = edges[i + 1];
    const lm = (top.l + bottom.l) / 2 + jitter(2.2);
    const rm = (top.r + bottom.r) / 2 + jitter(2.2);
    return {
      left: [top.l, lm, bottom.l] as [number, number, number],
      right: [top.r, rm, bottom.r] as [number, number, number],
      ridge: [top.k, bottom.k] as [number, number]
    };
  });

  const base = edges[0];
  return {
    layers,
    tip: {
      left: base.l,
      right: base.r,
      ridge: base.k,
      peak: base.l + (base.r - base.l) * (0.55 + rand() * 0.18),
      shoulder: 0.5 + rand() * 0.2
    }
  };
}

const pts = (list: Point[]) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/** Контур слоя: по нему режется всё, что не должно вылезать за лёд. */
const outline = (layer: IceLayer) => {
  const [lt, lm, lb] = layer.left;
  const [rt, rm, rb] = layer.right;
  return pts([[lt, 0], [rt, 0], [rm, 50], [rb, 100], [lb, 100], [lm, 50]]);
};

// ─── Трещина ─────────────────────────────────────────────────────────────────

/**
 * Трещина — как бьётся стекло. Из точки удара в разные стороны идут трещины
 * разной длины, прямыми кусками с изломами; между ними — ломаные кольца с
 * разрывами; часть осколков между трещинами ловит свет иначе, чем соседи; на
 * изломах вспыхивают блики, в месте удара — крошка. Через точку удара от края
 * до края проходит линия раскола (`split`): по ней слой режется надвое, и
 * нижняя часть откалывается (`IceSlice`).
 *
 * Каждая трещина растёт сама, со своей скоростью и до своей длины, поэтому край
 * у паутины рваный. Прежняя проступала растущим овалом, и по краю её ровно
 * обрезал круг — «банально, в радиусе круга», сказал владелец 25 октября 2026.
 * До того была одна черта через слой — «палочки».
 *
 * Всё в пикселях коробки слоя (`w`×`h` — её размер в момент удара), и SVG
 * трещины рисуется в них же, один к одному. Поэтому трещину можно растить
 * штрихом: в растянутом SVG штрих считался бы в пикселях экрана, а длина — в
 * процентах, и трещины шли бы кусками.
 *
 * Время у паутины своё, в миллисекундах от удара (`t0`…`t1` у каждой
 * трещины): наведение показывает начало медленно, нажатие доигрывает остальное.
 */
type Crack = { points: Point[]; length: number; t0: number; t1: number; weight: 'split' | 'ray' | 'ring' | 'chip' };
type Facet = { points: Point[]; t0: number; light: boolean; alpha: number };

export type Web = {
  /** Точка удара, в процентах коробки. */
  at: Point;
  w: number;
  h: number;
  /** Линия раскола в процентах коробки: по ней `IceSlice` режет слой. */
  split: Point[];
  /** Всё дальше — в пикселях коробки. */
  cracks: Crack[];
  facets: Facet[];
  /** Где и когда на изломе вспыхивает блик. */
  glints: { at: Point; t: number }[];
  /** Когда паутина дорастает целиком. */
  end: number;
};

/** Сколько миллисекунд паутины показывает наведение: трещины пошли, раскола ещё нет. */
export const TEASE_MS = 55;
/** Наведение играет их в восемь раз медленнее: лёд «пошёл», а не «треснул». */
const TEASE_SLOW = 8;
/** Сколько проступает осколок, который ловит свет. */
const FACET_MS = 140;
/**
 * За сколько дорастает самая длинная трещина: переход в раздел — через 380 мс
 * после нажатия, и к нему паутина уже целая.
 */
const GROW_MS = 280;

/** Края льда на высоте `y` слоя, в процентах: лёд кончается по силуэту, а не по коробке. */
function edgesAt(layer: IceLayer, y: number): [number, number] {
  const [lt, lm, lb] = layer.left;
  const [rt, rm, rb] = layer.right;
  const k = y <= 50 ? y / 50 : (y - 50) / 50;
  return y <= 50 ? [lt + (lm - lt) * k, rt + (rm - rt) * k] : [lm + (lb - lm) * k, rm + (rb - rm) * k];
}

const lengthOf = (line: Point[]) =>
  line.reduce((sum, [x, y], i) => (i ? sum + Math.hypot(x - line[i - 1][0], y - line[i - 1][1]) : 0), 0);

/**
 * Скол стекла: прямые куски по 7–27 px, на каждом стыке излом до ±16°. Не
 * волнистая линия — стекло и лёд ломаются гранями. Кончается, не дойдя до
 * кромки слоя: обрезанная ею трещина читалась бы линейкой.
 */
function shatter(from: Point, angle: number, length: number, h: number, rand: () => number): Point[] {
  const points: Point[] = [from];
  let [x, y] = from;
  let left = length;
  while (left > 1) {
    const step = Math.min(left, 7 + rand() * 20);
    angle += (rand() - 0.5) * 0.55;
    const nx = x + Math.cos(angle) * step;
    const ny = y + Math.sin(angle) * step;
    if (ny < 3 || ny > h - 3) break;
    x = nx;
    y = ny;
    points.push([x, y]);
    left -= step;
  }
  return points;
}

/**
 * Линия раскола: середины сдвигаются только вверх-вниз, поэтому она идёт слева
 * направо без петель. По ней слой режется надвое, и петля вывернула бы обломок
 * наизнанку. Размах тает с каждым шагом: скол крупно ломаный, а мелко — ровный.
 */
function splitBetween(a: Point, b: Point, rand: () => number, h: number): Point[] {
  let points: Point[] = [a, b];
  for (let round = 0; round < 5; round++) {
    const next: Point[] = [points[0]];
    const cap = h * 0.14 * Math.pow(0.6, round);
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      const reach = Math.min((bx - ax) * 0.2, cap);
      next.push([(ax + bx) / 2, clamp((ay + by) / 2 + (rand() - 0.5) * 2 * reach, h * 0.08, h * 0.92)], points[i + 1]);
    }
    points = next;
  }
  return points;
}

/** Точка на ломаной, идущей от удара, на расстоянии `r` от него, — и сколько до неё пройти вдоль. */
function along(line: Point[], [cx, cy]: Point, r: number): { at: Point; walked: number } | null {
  let walked = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const d0 = Math.hypot(ax - cx, ay - cy);
    const d1 = Math.hypot(bx - cx, by - cy);
    const step = Math.hypot(bx - ax, by - ay);
    if (d0 <= r && d1 >= r) {
      const k = d1 === d0 ? 0 : (r - d0) / (d1 - d0);
      return { at: [ax + (bx - ax) * k, ay + (by - ay) * k], walked: walked + step * k };
    }
    walked += step;
  }
  return null;
}

/**
 * Паутина трещин на слое с коробкой `w`×`h` пикселей.
 *
 * `hit` — точка удара в пикселях коробки: куда навели или нажали. Без неё —
 * где-нибудь в середине льда (так бьёт клавиатура). По высоте удар держится в
 * средней трети слоя, по ширине — не ближе восьмой части льда к краю: у самой
 * кромки паутине некуда расходиться.
 */
export function webAt(layer: IceLayer, w: number, h: number, rand: () => number, hit?: Point): Web {
  const y = clamp(hit ? hit[1] : h * (0.38 + rand() * 0.24), h * 0.32, h * 0.68);
  const [l, r] = edgesAt(layer, (y / h) * 100).map((edge) => (edge / 100) * w);
  const margin = (r - l) * 0.12;
  const x = clamp(hit ? hit[0] : l + (r - l) * (0.3 + rand() * 0.4), l + margin, r - margin);
  const centre: Point = [x, y];
  const cracks: Crack[] = [];
  const grow = (points: Point[], t0: number, speed: number, weight: Crack['weight']) => {
    const length = lengthOf(points);
    if (points.length < 2 || length < 2) return null;
    const crack = { points, length, t0, t1: t0 + length / speed, weight };
    cracks.push(crack);
    return crack;
  };

  // Раскол — от края коробки до края через удар; за силуэтом его срежет лёд.
  // Идёт после паутины, зато быстро: сначала лёд крошится под ударом, потом
  // его разваливает. Наведение раскола не показывает — до него лёд держится.
  const end = () => clamp(y + (rand() - 0.5) * h * 0.5, h * 0.15, h * 0.85);
  const westward = splitBetween([-4, end()], centre, rand, h);
  const eastward = splitBetween(centre, [w + 4, end()], rand, h);

  type Spoke = { angle: number; crack: Crack; speed: number };
  const spokes: Spoke[] = [];
  const halves: Spoke[] = [];
  for (const [points, angle] of [[[...westward].reverse(), Math.PI], [eastward, 0]] as [Point[], number][]) {
    const speed = 1.9 + rand() * 0.5;
    const crack = grow(points, TEASE_MS + rand() * 8, speed, 'split');
    if (crack) halves.push({ angle, crack, speed });
  }
  spokes.push(...halves);

  // Трещины во все стороны, длины вразнобой: коротких, средних и длинных
  // примерно поровну — так у паутины рваный край, а не круг.
  const count = 9 + Math.floor(rand() * 6);
  for (let k = 0; k < count; k++) {
    let angle = ((k + 0.15 + rand() * 0.7) / count) * Math.PI * 2 - Math.PI;
    // Совсем пологие отводятся: вбок уже идёт раскол.
    if (Math.abs(Math.sin(angle)) < 0.1) angle += (angle > 0) === (Math.cos(angle) > 0) ? 0.12 : -0.12;
    const pick = rand();
    const length = pick < 0.3 ? 12 + rand() * 18 : pick < 0.72 ? 30 + rand() * 40 : 70 + rand() * 80;
    const points = shatter(centre, angle, length, h, rand);
    const speed = Math.max(0.45 + rand() * 0.45, lengthOf(points) / GROW_MS);
    const crack = grow(points, rand() * 10, speed, 'ray');
    if (!crack) continue;
    spokes.push({ angle, crack, speed });
    // Ветка с излома: лёд редко ломается одной чертой.
    if (points.length > 2 && crack.length > 24 && rand() < 0.55) {
      const i = 1 + Math.floor(rand() * (points.length - 2));
      const [fx, fy] = points[i];
      const [px, py] = points[i - 1];
      const turn = Math.atan2(fy - py, fx - px) + (rand() < 0.5 ? -1 : 1) * (0.45 + rand() * 0.45);
      const walked = lengthOf(points.slice(0, i + 1));
      const twig = shatter([fx, fy], turn, (crack.length - walked) * (0.3 + rand() * 0.35) + 6, h, rand);
      grow(twig, crack.t0 + walked / speed, speed * (0.8 + rand() * 0.2), 'ray');
    }
  }

  // Отщепы от раскола — там, где он уже прошёл: голая черта читалась бы линейкой.
  for (const half of halves) {
    const { points } = half.crack;
    for (let k = 0, twigs = 1 + Math.floor(rand() * 2); k < twigs && points.length > 3; k++) {
      const i = 2 + Math.floor(rand() * (points.length - 3));
      const [ax, ay] = points[i];
      if (Math.hypot(ax - x, ay - y) < 40 || ax < l || ax > r) continue;
      const [px, py] = points[i - 1];
      const turn = Math.atan2(ay - py, ax - px) + (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 0.6);
      const walked = lengthOf(points.slice(0, i + 1));
      grow(shatter([ax, ay], turn, 6 + rand() * 16, h, rand), half.crack.t0 + walked / half.speed, 0.6, 'ray');
    }
  }

  // Крошка под ударом: крошечные трещины во все стороны.
  for (let k = 0, chips = 5 + Math.floor(rand() * 4); k < chips; k++) {
    const angle = rand() * Math.PI * 2;
    const from: Point = [x + Math.cos(angle) * rand() * 2, y + Math.sin(angle) * rand() * 2];
    grow(shatter(from, angle, 3 + rand() * 6, h, rand), rand() * 6, 0.3, 'chip');
  }

  // Кольца — ломаные хорды между соседними трещинами, на неровных расстояниях и
  // с разрывами: у каждой пары своя высота кольца, и не у каждой оно есть.
  // Хорда растёт от той трещины, до которой треск дошёл раньше. Между кольцами —
  // осколки: одни ловят свет, другие темнее, большинство — как лёд вокруг.
  spokes.sort((a, b) => a.angle - b.angle);
  const levels = [10, 21, 34, 50];
  const chance = [0.85, 0.7, 0.55, 0.4];
  const facets: Facet[] = [];
  const glints: Web['glints'] = [];
  for (let i = 0; i < spokes.length; i++) {
    const a = spokes[i];
    const b = spokes[(i + 1) % spokes.length];
    const gap = (b.angle - a.angle + Math.PI * 2) % (Math.PI * 2);
    if (gap === 0 || gap > 1.5) continue;
    let inner: [Point, Point] | null = null;
    for (let j = 0; j < levels.length; j++) {
      const base = levels[j] * (0.85 + rand() * 0.35);
      const pa = along(a.crack.points, centre, base * (0.8 + rand() * 0.4));
      const pb = along(b.crack.points, centre, base * (0.8 + rand() * 0.4));
      if (!pa || !pb || rand() > chance[j]) {
        inner = null;
        continue;
      }
      const ta = a.crack.t0 + pa.walked / a.speed;
      const tb = b.crack.t0 + pb.walked / b.speed;
      const t0 = Math.max(ta, tb) + 6;
      const pull = 0.06 + rand() * 0.1;
      const middle: Point = [
        (pa.at[0] + pb.at[0]) / 2 + (x - (pa.at[0] + pb.at[0]) / 2) * pull,
        (pa.at[1] + pb.at[1]) / 2 + (y - (pa.at[1] + pb.at[1]) / 2) * pull
      ];
      const chord = rand() < 0.5 ? [pa.at, pb.at] : [pa.at, middle, pb.at];
      grow(ta <= tb ? chord : [...chord].reverse(), t0, 0.7, 'ring');
      const tone = rand();
      // Светлый осколок виден на тёмном льду глубины, тёмный — на белом у
      // поверхности: так паутина читается стеклом на любом слое.
      if (tone < 0.5) {
        facets.push({
          points: inner ? [inner[0], pa.at, pb.at, inner[1]] : [centre, pa.at, pb.at],
          t0: t0 + 10,
          light: tone < 0.25,
          alpha: tone < 0.25 ? 0.22 + rand() * 0.18 : 0.06 + rand() * 0.06
        });
      }
      if (j < 2 && rand() < 0.35) glints.push({ at: pa.at, t: ta });
      inner = [pa.at, pb.at];
    }
  }

  const percent = (line: Point[]): Point[] => line.map(([px, py]) => [(px / w) * 100, (py / h) * 100]);
  return {
    at: [(x / w) * 100, (y / h) * 100],
    w,
    h,
    split: percent([...westward, ...eastward.slice(1)]),
    cracks,
    facets,
    glints,
    end: Math.max(...cracks.map((c) => c.t1), ...facets.map((f) => f.t0 + FACET_MS))
  };
}

// ─── Слой льда ───────────────────────────────────────────────────────────────

/**
 * Один слой: две грани, светлая слева и тёмная справа, и волосяной контур.
 *
 * Свет сверху-слева, как везде на сайте, но ни одной тени — глубину дают две
 * плоские заливки и ребро между ними. SVG растянут на слой
 * (`preserveAspectRatio="none"`), а линии — `non-scaling-stroke`, иначе на
 * широком слое контур стал бы толще, чем на узком.
 *
 * У выбранного слоя контур плотнее: слой должен читаться кнопкой, которую вот
 * сейчас нажмут, а не только светлеть.
 *
 * При трещине слой рисуется дважды, по обе стороны раскола, и нижняя часть
 * откалывается вниз. `veil` — туман поверх льда, но под надписью.
 */
export function IceSlice({
  layer,
  t,
  dim,
  lit,
  crack,
  veil = null
}: {
  layer: IceLayer;
  t: number;
  dim: number;
  lit: boolean;
  crack: Point[] | null;
  veil?: string | null;
}) {
  // Без двоеточий: `useId` отдаёт «:r1:», а внутри `url(#…)` двоеточие
  // понимают не все движки.
  const id = useId().replace(/:/g, '');
  const [lt, lmid, lb] = layer.left;
  const [rt, rmid, rb] = layer.right;
  const [kt, kb] = layer.ridge;
  const lift = lit ? 12 : 0;
  const onDark = lightOnIce(t, dim);
  const edge = onDark ? `rgb(var(--surface) / ${lit ? 0.55 : 0.14})` : `rgb(var(--ink) / ${lit ? 0.5 : 0.16})`;
  // Внутренняя грань: волосяная линия от ребра вниз-влево. Плоская заливка в
  // две краски читалась детской аппликацией; одна грань и мягкий перелив
  // сверху вниз дают льду объём без единой тени.
  const facet = onDark ? 'rgb(var(--surface) / 0.07)' : 'rgb(var(--ink) / 0.06)';

  const faces = (
    <>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={iceAt(t, lift + 10, dim)} />
          <stop offset="1" stopColor={iceAt(t, lift + 1, dim)} />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={iceAt(t, lift - 4, dim)} />
          <stop offset="1" stopColor={iceAt(t, lift - 11, dim)} />
        </linearGradient>
      </defs>
      <polygon points={pts([[lt, 0], [kt, 0], [kb, 100], [lb, 100], [lmid, 50]])} fill={`url(#${id}a)`} />
      <polygon points={pts([[kt, 0], [rt, 0], [rmid, 50], [rb, 100], [kb, 100]])} fill={`url(#${id}b)`} />
      <line
        x1={kt - (kt - lt) * 0.42}
        y1={0}
        x2={lb + (kb - lb) * 0.28}
        y2={100}
        stroke={facet}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={pts([[lt, 0], [lmid, 50], [lb, 100]])}
        fill="none"
        stroke={edge}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={pts([[rt, 0], [rmid, 50], [rb, 100]])}
        fill="none"
        stroke={edge}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {veil ? <polygon points={outline(layer)} fill={veil} /> : null}
    </>
  );

  if (!crack) {
    return (
      <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {faces}
      </svg>
    );
  }

  const ends = [crack[0], crack[crack.length - 1]].sort((a, b) => a[0] - b[0]);
  const line = crack[0][0] <= crack[crack.length - 1][0] ? crack : [...crack].reverse();
  const upper = pts([[0, 0], [100, 0], [100, ends[1][1]], ...[...line].reverse(), [0, ends[0][1]]]);
  const lower = pts([[0, ends[0][1]], ...line, [100, ends[1][1]], [100, 100], [0, 100]]);

  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
      <defs>
        <clipPath id={`${id}u`}>
          <polygon points={upper} />
        </clipPath>
        <clipPath id={`${id}l`}>
          <polygon points={lower} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}u)`}>{faces}</g>
      {/* Отколотая часть: съезжает вниз после того, как трещина дошла до края. */}
      <g clipPath={`url(#${id}l)`} className="animate-[calve_0.5s_cubic-bezier(0.5,0,0.9,0.6)_0.2s_both]">
        {faces}
      </g>
    </svg>
  );
}

/** Толщина и яркость трещины: раскол — главный, кольца — тоньше всего. */
const WEIGHT: Record<Crack['weight'], { width: [number, number]; alpha: [number, number] }> = {
  split: { width: [3, 1.3], alpha: [0.85, 0.85] },
  ray: { width: [2.2, 0.9], alpha: [0.75, 0.7] },
  ring: { width: [1.6, 0.7], alpha: [0.55, 0.45] },
  chip: { width: [1.4, 0.6], alpha: [0.7, 0.6] }
};

/**
 * Сама паутина — под надписями слоя: она гуще прежней черты, и поверх
 * названия читалась бы зачёркиванием. Не выходит за лёд: всё, что за силуэтом
 * слоя, срезается по его контуру (прежняя черта вылезала в воду — жалоба
 * владельца от 25 октября 2026).
 *
 * Каждая трещина прорисовывается штрихом от своего начала. `from`…`to` — какой
 * отрезок времени паутины показать: наведение — с нуля до `TEASE_MS`, в восемь
 * раз медленнее и бледнее; нажатие — с того же места до конца, в настоящем
 * темпе и в полную силу. Лёд, который начал трескаться, доламывается, а не
 * трескается заново.
 */
export function CrackLine({ layer, web, from = 0, to }: { layer: IceLayer; web: Web; from?: number; to?: number }) {
  const id = useId().replace(/:/g, '');
  const { w, h } = web;
  const until = to ?? web.end;
  const slow = to === undefined ? 1 : TEASE_SLOW;
  // Пошла, но держится — бледнее: тёмная паутина под названием спорила с ним.
  const k = to === undefined ? 1 : 0.6;
  const sec = (ms: number) => `${((ms * slow) / 1000).toFixed(3)}s`;
  /** Как отрезок `t0…t1` выглядит в окне `from…until`: доля в начале и в конце, когда начать и сколько длиться. */
  const span = (t0: number, t1: number) => {
    const share = (s: number) => clamp((s - t0) / Math.max(1, t1 - t0), 0, 1);
    const start = Math.max(t0, from);
    return { a: share(from), b: share(until), begin: sec(Math.max(0, start - from)), dur: sec(Math.max(1, Math.min(t1, until) - start)) };
  };
  const x = (web.at[0] / 100) * w;
  const y = (web.at[1] / 100) * h;
  const [lt, lm, lb] = layer.left;
  const [rt, rm, rb] = layer.right;
  const ice = pts(
    [[lt, 0], [rt, 0], [rm, 50], [rb, 100], [lb, 100], [lm, 50]].map(([px, py]): Point => [(px / 100) * w, (py / 100) * h])
  );
  const lines = web.cracks.map((crack, i) => ({ crack, i, ...span(crack.t0, crack.t1) })).filter((line) => line.b > 0);
  // Каждая трещина дважды: широкая светлая кромка и тонкая тёмная сердцевина —
  // так скол и выглядит. Сначала все кромки, потом все сердцевины: иначе
  // кромка следующей трещины перечёркивала бы сердцевину предыдущей.
  const stroke = (core: 0 | 1) =>
    lines.map(({ crack, i, a, b, begin, dur }) => {
      const { width, alpha } = WEIGHT[crack.weight];
      const off = (share: number) => (crack.length * (1 - share)).toFixed(1);
      return (
        <polyline
          key={`${core}-${i}`}
          points={pts(crack.points)}
          fill="none"
          stroke={core ? `rgb(var(--deep) / ${(alpha[1] * k).toFixed(2)})` : `rgb(var(--surface) / ${(alpha[0] * k).toFixed(2)})`}
          strokeWidth={width[core]}
          strokeLinejoin="round"
          strokeLinecap="round"
          // Штрих длиной в трещину и пробел длиннее неё: сдвигом штриха трещина
          // растёт от начала к концу.
          strokeDasharray={`${crack.length.toFixed(1)} ${(crack.length + 4).toFixed(1)}`}
          strokeDashoffset={off(a)}
        >
          {a < b ? <animate attributeName="stroke-dashoffset" from={off(a)} to={off(b)} begin={begin} dur={dur} fill="freeze" /> : null}
        </polyline>
      );
    });
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${w.toFixed(1)} ${h.toFixed(1)}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <clipPath id={`${id}i`}>
          <polygon points={ice} />
        </clipPath>
        <radialGradient id={`${id}g`}>
          <stop offset="0" stopColor="rgb(var(--surface))" stopOpacity="0.95" />
          <stop offset="1" stopColor="rgb(var(--surface))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${id}i)`}>
        {web.facets.map((facet, i) => {
          const { a, b, begin, dur } = span(facet.t0, facet.t0 + FACET_MS);
          if (b <= 0) return null;
          const shade = (share: number) => (facet.alpha * share * k).toFixed(3);
          return (
            <polygon key={i} points={pts(facet.points)} fill={facet.light ? 'rgb(var(--surface))' : 'rgb(var(--deep))'} opacity={shade(a)}>
              {a < b ? <animate attributeName="opacity" from={shade(a)} to={shade(b)} begin={begin} dur={dur} fill="freeze" /> : null}
            </polygon>
          );
        })}
        {stroke(0)}
        {stroke(1)}
        {/* Место удара: лёд там раздроблен в белую крошку. */}
        <circle cx={x} cy={y} r="6" fill={`url(#${id}g)`} />
        {/* Блики на изломах: вспыхивают, когда до них доходит трещина. */}
        {web.glints
          .filter((glint) => glint.t >= from && glint.t <= until)
          .map((glint, i) => (
            <g key={i} transform={`translate(${glint.at[0].toFixed(1)} ${glint.at[1].toFixed(1)})`} opacity="0">
              <circle r="2.5" fill={`url(#${id}g)`} />
              <path d="M-4.5 0H4.5M0-4.5V4.5" stroke="rgb(var(--surface))" strokeWidth="0.8" strokeLinecap="round" />
              <animate attributeName="opacity" values="0;1;0" begin={sec(glint.t - from)} dur="0.32s" fill="freeze" />
            </g>
          ))}
      </g>
    </svg>
  );
}

/**
 * Осколки от места удара: разлетаются и тонут, а не падают.
 *
 * В воде сопротивление съедает горизонтальную скорость быстро, а тяга вниз
 * остаётся, поэтому кривая — ease-in по вертикали и короткий снос вбок.
 * Осколок — HTML, а не часть растянутого SVG: в растянутом треугольник стал
 * бы щепкой.
 */
export function Shards({ web, t, dim, seed }: { web: Web; t: number; dim: number; seed: number }) {
  // Один раз на трещину: пересчёт на каждой перерисовке (наведение мыши,
  // приход ответов) двигал бы осколки посреди полёта.
  const shards = useMemo(() => {
    const rand = seeded(seed);
    // Сколько осколков — тоже случай, от пяти до девяти: одинаковая горсть на
    // каждом нажатии выдаёт, что это одна и та же анимация.
    const count = 5 + Math.floor(rand() * 5);
    return Array.from({ length: count }, () => {
      const angle = rand() * Math.PI * 2;
      const dist = 3 + rand() * 18;
      return {
        x: web.at[0] + ((Math.cos(angle) * dist) / web.w) * 100,
        y: clamp(web.at[1] + ((Math.sin(angle) * dist) / web.h) * 100, 12, 88),
        size: 4 + rand() * 6,
        a: rand() * 40,
        b: 60 + rand() * 40,
        dx: Math.cos(angle) * (12 + rand() * 30),
        dy: 36 + rand() * 70,
        rot: (rand() - 0.5) * 380
      };
    });
  }, [web, seed]);
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {shards.map(({ x, y, size, a, b, dx, dy, rot }, i) => (
        <span
          key={i}
          className="absolute animate-[shard-sink_0.8s_cubic-bezier(0.4,0,0.9,0.5)_0.12s_both]"
          style={
            {
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              background: iceAt(t, 14, dim),
              clipPath: `polygon(${a}% 0, 100% ${b}%, 0 100%)`,
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
              '--rot': `${rot}deg`
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

// ─── Верхушка ────────────────────────────────────────────────────────────────

/**
 * Верхушка над водой. Маленькая, как у настоящего айсберга: девять десятых
 * льда под водой, потому что лёд легче морской воды ровно настолько
 * (917 против 1025 кг/м³). Видно поле и кончик — остальное надо листать.
 */
export function IceTip({ tip, dim }: { tip: Iceberg['tip']; dim: number }) {
  const { left, right, peak, shoulder, ridge: ridgeX } = tip;
  const edge = dim > 0.3 ? 'rgb(var(--surface) / 0.22)' : 'rgb(var(--ink) / 0.16)';
  // Те же краски и то же ребро, что у верхнего слоя под водой (`IceSlice` при
  // t = 0): лёд над водой и под ней — один кусок.
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <polygon
        points={pts([[left, 100], [left + (peak - left) * 0.4, 100 - 46 * shoulder], [peak, 0], [ridgeX, 100]])}
        fill={iceAt(0, 10, dim)}
      />
      <polygon
        points={pts([[ridgeX, 100], [peak, 0], [peak + (right - peak) * 0.45, 38], [right, 100]])}
        fill={iceAt(0, -4, dim)}
      />
      <polyline
        points={pts([[left, 100], [left + (peak - left) * 0.4, 100 - 46 * shoulder], [peak, 0], [peak + (right - peak) * 0.45, 38], [right, 100]])}
        fill="none"
        stroke={edge}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <line x1={peak} y1={0} x2={ridgeX} y2={100} stroke={edge} strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Полоса льда в толще линии воды: верхушка и первый слой иначе разделены
 * полосой воды, и айсберг читался двумя кусками. Те же края, ребро и краски,
 * что у них обоих. По `data-ice-band` вода находит, где лёд: волна от него
 * отражается. `veil` — туман поверх льда.
 */
export function IceBand({ tip, dim, veil = null }: { tip: Iceberg['tip']; dim: number; veil?: string | null }) {
  const { left, right, ridge } = tip;
  const over = (colour: string) => (veil ? `linear-gradient(${veil}, ${veil}), ${colour}` : colour);
  return (
    <>
      <span
        data-ice-band=""
        className="absolute inset-y-0"
        style={{ left: `${left}%`, width: `${ridge - left}%`, background: over(iceAt(0, 10, dim)) }}
      />
      <span
        data-ice-band=""
        className="absolute inset-y-0"
        style={{ left: `${ridge}%`, width: `${right - ridge}%`, background: over(iceAt(0, -4, dim)) }}
      />
    </>
  );
}

// ─── Погода ──────────────────────────────────────────────────────────────────

export type Fall = 'none' | 'drizzle' | 'rain' | 'pour' | 'snow';

/** Погода за окном — так, как её рисует пульт. */
export type Look = {
  /** Насколько затянуто небо: 0 — ясно, 1 — сплошная пелена. */
  overcast: number;
  fall: Fall;
  fog: boolean;
  storm: boolean;
  /** Ветер, 0–1: наклон дождя и зыбь на воде. */
  wind: number;
};

/**
 * Что рисовать по погоде Цюриха. Девять состояний плитки погоды сводятся к
 * пелене, осадкам, туману и грозе. Ветер считается к 45 км/ч: для озера это
 * уже шторм, сильнее зыбь не растёт. Погоды нет (провайдер молчит) — ясно:
 * выдумывать дождь хуже, чем его не показать.
 */
export function lookOf(sky: PultSky | null): Look {
  const wind = clamp((sky?.wind ?? 8) / 45, 0, 1);
  const look = (overcast: number, fall: Fall = 'none', fog = false, storm = false): Look => ({
    overcast,
    fall,
    fog,
    storm,
    wind
  });
  switch (sky?.condition) {
    case 'partly':
      return look(0.3);
    case 'cloudy':
      return look(0.75);
    case 'fog':
      return look(0.55, 'none', true);
    case 'drizzle':
      return look(0.7, 'drizzle');
    case 'rain':
      return look(0.8, 'rain');
    case 'showers':
      return look(0.75, 'pour');
    case 'snow':
      return look(0.7, 'snow');
    case 'thunder':
      return look(0.9, 'pour', false, true);
    default:
      return look(0);
  }
}

/** Капли по воде: сколько в секунду и как сильно каждая толкает гладь. */
const DROPS: Record<Fall, { rate: number; power: number }> = {
  none: { rate: 0, power: 0 },
  drizzle: { rate: 10, power: 0.18 },
  rain: { rate: 22, power: 0.32 },
  pour: { rate: 40, power: 0.45 },
  snow: { rate: 6, power: 0.08 }
};

/**
 * Туман: цвет и плотность. Днём белёсый, в темноте — светлая серая пелена:
 * белый туман на ночном небе светился бы, как прожектор.
 */
export const fogOf = (dark: boolean, density: number) =>
  dark ? `rgb(var(--water) / ${(0.34 * density).toFixed(3)})` : `rgb(var(--surface) / ${(0.72 * density).toFixed(3)})`;

/** Сколько тумана у каждого слоя сверху: у самой воды гуще, к третьему слою его нет. */
export const FOG_DEPTH = [0.8, 0.45, 0.2];

/**
 * Пелена тумана: ровная заливка и клубы поверх, которые минуту плывут в одну
 * сторону и минуту обратно. Клубы — радиальные градиенты на полосе вдвое шире
 * места. `rise` — пелена густеет книзу, к воде: так она лежит на верхушке.
 */
export function FogBank({ dark, density, still, rise = false }: { dark: boolean; density: number; still: boolean; rise?: boolean }) {
  const puff = (x: number, y: number, rx: number, ry: number, k: number) =>
    `radial-gradient(${rx}% ${ry}% at ${x}% ${y}%, ${fogOf(dark, density * k)}, ${fogOf(dark, 0)})`;
  const fade = rise ? 'linear-gradient(to top, black, transparent)' : undefined;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 animate-[weather-in_1.2s_ease-out_both] overflow-hidden"
      style={{ background: fogOf(dark, density), maskImage: fade, WebkitMaskImage: fade }}
    >
      <span
        className="absolute inset-y-0 left-0 w-[200%]"
        style={{
          background: [puff(12, 55, 18, 70, 0.7), puff(38, 40, 22, 60, 0.55), puff(61, 60, 16, 80, 0.7), puff(86, 45, 24, 65, 0.6)].join(', '),
          animation: still ? undefined : 'fog-drift 64s ease-in-out infinite alternate'
        }}
      />
    </span>
  );
}

/**
 * Дождь и снег: три слоя узора, каждый за цикл едет вниз ровно на свою плитку —
 * шов не виден, а капель на экране сотни при трёх движущихся слоях.
 *
 * Узор — маска (SVG в data-URI), а цвет — токен: в маске только «есть капля
 * или нет», белым, и это не цвет сайта, а форма. Плитки разного размера
 * (97, 131 и 173 px), чтобы слои не складывались в сетку. Дальний слой
 * медленнее и бледнее ближнего — у дождя появляется глубина. Ветер наклоняет
 * весь дождь разом; снег — вполовину, он и так летит боком.
 */
function Precipitation({ fall, wind, dark, seed }: { fall: Exclude<Fall, 'none'>; wind: number; dark: boolean; seed: number }) {
  const snow = fall === 'snow';
  const layers = useMemo(() => {
    const rand = seeded(seed + 707);
    const spec = {
      drizzle: { per: 3, len: 7, speed: 190 },
      rain: { per: 4, len: 12, speed: 430 },
      pour: { per: 6, len: 17, speed: 560 },
      snow: { per: 4, len: 0, speed: 30 }
    }[fall];
    return [0, 1, 2].map((k) => {
      const w = [97, 131, 173][k];
      const h = [220, 260, 300][k];
      const marks = Array.from({ length: spec.per }, () => {
        const x = (rand() * w).toFixed(1);
        const y = (rand() * h).toFixed(1);
        return fall === 'snow'
          ? `<circle cx='${x}' cy='${y}' r='${(1 + rand() * 0.8).toFixed(2)}'/>`
          : `<rect x='${x}' y='${y}' width='1.1' height='${spec.len}' fill='url(#s)'/>`;
      }).join('');
      const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' fill='white'>` +
        "<linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='white' stop-opacity='0'/><stop offset='1' stop-color='white'/></linearGradient>" +
        `${marks}</svg>`;
      return {
        mask: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
        size: `${w}px ${h}px`,
        tile: h,
        seconds: h / (spec.speed * [1, 0.82, 0.66][k]),
        opacity: [1, 0.7, 0.45][k],
        sway: [3, 4.2, 5.6][k]
      };
    });
  }, [fall, seed]);
  const colour = snow
    ? dark
      ? 'rgb(var(--surface) / 0.8)'
      : 'rgb(var(--ink) / 0.3)'
    : dark
      ? `rgb(var(--surface) / ${fall === 'drizzle' ? 0.3 : 0.42})`
      : `rgb(var(--ink) / ${fall === 'drizzle' ? 0.2 : 0.28})`;
  return (
    <div
      className="absolute -inset-x-[30%] -inset-y-[12%] animate-[weather-in_1.2s_ease-out_both]"
      style={{ transform: `rotate(${-(wind * (snow ? 14 : 26)).toFixed(1)}deg)` }}
    >
      {layers.map((layer, k) => (
        <div
          key={k}
          className="absolute inset-x-0 bottom-0"
          style={
            {
              top: -layer.tile,
              opacity: layer.opacity,
              '--tile': `${layer.tile}px`,
              animation: `sky-fall ${layer.seconds.toFixed(2)}s linear infinite`
            } as React.CSSProperties
          }
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: colour,
              maskImage: layer.mask,
              WebkitMaskImage: layer.mask,
              maskSize: layer.size,
              WebkitMaskSize: layer.size,
              animation: snow ? `sky-sway ${layer.sway}s ease-in-out infinite alternate` : undefined
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Гроза: вспышка неба и молния за ней. Раз в одиннадцать секунд и двойной
 * вспышкой, как бывает на самом деле, — не чаще трёх в секунду: чаще вспышка
 * опасна для тех, у кого светочувствительная эпилепсия. Молния — по краю неба,
 * не за вершиной: там она спорила бы с ядром. Без движения грозы нет.
 */
function Lightning({ seed, dark }: { seed: number; dark: boolean }) {
  const bolts = useMemo(() => {
    const rand = seeded(seed + 919);
    const zigzag = (x: number, y: number, to: number, swing: number) => {
      const points: Point[] = [[x, y]];
      while (y < to) {
        x += (rand() - 0.5) * swing;
        y = Math.min(to, y + 6 + rand() * 9);
        points.push([x, y]);
      }
      return points;
    };
    const main = zigzag(rand() < 0.5 ? 8 + rand() * 18 : 74 + rand() * 18, -2, 72, 2.4);
    // Ответвление с середины: молния без него — просто ломаная черта.
    const [fx, fy] = main[Math.floor(main.length * (0.3 + rand() * 0.25))];
    return [main, zigzag(fx, fy, fy + 18 + rand() * 14, 3.2)];
  }, [seed]);
  const flash = { opacity: 0, animation: 'thunder 11s linear 2.5s infinite' };
  return (
    <>
      <span className="absolute inset-0" style={{ ...flash, background: `rgb(var(--surface) / ${dark ? 0.32 : 0.5})` }} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={flash}>
        {bolts.map((bolt, i) =>
          [6, 1.5].map((width) => (
            <polyline
              key={`${i}-${width}`}
              points={pts(bolt)}
              fill="none"
              // Широкая бледная — свечение вокруг, узкая — сам разряд.
              stroke={width > 2 ? 'rgb(var(--surface) / 0.25)' : 'rgb(var(--surface))'}
              strokeWidth={i ? width * 0.6 : width}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))
        )}
      </svg>
    </>
  );
}

/**
 * Свет сквозь воду: светлые столбы, которые медленно качаются, — так солнце
 * пробивает рябь у поверхности. Только в верхних слоях: глубже свет не доходит.
 *
 * Вертикальные, а не наклонные: столб рисуется кусками, по одному в каждом
 * слое, и наклонный рвался бы на каждой границе. Три полосатых узора с разным
 * шагом — чтобы столбы не стояли забором.
 */
export function LightShafts({ strength, still }: { strength: number; still: boolean }) {
  if (strength < 0.02) return null;
  const stripes = (gap: number, width: number) =>
    `repeating-linear-gradient(90deg, transparent 0 ${gap}px, rgb(var(--surface) / 0.6) ${gap + width / 2}px, transparent ${gap + width}px)`;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 -left-[6%] -right-[6%]"
      style={{
        opacity: strength,
        background: [stripes(56, 64), stripes(150, 90), stripes(270, 120)].join(', '),
        animation: still ? undefined : 'ray-sway 13s ease-in-out infinite alternate'
      }}
    />
  );
}

/**
 * Сила света сквозь воду по времени суток: ночью светит луна и город, а не
 * солнце. Едва заметно: ярче столбы читались полосками штрихкода.
 */
export const SHAFTS: Record<Mood, number> = { day: 0.38, dusk: 0.3, night: 0.16, blood: 0.16 };
/** И по глубине: у каждого из верхних слоёв своя доля. */
export const SHAFT_DEPTH = [0.42, 0.3, 0.19, 0.1];

/**
 * Дорожка от кровавой луны на воде: штрихи под луной, с глубиной уже и
 * тусклее. Под льдом, а не поверх: отражение лежит на воде. Стоит там же, где
 * луна, — у правого края на 12 %.
 */
export function MoonGlint({ depth, still }: { depth: number; still: boolean }) {
  const fade = 'linear-gradient(to right, transparent, black 30%, black 70%, transparent)';
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-[12%] flex w-20 justify-center sm:w-28">
      <span
        className="h-full"
        style={{
          width: `${64 - depth * 34}%`,
          opacity: 0.55 - depth * 0.35,
          background: 'repeating-linear-gradient(to bottom, rgb(var(--blood) / 0.75) 0 2px, transparent 2px 8px)',
          maskImage: fade,
          WebkitMaskImage: fade,
          animation: still ? undefined : 'glint 2.8s ease-in-out infinite alternate'
        }}
      />
    </span>
  );
}

// ─── Вода ────────────────────────────────────────────────────────────────────

/** Что пульт делает с водой. `x` — в пикселях окна. */
export type WaterHandle = {
  /** Плеснуть: яма, капли вверх, круги. */
  splash: (x: number, power?: number) => void;
  /** Качнуть айсберг: круги от обоих краёв льда. */
  rock: (power: number) => void;
};

/** Пикселей между столбиками воды: чаще — дороже, реже — волна углами. */
const GAP = 6;
/** Высота полосы воды (`h-5`) и где в ней гладь в покое. */
const BAND = 20;
const REST = 8;
/** Насколько выше полосы долетают брызги. */
const SPRAY = 22;
/** Сколько капель брызг живёт разом. */
const SPRAY_DROPS = 14;
/**
 * Волновое уравнение на столбиках: `WAVE` — квадрат скорости волны в столбиках
 * за подшаг (устойчиво, пока меньше единицы), `TENSION` — слабая пружина к
 * покою, `DAMPING` — затухание. С двумя подшагами за кадр круги бегут около
 * 450 px/s и видны за полэкрана: через треть секунды на 150 px волна ещё в
 * три пикселя, через секунду на 480 px — в пиксель (посчитано заранее, до
 * вёрстки). Схема «столбик отдаёт соседям», с которой начинали, размазывала
 * толчок на месте: в 120 px от него не доходило и пикселя.
 */
const WAVE = 0.45;
const TENSION = 0.003;
const DAMPING = 0.02;
const SUBSTEPS = 2;
const FRAME_MS = 1000 / 60;

/**
 * Линия воды — живая: столбики на пружинах, связанные с соседями.
 *
 * Толчок в одном месте расходится кругами в обе стороны, отражается ото льда и
 * затухает. Толкают курсор (провёл у воды — пошла рябь, нажал у воды —
 * плеснуло), каждая набранная буква (айсберг качнулся), удар по слою и дождь.
 * Под этим — зыбь из трёх синусоид разной длины, сильнее при ветре. Владелец
 * просил волны, с которыми можно играть (25 октября 2026).
 *
 * Покадрово, но не через React: путь пишется прямо в DOM из
 * `requestAnimationFrame`, как лианы у кнопки ПХ. Шаг физики — фиксированный,
 * 60 в секунду: на экране в 120 Гц волна иначе бежала бы вдвое быстрее.
 *
 * Ширина мерится, а не берётся с запасом: прежняя полоса в 2520 px на
 * широком мониторе кончалась, не дойдя до края, и справа воды не было.
 */
export function Waterline({
  still,
  dim,
  floor,
  look,
  wine = 0,
  fog = null,
  handle,
  children
}: {
  still: boolean;
  dim: number;
  floor: string;
  look: Look;
  wine?: number;
  fog?: string | null;
  handle: React.RefObject<WaterHandle | null>;
  /** Лёд, который проходит сквозь линию воды: между водой и гладью. */
  children?: React.ReactNode;
}) {
  const id = useId().replace(/:/g, '');
  const box = useRef<HTMLDivElement | null>(null);
  const under = useRef<SVGSVGElement | null>(null);
  const over = useRef<SVGSVGElement | null>(null);
  const body = useRef<SVGPathElement | null>(null);
  const line = useRef<SVGPathElement | null>(null);
  const shine = useRef<SVGPathElement | null>(null);
  const spray = useRef<SVGGElement | null>(null);
  // Погода приходит, когда вода уже живёт (`/api/pult` отвечает после
  // открытия), — через ref, чтобы не начинать воду заново.
  const weather = useRef(look);
  weather.current = look;

  useLayoutEffect(() => {
    const host = box.current;
    if (!host) return;
    let width = 0;
    let n = 0;
    let y = new Float32Array(0);
    let v = new Float32Array(0);
    let pull = new Float32Array(0);
    /** Насколько у столбика своя зыбь: у льда она гаснет. */
    let calm = new Float32Array(0);
    /** Столбики подо льдом, первый и последний. */
    let ice: Point = [-1, -2];
    let clock = 0;
    let due = 0;
    const drops = Array.from({ length: SPRAY_DROPS }, () => ({ live: false, x: 0, y: 0, vx: 0, vy: 0, r: 1 }));

    const step = () => (n > 1 ? width / (n - 1) : GAP);

    const measure = () => {
      const rect = host.getBoundingClientRect();
      const next = Math.max(1, Math.round(rect.width));
      if (next !== width) {
        width = next;
        n = Math.ceil(width / GAP) + 1;
        y = new Float32Array(n);
        v = new Float32Array(n);
        pull = new Float32Array(n);
        calm = new Float32Array(n);
        const view = `0 ${-SPRAY} ${width} ${BAND + SPRAY}`;
        under.current?.setAttribute('viewBox', view);
        over.current?.setAttribute('viewBox', view);
      }
      let lo = Infinity;
      let hi = -Infinity;
      host.querySelectorAll<HTMLElement>('[data-ice-band]').forEach((el) => {
        const b = el.getBoundingClientRect();
        lo = Math.min(lo, b.left - rect.left);
        hi = Math.max(hi, b.right - rect.left);
      });
      const gap = step();
      ice = lo < hi ? [Math.ceil(lo / gap), Math.floor(hi / gap)] : [-1, -2];
      for (let i = 0; i < n; i++) {
        const x = i * gap;
        // У борта вода стоит: зыбь, качающая лёд, резала бы его линией.
        calm[i] = lo < hi ? 0.15 + 0.85 * Math.min(1, Math.max(lo - x, x - hi, 0) / 24) : 1;
      }
    };

    const level = (i: number) => {
      const x = i * step();
      const w = weather.current;
      const t = clock * (1 + w.wind * 0.8);
      const a = (1.1 + w.wind * 2.6 + (w.storm ? 0.8 : 0)) * calm[i];
      const swell =
        0.62 * Math.sin(x * 0.045 - t * 0.0011) +
        0.28 * Math.sin(x * 0.103 + t * 0.0017 + 1.3) +
        0.1 * Math.sin(x * 0.21 - t * 0.0029 + 4.1);
      return REST + clamp(a * swell + y[i], -REST - 6, BAND - REST - 2);
    };

    const kick = (i: number, power: number) => {
      if (i < 0 || i >= n || (i >= ice[0] && i <= ice[1])) return;
      v[i] += power;
    };

    const physics = () => {
      const w = weather.current;
      // Дождь и снег: капля — толчок в случайном месте.
      due += DROPS[w.fall].rate / 60;
      while (due >= 1) {
        due -= 1;
        kick(Math.floor(Math.random() * n), DROPS[w.fall].power * (0.5 + Math.random()));
      }
      for (let sub = 0; sub < SUBSTEPS; sub++) {
        // У краёв окна вода отражается от себя же: соседом считается сам столбик.
        for (let i = 0; i < n; i++) {
          const left = i > 0 ? y[i - 1] : y[i];
          const right = i < n - 1 ? y[i + 1] : y[i];
          pull[i] = WAVE * (left + right - 2 * y[i]) - TENSION * y[i] - DAMPING * v[i];
        }
        for (let i = 0; i < n; i++) {
          v[i] += pull[i];
          y[i] = clamp(y[i] + v[i], -9, 9);
        }
        // Лёд не качается: столбики под ним стоят, и волна от борта отражается.
        for (let i = Math.max(0, ice[0]); i <= Math.min(n - 1, ice[1]); i++) {
          y[i] = 0;
          v[i] = 0;
        }
      }
      // Брызги летят по дуге и падают обратно — маленьким кругом.
      const gap = step();
      for (const p of drops) {
        if (!p.live) continue;
        p.vy += 0.2;
        p.x += p.vx;
        p.y += p.vy;
        const i = Math.round(p.x / gap);
        if (i < 0 || i >= n) p.live = false;
        else if (p.vy > 0 && p.y >= level(i)) {
          p.live = false;
          kick(i, 0.35);
        }
      }
    };

    const draw = () => {
      if (n < 2) return;
      const gap = step();
      let d = '';
      for (let i = 0; i < n; i++) d += `${i ? 'L' : 'M'}${(i * gap).toFixed(1)} ${level(i).toFixed(2)}`;
      line.current?.setAttribute('d', d);
      shine.current?.setAttribute('d', d);
      body.current?.setAttribute('d', `${d}L${width} ${BAND}L0 ${BAND}Z`);
      const dots = spray.current?.children;
      if (!dots) return;
      drops.forEach((p, k) => {
        const dot = dots[k];
        if (!dot) return;
        dot.setAttribute('r', p.live ? p.r.toFixed(2) : '0');
        if (!p.live) return;
        dot.setAttribute('cx', p.x.toFixed(1));
        dot.setAttribute('cy', p.y.toFixed(1));
      });
    };

    const splash = (clientX: number, power = 5.5) => {
      if (n < 2) return;
      const x = clientX - host.getBoundingClientRect().left;
      const i = Math.round(x / step());
      kick(i, power);
      kick(i - 1, power / 2);
      kick(i + 1, power / 2);
      // Об лёд не плещет: он стоит, вода под ним — тоже.
      if (i >= ice[0] && i <= ice[1]) return;
      let born = 0;
      for (const p of drops) {
        if (p.live || born >= 3 + Math.round(power)) continue;
        born++;
        p.live = true;
        p.x = x + (Math.random() - 0.5) * 8;
        p.y = level(clamp(i, 0, n - 1)) - 1;
        p.vx = (Math.random() - 0.5) * 2.4;
        p.vy = -(1.8 + Math.random() * 2.4) * Math.min(1.4, power / 2.5);
        p.r = 1.1 + Math.random() * 1.4;
      }
    };

    const rock = (power: number) => {
      if (ice[0] < 0) return;
      for (let k = 1; k <= 3; k++) {
        kick(ice[0] - k, power / k);
        kick(ice[1] + k, power / k);
      }
    };

    // Курсор у воды: провёл рядом — рябь, пересёк гладь — сильнее, вниз —
    // вдавил, вверх — потянул за собой. Палец не в счёт: им листают.
    let last: { x: number; y: number; t: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || n < 2) return;
      const rect = host.getBoundingClientRect();
      const surface = rect.top + REST;
      const off = e.clientY - surface;
      const prev = last;
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      if (!prev || Math.abs(off) > 36 || e.clientX < rect.left || e.clientX > rect.right) return;
      const speed = Math.hypot(e.clientX - prev.x, e.clientY - prev.y) / Math.max(8, e.timeStamp - prev.t);
      const crossed = (prev.y - surface) * off < 0;
      const power = Math.min(1.8, speed * 1.1) * (1 - Math.abs(off) / 36) * (crossed ? 1.8 : 1);
      const sign = crossed && e.clientY < prev.y ? -1 : 1;
      const i = Math.round((e.clientX - rect.left) / step());
      kick(i, power * sign);
      kick(i - 1, (power * sign) / 2);
      kick(i + 1, (power * sign) / 2);
    };
    // Нажатие у самой воды — всплеск. Кроме строки ввода, крестика и слоёв:
    // нажатие там значит другое.
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || n < 2) return;
      if ((e.target as Element | null)?.closest?.('input, button, a, [role="option"]')) return;
      const rect = host.getBoundingClientRect();
      if (Math.abs(e.clientY - (rect.top + REST)) > 26) return;
      splash(e.clientX);
    };

    let raf = 0;
    let then = 0;
    let spare = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Вкладка спала — не догонять: больше четырёх шагов за кадр не считаем.
      spare = Math.min(spare + (then ? now - then : 0), FRAME_MS * 4);
      then = now;
      while (spare >= FRAME_MS) {
        physics();
        clock += FRAME_MS;
        spare -= FRAME_MS;
      }
      draw();
    };

    const resize = new ResizeObserver(() => {
      measure();
      draw();
    });
    resize.observe(host);
    measure();
    draw();
    if (!still) {
      raf = requestAnimationFrame(frame);
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onDown, { passive: true });
      handle.current = { splash, rock };
    }
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      handle.current = null;
    };
  }, [still, handle]);

  const water = waterAt(0, dim, wine);
  const dark = dim > 0.3;
  const layer = 'absolute left-0 w-full overflow-visible';
  const frame = { top: -SPRAY, height: BAND + SPRAY };
  return (
    // Над гладью — небо у самой воды (`skyFloor`): прозрачный зазор показывал бы
    // лист под пультом, и ночью вдоль воды шла светлая полоса.
    <div ref={box} aria-hidden="true" className="pointer-events-none relative h-5 w-full" style={{ background: floor }}>
      <svg ref={under} className={layer} style={frame} preserveAspectRatio="none">
        <defs>
          {/* У самой глади вода чуть светлее: свет сверху отражается от поверхности. */}
          <linearGradient id={`${id}w`} gradientUnits="userSpaceOnUse" x1="0" y1={REST - 4} x2="0" y2={BAND}>
            <stop offset="0" stopColor={`color-mix(in oklab, rgb(var(--surface)) ${dark ? 6 : 18}%, ${water})`} />
            <stop offset="1" stopColor={water} />
          </linearGradient>
        </defs>
        <path ref={body} fill={`url(#${id}w)`} />
      </svg>
      {children}
      <svg ref={over} className={layer} style={frame} preserveAspectRatio="none">
        {/* Блик под линией: та же гладь, на полтора пикселя ниже и светлым. */}
        <path
          ref={shine}
          transform="translate(0 1.75)"
          fill="none"
          stroke={dark ? 'rgb(var(--surface) / 0.1)' : 'rgb(var(--surface) / 0.85)'}
          strokeWidth="1.5"
        />
        <path ref={line} fill="none" stroke={dark ? 'rgb(var(--surface) / 0.45)' : 'rgb(var(--ink) / 0.55)'} strokeWidth="1.25" />
        <g ref={spray} fill={dark ? 'rgb(var(--surface) / 0.6)' : waterAt(0.35, dim)}>
          {Array.from({ length: SPRAY_DROPS }, (_, i) => (
            <circle key={i} r="0" />
          ))}
        </g>
      </svg>
      {fog ? <span className="absolute inset-0 animate-[weather-in_1.2s_ease-out_both]" style={{ background: fog }} /> : null}
    </div>
  );
}

// ─── Небо и вершина ──────────────────────────────────────────────────────────

/**
 * Пелена облаков: днём небо сереет к воде, ночью светлеет — тучи над городом
 * подсвечены снизу.
 */
const cloud = (mood: Mood) => (mood === 'day' ? 'rgb(var(--water))' : waterAt(0.3, 0.3));

/** Цвет неба у самой воды: им же залит зазор над гладью (`Waterline`). */
export const skyFloor = (mood: Mood, overcast = 0) => {
  const base =
    mood === 'night'
      ? waterAt(0.1, DIM.night)
      : mood === 'blood'
        ? `color-mix(in oklab, rgb(var(--blood)) 30%, ${waterAt(0.1, DIM.blood)})`
        : mood === 'dusk'
          ? `color-mix(in oklab, rgb(var(--halo)) 34%, ${waterAt(0.15, DIM.night)})`
          : 'rgb(var(--canvas))';
  return overcast > 0 ? `color-mix(in oklab, ${cloud(mood)} ${Math.round(overcast * 28)}%, ${base})` : base;
};

const skyTop = (mood: Mood, look: Look) => {
  const base =
    mood === 'night'
      ? 'rgb(var(--deep))'
      : mood === 'blood'
        ? 'color-mix(in oklab, rgb(var(--blood)) 22%, rgb(var(--deep)))'
        : mood === 'dusk'
          ? 'color-mix(in oklab, rgb(var(--deep)) 82%, rgb(var(--water)))'
          : 'rgb(var(--surface))';
  if (!look.overcast) return base;
  // В грозу днём небо тяжелее: белая молния на почти белом не видна.
  const veil = look.storm && mood === 'day' ? waterAt(0.4) : cloud(mood);
  return `color-mix(in oklab, ${veil} ${Math.round(look.overcast * (mood === 'day' ? 62 : 24))}%, ${base})`;
};

/**
 * Небо над айсбергом. Днём — почти белое, светлеющее кверху: величие здесь не в
 * облаках, а в вершине (`Summit`), и пустота вокруг неё работает на неё. В
 * сумерках — тёплая полоса у горизонта под темнеющим верхом, ночью — тёмное, со
 * звёздами. Пасмурно — сереет, и звёзд не видно; идёт дождь или снег — идёт и
 * здесь.
 *
 * Звёзды — точки одного цвета, по зерну дня: у троих одно небо, как и айсберг.
 * Мерцает каждая пятая, и медленно: небо, которое всё время шевелится, — это
 * заставка, а не ночь.
 */
export function Sky({ mood, seed, still, look }: { mood: Mood; seed: number; still: boolean; look: Look }) {
  const stars = useMemo(() => {
    const rand = seeded(seed + 101);
    return Array.from({ length: 36 }, (_, i) => ({
      x: rand() * 100,
      y: rand() * 86,
      big: rand() < 0.14,
      o: 0.3 + rand() * 0.55,
      delay: rand() * 7,
      twinkle: i % 5 === 0
    }));
  }, [seed]);
  const ground = `linear-gradient(to bottom, ${skyTop(mood, look)}, ${skyFloor(mood, look.overcast)})`;
  const clear = 1 - look.overcast;
  const dark = mood !== 'day';
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ background: ground }}>
      {/* Кровавая луна, с двух до четырёх: круг с тёмным краем и тусклое
          зарево вокруг — заливками, не тенью. За облаками тусклее. */}
      {mood === 'blood' ? (
        <span className="absolute right-[12%] top-[16%] h-20 w-20 sm:h-28 sm:w-28" style={{ opacity: 0.5 + 0.5 * clear }}>
          <span
            className="absolute -inset-[120%] rounded-full"
            style={{ background: 'radial-gradient(circle, rgb(var(--blood) / 0.45), rgb(var(--blood) / 0) 60%)' }}
          />
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 38% 34%, color-mix(in oklab, rgb(var(--blood)) 70%, rgb(var(--halo))), rgb(var(--blood)) 55%, color-mix(in oklab, rgb(var(--blood)) 55%, rgb(var(--deep))))'
            }}
          />
        </span>
      ) : null}
      {!dark || look.overcast >= 0.7
        ? null
        : stars
            .filter((_, i) => mood === 'night' || i % 3 === 0)
            .map((s, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-surface"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: s.big ? 2.5 : 1.5,
                  height: s.big ? 2.5 : 1.5,
                  opacity: (mood === 'night' ? s.o : s.o * 0.5) * clear,
                  animation: s.twinkle && !still ? `star 6s ease-in-out ${s.delay}s infinite` : undefined
                }}
              />
            ))}
      {look.fall !== 'none' && !still ? <Precipitation fall={look.fall} wind={look.wind} dark={dark} seed={seed} /> : null}
      {look.storm && !still ? <Lightning seed={seed} dark={dark} /> : null}
    </div>
  );
}

/**
 * Вершина: свет сверху и кольца от ядра — за льдом, а само ядро — `SummitCore`,
 * перед ним. Ставится в точку пика: `x` — его доля ширины, верх коробки — макушка.
 *
 * Кольца — по одному в две секунды, каждое живёт шесть: одновременно видно
 * три, и ритм не сбивается в пульсацию. Без движения два кольца стоят на месте
 * отметкой, а не анимацией. За облаками и свет, и кольца вполовину тусклее.
 */
export function Summit({ x, mood, still, haze = 0 }: { x: number; mood: Mood; still: boolean; haze?: number }) {
  const dark = mood !== 'day';
  const k = 1 - 0.5 * haze;
  const ring = dark ? `rgb(var(--surface) / ${(0.3 * k).toFixed(3)})` : `rgb(var(--ink) / ${(0.2 * k).toFixed(3)})`;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute top-0 h-0 w-0" style={{ left: `${x}%` }}>
      {/* Свет вокруг макушки, вытянутый столбом вверх. Центр — в самой
          макушке, а не край: свет, обрезанный по её высоте, читался плашкой с
          ровным нижним краем. Нижнюю половину и так закрывает лёд. Заливка, а
          не тень. */}
      <span
        className="absolute left-0 top-0 h-[40rem] w-[22rem] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            mood === 'blood'
              ? `radial-gradient(ellipse 50% 50% at 50% 50%, rgb(var(--blood) / ${(0.4 * k).toFixed(3)}), rgb(var(--blood) / 0) 72%)`
              : `radial-gradient(ellipse 50% 50% at 50% 50%, rgb(var(--halo) / ${((dark ? 0.24 : 0.65) * k).toFixed(3)}), rgb(var(--halo) / 0) 72%)`
        }}
      />
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute left-0 top-0 h-56 w-56 rounded-full border"
          style={
            still
              ? { borderColor: ring, transform: `translate(-50%, -50%) scale(${0.35 + i * 0.3})`, opacity: 0.6 - i * 0.25 }
              : {
                  borderColor: ring,
                  opacity: 0,
                  animation: `aura-ring 6s cubic-bezier(0.25, 0.6, 0.35, 1) ${i * 2}s infinite`
                }
          }
        />
      ))}
    </span>
  );
}

/**
 * Кольцо от ядра на каждую набранную букву: `n` растёт с каждым нажатием, и
 * новый ключ запускает кольцо заново. Одно и короткое — отклик, а не салют.
 */
export function SummitPulse({ x, n, mood }: { x: number; n: number; mood: Mood }) {
  if (n === 0) return null;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute top-0 h-0 w-0" style={{ left: `${x}%` }}>
      <span
        key={n}
        className="absolute left-0 top-0 h-40 w-40 rounded-full border"
        style={{
          borderColor: mood === 'day' ? 'rgb(var(--reactor) / 0.45)' : 'rgb(var(--reactor) / 0.6)',
          opacity: 0,
          animation: 'aura-ping 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) both'
        }}
      />
    </span>
  );
}

/** Ядро на макушке — та же красная кнопка ПХ, только теперь она венчает айсберг. */
export function SummitCore({ x }: { x: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute top-0 h-0 w-0" style={{ left: `${x}%` }}>
      <span className="absolute left-0 top-0 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-reactor/20" />
      <span className="absolute left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-reactor" />
    </span>
  );
}

// ─── Рутина на глубине ───────────────────────────────────────────────────────

export type Drift = { word: string; side: 'left' | 'right'; inset: number; seconds: number; delay: number };

/**
 * Какие слова рутины тонут у каких слоёв: «понедельник», «дедлайн», «ещё пять
 * минут». То, что тянет вниз, пока наверху величие, — не текст для чтения, а
 * фактура воды: в полях по краям, почти прозрачные, и только начиная с трети
 * глубины.
 *
 * По зерну дня, у троих одинаково. Слова не повторяются, сторона и темп у
 * каждого свои: строем они читались бы бегущей строкой.
 */
export function undertowFor(n: number, words: string[], seed: number): (Drift | null)[] {
  const rand = seeded(seed + 313);
  const pool = [...words];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Array.from({ length: n }, (_, i) => {
    const t = i / Math.max(1, n - 1);
    if (t < 0.3 || !pool.length || rand() < 0.3) return null;
    return {
      word: pool.pop() as string,
      side: rand() < 0.5 ? 'left' : 'right',
      inset: 3 + rand() * 9,
      seconds: 9 + rand() * 7,
      delay: -rand() * 9
    };
  });
}
