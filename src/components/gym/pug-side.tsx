'use client';

import { BODY, GROUND, type Load, type P } from './pug-motions';
import { deg, n2, type Solved } from './pug-geometry';
import { HeadSide } from './PugHead';
import { C, LINE, Part, PartPath, type Frame } from './pug-parts';

/**
 * Мопс в профиль: детали в своих координатах (сегмент лежит вдоль +x) и кадр,
 * который ставит их по суставам.
 *
 * Сбоку видно левую сторону мопса: ближние рука и нога — левые, дальние —
 * правые, темнее и чуть выше и левее, как дальнее в перспективе. Конечности
 * рисуются в два прохода — сначала обводка всей цепочки, потом заливки, —
 * иначе на каждом суставе была бы линия поперёк руки.
 */

/** Во что одет и чем занят — то, что меняет кадр помимо позы. */
export type Live = {
  t: number;
  breath: number;
  blink: boolean;
  /** 0–1: где капля пота на пути с виска. */
  sweat: number;
  /** Видна ли капля: проявляется на виске и тает внизу, а не возникает. */
  sweatOpacity: number;
  /** 0–1: выдох после повтора, нарастает и тает. */
  puff: number;
  /** Язык наружу — когда отпустило; плавно, а не щелчком. */
  tongue: number;
  /** Дрожь на тяжёлом, пиксели. */
  tremble: number;
  wag: number;
  /** День отдыха: поднимает глаза на зрителя. */
  look: number;
};

const seg = (a: P, b: P, nominal: number) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return `translate(${n2(a[0])} ${n2(a[1])}) rotate(${n2(deg(Math.atan2(b[1] - a[1], b[0] - a[0])))}) scale(${n2(Math.max(0.2, len / nominal))} 1)`;
};
const at = (a: P, rad = 0) => `translate(${n2(a[0])} ${n2(a[1])})${rad ? ` rotate(${n2(deg(rad))})` : ''}`;
const angle = (a: P, b: P) => Math.atan2(b[1] - a[1], b[0] - a[0]);

/** Дальние конечности сдвинуты назад и вверх — они дальше от зрителя. */
const FAR_ARM = 'translate(-4 -2)';
const FAR_LEG = 'translate(-6 -2)';

