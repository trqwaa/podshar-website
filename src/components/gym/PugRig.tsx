'use client';

import { createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

import type { Gear, Motion } from '@/lib/gym/exercises';
import { BODY, FLOOR, MOTIONS, loadOf, shoulderOf, type Load, type P, type Pose, type Prop } from './pug-motions';

/**
 * Мопс-качок в профиль, который показывает упражнение.
 *
 * Тот же подход, что у воды и трещин айсберга: всё, что двигается, считается в
 * `requestAnimationFrame` и пишется прямо в DOM атрибутами, без React-state и
 * без перерисовки покадрово. Первый кадр считается ещё при рендере и уходит в
 * HTML атрибутами, поэтому мопс приходит уже в позе, а не грудой деталей в углу.
 *
 * Без движения (`prefers-reduced-motion`) стоит в середине повтора — так
 * видно, что за упражнение, лучше, чем в исходной позе.
 *
 * Анимация засыпает, когда мопса не видно (IntersectionObserver): подвал,
 * пролистанный вниз, не жжёт кадры.
 *
 * Рисуется в два прохода, контур и заливка: сначала обводки всей цепочки
 * (плечо + предплечье), потом заливки поверх. Иначе на каждом суставе была бы
 * линия поперёк руки.
 */

const deg = (rad: number) => (rad * 180) / Math.PI;
const FAR_ARM: P = [-5, -2];
const FAR_LEG: P = [-7, -2];

type Solved = {
  pose: Pose;
  shoulder: P;
  neck: P;
  arm: { mid: P; end: P };
  arm2: { mid: P; end: P; root: P };
  leg: { mid: P; end: P };
  leg2: { mid: P; end: P; root: P };
};

/** Двузвенная обратная кинематика: где локоть (колено), если плечо и кисть — здесь. */
function ik(a: P, target: P, l1: number, l2: number, sign: number) {
  const dx = target[0] - a[0];
  const dy = target[1] - a[1];
  const d = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, Math.hypot(dx, dy)));
  const base = Math.atan2(dy, dx);
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const angle = base + sign * Math.acos(Math.min(1, Math.max(-1, cos)));
  const mid: P = [a[0] + l1 * Math.cos(angle), a[1] + l1 * Math.sin(angle)];
  const end: P = [a[0] + d * Math.cos(base), a[1] + d * Math.sin(base)];
  return { mid, end };
}

function solve(pose: Pose): Solved {
  const shrug = pose.shrug ?? 0;
  const dir: P = [Math.sin(pose.torso), -Math.cos(pose.torso)];
  const shoulder = shoulderOf(pose.hip, pose.torso, shrug);
  const neck: P = [pose.hip[0] + dir[0] * (BODY.torso + shrug * 0.4), pose.hip[1] + dir[1] * (BODY.torso + shrug * 0.4)];
  const arm = ik(shoulder, pose.hand, BODY.upper, BODY.fore, pose.elbow);
  const root2: P = [shoulder[0] + FAR_ARM[0], shoulder[1] + FAR_ARM[1]];
  const hand2 = pose.hand2 ?? [pose.hand[0] + FAR_ARM[0], pose.hand[1] + FAR_ARM[1]];
  const arm2 = { ...ik(root2, hand2, BODY.upper, BODY.fore, pose.elbow), root: root2 };
  const leg = ik(pose.hip, pose.foot, BODY.thigh, BODY.shin, pose.knee);
  const hip2: P = [pose.hip[0] + FAR_LEG[0], pose.hip[1] + FAR_LEG[1]];
  // Дальняя стопа стоит на том же полу, что и ближняя: сдвиг только назад.
  const foot2 = pose.foot2 ?? [pose.foot[0] + FAR_LEG[0], pose.foot[1]];
  const leg2 = { ...ik(hip2, foot2, BODY.thigh, BODY.shin, pose.knee), root: hip2 };
  return { pose, shoulder, neck, arm, arm2, leg, leg2 };
}

const seg = (a: P, b: P) =>
  `translate(${a[0].toFixed(2)} ${a[1].toFixed(2)}) rotate(${deg(Math.atan2(b[1] - a[1], b[0] - a[0])).toFixed(2)})`;
