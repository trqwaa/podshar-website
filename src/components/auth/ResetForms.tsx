'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

import { completeReset, requestReset, type ResetState } from '@/lib/auth/reset';
import { Field } from './AuthForm';

/**
 * The two halves of a password reset, as forms.
 *
 * They do not go through `AuthForm` even though they look identical to it, for
 * two reasons: asking for a link has a success state to render — the sign-in
 * form only ever succeeds by navigating away — and the error keys belong to
 * this flow's own catalogue rather than to `auth.errors`, which is the login
 * form's vocabulary and should not grow words about expired links.
 */

/** Submit button plus the failure line, shared by both forms below. */
function Footer({ state, label }: { state: ResetState; label: string }) {
  const t = useTranslations('reset');
  const { pending } = useFormStatus();

  const message = state.error
    ? t.has(`errors.${state.error}`)
      ? t(`errors.${state.error}`, { suggestion: state.suggestion ?? '' })
      : t('errors.invalid')
    : null;

  return (
    <>
      {message ? (
        <p
          role="alert"
          className="rounded border-2 border-reactor/40 bg-reactor/10 px-3 py-2.5 text-sm text-ink"
        >
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded border-2 border-transparent bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition-opacity duration-drape hover:opacity-85 disabled:opacity-40"
      >
        {pending ? t('working') : label}
      </button>
    </>
  );
}

/**
 * Step one: type your address, get a letter.
 *
 * The confirmation deliberately does not say whether anything was sent. It
 * reads "if that address is ours, the letter is on its way" — the server
 * behaves the same for an address it has never seen, and a cheerful "sent!"
 * for real addresses only would turn this box into a way to find out who is a
 * member here.
 */
export function ResetRequestForm({ locale }: { locale: string }) {
  const t = useTranslations('reset');
  const [state, action] = useActionState<ResetState, FormData>(
    (prev, formData) => requestReset(locale, prev, formData),
    {}
  );

  if (state.sent) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="text-2xl font-semibold leading-tight text-ink">{t('sentTitle')}</h1>
        <p className="text-sm leading-relaxed text-ink-muted">{t('sentBody')}</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-tight text-ink">{t('title')}</h1>
        <p className="text-sm leading-relaxed text-ink-muted">{t('hint')}</p>
      </div>

      <Field name="email" label={t('email')} type="email" autoComplete="email" />
      <Footer state={state} label={t('send')} />
    </form>
  );
}

/**
 * Step two: the link worked, choose a new password.
 *
 * The token rides in a hidden field rather than being read from the URL by the
 * action, so that a failed submit — too short, mistyped twice — can be
 * corrected without going back to the letter.
 */
export function ResetPasswordForm({ locale, token }: { locale: string; token: string }) {
  const t = useTranslations('reset');
  const [state, action] = useActionState<ResetState, FormData>(
    (prev, formData) => completeReset(locale, prev, formData),
    {}
  );

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-tight text-ink">{t('newTitle')}</h1>
        <p className="text-sm leading-relaxed text-ink-muted">{t('newHint')}</p>
      </div>

      <input type="hidden" name="token" value={token} />
      <Field
        name="password"
        label={t('password')}
        type="password"
        autoComplete="new-password"
      />
      <Field
        name="confirm"
        label={t('confirm')}
        type="password"
        autoComplete="new-password"
      />
      <Footer state={state} label={t('save')} />
    </form>
  );
}
