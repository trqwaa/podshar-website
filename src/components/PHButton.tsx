'use client';

import { useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useTransform,
  useReducedMotion
} from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ReactorVines } from './ReactorVines';
import { openPult, warmPult } from './Pult';

/** Cursor distance in px at which the reactor is fully at rest. */
const FALLOFF = 460;
/**
 * How far the glow may lean toward the cursor, in percentage points of the
 * aura box. The aura's radius is 50% of that box, so 9pt is 18% of the radius —
 * the top of the range the brief allows. Past that the halo visibly detaches
 * from the core and the object stops reading as one thing.
 */
const MAX_LEAN = 9;
/** Where the aura sits when the pointer is absent (touch, or reduced motion). */
const RESTING = 0.16;
/** How many presses have their own retort before the counter takes over. */
const PRESS_LINES = 6;
/**
 * Rings per press, and how long one takes to cross the aura.
 *
 * One ring. Two staggered ones read as a double thump, and a press is meant to
 * be a single event now — the field is flung once and settles. The cap on how
 * many can be in flight keeps a mashed button from stacking animating elements.
 */
const RINGS_PER_PRESS = 1;
const RING_SECONDS = 1.45;
const MAX_WAVES = 8;
/**
 * One press, in seconds, and how much of that is the impulse.
 *
 * A press is one throw, not a pulsation: a fast shove, then a long decay while
 * the vines swing back and settle. That asymmetry is the whole feel — momentum
 * arrives all at once and leaves slowly. The vines, the aura, the ring and the
 * core all run off these numbers so the four stay in step.
 */
const BURST_SECONDS = 1.35;
const IMPULSE = 0.11;
/**
 * How far a shockwave ring swells, as a multiple of its own width.
 *
 * The ring is the outer edge of the explosion and the vines are capped just
 * inside it, so this number sets how big a press looks. At 1.55 the blast was
 * tidy but small; 1.75 puts the front at ~83 viewBox units, which is where
 * ReactorVines' TIP_MAX is set to sit under.
 */
const RING_SCALE = 1.75;

/**
 * Two decimals, always.
 *
 * These numbers are interpolated into a gradient string that is rendered on the
 * server and again in the browser. A raw float serialises differently on each
 * side ("46.400000000000006" against "46.4"), which is a hydration mismatch on
 * every paint. Fixed precision makes both sides emit the same characters.
 */
const fixed = (n: number) => n.toFixed(2);

/**
 * The "ПХ" reactor.
 *
 * A warning light: a small solid red core, a tight halo, and twelve rays
 * reaching in toward it. The joke is that it looks consequential and does
 * nothing at all — press it and it just gets ruder.
 *
 * A pointer anywhere on the page drives two signals:
 *
 *   proximity   1 at the core, 0 at FALLOFF px away. Squared, so the reactor
 *               stays dim across the room and lights up late as the cursor
 *               closes in, instead of glowing faintly the entire time.
 *
 *   bearing     `Math.atan2` gives the exact angle to the cursor. It moves the
 *               halo's centre a clamped distance that way and slides the whole
 *               ray ring after it, so the light leans toward the pointer.
 *
 * The light is two parts that barely talk to each other. The fill is a small
 * quiet halo that only has to bridge core and vines. The vines are the show:
 * SVG curves that grow toward the pointer and curl around it, drawn by
 * `ReactorVines`. They are deliberately not derived from the fill — a gradient
 * cannot bend, and bending is the entire idea.
 *
 * The core and the label never move. Only the light does — and on a press it
 * moves outward: two rings swell out of the core while a decaying `punch` value
 * lifts the whole field, so the vines flex with the wave rather than watching
 * it go past.
 *
 * Everything runs through motion values, so the gradients are rewritten on the
 * elements directly and React never re-renders during a mouse move. The press
 * counter is the one piece of real state, and it only changes on click.
 *
 * `prefers-reduced-motion` parks the aura at a fixed intensity, drops the idle
 * breath and the turn, and never attaches the listener.
 */
