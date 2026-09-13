'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { placeForPath } from '@/lib/navigation';
import { AssistantAvatar } from './AssistantAvatar';
import { AssistantLauncher } from './AssistantLauncher';

type Message = { id: string; role: 'assistant' | 'user'; text: string };

/** How tall the message field may grow before it starts scrolling, in pixels. */
const MAX_FIELD = 120;

/** How often the typewriter puts more of an answer on screen, in ms. */
const TYPE_MS = 28;
/** Characters per tick while it is keeping up — around seventy a second. */
const TYPE_CHARS = 2;
/** How many characters of backlog buy one more character per tick. */
const TYPE_CATCHUP = 40;

/**
 * The two bubbles.
 *
 * Written out here because the dog's is used twice — once for a finished turn
 * and once for the one being typed — and the handover between them must not be
 * visible. Two copies of a class list drift, and the day they drift the panel
 * twitches at the end of every answer.
 */
const SAID =
  'max-w-[88%] rounded-block rounded-bl-sm border-2 border-rule bg-sunk px-3.5 py-2.5 text-[0.9375rem] leading-relaxed text-ink';
const ASKED =
  'ml-auto max-w-[88%] rounded-block rounded-br-sm bg-accent px-3.5 py-2.5 text-[0.9375rem] font-medium leading-relaxed text-accent-ink';

/** Where the panel sits and whether it has been unclipped, per browser. */
const STORE_KEY = 'podshar:chat';
/** How much of a released panel must stay on screen after a resize or a drop, in pixels. */
const EDGE_KEEP = 56;

/**
 * How far a released panel has to move to stay within reach: at least
 * EDGE_KEEP pixels of it across, and its top edge inside the window. The header
 * is the only handle, and a panel whose header is off the screen cannot be
 * picked up again by anything on the page.
 */
function pullBack(r: DOMRect): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  if (r.right < EDGE_KEEP) dx = EDGE_KEEP - r.right;
  else if (r.left > window.innerWidth - EDGE_KEEP) dx = window.innerWidth - EDGE_KEEP - r.left;
  if (r.top < 0) dy = -r.top;
  else if (r.top > window.innerHeight - EDGE_KEEP) dy = window.innerHeight - EDGE_KEEP - r.top;
  return { dx, dy };
}
/** Pointer travel, in px, past which a press on the grip counts as a drag. */
const SLOP = 5;
/** How close to the right edge the panel must come before it will clip back. */
const SNAP = 96;
/**
 * How far the panel has to be pulled away from the edge before it comes off.
 *
 * Far enough that a stray drag on the header does not tear it loose, close
 * enough that the pull is one movement of the wrist and not a haul.
 */
const TEAR = 92;
/**
 * How far the hand can travel before the panel is meaningfully behind it.
 *
 * The lag is the whole tell: it is being held, and it is starting to come away.
 * Following the hand one-for-one would say the opposite — that it was never
 * attached to anything. But the resistance has to *build*, not exist from the
 * first pixel: the curve below leaves the panel under the hand for the first few
 * millimetres and only then starts holding it, which is how a magnet behaves and
 * how a browser tab comes out of its window.
 *
 * It also decides the size of the pop when the panel finally comes off, since
 * that pop is exactly the distance the panel is behind at the moment it lets go.
 * At the values here the hand is about 22px ahead by then — enough to read as a
 * release, small enough that the panel is not seen to teleport. The earlier
 * shape lagged by fifty-odd pixels and did teleport.
 */
const LAG = 160;

/**
 * What a loose window may be resized to.
 *
 * Limits rather than freedom, because both ends of the range break something
 * real, and the floor is set by what was actually seen to break rather than by
 * what looked small enough. At 260 square the panel stops being a chat: the
 * dog's job title under his name wraps to three lines and eats the header, and
 * what is left over for the conversation is shorter than one of his own
 * answers, so the form ends up sitting on the last bubble. The numbers here
 * leave the header at two lines and keep five or six lines of conversation,
 * which is the least that is still worth having on screen.
 *
 * Too wide is the other failure: a panel meant to sit beside the page becomes
 * the page, and once it is larger than the screen there is no header left to
 * grab and no way back. `pullBack` rescues a window dragged off the edge; it
 * cannot rescue one that no longer fits.
 *
 * The upper bounds also track the window itself, so shrinking the browser cannot
 * strand a panel that was sized on a larger screen.
 */
const MIN_W = 300;
const MIN_H = 360;
const MAX_W = 560;
/** Breathing room kept between the panel and the edges of the screen, in px. */
const MARGIN = 32;

/**
 * Where an element would sit with its transform taken off.
 *
 * The tear places the panel by setting a transform, so it needs the box that
 * transform is applied *to* — and every rectangle it can measure already has one
 * applied. Subtracting it is not optional and the motion value is not a safe
 * substitute: framer writes those to the DOM on its own frame, so the offset set
 * three lines earlier in the same handler is not necessarily the one the browser
 * has painted. Measuring against a stale transform left the panel nine pixels
 * off the hand on every tear — constant, so it followed the cursor perfectly
 * from there, which is exactly what makes that kind of mistake read as
 * sloppiness rather than as a bug worth looking for.
 */
