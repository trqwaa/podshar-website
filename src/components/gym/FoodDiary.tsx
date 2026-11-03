'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';

import type { Locale } from '@/i18n/routing';
import { addFood, hideRecent, importFatsecret, removeFood, removeFoods } from '@/lib/gym/actions';
import type { FoodView } from '@/lib/gym/data';
import { logMeal } from '@/lib/gym/food-actions';
import type { MealItem } from '@/lib/gym/food-estimate';
import { foodOf, macrosFor, recentKey, searchFoods, type Food } from '@/lib/gym/foods';
import type { Targets } from '@/lib/gym/norms';
import { CsvImport } from './CsvImport';
import { FoodPhoto } from './FoodPhoto';
import { MEALS, MealSwitch, type Meal } from './MealSwitch';
import { BUTTON, CHIP, CHIP_OFF, ErrorLine, GHOST, INPUT, parseNumber, useGymAction } from './ui';

/**
 * Дневник питания: сверху — «что съел?», ниже — сколько набралось против нормы
 * и четыре приёма пищи.
 *
 * Главный путь — словами: «два яйца и тост с маслом», Enter — и мопс сам
 * раскладывает на продукты, берёт КБЖУ из справочника, таблиц или сайта
 * производителя и сразу записывает (`logMeal`). Решение владельца от 2 ноября
 * 2026: поиск по справочнику не находил половину того, что едят, а в зале
 * некогда выбирать из списка. Записанное отменяется одной кнопкой.
 *
 * Справочник остался: из него — недавнее в один тап и запасной выбор, когда
 * мопс не на связи. Своя еда с цифрами с упаковки — по ссылке. Упаковки со
 * штрихкодом — в кладовке (`Pantry.tsx`, 1.54), сканер переехал туда.
 */

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
        <span
          className={`block h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${over ? 'bg-loss' : 'bg-accent'}`}
          style={{ width: `${Math.min(100, Math.round(share * 100))}%` }}
        />
      </span>
    </div>
  );
}

/** Своя еда с цифрами с упаковки. */
function CustomForm({ day, meal, onDone }: { day: string; meal: Meal; onDone: () => void }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const { run, pending, error } = useGymAction();
  return (
    <form
      className="flex flex-col gap-2 rounded-[12px] bg-sunk p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const num = (k: string) => parseNumber(String(data.get(k) ?? ''));
        const result = await run(addFood, {
          day,
          meal,
          locale,
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
        if (result.ok) onDone();
      }}
    >
      <input name="name" required maxLength={80} autoFocus placeholder={t('food.name')} aria-label={t('food.name')} className={INPUT} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
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
        <button type="button" className={GHOST} onClick={onDone}>
          {t('food.cancel')}
        </button>
      </div>
      <ErrorLine message={error} />
    </form>
  );
}

/** Продукт из справочника — граммы и запись. Запасной путь, когда мопс не отвечает. */
function Picked({ item, day, meal, onDone }: { item: Food; day: string; meal: Meal; onDone: () => void }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const { run, pending, error } = useGymAction();
  const [grams, setGrams] = useState('');
  const amount = parseNumber(grams) ?? item.portion.grams;
  const preview = macrosFor(item, amount);
  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-sunk p-3">
      <span className="font-semibold text-ink">{item.name[locale]}</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-sm text-ink-muted">
          <input autoFocus value={grams} onChange={(e) => setGrams(e.target.value)} placeholder={String(item.portion.grams)} inputMode="decimal" aria-label={t('food.grams')} className={`${INPUT} w-24`} />
          {t('food.grams')}
        </label>
        {[0.5, 1, 2].map((k) => (
          <button key={k} type="button" onClick={() => setGrams(String(Math.round(item.portion.grams * k)))} className={`${CHIP} ${CHIP_OFF}`}>
            {t('food.portion', { n: k === 0.5 ? '½' : k, unit: t(`food.units.${item.portion.unit}`) })}
          </button>
        ))}
      </div>
      <p className="text-sm tabular-nums text-ink">
        {preview.kcal} {t('food.kcal')} · {t('food.protein')} {preview.protein} · {t('food.fat')} {preview.fat} · {t('food.carbs')} {preview.carbs}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || amount <= 0}
          className={BUTTON}
          onClick={async () => {
            if ((await run(addFood, { day, meal, locale, food: item.id, grams: amount })).ok) onDone();
          }}
        >
          {t('food.add')}
        </button>
        <button type="button" className={GHOST} onClick={onDone}>
          {t('food.cancel')}
        </button>
      </div>
      <ErrorLine message={error} />
    </div>
  );
}

