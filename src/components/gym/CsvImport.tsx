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

  return (
    <section className="rounded-[10px] border-2 border-rule-soft p-4">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{hint}</p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setResult(null);
          const answer = await run(action, new FormData(e.currentTarget));
          if (answer.ok) {
            setResult(done(answer));
            if (file.current) file.current.value = '';
          }
        }}
      >
        <input
          ref={file}
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="min-w-0 max-w-full text-sm text-ink file:mr-3 file:rounded file:border-2 file:border-rule file:bg-canvas file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink"
        />
        <button type="submit" disabled={pending} className={GHOST}>
          {button}
        </button>
      </form>
      {result ? <p className="mt-2 text-sm font-medium text-win">{result}</p> : null}
      <ErrorLine message={error} />
    </section>
  );
}
