'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/i18n/routing';
import { MUSCLES, type Muscle } from '@/lib/gym/exercises';
import { ExercisePicker, MuscleChips, searchExercises } from './ExercisePicker';
import { INPUT } from './styles';

/** Рекорд, готовый к показу: строки собрал сервер — даты по Цюриху, числа по языку. */
export type RecordCard = {
  exercise: string;
  name: string;
  /** Главная цифра крупно: «≈ 117 кг на раз», «25 повторов», «2:30». */
  main: string;
  lines: { label: string; value: string }[];
  when: string;
  fresh: boolean;
  sets: string;
  /** Короткая метка в списке упражнений: «100 × 5». */
  badge: string;
};

/** Сколько рекордов видно сразу; остальные — по кнопке. */
const SHOWN = 6;

/**
 * Рекорды как в Strong: по каждому упражнению — лучший подход, самый тяжёлый
 * вес и объём за подход. Сверху самое тяжёлое по оценке максимума; первые
 * три — в рамке: это и есть «что ты сделал жёстче всего».
 */
function Records({ records }: { records: RecordCard[] }) {
  const t = useTranslations('gym');
  const [all, setAll] = useState(false);
  const shown = all ? records : records.slice(0, SHOWN);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-lg font-semibold text-ink">{t('records.title')}</h3>
        <p className="ps-label">{t('records.hint')}</p>
      </div>
      {records.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('records.empty')}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((r, i) => (
            <li key={r.exercise} className={`flex min-w-0 flex-col gap-1 rounded-[10px] border-2 p-3 ${i < 3 ? 'border-ink' : 'border-rule-soft'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold text-ink">{r.name}</span>
                {r.fresh ? <span className="shrink-0 rounded bg-amber/15 px-1.5 py-0.5 text-[0.7rem] font-bold text-amber">{t('records.fresh')}</span> : null}
              </div>
              <p className="text-xl font-bold tabular-nums text-ink">{r.main}</p>
              <dl className="flex flex-col gap-0.5 text-sm">
                {r.lines.map((line) => (
                  <div key={line.label} className="flex justify-between gap-2">
                    <dt className="text-ink-muted">{line.label}</dt>
                    <dd className="tabular-nums text-ink">{line.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="ps-label">
                {r.when} · {r.sets}
              </p>
            </li>
          ))}
        </ul>
      )}
      {records.length > SHOWN ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="ps-label self-start hover:text-ink hover:underline">
          {all ? t('records.less') : t('records.all', { n: records.length })}
        </button>
      ) : null}
    </section>
  );
}

/**
 * Все упражнения списком по мышцам — весь каталог Strong. Нажал — мопс
 * показывает технику сбоку и спереди. Сверху — рекорды того, чей дневник
 * открыт, а у упражнения с рекордом в списке — его лучший подход.
 *
 * Двести с лишним анимированных мопсов на одной странице — это DOM на
 * десятки тысяч узлов, даже если анимация спит. Поэтому здесь список, а мопс
 * — в окне по нажатию, как в самом Strong.
 */
export function ExerciseLibrary({ records }: { records: RecordCard[] }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => searchExercises(query, muscle), [query, muscle]);
  const groups = MUSCLES.map((m) => ({ muscle: m, items: list.filter((e) => e.muscle === m) })).filter((g) => g.items.length);
  const badges = useMemo(() => new Map(records.map((r) => [r.exercise, r.badge])), [records]);

  return (
    <div className="flex flex-col gap-3">
      <Records records={records} />
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('picker.search')} aria-label={t('picker.search')} className={INPUT} />
      <MuscleChips muscle={muscle} onChange={setMuscle} />
      <p className="ps-label">{t('picker.count', { n: list.length })}</p>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <section key={g.muscle}>
            <h3 className="ps-label mb-1 font-semibold !text-ink">
              {t(`muscles.${g.muscle}`)} · {g.items.length}
            </h3>
            <ul className="flex flex-col divide-y divide-rule-soft">
              {g.items.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setOpen(e.id)} className="flex w-full items-baseline justify-between gap-3 py-2 text-left text-sm hover:text-accent">
                    <span className="text-ink">{e.name[locale]}</span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      {badges.has(e.id) ? <span className="text-xs font-semibold tabular-nums text-amber">{badges.get(e.id)}</span> : null}
                      <span className="ps-label">{t(`gear.${e.gear}`)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {list.length === 0 ? <p className="text-sm text-ink-muted">{t('picker.nothing')}</p> : null}
      {open ? <ExercisePicker initial={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
