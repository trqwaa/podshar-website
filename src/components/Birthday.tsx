'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { BIRTHDAY } from '@/lib/birthday';

/**
 * Поздравление Бориса (`lib/birthday.ts`): ленточки сыплются сверху, по центру
 * карточка. Закрыл — маленькое окошко с вопросом и двумя одинаковыми ответами,
 * любой закрывает всё и больше не покажется. Текст не в каталогах: это не
 * интерфейс сайта, а одно письмо одному человеку.
 *
 * Ленточки — тёмно-серые и красные, как сайт, и не случайные: позиции из зерна,
 * иначе нарисованное сервером разошлось бы с браузером при гидратации.
 */

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

export function Birthday({ name }: { name: string }) {
  const [step, setStep] = useState<'card' | 'ask' | 'gone'>('card');
  const still = Boolean(useReducedMotion());
  const focus = useRef<HTMLButtonElement>(null);

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
    document.cookie = `${BIRTHDAY.cookie}=seen; path=/; max-age=${400 * 86_400}; samesite=lax`;
    setStep('gone');
  }, []);

  // Прокрутка заперта на `html`, фокус на кнопке; Esc — следующий шаг.
  useLayoutEffect(() => {
    if (step === 'gone') return;
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = 'hidden';
    focus.current?.focus({ preventScroll: true });
    const onKeys = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (step === 'card') setStep('ask');
      else done();
    };
    window.addEventListener('keydown', onKeys, true);
    return () => {
      window.removeEventListener('keydown', onKeys, true);
      root.style.overflow = document.querySelector('[role="dialog"][aria-modal="true"]:not([data-birthday])')
        ? 'hidden'
        : was;
    };
  }, [step, done]);

  const answer =
    'rounded border-2 border-rule px-6 py-2 text-base font-semibold text-ink transition-colors duration-180 hover:border-ink hover:bg-sunk';

  return (
    <AnimatePresence>
      {step !== 'gone' ? (
        <motion.div
          key="birthday"
          data-birthday=""
          role="dialog"
          aria-modal="true"
          aria-label="С днём рождения"
          className="fixed inset-0 z-[95] grid place-items-center overflow-hidden bg-ink/55 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          {/* Ленточки: падают и крутятся, каждая в своём темпе. */}
          {step === 'card'
            ? ribbons.map((r, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={`pointer-events-none absolute top-0 rounded-[1px] ${r.colour}`}
                  style={
                    {
                      left: `${r.left}%`,
                      width: r.width,
                      height: r.height,
                      '--spin': r.spin,
                      '--sway': r.sway,
                      animation: still ? undefined : `ribbon-fall ${r.seconds}s linear ${r.delay}s infinite`,
                      transform: still ? `translateY(${(i * 37) % 90}vh)` : undefined
                    } as React.CSSProperties
                  }
                />
              ))
            : null}

          <AnimatePresence mode="wait">
            {step === 'card' ? (
              <motion.section
                key="card"
                className="block-card relative w-full max-w-sm px-7 py-8 text-center"
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              >
                <p className="ps-label">сегодня твой день</p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight text-ink">с днём рождения, {name}</h2>
                <p className="mt-4 text-base leading-relaxed text-ink-muted">
                  восемнадцать. теперь ты официально взрослый, а логотип — всё ещё нет. мы верим: он будет. когда-нибудь
                </p>
                <button ref={focus} type="button" onClick={() => setStep('ask')} className={`mt-7 ${answer}`}>
                  спасибо
                </button>
              </motion.section>
            ) : (
              <motion.section
                key="ask"
                className="block-card relative w-full max-w-[16rem] px-6 py-6 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                <p className="text-lg font-semibold text-ink">сосал?</p>
                <div className="mt-5 flex justify-center gap-3">
                  <button ref={focus} type="button" onClick={done} className={answer}>
                    да
                  </button>
                  <button type="button" onClick={done} className={answer}>
                    да
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
