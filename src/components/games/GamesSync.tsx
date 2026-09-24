'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Освежить доску после того, как она уже на экране.
 *
 * Страница рисуется из базы сразу, со вчерашними, может быть, цифрами. Потом
 * отсюда уходит один запрос на синхронизацию — он сходит в OpenDota и Supercell
 * за теми, у кого снимок протух, — и по ответу страница перечитывает себя без
 * перезагрузки. Это ровно тот порядок, который правило проекта и требует:
 * медленный чужой сервис не держит рендер, а догоняет его.
 *
 * Один раз за визит. `router.refresh` не пересоздаёт этот компонент, поэтому
 * по кругу оно не пойдёт.
 */
export function GamesSync({ working, done }: { working: string; done: string }) {
  const router = useRouter();
  const [state, setState] = useState<'working' | 'done' | 'quiet'>('working');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch('/api/games/sync', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.ok) {
          router.refresh();
          setState('done');
        } else {
          setState('quiet');
        }
      })
      .catch(() => setState('quiet'));
  }, [router]);

  // После обновления строка исчезает: «свежее» под подзаголовком читалось как
  // мусор, а не как новость. Для скринридера оно успевает прозвучать.
  if (state !== 'working')
    return (
      <span className="sr-only" aria-live="polite">
        {state === 'done' ? done : ''}
      </span>
    );
  return (
    <p className="ps-label" aria-live="polite">
      {working}
    </p>
  );
}