const at = (a: P, rad = 0) => `translate(${a[0].toFixed(2)} ${a[1].toFixed(2)})${rad ? ` rotate(${deg(rad).toFixed(2)})` : ''}`;

type Frame = Map<string, Record<string, string>>;

/** Все движущиеся атрибуты одной позы: часть → атрибут → значение. */
function frameOf(r: Solved, load: Load): Frame {
  const { pose } = r;
  const toe = pose.toe ?? 0;
  const out: Frame = new Map();
  const put = (part: string, attr: string, value: string) => out.set(part, { ...(out.get(part) ?? {}), [attr]: value });
  put('thigh2', 'transform', seg(r.leg2.root, r.leg2.mid));
  put('shin2', 'transform', seg(r.leg2.mid, r.leg2.end));
  put('foot2', 'transform', at(r.leg2.end, pose.foot2 ? 0 : toe));
  put('upper2', 'transform', seg(r.arm2.root, r.arm2.mid));
  put('fore2', 'transform', seg(r.arm2.mid, r.arm2.end));
  put('torso', 'transform', at(pose.hip, pose.torso));
  put('head', 'transform', at(r.neck, pose.torso + (pose.head ?? 0)));
  put('thigh', 'transform', seg(pose.hip, r.leg.mid));
  put('shin', 'transform', seg(r.leg.mid, r.leg.end));
  put('foot', 'transform', at(r.leg.end, toe));
  put('upper', 'transform', seg(r.shoulder, r.arm.mid));
  put('fore', 'transform', seg(r.arm.mid, r.arm.end));
  put('lid', 'opacity', Math.min(1, Math.max(0, ((pose.effort ?? 0) - 0.55) * 3)).toFixed(2));
  if (load === 'plate') put('load', 'transform', at(pose.load ?? r.arm.end));
  if (load === 'dumbbell') {
    put('load', 'transform', at(r.arm.end));
    put('load2', 'transform', at(r.arm2.end));
  }
  if (load === 'handle') {
    put('load', 'transform', at(r.arm.end));
    put('cable', 'x2', r.arm.end[0].toFixed(2));
    put('cable', 'y2', r.arm.end[1].toFixed(2));
  }
  if ((load === 'roller' || load === 'platform') && pose.pad) put('pad', 'transform', at(pose.pad, load === 'platform' ? -0.62 : 0));
  return out;
}

/**
 * Где фаза повтора: пауза наверху, медленно вниз, пауза внизу, вверх быстрее,
 * чем вниз. Так выглядит повтор с контролем, а не маятник.
 */
const CYCLE = 2.9;
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
function phaseOf(t: number, tempo: 'rep' | 'hold'): number {
  if (tempo === 'hold') return 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 3.8);
  const c = t % CYCLE;
  if (c < 0.35) return 0;
  if (c < 1.65) return ease((c - 0.35) / 1.3);
  if (c < 1.9) return 1;
  return 1 - ease((c - 1.9) / 1.0);
}

// ─── Детали: локальные координаты, сегмент лежит вдоль +x ───────────────────

const UPPER = 'M0 -14.5C8 -19.5 23 -19 41 -9L41 9C27 15.5 10 18 0 14.5Z';
const FORE = 'M0 -10C12 -12.5 26 -9.5 38.5 -6.5L38.5 6.5C26 10 12 12.5 0 10Z';
const THIGH = 'M0 -17C16 -20 34 -15 47 -10L47 10C34 14 16 18.5 0 17Z';
const SHORTS_LEG = 'M-1 -17.5C8 -19 16 -19 22 -18.3L22 18.6C14 18.8 6 18.2 -1 17.5Z';
const SHIN = 'M0 -11C14 -10.5 30 -7.5 44.5 -6L44.5 6C30 10.5 13 14.5 0 11Z';
const FOOT = 'M-7 -5C-6 -10 4 -9 12 -7C22 -5 27 1 25 6L-7 6Z';
const TORSO =
  'M-15 8C-19 -6 -21 -16 -23 -28C-27 -42 -27 -54 -21 -64C-16 -72 -7 -78 2 -77C10 -76 16 -71 22 -65C31 -57 33 -45 27 -37C22 -32 19 -26 18 -18C17 -8 17 0 13 8C4 12 -8 12 -15 8Z';
