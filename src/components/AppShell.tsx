'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { LeftSidebar } from './LeftSidebar';
import { Modal } from './Modal';
import { RightAIChat } from './RightAIChat';
import { PodsharWordmark } from './PodsharMark';
import type { MemberProfile } from '@/lib/types';

/**
 * The shell: a drawer and a canvas.
 *
 * Two columns, not three — the assistant left the flow in v0.5 and is now a
 * fixed panel over the canvas, so nothing here reserves width for it.
 *
 * The left panel *pushes* rather than overlays, which is why this is a flex row
 * and not a fixed panel over a dimmed page. The two breakpoints differ on
 * purpose:
 *
 *   below lg — `min-w-full` keeps the canvas a full viewport wide, so opening
 *              the panel slides the canvas off to the right (a real drawer
 *              push) instead of crushing it into an unusable column.
 *   lg and up — `lg:min-w-0` lets the canvas give up width instead, so the
 *              bento grid re-flows into the space that is left.
 *
 * `overflow-x-clip` hides the mobile overhang. It is `clip` rather than
 * `hidden` deliberately: `overflow-x: hidden` forces the computed `overflow-y`
 * to `auto`, which would quietly turn this row into a second scroll container.
 */
export function AppShell({
  profile,
  children,
  patches,
  telegram
}: {
  profile: MemberProfile;
  children: React.ReactNode;
  /**
   * The patch list, rendered on the server upstairs and shown here in a panel.
   * It arrives as a prop rather than being fetched on demand because turning
   * handles into names needs the database, and a dialog that opens on a
   * spinner is not the quick glance this is meant to be.
   */
  patches?: React.ReactNode;
  /** The group's Telegram invite for the footer, or nothing — see the (app) layout. */
  telegram?: string;
}) {
  const t = useTranslations('home');
  const tPatches = useTranslations('patches');
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  /**
   * The patch list, as a panel over whatever you were reading.
   *
   * This was briefly a Next intercepting route, which is the textbook way to
   * give a panel its own address. It broke the client router outright —
   * `initialTree is not iterable` on every navigation — somewhere in the
   * crossing of a dynamic `[locale]`, a route group and next-intl's navigation.
   * A dialog in state does the same job for the reader, and `/patches` is still
   * a real page for a link sent to somebody else, for a reload, and for the dog
   * to walk you to.
   */
  const [patchesOpen, setPatchesOpen] = useState(false);

  // Everything except the homepage is one level down, so "back" and "home" are
  // the same journey. That is why this is a link to `/` and not `router.back()`:
  // history knows where you came *from*, which on a first visit is another site
  // entirely, and an arrow that sometimes leaves Podshar is worse than no arrow.
  const isHome = pathname === '/';

  // A tap-through should not leave the drawer standing open behind the page.
  useEffect(() => {
    setNavOpen(false);
    setPatchesOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className="flex min-h-dvh overflow-x-clip bg-canvas">
      <LeftSidebar
        open={navOpen}
        profile={profile}
        onOpenPatches={patches ? () => setPatchesOpen(true) : undefined}
      />

      <div className="relative flex min-w-full flex-1 flex-col lg:min-w-0">
        {/* Top bar. The trigger lives in the flow, so the push carries it.

            Sticky, so the way out travels with you. The switch here is the only
            thing that closes the drawer and the arrow is the only obvious way
            back, and a page of patches is long enough that both used to scroll
            out of reach — leaving the reader to haul themselves back to the top
            to go anywhere.

            `bg-canvas` is load-bearing: the bar had no background of its own,
            which is invisible while it sits at the top of the page and becomes
            content sliding through the letters the moment it stops moving.
            `z-30` puts it over the canvas and under the dog, who is fixed at
            z-50 and should stay on top of everything.

            This works only because the row above uses `overflow-x: clip`
            rather than `hidden` — `hidden` computes `overflow-y` to `auto` and
            would make that row a scroll container, against which `top-0` means
            the top of the row and not the top of the screen. The bar would then
            never stick at all. */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-canvas px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            {/* One control, not two.

                This used to only open, which left it doing nothing at all while
                the drawer stood open — a button sitting inches from the drawer's
                own close cross, looking identical to the one that had just
                worked. Now it is the single switch, and it says which way it
                will go: the three bars fold into a cross, so the thing you press
                to close is the thing you pressed to open, in the same place. */}
            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              aria-label={navOpen ? t('closeMenu') : t('openMenu')}
              aria-expanded={navOpen}
              aria-controls="podshar-nav"
              className="group relative flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-[5px] rounded border-2 border-rule transition-colors duration-drape ease-drape hover:bg-sunk"
            >
              {/* Three bars, 2px each, 5px apart: the outer two are 7px off
                  centre, which is exactly how far they travel to meet in the
                  middle as a cross. The hover widths only apply while closed —
                  a cross whose arms grow on hover reads as broken, not lively. */}
              <span
                className={`h-0.5 bg-ink transition-all duration-drape ease-drape ${
                  navOpen
                    ? 'w-5 translate-y-[7px] rotate-45'
                    : 'w-4 group-hover:w-5'
                }`}
              />
              <span
                className={`h-0.5 bg-ink transition-all duration-drape ease-drape ${
                  navOpen ? 'w-5 opacity-0' : 'w-4 group-hover:w-3'
                }`}
              />
              <span
                className={`h-0.5 bg-ink transition-all duration-drape ease-drape ${
                  navOpen
                    ? 'w-5 -translate-y-[7px] -rotate-45'
                    : 'w-4 group-hover:w-5'
                }`}
              />
            </button>

            {/* Back, and only where there is somewhere to go back to. On the
                homepage the arrow would point at the page you are already on.
                The wordmark opposite also goes home, but a wordmark is a
                convention you have to already know; an arrow is not. */}
            {isHome ? null : (
              <Link
                href="/"
                aria-label={t('goBack')}
                className="grid h-11 w-11 shrink-0 place-items-center rounded border-2 border-rule text-ink transition-colors duration-drape ease-drape hover:bg-sunk"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 5 8 12l7 7" />
                </svg>
              </Link>
            )}
          </div>

          {/* The wordmark is the way back to the homepage, here and in the
              drawer. It is a link at the call site rather than inside
              `PodsharWordmark`, because the same wordmark heads the login and
              join pages, where "home" is a page you are not allowed on yet and
              the click would land you back on the login screen. */}
          <Link
            href="/"
            aria-label={t('goHome')}
            // 44px tall, the height a thumb needs. The bar is already that
            // tall because of the switch beside it, so this costs no layout.
            className="inline-flex min-h-11 items-center rounded px-2 transition-colors duration-drape ease-drape hover:bg-sunk"
          >
            <PodsharWordmark className="text-xs font-semibold text-ink-muted" />
          </Link>
        </header>

        {/* With the drawer open, the page beside it is a way out.

            A scrim rather than a click handler on the page: the first press
            should close the drawer and do nothing else. Hanging the close on
            the page itself would mean that same press also fires the reactor,
            or follows whatever link happened to be under the finger, which is
            not what someone reaching past an open drawer means by it.

            Stops below the top bar on purpose. `z-20` sits under the header's
            `z-30`, so the switch and the back arrow stay live — the two
            controls you might actually want while the drawer is open. */}
        {navOpen ? (
          <button
            type="button"
            aria-label={t('closeMenu')}
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 z-20 cursor-default"
          />
        ) : null}

        <main className="flex flex-1 flex-col">{children}</main>

        {/* The footer.

            It said "in development" for a day, which was honest and dreary —
            and it was not even true of the footer, only of whatever might one
            day go in it. Nobody knows what that is, so rather than reserve the
            space with an apology it says the one thing about this site that is
            certain and worth reading. A band the page ends with, edge to edge
            with a rule on top; the heart is the only colour down here.

            Under it, the group chat — which is where these three actually
            live; this site is the part of it that got an address. The link
            comes down from the server (the (app) layout says why it is not
            written in the code), so without it the icon is simply not drawn.
            The heart is held to the last word with a no-break space, because
            on a phone the line wraps and a heart alone on a line is a typo. */}
        {/* Taller at the bottom on a phone: the dog floats in the bottom-right
            corner, and at phone width the small print runs nearly edge to edge
            — so at the very end of the page it ran straight under him. 6rem
            clears his 3.5rem and the margin he keeps. On a wider screen the
            lines are short and centred, and never reach his corner. */}
        <footer className="mt-2 flex flex-col items-center gap-4 border-t border-rule-soft px-4 pb-24 pt-10 text-center sm:pb-10">
          <p className="ps-label">
            {t('footerLove')}&nbsp;<span className="text-reactor">&#9829;</span>
          </p>
          {telegram ? (
            <a
              href={telegram}
              target="_blank"
              // `noreferrer` as well as `noopener`: the address of a private
              // site has no business arriving at Telegram in a Referer header.
              rel="noopener noreferrer"
              aria-label={t('footerTelegram')}
              title={t('footerTelegram')}
              className="grid h-11 w-11 place-items-center rounded-full text-ink-muted transition-colors duration-drape ease-drape hover:bg-sunk hover:text-accent"
            >
              {/* Telegram's paper plane in a ring, in the site's own ink. Not
                  Telegram blue: a brand colour would be the one raw hex in
                  the codebase that no token describes, and the palette stays
                  this small only because nothing gets one. The shape is what
                  people recognise. Hover borrows the accent, the one colour
                  here that already means "press". */}
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M16.9 7.6 6.4 11.7l3.9 1.4 5 3.5z" />
                <path d="m16.9 7.6-6.6 5.5.5 3.2 1.8-1.7" />
              </svg>
            </a>
          ) : null}
          {/* The small print, which is the joke: the one line on a site like
              this that is expected to be solemn. Quieter than the line above
              it, the way small print always is. */}
          <p className="ps-label text-ink-faint">{t('footerRights')}</p>
        </footer>
      </div>

      <RightAIChat />

      {/* Last, and over everything: the dog is fixed at z-50 and a panel that
          slid under him would be a panel you cannot fully read. */}
      {/* `AnimatePresence` is what lets the panel finish leaving. Without it
          React unmounts the moment the flag flips and the panel vanishes
          mid-blink, which is abrupt enough to register as a glitch. */}
      <AnimatePresence>
        {patchesOpen && patches ? (
          <Modal
            key="patches"
            title={tPatches('title')}
            hint={tPatches('hint')}
            close={t('close')}
            onClose={() => setPatchesOpen(false)}
          >
            {patches}
          </Modal>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