function restingBox(el: HTMLElement): { left: number; top: number } {
  const rect = el.getBoundingClientRect();
  const applied = getComputedStyle(el).transform;
  if (!applied || applied === 'none') return { left: rect.left, top: rect.top };
  const shift = new DOMMatrixReadOnly(applied);
  return { left: rect.left - shift.e, top: rect.top - shift.f };
}

function fitSize(w: number, h: number): { w: number; h: number } {
  return {
    w: Math.round(Math.min(Math.max(w, MIN_W), Math.min(MAX_W, window.innerWidth - MARGIN))),
    h: Math.round(Math.min(Math.max(h, MIN_H), window.innerHeight - MARGIN))
  };
}

/**
 * Follow a pointer on the window until it is let go.
 *
 * Both gestures here need this and for the same reason: the thing under the hand
 * moves out from under it almost immediately, and an element listener stops
 * hearing anything the moment the cursor is no longer over it — the drag then
 * dies four pixels in, which is exactly what it used to do. Pointer capture
 * ought to cover that and did not survive the re-renders a drag itself causes,
 * so the listeners go somewhere that cannot move.
 *
 * Added and removed by the identical closures. However many renders happen in
 * between, nothing is left behind on the window to quietly drag the panel during
 * some later, unrelated click.
 */
