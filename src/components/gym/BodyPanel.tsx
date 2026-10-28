'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { DayField } from '@/components/calendar/DayField';
import type { Locale } from '@/i18n/routing';
import { addGoal, addMeasure, removeGoal, removeMeasure, saveProfile } from '@/lib/gym/actions';
import type { GoalView, MeasureView } from '@/lib/gym/data';
import { EXERCISES, exerciseOf } from '@/lib/gym/exercises';
import { ACTIVITIES, GOALS, GOAL_KINDS, PARTS, SEXES, unitOf, type Activity, type Goal, type GoalKind, type Part, type Sex, type Targets } from '@/lib/gym/norms';
import { BUTTON, CHIP, ErrorLine, GHOST, INPUT, parseNumber, useGymAction } from './ui';

/**
 * Цели и замеры: основная цель, данные для норм, конкретные цели с
 * прогрессом и история замеров с графиком.
 */

export type ProfileView = {
  goal: Goal;
  heightCm: number | null;
  sex: Sex;
  activity: Activity;
  bornYear: number | null;
  age: number | null;
  ageFromBirthday: boolean;
  weightKg: number | null;
  targets: Targets;
};

function Sparkline({ points }: { points: MeasureView[] }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const d = points
    .map((p, i) => `${((i / (points.length - 1)) * 116 + 2).toFixed(1)},${(30 - ((p.value - lo) / span) * 26).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox="0 0 120 32" className="h-8 w-28 shrink-0" aria-hidden="true">
      <polyline points={d} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={118} cy={Number(d.split(' ').pop()?.split(',')[1] ?? 16)} r={2.6} className="fill-accent" />
    </svg>
  );
}

function progressOf(goal: GoalView, measures: Partial<Record<Part, MeasureView[]>>, heaviest: Record<string, number>) {
  if (goal.kind === 'lift') {
    const now = goal.subject ? heaviest[goal.subject] ?? null : null;
    return { now, share: now === null ? 0 : Math.min(1, now / goal.target) };
  }
  const series = goal.kind === 'bodyweight' ? measures.weight : measures[goal.subject as Part];
  if (!series?.length) return { now: null, share: 0 };
  const start = series[0].value;
  const now = series[series.length - 1].value;
  if (start === goal.target) return { now, share: 1 };
  return { now, share: Math.max(0, Math.min(1, (now - start) / (goal.target - start))) };
}

export function BodyPanel({
  profile,
  goals,
  measures,
  heaviest,
  today,
  editable
}: {
  profile: ProfileView;
  goals: GoalView[];
  measures: Partial<Record<Part, MeasureView[]>>;
  /** Самый тяжёлый рабочий вес в каждом упражнении — для целей «жим 100». */
  heaviest: Record<string, number>;
  today: string;
  editable: boolean;
}) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const { run, pending, error } = useGymAction();
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const dateFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const unit = (part: Part) => t(`body.units.${unitOf(part)}`);

  const [sex, setSex] = useState<Sex>(profile.sex);
  const [activity, setActivity] = useState<Activity>(profile.activity);
  const [kind, setKind] = useState<GoalKind>('lift');
  const [part, setPart] = useState<Part>('weight');
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Основная цель */}
      <section>
        <h3 className="ps-label">{t('body.goal')}</h3>
        <p className="text-sm text-ink-muted">{t('body.goalHint')}</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {GOALS.map((g) => (
            <button
              key={g}
              type="button"
              disabled={!editable || pending}
              aria-pressed={profile.goal === g}
              onClick={() => void run(saveProfile, { goal: g })}
              className={`ps-press rounded-[10px] border-2 p-3 text-left ${profile.goal === g ? 'border-ink bg-ink text-surface' : 'border-rule text-ink hover:border-ink'} disabled:cursor-default`}
            >
              <span className="block text-lg font-semibold lowercase">{t(`goals.${g}`)}</span>
              <span className={`block text-xs ${profile.goal === g ? 'text-surface/75' : 'text-ink-muted'}`}>{t(`goalHint.${g}`)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Данные для норм */}
      <section>
        <h3 className="ps-label">{t('body.profile')}</h3>
        <form
          className="mt-2 flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const result = await run(saveProfile, {
              heightCm: parseNumber(String(data.get('height') ?? '')),
              bornYear: profile.ageFromBirthday ? undefined : parseNumber(String(data.get('born') ?? '')),
              sex,
              activity
            });
            setSaved(Boolean(result.ok));
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t('body.height')}
            <input name="height" defaultValue={profile.heightCm ?? ''} inputMode="decimal" disabled={!editable} className={`${INPUT} w-24`} />
          </label>
          {profile.ageFromBirthday ? null : (
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              {t('body.bornYear')}
              <input name="born" defaultValue={profile.bornYear ?? ''} inputMode="numeric" disabled={!editable} className={`${INPUT} w-24`} />
            </label>
          )}
          <fieldset className="flex flex-col gap-1 text-xs text-ink-muted">
            <legend className="mb-1">{t('body.sex')}</legend>
            <div className="flex gap-1">
              {SEXES.map((s) => (
                <button key={s} type="button" disabled={!editable} onClick={() => setSex(s)} className={`${CHIP} ${sex === s ? 'border-ink bg-ink text-surface' : 'border-rule text-ink'}`}>
                  {t(`body.sexes.${s}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-1 text-xs text-ink-muted">
            <legend className="mb-1">{t('body.activity')}</legend>
            <div className="flex gap-1">
              {ACTIVITIES.map((a) => (
                <button key={a} type="button" disabled={!editable} onClick={() => setActivity(a)} className={`${CHIP} ${activity === a ? 'border-ink bg-ink text-surface' : 'border-rule text-ink'}`}>
                  {t(`body.activities.${a}`)}
                </button>
              ))}
            </div>
          </fieldset>
          {editable ? (
            <button type="submit" disabled={pending} className={GHOST}>
              {saved ? t('body.saved') : t('body.save')}
            </button>
          ) : null}
        </form>
        <p className="mt-2 text-sm text-ink">
          {t('body.targets', {
            kcal: num.format(profile.targets.kcal),
            protein: num.format(profile.targets.protein),
            fat: num.format(profile.targets.fat),
            carbs: num.format(profile.targets.carbs)
          })}
        </p>
        <p className="text-xs text-ink-muted">
          {profile.age === null ? t('body.ageUnknown') : profile.ageFromBirthday ? t('body.ageFromBirthday', { age: profile.age }) : t('body.age', { age: profile.age })}
          {profile.weightKg === null ? ` · ${t('body.weightGuess')}` : ''}
        </p>
      </section>

      {/* Конкретные цели */}
      <section>
        <h3 className="ps-label">{t('body.goals')}</h3>
        {goals.length === 0 ? <p className="mt-1 text-sm text-ink-muted">{t('body.noGoals')}</p> : null}
        <ul className="mt-2 flex flex-col gap-2">
          {goals.map((g) => {
            const { now, share } = progressOf(g, measures, heaviest);
            const subject =
              g.kind === 'lift' ? exerciseOf(g.subject ?? '')?.name[locale] ?? g.subject : g.kind === 'measure' ? t(`body.parts.${g.subject}`) : t('body.kinds.bodyweight');
            const u = g.kind === 'measure' ? unit(g.subject as Part) : t('body.units.kg');
            return (
              <li key={g.id} className="rounded-[10px] border-2 border-rule-soft p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {subject} → {num.format(g.target)} {u}
                    {g.deadline ? <span className="ml-2 text-xs font-normal text-ink-muted">{t('body.deadline')} {dateFormat.format(new Date(`${g.deadline}T12:00:00Z`))}</span> : null}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {share >= 1 ? (
                      <span className="rounded bg-win/15 px-1.5 py-0.5 text-xs font-bold text-win">{t('body.reached')}</span>
                    ) : now === null ? (
                      t('body.progressNone')
                    ) : (
                      t('body.progress', { now: num.format(now), target: num.format(g.target) })
                    )}
                  </span>
                </div>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sunk">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
                </span>
                {editable ? (
                  <button type="button" disabled={pending} onClick={() => void run(removeGoal, { id: g.id })} className="ps-label mt-1.5 hover:text-loss">
                    {t('body.removeGoal')}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {editable ? (
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = new FormData(form);
              const result = await run(addGoal, {
                kind,
                subject: kind === 'bodyweight' ? null : String(data.get('subject') ?? ''),
                target: parseNumber(String(data.get('target') ?? '')),
                deadline: String(data.get('deadline') ?? '') || null
              });
              if (result.ok) form.reset();
            }}
          >
            <div className="flex gap-1">
              {GOAL_KINDS.map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={`${CHIP} ${kind === k ? 'border-ink bg-ink text-surface' : 'border-rule text-ink'}`}>
                  {t(`body.kinds.${k}`)}
                </button>
              ))}
            </div>
            {kind === 'lift' ? (
              <select name="subject" className={`${INPUT} max-w-[14rem]`} aria-label={t('body.kinds.lift')} defaultValue="bench-press">
                {EXERCISES.filter((e) => e.kind === 'weight').map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name[locale]}
                  </option>
                ))}
              </select>
            ) : kind === 'measure' ? (
              <select name="subject" className={`${INPUT} max-w-[12rem]`} aria-label={t('body.kinds.measure')} defaultValue="biceps">
                {PARTS.filter((p) => p !== 'weight').map((p) => (
                  <option key={p} value={p}>
                    {t(`body.parts.${p}`)}
                  </option>
                ))}
              </select>
            ) : null}
            <input name="target" required inputMode="decimal" placeholder={t('body.target')} aria-label={t('body.target')} className={`${INPUT} w-24`} />
            <div className="w-44">
              <DayField name="deadline" label={t('body.deadline')} value="" clearable />
            </div>
            <button type="submit" disabled={pending} className={BUTTON}>
              {t('body.addGoal')}
            </button>
          </form>
        ) : null}
      </section>

      {/* Замеры */}
      <section>
        <h3 className="ps-label">{t('body.measures')}</h3>
        {editable ? (
          <form
            className="mt-2 flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = new FormData(form);
              const result = await run(addMeasure, {
                part,
                value: parseNumber(String(data.get('value') ?? '')),
                takenOn: String(data.get('takenOn') ?? today) || today
              });
              if (result.ok) (form.elements.namedItem('value') as HTMLInputElement).value = '';
            }}
          >
            <select value={part} onChange={(e) => setPart(e.target.value as Part)} className={`${INPUT} max-w-[11rem]`} aria-label={t('body.measures')}>
              {PARTS.map((p) => (
                <option key={p} value={p}>
                  {t(`body.parts.${p}`)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-sm text-ink-muted">
              <input name="value" required inputMode="decimal" placeholder={t('body.value')} aria-label={t('body.value')} className={`${INPUT} w-24`} />
              {unit(part)}
            </label>
            <div className="w-44">
              <DayField name="takenOn" label={t('body.date')} value={today} />
            </div>
            <button type="submit" disabled={pending} className={BUTTON}>
              {t('body.addMeasure')}
            </button>
          </form>
        ) : null}
        {PARTS.every((p) => !measures[p]?.length) ? <p className="mt-2 text-sm text-ink-muted">{t('body.noMeasures')}</p> : null}
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {PARTS.filter((p) => measures[p]?.length).map((p) => {
            const series = measures[p] as MeasureView[];
            const last = series[series.length - 1];
            const first = series[0];
            const delta = last.value - first.value;
            const days = Math.round((Date.parse(last.takenOn) - Date.parse(first.takenOn)) / 86_400_000);
            return (
              <li key={p} className="rounded-[10px] border-2 border-rule-soft p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="ps-label">{t(`body.parts.${p}`)}</p>
                    <p className="text-xl font-semibold tabular-nums text-ink">
                      {num.format(last.value)} <span className="text-sm font-normal text-ink-muted">{unit(p)}</span>
                    </p>
                    {series.length > 1 ? (
                      <p className="text-xs text-ink-muted">
                        {t('body.change', { delta: `${delta > 0 ? '+' : ''}${num.format(delta)}`, days })}
                      </p>
                    ) : null}
                  </div>
                  <Sparkline points={series} />
                </div>
                <details className="mt-2 text-sm">
                  <summary className="ps-label cursor-pointer">{t('body.entries', { n: series.length })}</summary>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {[...series].reverse().map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 tabular-nums">
                        <span className="text-ink-muted">{dateFormat.format(new Date(`${m.takenOn}T12:00:00Z`))}</span>
                        <span className="text-ink">
                          {num.format(m.value)} {unit(p)}
                        </span>
                        {editable ? (
                          <button type="button" onClick={() => void run(removeMeasure, { id: m.id })} aria-label={t('body.remove')} className="text-ink-faint hover:text-loss">
                            ×
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
      <ErrorLine message={error} />
    </div>
  );
}
