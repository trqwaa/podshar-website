'use client';

import { BODY, CHEST, GROUND, type Load, type P } from './pug-motions';
import { CX, capsule, circlePath, clamp, hull, lerp, n2, polygon, rotate, smoothPolygon, type Solved, type Widths } from './pug-geometry';
import { HeadFront, HoodStrings } from './PugHead';
import { C, LINE, Part, PartPath, type Frame } from './pug-parts';
import type { Live } from './pug-side';

/**
 * Мопс анфас — та же поза, что сбоку, только камера стоит перед ним.
 *
 * Высоты суставов берутся из решения сбоку, а ширины — из `pose.z`: хват,
 * постановка стоп, разведение локтей. Сбоку мировая ось x уходит в глубину.
 *
 * Корпус — не плоская картинка, а грудная клетка с толщиной: сечения от таза
 * до шеи (ширина, грудь вперёд, спина назад) проецируются на экран и
 * сливаются в силуэт. Поэтому лежащий на скамье мопс, если смотреть от ног,
 * — это купол груди, а стоящий — торс с широчайшими и трапециями.
 *
 * Кто кого закрывает, решается один раз на движение, а не каждый кадр
 * (`frontPlan`): голова лежащего — за грудью, бёдра сидящего и приседающего —
 * перед животом, штанга в приседе — за плечами и под кистями, в жиме — перед
 * грудью. Слой посреди повтора не меняется никогда: пересортировка на лету
 * давала скачки, когда глубины двух частей сравнивались.
 */

// Сечения корпуса от таза (0) до шеи (1): полуширина, грудь вперёд, спина назад.
const V = [-0.12, 0, 0.15, 0.3, 0.45, 0.6, 0.72, 0.84, 0.93, 1];
const W = [21, 23, 21, 19.5, 24, 31, 37, 38, 27, 14];
const F = [17, 20, 21, 22, 27, CHEST - 1, CHEST - 1, 30, 20, 11];
const B = [17, 20, 15, 13, 14, 16, 17, 17, 14, 10];

const interp = (table: number[], v: number) => {
  if (v <= V[0]) return table[0];
  for (let i = 1; i < V.length; i++) {
    if (v <= V[i]) return lerp(table[i - 1], table[i], (v - V[i - 1]) / (V[i] - V[i - 1]));
  }
  return table[table.length - 1];
};

type Ctx = {
  t: number;
  hipY: number;
  lean: number;
  twist: number;
};

const leanAt = (ctx: Ctx, v: number) => {
  const k = clamp(v / 0.35, 0, 1);
  return ctx.lean * k * k * (3 - 2 * k);
};

/** Точка на поверхности корпуса: сечение `v`, доля ширины `u` (−1…1), спереди (1) или сзади (−1). */
function surface(ctx: Ctx, v: number, u: number, side: 1 | -1): P {
  const w = interp(W, v) * (v > 0.4 ? Math.cos(ctx.twist * 0.8) : 1);
  const depth = side > 0 ? interp(F, v) : -interp(B, v);
  const y = ctx.hipY - Math.cos(ctx.t) * BODY.torso * v + Math.sin(ctx.t) * depth * Math.sqrt(Math.max(0, 1 - u * u));
  const x = CX + u * w + (v > 0.4 ? Math.sin(ctx.twist) * CHEST * 0.4 * (v - 0.4) : 0);
  return rotate([x, y], [CX, ctx.hipY], leanAt(ctx, v));
}

/** Сечение `v`, спроецированное на экран: эллипс с разной глубиной спереди и сзади. */
function section(ctx: Ctx, v: number, n = 14): P[] {
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const w = interp(W, v) * (v > 0.4 ? Math.cos(ctx.twist * 0.8) : 1);
    const depth = s >= 0 ? interp(F, v) * s : interp(B, v) * s;
    const y = ctx.hipY - Math.cos(ctx.t) * BODY.torso * v + Math.sin(ctx.t) * depth;
    const x = CX + c * w + (v > 0.4 ? Math.sin(ctx.twist) * CHEST * 0.4 * (v - 0.4) : 0);
    pts.push(rotate([x, y], [CX, ctx.hipY], leanAt(ctx, v)));
  }
  return pts;
}

/** Силуэт отрезка корпуса между сечениями — выпуклые оболочки соседних пар. */
function band(ctx: Ctx, from: number, to: number): string {
  const vs = V.filter((v) => v >= from - 1e-6 && v <= to + 1e-6);
  let d = '';
  for (let i = 0; i < vs.length - 1; i++) d += polygon(hull([...section(ctx, vs[i]), ...section(ctx, vs[i + 1])]));
  return d;
}

/** Кривая по поверхности корпуса через точки (u, v). */
const curve = (ctx: Ctx, pts: [number, number][], side: 1 | -1 = 1) => {
  const ps = pts.map(([u, v]) => surface(ctx, v, u, side));
  return `M${ps.map((p) => `${n2(p[0])} ${n2(p[1])}`).join('L')}`;
};
const mirror = (pts: [number, number][]) => pts.map(([u, v]) => [-u, v] as [number, number]);

