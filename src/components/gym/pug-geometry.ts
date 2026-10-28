import type { Grip } from '@/lib/gym/exercises';
import { BODY, LATERAL, shoulderOf, type Lateral, type P, type Pose } from './pug-motions';

/**
 * Геометрия мопса: из позы — суставы, из суставов — кадр.
 *
 * Поза задаёт вид сбоку (плоскость x–y). Вид спереди берёт те же высоты, а
 * по горизонтали ставит ширину из `pose.z`: камера спереди смотрит на мопса
 * вдоль оси x, поэтому x становится глубиной и решает, кто кого закрывает.
 */

export const deg = (rad: number) => (rad * 180) / Math.PI;
/** Две цифры после точки: атрибуты пишутся каждый кадр, лишние знаки — лишний мусор в DOM. */
export const n2 = (v: number) => (Math.round(v * 100) / 100).toString();
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Двузвенная обратная кинематика: где локоть (колено), если плечо и кисть — здесь. */
export function ik(a: P, target: P, l1: number, l2: number, sign: number) {
  const dx = target[0] - a[0];
  const dy = target[1] - a[1];
  const d = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const angle = base + sign * Math.acos(clamp(cos, -1, 1));
  const mid: P = [a[0] + l1 * Math.cos(angle), a[1] + l1 * Math.sin(angle)];
  const end: P = [a[0] + d * Math.cos(base), a[1] + d * Math.sin(base)];
  return { mid, end };
}

export type Limb = { root: P; mid: P; end: P };

export type Solved = {
  pose: Pose;
  shoulder: P;
  neck: P;
  /** Ближние к зрителю сбоку рука и нога — левые; дальние — правые. */
  arm: Limb;
  arm2: Limb;
  leg: Limb;
  leg2: Limb;
};

export function solve(pose: Pose): Solved {
  const shrug = pose.shrug ?? 0;
  const reach = pose.reach ?? 1;
  const d: P = [Math.sin(pose.torso), -Math.cos(pose.torso)];
  const shoulder = shoulderOf(pose.hip, pose.torso, shrug);
  const up = BODY.torso + shrug * 0.4;
  const neck: P = [pose.hip[0] + d[0] * up, pose.hip[1] + d[1] * up];
  const limb = (root: P, target: P, l1: number, l2: number, sign: number): Limb => ({ root, ...ik(root, target, l1, l2, sign) });
  return {
    pose,
    shoulder,
    neck,
    arm: limb(shoulder, pose.hand, BODY.upper * (pose.reachUpper ?? reach), BODY.fore * reach, pose.elbow),
    arm2: limb(shoulder, pose.hand2 ?? pose.hand, BODY.upper * (pose.reachUpper ?? reach), BODY.fore * reach, pose.elbow2 ?? pose.elbow),
    // Колено гнётся только в одну сторону, и сторона эта не зависит от позы:
    // голень уходит назад относительно бедра, поэтому колено всегда по одну
    // сторону от линии таз–лодыжка, как бы ни был повёрнут мопс. Сбоку мопс
    // смотрит вправо — это сторона `KNEE`. Поза колено не выбирает: выбор в
    // позе однажды уже вывернул колени назад в двух десятках движений.
    leg: limb(pose.hip, pose.foot, BODY.thigh, BODY.shin, KNEE),
    leg2: limb(pose.hip, pose.foot2 ?? pose.foot, BODY.thigh, BODY.shin, KNEE)
  };
}

const KNEE = -1;

/** Середина мира по ширине: на ней стоит мопс в виде спереди. */
export const CX = 200;

export type Widths = Lateral & { pulley: number };

/** Ширины позы с поправкой на хват упражнения: узкий собирает кисти, широкий разводит. */
export function widthsOf(pose: Pose, grip?: Grip): Widths {
  const z: Widths = { ...LATERAL, pulley: 0, ...pose.z };
  if (grip === 'close') {
    z.hand *= 0.58;
    z.elbow = Math.max(z.shoulder + 2, z.elbow * 0.86);
  }
  if (grip === 'wide') {
    z.hand *= 1.32;
    z.elbow *= 1.16;
  }
  return z;
}

/** Точка вида спереди: ширина по горизонтали, высота — как сбоку. `side` 1 — левая сторона мопса, она у зрителя справа. */
export const front = (p: P, z: number, side: 1 | -1): P => [CX + side * z, p[1]];

