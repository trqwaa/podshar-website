import { getTranslations } from 'next-intl/server';

import {
  DotaAccountForm,
  HomeStationForm,
  IdentityForm,
  InviteForm,
  PasswordForm,
  SessionsForm
} from '@/components/profile/ProfileForms';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth/session';
import { guestModeAllowed } from '@/lib/auth/config';
import { resolveLocale } from '@/lib/locale';
import { redirect } from '@/i18n/routing';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'profile' });
  return { title: t('title') };
}

/**
 * The profile page.
 *
 * Everything about *you* that the site can change, in one place: who you are,
 * where you go home to, how you sign in, and — if you own the place — who else
 * may.
 *
 * It reads the session directly rather than taking the member from the layout.
 * The layout hands down a display shape (name, handle, avatar); this page needs
 * the record, including the fields nothing else renders, and it needs to be
 * certain whose record it is.
 */
export default async function ProfilePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'profile' });

  const session = await readSession();
  if (!session) {
    // Only reachable in development without a database; the layout already
    // turns everyone else away.
    if (guestModeAllowed()) redirect({ href: '/', locale });
    return null;
  }

  const { user } = session;
  const home = user.homeLocationId
    ? await prisma.location.findUnique({
        where: { id: user.homeLocationId },
        select: { label: true }
      })
    : null;

  // Ник, а не номер: в поле лежит ссылка, а показать в ответ надо то, по чему
  // человек узнает свой аккаунт. Номер он всё равно не помнит.
  const dota = await prisma.gameAccount.findFirst({
    where: { userId: user.id, game: 'DOTA2' },
    select: { externalId: true, tag: true }
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-3 sm:gap-4 sm:p-4">
      <header className="block-card animate-rise-in flex flex-col gap-2 px-6 py-8 sm:px-8">
        <p className="ps-label">{t('label')}</p>
        <h1 className="text-greeting font-medium leading-tight text-ink">{t('title')}</h1>
        <p className="max-w-xl text-base leading-relaxed text-ink-muted">{t('intro')}</p>
      </header>

      <div className="animate-rise-in [animation-delay:60ms]">
        <IdentityForm
          member={{
            displayName: user.displayName,
            handle: user.handle,
            email: user.email,
            locale: user.locale,
            timeZone: user.timeZone,
            avatarPreset: user.avatarPreset
          }}
        />
      </div>

      <div className="animate-rise-in [animation-delay:90ms]">
        <HomeStationForm current={home?.label ?? null} />
      </div>

      <div className="animate-rise-in [animation-delay:120ms]">
        <DotaAccountForm current={dota?.tag ?? dota?.externalId ?? null} />
      </div>

      <div className="animate-rise-in [animation-delay:150ms]">
        <PasswordForm />
      </div>

      <div className="animate-rise-in [animation-delay:180ms]">
        <SessionsForm />
      </div>

      {/* The allowlist is the whole membership model, so only the owner may add
          to it. Hidden rather than disabled: a button you may never press is
          noise, and the action checks the role again on the server anyway. */}
      {user.role === 'OWNER' ? (
        <div className="animate-rise-in [animation-delay:240ms]">
          <InviteForm />
        </div>
      ) : null}
    </div>
  );
}