/** Майка-борцовка в долях ширины и высоты корпуса: глубокие проймы, вырез, узкие лямки. */
const TANK_FRONT: [number, number][] = [
  [-1, 0.06], [-1, 0.46], [-0.93, 0.55], [-0.76, 0.63], [-0.64, 0.72], [-0.6, 0.84], [-0.56, 0.92], [-0.34, 0.93],
  [-0.3, 0.85], [-0.2, 0.77], [0, 0.73], [0.2, 0.77], [0.3, 0.85], [0.34, 0.93], [0.56, 0.92], [0.6, 0.84],
  [0.64, 0.72], [0.76, 0.63], [0.93, 0.55], [1, 0.46], [1, 0.06]
];
const TANK_BACK: [number, number][] = [
  [-1, 0.06], [-1, 0.4], [-0.84, 0.52], [-0.5, 0.62], [-0.26, 0.72], [-0.3, 0.84], [-0.46, 0.98], [-0.3, 0.99],
  [-0.12, 0.84], [0, 0.78], [0.12, 0.84], [0.3, 0.99], [0.46, 0.98], [0.3, 0.84], [0.26, 0.72], [0.5, 0.62],
  [0.84, 0.52], [1, 0.4], [1, 0.06]
];
const HOODIE_FRONT: [number, number][] = [
  [-1, -0.1], [-1, 0.5], [-1, 0.78], [-0.96, 0.92], [-0.6, 1.0], [0, 1.0], [0.6, 1.0], [0.96, 0.92], [1, 0.78], [1, 0.5], [1, -0.1]
];
/** Широчайшая в пройме и под ней — тень вдоль боков. */
const LAT: [number, number][] = [[-1, 0.42], [-1, 0.6], [-1, 0.74], [-0.97, 0.82], [-0.8, 0.76], [-0.72, 0.64], [-0.78, 0.52], [-0.9, 0.44]];
/** Трапеции: скат от шеи к плечу. */
const TRAP: [number, number][] = [[-0.98, 0.86], [-0.64, 0.9], [-0.36, 0.97], [-0.34, 1.0], [-0.7, 0.95], [-1, 0.9]];
/** Нижний край грудной: от подмышки к грудине, под ним тень на ткани. */
const PEC: [number, number][] = [[-0.86, 0.66], [-0.66, 0.6], [-0.4, 0.565], [-0.16, 0.575], [-0.02, 0.61]];
const PEC_SHADE: [number, number][] = [...PEC, [-0.02, 0.585], [-0.16, 0.55], [-0.4, 0.54], [-0.66, 0.575], [-0.86, 0.64]];

/**
 * Капсула, сдвинутая поперёк конечности наружу (`side` 1) или внутрь (−1):
 * тень мышцы с одной стороны, блик с другой. «Наружу» — поворотом от
 * направления конечности, зеркально для левой и правой: так сторона тени
 * меняется плавно вместе с рукой, а не перескакивает, когда рука проходит
 * горизонталь.
 */
function offsetCapsule(a: P, ra: number, b: P, rb: number, shift: number, side: 1 | -1, limb: 1 | -1): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const n: P = [(limb * dy) / L, (-limb * dx) / L];
  const k = shift * side;
  return capsule([a[0] + n[0] * k, a[1] + n[1] * k], ra, [b[0] + n[0] * k, b[1] + n[1] * k], rb);
}
const at = (a: P, b: P, t: number): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

export type Layer = 'ropeBack' | 'legR' | 'legL' | 'torso' | 'armR' | 'armL' | 'loadR' | 'loadL' | 'head' | 'bar' | 'extra' | 'ropeFront';

export type FrontPlan = {
  order: Layer[];
  /** Гантели гриф поперёк (жимы, разводки) или торцом к зрителю (висят по бокам). */
  dbFlat: boolean;
  /** Одна гиря на две руки или одна в ближней руке. */
  kbSingle: boolean;
  /** Морда к зрителю или затылок. */
  face: boolean;
  /** Голова макушкой вверх (1) или вниз (−1, стойка на руках). */
  upright: 1 | -1;
};

/**
 * Порядок слоёв и варианты деталей на всё движение — по выборке поз.
 * Решается большинством: деталь, которая в половине повтора смотрела бы
 * иначе, рисуется так, как она выглядит дольше.
 */
