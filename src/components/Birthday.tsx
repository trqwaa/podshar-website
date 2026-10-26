'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { markBirthdayGreeted } from '@/lib/auth/profile';

/**
 * Поздравление с днём рождения (`lib/birthdays.ts`): ленточки сыплются сверху,
 * по центру карточка. В свой день и раз в год: «спасибо» отмечает это в базе, и
 * ни на другом устройстве, ни на другом адресе оно больше не выскочит.
 *
 * Тексты приходят с сервера готовыми, на языке страницы: поздравление бывает
 * раз в год, и возить его раздел каталога в каждую страницу незачем.
 *
 * Выходит после заставки, а не поверх неё: сначала фраза дня, потом сайт, и уже
 * на нём поздравление — решение владельца от 26 октября 2026. Ждёт, пока на
 * экране есть другое окно (заставка, пульт), и ещё полсекунды — пусть осколки
 * заставки долетят.
 *
 * Ленточки — тёмно-серые и красные, как сайт, и не случайные: позиции из зерна,
 * иначе нарисованное сервером разошлось бы с браузером при гидратации.
 */

export type BirthdayWords = { dialog: string; label: string; title: string; line: string; thanks: string };

/** Mulberry32 — тот же маленький генератор с зерном, что у айсберга. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLOURS = ['bg-reactor', 'bg-ink/80', 'bg-ink/45', 'bg-reactor/70', 'bg-ink/60'];

/** Пауза после того, как закрылось окно перед поздравлением. */
const AFTER_MS = 500;

export function Birthday({ words }: { words: BirthdayWords }) {
  const [step, setStep] = useState<'wait' | 'open' | 'done'>('wait');
  const open = step === 'open';
  const still = Boolean(useReducedMotion());
  const focus = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const busy = () => Boolean(document.querySelector('[role="dialog"][aria-modal="true"]:not([data-birthday])'));
    if (!busy()) {
      setStep('open');
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watch = new MutationObserver(() => {
      clearTimeout(timer);
      if (busy()) return;
      timer = setTimeout(() => {
        if (busy()) return;
        watch.disconnect();
        setStep('open');
      }, AFTER_MS);
    });
    watch.observe(document.body, { childList: true, subtree: true });
    return () => {
      watch.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const ribbons = useMemo(() => {
    const rand = seeded(1024);
    return Array.from({ length: 46 }, (_, i) => ({
      left: rand() * 100,
      width: 5 + rand() * 5,
      height: 14 + rand() * 18,
      colour: COLOURS[i % COLOURS.length],
      seconds: 2.8 + rand() * 2.6,
      delay: -rand() * 5,
      spin: `${(rand() - 0.5) * 900}deg`,
      sway: `${(rand() - 0.5) * 120}px`
    }));
  }, []);

  const done = useCallback(() => {
    setStep('done');
    // Отметка — после закрытия, а не до: не дошла — поздравит ещё раз, и это
    // лучше, чем ни разу.
    markBirthdayGreeted().catch(() => {});
  }, []);

  // Прокрутка заперта на `html`, фокус на кнопке; Esc — то же «спасибо».
  useLayoutEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = 'hidden';
    focus.current?.focus({ preventScroll: true });
    const onKeys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      done();
    };
    window.addEventListener('keydown', onKeys, true);
    return () => {
      window.removeEventListener('keydown', onKeys, true);
      root.style.overflow = document.querySelector('[role="dialog"][aria-modal="true"]:not([data-birthday])')
        ? 'hidden'
        : was;
    };
  }, [open, done]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="birthday"
          data-birthday=""
          role="dialog"
          aria-modal="true"
          aria-label={words.dialog}
          className="fixed inset-0 z-[95] grid place-items-center overflow-hidden bg-ink/55 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          {/* Ленточки: падают и крутятся, каждая в своём темпе. */}
          {ribbons.map((ribbon, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`pointer-events-none absolute top-0 rounded-[1px] ${ribbon.colour}`}
              style={
                {
                  left: `${ribbon.left}%`,
                  width: ribbon.width,
                  height: ribbon.height,
                  '--spin': ribbon.spin,
                  '--sway': ribbon.sway,
                  animation: still ? undefined : `ribbon-fall ${ribbon.seconds}s linear ${ribbon.delay}s infinite`,
                  transform: still ? `translateY(${(i * 37) % 90}vh)` : undefined
                } as React.CSSProperties
              }
            />
          ))}

          <motion.section
            className="block-card relative w-full max-w-sm px-7 py-8 text-center"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <p className="ps-label">{words.label}</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-ink">{words.title}</h2>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">{words.line}</p>
            <button
              ref={focus}
              type="button"
              onClick={done}
              className="mt-7 rounded border-2 border-rule px-6 py-2 text-base font-semibold text-ink transition-colors duration-180 hover:border-ink hover:bg-sunk"
            >
              {words.thanks}
            </button>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