const SHORTS = 'M-16 9C-18 2 -18.6 -3 -18.8 -8L17.6 -8C17.4 -2 16.6 4 13.5 9C4 13 -8 13 -16 9Z';
const TANK =
  'M-18.8 -8C-20 -18 -21.4 -27 -22.8 -35C-16 -39 -9 -37 -4.5 -32C2 -41 11 -51 22.5 -56.5C28 -50 28.5 -42 26.6 -37.4C22 -32 19.2 -26 18 -18C17.6 -12 17.6 -10 17.6 -8Z';
const HOODIE =
  'M-15.6 9C-20 -6 -22 -16 -24 -28C-28.5 -43 -28 -55 -21.5 -65C-16 -73 -7 -79 2 -78C11 -77 17 -72 23 -66C32 -58 34 -45 28 -37C23 -31 20 -25 19 -17C18 -8 18 0 14 9C4 13 -8 13 -15.6 9Z';
const HEAD = 'M-4 2C-20 0 -24 -22 -18 -36C-12 -50 4 -54 16 -50C28 -46 34 -34 32 -22C31 -12 26 -4 18 -1C10 2 2 3 -4 2Z';
const MASK = 'M17 -46.5C28 -42 34 -32 32.6 -22C31.6 -12 27 -4.5 18 -1.2C15.5 -10 14 -20 14.6 -30C15 -37 15.8 -42 17 -46.5Z';
const EAR = 'M-8 -44C-6 -54 6 -55.5 7.5 -48C4 -43 -2 -41 -8 -44Z';
const HOOD =
  'M-6 6C-26 2 -32 -26 -24 -42C-16 -58 6 -64 22 -56C30 -52 35 -44 36 -36L28 -38C26 -45 16 -52 4 -50C-10 -48 -16 -32 -12 -16C-10 -8 -8 -2 -6 6Z';

/** Корпус глубже, чем рисовался: качок в профиль — это грудь и спина, а не доска. */
const TORSO_SCALE = 'scale(1.38 1)';
/** Голова мопса крупнее человеческой — иначе это человек с мордой мопса. */
const HEAD_SCALE = 'scale(1.18)';

const SKIN = 'fill-pug';
const FAR_SKIN = { fill: 'color-mix(in oklab, rgb(var(--pug)) 78%, rgb(var(--ink)))' };
const HOOD_FILL = { fill: 'color-mix(in oklab, rgb(var(--ink)) 20%, rgb(var(--surface)))' };
const HOOD_FAR = { fill: 'color-mix(in oklab, rgb(var(--ink)) 34%, rgb(var(--surface)))' };
const IRON = { fill: 'color-mix(in oklab, rgb(var(--deep)) 92%, rgb(var(--surface)))' };
const FRAME = { fill: 'color-mix(in oklab, rgb(var(--ink)) 62%, rgb(var(--canvas)))' };
const PAD = { fill: 'color-mix(in oklab, rgb(var(--ink)) 82%, rgb(var(--canvas)))' };
const TONGUE = { fill: 'color-mix(in oklab, rgb(var(--loss)) 45%, rgb(var(--note-pink)))' };
const OUTLINE = { stroke: 'rgb(var(--ink))', strokeWidth: 5, strokeLinejoin: 'round' as const, fill: 'rgb(var(--ink))' };

/** Первый кадр, разложенный по частям: каждая часть берёт свои атрибуты отсюда. */
const Initial = createContext<Frame>(new Map());

function Part({ name, children, ...rest }: { name: string; children?: React.ReactNode } & React.SVGProps<SVGGElement>) {
  const initial = useContext(Initial);
  return (
    <g data-part={name} {...initial.get(name)} {...rest}>
      {children}
    </g>
  );
}

function LimbOutline({ name, d, paw, delt }: { name: string; d: string; paw?: boolean; delt?: boolean }) {
  return (
    <Part name={name}>
      <path d={d} {...OUTLINE} />
      {paw ? <circle cx={40.5} cy={0} r={8.6} {...OUTLINE} /> : null}
      {delt ? <circle cx={2} cy={0} r={15} {...OUTLINE} /> : null}
    </Part>
  );
}

