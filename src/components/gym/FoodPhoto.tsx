'use client';

import { useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/i18n/routing';
import { addFoods } from '@/lib/gym/actions';
import { estimateMeal } from '@/lib/gym/food-photo-actions';
import type { PhotoItem } from '@/lib/gym/food-photo';
import { BUTTON, GHOST, SMALL_INPUT } from './styles';
import { ErrorLine, parseNumber, useGymAction } from './ui';

/**
 * Еда по фото: снял тарелку — мопс прикинул, что на ней и сколько.
 *
 * Снимок сжимается в браузере до 1024 px по длинной стороне: с телефона
 * приходят мегабайты, а модели для тарелки хватает и этого, и запрос
 * укладывается в лимит тела серверного действия. Граммы можно поправить до
 * записи — КБЖУ пересчитываются пропорционально; лишнее снимается галочкой.
 */

async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1] ?? '';
}

type Row = PhotoItem & { keep: boolean; base: number };

function scaled(row: Row) {
  const k = row.base > 0 ? row.grams / row.base : 1;
  const r = (v: number) => Math.round(v * k);
  return { kcal: r(row.kcal), protein: r(row.protein), fat: r(row.fat), carbs: r(row.carbs), fiber: r(row.fiber), sugar: r(row.sugar) };
}

export function FoodPhoto({ day, meal, onDone }: { day: string; meal: string; onDone: () => void }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const input = useRef<HTMLInputElement | null>(null);
  const [looking, start] = useTransition();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { run, pending, error } = useGymAction();

  const pick = (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setRows(null);
    start(async () => {
      try {
        const image = await shrink(file);
        const result = await estimateMeal({ image, mediaType: 'image/jpeg', locale });
        if (result.error) setProblem(result.error);
        else setRows((result.items ?? []).map((item) => ({ ...item, keep: true, base: item.grams })));
      } catch {
        setProblem('photoUnreadable');
      }
      if (input.current) input.current.value = '';
    });
  };

  const kept = rows?.filter((r) => r.keep) ?? [];
  const total = kept.reduce((s, r) => s + scaled(r).kcal, 0);

  return (
    <div className="flex flex-col gap-2">
      <label className={`${GHOST} inline-flex w-fit cursor-pointer items-center gap-1.5`}>
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 5h2.2l1.2-1.8h4.2L11.3 5h2.2v7.6h-11z" />
          <circle cx="8" cy="8.6" r="2.3" />
        </svg>
        {looking ? t('food.photoLooking') : t('food.photo')}
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={looking}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>
      {!rows && !looking ? <p className="text-xs text-ink-muted">{t('food.photoHint')}</p> : null}
      {problem ? (
        <p role="status" className="text-sm font-medium text-loss">
          {t.has(`errors.${problem}`) ? t(`errors.${problem}`) : t('errors.generic')}
        </p>
      ) : null}

      {rows ? (
        <div className="flex flex-col gap-1.5 rounded-[10px] border-2 border-dashed border-rule p-2.5">
          <p className="text-xs text-ink-muted">{t('food.photoEstimate')}</p>
          <ul className="flex flex-col gap-1.5">
            {rows.map((row, i) => {
              const v = scaled(row);
              return (
                <li key={i} className={`flex flex-wrap items-center gap-2 ${row.keep ? '' : 'opacity-40'}`}>
                  <input
                    type="checkbox"
                    checked={row.keep}
                    aria-label={row.name}
                    onChange={() => setRows((all) => all?.map((r, j) => (j === i ? { ...r, keep: !r.keep } : r)) ?? null)}
                    className="h-4 w-4 accent-ink"
                  />
                  <span className="min-w-[7rem] flex-1 text-sm text-ink">
                    {row.name}
                    {row.fast_food ? <span className="ml-1.5 text-xs font-bold text-loss">{t('food.junk')}</span> : null}
                  </span>
                  <label className="flex items-center gap-1 text-xs text-ink-muted">
                    <input
                      defaultValue={row.grams}
                      inputMode="decimal"
                      aria-label={`${row.name}, ${t('food.grams')}`}
                      className={`${SMALL_INPUT} w-16`}
                      onBlur={(e) => {
                        const grams = parseNumber(e.target.value);
                        if (grams && grams > 0) setRows((all) => all?.map((r, j) => (j === i ? { ...r, grams } : r)) ?? null);
                      }}
                    />
                    {t('food.grams')}
                  </label>
                  <span className="w-full pl-6 text-xs tabular-nums text-ink-muted sm:w-auto sm:pl-0">
                    ≈ {v.kcal} {t('food.kcal')} · {t('food.protein')} {v.protein} · {t('food.fat')} {v.fat} · {t('food.carbs')} {v.carbs} · {t('food.fiber')} {v.fiber}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || kept.length === 0}
              className={BUTTON}
              onClick={async () => {
                const result = await run(addFoods, {
                  day,
                  meal,
                  items: kept.map((r) => ({ name: r.name, grams: r.grams, junk: r.fast_food, ...scaled(r) }))
                });
                if (result.ok) {
                  setRows(null);
                  onDone();
                }
              }}
            >
              {t('food.photoAdd', { kcal: total })}
            </button>
            <button type="button" className={GHOST} onClick={() => setRows(null)}>
              ←
            </button>
          </div>
          <ErrorLine message={error} />
        </div>
      ) : null}
    </div>
  );
}
