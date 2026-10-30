import type { Gear, Motion } from '@/lib/gym/exercises';

/**
 * Как двигается мопс: позы упражнений для `PugRig`.
 *
 * Каждое движение — функция от фазы `p` ∈ [0, 1]. У силовых (`tempo: 'rep'`)
 * это глубина повтора: 0 — исходное положение, 1 — нижняя (или пиковая) точка,
 * а туда и обратно водит `PugRig`. У циклических (`'cycle'`: бег, прыжки,
 * олимпийка) — фаза одного круга, который идёт только вперёд. У статики
 * (`'hold'`) — вдох.
 *
 * Поза задаёт не углы суставов, а то, что видит тренер: где таз, куда наклонён
 * корпус, где гриф и где стопы. Локти и колени решает двузвенная обратная
 * кинематика: гриф в жиме идёт по прямой, стопы в приседе стоят на месте —
 * техника получается правильной сама, а не подгоняется кадрами.
 *
 * Вид сбоку — плоскость `(x, y)`. Вид спереди берёт те же высоты и добавляет
 * ширину — `z`: хват, постановку стоп, разведение локтей и коленей. Руки,
 * которые уходят в стороны (махи, разводки), сбоку укорачиваются (`reach`) —
 * честная перспектива, а спереди раскрываются в полную длину.
 *
 * Мир — 400 × 300, пол на `FLOOR`, мопс смотрит вправо. Длины сегментов — в
 * `BODY`; позы считаются от них, поэтому менять длины — значит пересмотреть позы.
 */

export type P = [number, number];

/** Высота голеностопа у стоящего мопса; подошва и пол — на `GROUND`. */
export const FLOOR = 296;
export const GROUND = 300;
export const BODY = { torso: 70, upper: 40, fore: 38, thigh: 46, shin: 44 } as const;
/** Плечо — не верх корпуса, а чуть ниже шеи. */
export const SHOULDER_AT = 0.84;
/**
 * Ось корпуса идёт ближе к спине, как позвоночник, а плечевой сустав сидит
 * впереди неё — посередине грудной клетки. Без сдвига рука росла бы из спины.
 */
export const SHOULDER_FWD = 9;
/** Толщина корпуса от оси: до спины и до груди. Нужна лежачим позам и виду спереди. */
export const BACK = 17;
export const CHEST = 38;

/** Полуширины для вида спереди: насколько сустав отстоит от середины тела. */
export type Lateral = {
  shoulder: number;
  elbow: number;
  hand: number;
  hip: number;
  knee: number;
  foot: number;
};

export const LATERAL: Lateral = { shoulder: 34, elbow: 44, hand: 40, hip: 15, knee: 17, foot: 20 };

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
  elbow2?: 1 | -1;
  foot: P;
  foot2?: P;
  knee: 1 | -1;
  knee2?: 1 | -1;
  /** Поворот стопы: 0 — на полу, плюс — носок вниз (на носках, в висе). */
  toe?: number;
  toe2?: number;
  /** Центр груза, если он не в кисти: штанга на спине, гриф на тазу. */
  load?: P;
  /** Откуда идёт трос — у блоков. */
  pulley?: P;
  /** Подвижная часть тренажёра: валик, платформа, сиденье гребли. */
  pad?: P;
  /** Насколько тяжело прямо сейчас: щурится, потеет, дрожит. */
  effort?: number;
  /** Видимая длина руки сбоку: рука, ушедшая в сторону, смотрит на нас. */
  reach?: number;
  /**
   * Видимая длина одного плеча. В жиме локти разведены в стороны, и сбоку
   * плечо короче предплечья — только так предплечье стоит вертикально под
   * грифом, как его ставит тренер.
   */
  reachUpper?: number;
  /** Вид спереди: ширины этой позы поверх `LATERAL`; `pulley` — где блок. */
  z?: Partial<Lateral> & { pulley?: number };
  /** Вид спереди: кисти у морды — руки рисуются поверх головы. */
  handsFront?: boolean;
  /**
   * Вид спереди: высота локтей, если сбоку она другая. Кулаки у рта и локти на
   * бёдрах при наших длинах рук сбоку не сходятся, а спереди только так и
   * читается поза: предплечья встают от колен к морде.
   */
  elbowY?: number;
  /** Вид спереди: наклон корпуса вбок (наклоны) и сдвиг рук (скручивания). */
  lean?: number;
  shift?: number;
  /** Фаза скакалки и волн канатов. */
  spin?: number;
};

export type Prop =
  | 'bench'
  | 'incline'
  | 'decline'
  | 'rack'
  | 'seat'
  | 'backrest'
  | 'press'
  | 'bar'
  | 'barLow'
  | 'lowBar'
  | 'dips'
  | 'step'
  | 'box'
  | 'rearBench'
  | 'mat'
  | 'thrustBench'
  | 'hood'
  | 'crossover'
  | 'preacherPad'
  | 'hyper'
  | 'bike'
  | 'rower'
  | 'treadmill'
  | 'water'
  | 'wall'
  | 'anchor'
  | 'hackSled'
  | 'longBench'
  /** Скамья поперёк, лицом к зрителю: на ней сидят в день отдыха. */
  | 'sideBench'
  | 'elliptical';

export type Load =
  | 'plate'
  | 'dumbbell'
  | 'singleDb'
  | 'kettlebell'
  /** Блин в руках: подъём перед собой, ролик для запястий. */
  | 'disc'
  | 'handle'
  | 'band'
  | 'roller'
  | 'platform'
  | 'ball'
  | 'wheel'
  | 'ropes'
  | 'jumpRope'
  | 'seatSlide'
  | 'none';

export type MotionDef = {
  /** Снаряд меняет позу там, где меняет технику: штанга в выпадах лежит на спине, гантели висят в руках. */
  pose: (p: number, gear: Gear | null) => Pose;
  props: Prop[];
  /** Чем нагружен по умолчанию, если снаряд упражнения не сказал иначе. */
  load: Load;
  /** `rep` — повторы туда-обратно; `cycle` — круг вперёд; `hold` — статика с дыханием. */
  tempo: 'rep' | 'hold' | 'cycle';
  /** Секунд на круг или повтор, если не стандартные. */
  period?: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: P, b: P, t: number): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const dirOf = (torso: number): P => [Math.sin(torso), -Math.cos(torso)];
/** Куда смотрит грудь: для стоящего — вправо, для лежащего на спине — вверх. */
const frontOf = (torso: number): P => [Math.cos(torso), Math.sin(torso)];
/** Где окажется плечо при такой позе таза и корпуса. */
export const shoulderOf = (hip: P, torso: number, shrug = 0): P => {
  const d = dirOf(torso);
  const f = frontOf(torso);
  const k = BODY.torso * SHOULDER_AT + shrug;
  return [hip[0] + d[0] * k + f[0] * SHOULDER_FWD, hip[1] + d[1] * k + f[1] * SHOULDER_FWD];
};
const neckOf = (hip: P, torso: number): P => {
  const d = dirOf(torso);
  return [hip[0] + d[0] * BODY.torso, hip[1] + d[1] * BODY.torso];
};
/** Таз по плечу: когда задано, где плечо, а корпус к нему подстраивается. */
const hipFrom = (s: P, torso: number): P => {
  const d = dirOf(torso);
  const f = frontOf(torso);
  const k = BODY.torso * SHOULDER_AT;
  return [s[0] - d[0] * k - f[0] * SHOULDER_FWD, s[1] - d[1] * k - f[1] * SHOULDER_FWD];
};
/** Тело одной прямой от плеча к опоре (стопам, коленям): корпус и таз по этой линии. */
const lineFrom = (s: P, support: P) => {
  const v: P = [support[0] - s[0], support[1] - s[1]];
  const len = Math.hypot(v[0], v[1]) || 1;
  const torso = Math.atan2(-v[0] / len, v[1] / len);
  return { torso, hip: hipFrom(s, torso) };
};
const add = (a: P, x: number, y: number): P => [a[0] + x, a[1] + y];
/** Точка на окружности: угол от «вниз» (0) через «вперёд» (π/2) к «вверх» (π). */
const arc = (centre: P, r: number, angle: number): P => [centre[0] + r * Math.sin(angle), centre[1] + r * Math.cos(angle)];
/** Сдвиг вдоль корпуса: вперёд по груди и вверх по позвоночнику. */
const along = (o: P, torso: number, fwd: number, upAmt: number): P => {
  const f = frontOf(torso);
  const u = dirOf(torso);
  return [o[0] + f[0] * fwd + u[0] * upAmt, o[1] + f[1] * fwd + u[1] * upAmt];
};
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const span = (p: number, a: number, b: number) => smooth((p - a) / (b - a));
const TAU = Math.PI * 2;
/** 0 → 1 → 0 за круг. */
const wave = (p: number) => 0.5 - 0.5 * Math.cos(TAU * p);
const ARM = BODY.upper + BODY.fore;
/** Нагрузка по ходу повтора: растёт к самой трудной точке и спадает после неё. */
const hardAt = (p: number, peak: number) => (p <= peak ? p / peak : 1 - (0.6 * (p - peak)) / (1 - peak));

/** Стоя: таз над серединой стопы. */
const STAND: P = [206, FLOOR - 89];
const FOOT: P = [212, FLOOR];
/** Сидя на скамье или в тренажёре: таз на сиденье, стопы на полу, колени под прямым углом. */
const SEAT: P = [192, 238];
const SEAT_FEET: P = [242, FLOOR];

type Key = { at: number; hip: P; torso: number; hand: P; foot: P; foot2?: P; hand2?: P; toe?: number; head?: number };

/** Ключевые позы и плавный переход между ними — для бёрпи, прыжков и олимпийки. */
function keyed(keys: Key[], p: number) {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].at) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const t = smooth((p - a.at) / Math.max(1e-6, b.at - a.at));
  return {
    hip: mix(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    hand: mix(a.hand, b.hand, t),
    foot: mix(a.foot, b.foot, t),
    foot2: mix(a.foot2 ?? a.foot, b.foot2 ?? b.foot, t),
    hand2: a.hand2 || b.hand2 ? mix(a.hand2 ?? a.hand, b.hand2 ?? b.hand, t) : undefined,
    toe: lerp(a.toe ?? 0, b.toe ?? 0, t),
    head: lerp(a.head ?? 0, b.head ?? 0, t)
  };
}

// ─── Заготовки семейств ─────────────────────────────────────────────────────

/** Жим лёжа под любым углом скамьи: гриф по вертикали от груди до локаута. */
const pressLying =
  (hip: P, torso: number, foot: P, grip: number, bottom: P = [16, -24]) =>
  (p: number): Pose => {
    // 0 — локаут, руки отвесно над плечами; 1 — гриф касается низа груди,
    // предплечья вертикальны, локти под грифом и разведены градусов на 45.
    const s = shoulderOf(hip, torso);
    return {
      hip,
      torso,
      head: 0.1,
      hand: mix([s[0] + 4, s[1] - ARM + 3], [s[0] + bottom[0], s[1] + bottom[1]], p),
      reachUpper: lerp(1, 0.55, p),
      elbow: 1,
      foot,
      knee: -1,
      effort: p,
      z: { hand: grip, elbow: lerp(grip + 2, grip + 22, p) }
    };
  };

