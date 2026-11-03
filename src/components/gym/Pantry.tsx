'use client';

import { useEffect, useId, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';

import { Modal } from '@/components/Modal';
import { removeFoods } from '@/lib/gym/actions';
import type { Face } from '@/lib/gym/critic';
import { dropFromPantry, eatFromPantry, scanToPantry } from '@/lib/gym/food-actions';
import { gradeColor, type Grade, type Tier } from '@/lib/gym/grade';
import type { PantryItem } from '@/lib/gym/pantry';
import { Camera } from './BarcodeScanner';
import { MealSwitch, type Meal } from './MealSwitch';
import { PugFace } from './PugFace';
import { BUTTON, CHIP, CHIP_OFF, CHIP_ON, INPUT } from './styles';
import { parseNumber } from './ui';

/**
 * Кладовка (1.54, решение владельца от 3 ноября 2026): всё, что пикнул
 * сканером, — с фото пачки, КБЖУ и оценкой от 1 до 100. Отсюда продукт
 * ложится в приём пищи кнопкой: на айфоне перетаскивание спорит с прокруткой,
 * и владелец сам сказал «по кнопке».
 *
 * На телефоне вход — красная кнопка внизу экрана; на компьютере кладовка
 * просто стоит в колонке справа: сканировать с ноутбука незачем, «просто
 * глянуть». Красный — свой токен `--laser`, луч кассового сканера, а не
 * реактор.
 *
 * Оценку говорит мопс — мордой и словами, без мата: так попросил владелец.
 */

const FACE: Record<Tier, Face> = { trash: 'sick', bad: 'angry', mid: 'meh', good: 'happy', god: 'proud' };

type View = { at: 'list' } | { at: 'scan' } | { at: 'item'; code: string };

const unitOf = (item: PantryItem) => (item.kind === 'drink' || item.kind === 'water' ? 'pantry.ml' : 'food.grams');

function BarcodeIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3M7.5 8v8M10.5 8v8M13.5 8v8M16.5 8v8" />
    </svg>
  );
}

/** Искры вокруг божества: мерцают по очереди, без движения — гаснут вовсе. */
function Sparks({ big }: { big: boolean }) {
  const spots = big
    ? [
        { left: '-8%', top: '6%', delay: '0s' },
        { left: '86%', top: '-6%', delay: '0.7s' },
        { left: '90%', top: '78%', delay: '1.4s' }
      ]
    : [
        { left: '-14%', top: '-6%', delay: '0s' },
        { left: '88%', top: '76%', delay: '1.1s' }
      ];
  return (
    <>
      {spots.map((spot) => (
        <svg
          key={spot.left}
          viewBox="0 0 10 10"
          aria-hidden="true"
          className={`absolute animate-pantry-spark ${big ? 'h-4 w-4' : 'h-2.5 w-2.5'}`}
          style={{ left: spot.left, top: spot.top, animationDelay: spot.delay }}
        >
          <path d="M5 0Q5.7 4.3 10 5Q5.7 5.7 5 10Q4.3 5.7 0 5Q4.3 4.3 5 0Z" fill="rgb(var(--grade-god-a))" />
        </svg>
      ))}
    </>
  );
}

/**
 * Оценка кольцом: дуга — сколько из ста, цвет — по шкале, цифра внутри. От 90
 * — божество: дуга переливается голограммой, цифра на чернильном круге, вокруг
 * искры. Переливание — SMIL и CSS, React покадрово не трогается; без движения
 * голограмма стоит.
 */
