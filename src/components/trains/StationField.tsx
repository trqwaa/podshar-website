'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { ClockIcon, CrossIcon } from '@/components/Icons';
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

/**
 * Спрятанные подсказки — в браузере, а не в базе.
 *
 * Это удобство одного человека на одном устройстве: «не предлагай мне вокзал,
 * которым я не езжу». Заводить ради него таблицу на общей базе было бы
 * несоразмерно, а потерять список не страшно — он соберётся заново сам.
 * Чтение и запись в `try`, потому что приватное окно и закрытые куки оба умеют
 * бросать отсюда исключение.
 */
const HIDDEN_KEY = 'podshar.trains.hidden';

function readHidden(): string[] {
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function StationField({
  name,
  label,
  station,
  onPick,
  bare = false,
  suggest
}: {
  /** Имя скрытого поля с номером станции. Видимое поле имени не имеет: в форму оно не едет. */
  name: string;
  label: string;
  station: Station | null;
  /** Вызывается, когда станция выбрана или очищена, — форме это нужно для перевёртыша. */
  onPick?: (station: Station | null) => void;
  /**
   * Без коробки: крупный текст на волосяной линии.
   *
   * В поиске поле стоит на конце нарисованного маршрута, и рамка вокруг него
   * превращала бы рисунок обратно в форму. В настройках и на табло поле
   * остаётся обычным: там оно одно и ему нужны края.
   */
  bare?: boolean;
  /**
   * Что предложить до того, как человек начал печатать.
   *
   * Свои станции: дом, концы сохранённых дорог, станции остальных. Пустое поле,
   * которое молчит, пока не наберёшь две буквы, заставляет вспоминать точное
   * название — а девять поездок из десяти идут по тем же четырём станциям.
   */
  suggest?: Station[];
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
  const [hidden, setHidden] = useState<string[]>([]);

  // Читается после монтирования: на сервере `localStorage` не существует, а
  // разметка до первого нажатия всё равно одинаковая.
  useEffect(() => setHidden(readHidden()), []);

  function hide(id: string) {
    setHidden((was) => {
      const next = was.includes(id) ? was : [...was, id];
      try {
        window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      } catch {
        // Приватное окно: спрятали на сессию, и это лучше, чем уронить поле.
      }
      return next;
    });
  }

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
    const list = typing ? found : mine;
    if (!list.length) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setCursor((was) => (was + step + list.length) % list.length);
      return;
    }
    if (event.key === 'Enter' && cursor >= 0) {
      event.preventDefault();
      pick(list[cursor]);
    }
  }

  // Пока не набрано двух букв — показываем свои станции, дальше уже найденные.
  const typing = text.trim().length >= MIN_CHARS && text !== station?.name;
  const mine = (suggest ?? []).filter((one) => !hidden.includes(one.id));
  const options = typing ? found : mine;
  const showing = open && (options.length > 0 || (typing && asking));

  return (
    <div ref={box} className="relative flex min-w-0 flex-1 flex-col gap-1">
      <label className={`ps-label ${bare ? 'text-ink-faint' : ''}`} htmlFor={`${listId}-input`}>
        {label}
      </label>

      <input type="hidden" name={name} value={id} />

      <input
        id={`${listId}-input`}
        // 16px на телефоне: меньше — и айфон зумит страницу при тапе.
        className={
          bare
            ? 'w-full border-b-2 border-rule bg-transparent pb-1 text-[1.0625rem] font-medium text-ink outline-none ps-press focus:border-ink sm:text-lg placeholder:font-normal placeholder:text-ink-faint'
            : 'h-11 w-full rounded border-2 border-rule bg-canvas px-3 text-[1rem] text-ink outline-none ps-press focus:border-ink sm:text-base placeholder:text-ink-faint'
        }
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
          className="animate-pop-in absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-block border-2 border-ink bg-canvas"
        >
          {/* Заголовок только у своих: он объясняет, откуда взялся список,
              который появился раньше, чем человек что-то набрал. */}
          {!typing && options.length ? (
            <li className="ps-label border-b-2 border-rule-soft px-4 py-2.5 text-ink-faint">
              {t('yourStations')}
            </li>
          ) : null}

          {options.length === 0 ? (
            <li className="px-4 py-3 text-base text-ink-faint">{t('looking')}</li>
          ) : (
            options.map((choice, index) => (
              <li
                key={choice.id}
                id={`${optionId}-${index}`}
                role="option"
                aria-selected={index === cursor}
                className={`group flex items-center border-b border-rule-soft last:border-b-0 ps-press ${
                  index === cursor ? 'bg-sunk' : 'hover:bg-sunk'
                }`}
              >
                <button
                  type="button"
                  // `onPointerDown`, а не `onClick`: клик приходит уже после
                  // того, как поле потеряло фокус и список закрылся.
                  onPointerDown={(event) => {
                    event.preventDefault();
                    pick(choice);
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                    index === cursor ? 'text-ink' : 'text-ink-muted'
                  }`}
                >
                  <ClockIcon className="h-4 w-4 shrink-0 text-ink-faint" />
                  <span className="truncate">{choice.name}</span>
                </button>

                {/* Крестик только у своих: найденное в SBB прятать бессмысленно,
                    оно и так исчезнет со следующей буквой. */}
                {!typing ? (
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      hide(choice.id);
                    }}
                    aria-label={t('hideStation')}
                    title={t('hideStation')}
                    className="me-2 grid h-8 w-8 shrink-0 place-items-center text-ink-faint opacity-0 ps-press hover:text-loss focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <CrossIcon className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