/** Разводка лёжа: руки уходят в стороны по дуге — сбоку видно, как они укорачиваются. */
const flyLying =
  (hip: P, torso: number, foot: P) =>
  (p: number): Pose => {
    const s = shoulderOf(hip, torso);
    return {
      hip,
      torso,
      head: 0.1,
      hand: mix(along(s, torso, ARM - 8, 0), along(s, torso, 4, -6), p),
      reach: lerp(1, 0.3, p),
      elbow: 1,
      foot,
      knee: -1,
      effort: p,
      z: { hand: lerp(30, 104, p), elbow: lerp(36, 74, p) }
    };
  };

type SquatBar = 'back' | 'front' | 'goblet' | 'overhead' | 'hang' | 'none';

/** Присед со штангой на спине, на груди, с гантелью у груди, над головой или без веса. */
function squatPose(p: number, bar: SquatBar): Pose {
  const front = bar === 'front' || bar === 'goblet' || bar === 'overhead';
  const hip = mix([front ? 210 : 208, FLOOR - 89], [front ? 190 : 182, front ? 258 : 256], p);
  const torso = lerp(front ? 0.04 : 0.1, bar === 'overhead' ? 0.3 : front ? 0.38 : 0.66, p);
  const s = shoulderOf(hip, torso);
  const z = { foot: 26, knee: lerp(26, 34, p) };
  if (bar === 'back') {
    // Гриф лежит на трапециях: позади плеча и чуть выше. Локоть — назад и вниз.
    const b = along(s, torso, -13, 7);
    return { hip, torso, head: -torso * 0.6, hand: b, elbow: -1, foot: [214, FLOOR], knee: -1, load: b, effort: p, z: { ...z, hand: 46, elbow: 50 } };
  }
  if (bar === 'front') {
    // Гриф на передних дельтах, кисти под ним, локти высоко и вперёд.
    const b = along(s, torso, 13, -7);
    return { hip, torso, head: -torso * 0.5, hand: along(b, torso, -1, 0), elbow: -1, foot: [216, FLOOR], knee: -1, load: b, effort: p, z: { ...z, hand: 34, elbow: 30 } };
  }
  if (bar === 'goblet') {
    const h = along(s, torso, 18, -14);
    return { hip, torso, head: -torso * 0.5, hand: h, elbow: 1, foot: [216, FLOOR], knee: -1, effort: p, z: { ...z, hand: 8, elbow: 24 } };
  }
  if (bar === 'overhead') {
    const h = add(s, -2, -ARM + 4);
    return { hip, torso, head: -torso * 0.4, hand: h, elbow: -1, foot: [216, FLOOR], knee: -1, effort: p, z: { ...z, hand: 66, elbow: 60 } };
  }
  if (bar === 'hang') {
    // Гантели висят по бокам, руки прямые: снаряд опускается вместе с тазом.
    const h = add(s, 2, ARM - 4);
    return { hip, torso, head: -torso * 0.5, hand: h, elbow: 1, foot: [214, FLOOR], knee: -1, effort: p, z: { ...z, hand: 40, elbow: 40 } };
  }
  return {
    hip,
    torso,
    head: -torso * 0.5,
    hand: mix(add(s, 6, ARM - 6), add(s, ARM - 8, 2), p),
    elbow: -1,
    foot: [214, FLOOR],
    knee: -1,
    effort: p * 0.5,
    z: { ...z, hand: 24 }
  };
}

/** Тяга от пола: 0 — внизу, 1 — стоя. Сумо — шире стопы, корпус вертикальнее, руки внутри коленей. */
function pullFromFloor(p: number, sumo = false, from: { hip: P; torso: number; bar: P } | null = null): Pose {
  // Старт: блины стоят на полу, руки прямые и отвесные, лопатки над грифом,
  // гриф у голеней над серединой стопы. Встал — гриф у бёдер, плечи назад.
  const start = from ?? (sumo ? { hip: [184, 240] as P, torso: 0.6, bar: [217, GROUND - 28] as P } : { hip: [176, 228] as P, torso: 0.86, bar: [222, GROUND - 28] as P });
  const hip = mix(start.hip, [208, FLOOR - 89], p);
  const torso = lerp(start.torso, 0.03, p);
  const top = shoulderOf([208, FLOOR - 89], 0.03);
  // Руки прямые всю дорогу: гриф висит под плечами, а по горизонтали идёт отвесно.
  const s = shoulderOf(hip, torso);
  const bar: P = [lerp(start.bar[0], top[0] + 1, p), Math.min(start.bar[1], s[1] + ARM - 3)];
  return {
    hip,
    torso,
    head: lerp(-start.torso * 0.7, 0, p),
    hand: bar,
    elbow: 1,
    foot: [218, FLOOR],
    knee: -1,
    effort: 1 - p,
    z: sumo ? { hand: 18, elbow: 22, foot: 46, knee: lerp(50, 30, p) } : { hand: 30, elbow: 32, foot: 18, knee: 19 }
  };
}

/** Бег и ходьба: шаг по кругу, стопа сзади — на земле, спереди — в воздухе. */
function gait(p: number, stride: number, lift: number, lean: number, bob: number, armSwing: number): Pose {
  const phi = TAU * p;
  const hip: P = [206, FLOOR - 85 + bob * Math.cos(2 * phi)];
  const footAt = (ph: number): P => {
    const q = ((ph % TAU) + TAU) % TAU;
    if (q < Math.PI) return [206 + lerp(stride, -stride, q / Math.PI), FLOOR];
    const r = (q - Math.PI) / Math.PI;
    return [206 + lerp(-stride, stride, r), FLOOR - lift * Math.sin(Math.PI * r)];
  };
  const s = shoulderOf(hip, lean);
  const swing = Math.sin(phi);
  return {
    hip,
    torso: lean,
    head: -lean * 0.8,
    hand: add(s, 10 - armSwing * swing, 50 - 6 * Math.abs(swing)),
    hand2: add(s, 10 + armSwing * swing, 50 - 6 * Math.abs(swing)),
    elbow: 1,
    elbow2: 1,
    foot: footAt(phi),
    foot2: footAt(phi + Math.PI),
    knee: -1,
    knee2: -1,
    toe: Math.max(0, Math.sin(phi)) * 0.5,
    toe2: Math.max(0, -Math.sin(phi)) * 0.5,
    effort: 0.3,
    z: { foot: 14, knee: 15, hand: 28, elbow: 34 }
  };
}

// ─── Движения ───────────────────────────────────────────────────────────────

