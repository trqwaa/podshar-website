'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { PRIMARY_NAV_SLOTS } from '@/lib/navigation';
import { Link } from '@/i18n/routing';
import { DotaBlock } from './DotaBlock';
import { MemberAvatar } from './profile/MemberAvatar';
import { PodsharWordmark } from './PodsharMark';
import { LocaleSwitcher } from './LocaleSwitcher';
import { PatchesRow } from './PatchesRow';
import { SignOutButton } from './auth/SignOutButton';
import type { MemberProfile, QuickStats } from '@/lib/types';

/**
 * The drawer. Closed on first paint, and it pushes the canvas when it opens.
 *
 * The push is done by animating this element's own width from zero, so it is a
 * real flex sibling of the canvas rather than a panel floating over one. Two
 * details make that read cleanly: `overflow-hidden` clips the contents while
 * the width animates, and the inner wrapper is pinned to the full open width so
 * the text inside never reflows mid-animation.
 *
 * It scrolls on its own. `sticky top-0` with `h-dvh` pins the drawer to the
 * viewport while the canvas scrolls past it, and the region between the header
 * and the footer takes its own `overflow-y-auto` — so a long nav list scrolls
 * inside the drawer instead of dragging the drawer up the page with the
 * greeting and the reactor. Sticky, not fixed, deliberately: a fixed panel
 * leaves the flow, and leaving the flow is exactly what would break the push.
 *
 * Order, top to bottom: who you are, then how you are doing, then where you can
 * go. The profile and the stats sit together as one unit at the top — they are
 * both answers to "me" — and navigation is pushed down past a deliberate gap.
 * That gap is doing real work: without it the drawer reads as one undifferentiated
 * list, and the eye has to parse the labels to find the links.
 */