function GradeRing({ grade, size }: { grade: Grade; size: 'sm' | 'lg' }) {
  const t = useTranslations('gym');
  const still = useReducedMotion();
  const holo = `holo${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const god = grade.tier === 'god';
  const big = size === 'lg';
  return (
    <span role="img" aria-label={t('grade.label', { n: grade.score })} className={`relative grid shrink-0 place-items-center ${big ? 'h-24 w-24' : 'h-11 w-11'}`}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        {god ? (
          <defs>
            <linearGradient id={holo} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgb(var(--grade-god-a))" />
              <stop offset="0.5" stopColor="rgb(var(--grade-god-b))" />
              <stop offset="1" stopColor="rgb(var(--grade-god-c))" />
              {still ? null : <animateTransform attributeName="gradientTransform" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur="3s" repeatCount="indefinite" />}
            </linearGradient>
          </defs>
        ) : null}
        <circle cx="22" cy="22" r="19" strokeWidth="4" className={god ? 'fill-ink stroke-ink' : 'fill-none stroke-sunk'} />
        <circle
          cx="22"
          cy="22"
          r="19"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${grade.score} 100`}
          style={{ stroke: god ? `url(#${holo})` : gradeColor(grade.score) }}
        />
      </svg>
      <span aria-hidden="true" className={`relative font-bold tabular-nums leading-none ${big ? 'text-[1.6rem]' : 'text-[0.85rem]'} ${god ? 'ps-holo-text' : 'text-ink'}`}>
        {grade.score}
        {big ? <span className="text-sm">%</span> : null}
      </span>
      {god ? <Sparks big={big} /> : null}
    </span>
  );
}

/**
 * Фото пачки — с нашего маршрута, браузер в чужую базу не ходит; месяц лежит
 * в кеше браузера. Нет фото или не загрузилось — первая буква названия.
 */