/**
 * Недавнее — в один тап. «Убрать лишнее» включает крестики, и чипы покачиваются,
 * как иконки айфона в режиме правки: тап — продукт ушёл из недавнего. Дневник
 * не трогается (`hideRecent`), съел снова — продукт вернётся сам.
 */
function RecentChips({ recent, day, meal, custom, onCustom }: { recent: FoodView[]; day: string; meal: Meal; custom: boolean; onCustom: () => void }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const still = useReducedMotion();
  const { run, pending, error } = useGymAction();
  const [tidy, setTidy] = useState(false);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const shown = recent.filter((r) => !gone.has(recentKey(r)));
  const editing = tidy && shown.length > 0;
  const hide = (keys: string[], what: string[]) => {
    setGone((g) => new Set([...g, ...what]));
    void run(hideRecent, { keys });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((r, n) => {
            const item = r.food ? foodOf(r.food) : undefined;
            const name = item ? item.name[locale] : r.name;
            return (
              <motion.span
                key={r.id}
                layout={!still}
                exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.6, transition: { duration: 0.18 } }}
                className="inline-flex"
              >
                {editing ? (
                  <button
                    type="button"
                    onClick={() => hide([recentKey(r)], [recentKey(r)])}
                    aria-label={t('food.tidyRemove', { name })}
                    className={`${CHIP} inline-flex animate-chip-wiggle items-center gap-1.5 bg-loss/10 text-loss hover:bg-loss/15`}
                    style={{ animationDelay: `${(n % 3) * -90}ms` }}
                  >
                    {name}
                    <span aria-hidden="true" className="text-base leading-none">
                      ×
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        addFood,
                        item
                          ? { day, meal, locale, food: item.id, grams: r.grams ?? item.portion.grams }
                          : { day, meal, locale, name: r.name, grams: r.grams, kcal: r.kcal, protein: r.protein, fat: r.fat, carbs: r.carbs }
                      )
                    }
                    className={`${CHIP} ${CHIP_OFF}`}
                  >
                    + {name}
                  </button>
                )}
              </motion.span>
            );
          })}
        </AnimatePresence>
        {editing ? (
          <>
            <button type="button" onClick={() => hide(['*'], shown.map(recentKey))} className="ps-label px-1 hover:text-loss hover:underline">
              {t('food.tidyAll')}
            </button>
            <button type="button" onClick={() => setTidy(false)} className="ps-label px-1 text-ink hover:underline">
              {t('food.tidyDone')}
            </button>
          </>
        ) : (
          <>
            {custom ? null : (
              <button type="button" onClick={onCustom} className="ps-label px-1 hover:text-ink hover:underline">
                {t('food.custom')}
              </button>
            )}
            {shown.length ? (
              <button type="button" onClick={() => setTidy(true)} className="ps-label px-1 hover:text-ink hover:underline">
                {t('food.tidy')}
              </button>
            ) : null}
          </>
        )}
      </div>
      <ErrorLine message={error} />
    </>
  );
}

type Saved = { ids: string[]; items: MealItem[]; meal: Meal; gone?: boolean };

/**
 * «Что съел?» — одно поле, Enter. Мопс считает и записывает в выбранный приём
 * пищи; под полем — что легло и «отменить».
 */
