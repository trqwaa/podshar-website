'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/i18n/routing';
import { CUES, EXERCISES, MUSCLES, type Muscle } from '@/lib/gym/exercises';
import { PugRig } from './PugRig';
import { CHIP } from './ui';

/**
 * Все упражнения сразу, и в каждом мопс показывает технику.
 *
 * Анимация каждого мопса засыпает, пока он за краем экрана (`PugRig`), так что
 * тридцать мопсов на странице стоят столько же, сколько видимые три-четыре.
 */
export function ExerciseLibrary() {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const list = EXERCISES.filter((e) => !muscle || e.muscle === muscle);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setMuscle(null)}
          className={`${CHIP} ${muscle === null ? 'border-ink bg-ink text-surface' : 'border-rule text-ink hover:border-ink'}`}
        >
          {t('picker.all')}
        </button>
        {MUSCLES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMuscle(m === muscle ? null : m)}
            className={`${CHIP} ${muscle === m ? 'border-ink bg-ink text-surface' : 'border-rule text-ink hover:border-ink'}`}
          >
            {t(`muscles.${m}`)}
          </button>
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((e) => (
          <li key={e.id} className="flex flex-col rounded-[10px] border-2 border-rule-soft p-3">
            <div className="rounded-[8px] bg-sunk/60">
              <PugRig motion={e.motion} gear={e.gear} title={t('pug.demo', { name: e.name[locale] })} className="aspect-[32/30] w-full" />
            </div>
            <h3 className="mt-2 font-semibold text-ink">{e.name[locale]}</h3>
            <p className="ps-label">
              {t(`muscles.${e.muscle}`)} · {t(`gear.${e.gear}`)}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-sm leading-snug text-ink-muted">
              {CUES[e.motion][locale].map((cue) => (
                <li key={cue}>— {cue}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