function LimbFill({ name, d, far, sleeve, paw, delt }: { name: string; d: string; far?: boolean; sleeve?: boolean; paw?: boolean; delt?: boolean }) {
  const style = sleeve ? (far ? HOOD_FAR : HOOD_FILL) : far ? FAR_SKIN : undefined;
  const skin = far ? FAR_SKIN : undefined;
  return (
    <Part name={name}>
      <path d={d} className={style ? undefined : SKIN} style={style} />
      {delt ? <circle cx={2} cy={0} r={15} className={style ? undefined : SKIN} style={style} /> : null}
      {paw ? <circle cx={40.5} cy={0} r={8.6} className={skin ? undefined : SKIN} style={skin} /> : null}
    </Part>
  );
}

function Foot({ name, far }: { name: string; far?: boolean }) {
  return (
    <Part name={name}>
      <path d={FOOT} {...OUTLINE} />
      <path d={FOOT} className={far ? undefined : SKIN} style={far ? FAR_SKIN : undefined} />
      <path d="M12 0.5V6M17 -0.5V6M21.5 1V5.5" className="stroke-pug-mask" strokeWidth={1.4} strokeLinecap="round" fill="none" />
    </Part>
  );
}

function Head({ hood, outline }: { hood: boolean; outline?: boolean }) {
  const initial = useContext(Initial);
  if (outline) {
    return (
      <Part name="head">
        <g transform={HEAD_SCALE}>
          <path d={HEAD} {...OUTLINE} />
          {hood ? <path d={HOOD} {...OUTLINE} /> : <path d={EAR} {...OUTLINE} strokeWidth={3} />}
        </g>
      </Part>
    );
  }
  return (
    <Part name="head">
      <g transform={HEAD_SCALE}>
      <path d={HEAD} className={SKIN} />
      <path d={MASK} className="fill-pug-mask" />
      <path d="M4 -46Q12 -50.5 18 -46.5M6 -41Q12 -44.5 17 -41.5" className="stroke-pug-mask" strokeWidth={2} fill="none" strokeLinecap="round" />
      {hood ? null : <path d={EAR} className="fill-pug-mask" />}
      <circle cx={21} cy={-31} r={6.4} className="fill-surface" />
      <circle cx={22.4} cy={-31} r={4.9} className="fill-ink" />
      <circle cx={23.9} cy={-32.8} r={1.5} className="fill-surface" />
      {/* Веко: опускается, когда тяжело. Прозрачность пишет кадр. */}
      <path
        data-part="lid"
        {...initial.get('lid')}
        d="M14.4 -30.6C15.4 -38.6 27.2 -38.6 27.8 -30.6C24 -33.2 18 -33.2 14.4 -30.6Z"
        className="fill-pug-mask"
      />
      <path d="M31 -27C35 -27 36 -22 33 -20C31 -19 29.5 -21 29.5 -23.5C29.5 -25.5 30 -27 31 -27Z" className="fill-ink" />
      <path d="M22 -5.5C22 -0.5 27 0.5 28.2 -4.2Z" style={TONGUE} />
      <path d="M16 -6C21 -3 27 -5 30 -10" className="stroke-ink" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      {hood ? <path d={HOOD} style={HOOD_FILL} /> : null}
      {hood ? <path d="M30 -37C29 -30 28 -24 27 -20" className="stroke-ink/40" strokeWidth={1.4} fill="none" /> : null}
      </g>
    </Part>
  );
}

function Torso({ hood, outline }: { hood: boolean; outline?: boolean }) {
  if (outline) {
    return (
      <Part name="torso">
        <g transform={TORSO_SCALE}>
          <path d={hood ? HOODIE : TORSO} {...OUTLINE} strokeWidth={4} />
          {hood ? null : <circle cx={-22} cy={-8} r={6} {...OUTLINE} strokeWidth={3} />}
        </g>
      </Part>
    );
  }
  if (hood) {
    return (
      <Part name="torso">
        <g transform={TORSO_SCALE}>
          <path d={HOODIE} style={HOOD_FILL} />
          <path d="M-10 -6C0 -3 10 -4 16 -8M18 -50C14 -42 12 -34 13 -26" className="stroke-ink/30" strokeWidth={1.4} fill="none" />
          <path d="M-15.6 9C-8 13 4 13 14 9" className="stroke-ink/40" strokeWidth={1.6} fill="none" />
        </g>
      </Part>
    );
  }
  return (
    <Part name="torso">
      <g transform={TORSO_SCALE}>
      {/* Хвост бубликом — за тазом, до шорт. */}
      <circle cx={-22} cy={-8} r={6} className={SKIN} />
      <path d="M-25 -8a3 3 0 1 0 3 -3" className="stroke-pug-mask" strokeWidth={1.4} fill="none" />
      <path d={TORSO} className={SKIN} />
      {/* Трапеция и грудь видны над майкой. */}
      <path d="M8 -70C14 -64 20 -60 26 -52M-12 -70C-16 -64 -20 -58 -21 -50" className="stroke-pug-mask/50" strokeWidth={1.4} fill="none" />
      <path d={TANK} className="fill-surface" />
      <path d={TANK} className="stroke-ink/25" strokeWidth={1.2} fill="none" />
      <path d="M22 -57C16 -66 4 -73.5 -9 -71.5" className="stroke-surface" strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d={SHORTS} className="fill-ink" />
      </g>
    </Part>
  );
}