export function sideFrame(r: Solved, load: Load, live: Live): Frame {
  const { pose } = r;
  const out: Frame = new Map();
  const put = (part: string, attr: string, value: string) => out.set(part, { ...(out.get(part) ?? {}), [attr]: value });
  const effort = pose.effort ?? 0;

  put('thigh2', 'transform', seg(r.leg2.root, r.leg2.mid, BODY.thigh));
  put('shin2', 'transform', seg(r.leg2.mid, r.leg2.end, BODY.shin));
  put('foot2', 'transform', at(r.leg2.end, pose.toe2 ?? pose.toe ?? 0));
  put('delt2', 'transform', at(r.arm2.root, angle(r.arm2.root, r.arm2.mid)));
  put('upper2', 'transform', seg(r.arm2.root, r.arm2.mid, BODY.upper));
  put('fore2', 'transform', seg(r.arm2.mid, r.arm2.end, BODY.fore));
  put('hand2', 'transform', at(r.arm2.end, angle(r.arm2.mid, r.arm2.end)));

  put('torso', 'transform', `${at(pose.hip, pose.torso)} scale(${n2(1 + 0.03 * live.breath)} 1)`);
  put('tail', 'transform', `translate(-23 -6) rotate(${n2(deg(live.wag))})`);
  put('head', 'transform', at(r.neck, pose.torso + (pose.head ?? 0)));

  put('thigh', 'transform', seg(pose.hip, r.leg.mid, BODY.thigh));
  put('shin', 'transform', seg(r.leg.mid, r.leg.end, BODY.shin));
  // Лампас — по внешнему шву ближней ноги, от пояса до подола одной кривой:
  // гнётся на суставе вместе с бедром, как шов, а не ломается галочкой.
  // Дальний шов смотрит от зрителя, его не видно.
  const up: P = [Math.sin(pose.torso), -Math.cos(pose.torso)];
  const fwd: P = [-up[1], up[0]];
  const waist: P = [pose.hip[0] + up[0] * 15.5 + fwd[0] * 2.2, pose.hip[1] + up[1] * 15.5 + fwd[1] * 2.2];
  const along = angle(pose.hip, r.leg.mid);
  const hem: P = [pose.hip[0] + Math.cos(along) * 28.5, pose.hip[1] + Math.sin(along) * 28.5];
  put('stripe', 'd', `M${n2(waist[0])} ${n2(waist[1])}Q${n2(pose.hip[0])} ${n2(pose.hip[1])} ${n2(hem[0])} ${n2(hem[1])}`);
  put('foot', 'transform', at(r.leg.end, pose.toe ?? 0));
  put('delt', 'transform', at(r.shoulder, angle(r.shoulder, r.arm.mid)));
  put('upper', 'transform', seg(r.shoulder, r.arm.mid, BODY.upper));
  put('fore', 'transform', seg(r.arm.mid, r.arm.end, BODY.fore));
  put('hand', 'transform', at(r.arm.end, angle(r.arm.mid, r.arm.end)));

  // Морда: веко опускается и брови сходятся под нагрузкой, язык — когда отпустило.
  put('lid', 'opacity', n2(Math.min(1, Math.max(0, (effort - 0.5) * 2.6))));
  put('blink', 'opacity', live.blink ? '1' : '0');
  put('brow', 'transform', `translate(${n2(effort * 1.5)} ${n2(effort * 3)}) rotate(${n2(effort * 8)} 24 -43)`);
  put('tongue', 'opacity', n2(live.tongue));
  put('ear', 'transform', `rotate(${n2(-6 * effort + 4 * Math.sin(live.t * 2.1))} 6 -48)`);
  put('sweat', 'opacity', n2(live.sweatOpacity));
  // Капля — с виска по щеке, позади глаза: путь мимо самого глаза читался
  // слезой, а мопс на подходе не плачет.
  put('sweat', 'transform', `translate(${n2(9 + live.sweat * 1.5)} ${n2(-36 + live.sweat * 27)})`);
  put('puff', 'opacity', n2(Math.max(0, live.puff)));
  put('puff', 'transform', `translate(${n2(40 + (1 - live.puff) * 12)} ${n2(-16 - (1 - live.puff) * 6)}) scale(${n2(0.6 + (1 - live.puff) * 0.8)})`);

  const hand = r.arm.end;
  const hand2 = r.arm2.end;
  if (load === 'plate') {
    put('load', 'transform', at(pose.load ?? hand));
    put('farPlate', 'transform', at(pose.load ?? hand));
  }
  if (load === 'singleDb') put('loadBack', 'transform', at(hand));
  if (load === 'disc' || load === 'ball' || load === 'wheel') put('loadMid', 'transform', at(hand));
  if (load === 'dumbbell' || load === 'kettlebell') {
    put('load', 'transform', at(hand));
    put('load2', 'transform', at(hand2));
    put('load2', 'opacity', load === 'kettlebell' && pose.hand2 ? '0' : '1');
  }
  if ((load === 'handle' || load === 'band') && pose.pulley) {
    put('cable', 'x1', n2(pose.pulley[0]));
    put('cable', 'y1', n2(pose.pulley[1]));
    put('cable', 'x2', n2(hand[0]));
    put('cable', 'y2', n2(hand[1]));
  }
  if (load === 'handle') put('load', 'transform', at(hand, angle(r.arm.mid, hand)));
  if (load === 'band') {
    const from: P = pose.pulley ?? [pose.foot[0] + 6, GROUND - 2];
    put('band', 'd', `M${n2(from[0])} ${n2(from[1])}Q${n2((from[0] + hand[0]) / 2 + 6)} ${n2((from[1] + hand[1]) / 2)} ${n2(hand[0])} ${n2(hand[1])}`);
  }
  if ((load === 'roller' || load === 'platform' || load === 'seatSlide') && pose.pad) put('pad', 'transform', at(pose.pad, load === 'platform' ? -0.62 : 0));
  if (load === 'ropes') {
    const wave = (h: P, k: number) => {
      const end: P = [330, 272];
      const s = pose.spin ?? 0;
      const mid1: P = [h[0] + (end[0] - h[0]) * 0.33, h[1] + (end[1] - h[1]) * 0.33 + 14 * Math.sin(s + k)];
      const mid2: P = [h[0] + (end[0] - h[0]) * 0.66, h[1] + (end[1] - h[1]) * 0.66 - 12 * Math.sin(s + k)];
      return `M${n2(h[0])} ${n2(h[1])}C${n2(mid1[0])} ${n2(mid1[1])} ${n2(mid2[0])} ${n2(mid2[1])} ${end[0]} ${end[1]}`;
    };
    put('rope', 'd', wave(hand, 0));
    put('rope2', 'd', wave(hand2, Math.PI));
  }
  if (load === 'jumpRope') {
    // Скакалка сбоку — овал вокруг мопса: над головой, перед, под ногами, за спиной.
    const s = pose.spin ?? 0;
    const cx = (hand[0] + pose.hip[0]) / 2;
    const top = r.neck[1] - 50;
    const bottom = GROUND;
    const midY = (top + bottom) / 2;
    const ry = (bottom - top) / 2;
    const px = cx + 46 * Math.sin(s);
    const py = midY - ry * Math.cos(s);
    put('jump', 'd', `M${n2(hand[0])} ${n2(hand[1])}Q${n2(px + (px - hand[0]) * 0.6)} ${n2(py + (py - hand[1]) * 0.25)} ${n2(hand[0] - 4)} ${n2(hand[1])}`);
  }
  return out;
}