export function frontPlan(samples: { r: Solved; z: Widths }[], load: Load): FrontPlan {
  let headBehind = 0;
  let legsFront = 0;
  let armsBehind = 0;
  let barFront = 0;
  let flat = 0;
  let single = 0;
  let face = 0;
  let upright = 0;
  for (const { r, z } of samples) {
    const { pose } = r;
    const t = pose.torso;
    const front: P = [Math.cos(t), Math.sin(t)];
    const lyingUp = Math.sin(t) < -0.6 && r.neck[0] < pose.hip[0] - 30;
    if (lyingUp) headBehind++;
    const kneeAhead = (r.leg.mid[0] + r.leg2.mid[0]) / 2 - pose.hip[0];
    if (kneeAhead > 10 || lyingUp) legsFront++;
    const hands = (r.arm.end[0] + r.arm2.end[0]) / 2 - r.shoulder[0];
    if (hands < -10 && Math.cos(t) > 0.3) armsBehind++;
    const bar = pose.load ?? r.arm.end;
    if ((bar[0] - pose.hip[0]) * front[0] + (bar[1] - pose.hip[1]) * front[1] > 6) barFront++;
    if (Math.abs(Math.cos(t)) < 0.5 || r.arm.end[1] < r.shoulder[1] - 10) flat++;
    if (z.hand < 16 || pose.hand2) single++;
    const a = t + (pose.head ?? 0);
    if (Math.cos(a) > 0.15) face++;
    if (Math.cos(a) > -0.2) upright++;
  }
  const most = (n: number) => n * 2 >= samples.length;
  const arms: Layer[] = load === 'dumbbell' || load === 'kettlebell' || load === 'handle' || load === 'band' ? ['armR', 'loadR', 'armL', 'loadL'] : ['armR', 'armL', 'loadR', 'loadL'];
  const order: Layer[] = ['ropeBack'];
  if (most(headBehind)) order.push('head');
  // Штанга — сразу под кистями: пальцы обхватывают гриф поверх.
  if (!most(barFront)) order.push('bar');
  if (most(armsBehind)) order.push(...arms);
  if (!most(legsFront)) order.push('legR', 'legL');
  order.push('torso');
  if (most(legsFront)) order.push('legR', 'legL');
  if (most(barFront)) order.push('bar');
  if (!most(armsBehind)) order.push(...arms);
  order.push('extra');
  if (!most(headBehind)) order.push('head');
  order.push('ropeFront');
  return { order, dbFlat: most(flat), kbSingle: most(single), face: most(face), upright: most(upright) ? 1 : -1 };
}

/** Голова анфас чуть меньше нарисованной: качок шире в плечах, чем в морде. */
const HEAD = 0.88;

