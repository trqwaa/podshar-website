'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/i18n/routing';
import { addFood, removeFood } from '@/lib/gym/actions';
import type { FoodView } from '@/lib/gym/data';
import { foodOf, macrosFor, searchFoods, type Food } from '@/lib/gym/foods';
import type { Targets } from '@/lib/gym/norms';
import { FoodPhoto } from './FoodPhoto';
import { BUTTON, CHIP, ErrorLine, GHOST, INPUT, parseNumber, useGymAction } from './ui';

/**
 * Дневник питания, как в FatSecret: четыре приёма пищи, в каждом — что съел,
 * сверху — сколько набралось против нормы.
 *
 * Добавление — поиском по справочнику на любом из четырёх языков, из
 * недавнего в один тап или своей едой с цифрами с упаковки. Фастфуд
 * помечается сам, и лицо мопса над дневником это замечает.
 */

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type Meal = (typeof MEALS)[number];

function Bar({ label, value, target, unit, limit = false }: { label: string; value: number; target: number; unit: string; limit?: boolean }) {
  const share = target > 0 ? value / target : 0;
  // У норм перебор — это плохо выше 8%, у потолков (сахар, соль) — сразу.
  const over = share > (limit ? 1 : 1.08);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="ps-label">{label}</span>
        <span className="tabular-nums text-ink">
          <span className={over ? 'font-bold text-loss' : 'font-semibold'}>{Math.round(value)}</span>
          <span className="text-ink-muted">
            {' '}
            / {Math.round(target)} {unit}
          </span>
        </span>
      </div>
      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-sunk">
        <span className={`block h-full rounded-full ${over ? 'bg-loss' : 'bg-accent'}`} style={{ width: `${Math.min(100, Math.round(share * 100))}%` }} />
      </span>
    </div>
  );
}

