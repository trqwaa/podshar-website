'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Slot = 'night' | 'morning' | 'afternoon' | 'evening';

const SLOTS: Slot[] = ['night', 'morning', 'afternoon', 'evening'];

/**
 * How many lines each slot carries, in every catalogue. Keep in step with the
 * `greeting` block in the JSON — a mismatch resolves to a key that does not
 * exist, and a missing message throws at render.
 *
 * Thirty-one, because eight meant the three of them had seen every line inside
 * a fortnight, and a joke stops being one on the third telling.
 *
 * Thirty-one rather than a round thirty, and the odd number is the point: the
 * same day index also picks the quote, and 30 divides 120 exactly, so every
 * greeting would have come back paired with a quote it had already been paired
 * with. 31 and 120 share no factor, so the *page* — this line plus the thought
 * under it — does not repeat as a pair for a little over ten years, while a
 * single line comes round monthly.
 */
const VARIANTS = 31;

function slotFor(date: Date): Slot {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 23) return 'evening';
  return 'night';
}

/**
 * The greeting, in Podshar's voice.
 *
 * Two independent facts pick the line, and they come from different machines:
 *
 *   slot   morning / afternoon / evening / night, from the *viewer's* clock.
 *          The server cannot know it, so it resolves after mount.
 *   day    which of the eight lines for that slot, from `day` — the shared
 *          Zurich day index the quote of the day already uses. Rendered on the
 *          server, so it is identical on both sides of hydration, and it means
 *          all three of us are greeted the same way on the same day, and the
 *          same way after a refresh. See `lib/day.ts` for why it is not random.
 *
 * The height is reserved by rendering all four of the day's candidate lines in
 * one grid cell, three of them `invisible`. Without that the block resizes the
 * instant the real slot lands: these lines vary in length far more than "Good
 * afternoon" ever did, and on a 390px screen the difference is a whole extra
 * line pushing the reactor down. `visibility: hidden` keeps the space and stays
 * out of the accessibility tree, which is exactly the trade we want.
 *
 * `{name}` is optional inside a line, and `<n>` styles it, so a line can put the
 * name where the joke needs it — or leave it out entirely.
 */
export function Greeting({ name, day }: { name: string; day: number }) {
  const t = useTranslations('greeting');
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
      {t.rich(`${which}.${day % VARIANTS}`, {
        name,
        n: (chunks) => <span className="text-ink-muted">{chunks}</span>
      })}
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
