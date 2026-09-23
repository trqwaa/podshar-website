'use server';

import { createHash, randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { linkOrigin } from '@/lib/auth/origin';
import { deliver } from '@/lib/mail';
import { redirect } from '@/i18n/routing';
import { resolveLocale } from '@/lib/locale';

/**
 * Forgetting a password, and getting back in.
 *
 * Until this existed, a forgotten password was fixed by someone editing the
 * database by hand — which meant access to a private site for three people
 * depended on whoever still had a database client open. That is the whole
 * reason this file is here.
 *
 * Two halves. `requestReset` takes an address and, if it belongs to somebody,
 * mails them a link. `completeReset` takes the link's token and a new password.
 * Both return `{ error: <translation key> }` in the same shape as the login
 * actions, so the same form chrome renders them.
 */

export type ResetState = { error?: string; sent?: boolean };

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * How long a link is good for.
 *
 * An hour, against the invite's fourteen days, because the two are not the same
 * kind of secret. An invite is handed over in person and may wait for a
 * convenient evening; a reset link sits in an inbox that is itself the thing
 * most likely to have been compromised.
 */
const LINK_MINUTES = 60;

/** How long before the same person can ask for another letter. */
const COOLDOWN_MS = 2 * 60 * 1000;

/**
 * Rows in `auth_verification_tokens` are prefixed by what they are for.
 *
 * The table is the generic next-auth shape and will one day also hold email
 * confirmations. A reset token that could be redeemed as a confirmation, or the
 * reverse, is a hole that costs one string to close now and a migration to
 * close later.
 */
const SCOPE = 'reset:';

const password = z.string().min(10, 'tooShort').max(200);

/**
 * Make an action take at least this long.
 *
 * An address nobody owns does no work and answers instantly; a real one hashes,
 * writes and posts a letter. That difference is readable with a stopwatch, and
 * it answers the one question this form must never answer — whether an address
 * has an account here. Same reasoning as the dummy hash on the login form.
 */
async function atLeast<T>(ms: number, work: Promise<T>): Promise<T> {
  const [result] = await Promise.all([
    work,
    new Promise((resolve) => setTimeout(resolve, ms))
  ]);
  return result;
}

/** Where the link in the letter should point — never simply the `Host` asked with. See `auth/origin.ts`. */
async function origin() {
  return linkOrigin((await headers()).get('host'), process.env.NODE_ENV === 'production');
}

/**
 * Ask for a reset link.
 *
 * Always reports success. Whether the address exists, whether a letter went,
 * whether the provider was down — the visitor is told the same thing, because
 * the alternative is a form that confirms which of three people banks here.
 * Everything that actually happened goes to the log and the audit table.
 */
export async function requestReset(
  locale: string,
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email('badEmail').max(200) })
    .safeParse({ email: formData.get('email') });

  // A malformed address is the one thing worth saying out loud: it is a typo in
  // what the visitor just typed, not a fact about who has an account.
  if (!parsed.success) return { error: 'badEmail' };

  // The work happens after the answer has gone, not before it.
  //
  // It used to be awaited behind a 400 ms floor, and the floor was not enough:
  // a real address hashes, writes and posts a letter, and whenever the mail
  // provider took longer than 400 ms the answer for a real account came back
  // visibly later than the one for an address nobody owns. That difference is
  // exactly the question this form must never answer. `after` runs the letter
  // once the response is out, so every answer takes the same floor and nothing
  // about the account can be read off the clock.
  //
  // The origin is read here, while the request is still ours to read.
  const email = parsed.data.email;
  const base = await origin();
  after(() =>
    issue(email, locale, base).catch((error) => {
      console.error('[podshar] reset letter not issued:', error);
    })
  );

  return atLeast(400, Promise.resolve({ sent: true }));
}

