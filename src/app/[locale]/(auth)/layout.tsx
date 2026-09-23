import { NextIntlClientProvider } from 'next-intl';

import { redirect } from '@/i18n/routing';
import { SIGNED_OUT, clientMessages } from '@/i18n/client-messages';
import { PodsharWordmark } from '@/components/PodsharMark';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { readSession } from '@/lib/auth/session';
import { authConfigured } from '@/lib/auth/config';
import { resolveLocale } from '@/lib/locale';

/**
 * The signed-out half: login and join.
 *
 * One centred card on the bare canvas. No drawer, no assistant, no reactor —
 * there is nothing to navigate to yet, and a page that shows the furniture of
 * an app you have not been let into is just a tease.
 *
 * Already signed in? Then this screen has nothing to offer, so it sends you
 * home instead of inviting you to log in twice.
 */
export default async function AuthLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);

  // Only ask when there is something to ask. Unlike the (app) side this one
  // stays reachable without a database — it is the page a misconfigured deploy
  // sends everyone to, and it should at least render.
  if (authConfigured()) {
    const session = await readSession();
    if (session) redirect({ href: '/', locale });
  }

  // Only the strings the forms and the language switch read. This is the one
  // page anyone at all can open, so it is the one place where "whatever is in
  // the catalogue" meant handing the whole private site to a stranger.
  const messages = await clientMessages(locale, SIGNED_OUT);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-rule-soft px-4 py-4 sm:px-6">
        <PodsharWordmark className="text-xs font-semibold text-ink" />
        <LocaleSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="block-card w-full max-w-md p-6 sm:p-8">{children}</div>
      </main>
    </div>
    </NextIntlClientProvider>
  );
}
