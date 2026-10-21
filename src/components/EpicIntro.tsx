'use client';

import { Fragment, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Заставка кнопки ПХ: на весь экран, белым по чёрному, одна фраза огромными
 * буквами — «тебя приветствует весь легион». Раз за заход на сайт, решение
 * владельца от 20 октября 2026; дальше обычный заход в айсберг (`claimIntro` в
 * `Pult`).
 *
 * Сначала красная волна сносит страницу, как всегда, потом гаснет свет и
 * появляется фраза, а из ядра расходятся кольца — как от кнопки на главной,
 * только на весь экран. Через две с половиной секунды заставка тает, и под ней
 * уже раскрыт айсберг. Нажатие или любая клавиша — сразу дальше.
 *
 * Четыре манеры появления, по номеру захода, чтобы и она не повторялась
 * подряд: удар (фраза влетает крупнее и садится на место), слова по одному,
 * сжатие (фраза растянута вширь и собирается) и разрез — проступает из полоски.
 *
 * Для скринридера её нет: это вспышка поверх пульта, а не содержимое, и пульт
 * под ней уже открыт и в фокусе.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
/** Сколько заставка держится, прежде чем растаять. */
const HOLD_MS = 2600;
/** Когда гаснет свет: красная волна должна успеть накрыть страницу. */
const AFTER_WAVE = 0.42;

export function EpicIntro({
  text,
  variant,
  still,
  onDone
}: {
  text: string;
  variant: number;
  still: boolean;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, still ? 1800 : HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [onDone, still]);

  const start = still ? 0 : AFTER_WAVE;
  const words = text.split(' ');

  const phrase = (() => {
    if (still) return text;
    switch (variant % 4) {
      case 1:
        return words.map((word, i) => (
          <Fragment key={i}>
            {i > 0 ? ' ' : null}
            <motion.span
              className="inline-block"
              initial={{ opacity: 0, y: '0.5em', filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: start + 0.1 + i * 0.11, duration: 0.55, ease: EASE }}
            >
              {word}
            </motion.span>
          </Fragment>
        ));
      case 2:
        return (
          <motion.span
            className="block"
            initial={{ opacity: 0, scaleX: 1.6, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scaleX: 1, filter: 'blur(0px)' }}
            transition={{ delay: start + 0.05, duration: 0.85, ease: EASE }}
          >
            {text}
          </motion.span>
        );
      case 3:
        return (
          <motion.span
            className="block"
            initial={{ opacity: 0.3, clipPath: 'inset(50% 0% 50% 0%)' }}
            animate={{ opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' }}
            transition={{ delay: start + 0.1, duration: 0.7, ease: EASE }}
          >
            {text}
          </motion.span>
        );
      default:
        return (
          <motion.span
            className="block"
            initial={{ opacity: 0, scale: 1.45, filter: 'blur(12px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ delay: start + 0.05, duration: 0.5, ease: EASE }}
          >
            {text}
          </motion.span>
        );
    }
  })();

  return (
    <motion.div
      aria-hidden="true"
      onPointerDown={onDone}
      className="absolute inset-0 z-20 grid cursor-pointer place-items-center overflow-hidden bg-ink px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.22, delay: still ? 0 : start - 0.12 } }}
      exit={{ opacity: 0, transition: { duration: still ? 0.15 : 0.5, ease: EASE } }}
    >
      {still
        ? null
        : [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmax] w-[70vmax] rounded-full border border-surface/20"
              // Сдвиг на половину — через framer, а не классом: он пишет весь
              // `transform` сам, и класс с translate молча проиграл бы.
              style={{ x: '-50%', y: '-50%' }}
              initial={{ scale: 0.04, opacity: 0.9 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ delay: start + i * 0.32, duration: 2.1, ease: [0.2, 0.7, 0.3, 1] }}
            />
          ))}
      <div className="relative flex flex-col items-center gap-7 text-center">
        <motion.span
          className="h-3 w-3 rounded-full bg-reactor"
          initial={still ? false : { scale: 0 }}
          animate={still ? undefined : { scale: [0, 1.8, 1] }}
          transition={{ delay: start, duration: 0.6, times: [0, 0.4, 1], ease: 'easeOut' }}
        />
        <p className="max-w-[15ch] text-balance text-[clamp(2.4rem,8vw,6.5rem)] font-bold leading-[0.95] tracking-tight text-surface">
          {phrase}
        </p>
      </div>
    </motion.div>
  );
}
