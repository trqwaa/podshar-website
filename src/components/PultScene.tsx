'use client';

import { useId, useMemo } from 'react';

/**
 * Айсберг пульта: геометрия, небо над ним и трещина.
 *
 * Пульт — это айсберг. Строка ввода стоит на линии воды, над ней небо, под ней
 * разделы слоями льда: чем глубже, тем нишевее. Здесь всё, что рисуется, а не
 * нажимается; списком и клавишами занимается `Pult`.
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

/**
 * Цвет воды на глубине `t` ∈ [0, 1] — смесь двух токенов в OKLab.
 *
 * Два цвета вместо палитры на каждый слой: поверхность и дно, а между ними
 * сколько угодно ступеней. OKLab, а не sRGB: в нём смесь темнеет равномерно для
 * глаза, а в sRGB середина выходит грязно-серой. Ступени, а не плавный
 * градиент, — как пояса глубин на морской карте.
 */
export const waterAt = (t: number) =>
  `color-mix(in oklab, rgb(var(--deep)) ${Math.round(t * 100)}%, rgb(var(--water)))`;

/** Лёд на глубине: светлее воды вокруг, но тоже уходит в синеву. */
export const iceAt = (t: number, lift = 0) =>
  `color-mix(in oklab, rgb(var(--ice)) ${Math.max(0, Math.min(100, Math.round(100 - 58 * t + lift)))}%, ${waterAt(t)})`;

/**
 * С какой глубины текст становится светлым.
 *
 * Половина пути до дна — там, где смешанная вода переходит за середину по
 * светлоте. Все живые разделы выше этой черты, и тёмный текст на них держит
 * контраст больше 5:1; светлый достаётся только «скоро», а их не нажимают.
 */
export const DARK_FROM = 0.5;

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
  // зачёркиванием, а не сколом.
  const down = rand() < 0.5;
  const high = 14 + rand() * 18;
  const low = 68 + rand() * 18;
  let points: [number, number][] = [
    [layer.left[1] + 1, down ? high : low],
    [layer.right[1] - 1, down ? low : high]
  ];
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
 * При трещине слой рисуется дважды, по обе стороны скола, и нижняя часть
 * откалывается вниз.
 */
export function IceSlice({
  layer,
  t,
  lit,
  crack
}: {
  layer: IceLayer;
  t: number;
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
  const light = iceAt(t, lift + 6);
  const shade = iceAt(t, lift - 7);
  const edge = t < DARK_FROM ? 'rgb(var(--ink) / 0.16)' : 'rgb(var(--surface) / 0.14)';

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

  const upper = pts([[0, 0], [100, 0], [100, crack[crack.length - 1][1]], ...[...crack].reverse(), [0, crack[0][1]]]);
  const lower = pts([[0, crack[0][1]], ...crack, [100, crack[crack.length - 1][1]], [100, 100], [0, 100]]);

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
 */
export function CrackLine({ crack, seed }: { crack: [number, number][]; seed: number }) {
  const branch = useMemo(() => {
    const rand = seeded(seed + 7);
    const at = crack[Math.floor(crack.length * (0.35 + rand() * 0.3))];
    const out: [number, number][] = [at];
    let [x, y] = at;
    const dir = rand() < 0.5 ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      x += 1.5 + rand() * 3;
      y = Math.min(96, Math.max(4, y + dir * (6 + rand() * 10)));
      out.push([x, y]);
    }
    return out;
  }, [crack, seed]);
  const line = (points: [number, number][], width: number, colour: string, delay: string) => (
    <polyline
      points={pts(points)}
      fill="none"
      stroke={colour}
      strokeWidth={width}
      strokeLinejoin="bevel"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      pathLength={1}
      strokeDasharray="1"
      style={{ animation: `crack-draw 0.26s cubic-bezier(0.2,0.8,0.2,1) ${delay} both` }}
    />
  );
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      {line(crack, 5, 'rgb(var(--surface) / 0.9)', '0s')}
      {line(crack, 1.75, 'rgb(var(--deep) / 0.85)', '0s')}
      {line(branch, 3.5, 'rgb(var(--surface) / 0.85)', '0.12s')}
      {line(branch, 1.25, 'rgb(var(--deep) / 0.75)', '0.12s')}
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
export function Shards({ crack, t, seed }: { crack: [number, number][]; t: number; seed: number }) {
  // Один раз на трещину: пересчёт на каждой перерисовке (наведение мыши,
  // приход ответов) двигал бы осколки посреди полёта.
  const shards = useMemo(() => {
    const rand = seeded(seed);
    const step = Math.max(1, Math.floor(crack.length / 8));
    return crack
      .filter((_, i) => i % step === 0)
      .slice(1, 8)
      .map(([x, y]) => ({
        x,
        y,
        size: 5 + rand() * 6,
        a: rand() * 40,
        b: 60 + rand() * 40,
        dx: (rand() - 0.5) * 44,
        dy: 36 + rand() * 60,
        rot: (rand() - 0.5) * 360
      }));
  }, [crack, seed]);
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {shards.map(({ x, y, size, a, b, dx, dy, rot }, i) => {
          return (
            <span
              key={i}
              className="absolute animate-[shard-sink_0.8s_cubic-bezier(0.4,0,0.9,0.5)_0.12s_both]"
              style={
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size,
                  background: iceAt(t, 14),
                  clipPath: `polygon(${a}% 0, 100% ${b}%, 0 100%)`,
                  '--dx': `${dx}px`,
                  '--dy': `${dy}px`,
                  '--rot': `${rot}deg`
                } as React.CSSProperties
              }
            />
          );
        })}
    </span>
  );
}

