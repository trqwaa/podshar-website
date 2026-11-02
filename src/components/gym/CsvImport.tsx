'use client';

import { useRef, useState } from 'react';

import type { GymResult } from '@/lib/gym/actions';
import { GHOST } from './styles';
import { ErrorLine, useGymAction } from './ui';

/**
 * Загрузка чужой выгрузки: файл, кнопка и строка «загружено …». Как у сна,
 * только общим куском — Strong в истории и FatSecret в питании устроены
 * одинаково, а различаются действием и словами.
 */
export function CsvImport({
  action,
  title,
  hint,
  button,
  done
}: {
  action: (data: FormData) => Promise<GymResult>;
  title: string;
  hint: string;
  button: string;
  done: (result: GymResult) => string;
}) {
  const { run, pending, error } = useGymAction();
  const file = useRef<HTMLInputElement | null>(null);
  const [result, setResult] = useState<string | null>(null);

  // Свёрнуто: загрузка — раз в жизни, а не каждый день, и на телефоне блок
  // отодвигал дневник. Файл уходит сразу, как выбран: второе нажатие
  // «загрузить» было лишним. Системное поле спрятано — оно говорило на языке
  // браузера, а не страницы («Datei auswählen» на русской странице).
  return (
    <details className="group rounded-[12px] bg-sunk px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-ink-muted transition-transform group-open:rotate-180">
          ↓
        </span>
      </summary>
      <p className="mt-2 text-sm text-ink-muted">{hint}</p>
      <form
        className="mt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setResult(null);
          const answer = await run(action, new FormData(e.currentTarget));
          if (answer.ok) setResult(done(answer));
          if (file.current) file.current.value = '';
        }}
      >
        <label className={`${GHOST} inline-flex cursor-pointer items-center gap-2 bg-canvas ${pending ? 'pointer-events-none opacity-40' : ''}`}>
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 10.5V2.5M4.5 6 8 2.5 11.5 6M2.5 10.5v3h11v-3" />
          </svg>
          {button}
          <input
            ref={file}
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="sr-only"
            onChange={(e) => {
              if (e.currentTarget.files?.length) e.currentTarget.form?.requestSubmit();
            }}
          />
        </label>
      </form>
      {result ? <p className="mt-2 text-sm font-medium text-win">{result}</p> : null}
      <ErrorLine message={error} />
    </details>
  );
}
