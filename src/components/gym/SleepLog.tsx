'use client';

import { useLocale, useTranslations } from 'next-intl';

import { DayField } from '@/components/calendar/DayField';
import type { Locale } from '@/i18n/routing';
import { addSleep, removeSleep } from '@/lib/gym/actions';
import type { SleepView } from '@/lib/gym/data';
import type { SleepNorm } from '@/lib/gym/norms';
import { BUTTON, ErrorLine, INPUT, useGymAction } from './ui';

/**
 * Сон: две недели столбиками с полосой нормы и ночь руками. Загрузка файла
 * из Zepp Life с 1.55 — в настройках → подключения, рядом с часами.
 *
 * Норма — полосой по возрасту, черта «невыспался» — на семи часах: ниже неё
 * столбик красный, выше нормы с запасом — янтарный, в норме — синий.
 */

const clockFormat = (locale: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Zurich' });

export function SleepChart({ nights, days, norm, locale }: { nights: SleepView[]; days: string[]; norm: SleepNorm; locale: string }) {
  const top = 12;
  const y = (h: number) => 100 - (Math.min(top, h) / top) * 100;
  const short = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' });
  return (
    <div className="relative h-44 w-full">
      {/* Полоса нормы и черта семи часов. */}
      <div className="absolute inset-x-0 bg-win/10" style={{ top: `${y(norm.high)}%`, height: `${y(norm.low) - y(norm.high)}%` }} />
      <div className="absolute inset-x-0 border-t-2 border-dashed border-loss/50" style={{ top: `${y(norm.short)}%` }} />
      <ol className="absolute inset-0 flex items-end gap-1 px-0.5">
        {days.map((d) => {
          const n = nights.find((x) => x.night === d);
          const h = n ? n.minutes / 60 : 0;
          const color = !n ? '' : h < norm.short ? 'bg-loss/75' : h > norm.long ? 'bg-amber/75' : 'bg-accent/75';
          return (
            <li key={d} className="flex h-full flex-1 flex-col justify-end" title={n ? `${(h).toFixed(1)} h` : ''}>
              <span className={`block w-full rounded-t-[4px] ${color}`} style={{ height: n ? `${100 - y(h)}%` : '0%' }} />
              <span className="mt-0.5 text-center text-[0.6rem] text-ink-muted">{short.format(new Date(`${d}T12:00:00Z`))}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Фазы ночи полоской (1.55): глубокий — чернилами, быстрый — акцентом,
 * остальное — лёгкий. Только у ночей с часов; цифры — в подсказке и для
 * скринридера, на экране хватает полоски.
 */
function Phases({ night }: { night: SleepView }) {
  const t = useTranslations('gym');
  const locale = useLocale();
  if (night.deep === null || night.rem === null || night.minutes <= 0) return null;
  const share = (m: number) => `${Math.max(0, Math.min(100, (m / night.minutes) * 100))}%`;
  const hours = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const label = t('sleep.phases.label', { deep: hours.format(night.deep / 60), rem: hours.format(night.rem / 60) });
  return (
    <span role="img" aria-label={label} title={label} className="flex h-2 w-20 overflow-hidden rounded-full bg-accent/25">
      <span className="h-full bg-ink" style={{ width: share(night.deep) }} />
      <span className="h-full bg-accent" style={{ width: share(night.rem) }} />
    </span>
  );
}

export function SleepLog({ nights, today, editable }: { nights: SleepView[]; today: string; editable: boolean }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const { run, pending, error } = useGymAction();
  const staged = nights.some((n) => n.deep !== null && n.rem !== null);
  const time = clockFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const hours = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  return (
    <div className="flex flex-col gap-6">
      {editable ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void run(addSleep, { night: String(data.get('night') ?? today), bed: String(data.get('bed') ?? ''), wake: String(data.get('wake') ?? '') });
          }}
        >
          <div className="w-44">
            <DayField name="night" label={t('sleep.night')} value={today} />
          </div>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t('sleep.bed')}
            <input name="bed" type="time" defaultValue="23:30" required className={`${INPUT} w-28`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {t('sleep.wake')}
            <input name="wake" type="time" defaultValue="07:30" required className={`${INPUT} w-28`} />
          </label>
          <button type="submit" disabled={pending} className={BUTTON}>
            {t('sleep.add')}
          </button>
        </form>
      ) : null}
      <ErrorLine message={error} />

      {nights.length === 0 ? <p className="text-sm text-ink-muted">{t('sleep.empty')}</p> : null}
      {staged ? (
        <p className="-mb-4 flex items-center gap-3 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ink" />
            {t('sleep.phases.deep')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
            {t('sleep.phases.rem')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent/25" />
            {t('sleep.phases.light')}
          </span>
        </p>
      ) : null}
      <ul className="flex flex-col divide-y divide-rule-soft">
        {nights.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-[8rem] text-sm text-ink">{date.format(new Date(`${n.night}T12:00:00Z`)).toLowerCase()}</span>
            <span className="text-sm tabular-nums text-ink-muted">
              {time.format(n.bedAt)} — {time.format(n.wakeAt)}
            </span>
            <span className="text-sm font-semibold tabular-nums text-ink">{t('sleep.hours', { hours: hours.format(n.minutes / 60) })}</span>
            <Phases night={n} />
            <span className="ps-label">{t(`sleep.sources.${n.source === 'zepp' || n.source === 'csv' || n.source === 'health' ? n.source : 'manual'}`)}</span>
            {editable ? (
              <button type="button" aria-label={t('sleep.remove')} onClick={() => void run(removeSleep, { id: n.id })} className="text-ink-faint hover:text-loss">
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>

    </div>
  );
}