/** Поворот точки вокруг центра — наклон корпуса вбок в виде спереди. */
export function rotate(p: P, c: P, a: number): P {
  if (!a) return p;
  const s = Math.sin(a);
  const k = Math.cos(a);
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * k - dy * s, c[1] + dx * s + dy * k];
}

const e = (a: number): P => [Math.cos(a), Math.sin(a)];
const pt = (p: P) => `${n2(p[0])} ${n2(p[1])}`;

export const circlePath = (c: P, r: number) =>
  `M${n2(c[0] - r)} ${n2(c[1])}a${n2(r)} ${n2(r)} 0 1 0 ${n2(2 * r)} 0a${n2(r)} ${n2(r)} 0 1 0 ${n2(-2 * r)} 0Z`;

/**
 * Конечность спереди — «капсула» с сужением: круг у одного сустава, круг у
 * другого и касательные между ними. Укороченная перспективой (бедро сидящего,
 * которое смотрит на зрителя) честно становится кругом, а не щепкой.
 */
export function capsule(a: P, ra: number, b: P, rb: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(ra - rb) + 0.01) return ra >= rb ? circlePath(a, ra) : circlePath(b, rb);
  const th = Math.atan2(dy, dx);
  const al = Math.acos(clamp((ra - rb) / d, -1, 1));
  const ea1 = e(th + al);
  const ea2 = e(th - al);
  const a1: P = [a[0] + ra * ea1[0], a[1] + ra * ea1[1]];
  const b1: P = [b[0] + rb * ea1[0], b[1] + rb * ea1[1]];
  const b2: P = [b[0] + rb * ea2[0], b[1] + rb * ea2[1]];
  const a2: P = [a[0] + ra * ea2[0], a[1] + ra * ea2[1]];
  const bigB = 2 * al > Math.PI ? 1 : 0;
  const bigA = 2 * Math.PI - 2 * al > Math.PI ? 1 : 0;
  return `M${pt(a1)}L${pt(b1)}A${n2(rb)} ${n2(rb)} 0 ${bigB} 0 ${pt(b2)}L${pt(a2)}A${n2(ra)} ${n2(ra)} 0 ${bigA} 0 ${pt(a1)}Z`;
}

/** Выпуклая оболочка (монотонная цепь Эндрю). */
export function hull(points: P[]): P[] {
  const ps = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (ps.length < 3) return ps;
  const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P[] = [];
  for (const p of ps) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P[] = [];
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

export const polygon = (ps: P[]) => (ps.length ? `M${ps.map(pt).join('L')}Z` : '');

/** Гладкая замкнутая кривая через точки (Catmull–Rom в кубические Безье). */
export function smoothPolygon(ps: P[], tension = 0.5): string {
  const n = ps.length;
  if (n < 3) return polygon(ps);
  let d = `M${pt(ps[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = ps[(i - 1 + n) % n];
    const p1 = ps[i];
    const p2 = ps[(i + 1) % n];
    const p3 = ps[(i + 2) % n];
    const c1: P = [p1[0] + ((p2[0] - p0[0]) / 6) * tension * 2, p1[1] + ((p2[1] - p0[1]) / 6) * tension * 2];
    const c2: P = [p2[0] - ((p3[0] - p1[0]) / 6) * tension * 2, p2[1] - ((p3[1] - p1[1]) / 6) * tension * 2];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return `${d}Z`;
}

/**
 * Где фаза повтора. `rep`: пауза наверху, медленно вниз, пауза внизу, вверх
 * быстрее, чем вниз, — так выглядит повтор с контролем, а не маятник.
 * `cycle`: круг идёт только вперёд. `hold`: вдох и выдох.
 */
export const REP = 2.9;
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
export function phaseOf(t: number, tempo: 'rep' | 'hold' | 'cycle', period?: number): number {
  if (tempo === 'hold') return 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / (period ?? 3.8));
  if (tempo === 'cycle') return (t / (period ?? 1.2)) % 1;
  const k = (period ?? REP) / REP;
  const c = (t / k) % REP;
  if (c < 0.35) return 0;
  if (c < 1.65) return ease((c - 0.35) / 1.3);
  if (c < 1.9) return 1;
  return 1 - ease((c - 1.9) / 1.0);
}
