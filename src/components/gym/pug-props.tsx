'use client';

import type { Gear } from '@/lib/gym/exercises';
import { BACK, GROUND, type P, type Prop } from './pug-motions';
import { CX, type Solved, type Widths } from './pug-geometry';
import { C } from './pug-parts';

/**
 * Снаряды и тренажёры вокруг мопса — сбоку и спереди. Стоят на месте, их
 * положение считается по первой позе движения: скамья ложится под спину,
 * стойка встаёт у головы, ящик — под стопу.
 */

const frontOf = (t: number): P => [Math.cos(t), Math.sin(t)];
const dirOf = (t: number): P => [Math.sin(t), -Math.cos(t)];
const off = (p: P, v: P, k: number): P => [p[0] + v[0] * k, p[1] + v[1] * k];

const fr = { fill: C.frame };
const pad = { fill: C.pad };

/** Подушка вдоль линии: спинка, наклонная скамья, станина. */
function Beam({ a, b, w, color = C.pad }: { a: P; b: P; w: number; color?: string }) {
  return (
    <>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={C.ink} strokeWidth={w + 2.4} strokeLinecap="round" />
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={w} strokeLinecap="round" />
    </>
  );
}

function Post({ x, from, w = 6 }: { x: number; from: number; w?: number }) {
  return <rect x={x - w / 2} y={from} width={w} height={GROUND - from} {...fr} />;
}

function Base({ x0, x1 }: { x0: number; x1: number }) {
  return <rect x={x0} y={GROUND - 4} width={x1 - x0} height={5} rx={2} {...fr} />;
}

/** Лёжа ли мопс в первой позе: тогда скамья под спиной, а не под тазом. */
const lying = (first: Solved) => Math.abs(Math.cos(first.pose.torso)) < 0.5;
/** Верх скамьи: лёжа на спине — под лопатками, лицом вниз — под животом, сидя — под тазом. */
const benchTop = (first: Solved) => {
  const { pose, neck } = first;
  if (!lying(first)) return pose.hip[1] + 13;
  const low = Math.max(pose.hip[1], neck[1]);
  return Math.sin(pose.torso) > 0 ? low + 24 : low + BACK + 3;
};

/**
 * `front` — то, что ближе мопса: ближняя жердь брусьев. Без неё сбоку кажется,
 * что мопс сидит на брусьях, а не висит между ними.
 */
