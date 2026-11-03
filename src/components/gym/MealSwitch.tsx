'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

/**
 * Приём пищи — переключателем, выбранный подсвечен плашкой, которая переезжает.
 * Плашка своя у каждого переключателя (`layout`): у «что съел?» и у кладовки
 * общая перелетала бы из одного в другой.
 */
export function MealSwitch({ meal, onPick, layout = 'food-meal' }: { meal: Meal; onPick: (meal: Meal) => void; layout?: string }) {
  const t = useTranslations('gym');
  const still = useReducedMotion();
  return (
    <div role="radiogroup" aria-label={t('food.mealPick')} className="grid grid-cols-4 gap-1 rounded-full bg-sunk p-1">
      {MEALS.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={meal === m}
          onClick={() => onPick(m)}
          className="relative rounded-full px-1 py-2 text-[0.8rem] font-semibold lowercase sm:text-sm"
        >
          {meal === m ? (
            <motion.span
              layoutId={layout}
              className="absolute inset-0 rounded-full bg-ink"
              transition={still ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
            />
          ) : null}
          <span className={`relative transition-colors ${meal === m ? 'text-surface' : 'text-ink-muted'}`}>{t(`food.meals.${m}`)}</span>
        </button>
      ))}
    </div>
  );
}
