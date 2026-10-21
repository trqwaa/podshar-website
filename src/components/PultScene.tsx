'use client';

import { useId, useMemo } from 'react';

import type { Mood } from '@/lib/sun';

/**
 * Айсберг пульта: геометрия, небо над ним и трещина.
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
 * Числа здесь не на глаз, и у каждого есть причина — она записана рядом.
 */

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
export const DIM: Record<Mood, number> = { day: 0, dusk: 0.4, night: 0.62 };

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
 */
export const waterAt = (t: number, dim = 0) =>
  `color-mix(in oklab, rgb(var(--deep)) ${Math.round(deepShare(t, dim) * 100)}%, rgb(var(--water)))`;

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
const LIGHTNESS = { ice: 0.98, water: 0.9, deep: 0.21 };

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
  /** Верхушка над водой: левый и правый край основания, пик (x, высота 0–1). */
  tip: { left: number; right: number; peak: number; shoulder: number };
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
      left: base.l + 4,
      right: base.r - 6,
      peak: base.l + (base.r - base.l) * (0.55 + rand() * 0.18),
      shoulder: 0.5 + rand() * 0.2
    }
  };
}

// ─── Трещина ─────────────────────────────────────────────────────────────────

/**
 * Трещина поперёк слоя — смещением середины (midpoint displacement).
 *
 * Тот же приём, которым рисуют береговые линии и горные хребты: отрезок делят
 * пополам и середину сдвигают на случайную величину, потом каждую половину, и
 * так пять раз; размах на каждом шаге умножается на 0.55. Отсюда неровность
 * одинаковая на любом увеличении — фрактал, как настоящий скол во льду.
 */
export function crackThrough(layer: IceLayer, rand: () => number): [number, number][] {
  // По диагонали, от одного края к другому на разной высоте: ровно
  // горизонтальная трещина посередине слоя ложилась на название и читалась
  // зачёркиванием, а не сколом. С какого края она пойдёт — тоже случай: всегда
  // слева она через неделю читалась бы заставкой.
  const down = rand() < 0.5;
  const fromLeft = rand() < 0.5;
  const high = 14 + rand() * 18;
  const low = 68 + rand() * 18;
  let points: [number, number][] = [
    [layer.left[1] + 1, down ? high : low],
    [layer.right[1] - 1, down ? low : high]
  ];
  if (!fromLeft) points.reverse();
  let amplitude = 44;
  for (let round = 0; round < 5; round++) {
    const next: [number, number][] = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      const mx = (ax + bx) / 2 + (rand() - 0.5) * amplitude * 0.18;
      const my = Math.min(92, Math.max(8, (ay + by) / 2 + (rand() - 0.5) * amplitude));
      next.push([mx, my], points[i + 1]);
    }
    points = next;
    amplitude *= 0.55;
  }
  return points;
}

/** Сколько трещины проступает при наведении: треть — видно, что пошло, и ещё держится. */
export const TEASE = 0.34;

const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

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
 * При трещине слой рисуется дважды, по обе стороны скола, и нижняя часть
 * откалывается вниз.
 */