function ProductPhoto({ item, size }: { item: PantryItem; size: 'sm' | 'lg' }) {
  const [broken, setBroken] = useState(false);
  const big = size === 'lg';
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden border-2 border-rule-soft bg-surface ${big ? 'h-24 w-24 rounded-[20px]' : 'h-14 w-14 rounded-[14px]'}`}>
      {item.image && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- фото с нашего маршрута, next/image тут лишний круг
        <img
          src={`/api/gym/pantry/photo?code=${item.code}`}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setBroken(true)}
          className="pointer-events-none h-full w-full object-contain p-1"
        />
      ) : (
        <span className={`font-bold text-ink-muted ${big ? 'text-3xl' : 'text-lg'}`}>{item.name.slice(0, 1)}</span>
      )}
    </span>
  );
}

function ProductRow({ item, onOpen }: { item: PantryItem; onOpen: () => void }) {
  const t = useTranslations('gym');
  return (
    <button type="button" onClick={onOpen} className="ps-press flex w-full items-center gap-3 rounded-[16px] p-2 text-left transition-colors hover:bg-sunk">
      <ProductPhoto item={item} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 font-semibold leading-snug text-ink">{item.name}</span>
        {/* Калории первыми: марка бывает юридическим именем на полстроки. */}
        <span className="mt-0.5 block truncate text-xs text-ink-muted">
          {Math.round(item.per100.kcal)} {t('food.kcal')} / 100 {t(unitOf(item))}
          {item.brand ? ` · ${item.brand}` : ''}
        </span>
      </span>
      <GradeRing grade={item.grade} size="sm" />
    </button>
  );
}

function ScanButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations('gym');
  return (
    <button
      type="button"
      onClick={onClick}
      className="ps-press inline-flex w-full items-center justify-center gap-2 rounded-full bg-laser px-5 py-3 text-base font-semibold lowercase text-surface transition-opacity hover:opacity-90"
    >
      <BarcodeIcon className="h-5 w-5" />
      {t('pantry.scan')}
    </button>
  );
}

type Saved = { ids: string[]; kcal: number; meal: Meal; gone?: boolean };

/** Карточка продукта: оценка, цифры с этикетки и «записать» — граммы уже вписаны. */
function ProductCard({
  item,
  editable,
  day,
  initialMeal,
  onBack,
  onClose
}: {
  item: PantryItem;
  editable: boolean;
  day: string;
  initialMeal: Meal;
  onBack: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('gym');
  const locale = useLocale();
  const still = useReducedMotion();
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [grams, setGrams] = useState(String(item.grams ?? item.serving ?? 100));
  const [busy, start] = useTransition();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sure, setSure] = useState(false);

  const per = item.per100;
  const unit = t(unitOf(item));
  const amount = parseNumber(grams) ?? 0;
  const k = amount / 100;
  const fmt = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: v < 10 ? 1 : 0 }).format(v);
  const say = (key: string) => (t.has(`errors.${key}`) ? t(`errors.${key}`) : t('errors.generic'));
  const portions = [...new Set([item.serving, 100, item.grams].filter((g): g is number => Boolean(g)).map(Math.round))];
  // Неразрывный пробел: «соль» и её число не разъезжаются по строкам.
  const extra = [
    per.sugar === null ? null : `${t('food.sugar')} ${fmt(per.sugar)}`,
    per.satFat === null ? null : `${t('food.satFat')} ${fmt(per.satFat)}`,
    per.fiber === null ? null : `${t('food.fiber')} ${fmt(per.fiber)}`,
    per.salt === null ? null : `${t('pantry.salt')} ${fmt(per.salt)}`
  ].filter(Boolean);

  const eat = () =>
    start(async () => {
      setProblem(null);
      const result = await eatFromPantry({ code: item.code, meal, day, grams: amount }).catch(() => ({ error: 'generic' }) as { error: string; ids?: undefined; kcal?: undefined });
      if (result.ids) setSaved({ ids: result.ids, kcal: result.kcal ?? 0, meal });
      else setProblem(result.error ?? 'generic');
    });
  const undo = (what: Saved) =>
    start(async () => {
      const result = await removeFoods({ ids: what.ids }).catch(() => ({ ok: false, error: 'generic' }));
      if (result.ok) setSaved({ ...what, gone: true });
      else setProblem(result.error ?? 'generic');
    });
  const drop = () => {
    if (!sure) return setSure(true);
    start(async () => {
      const result = await dropFromPantry({ code: item.code }).catch(() => ({ ok: false, error: 'generic' }));
      if (result.ok) onBack();
      else setProblem(result.error ?? 'generic');
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="ps-label self-start hover:text-ink">
        ← {t('pantry.title')}
      </button>

      <div className="flex items-center gap-4">
        {/* Легло в дневник — пачка подпрыгивает. */}
        <motion.span
          className="shrink-0"
          animate={saved && !saved.gone && !still ? { y: [0, -14, 0], rotate: [0, -7, 0] } : { y: 0, rotate: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <ProductPhoto item={item} size="lg" />
        </motion.span>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug text-ink">{item.name}</h3>
          {item.brand ? <p className="text-sm text-ink-muted">{item.brand}</p> : null}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <GradeRing grade={item.grade} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <PugFace face={FACE[item.grade.tier]} className="h-11 w-11 shrink-0" />
            <p className="rounded-[12px] border-2 border-ink px-3 py-1.5 text-sm font-semibold leading-snug text-ink">{t(`grade.${item.grade.tier}`)}</p>
          </div>
          {item.grade.why.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {item.grade.why.map((why) => (
                <li key={why.key} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${why.good ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss'}`}>
                  {t(`grade.why.${why.key}`, { n: why.n ?? 0 })}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {item.grade.rough ? <p className="-mt-2 text-xs text-ink-muted">{t('grade.rough')}</p> : null}

      <div>
        <p className="ps-label mb-1.5">{t('pantry.per100', { unit })}</p>
        <dl className="grid grid-cols-4 gap-1 rounded-[14px] bg-sunk px-2 py-3 text-center">
          {(
            [
              ['kcal', per.kcal],
              ['protein', per.protein],
              ['fat', per.fat],
              ['carbs', per.carbs]
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="truncate text-[0.7rem] text-ink-muted">{t(`food.${key}`)}</dt>
              <dd className="text-base font-bold tabular-nums text-ink">{key === 'kcal' ? Math.round(value) : fmt(value)}</dd>
            </div>
          ))}
        </dl>
        {extra.length ? <p className="mt-1.5 text-xs tabular-nums text-ink-muted">{extra.join(' · ')}</p> : null}
      </div>

      {editable ? (
        <section aria-label={t('pantry.eat', { meal: t(`food.meals.${meal}`) })} className="flex flex-col gap-3 border-t-2 border-rule-soft pt-4">
          <MealSwitch meal={meal} onPick={setMeal} layout="pantry-meal" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-ink-muted">
              <input value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="decimal" aria-label={unit} className={`${INPUT} w-20 text-center tabular-nums`} />
              {unit}
            </label>
            {portions.map((g) => (
              <button key={g} type="button" onClick={() => setGrams(String(g))} className={`${CHIP} ${amount === g ? CHIP_ON : CHIP_OFF}`}>
                {g === Math.round(item.serving ?? 0) ? t('pantry.serving', { n: g, unit }) : `${g} ${unit}`}
              </button>
            ))}
          </div>
          <p className="text-sm tabular-nums text-ink">
            <span className="font-semibold">
              {Math.round(per.kcal * k)} {t('food.kcal')}
            </span>{' '}
            · {t('food.protein')} {fmt(per.protein * k)} · {t('food.fat')} {fmt(per.fat * k)} · {t('food.carbs')} {fmt(per.carbs * k)}
          </p>

          <AnimatePresence mode="wait" initial={false}>
            {saved ? (
              <motion.div key="saved" initial={still ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
                <div role="status" className={`flex items-baseline justify-between gap-3 rounded-[12px] px-3 py-2 ${saved.gone ? 'bg-sunk' : 'bg-accent/10'}`}>
                  <p className="text-sm font-semibold text-ink">{saved.gone ? t('food.undone') : t('food.quickSaved', { meal: t(`food.meals.${saved.meal}`), kcal: saved.kcal })}</p>
                  {saved.gone ? null : (
                    <button type="button" disabled={busy} onClick={() => undo(saved)} className="ps-label shrink-0 hover:text-loss">
                      {t('food.undo')}
                    </button>
                  )}
                </div>
                <button type="button" onClick={onClose} className={`${BUTTON} w-full py-3 text-base`}>
                  {t('pantry.done')}
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="eat"
                type="button"
                disabled={busy || amount <= 0}
                onClick={eat}
                initial={still ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`${BUTTON} w-full py-3 text-base`}
              >
                {t('pantry.eat', { meal: t(`food.meals.${meal}`) })}
              </motion.button>
            )}
          </AnimatePresence>
          {problem ? (
            <p role="status" className="text-sm font-medium text-loss">
              {say(problem)}
            </p>
          ) : null}
          <button type="button" disabled={busy} onClick={drop} className={`ps-label self-center py-1 ${sure ? 'text-loss' : 'hover:text-loss'}`}>
            {sure ? t('pantry.removeSure') : t('pantry.remove')}
          </button>
        </section>
      ) : null}
    </div>
  );
}

