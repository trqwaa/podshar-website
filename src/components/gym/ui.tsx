'use client';

import { useCallback, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import type { GymResult } from '@/lib/gym/actions';

/**
 * Общие мелочи интерфейса зала: поля, кнопки и вызов действий с ошибкой.
 *
 * Поля — 16px на телефоне (`text-[1rem]`), как везде на сайте: меньше — и
 * айфон зумит страницу при тапе и оставляет её зумнутой.
 */

export { BUTTON, CHIP, GHOST, INPUT, SMALL_INPUT, TAB } from './styles';

/**
 * Вызвать серверное действие и запомнить ошибку ключом каталога.
 * Возвращает результат, чтобы вызвавший мог сбросить форму на успехе.
 */
export function useGymAction() {
  const t = useTranslations('gym');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    <I,>(action: (input: I) => Promise<GymResult>, input: I): Promise<GymResult> =>
      new Promise((resolve) => {
        start(async () => {
          setError(null);
          const result = await action(input).catch(() => ({ error: 'generic' }) as GymResult);
          if (result.error) setError(result.error);
          resolve(result);
        });
      }),
    []
  );

  const message = error ? (t.has(`errors.${error}`) ? t(`errors.${error}`) : t('errors.generic')) : null;
  return { run, pending, error: message, clear: () => setError(null) };
}

export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="text-sm font-medium text-loss">
      {message}
    </p>
  );
}

/** Число из поля: пусто — null, запятая — точка. */
export function parseNumber(value: string): number | null {
  const clean = value.replace(',', '.').trim();
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}