// ─── Детали ─────────────────────────────────────────────────────────────────

const DELT = 'M-13 0C-13-9-6-15 2-15C10-15 16-9 16 0C16 8 10 14 2 14C-6 14-13 8-13 0Z';
/**
 * Локоть — как колено: конец плеча и начало предплечья — полукруги одного
 * радиуса вокруг сустава. Плоские срезы разной ширины на согнутой руке давали
 * угол снаружи и щель внутри: предплечье будто отрывалось от плеча.
 */
const UPPER = 'M0-13C9-17 20-17 29-12C34-10 37-9 40-9A9 9 0 0 1 40 9C34 10.5 27 12.5 17 13C9 14 3 13 0 12Z';
const FORE = 'M0-9.5C7-12.5 17-11 26-7.5C31-6 35-5.5 38-5.5L38 5.5C33 6.5 25 9 15 10.5C7 11.5 2 11 0 9.5A9.5 9.5 0 0 1 0-9.5Z';
const HAND = 'M-3-7.5C4-10.5 12-9.5 15.5-5.5C17.6-2 17.6 2 15.5 5.5C12 9.5 4 10.5-3 7.5Z';
/**
 * Концы бедра — полукруги вокруг сустава: таз и колено поворачивают бедро на
 * любой угол, и плоский срез торчал бы углом — в приседе бедро было коробкой.
 */
const THIGH = 'M0-17C14-20 30-17 46-10.5A10.5 10.5 0 0 1 46 10.5C34 13 18 17 0 17A17 17 0 0 1 0-17Z';
/**
 * Штанина — труба с круглым верхом вокруг тазобедренного сустава и подолом
 * дугой. Круг поворачивается вместе с бедром и не меняется, поэтому штанина
 * при любом наклоне сливается с сиденьем шорт, а не торчит из него
 * прямоугольником. Радиус круга — не выше пояса (`SHORTS`), иначе шорты лезли
 * бы на майку.
 */
const SHORTS_LEG = 'M0 20C8 20 17 19.6 24 18.6C27.5 18.1 29.5 15.5 30 12C30.8 6 30.8-6 30-13C29.5-16.5 27.5-19.4 24-19.9C16-20.8 8-20.6 0-20A20 20 0 0 0 0 20Z';
const SHIN = 'M-2-10C12-11 28-8 44-6L44 6C35 8 25 13 12 14.5C5 15 0 13-2 11Z';
const FOOT = 'M-8-6C-8-11 2-11 10-8.5C19-6 25-2.5 25.5 1C25.8 3 24.6 4 22.5 4H-4.5C-6.6 4-8 2.6-8 0.5Z';
const TORSO =
  'M12-76C18-71 22-68 28-65C36-61 40-55 40-48C40-43 38-40 33-38C30-30 29-22 28-14C27-6 24 0 18 6C10 11-6 12-14 8C-20 4-22-4-20-12C-18-18-14-22-14-28C-15-36-19-46-20-56C-21-66-20-76-16-86C-8-88 6-84 12-76Z';
