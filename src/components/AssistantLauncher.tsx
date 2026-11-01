'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { AssistantAvatar } from './AssistantAvatar';

const STORE_KEY = 'podshar:launcher';
/** Pointer travel, in px, above which a press counts as a drag and not a click. */
const DRAG_SLOP = 4;
/** Keep at least this much of the button on screen after a resize. */
const EDGE_KEEP = 12;
/**
 * How close to the bottom edge, in px, the dog counts as standing on it. There
 * he rides with the bottom: Safari's bottom bar grows and shrinks as the page
 * scrolls, and a dog pinned in place down there would end up under it. Dropped
 * any higher, he hangs from the top instead, and the bar no longer moves him at
 * all. 64 is more than the bar grows by, so a hanging dog is never covered.
 */
const DOCK = 64;

/** `top`: `y` is measured down from the top edge. Without it, up from the bottom. */
type Stored = { x: number; y: number; collapsed: boolean; top: boolean };

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    if (typeof v.x !== 'number' || typeof v.y !== 'number') return null;
    return { x: v.x, y: v.y, collapsed: Boolean(v.collapsed), top: v.top === true };
  } catch {
    // Private mode, blocked storage, or someone else's key in the way. The
    // launcher has a perfectly good default position; take it and move on.
    return null;
  }
}

/**
 * The assistant's launcher: the dog, in the corner, on a leash you can move.
 *
 * Three behaviours in one control, which is one more than a floating button
 * usually earns:
 *
 *   drag       it parks anywhere. The reactor, the quote block and the drawer
 *              all live under it at some window size, and a button fixed to one
 *              corner is a button that is sometimes in the way.
 *   collapse   shrinks it to a small disc for when you want it gone but not
 *              forgotten. Collapsed, a press expands rather than opening chat.
 *   open       a plain press, expanded, opens the panel.
 *
 * Position and collapsed state persist per browser, because a control you moved
 * that returns to its old spot on reload has not really been moved.
 *
 * The drag offset lives in motion values (no re-render per frame) while the
 * collapsed flag is React state, since it changes what is drawn.
 */