export function SideProps({ list, first, gear, layer = 'back' }: { list: Prop[]; first: Solved; gear: Gear | null; layer?: 'back' | 'front' }) {
  const { pose, neck, shoulder } = first;
  if (layer === 'front') {
    if (!list.includes('dips')) return null;
    const y = pose.hand[1] + 2;
    return (
      <g>
        <rect x={140} y={y - 3} width={136} height={7} rx={3} {...fr} stroke={C.ink} strokeWidth={1} />
        <Post x={150} from={y} w={7} />
      </g>
    );
  }
  const hip = pose.hip;
  const t = pose.torso;
  const back: P = [-frontOf(t)[0], -frontOf(t)[1]];
  const nodes: React.ReactNode[] = [];
  for (const prop of list) {
    if (prop === 'bench' || prop === 'longBench') {
      const top = benchTop(first);
      const x0 = Math.min(neck[0], hip[0]) - 28;
      const x1 = Math.max(neck[0], hip[0]) + 34;
      nodes.push(
        <g key={prop}>
          <Post x={x0 + 16} from={top + 10} />
          <Post x={x1 - 16} from={top + 10} />
          <Base x0={x0} x1={x1} />
          <rect x={x0} y={top} width={x1 - x0} height={12} rx={5} {...pad} stroke={C.ink} strokeWidth={1.2} />
        </g>
      );
    }
    if (prop === 'incline' || prop === 'decline' || prop === 'hackSled' || prop === 'backrest' || prop === 'press') {
      const a = off(hip, back, BACK + 6);
      const b = off(off(neck, dirOf(t), prop === 'backrest' ? -6 : 14), back, BACK + 6);
      nodes.push(
        <g key={prop}>
          <Post x={(a[0] + b[0]) / 2} from={Math.max(a[1], b[1])} />
          <Base x0={Math.min(a[0], b[0]) - 20} x1={Math.max(a[0], b[0]) + 30} />
          <Beam a={a} b={b} w={12} />
          {prop === 'incline' || prop === 'decline' || prop === 'press' ? <rect x={hip[0] - 16} y={hip[1] + 12} width={34} height={10} rx={4} {...pad} stroke={C.ink} strokeWidth={1.2} /> : null}
          {prop === 'decline' ? <circle cx={pose.foot[0] - 2} cy={pose.foot[1] - 14} r={7} {...pad} stroke={C.ink} strokeWidth={1.2} /> : null}
          {prop === 'hackSled' ? <circle cx={shoulder[0] - 2} cy={shoulder[1] - 10} r={8} {...pad} stroke={C.ink} strokeWidth={1.2} /> : null}
          {prop === 'hackSled' || prop === 'press' ? <Beam a={[pose.foot[0] + 14, pose.foot[1] + 16]} b={[pose.foot[0] - 4, pose.foot[1] - 30]} w={6} color={C.frame} /> : null}
        </g>
      );
    }
    if (prop === 'rack') {
      const x = Math.min(neck[0], shoulder[0]) - 10;
      const hook = Math.min(pose.hand[1], first.arm.end[1]) - 2;
      nodes.push(
        <g key="rack">
          <Post x={x} from={Math.min(96, hook - 30)} w={8} />
          <rect x={x - 3} y={hook} width={18} height={6} rx={2} {...fr} />
          <Base x0={x - 26} x1={x + 26} />
        </g>
      );
    }
    if (prop === 'seat' || prop === 'sideBench') {
      const w = prop === 'sideBench' ? 38 : 56;
      nodes.push(
        <g key={prop}>
          <Post x={hip[0] - 2} from={hip[1] + 22} w={8} />
          <Base x0={hip[0] - 34} x1={hip[0] + 32} />
          <rect x={hip[0] - w / 2 - 2} y={hip[1] + 12} width={w} height={11} rx={4} {...pad} stroke={C.ink} strokeWidth={1.2} />
        </g>
      );
    }
    if (prop === 'bar' || prop === 'barLow') {
      const y = prop === 'bar' ? 44 : 96;
      nodes.push(
        <g key={prop}>
          <Post x={300} from={y - 6} w={8} />
          <rect x={200} y={y - 4} width={104} height={7} rx={3} {...fr} />
          <circle cx={pose.hand[0]} cy={y} r={5} fill={C.ink} />
          <Base x0={276} x1={324} />
        </g>
      );
    }
    if (prop === 'lowBar') {
      nodes.push(
        <g key="lowBar">
          <Post x={140} from={170} w={8} />
          <Base x0={116} x1={164} />
          <circle cx={pose.hand[0]} cy={pose.hand[1]} r={5} fill={C.ink} />
        </g>
      );
    }
    if (prop === 'dips') {
      const y = pose.hand[1] + 2;
      nodes.push(
        <g key="dips">
          <Post x={160} from={y} w={7} />
          <Post x={262} from={y} w={7} />
          <rect x={146} y={y - 3} width={130} height={7} rx={3} {...fr} />
          <Base x0={140} x1={282} />
        </g>
      );
    }
    if (prop === 'step') nodes.push(<rect key="step" x={176} y={GROUND - 16} width={66} height={16} rx={3} {...pad} />);
    if (prop === 'box') nodes.push(<rect key="box" x={232} y={250} width={70} height={GROUND - 250} rx={3} fill={C.frame} stroke={C.ink} strokeWidth={1.4} />);
    if (prop === 'rearBench') {
      nodes.push(
        <g key="rearBench">
          <Post x={150} from={262} />
          <Base x0={110} x1={190} />
          <rect x={106} y={252} width={86} height={11} rx={4} {...pad} stroke={C.ink} strokeWidth={1.2} />
        </g>
      );
    }
    if (prop === 'mat') nodes.push(<rect key="mat" x={56} y={GROUND - 3} width={290} height={4} rx={2} {...pad} />);
    if (prop === 'thrustBench') {
      const top = shoulder[1] + 6;
      nodes.push(
        <g key="thrust">
          <Post x={84} from={top + 10} />
          <Post x={134} from={top + 10} />
          <rect x={60} y={top} width={shoulder[0] - 54} height={13} rx={5} {...pad} stroke={C.ink} strokeWidth={1.2} />
        </g>
      );
    }
    if (prop === 'crossover') {
      const x = (pose.pulley ?? [150, 30])[0];
      nodes.push(
        <g key="crossover">
          <rect x={x - 12} y={18} width={9} height={GROUND - 18} {...fr} />
          <rect x={x - 22} y={14} width={30} height={7} rx={2} {...fr} />
          <Base x0={x - 40} x1={x + 20} />
        </g>
      );
    }
    if (prop === 'preacherPad') {
      nodes.push(<Beam key="preacher" a={[shoulder[0] + 12, shoulder[1] + 8]} b={[shoulder[0] + 40, shoulder[1] + 44]} w={10} />);
      nodes.push(<Post key="preacherPost" x={shoulder[0] + 44} from={shoulder[1] + 44} w={6} />);
    }
    if (prop === 'hyper') {
      nodes.push(
        <g key="hyper">
          <Beam a={[hip[0] - 4, hip[1] + 20]} b={[hip[0] + 16, hip[1] + 4]} w={12} />
          <circle cx={pose.foot[0] + 4} cy={pose.foot[1] - 12} r={7} {...pad} stroke={C.ink} strokeWidth={1.2} />
          <Beam a={[pose.foot[0] - 6, GROUND - 2]} b={[hip[0] + 12, hip[1] + 18]} w={6} color={C.frame} />
          <Base x0={pose.foot[0] - 24} x1={hip[0] + 30} />
        </g>
      );
    }
    if (prop === 'bike') {
      nodes.push(
        <g key="bike">
          <Beam a={[hip[0] - 2, hip[1] + 14]} b={[224, 266]} w={6} color={C.frame} />
          <Beam a={[224, 266]} b={[270, 196]} w={6} color={C.frame} />
          <Beam a={[262, 196]} b={[278, 192]} w={6} color={C.frame} />
          <circle cx={262} cy={262} r={22} fill="none" stroke={C.frame} strokeWidth={5} />
          <circle cx={224} cy={266} r={17} fill="none" stroke={C.ink} strokeOpacity={0.4} strokeWidth={1.4} />
          <rect x={hip[0] - 18} y={hip[1] + 8} width={30} height={8} rx={4} {...pad} />
          <Base x0={170} x1={300} />
        </g>
      );
    }
    if (prop === 'rower') {
      nodes.push(
        <g key="rower">
          <rect x={80} y={276} width={220} height={6} rx={3} {...fr} />
          <rect x={286} y={234} width={40} height={54} rx={10} fill={C.frame} stroke={C.ink} strokeWidth={1.2} />
          <rect x={236} y={258} width={8} height={26} rx={2} {...pad} />
          <Base x0={76} x1={330} />
        </g>
      );
    }
    if (prop === 'treadmill') {
      nodes.push(
        <g key="treadmill">
          <Beam a={[296, GROUND - 4]} b={[310, 150]} w={6} color={C.frame} />
          <rect x={294} y={140} width={30} height={14} rx={3} fill={C.frame} stroke={C.ink} strokeWidth={1.2} />
          <rect x={108} y={GROUND - 9} width={200} height={10} rx={4} fill={C.pad} stroke={C.ink} strokeWidth={1.2} />
        </g>
      );
    }
    if (prop === 'elliptical') {
      nodes.push(
        <g key="elliptical">
          <rect x={150} y={GROUND - 7} width={150} height={7} rx={3} {...fr} />
          <Beam a={[292, GROUND - 4]} b={[296, 150]} w={6} color={C.frame} />
          <rect x={286} y={140} width={26} height={12} rx={3} fill={C.frame} />
          <circle cx={282} cy={GROUND - 22} r={18} fill="none" stroke={C.frame} strokeWidth={4} />
        </g>
      );
    }
    if (prop === 'water') {
      nodes.push(
        <g key="water">
          <rect x={40} y={236} width={320} height={64} fill={C.sweat} fillOpacity={0.4} />
          <path d="M40 236Q60 230 80 236T120 236T160 236T200 236T240 236T280 236T320 236T360 236" stroke={C.sweat} strokeWidth={3} fill="none" />
        </g>
      );
    }
    if (prop === 'wall') {
      const x = hip[0] + BACK + 6;
      nodes.push(<rect key="wall" x={x} y={0} width={60} height={GROUND} fill={C.frame} fillOpacity={0.35} />);
    }
    if (prop === 'anchor') {
      nodes.push(
        <g key="anchor">
          <Post x={332} from={252} w={10} />
          <circle cx={330} cy={272} r={4} fill="none" stroke={C.ink} strokeWidth={2} />
        </g>
      );
    }
  }
  if (gear === 'smith') {
    const x = (pose.load ?? first.arm.end)[0];
    nodes.push(
      <g key="smith" opacity={0.85}>
        <rect x={x + 30} y={30} width={6} height={GROUND - 30} {...fr} />
        <rect x={x + 18} y={26} width={30} height={6} rx={2} {...fr} />
      </g>
    );
  }
  if (pose.pulley && !list.includes('crossover')) {
    const [x, y] = pose.pulley;
    nodes.push(
      <g key="pulley">
        <rect x={x - 3} y={y < 120 ? 0 : y - 4} width={6} height={y < 120 ? y : GROUND - y + 4} {...fr} />
        <circle cx={x} cy={y} r={7} fill={C.ink} />
        <circle cx={x} cy={y} r={2.4} fill={C.chrome} />
      </g>
    );
  }
  return <>{nodes}</>;
}

