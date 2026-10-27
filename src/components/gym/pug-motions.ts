import type { Gear, Motion } from '@/lib/gym/exercises';

/**
 * Как двигается мопс: позы упражнений для `PugRig`.
 *
 * Каждое движение — функция от глубины повтора `p` ∈ [0, 1]: 0 — исходное
 * положение, 1 — нижняя (или пиковая) точка. Поза задаёт не углы суставов, а
 * то, что видит тренер: где таз, куда наклонён корпус, где гриф и где стопы.
 * Локти и колени решает двузвенная обратная кинематика (`solve` в `PugRig`):
 * гриф в жиме идёт по прямой, стопы в приседе стоят на месте — техника
 * получается правильной сама, а не подгоняется кадрами.
 *
 * Мир — 400 × 300, пол на `FLOOR`, мопс смотрит вправо. Длины сегментов — в
 * `BODY`; позы считаются от них, поэтому менять длины — значит пересмотреть позы.
 */

export type P = [number, number];

export const FLOOR = 296;
export const BODY = { torso: 70, upper: 40, fore: 38, thigh: 46, shin: 44 } as const;
/** Плечо — не верх корпуса, а чуть ниже шеи. */
export const SHOULDER_AT = 0.84;

export type Pose = {
  hip: P;
  /** Корпус: 0 — вертикально вверх, плюс — наклон вперёд (вправо), радианы. */
  torso: number;
  /** Голова относительно корпуса. */
  head?: number;
  /** Плечи вверх вдоль корпуса (шраги, вдох). */
  shrug?: number;
  hand: P;
  hand2?: P;
  /** С какой стороны линии плечо—кисть локоть: знак поворота в решении. */
  elbow: 1 | -1;
  foot: P;
  foot2?: P;
  knee: 1 | -1;
  /** Поворот стопы: 0 — на полу, плюс — носок вниз (на носках, в висе). */
  toe?: number;
  /** Центр груза, если он не в кисти: штанга на спине, гриф на тазу. */
  load?: P;
  /** Откуда идёт трос — у блоков. */
  pulley?: P;
  /** Подвижная часть тренажёра: валик, платформа. */
  pad?: P;
  /** Насколько тяжело прямо сейчас: щурится и потеет. */
  effort?: number;
};

export type Prop = 'bench' | 'incline' | 'rack' | 'seat' | 'press' | 'bar' | 'dips' | 'step' | 'mat' | 'thrustBench' | 'hood';
export type Load = 'plate' | 'dumbbell' | 'handle' | 'roller' | 'platform' | 'none';

export type MotionDef = {
  pose: (p: number) => Pose;
  props: Prop[];
  /** Чем нагружен по умолчанию, если снаряд упражнения не сказал иначе. */
  load: Load;
  /** `rep` — повторы; `hold` — статика с дыханием. */
  tempo: 'rep' | 'hold';
  /** Подпись на блине, если это витрина подвала. */
  plate?: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: P, b: P, t: number): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const dirOf = (torso: number): P => [Math.sin(torso), -Math.cos(torso)];
/** Где окажется плечо при такой позе таза и корпуса. */
export const shoulderOf = (hip: P, torso: number, shrug = 0): P => {
  const d = dirOf(torso);
  const k = BODY.torso * SHOULDER_AT + shrug;
  return [hip[0] + d[0] * k, hip[1] + d[1] * k];
};
const add = (a: P, x: number, y: number): P => [a[0] + x, a[1] + y];
const arc = (centre: P, r: number, angle: number): P => [centre[0] + r * Math.sin(angle), centre[1] + r * Math.cos(angle)];
const ARM = BODY.upper + BODY.fore;

/** Стоя: таз над серединой стопы. */
const STAND: P = [206, FLOOR - 89];
const FOOT: P = [212, FLOOR];

