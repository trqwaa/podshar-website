'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';

import { Modal } from '@/components/Modal';
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
import { countsVolume, exerciseOf, oneRepMax, type Kind } from '@/lib/gym/exercises';
import { ExercisePicker } from './ExercisePicker';
import { PugAvatar } from './PugAvatar';
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

/** «1:30», «90», «1:02:03» — в секунды. Пусто или мусор — `null`. */
export function parseClock(text: string): number | null {
  const parts = text.trim().split(':').map((p) => p.trim());
  if (!parts[0] || parts.some((p) => !/^\d+(?:[.,]\d+)?$/.test(p))) return null;
  const n = parts.map((p) => Number(p.replace(',', '.')));
  const total = n.reduce((acc, v) => acc * 60 + v, 0);
  return Number.isFinite(total) ? Math.round(total) : null;
}

/**
 * Отдых, как в Strong: идёт или стоит на паузе. Идёт — помним, когда кончится;
 * на паузе — сколько осталось. `total` — во сколько он сейчас, для полосы:
 * ±15 с двигают и его.
 */
type Rest = { total: number; end: number | null; left: number };

/**
 * Таймер отдыха — крупно, внизу экрана, поверх всего: пауза, заново, ±15 с,
 * пропустить. Пока он стоит, у `<html>` есть `data-docked`, и кнопка мопса в
 * углу прячется: и на таймере, и над ним она закрывала кнопки.
 */
function RestBar({
  left,
  total,
  paused,
  onPause,
  onReset,
  onShift,
  onSkip
}: {
  left: number;
  total: number;
  paused: boolean;
  onPause: () => void;
  onReset: () => void;
  onShift: (seconds: number) => void;
  onSkip: () => void;
}) {
  const t = useTranslations('gym');
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.docked = '';
    return () => {
      delete root.dataset.docked;
    };
  }, []);
  const small = 'ps-press rounded-[10px] border-2 border-rule py-2 text-sm font-semibold lowercase text-ink hover:border-ink';
  return (
    <div
      role="timer"
      aria-label={t('workout.restTitle')}
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-[30rem] sm:-translate-x-1/2 sm:rounded-[14px] sm:border-2 sm:pb-3"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="ps-label">{paused ? t('workout.restPaused') : t('workout.restTitle')}</p>
          <p className={`text-4xl font-bold leading-none tabular-nums ${paused ? 'text-ink-muted' : 'text-ink'}`}>{clock(left)}</p>
        </div>
        <button type="button" onClick={onPause} className={`${BUTTON} px-5 py-2.5 text-sm sm:text-sm`}>
          {paused ? t('workout.restResume') : t('workout.restPause')}
        </button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunk">
        <div className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${Math.max(0, Math.min(100, (left / Math.max(1, total)) * 100))}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <button type="button" className={small} onClick={() => onShift(-15)}>
          {t('workout.restLess')}
        </button>
        <button type="button" className={small} onClick={onReset}>
          {t('workout.restReset')}
        </button>
        <button type="button" className={small} onClick={() => onShift(15)}>
          {t('workout.restMore')}
        </button>
        <button type="button" className={`${small} border-ink`} onClick={onSkip}>
          {t('workout.restSkip')}
        </button>
      </div>
    </div>
  );
}

type Past = { weight: number | null; reps: number | null; seconds: number | null; distance: number | null };
type Previous = Record<string, Past[]>;
type Field = 'weight' | 'reps' | 'seconds' | 'distance';

/** Какие поля у подхода — как категории Strong. */
const FIELDS: Record<Kind, Field[]> = {
  weight: ['weight', 'reps'],
  body: ['weight', 'reps'],
  assisted: ['weight', 'reps'],
  time: ['seconds'],
  cardio: ['distance', 'seconds']
};

