'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/i18n/routing';
import { MUSCLES, type Muscle } from '@/lib/gym/exercises';
import { ExercisePicker, MuscleChips, searchExercises } from './ExercisePicker';
import { INPUT } from './styles';

/**
 * Все упражнения списком по мышцам — весь каталог Strong. Нажал — мопс
 * показывает технику сбоку и спереди.
 *
 * Двести с лишним анимированных мопсов на одной странице — это DOM на
 * десятки тысяч узлов, даже если анимация спит. Поэтому здесь список, а мопс
 * — в окне по нажатию, как в самом Strong.
 */
export function ExerciseLibrary() {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => searchExercises(query, muscle), [query, muscle]);
  const groups = MUSCLES.map((m) => ({ muscle: m, items: list.filter((e) => e.muscle === m) })).filter((g) => g.items.length);

  return (
    <div className="flex flex-col gap-3">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('picker.search')} aria-label={t('picker.search')} className={INPUT} />
      <MuscleChips muscle={muscle} onChange={setMuscle} />
      <p className="ps-label">{t('picker.count', { n: list.length })}</p>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <section key={g.muscle}>
            <h3 className="ps-label mb-1 font-semibold !text-ink">
              {t(`muscles.${g.muscle}`)} · {g.items.length}
            </h3>
            <ul className="flex flex-col divide-y divide-rule-soft">
              {g.items.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setOpen(e.id)} className="flex w-full items-baseline justify-between gap-3 py-2 text-left text-sm hover:text-accent">
                    <span className="text-ink">{e.name[locale]}</span>
                    <span className="ps-label shrink-0">{t(`gear.${e.gear}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {list.length === 0 ? <p className="text-sm text-ink-muted">{t('picker.nothing')}</p> : null}
      {open ? <ExercisePicker initial={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