export function FrontProps({ list, first, z, gear }: { list: Prop[]; first: Solved; z: Widths; gear: Gear | null }) {
  const { pose, neck, shoulder } = first;
  const hip = pose.hip;
  const nodes: React.ReactNode[] = [];
  const padRect = (key: string, x: number, y: number, w: number, h: number) => (
    <rect key={key} x={x} y={y} width={w} height={h} rx={4} {...pad} stroke={C.ink} strokeWidth={1.2} />
  );
  for (const prop of list) {
    if (prop === 'bench' || prop === 'longBench' || prop === 'incline' || prop === 'decline' || prop === 'rearBench') {
      const top = prop === 'rearBench' ? 252 : benchTop(first);
      nodes.push(
        <g key={prop}>
          <Post x={CX} from={top + 10} w={8} />
          <Base x0={CX - 40} x1={CX + 40} />
          {padRect(`${prop}p`, CX - 18, top, 36, 12)}
          {prop === 'incline' || prop === 'decline' ? padRect(`${prop}b`, CX - 20, Math.min(neck[1], hip[1]) - 18, 40, Math.abs(neck[1] - hip[1]) + 26) : null}
        </g>
      );
    }
    if (prop === 'rack') {
      const hook = Math.min(pose.hand[1], first.arm.end[1]) - 2;
      const x = Math.max(z.hand + 22, 66);
      for (const s of [-1, 1]) {
        nodes.push(
          <g key={`rack${s}`}>
            <Post x={CX + s * x} from={Math.min(96, hook - 30)} w={8} />
            <rect x={CX + s * x - (s > 0 ? 14 : 4)} y={hook} width={18} height={6} rx={2} {...fr} />
            <Base x0={CX + s * x - 18} x1={CX + s * x + 18} />
          </g>
        );
      }
    }
    if (prop === 'seat' || prop === 'press' || prop === 'hackSled') {
      nodes.push(
        <g key={`${prop}s`}>
          <Post x={CX} from={hip[1] + 22} w={8} />
          <Base x0={CX - 44} x1={CX + 44} />
          {padRect(`${prop}sp`, CX - 28, hip[1] + 12, 56, 11)}
        </g>
      );
    }
    if (prop === 'backrest' || prop === 'press' || prop === 'hackSled') {
      nodes.push(padRect(`${prop}b`, CX - 23, Math.min(shoulder[1], hip[1]) - 12, 46, Math.abs(hip[1] - shoulder[1]) + 20));
      if (prop === 'hackSled') {
        nodes.push(<rect key="hs1" x={CX - 60} y={40} width={6} height={GROUND - 40} {...fr} />);
        nodes.push(<rect key="hs2" x={CX + 54} y={40} width={6} height={GROUND - 40} {...fr} />);
      }
    }
    if (prop === 'sideBench') {
      const top = hip[1] + 12;
      nodes.push(
        <g key="sideBench">
          <Post x={CX - 76} from={top + 10} w={7} />
          <Post x={CX + 76} from={top + 10} w={7} />
          <Base x0={CX - 100} x1={CX + 100} />
          {padRect('sbp', CX - 98, top, 196, 12)}
        </g>
      );
    }
    if (prop === 'bar' || prop === 'barLow' || prop === 'lowBar') {
      const y = prop === 'bar' ? 44 : prop === 'barLow' ? 96 : pose.hand[1];
      nodes.push(
        <g key={prop}>
          <rect x={CX - 124} y={y - 3.5} width={248} height={7} rx={3.5} {...fr} />
          <Post x={CX - 124} from={y - 4} w={8} />
          <Post x={CX + 124} from={y - 4} w={8} />
        </g>
      );
    }
    if (prop === 'dips') {
      const y = pose.hand[1] + 2;
      for (const s of [-1, 1]) {
        nodes.push(
          <g key={`dip${s}`}>
            <Post x={CX + s * (z.hand + 2)} from={y + 3} w={6} />
            <rect x={CX + s * (z.hand + 2) - 6} y={y - 4} width={12} height={8} rx={3} {...fr} />
          </g>
        );
      }
      nodes.push(<Base key="dipBase" x0={CX - z.hand - 20} x1={CX + z.hand + 20} />);
    }
    if (prop === 'step') nodes.push(padRect('step', CX - 36, GROUND - 16, 72, 16));
    if (prop === 'box') nodes.push(<rect key="box" x={CX - 46} y={250} width={92} height={GROUND - 250} rx={3} fill={C.frame} stroke={C.ink} strokeWidth={1.4} />);
    if (prop === 'mat') nodes.push(<rect key="mat" x={CX - 100} y={GROUND - 3} width={200} height={4} rx={2} {...pad} />);
    if (prop === 'thrustBench') nodes.push(padRect('thrust', CX - 84, shoulder[1] + 6, 168, 13));
    if (prop === 'crossover') {
      for (const s of [-1, 1]) {
        nodes.push(
          <g key={`co${s}`}>
            <rect x={CX + s * 150 - 4} y={18} width={9} height={GROUND - 18} {...fr} />
            <circle cx={CX + s * (150 - 8)} cy={(pose.pulley ?? [0, 30])[1]} r={6} fill={C.ink} />
          </g>
        );
      }
    }
    if (prop === 'preacherPad') nodes.push(padRect('preacher', CX - 32, shoulder[1] + 14, 64, 26));
    if (prop === 'hyper') {
      nodes.push(padRect('hyperPad', CX - 26, hip[1] + 6, 52, 14));
      nodes.push(<Base key="hyperBase" x0={CX - 40} x1={CX + 40} />);
    }
    if (prop === 'bike') {
      nodes.push(
        <g key="bike">
          <rect x={CX - 34} y={196} width={68} height={6} rx={3} {...fr} />
          <Post x={CX} from={198} w={7} />
          {padRect('bikeSeat', CX - 16, hip[1] + 8, 32, 8)}
          <rect x={CX - 5} y={240} width={10} height={46} rx={5} fill={C.frame} />
          <Base x0={CX - 50} x1={CX + 50} />
        </g>
      );
    }
    if (prop === 'rower') nodes.push(<rect key="rower" x={CX - 12} y={276} width={24} height={8} rx={2} {...fr} />);
    if (prop === 'treadmill') {
      nodes.push(
        <g key="treadmill">
          <rect x={CX - 52} y={GROUND - 9} width={104} height={10} rx={4} {...pad} stroke={C.ink} strokeWidth={1.2} />
          <rect x={CX - 60} y={204} width={6} height={GROUND - 210} {...fr} />
          <rect x={CX + 54} y={204} width={6} height={GROUND - 210} {...fr} />
        </g>
      );
    }
    if (prop === 'elliptical') {
      nodes.push(
        <g key="elliptical">
          <rect x={CX - 38} y={150} width={6} height={GROUND - 150} {...fr} />
          <rect x={CX + 32} y={150} width={6} height={GROUND - 150} {...fr} />
          <rect x={CX - 26} y={GROUND - 8} width={52} height={8} rx={3} {...fr} />
        </g>
      );
    }
    if (prop === 'water') {
      nodes.push(
        <g key="water">
          <rect x={40} y={236} width={320} height={64} fill={C.sweat} fillOpacity={0.4} />
          <path d="M40 236Q60 230 80 236T120 236T160 236T200 236T240 236T280 236T320 236T360 236" stroke={C.sweat} strokeWidth={3} fill="none" />
        </g>
      );
    }
    if (prop === 'wall') nodes.push(<rect key="wall" x={40} y={0} width={320} height={GROUND} fill={C.frame} fillOpacity={0.18} />);
  }
  if (gear === 'smith') {
    nodes.push(
      <g key="smith" opacity={0.85}>
        <rect x={CX - 112} y={30} width={6} height={GROUND - 30} {...fr} />
        <rect x={CX + 106} y={30} width={6} height={GROUND - 30} {...fr} />
        <rect x={CX - 114} y={26} width={228} height={6} rx={2} {...fr} />
      </g>
    );
  }
  if (pose.pulley && !list.includes('crossover')) {
    const x = CX + z.pulley;
    const y = pose.pulley[1];
    nodes.push(
      <g key="pulley">
        <rect x={x - 3} y={y < 120 ? 0 : y - 4} width={6} height={y < 120 ? y : GROUND - y + 4} {...fr} />
        <circle cx={x} cy={y} r={7} fill={C.ink} />
      </g>
    );
  }
  return <>{nodes}</>;
}