export function frontFrame(r: Solved, load: Load, live: Live, z: Widths, plan: FrontPlan, hood: boolean): Frame {
  const { pose } = r;
  const out: Frame = new Map();
  const put = (part: string, attr: string, value: string) => out.set(part, { ...(out.get(part) ?? {}), [attr]: value });
  const effort = pose.effort ?? 0;
  const lean = pose.lean ?? 0;
  const shift = pose.shift ?? 0;
  const twist = shift / 70;
  const ctx: Ctx = { t: pose.torso, hipY: pose.hip[1], lean, twist };
  const pelvis: P = [CX, pose.hip[1]];
  const up = (p: P) => rotate(p, pelvis, lean);

  // Суставы на экране. Левая сторона мопса (ближняя сбоку) — у зрителя справа.
  const hipL: P = [CX + z.hip, pose.hip[1]];
  const hipR: P = [CX - z.hip, pose.hip[1]];
  const kneeL: P = [CX + z.knee, r.leg.mid[1]];
  const kneeR: P = [CX - z.knee, r.leg2.mid[1]];
  const footL: P = [CX + z.foot, r.leg.end[1]];
  const footR: P = [CX - z.foot, r.leg2.end[1]];
  const sw = z.shoulder * Math.cos(twist);
  const sx = Math.sin(twist) * 10;
  const shL = up([CX + sw + sx, r.shoulder[1]]);
  const shR = up([CX - sw + sx, r.shoulder[1]]);
  const elL = up([CX + z.elbow + shift * 0.6, r.arm.mid[1]]);
  const elR = up([CX - z.elbow + shift * 0.6, r.arm2.mid[1]]);
  const hdL = up([CX + z.hand + shift, r.arm.end[1]]);
  const hdR = up([CX - z.hand + shift, r.arm2.end[1]]);

  // ── Корпус ──
  put('skin', 'd', band(ctx, -0.12, 1));
  // Грудь к зрителю — видна передняя сторона майки; спиной — задняя. Между ними
  // перетекает, а не переключается.
  const ct = Math.cos(pose.torso);
  const frontSide = clamp((ct + 0.12) / 0.24, 0, 1);
  const map = (pts: [number, number][], side: 1 | -1) => pts.map(([u, v]) => surface(ctx, v, u, side));
  put('cloth', 'd', smoothPolygon(map(hood ? HOODIE_FRONT : TANK_FRONT, 1), 0.3));
  put('cloth', 'opacity', n2(frontSide));
  put('clothBack', 'd', smoothPolygon(map(hood ? HOODIE_FRONT : TANK_BACK, -1), 0.3));
  put('clothBack', 'opacity', n2(1 - frontSide));
  // Мышцы корпуса: широчайшие и трапеции — тенью по коже, грудные и пресс — складками ткани.
  const muscles = hood ? 0 : frontSide;
  put('lats', 'd', `${smoothPolygon(map(LAT, 1), 0.4)}${smoothPolygon(map(mirror(LAT), 1), 0.4)}`);
  put('traps', 'd', `${smoothPolygon(map(TRAP, 1), 0.4)}${smoothPolygon(map(mirror(TRAP), 1), 0.4)}`);
  put('pecs', 'd', `${curve(ctx, PEC)}${curve(ctx, mirror(PEC))}`);
  put('pecShade', 'd', `${smoothPolygon(map(PEC_SHADE, 1), 0.2)}${smoothPolygon(map(mirror(PEC_SHADE), 1), 0.2)}`);
  put('abs', 'd', `${curve(ctx, [[0, 0.14], [0, 0.5]])}${curve(ctx, [[-0.3, 0.4], [0.3, 0.4]])}${curve(ctx, [[-0.32, 0.27], [0.32, 0.27]])}`);
  for (const part of ['lats', 'traps', 'pecs', 'pecShade', 'abs']) put(part, 'opacity', n2(muscles));
  // Таз дальше груди, когда мопс наклонился к зрителю: тогда шорты под майкой.
  const shortsD = band(ctx, -0.12, 0.06);
  const bowed = clamp((Math.sin(pose.torso) - 0.25) / 0.2, 0, 1);
  put('shorts', 'd', shortsD);
  put('shorts', 'opacity', n2(1 - bowed));
  put('shortsBack', 'd', shortsD);
  put('shortsBack', 'opacity', n2(bowed));
  // Грудина и ключицы в вырезе майки — видны, только когда грудь к зрителю.
  const ster0 = surface(ctx, 0.74, 0, 1);
  const ster1 = surface(ctx, 0.86, 0, 1);
  const clL = surface(ctx, 0.9, 0.28, 1);
  const clR = surface(ctx, 0.9, -0.28, 1);
  put('chest', 'd', `M${n2(ster0[0])} ${n2(ster0[1])}L${n2(ster1[0])} ${n2(ster1[1])}M${n2(clR[0])} ${n2(clR[1])}Q${n2(CX)} ${n2(ster1[1] - 2)} ${n2(clL[0])} ${n2(clL[1])}`);
  put('chest', 'opacity', n2(hood ? 0 : clamp(ct * 1.4, 0, 1)));
  if (hood) {
    const pocket: [number, number][] = [[-0.62, 0.12], [-0.7, 0.34], [-0.34, 0.4], [0.34, 0.4], [0.7, 0.34], [0.62, 0.12]];
    put('pocket', 'd', smoothPolygon(map(pocket, 1), 0.2));
  }

  // ── Ноги: бедро, голень с икрой, лапа; шорты на бедре ──
  const leg = (side: 'L' | 'R', hip: P, knee: P, foot: P, ahead: number) => {
    const lim = side === 'L' ? 1 : -1;
    put(`thigh${side}`, 'd', capsule(hip, 15.5, knee, 11.5));
    put(`shin${side}`, 'd', capsule(knee, 11, foot, 7.5));
    put(`calf${side}`, 'd', capsule([knee[0], knee[1] + 4], 12.5, at(knee, foot, 0.55), 8.6));
    const mid = at(hip, knee, 0.42);
    put(`trunks${side}`, 'd', capsule(hip, 16, mid, 15));
    // Бедро, которое смотрит на зрителя, — колено впереди, шорты кольцом за ним.
    put(`knee${side}`, 'd', capsule(mid, 13, knee, 11.5));
    put(`knee${side}`, 'opacity', n2(clamp((ahead - 4) / 12, 0, 1)));
    put(`quad${side}`, 'd', offsetCapsule(at(hip, knee, 0.2), 6.5, at(hip, knee, 0.85), 4.5, 7, 1, lim));
    put(`vmo${side}`, 'd', offsetCapsule(at(hip, knee, 0.55), 4.5, at(hip, knee, 0.86), 6, 5.5, -1, lim));
    put(`calfShade${side}`, 'd', offsetCapsule(at(knee, foot, 0.12), 5, at(knee, foot, 0.5), 3.5, 6, -1, lim));
    put(`paw${side}`, 'transform', `translate(${n2(foot[0])} ${n2(foot[1])})`);
  };
  leg('L', hipL, kneeL, footL, r.leg.mid[0] - pose.hip[0]);
  leg('R', hipR, kneeR, footR, r.leg2.mid[0] - pose.hip[0]);

  // ── Руки: дельта, бицепс и трицепс, предплечье, лапа ──
  const arm = (side: 'L' | 'R', sh: P, el: P, hd: P) => {
    const lim = side === 'L' ? 1 : -1;
    put(`delt${side}`, 'd', circlePath(sh, 17));
    put(`upper${side}`, 'd', capsule(sh, 14.5, el, 11));
    put(`fore${side}`, 'd', capsule(el, 10.5, hd, 7.5));
    put(`brach${side}`, 'd', capsule(el, 11.5, at(el, hd, 0.4), 9.6));
    put(`paw${side}H`, 'd', circlePath(hd, 8.6));
    const out: P = [Math.sign(sh[0] - CX) || 1, 0];
    put(`deltLight${side}`, 'd', circlePath([sh[0] + out[0] * 5, sh[1] - 7], 6));
    put(`bicep${side}`, 'd', offsetCapsule(at(sh, el, 0.3), 6.5, at(sh, el, 0.8), 4.6, 3.5, -1, lim));
    put(`tricep${side}`, 'd', offsetCapsule(at(sh, el, 0.25), 6, at(sh, el, 0.85), 4.4, 7.5, 1, lim));
    const a = at(sh, el, 0.3);
    const dx = el[0] - sh[0];
    const dy = el[1] - sh[1];
    const L = Math.hypot(dx, dy) || 1;
    const n: P = [-dy / L, dx / L];
    put(`deltLine${side}`, 'd', `M${n2(a[0] + n[0] * 11)} ${n2(a[1] + n[1] * 11)}Q${n2(a[0] + (dx / L) * 4)} ${n2(a[1] + (dy / L) * 4)} ${n2(a[0] - n[0] * 11)} ${n2(a[1] - n[1] * 11)}`);
  };
  arm('L', shL, elL, hdL);
  arm('R', shR, elR, hdR);

  // ── Голова ──
  // Череп круглый при любом наклоне; наклон двигает черты морды вниз-вверх.
  const a = pose.torso + (pose.head ?? 0);
  const ca = Math.cos(a);
  const neck = up([CX + shift * 0.15, r.neck[1]]);
  const hc: P = [neck[0], neck[1] - ca * 27 + Math.sin(a) * 6];
  const sy = plan.upright * (0.92 + 0.08 * Math.abs(ca));
  put('headF', 'transform', `translate(${n2(hc[0])} ${n2(hc[1])}) rotate(${n2((lean * 180) / Math.PI)}) scale(${HEAD} ${n2(sy * HEAD)})`);
  put('feat', 'transform', `translate(0 ${n2(clamp(Math.sin(a) * 14, -10, 12))})`);
  put('lidF', 'opacity', n2(clamp((effort - 0.5) * 2.6, 0, 1)));
  put('blinkF', 'opacity', live.blink ? '1' : '0');
  put('browF', 'transform', `translate(0 ${n2(effort * 2.5)})`);
  put('tongueF', 'opacity', n2(hood ? 0 : live.tongue));
  put('earL', 'transform', `rotate(${n2(-4 * effort + 3 * Math.sin(live.t * 2.1))} 20 -34)`);
  put('earR', 'transform', `rotate(${n2(4 * effort - 3 * Math.sin(live.t * 2.1 + 0.6))} -20 -34)`);
  put('sweatF', 'opacity', n2(live.sweatOpacity));
  // Спереди — по краю щеки под ухом, а не у внешнего угла глаза: там она слеза.
  put('sweatF', 'transform', `translate(${n2(37 - live.sweat * 2)} ${n2(-12 + live.sweat * 28)})`);
  put('strings', 'transform', `translate(${n2(hc[0])} ${n2(hc[1] + 2)}) scale(${HEAD})`);

  // ── Снаряды ──
  const bend = effort * (load === 'plate' ? 5 : 0);
  if (load === 'plate') {
    const by = (pose.load ?? [0, (r.arm.end[1] + r.arm2.end[1]) / 2])[1];
    const half = 124;
    const yAt = (x: number) => by + bend * ((x - CX) / half) ** 2;
    put('barLine', 'd', `M${n2(CX - half)} ${n2(yAt(CX - half))}Q${n2(CX)} ${n2(by - bend)} ${n2(CX + half)} ${n2(yAt(CX + half))}`);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = CX + s * (84 + i * 8);
        const slope = (2 * bend * (x - CX)) / (half * half);
        put(`plate${s}${i}`, 'transform', `translate(${n2(x)} ${n2(yAt(x))}) rotate(${n2((Math.atan(slope) * 180) / Math.PI)})`);
      }
      const cx = CX + s * 77;
      put(`collar${s}`, 'transform', `translate(${n2(cx)} ${n2(yAt(cx))})`);
    }
  }
  const mid: P = [(hdL[0] + hdR[0]) / 2, (hdL[1] + hdR[1]) / 2];
  if (load === 'dumbbell') {
    put('loadL', 'transform', `translate(${n2(hdL[0])} ${n2(hdL[1])})`);
    put('loadR', 'transform', `translate(${n2(hdR[0])} ${n2(hdR[1])})`);
  }
  if (load === 'kettlebell') {
    const together = z.hand < 16;
    put('loadL', 'transform', `translate(${n2(together ? mid[0] : hdL[0])} ${n2(hdL[1])})`);
    put('loadR', 'transform', `translate(${n2(hdR[0])} ${n2(hdR[1])})`);
  }
  if (load === 'singleDb' || load === 'disc' || load === 'ball' || load === 'wheel') put('loadL', 'transform', `translate(${n2(mid[0])} ${n2(mid[1])})`);
  if (load === 'handle' || load === 'band') {
    const pulley: P | null = pose.pulley ? [CX + z.pulley, pose.pulley[1]] : null;
    const twoTowers = Math.abs(z.pulley) > 60;
    const fromL: P = pulley ? (twoTowers ? [CX + Math.abs(z.pulley), pulley[1]] : pulley) : [footL[0] + 4, GROUND - 2];
    const fromR: P = pulley ? (twoTowers ? [CX - Math.abs(z.pulley), pulley[1]] : pulley) : [footR[0] - 4, GROUND - 2];
    put('cableL', 'd', `M${n2(fromL[0])} ${n2(fromL[1])}L${n2(hdL[0])} ${n2(hdL[1])}`);
    put('cableR', 'd', `M${n2(fromR[0])} ${n2(fromR[1])}L${n2(hdR[0])} ${n2(hdR[1])}`);
    put('loadL', 'transform', `translate(${n2(hdL[0])} ${n2(hdL[1])})`);
    put('loadR', 'transform', `translate(${n2(hdR[0])} ${n2(hdR[1])})`);
  }
  if (load === 'roller' || load === 'platform' || load === 'seatSlide') {
    const pad = pose.pad ?? pose.hip;
    put('loadL', 'transform', `translate(${n2(CX)} ${n2(pad[1])})`);
  }
  if (load === 'ropes') {
    const s = pose.spin ?? 0;
    const wave = (h: P, k: number) => {
      const end: P = [h[0] * 0.7 + CX * 0.3 + (h[0] > CX ? 30 : -30), GROUND - 1];
      const m1: P = [lerp(h[0], end[0], 0.33) + 10 * Math.sin(s + k), lerp(h[1], end[1], 0.33)];
      const m2: P = [lerp(h[0], end[0], 0.66) - 10 * Math.sin(s + k), lerp(h[1], end[1], 0.66)];
      return `M${n2(h[0])} ${n2(h[1])}C${n2(m1[0])} ${n2(m1[1])} ${n2(m2[0])} ${n2(m2[1])} ${n2(end[0])} ${n2(end[1])}`;
    };
    put('ropeL', 'd', wave(hdL, 0));
    put('ropeR', 'd', wave(hdR, Math.PI));
  }
  if (load === 'jumpRope') {
    // Скакалка проходит то перед мопсом, то за ним; меняет сторону, когда она
    // над головой или под ногами, — там она ни с чем не пересекается.
    const s = pose.spin ?? 0;
    const top = hc[1] - 52;
    const target = lerp(GROUND + 1, top, (1 + Math.cos(s)) / 2);
    const cy = 2 * target - (hdL[1] + hdR[1]) / 2;
    const d = `M${n2(hdL[0])} ${n2(hdL[1])}Q${n2(CX)} ${n2(cy)} ${n2(hdR[0])} ${n2(hdR[1])}`;
    const ahead = Math.sin(s) > 0;
    put('jumpFront', 'd', d);
    put('jumpFront', 'opacity', ahead ? '1' : '0');
    put('jumpBack', 'd', d);
    put('jumpBack', 'opacity', ahead ? '0' : '1');
  }
  return out;
}

