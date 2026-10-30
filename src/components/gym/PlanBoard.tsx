'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/i18n/routing';
import { addPlanItem, removePlanDay, removePlanItem, savePlanDay, updatePlanItem } from '@/lib/gym/actions';
import type { PlanDayView, PlanItemView } from '@/lib/gym/data';
import { exerciseOf, musclesOf, trainsOn } from '@/lib/gym/exercises';
import { ExercisePicker } from './ExercisePicker';
import { ProgramPicker } from './ProgramPicker';
import { ErrorLine, parseNumber, useGymAction } from './ui';

/**
 * План недели — мелом на доске, как в подвале.
 *
 * Семь строк, понедельник сверху. У дня — название и упражнения с подходами,
 * повторами и весом; день без упражнений — отдых. Правится прямо на доске:
 * название — по уходу с поля, цифры — так же, упражнение — через мопса
 * (`ExercisePicker`). Чужая доска показывается, но не правится.
 */

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
/** «1:30» или «90» — секунды. */
const readClock = (text: string) => {
  const parts = text.trim().split(':').map((p) => Number(p.replace(',', '.')));
  if (!text.trim() || parts.some((n) => !Number.isFinite(n))) return null;
  return Math.round(parts.reduce((acc, v) => acc * 60 + v, 0));
};

const CHALK_INPUT =
  'min-w-0 rounded border border-surface/25 bg-transparent px-1.5 py-1 text-center text-[1rem] tabular-nums text-surface outline-none placeholder:text-surface/35 focus:border-surface/70 sm:text-[0.9375rem]';

