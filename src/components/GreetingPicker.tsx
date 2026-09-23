'use client';

import { useEffect, useState } from 'react';

import type { Slot } from '@/components/Greeting';

const SLOTS: Slot[] = ['night', 'morning', 'afternoon', 'evening'];

function slotFor(date: Date): Slot {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 23) return 'evening';
  return 'night';
}

/**
 * The half of the greeting that has to run in the browser: which of today's
 * four lines is the right one for the viewer's clock.
 *
 * It is handed the four lines already written. Choosing *which day's* lines is
 * the server's job and it has done it — so the browser holds four sentences,
 * not the whole catalogue of them. It used to hold all 124, because the day
 * index was applied here; that was nine kilobytes of greetings shipped to every
 * page so that one could be shown.
 *
 * The height is reserved by rendering all four in one grid cell, three of them
 * `invisible`. Without that the block resizes the instant the real slot lands:
 * these lines vary in length far more than "Good afternoon" ever did, and on a
 * 390px screen the difference is a whole extra line pushing the reactor down.
 * `visibility: hidden` keeps the space and stays out of the accessibility tree,
 * which is exactly the trade we want.
 */
export function GreetingPicker({ lines }: { lines: Record<Slot, React.ReactNode> }) {
  const [slot, setSlot] = useState<Slot | null>(null);

  useEffect(() => {
    const sync = () => setSlot(slotFor(new Date()));
    sync();
    // Re-check every minute so an open tab rolls over at the boundary.
    const id = setInterval(sync, 60_000);
    return () => clearInterval(id);
  }, []);

  const line = (which: Slot) => (
    <>
      {lines[which]}
      <span className="text-ink-faint">…</span>
    </>
  );

  return (
    <h1 className="grid text-greeting font-medium text-ink" aria-live="polite">
      {SLOTS.map((candidate) => (
        <span key={candidate} aria-hidden="true" className="invisible col-start-1 row-start-1">
          {line(candidate)}
        </span>
      ))}

      <span
        className={`col-start-1 row-start-1 transition-opacity duration-500 ${
          slot ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {line(slot ?? 'afternoon')}
      </span>
    </h1>
  );
}