function LegFront({ side, hood }: { side: 'L' | 'R'; hood: boolean }) {
  const skin = side === 'R' ? C.skinFar : C.skin;
  const cloth = hood ? (side === 'R' ? C.hoodieFar : C.hoodie) : skin;
  const trunks = hood ? C.hoodieFar : side === 'R' ? C.shortsFar : C.shorts;
  return (
    <>
      <PartPath name={`thigh${side}`} {...LINE} />
      <PartPath name={`shin${side}`} {...LINE} />
      <PartPath name={`calf${side}`} {...LINE} />
      <Part name={`paw${side}`}>
        <ellipse cx={0} cy={1} rx={12} ry={6.5} {...LINE} />
      </Part>
      <PartPath name={`shin${side}`} fill={cloth} />
      <PartPath name={`calf${side}`} fill={cloth} />
      {hood ? null : <PartPath name={`calfShade${side}`} fill={C.shade} />}
      <PartPath name={`thigh${side}`} fill={cloth} />
      {hood ? null : (
        <>
          <PartPath name={`quad${side}`} fill={C.shade} />
          <PartPath name={`vmo${side}`} fill={C.sheen} />
        </>
      )}
      {/* Шорты — без своей обводки: вместе с поясом они один кусок ткани, а
          не две половинки. */}
      <PartPath name={`trunks${side}`} fill={trunks} />
      <PartPath name={`knee${side}`} fill={cloth} />
      <Part name={`paw${side}`}>
        <ellipse cx={0} cy={1} rx={12} ry={6.5} fill={skin} />
        <path d="M-6 2V6M-2 1.5V6.5M2 1.5V6.5M6 2V6" stroke={C.mask} strokeOpacity={0.5} strokeWidth={1.2} strokeLinecap="round" />
      </Part>
    </>
  );
}