function QuickAdd({ day, initialMeal, recent }: { day: string; initialMeal: Meal; recent: FoodView[] }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const still = useReducedMotion();
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [text, setText] = useState('');
  const [busy, start] = useTransition();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [extra, setExtra] = useState<'custom' | Food | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const { run, pending, error } = useGymAction();
  const options = useMemo(() => (offline ? searchFoods(offline, locale, 6) : []), [offline, locale]);

  const say = (key: string) => (t.has(`errors.${key}`) ? t(`errors.${key}`) : t('errors.generic'));

  const send = () => {
    const said = text.trim();
    if (said.length < 2 || busy) return;
    setProblem(null);
    setOffline(null);
    setSaved(null);
    start(async () => {
      const result = await logMeal({ text: said, day, meal, locale }).catch(() => ({ error: 'generic' }) as { error: string; ids?: undefined; items?: undefined });
      if (result.ids && result.items) {
        setSaved({ ids: result.ids, items: result.items, meal });
        setText('');
        return;
      }
      setProblem(result.error ?? 'generic');
      if (result.error === 'foodNoModel') setOffline(said);
    });
  };

  const kcal = saved ? Math.round(saved.items.reduce((s, i) => s + i.kcal, 0)) : 0;

  return (
    <section aria-label={t('food.quickTitle')} className="flex flex-col gap-3 rounded-[16px] border-2 border-ink p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold lowercase text-ink">{t('food.quickTitle')}</h3>
        <FoodPhoto day={day} meal={meal} onDone={() => setSaved(null)} />
      </div>
      <MealSwitch
        meal={meal}
        onPick={(m) => {
          setMeal(m);
          field.current?.focus();
        }}
      />
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          ref={field}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={400}
          enterKeyHint="send"
          autoComplete="off"
          placeholder={t('food.quickPlaceholder')}
          aria-label={t('food.quickTitle')}
          className={`${INPUT} w-full rounded-full py-3 pl-4 pr-14`}
        />
        <button
          type="submit"
          disabled={busy || text.trim().length < 2}
          aria-label={t('food.quickSend')}
          className="ps-press absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-ink text-surface transition-opacity disabled:opacity-30"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      </form>

      <AnimatePresence initial={false} mode="popLayout">
        {busy ? (
          <motion.p
            key="busy"
            role="status"
            initial={still ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-sm text-ink-muted"
          >
            <span className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted motion-reduce:animate-none" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </span>
            {t('food.quickWorking')}
          </motion.p>
        ) : saved ? (
          <motion.div
            key={saved.ids.join()}
            role="status"
            initial={still ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex flex-col gap-1 rounded-[12px] px-3 py-2 ${saved.gone ? 'bg-sunk' : 'bg-accent/10'}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-ink">
                {saved.gone ? t('food.undone') : t('food.quickSaved', { meal: t(`food.meals.${saved.meal}`), kcal })}
              </p>
              {saved.gone ? null : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={async () => {
                    if ((await run(removeFoods, { ids: saved.ids })).ok) setSaved({ ...saved, gone: true });
                  }}
                  className="ps-label shrink-0 hover:text-loss"
                >
                  {t('food.undo')}
                </button>
              )}
            </div>
            {saved.gone ? null : (
              <ul className="text-xs tabular-nums text-ink-muted">
                {saved.items.map((i, n) => (
                  <li key={n}>
                    {i.name} · {Math.round(i.grams)} {t('food.grams')} · {Math.round(i.kcal)} {t('food.kcal')}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {problem ? (
        <p role="status" className="text-sm font-medium text-loss">
          {say(problem)}
        </p>
      ) : null}
      <ErrorLine message={error} />

      {options.length ? (
        <ul className="flex flex-col divide-y divide-rule-soft">
          {options.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => setExtra(f)} className="flex w-full items-baseline justify-between gap-3 py-2 text-left hover:text-accent">
                <span className="text-ink">{f.name[locale]}</span>
                <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                  {f.per100.kcal} {t('food.kcal')} / 100 {t('food.grams')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {extra === 'custom' ? (
        <CustomForm day={day} meal={meal} onDone={() => setExtra(null)} />
      ) : extra ? (
        <Picked item={extra} day={day} meal={meal} onDone={() => setExtra(null)} />
      ) : null}

      {recent.length || !extra ? <RecentChips recent={recent} day={day} meal={meal} custom={Boolean(extra)} onCustom={() => setExtra('custom')} /> : null}
    </section>
  );
}

export function FoodDiary({
  day,
  entries,
  targets,
  recent,
  editable,
  initialMeal
}: {
  day: string;
  entries: FoodView[];
  targets: Targets;
  recent: FoodView[];
  editable: boolean;
  /** Приём пищи по часам Цюриха — считает сервер, чтобы не разойтись при гидратации. */
  initialMeal: Meal;
}) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const still = useReducedMotion();
  const { run, error } = useGymAction();
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
      {editable ? <QuickAdd day={day} initialMeal={initialMeal} recent={recent} /> : null}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Bar label={t('food.kcal')} value={sum.kcal} target={targets.kcal} unit="" />
        <Bar label={t('food.protein')} value={sum.protein} target={targets.protein} unit={t('food.grams')} />
        <Bar label={t('food.fat')} value={sum.fat} target={targets.fat} unit={t('food.grams')} />
        <Bar label={t('food.carbs')} value={sum.carbs} target={targets.carbs} unit={t('food.grams')} />
      </div>
      <p className="-mt-2 text-sm font-medium text-ink">{left >= 0 ? t('food.left', { kcal: num.format(left) }) : t('food.over', { kcal: num.format(-left) })}</p>

      {MEALS.map((meal) => {
        const list = shown.filter((e) => e.meal === meal);
        const kcal = list.reduce((s, e) => s + e.kcal, 0);
        return (
          <section key={meal} className="flex flex-col gap-1.5">
            <header className="flex items-baseline justify-between border-b-2 border-rule-soft pb-1">
              <h3 className="font-semibold lowercase text-ink">{t(`food.meals.${meal}`)}</h3>
              <span className="text-sm tabular-nums text-ink-muted">
                {num.format(kcal)} {t('food.kcal')}
              </span>
            </header>
            {list.length === 0 ? <p className="text-sm text-ink-faint">{t('food.empty')}</p> : null}
            <ul className="flex flex-col gap-1">
              <AnimatePresence initial={false}>
                {list.map((e) => {
                  const item = e.food ? foodOf(e.food) : undefined;
                  return (
                    <motion.li
                      key={e.id}
                      layout={!still}
                      initial={still ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -12 }}
                      className={`flex items-center justify-between gap-3 rounded-[10px] px-2 py-1.5 ${e.junk ? 'bg-loss/5' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-ink">
                          {item ? item.name[locale] : e.name}
                          {e.junk ? <span className="ml-1.5 text-xs font-bold text-loss">{t('food.junk')}</span> : null}
                          {e.estimated ? (
                            <span className="ml-1.5 text-xs text-ink-muted" title={t('food.estimated')}>
                              ≈
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs tabular-nums text-ink-muted">
                          {e.grams ? `${Math.round(e.grams)} ${t('food.grams')} · ` : ''}
                          {t('food.protein')} {num.format(e.protein)} · {t('food.fat')} {num.format(e.fat)} · {t('food.carbs')} {num.format(e.carbs)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-sm font-semibold tabular-nums text-ink">{num.format(e.kcal)}</span>
                        {editable ? (
                          <button
                            type="button"
                            aria-label={t('food.remove')}
                            onClick={() => {
                              setHidden((h) => new Set(h).add(e.id));
                              void run(removeFood, { id: e.id });
                            }}
                            className="grid h-8 w-8 place-items-center rounded-full text-lg text-ink-faint transition-colors hover:bg-loss/10 hover:text-loss"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </section>
        );
      })}

      <details className="rounded-[12px] bg-sunk px-3 py-2">
        <summary className="ps-label cursor-pointer">{t('food.details')}</summary>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <Bar label={t('food.fiber')} value={sum.fiber} target={extras.fiber} unit={t('food.grams')} />
          <Bar label={t('food.sugar')} value={sum.sugar} target={extras.sugar} unit={t('food.grams')} limit />
          <Bar label={t('food.satFat')} value={sum.satFat} target={extras.satFat} unit={t('food.grams')} limit />
          <Bar label={t('food.sodium')} value={sum.sodium} target={extras.sodium} unit={t('food.mg')} limit />
          <Bar label={t('food.cholesterol')} value={sum.cholesterol} target={extras.cholesterol} unit={t('food.mg')} limit />
          <Bar label={t('food.potassium')} value={sum.potassium} target={extras.potassium} unit={t('food.mg')} />
        </div>
      </details>

      <ErrorLine message={error} />
      {editable ? (
        <CsvImport
          action={importFatsecret}
          title={t('fatsecret.title')}
          hint={t('fatsecret.hint')}
          button={t('fatsecret.button')}
          done={(r) => t('fatsecret.done', { n: r.count ?? 0, days: r.days ?? 0 })}
        />
      ) : null}
    </div>
  );
}