/**
 * Майка висит с груди прямо, а не обтягивает её снизу: иначе в профиль выходит
 * бюст. Заправлена в шорты — подол чуть ниже пояса.
 */
const TANK =
  'M32.7-17.8C33.8-26 35.2-34 37-40C39-44 40-46 40-49C40-55 35-61 28-64C22-66 17-69 14-72L12-77.5C6-79.5-3-79-10-77C-16-71-20-64-20-56C-19-46-15-36-14-28C-14-24.1-15.7-21-17.4-17.7Z' +
  'M10-69C6-62 4-52 6-42C7-36 6-31 2-29C-2-33-4-42-4-52C-4-62-1-70 4-73C6-73 8-71 10-69Z';
/**
 * Сиденье шорт — от пояса до складки под ягодицами, с запасом ткани по
 * контуру. Пояс выше сустава на радиус круга штанины (`SHORTS_LEG`): там, где
 * он сидел вровень с суставом, штанина в приседе вылезала на майку.
 */
const SHORTS = 'M33.6-21C33.6-13 30.5-3 26 3C22 8 16 11.5 9 13C1 14.5-8 14-15 10.5C-21 7.5-23.5 1-23.5-5C-23.5-11-20.5-16.5-17-21Z';
const HOODIE =
  'M14-77C20-72 24-69 30-66C38-62 43-56 43-49C43-43 41-38 37-34C35-26 34-18 33-11C32-3 29 3 22 8C13 13-7 14-16 10C-22 6-24-3-22-12C-20-18-16-23-16-29C-17-37-21-47-22-57C-23-67-22-77-18-87C-10-90 7-86 14-77Z';

/**
 * Штанга сбоку — торцом: гриф смотрит на зрителя. Ближний блин — ближе всего
 * к камере и рисуется последним, поверх кисти; дальний — за всем телом.
 */
function FarPlate() {
  return (
    <Part name="farPlate">
      <g transform="translate(-5 -3)">
        <circle r={28} fill={C.ironEdge} stroke={C.ink} strokeWidth={1.2} />
        <circle r={6} fill={C.chrome} />
      </g>
    </Part>
  );
}

function Plate({ weight, count }: { weight?: number; count: number }) {
  // Блины стопкой: дальние в стопке чуть сдвинуты, у ближнего — обод, кольцо и вес.
  const behind = Array.from({ length: Math.max(0, count - 1) }, (_, i) => count - 1 - i);
  return (
    <Part name="load">
      {behind.map((i) => (
        <circle key={i} cx={i * 2.6} cy={i * 1.2} r={28} fill={C.ironEdge} stroke={C.ink} strokeWidth={1.2} />
      ))}
      <circle r={28} fill={C.iron} stroke={C.ink} strokeWidth={1.4} />
      <circle r={24.5} fill="none" stroke={C.white} strokeOpacity={0.12} strokeWidth={1.4} />
      <circle r={15} fill="none" stroke={C.white} strokeOpacity={0.08} strokeWidth={6} />
      <circle r={7} fill={C.chrome} stroke={C.ink} strokeWidth={1.2} />
      <circle r={3.4} fill={C.iron} />
      {weight ? (
        <text y={-15} textAnchor="middle" fill={C.white} style={{ font: '700 10px var(--font-sans), sans-serif' }}>
          {weight}
        </text>
      ) : null}
    </Part>
  );
}

/** Гантель сбоку: гриф смотрит на зрителя, видно шестигранный блин. */
function Dumbbell({ name, far }: { name: string; far?: boolean }) {
  return (
    <Part name={name}>
      <path d="M0-12L10.4-6V6L0 12L-10.4 6V-6Z" fill={far ? C.ironEdge : C.iron} stroke={C.ink} strokeWidth={1.3} strokeLinejoin="round" />
      <circle r={3.4} fill={C.chrome} />
    </Part>
  );
}

function Kettlebell({ name, far }: { name: string; far?: boolean }) {
  return (
    <Part name={name}>
      <path d="M-7 2C-7-9 7-9 7 2" stroke={C.ink} strokeWidth={3.4} fill="none" />
      <circle cx={0} cy={13} r={11.5} fill={far ? C.ironEdge : C.iron} stroke={C.ink} strokeWidth={1.3} />
      <path d="M-6 9Q0 5 6 9" stroke={C.white} strokeOpacity={0.15} strokeWidth={1.5} fill="none" />
    </Part>
  );
}