function ArmFront({ side, hood }: { side: 'L' | 'R'; hood: boolean }) {
  const skin = side === 'R' ? C.skinFar : C.skin;
  const cloth = hood ? (side === 'R' ? C.hoodieFar : C.hoodie) : skin;
  const names = [`delt${side}`, `upper${side}`, `fore${side}`, `brach${side}`, `paw${side}H`];
  return (
    <>
      {names.map((n) => (
        <PartPath key={`o${n}`} name={n} {...LINE} />
      ))}
      <PartPath name={`delt${side}`} fill={cloth} />
      <PartPath name={`upper${side}`} fill={cloth} />
      <PartPath name={`fore${side}`} fill={cloth} />
      <PartPath name={`brach${side}`} fill={cloth} />
      {hood ? null : (
        <>
          <PartPath name={`tricep${side}`} fill={C.shade} />
          <PartPath name={`bicep${side}`} fill={C.sheen} />
          <PartPath name={`deltLight${side}`} fill={C.sheen} />
          <PartPath name={`deltLine${side}`} stroke={C.mask} strokeOpacity={0.28} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        </>
      )}
      <PartPath name={`paw${side}H`} fill={skin} />
    </>
  );
}

function BarbellFront() {
  return (
    <>
      <PartPath name="barLine" stroke={C.ink} strokeWidth={5} fill="none" strokeLinecap="round" />
      <PartPath name="barLine" stroke={C.chrome} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <Part name={`collar${s}`}>
            <rect x={-3} y={-7} width={6} height={14} rx={1.5} fill={C.chrome} stroke={C.ink} strokeWidth={1.2} />
          </Part>
          {[0, 1, 2].map((i) => (
            <Part key={i} name={`plate${s}${i}`}>
              <rect x={-4} y={-28} width={8} height={56} rx={2.5} fill={i === 0 ? C.iron : C.ironEdge} stroke={C.ink} strokeWidth={1.3} />
            </Part>
          ))}
        </g>
      ))}
    </>
  );
}