// ─── Верхушка и вода ─────────────────────────────────────────────────────────

/**
 * Верхушка над водой. Маленькая, как у настоящего айсберга: девять десятых
 * льда под водой, потому что лёд легче морской воды ровно настолько
 * (917 против 1025 кг/м³). Видно поле и кончик — остальное надо листать.
 */
export function IceTip({ tip }: { tip: Iceberg['tip'] }) {
  const { left, right, peak, shoulder } = tip;
  const ridgeX = left + (peak - left) * 0.62;
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <polygon
        points={pts([[left, 100], [left + (peak - left) * 0.4, 100 - 46 * shoulder], [peak, 0], [ridgeX, 100]])}
        fill="rgb(var(--ice))"
      />
      <polygon
        points={pts([[ridgeX, 100], [peak, 0], [peak + (right - peak) * 0.45, 38], [right, 100]])}
        fill={iceAt(0.06, -4)}
      />
      <polyline
        points={pts([[left, 100], [left + (peak - left) * 0.4, 100 - 46 * shoulder], [peak, 0], [peak + (right - peak) * 0.45, 38], [right, 100]])}
        fill="none"
        stroke="rgb(var(--ink) / 0.16)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <line x1={peak} y1={0} x2={ridgeX} y2={100} stroke="rgb(var(--ink) / 0.12)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
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
export function Waterline({ still }: { still: boolean }) {
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
    <div aria-hidden="true" className="pointer-events-none relative h-3.5 w-full overflow-hidden">
      <svg
        width={width}
        height="14"
        viewBox={`0 0 ${width} 14`}
        className={`absolute left-0 top-0 ${still ? '' : 'animate-[swell_7s_linear_infinite]'}`}
      >
        <path d={`${line} L${width} 14 L0 14 Z`} fill={waterAt(0)} />
        <path d={line} fill="none" stroke="rgb(var(--ink))" strokeWidth="2" />
      </svg>
    </div>
  );
}

// ─── Небо ────────────────────────────────────────────────────────────────────

/**
 * Облако из кругов одного цвета: где круги перекрываются, шва нет, и силуэт
 * собирается сам. Плоское дно — прямоугольником, как у кучевых облаков.
 */
function Cloud({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 48" className={className} style={style}>
      <g fill="rgb(var(--surface))">
        <circle cx="24" cy="32" r="13" />
        <circle cx="44" cy="23" r="19" />
        <circle cx="68" cy="20" r="17" />
        <circle cx="88" cy="29" r="13" />
        <circle cx="104" cy="35" r="9" />
        <rect x="11" y="32" width="102" height="12" rx="6" />
      </g>
    </svg>
  );
}

/**
 * Ангел: нимб, голова, балахон и два крыла, которые машут.
 *
 * Линией и плоской заливкой, как значки сайта, — не картинка из интернета.
 * Крыло машет по вертикали вокруг плеча (`transform-box: fill-box`), и у каждого
 * ангела свой темп: в ногу махали бы, как на параде.
 */
function Angel({ flap }: { flap: string }) {
  const wing = 'rgb(var(--ink) / 0.45)';
  return (
    <svg aria-hidden="true" viewBox="0 0 40 32" className="h-full w-full overflow-visible">
      <ellipse cx="20" cy="4.5" rx="6" ry="1.8" fill="none" stroke="rgb(var(--halo))" strokeWidth="1.6" />
      <g
        style={{ transformBox: 'fill-box', transformOrigin: '100% 30%', animation: `wing-flap ${flap} ease-in-out infinite` }}
      >
        <path d="M17.5 16 C 10 8.5, 3 10.5, 0.5 16.5 C 6 15.5, 10 17.5, 17 20 Z" fill="rgb(var(--surface))" stroke={wing} strokeWidth="1.1" />
      </g>
      <g
        style={{ transformBox: 'fill-box', transformOrigin: '0% 30%', animation: `wing-flap ${flap} ease-in-out infinite` }}
      >
        <path d="M22.5 16 C 30 8.5, 37 10.5, 39.5 16.5 C 34 15.5, 30 17.5, 23 20 Z" fill="rgb(var(--surface))" stroke={wing} strokeWidth="1.1" />
      </g>
      <path d="M20 14 L14.5 29 Q20 31.2 25.5 29 Z" fill="rgb(var(--surface))" stroke="rgb(var(--ink) / 0.55)" strokeWidth="1.1" />
      <circle cx="20" cy="10.5" r="3.1" fill="rgb(var(--ink) / 0.72)" />
    </svg>
  );
}