export function Workout({
  workout,
  previous,
  best,
  restSeconds,
  todayPlan,
  editable,
  discardLines
}: {
  workout: WorkoutView | null;
  previous: Previous;
  best: Record<string, number>;
  restSeconds: number;
  todayPlan: { title: string; count: number } | null;
  editable: boolean;
  /** Что мопс говорит тому, кто бросает тренировку: строки выбрал сервер. */
  discardLines: string[];
}) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const { run, pending, error } = useGymAction();
  const [sets, setSets] = useState<SetView[]>(workout?.sets ?? []);
  const [picking, setPicking] = useState(false);
  const [demo, setDemo] = useState<string | null>(null);
  const [rest, setRest] = useState<Rest | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<string | null>(null);

  useEffect(() => setSets(workout?.sets ?? []), [workout]);

  // Секундомер тренировки и таймер отдыха: раз в секунду, не покадрово.
  const ticking = Boolean(workout) || rest !== null;
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  useEffect(() => {
    if (rest?.end != null && now >= rest.end) {
      setRest(null);
      if ('vibrate' in navigator) navigator.vibrate?.([120, 80, 120]);
    }
  }, [now, rest]);

  const startRest = () => setRest({ total: restSeconds, end: Date.now() + restSeconds * 1000, left: 0 });

  const blocks = useMemo(() => {
    const map = new Map<number, SetView[]>();
    for (const s of sets) map.set(s.block, [...(map.get(s.block) ?? []), s]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([block, list]) => ({ block, list: list.sort((a, b) => a.index - b.index) }));
  }, [sets]);

  const volume = sets
    .filter((s) => s.done && !s.warmup && countsVolume(exerciseOf(s.exercise)?.kind ?? 'weight'))
    .reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
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
  const resting = rest ? (rest.end !== null ? (rest.end - now) / 1000 : rest.left / 1000) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <input
          key={workout.id}
          defaultValue={workout.title}
          disabled={!editable}
          placeholder={t('workout.titlePlaceholder')}
          aria-label={t('workout.titlePlaceholder')}
          maxLength={60}
          className="min-w-0 basis-full border-b-2 border-rule bg-transparent py-1 text-xl font-semibold text-ink outline-none placeholder:text-ink-faint focus:border-ink sm:flex-1 sm:basis-auto"
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
        const kind: Kind = exercise?.kind ?? 'weight';
        const fields = FIELDS[kind];
        const label = (f: Field) =>
          f === 'weight' ? (kind === 'body' ? t('workout.plusKg') : kind === 'assisted' ? t('workout.minusKg') : t('workout.kg')) : f === 'reps' ? t('workout.reps') : f === 'seconds' ? t('workout.time') : t('workout.km');
        const show = (f: Field, v: number | null | undefined) => (v == null ? '' : f === 'seconds' ? clock(v) : num.format(v));
        const read = (f: Field, text: string): number | null => {
          if (f === 'seconds') return parseClock(text);
          const v = parseNumber(text);
          return v === null ? null : f === 'reps' ? Math.round(v) : v;
        };
        const pastLine = (p: Past) =>
          kind === 'time'
            ? p.seconds != null ? clock(p.seconds) : '—'
            : kind === 'cardio'
              ? [p.distance != null ? `${num.format(p.distance)} ${t('workout.km')}` : null, p.seconds != null ? clock(p.seconds) : null].filter(Boolean).join(' · ') || '—'
              : `${p.weight ? (kind === 'body' ? '+' : kind === 'assisted' ? '−' : '') + num.format(p.weight) + ' ' : ''}× ${p.reps ?? '—'}`;
        return (
          <section key={block} className="-mx-1 rounded-[10px] border-2 border-rule-soft p-2 sm:mx-0 sm:p-4">
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
            {/* На телефоне столбца «прошлый раз» нет: прошлые цифры и так стоят
                в полях подсказкой, а с ним поля сжимались до «102,…». */}
            <table className="w-full table-fixed border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left">
                  <th className="ps-label w-11 font-semibold sm:w-14">{t('workout.set')}</th>
                  <th className="ps-label hidden font-semibold sm:table-cell">{t('workout.previous')}</th>
                  {fields.map((f) => (
                    <th key={f} className={`ps-label text-center font-semibold ${f === 'seconds' ? 'w-auto sm:w-[4.75rem]' : 'w-auto sm:w-[4.5rem]'}`}>
                      {label(f)}
                    </th>
                  ))}
                  <th className="w-10 sm:w-11" aria-label={t('workout.done')} />
                  {editable ? <th className="w-6 sm:w-7" /> : null}
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => {
                  const prev = before[i - list.filter((x, j) => j < i && x.warmup).length] ?? null;
                  const pr =
                    kind === 'weight' && s.done && !s.warmup && (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0 && record > 0 && oneRepMax(s.weight ?? 0, s.reps ?? 0) > record + 0.01;
                  const workingIndex = list.slice(0, i + 1).filter((x) => !x.warmup).length;
                  return (
                    <tr key={s.id} className={s.done ? (pr ? 'bg-amber/15' : 'bg-win/10') : ''}>
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
                      <td className="hidden truncate text-ink-muted tabular-nums sm:table-cell">
                        {prev ? pastLine(prev) : '—'}
                        {pr ? <span className="ml-1.5 rounded bg-amber/15 px-1.5 py-0.5 text-[0.7rem] font-bold text-amber">{t('workout.best')}</span> : null}
                      </td>
                      {fields.map((f) => (
                        <td key={f} className="px-0.5 sm:px-1">
                          <input
                            key={`${s.id}-${f}`}
                            data-field={f}
                            defaultValue={show(f, s[f])}
                            disabled={!editable}
                            inputMode={f === 'reps' ? 'numeric' : f === 'seconds' ? 'text' : 'decimal'}
                            placeholder={prev && prev[f] != null ? show(f, prev[f]) : f === 'seconds' ? '0:00' : '—'}
                            aria-label={`${name}, ${t('workout.set')} ${i + 1}, ${label(f)}`}
                            className={SMALL_INPUT}
                            onBlur={(e) => {
                              const value = read(f, e.target.value);
                              if (value !== s[f]) {
                                patch(s.id, { [f]: value });
                                void run(updateSet, { id: s.id, [f]: value });
                              }
                            }}
                          />
                        </td>
                      ))}
                      <td className="text-center">
                        <button
                          type="button"
                          disabled={!editable}
                          aria-pressed={s.done}
                          aria-label={`${name}, ${t('workout.set')} ${i + 1}: ${t('workout.done')}`}
                          onClick={(e) => {
                            // Поле, из которого пришли, ещё не успело сохраниться: берём
                            // цифры прямо из строки, чтобы галочка не ушла с пустыми.
                            const row = e.currentTarget.closest('tr') as HTMLTableRowElement | null;
                            const done = !s.done;
                            const filled: Partial<Record<Field, number | null>> = {};
                            for (const f of fields) {
                              const input = row?.querySelector<HTMLInputElement>(`input[data-field="${f}"]`);
                              const typed = input ? read(f, input.value) : s[f];
                              filled[f] = typed ?? (done ? (prev?.[f] ?? null) : s[f]);
                            }
                            patch(s.id, { done, ...filled });
                            void run(updateSet, { id: s.id, done, ...filled });
                            if (done && !s.warmup) startRest();
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
                setRest(null);
              }}
            >
              {t('workout.finish')}
            </button>
            <button
              type="button"
              disabled={pending}
              className={GHOST}
              onClick={() => setDiscarding(discardLines[Math.floor(Math.random() * discardLines.length)] ?? t('workout.discardConfirm'))}
            >
              {t('workout.discard')}
            </button>
          </div>
        </div>
      ) : null}
      <ErrorLine message={error} />

      {/* Место под таймером: иначе «закончить» и «бросить» уезжали бы под него. */}
      {rest ? <div aria-hidden="true" className="h-36 sm:h-28" /> : null}

      {/* Таймер отдыха и окно «бросить» — в `document.body`: внутри карточки с
          анимацией въезда `fixed` прилип бы к карточке, а не к экрану. */}
      {rest && resting !== null
        ? createPortal(
            <RestBar
              left={Math.max(0, resting)}
              total={rest.total}
              paused={rest.end === null}
              onPause={() =>
                setRest((r) => (r ? (r.end !== null ? { ...r, end: null, left: Math.max(0, r.end - Date.now()) } : { ...r, end: Date.now() + r.left }) : r))
              }
              onReset={() => setRest((r) => (r ? { ...r, end: Date.now() + r.total * 1000, left: 0 } : r))}
              onShift={(seconds) =>
                setRest((r) => {
                  if (!r) return r;
                  const total = Math.max(15, r.total + seconds);
                  return r.end !== null ? { ...r, total, end: Math.max(Date.now(), r.end + seconds * 1000) } : { ...r, total, left: Math.max(0, r.left + seconds * 1000) };
                })
              }
              onSkip={() => setRest(null)}
            />,
            document.body
          )
        : null}
      {discarding !== null
        ? createPortal(
            <Modal title={t('workout.discardTitle')} close={t('workout.discardNo')} onClose={() => setDiscarding(null)}>
              {/* Не системное «точно?», а тренер: бросать на середине — повод получить. */}
              <div className="flex flex-col items-center gap-3 text-center">
                <PugAvatar className="h-28 w-28" />
                <p className="rounded-[12px] border-2 border-ink px-4 py-2 text-base font-semibold text-ink">{discarding}</p>
                <p className="text-xs text-ink-muted">{t('workout.discardConfirm')}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" className={BUTTON} onClick={() => setDiscarding(null)}>
                    {t('workout.discardNo')}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className={`${GHOST} hover:border-loss hover:text-loss`}
                    onClick={() => {
                      setDiscarding(null);
                      setRest(null);
                      void run(removeWorkout, { id: workout.id });
                    }}
                  >
                    {t('workout.discardYes')}
                  </button>
                </div>
              </div>
            </Modal>,
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
