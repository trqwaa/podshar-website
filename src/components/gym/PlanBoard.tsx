'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/i18n/routing';
import { addPlanItem, removePlanDay, removePlanItem, savePlanDay, updatePlanItem } from '@/lib/gym/actions';
import type { PlanDayView, PlanItemView } from '@/lib/gym/data';
import { exerciseOf } from '@/lib/gym/exercises';
import { ExercisePicker } from './ExercisePicker';
import { ErrorLine, parseNumber, useGymAction } from './ui';

/**
 * План недели — мелом на доске, как в подвале.
 *
 * Семь строк, понедельник сверху. У дня — название и упражнения с подходами,
 * повторами и весом; день без упражнений — отдых. Правится прямо на доске:
 * название — по уходу с поля, цифры — так же, упражнение — через мопса
 * (`ExercisePicker`). Чужая доска показывается, но не правится.
 */

const CHALK_INPUT =
  'min-w-0 rounded border border-surface/25 bg-transparent px-1.5 py-1 text-center text-[1rem] tabular-nums text-surface outline-none placeholder:text-surface/35 focus:border-surface/70 sm:text-[0.9375rem]';

function ItemRow({ item, editable, onChange, onRemove }: { item: PlanItemView; editable: boolean; onChange: (patch: Partial<PlanItemView>) => void; onRemove: () => void }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const name = exerciseOf(item.exercise)?.name[locale] ?? item.exercise;
  if (!editable) {
    return (
      <li className="flex flex-wrap items-baseline gap-x-2 text-surface/90">
        <span>{name}</span>
        <span className="tabular-nums text-surface/60">
          {item.sets}×{item.reps}
          {item.weight ? ` · ${item.weight} ${t('board.weight')}` : ''}
        </span>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-surface/90">
      <span className="min-w-[9rem] flex-1">{name}</span>
      <label className="flex items-center gap-1 text-surface/60">
        <input aria-label={t('board.sets')} defaultValue={item.sets} inputMode="numeric" className={`${CHALK_INPUT} w-10`} onBlur={(e) => {
          const sets = parseNumber(e.target.value);
          if (sets && sets !== item.sets) onChange({ sets });
        }} />
        ×
        <input aria-label={t('board.reps')} defaultValue={item.reps} inputMode="numeric" className={`${CHALK_INPUT} w-11`} onBlur={(e) => {
          const reps = parseNumber(e.target.value);
          if (reps && reps !== item.reps) onChange({ reps });
        }} />
        ·
        <input
          aria-label={t('board.weight')}
          defaultValue={item.weight ?? ''}
          inputMode="decimal"
          placeholder="—"
          className={`${CHALK_INPUT} w-14`}
          onBlur={(e) => {
            const weight = parseNumber(e.target.value);
            if (weight !== item.weight) onChange({ weight });
          }}
        />
        {t('board.weight')}
      </label>
      <button type="button" onClick={onRemove} className="ps-label !text-surface/50 hover:!text-surface" aria-label={`${t('board.remove')}: ${name}`}>
        ×
      </button>
    </li>
  );
}

export function PlanBoard({ days, names, today, editable }: { days: PlanDayView[]; names: string[]; today: number; editable: boolean }) {
  const t = useTranslations('gym');
  const { run, pending, error } = useGymAction();
  const [picking, setPicking] = useState<number | null>(null);
  const [local, setLocal] = useState(days);
  useEffect(() => setLocal(days), [days]);

  const day = (weekday: number) => local.find((d) => d.weekday === weekday);

  return (
    <div className="rounded-[12px] border-[10px] p-4 sm:p-6" style={{ borderColor: 'color-mix(in oklab, rgb(var(--amber)) 55%, rgb(var(--ink)))', background: 'rgb(var(--chalkboard))' }}>
      <p className="text-sm text-surface/60">{editable ? t('board.hint') : t('board.readOnly')}</p>
      <ol className="mt-3 flex flex-col divide-y divide-surface/10">
        {names.map((label, weekday) => {
          const d = day(weekday);
          const items = d?.items ?? [];
          return (
            <li key={weekday} className={`grid grid-cols-[2.6rem,1fr] gap-x-3 gap-y-1 py-3 ${weekday === today ? 'rounded-[10px] bg-surface/5' : ''}`}>
              <span className={`pt-1 text-sm font-bold ${weekday === today ? 'text-surface' : 'text-surface/55'}`}>
                {label}
                {weekday === today ? <span className="block text-[0.65rem] font-semibold text-surface/60">{t('board.today')}</span> : null}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {editable ? (
                    <input
                      key={`${weekday}-${d?.title ?? ''}`}
                      defaultValue={d?.title ?? ''}
                      placeholder={items.length ? t('board.titlePlaceholder') : t('board.empty')}
                      aria-label={`${label}: ${t('board.titlePlaceholder')}`}
                      maxLength={40}
                      className="min-w-0 flex-1 border-b border-surface/20 bg-transparent py-1 text-[1rem] font-semibold text-surface outline-none placeholder:font-normal placeholder:text-surface/35 focus:border-surface/70 sm:text-[1.05rem]"
                      onBlur={(e) => {
                        const title = e.target.value.trim();
                        if (title !== (d?.title ?? '')) void run(savePlanDay, { weekday, title });
                      }}
                    />
                  ) : (
                    <span className={`py-1 font-semibold ${items.length ? 'text-surface' : 'text-surface/35'}`}>{d?.title || (items.length ? '' : t('board.empty'))}</span>
                  )}
                  {editable && d ? (
                    <button type="button" disabled={pending} onClick={() => void run(removePlanDay, { weekday })} className="ps-label !text-surface/45 hover:!text-surface">
                      {t('board.clearDay')}
                    </button>
                  ) : null}
                </div>
                {items.length ? (
                  <ul className="mt-1.5 flex flex-col gap-1.5 text-sm">
                    {items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        editable={editable}
                        onChange={(patch) => {
                          setLocal((all) => all.map((x) => (x.weekday === weekday ? { ...x, items: x.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) } : x)));
                          void run(updatePlanItem, { id: item.id, ...patch });
                        }}
                        onRemove={() => {
                          setLocal((all) => all.map((x) => (x.weekday === weekday ? { ...x, items: x.items.filter((i) => i.id !== item.id) } : x)));
                          void run(removePlanItem, { id: item.id });
                        }}
                      />
                    ))}
                  </ul>
                ) : null}
                {editable ? (
                  <button type="button" onClick={() => setPicking(weekday)} className="mt-2 text-sm font-semibold lowercase text-surface/70 hover:text-surface">
                    {t('board.add')}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <ErrorLine message={error} />
      {picking !== null ? (
        <ExercisePicker
          onClose={() => setPicking(null)}
          onPick={(exercise) => {
            const weekday = picking;
            setPicking(null);
            void run(addPlanItem, { weekday, exercise, sets: 3, reps: 10, weight: null });
          }}
        />
      ) : null}
    </div>
  );
}