export const MOTIONS: Record<Motion | 'rest', MotionDef> = {
  bench: {
    props: ['rack', 'bench'],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [226, 228];
      const torso = -Math.PI / 2 + 0.05;
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: 0.1,
        hand: mix([s[0] + 4, s[1] - ARM + 2], [s[0] + 16, s[1] - 22], p),
        elbow: 1,
        foot: [266, FLOOR],
        knee: -1,
        effort: p
      };
    }
  },
  incline: {
    props: ['rack', 'incline'],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [234, 232];
      const torso = -1.02;
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: 0.15,
        hand: mix([s[0] + 6, s[1] - ARM + 2], [s[0] + 14, s[1] - 18], p),
        elbow: 1,
        foot: [272, FLOOR],
        knee: -1,
        effort: p
      };
    }
  },
  pushup: {
    props: ['mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const feet: P = [96, FLOOR - 2];
      const angle = lerp(1.06, 1.36, p);
      const d = dirOf(angle);
      const hip: P = [feet[0] + d[0] * 90, feet[1] + d[1] * 90];
      return { hip, torso: angle, head: -0.25, hand: [232, FLOOR], elbow: 1, foot: feet, knee: 1, toe: 1.5, effort: p };
    }
  },
  dip: {
    props: ['dips'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const torso = lerp(0.12, 0.38, p);
      const s: P = mix([203, 128], [214, 162], p);
      const d = dirOf(torso);
      const hip: P = [s[0] - d[0] * BODY.torso * SHOULDER_AT, s[1] - d[1] * BODY.torso * SHOULDER_AT];
      return { hip, torso, head: -0.1, hand: [206, 204], elbow: 1, foot: add(hip, -36, 52), knee: 1, toe: 0.6, effort: p };
    }
  },
  ohp: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      // Здесь глубина наоборот: 0 — гриф на груди, 1 — над головой.
      const s = shoulderOf(STAND, 0.02);
      return {
        hip: STAND,
        torso: 0.02,
        head: lerp(-0.18, 0.05, p),
        hand: mix([s[0] + 13, s[1] + 2], [s[0] + 3, s[1] - ARM + 3], p),
        elbow: -1,
        foot: FOOT,
        knee: -1,
        effort: p
      };
    }
  },
  raise: {
    props: [],
    load: 'dumbbell',
    tempo: 'rep',
    pose: (p) => {
      const s = shoulderOf(STAND, 0.04);
      return {
        hip: STAND,
        torso: 0.04,
        hand: arc(s, ARM - 4, lerp(0.08, Math.PI / 2 - 0.05, p)),
        elbow: -1,
        foot: FOOT,
        knee: -1,
        effort: p
      };
    }
  },
  squat: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const hip = mix([208, FLOOR - 89], [182, 256], p);
      const torso = lerp(0.1, 0.66, p);
      const s = shoulderOf(hip, torso);
      // Гриф лежит на трапециях: позади плеча и чуть выше. Кисть — на грифе,
      // локоть уходит назад и вниз.
      const back = dirOf(torso - Math.PI / 2);
      const up = dirOf(torso);
      const bar: P = [s[0] + back[0] * 13 + up[0] * 7, s[1] + back[1] * 13 + up[1] * 7];
      return { hip, torso, head: -torso * 0.6, hand: bar, elbow: -1, foot: [214, FLOOR], knee: -1, load: bar, effort: p };
    }
  },
  frontSquat: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const hip = mix([210, FLOOR - 89], [190, 258], p);
      const torso = lerp(0.03, 0.36, p);
      const s = shoulderOf(hip, torso);
      // Гриф на передних дельтах, кисти под ним, локти высоко и вперёд.
      const front = dirOf(torso + Math.PI / 2);
      const down = dirOf(torso + Math.PI);
      const bar: P = [s[0] + front[0] * 13 + down[0] * 7, s[1] + front[1] * 13 + down[1] * 7];
      return { hip, torso, head: -torso * 0.5, hand: add(bar, -front[0], -front[1]), elbow: -1, foot: [216, FLOOR], knee: -1, load: bar, effort: p };
    }
  },
  legPress: {
    props: ['press'],
    load: 'platform',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [150, 250];
      const foot = mix([246, 182], [204, 210], p);
      return { hip, torso: -0.95, head: 0.45, hand: [164, 262], elbow: 1, foot, knee: 1, toe: -0.9, pad: add(foot, 10, -4), effort: p };
    }
  },
  lunge: {
    props: [],
    load: 'dumbbell',
    tempo: 'rep',
    pose: (p) => {
      const hip = mix([200, FLOOR - 86], [196, 252], p);
      const s = shoulderOf(hip, 0.04);
      return {
        hip,
        torso: 0.04,
        hand: add(s, 4, ARM - 4),
        elbow: 1,
        foot: [248, FLOOR],
        foot2: [148, FLOOR - 4],
        knee: -1,
        toe: 0,
        effort: p
      };
    }
  },
  legExt: {
    props: ['seat'],
    load: 'roller',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [186, 238];
      const knee: P = [hip[0] + BODY.thigh, hip[1]];
      const foot = arc(knee, BODY.shin - 0.5, lerp(0.15, Math.PI / 2 - 0.08, p));
      return { hip, torso: -0.12, head: 0.1, hand: [196, 252], elbow: 1, foot, knee: 1, toe: -0.2, pad: add(foot, 2, -9), effort: p };
    }
  },
  legCurl: {
    props: ['seat'],
    load: 'roller',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [186, 238];
      const knee: P = [hip[0] + BODY.thigh, hip[1]];
      const foot = arc(knee, BODY.shin - 0.5, lerp(Math.PI / 2 - 0.08, -0.45, p));
      return { hip, torso: -0.12, head: 0.1, hand: [196, 252], elbow: 1, foot, knee: 1, toe: -0.2, pad: add(foot, 4, 9), effort: p };
    }
  },
  deadlift: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      // Глубина наоборот: 0 — внизу у пола, 1 — стоя.
      const hip = mix([174, 230], [208, FLOOR - 89], p);
      const torso = lerp(1.0, 0.03, p);
      const bar = mix([222, FLOOR - 30], [214, 222], p);
      return { hip, torso, head: lerp(-0.7, 0, p), hand: bar, elbow: 1, foot: [218, FLOOR], knee: -1, effort: 1 - p };
    }
  },
  rdl: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const hip = mix([206, FLOOR - 89], [180, 214], p);
      const torso = lerp(0.04, 1.18, p);
      const bar = mix([214, 222], [218, 252], p);
      return { hip, torso, head: -torso * 0.55, hand: bar, elbow: 1, foot: [216, FLOOR], knee: -1, effort: p };
    }
  },
  hipThrust: {
    props: ['thrustBench'],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      // 0 — таз внизу, 1 — таз вверху.
      const hip = mix([196, 270], [204, 236], p);
      const torso = lerp(-1.08, -Math.PI / 2 + 0.02, p);
      const bar: P = [hip[0] + 4, hip[1] - 24];
      return { hip, torso, head: lerp(0.6, 0.9, p), hand: add(bar, -10, 4), elbow: 1, foot: [252, FLOOR], knee: 1, load: bar, effort: p };
    }
  },
  calf: {
    props: ['step'],
    load: 'dumbbell',
    tempo: 'rep',
    pose: (p) => {
      const rise = 13 * p;
      const hip: P = [206, FLOOR - 101 - rise];
      const s = shoulderOf(hip, 0.02);
      return {
        hip,
        torso: 0.02,
        hand: add(s, 4, ARM - 4),
        elbow: 1,
        foot: [210, FLOOR - 12 - rise],
        knee: -1,
        toe: 0.55 * p,
        effort: p
      };
    }
  },
  row: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [184, 214];
      const torso = 1.22;
      const s = shoulderOf(hip, torso);
      const d = dirOf(torso);
      const n: P = [Math.cos(torso), Math.sin(torso)];
      const belly: P = [hip[0] + d[0] * 26 + n[0] * 18, hip[1] + d[1] * 26 + n[1] * 18];
      return {
        hip,
        torso,
        head: -0.95,
        hand: mix([s[0] + 2, s[1] + ARM - 3], belly, p),
        elbow: 1,
        foot: [214, FLOOR],
        knee: -1,
        effort: p
      };
    }
  },
  cableRow: {
    props: ['seat'],
    load: 'handle',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [150, 252];
      const torso = lerp(0.32, -0.06, p);
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: -torso * 0.4,
        hand: mix([s[0] + ARM - 4, s[1] + 12], [hip[0] + 30, hip[1] - 26], p),
        elbow: 1,
        foot: [236, 262],
        knee: -1,
        toe: -1.2,
        pulley: [312, 262],
        effort: p
      };
    }
  },
  pullup: {
    props: ['bar'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const torso = lerp(-0.06, 0.08, p);
      const s = mix([204, 48 + ARM - 2], [206, 56], p);
      const d = dirOf(torso);
      const hip: P = [s[0] - d[0] * BODY.torso * SHOULDER_AT, s[1] - d[1] * BODY.torso * SHOULDER_AT];
      return { hip, torso, head: -0.1, hand: [212, 44], elbow: -1, foot: add(hip, -30, 74), knee: 1, toe: 0.5, effort: p };
    }
  },
  pulldown: {
    props: ['seat'],
    load: 'handle',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [190, 236];
      const torso = -0.16;
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: lerp(0.0, -0.25, p),
        hand: mix([s[0] + 10, s[1] - ARM + 3], [s[0] + 18, s[1] - 4], p),
        elbow: 1,
        foot: [236, FLOOR],
        knee: -1,
        pulley: [s[0] + 10, 18],
        effort: p
      };
    }
  },
  shrug: {
    props: [],
    load: 'dumbbell',
    tempo: 'rep',
    pose: (p) => {
      const shrug = 9 * p;
      const s = shoulderOf(STAND, 0.03, shrug);
      return { hip: STAND, torso: 0.03, shrug, hand: add(s, 4, ARM - 3), elbow: 1, foot: FOOT, knee: -1, effort: p };
    }
  },
  curl: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const s = shoulderOf(STAND, 0.02);
      const elbowAt = add(s, 1, BODY.upper - 0.5);
      return {
        hip: STAND,
        torso: 0.02,
        hand: arc(elbowAt, BODY.fore - 0.5, lerp(0.05, 2.55, p)),
        elbow: 1,
        foot: FOOT,
        knee: -1,
        effort: p
      };
    }
  },
  pushdown: {
    props: [],
    load: 'handle',
    tempo: 'rep',
    pose: (p) => {
      const torso = 0.16;
      const s = shoulderOf(STAND, torso);
      const elbowAt = add(s, 0, BODY.upper - 0.5);
      return {
        hip: STAND,
        torso,
        head: -0.1,
        hand: arc(elbowAt, BODY.fore - 0.5, lerp(2.2, 0.12, p)),
        elbow: 1,
        foot: FOOT,
        knee: -1,
        pulley: [s[0] + 44, 22],
        effort: p
      };
    }
  },
  skull: {
    props: ['bench'],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [226, 228];
      const torso = -Math.PI / 2 + 0.05;
      const s = shoulderOf(hip, torso);
      const elbowAt = arc(s, BODY.upper - 0.5, Math.PI + 0.28);
      return {
        hip,
        torso,
        head: 0.1,
        hand: arc(elbowAt, BODY.fore - 0.5, lerp(Math.PI + 0.25, Math.PI + 2.35, p)),
        elbow: -1,
        foot: [266, FLOOR],
        knee: -1,
        effort: p
      };
    }
  },
  plank: {
    props: ['mat'],
    load: 'none',
    tempo: 'hold',
    pose: (p) => {
      const feet: P = [92, FLOOR - 2];
      const angle = 1.36 - 0.02 * p;
      const d = dirOf(angle);
      const hip: P = [feet[0] + d[0] * 90, feet[1] + d[1] * 90];
      return { hip, torso: angle - 0.02, head: -0.2, hand: [262, FLOOR - 2], elbow: 1, foot: feet, knee: 1, toe: 1.5, effort: 0.4 };
    }
  },
  crunch: {
    props: ['mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [204, 276];
      const torso = lerp(-Math.PI / 2 + 0.06, -Math.PI / 2 + 0.62, p);
      const d = dirOf(torso);
      const neck: P = [hip[0] + d[0] * BODY.torso, hip[1] + d[1] * BODY.torso];
      return { hip, torso, head: lerp(0.05, 0.35, p), hand: add(neck, -10, -8), elbow: -1, foot: [258, FLOOR], knee: 1, effort: p };
    }
  },
  hangRaise: {
    props: ['bar'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const s: P = [204, 48 + ARM - 2];
      const torso = lerp(-0.06, -0.24, p);
      const d = dirOf(torso);
      const hip: P = [s[0] - d[0] * BODY.torso * SHOULDER_AT, s[1] - d[1] * BODY.torso * SHOULDER_AT];
      return {
        hip,
        torso,
        head: 0.1,
        hand: [212, 44],
        elbow: -1,
        foot: arc(hip, 88, lerp(0.05, Math.PI / 2 + 0.1, p)),
        knee: 1,
        effort: p
      };
    }
  },
  /**
   * День без тренировки: в капюшоне на скамье, в телефоне. Дышит и иногда
   * вздыхает — `p` здесь не глубина, а вдох.
   */
  rest: {
    props: ['bench', 'hood'],
    load: 'none',
    tempo: 'hold',
    pose: (p) => {
      const hip: P = [214, 234];
      const torso = 0.26 + 0.025 * p;
      return {
        hip,
        torso,
        head: 0.42 - 0.04 * p,
        shrug: 2.5 * p,
        hand: [244, 214],
        elbow: 1,
        foot: [262, FLOOR],
        knee: -1,
        effort: 0
      };
    }
  }
};

/** Чем нагружен мопс: снаряд упражнения важнее движения по умолчанию. */
export function loadOf(motion: Motion | 'rest', gear: Gear | null): Load {
  const own = MOTIONS[motion].load;
  if (!gear || own === 'roller' || own === 'platform') return own;
  if (gear === 'dumbbell') return 'dumbbell';
  if (gear === 'cable') return 'handle';
  if (gear === 'body') return 'none';
  return own;
}