function Plate({ weight }: { weight?: number }) {
  return (
    <Part name="load">
      <circle r={27} style={IRON} />
      <circle r={21} fill="none" className="stroke-surface/15" strokeWidth={1.5} />
      <circle r={6} className="fill-sunk" />
      <circle r={2.4} style={IRON} />
      {weight ? (
 <text y={-10.5} textAnchor="middle" className="fill-surface" style={{ font: '700 11px var(--font-sans), sans-serif' }}>
          {weight}
        </text>
      ) : null}
    </Part>
  );
}

function Dumbbell({ name }: { name: string }) {
  return (
    <Part name={name}>
      <circle r={10.5} style={IRON} />
      <circle r={3.2} className="fill-sunk" />
    </Part>
  );
}

function Props({ list, first, load }: { list: Prop[]; first: Solved; load: Load }) {
  const hip = first.pose.hip;
  const nodes: React.ReactNode[] = [];
  for (const prop of list) {
    if (prop === 'rack') {
      nodes.push(
        <g key="rack" style={FRAME}>
          <rect x={150} y={118} width={7} height={FLOOR - 118} />
          <rect x={146} y={146} width={18} height={6} rx={2} />
          <rect x={130} y={FLOOR - 4} width={46} height={6} rx={2} />
        </g>
      );
    }
    if (prop === 'bench') {
      nodes.push(
        <g key="bench">
          <rect x={128} y={252} width={7} height={FLOOR - 252} style={FRAME} />
          <rect x={232} y={252} width={7} height={FLOOR - 252} style={FRAME} />
          <rect x={112} y={FLOOR - 3} width={140} height={5} rx={2} style={FRAME} />
          <rect x={108} y={242} width={150} height={12} rx={5} style={PAD} />
        </g>
      );
    }
    if (prop === 'incline') {
      nodes.push(
        <g key="incline">
          <path d="M246 252L154 196" strokeWidth={13} strokeLinecap="round" style={{ stroke: PAD.fill }} />
          <rect x={230} y={246} width={30} height={10} rx={4} style={PAD} />
          <rect x={238} y={256} width={7} height={FLOOR - 256} style={FRAME} />
          <path d="M190 224L176 296" strokeWidth={6} style={{ stroke: FRAME.fill }} />
          <rect x={150} y={FLOOR - 3} width={110} height={5} rx={2} style={FRAME} />
        </g>
      );
    }
    if (prop === 'thrustBench') {
      nodes.push(
        <g key="thrust">
          <rect x={66} y={252} width={86} height={13} rx={5} style={PAD} />
          <rect x={76} y={265} width={7} height={FLOOR - 265} style={FRAME} />
          <rect x={136} y={265} width={7} height={FLOOR - 265} style={FRAME} />
        </g>
      );
    }
    if (prop === 'seat') {
      nodes.push(
        <g key="seat">
          <rect x={hip[0] - 30} y={hip[1] + 13} width={56} height={11} rx={4} style={PAD} />
          <rect x={hip[0] - 6} y={hip[1] + 24} width={8} height={FLOOR - hip[1] - 24} style={FRAME} />
          <rect x={hip[0] - 34} y={FLOOR - 3} width={70} height={5} rx={2} style={FRAME} />
          {load === 'roller' ? <rect x={hip[0] - 34} y={hip[1] - 70} width={11} height={80} rx={4} style={PAD} /> : null}
        </g>
      );
    }
    if (prop === 'press') {
      nodes.push(
        <g key="press">
          <path d="M100 236L178 270" strokeWidth={13} strokeLinecap="round" style={{ stroke: PAD.fill }} />
          <path d="M150 270L290 150" strokeWidth={5} style={{ stroke: FRAME.fill }} />
          <rect x={92} y={FLOOR - 3} width={200} height={5} rx={2} style={FRAME} />
          <path d="M150 272L160 296M270 170L284 296" strokeWidth={6} style={{ stroke: FRAME.fill }} />
        </g>
      );
    }
    if (prop === 'bar') {
      nodes.push(
        <g key="bar" style={FRAME}>
          <rect x={288} y={30} width={8} height={FLOOR - 30} />
          <rect x={206} y={38} width={90} height={7} rx={3} />
          <rect x={268} y={FLOOR - 3} width={48} height={5} rx={2} />
          <circle cx={212} cy={44} r={5} className="fill-ink" />
        </g>
      );
    }
    if (prop === 'dips') {
      nodes.push(
        <g key="dips" style={FRAME}>
          <rect x={202} y={206} width={8} height={FLOOR - 206} />
          <rect x={182} y={FLOOR - 3} width={48} height={5} rx={2} />
          <circle cx={206} cy={206} r={5.5} className="fill-ink" />
        </g>
      );
    }
    if (prop === 'step') nodes.push(<rect key="step" x={176} y={FLOOR - 12} width={66} height={14} rx={3} style={PAD} />);
    if (prop === 'mat') nodes.push(<rect key="mat" x={60} y={FLOOR - 1} width={260} height={5} rx={2} style={PAD} />);
  }
  if (load === 'handle' && first.pose.pulley) {
    const [x, y] = first.pose.pulley;
    nodes.push(
      <g key="pulley">
        <rect x={x - 3} y={y < 100 ? 0 : y - 4} width={6} height={y < 100 ? y : FLOOR - y + 4} style={FRAME} />
        <circle cx={x} cy={y} r={7} className="fill-ink" />
        <circle cx={x} cy={y} r={2.4} className="fill-sunk" />
      </g>
    );
  }
  return <>{nodes}</>;
}

