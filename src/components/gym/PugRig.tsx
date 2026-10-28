'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

import type { Gear, Grip, Motion } from '@/lib/gym/exercises';
import { MOTIONS, loadOf, zoneOf, type P, type Pose, type Zone } from './pug-motions';
import { REP, clamp, phaseOf, solve, widthsOf } from './pug-geometry';
import { FrontBody, frontFrame, frontPlan } from './pug-front';
import { Initial, type Frame } from './pug-parts';
import { FrontProps, SideProps } from './pug-props';
import { SideBody, sideFrame, type Live } from './pug-side';

/**
 * Мопс-качок, который показывает упражнение: сбоку или спереди.
 *
 * Тот же подход, что у воды и трещин айсберга: всё, что двигается, считается
 * в `requestAnimationFrame` и пишется прямо в DOM атрибутами, без React-state
 * и без перерисовки покадрово. Первый кадр считается ещё при рендере — та же
 * поза, с которой начнётся анимация, — и уходит в HTML атрибутами: мопс
 * приходит уже в позе и не прыгает в другую, когда скрипт оживает.
 *
 * Живость — поверх позы: дышит, моргает, на тяжёлом щурится и дрожит той
 * мышцей, что работает, после повтора выдыхает, пот катится со лба, хвост
 * виляет, когда отпустило. Всё это нарастает и тает, а не включается: ничто
 * не появляется и не исчезает скачком. В день отдыха сидит и думает и иногда
 * поднимает глаза на тебя.
 *
 * Часы анимации идут, только пока мопса видно (IntersectionObserver) и вкладка
 * открыта: вернулся — он продолжает с того же места, а не перескакивает туда,
 * где был бы, если бы всё это время качался.
 *
 * Без движения (`prefers-reduced-motion`) стоит в середине повтора — так
 * видно, что за упражнение, лучше, чем в исходной позе.
 */

export type View = 'side' | 'front';

const smooth = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const frac = (x: number) => x - Math.floor(x);

/** Живое поверх позы в момент `t`: то, что мопс делает сам, а не упражнение. */
function liveAt(t: number, p: number, motion: Motion | 'rest', tempo: 'rep' | 'hold' | 'cycle', period: number | undefined, effort: number): Live {
  const blink = frac(t / 4.3) < 0.032 || frac((t + 1.9) / 6.7) < 0.022;
  const working = motion !== 'rest' && zoneOf(motion) !== 'none';
  // Выдох в конце подъёма: нарастает за пятую долю секунды и тает.
  let puff = 0;
  if (tempo === 'rep' && working) {
    const k = (period ?? REP) / REP;
    const x = frac(((t / k) % REP - 2.55) / REP) * REP;
    puff = x < 0.2 ? x / 0.2 : x < 0.9 ? 1 - (x - 0.2) / 0.7 : 0;
  }
  // Капля пота: проявляется на лбу, сползает и тает — круг за кругом.
  const sweaty = motion !== 'rest' && motion !== 'yoga' && motion !== 'walk';
  const sweat = frac(t / 2.6);
  const sweatOpacity = sweaty ? Math.min(1, sweat * 6, (1 - sweat) * 2.5) : 0;
  // День отдыха: раз в десять секунд поднимает глаза, держит и опускает.
  const k = frac(t / 10);
  const look = motion === 'rest' ? smooth(0.6, 0.68, k) * (1 - smooth(0.86, 0.94, k)) : 0;
  return {
    t,
    breath: 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 3.6),
    blink,
    sweat,
    sweatOpacity,
    puff,
    tongue: motion === 'rest' ? 0 : clamp((0.2 - effort) / 0.12, 0, 1) * (1 - puff),
    tremble: 1.3 * smooth(0.72, 1, effort),
    wag: (motion === 'rest' ? 0.08 : 0.3 * (1 - Math.min(1, effort * 2))) * Math.sin(t * 9.5) + 0.12 * (1 - smooth(0, 0.12, p)) * Math.sin(t * 14),
    look
  };
}