function DumbbellFront({ side, flat }: { side: 'L' | 'R'; flat: boolean }) {
  return (
    <Part name={`load${side}`}>
      {flat ? (
        <g>
          <rect x={-14} y={-2} width={28} height={4} rx={2} fill={C.chrome} stroke={C.ink} strokeWidth={1} />
          <rect x={-19} y={-11} width={8} height={22} rx={2} fill={C.iron} stroke={C.ink} strokeWidth={1.2} />
          <rect x={11} y={-11} width={8} height={22} rx={2} fill={C.iron} stroke={C.ink} strokeWidth={1.2} />
        </g>
      ) : (
        <g>
          <path d="M0-12L10.4-6V6L0 12L-10.4 6V-6Z" fill={C.iron} stroke={C.ink} strokeWidth={1.3} strokeLinejoin="round" />
          <circle r={3.4} fill={C.chrome} />
        </g>
      )}
    </Part>
  );
}

/** Всё, что рисуется спереди, в порядке плана движения. */
export function FrontBody({ load, hood, plan }: { load: Load; hood: boolean; plan: FrontPlan }) {
  const layers: Record<Layer, React.ReactNode> = {
    ropeBack: load === 'jumpRope' ? <PartPath name="jumpBack" stroke={C.ink} strokeWidth={1.8} fill="none" /> : null,
    legR: <LegFront side="R" hood={hood} />,
    legL: <LegFront side="L" hood={hood} />,
    torso: (
      <>
        <PartPath name="skin" {...LINE} />
        <PartPath name="skin" fill={hood ? C.hoodie : C.skin} />
        <PartPath name="lats" fill={C.shade} />
        <PartPath name="traps" fill={C.shade} />
        <PartPath name="shortsBack" fill={hood ? C.hoodieFar : C.shorts} />
        <PartPath name="clothBack" fill={hood ? C.hoodie : C.tankFar} stroke={C.ink} strokeOpacity={0.3} strokeWidth={1.1} />
        <PartPath name="cloth" fill={hood ? C.hoodie : C.tank} stroke={C.ink} strokeOpacity={hood ? 0.25 : 0.35} strokeWidth={1.1} />
        <PartPath name="pecShade" fill={C.tankShade} fillOpacity={0.8} />
        <PartPath name="pecs" stroke={C.tankShade} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        <PartPath name="abs" stroke={C.tankShade} strokeWidth={1.2} strokeOpacity={0.7} fill="none" strokeLinecap="round" />
        {hood ? <PartPath name="pocket" fill={C.hoodieFar} stroke={C.ink} strokeOpacity={0.3} strokeWidth={1} /> : null}
        <PartPath name="chest" stroke={C.mask} strokeOpacity={0.25} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <PartPath name="shorts" fill={hood ? C.hoodieFar : C.shorts} />
        {hood ? (
          <Part name="strings">
            <HoodStrings />
          </Part>
        ) : null}
      </>
    ),
    armR: <ArmFront side="R" hood={hood} />,
    armL: <ArmFront side="L" hood={hood} />,
    head: (
      <Part name="headF">
        <HeadFront hood={hood} outline back={!plan.face} />
        <HeadFront hood={hood} back={!plan.face} />
      </Part>
    ),
    bar: load === 'plate' ? <BarbellFront /> : null,
    loadR:
      load === 'dumbbell' ? (
        <DumbbellFront side="R" flat={plan.dbFlat} />
      ) : load === 'kettlebell' && !plan.kbSingle ? (
        <Part name="loadR">
          <path d="M-7 2C-7-9 7-9 7 2" stroke={C.ink} strokeWidth={3.4} fill="none" />
          <circle cx={0} cy={13} r={11.5} fill={C.iron} stroke={C.ink} strokeWidth={1.3} />
        </Part>
      ) : load === 'handle' || load === 'band' ? (
        <>
          <PartPath name="cableR" stroke={load === 'band' ? 'rgb(var(--loss))' : C.ink} strokeOpacity={0.8} strokeWidth={load === 'band' ? 3 : 1.6} fill="none" />
          {load === 'handle' ? (
            <Part name="loadR">
              <rect x={-4} y={-9} width={8} height={18} rx={4} fill={C.ink} />
            </Part>
          ) : null}
        </>
      ) : null,
    loadL:
      load === 'dumbbell' ? (
        <DumbbellFront side="L" flat={plan.dbFlat} />
      ) : load === 'kettlebell' ? (
        <Part name="loadL">
          <path d="M-7 2C-7-9 7-9 7 2" stroke={C.ink} strokeWidth={3.4} fill="none" />
          <circle cx={0} cy={13} r={11.5} fill={C.iron} stroke={C.ink} strokeWidth={1.3} />
        </Part>
      ) : load === 'handle' || load === 'band' ? (
        <>
          <PartPath name="cableL" stroke={load === 'band' ? 'rgb(var(--loss))' : C.ink} strokeOpacity={0.8} strokeWidth={load === 'band' ? 3 : 1.6} fill="none" />
          {load === 'handle' ? (
            <Part name="loadL">
              <rect x={-4} y={-9} width={8} height={18} rx={4} fill={C.ink} />
            </Part>
          ) : null}
        </>
      ) : load === 'singleDb' ? (
        <Part name="loadL">
          <rect x={-2} y={-16} width={4} height={32} rx={2} fill={C.chrome} stroke={C.ink} strokeWidth={1} />
          <rect x={-12} y={-21} width={24} height={8} rx={2} fill={C.iron} stroke={C.ink} strokeWidth={1.2} />
          <rect x={-12} y={13} width={24} height={8} rx={2} fill={C.iron} stroke={C.ink} strokeWidth={1.2} />
        </Part>
      ) : load === 'disc' ? (
        <Part name="loadL">
          <circle r={21} fill={C.iron} stroke={C.ink} strokeWidth={1.4} />
          <circle r={16} fill="none" stroke={C.white} strokeOpacity={0.12} strokeWidth={1.4} />
          <circle r={4} fill={C.chrome} />
        </Part>
      ) : load === 'ball' ? (
        <Part name="loadL">
          <circle r={14} fill={C.ink} />
          <path d="M-13-3Q0 3 13-3M-12 5Q0 10 12 5" stroke={C.white} strokeOpacity={0.2} strokeWidth={1.4} fill="none" />
        </Part>
      ) : load === 'wheel' ? (
        <Part name="loadL">
          <rect x={-20} y={-2} width={40} height={4} rx={2} fill={C.chrome} />
          <rect x={-5} y={-11} width={10} height={24} rx={5} fill={C.ink} />
        </Part>
      ) : load === 'roller' || load === 'platform' || load === 'seatSlide' ? (
        <Part name="loadL">
          {load === 'roller' ? <rect x={-34} y={-8} width={68} height={16} rx={8} fill={C.pad} stroke={C.ink} strokeWidth={1.2} /> : null}
          {load === 'platform' ? <rect x={-50} y={-26} width={100} height={52} rx={4} fill="none" stroke={C.frame} strokeWidth={5} /> : null}
          {load === 'seatSlide' ? <rect x={-20} y={8} width={40} height={8} rx={3} fill={C.pad} /> : null}
        </Part>
      ) : null,
    extra:
      load === 'ropes' ? (
        <>
          <PartPath name="ropeR" stroke={C.ink} strokeWidth={4.5} fill="none" strokeLinecap="round" />
          <PartPath name="ropeL" stroke={C.ink} strokeWidth={4.5} fill="none" strokeLinecap="round" />
        </>
      ) : null,
    ropeFront: load === 'jumpRope' ? <PartPath name="jumpFront" stroke={C.ink} strokeWidth={1.8} fill="none" /> : null
  };
  return (
    <>
      {plan.order.map((name) => (
        <g key={name}>{layers[name]}</g>
      ))}
    </>
  );
}
