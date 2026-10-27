'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { askCritic } from '@/lib/gym/critic-actions';

/** Кнопка «разнести по-взрослому»: модель по кнопке, а не на каждый заход. */
export function AskCritic({ again }: { again: boolean }) {
  const t = useTranslations('gym');
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await askCritic({ locale });
            if (result.error) setError(result.error);
          })
        }
        className="ps-press rounded border-2 border-ink bg-ink px-4 py-2.5 text-sm font-semibold lowercase text-surface hover:opacity-90 disabled:opacity-60"
      >
        {pending ? t('critic.asking') : again ? t('critic.again') : t('critic.ask')}
      </button>
      {error ? (
        <p role="status" className="text-sm text-ink-muted">
          {t.has(`errors.${error}`) ? t(`errors.${error}`) : t('errors.generic')}
        </p>
      ) : null}
    </div>
  );
}