/** Дрожь — не дёрганье: две частоты физиологического тремора, 9–13 герц. */
const jitter = (t: number, k: number): P => [
  Math.sin(t * 57 + k) * 0.6 + Math.sin(t * 83 + 2 * k) * 0.4,
  Math.cos(t * 61 + k) * 0.6 + Math.sin(t * 79 + 3 * k) * 0.4
];
const plus = (q: P | undefined, d: P): P | undefined => (q ? [q[0] + d[0], q[1] + d[1]] : q);

/** Поза с живостью: дрожь в рабочей мышце, кивок, дыхание, взгляд на зрителя. */
function lively(pose: Pose, live: Live, motion: Motion | 'rest', zone: Zone): Pose {
  if (motion === 'rest') {
    return { ...pose, head: (pose.head ?? 0) - live.look * 0.34, torso: pose.torso - live.look * 0.05 };
  }
  const nod = 0.03 * Math.sin(live.t * 1.7) * (1 - (pose.effort ?? 0));
  const base: Pose = { ...pose, head: (pose.head ?? 0) + nod, shrug: (pose.shrug ?? 0) + live.breath * 1.2 };
  const a = live.tremble;
  if (!a || zone === 'none') return base;
  const j: P = jitter(live.t, 0);
  const j2: P = jitter(live.t, 2);
  switch (zone) {
    case 'arms': {
      const d: P = [j[0] * a, j[1] * a];
      return { ...base, hand: plus(base.hand, d) as P, hand2: plus(base.hand2, [j2[0] * a, j2[1] * a]), load: plus(base.load, d) };
    }
    case 'legs': {
      // Корпус с грифом ходит на дрожащих ногах: стопы стоят, колени гуляют.
      const d: P = [j[0] * a * 0.5, j[1] * a * 0.9];
      return {
        ...base,
        hip: plus(base.hip, d) as P,
        hand: plus(base.hand, d) as P,
        hand2: plus(base.hand2, d),
        load: plus(base.load, d),
        z: { ...base.z, knee: (base.z?.knee ?? 17) + Math.sin(live.t * 71) * a * 1.4 }
      };
    }
    case 'shins': {
      const d: P = [j[0] * a, j[1] * a];
      return { ...base, foot: plus(base.foot, d) as P, pad: plus(base.pad, d) };
    }
    case 'calves': {
      const dy = Math.sin(live.t * 59) * a * 0.5;
      return {
        ...base,
        toe: (base.toe ?? 0) + Math.sin(live.t * 67) * a * 0.04,
        hip: plus(base.hip, [0, dy]) as P,
        hand: plus(base.hand, [0, dy]) as P,
        load: plus(base.load, [0, dy]),
        pad: plus(base.pad, [0, dy])
      };
    }
    case 'core':
      return { ...base, hip: plus(base.hip, [0, Math.sin(live.t * 63) * a * 0.9]) as P };
  }
}

function tidy<T>(v: T): T {
  if (typeof v === 'number') return (Math.round(v * 100) / 100) as T;
  if (Array.isArray(v)) return v.map(tidy) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tidy(x)])) as T;
  return v;
}