export function IceSlice({
  layer,
  t,
  dim,
  lit,
  crack
}: {
  layer: IceLayer;
  t: number;
  dim: number;
  lit: boolean;
  crack: [number, number][] | null;
}) {
  // Без двоеточий: `useId` отдаёт «:r1:», а внутри `url(#…)` двоеточие
  // понимают не все движки.
  const id = useId().replace(/:/g, '');
  const [lt, lmid, lb] = layer.left;
  const [rt, rmid, rb] = layer.right;
  const [kt, kb] = layer.ridge;
  const lift = lit ? 12 : 0;
  const light = iceAt(t, lift + 6, dim);
  const shade = iceAt(t, lift - 7, dim);
  const edge = lightOnIce(t, dim)
    ? `rgb(var(--surface) / ${lit ? 0.55 : 0.14})`
    : `rgb(var(--ink) / ${lit ? 0.5 : 0.16})`;

  const faces = (
    <>
      <polygon points={pts([[lt, 0], [kt, 0], [kb, 100], [lb, 100], [lmid, 50]])} fill={light} />
      <polygon points={pts([[kt, 0], [rt, 0], [rmid, 50], [rb, 100], [kb, 100]])} fill={shade} />
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

/**
 * Сама линия скола — поверх надписей слоя, а не под ними: трещина идёт по
 * льду, а надпись — на льду. Две линии: широкая светлая кромка и тонкая тёмная
 * сердцевина, — так скол во льду и выглядит. Плюс одно ответвление от середины:
 * лёд редко ломается одной чертой.
 *
 * `to` меньше единицы — трещина только пошла: так слой отвечает на наведение
 * (`TEASE`). Нажатие продолжает её с того же места (`from`), а не рисует новую:
 * лёд, который начал трескаться, доламывается, а не трескается заново.
 */
export function CrackLine({
  crack,
  seed,
  from = 0,
  to = 1
}: {
  crack: [number, number][];
  seed: number;
  from?: number;
  to?: number;
}) {
  const id = useId().replace(/:/g, '');
  const whole = to >= 1;
  const branch = useMemo(() => {
    const rand = seeded(seed + 7);
    const at = crack[Math.floor(crack.length * (0.35 + rand() * 0.3))];
    const out: [number, number][] = [at];
    let [x, y] = at;
    const dir = rand() < 0.5 ? -1 : 1;
    const step = crack[0][0] <= crack[crack.length - 1][0] ? 1 : -1;
    for (let i = 0; i < 4; i++) {
      x += step * (1.5 + rand() * 3);
      y = Math.min(96, Math.max(4, y + dir * (6 + rand() * 10)));
      out.push([x, y]);
    }
    return out;
  }, [crack, seed]);
  // Наведение тянет трещину медленнее, чем удар: она «пошла», а не «треснула».
  const seconds = `${whole ? 0.26 : 0.55}s`;
  // Прорисовка — растущей шторкой в координатах слоя, а не пунктиром. У
  // растянутого SVG с `non-scaling-stroke` пунктир считается в пикселях экрана,
  // а `pathLength` — в координатах слоя, и трещина шла кусками. Шторка растёт
  // от того края, с которого трещина пошла.
  const xs = crack.map(([x]) => x);
  const lo = Math.min(...xs) - 1;
  const hi = Math.max(...xs) + 1;
  const forward = crack[0][0] <= crack[crack.length - 1][0];
  const w0 = (hi - lo) * from;
  const w1 = (hi - lo) * to;
  const ease = { calcMode: 'spline', keyTimes: '0;1', keySplines: '0.2 0.8 0.2 1', fill: 'freeze' } as const;
  const line = (points: [number, number][], width: number, colour: string) => (
    <polyline
      points={pts(points)}
      fill="none"
      stroke={colour}
      strokeWidth={width}
      strokeLinejoin="bevel"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  );
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <defs>
        <clipPath id={`${id}c`}>
          <rect x={forward ? lo : hi - w1} y={-20} width={w1} height={140}>
            <animate attributeName="width" from={w0} to={w1} dur={seconds} {...ease} />
            {forward ? null : <animate attributeName="x" from={hi - w0} to={hi - w1} dur={seconds} {...ease} />}
          </rect>
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        {line(crack, 5, 'rgb(var(--surface) / 0.9)')}
        {line(crack, 1.75, 'rgb(var(--deep) / 0.85)')}
        {whole ? line(branch, 3.5, 'rgb(var(--surface) / 0.85)') : null}
        {whole ? line(branch, 1.25, 'rgb(var(--deep) / 0.75)') : null}
      </g>
    </svg>
  );
}

/**
 * Осколки из трещины: тонут, а не падают.
 *
 * В воде сопротивление съедает горизонтальную скорость быстро, а тяга вниз
 * остаётся, поэтому кривая — ease-in по вертикали и короткий снос вбок.
 * Осколок — HTML, а не часть растянутого SVG: в растянутом треугольник стал
 * бы щепкой.
 */
export function Shards({ crack, t, dim, seed }: { crack: [number, number][]; t: number; dim: number; seed: number }) {
  // Один раз на трещину: пересчёт на каждой перерисовке (наведение мыши,
  // приход ответов) двигал бы осколки посреди полёта.
  const shards = useMemo(() => {
    const rand = seeded(seed);
    const step = Math.max(1, Math.floor(crack.length / 8));
    // Сколько осколков — тоже случай, от пяти до девяти: одинаковая горсть на
    // каждом нажатии выдаёт, что это одна и та же анимация.
    const count = 5 + Math.floor(rand() * 5);
    return crack
      .filter((_, i) => i % step === 0)
      .slice(1, 1 + count)
      .map(([x, y]) => ({
        x,
        y,
        size: 5 + rand() * 7,
        a: rand() * 40,
        b: 60 + rand() * 40,
        dx: (rand() - 0.5) * 50,
        dy: 36 + rand() * 70,
        rot: (rand() - 0.5) * 380
      }));
  }, [crack, seed]);
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

// ─── Верхушка и вода ─────────────────────────────────────────────────────────

/**
 * Верхушка над водой. Маленькая, как у настоящего айсберга: девять десятых
 * льда под водой, потому что лёд легче морской воды ровно настолько
 * (917 против 1025 кг/м³). Видно поле и кончик — остальное надо листать.
 */
export function IceTip({ tip, dim }: { tip: Iceberg['tip']; dim: number }) {
  const { left, right, peak, shoulder } = tip;
  const ridgeX = left + (peak - left) * 0.62;
  const edge = dim > 0.3 ? 'rgb(var(--surface) / 0.22)' : 'rgb(var(--ink) / 0.16)';
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <polygon
        points={pts([[left, 100], [left + (peak - left) * 0.4, 100 - 46 * shoulder], [peak, 0], [ridgeX, 100]])}
        fill={iceAt(0, 4, dim)}
      />
      <polygon
        points={pts([[ridgeX, 100], [peak, 0], [peak + (right - peak) * 0.45, 38], [right, 100]])}
        fill={iceAt(0.06, -4, dim)}
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
 * Линия воды: две синусоиды, основная и вдвое чаще в треть высоты.
 *
 * Вторая гармоника ломает идеальную синусоиду так, что волна выглядит водой,
 * а не школьным графиком. Период 120 px, и вся полоса сдвигается ровно на
 * период по кругу — поэтому шов не виден никогда.
 */
export function Waterline({ still, dim, floor }: { still: boolean; dim: number; floor: string }) {
  const period = 120;
  const width = 2400 + period;
  const d: string[] = [];
  for (let x = 0; x <= width; x += 4) {
    const k = (x / period) * Math.PI * 2;
    const y = 7 + 2.6 * Math.sin(k) + 0.9 * Math.sin(2 * k + 1);
    d.push(`${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(2)}`);
  }
  const line = d.join(' ');
  return (
    // Над волной — небо у самой воды (`skyFloor`): прозрачный зазор показывал бы
    // лист под пультом, и ночью вдоль воды шла светлая полоса.
    <div aria-hidden="true" className="pointer-events-none relative h-3.5 w-full overflow-hidden" style={{ background: floor }}>
      <svg
        width={width}
        height="14"
        viewBox={`0 0 ${width} 14`}
        className={`absolute left-0 top-0 ${still ? '' : 'animate-[swell_7s_linear_infinite]'}`}
      >
        <path d={`${line} L${width} 14 L0 14 Z`} fill={waterAt(0, dim)} />
        <path d={line} fill="none" stroke={dim > 0.3 ? 'rgb(var(--surface) / 0.5)' : 'rgb(var(--ink))'} strokeWidth="2" />
      </svg>
    </div>
  );
}

// ─── Небо и вершина ──────────────────────────────────────────────────────────

/** Цвет неба у самой воды: им же залит зазор над волной (`Waterline`). */
export const skyFloor = (mood: Mood) =>
  mood === 'night'
    ? waterAt(0.1, DIM.night)
    : mood === 'dusk'
      ? `color-mix(in oklab, rgb(var(--halo)) 34%, ${waterAt(0.15, DIM.night)})`
      : 'rgb(var(--canvas))';

/**
 * Небо над айсбергом. Днём — почти белое, светлеющее кверху: величие здесь не в
 * облаках, а в вершине (`Summit`), и пустота вокруг неё работает на неё. В
 * сумерках — тёплая полоса у горизонта под темнеющим верхом, ночью — тёмное, со
 * звёздами.
 *
 * Звёзды — точки одного цвета, по зерну дня: у троих одно небо, как и айсберг.
 * Мерцает каждая пятая, и медленно: небо, которое всё время шевелится, — это
 * заставка, а не ночь.
 */
export function Sky({ mood, seed, still }: { mood: Mood; seed: number; still: boolean }) {
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
  const top =
    mood === 'night'
      ? 'rgb(var(--deep))'
      : mood === 'dusk'
        ? 'color-mix(in oklab, rgb(var(--deep)) 82%, rgb(var(--water)))'
        : 'rgb(var(--surface))';
  const ground = `linear-gradient(to bottom, ${top}, ${skyFloor(mood)})`;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ background: ground }}>
      {mood === 'day'
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
                  opacity: mood === 'night' ? s.o : s.o * 0.5,
                  animation: s.twinkle && !still ? `star 6s ease-in-out ${s.delay}s infinite` : undefined
                }}
              />
            ))}
    </div>
  );
}

