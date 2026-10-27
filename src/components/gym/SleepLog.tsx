'use client';

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { DayField } from '@/components/calendar/DayField';
import type { Locale } from '@/i18n/routing';
import { addSleep, importSleep, removeSleep } from '@/lib/gym/actions';
import type { SleepView } from '@/lib/gym/data';
import type { SleepNorm } from '@/lib/gym/norms';
import { BUTTON, ErrorLine, GHOST, INPUT, useGymAction } from './ui';

/**
 * Сон: две недели столбиками с полосой нормы, ночь руками и импорт файла.
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

export function SleepLog({ nights, today, editable }: { nights: SleepView[]; today: string; editable: boolean }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const { run, pending, error } = useGymAction();
  const [imported, setImported] = useState<string | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
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
      <ul className="flex flex-col divide-y divide-rule-soft">
        {nights.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-[8rem] text-sm text-ink">{date.format(new Date(`${n.night}T12:00:00Z`)).toLowerCase()}</span>
            <span className="text-sm tabular-nums text-ink-muted">
              {time.format(n.bedAt)} — {time.format(n.wakeAt)}
            </span>
            <span className="text-sm font-semibold tabular-nums text-ink">{t('sleep.hours', { hours: hours.format(n.minutes / 60) })}</span>
            <span className="ps-label">{t(`sleep.sources.${n.source === 'zepp' || n.source === 'csv' ? n.source : 'manual'}`)}</span>
            {editable ? (
              <button type="button" aria-label={t('sleep.remove')} onClick={() => void run(removeSleep, { id: n.id })} className="text-ink-faint hover:text-loss">
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {editable ? (
        <section className="rounded-[10px] border-2 border-rule-soft p-4">
          <h3 className="font-semibold text-ink">{t('sleep.import.title')}</h3>
          <p className="mt-1 text-sm text-ink-muted">{t('sleep.import.hint')}</p>
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setImported(null);
              const data = new FormData(e.currentTarget);
              const result = await run(importSleep, data);
              if (result.ok) {
                setImported(
                  [t('sleep.import.done', { n: result.count ?? 0 }), result.skipped ? t('sleep.import.skipped', { n: result.skipped }) : null].filter(Boolean).join(' · ')
                );
                if (file.current) file.current.value = '';
              }
            }}
          >
            <input ref={file} name="file" type="file" accept=".csv,text/csv" required className="text-sm text-ink file:mr-3 file:rounded file:border-2 file:border-rule file:bg-canvas file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink" />
            <button type="submit" disabled={pending} className={GHOST}>
              {t('sleep.import.button')}
            </button>
          </form>
          {imported ? <p className="mt-2 text-sm font-medium text-win">{imported}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
