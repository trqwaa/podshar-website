'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { Station } from '@/lib/types';

/**
 * Поле станции: пишешь три буквы — выбираешь из списка.
 *
 * Заменило поле, куда писали название, а сайт брал первое совпадение и называл
 * найденное вслух. Это работало, пока человек набирал «Oerlikon»; на «Bahnhof»
 * или «Zürich» сайт молча брал не ту станцию, и узнать об этом было неоткуда —
 * поезда показывались настоящие, только чужие.
 *
 * Наружу уходит **номер станции**, а не набранный текст: видимое поле держит
 * имя для человека, скрытое — номер для сервера. Сервер имени из формы всё
 * равно не верит и спрашивает его у SBB заново, но пока номер не выбран,
 * отправлять нечего, и кнопка поиска об этом знает.
 *
 * Запрос на каждую букву бросается на полпути, когда пришла следующая
 * (`AbortController`). Без этого ответы прилетают не в том порядке, в каком их
 * спрашивали, и в списке оседает то, что нашлось по трём буквам, пока человек
 * дописал шесть.
 */

const WAIT_MS = 220;
const MIN_CHARS = 2;

export function StationField({
  name,
  label,
  station,
  onPick
}: {
  /** Имя скрытого поля с номером станции. Видимое поле имени не имеет: в форму оно не едет. */
  name: string;
  label: string;
  station: Station | null;
  /** Вызывается, когда станция выбрана или очищена, — форме это нужно для перевёртыша. */
  onPick?: (station: Station | null) => void;
}) {
  const t = useTranslations('trains');
  const listId = useId();
  const optionId = useId();

  const [text, setText] = useState(station?.name ?? '');
  const [id, setId] = useState(station?.id ?? '');
  const [found, setFound] = useState<Station[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [asking, setAsking] = useState(false);

  const box = useRef<HTMLDivElement>(null);
  // Станцию мог поменять кто-то снаружи — перевёртыш меняет местами оба поля.
  const outside = station ? `${station.id}:${station.name}` : '';
  useEffect(() => {
    setText(station?.name ?? '');
    setId(station?.id ?? '');
    setOpen(false);
  }, [outside]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Уже выбранная станция — не повод искать: текст совпадает с её именем.
    if (!open || text.trim().length < MIN_CHARS || text === station?.name) {
      setFound([]);
      return;
    }

    const stop = new AbortController();
    const timer = setTimeout(async () => {
      setAsking(true);
      try {
        const response = await fetch('/api/sbb', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ q: text }),
          signal: stop.signal
        });
        const data = (await response.json()) as { stations?: Station[] };
        setFound(Array.isArray(data.stations) ? data.stations : []);
        setCursor(-1);
      } catch {
        // Брошенный запрос — это не ошибка, а следующая буква.
        if (!stop.signal.aborted) setFound([]);
      } finally {
        if (!stop.signal.aborted) setAsking(false);
      }
    }, WAIT_MS);

    return () => {
      clearTimeout(timer);
      stop.abort();
    };
  }, [text, open, station?.name]);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  function pick(choice: Station) {
    setText(choice.name);
    setId(choice.id);
    setFound([]);
    setOpen(false);
    setCursor(-1);
    onPick?.(choice);
  }

  function typed(value: string) {
    setText(value);
    setOpen(true);
    // Правка текста снимает выбор: иначе в поле «Bern», а поедет старый номер.
    if (id) {
      setId('');
      onPick?.(null);
    }
  }

  function keys(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!found.length) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setCursor((was) => (was + step + found.length) % found.length);
      return;
    }
    if (event.key === 'Enter' && cursor >= 0) {
      event.preventDefault();
      pick(found[cursor]);
    }
  }

  const showing = open && (found.length > 0 || (asking && text.trim().length >= MIN_CHARS));

  return (
    <div ref={box} className="relative flex min-w-0 flex-1 flex-col gap-1">
      <label className="ps-label" htmlFor={`${listId}-input`}>
        {label}
      </label>

      <input type="hidden" name={name} value={id} />

      <input
        id={`${listId}-input`}
        // 16px на телефоне: меньше — и айфон зумит страницу при тапе.
        className="w-full rounded border-2 border-rule bg-canvas px-3 py-2.5 text-[1rem] text-ink outline-none transition-colors focus:border-ink sm:text-[0.9375rem] placeholder:text-ink-faint"
        value={text}
        onChange={(event) => typed(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={keys}
        placeholder={t('anyStation')}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={cursor >= 0 ? `${optionId}-${cursor}` : undefined}
      />

      {showing ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded border-2 border-ink bg-canvas"
        >
          {found.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-faint">{t('looking')}</li>
          ) : (
            found.map((choice, index) => (
              <li key={choice.id} id={`${optionId}-${index}`} role="option" aria-selected={index === cursor}>
                <button
                  type="button"
                  // `onPointerDown`, а не `onClick`: клик приходит уже после
                  // того, как поле потеряло фокус и список закрылся.
                  onPointerDown={(event) => {
                    event.preventDefault();
                    pick(choice);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                    index === cursor ? 'bg-ink/8 text-ink' : 'text-ink-muted hover:bg-ink/5 hover:text-ink'
                  }`}
                >
                  {choice.name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