export function AssistantLauncher({
  hidden,
  onOpen
}: {
  /** True while the chat panel is up: the launcher steps out of the way. */
  hidden: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations('assistant');
  const boundsRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);

  // Drag limits are numbers taken the moment a finger or the mouse goes down,
  // not a ref to the bounds box. Given a ref, framer-motion repositions the
  // dog itself whenever the box changes size, keeping his share of the way
  // between its edges — and on a phone the box changes size all the time the
  // page scrolls, as the address bar slides away and back. A dog dragged off
  // the corner rode up and down with every scroll, in the gym most of all,
  // where the pages are long. Numbers are never re-applied: he stays where he
  // was put, and the clamp below still pulls him in if the window shrinks.
  // They bound the x/y offsets from the corner he hangs from (`fromTop`).
  const [limits, setLimits] = useState({ top: 0, left: 0, right: 0, bottom: 0 });
  const measureLimits = () => {
    const box = boundsRef.current;
    const own = handleRef.current;
    if (!box || !own) return;
    const room = box.clientHeight - own.offsetHeight;
    const top = fromTopRef.current;
    setLimits({ top: top ? 0 : -room, left: own.offsetWidth - box.clientWidth, right: 0, bottom: top ? room : 0 });
  };

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [collapsed, setCollapsed] = useState(false);
  // Which edge the dog hangs from: the bottom at rest and within `DOCK` of it,
  // the top anywhere higher. Mirrored in a ref for the handlers below.
  const [fromTop, setFromTop] = useState(false);
  const fromTopRef = useRef(false);
  fromTopRef.current = fromTop;
  // A new `y` waits for the new edge: set together with the class swap, it
  // would paint one frame measured from the old edge — a jump of a screen.
  const pendingY = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingY.current === null) return;
    y.set(pendingY.current);
    pendingY.current = null;
  }, [fromTop, y]);
  // Until storage has been read, the button renders at its default spot. Doing
  // this in an effect rather than in the initial state is what keeps the server
  // and the first client paint identical.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const saved = readStored();
    if (saved) {
      x.set(saved.x);
      if (saved.top) {
        pendingY.current = saved.y;
        setFromTop(true);
      } else y.set(saved.y);
      setCollapsed(saved.collapsed);
    }
    setRestored(true);
  }, [x, y]);

  const persist = (next?: Partial<Stored>) => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ x: x.get(), y: y.get(), collapsed, top: fromTopRef.current, ...next })
      );
    } catch {
      // Storage refused. The position still works for this session.
    }
  };

  // Where the dog was dropped decides what he hangs from: within `DOCK` of the
  // bottom he rides with it, higher up he hangs from the top. His spot on the
  // screen stays the same; only the edge it is measured from changes.
  const settle = () => {
    const box = boundsRef.current;
    const own = handleRef.current;
    if (!box || !own) return;
    x.stop();
    y.stop();
    const room = Math.max(0, box.clientHeight - own.offsetHeight);
    const nextX = Math.min(0, Math.max(own.offsetWidth - box.clientWidth, x.get()));
    x.set(nextX);
    const above = Math.min(room, Math.max(0, fromTopRef.current ? room - y.get() : -y.get()));
    const top = above > DOCK;
    const nextY = top ? room - above : -above;
    if (top === fromTopRef.current) y.set(nextY);
    else {
      pendingY.current = nextY;
      setFromTop(top);
    }
    persist({ x: nextX, y: nextY, top });
  };

  // A window that got smaller can leave the button off-screen, where it is
  // unreachable and looks lost. Pull it back inside whenever the box changes.
  useEffect(() => {
    const clamp = () => {
      const box = boundsRef.current?.getBoundingClientRect();
      if (!box) return;
      const minX = -(box.width - EDGE_KEEP);
      const reach = box.height - EDGE_KEEP;
      if (x.get() < minX) x.set(minX);
      if (x.get() > 0) x.set(0);
      if (fromTopRef.current) {
        if (y.get() > reach) y.set(reach);
        if (y.get() < 0) y.set(0);
      } else {
        if (y.get() < -reach) y.set(-reach);
        if (y.get() > 0) y.set(0);
      }
    };
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [x, y, restored]);

  /**
   * True if this click is the tail of a drag.
   *
   * framer-motion fires a click after the pointer comes up, even when the
   * gesture was a drag. Every control inside the launcher has to ask, or
   * dropping the button happens to also press whatever it was dropped on.
   */
  const swallowedByDrag = () => {
    if (!movedRef.current) return false;
    movedRef.current = false;
    return true;
  };

  const press = () => {
    if (swallowedByDrag()) return;
    if (collapsed) {
      setCollapsed(false);
      persist({ collapsed: false });
      return;
    }
    onOpen();
  };

  return (
    // The bounds box is the drag area and the anchor in one. `inset-4` is the
    // margin the button can never be dragged past.
    <div
      ref={boundsRef}
      // `inert` and not just `opacity-0`: a transparent button is still in the
      // tab order, so without this the keyboard lands on an invisible launcher
      // sitting on top of an open chat panel.
      inert={hidden}
      // The bottom margin grows into the home-indicator strip on an iPhone
      // running the site from its home screen, and is the plain 1rem elsewhere.
      // `data-docked` on <html> means a bar is docked at the bottom of the
      // screen — the gym's rest timer. The dog steps away while it is up:
      // standing on the bar or right above it, he covered its buttons and the
      // ticks of the sets. Invisible, so the keyboard skips him too.
      className="pointer-events-none fixed inset-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 [html[data-docked]_&]:invisible"
    >
      <motion.div
        ref={handleRef}
        drag
        dragConstraints={limits}
        onPointerDownCapture={measureLimits}
        dragElastic={0.04}
        dragMomentum={false}
        onDragStart={() => {
          movedRef.current = true;
        }}
        onDragEnd={(_, info) => {
          movedRef.current = Math.hypot(info.offset.x, info.offset.y) > DRAG_SLOP;
          settle();
        }}
        style={{ x, y }}
        onDragStartCapture={(e) => e.preventDefault()}
        className={`pointer-events-auto absolute right-0 ${fromTop ? 'top-0' : 'bottom-0'} touch-none select-none transition-opacity duration-drape ${
          hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <div className="group relative">
          <button
            type="button"
            onClick={press}
            aria-label={collapsed ? t('expand') : t('open')}
            aria-expanded={collapsed ? undefined : false}
            className={`block cursor-grab rounded-full transition-transform duration-drape ease-drape hover:scale-[1.04] active:cursor-grabbing active:scale-100 ${
              collapsed ? 'opacity-70 hover:opacity-100' : ''
            }`}
          >
            <AssistantAvatar className={collapsed ? 'h-8 w-8' : 'h-14 w-14'} />
          </button>

          {/* Collapse. Always rendered rather than hover-only: on a touch
              screen there is no hover, and a control you cannot reach without a
              mouse is not a control. */}
          {!collapsed ? (
            <button
              type="button"
              onClick={() => {
                if (swallowedByDrag()) return;
                setCollapsed(true);
                persist({ collapsed: true });
              }}
              aria-label={t('collapse')}
              // Drawn at 20px, pressed at 32. A thumb is not a cursor, and a
              // 20px target is easy to miss. The `before` layer is an invisible
              // margin that grows only up and to the right — away from the dog.
              // This button sits on his shoulder, so a margin grown every way
              // took the whole upper-right quarter of his face, and a thumb
              // aimed at the dog shrank him instead of opening the chat.
              className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-rule bg-surface text-xs leading-none text-ink-muted opacity-70 transition-opacity before:absolute before:-right-3 before:-top-3 before:bottom-0 before:left-0 before:content-[''] hover:opacity-100 focus-visible:opacity-100"
            >
              &#8722;
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
