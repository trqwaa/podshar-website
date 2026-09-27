'use client';

import { useState } from 'react';

/**
 * Пояснение под значком «i».
 *
 * Подсказки хороши ровно один раз — когда человек видит блок впервые. Дальше
 * они мозолят глаза каждый заход и занимают строку, из-за которой блок кажется
 * тяжелее, чем он есть. Владелец сказал про это прямо: «можно было просто
 * добавить что-то типа i и туда закинуть».
 *
 * Поэтому текст свёрнут и разворачивается по нажатию. Скринридеру он доступен
 * всегда — кнопка честно говорит, что раскрывает, и текст лежит в разметке, а
 * не подставляется скриптом.
 */
export function Hint({ children, label }: { children: React.ReactNode; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-label={label}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 text-[0.6875rem] font-medium leading-none transition-colors duration-drape ease-drape ${
          open ? 'border-ink bg-ink text-canvas' : 'border-rule text-ink-faint hover:border-ink hover:text-ink'
        }`}
      >
        <span aria-hidden="true">i</span>
      </button>

      {open ? <span className="text-sm leading-relaxed text-ink-muted">{children}</span> : null}
    </span>
  );
}
