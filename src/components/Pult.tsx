'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';

import { usePathname, useRouter } from '@/i18n/routing';
import { ALL_PLACES, type Place } from '@/lib/navigation';
import {
  CalendarIcon,
  ChatIcon,
  CrossIcon,
  GamepadIcon,
  HomeIcon,
  NoteIcon,
  RouteIcon,
  TagIcon,
  UserIcon
} from './Icons';

/**
 * Пульт: весь сайт за кнопкой, на которой написано «не нажимать».
 *
 * Кнопку жмут — главная разлетается, и под ней одна строка ввода и все разделы.
 * Шутка кнопки при этом не теряется: её реплика («серьёзно?», «я предупреждал»)
 * становится первой строкой пульта. Сюжет, который раньше обрывался на
 * «ничего не происходит», получает развязку.
 *
 * Механика — от командных строк вроде Spotlight: одно поле и список, самый
 * короткий путь куда угодно. Своё здесь три вещи:
 *
 *   - строка отвечает, а не только ведёт: справа живой ответ раздела
 *     (`/api/pult`) — когда поезд, что сегодня, сколько на доске;
 *   - ищет по тем же словам, по которым мопс понимает, куда вести
 *     (`navigation.ts`), и прощает раскладку: «gjtplf» — это «поезда»;
 *   - что не нашлось — уходит мопсу последней строкой.
 *
 * Список разделов берётся из `navigation.ts` целиком, поэтому новый раздел
 * появляется здесь сам. Будущие — серым, со словом «скоро», как в шторке.
 *
 * Открывается отовсюду: кнопкой на главной, красной точкой в шапке, клавишей
 * `/` или Ctrl+K. Все пути — событием `podshar:pult` с точкой, из которой
 * разлетаться.
 */

export const PULT_OPEN = 'podshar:pult';
/** Подгрузить ответы заранее: курсор подбирается к кнопке или точке. */
export const PULT_WARM = 'podshar:pult-warm';
/** Передать мопсу набранное. Слушает `RightAIChat`. */
export const PULT_ASK = 'podshar:ask';

export type PultOrigin = {
  /** Центр, из которого раскрывается пульт, в пикселях окна. */
  x: number;
  y: number;
  /** Радиус того, из чего он вылетает: у кнопки — её край, у точки — почти ноль. */
  r?: number;
  /** Реплика кнопки. Нет — просто «пульт». */
  line?: string;
};

export const openPult = (origin: PultOrigin) =>
  window.dispatchEvent(new CustomEvent<PultOrigin>(PULT_OPEN, { detail: origin }));
export const warmPult = () => window.dispatchEvent(new Event(PULT_WARM));

/** Порядок живых разделов, пока ничего не набрано: по тому, что нужно чаще. */
const ORDER = ['trains', 'calendar', 'todos', 'games', 'home', 'patches', 'profile'];
/** Ответы свежие минуту: поезд за это время не успевает уйти незамеченным. */
const FRESH_MS = 60_000;
const EASE = [0.22, 1, 0.36, 1] as const;

const ICONS: Record<string, (p: { className?: string }) => React.ReactElement> = {
  trains: RouteIcon,
  calendar: CalendarIcon,
  todos: NoteIcon,
  games: GamepadIcon,
  home: HomeIcon,
  patches: TagIcon,
  profile: UserIcon
};

// Русская раскладка поверх английской и обратно: набрал «gjtplf», забыв
// переключить, — ищется и «поезда». Украинские і/ї/є стоят там же, где ы/ъ/э.
const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
const SWAP = new Map<string, string>();
for (let i = 0; i < EN.length; i++) {
  SWAP.set(EN[i], RU[i]);
  SWAP.set(RU[i], EN[i]);
}
SWAP.set('і', 's').set('ї', ']').set('є', "'");

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const swapLayout = (s: string) => [...s].map((c) => SWAP.get(c) ?? c).join('');

