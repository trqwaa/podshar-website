'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';

import { Modal } from '@/components/Modal';
import type { Locale } from '@/i18n/routing';
import { CUES, EXERCISES, MUSCLES, exerciseOf, type Muscle } from '@/lib/gym/exercises';
import { PugRig } from './PugRig';
import { BUTTON, CHIP, GHOST, INPUT } from './ui';

/**
 * Выбор упражнения: поиск, мышцы и мопс, который показывает технику.
 *
 * Список → нажал → мопс делает это упражнение с правильной техникой, под ним
 * две строки «как делать», кнопка «добавить». Владелец просил именно так:
 * добавляешь упражнение — мопс его показывает.
 */
export function ExercisePicker({
  onPick,
  onClose,
  pickLabel,
  initial = null
}: {
  /** Нет — это просто показ техники, без кнопки «добавить». */
  onPick?: (id: string) => void;
  onClose: () => void;
  pickLabel?: string;
  /** Открыть сразу на этом упражнении. */
  initial?: string | null;
}) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [chosen, setChosen] = useState<string | null>(initial);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/ё/g, 'е');
    return EXERCISES.filter((e) => !muscle || e.muscle === muscle).filter(
      (e) => !q || Object.values(e.name).some((n) => n.replace(/ё/g, 'е').includes(q))
    );
  }, [query, muscle]);

  const exercise = chosen ? exerciseOf(chosen) : null;
  // Окно прокручивается само по себе: выбрал упражнение внизу списка — и
  // карточка открылась бы с середины, с уехавшим под шапку названием.
  const top = useRef<HTMLDivElement | null>(null);
  useEffect(() => top.current?.scrollIntoView({ block: 'start' }), [chosen]);

  // В `document.body`, а не на месте: карточки зала въезжают анимацией, и
  // оставшийся после неё `transform` делает `fixed` внутри них относительным
  // карточке, а не окну, — окно выбора открылось бы внутри доски.
  return createPortal(
    <Modal title={t('picker.title')} close={t('picker.close')} onClose={onClose}>
      <div ref={top} />
      {exercise ? (
        <div className="flex flex-col gap-4">
          {onPick ? (
            <button type="button" onClick={() => setChosen(null)} className="ps-label self-start hover:underline">
              ← {t('picker.back')}
            </button>
          ) : null}
          <div>
            <h3 className="text-xl font-semibold text-ink">{exercise.name[locale]}</h3>
            <p className="ps-label mt-1">
              {t(`muscles.${exercise.muscle}`)} · {t(`gear.${exercise.gear}`)}
            </p>
          </div>
          <div className="rounded-[10px] border-2 border-rule-soft bg-sunk/60">
            <PugRig
              motion={exercise.motion}
              gear={exercise.gear}
              title={t('pug.demo', { name: exercise.name[locale] })}
              className="mx-auto aspect-[32/30] w-full max-w-md"
            />
          </div>
          <div>
            <p className="ps-label">{t('picker.technique')}</p>
            <ul className="mt-1.5 space-y-1 text-sm leading-snug text-ink">
              {CUES[exercise.motion][locale].map((cue) => (
                <li key={cue}>— {cue}</li>
              ))}
            </ul>
          </div>
          {onPick ? (
            <button type="button" onClick={() => onPick(exercise.id)} className={`${BUTTON} self-start`}>
              {pickLabel ?? t('picker.add')}
            </button>
          ) : (
            <button type="button" onClick={onClose} className={`${GHOST} self-start`}>
              {t('picker.close')}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('picker.search')}
            className={INPUT}
            aria-label={t('picker.search')}
          />
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
          <ul className="flex flex-col divide-y divide-rule-soft">
            {list.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setChosen(e.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:text-accent">
                  <span className="font-medium text-ink">{e.name[locale]}</span>
                  <span className="ps-label shrink-0">{t(`muscles.${e.muscle}`)}</span>
                </button>
              </li>
            ))}
          </ul>
          {list.length === 0 ? <p className="text-sm text-ink-muted">{t('picker.nothing')}</p> : null}
          <button type="button" onClick={onClose} className={`${GHOST} self-start`}>
            {t('picker.close')}
          </button>
        </div>
      )}
    </Modal>,
    document.body
  );
}