function LimbLines({ hand = true, far = false }: { hand?: boolean; far?: boolean }) {
  const n = far ? '2' : '';
  return (
    <>
      <Part name={`delt${n}`}>
        <path d={DELT} {...LINE} />
      </Part>
      <Part name={`upper${n}`}>
        <path d={UPPER} {...LINE} />
      </Part>
      <Part name={`fore${n}`}>
        <path d={FORE} {...LINE} />
      </Part>
      {hand ? (
        <Part name={`hand${n}`}>
          <path d={HAND} {...LINE} />
        </Part>
      ) : null}
    </>
  );
}

function Arm({ far = false, sleeve = false }: { far?: boolean; sleeve?: boolean }) {
  const n = far ? '2' : '';
  const skin = far ? C.skinFar : C.skin;
  const cloth = sleeve ? (far ? C.hoodieFar : C.hoodie) : skin;
  return (
    <>
      <LimbLines far={far} />
      <Part name={`delt${n}`}>
        <path d={DELT} fill={cloth} />
        {sleeve ? null : <path d="M-10-6C-6-12 2-14 9-12" stroke={C.mask} strokeOpacity={0.18} strokeWidth={1.4} fill="none" />}
      </Part>
      <Part name={`upper${n}`}>
        <path d={UPPER} fill={cloth} />
        <path d="M4 9C14 11 26 9.5 38 5.5L40 6.4C33 9 26 11.5 17 12.6C10 13 5 12.4 4 9Z" fill={C.shade} />
        {sleeve ? null : <path d="M10-11C18-13 26-11 32-8" stroke={C.mask} strokeOpacity={0.22} strokeWidth={1.3} fill="none" strokeLinecap="round" />}
      </Part>
      <Part name={`fore${n}`}>
        <path d={FORE} fill={sleeve ? cloth : skin} />
        {sleeve ? <path d="M30-6.5L38-5.5V5.5L30 7.2Z" fill={far ? C.hoodieFar : C.hoodieInner} /> : null}
        <path d="M2 7C12 8.5 24 7 36 4.5L37.5 5.5C30 7.5 21 9.6 13 10.2C6 10.6 3 9.4 2 7Z" fill={C.shade} />
      </Part>
      <Part name={`hand${n}`}>
        <path d={HAND} fill={skin} />
        <path d="M9-5.5L14.5-3.5M10.5 0H16M9 5.5L14.5 3.5" stroke={C.mask} strokeOpacity={0.55} strokeWidth={1.2} strokeLinecap="round" />
      </Part>
    </>
  );
}

function Leg({ far = false, pants = false }: { far?: boolean; pants?: boolean }) {
  const n = far ? '2' : '';
  const bare = far ? C.skinFar : C.skin;
  // В день отдыха — серые треники до щиколоток вместо шорт.
  const skin = pants ? (far ? C.hoodieFar : C.hoodie) : bare;
  return (
    <>
      <Part name={`thigh${n}`}>
        <path d={THIGH} {...LINE} />
      </Part>
      <Part name={`shin${n}`}>
        <path d={SHIN} {...LINE} />
      </Part>
      <Part name={`foot${n}`}>
        <path d={FOOT} {...LINE} />
      </Part>
      <Part name={`thigh${n}`}>
        {/* Треники у таза — круг без обводки: сливается с худи, как штанина с шортами. */}
        {pants ? <circle r={19} fill={skin} /> : null}
        <path d={THIGH} fill={skin} />
        <path d="M4 12C18 14 32 11 45 8L46 9.6C34 12.5 20 15.8 4 16Z" fill={C.shade} />
        <path d="M26-13C33-12 39-10 44-8" stroke={C.mask} strokeOpacity={0.2} strokeWidth={1.3} fill="none" strokeLinecap="round" />
        {pants ? null : <path d={SHORTS_LEG} fill={far ? C.shortsFar : C.shorts} />}
      </Part>
      <Part name={`shin${n}`}>
        <path d={SHIN} fill={skin} />
        <path d="M10 12C20 12.5 30 9 42 5.6L43 6.2C34 8.4 25 12.6 13 14Z" fill={C.shade} />
      </Part>
      <Part name={`foot${n}`}>
        <path d={FOOT} fill={bare} />
        <path d="M13-1.5V3.5M18-2.5V3.5M22.5-0.5V3.5" stroke={C.mask} strokeOpacity={0.5} strokeWidth={1.2} strokeLinecap="round" />
      </Part>
    </>
  );
}

