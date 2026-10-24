'use client';

import { Fragment, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { SPLASH_COOKIE } from '@/lib/epic-keys';

/**
 * Фраза дня: раз в день, при первом заходе на сайт, — экран и одна строка.
 * Нажал — экран трескается от места нажатия, как лёд айсберга, и осыпается
 * осколками, а под ним сайт. Решения владельца от 20 и 24 октября 2026: входить
 * с эмоцией и с ощущением, что это наш сайт.
 *
 * Днём — тёмным по светлому, вечером и ночью — белым по тёмному; какое сейчас
 * небо, решает сервер по закату (`lib/sun.ts`), как и пульт.
 *
 * Фраза общая у троих на день (`lib/epic.ts`), как приветствие и цитата: о ней
 * можно поговорить. «Сегодня уже видел» — кука с датой, и решает по ней сервер
 * (`(app)/layout.tsx`): заставка приходит в первом же HTML и закрывает сайт до
 * того, как он покажется. Решай это браузер после загрузки — сайт успевал бы
 * мелькнуть.
 *
 * Слова проступают CSS-анимацией, а не framer: она начинается, как только
 * страница нарисована, а не когда оживёт, — на медленном телефоне это секунда
 * пустого экрана разницы.
 */

/** Сколько трещин бежит от точки нажатия. Столько же осколков. */
const RAYS = 11;
/** Через сколько осколки упали, ядро село на место и заставку можно убирать. */
const SHATTER_MS = 1300;

/**
 * Ядро — как у настоящей кнопки ПХ: светлее сверху, глубже снизу. Токенами, а
 * не числами: красный ядра — `--reactor`, свет и тень — подмешанные свои.
 */
const CORE_FILL =
  'radial-gradient(circle at 50% 34%, color-mix(in oklab, rgb(var(--reactor)) 78%, rgb(var(--surface))) 0%, rgb(var(--reactor)) 52%, color-mix(in oklab, rgb(var(--reactor)) 86%, rgb(var(--ink))) 100%)';

type Point = [number, number];
type Shard = { clip: string; dx: number; dy: number; rot: number; delay: number };
/** Перелёт ядра: откуда (левый верх и размер) и куда — сдвиг центра и масштаб. */
type Flight = { left: number; top: number; size: number; dx: number; dy: number; scale: number };
type Broken = { shards: Shard[]; cracks: string[]; w: number; h: number; flight: Flight | null };

/**
 * Разбить экран w×h от точки (x, y): лучи до краёв с изломами — трещины, а
 * между соседними лучами — осколок, к которому добавлены углы экрана, попавшие
 * между ними. Случайность здесь можно: считается по нажатию, не при рендере.
 */
function shatter(x: number, y: number, w: number, h: number): Broken {
  const perimeter = 2 * (w + h);
  /** Положение точки на краю экрана, по часовой стрелке от левого верхнего угла. */
  const along = ([px, py]: Point) =>
    py <= 0.5 ? px : px >= w - 0.5 ? w + py : py >= h - 0.5 ? w + h + (w - px) : 2 * w + h + (h - py);
  const edge = (a: number): Point => {
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    let t = Infinity;
    if (cx > 0) t = Math.min(t, (w - x) / cx);
    if (cx < 0) t = Math.min(t, -x / cx);
    if (cy > 0) t = Math.min(t, (h - y) / cy);
    if (cy < 0) t = Math.min(t, -y / cy);
    return [x + cx * t, y + cy * t];
  };
  const turn = Math.random() * Math.PI * 2;
  const rays = Array.from({ length: RAYS }, (_, i) => turn + (i + (Math.random() - 0.5) * 0.7) * ((2 * Math.PI) / RAYS))
    .sort((a, b) => a - b)
    .map((a) => {
      const end = edge(a);
      const length = Math.hypot(end[0] - x, end[1] - y);
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      const points: Point[] = [[x, y]];
      for (const f of [0.16, 0.38, 0.64]) {
        const jag = (Math.random() - 0.5) * length * 0.07;
        points.push([x + (end[0] - x) * f + nx * jag, y + (end[1] - y) * f + ny * jag]);
      }
      points.push(end);
      return { a, points, s: along(end) };
    });
  const corners: [number, number, number][] = [
    [0, 0, 0],
    [w, 0, w],
    [w, h, w + h],
    [0, h, 2 * w + h]
  ];
  const shards = rays.map((ray, i) => {
    const next = rays[(i + 1) % RAYS];
    const s0 = ray.s;
    const s1 = next.s > s0 ? next.s : next.s + perimeter;
    const between = corners
      .flatMap(([cx, cy, cs]) => [cs, cs + perimeter].filter((c) => c > s0 && c < s1).map((c) => ({ c, p: [cx, cy] as Point })))
      .sort((p, q) => p.c - q.c)
      .map(({ p }) => p);
    const polygon = [...ray.points, ...between, ...[...next.points].reverse().slice(0, -1)];
    const mid = (ray.a + (next.a > ray.a ? next.a : next.a + 2 * Math.PI)) / 2;
    const push = 70 + Math.random() * 150;
    return {
      clip: `polygon(${polygon.map(([px, py]) => `${px.toFixed(1)}px ${py.toFixed(1)}px`).join(', ')})`,
      dx: Math.cos(mid) * push,
      // Падают вниз, сколько бы ни летели вбок: стекло — не конфетти.
      dy: Math.sin(mid) * push + 260 + Math.random() * 200,
      rot: (Math.random() - 0.5) * 50,
      delay: 0.1 + Math.random() * 0.14
    };
  });
  const cracks = rays.map((r) => r.points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' '));
  return { shards, cracks, w, h, flight: null };
}

