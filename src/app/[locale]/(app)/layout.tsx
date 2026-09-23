import { NextIntlClientProvider } from 'next-intl';

import { redirect } from '@/i18n/routing';
import { SIGNED_IN, clientMessages } from '@/i18n/client-messages';
import { AppShell } from '@/components/AppShell';
import { PatchList } from '@/components/Patches';
import { PresenceBeat } from '@/components/Presence';
import { readSession } from '@/lib/auth/session';
import { guestModeAllowed } from '@/lib/auth/config';
import { getCurrentMember } from '@/lib/session';
import { resolveLocale } from '@/lib/locale';

/**
 * The signed-in half of the site.
 *
 * Everything with a drawer, an assistant and a canvas lives under this layout,
 * and this is where access is actually decided. `middleware.ts` also redirects
 * a visitor with no cookie, but middleware runs in the Edge Runtime where
 * Prisma cannot load, so all it can check is that *a* cookie exists — it is a
 * shortcut that saves a render, not a gate.
 *
 * This is the gate: it asks the database whether the cookie names a live
 * session, and a forged or expired one gets no further than here.
 *
 * Guest mode — rendering this without a session — is a development-only
 * convenience for running before the database exists. In production a missing
 * `DATABASE_URL` shuts the door instead of opening it; see auth/config.ts.
 */
export default async function AppLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);

  if (!guestModeAllowed()) {
    const session = await readSession();
    if (!session) redirect({ href: '/login', locale });
  }

  // Read only after the gate above has let the visitor through: the strings
  // behind the login are not built at all for someone who is being sent away.
  const [profile, messages] = await Promise.all([
    getCurrentMember(),
    clientMessages(locale, SIGNED_IN)
  ]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/* The patch list is rendered here, on the server, and handed to the
          shell as a prop — it needs the database to turn handles into names,
          which a client dialog cannot do. It costs a few kilobytes on every
          page and buys a panel that opens instantly, with no spinner and no
          second request. */}
      <AppShell
        profile={profile}
        patches={<PatchList locale={locale} />}
        telegram={telegramInvite()}
      >
        {children}
      </AppShell>
      {/* Here and not on the homepage: every signed-in page is being on the
          site, and this layout is exactly the set of signed-in pages. */}
      <PresenceBeat />
    </NextIntlClientProvider>
  );
}

/**
 * The group's Telegram invite, for the icon in the footer — or nothing.
 *
 * From the environment and not from the code, because this repository is
 * public: an invite written here is a way into the group for anyone who reads
 * GitHub. Read on the server and handed down as a prop, so the address only
 * ever travels inside a signed-in page, never inside a script file that anybody
 * could fetch.
 *
 * Only a t.me address counts. A mistyped variable should make the icon quietly
 * disappear, not turn it into a link to wherever the typo happens to point.
 */
function telegramInvite(): string | undefined {
  const url = process.env.TELEGRAM_INVITE_URL?.trim();
  return url && /^https:\/\/t\.me\/\S+$/.test(url) ? url : undefined;
}