function Torso({ hood, outline }: { hood: boolean; outline?: boolean }) {
  if (outline) {
    return (
      <Part name="torso">
        <path d={hood ? HOODIE : TORSO} {...LINE} />
        {hood ? null : <path d={TANK} {...LINE} fillRule="evenodd" />}
        {hood ? null : <path d={SHORTS} {...LINE} />}
      </Part>
    );
  }
  if (hood) {
    return (
      <Part name="torso">
        <path d={HOODIE} fill={C.hoodie} />
        <path d="M-15-29C-16-37-20-47-20-57C-20-65-18-73-14-81C-10-70-11-56-10-44C-9-32-10-20-14-8C-18-4-21-6-21-12C-19-18-15-23-15-29Z" fill={C.hoodieFar} />
        <path d="M-12 4C0 7 12 6 20 2" stroke={C.ink} strokeOpacity={0.3} strokeWidth={1.4} fill="none" />
        {/* Карман-кенгуру. */}
        <path d="M8-2C10-10 18-16 27-16L28-2Z" fill={C.hoodieFar} stroke={C.ink} strokeOpacity={0.3} strokeWidth={1} />
      </Part>
    );
  }
  return (
    <Part name="torso">
      <path d={TORSO} fill={C.skin} />
      {/* Спина темнее: свет сверху-спереди. */}
      <path d="M-19-56C-19-46-15-36-14-28C-14-22-18-18-20-12C-21-6-20 2-16 6C-12 0-10-8-10-16C-10-30-14-44-14-56C-14-66-12-74-9-80C-14-78-19-68-19-56Z" fill={C.shade} />
      {/* Трапеция над майкой — до самого затылка — и ключица. */}
      <path d="M-16-84C-10-80-4-78 3-77M14-72C18-69 22-67 27-65" stroke={C.mask} strokeOpacity={0.22} strokeWidth={1.4} fill="none" />
      <path d="M-20-56C-21-66-20-76-16-86C-13-80-13-72-14-64Z" fill={C.shadeDeep} fillOpacity={0.5} />
      {/* Широчайшая в пройме. */}
      <path d="M2-29C-2-33-4-42-4-52C0-46 3-38 4-30Z" fill={C.shade} />
      <path d={TANK} fill={C.tank} fillRule="evenodd" />
      <path d={TANK} fill="none" stroke={C.ink} strokeOpacity={0.35} strokeWidth={1.1} fillRule="evenodd" />
      {/* Складки ткани и тень под грудью. */}
      <path d="M37-40C35.8-33.8 34.5-26.1 33.3-18.2L29.5-18.8C30.8-26.6 32.2-34 34-40Z" fill={C.tankShade} />
      <path d="M18-30C20-22 21-14 20-6M-10-40C-12-30-11-20-12-10" stroke={C.tankShade} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <path d="M-19-56C-19-46-15-36-14-28C-14-22-18-18-20-12C-21-8-21-5-20-2H-15C-16-10-12-20-12-30C-13-40-16-50-15-60C-15-68-12-74-9-76C-15-71-19-64-19-56Z" fill={C.tankShade} />
      <path d={SHORTS} fill={C.shorts} />
      <path d="M33.4-17.5C14-16-4-16-19.6-17.5" stroke={C.ink} strokeOpacity={0.4} strokeWidth={1.4} fill="none" />
      <path d="M29-14C14-12.5 0-12.5-21-14.5" stroke={C.white} strokeOpacity={0.18} strokeWidth={1} fill="none" />
    </Part>
  );
}

function Tail() {
  return (
    <Part name="tail">
      <circle r={7.5} {...LINE} strokeWidth={2.6} />
      <circle r={7.5} fill={C.skin} />
      <path d="M-3.5 0a3.5 3.5 0 1 0 3.5-3.5" stroke={C.mask} strokeOpacity={0.5} strokeWidth={1.4} fill="none" />
    </Part>
  );
}