/**
 * Вершина: свет сверху и кольца от ядра — за льдом, а само ядро — `SummitCore`,
 * перед ним. Ставится в точку пика: `x` — его доля ширины, верх коробки — макушка.
 *
 * Кольца — по одному в две секунды, каждое живёт шесть: одновременно видно
 * три, и ритм не сбивается в пульсацию. Без движения два кольца стоят на месте
 * отметкой, а не анимацией.
 */
export function Summit({ x, mood, still }: { x: number; mood: Mood; still: boolean }) {
  const dark = mood !== 'day';
  const ring = dark ? 'rgb(var(--surface) / 0.3)' : 'rgb(var(--ink) / 0.2)';
  return (
    <span aria-hidden="true" className="pointer-events-none absolute top-0 h-0 w-0" style={{ left: `${x}%` }}>
      {/* Свет вокруг макушки, вытянутый столбом вверх. Центр — в самой
          макушке, а не край: свет, обрезанный по её высоте, читался плашкой с
          ровным нижним краем. Нижнюю половину и так закрывает лёд. Заливка, а
          не тень. */}
      <span
        className="absolute left-0 top-0 h-[40rem] w-[22rem] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgb(var(--halo) / ${dark ? 0.24 : 0.65}), rgb(var(--halo) / 0) 72%)`
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
