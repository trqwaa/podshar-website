'use client';

import { Fragment, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { SPLASH_COOKIE } from '@/lib/epic-keys';

/**
 * Фраза дня: раз в день, при первом заходе на сайт, — тёмный экран и одна
 * строка белым. Нажал — и ты на сайте. Решение владельца от 20 октября 2026:
 * входить с эмоцией и с ощущением, что это наш сайт.
 *
 * Фраза общая у троих на день (`lib/epic.ts`, по номеру дня), как приветствие
 * и цитата: о ней можно поговорить. «Сегодня уже видел» — кука с датой, и решает
 * по ней сервер (`(app)/layout.tsx`): заставка приходит в первом же HTML и
 * закрывает сайт до того, как он покажется. Решай это браузер после загрузки —
 * сайт успевал бы мелькнуть.
 *
 * Слова проступают CSS-анимацией, а не framer: она начинается, как только
 * страница нарисована, а не когда оживёт, — на медленном телефоне это секунда
 * пустого экрана разницы. Framer — только на уход.
 */
export function DailySplash({
  line,
  date,
  enter,
  label,
  day
}: {
  line: string;
  /** «среда, 21 октября» — уже строчными, с сервера. */
  date: string;
  /** Подсказка внизу: «нажми, чтобы войти». */
  enter: string;
  /** Имя окна для скринридера. */
  label: string;
  /** Сегодняшний день `ГГГГ-ММ-ДД` — его и запомнит кука. */
  day: string;
}) {
  const [open, setOpen] = useState(true);
  const still = Boolean(useReducedMotion());
  const door = useRef<HTMLButtonElement>(null);

  const enterSite = useCallback(() => {
    document.cookie = `${SPLASH_COOKIE}=${day}; path=/; max-age=${400 * 86_400}; samesite=lax`;
    setOpen(false);
  }, [day]);

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
      root.style.overflow = was;
    };
  }, [open, enterSite]);

  const words = line.split(' ');
  const shown = 0.25 + words.length * 0.09;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="splash"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-[90] bg-ink text-surface"
          initial={false}
          exit={{ opacity: 0, transition: { duration: still ? 0.15 : 0.7, ease: [0.22, 1, 0.36, 1] } }}
        >
          <button
            ref={door}
            type="button"
            onClick={enterSite}
            className="flex h-full w-full cursor-pointer flex-col items-center justify-between px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-center outline-none"
          >
            <span className="ps-label text-surface/45">{date}</span>
            <motion.span
              className="block max-w-[20ch] text-balance text-[clamp(1.9rem,5.5vw,4.25rem)] font-semibold leading-[1.08] tracking-tight"
              exit={still ? undefined : { scale: 1.04, filter: 'blur(6px)', transition: { duration: 0.7 } }}
            >
              {/* Пробел — настоящий, между словами, а не отступом: скринридер
                  читает текст, и с отступами фраза звучала одним словом. */}
              {words.map((word, i) => (
                <Fragment key={i}>
                  {i > 0 ? ' ' : null}
                  <span
                    className="inline-block"
                    style={{ animation: `splash-word 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${0.25 + i * 0.09}s both` }}
                  >
                    {word}
                  </span>
                </Fragment>
              ))}
            </motion.span>
            <span
              className="ps-label text-surface"
              style={{ animation: `splash-word 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${shown + 0.5}s both` }}
            >
              <span className="block" style={{ animation: 'splash-hint 2.8s ease-in-out infinite' }}>
                {enter}
              </span>
            </span>
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