/** Всё, что рисуется сбоку, кроме снарядов позади мопса. Порядок — от дальнего к ближнему. */
export function SideBody({ load, hood, plate, plates }: { load: Load; hood: boolean; plate?: number; plates: number }) {
  const cable = load === 'handle' || load === 'band';
  return (
    <>
      {load === 'plate' ? <FarPlate /> : null}
      <g transform={FAR_LEG}>
        <Leg far pants={hood} />
      </g>
      <g transform={FAR_ARM}>
        <Arm far sleeve={hood} />
      </g>
      {load === 'dumbbell' ? <Dumbbell name="load2" far /> : null}
      {load === 'kettlebell' ? <Kettlebell name="load2" far /> : null}
      {/* Гантель в обеих руках посередине — за ближней рукой и за головой. */}
      {load === 'singleDb' ? <Dumbbell name="loadBack" /> : null}

      {hood ? null : <Part name="torso"><Tail /></Part>}
      <Torso hood={hood} outline />
      <Torso hood={hood} />
      <Part name="head">
        <HeadSide hood={hood} outline />
        <HeadSide hood={hood} />
      </Part>

      <Leg pants={hood} />
      {hood ? null : <PartPath name="stripe" stroke={C.stripe} strokeWidth={3} strokeLinecap="round" fill="none" />}
      {load === 'roller' ? (
        <Part name="pad">
          <circle r={8.5} fill={C.pad} stroke={C.ink} strokeWidth={1.2} />
          <circle r={2.6} fill={C.frame} />
        </Part>
      ) : null}
      {load === 'platform' ? (
        <Part name="pad">
          <rect x={-5} y={-24} width={10} height={48} rx={3} fill={C.frame} stroke={C.ink} strokeWidth={1.2} />
        </Part>
      ) : null}
      {load === 'seatSlide' ? (
        <Part name="pad">
          <rect x={-16} y={-3} width={32} height={8} rx={3} fill={C.pad} />
        </Part>
      ) : null}

      {cable ? <line data-part="cable" stroke={C.ink} strokeOpacity={0.75} strokeWidth={1.6} /> : null}
      {load === 'band' ? <path data-part="band" stroke="rgb(var(--loss))" strokeWidth={3} fill="none" strokeLinecap="round" /> : null}
      {load === 'ropes' ? (
        <>
          <path data-part="rope2" stroke={C.ink} strokeOpacity={0.6} strokeWidth={4} fill="none" strokeLinecap="round" />
          <path data-part="rope" stroke={C.ink} strokeWidth={4.5} fill="none" strokeLinecap="round" />
        </>
      ) : null}

      {/* Блин, мяч, ролик — посередине между руками: перед телом, за ближней рукой. */}
      {load === 'disc' ? (
        <Part name="loadMid">
          <circle r={19} fill={C.iron} stroke={C.ink} strokeWidth={1.3} />
          <circle r={5} fill={C.ironEdge} />
        </Part>
      ) : null}
      {load === 'ball' ? (
        <Part name="loadMid">
          <circle cx={6} cy={0} r={14} fill={C.ink} />
          <path d="M-6-4Q6 2 19-4M-6 5Q6 10 19 5" stroke={C.white} strokeOpacity={0.2} strokeWidth={1.4} fill="none" />
        </Part>
      ) : null}
      {load === 'wheel' ? (
        <Part name="loadMid">
          <circle cx={0} cy={3} r={11} fill={C.ink} />
          <circle cx={0} cy={3} r={4} fill={C.chrome} />
        </Part>
      ) : null}

      <Arm sleeve={hood} />
      {load === 'dumbbell' ? <Dumbbell name="load" /> : null}
      {load === 'kettlebell' ? <Kettlebell name="load" /> : null}
      {load === 'handle' ? (
        <Part name="load">
          <rect x={6} y={-10} width={7} height={20} rx={3.5} fill={C.ink} />
        </Part>
      ) : null}
      {load === 'jumpRope' ? <path data-part="jump" stroke={C.ink} strokeWidth={1.8} fill="none" /> : null}
      {/* Ближний блин — ближе всего к камере: поверх кисти и плеча. */}
      {load === 'plate' ? <Plate weight={plate} count={plates} /> : null}
    </>
  );
}