/** Окно кладовки: список, сканер и карточка — одно окно, виды сменяют друг друга. */
function PantryModal({
  items,
  editable,
  day,
  initialMeal,
  first,
  onClose
}: {
  items: PantryItem[];
  editable: boolean;
  day: string;
  initialMeal: Meal;
  first: View;
  onClose: () => void;
}) {
  const t = useTranslations('gym');
  const still = useReducedMotion();
  const [view, setView] = useState<View>(first);
  // Только что пикнутое — пока список со страницы его не догнал.
  const [fresh, setFresh] = useState<PantryItem | null>(null);
  const [looking, setLooking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const say = (key: string) => (t.has(`errors.${key}`) ? t(`errors.${key}`) : t('errors.generic'));

  const found = async (code: string) => {
    setLooking(true);
    const result = await scanToPantry({ code }).catch(() => ({ error: 'generic' }) as { error: string; item?: undefined });
    setLooking(false);
    if (result.item) {
      setFresh(result.item);
      setView({ at: 'item', code: result.item.code });
    } else setProblem(result.error ?? 'generic');
  };
  const shown = view.at === 'item' ? (items.find((i) => i.code === view.code) ?? (fresh?.code === view.code ? fresh : null)) : null;
  const toList = () => setView({ at: 'list' });

  return (
    <Modal title={t('pantry.title')} hint={t('pantry.count', { n: items.length })} close={t('picker.close')} onClose={onClose}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={shown ? shown.code : view.at}
          initial={still ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -16, transition: { duration: 0.12 } }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {shown ? (
            <ProductCard item={shown} editable={editable} day={day} initialMeal={initialMeal} onBack={toList} onClose={onClose} />
          ) : view.at === 'scan' ? (
            <div className="flex flex-col gap-3">
              <button type="button" onClick={toList} className="ps-label self-start hover:text-ink">
                ← {t('pantry.title')}
              </button>
              {problem ? (
                <>
                  <p role="status" className="text-sm font-medium text-loss">
                    {say(problem)}
                  </p>
                  <button type="button" onClick={() => setProblem(null)} className={`${BUTTON} self-start`}>
                    {t('scanner.again')}
                  </button>
                </>
              ) : looking ? (
                <p role="status" className="py-8 text-center text-sm text-ink-muted">
                  {t('scanner.looking')}
                </p>
              ) : (
                <>
                  <Camera onCode={found} onFail={() => setProblem('cameraDenied')} />
                  <p className="text-xs text-ink-muted">{t('scanner.hint')}</p>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {editable ? (
                <ScanButton
                  onClick={() => {
                    setProblem(null);
                    setView({ at: 'scan' });
                  }}
                />
              ) : null}
              {items.length ? (
                <ul className="-mx-2 flex flex-col">
                  {items.map((item) => (
                    <li key={item.code}>
                      <ProductRow item={item} onOpen={() => setView({ at: 'item', code: item.code })} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-relaxed text-ink-muted">{editable ? t('pantry.empty') : t('pantry.emptyTheirs')}</p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}

type Props = { items: PantryItem[]; day: string; initialMeal: Meal };

/**
 * Красная кнопка внизу экрана — вход в кладовку на телефоне. Горит: от неё
 * расходится кольцо — рамкой, а не тенью, теней на сайте нет. Через портал:
 * внутри карточек зала `fixed` считается от карточки.
 */
export function PantryFab({ items, day, initialMeal }: Props) {
  const t = useTranslations('gym');
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return createPortal(
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('pantry.open')}
          className="ps-press pointer-events-auto relative grid h-16 w-16 place-items-center rounded-full bg-laser text-surface"
        >
          <span aria-hidden="true" className="absolute inset-0 animate-pantry-glow rounded-full border-2 border-laser" />
          <BarcodeIcon className="h-7 w-7" />
        </button>
      </div>
      {open ? <PantryModal items={items} editable day={day} initialMeal={initialMeal} first={{ at: 'list' }} onClose={() => setOpen(false)} /> : null}
    </>,
    document.body
  );
}

/**
 * Кладовка на компьютере — в колонке справа, просто глянуть; нажал — карточка
 * с оценкой и «записать». С пальцем вместо мыши (айпад боком) — и «пикнуть».
 */
export function PantryPanel({ items, day, initialMeal, editable }: Props & { editable: boolean }) {
  const t = useTranslations('gym');
  const [open, setOpen] = useState<View | null>(null);
  return (
    <section aria-label={t('pantry.title')} className="hidden flex-col gap-2 lg:flex">
      <div className="flex items-baseline justify-between gap-2">
        <p className="ps-label">{t('pantry.title')}</p>
        {items.length ? <span className="text-xs text-ink-muted">{t('pantry.count', { n: items.length })}</span> : null}
      </div>
      {editable ? (
        <div className="hidden [@media(pointer:coarse)]:block">
          <ScanButton onClick={() => setOpen({ at: 'scan' })} />
        </div>
      ) : null}
      {items.length ? (
        <ul className="scroll-quiet -mx-2 flex max-h-[30rem] flex-col overflow-y-auto overscroll-contain">
          {items.map((item) => (
            <li key={item.code}>
              <ProductRow item={item} onOpen={() => setOpen({ at: 'item', code: item.code })} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed text-ink-muted">{editable ? t('pantry.emptyDesk') : t('pantry.emptyTheirs')}</p>
      )}
      {open ? createPortal(<PantryModal items={items} editable={editable} day={day} initialMeal={initialMeal} first={open} onClose={() => setOpen(null)} />, document.body) : null}
    </section>
  );
}