export function PugRig({
  motion,
  gear = null,
  plate,
  still: forcedStill = false,
  className = '',
  title,
  speed = 1
}: {
  motion: Motion | 'rest';
  gear?: Gear | null;
  /** Подпись на блине: 200 на жиме в подвале. */
  plate?: number;
  still?: boolean;
  className?: string;
  /** Подпись для скринридера: что делает мопс. */
  title: string;
  speed?: number;
}) {
  const svg = useRef<SVGSVGElement | null>(null);
  const reduce = useReducedMotion();
  const still = forcedStill || Boolean(reduce);
  const def = MOTIONS[motion];
  const load = loadOf(motion, gear);
  const hood = def.props.includes('hood');
  const restP = def.tempo === 'hold' ? 0.5 : 0.55;

  const first = useMemo(() => solve(def.pose(0)), [def]);
  // Первый кадр — при рендере: сервер отдаёт мопса уже в позе.
  const initial = useMemo(() => frameOf(solve(def.pose(restP)), load), [def, load, restP]);

  useLayoutEffect(() => {
    const root = svg.current;
    if (!root) return;
    const parts = new Map<string, Element[]>();
    root.querySelectorAll('[data-part]').forEach((el) => {
      const key = el.getAttribute('data-part') as string;
      parts.set(key, [...(parts.get(key) ?? []), el]);
    });
    const draw = (p: number) => {
      for (const [part, attrs] of frameOf(solve(def.pose(p)), load)) {
        const els = parts.get(part);
        if (!els) continue;
        for (const el of els) for (const [attr, value] of Object.entries(attrs)) el.setAttribute(attr, value);
      }
    };
    if (still) {
      draw(restP);
      return;
    }

    let raf = 0;
    let started = 0;
    let shown = true;
    const frame = (now: number) => {
      raf = 0;
      if (!shown) return;
      if (!started) started = now;
      draw(phaseOf(((now - started) / 1000) * speed, def.tempo));
      raf = requestAnimationFrame(frame);
    };
    const watch = new IntersectionObserver(([entry]) => {
      shown = entry.isIntersecting;
      if (shown && !raf) raf = requestAnimationFrame(frame);
    });
    watch.observe(root);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      watch.disconnect();
    };
  }, [def, load, still, speed, restP]);

  const cableFrom = first.pose.pulley;

  return (
    <Initial.Provider value={initial}>
      <svg ref={svg} viewBox="40 0 320 300" role="img" aria-label={title} className={className}>
        <Props list={def.props} first={first} load={load} />

        {/* Дальняя нога и дальняя рука: темнее, за телом. */}
        <LimbOutline name="thigh2" d={THIGH} />
        <LimbOutline name="shin2" d={SHIN} />
        <Part name="thigh2">
          <path d={THIGH} style={FAR_SKIN} />
          <path d={SHORTS_LEG} className="fill-ink" />
        </Part>
        <LimbFill name="shin2" d={SHIN} far />
        <Foot name="foot2" far />

        <LimbOutline name="upper2" d={UPPER} delt />
        <LimbOutline name="fore2" d={FORE} paw />
        <LimbFill name="upper2" d={UPPER} far sleeve={hood} delt />
        <LimbFill name="fore2" d={FORE} far paw />
        {load === 'dumbbell' ? <Dumbbell name="load2" /> : null}

        {/* Тело, блин, голова. Блин — перед корпусом, но под головой: ближний
            блин на самом деле закрывает и лицо, но мопс тут ради лица, а не
            ради честной перспективы. Голова поверх шеи с обводкой — как щёки
            мопса, которые лежат на груди. */}
        <Torso hood={hood} outline />
        <Torso hood={hood} />
        {load === 'plate' ? <Plate weight={plate} /> : null}
        <Head hood={hood} outline />
        <Head hood={hood} />

        {load === 'handle' && cableFrom ? (
          <line
            data-part="cable"
            x1={cableFrom[0]}
            y1={cableFrom[1]}
            {...initial.get('cable')}
            className="stroke-ink/70"
            strokeWidth={1.6}
          />
        ) : null}

        {/* Ближняя нога. */}
        <LimbOutline name="thigh" d={THIGH} />
        <LimbOutline name="shin" d={SHIN} />
        <Part name="thigh">
          <path d={THIGH} className={SKIN} />
          <path d={SHORTS_LEG} className="fill-ink" />
        </Part>
        <LimbFill name="shin" d={SHIN} />
        <Foot name="foot" />

        {load === 'roller' ? (
          <Part name="pad">
            <circle r={8} style={PAD} />
            <circle r={2.5} className="fill-sunk" />
          </Part>
        ) : null}
        {load === 'platform' ? (
          <Part name="pad">
            <rect x={-5} y={-22} width={9} height={44} rx={3} style={FRAME} />
          </Part>
        ) : null}

        {/* Ближняя рука — последней: она поверх всего, и блина тоже. */}
        <LimbOutline name="upper" d={UPPER} delt />
        <LimbOutline name="fore" d={FORE} paw />
        <Part name="upper">
          <circle cx={2} cy={0} r={15} className={hood ? undefined : SKIN} style={hood ? HOOD_FILL : undefined} />
          <path d={UPPER} className={hood ? undefined : SKIN} style={hood ? HOOD_FILL : undefined} />
          {hood ? null : <path d="M12 -9C19 -12.5 27 -11.5 33 -7.5" className="stroke-pug-mask/40" strokeWidth={1.3} fill="none" />}
        </Part>
        <Part name="fore">
          <path d={FORE} className={SKIN} />
          <circle cx={40.5} cy={0} r={8.6} className={SKIN} />
          {hood ? (
            <g>
              <rect x={34} y={-12} width={9} height={16} rx={2} className="fill-ink" />
              <rect x={35.5} y={-10.5} width={6} height={12} rx={1} className="fill-halo" />
            </g>
          ) : null}
        </Part>
        {load === 'dumbbell' ? <Dumbbell name="load" /> : null}
        {load === 'handle' ? (
          <Part name="load">
            <rect x={-3} y={-9} width={6} height={18} rx={3} className="fill-ink" />
          </Part>
        ) : null}
      </svg>
    </Initial.Provider>
  );
}