export function PugRig({
  motion,
  gear = null,
  grip,
  view = 'side',
  plate,
  still: forcedStill = false,
  className = '',
  title,
  speed = 1,
  phase
}: {
  motion: Motion | 'rest';
  gear?: Gear | null;
  grip?: Grip;
  view?: View;
  /** Подпись на блине: 200 на жиме в подвале. */
  plate?: number;
  still?: boolean;
  className?: string;
  /** Подпись для скринридера: что делает мопс. */
  title: string;
  speed?: number;
  /** Застыть в этой фазе повтора: для картинок без анимации. */
  phase?: number;
}) {
  const svg = useRef<SVGSVGElement | null>(null);
  const reduce = useReducedMotion();
  const still = forcedStill || Boolean(reduce) || phase !== undefined;
  const def = MOTIONS[motion];
  const load = loadOf(motion, gear);
  const hood = def.props.includes('hood');
  const zone = zoneOf(motion);
  const restP = phase ?? (def.tempo === 'hold' ? 0.5 : def.tempo === 'cycle' ? 0.3 : 0.55);
  const plates = plate ? Math.min(4, Math.max(2, Math.round(plate / 50))) : 2;

  // Кто кого закрывает спереди — один раз на движение, по выборке поз.
  const plan = useMemo(() => {
    const n = 13;
    const samples = Array.from({ length: n }, (_, i) => {
      const pose = def.pose(i / (n - 1), gear);
      return { r: solve(pose), z: widthsOf(pose, grip) };
    });
    return frontPlan(samples, load);
  }, [def, gear, grip, load]);

  const draw = useMemo(() => {
    return (t: number, p: number): Frame => {
      const raw = def.pose(p, gear);
      const live = liveAt(t, p, motion, def.tempo, def.period, raw.effort ?? 0);
      const pose = lively(raw, live, motion, zone);
      const solved = solve(pose);
      return view === 'front' ? frontFrame(solved, load, live, widthsOf(pose, grip), plan, hood) : sideFrame(solved, load, live);
    };
  }, [def, gear, motion, view, load, grip, hood, zone, plan]);

  // Снаряды рисует React, а не кадр: их координаты округлены, иначе последние
  // знаки синуса на сервере и в браузере расходятся и гидратация ругается.
  const first = useMemo(() => tidy(solve(def.pose(0, gear))), [def, gear]);
  const z = useMemo(() => tidy(widthsOf(def.pose(0, gear), grip)), [def, gear, grip]);
  // Первый кадр — при рендере, и ровно тот, с которого пойдёт анимация.
  const initial = useMemo(() => (still ? draw(0.8, restP) : draw(0, phaseOf(0, def.tempo, def.period))), [draw, still, restP, def]);

  useLayoutEffect(() => {
    const root = svg.current;
    if (!root) return;
    const parts = new Map<string, Element[]>();
    root.querySelectorAll('[data-part]').forEach((el) => {
      const key = el.getAttribute('data-part') as string;
      parts.set(key, [...(parts.get(key) ?? []), el]);
    });
    const paint = (frame: Frame) => {
      for (const [part, attrs] of frame) {
        const els = parts.get(part);
        if (!els) continue;
        for (const el of els) for (const [attr, value] of Object.entries(attrs)) el.setAttribute(attr, value);
      }
    };
    if (still) {
      paint(draw(0.8, restP));
      return;
    }

    let raf = 0;
    let last = 0;
    let t = 0;
    let shown = true;
    const frame = (now: number) => {
      raf = 0;
      if (!shown) return;
      // Время копится только пока видно, и не больше десятой секунды за кадр:
      // после спрятанной вкладки мопс продолжает, а не телепортируется.
      if (last) t += Math.min(0.1, (now - last) / 1000) * speed;
      last = now;
      paint(draw(t, phaseOf(t, def.tempo, def.period)));
      raf = requestAnimationFrame(frame);
    };
    const watch = new IntersectionObserver(([entry]) => {
      shown = entry.isIntersecting;
      last = 0;
      if (shown && !raf) raf = requestAnimationFrame(frame);
    });
    watch.observe(root);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      watch.disconnect();
    };
  }, [draw, def, still, speed, restP]);

  return (
    <Initial.Provider value={initial}>
      <svg ref={svg} viewBox="40 0 320 300" role="img" aria-label={title} className={className}>
        {view === 'front' ? (
          <>
            <FrontProps list={def.props} first={first} z={z} gear={gear} />
            <FrontBody load={load} hood={hood} plan={plan} />
          </>
        ) : (
          <>
            <SideProps list={def.props} first={first} gear={gear} />
            <SideBody load={load} hood={hood} plate={plate} plates={plates} />
            <SideProps list={def.props} first={first} gear={gear} layer="front" />
          </>
        )}
      </svg>
    </Initial.Provider>
  );
}
