import { getTranslations } from 'next-intl/server';

import { GreetingPicker } from '@/components/GreetingPicker';
import type { Locale } from '@/i18n/routing';

export type Slot = 'night' | 'morning' | 'afternoon' | 'evening';

const SLOTS: Slot[] = ['night', 'morning', 'afternoon', 'evening'];

/**
 * How many lines each slot carries, in every catalogue. Keep in step with the
 * `greeting` block in the JSON — a mismatch resolves to a key that does not
 * exist, and a missing message throws at render.
 *
 * Sixty-one. Eight meant the three of them had seen every line inside a
 * fortnight, and a joke stops being one on the third telling; at sixty-one a
 * line in a given slot comes round every two months.
 *
 * An odd number on purpose, and a prime: the same day index also picks the
 * quote, and a count that shares a factor with the quote count brings every
 * greeting back paired with a quote it has already been paired with. 61 and
 * 240 share none, so the *page* — this line plus the thought under it — does
 * not repeat as a pair for forty years. Change either count, keep them coprime.
 */
const VARIANTS = 61;

/**
 * The greeting, in Podshar's voice.
 *
 * Two independent facts pick the line, and they come from different machines:
 *
 *   day    which of the lines for each slot, from `day` — the shared Zurich
 *          day index the quote of the day already uses. Decided here, on the
 *          server, so all three of us are greeted the same way on the same day
 *          and the same way after a refresh. See `lib/day.ts` for why it is not
 *          random.
 *   slot   morning / afternoon / evening / night, from the *viewer's* clock.
 *          The server cannot know it, so `GreetingPicker` resolves it after
 *          mount, choosing among the four lines rendered here.
 *
 * Split in two so that only today's four sentences reach the browser. When the
 * whole of this ran on the client, every one of the 124 greetings had to go
 * with it.
 *
 * `{name}` is optional inside a line, and `<n>` styles it, so a line can put the
 * name where the joke needs it — or leave it out entirely.
 */
export async function Greeting({
  locale,
  name,
  day
}: {
  locale: Locale;
  name: string;
  day: number;
}) {
  const t = await getTranslations({ locale, namespace: 'greeting' });

  const lines = Object.fromEntries(
    SLOTS.map((slot) => [
      slot,
      t.rich(`${slot}.${day % VARIANTS}`, {
        name,
        n: (chunks) => <span className="text-ink-muted">{chunks}</span>
      })
    ])
  ) as Record<Slot, React.ReactNode>;

  return <GreetingPicker lines={lines} />;
}