export const MOTIONS: Record<Motion | 'rest', MotionDef> = {
  // Грудь
  bench: { props: ['rack', 'bench'], load: 'plate', tempo: 'rep', pose: pressLying([226, 222], -Math.PI / 2 + 0.05, [262, FLOOR], 50) },
  incline: { props: ['rack', 'incline'], load: 'plate', tempo: 'rep', pose: pressLying([234, 230], -1.02, [270, FLOOR], 48, [10, -22]) },
  decline: { props: ['rack', 'decline'], load: 'plate', tempo: 'rep', pose: pressLying([228, 218], -Math.PI / 2 - 0.3, [264, 250], 48, [18, -22]) },
  fly: { props: ['bench'], load: 'dumbbell', tempo: 'rep', pose: flyLying([226, 222], -Math.PI / 2 + 0.05, [266, FLOOR]) },
  inclineFly: { props: ['incline'], load: 'dumbbell', tempo: 'rep', pose: flyLying([234, 228], -1.02, [272, FLOOR]) },
  cableFly: {
    props: ['crossover'],
    load: 'handle',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [204, FLOOR - 88];
      const torso = 0.22;
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: -0.15,
        hand: mix([s[0] + 34, s[1] + 56], [s[0] - 2, s[1] + 8], p),
        reach: lerp(0.95, 0.25, p),
        elbow: 1,
        foot: [226, FLOOR],
        foot2: [190, FLOOR],
        knee: -1,
        pulley: [s[0] - 16, 34],
        effort: 1 - p,
        z: { hand: lerp(10, 112, p), elbow: lerp(32, 82, p), foot: 16, pulley: 150 }
      };
    }
  },
  pecDeck: {
    props: ['seat', 'backrest'],
    load: 'handle',
    tempo: 'rep',
    pose: (p) => {
      const torso = -0.08;
      const s = shoulderOf(SEAT, torso);
      return {
        hip: SEAT,
        torso,
        head: 0.05,
        hand: mix([s[0] + 44, s[1] + 10], [s[0] - 4, s[1] + 6], p),
        reach: lerp(1, 0.25, p),
        elbow: 1,
        foot: SEAT_FEET,
        knee: -1,
        effort: 1 - p,
        z: { hand: lerp(12, 104, p), elbow: lerp(40, 92, p), knee: 26, foot: 28 }
      };
    }
  },
  chestPress: {
    props: ['seat', 'backrest'],
    load: 'handle',
    tempo: 'rep',
    pose: (p) => {
      const torso = -0.1;
      const s = shoulderOf(SEAT, torso);
      return {
        hip: SEAT,
        torso,
        head: 0.08,
        hand: mix([s[0] + ARM - 4, s[1] + 10], [s[0] + 14, s[1] + 8], p),
        elbow: 1,
        foot: SEAT_FEET,
        knee: -1,
        effort: p,
        z: { hand: 44, elbow: lerp(46, 58, p), knee: 26, foot: 28 }
      };
    }
  },
  pullover: {
    props: ['bench'],
    load: 'singleDb',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [226, 228];
      const torso = -Math.PI / 2 + 0.05;
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: 0.1,
        hand: arc(s, ARM - 4, lerp(Math.PI - 0.1, Math.PI + 1.3, p)),
        elbow: -1,
        foot: [266, FLOOR],
        knee: -1,
        effort: p,
        z: { hand: 8, elbow: 26 }
      };
    }
  },
  pushup: {
    props: ['mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      // Плечи над кистями, тело одной доской от плеч до носков.
      const feet: P = [96, FLOOR - 2];
      const s = mix([228, FLOOR - ARM + 6], [234, FLOOR - 30], p);
      const { hip, torso } = lineFrom(s, feet);
      return { hip, torso, head: -0.25, hand: [232, FLOOR], elbow: 1, foot: feet, knee: 1, toe: 1.5, effort: p, z: { hand: 42, elbow: 52, foot: 10, knee: 11 } };
    }
  },
  kneePushup: {
    props: ['mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      // Опора на колени: линия тела от колена до плеча, голени вверх-назад.
      const k: P = [134, FLOOR - 8];
      const s: P = mix([228, FLOOR - 74], [236, FLOOR - 46], p);
      const v: P = [s[0] - k[0], s[1] - k[1]];
      const len = Math.hypot(v[0], v[1]);
      const u: P = [v[0] / len, v[1] / len];
      const hip: P = [k[0] + u[0] * BODY.thigh, k[1] + u[1] * BODY.thigh];
      const torso = Math.atan2(u[0], -u[1]);
      return { hip, torso, head: -0.25, hand: [232, FLOOR], elbow: 1, foot: [104, FLOOR - 40], knee: 1, toe: -0.6, effort: p, z: { hand: 42, elbow: 52, foot: 12, knee: 14 } };
    }
  },
  hspu: {
    props: ['wall', 'mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const s: P = mix([206, FLOOR - 74], [206, FLOOR - 40], p);
      const torso = Math.PI - 0.06;
      const hip = hipFrom(s, torso);
      return { hip, torso, head: 0, hand: [204, FLOOR], elbow: 1, foot: add(hip, 4, -86), knee: 1, toe: 1.2, effort: p, z: { hand: 40, elbow: 56, foot: 10, knee: 12 } };
    }
  },
  dip: {
    props: ['dips'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const torso = lerp(0.12, 0.38, p);
      const s: P = mix([203, 128], [214, 162], p);
      const hip = hipFrom(s, torso);
      return { hip, torso, head: -0.1, hand: [206, 204], elbow: 1, foot: add(hip, -36, 52), knee: 1, toe: 0.6, effort: p, z: { hand: 32, elbow: lerp(34, 44, p), foot: 8, knee: 12 } };
    }
  },
  benchDip: {
    props: ['rearBench'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const s: P = mix([180, 182], [186, 218], p);
      const torso = 0.05;
      const hip = hipFrom(s, torso);
      return { hip, torso, head: 0, hand: [172, 252], elbow: -1, foot: [236, FLOOR], knee: -1, toe: -0.4, effort: p, z: { hand: 30, elbow: 36 } };
    }
  },

  // Плечи
  ohp: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      // Здесь глубина наоборот: 0 — гриф на груди, 1 — над головой.
      // Гриф идёт отвесно над серединой стопы; голова уходит назад и
      // возвращается под гриф. Локти под грифом, предплечья вертикальны.
      const torso = lerp(-0.05, 0.03, p);
      const s = shoulderOf(STAND, torso);
      return {
        hip: STAND,
        torso,
        head: lerp(-0.2, 0.06, p) - 0.12 * Math.sin(Math.PI * p),
        hand: mix([s[0] + 13, s[1]], [s[0] + 2, s[1] - ARM + 3], p),
        reachUpper: 1 - 0.5 * Math.sin(Math.PI * p),
        elbow: 1,
        foot: FOOT,
        knee: -1,
        effort: hardAt(p, 0.4),
        z: { hand: lerp(34, 31, p), elbow: lerp(42, 44, Math.sin(Math.PI * p)) }
      };
    }
  },
  seatedPress: {
    props: ['seat', 'backrest'],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const torso = -0.06;
      const s = shoulderOf(SEAT, torso);
      return {
        hip: SEAT,
        torso,
        head: lerp(-0.12, 0.05, p) - 0.1 * Math.sin(Math.PI * p),
        hand: mix([s[0] + 12, s[1] + 2], [s[0] + 2, s[1] - ARM + 3], p),
        reachUpper: 1 - 0.5 * Math.sin(Math.PI * p),
        elbow: 1,
        foot: SEAT_FEET,
        knee: -1,
        effort: hardAt(p, 0.4),
        z: { hand: lerp(40, 30, p), elbow: lerp(56, 40, p), knee: 26, foot: 28 }
      };
    }
  },
  pushPress: {
    props: [],
    load: 'plate',
    tempo: 'cycle',
    period: 2.4,
    pose: (p) => {
      // Подсед ногами — и толчок: гриф уходит наверх на инерции, а не руками.
      const dip = span(p, 0, 0.18) - span(p, 0.18, 0.3);
      const press = span(p, 0.24, 0.42) - span(p, 0.72, 0.98);
      const hip: P = [206, FLOOR - 89 + 14 * dip];
      const s = shoulderOf(hip, 0.03);
      return {
        hip,
        torso: 0.03,
        head: lerp(-0.18, 0.05, press),
        hand: mix(add(s, 13, 2), add(s, 3, -ARM + 3), press),
        elbow: -1,
        foot: FOOT,
        knee: -1,
        toe: 0.25 * (span(p, 0.26, 0.34) - span(p, 0.34, 0.42)),
        effort: Math.max(dip, press * 0.6),
        z: { hand: 34, elbow: 44 }
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
        hand: add(s, 4, lerp(ARM - 6, 8, p)),
        reach: lerp(1, 0.22, p),
        elbow: -1,
        foot: FOOT,
        knee: -1,
        effort: p,
        z: { hand: lerp(34, 108, p), elbow: lerp(34, 74, p) }
      };
    }
  },
  frontRaise: {
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
        effort: p,
        z: { hand: 26, elbow: 34 }
      };
    }
  },
  reverseFly: {
    props: [],
    load: 'dumbbell',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [184, 214];
      const torso = 1.15;
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: -0.9,
        hand: add(s, lerp(2, 4, p), lerp(ARM - 6, 8, p)),
        reach: lerp(1, 0.24, p),
        elbow: -1,
        foot: [214, FLOOR],
        knee: -1,
        effort: p,
        z: { hand: lerp(24, 104, p), elbow: lerp(28, 72, p) }
      };
    }
  },
  facePull: {
    props: [],
    load: 'handle',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [204, FLOOR - 89];
      const torso = -0.06;
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: 0.05,
        hand: mix(add(s, ARM - 6, -6), add(s, 8, -22), p),
        elbow: -1,
        foot: FOOT,
        foot2: [196, FLOOR],
        knee: -1,
        pulley: [334, s[1] - 8],
        effort: p,
        z: { hand: lerp(12, 46, p), elbow: lerp(30, 72, p) }
      };
    }
  },
  uprightRow: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const s = shoulderOf(STAND, 0.04);
      return {
        hip: STAND,
        torso: 0.04,
        hand: mix(add(s, 6, ARM - 8), add(s, 12, -8), p),
        elbow: 1,
        foot: FOOT,
        knee: -1,
        effort: p,
        z: { hand: 16, elbow: lerp(28, 70, p) }
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
      return { hip: STAND, torso: 0.03, shrug, hand: add(s, 4, ARM - 3), elbow: 1, foot: FOOT, knee: -1, effort: p, z: { hand: 34, elbow: 36 } };
    }
  },

  // Ноги
  squat: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    // Гантели в приседе висят в руках, гиря — у груди; штанга, смит и резина — на спине.
    pose: (p, gear) => squatPose(p, gear === 'dumbbell' ? 'hang' : gear === 'kettlebell' ? 'goblet' : 'back')
  },
  frontSquat: { props: [], load: 'plate', tempo: 'rep', pose: (p) => squatPose(p, 'front') },
  goblet: { props: [], load: 'kettlebell', tempo: 'rep', pose: (p) => squatPose(p, 'goblet') },
  ohSquat: { props: [], load: 'plate', tempo: 'rep', pose: (p) => squatPose(p, 'overhead') },
  bwSquat: { props: [], load: 'none', tempo: 'rep', pose: (p) => squatPose(p, 'none') },
  hackSquat: {
    props: ['hackSled'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const hip = mix([214, 204], [196, 252], p);
      const torso = lerp(-0.26, -0.1, p);
      const s = shoulderOf(hip, torso);
      return { hip, torso, head: 0.2, hand: add(s, 8, 12), elbow: 1, foot: [252, 286], knee: -1, toe: -0.3, effort: p, z: { foot: 24, knee: lerp(24, 32, p), hand: 34, elbow: 44 } };
    }
  },
  pistol: {
    props: [],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const hip = mix([206, FLOOR - 89], [188, 258], p);
      const torso = lerp(0.06, 0.5, p);
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: -torso * 0.5,
        hand: add(s, ARM - 10, 10),
        elbow: -1,
        foot: [214, FLOOR],
        foot2: add(hip, lerp(30, 86, p), lerp(80, 2, p)),
        knee: -1,
        knee2: 1,
        toe2: -0.5,
        effort: p,
        z: { foot: 10, knee: 11, hand: 18 }
      };
    }
  },
  jumpSquat: {
    props: [],
    load: 'none',
    tempo: 'cycle',
    period: 2.2,
    pose: (p) => {
      const d = p < 0.4 ? span(p, 0, 0.4) : p < 0.55 ? 1 - span(p, 0.4, 0.55) : p < 0.75 ? 0 : p < 0.85 ? 0.35 * span(p, 0.75, 0.85) : 0.35 * (1 - span(p, 0.85, 1));
      const lift = p > 0.5 && p < 0.8 ? 34 * Math.sin((Math.PI * (p - 0.5)) / 0.3) : 0;
      const hip: P = [lerp(208, 186, d), lerp(FLOOR - 89, 252, d) - lift];
      const torso = lerp(0.08, 0.6, d);
      const s = shoulderOf(hip, torso);
      const air = lift / 34;
      return {
        hip,
        torso,
        head: -torso * 0.5,
        hand: mix(mix(add(s, 6, ARM - 6), add(s, -14, ARM - 12), d), add(s, 30, -30), air),
        elbow: -1,
        foot: [214, FLOOR - lift],
        knee: -1,
        toe: air * 0.9,
        effort: d,
        z: { foot: 24, knee: lerp(24, 32, d), hand: 26 }
      };
    }
  },
  lunge: {
    props: [],
    load: 'dumbbell',
    tempo: 'rep',
    pose: (p, gear) => {
      const hip = mix([200, FLOOR - 78], [196, 252], p);
      const s = shoulderOf(hip, 0.04);
      const legs = { foot: [242, FLOOR] as P, foot2: [158, FLOOR - 4] as P, knee: -1 as const, toe: 0, toe2: 0.4, effort: p };
      if (gear === 'barbell' || gear === 'smith') {
        const b = along(s, 0.04, -13, 7);
        return { hip, torso: 0.04, hand: b, elbow: -1, load: b, ...legs, z: { foot: 14, knee: 15, hand: 46, elbow: 50 } };
      }
      return { hip, torso: 0.04, hand: add(s, 4, ARM - 4), elbow: 1, ...legs, z: { foot: 14, knee: 15, hand: 38 } };
    }
  },
  bulgarian: {
    props: ['rearBench'],
    load: 'dumbbell',
    tempo: 'rep',
    pose: (p) => {
      const hip = mix([204, 220], [200, 250], p);
      const s = shoulderOf(hip, 0.06);
      return { hip, torso: 0.06, hand: add(s, 4, ARM - 4), elbow: 1, foot: [246, FLOOR], foot2: [156, 248], knee: -1, knee2: -1, toe2: 1.1, effort: p, z: { foot: 14, knee: 15, hand: 34 } };
    }
  },
  stepUp: {
    props: ['box'],
    load: 'dumbbell',
    tempo: 'rep',
    pose: (p) => {
      const k = smooth(p);
      const hip = mix([204, 216], [234, 166], k);
      const torso = lerp(0.2, 0.04, k);
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        hand: add(s, 4, ARM - 4),
        elbow: 1,
        foot: [244, 254],
        foot2: mix([184, FLOOR], [230, 250], k),
        knee: -1,
        knee2: -1,
        toe2: lerp(0.3, 0, k),
        effort: 1 - Math.abs(0.5 - p) * 2,
        z: { foot: 14, knee: 15, hand: 34 }
      };
    }
  },
  legPress: {
    props: ['press'],
    load: 'platform',
    tempo: 'rep',
    pose: (p) => {
      // Платформа ходит по направляющей, стопы на ней целиком: наверху колени
      // почти прямые, внизу — прямой угол, поясница на спинке.
      const hip: P = [150, 250];
      const u: P = [0.816, -0.578];
      const reach = lerp(87, 60, p);
      const foot: P = [hip[0] + u[0] * reach, hip[1] + u[1] * reach];
      return { hip, torso: -0.95, head: 0.45, hand: [164, 262], elbow: 1, foot, knee: 1, toe: -0.9, pad: [foot[0] + u[0] * 9, foot[1] + u[1] * 9], effort: p, z: { foot: 24, knee: lerp(24, 34, p), hand: 40 } };
    }
  },
  legExt: {
    props: ['seat', 'backrest'],
    load: 'roller',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [186, 238];
      const knee: P = [hip[0] + BODY.thigh, hip[1]];
      const foot = arc(knee, BODY.shin - 0.5, lerp(0.15, Math.PI / 2 - 0.08, p));
      return { hip, torso: -0.12, head: 0.1, hand: [196, 252], elbow: 1, foot, knee: 1, toe: -0.2, pad: add(foot, 2, -9), effort: p, z: { foot: 18, knee: 18, hand: 40 } };
    }
  },
  legCurl: {
    props: ['seat', 'backrest'],
    load: 'roller',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [186, 238];
      const knee: P = [hip[0] + BODY.thigh, hip[1]];
      const foot = arc(knee, BODY.shin - 0.5, lerp(Math.PI / 2 - 0.08, -0.45, p));
      return { hip, torso: -0.12, head: 0.1, hand: [196, 252], elbow: 1, foot, knee: 1, toe: -0.2, pad: add(foot, 4, 9), effort: p, z: { foot: 18, knee: 18, hand: 40 } };
    }
  },
  lyingLegCurl: {
    props: ['longBench'],
    load: 'roller',
    tempo: 'rep',
    pose: (p) => {
      // Лёжа лицом вниз головой вправо: колено на краю скамьи, голень вверх.
      const hip: P = [192, 218];
      const torso = Math.PI / 2;
      const s = shoulderOf(hip, torso);
      const knee: P = [hip[0] - BODY.thigh + 0.5, hip[1] + 2];
      const foot = arc(knee, BODY.shin - 0.5, lerp(-Math.PI / 2 + 0.05, -Math.PI + 0.35, p));
      return { hip, torso, head: -0.35, hand: add(s, 16, 14), elbow: 1, foot, knee: 1, toe: 0.2, pad: add(foot, -4, -8), effort: p, z: { foot: 14, knee: 15, hand: 30 } };
    }
  },
  deadlift: { props: [], load: 'plate', tempo: 'rep', pose: (p) => pullFromFloor(p) },
  sumo: { props: [], load: 'plate', tempo: 'rep', pose: (p) => pullFromFloor(p, true) },
  rackPull: { props: ['rack'], load: 'plate', tempo: 'rep', pose: (p) => pullFromFloor(p, false, { hip: [190, 218], torso: 0.55, bar: [220, 248] }) },
  rdl: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      // Таз уходит назад, колени почти прямые, гриф скользит по ногам до середины голени.
      const hip = mix([208, FLOOR - 89], [176, 214], p);
      const torso = lerp(0.03, 1.12, p);
      const top = shoulderOf([208, FLOOR - 89], 0.03);
      const bar = mix([top[0] + 1, top[1] + ARM - 3], [222, 256], p);
      return { hip, torso, head: -torso * 0.55, hand: bar, elbow: 1, foot: [216, FLOOR], knee: -1, effort: p, z: { hand: 28, elbow: 30, foot: 16 } };
    }
  },
  goodMorning: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const hip = mix([206, FLOOR - 89], [184, 214], p);
      const torso = lerp(0.06, 1.25, p);
      const s = shoulderOf(hip, torso);
      const b = along(s, torso, -13, 7);
      return { hip, torso, head: -torso * 0.5, hand: b, elbow: -1, foot: [214, FLOOR], knee: -1, load: b, effort: p, z: { hand: 46, elbow: 50, foot: 18 } };
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
      return { hip, torso, head: lerp(0.6, 0.9, p), hand: add(bar, -10, 4), elbow: 1, foot: [252, FLOOR], knee: 1, load: bar, effort: p, z: { hand: 44, foot: 24, knee: 26 } };
    }
  },
  kickbackLeg: {
    props: [],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [196, 206];
      const torso = 0.55;
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: -0.4,
        hand: add(s, 30, 34),
        elbow: 1,
        foot: mix([200, FLOOR - 6], [120, 228], p),
        foot2: [206, FLOOR],
        knee: -1,
        knee2: -1,
        toe: lerp(0, 0.9, p),
        effort: p,
        z: { foot: 16, knee: 16, hand: 30 }
      };
    }
  },
  abduction: {
    props: ['seat', 'backrest'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      // Сбоку почти не видно: ноги расходятся вбок. Спереди — во всю ширину.
      const torso = -0.08;
      const s = shoulderOf(SEAT, torso);
      return { hip: SEAT, torso, hand: add(s, 4, 46), elbow: 1, foot: [244, 278], knee: -1, toe: -0.2, effort: p, z: { knee: lerp(18, 54, p), foot: lerp(18, 56, p), hand: 40 } };
    }
  },
  calf: {
    props: ['step'],
    load: 'dumbbell',
    tempo: 'rep',
    pose: (p, gear) => {
      const rise = 13 * p;
      const hip: P = [206, FLOOR - 101 - rise];
      const s = shoulderOf(hip, 0.02);
      const legs = { foot: [210, FLOOR - 12 - rise] as P, knee: -1 as const, toe: 0.55 * p, effort: p };
      if (gear === 'barbell' || gear === 'smith' || gear === 'machine') {
        const b = along(s, 0.02, -13, 7);
        return { hip, torso: 0.02, hand: b, elbow: -1, load: b, ...legs, z: { hand: 46, elbow: 50, foot: 16, knee: 17 } };
      }
      return { hip, torso: 0.02, hand: add(s, 4, ARM - 4), elbow: 1, ...legs, z: { hand: 38, foot: 16, knee: 17 } };
    }
  },
  seatedCalf: {
    props: ['seat'],
    load: 'roller',
    tempo: 'rep',
    pose: (p) => {
      const torso = 0.12;
      const s = shoulderOf(SEAT, torso);
      const foot: P = [238, lerp(286, 274, p)];
      return { hip: SEAT, torso, hand: add(s, 30, 30), elbow: 1, foot, knee: -1, toe: 0.5 * p, pad: [234, lerp(234, 222, p)], effort: p, z: { foot: 18, knee: 18, hand: 30 } };
    }
  },

  // Спина
  row: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      // Наклон градусов на шестьдесят, спина ровная, колени чуть согнуты.
      // Плечи над грифом, гриф над серединой стопы; внизу блины почти
      // касаются пола, наверху гриф у низа живота, локти уходят назад-вверх.
      const hip: P = [172, 220];
      const torso = 1.05;
      const s = shoulderOf(hip, torso);
      const bottom: P = [s[0] + 1, Math.min(s[1] + ARM - 3, GROUND - 29)];
      const belly = along(hip, torso, 27, 28);
      return { hip, torso, head: -0.8, hand: mix(bottom, belly, p), elbow: 1, foot: [214, FLOOR], knee: -1, effort: p, z: { hand: 33, elbow: lerp(34, 44, p), foot: 18 } };
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
        effort: p,
        z: { hand: 18, elbow: lerp(22, 36, p), foot: 22, knee: 24 }
      };
    }
  },
  invertedRow: {
    props: ['lowBar'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      // Под перекладиной, тело прямое от пяток до плеч, грудь тянется к грифу.
      // Тело — жёсткая доска, которая поворачивается вокруг пяток: плечи идут
      // по дуге к грифу, а не растягивают тело.
      const bar: P = [150, 196];
      const feet: P = [292, FLOOR - 2];
      const a = lerp(0.23, 0.573, p);
      const s: P = [feet[0] - 147.5 * Math.cos(a), feet[1] - 147.5 * Math.sin(a)];
      const { hip, torso } = lineFrom(s, feet);
      return { hip, torso, head: 0.1, hand: bar, elbow: 1, foot: feet, knee: 1, toe: -0.4, effort: p, z: { hand: 40, elbow: 50, foot: 12, knee: 13 } };
    }
  },
  pullup: {
    props: ['bar'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const torso = lerp(-0.06, 0.08, p);
      const s = mix([205, 44 + ARM - 2], [207, 58], p);
      const hip = hipFrom(s, torso);
      return { hip, torso, head: lerp(-0.05, -0.2, p), hand: [212, 44], elbow: -1, foot: add(hip, -26, 76), knee: 1, toe: 0.5, effort: p, z: { hand: 48, elbow: lerp(52, 64, p), foot: 8, knee: 12 } };
    }
  },
  muscleUp: {
    props: ['barLow'],
    load: 'none',
    tempo: 'cycle',
    period: 3.2,
    pose: (p) => {
      // Подтянулся грудью к грифу — перевалился через него — выжал себя на
      // прямые руки, и обратно тем же путём. Плечи обходят кисти дугой спереди,
      // а не проходят сквозь них: иначе локоть перещёлкивается.
      const bar: P = [214, 96];
      const HANG: P = [206, 96 + ARM - 3];
      const PULL: P = [200, 120];
      const OVER: P = [227, 104];
      const TOP: P = [220, 62];
      const k = keyed(
        [
          { at: 0, hip: HANG, torso: -0.06, hand: bar, foot: HANG },
          { at: 0.3, hip: PULL, torso: 0.1, hand: bar, foot: PULL },
          { at: 0.42, hip: OVER, torso: 0.3, hand: bar, foot: OVER },
          { at: 0.55, hip: TOP, torso: 0.2, hand: bar, foot: TOP },
          { at: 0.68, hip: TOP, torso: 0.2, hand: bar, foot: TOP },
          { at: 0.8, hip: OVER, torso: 0.3, hand: bar, foot: OVER },
          { at: 0.9, hip: PULL, torso: 0.1, hand: bar, foot: PULL },
          { at: 1, hip: HANG, torso: -0.06, hand: bar, foot: HANG }
        ],
        p
      );
      const s = k.hip;
      const torso = k.torso;
      const hip = hipFrom(s, torso);
      const effort = span(p, 0, 0.3) * (1 - span(p, 0.55, 0.7)) + span(p, 0.8, 0.9) * (1 - span(p, 0.9, 1)) * 0.5;
      return { hip, torso, head: 0, hand: bar, elbow: -1, foot: add(hip, -42, 56), knee: 1, toe: 0.5, effort, z: { hand: 40, elbow: 50, foot: 8, knee: 12 } };
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
        effort: p,
        z: { hand: 52, elbow: lerp(56, 62, p), knee: 24, foot: 26 }
      };
    }
  },
  backExt: {
    props: ['hyper'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      // 0 — корпус продолжает линию ног, 1 — свесился вниз.
      const hip: P = [198, 222];
      const torso = lerp(0.72, 2.3, p);
      const s = shoulderOf(hip, torso);
      return { hip, torso, head: -0.2, hand: along(s, torso, 12, -4), elbow: 1, foot: [150, 284], knee: 1, toe: 0.3, effort: 1 - p, z: { hand: 14, elbow: 34, foot: 14, knee: 15 } };
    }
  },
  superman: {
    props: ['mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      // Лёжа на животе головой вправо: руки, грудь и ноги отрываются от пола.
      const hip: P = [186, 266];
      const torso = Math.PI / 2 - lerp(0.02, 0.28, p);
      const s = shoulderOf(hip, torso);
      return { hip, torso, head: -0.15 - 0.15 * p, hand: add(s, 72, lerp(8, -16, p)), elbow: 1, foot: [100, lerp(288, 268, p)], knee: -1, toe: 1.4, effort: p, z: { hand: 34, elbow: 34, foot: 14, knee: 15 } };
    }
  },

  // Руки
  curl: {
    props: [],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const s = shoulderOf(STAND, 0.02);
      const elbowAt = add(s, 1, BODY.upper - 0.5);
      return { hip: STAND, torso: 0.02, hand: arc(elbowAt, BODY.fore - 0.5, lerp(0.05, 2.55, p)), elbow: 1, foot: FOOT, knee: -1, effort: p, z: { hand: 30, elbow: 32 } };
    }
  },
  concentration: {
    props: ['seat'],
    load: 'dumbbell',
    tempo: 'rep',
    pose: (p) => {
      const torso = 0.7;
      const s = shoulderOf(SEAT, torso);
      const elbowAt = add(s, 18, 34);
      return {
        hip: SEAT,
        torso,
        head: -0.5,
        hand: arc(elbowAt, BODY.fore - 0.5, lerp(0.15, 2.7, p)),
        hand2: add(s, 30, 44),
        elbow: 1,
        foot: SEAT_FEET,
        knee: -1,
        effort: p,
        z: { hand: 14, elbow: 16, knee: 40, foot: 42 }
      };
    }
  },
  preacher: {
    props: ['seat', 'preacherPad'],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      const torso = 0.25;
      const s = shoulderOf(SEAT, torso);
      const elbowAt = arc(s, BODY.upper - 0.5, 0.85);
      return { hip: SEAT, torso, head: -0.2, hand: arc(elbowAt, BODY.fore - 0.5, lerp(0.95, 2.85, p)), elbow: -1, foot: SEAT_FEET, knee: -1, effort: p, z: { hand: 26, elbow: 24, knee: 24, foot: 26 } };
    }
  },
  wristCurl: {
    props: ['seat'],
    load: 'plate',
    tempo: 'rep',
    pose: (p) => {
      // Предплечья лежат на бёдрах, ходят только кисти.
      const torso = 0.5;
      return { hip: SEAT, torso, head: -0.4, hand: [258, lerp(250, 238, p)], elbow: 1, foot: SEAT_FEET, knee: -1, effort: p * 0.6, z: { hand: 22, elbow: 22, knee: 22 } };
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
      return { hip: STAND, torso, head: -0.1, hand: arc(elbowAt, BODY.fore - 0.5, lerp(2.2, 0.12, p)), elbow: 1, foot: FOOT, knee: -1, pulley: [s[0] + 44, 22], effort: p, z: { hand: 16, elbow: 30 } };
    }
  },
  overheadExt: {
    props: [],
    load: 'singleDb',
    tempo: 'rep',
    pose: (p) => {
      // Плечо вертикально вверх у головы, работает только предплечье.
      const s = shoulderOf(STAND, 0.02);
      const elbowAt = add(s, 3, -BODY.upper + 0.5);
      return { hip: STAND, torso: 0.02, head: 0.05, hand: arc(elbowAt, BODY.fore - 0.5, lerp(Math.PI + 0.05, TAU - 0.5, p)), elbow: -1, foot: FOOT, knee: -1, effort: p, z: { hand: 10, elbow: 22 } };
    }
  },
  kickback: {
    props: [],
    load: 'dumbbell',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [190, 214];
      const torso = 1.1;
      const s = shoulderOf(hip, torso);
      const d = dirOf(torso);
      const elbowAt: P = [s[0] - d[0] * 38, s[1] - d[1] * 38 + 4];
      return { hip, torso, head: -0.85, hand: arc(elbowAt, BODY.fore - 0.5, lerp(0.05, -1.1, p)), elbow: -1, foot: [216, FLOOR], knee: -1, effort: p, z: { hand: 30, elbow: 32 } };
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
      return { hip, torso, head: 0.1, hand: arc(elbowAt, BODY.fore - 0.5, lerp(Math.PI + 0.25, Math.PI + 2.35, p)), elbow: -1, foot: [266, FLOOR], knee: -1, effort: p, z: { hand: 22, elbow: 26 } };
    }
  },

  // Пресс
  plank: {
    props: ['mat'],
    load: 'none',
    tempo: 'hold',
    pose: (p) => {
      // На предплечьях: плечо над локтем, предплечье лежит вперёд.
      const feet: P = [104, FLOOR - 2];
      const s: P = [244, FLOOR - 44 - 1.5 * p];
      const { hip, torso } = lineFrom(s, feet);
      return { hip, torso, head: -0.2, hand: [282, FLOOR - 4], elbow: 1, foot: feet, knee: 1, toe: 1.5, effort: 0.4, z: { hand: 14, elbow: 26, foot: 12, knee: 13 } };
    }
  },
  sidePlank: {
    props: ['mat'],
    load: 'none',
    tempo: 'hold',
    pose: (p) => {
      const feet: P = [104, FLOOR - 2];
      const s: P = [244, FLOOR - 44 - 1.5 * p];
      const { hip, torso } = lineFrom(s, feet);
      return { hip, torso, head: -0.2, hand: [282, FLOOR - 4], hand2: add(s, 4, -ARM + 6), elbow: 1, elbow2: -1, foot: feet, knee: 1, toe: 1.5, effort: 0.45, lean: 0.12, z: { hand: 14, elbow: 26, foot: 4, knee: 6 } };
    }
  },
  crunch: {
    props: ['mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [204, 276];
      const torso = lerp(-Math.PI / 2 + 0.06, -Math.PI / 2 + 0.62, p);
      const neck = neckOf(hip, torso);
      return { hip, torso, head: lerp(0.05, 0.35, p), hand: add(neck, -10, -8), elbow: -1, foot: [258, FLOOR], knee: 1, effort: p, z: { hand: 12, elbow: 40, knee: 16, foot: 18 } };
    }
  },
  situp: {
    props: ['mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [204, 282];
      const torso = lerp(-Math.PI / 2 + 0.05, 0.05, p);
      const neck = neckOf(hip, torso);
      return { hip, torso, head: lerp(0.1, -0.1, p), hand: along(neck, torso, -6, 6), elbow: -1, foot: [258, FLOOR], knee: 1, effort: Math.sin(Math.PI * p), z: { hand: 12, elbow: 42, knee: 16, foot: 18 } };
    }
  },
  vUp: {
    props: ['mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [200, 284];
      const torso = lerp(-Math.PI / 2 + 0.03, -0.65, p);
      const foot = arc(hip, 86, lerp(Math.PI / 2 - 0.03, 2.45, p));
      const s = shoulderOf(hip, torso);
      // Прямые руки идут дугой из-за головы к носкам, а не сквозь плечо.
      return { hip, torso, head: 0.2, hand: arc(s, ARM - 4, lerp(-Math.PI / 2 - 0.05, -1.25 * Math.PI, p)), elbow: -1, foot, knee: 1, toe: 0.6, effort: p, z: { hand: 26, elbow: 30, foot: 8, knee: 10 } };
    }
  },
  legRaise: {
    props: ['mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const hip: P = [200, 284];
      const torso = -Math.PI / 2 + 0.03;
      return { hip, torso, head: 0.15, hand: add(hip, -8, 8), elbow: 1, foot: arc(hip, 86, lerp(Math.PI / 2 - 0.03, Math.PI - 0.12, p)), knee: 1, toe: 0.6, effort: p, z: { hand: 30, elbow: 34, foot: 8, knee: 10 } };
    }
  },
  hangRaise: {
    props: ['bar'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const s: P = [205, 44 + ARM - 2];
      const torso = lerp(-0.06, -0.24, p);
      const hip = hipFrom(s, torso);
      return { hip, torso, head: 0.1, hand: [212, 44], elbow: -1, foot: arc(hip, 88, lerp(0.05, Math.PI / 2 + 0.1, p)), knee: 1, effort: p, z: { hand: 46, elbow: 50, foot: 8, knee: 10 } };
    }
  },
  cableCrunch: {
    props: [],
    load: 'handle',
    tempo: 'rep',
    pose: (p) => {
      // На коленях под верхним блоком: скручивается позвоночник, таз стоит.
      const hip: P = [214, 242];
      const torso = lerp(0.15, 1.2, p);
      const neck = neckOf(hip, torso);
      return { hip, torso, head: lerp(0, 0.4, p), hand: along(neck, torso, 10, 6), elbow: -1, foot: [174, FLOOR - 4], knee: 1, toe: 1.2, pulley: [246, 16], effort: p, z: { hand: 10, elbow: 30, knee: 18, foot: 18 } };
    }
  },
  russianTwist: {
    props: ['mat'],
    load: 'kettlebell',
    tempo: 'cycle',
    period: 2.2,
    pose: (p) => {
      const hip: P = [204, 282];
      const torso = -0.55;
      const s = shoulderOf(hip, torso);
      const side = Math.sin(TAU * p);
      return { hip, torso, head: 0.2, hand: along(s, torso, 30 + 4 * side, -14), elbow: 1, foot: [262, 266], knee: -1, toe: -0.3, effort: 0.5 + 0.3 * Math.abs(side), shift: 44 * side, z: { hand: 6, elbow: 30, knee: 14, foot: 12 } };
    }
  },
  sideBend: {
    props: [],
    load: 'dumbbell',
    tempo: 'cycle',
    period: 2.6,
    pose: (p) => {
      const s = shoulderOf(STAND, 0.02);
      const side = Math.sin(TAU * p);
      return { hip: STAND, torso: 0.02, hand: add(s, 4, ARM - 4), elbow: 1, foot: FOOT, knee: -1, effort: Math.abs(side) * 0.5, lean: 0.32 * side, z: { hand: 34, foot: 22 } };
    }
  },
  abWheel: {
    props: ['mat'],
    load: 'wheel',
    tempo: 'rep',
    pose: (p) => {
      const hip = mix([186, 246], [214, 264], p);
      const torso = lerp(0.75, 1.45, p);
      return { hip, torso, head: -0.5, hand: mix([233, FLOOR - 12], [298, FLOOR - 12], p), elbow: 1, foot: [140, FLOOR - 4], knee: 1, toe: 1.3, effort: p, z: { hand: 16, elbow: 26, knee: 14, foot: 14 } };
    }
  },
  climber: {
    props: ['mat'],
    load: 'none',
    tempo: 'cycle',
    period: 1.1,
    pose: (p) => {
      const feet: P = [96, FLOOR - 2];
      const { hip, torso: angle } = lineFrom([228, FLOOR - ARM + 6], feet);
      const a = wave(p);
      const b = wave(p + 0.5);
      return {
        hip,
        torso: angle,
        head: -0.25,
        hand: [232, FLOOR],
        elbow: 1,
        foot: mix(feet, [168, FLOOR - 14], a),
        foot2: mix(feet, [168, FLOOR - 14], b),
        knee: 1,
        knee2: 1,
        toe: 1.5,
        toe2: 1.5,
        effort: 0.6,
        z: { hand: 40, elbow: 46, foot: 14, knee: 16 }
      };
    }
  },

  // Олимпийка и всё тело
  clean: {
    props: [],
    load: 'plate',
    tempo: 'cycle',
    period: 3.2,
    pose: (p) => {
      // Тяга с пола → подрыв → подсед с грифом на груди → встал → опустил.
      const STANDK = { hip: [208, FLOOR - 89] as P, torso: 0.03 };
      const k = keyed(
        [
          { at: 0, hip: [174, 230], torso: 1.0, hand: [222, FLOOR - 27], foot: [218, FLOOR] },
          { at: 0.3, hip: [204, 214], torso: 0.25, hand: [215, 232], foot: [218, FLOOR] },
          { at: 0.4, hip: [210, 200], torso: -0.05, hand: [222, 172], foot: [218, FLOOR - 6], toe: 0.6 },
          { at: 0.5, hip: [196, 238], torso: 0.3, hand: [238, 168], foot: [218, FLOOR] },
          { at: 0.68, hip: STANDK.hip, torso: STANDK.torso, hand: [228, 156], foot: [218, FLOOR] },
          { at: 0.84, hip: [204, 214], torso: 0.25, hand: [215, 232], foot: [218, FLOOR] },
          { at: 1, hip: [174, 230], torso: 1.0, hand: [222, FLOOR - 27], foot: [218, FLOOR] }
        ],
        p
      );
      return { hip: k.hip, torso: k.torso, head: -k.torso * 0.5, hand: k.hand, elbow: -1, foot: k.foot, knee: -1, toe: k.toe, effort: 1 - 0.5 * span(p, 0.5, 0.62), z: { hand: 32, elbow: 38, foot: 20, knee: 22 } };
    }
  },
  snatch: {
    props: [],
    load: 'plate',
    tempo: 'cycle',
    period: 3.4,
    pose: (p) => {
      const k = keyed(
        [
          // Гриф идёт вплотную к телу, но перед ним, а не сквозь плечо: на
          // высоком подрыве — на уровне груди, локти вверх и в стороны.
          { at: 0, hip: [172, 234], torso: 1.05, hand: [222, GROUND - 28], foot: [218, FLOOR] },
          { at: 0.28, hip: [204, 216], torso: 0.3, hand: [214, 238], foot: [218, FLOOR] },
          { at: 0.36, hip: [210, 198], torso: -0.06, hand: [222, 196], foot: [218, FLOOR - 6], toe: 0.6 },
          { at: 0.44, hip: [206, 204], torso: 0, hand: [237, 150], foot: [218, FLOOR - 2], toe: 0.2 },
          { at: 0.53, hip: [190, 256], torso: 0.3, hand: [214, 126], foot: [218, FLOOR] },
          { at: 0.72, hip: [208, FLOOR - 89], torso: 0.03, hand: [212, 72], foot: [218, FLOOR] },
          { at: 0.79, hip: [208, FLOOR - 89], torso: 0.03, hand: [238, 150], foot: [218, FLOOR] },
          { at: 0.88, hip: [204, 216], torso: 0.3, hand: [214, 238], foot: [218, FLOOR] },
          { at: 1, hip: [172, 234], torso: 1.05, hand: [222, GROUND - 28], foot: [218, FLOOR] }
        ],
        p
      );
      return { hip: k.hip, torso: k.torso, head: -k.torso * 0.5, hand: k.hand, elbow: -1, foot: k.foot, knee: -1, toe: k.toe, effort: 1 - 0.5 * span(p, 0.55, 0.68), z: { hand: 66, elbow: 62, foot: 22, knee: 26 } };
    }
  },
  thruster: {
    props: [],
    load: 'plate',
    tempo: 'cycle',
    period: 2.8,
    pose: (p) => {
      const d = p < 0.35 ? span(p, 0, 0.35) : 1 - span(p, 0.35, 0.55);
      const press = span(p, 0.4, 0.58) - span(p, 0.75, 1);
      const sq = squatPose(d, 'front');
      const s = shoulderOf(sq.hip, sq.torso);
      return { ...sq, hand: mix(sq.hand, add(s, 3, -ARM + 3), press), load: undefined, effort: Math.max(d, press * 0.7), z: { foot: 26, knee: 30, hand: 34, elbow: lerp(30, 38, press) } };
    }
  },
  kbSwing: {
    props: [],
    load: 'kettlebell',
    tempo: 'cycle',
    period: 1.8,
    pose: (p) => {
      const d = wave(p);
      const hip = mix([206, FLOOR - 89], [184, 216], d);
      const torso = lerp(0.05, 1.05, d);
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: -torso * 0.6,
        hand: mix(arc(s, ARM - 6, Math.PI / 2 - 0.05), [hip[0] + 14, hip[1] + 40], d),
        elbow: 1,
        foot: [214, FLOOR],
        knee: -1,
        effort: 1 - d,
        z: { hand: 6, elbow: 22, foot: 26, knee: 26 }
      };
    }
  },
  burpee: {
    props: ['mat'],
    load: 'none',
    tempo: 'cycle',
    period: 4.2,
    pose: (p) => {
      const STANDK: Omit<Key, 'at'> = { hip: [206, FLOOR - 89], torso: 0.03, hand: [212, 222], foot: [212, FLOOR] };
      const SQUATK: Omit<Key, 'at'> = { hip: [196, 262], torso: 0.95, hand: [238, FLOOR], foot: [214, FLOOR] };
      const PLANKK: Omit<Key, 'at'> = { hip: [174, 250], torso: 1.06, hand: [232, FLOOR], foot: [96, FLOOR - 2], toe: 1.5 };
      const PBOT: Omit<Key, 'at'> = { hip: [183, 270], torso: 1.36, hand: [232, FLOOR], foot: [96, FLOOR - 2], toe: 1.5 };
      const AIRK: Omit<Key, 'at'> = { hip: [206, 182], torso: 0.02, hand: [216, 70], foot: [212, 272], toe: 0.9 };
      const k = keyed(
        [
          { at: 0, ...STANDK },
          { at: 0.14, ...SQUATK },
          { at: 0.26, ...PLANKK },
          { at: 0.38, ...PBOT },
          { at: 0.48, ...PLANKK },
          { at: 0.6, ...SQUATK },
          // Руки идут вверх и вниз перед грудью, а не сквозь плечо.
          { at: 0.67, hip: [202, 226], torso: 0.4, hand: [256, 196], foot: [212, FLOOR] },
          { at: 0.74, ...AIRK },
          { at: 0.8, hip: [206, 206], torso: 0.05, hand: [244, 156], foot: [212, FLOOR - 2], toe: 0.3 },
          { at: 0.88, ...STANDK },
          { at: 1, ...STANDK }
        ],
        p
      );
      return { hip: k.hip, torso: k.torso, head: -k.torso * 0.3, hand: k.hand, elbow: 1, foot: k.foot, knee: -1, toe: k.toe, effort: 0.7, z: { hand: 34, elbow: 44, foot: 16, knee: 18 } };
    }
  },
  boxJump: {
    props: ['box'],
    load: 'none',
    tempo: 'cycle',
    period: 3.0,
    pose: (p) => {
      const k = keyed(
        [
          { at: 0, hip: [182, FLOOR - 89], torso: 0.04, hand: [190, 222], foot: [188, FLOOR] },
          { at: 0.22, hip: [170, 246], torso: 0.7, hand: [150, 248], foot: [190, FLOOR] },
          { at: 0.42, hip: [214, 150], torso: 0.3, hand: [262, 118], foot: [224, 232], toe: 0.6 },
          { at: 0.56, hip: [250, 200], torso: 0.55, hand: [292, 182], foot: [262, 250] },
          { at: 0.74, hip: [258, 161], torso: 0.03, hand: [264, 176], foot: [264, 250] },
          { at: 0.88, hip: [214, 196], torso: 0.1, hand: [224, 212], foot: [206, 284] },
          { at: 1, hip: [182, FLOOR - 89], torso: 0.04, hand: [190, 222], foot: [188, FLOOR] }
        ],
        p
      );
      return { hip: k.hip, torso: k.torso, head: -k.torso * 0.4, hand: k.hand, elbow: -1, foot: k.foot, knee: -1, toe: k.toe, effort: 0.6, z: { hand: 30, elbow: 36, foot: 18, knee: 20 } };
    }
  },
  jumpRope: {
    props: [],
    load: 'jumpRope',
    tempo: 'cycle',
    period: 1.0,
    pose: (p) => {
      const lift = 7 * Math.abs(Math.sin(TAU * p));
      const hip: P = [206, FLOOR - 90 - lift];
      const s = shoulderOf(hip, 0.03);
      return { hip, torso: 0.03, hand: add(s, 16, 56), elbow: 1, foot: [212, FLOOR - lift], knee: -1, toe: 0.7, effort: 0.4, spin: TAU * p, z: { hand: 46, elbow: 34, foot: 10, knee: 12 } };
    }
  },
  jumpingJack: {
    props: [],
    load: 'none',
    tempo: 'cycle',
    period: 1.4,
    pose: (p) => {
      const k = wave(p);
      const lift = 6 * Math.abs(Math.sin(TAU * p));
      const hip: P = [206, FLOOR - 89 - lift];
      const s = shoulderOf(hip, 0.02);
      return {
        hip,
        torso: 0.02,
        // Руки идут через стороны: сбоку видна только проекция, cos угла.
        hand: add(s, 2, Math.cos(Math.PI * k) * (ARM - 6)),
        reach: Math.max(0.18, Math.abs(Math.cos(Math.PI * k))),
        elbow: -1,
        foot: [212, FLOOR - lift],
        knee: -1,
        toe: 0.4,
        effort: 0.4,
        z: { hand: lerp(32, 36, k) + 74 * Math.sin(Math.PI * k), elbow: lerp(34, 30, k) + 40 * Math.sin(Math.PI * k), foot: lerp(16, 50, k), knee: lerp(17, 42, k) }
      };
    }
  },
  slam: {
    props: [],
    load: 'ball',
    tempo: 'cycle',
    period: 2.8,
    pose: (p) => {
      const k = keyed(
        [
          { at: 0, hip: [194, 252], torso: 0.8, hand: [246, 280], foot: [214, FLOOR] },
          { at: 0.2, hip: [200, 226], torso: 0.4, hand: [258, 186], foot: [214, FLOOR] },
          { at: 0.38, hip: [206, 198], torso: -0.08, hand: [206, 82], foot: [214, FLOOR - 6], toe: 0.5 },
          { at: 0.44, hip: [198, 214], torso: 0.45, hand: [262, 168], foot: [214, FLOOR - 2], toe: 0.2 },
          { at: 0.5, hip: [190, 232], torso: 1.0, hand: [252, 270], foot: [214, FLOOR] },
          { at: 0.72, hip: [194, 252], torso: 0.85, hand: [246, 280], foot: [214, FLOOR] },
          { at: 1, hip: [194, 252], torso: 0.8, hand: [246, 280], foot: [214, FLOOR] }
        ],
        p
      );
      return { hip: k.hip, torso: k.torso, head: -k.torso * 0.4, hand: k.hand, elbow: -1, foot: k.foot, knee: -1, toe: k.toe, effort: 0.4 + 0.6 * span(p, 0.28, 0.38) * (1 - span(p, 0.5, 0.62)), z: { hand: 16, elbow: 34, foot: 24, knee: 26 } };
    }
  },
  ropes: {
    props: ['anchor'],
    load: 'ropes',
    tempo: 'cycle',
    period: 1.0,
    pose: (p) => {
      const hip: P = [192, 240];
      const torso = 0.35;
      const s = shoulderOf(hip, torso);
      const w = Math.sin(TAU * p);
      return {
        hip,
        torso,
        head: -0.3,
        hand: add(s, 42, 42 - 22 * w),
        hand2: add(s, 38, 42 + 22 * w),
        elbow: 1,
        elbow2: 1,
        foot: [218, FLOOR],
        knee: -1,
        effort: 0.8,
        spin: TAU * p,
        z: { hand: 26, elbow: 40, foot: 28, knee: 30 }
      };
    }
  },

  // Кардио
  run: { props: [], load: 'none', tempo: 'cycle', period: 0.8, pose: (p) => gait(p, 32, 34, 0.18, 4, 24) },
  treadmill: { props: ['treadmill'], load: 'none', tempo: 'cycle', period: 0.8, pose: (p) => gait(p, 31, 32, 0.16, 4, 22) },
  walk: { props: [], load: 'none', tempo: 'cycle', period: 1.5, pose: (p) => gait(p, 22, 12, 0.05, 2, 12) },
  cycle: {
    props: ['bike'],
    load: 'none',
    tempo: 'cycle',
    period: 1.1,
    pose: (p) => {
      const hip: P = [192, 214];
      const torso = 0.66;
      const crank: P = [224, 266];
      const a = TAU * p;
      return {
        hip,
        torso,
        head: -0.55,
        hand: [262, 200],
        elbow: 1,
        foot: [crank[0] + 17 * Math.sin(a), crank[1] - 17 * Math.cos(a)],
        foot2: [crank[0] - 17 * Math.sin(a), crank[1] + 17 * Math.cos(a)],
        knee: -1,
        knee2: -1,
        toe: 0.2,
        toe2: 0.2,
        effort: 0.5,
        z: { hand: 30, elbow: 40, foot: 14, knee: 15 }
      };
    }
  },
  rowErg: {
    props: ['rower'],
    load: 'seatSlide',
    tempo: 'cycle',
    period: 2.4,
    pose: (p) => {
      // Толчок ногами, корпус назад, руки к поясу — и медленно обратно.
      const k = p < 0.4 ? span(p, 0, 0.4) : 1 - span(p, 0.4, 1);
      const hip = mix([196, 262], [150, 262], k);
      const torso = lerp(0.5, -0.35, k);
      const s = shoulderOf(hip, torso);
      return {
        hip,
        torso,
        head: -torso * 0.5,
        hand: mix(add(s, ARM - 6, 16), along(s, torso, 18, -30), span(k, 0.45, 1)),
        elbow: 1,
        foot: [238, 270],
        knee: -1,
        toe: -0.6,
        pulley: [292, 244],
        pad: [hip[0], hip[1] + 12],
        effort: k,
        z: { hand: 10, elbow: 34, foot: 14, knee: 18 }
      };
    }
  },
  swim: {
    props: ['water'],
    load: 'none',
    tempo: 'cycle',
    period: 1.8,
    pose: (p) => {
      // Кроль: лицом в воду головой вправо, руки по кругу, ноги — мелко.
      const hip: P = [172, 238];
      const torso = Math.PI / 2 - 0.06;
      const s = shoulderOf(hip, torso);
      const a = Math.PI / 2 - TAU * p;
      const kick = Math.sin(2 * TAU * p);
      return {
        hip,
        torso,
        head: -0.1,
        hand: arc(s, ARM - 6, a),
        hand2: arc(s, ARM - 6, a + Math.PI),
        elbow: -1,
        elbow2: -1,
        foot: [88, 244 + 8 * kick],
        foot2: [88, 244 - 8 * kick],
        knee: -1,
        knee2: -1,
        toe: 1.4,
        toe2: 1.4,
        effort: 0.5,
        z: { hand: 26, elbow: 34, foot: 10, knee: 12 }
      };
    }
  },
  yoga: {
    props: ['mat'],
    load: 'none',
    tempo: 'hold',
    pose: (p) => {
      // Собака мордой вниз: таз вверх, руки и пятки тянутся к полу.
      const hip: P = [196, 222 - 3 * p];
      return { hip, torso: 2.18, head: 0.5, hand: [300, FLOOR], elbow: 1, foot: [148, FLOOR], knee: 1, toe: -0.2, effort: 0.2, z: { hand: 34, elbow: 36, foot: 18, knee: 18 } };
    }
  },


  // Добавлено к каталогу Strong
  floorPress: { props: ['mat'], load: 'plate', tempo: 'rep', pose: pressLying([226, FLOOR - 20], -Math.PI / 2 + 0.04, [262, FLOOR], 50, [14, -8]) },
  adduction: {
    props: ['seat', 'backrest'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const torso = -0.08;
      const s = shoulderOf(SEAT, torso);
      return { hip: SEAT, torso, hand: add(s, 4, 46), elbow: 1, foot: [244, 278], knee: -1, toe: -0.2, effort: p, z: { knee: lerp(54, 18, p), foot: lerp(56, 18, p), hand: 40 } };
    }
  },
  calfPress: {
    props: ['press'],
    load: 'platform',
    tempo: 'rep',
    pose: (p) => {
      // Ноги прямые, работает только голеностоп: платформа уходит на длину стопы.
      const hip: P = [150, 250];
      const u: P = [0.816, -0.578];
      const foot: P = [hip[0] + u[0] * 88, hip[1] + u[1] * 88];
      return { hip, torso: -0.95, head: 0.45, hand: [164, 262], elbow: 1, foot, knee: 1, toe: lerp(-1.05, -0.35, p), pad: [foot[0] + u[0] * (10 + 8 * p), foot[1] + u[1] * (10 + 8 * p)], effort: p, z: { foot: 24, knee: 24, hand: 40 } };
    }
  },
  bridge: {
    props: ['mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      // Лопатки на полу, одна стопа упирается, другая нога вытянута вверх.
      // Опора — лопатки и затылок: корпус поворачивается вокруг шеи, а не плеча.
      const neck: P = [126, FLOOR - 22];
      const torso = lerp(-Math.PI / 2 - 0.05, -Math.PI / 2 - 0.5, p);
      const up = dirOf(torso);
      const hip: P = [neck[0] - up[0] * BODY.torso, neck[1] - up[1] * BODY.torso];
      return { hip, torso, head: lerp(0.15, 0.55, p), hand: [hip[0] - 22, FLOOR - 2], elbow: 1, foot: [256, FLOOR], foot2: add(hip, 72, -54), knee: -1, knee2: -1, toe2: 0.4, effort: p, z: { hand: 40, elbow: 40, foot: 16, knee: 16 } };
    }
  },
  reversePlank: {
    props: ['mat'],
    load: 'none',
    tempo: 'hold',
    pose: (p) => {
      // Лицом вверх на ладонях и пятках: от пяток до плеч прямая.
      const s: P = [166, FLOOR - 70 - 2 * p];
      const { hip, torso } = lineFrom(s, [296, FLOOR - 4]);
      return { hip, torso, head: 0.3, hand: [160, FLOOR], elbow: -1, foot: [296, FLOOR - 4], knee: -1, toe: -0.5, effort: 0.45, z: { hand: 34, elbow: 36, foot: 12, knee: 13 } };
    }
  },
  bicycle: {
    props: ['mat'],
    load: 'none',
    tempo: 'cycle',
    period: 1.6,
    pose: (p) => {
      const hip: P = [204, FLOOR - 20];
      const torso = -Math.PI / 2 + 0.42;
      const neck = neckOf(hip, torso);
      const ext = add(hip, 86, -12);
      const bent = add(hip, 22, -40);
      const side = Math.sin(TAU * p);
      return {
        hip,
        torso,
        head: 0.3,
        hand: along(neck, torso, -6, 4),
        elbow: -1,
        foot: mix(ext, bent, wave(p)),
        foot2: mix(ext, bent, wave(p + 0.5)),
        knee: -1,
        knee2: -1,
        toe: 0.6,
        toe2: 0.6,
        effort: 0.5,
        shift: 22 * side,
        z: { hand: 12, elbow: 40, knee: 14, foot: 12 }
      };
    }
  },
  reverseCrunch: {
    props: ['mat'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      // Колени согнуты под прямым углом и тянутся к груди, таз отрывается от пола.
      const hip: P = [204, FLOOR - 20 - 10 * p];
      const torso = -Math.PI / 2 + 0.03 - 0.12 * p;
      const a = lerp(0.05, 0.75, p);
      const knee: P = [hip[0] - 46 * Math.sin(a), hip[1] - 46 * Math.cos(a)];
      return { hip, torso, head: 0.15, hand: add(hip, -24, 18), elbow: 1, foot: [knee[0] + 44 * Math.cos(a), knee[1] + 44 * Math.sin(a)], knee: -1, toe: 0.5, effort: p, z: { hand: 34, elbow: 36, knee: 14, foot: 12 } };
    }
  },
  hangKnee: {
    props: ['bar'],
    load: 'none',
    tempo: 'rep',
    pose: (p) => {
      const s: P = [205, 44 + ARM - 2];
      const torso = lerp(-0.06, -0.2, p);
      const hip = hipFrom(s, torso);
      return { hip, torso, head: 0.1, hand: [212, 44], elbow: -1, foot: add(hip, lerp(-6, 42, p), lerp(88, 40, p)), knee: -1, toe: 0.5, effort: p, z: { hand: 46, elbow: 50, foot: 10, knee: 12 } };
    }
  },
  twist: {
    props: [],
    load: 'handle',
    tempo: 'cycle',
    period: 2.6,
    pose: (p) => {
      const s = shoulderOf(STAND, 0.02);
      const side = Math.sin(TAU * p);
      return {
        hip: STAND,
        torso: 0.02,
        hand: add(s, (ARM - 8) * (1 - 0.4 * Math.abs(side)), 10),
        elbow: 1,
        foot: FOOT,
        knee: -1,
        effort: 0.3 + 0.4 * Math.abs(side),
        shift: 52 * side,
        pulley: [s[0] + 20, s[1] + 10],
        z: { hand: 8, elbow: 26, foot: 24, knee: 24, pulley: -150 }
      };
    }
  },
  getUp: {
    props: ['mat'],
    load: 'kettlebell',
    tempo: 'cycle',
    period: 7,
    pose: (p) => {
      // Лёжа → на локоть → на ладонь → мост → колено → встал, и обратно. Гиря всё время над плечом.
      const LIE: Omit<Key, 'at'> = { hip: [204, FLOOR - 20], torso: -1.54, hand: [0, 0], foot: [252, FLOOR], foot2: [292, FLOOR - 4] };
      const ELBOW: Omit<Key, 'at'> = { ...LIE, torso: -1.05 };
      const SIT: Omit<Key, 'at'> = { ...LIE, hip: [206, FLOOR - 18], torso: -0.35 };
      const BRIDGE: Omit<Key, 'at'> = { hip: [214, 246], torso: -0.5, hand: [0, 0], foot: [252, FLOOR], foot2: [266, FLOOR - 4] };
      const KNEEL: Omit<Key, 'at'> = { hip: [208, 232], torso: 0.04, hand: [0, 0], foot: [248, FLOOR], foot2: [156, FLOOR - 6], toe: 0 };
      const STANDK: Omit<Key, 'at'> = { hip: [206, FLOOR - 89], torso: 0.02, hand: [0, 0], foot: [214, FLOOR], foot2: [202, FLOOR] };
      const k = keyed(
        [
          { at: 0, ...LIE },
          { at: 0.1, ...ELBOW },
          { at: 0.2, ...SIT },
          { at: 0.3, ...BRIDGE },
          { at: 0.42, ...KNEEL },
          { at: 0.54, ...STANDK },
          { at: 0.62, ...STANDK },
          { at: 0.72, ...KNEEL },
          { at: 0.8, ...BRIDGE },
          { at: 0.88, ...SIT },
          { at: 0.94, ...ELBOW },
          { at: 1, ...LIE }
        ],
        p
      );
      const s = shoulderOf(k.hip, k.torso);
      // Встаёт плавно: свободная рука уходит с пола вниз вдоль тела, голова
      // переводит взгляд с гири вперёд — без переключения в момент «стоя».
      const up = span(Math.cos(k.torso), 0.25, 0.75);
      return {
        hip: k.hip,
        torso: k.torso,
        head: lerp(0.35, -0.1, up),
        hand: [s[0] + 2, s[1] - ARM + 3],
        hand2: mix([k.hip[0] - 30, FLOOR - 2], add(s, 2, ARM - 4), up),
        elbow: -1,
        elbow2: 1,
        foot: k.foot,
        foot2: k.foot2,
        knee: -1,
        knee2: 1,
        toe2: lerp(1.1, 0, up),
        effort: 0.5,
        z: { hand: 30, elbow: 30, foot: 18, knee: 20 }
      };
    }
  },
  highKnees: {
    props: [],
    load: 'none',
    tempo: 'cycle',
    period: 0.7,
    pose: (p) => {
      const footAt = (q: number): P => {
        const r = ((q % 1) + 1) % 1;
        const lift = r < 0.5 ? 0 : Math.sin((Math.PI * (r - 0.5)) / 0.5);
        return [212 + 18 * lift, FLOOR - 52 * lift];
      };
      const bob = 3 * Math.abs(Math.sin(TAU * p));
      const hip: P = [206, FLOOR - 86 - bob];
      const s = shoulderOf(hip, 0.04);
      const swing = Math.sin(TAU * p);
      return {
        hip,
        torso: 0.04,
        hand: add(s, 12 - 18 * swing, 44),
        hand2: add(s, 12 + 18 * swing, 44),
        elbow: 1,
        elbow2: 1,
        foot: footAt(p),
        foot2: footAt(p + 0.5),
        knee: -1,
        knee2: -1,
        toe: 0.6,
        toe2: 0.6,
        effort: 0.5,
        z: { hand: 30, elbow: 36, foot: 14, knee: 15 }
      };
    }
  },
  elliptical: {
    props: ['elliptical'],
    load: 'none',
    tempo: 'cycle',
    period: 1.4,
    pose: (p) => {
      const a = TAU * p;
      const hip: P = [204, 190 + 2 * Math.cos(2 * a)];
      const s = shoulderOf(hip, 0.06);
      return {
        hip,
        torso: 0.06,
        head: -0.05,
        hand: add(s, 26 + 14 * Math.sin(a), 18),
        hand2: add(s, 26 - 14 * Math.sin(a), 18),
        elbow: 1,
        elbow2: 1,
        foot: [212 + 22 * Math.cos(a), 270 - 8 * Math.sin(a)],
        foot2: [212 - 22 * Math.cos(a), 270 + 8 * Math.sin(a)],
        knee: -1,
        knee2: -1,
        effort: 0.3,
        z: { hand: 34, elbow: 40, foot: 16, knee: 17 }
      };
    }
  },
  skate: {
    props: [],
    load: 'none',
    tempo: 'cycle',
    period: 1.6,
    pose: (p) => {
      const g = gait(p, 30, 10, 0.55, 2, 28);
      return { ...g, hip: add(g.hip, -6, 14), head: -0.45, effort: 0.4, z: { foot: lerp(14, 34, wave(p)), knee: 18, hand: 30, elbow: 36 } };
    }
  },

  /**
   * День без тренировки: сидит на скамье в худи с капюшоном, подался вперёд,
   * локти вниз, сцепленные кулаки у рта — как Левроун на старом фото, — и
   * хмуро смотрит из-под капюшона: не качается, и это его бесит. Иногда
   * поднимает глаза на зрителя (это живость в `PugRig`). Дышит — `p` здесь не
   * глубина, а вдох. Спереди сидит лицом к нам.
   */
  rest: {
    props: ['sideBench', 'hood'],
    load: 'none',
    tempo: 'hold',
    period: 4.6,
    pose: (p) => {
      const hip: P = [214, 234];
      const torso = 0.5 + 0.015 * p;
      return {
        hip,
        torso,
        head: -0.26 - 0.02 * p,
        shrug: 1.6 * p,
        hand: [266, 176],
        elbow: 1,
        foot: [258, FLOOR],
        knee: -1,
        effort: 0,
        handsFront: true,
        elbowY: 236,
        z: { hand: 5, elbow: 30, knee: 22, foot: 26 }
      };
    }
  }
};