function AddPanel({ meal, day, recent, onDone }: { meal: Meal; day: string; recent: FoodView[]; onDone: () => void }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const { run, pending, error } = useGymAction();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState('');
  const [custom, setCustom] = useState(false);
  const results = useMemo(() => searchFoods(query, locale, 10), [query, locale]);

  const amount = parseNumber(grams) ?? picked?.portion.grams ?? 0;
  const preview = picked ? macrosFor(picked, amount) : null;

  const add = async (input: Record<string, unknown>) => {
    const result = await run(addFood, { day, meal, locale, ...input });
    if (result.ok) onDone();
  };

  if (picked) {
    return (
      <div className="flex flex-col gap-2 rounded-[10px] border-2 border-ink p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-ink">{picked.name[locale]}</span>
          {picked.quality === 'junk' ? <span className="rounded bg-loss/10 px-1.5 py-0.5 text-xs font-bold text-loss">{t('food.junk')}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-ink-muted">
            <input
              autoFocus
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              placeholder={String(picked.portion.grams)}
              inputMode="decimal"
              aria-label={t('food.grams')}
              className={`${INPUT} w-24`}
            />
            {t('food.grams')}
          </label>
          {[0.5, 1, 2].map((k) => (
            <button key={k} type="button" onClick={() => setGrams(String(Math.round(picked.portion.grams * k)))} className={`${CHIP} border-rule text-ink hover:border-ink`}>
              {t('food.portion', { n: k === 0.5 ? '½' : k, unit: t(`food.units.${picked.portion.unit}`) })}
            </button>
          ))}
        </div>
        {preview ? (
          <p className="text-sm tabular-nums text-ink">
            {preview.kcal} {t('food.kcal')} · {t('food.protein')} {preview.protein} · {t('food.fat')} {preview.fat} · {t('food.carbs')} {preview.carbs}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button type="button" disabled={pending || amount <= 0} className={BUTTON} onClick={() => void add({ food: picked.id, grams: amount })}>
            {t('food.add')}
          </button>
          <button type="button" className={GHOST} onClick={() => setPicked(null)}>
            ←
          </button>
        </div>
        <ErrorLine message={error} />
      </div>
    );
  }

  if (custom) {
    return (
      <form
        className="flex flex-col gap-2 rounded-[10px] border-2 border-ink p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const num = (k: string) => parseNumber(String(data.get(k) ?? ''));
          void add({
            name: String(data.get('name') ?? ''),
            grams: num('grams'),
            kcal: num('kcal'),
            protein: num('protein'),
            fat: num('fat'),
            carbs: num('carbs'),
            fiber: num('fiber'),
            sugar: num('sugar'),
            satFat: num('satFat'),
            sodium: num('sodium')
          });
        }}
      >
        <p className="text-xs text-ink-muted">{t('food.customHint')}</p>
        <input name="name" required maxLength={80} autoFocus placeholder={t('food.name')} aria-label={t('food.name')} className={INPUT} />
        <div className="grid grid-cols-5 gap-2">
          {(['grams', 'kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'satFat', 'sodium'] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1 text-[0.7rem] text-ink-muted">
              {k === 'sodium' ? `${t('food.sodium')}, ${t('food.mg')}` : t(`food.${k}`)}
              <input name={k} inputMode="decimal" required={k === 'kcal'} className={`${INPUT} w-full px-2`} />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={BUTTON}>
            {t('food.add')}
          </button>
          <button type="button" className={GHOST} onClick={() => setCustom(false)}>
            ←
          </button>
        </div>
        <ErrorLine message={error} />
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border-2 border-ink p-3">
      <FoodPhoto day={day} meal={meal} onDone={onDone} />
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('food.search')} aria-label={t('food.search')} className={INPUT} />
      {query ? (
        <ul className="flex flex-col divide-y divide-rule-soft">
          {results.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => setPicked(f)} className="flex w-full items-baseline justify-between gap-3 py-2 text-left hover:text-accent">
                <span className="text-ink">
                  {f.name[locale]}
                  {f.quality === 'junk' ? <span className="ml-1.5 text-xs font-bold text-loss">{t('food.junk')}</span> : null}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                  {f.per100.kcal} {t('food.kcal')} / 100 {t('food.grams')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : recent.length ? (
        <div>
          <p className="ps-label">{t('food.recent')}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {recent.map((r) => {
              const item = r.food ? foodOf(r.food) : undefined;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void add(
                        item
                          ? { food: item.id, grams: r.grams ?? item.portion.grams }
                          : { name: r.name, grams: r.grams, kcal: r.kcal, protein: r.protein, fat: r.fat, carbs: r.carbs }
                      )
                    }
                    className={`${CHIP} border-rule text-ink hover:border-ink`}
                  >
                    {item ? item.name[locale] : r.name}
                    {r.grams ? ` · ${Math.round(r.grams)} ${t('food.grams')}` : ''}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <button type="button" onClick={() => setCustom(true)} className="ps-label self-start hover:text-ink hover:underline">
        + {t('food.custom')}
      </button>
      <ErrorLine message={error} />
    </div>
  );
}

export function FoodDiary({
  day,
  entries,
  targets,
  recent,
  editable
}: {
  day: string;
  entries: FoodView[];
  targets: Targets;
  recent: FoodView[];
  editable: boolean;
}) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const { run, error } = useGymAction();
  const [adding, setAdding] = useState<Meal | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const shown = entries.filter((e) => !hidden.has(e.id));
  const sum = shown.reduce(
    (s, e) => ({
      kcal: s.kcal + e.kcal,
      protein: s.protein + e.protein,
      fat: s.fat + e.fat,
      carbs: s.carbs + e.carbs,
      fiber: s.fiber + (e.fiber ?? 0),
      sugar: s.sugar + (e.sugar ?? 0),
      satFat: s.satFat + (e.satFat ?? 0),
      sodium: s.sodium + (e.sodium ?? 0),
      cholesterol: s.cholesterol + (e.cholesterol ?? 0),
      potassium: s.potassium + (e.potassium ?? 0)
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, satFat: 0, sodium: 0, cholesterol: 0, potassium: 0 }
  );
  // Ориентиры, как у FatSecret и ВОЗ: клетчатка — 14 г на 1000 ккал, сахар и
  // насыщенные жиры — не больше 10% калорий, натрий — не больше 2300 мг,
  // холестерин — 300 мг, калий — 3500 мг.
  const extras = {
    fiber: Math.round((targets.kcal / 1000) * 14),
    sugar: Math.round((targets.kcal * 0.1) / 4),
    satFat: Math.round((targets.kcal * 0.1) / 9),
    sodium: 2300,
    cholesterol: 300,
    potassium: 3500
  };
  const left = targets.kcal - sum.kcal;
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Bar label={t('food.kcal')} value={sum.kcal} target={targets.kcal} unit="" />
        <Bar label={t('food.protein')} value={sum.protein} target={targets.protein} unit={t('food.grams')} />
        <Bar label={t('food.fat')} value={sum.fat} target={targets.fat} unit={t('food.grams')} />
        <Bar label={t('food.carbs')} value={sum.carbs} target={targets.carbs} unit={t('food.grams')} />
      </div>
      <p className="text-sm font-medium text-ink">{left >= 0 ? t('food.left', { kcal: num.format(left) }) : t('food.over', { kcal: num.format(-left) })}</p>
      <details className="rounded-[10px] border-2 border-rule-soft px-3 py-2">
        <summary className="ps-label cursor-pointer">{t('food.details')}</summary>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Bar label={t('food.fiber')} value={sum.fiber} target={extras.fiber} unit={t('food.grams')} />
          <Bar label={t('food.sugar')} value={sum.sugar} target={extras.sugar} unit={t('food.grams')} limit />
          <Bar label={t('food.satFat')} value={sum.satFat} target={extras.satFat} unit={t('food.grams')} limit />
          <Bar label={t('food.sodium')} value={sum.sodium} target={extras.sodium} unit={t('food.mg')} limit />
          <Bar label={t('food.cholesterol')} value={sum.cholesterol} target={extras.cholesterol} unit={t('food.mg')} limit />
          <Bar label={t('food.potassium')} value={sum.potassium} target={extras.potassium} unit={t('food.mg')} />
        </div>
        <p className="mt-2 text-xs text-ink-muted">{t('food.detailsHint')}</p>
      </details>

      {MEALS.map((meal) => {
        const list = shown.filter((e) => e.meal === meal);
        const kcal = list.reduce((s, e) => s + e.kcal, 0);
        return (
          <section key={meal} className="flex flex-col gap-2">
            <header className="flex items-baseline justify-between border-b-2 border-rule-soft pb-1">
              <h3 className="font-semibold lowercase text-ink">{t(`food.meals.${meal}`)}</h3>
              <span className="text-sm tabular-nums text-ink-muted">
                {num.format(kcal)} {t('food.kcal')}
              </span>
            </header>
            {list.length === 0 ? <p className="text-sm text-ink-faint">{t('food.empty')}</p> : null}
            <ul className="flex flex-col gap-1">
              {list.map((e) => {
                const item = e.food ? foodOf(e.food) : undefined;
                return (
                  <li key={e.id} className={`flex items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 ${e.junk ? 'bg-loss/5' : ''}`}>
                    <div className="min-w-0">
                      <p className="truncate text-ink">
                        {item ? item.name[locale] : e.name}
                        {e.junk ? <span className="ml-1.5 text-xs font-bold text-loss">{t('food.junk')}</span> : null}
                        {e.estimated ? (
                          <span className="ml-1.5 text-xs text-ink-muted" title={t('food.estimated')}>
                            ≈ {t('food.byPhoto')}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs tabular-nums text-ink-muted">
                        {e.grams ? `${Math.round(e.grams)} ${t('food.grams')} · ` : ''}
                        {t('food.protein')} {num.format(e.protein)} · {t('food.fat')} {num.format(e.fat)} · {t('food.carbs')} {num.format(e.carbs)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-ink">{num.format(e.kcal)}</span>
                      {editable ? (
                        <button
                          type="button"
                          aria-label={t('food.remove')}
                          onClick={() => {
                            setHidden((h) => new Set(h).add(e.id));
                            void run(removeFood, { id: e.id });
                          }}
                          className="text-ink-faint hover:text-loss"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            {editable ? (
              adding === meal ? (
                <AddPanel meal={meal} day={day} recent={recent} onDone={() => setAdding(null)} />
              ) : (
                <button type="button" onClick={() => setAdding(meal)} className={`${GHOST} self-start border-dashed`}>
                  + {t('food.add')}
                </button>
              )
            ) : null}
          </section>
        );
      })}
      <ErrorLine message={error} />
    </div>
  );
}