async function issue(email: string, locale: string, base: string): Promise<ResetState> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, displayName: true, email: true, locale: true }
  });

  // No account. Nothing to do, and nothing to say — the caller reports success
  // either way.
  if (!user) return { sent: true };

  const identifier = `${SCOPE}${user.id}`;
  const now = Date.now();

  const token = randomBytes(32).toString('base64url');
  const userLocale = resolveLocale(user.locale ?? locale);

  // One letter per two minutes. Without this, holding the button down turns
  // the form into a way to bury someone's inbox using our provider's quota.
  // The issue time is not stored: it is the expiry minus the lifetime, which is
  // one fewer column to add to a table three people share.
  //
  // Checked and written under one lock per account. As a plain read followed
  // by a write it did not hold: sixteen requests fired together each read "no
  // letter yet" before any of them had written one, and seven letters went
  // out. The advisory lock makes requests for the same account take turns, so
  // the second one reads the first one's row. It lives only as long as the
  // transaction, which suits the pooled connection the app runs on.
  //
  // Older links stop working the moment a new one is asked for. Two live links
  // in one inbox is two chances for the wrong one to be used, and the older one
  // is the likelier to have leaked.
  const fresh = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identifier}))`;

    const existing = await tx.verificationToken.findFirst({
      where: { identifier, expires: { gt: new Date(now) } },
      orderBy: { expires: 'desc' }
    });
    if (existing && existing.expires.getTime() - LINK_MINUTES * 60_000 > now - COOLDOWN_MS) {
      return false;
    }

    await tx.verificationToken.deleteMany({ where: { identifier } });
    await tx.verificationToken.create({
      data: { identifier, token: sha256(token), expires: new Date(now + LINK_MINUTES * 60_000) }
    });
    return true;
  });
  if (!fresh) return { sent: true };

  // The letter speaks the language the person chose in their profile, not the
  // language of the browser that happens to be asking — being locked out is
  // exactly when you want your own language.
  const t = await getTranslations({ locale: userLocale, namespace: 'reset' });
  const link = `${base}/${userLocale}/reset?token=${token}`;

  const sent = await deliver({
    to: user.email,
    subject: t('mailSubject'),
    text: t('mailBody', { name: user.displayName, link, minutes: LINK_MINUTES })
  });

  await prisma.auditLog.create({
    data: {
      action: sent ? 'reset_requested' : 'reset_mail_failed',
      userId: user.id,
      metadata: { locale: userLocale }
    }
  });

  return { sent: true };
}

/**
 * Redeem a link and set a new password.
 *
 * Every session belonging to the account is deleted, not just the other ones.
 * The person doing this is by definition not signed in, and if the reason for
 * the reset is that somebody else got in, leaving their session alive undoes
 * the entire point of the exercise.
 */
export async function completeReset(
  locale: string,
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const parsed = z
    .object({
      token: z.string().trim().min(10, 'badToken').max(200),
      password,
      confirm: z.string()
    })
    .safeParse({
      token: formData.get('token'),
      password: formData.get('password'),
      confirm: formData.get('confirm')
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'invalid' };

  const { token, password: next, confirm } = parsed.data;
  if (next !== confirm) return { error: 'mismatch' };

  const row = await prisma.verificationToken.findUnique({ where: { token: sha256(token) } });

  // Unknown and expired are told apart on purpose. "This link has expired" tells
  // someone staring at a week-old letter what to do next; folding it into a
  // generic failure would leave them retrying the same dead link. Neither
  // message says anything about whose link it was.
  if (!row || !row.identifier.startsWith(SCOPE)) return { error: 'badToken' };
  if (row.expires.getTime() < Date.now()) return { error: 'expired' };

  const userId = row.identifier.slice(SCOPE.length);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return { error: 'badToken' };

  const passwordHash = await hashPassword(next);

  // The delete is inside the transaction, and it is what makes the link single
  // use: two submissions of the same token race for one row, and the loser's
  // whole transaction rolls back rather than setting a second password.
  await prisma.$transaction([
    prisma.verificationToken.delete({ where: { token: sha256(token) } }),
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.auditLog.create({ data: { action: 'password_reset', userId } })
  ]);

  // Straight to the login form rather than signing them in here. Typing the new
  // password once, immediately, is what turns "I set a password" into "I know
  // my password".
  redirect({ href: '/login', locale: resolveLocale(locale) });
  return {};
}
