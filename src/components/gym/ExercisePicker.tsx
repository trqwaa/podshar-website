'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';

import { Modal } from '@/components/Modal';
import type { Locale } from '@/i18n/routing';
import { EXERCISES, MUSCLES, cuesOf, exerciseOf, type Exercise, type Muscle } from '@/lib/gym/exercises';
import { PugRig } from './PugRig';
import { BUTTON, CHIP, GHOST, INPUT } from './styles';

/**
 * Выбор упражнения: поиск, мышцы и мопс, который показывает технику.
 *
 * Список → нажал → мопс делает это упражнение с правильной техникой, под ним
 * две строки «как делать», кнопка «добавить». Владелец просил именно так:
 * добавляешь упражнение — мопс его показывает.
 *
 * Упражнений — весь каталог Strong, за две сотни, поэтому поиск ищет на всех
 * четырёх языках сразу: «жим» и «press» находят одно и то же.
 */

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[’'`-]/g, ' ');

/** Найти по запросу на любом из четырёх языков. */
export function searchExercises(query: string, muscle: Muscle | null): Exercise[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return EXERCISES.filter((e) => !muscle || e.muscle === muscle).filter((e) => {
    if (!words.length) return true;
    const names = Object.values(e.name).map(norm);
    return words.every((w) => names.some((n) => n.includes(w)));
  });
}

/**
 * Мопс показывает упражнение сбоку. Вид спереди здесь был и убран 28 октября
 * 2026: багов в нём больше, чем пользы. Рисунок спереди (`pug-front.tsx`)
 * остался — им сидит мопс в день отдыха; вернуть сюда — когда он будет чистым.
 */
export function ExerciseDemo({ exercise }: { exercise: Exercise }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  return (
    <figure className="mx-auto w-full max-w-md rounded-[10px] border-2 border-rule-soft bg-sunk/60">
      <PugRig motion={exercise.motion} gear={exercise.gear} title={t('pug.demo', { name: exercise.name[locale] })} className="aspect-[32/30] w-full" />
    </figure>
  );
}

export function MuscleChips({ muscle, onChange }: { muscle: Muscle | null; onChange: (m: Muscle | null) => void }) {
  const t = useTranslations('gym');
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`${CHIP} ${muscle === null ? 'border-ink bg-ink text-surface' : 'border-rule text-ink hover:border-ink'}`}
      >
        {t('picker.all')}
      </button>
      {MUSCLES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m === muscle ? null : m)}
          className={`${CHIP} ${muscle === m ? 'border-ink bg-ink text-surface' : 'border-rule text-ink hover:border-ink'}`}
        >
          {t(`muscles.${m}`)}
        </button>
      ))}
    </div>
  );
}

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

  const list = useMemo(() => searchExercises(query, muscle), [query, muscle]);

  const exercise = chosen ? exerciseOf(chosen) : null;
  // Окно прокручивается само по себе: выбрал упражнение внизу списка — и
  // карточка открылась бы с середины, с уехавшим под шапку названием.
  const top = useRef<HTMLDivElement | null>(null);
  // В фигурных скобках: свежий Chrome возвращает из `scrollIntoView` промис, а
  // эффект, который возвращает не функцию, React считает ошибкой.
  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [chosen]);

  // В `document.body`, а не на месте: карточки зала въезжают анимацией, и
  // оставшийся после неё `transform` делает `fixed` внутри них относительным
  // карточке, а не окну, — окно выбора открылось бы внутри доски.
  return createPortal(
    <Modal title={t('picker.title')} close={t('picker.close')} onClose={onClose}>
      {/* Отступ больше липкой шапки окна: без него `scrollIntoView` ставил начало
          карточки под шапку, и название упражнения уезжало под неё наполовину. */}
      <div ref={top} className="scroll-mt-40" />
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
              {t(`muscles.${exercise.muscle}`)} · {t(`gear.${exercise.gear}`)} · {t(`kinds.${exercise.kind}`)}
            </p>
          </div>
          <ExerciseDemo exercise={exercise} />
          <div>
            <p className="ps-label">{t('picker.technique')}</p>
            <ul className="mt-1.5 space-y-1 text-sm leading-snug text-ink">
              {cuesOf(exercise.motion, locale).map((cue) => (
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
          <MuscleChips muscle={muscle} onChange={setMuscle} />
          <p className="ps-label">{t('picker.count', { n: list.length })}</p>
          <ul className="flex flex-col divide-y divide-rule-soft">
            {list.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setChosen(e.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:text-accent">
                  <span className="font-medium text-ink">{e.name[locale]}</span>
                  <span className="ps-label shrink-0">{t(`gear.${e.gear}`)}</span>
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
