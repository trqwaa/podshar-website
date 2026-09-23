'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { Modal } from '@/components/Modal';

/**
 * The weather tile, turned into something you can press, and the week behind it.
 *
 * A thin client shell around server-rendered content, the same shape as the
 * patches panel: both the face of the tile and the rows in the panel are built
 * on the server and handed down as nodes. The only thing that lives in the
 * browser is whether the panel is open. That keeps the provider call, the
 * translation lookups and the date formatting where they already were — this
 * file never learns what the weather is.
 *
 * The card becomes a `<button>` rather than growing an icon in its corner. The
 * whole tile is the target, which is the only size that works on a phone, and
 * a button is announced as one instead of being a card that silently happens to
 * react to a click. `text-left` because a button centres its content and
 * everything inside was laid out flush left.
 */
export function WeatherPanel({
  label,
  title,
  hint,
  close,
  week,
  className = '',
  children
}: {
  /** The quiet line at the top of the card, and what the button is announced as. */
  label: string;
  title: string;
  hint: string;
  close: string;
  /** The week, already rendered on the server. */
  week: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // `block-card` and the padding are copied from the tile's own frame so
        // pressing it changes nothing about how it sits in the grid. The hover
        // is the only thing added: a card that opens something has to say so
        // before it is pressed, and there is no icon to say it with.
        className={`block-card animate-rise-in flex w-full flex-col gap-4 p-6 text-left transition-colors duration-drape ease-drape [animation-delay:150ms] hover:bg-sunk ${className}`}
      >
        <p className="ps-label">{label}</p>
        {children}
      </button>

      {/* Without `AnimatePresence` the panel is unmounted the instant the flag
          flips and never plays its way out — the same reason the patches panel
          is wrapped in one. */}
      <AnimatePresence>
        {open ? (
          <Modal key="weather" title={title} hint={hint} close={close} onClose={() => setOpen(false)}>
            {week}
          </Modal>
        ) : null}
      </AnimatePresence>
    </>
  );
}
