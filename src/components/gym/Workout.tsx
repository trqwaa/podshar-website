'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/i18n/routing';
import {
  addExercise,
  addSet,
  finishWorkout,
  removeBlock,
  removeSet,
  removeWorkout,
  renameWorkout,
  startWorkout,
  updateSet
} from '@/lib/gym/actions';
import type { SetView, WorkoutView } from '@/lib/gym/data';
import { exerciseOf, oneRepMax } from '@/lib/gym/exercises';
import { ExercisePicker } from './ExercisePicker';
import { BUTTON, ErrorLine, GHOST, SMALL_INPUT, parseNumber, useGymAction } from './ui';

/**
 * Тренировка — как в Strong: упражнения столбиком, у каждого подходы строкой
 * «прошлый раз · кг · повторы · галочка». Отметил подход — пошёл таймер
 * отдыха, длина которого зависит от цели. Закончил — в историю уходит только
 * отмеченное.
 *
 * Поля неуправляемые и сохраняются по уходу с поля: перерисовка после ответа
 * сервера не сбивает то, что человек сейчас набирает. Галочка и разминка
 * меняются сразу — и на экране, и в базе.
 */

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
};

type Previous = Record<string, { weight: number | null; reps: number | null }[]>;

export function Workout({
  workout,
  previous,
  best,
  restSeconds,
  todayPlan,
  editable
}: {
  workout: WorkoutView | null;
  previous: Previous;
  best: Record<string, number>;
  restSeconds: number;
  todayPlan: { title: string; count: number } | null;
  editable: boolean;
}) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const { run, pending, error } = useGymAction();
  const [sets, setSets] = useState<SetView[]>(workout?.sets ?? []);
  const [picking, setPicking] = useState(false);
  const [demo, setDemo] = useState<string | null>(null);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => setSets(workout?.sets ?? []), [workout]);

  // Секундомер тренировки и таймер отдыха: раз в секунду, не покадрово.
  const ticking = Boolean(workout) || restUntil !== null;
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  useEffect(() => {
    if (restUntil !== null && now >= restUntil) {
      setRestUntil(null);
      if ('vibrate' in navigator) navigator.vibrate?.([120, 80, 120]);
    }
  }, [now, restUntil]);

  const blocks = useMemo(() => {
    const map = new Map<number, SetView[]>();
    for (const s of sets) map.set(s.block, [...(map.get(s.block) ?? []), s]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([block, list]) => ({ block, list: list.sort((a, b) => a.index - b.index) }));
  }, [sets]);

  const volume = sets.filter((s) => s.done && !s.warmup).reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  const patch = (id: string, change: Partial<SetView>) => setSets((all) => all.map((s) => (s.id === id ? { ...s, ...change } : s)));

  if (!workout) {
    return (
      <div className="flex flex-col gap-3">
        {note ? <p className="rounded border-2 border-ink px-3 py-2 text-sm font-medium text-ink">{note}</p> : null}
        {editable ? (
          <>
            {todayPlan ? null : <p className="text-sm text-ink-muted">{t('workout.noPlanToday')}</p>}
            <div className="flex flex-wrap gap-2">
              {todayPlan ? (
                <button type="button" disabled={pending} className={BUTTON} onClick={() => void run(startWorkout, { fromPlan: true })}>
                  {todayPlan.title ? t('workout.startPlan', { title: todayPlan.title }) : t('workout.startPlanUntitled')}
                </button>
              ) : null}
              <button type="button" disabled={pending} className={todayPlan ? GHOST : BUTTON} onClick={() => void run(startWorkout, { fromPlan: false })}>
                {t('workout.startEmpty')}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-muted">{t('board.readOnly')}</p>
        )}
        <ErrorLine message={error} />
      </div>
    );
  }

  const unchecked = sets.some((s) => !s.done);
  const resting = restUntil !== null ? (restUntil - now) / 1000 : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          key={workout.id}
          defaultValue={workout.title}
          disabled={!editable}
          placeholder={t('workout.titlePlaceholder')}
          aria-label={t('workout.titlePlaceholder')}
          maxLength={60}
          className="min-w-0 flex-1 border-b-2 border-rule bg-transparent py-1 text-xl font-semibold text-ink outline-none placeholder:text-ink-faint focus:border-ink"
          onBlur={(e) => {
            if (e.target.value.trim() !== workout.title) void run(renameWorkout, { sessionId: workout.id, title: e.target.value });
          }}
        />
        <span className="ps-label tabular-nums">{t('workout.elapsed', { time: clock((now - workout.startedAt) / 1000) })}</span>
        <span className="ps-label tabular-nums">
          {t('workout.volume')}: {num.format(volume)} kg
        </span>
      </div>

      {blocks.map(({ block, list }) => {
        const exercise = exerciseOf(list[0].exercise);
        const name = exercise?.name[locale] ?? list[0].exercise;
        const before = previous[list[0].exercise] ?? [];
        const record = best[list[0].exercise] ?? 0;
        return (
          <section key={block} className="rounded-[10px] border-2 border-rule-soft p-3 sm:p-4">
            <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-accent">{name}</h3>
              <div className="flex gap-2">
                <button type="button" onClick={() => setDemo(list[0].exercise)} className="ps-label hover:text-ink hover:underline">
                  {t('workout.demo')}
                </button>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSets((all) => all.filter((s) => s.block !== block));
                      void run(removeBlock, { sessionId: workout.id, block });
                    }}
                    className="ps-label hover:text-loss"
                  >
                    {t('workout.removeExercise')}
                  </button>
                ) : null}
              </div>
            </header>
            <table className="w-full table-fixed border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left">
                  <th className="ps-label w-14 font-semibold">{t('workout.set')}</th>
                  <th className="ps-label font-semibold">{t('workout.previous')}</th>
                  <th className="ps-label w-[4.5rem] text-center font-semibold">{t('workout.kg')}</th>
                  <th className="ps-label w-[4rem] text-center font-semibold">{t('workout.reps')}</th>
                  <th className="w-11" aria-label={t('workout.done')} />
                  {editable ? <th className="w-7" /> : null}
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => {
                  const prev = before[i - list.filter((x, j) => j < i && x.warmup).length] ?? null;
                  const pr = s.done && !s.warmup && (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0 && record > 0 && oneRepMax(s.weight ?? 0, s.reps ?? 0) > record + 0.01;
                  const workingIndex = list.slice(0, i + 1).filter((x) => !x.warmup).length;
                  return (
                    <tr key={s.id} className={s.done ? 'bg-win/10' : ''}>
                      <td className="rounded-l-[6px] py-1 pl-1">
                        <button
                          type="button"
                          disabled={!editable}
                          title={t('workout.warmupLabel')}
                          onClick={() => {
                            patch(s.id, { warmup: !s.warmup });
                            void run(updateSet, { id: s.id, warmup: !s.warmup });
                          }}
                          className={`grid h-8 w-8 place-items-center rounded font-bold tabular-nums ${s.warmup ? 'bg-amber/15 text-amber' : 'text-ink'}`}
                        >
                          {s.warmup ? t('workout.warmup') : workingIndex}
                        </button>
                      </td>
                      <td className="truncate text-ink-muted tabular-nums">
                        {prev && prev.weight != null ? `${num.format(prev.weight)} × ${prev.reps ?? '—'}` : prev ? `× ${prev.reps ?? '—'}` : '—'}
                        {pr ? <span className="ml-1.5 rounded bg-amber/15 px-1.5 py-0.5 text-[0.7rem] font-bold text-amber">{t('workout.best')}</span> : null}
                      </td>
                      <td className="px-1">
                        <input
                          key={`${s.id}-w`}
                          defaultValue={s.weight ?? ''}
                          disabled={!editable}
                          inputMode="decimal"
                          placeholder={prev?.weight != null ? num.format(prev.weight) : '—'}
                          aria-label={`${name}, ${t('workout.set')} ${i + 1}, ${t('workout.kg')}`}
                          className={SMALL_INPUT}
                          onBlur={(e) => {
                            const weight = parseNumber(e.target.value);
                            if (weight !== s.weight) {
                              patch(s.id, { weight });
                              void run(updateSet, { id: s.id, weight });
                            }
                          }}
                        />
                      </td>
                      <td className="px-1">
                        <input
                          key={`${s.id}-r`}
                          defaultValue={s.reps ?? ''}
                          disabled={!editable}
                          inputMode="numeric"
                          placeholder={prev?.reps != null ? String(prev.reps) : '—'}
                          aria-label={`${name}, ${t('workout.set')} ${i + 1}, ${t('workout.reps')}`}
                          className={SMALL_INPUT}
                          onBlur={(e) => {
                            const reps = parseNumber(e.target.value);
                            const value = reps === null ? null : Math.round(reps);
                            if (value !== s.reps) {
                              patch(s.id, { reps: value });
                              void run(updateSet, { id: s.id, reps: value });
                            }
                          }}
                        />
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          disabled={!editable}
                          aria-pressed={s.done}
                          aria-label={`${name}, ${t('workout.set')} ${i + 1}: ${t('workout.done')}`}
                          onClick={(e) => {
                            // Поле, из которого пришли, ещё не успело сохраниться: берём
                            // цифры прямо из строки, чтобы галочка не ушла с пустыми.
                            const row = (e.currentTarget.closest('tr') as HTMLTableRowElement | null)?.querySelectorAll('input');
                            const weight = row?.[0] ? parseNumber(row[0].value) : s.weight;
                            const reps = row?.[1] ? parseNumber(row[1].value) : s.reps;
                            const done = !s.done;
                            const filled = {
                              weight: weight ?? (done ? (prev?.weight ?? null) : s.weight),
                              reps: reps === null ? (done ? (prev?.reps ?? null) : s.reps) : Math.round(reps)
                            };
                            patch(s.id, { done, ...filled });
                            void run(updateSet, { id: s.id, done, ...filled });
                            if (done && !s.warmup) setRestUntil(Date.now() + restSeconds * 1000);
                          }}
                          className={`grid h-8 w-9 place-items-center rounded border-2 font-bold ${
                            s.done ? 'border-win bg-win text-surface' : 'border-rule text-ink-faint hover:border-ink'
                          }`}
                        >
                          ✓
                        </button>
                      </td>
                      {editable ? (
                        <td className="rounded-r-[6px] text-center">
                          <button
                            type="button"
                            aria-label={t('workout.removeSet')}
                            onClick={() => {
                              setSets((all) => all.filter((x) => x.id !== s.id));
                              void run(removeSet, { id: s.id });
                            }}
                            className="text-ink-faint hover:text-loss"
                          >
                            ×
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {editable ? (
              <button type="button" disabled={pending} onClick={() => void run(addSet, { sessionId: workout.id, block })} className={`${GHOST} mt-1 w-full`}>
                {t('workout.addSet')}
              </button>
            ) : null}
          </section>
        );
      })}

      {editable ? (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setPicking(true)} className={`${GHOST} w-full border-dashed`}>
            {t('workout.addExercise')}
          </button>
          {unchecked ? <p className="text-xs text-ink-muted">{t('workout.unchecked')}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className={BUTTON}
              onClick={async () => {
                const result = await run(finishWorkout, { sessionId: workout.id });
                if (result.ok) setNote(result.empty ? t('workout.empty') : t('workout.finished'));
                setRestUntil(null);
              }}
            >
              {t('workout.finish')}
            </button>
            <button
              type="button"
              disabled={pending}
              className={GHOST}
              onClick={() => {
                if (window.confirm(t('workout.discardConfirm'))) {
                  setRestUntil(null);
                  void run(removeWorkout, { id: workout.id });
                }
              }}
            >
              {t('workout.discard')}
            </button>
          </div>
        </div>
      ) : null}
      <ErrorLine message={error} />

      {/* Таймер отдыха — в `document.body`: внутри карточки с анимацией въезда
          `fixed` прилип бы к карточке, а не к низу экрана. */}
      {resting !== null
        ? createPortal(
            <div className="fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-md items-center gap-3 rounded-[12px] border-2 border-ink bg-surface px-4 py-3 sm:bottom-5">
              <span className="text-lg font-bold tabular-nums text-ink">{t('workout.rest', { time: clock(resting) })}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, (resting / restSeconds) * 100))}%` }} />
              </span>
              <button type="button" className="ps-label hover:text-ink" onClick={() => setRestUntil((u) => (u ?? Date.now()) + 15_000)}>
                {t('workout.restMore')}
              </button>
              <button type="button" className="ps-label hover:text-ink" onClick={() => setRestUntil(null)}>
                {t('workout.restSkip')}
              </button>
            </div>,
            document.body
          )
        : null}

      {picking ? (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(exercise) => {
            setPicking(false);
            void run(addExercise, { sessionId: workout.id, exercise });
          }}
        />
      ) : null}
      {demo ? <ExercisePicker initial={demo} onClose={() => setDemo(null)} /> : null}
    </div>
  );
}