function holdPointer(move: (e: PointerEvent) => void, letGo: () => void) {
  const onMove = (e: PointerEvent) => move(e);
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    letGo();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

/**
 * Podshar, the resident assistant.
 *
 * One panel at every width, hidden until asked for, opened by a round button in
 * the bottom-right corner with the dog's face on it — the shape every assistant
 * widget on the web has, and the reason it needs no label to be understood.
 *
 * It was a permanent third column on desktop until v0.5. Two things were wrong
 * with that: the conversation sat there taking a fifth of the screen whether or
 * not anyone was talking to it, and the desktop column and the mobile drawer
 * were separate elements rendering separate `<ChatBody />`s — two message lists,
 * two pieces of state, drifting apart the moment the window crossed `lg`. One
 * fixed panel has neither problem.
 *
 * Fixed rather than a flex sibling, so it floats over the canvas instead of
 * squeezing the bento grid on open. The left drawer still pushes; that one is
 * navigation, and losing your place in the page while picking a destination is
 * the point of a drawer. This is a conversation held beside the page.
 */
export function RightAIChat() {
  const t = useTranslations('assistant');
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  /**
   * Clipped to the edge, or off the leash.
   *
   * Docked, the panel is what it has always been: full height against the right
   * edge, sliding in and out. Released, it becomes a window you can put where
   * you like — because the thing you want to ask the dog about is often exactly
   * what the panel is covering, and a conversation held beside the page should
   * not be the reason you cannot see the page.
   *
   * It clips back by pressing the same catch, and lands where it started rather
   * than wherever it was dropped: docking is a place, not a direction.
   */
  const [free, setFree] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** True while a release right now would clip the panel back to the edge. */
  const [willSnap, setWillSnap] = useState(false);
  /** Brief, and only to acknowledge a landing. */
  const [landed, setLanded] = useState(false);
  /** True while the panel is being pulled but has not yet come off the edge. */
  const [peeling, setPeeling] = useState(false);
  /**
   * How big the loose window has been made, if it has been touched at all.
   *
   * `null` means "whatever the stylesheet says", which is the right default and
   * also the right thing to keep saying: a size in pixels frozen at first render
   * would stop answering `vh` and `vw` the moment the browser changed shape.
   * Only a deliberate resize replaces it. Docked, it is ignored entirely — the
   * clipped panel is the full height of the edge it is clipped to — but it is
   * remembered, so unclipping gives back the window you had.
   */
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  /** True while the corner is being dragged. */
  const [sizing, setSizing] = useState(false);
  /**
   * The same fact as `willSnap`, for the code rather than the screen.
   *
   * The pointer handlers are registered once, at the start of a gesture, and a
   * closure made then reads whatever `willSnap` was at that moment — which is
   * always false, since nothing has moved yet. State draws the landing zone; the
   * ref decides where the panel goes when the hand opens.
   */
  const snapRef = useRef(false);

  /**
   * The live gesture handlers, so a drag in progress can reach the current ones.
   *
   * The listeners go on at pointer-down and must come off by the identical
   * function objects. A drag re-renders this component many times and every
   * render builds new handlers, so registering one and removing another would
   * leave a listener on the window for good — quietly dragging the panel on
   * some later, unrelated click.
   */
  const moveRef = useRef<(e: PointerEvent) => void>(() => {});
  const upRef = useRef<() => void>(() => {});
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  /**
   * The gesture in progress, if any.
   *
   * A ref rather than state: this changes on every pointer move, and a panel
   * that re-renders sixty times a second while being dragged is a panel that
   * drags badly.
   */
  const gesture = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    /** Where inside the header the pointer took hold. */
    grabX: number;
    grabY: number;
    torn: boolean;
    moved: boolean;
    /** Whether the panel has been clear of the edge at any point in this drag. */
    escaped: boolean;
  } | null>(null);

  // Read after mount, never during render: the server has no idea where this
  // browser last left the panel, and disagreeing about it is a hydration error
  // on every load.
  /**
   * The same size, for code that cannot wait for a render.
   *
   * The corner drag writes a size on every pointer move and reads it back on
   * pointer up to store it. Reading it out of state there would save whatever
   * the last committed render happened to be holding, which is not necessarily
   * where the hand stopped.
   */
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  const applySize = (next: { w: number; h: number } | null) => {
    sizeRef.current = next;
    setSize(next);
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const v = JSON.parse(raw) as {
        free?: boolean;
        x?: number;
        y?: number;
        w?: number;
        h?: number;
      };
      if (typeof v.x === 'number') x.set(v.x);
      if (typeof v.y === 'number') y.set(v.y);
      // Put back through the limits rather than trusted: the window it was
      // measured in may have been a different size, or a different screen.
      if (typeof v.w === 'number' && typeof v.h === 'number') {
        const fitted = fitSize(v.w, v.h);
        sizeRef.current = fitted;
        setSize(fitted);
      }
      setFree(Boolean(v.free));
    } catch {
      // Blocked storage, or something else under our key. The default corner is
      // a perfectly good place to be.
    }
  }, [x, y]);

  const persist = (next: { free?: boolean; x?: number; y?: number }) => {
    try {
      window.localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          free,
          x: x.get(),
          y: y.get(),
          w: sizeRef.current?.w,
          h: sizeRef.current?.h,
          ...next
        })
      );
    } catch {
      // It still works for this session.
    }
  };

  // A window made smaller can leave a released panel off the screen, where
  // there is nothing left to grab to bring it back. Measured rather than
  // computed: the panel's own rectangle already accounts for its size, its
  // anchor and however far it has been dragged.
  //
  // Measured twice: now, and again once the anchor has finished moving.
  // Releasing the panel animates its top, right, width and height, and a panel
  // restored from storage is released on every page load — so the first
  // measurement sees the docked rectangle, mid-slide, and the correction came
  // out one anchor-shift short. A panel left low ended 80px further down than
  // intended, below the bottom of the screen with no header to grab: the dog
  // fell off the page and stayed there.
  useEffect(() => {
    if (!free) return;
    const el = wrapRef.current;
    const clamp = () => {
      if (!el) return;
      // Size first: a panel sized on a wide screen and reopened on a narrow one
      // has to be brought back inside the limits before there is any point
      // asking whether it is still reachable.
      const held = sizeRef.current;
      if (held) {
        const fitted = fitSize(held.w, held.h);
        if (fitted.w !== held.w || fitted.h !== held.h) {
          sizeRef.current = fitted;
          setSize(fitted);
        }
      }
      const { dx, dy } = pullBack(el.getBoundingClientRect());
      if (dx) x.set(x.get() + dx);
      if (dy) y.set(y.get() + dy);
    };
    // The wrapper's own transitions only: the panel inside it animates too, and
    // its events bubble up to here.
    const onSettled = (e: TransitionEvent) => {
      if (e.target === el) clamp();
    };
    clamp();
    el?.addEventListener('transitionend', onSettled);
    window.addEventListener('resize', clamp);
    return () => {
      el?.removeEventListener('transitionend', onSettled);
      window.removeEventListener('resize', clamp);
    };
  }, [free, x, y]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Move focus into the panel on open, so the keyboard follows the eye.
  useEffect(() => {
    if (open) panelRef.current?.querySelector('textarea')?.focus();
  }, [open]);

  const dock = () => {
    x.set(0);
    y.set(0);
    setFree(false);
    setWillSnap(false);
    snapRef.current = false;
    persist({ free: false, x: 0, y: 0 });
    // A short acknowledgement, so the panel is seen to arrive rather than to
    // have always been there. Windows does the same thing when a window snaps,
    // and for the same reason: the movement was the user's, and the software
    // should be seen to have caught it.
    setLanded(true);
    window.setTimeout(() => setLanded(false), 420);
  };

  const release = () => {
    setFree(true);
    persist({ free: true });
  };

  /**
   * The corner, and why it is that corner.
   *
   * The window is pinned by its top-right — `right-4 top-20` plus the drag
   * offset — so the grip in the opposite corner is the one that needs no
   * arithmetic and no explaining: pulling it left widens the panel into the page
   * and pulling it down lengthens it, with the anchor never moving. A grip on
   * the bottom right would have to shift the anchor by exactly as much as it
   * changed the width, and it would grow the panel towards the screen edge it is
   * already sitting against, which is the direction with no room in it.
   */
  const sizeFrom = useRef<{ px: number; py: number; w: number; h: number } | null>(null);
  const sizeMoveRef = useRef<(e: PointerEvent) => void>(() => {});
  const sizeUpRef = useRef<() => void>(() => {});

  const onCornerGrab = (e: React.PointerEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    // Stops the press selecting the conversation behind it as the hand travels.
    e.preventDefault();
    const r = el.getBoundingClientRect();
    sizeFrom.current = { px: e.clientX, py: e.clientY, w: r.width, h: r.height };
    setSizing(true);
    holdPointer(
      (ev) => sizeMoveRef.current(ev),
      () => sizeUpRef.current()
    );
  };

  const onCornerMove = (e: PointerEvent) => {
    const from = sizeFrom.current;
    if (!from) return;
    applySize(fitSize(from.w + (from.px - e.clientX), from.h + (e.clientY - from.py)));
  };

  const onCornerLetGo = () => {
    sizeFrom.current = null;
    setSizing(false);
    persist({});
  };

  sizeMoveRef.current = onCornerMove;
  sizeUpRef.current = onCornerLetGo;

  /** The same by keyboard: a handle only a mouse can reach is not a control. */
  const onCornerKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 48 : 16;
    const by: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowDown: [0, step],
      ArrowUp: [0, -step]
    };
    const nudge = by[e.key];
    const el = wrapRef.current;
    if (!nudge || !el) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    applySize(fitSize(r.width + nudge[0], r.height + nudge[1]));
    persist({});
  };

  /**
   * Press, drag, tear off, shove back.
   *
   * One gesture on the header does all of it. Pressed and let go, it toggles —
   * the keyboard path, and the one for anybody who would rather press a button
   * than throw a window about. Pressed and moved, it drags; and if the panel was
   * still clipped to the edge, that first movement pulls it off, the way a tab
   * comes out of a browser window. Nothing has to be armed first.
   */
  const onGrab = (e: React.PointerEvent) => {
    // A pull that begins before the last spring has finished should start from
    // where the panel actually is, not from where it was heading.
    x.stop();
    y.stop();

    // The close cross is a button, not a handle.
    const hit = (e.target as HTMLElement).closest('button');
    if (hit && !hit.hasAttribute('data-grip')) return;

    const header = (e.currentTarget as HTMLElement).getBoundingClientRect();
    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: x.get(),
      baseY: y.get(),
      grabX: e.clientX - header.left,
      grabY: e.clientY - header.top,
      torn: free,
      moved: false,
      escaped: false
    };

    // The live handlers are reached through refs, for the reason set out on
    // `holdPointer`: this gesture re-renders the component many times, and each
    // render builds new closures.
    holdPointer(
      (ev) => moveRef.current(ev),
      () => upRef.current()
    );
  };

  const onDragMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < SLOP) return;
    g.moved = true;
    setDragging(true);

    // Still clipped: the panel resists.
    //
    // A window that came away at the first twitch would be a window that is
    // never really attached, and the snap back to the edge would then have
    // nothing to mean. So the pull is answered by a fraction of itself, easing
    // out to a limit, the way anything held by a magnet gives a little before
    // it lets go — and it only counts leftward, since dragging a docked panel
    // further into the edge is not a request for anything.
    if (!g.torn) {
      const pull = Math.max(-dx, 0);
      if (pull < 1) {
        x.set(0);
        y.set(0);
        return;
      }
      setPeeling(true);
      // Exponential with the same length constant top and bottom: the slope at
      // the very start is exactly one, so the panel leaves with the hand and
      // falls behind gradually instead of refusing the first centimetre.
      const give = LAG * (1 - Math.exp(-pull / LAG));
      x.set(-give);
      y.set(dy * 0.1);
      if (pull < TEAR) return;

      // Past the threshold it comes off. The panel changes size and anchor at
      // this moment, so rather than let it jump somewhere of its own choosing
      // it is placed under the hand that pulled it.
      //
      // `flushSync`, and this is the part that took a while to see. Both halves
      // of the handover need the *new* rectangle: it cannot be measured before
      // React has written the new geometry, and it must not be measured a frame
      // later, because a frame later is a frame of the panel sitting in the
      // wrong place with the hand already gone. Deferring it to the next frame
      // is what the previous version did, and it lost the race in two ways —
      // a pointer move landing first would drag from a stale origin, and the
      // easing spring that followed kept writing to `x` for a third of a second
      // while the hand was already moving. The panel looked stuck to the edge
      // and then flung itself, and had to be caught and grabbed a second time.
      // Nothing eases here: from this instant the hand is the animation.
      g.torn = true;
      flushSync(() => {
        setPeeling(false);
        setFree(true);
      });

      const el = wrapRef.current;
      if (el) {
        // The offset that puts the point the hand took hold of back under the
        // hand, measured against the panel's untransformed box — see
        // `restingBox` for why the current offset cannot be read off `x`.
        const rest = restingBox(el);
        const nx = e.clientX - g.grabX - rest.left;
        const ny = e.clientY - g.grabY - rest.top;
        x.set(nx);
        y.set(ny);
        g.baseX = nx;
        g.baseY = ny;
        g.startX = e.clientX;
        g.startY = e.clientY;
      }
      return;
    }

    x.set(g.baseX + dx);
    y.set(g.baseY + dy);

    // The magnet only works on a panel that has been brought back to the edge,
    // never on one that has not left it yet.
    //
    // Without that condition it is armed from the first pixel of every drag,
    // because a panel torn off the right edge is by definition still next to the
    // right edge. Tear it loose, let go a moment too early, and it flies back to
    // where it came from — which reads as the site refusing the gesture rather
    // than as a feature, and it is the whole of "the magnet always works".
    // Arming it on the way out means the snap zone appears when you steer
    // towards the edge, which is the only time anybody wants it.
    const el = wrapRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const near = r.right > window.innerWidth - SNAP;
      if (!near) g.escaped = true;
      snapRef.current = g.escaped && near;
      setWillSnap(snapRef.current);
    }
  };

  const onLetGo = () => {
    const g = gesture.current;
    gesture.current = null;
    setDragging(false);
    setPeeling(false);
    if (!g) return;

    // A press that never moved is a press.
    if (!g.moved) {
      if (free) dock();
      else release();
      return;
    }

    // Pulled, but not far enough. It goes back to the edge under its own
    // steam — with enough spring in it to read as having been let go of
    // rather than as having been put back.
    if (!g.torn) {
      setPeeling(false);
      animate(x, 0, { type: 'spring', stiffness: 420, damping: 24 });
      animate(y, 0, { type: 'spring', stiffness: 420, damping: 24 });
      return;
    }

    if (snapRef.current) {
      dock();
      return;
    }
    setWillSnap(false);

    // Let go past the edge of the screen, it comes back to where it can be
    // reached. Nothing else would ever bring it back: dragging needs the header,
    // and the header is what went over the edge. Stored where it is going, not
    // where the hand opened.
    const el = wrapRef.current;
    const { dx, dy } = el ? pullBack(el.getBoundingClientRect()) : { dx: 0, dy: 0 };
    const nx = x.get() + dx;
    const ny = y.get() + dy;
    if (dx) animate(x, nx, { type: 'spring', stiffness: 420, damping: 30 });
    if (dy) animate(y, ny, { type: 'spring', stiffness: 420, damping: 30 });
    persist({ x: nx, y: ny });
  };

  moveRef.current = onDragMove;
  upRef.current = onLetGo;

  return (
    <>
      {/* Two elements, one panel. The outer carries the drag offset, which
          framer-motion writes as a transform; the inner carries the open and
          shut transition, which is also a transform. On one element the second
          would overwrite the first, and the panel would either refuse to move
          or refuse to close.

          The wrapper never takes a click of its own: docked and shut it still
          covers a tall strip of the right edge, and an invisible box swallowing
          presses there is a bug nobody would think to look for. */}
      {/* Where it will land. Windows shows you the shape of the snap before you
          commit to it, and that preview is most of why snapping feels like a
          feature rather than an accident — you are choosing it, not discovering
          it afterwards. */}
      <AnimatePresence>
        {dragging && willSnap ? (
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="pointer-events-none fixed bottom-0 right-0 top-0 z-40 w-[min(23rem,92vw)] rounded-l-block border-2 border-r-0 border-dashed border-ink/45 bg-ink/[0.07]"
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        ref={wrapRef}
        // A measured size only applies to the loose window, and only once
        // somebody has asked for one. Docked, the classes below own the
        // geometry; inline pixels there would fight the edge it is clipped to.
        style={{ x, y, ...(free && size ? { width: size.w, height: size.h } : null) }}
        // `overflow-clip`. Docked and shut, the panel waits a whole panel's
        // width past the right edge of the screen. Chrome ignores anything
        // parked there; Safari on a phone let the page be dragged sideways
        // towards it. Clipped by its own wrapper it still slides in from the
        // edge exactly as before, and past the edge it simply is not there.
        // `clip` rather than `hidden`: `hidden` makes a scroll container, and
        // focusing the field mid-slide would then scroll the panel inside it.
        className={`pointer-events-none fixed z-50 overflow-clip ${
          dragging || sizing
            ? ''
            : 'transition-[top,right,width,height] duration-drape ease-drape'
        } ${
          free
            ? 'right-4 top-20 h-[min(34rem,72vh)] w-[min(23rem,92vw)]'
            : 'bottom-0 right-0 top-0 w-[min(23rem,92vw)]'
        }`}
      >
        <aside
          ref={panelRef}
          aria-label={t('name')}
          // Off-screen content stays in the DOM, so without `inert` a keyboard
          // user tabs into a conversation nobody can see.
          inert={!open}
          className={`relative flex h-full flex-col border-2 bg-surface transition-[transform,opacity,border-color] duration-drape ease-drape ${
            landed ? 'border-ink' : 'border-rule'
          } ${
            free || peeling ? 'rounded-block' : 'rounded-l-block border-r-0'
          } ${
            open
              ? 'pointer-events-auto translate-x-0 opacity-100'
              : free
                ? 'pointer-events-none scale-[0.98] opacity-0'
                : 'pointer-events-none translate-x-full'
          }`}
        >
          <ChatBody
            onClose={() => setOpen(false)}
            free={free}
            dragging={dragging}
            onGrab={onGrab}
            onCornerGrab={onCornerGrab}
            onCornerKey={onCornerKey}
          />
        </aside>
      </motion.div>

      {/* The launcher owns its own position, collapse state and drag. This
          component only says whether the panel is up. */}
      <AssistantLauncher hidden={open} onOpen={() => setOpen(true)} />
    </>
  );
}

function ChatBody({
  onClose,
  free,
  dragging,
  onGrab,
  onCornerGrab,
  onCornerKey
}: {
  onClose: () => void;
  /** True while the panel is off the edge and can be moved. */
  free: boolean;
  dragging: boolean;
  onGrab: (e: React.PointerEvent) => void;
  onCornerGrab: (e: React.PointerEvent) => void;
  onCornerKey: (e: React.KeyboardEvent) => void;
}) {
  const t = useTranslations('assistant');
  const tGuide = useTranslations('guide');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  /**
   * The reply being written, or `null` if there is nothing on the way.
   *
   * Kept out of `messages` until it is finished. A half-written sentence is not
   * a turn in the conversation — it cannot be quoted back to the model, it must
   * not be announced to a screen reader on every keystroke, and if the line
   * drops halfway it should not look like the dog chose to stop there.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);

  /** Received from the server but not yet on screen. */
  const waiting = useRef('');
  /** On screen. The same string as `draft`, reachable without a render. */
  const shown = useRef('');
  /** True once the server has said everything it is going to say. */
  const ended = useRef(false);
  const ticker = useRef<number | null>(null);

  const stopTyping = () => {
    if (ticker.current !== null) window.clearInterval(ticker.current);
    ticker.current = null;
  };
  // A panel closed mid-answer takes its typewriter with it.
  useEffect(() => stopTyping, []);

  /**
   * Put the answer on screen at a pace a person can read, wherever it came from.
   *
   * This is the part that makes it look like writing, and it is deliberately not
   * the network. The model's own deltas arrive in gusts — a comma, then nine
   * words at once, then a pause — and rendering them as they land looks like a
   * page loading, not like somebody typing. Everything received goes into a
   * queue instead, and the queue is drained at a steady rate.
   *
   * The rate rises with the backlog, so the typewriter is never the reason an
   * answer is slow: a couple of characters a tick while it is keeping up, more
   * as soon as it is behind. That is also what lets the keyword fallback — which
   * arrives complete, in a single beat — come out typed at the same cadence
   * rather than appearing all at once. Nobody should be able to tell from the
   * outside which half of the dog answered, and the timing was the last thing
   * that would have given it away.
   *
   * Reduced motion empties the queue whole on the first tick. The answer still
   * arrives; it simply does not perform.
   */
  const typeOut = () =>
    new Promise<void>((resolve) => {
      ticker.current = window.setInterval(() => {
        const left = waiting.current;
        if (!left) {
          if (ended.current) {
            stopTyping();
            resolve();
          }
          return;
        }
        const take = reduceMotion ? left.length : TYPE_CHARS + Math.ceil(left.length / TYPE_CATCHUP);
        waiting.current = left.slice(take);
        shown.current += left.slice(0, take);
        setDraft(shown.current);
      }, TYPE_MS);
    });

  // A guide opens by saying where you are standing, not with a menu. The
  // fallback covers a page the map does not describe, which today cannot
  // happen: the shell only wraps routes that exist, and the homepage is the
  // only one of those.
  const here = placeForPath(pathname);
  const opening = here?.status === 'live' ? tGuide(`${here.id}.here`) : t('intro');

  // Reseed whenever that line changes — a new language, or a new page. It also
  // clears the log, which is the right trade while there is exactly one page to
  // stand on. When the second one lands, this is the line to revisit: arriving
  // somewhere should append the dog's remark, not erase the conversation that
  // asked to go there.
  useEffect(() => {
    setMessages([{ id: 'intro', role: 'assistant', text: opening }]);
  }, [opening]);

  // Keep the newest turn in view.
  //
  // Smoothly for a whole turn arriving, but not while one is being typed: there
  // the log grows a few pixels at a time, and a smooth scroll restarted thirty
  // times a second never reaches the bottom it is heading for. Jumping reads as
  // the text pushing the view along, which is exactly what is happening.
  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: draft === null ? 'smooth' : 'auto'
    });
  }, [messages, draft]);

  // And again whenever the panel itself changes shape. Resizing the window does
  // not add a message, so nothing above fires — the log simply keeps the scroll
  // position it had, which after a shrink leaves the last thing said sitting
  // half under the field. That reads as the panel being broken rather than
  // merely smaller. Setting `scrollTop` cannot resize anything, so this cannot
  // feed itself.
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const watch = new ResizeObserver(() => {
      log.scrollTop = log.scrollHeight;
    });
    watch.observe(log);
    return () => watch.disconnect();
  }, []);

  // Grow the field down as the text wraps, instead of scrolling the beginning of
  // a sentence out of sight in a one-line box. Height is set from the content's
  // own `scrollHeight`, which is why it has to be cleared to `auto` first:
  // scrollHeight never reports less than the height already set, so without the
  // reset the field would grow and then refuse to shrink when text is deleted.
  //
  // Capped at MAX_FIELD, past which it scrolls. The panel is a fixed column with
  // the conversation above the field, and a box that keeps growing eats the
  // conversation it is a reply to.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = 'auto';

    // Empty is not "no content": an empty textarea reports the height of its
    // *placeholder*, which wraps to two lines in a panel this narrow. Measured
    // that way the box would open two lines tall and jump shorter at the first
    // keystroke. With nothing typed there is nothing to grow to, so the height
    // is handed back to `rows={1}` — which is also exactly how the single-line
    // input this replaced behaved, placeholder clipped and all.
    if (!input) {
      // `rows={1}` is not load-bearing enough on its own. An empty textarea lays
      // out its *placeholder*, so a placeholder long enough to wrap makes the
      // box two lines tall — which is what happened here, and what a longer
      // translation would quietly do again. One row, computed from the field's
      // own metrics, cannot be talked out of it by the copy.
      const style = getComputedStyle(field);
      const oneRow =
        parseFloat(style.lineHeight) +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        parseFloat(style.borderTopWidth) +
        parseFloat(style.borderBottomWidth);
      field.style.height = `${oneRow}px`;
      return;
    }

    // `scrollHeight` counts content and padding but not the border, and the box
    // is `border-box`, so assigning it straight leaves the field two pixels
    // short at the top and bottom and quietly clips the line it is meant to fit.
    const border = field.offsetHeight - field.clientHeight;
    field.style.height = `${Math.min(field.scrollHeight + border, MAX_FIELD)}px`;
  }, [input]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text }]);
    setInput('');
    setBusy(true);

    waiting.current = '';
    shown.current = '';
    ended.current = false;
    setDraft(null);

    // Started before the request, so the dots are already up and the first
    // characters go on screen the moment they exist rather than on the tick
    // after the interval happens to have been created.
    const typed = typeOut();
    let route: string | undefined;
    let broke = false;

    try {
      // `messages` is the log as it stood before this turn — the state update
      // above has not landed in this closure — so it is exactly the history,
      // with the text being sent carried separately. The opening line is left
      // out: it is the dog describing the page, which the brief already says.
      const history = messages
        .filter((m) => m.id !== 'intro')
        // Capped here as well as on the server. A long enough conversation would
        // otherwise grow past what the endpoint accepts and start coming back as
        // "no connection" — the one failure the fallback cannot cover, because
        // the request never arrives.
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.text }));

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, locale, path: pathname, history })
      });
      if (!res.ok || !res.body) throw new Error(`assistant responded ${res.status}`);

      // One line of JSON per beat. A chunk off the wire almost never ends on a
      // line boundary, so whatever follows the last newline is half a beat and
      // waits here for the rest of itself.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let carry = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });
        const lines = carry.split('\n');
        carry = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const beat = JSON.parse(line) as { text?: string; route?: string };
          if (typeof beat.text === 'string') waiting.current += beat.text;
          if (typeof beat.route === 'string') route = beat.route;
        }
      }
    } catch {
      broke = true;
    }

    // Whatever happened up there, the queue has everything it is going to get.
    ended.current = true;
    await typed;

    // The draft becomes a turn and the panel goes quiet in one commit, so there
    // is no frame in which the bubble has been taken away and not yet put back.
    const said = shown.current.trim();
    setDraft(null);
    setBusy(false);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'assistant', text: said || t('offline') }
    ]);

    // A line that dropped halfway keeps what was said — the words were his, and
    // replacing them with an apology would throw away the answer. Only a reply
    // that never started at all becomes one.
    if (route && !broke) {
      // Give the reply a beat to land before the page changes underneath.
      const target = route;
      setTimeout(() => router.push(target), 600);
    }
  }

  return (
    <>
      {/* The header is the handle. Anywhere else and you would be dragging the
          conversation, which is a thing people select text in. */}
      <header
        onPointerDown={onGrab}
        className={`flex touch-none items-center gap-3 px-5 py-5 ${
          dragging ? 'cursor-grabbing select-none' : 'cursor-grab select-none'
        }`}
      >
        <AssistantAvatar className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{t('name')}</p>
          <p className="ps-label">{free ? t('roleFree') : t('role')}</p>
        </div>

        {/* The grip.

            A pin used to live here and it was the wrong idea: a fastener you
            press is a setting, and this is not a setting, it is a handle. Six
            dots is what a thing you can pick up looks like everywhere, and the
            gesture it invites — pull — is the one that now works. Pressed
            without moving it still toggles, which keeps a keyboard and anyone
            who would rather not throw windows around on the same path. */}
        <button
          type="button"
          data-grip=""
          aria-label={free ? t('dock') : t('undock')}
          aria-pressed={free}
          className="grid h-9 w-7 shrink-0 cursor-grab place-items-center rounded text-ink-faint transition-colors hover:bg-sunk hover:text-ink active:cursor-grabbing"
        >
          <svg viewBox="0 0 10 16" aria-hidden="true" className="h-4 w-3" fill="currentColor">
            <circle cx="2.5" cy="3" r="1.4" />
            <circle cx="7.5" cy="3" r="1.4" />
            <circle cx="2.5" cy="8" r="1.4" />
            <circle cx="7.5" cy="8" r="1.4" />
            <circle cx="2.5" cy="13" r="1.4" />
            <circle cx="7.5" cy="13" r="1.4" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="grid h-9 w-9 place-items-center rounded border-2 border-rule text-base leading-none text-ink-muted transition-colors hover:bg-sunk hover:text-ink"
        >
          &#215;
        </button>
      </header>

      <div
        ref={logRef}
        className="flex-1 space-y-2 overflow-y-auto border-t border-rule-soft px-5 py-5"
      >
        {/* Only finished turns are announced. A live region that followed the
            typing would read the same sentence to a screen reader a dozen times
            as it grew; this way it is spoken once, whole, when it lands. */}
        <div aria-live="polite" className="space-y-2">
          {messages.map((m) => (
            <p key={m.id} className={m.role === 'assistant' ? SAID : ASKED}>
              {m.text}
            </p>
          ))}
        </div>

        {/* The answer on its way: the same bubble, first holding the dots and
            then filling with words. One element for both states so the moment
            he starts speaking is a change of contents, not a change of shape —
            no second bubble appearing under the first, nothing jumping. */}
        {busy ? (
          <p aria-hidden="true" className={SAID}>
            {draft === null ? (
              <Dots />
            ) : (
              <>
                {draft}
                <Caret />
              </>
            )}
          </p>
        ) : null}
      </div>

      {/* `items-end` so the button stays on the last line as the field grows,
          rather than floating in the middle of a four-line message. */}
      <form
        onSubmit={send}
        // Docked, the form sits on the bottom edge of the screen — which, on an
        // iPhone running the site from its home screen, is where the home
        // indicator lives. The inset is zero everywhere else, and a released
        // window is nowhere near that edge, so it does not take it.
        className={`flex items-end gap-2 border-t border-rule-soft p-3 ${
          free ? '' : 'pb-[max(0.75rem,env(safe-area-inset-bottom))]'
        }`}
      >
        <textarea
          ref={fieldRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, shift+Enter breaks the line — the arrangement every
            // chat box has, and the reason a textarea here does not cost you the
            // ability to just type and hit return. `isComposing` guards the
            // Enter that only confirms a character being composed.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          // 16px on a phone, 15 from `sm` up. Under 16, Safari on an iPhone
          // zooms the whole page in the moment the field is tapped and leaves
          // it zoomed — after which the page drags sideways. The one-row height
          // above is measured from the live line-height, so it follows along.
          //
          // The placeholder is held to one line and cut with an ellipsis rather
          // than allowed to wrap. An empty field is exactly one row tall by
          // design, so a placeholder that wraps to two does not make the box
          // taller — it gets sliced through the middle of the second line, which
          // looks like a rendering fault. It showed up as soon as the window
          // could be made narrow, and a longer translation would have found it
          // eventually anyway.
          className="min-w-0 flex-1 resize-none overflow-y-auto rounded border-2 border-rule bg-canvas px-3 py-2.5 text-[1rem] leading-relaxed text-ink outline-none transition-colors focus:border-ink placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap placeholder:text-ink-faint sm:text-[0.9375rem]"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="ps-label rounded border-2 border-transparent bg-accent px-3.5 py-3 text-accent-ink transition-opacity duration-drape hover:opacity-85 disabled:opacity-30"
        >
          {t('send')}
        </button>
      </form>

      {/* The size handle, on the loose window only — a clipped panel is as tall
          as the edge it is clipped to, and there is nothing there to resize.

          Not offered on a phone, where the panel is already almost the width of
          the screen and there is nothing to gain: a 24px target sitting on the
          corner of the text field would be a trap for a thumb, and this site
          holds itself to 44px for anything a thumb is meant to hit. */}
      {free ? (
        <button
          type="button"
          aria-label={t('resize')}
          onPointerDown={onCornerGrab}
          onKeyDown={onCornerKey}
          className="absolute bottom-0 left-0 z-10 hidden h-6 w-6 cursor-nesw-resize touch-none place-items-center text-ink-faint transition-colors duration-drape hover:text-ink focus-visible:text-ink sm:grid"
        >
          <svg
            viewBox="0 0 10 10"
            aria-hidden="true"
            className="h-2.5 w-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M1 3.5 6.5 9" />
            <path d="M1 7.5 2.5 9" />
          </svg>
        </button>
      ) : null}
    </>
  );
}

/**
 * He is thinking.
 *
 * Three dots that lift in turn, rather than the whole line pulsing together as
 * it did. A pulse is a loading indicator — a thing waiting on a machine. A
 * stagger reads as somebody about to speak, which is what is actually happening,
 * and it is the shape every chat has used for the same reason. Slow enough to be
 * calm; the panel is at the edge of the eye, and something flickering there is
 * an irritation rather than a signal.
 *
 * The global reduced-motion rule stops these where they stand, leaving three
 * dots — still the right sign, minus the fidget.
 */
function Dots() {
  return (
    <span className="flex h-[1.4em] items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ animationDelay: `${i * 0.16}s` }}
          className="h-1.5 w-1.5 animate-dot-hop rounded-full bg-ink"
        />
      ))}
    </span>
  );
}

/** The bar at the end of what has been written so far. It is the one thing that
 *  says the sentence is not finished, and its absence is how you know it is. */
function Caret() {
  return (
    <span
      aria-hidden="true"
      className="ms-0.5 inline-block h-[0.95em] w-[2px] translate-y-[0.15em] animate-caret-blink bg-ink/70"
    />
  );
}