/**
 * Куда садится ядро: на кнопку ПХ, если она на экране (главная), иначе — в
 * красную точку шапки, её знак на любой странице.
 */
function landing(from: DOMRect, h: number): Flight | null {
  const button = document.querySelector<HTMLElement>('[data-ph-core]')?.getBoundingClientRect();
  const target =
    button && button.width > 0 && button.bottom > 0 && button.top < h
      ? button
      : document.querySelector<HTMLElement>('[data-pult-dot]')?.getBoundingClientRect();
  if (!target || !target.width || !from.width) return null;
  return {
    left: from.left,
    top: from.top,
    size: from.width,
    dx: target.left + target.width / 2 - (from.left + from.width / 2),
    dy: target.top + target.height / 2 - (from.top + from.height / 2),
    scale: target.width / from.width
  };
}

export function DailySplash({
  line,
  enter,
  label,
  day,
  dark
}: {
  line: string;
  /** Подсказка внизу: «нажми, чтобы войти». */
  enter: string;
  /** Имя окна для скринридера. */
  label: string;
  /** Сегодняшний день `ГГГГ-ММ-ДД` — его и запомнит кука. */
  day: string;
  /** Вечер или ночь: белым по тёмному. День — тёмным по светлому. */
  dark: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [broken, setBroken] = useState<Broken | null>(null);
  const still = Boolean(useReducedMotion());
  const door = useRef<HTMLButtonElement>(null);
  const seed = useRef<HTMLSpanElement>(null);
  const leaving = useRef(false);

  const enterSite = useCallback(
    (x?: number, y?: number) => {
      if (leaving.current) return;
      leaving.current = true;
      document.cookie = `${SPLASH_COOKIE}=${day}; path=/; max-age=${400 * 86_400}; samesite=lax`;
      if (still) {
        setOpen(false);
        return;
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      const from = seed.current?.getBoundingClientRect();
      setBroken({ ...shatter(x ?? w / 2, y ?? h / 2, w, h), flight: from ? landing(from, h) : null });
      window.setTimeout(() => setOpen(false), SHATTER_MS);
    },
    [day, still]
  );

  // Прокрутка заперта на `html`, как у окон. Фокус — на «двери», а Tab не уходит
  // на невидимую страницу. Enter, пробел и Esc входят, где бы ни был фокус: до
  // того как страница оживёт, он мог остаться на адресной строке.
  useLayoutEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = 'hidden';
    door.current?.focus({ preventScroll: true });
    const onKeys = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        door.current?.focus();
      } else if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        enterSite();
      }
    };
    window.addEventListener('keydown', onKeys, true);
    return () => {
      window.removeEventListener('keydown', onKeys, true);
      // Под фразой могло успеть открыться другое окно (пульт по «назад»): тогда
      // прокрутку держит оно, и отпустит её само.
      root.style.overflow = document.querySelector('[role="dialog"][aria-modal="true"]:not([data-splash])')
        ? 'hidden'
        : was;
    };
  }, [open, enterSite]);

  const words = line.split(' ');
  const shown = 0.25 + words.length * 0.09;
  const ground = dark ? 'bg-ink text-surface' : 'bg-canvas text-ink';

  /** Сам экран: знак, фраза, подсказка. `settled` — без анимации появления, для осколков. */
  const face = (settled: boolean) => (
    <span className="flex h-full w-full flex-col items-center justify-between px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-center">
      {/* Сверху пусто: дату владелец убрал, а место держит фразу посередине. */}
      <span />
      <span className="flex flex-col items-center gap-10">
      {/* Знак кнопки ПХ над фразой — красная точка с ореолом, как в шапке, без
          надписи. При нажатии она не бьётся с экраном, а летит на своё место —
          на кнопку главной — и вырастает в неё. В осколках её нет: вместо неё
          пустое место того же размера, чтобы фраза в них стояла там же. */}
      {settled ? (
        <span className="h-4 w-4" />
      ) : (
        <span
          ref={seed}
          className="relative grid h-4 w-4 place-items-center"
          style={{ animation: 'splash-word 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both' }}
        >
          <span className="absolute -inset-2 rounded-full bg-reactor/15" />
          <span className="relative h-4 w-4 rounded-full bg-reactor" />
        </span>
      )}
      <span className="block max-w-[20ch] text-balance text-[clamp(1.9rem,5.5vw,4.25rem)] font-semibold leading-[1.08] tracking-tight">
        {/* Пробел — настоящий, между словами, а не отступом: скринридер читает
            текст, и с отступами фраза звучала одним словом. */}
        {words.map((word, i) => (
          <Fragment key={i}>
            {i > 0 ? ' ' : null}
            <span
              className="inline-block"
              style={
                settled
                  ? undefined
                  : { animation: `splash-word 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${0.25 + i * 0.09}s both` }
              }
            >
              {word}
            </span>
          </Fragment>
        ))}
      </span>
      </span>
      <span
        className={`ps-label ${dark ? 'text-surface' : 'text-ink'}`}
        style={settled ? { opacity: 0.6 } : { animation: `splash-word 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${shown + 0.5}s both` }}
      >
        <span className="block" style={settled ? undefined : { animation: 'splash-hint 2.8s ease-in-out infinite' }}>
          {enter}
        </span>
      </span>
    </span>
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="splash"
          data-splash=""
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={`fixed inset-0 z-[90] ${broken ? (dark ? 'text-surface' : 'text-ink') : ground}`}
          initial={false}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          <button
            ref={door}
            type="button"
            onClick={(e) => enterSite(e.clientX || undefined, e.clientY || undefined)}
            className={`block h-full w-full cursor-pointer outline-none ${broken ? 'invisible' : ''}`}
          >
            {face(false)}
          </button>
          {broken ? (
            <>
              {broken.shards.map((s, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 ${ground}`}
                  style={
                    {
                      clipPath: s.clip,
                      '--dx': `${s.dx}px`,
                      '--dy': `${s.dy}px`,
                      '--rot': `${s.rot}deg`,
                      transformOrigin: 'center',
                      animation: `shard-fall 0.8s cubic-bezier(0.55, 0, 0.9, 0.55) ${s.delay}s both`
                    } as React.CSSProperties
                  }
                >
                  {face(true)}
                </span>
              ))}
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${broken.w} ${broken.h}`}
              >
                {broken.cracks.map((points, i) => (
                  <polyline
                    key={i}
                    points={points}
                    fill="none"
                    stroke={dark ? 'rgb(var(--surface) / 0.75)' : 'rgb(var(--ink) / 0.6)'}
                    strokeWidth="1.25"
                    strokeLinejoin="bevel"
                    pathLength={1}
                    strokeDasharray="1"
                    style={{ animation: 'crack-in 0.14s ease-out both, splash-fade 0.3s ease-in 0.2s both' }}
                  />
                ))}
              </svg>
              {/* Точка летит на место кнопки и вырастает до её размера, наливаясь
                  её объёмом, а сев — тает: под ней уже настоящая кнопка. */}
              {broken.flight ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none fixed"
                  style={
                    {
                      left: broken.flight.left,
                      top: broken.flight.top,
                      width: broken.flight.size,
                      height: broken.flight.size,
                      '--fx': `${broken.flight.dx}px`,
                      '--fy': `${broken.flight.dy}px`,
                      '--fs': broken.flight.scale,
                      animation:
                        'ph-land 1s cubic-bezier(0.65, 0, 0.35, 1) 0.12s both, splash-fade 0.22s ease-out 1.1s both'
                    } as React.CSSProperties
                  }
                >
                  <span className="absolute -inset-[50%] rounded-full bg-reactor/15" />
                  <span className="absolute inset-0 rounded-full" style={{ background: CORE_FILL }} />
                </span>
              ) : null}
            </>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
