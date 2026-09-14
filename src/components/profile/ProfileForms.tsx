'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';

import {
  changePassword,
  createInvite,
  revokeOtherSessions,
  updateDotaAccount,
  updateHomeStation,
  updateIdentity,
  type DotaState,
  type ProfileState,
  type StationState
} from '@/lib/auth/profile';
import { routing, LOCALE_LABELS, type Locale } from '@/i18n/routing';
import { AVATAR_PRESETS, MemberAvatar } from './MemberAvatar';

/**
 * The three forms on the profile page, plus the owner's invite box.
 *
 * Each is its own `<form>` with its own action and its own state. One big form
 * would mean typing a password to change a display name, and a failure in any
 * field would reject the lot.
 */

/** Shared chrome: a titled block in the site's one surface style. */
function Section({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="block-card flex flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold leading-tight text-ink">{title}</h2>
        {hint ? <p className="text-sm leading-relaxed text-ink-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  name,
  label,
  type = 'text',
  defaultValue,
  autoComplete,
  prefix,
  required = true
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  autoComplete?: string;
  /** Rendered inside the field, before the input — used for the `@` on handles. */
  prefix?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="ps-label">{label}</span>
      {/* 16px on a phone, 15 from `sm` up — under 16, an iPhone zooms the page
          in on tap and leaves it zoomed and draggable sideways. The `@` is
          sized with the field so the two stay on one baseline. */}
      <span className="flex items-center gap-1 rounded border-2 border-rule bg-canvas px-3 transition-colors focus-within:border-ink">
        {prefix ? <span className="text-[1rem] text-ink-faint sm:text-[0.9375rem]">{prefix}</span> : null}
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          autoComplete={autoComplete}
          required={required}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[1rem] text-ink outline-none placeholder:text-ink-faint sm:text-[0.9375rem]"
        />
      </span>
    </label>
  );
}

/** Submit plus the result line, which is the same shape in every form here. */
function Footer({ state, label }: { state: ProfileState; label: string }) {
  const t = useTranslations('profile');
  const { pending } = useFormStatus();

  const message = state.error
    ? t.has(`errors.${state.error}`)
      ? t(`errors.${state.error}`)
      : t('errors.invalid')
    : state.ok
      ? t('saved')
      : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded border-2 border-transparent bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-opacity duration-drape hover:opacity-85 disabled:opacity-40"
      >
        {pending ? t('working') : label}
      </button>
      {message ? (
        <p
          role="status"
          className={`text-sm ${state.error ? 'text-reactor' : 'text-ink-muted'}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function IdentityForm({
  member
}: {
  member: {
    displayName: string;
    handle: string;
    email: string;
    locale: string;
    timeZone: string;
    avatarPreset: string | null;
  };
}) {
  const t = useTranslations('profile');
  const [state, action] = useActionState<ProfileState, FormData>(updateIdentity, {});
  // The picked avatar is local state so the preview updates before saving.
  const [avatar, setAvatar] = useState(member.avatarPreset ?? '');

  return (
    <form action={action}>
      <Section title={t('identityTitle')} hint={t('identityHint')}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
          <div className="flex items-center gap-4 sm:flex-col sm:gap-3">
            <MemberAvatar
              preset={avatar || null}
              displayName={member.displayName}
              className="h-20 w-20"
            />
            <span className="ps-label sm:text-center">{t('avatarLabel')}</span>
          </div>

          <div className="flex flex-1 flex-col gap-4">
            <Field
              name="displayName"
              label={t('displayName')}
              defaultValue={member.displayName}
              autoComplete="nickname"
            />
            <Field
              name="handle"
              label={t('handle')}
              defaultValue={member.handle}
              prefix="@"
              autoComplete="username"
            />
            <Field
              name="email"
              label={t('email')}
              type="email"
              defaultValue={member.email}
              autoComplete="email"
            />
          </div>
        </div>

        {/* Avatar picker. A radio group, so it is keyboard-reachable and one
            choice is always the current one. */}
        <fieldset className="flex flex-col gap-3">
          <legend className="ps-label mb-1">{t('avatarPick')}</legend>
          <div className="flex flex-wrap gap-2">
            {['', ...AVATAR_PRESETS].map((preset) => {
              const selected = avatar === preset;
              return (
                <label
                  key={preset || 'none'}
                  className={`cursor-pointer rounded-full p-0.5 transition-shadow ${
                    selected ? 'ring-2 ring-ink' : 'ring-1 ring-transparent hover:ring-rule'
                  }`}
                  title={preset || t('avatarInitials')}
                >
                  <input
                    type="radio"
                    name="avatarPreset"
                    value={preset}
                    checked={selected}
                    onChange={() => setAvatar(preset)}
                    className="sr-only"
                  />
                  <MemberAvatar
                    preset={preset || null}
                    displayName={member.displayName}
                    className="h-11 w-11"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="ps-label">{t('language')}</span>
            <select
              name="locale"
              defaultValue={member.locale}
              // 16px on a phone for the same reason as the fields: a smaller
              // select zooms an iPhone in on tap and leaves it zoomed.
              className="rounded border-2 border-rule bg-canvas px-3 py-2.5 text-[1rem] text-ink outline-none transition-colors focus:border-ink sm:text-[0.9375rem]"
            >
              {routing.locales.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABELS[l as Locale]}
                </option>
              ))}
            </select>
          </label>

          <Field name="timeZone" label={t('timeZone')} defaultValue={member.timeZone} />
        </div>

        <Footer state={state} label={t('save')} />
      </Section>
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations('profile');
  const [state, action] = useActionState<ProfileState, FormData>(changePassword, {});

  return (
    <form action={action}>
      <Section title={t('passwordTitle')} hint={t('passwordHint')}>
        <div className="flex flex-col gap-4">
          <Field
            name="current"
            label={t('currentPassword')}
            type="password"
            autoComplete="current-password"
          />
          <Field
            name="next"
            label={t('newPassword')}
            type="password"
            autoComplete="new-password"
          />
          <Field
            name="confirm"
            label={t('confirmPassword')}
            type="password"
            autoComplete="new-password"
          />
        </div>
        <Footer state={state} label={t('changePassword')} />
      </Section>
    </form>
  );
}

export function SessionsForm() {
  const t = useTranslations('profile');
  const [state, action] = useActionState<ProfileState, FormData>(
    async () => revokeOtherSessions(),
    {}
  );

  return (
    <form action={action}>
      <Section title={t('sessionsTitle')} hint={t('sessionsHint')}>
        <Footer state={state} label={t('revokeOthers')} />
      </Section>
    </form>
  );
}

export function InviteForm() {
  const t = useTranslations('profile');
  const locale = useLocale();
  const [state, action] = useActionState<{ token?: string; error?: string }, FormData>(
    createInvite,
    {}
  );

  const link = state.token
    ? `${typeof window === 'undefined' ? '' : window.location.origin}/${locale}/join?token=${state.token}`
    : null;

  return (
    <form action={action}>
      <Section title={t('inviteTitle')} hint={t('inviteHint')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="inviteHandle" label={t('inviteHandle')} prefix="@" />
          <Field name="inviteEmail" label={t('inviteEmail')} type="email" />
        </div>

        {link ? (
          // Shown once and never again: only the hash is stored, exactly like
          // the seeded invites.
          <div className="flex flex-col gap-2 rounded border-2 border-rule bg-sunk p-4">
            <p className="ps-label">{t('inviteReady')}</p>
            <code className="break-all text-[0.8125rem] leading-relaxed text-ink">{link}</code>
            <p className="text-sm text-ink-muted">{t('inviteOnce')}</p>
          </div>
        ) : null}

        <Footer state={state.error ? { error: state.error } : {}} label={t('createInvite')} />
      </Section>
    </form>
  );
}

/**
 * Where you go home to from Zürich HB — the one field the train tile reads.
 *
 * Not in the identity form: that one saves six things at once, and this one
 * asks SBB a question on the way, which can be slow or can fail on its own.
 * Keeping it separate keeps a station typo from rejecting a changed name.
 */
export function HomeStationForm({ current }: { current: string | null }) {
  const t = useTranslations('profile');
  const [state, action] = useActionState<StationState, FormData>(updateHomeStation, {});

  return (
    <form action={action}>
      <Section title={t('stationTitle')} hint={t('stationHint')}>
        <Field
          name="station"
          label={t('station')}
          defaultValue={current ?? ''}
          autoComplete="off"
          required={false}
        />
        {/* The station SBB actually matched, said out loud, instead of a bare
            "saved" — it is the one thing worth checking. */}
        <Footer state={{ error: state.error, ok: state.ok && !state.station }} label={t('save')} />
        {state.station ? (
          <p role="status" className="text-sm text-ink-muted">
            {t('stationSaved', { station: state.station })}
          </p>
        ) : null}
      </Section>
    </form>
  );
}

/**
 * Аккаунт доты — по ссылке, какая под рукой.
 *
 * Поле принимает Steam, Dotabuff и OpenDota, и голый номер тоже. Просить
 * «номер аккаунта» было бы честнее по названию и хуже по делу: его никто не
 * знает наизусть, а ссылка на свой профиль открыта у каждого.
 *
 * В ответ называется найденный ник — как и станция в форме выше. Ошибиться тут
 * можно ровно одним способом, привязав чужой аккаунт, и заметить это можно
 * только по имени.
 */
export function DotaAccountForm({
  accounts
}: {
  /**
   * Все привязанные аккаунты, отмеченный первым.
   *
   * В поле идёт **номер**, а не ник: поле ждёт ссылку, и ник обратно в неё не
   * разбирается. Поставленный туда, он превращал повторное «сохранить» в
   * «не разобрал ссылку» на совершенно исправной привязке.
   */
  accounts: { externalId: string; tag: string | null; isPrimary: boolean }[];
}) {
  const t = useTranslations('profile');
  const [state, action] = useActionState<DotaState, FormData>(updateDotaAccount, {});
  const active = accounts.find((a) => a.isPrimary) ?? accounts[0] ?? null;

  return (
    <form action={action}>
      <Section title={t('dotaTitle')} hint={t('dotaHint')}>
        <Field
          name="dota"
          label={t('dota')}
          defaultValue={active?.externalId ?? ''}
          autoComplete="off"
          required={false}
        />

        {/* Список того, что уже привязывали. Каждый — кнопка отправки со своим
            номером, так что выбор и есть сохранение: отдельного «применить» тут
            не нужно, а ссылки на свои аккаунты больше не надо держать в
            заметках. Действие предпочитает `pick` тексту в поле — см. его. */}
        {accounts.length ? (
          <div className="flex flex-col gap-2">
            <span className="ps-label">{t('dotaList')}</span>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <button
                  key={a.externalId}
                  type="submit"
                  name="pick"
                  value={a.externalId}
                  aria-current={a.isPrimary ? 'true' : undefined}
                  // `normal-case`: ник — имя человека, и строчить его нельзя.
                  className={`rounded border-2 px-3 py-2 text-sm normal-case transition-colors duration-drape ${
                    a.isPrimary
                      ? 'border-ink bg-sunk font-semibold text-ink'
                      : 'border-rule text-ink-muted hover:border-ink hover:text-ink'
                  }`}
                >
                  {a.tag ?? a.externalId}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Footer
          state={{ error: state.error, ok: state.ok && !state.player && !state.pending }}
          label={t('save')}
        />
        {state.player || state.pending ? (
          <p role="status" className="text-sm text-ink-muted">
            {state.player ? t('dotaSaved', { player: state.player }) : t('dotaPending')}
          </p>
        ) : null}
      </Section>
    </form>
  );
}
