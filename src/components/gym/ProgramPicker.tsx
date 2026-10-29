'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';

import { Modal } from '@/components/Modal';
import type { Locale } from '@/i18n/routing';
import { applyProgram } from '@/lib/gym/actions';
import { exerciseOf } from '@/lib/gym/exercises';
import { PROGRAMS } from '@/lib/gym/programs';
import { BUTTON } from './styles';
import { ErrorLine, useGymAction } from './ui';

/**
 * Готовые программы: выбрал — доска перерисована (`programs.ts`).
 *
 * У каждой — сколько дней в неделю и какие, а состав — по «что внутри»: семь
 * программ с составами разом — это простыня, а выбирают по схеме, не по
 * списку упражнений. Если на доске уже что-то есть, первое нажатие спрашивает
 * — программа стирает план целиком, и стёртое не вернуть.
 *
 * В `document.body`: доска въезжает анимацией, и `fixed` внутри неё открылся бы
 * внутри доски.
 */
export function ProgramPicker({ names, filled, onClose, onDone }: { names: string[]; filled: boolean; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const { run, pending, error } = useGymAction();
  const [open, setOpen] = useState<string | null>(null);
  const [sure, setSure] = useState<string | null>(null);

  return createPortal(
    <Modal title={t('board.programsTitle')} hint={t('board.programsHint')} close={t('picker.close')} onClose={onClose}>
      <ul className="flex flex-col gap-2">
        {PROGRAMS.map((p) => {
          const weekdays = new Set(p.days.map((d) => d.weekday));
          const expanded = open === p.id;
          return (
            <li key={p.id} className="rounded-[10px] border-2 border-rule p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-ink">{p.name[locale]}</h3>
                  <p className="text-sm text-ink-muted">{p.about[locale]}</p>
                </div>
                <span className="ps-label shrink-0 pt-1">{t('board.programDays', { n: weekdays.size })}</span>
              </div>
              {/* Неделя: занятые дни тёмные. */}
              <ol className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">
                {names.map((day, i) => (
                  <li key={day} className={`rounded-[6px] py-1 text-center text-xs font-semibold ${weekdays.has(i) ? 'bg-ink text-surface' : 'bg-sunk text-ink-faint'}`}>
                    {day}
                  </li>
                ))}
              </ol>
              {expanded ? (
                <div className="mt-3 flex flex-col gap-2">
                  {[...p.days]
                    .sort((a, b) => a.weekday - b.weekday)
                    .map((d) => (
                      <div key={d.weekday}>
                        <p className="ps-label">{names[d.weekday]}</p>
                        <p className="text-sm text-ink">{d.items.map((i) => `${exerciseOf(i.exercise)?.name[locale] ?? i.exercise} ${i.sets}×${i.reps}`).join(' · ')}</p>
                      </div>
                    ))}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={pending}
                  className={`${BUTTON} ${sure === p.id ? '!border-loss !bg-loss' : ''}`}
                  onClick={async () => {
                    if (filled && sure !== p.id) {
                      setSure(p.id);
                      return;
                    }
                    const result = await run(applyProgram, { program: p.id });
                    if (result.ok) onDone();
                  }}
                >
                  {sure === p.id ? t('board.programSure') : t('board.programApply')}
                </button>
                <button type="button" aria-expanded={expanded} className="ps-label hover:text-ink hover:underline" onClick={() => setOpen(expanded ? null : p.id)}>
                  {expanded ? t('board.programHide') : t('board.programShow')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <ErrorLine message={error} />
    </Modal>,
    document.body
  );
}