/** Насколько раздел похож на набранное. 0 — не похож. */
function score(place: Place, label: string, answer: string | undefined, q: string): number {
  const name = norm(label);
  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 80;

  let best = 0;
  const terms = [...place.terms, ...(place.elements ?? []).flatMap((e) => e.terms)];
  for (const raw of terms) {
    const term = norm(raw);
    if (!term) continue;
    // Набираешь начало слова из словаря («пое» → «поезд»)…
    if (q.length >= 2 && term.startsWith(q)) best = Math.max(best, 60);
    // …или набрал целое слово, внутри которого стоит основа («поездов» ⊃ «поезд»).
    else if (term.length >= 3 && q.includes(term)) best = Math.max(best, 55);
  }
  // Поиск по ответу — бесплатный поиск внутрь: «зубной» находит календарь.
  if (answer && q.length >= 3 && norm(answer).includes(q)) best = Math.max(best, 30);
  return best;
}

type Row =
  | { kind: 'place'; place: Place; label: string; answer?: string; here: boolean }
  | { kind: 'soon'; place: Place; label: string }
  | { kind: 'ask'; text: string };

export function Pult() {
  const t = useTranslations('pult');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const [origin, setOrigin] = useState<PultOrigin | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  /**
   * Как пульт уходит. Закрыл сам — схлопывается обратно в ядро, из которого
   * вылетел. Ушёл в раздел — растворяется: схлопываться в кнопку, которой на
   * новой странице нет, значило бы показывать дорогу в никуда.
   */
  const [leaving, setLeaving] = useState<'close' | 'nav'>('close');
  /** Строка, в которую уже пошли: пока грузится страница, она отвечает. */
  const [going, setGoing] = useState<number | null>(null);
  const fetchedAt = useRef(0);
  const inflight = useRef(false);
  const field = useRef<HTMLInputElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const load = useCallback(() => {
    if (inflight.current || Date.now() - fetchedAt.current < FRESH_MS) return;
    inflight.current = true;
    setLoading(true);
    fetch(`/api/pult?locale=${locale}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { answers?: Record<string, string> } | null) => {
        if (body?.answers) {
          setAnswers(body.answers);
          fetchedAt.current = Date.now();
        }
      })
      .catch(() => {})
      .finally(() => {
        inflight.current = false;
        setLoading(false);
      });
  }, [locale]);

  const open = origin !== null;
  const close = useCallback(() => setOrigin(null), []);

  // Все пути открыть — одно событие. Плюс клавиатура: `/` вне полей ввода и
  // Ctrl+K (⌘K) откуда угодно — так открываются такие строки везде, и рука
  // уже знает.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<PultOrigin>).detail;
      returnTo.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setActive(0);
      setGoing(null);
      setLeaving('close');
      setOrigin(detail);
      load();
    };
    const onKey = (e: KeyboardEvent) => {
      if (origin) return;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      const combo = (e.key === 'k' || e.key === 'K' || e.key === 'л' || e.key === 'Л') && (e.metaKey || e.ctrlKey);
      if (combo || (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        // Из красной точки в шапке, если она на экране: всё вылетает из ядра.
        const dot = document.querySelector<HTMLElement>('[data-pult-dot]')?.getBoundingClientRect();
        openPult(
          dot && dot.width
            ? { x: dot.left + dot.width / 2, y: dot.top + dot.height / 2, r: 6 }
            : { x: window.innerWidth / 2, y: window.innerHeight / 3 }
        );
      }
    };
    window.addEventListener(PULT_OPEN, onOpen);
    window.addEventListener(PULT_WARM, load);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(PULT_OPEN, onOpen);
      window.removeEventListener(PULT_WARM, load);
      document.removeEventListener('keydown', onKey);
    };
  }, [origin, load]);

  // Ушли на другую страницу — пульт своё отработал.
  useEffect(() => {
    setLeaving('nav');
    setOrigin(null);
  }, [pathname]);

  // Прокрутка под пультом заперта на `html`, как у окон (`Modal`): на `body`
  // липкая шапка перестаёт липнуть.
  //
  // `useLayoutEffect` и фокус сразу, без задержки. Было `useEffect` и фокус
  // через 30 мс — и первые ~50 мс пульт уже стоял на экране, а клавиши шли
  // мимо него: набравший «/» и сразу «кал» терял первую букву, Esc в этом окне
  // не закрывал. Проверка поймала это через раз — нажимала быстрее человека.
  useLayoutEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const gap = window.innerWidth - root.clientWidth;
    const overflow = root.style.overflow;
    const { paddingRight } = document.body.style;
    root.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    field.current?.focus({ preventScroll: true });
    // Esc — на всём документе, как у окон, а не только в строке: фокус бывает
    // и на крестике, и после щелчка мимо строки, и пульт должен закрываться
    // оттуда тоже.
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('keydown', onEscape);
      root.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      returnTo.current?.focus?.();
    };
  }, [open, close]);

  const rows = useMemo<Row[]>(() => {
    const q = norm(query);
    const live = ALL_PLACES.filter((p) => p.status === 'live');
    const planned = ALL_PLACES.filter((p) => p.status === 'planned');
    const place = (p: Place): Row => ({
      kind: 'place',
      place: p,
      label: tNav(p.labelKey),
      answer: answers?.[p.id],
      here: p.href === pathname
    });

    if (!q) {
      const rank = (p: Place) => {
        const i = ORDER.indexOf(p.id);
        return i < 0 ? ORDER.length : i;
      };
      return [...live].sort((a, b) => rank(a) - rank(b)).map(place);
    }

    const swapped = swapLayout(q);
    const best = (p: Place) => {
      const label = tNav(p.labelKey);
      const answer = answers?.[p.id];
      return Math.max(score(p, label, answer, q), score(p, label, answer, swapped));
    };
    const found = live
      .map((p) => ({ p, s: best(p) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => place(x.p));
    const soon = planned
      .filter((p) => best(p) > 0)
      .map((p): Row => ({ kind: 'soon', place: p, label: tNav(p.labelKey) }));
    return [...found, ...soon, { kind: 'ask', text: query.trim() }];
  }, [query, answers, pathname, tNav]);

  // Стрелки ходят только по тому, что можно нажать: «скоро» пропускается.
  const pickable = rows.map((row, i) => (row.kind === 'soon' ? -1 : i)).filter((i) => i >= 0);
  const current = pickable.includes(active) ? active : (pickable[0] ?? 0);

  const activate = (index: number) => {
    const row = rows[index];
    if (!row || row.kind === 'soon') return;
    if (row.kind === 'ask') {
      if (!row.text) return;
      close();
      window.dispatchEvent(new CustomEvent<string>(PULT_ASK, { detail: row.text }));
      return;
    }
    if (row.here) {
      close();
      return;
    }
    setGoing(index);
    router.push(row.place.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Esc сюда не входит: его слушает весь документ, пока пульт открыт.
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!pickable.length) return;
      const at = pickable.indexOf(current);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(pickable[(at + step + pickable.length) % pickable.length]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(current);
    }
  };

  const soonLine = ALL_PLACES.filter((p) => p.status === 'planned').map((p) => tNav(p.labelKey));

  // Радиус, который накрывает всё окно из точки вылета: до дальнего угла.
  const cover = (o: PultOrigin) =>
    Math.ceil(
      Math.max(
        Math.hypot(o.x, o.y),
        Math.hypot(window.innerWidth - o.x, o.y),
        Math.hypot(o.x, window.innerHeight - o.y),
        Math.hypot(window.innerWidth - o.x, window.innerHeight - o.y)
      )
    ) + 8;

  return (
    // `custom` на `AnimatePresence`, а не на самом листе: у уходящего элемента
    // пропсы уже не обновить, а как уходить, решается в момент ухода.
    <AnimatePresence custom={leaving}>
      {origin ? (
        <div key="pult" className="fixed inset-0 z-[60]">
          {/* Волна. Красный круг вылетает из ядра чуть раньше листа, и между
              ними пробегает красное кольцо — та же ударная волна, что у
              кнопки, только на этот раз она не гаснет у края, а сносит
              страницу. Без анимации — сразу лист, без красного. */}
          {reduceMotion ? null : (
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 bg-reactor"
              custom={leaving}
              variants={{
                from: { clipPath: `circle(${origin.r ?? 0}px at ${origin.x}px ${origin.y}px)` },
                open: { clipPath: `circle(${cover(origin)}px at ${origin.x}px ${origin.y}px)` },
                gone: (how: 'close' | 'nav') =>
                  how === 'nav'
                    ? { opacity: 0, transition: { duration: 0.2 } }
                    : {
                        clipPath: `circle(0px at ${origin.x}px ${origin.y}px)`,
                        transition: { duration: 0.3, ease: EASE, delay: 0.06 }
                      }
              }}
              initial="from"
              animate="open"
              exit="gone"
              transition={{ duration: 0.5, ease: EASE }}
            />
          )}

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('label')}
            className="scroll-quiet absolute inset-0 overflow-y-auto overscroll-contain bg-canvas"
            custom={leaving}
            variants={{
              from: reduceMotion
                ? { opacity: 0 }
                : { clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` },
              open: reduceMotion
                ? { opacity: 1 }
                : { clipPath: `circle(${cover(origin)}px at ${origin.x}px ${origin.y}px)` },
              gone: (how: 'close' | 'nav') =>
                reduceMotion || how === 'nav'
                  ? { opacity: 0, transition: { duration: how === 'nav' ? 0.2 : 0.12 } }
                  : {
                      clipPath: `circle(0px at ${origin.x}px ${origin.y}px)`,
                      transition: { duration: 0.28, ease: EASE }
                    }
            }}
            initial="from"
            animate="open"
            exit="gone"
            transition={reduceMotion ? { duration: 0.12 } : { duration: 0.56, ease: EASE, delay: 0.08 }}
          >
            <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-[12vh]">
              <div className="flex items-center justify-between gap-4">
                <p key={origin.line ?? 'title'} className="ps-label animate-rise-in text-ink-muted">
                  {origin.line ?? t('title')}
                </p>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t('close')}
                  className="ps-press grid h-10 w-10 shrink-0 place-items-center rounded border-2 border-rule text-ink-muted transition-colors duration-180 hover:border-ink hover:text-ink"
                >
                  <CrossIcon />
                </button>
              </div>

              <div className="mt-4 border-b-2 border-ink pb-2">
                <input
                  ref={field}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="pult-list"
                  aria-autocomplete="list"
                  aria-activedescendant={rows.length ? `pult-row-${current}` : undefined}
                  aria-label={t('label')}
                  placeholder={t('placeholder')}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  className="w-full bg-transparent text-3xl font-semibold leading-tight text-ink caret-reactor outline-none placeholder:text-ink-faint sm:text-4xl"
                />
              </div>

              <ul id="pult-list" role="listbox" aria-label={t('label')} className="mt-4 flex flex-col">
                {rows.map((row, index) => {
                  const on = index === current && row.kind !== 'soon';
                  const Icon =
                    row.kind === 'place' ? ICONS[row.place.id] : row.kind === 'ask' ? ChatIcon : null;
                  return (
                    <li
                      key={row.kind === 'ask' ? 'ask' : `${row.kind}-${row.place.id}`}
                      id={`pult-row-${index}`}
                      role="option"
                      aria-selected={on}
                      aria-disabled={row.kind === 'soon' || undefined}
                      onPointerMove={() => row.kind !== 'soon' && index !== current && setActive(index)}
                      onClick={() => activate(index)}
                      // Лесенкой, как поездки в поездах: список читается сверху
                      // вниз, а не вспыхивает. Начинается, когда лист уже накрыл
                      // экран, — раньше строки проступали бы сквозь волну.
                      style={{ animationDelay: `${160 + Math.min(index, 10) * 35}ms` }}
                      className={`animate-rise-in flex min-h-12 items-center gap-3 rounded px-3 py-2.5 transition-colors duration-180 ${
                        row.kind === 'soon' ? 'cursor-default' : 'cursor-pointer'
                      } ${on ? 'bg-sunk' : ''}`}
                    >
                      {/* Где ты в списке, отмечает ядро: красная точка — тот же
                          красный, что у кнопки, и больше нигде на этом листе. */}
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-180 ${
                          on || going === index ? 'bg-reactor' : 'bg-transparent'
                        } ${going === index ? 'animate-pulse' : ''}`}
                      />
                      <span className={`shrink-0 ${row.kind === 'soon' ? 'text-ink-faint' : 'text-ink-muted'}`}>
                        {Icon ? <Icon /> : <span className="block h-4 w-4" />}
                      </span>

                      {/* Название и ответ — на одной линии букв, а не по
                          середине: у них разный кегль, и по середине мелкий
                          ответ проседал ниже названия. Значки — по середине,
                          у них линии букв нет. */}
                      {row.kind === 'ask' ? (
                        <span className="flex min-w-0 flex-1 items-baseline gap-3">
                          <span className="shrink-0 text-lg font-medium text-ink">{t('ask')}</span>
                          <span className="ms-auto min-w-0 truncate text-right text-sm text-ink-muted">
                            {row.text ? `«${row.text}»` : ''}
                          </span>
                        </span>
                      ) : (
                        <span className="flex min-w-0 flex-1 items-baseline gap-3">
                          <span
                            className={`shrink-0 text-lg font-medium ${
                              row.kind === 'soon' ? 'text-ink-faint' : 'text-ink'
                            }`}
                          >
                            {row.label}
                          </span>
                          {row.kind === 'place' && row.here ? (
                            <span className="ps-label shrink-0 text-ink-faint">{t('here')}</span>
                          ) : null}
                          <span className="ms-auto min-w-0 truncate text-right text-sm tabular-nums text-ink-muted">
                            {row.kind === 'soon' ? (
                              <span className="ps-label text-ink-faint">{t('soon')}</span>
                            ) : row.answer ? (
                              // Блоком, а не строчным: строчный блок внутри
                              // обрезки добавлял строке нижний вынос, и ответ
                              // на телефоне сидел ниже названия.
                              <span key={row.answer} className="animate-rise-in block truncate">
                                {row.answer}
                              </span>
                            ) : loading && ORDER.includes(row.place.id) && row.place.id !== 'profile' ? (
                              <span className="inline-block h-3 w-24 animate-pulse rounded-sm bg-rule-soft align-middle" />
                            ) : null}
                          </span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Будущее одной строкой, пока ничего не набрано: девять серых
                  строк «скоро» под живыми превратили бы пульт в оглавление. */}
              {!query.trim() ? (
                <p
                  className="animate-rise-in mt-6 px-3 text-sm leading-relaxed text-ink-faint"
                  style={{ animationDelay: `${160 + ORDER.length * 35}ms` }}
                >
                  <span className="ps-label me-2">{t('soon')}</span>
                  {soonLine.map((name, i) => (
                    // Название не рвётся пополам: «трэп-хаус» переносился по
                    // дефису. Переносится только между названиями.
                    // Разделитель снаружи: внутри неразрывного куска он
                    // склеивал всю строку в одну, и она уезжала за край.
                    <span key={name}>
                      <span className="whitespace-nowrap">{name}</span>
                      {i < soonLine.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </p>
              ) : null}

              <p className="ps-label mt-auto hidden pt-10 text-ink-faint sm:block">{t('keys')}</p>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Красная точка в шапке — кнопка ПХ в миниатюре, на каждой странице.
 *
 * На главной есть большая кнопка, на остальных страницах её нет, а пульт нужен
 * отовсюду: на телефоне нет ни `/`, ни Ctrl+K. Точка того же красного, что
 * ядро, — единственное красное в шапке, поэтому читается как «то самое».
 */
export function PultDot({ label }: { label: string }) {
  return (
    <button
      type="button"
      data-pult-dot=""
      aria-label={label}
      onPointerEnter={warmPult}
      onFocus={warmPult}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        openPult({ x: r.left + r.width / 2, y: r.top + r.height / 2, r: 6 });
      }}
      className="group grid h-11 w-11 place-items-center rounded transition-colors duration-drape ease-drape hover:bg-sunk"
    >
      <span aria-hidden="true" className="relative grid h-3 w-3 place-items-center">
        {/* Ореол — заливка, а не тень: тени на сайте нет нигде. */}
        <span className="absolute -inset-1.5 rounded-full bg-reactor/15 transition-transform duration-drape ease-drape group-hover:scale-125" />
        <span className="relative h-3 w-3 rounded-full bg-reactor" />
      </span>
    </button>
  );
}
