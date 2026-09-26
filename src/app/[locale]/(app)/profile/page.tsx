import { getTranslations } from 'next-intl/server';

import {
  GameAccountForm,
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
 * how you sign in, and — if you own the place — who else may. The home station
 * used to live here too; it moved to `/trains`, where the rest of the train
 * things are.
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

  // Все аккаунты, отмеченный первым. Их может быть несколько — смурфы, старый
  // аккаунт, чужой на посмотреть, — и список под полем избавляет от привычки
  // держать ссылки на них где-то в заметках.
  const games = await prisma.gameAccount.findMany({
    where: { userId: user.id },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    select: { game: true, externalId: true, tag: true, isPrimary: true }
  });
  const dota = games.filter((g) => g.game === 'DOTA2');
  const brawl = games.filter((g) => g.game === 'BRAWL_STARS');

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

      {/* Якорь: плитка в шторке ведёт сюда, а не на верх страницы. Человек,
          нажавший «привязать аккаунт», пришёл за одним полем, и искать его
          самому среди пяти блоков — работа, которую он не просил. */}
      <div id="dota" className="animate-rise-in scroll-mt-20 [animation-delay:120ms]">
        <GameAccountForm game="dota" accounts={dota} />
      </div>

      <div id="brawl" className="animate-rise-in scroll-mt-20 [animation-delay:135ms]">
        <GameAccountForm game="brawl" accounts={brawl} />
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