export function LeftSidebar({
  open,
  profile,
  stats,
  onOpenPatches
}: {
  open: boolean;
  profile: MemberProfile;
  stats: QuickStats;
  /** Opens the patch list as a panel. Absent means fall back to the page. */
  onOpenPatches?: () => void;
}) {
  const t = useTranslations('sidebar');
  const tHome = useTranslations('home');
  const tNav = useTranslations('nav');
  const tGames = useTranslations('games');
  const panelRef = useRef<HTMLElement | null>(null);

  // Focus moves into the panel itself rather than onto a control inside it.
  // There is no close cross here any more — the top bar's switch is the only
  // one — so the useful thing to announce on opening is the region, and from
  // there the first Tab lands on the profile row.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <aside
      id="podshar-nav"
      ref={panelRef}
      tabIndex={-1}
      aria-label={t('navigation')}
      // Collapsed content stays in the DOM, so without `inert` a keyboard user
      // tabs into rows that are clipped to zero width.
      inert={!open}
      // The max-width is what keeps the only close control on screen. The panel
      // pushes the canvas, and the canvas carries the switch that closes it, so
      // a panel wide enough to shove that switch past the right edge would trap
      // someone on a narrow phone with no way out but Escape. 4.5rem leaves room
      // for the 44px button and its padding at any width.
      className={`sticky top-0 h-dvh shrink-0 self-start overflow-hidden bg-surface outline-none transition-[width] duration-drape ease-drape ${
        open
          ? 'w-sidebar max-w-[calc(100vw-4.5rem)] border-r-2 border-rule lg:w-sidebar-lg'
          : 'w-0'
      }`}
    >
      {/* Pinned to the open width so nothing reflows while the width animates. */}
      <div className="flex h-full w-sidebar flex-col lg:w-sidebar-lg">
        {/* No close cross here. It sat a couple of centimetres from the top
            bar's switch, which had by then gone inert — two identical-looking
            controls where only one did anything. The switch stays, this one
            goes, and the panel is closed from the same place it was opened. */}
        <header className="flex items-center border-b border-rule-soft px-5 py-4">
          {/* Same as the one in the top bar — see the note in AppShell. The
              negative margins pull the hover surface back under the header
              padding: sideways so the letters stay on the same line as
              everything else, and vertically so the 44px a thumb needs does
              not make the header 12px taller than it was. */}
          <Link
            href="/"
            aria-label={tHome('goHome')}
            className="-my-1.5 -ms-2 inline-flex min-h-11 items-center rounded px-2 transition-colors duration-drape ease-drape hover:bg-sunk"
          >
            <PodsharWordmark className="text-xs font-semibold text-ink" />
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Who you are, and how you are doing. One block, no rule between
              them — the stats belong to the profile, not beside it. */}
          <section className="px-5 pb-6 pt-6">
            <p className="ps-label mb-4">{t('profile')}</p>
            {/* The whole row is the link. A profile is one destination, and a
                separate "edit" control beside your own name is a button for
                something the name already implies. */}
            <Link
              href="/profile"
              className="-mx-2 flex items-center gap-3 rounded px-2 py-2 transition-colors duration-drape hover:bg-sunk"
            >
              <MemberAvatar
                preset={profile.avatarPreset}
                displayName={profile.displayName}
                className="h-12 w-12"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold leading-tight text-ink">
                  {profile.displayName}
                </p>
                <p className="truncate text-sm text-ink-muted">@{profile.handle}</p>
              </div>
              <span className="ps-label shrink-0 text-ink-faint">{t('editProfile')}</span>
            </Link>

            {/* Колонкой, а не парой квадратиков: у доты теперь медаль, а она
                рядом с названием ранга в половину ширины шторки не помещается. */}
            <p className="ps-label mb-3 mt-7">{t('stats')}</p>
            <div className="space-y-2">
              <DotaBlock open={open} />
              <StatBlock label={t('brawlCups')} value={stats.brawlCups} empty={tGames('soon')} />
            </div>
          </section>

          {/* Five reserved rows. Names and destinations are not decided yet, so
              they say so rather than pretending to be links — see
              PRIMARY_NAV_SLOTS in src/lib/navigation.ts. */}
          <nav className="border-t border-rule-soft px-5 pb-6 pt-8">
            <p className="ps-label mb-4">{t('navHeading')}</p>
            <ul className="space-y-2">
              {Array.from({ length: PRIMARY_NAV_SLOTS }, (_, i) => (
                <li key={i}>
                  <span className="flex cursor-not-allowed items-center justify-between rounded border-2 border-dashed border-rule-soft px-3 py-3 text-base text-ink-faint">
                    {tNav('wip')}
                    <span aria-hidden="true" className="text-sm">
                      &#8943;
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Which version of the site you are looking at, and whether there
            is anything new in it. Above the footer rather than in it: the
            footer is controls, and this is a fact with a link on it. */}
        <PatchesRow onOpen={onOpenPatches} />

        {/* The bottom padding grows into the home-indicator strip on an iPhone
            running the site from its home screen: the drawer is a full viewport
            tall, so its footer sits exactly there. Zero inset everywhere else. */}
        <footer className="flex items-center justify-between border-t border-rule-soft px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <LocaleSwitcher />
          <SignOutButton />
        </footer>
      </div>
    </aside>
  );
}

// `p` вместо `dt`/`dd`: список определений держался, пока обе цифры были
// однородными парами «подпись — число». Теперь у доты медаль и две строки, а
// `dt` с `dd` вне `dl` — уже не разметка, а просто неверные теги.
// Пустое значение говорит словами, а не пульсирует. Пульс обещает, что цифра
// сейчас появится, — а у кубков она не появится, пока нет ключа Supercell.
// Рядом с настоящей медалью вечная «загрузка» читается как сломанный сайт.
function StatBlock({
  label,
  value,
  empty
}: {
  label: string;
  value: number | null;
  empty: string;
}) {
  return (
    <div className="rounded border-2 border-rule bg-canvas p-3">
      <p className="text-[0.7rem] lowercase leading-tight tracking-label text-ink-muted">{label}</p>
      {value === null ? (
        <p className="mt-2 text-sm text-ink-faint">{empty}</p>
      ) : (
        <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value.toLocaleString()}</p>
      )}
    </div>
  );
}