export function PHButton() {
  const t = useTranslations('home');
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLButtonElement>(null);
  /** Когда последний раз просили пульт подгрузиться: не чаще раза в полминуты. */
  const warmedAt = useRef(0);
  const [presses, setPresses] = useState(0);
  // Live shockwaves. The delay is stored per ring rather than derived from the
  // array index: rings retire out of order, so an index-based delay would be
  // recomputed for the survivors mid-flight and restart their animation.
  const [waves, setWaves] = useState<{ id: number; delay: number }[]>([]);
  const nextWave = useRef(0);

  // Pointer offset from the core's centre, in px. Seeded a full falloff away so
  // the reactor loads dormant — (0, 0) would read as a cursor sitting on it.
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(-FALLOFF);
  // A spring gives the light some lag, so it swells and leans rather than
  // snapping frame to frame.
  const dx = useSpring(rawX, { stiffness: 120, damping: 22, mass: 0.5 });
  const dy = useSpring(rawY, { stiffness: 120, damping: 22, mass: 0.5 });
  // Hover lives in a motion value, not state: the core must not re-render.
  const hover = useSpring(0, { stiffness: 200, damping: 26 });
  // The kick a press gives the light. Set to 1 on click and decayed back to 0,
  // it rides on top of proximity — so the vines lengthen and brighten with the
  // wave instead of the wave being a decal floating over a static field.
  const punch = useMotionValue(0);
  // The core's own scale through a press. A motion value rather than a CSS
  // transition so it can carry keyframes — two peaks, which `transition-
  // transform` cannot express.
  const core = useMotionValue(1);
  // Bumped on every press. The vines watch it and roll a fresh set of random
  // directions when it changes, so no two throws land the same way.
  const seed = useMotionValue(0);
  // Angular momentum, kept separate from the shove.
  //
  // `punch` is the wave arriving; this is the vines still moving afterwards. It
  // decays over a longer window and dips below zero on the way back, so a vine
  // swings a little past centre and settles instead of stopping dead where it
  // started. One shared value rather than a spring per vine: seventeen springs
  // would be seventeen more things updating every frame for a difference no one
  // could see, since each vine already scales this by its own random kick.
  const sway = useMotionValue(0);
  // How far the field has let go of the cursor: 1 means the pointer does not
  // exist as far as the vines are concerned. Deliberately not `punch` — see the
  // animation in `press` for why the shove and the release cannot share a
  // curve.
  const release = useMotionValue(0);

  useEffect(() => {
    if (reduceMotion) return;

    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      rawX.set(x);
      rawY.set(y);
      // Свечение просыпается, когда курсор подбирается, — в тот же момент
      // пульт просит свои ответы. Пока рука дошла до кнопки, всё уже лежит.
      if (Math.hypot(x, y) < FALLOFF * 0.6 && Date.now() - warmedAt.current > 30_000) {
        warmedAt.current = Date.now();
        warmPult();
      }
    };

    // Pointer off the window returns the reactor to rest.
    const onLeave = () => {
      rawX.set(0);
      rawY.set(-FALLOFF);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [rawX, rawY, reduceMotion]);

  // 0 at FALLOFF, 1 at the core, squared for a late wake-up. Hover pins it near
  // the top of the range, so being on the button always looks like the most
  // dangerous place to be.
  const intensity = useTransform<number, number>([dx, dy, hover], ([x, y, h]) => {
    if (reduceMotion) return RESTING;
    const linear = Math.max(0, Math.min(1, 1 - Math.hypot(x, y) / FALLOFF));
    return Math.max(linear * linear, h * 0.92);
  });

  // What everything downstream actually reads: proximity plus the press kick.
  const lit = useTransform<number, number>([intensity, punch], ([i, p]) =>
    Math.min(1, i + p * 0.6)
  );

  // Halo centre, in percent of the aura box. Clamped by MAX_LEAN, and damped at
  // distance so a far-off cursor does not drag a dim halo around.
  const bearing = useTransform<number, number>([dx, dy], ([x, y]) => Math.atan2(y, x));
  const lean = useTransform(lit, (i) => MAX_LEAN * (0.4 + 0.6 * i));

  const gx = useTransform<number, string>([bearing, lean], ([b, l]) =>
    fixed(50 + Math.cos(b) * l)
  );
  const gy = useTransform<number, string>([bearing, lean], ([b, l]) =>
    fixed(50 + Math.sin(b) * l)
  );

  // Pointer distance in px, and half the container's width, which is what turns
  // px into the vines' viewBox units. The size is measured rather than assumed
  // because the container is `min(26rem, 92vw)` and so is not a constant.
  const distance = useTransform<number, number>([dx, dy], ([x, y]) => Math.hypot(x, y));
  const halfSize = useMotionValue(208);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => halfSize.set(el.getBoundingClientRect().width / 2 || 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [halfSize]);

  // Quiet numbers. The old fill peaked at 0.80 alpha across a 20rem circle,
  // which is a lot of red on a near-white page; the rays carry the effect now,
  // so the fill only has to bridge the gap between the core and them.
  const hot = useTransform(lit, (i) => fixed(0.14 + 0.2 * i));
  const mid = useTransform(lit, (i) => fixed(0.06 + 0.12 * i));
  const far = useTransform(lit, (i) => fixed(0.025 + 0.05 * i));

  // Four stops so the fill has a long tail. The tail is the point: it has to
  // still be carrying colour out at 60-70% of the radius, because that is where
  // the rays live. When the fill died at 58% the rays began in bare space and
  // read as a separate ring hovering around the button.
  const aura = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgb(var(--reactor) / ${hot}) 0%, rgb(var(--reactor) / ${hot}) 18%, rgb(var(--reactor) / ${mid}) 36%, rgb(var(--reactor) / ${far}) 58%, rgb(var(--reactor) / 0) 84%)`;
  const auraScale = useTransform(lit, [0, 1], [0.9, 1.08]);

  const press = () => {
    const next = presses + 1;
    setPresses(next);

    // Реплика этого нажатия становится первой строкой пульта, а сам пульт
    // вылетает из ядра — на пике толчка, когда волна уже пошла, а не до неё:
    // так видно, что это она снесла страницу.
    const r = coreRef.current?.getBoundingClientRect();
    const line = next <= PRESS_LINES ? t(`press.${next}`) : t('pressCount', { count: next });
    const go = () =>
      openPult(
        r
          ? { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2, line }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2, line }
      );
    if (reduceMotion) {
      go();
      return;
    }
    window.setTimeout(go, BURST_SECONDS * IMPULSE * 1000 + 60);

    // Keep only the tail: rings older than MAX_WAVES have long since faded, and
    // holding their ids just leaks state on a button that invites mashing.
    const rings = Array.from({ length: RINGS_PER_PRESS }, () => ({
      id: nextWave.current++,
      delay: 0
    }));
    setWaves((w) => [...w, ...rings].slice(-MAX_WAVES));

    // Tell the vines to roll fresh directions before the throw reaches them.
    seed.set(seed.get() + 1);

    // One impulse: shove, then decay. The rise is short and the fall is the
    // rest of the duration, so the vines are thrown and then coast back rather
    // than being driven out and pulled in again. `easeOut` on both segments
    // keeps the turn at the top soft — the old two-peak curve is what made
    // this read as pulsation.
    animate(punch, [0, 1, 0], {
      duration: BURST_SECONDS,
      times: [0, IMPULSE, 1],
      ease: 'easeOut'
    });

    // The core goes with it, once. It starts under 1: that dip is the press,
    // and it replaces the CSS `active:scale` the button used to carry — two
    // things writing `transform` on one element means whichever loses the
    // cascade is silently ignored.
    animate(core, [0.95, 1.09, 1], {
      duration: BURST_SECONDS * 0.7,
      times: [0, 0.16, 1],
      ease: 'easeOut'
    });

    // Letting go of the pointer, on its own envelope.
    //
    // The shove is a spike by design: momentum arrives all at once. But "the
    // cursor does not exist" has to hold for as long as the throw is visible,
    // which is the best part of two seconds. Rising faster than the shove opens
    // the hand *before* the push lands; the flat middle is the flight; and the
    // long ease back returns the chase only once the vines have stopped
    // swinging, so nothing snaps sideways at the end. Same duration as `sway`
    // for that reason — the grip must not come back while a vine is still
    // moving.
    animate(release, [0, 1, 1, 0], {
      duration: BURST_SECONDS * 1.4,
      times: [0, 0.05, 0.55, 1],
      ease: ['easeOut', 'linear', 'easeInOut']
    });

    // The swing outlives the shove and overshoots slightly on the way back —
    // the small negative is a vine passing centre before it settles. Without
    // it the return is the outward path played backwards, which is the thing
    // that made the whole press look mechanical.
    animate(sway, [0, 1, -0.14, 0], {
      duration: BURST_SECONDS * 1.4,
      // Peaks around 300ms against the shove's 150ms. The vine is pushed first
      // and swings after, because that is the order it happens in — a swing
      // that peaked with the shove was just the shove wearing a second name.
      times: [0, 0.16, 0.66, 1],
      ease: 'easeOut'
    });
  };

  // Presses past the last written line fall back to a counted one.
  const caption =
    presses === 0
      ? t('enterCaption')
      : presses <= PRESS_LINES
        ? t(`press.${presses}`)
        : t('pressCount', { count: presses });

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 26rem of box around a 20rem aura. The headroom is the point: the glow
          has to reach zero well before anything can clip it.
          Both track the viewport on narrow screens, and they have to track it
          together: at 390px a fixed 20rem aura is already wider than the block
          it sits in, and the proximity scale then pushes it past that. */}
      <div
        ref={ref}
        className="relative grid h-[min(26rem,92vw)] w-[min(26rem,92vw)] place-items-center"
      >
        {/* Idle breath. A separate element from the proximity scale below, so
            the two transforms compose instead of overwriting each other. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute grid h-[min(20rem,70vw)] w-[min(20rem,70vw)] place-items-center ${
            reduceMotion ? '' : 'animate-breathe'
          }`}
        >
          <motion.span
            style={{ backgroundImage: aura, scale: auraScale }}
            className="block h-full w-full rounded-full"
          />
        </span>

        {/* Shockwaves. Each is a soft ring that starts at the core's edge and
            swells past the aura as it fades — the glow spreading outward rather
            than a hard circle travelling. Rendered before the vines so the
            vines stay on top of their own wave. */}
        {waves.map((wave) => (
          <motion.span
            key={wave.id}
            aria-hidden="true"
            initial={{ scale: 0.3, opacity: 0.5 }}
            animate={{ scale: RING_SCALE, opacity: 0 }}
            transition={{
              duration: RING_SECONDS,
              ease: [0.16, 1, 0.3, 1],
              // The second ring of a press trails the first.
              delay: wave.delay
            }}
            onAnimationComplete={() => setWaves((w) => w.filter((x) => x.id !== wave.id))}
            style={{
              // A band, not a disc: transparent through the middle so the ring
              // is legible as a ring against the fill it is passing through.
              // The inner shoulder is steeper than the outer one, which is how
              // a wave actually looks — a front, and a wake behind it.
              backgroundImage:
                'radial-gradient(circle, rgb(var(--reactor) / 0) 44%, rgb(var(--reactor) / 0.34) 62%, rgb(var(--reactor) / 0.14) 73%, rgb(var(--reactor) / 0) 88%)'
            }}
            className="pointer-events-none absolute h-[min(20rem,70vw)] w-[min(20rem,70vw)] rounded-full"
          />
        ))}

        {/* The vines. Sized to the whole box, not the aura: they need room to
            reach past the glow toward wherever the pointer is. */}
        <ReactorVines
          bearing={bearing}
          intensity={lit}
          distance={distance}
          halfSize={halfSize}
          burst={punch}
          release={release}
          sway={sway}
          seed={seed}
          still={Boolean(reduceMotion)}
        />

        {/* The core. Fixed dead centre, and the only red in the palette.
            Deliberately borderless: an outline here was drawing a hard ring at
            exactly the seam the gradient is trying to hide, and cutting the
            object back into two. */}
        <motion.button
          ref={coreRef}
          type="button"
          // Палец не водит курсором над экраном: на телефоне подгрузка
          // начинается с касания, на сотню миллисекунд раньше нажатия.
          onPointerDown={warmPult}
          onPointerEnter={() => hover.set(1)}
          onPointerLeave={() => hover.set(0)}
          onClick={press}
          aria-label={t('enterCaption')}
          style={{
            scale: core,
            // Lit from above rather than filled flat: the top is a touch
            // lighter, the bottom a touch deeper. Two percent of lightness, and
            // the difference between a sticker and a lamp.
            backgroundImage:
              'radial-gradient(circle at 50% 34%, rgb(232 96 90) 0%, rgb(var(--reactor)) 52%, rgb(196 44 39) 100%)',
            // The rim is where "jagged" lived: a solid circle against a soft
            // glow ends on one hard pixel. This spreads the last few pixels of
            // the core outward into the aura so the edge has nowhere to land.
            boxShadow: '0 0 22px 6px rgb(var(--reactor) / 0.34)'
          }}
          className="relative grid h-28 w-28 cursor-pointer place-items-center rounded-full text-white"
        >
          <span className="text-2xl font-bold tracking-[0.08em]">{t('enter')}</span>
        </motion.button>
      </div>

      {/* The caption is the whole payoff of pressing, so it announces itself. */}
      <span key={caption} className="ps-label animate-rise-in text-center">
        {caption}
      </span>
    </div>
  );
}
