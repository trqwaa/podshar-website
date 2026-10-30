'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/i18n/routing';
import { removeWorkout } from '@/lib/gym/actions';
import type { WorkoutView } from '@/lib/gym/data';
import { countsVolume, exerciseOf, musclesOf, oneRepMax } from '@/lib/gym/exercises';
import { ErrorLine, useGymAction } from './ui';

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
};

/** История: законченные тренировки, свежая сверху, с лучшим подходом каждого упражнения. */
export function History({ workouts, editable }: { workouts: WorkoutView[]; editable: boolean }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const { run, pending, error } = useGymAction();
  // Стереть — в два нажатия на месте, а не системным «точно?» браузера.
  const [sure, setSure] = useState<string | null>(null);
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'Europe/Zurich' });

  if (workouts.length === 0) return <p className="text-sm text-ink-muted">{t('history.empty')}</p>;

  return (
    <div className="flex flex-col gap-3">
      <ErrorLine message={error} />
      <ul className="flex flex-col gap-3">
        {workouts.map((w) => {
          const working = w.sets.filter((s) => !s.warmup);
          const volume = working.filter((s) => countsVolume(exerciseOf(s.exercise)?.kind ?? 'weight')).reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
          const minutes = w.finishedAt ? Math.max(1, Math.round((w.finishedAt - w.startedAt) / 60_000)) : 0;
          const byExercise = new Map<string, { sets: number; line: string; score: number }>();
          for (const s of working) {
            const kind = exerciseOf(s.exercise)?.kind ?? 'weight';
            const entry = byExercise.get(s.exercise) ?? { sets: 0, line: '', score: -Infinity };
            entry.sets += 1;
            // Лучший подход — у каждого вида свой: максимум по Эпли, меньше помощи, дольше, дальше.
            const score =
              kind === 'time' ? (s.seconds ?? 0) : kind === 'cardio' ? (s.distance ?? 0) * 1e4 + (s.seconds ?? 0) : kind === 'assisted' ? -(s.weight ?? 0) + (s.reps ?? 0) / 100 : s.weight && s.reps ? oneRepMax(s.weight, s.reps) : (s.reps ?? 0) / 100;
            if (score > entry.score) {
              entry.score = score;
              entry.line =
                kind === 'time'
                  ? clock(s.seconds ?? 0)
                  : kind === 'cardio'
                    ? [s.distance ? `${num.format(s.distance)} ${t('workout.km')}` : null, s.seconds ? clock(s.seconds) : null].filter(Boolean).join(' · ')
                    : s.weight
                      ? `${kind === 'body' ? '+' : kind === 'assisted' ? '−' : ''}${num.format(s.weight)} × ${s.reps ?? 0}`
                      : `× ${s.reps ?? 0}`;
            }
            byExercise.set(s.exercise, entry);
          }
          const title = w.title || musclesOf(w.sets.map((s) => s.exercise)).map((m) => t(`muscles.${m}`)).join(' · ') || t('history.untitled');
          return (
            <li key={w.id} className="rounded-[10px] border-2 border-rule-soft p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-ink">{title}</h3>
                  <p className="ps-label mt-0.5">{date.format(w.startedAt).toLowerCase()}</p>
                </div>
                <p className="flex flex-wrap gap-x-3 text-sm text-ink-muted">
                  <span>{t('history.minutes', { n: minutes })}</span>
                  <span>{t('history.sets', { n: working.length })}</span>
                  {volume > 0 ? <span>{t('history.volume', { kg: num.format(volume) })}</span> : null}
                </p>
              </div>
              <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
                {[...byExercise.entries()].map(([id, e]) => (
                  <li key={id} className="flex justify-between gap-2">
                    <span className="truncate text-ink">
                      {e.sets} × {exerciseOf(id)?.name[locale] ?? id}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-muted">
                      {e.line}
                    </span>
                  </li>
                ))}
              </ul>
              {editable ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={pending}
                    className={`ps-label hover:text-loss ${sure === w.id ? '!text-loss' : ''}`}
                    onClick={() => {
                      if (sure !== w.id) return setSure(w.id);
                      setSure(null);
                      void run(removeWorkout, { id: w.id });
                    }}
                  >
                    {sure === w.id ? t('history.removeConfirm') : t('history.remove')}
                  </button>
                  {sure === w.id ? (
                    <button type="button" className="ps-label hover:text-ink" onClick={() => setSure(null)}>
                      {t('history.keep')}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