/** Четырёхлучевая искра: ромб с вогнутыми сторонами. */
function Sparkle() {
  return (
    <svg aria-hidden="true" viewBox="0 0 10 10" className="h-full w-full">
      <path d="M5 0 Q5.6 4.4 10 5 Q5.6 5.6 5 10 Q4.4 5.6 0 5 Q4.4 4.4 5 0 Z" fill="rgb(var(--halo))" />
    </svg>
  );
}

/**
 * Небо над айсбергом: рай, как его просили, — свет из-за облаков, облака, над
 * ними ангелы, в воздухе искры.
 *
 * Всё движется только `transform` и `opacity` и стоит на месте при
 * `prefers-reduced-motion`. Облака и ангелы вылетают из-за левого края и
 * уходят за правый, а отрицательные задержки рассыпают их по небу к моменту
 * открытия, иначе все стартовали бы из одной точки. Без движения они стоят в
 * заранее разложенных местах, а не за краем.
 */
export function Sky({ still }: { still: boolean }) {
  const drift = (seconds: number, delay: number, distance = '150vw'): React.CSSProperties =>
    still
      ? {}
      : ({
          animation: `cloud-drift ${seconds}s linear ${delay}s infinite`,
          '--drift': distance
        } as React.CSSProperties);

  const clouds = [
    { top: '38%', left: still ? '6%' : '-22%', w: 'w-40 sm:w-56', s: 110, d: -38, o: 0.95 },
    { top: '58%', left: still ? '62%' : '-22%', w: 'w-32 sm:w-44', s: 80, d: -56, o: 0.85 },
    { top: '22%', left: still ? '38%' : '-22%', w: 'w-24 sm:w-32', s: 140, d: -20, o: 0.7 }
  ];
  const angels = [
    { top: '10%', left: still ? '18%' : '-10%', s: 46, d: -14, bob: '3.4s', flap: '0.9s', size: 'h-7 w-9 sm:h-11 sm:w-14' },
    { top: '26%', left: still ? '74%' : '-10%', s: 64, d: -40, bob: '4.1s', flap: '1.15s', size: 'h-5 w-7 sm:h-8 sm:w-10' },
    { top: '4%', left: still ? '52%' : '-10%', s: 82, d: -61, bob: '3.8s', flap: '1.3s', size: 'h-4 w-5 sm:h-6 sm:w-8' }
  ];
  const sparkles = [
    ['12%', '30%', '0s'],
    ['30%', '8%', '1.1s'],
    ['47%', '44%', '2.3s'],
    ['66%', '14%', '0.6s'],
    ['82%', '36%', '1.7s'],
    ['91%', '9%', '2.9s']
  ];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Сияние сверху: свет, который идёт из-за облаков. */}
      <div
        className="absolute inset-x-0 top-0 h-full"
        style={{ background: 'radial-gradient(ellipse 70% 90% at 50% -10%, rgb(var(--halo) / 0.26), rgb(var(--halo) / 0) 70%)' }}
      />

      {/* Лучи — семь клиньев из одной точки над экраном; качаются на два
          градуса в обе стороны, чтобы свет был живым, но не вертелся. */}
      <svg
        viewBox="0 0 1000 400"
        preserveAspectRatio="xMidYMin slice"
        className={`absolute inset-0 h-full w-full origin-top ${still ? '' : 'animate-[ray-sway_16s_ease-in-out_infinite]'}`}
      >
        <defs>
          <linearGradient id="pult-ray" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--halo))" stopOpacity="0.22" />
            <stop offset="1" stopColor="rgb(var(--halo))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[-54, -34, -16, 0, 15, 33, 52].map((deg, i) => {
          const spread = i % 2 ? 3.2 : 5.5;
          const a = ((deg - spread) * Math.PI) / 180;
          const b = ((deg + spread) * Math.PI) / 180;
          const reach = 520;
          return (
            <polygon
              key={deg}
              points={`500,-60 ${500 + Math.sin(a) * reach},${-60 + Math.cos(a) * reach} ${500 + Math.sin(b) * reach},${-60 + Math.cos(b) * reach}`}
              fill="url(#pult-ray)"
            />
          );
        })}
      </svg>

      {sparkles.map(([left, top, delay]) => (
        <span
          key={left}
          className={`absolute h-2.5 w-2.5 ${still ? 'opacity-60' : 'animate-[twinkle_3.6s_ease-in-out_infinite]'}`}
          style={{ left, top, animationDelay: delay }}
        >
          <Sparkle />
        </span>
      ))}

      {clouds.map((c) => (
        <Cloud key={c.top} className={`absolute ${c.w}`} style={{ top: c.top, left: c.left, opacity: c.o, ...drift(c.s, c.d) }} />
      ))}

      {/* Ангелы выше облаков, как просили: «над ним, над облаками». */}
      {angels.map((a) => (
        <span key={a.top} className="absolute" style={{ top: a.top, left: a.left, ...drift(a.s, a.d, '125vw') }}>
          <span
            className={`block ${a.size}`}
            style={still ? undefined : { animation: `angel-bob ${a.bob} ease-in-out infinite` }}
          >
            <Angel flap={a.flap} />
          </span>
        </span>
      ))}
    </div>
  );
}