function ItemRow({ item, editable, onChange, onRemove }: { item: PlanItemView; editable: boolean; onChange: (patch: Partial<PlanItemView>) => void; onRemove: () => void }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const exercise = exerciseOf(item.exercise);
  const name = exercise?.name[locale] ?? item.exercise;
  const kind = exercise?.kind ?? 'weight';
  const timed = kind === 'time' || kind === 'cardio';
  if (!editable) {
    return (
      <li className="flex flex-wrap items-baseline gap-x-2 text-surface/90">
        <span>{name}</span>
        <span className="tabular-nums text-surface/60">
          {kind === 'cardio' ? clock(item.seconds ?? 0) : timed ? `${item.sets}×${clock(item.seconds ?? 0)}` : `${item.sets}×${item.reps}`}
          {!timed && item.weight ? ` · ${kind === 'assisted' ? '−' : kind === 'body' ? '+' : ''}${item.weight} ${t('board.weight')}` : ''}
        </span>
      </li>
    );
  }
  if (timed) {
    return (
      <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-surface/90">
        <span className="min-w-[9rem] flex-1">{name}</span>
        <label className="flex items-center gap-1 text-surface/60">
          {kind === 'time' ? (
            <>
              <input aria-label={t('board.sets')} defaultValue={item.sets} inputMode="numeric" className={`${CHALK_INPUT} w-10`} onBlur={(e) => {
                const sets = parseNumber(e.target.value);
                if (sets && sets !== item.sets) onChange({ sets });
              }} />
              ×
            </>
          ) : null}
          <input
            aria-label={t('board.time')}
            defaultValue={clock(item.seconds ?? 0)}
            className={`${CHALK_INPUT} w-16`}
            onBlur={(e) => {
              const seconds = readClock(e.target.value);
              if (seconds !== null && seconds !== item.seconds) onChange({ seconds });
            }}
          />
        </label>
        <button type="button" onClick={onRemove} className="ps-label !text-surface/50 hover:!text-surface" aria-label={`${t('board.remove')}: ${name}`}>
          ×
        </button>
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
        {kind === 'assisted' ? `−${t('board.weight')}` : kind === 'body' ? `+${t('board.weight')}` : t('board.weight')}
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
  const [programs, setPrograms] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => setLocal(days), [days]);
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 4000);
    return () => window.clearTimeout(timer);
  }, [note]);

  const day = (weekday: number) => local.find((d) => d.weekday === weekday);
  // Название, которое не вписали, — из мышц дня, на языке страницы.
  const auto = (items: PlanItemView[]) => musclesOf(items.map((i) => i.exercise)).map((m) => t(`muscles.${m}`)).join(' · ');

  return (
    <div className="relative rounded-[12px] border-[10px] p-4 pb-12 sm:p-6 sm:pb-14" style={{ borderColor: 'color-mix(in oklab, rgb(var(--amber)) 55%, rgb(var(--ink)))', background: 'rgb(var(--chalkboard))' }}>
      <ChalkDust />
      {/* Справа — место под каракули мелом: на телефоне текст шёл прямо по ним. */}
      <p className="relative pr-24 text-sm text-surface/60 sm:pr-32">{editable ? t('board.hint') : t('board.readOnly')}</p>
      {editable ? (
        <div className="relative mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPrograms(true)}
            className="ps-press rounded-[8px] border-2 border-surface/40 px-3 py-1.5 text-sm font-semibold lowercase text-surface hover:border-surface"
          >
            {t('board.programs')}
          </button>
          {note ? (
            <span role="status" className="text-sm font-medium text-surface/80">
              {note}
            </span>
          ) : null}
        </div>
      ) : null}
      <ol className="relative mt-3 flex flex-col divide-y divide-surface/10">
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
                      placeholder={items.length ? auto(items) || t('board.titlePlaceholder') : t('board.empty')}
                      aria-label={`${label}: ${t('board.titlePlaceholder')}`}
                      maxLength={40}
                      className="min-w-0 flex-1 border-b border-surface/20 bg-transparent py-1 text-[1rem] font-semibold text-surface outline-none placeholder:font-normal placeholder:text-surface/35 focus:border-surface/70 sm:text-[1.05rem]"
                      onBlur={(e) => {
                        const title = e.target.value.trim();
                        if (title !== (d?.title ?? '')) void run(savePlanDay, { weekday, title });
                      }}
                    />
                  ) : (
                    <span className={`py-1 font-semibold ${trainsOn(d?.title ?? '', items.length) ? 'text-surface' : 'text-surface/35'}`}>{d?.title || (items.length ? auto(items) : t('board.empty'))}</span>
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
      <ChalkTray />
      {programs ? (
        <ProgramPicker
          names={names}
          filled={local.some((d) => d.items.length > 0)}
          onClose={() => setPrograms(false)}
          onDone={() => {
            setPrograms(false);
            setNote(t('board.programDone'));
          }}
        />
      ) : null}
      {picking !== null ? (
        <ExercisePicker
          onClose={() => setPicking(null)}
          onPick={(exercise) => {
            const weekday = picking;
            setPicking(null);
            const kind = exerciseOf(exercise)?.kind;
            void run(addPlanItem, {
              weekday,
              exercise,
              sets: kind === 'cardio' ? 1 : 3,
              reps: kind === 'time' || kind === 'cardio' ? 1 : 10,
              weight: null,
              seconds: kind === 'time' ? 60 : kind === 'cardio' ? 1800 : null
            });
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Доска не новая: разводы стёртого мела, в углу — чьи-то каракули, которые
 * не стирают из уважения. Только картинка, для скринридера её нет.
 */
function ChalkDust() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
      <defs>
        <radialGradient id="chalk-smear" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(var(--surface))" stopOpacity="0.07" />
          <stop offset="100%" stopColor="rgb(var(--surface))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="78" cy="22" rx="26" ry="12" fill="url(#chalk-smear)" />
      <ellipse cx="22" cy="70" rx="30" ry="10" fill="url(#chalk-smear)" />
      <ellipse cx="60" cy="88" rx="22" ry="7" fill="url(#chalk-smear)" />
    </svg>
  );
}

/** Каракули мелом и полочка снизу: огрызок мела и тряпка. */
function ChalkTray() {
  return (
    <>
      <svg aria-hidden="true" viewBox="0 0 120 60" className="pointer-events-none absolute right-3 top-3 h-12 w-24 opacity-50 sm:right-5 sm:top-4 sm:h-16 sm:w-32">
        <g stroke="rgb(var(--surface))" strokeWidth="1.8" strokeLinecap="round" fill="none">
          {/* Гантель и пять палочек — счёт чего-то, о чём уже никто не помнит. */}
          <path d="M14 30H46M14 22V38M20 20V40M40 20V40M46 22V38" />
          <path d="M62 18V40M68 18V40M74 18V40M80 18V40M58 34L86 22" />
          <path d="M96 40Q100 20 106 40M98 33H104" />
          <path d="M8 52Q40 46 70 52T112 50" strokeOpacity="0.5" />
        </g>
      </svg>
      <svg aria-hidden="true" viewBox="0 0 320 28" className="pointer-events-none absolute -bottom-[10px] left-1/2 h-7 w-[min(90%,22rem)] -translate-x-1/2" preserveAspectRatio="xMidYMax meet">
        <rect x="0" y="16" width="320" height="12" rx="3" fill="color-mix(in oklab, rgb(var(--amber)) 50%, rgb(var(--ink)))" />
        <rect x="0" y="16" width="320" height="3" fill="rgb(var(--ink) / 0.3)" />
        {/* Мел: длинный, огрызок и крошки. */}
        <rect x="40" y="10" width="34" height="7" rx="3" fill="rgb(var(--surface))" />
        <rect x="88" y="11" width="12" height="6" rx="2.5" fill="rgb(var(--surface) / 0.85)" transform="rotate(-8 94 14)" />
        <circle cx="108" cy="15" r="1.2" fill="rgb(var(--surface) / 0.8)" />
        <circle cx="113" cy="15.5" r="0.9" fill="rgb(var(--surface) / 0.7)" />
        {/* Тряпка, серая от мела. */}
        <path d="M206 17C204 8 214 2 228 4C240 2 252 6 254 12C258 16 252 18 244 17Z" fill="color-mix(in oklab, rgb(var(--ink)) 35%, rgb(var(--surface)))" />
        <path d="M212 12Q226 8 246 12M216 15Q230 12 240 15" stroke="rgb(var(--ink) / 0.25)" strokeWidth="1" fill="none" />
      </svg>
    </>
  );
}