/**
 * Где дрожит, когда тяжело: в той мышце, что работает. В жиме — руки и гриф,
 * в приседе — колени (корпус с грифом ходит на дрожащих ногах), в планке —
 * таз, в подъёмах на носки — икры, в тренажёрах на ноги — голень с валиком.
 * На кардио и в рывках дрожи нет: там не держат, а двигаются.
 */
export type Zone = 'arms' | 'legs' | 'shins' | 'core' | 'calves' | 'none';

const ZONE_LIST: [Zone, Motion[]][] = [
  ['legs', ['squat', 'frontSquat', 'goblet', 'ohSquat', 'bwSquat', 'hackSquat', 'pistol', 'lunge', 'bulgarian', 'stepUp', 'legPress', 'deadlift', 'sumo', 'rackPull', 'rdl', 'goodMorning', 'abduction', 'adduction']],
  ['shins', ['legExt', 'legCurl', 'lyingLegCurl', 'kickbackLeg']],
  ['calves', ['calf', 'calfPress', 'seatedCalf']],
  ['core', ['plank', 'sidePlank', 'reversePlank', 'crunch', 'situp', 'vUp', 'legRaise', 'reverseCrunch', 'bicycle', 'hangRaise', 'hangKnee', 'cableCrunch', 'russianTwist', 'twist', 'sideBend', 'abWheel', 'climber', 'backExt', 'superman', 'hipThrust', 'bridge']],
  ['none', ['run', 'treadmill', 'walk', 'elliptical', 'cycle', 'rowErg', 'swim', 'skate', 'yoga', 'jumpRope', 'jumpingJack', 'highKnees', 'burpee', 'boxJump', 'jumpSquat', 'slam', 'ropes', 'getUp', 'clean', 'snatch', 'thruster', 'kbSwing']]
];
const ZONES = new Map<Motion | 'rest', Zone>(ZONE_LIST.flatMap(([zone, list]) => list.map((m) => [m, zone] as const)));
export const zoneOf = (motion: Motion | 'rest'): Zone => (motion === 'rest' ? 'none' : ZONES.get(motion) ?? 'arms');

/** Груз, который даёт сам тренажёр или снаряд движения, — его не заменяет снаряд упражнения. */
const OWN: Load[] = ['roller', 'platform', 'ball', 'wheel', 'ropes', 'jumpRope', 'seatSlide'];

/** Чем нагружен мопс: снаряд упражнения важнее движения по умолчанию. */
export function loadOf(motion: Motion | 'rest', gear: Gear | null): Load {
  const own = MOTIONS[motion].load;
  if (!gear || OWN.includes(own)) return own;
  switch (gear) {
    case 'dumbbell':
      return own === 'singleDb' ? 'singleDb' : 'dumbbell';
    case 'kettlebell':
      return 'kettlebell';
    case 'plate':
      return 'disc';
    case 'cable':
    case 'machine':
      // Подъёмы на носки в тренажёре: груз лежит на плечах подушками, рукоятей нет.
      if (gear === 'machine' && motion === 'calf') return 'none';
      return own === 'none' ? 'none' : 'handle';
    case 'band':
      return own === 'none' ? 'none' : 'band';
    case 'barbell':
    case 'smith':
      return own === 'none' ? 'none' : 'plate';
    default:
      return 'none';
  }
}
