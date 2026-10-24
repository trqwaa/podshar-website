'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';

import { usePathname, useRouter } from '@/i18n/routing';
import { sharedDayIndex } from '@/lib/day';
import { EPIC_COOKIE, EPIC_SEEN } from '@/lib/epic-keys';
import { ALL_PLACES, HOME, type Place } from '@/lib/navigation';
import { moodAt, type Mood } from '@/lib/sun';
import { EpicIntro } from './EpicIntro';
import {
  CalendarIcon,
  ChatIcon,
  GamepadIcon,
  HomeIcon,
  NoteIcon,
  RouteIcon,
  TagIcon,
  UserIcon
} from './Icons';
import {
  CrackLine,
  DIM,
  IceSlice,
  IceTip,
  Shards,
  Sky,
  IceBand,
  Summit,
  SummitCore,
  SummitPulse,
  TEASE,
  Waterline,
  crackThrough,
  depthOf,
  icebergFor,
  lightOnIce,
  lightOnWater,
  seeded,
  skyFloor,
  undertowFor,
  waterAt
} from './PultScene';

/**
 * Пульт: весь сайт за красной кнопкой ПХ.
 *
 * Кнопку жмут — главная разлетается, и под ней айсберг. Строка ввода стоит на
 * линии воды; над водой величие — на макушке то же красное ядро, от него
 * расходятся кольца, сверху падает свет. Под водой разделы слоями льда, и чем
 * глубже, тем нишевее и серее: поезда у поверхности, «трэп-хаус» в темноте, по
 * краям тонут слова рутины, на самом дне, ровно на −10 994 м, живёт мопс.
 * Вечером и ночью айсберг темнеет по настоящему закату. Рисунок и вся
 * геометрия — в `PultScene.tsx`.
 *
 * Первое нажатие за заход на сайт сначала играет заставку на весь экран
 * (`EpicIntro`): «тебя приветствует весь легион» и ещё тысяча таких. Фраза
 * приходит с сервера готовой (`lib/epic.ts`), здесь только «было или нет».
 *
 * Механика — от командных строк вроде Spotlight: одно поле, самый короткий путь
 * куда угодно. Своё здесь:
 *
 *   - слой отвечает, а не только ведёт: под названием живой ответ раздела
 *     (`/api/pult`) — когда поезд, что сегодня, сколько на доске;
 *   - поиск не перестраивает айсберг, а подсвечивает найденные слои: лёд
 *     остаётся целым, тусклеет то, что не подошло;
 *   - ищет по словам, по которым мопс понимает, куда вести (`navigation.ts`),
 *     и прощает раскладку: «gjtplf» — это «поезда»;
 *   - что не нашлось — уходит мопсу строкой у самой поверхности;
 *   - выбранный слой трескается, и трещина успевает пробежать до перехода.
 *
 * Список разделов берётся из `navigation.ts` целиком: новый раздел станет новым
 * слоем сам, а шкала глубин пересчитается.
 *
 * Открывается отовсюду: кнопкой на главной, красной точкой в шапке, клавишей
 * `/` или Ctrl+K. «Назад» из раздела, в который пришли из пульта, возвращает в
 * пульт с тем же набранным текстом.
 */

export const PULT_OPEN = 'podshar:pult';
/** Подгрузить ответы заранее: курсор подбирается к кнопке или точке. */
export const PULT_WARM = 'podshar:pult-warm';
/** Передать мопсу набранное (или просто открыть его, если текста нет). Слушает `RightAIChat`. */
export const PULT_ASK = 'podshar:ask';

export type PultOrigin = {
  /** Центр, из которого раскрывается пульт, в пикселях окна. */
  x: number;
  y: number;
  /** Радиус того, из чего он вылетает: у кнопки — её край, у точки — почти ноль. */
  r?: number;
  /** Без красной волны: пульт возвращается, а не взрывается. */
  quiet?: boolean;
  /**
   * Открыли кнопкой, а не клавишами: тогда, если за этот заход ещё не было,
   * играет заставка. Кто открывает с клавиатуры, хочет искать, а не смотреть.
   */
  epic?: boolean;
};

export const openPult = (origin: PultOrigin) =>
  window.dispatchEvent(new CustomEvent<PultOrigin>(PULT_OPEN, { detail: origin }));
export const warmPult = () => window.dispatchEvent(new Event(PULT_WARM));

// ─── Возврат «назад» в пульт ────────────────────────────────────────────────

/**
 * Откуда в раздел пришли из пульта. В `sessionStorage`, а не в состоянии
 * истории: в `history.state` Next хранит своё дерево, и чужие поля там —
 * способ однажды сломать ему навигацию.
 */
const RETURN_KEY = 'podshar:pult-return';
/** Через полчаса «назад» уже не про пульт: человек давно занят другим. */
const RETURN_TTL = 30 * 60_000;

type Return = {
  from: string;
  to: string;
  query: string;
  at: number;
  /** `history.length` по приходе в раздел: шагнул дальше — «назад» уже не про пульт. */
  depth?: number;
  /** Адрес по приходе: путь с параметрами. */
  href?: string;
  /** Когда стрелка отправила «назад»: второй щелчок в эти секунды не шагает ещё раз. */
  leaving?: number;
};

/** Браузеры перестают считать `history.length` на пятидесяти: выше — счёт врёт. */
const HISTORY_CAP = 50;
/** Сколько ждать, что «назад» долетит, прежде чем снова пускать стрелку. */
const LEAVING_MS = 3000;

/** Путь без языка, как его отдаёт `usePathname` next-intl: `/ru/calendar` → `/calendar`. */
const stripLocale = (path: string) => path.replace(/^\/(en|ru|uk|de)(?=\/|$)/, '') || '/';

function readReturn(): Return | null {
  try {
    const raw = window.sessionStorage.getItem(RETURN_KEY);
    const value = raw ? (JSON.parse(raw) as Return) : null;
    return value && Date.now() - value.at < RETURN_TTL ? value : null;
  } catch {
    return null;
  }
}

function writeReturn(value: Return | null) {
  try {
    if (value) window.sessionStorage.setItem(RETURN_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Приватное окно без хранилища: «назад» просто поведёт на главную, как раньше.
  }
}

/**
 * Стрелка «назад» в шапке. Если в этот раздел пришли из пульта — шаг назад по
 * истории, и пульт откроется снова (его ловит `popstate`). Иначе — `false`, и
 * стрелка ведёт на главную, как всегда: тогда в истории позади может быть
 * чужой сайт, и `history.back()` увёл бы с Podshar.
 */
export function backToPult(pathname: string): boolean {
  const back = readReturn();
  if (!back || back.to !== pathname) return false;
  // После прихода из пульта человек мог полистать недели или сменить вкладку —
  // это новые записи истории, и `history.back()` вернул бы на прошлую неделю, а
  // не в пульт. Тогда стрелка ведёт на главную, как всегда. Узнаём это по
  // адресу (тот же — никуда не ходил) или по длине истории (та же — менял
  // только `replaceState`, как выбор дня в календаре). Длина работает только до
  // пятидесяти: дальше браузеры её не растят, и она совпадала бы всегда.
  const here = window.location.pathname + window.location.search;
  const length = window.history.length;
  const samePlace = back.href === here;
  const sameDepth = length < HISTORY_CAP && back.depth === length;
  if (!samePlace && !sameDepth) return false;
  // Второй щелчок, пока возвращаемся и страница ещё грузится, — ничего. Иначе
  // `history.back()` срабатывал дважды и проскакивал мимо пульта, вплоть до
  // чужого сайта позади. Через три секунды отметка не держит: если «назад»
  // так и не увёл со страницы, стрелка снова работает.
  if (back.leaving && Date.now() - back.leaving < LEAVING_MS) return true;
  writeReturn({ ...back, leaving: Date.now() });
  window.history.back();
  return true;
}

// ─── Порядок слоёв ──────────────────────────────────────────────────────────

/** Живые разделы от самого будничного к самому редкому. */
const ORDER = ['trains', 'calendar', 'todos', 'games', 'home', 'patches', 'profile'];
/** Будущие — от понятного всем к понятному троим. На дне — свои шутки. */
const DEEP_ORDER = ['gym', 'memes', 'gallery', 'music', 'wallOfShame', 'radar', 'geopolitics', 'traphouse', 'ballick'];
/** Ответы свежие минуту: поезд за это время не успевает уйти незамеченным. */
const FRESH_MS = 60_000;
/** Сколько трещина бежит до перехода: столько, чтобы её успели увидеть. */
const CRACK_MS = 380;
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
// Украинская раскладка отличается от русской тремя клавишами: на месте ы, ъ и э
// стоят і, ї и є. Набранное латиницей проверяется в обоих вариантах, иначе
// «suhb» становилось «ыгри» и не находило «ігри».
const UK_SWAP = new Map(SWAP);
UK_SWAP.set('s', 'і').set(']', 'ї').set("'", 'є');

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const swapLayout = (s: string, map: Map<string, string> = SWAP) => [...s].map((c) => map.get(c) ?? c).join('');

/** Насколько раздел похож на набранное. 0 — не похож. */
function score(label: string, terms: string[], answer: string | undefined, q: string): number {
  const name = norm(label);
  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 80;

  let best = 0;
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

const termsOf = (p: Place) => [...p.terms, ...(p.elements ?? []).flatMap((e) => e.terms)];
const DOG_TERMS = HOME.elements?.find((e) => e.id === 'dog')?.terms ?? [];

/** Точка, из которой вылетать без кнопки: красная точка в шапке, если она есть. */
function fromDot(): PultOrigin {
  const dot = document.querySelector<HTMLElement>('[data-pult-dot]')?.getBoundingClientRect();
  return dot && dot.width
    ? { x: dot.left + dot.width / 2, y: dot.top + dot.height / 2, r: 6 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 3 };
}

/**
 * Заставка — раз за заход на сайт: отметка в `sessionStorage`, который живёт,
 * пока открыта вкладка. Счётчик в куке — для сервера: по нему он выбирает фразу
 * следующего захода (`lib/epic.ts`), и тысяча фраз идёт по кругу без повторов.
 * Он же выбирает манеру появления, чтобы и она не повторялась подряд.
 */
function claimIntro(text: string): { text: string; variant: number } | null {
  try {
    if (window.sessionStorage.getItem(EPIC_SEEN)) return null;
    window.sessionStorage.setItem(EPIC_SEEN, '1');
  } catch {
    // Без хранилища заставка играла бы на каждое нажатие — лучше ни разу.
    return null;
  }
  const n = Number(document.cookie.match(new RegExp(`(?:^|; )${EPIC_COOKIE}=(\\d+)`))?.[1] ?? 0);
  document.cookie = `${EPIC_COOKIE}=${n + 1}; path=/; max-age=${400 * 86_400}; samesite=lax`;
  return { text, variant: n % 4 };
}

/**
 * Колонка айсберга. Шире, чем была (40rem): владелец попросил айсберг ближе, а
 * на широком экране слои в 40rem терялись посреди воды.
 */
const COLUMN = 'mx-auto flex w-full max-w-[44rem] px-3 sm:px-4 lg:max-w-[52rem]';

type Band = {
  key: string;
  kind: 'place' | 'soon' | 'dog';
  place?: Place;
  label: string;
  answer?: string;
  here: boolean;
  terms: string[];
};

export function Pult({ epic = null }: { epic?: string | null }) {
  const t = useTranslations('pult');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const still = Boolean(useReducedMotion());

  const [origin, setOrigin] = useState<PultOrigin | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  /**
   * Как пульт уходит. Закрыл сам — схлопывается обратно в ядро, из которого
   * вылетел. Ушёл в раздел — растворяется: схлопываться в кнопку, которой на
   * новой странице нет, значило бы показывать дорогу в никуда.
   */
  const [leaving, setLeaving] = useState<'close' | 'nav'>('close');
  /** Трещина в выбранном слое: какой слой, по какой линии и с какого места рисовать. */
  const [crack, setCrack] = useState<{ key: string; points: [number, number][]; seed: number; from: number } | null>(
    null
  );
  /** Трещина, которая пошла от наведения мыши: нажатие доломает именно её. */
  const [tease, setTease] = useState<{ key: string; points: [number, number][]; seed: number } | null>(null);
  /** Какое небо: считается в момент открытия, по закату над Цюрихом. */
  const [mood, setMood] = useState<Mood>('day');
  /** Заставка поверх айсберга: фраза и манера, в которой она появится. */
  const [intro, setIntro] = useState<{ text: string; variant: number } | null>(null);
  const introRef = useRef(false);
  introRef.current = intro !== null;
  /** Нажимали ли в строку: тогда «куда?» уходит, остаётся курсор. */
  const [poked, setPoked] = useState(false);
  /** Сколько букв набрано за этот раз: каждая новая пускает кольцо от ядра и выпрыгивает. */
  const [typed, setTyped] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [deepBelow, setDeepBelow] = useState(false);
  const fetchedAt = useRef(0);
  const inflight = useRef(false);
  const field = useRef<HTMLInputElement | null>(null);
  const sheet = useRef<HTMLDivElement | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const poppedAt = useRef(0);
  /** Куда привёл последний «назад»: чужой «назад» на другую страницу не в счёт. */
  const poppedPath = useRef('');
  /** Отложенный переход после трещины — чтобы Esc в эти 380 мс его отменял. */
  const crackTimer = useRef<number | null>(null);
  const openRef = useRef(false);
  openRef.current = origin !== null;
  /** Вернулись на страницу, откуда шли из пульта, но «назад» ещё не пришёл. */
  const pending = useRef<{ back: Return; until: number } | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const followActive = useRef(false);

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

  /** Передумал во время трещины: перехода не будет, и «назад» ему не нужен. */
  const cancelCrack = useCallback(() => {
    if (crackTimer.current === null) return;
    window.clearTimeout(crackTimer.current);
    crackTimer.current = null;
    writeReturn(null);
  }, []);

  const close = useCallback(() => {
    cancelCrack();
    setCrack(null);
    setTease(null);
    setIntro(null);
    setOrigin(null);
  }, [cancelCrack]);

  useEffect(() => cancelCrack, [cancelCrack]);

  const endIntro = useCallback(() => setIntro(null), []);

  const show = useCallback(
    (detail: PultOrigin, text = '') => {
      // Уже открыт: второе нажатие на кнопку, пока первое долетало, — ничего.
      // Иначе фокус «возвращался» бы в собственную строку пульта, а набранное
      // стиралось.
      if (openRef.current) return;
      cancelCrack();
      returnTo.current = document.activeElement as HTMLElement | null;
      setQuery(text);
      setPicked(null);
      setCrack(null);
      setTease(null);
      setPoked(false);
      setTyped(0);
      setScrolled(false);
      setLeaving('close');
      setMood(moodAt(Date.now()));
      setIntro(detail.epic && epic && !detail.quiet ? claimIntro(epic) : null);
      setOrigin(detail);
      load();
    },
    [load, cancelCrack, epic]
  );

  // Все пути открыть — одно событие. Плюс клавиатура: `/` вне полей ввода и
  // Ctrl+K (⌘K) откуда угодно — так открываются такие строки везде, и рука
  // уже знает.
  useEffect(() => {
    const onOpen = (e: Event) => show((e as CustomEvent<PultOrigin>).detail);
    const onKey = (e: KeyboardEvent) => {
      if (origin) return;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      // По физической клавише там, где символ врёт: на русской и украинской
      // раскладке клавиша «/» печатает точку, а «K» — «л». На немецкой «/» —
      // это Shift+7, и его ловит сам символ.
      const combo = (e.code === 'KeyK' || e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey);
      const slash = (e.key === '/' || (e.code === 'Slash' && e.key === '.')) && !typing && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!combo && !slash) return;
      // Открыто другое окно (патчи): пульт встал бы под ним, а фокус ушёл бы в
      // невидимую строку.
      // Своё уходящее окно не в счёт: пока оно доигрывает исчезновение, Ctrl+K
      // иначе уходил бы браузеру, в адресную строку.
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([data-pult])')) return;
      e.preventDefault();
      openPult(fromDot());
    };
    // «Назад» в браузере. Порядок с эффектом смены страницы ниже не
    // гарантирован: проверено, что Next рисует вернувшуюся страницу раньше,
    // чем `popstate` доходит до слушателей, а при промахе кеша бывает и
    // наоборот. Поэтому обе стороны ждут друг друга: событие отмечает время,
    // а если страница уже сменилась и ждёт — открывает пульт само.
    const onPop = () => {
      poppedAt.current = Date.now();
      poppedPath.current = stripLocale(window.location.pathname);
      const waiting = pending.current;
      pending.current = null;
      if (waiting && Date.now() < waiting.until && poppedPath.current === waiting.back.from) {
        show({ ...fromDot(), quiet: true }, waiting.back.query);
      }
    };
    window.addEventListener(PULT_OPEN, onOpen);
    window.addEventListener(PULT_WARM, load);
    window.addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(PULT_OPEN, onOpen);
      window.removeEventListener(PULT_WARM, load);
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('keydown', onKey);
    };
  }, [origin, load, show]);

  // Сменилась страница. Ушли в раздел — пульт своё отработал и растворяется.
  // Вернулись «назад» туда, откуда в раздел пришли из пульта, — пульт
  // появляется снова, с тем же текстом: «назад» значит «к предыдущему
  // действию», а предыдущим действием был пульт, а не главная.
  useEffect(() => {
    // «Назад» браузером посреди трещины: переход, на который она шла, отменён —
    // иначе через 380 мс он увёл бы вперёд, туда, откуда человек только что ушёл.
    // При обычном приходе таймер уже отработал, и здесь ничего не делается.
    cancelCrack();
    setLeaving('nav');
    setOrigin(null);
    const back = readReturn();
    if (!back) return;
    if (pathname === back.to) {
      // Пришли. Запоминаем, на какой записи истории: всё, что дальше, — уже
      // своя навигация раздела, и «назад» с неё ведёт не в пульт.
      if (back.depth === undefined) {
        writeReturn({
          ...back,
          depth: window.history.length,
          href: window.location.pathname + window.location.search
        });
      }
      return;
    }
    writeReturn(null);
    if (pathname !== back.from) return;
    if (Date.now() - poppedAt.current < 2000 && poppedPath.current === pathname) {
      // «Назад» пришёл раньше страницы.
      show({ ...fromDot(), quiet: true }, back.query);
    } else {
      // Страница раньше «назад»: ждём событие чуть больше полсекунды. Пришли
      // сюда обычной ссылкой — события не будет, и пульт не всплывёт.
      pending.current = { back, until: Date.now() + 600 };
    }
    // `show` меняется вместе с языком; повод для перезапуска здесь — только
    // смена страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Прокрутка под пультом заперта на `html`, как у окон (`Modal`): на `body`
  // липкая шапка перестаёт липнуть.
  //
  // `useLayoutEffect` и фокус сразу, без задержки: с `useEffect` и фокусом
  // через 30 мс первые ~50 мс пульт уже стоял на экране, а клавиши шли мимо
  // него — набравший «/» и сразу «кал» терял первую букву.
  useLayoutEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const gap = window.innerWidth - root.clientWidth;
    const overflow = root.style.overflow;
    const { paddingRight } = document.body.style;
    root.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    field.current?.focus({ preventScroll: true });
    // На окне и в фазе захвата — раньше всех. Esc закрывает только пульт: шторка
    // и чат мопса под ним слушают Esc на документе и закрылись бы тем же
    // нажатием. Tab не уходит под пульт: элемент с aria-modal обещает, что за
    // ним ничего нет, а фокус иначе гулял по невидимым кнопкам страницы.
    const onKeys = (e: KeyboardEvent) => {
      // Любая клавиша во время заставки — дальше, к айсбергу; буква при этом
      // остаётся в строке поиска. Esc, Enter и пробел — только заставку: закрыть
      // пульт или открыть слой, не увидев их, — не то, чего хотели.
      if (introRef.current) {
        setIntro(null);
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      const box = sheet.current;
      if (e.key !== 'Tab' || !box) return;
      const stops = [...box.querySelectorAll<HTMLElement>('button, input, a[href], [tabindex]:not([tabindex="-1"])')].filter(
        (el) => !el.hasAttribute('disabled')
      );
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const at = document.activeElement;
      const inside = !!at && box.contains(at);
      if (e.shiftKey ? !inside || at === first : !inside || at === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener('keydown', onKeys, true);
    return () => {
      window.removeEventListener('keydown', onKeys, true);
      // Под пультом открыто другое окно (фраза дня) — прокрутку держит оно. Нет —
      // отпускаем совсем, даже если пульт застал её запертой: запиравшее окно
      // могло закрыться раньше, и вернуть его «hidden» значило запереть сайт.
      root.style.overflow = document.querySelector('[role="dialog"][aria-modal="true"]:not([data-pult])')
        ? 'hidden'
        : overflow === 'hidden'
          ? ''
          : overflow;
      document.body.style.paddingRight = paddingRight;
      returnTo.current?.focus?.();
    };
  }, [open, close]);

  // Слои айсберга: живые, будущие, мопс. Порядок — глубина.
  const bands = useMemo<Band[]>(() => {
    const rank = (list: string[]) => (p: Place) => {
      const i = list.indexOf(p.id);
      return i < 0 ? list.length : i;
    };
    const byOrder = rank(ORDER);
    const byDepth = rank(DEEP_ORDER);
    const live = ALL_PLACES.filter((p) => p.status === 'live').sort((a, b) => byOrder(a) - byOrder(b));
    const deep = ALL_PLACES.filter((p) => p.status === 'planned').sort((a, b) => byDepth(a) - byDepth(b));
    return [
      ...live.map<Band>((p) => ({
        key: p.id,
        kind: 'place',
        place: p,
        label: tNav(p.labelKey),
        answer: answers?.[p.id],
        here: p.href === pathname,
        terms: termsOf(p)
      })),
      ...deep.map<Band>((p) => ({ key: p.id, kind: 'soon', place: p, label: tNav(p.labelKey), here: false, terms: termsOf(p) })),
      { key: 'dog', kind: 'dog', label: t('dog'), answer: t('dogHint'), here: false, terms: DOG_TERMS }
    ];
  }, [answers, pathname, tNav, t]);

  // Айсберг на сегодня: форма меняется раз в сутки, одинаково у троих.
  const berg = useMemo(() => icebergFor(bands.length, sharedDayIndex()), [bands.length]);

  const meters = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter', unitDisplay: 'short', maximumFractionDigits: 0 }),
    [locale]
  );

  // Поиск подсвечивает слои, а не перестраивает айсберг.
  const q = norm(query);
  const scores = useMemo(() => {
    const out = new Map<string, number>();
    if (!q) return out;
    const variants = [...new Set([q, swapLayout(q), swapLayout(q, UK_SWAP)])];
    for (const band of bands) {
      const s = Math.max(...variants.map((v) => score(band.label, band.terms, band.answer, v)));
      if (s > 0) out.set(band.key, s);
    }
    return out;
  }, [q, bands]);

  // Что можно выбрать стрелками, в порядке на экране: строка «спросить мопса»
  // у поверхности, потом слои сверху вниз. «Скоро» не выбирается.
  const pickable = useMemo(() => {
    const keys = bands.filter((b) => b.kind !== 'soon' && (!q || scores.has(b.key))).map((b) => b.key);
    return q ? ['ask', ...keys] : keys;
  }, [bands, q, scores]);

  // Без выбора — лучшее совпадение; ничего не нашлось — мопс.
  const fallback = useMemo(() => {
    if (!q) return pickable[0] ?? null;
    let best: string | null = null;
    let top = 0;
    for (const key of pickable) {
      const s = scores.get(key) ?? 0;
      if (s > top) {
        top = s;
        best = key;
      }
    }
    return best ?? 'ask';
  }, [q, pickable, scores]);
  const current = picked && pickable.includes(picked) ? picked : fallback;

  // Выбор стрелками или набором уводит прокрутку к слою; наведение мышью — нет.
  useEffect(() => {
    if (!followActive.current || !current) return;
    followActive.current = false;
    rows.current.get(current)?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, [current, still]);

  // Есть ли что листать вниз: тогда внизу подсказка «ниже — нишевее».
  useLayoutEffect(() => {
    if (!open) return;
    const el = sheet.current;
    setDeepBelow(Boolean(el && el.scrollHeight > el.clientHeight + 48));
  }, [open, bands.length]);

  const activate = (key: string | null) => {
    if (!key || crack) return;
    if (key === 'ask' || key === 'dog') {
      close();
      window.dispatchEvent(new CustomEvent<string>(PULT_ASK, { detail: key === 'ask' ? query.trim() : '' }));
      return;
    }
    const index = bands.findIndex((b) => b.key === key);
    const band = bands[index];
    if (!band?.place || band.kind !== 'place') return;
    if (band.here) {
      close();
      return;
    }
    const href = band.place.href;
    writeReturn({ from: pathname, to: href, query, at: Date.now() });

    if (still) {
      router.push(href);
      return;
    }
    // Трещина бежит, пока грузится страница: переход заранее запрошен, и
    // `CRACK_MS` — это время, которое человек видит скол, а не ждёт сеть.
    // Пошедшая от наведения доламывается с того же места; нет её (клавиатура,
    // палец) — новая, своя на каждое нажатие.
    const started = tease?.key === key ? tease : null;
    const seed = started?.seed ?? Date.now() % 2147483647;
    setCrack({
      key,
      points: started?.points ?? crackThrough(berg.layers[index], seeded(seed)),
      seed,
      from: started ? TEASE : 0
    });
    setTease(null);
    router.prefetch(href);
    crackTimer.current = window.setTimeout(() => {
      crackTimer.current = null;
      router.push(href);
    }, CRACK_MS);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Esc сюда не входит: его слушает весь документ, пока пульт открыт.
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!pickable.length) return;
      const at = Math.max(0, pickable.indexOf(current ?? ''));
      const step = e.key === 'ArrowDown' ? 1 : -1;
      followActive.current = true;
      setPicked(pickable[(at + step + pickable.length) % pickable.length]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activate(current);
    }
  };

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

  const last = bands.length - 1;
  const dim = DIM[mood];
  /** Небо тёмное — в сумерках и ночью: текст над водой тогда светлый. */
  const dark = mood !== 'day';
  /** Набранное рисуется наложением с прыгающей последней буквой — пока строка короткая. */
  const fancy = !still && query.length > 0 && query.length <= 24;
  // Слова рутины на глубине: по зерну дня, как и сам айсберг.
  const drifts = useMemo(
    () => undertowFor(bands.length, t('undertow').split(' · '), sharedDayIndex()),
    [bands.length, t]
  );

  return (
    // `custom` на `AnimatePresence`, а не на самом листе: у уходящего элемента
    // пропсы уже не обновить, а как уходить, решается в момент ухода.
    <AnimatePresence custom={leaving}>
      {origin ? (
        <div key="pult" className="fixed inset-0 z-[60]">
          {/* Волна. Красный круг вылетает из ядра чуть раньше листа, и между
              ними пробегает красное кольцо — та же ударная волна, что у
              кнопки, только на этот раз она сносит страницу. */}
          {still || origin.quiet ? null : (
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
            ref={sheet}
            data-pult=""
            role="dialog"
            aria-modal="true"
            aria-label={t('label')}
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 40)}
            className="scroll-quiet absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-canvas"
            custom={leaving}
            variants={{
              from: still ? { opacity: 0 } : { clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` },
              open: still ? { opacity: 1 } : { clipPath: `circle(${cover(origin)}px at ${origin.x}px ${origin.y}px)` },
              gone: (how: 'close' | 'nav') =>
                still || how === 'nav'
                  ? { opacity: 0, transition: { duration: how === 'nav' ? 0.2 : 0.12 } }
                  : {
                      clipPath: `circle(0px at ${origin.x}px ${origin.y}px)`,
                      transition: { duration: 0.28, ease: EASE }
                    }
            }}
            initial="from"
            // Пока идёт заставка, айсберг не раскрывается: сначала величие, потом
            // поисковик. Раскроется из ядра, когда заставка начнёт таять.
            animate={intro ? 'from' : 'open'}
            exit="gone"
            transition={still ? { duration: 0.12 } : { duration: origin.quiet ? 0.42 : 0.56, ease: EASE, delay: origin.quiet ? 0 : 0.08 }}
          >
            <div className="flex min-h-full flex-col">
              {/* ── Небо ─────────────────────────────────────────────────── */}
              {/* Неба меньше, чем было: айсберг ближе, и главное в нём — вершина,
                  а не воздух над ней. */}
              <section className="relative isolate flex min-h-[clamp(12rem,27vh,17rem)] flex-col justify-end">
                <Sky mood={mood} seed={sharedDayIndex()} still={still} />

                {/* Только выход: подпись «пульт» в углу владелец снял — айсберг и
                    так говорит, что это. Крестик тонкий и в круге, поворачивается
                    под курсором: квадратная рамка была кнопкой из формы, а не
                    частью сцены. */}
                <div className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-[44rem] items-center justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-6 lg:max-w-[52rem]">
                  <button
                    type="button"
                    onClick={close}
                    aria-label={t('close')}
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-[border-color,color,transform] duration-drape ease-drape hover:rotate-90 ${
                      dark
                        ? 'border-surface/30 text-surface/75 hover:border-surface hover:text-surface'
                        : 'border-ink/20 text-ink/65 hover:border-ink hover:text-ink'
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                    >
                      <path d="M5 5l14 14M19 5L5 19" />
                    </svg>
                  </button>
                </div>

                {/* Верхушка и строка ввода — на одной оси с айсбергом: слева та же
                    колонка, что у шкалы глубин, поэтому кончик над водой стоит
                    ровно над телом под водой. */}
                <div className={`relative z-10 ${COLUMN}`}>
                  <span className="w-16 shrink-0" aria-hidden="true" />
                  <div className="relative flex-1">
                    {/* Вершина: свет и кольца — за льдом, ядро — перед ним. */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 sm:h-28 lg:h-32">
                      <Summit x={berg.tip.peak} mood={mood} still={still} />
                      {still ? null : <SummitPulse x={berg.tip.peak} n={typed} mood={mood} />}
                      <IceTip tip={berg.tip} dim={dim} />
                      <SummitCore x={berg.tip.peak} />
                    </div>
                    <input
                      ref={field}
                      value={query}
                      onChange={(e) => {
                        // Буква добавилась, а не стёрлась: кольцо и прыжок — только на ввод.
                        if (e.target.value.length > query.length) setTyped((n) => n + 1);
                        setQuery(e.target.value);
                        setPicked(null);
                        followActive.current = true;
                      }}
                      onPointerDown={() => setPoked(true)}
                      onKeyDown={(e) => {
                        setPoked(true);
                        onKeyDown(e);
                      }}
                      role="combobox"
                      aria-expanded="true"
                      aria-controls="pult-list"
                      aria-autocomplete="list"
                      aria-activedescendant={current ? `pult-${current}` : undefined}
                      aria-label={t('label')}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="go"
                      // Тёмный текст и ночью: строка стоит на верхушке льда, а лёд
                      // светлый всегда — белое «куда?» на нём пропадало.
                      className={`relative w-full bg-transparent pb-1 text-center text-3xl font-semibold leading-tight outline-none sm:text-4xl ${
                        fancy ? 'text-transparent' : 'text-ink'
                      } ${query || poked ? 'caret-reactor' : 'caret-transparent'}`}
                    />
                    {/* Набранное рисуется поверх поля, а само поле прозрачное: так
                        последняя буква может выпрыгнуть — в настоящем поле буквы
                        не анимируются. Курсор остаётся настоящим. Прыгает только
                        последняя: разрежь всё слово на буквы — пропал бы кернинг,
                        и курсор разошёлся бы с текстом. Длинная строка поле
                        прокручивает, а наложение — нет; тогда без фокусов. */}
                    {fancy ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center whitespace-pre text-3xl font-semibold leading-tight text-ink sm:text-4xl"
                      >
                        {query.slice(0, -1)}
                        <span
                          key={typed}
                          className="inline-block"
                          style={{ animation: 'type-pop 0.26s cubic-bezier(0.2, 0.9, 0.3, 1.3) both' }}
                        >
                          {query.slice(-1) === ' ' ? ' ' : query.slice(-1)}
                        </span>
                      </span>
                    ) : null}
                    {/* Пустое поле: «куда?» и красный курсор после него. Поле стоит
                        по центру, и настоящий курсор в пустом поле встаёт в
                        середину — посреди подсказки, «ку|да?», как сбой. */}
                    {/* «Куда?» — пока в строку не нажали: нажал — вопрос задан,
                        дальше только курсор. */}
                    {query || poked ? null : (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-1 flex items-center justify-center text-3xl font-semibold leading-tight text-ink/40 sm:text-4xl"
                      >
                        {t('placeholder')}
                        <span className="ms-1 h-[0.9em] w-[3px] animate-caret-blink rounded-full bg-reactor" />
                      </span>
                    )}
                  </div>
                </div>
              </section>

              <Waterline still={still} dim={dim} floor={skyFloor(mood)}>
                <div className={`pointer-events-none absolute inset-0 ${COLUMN}`}>
                  <span className="w-16 shrink-0" />
                  <div className="relative flex-1">
                    <IceBand tip={berg.tip} dim={dim} />
                  </div>
                </div>
              </Waterline>

              {/* ── Вода ─────────────────────────────────────────────────── */}
              <ul
                id="pult-list"
                role="listbox"
                aria-label={t('label')}
                className={`relative ${crack && !still ? 'animate-[ice-shudder_0.16s_ease-in-out_2]' : ''}`}
              >
                {/* У самой поверхности, пока что-то набрано: спросить мопса. */}
                {q ? (
                  <li
                    id="pult-ask"
                    role="option"
                    aria-selected={current === 'ask'}
                    ref={(el) => {
                      if (el) rows.current.set('ask', el);
                      else rows.current.delete('ask');
                    }}
                    onPointerMove={() => current !== 'ask' && setPicked('ask')}
                    onClick={() => activate('ask')}
                    className="relative cursor-pointer"
                    style={{ background: waterAt(0, dim) }}
                  >
                    {/* Лёд и через эту строку: она встаёт между верхушкой и первым
                        слоем, и без полосы льда айсберг снова рвался водой. Текст
                        стоит на льду — и цвет его по льду, а не по воде. */}
                    <div className={`pointer-events-none absolute inset-0 ${COLUMN}`}>
                      <span className="w-16 shrink-0" />
                      <div className="relative flex-1">
                        <IceBand tip={berg.tip} dim={dim} />
                      </div>
                    </div>
                    <div className={`relative ${COLUMN}`}>
                      <Gauge marked={current === 'ask'} dark={lightOnWater(0, dim)} label="" still={still} />
                      <p
                        className={`flex min-h-11 flex-1 items-center justify-center gap-2 px-4 text-center text-sm transition-colors duration-180 ${
                          lightOnIce(0, dim)
                            ? current === 'ask'
                              ? 'text-surface'
                              : 'text-surface/70'
                            : current === 'ask'
                              ? 'text-ink'
                              : 'text-ink-muted'
                        }`}
                      >
                        <ChatIcon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 truncate">
                          {t('ask')}: «{query.trim()}»
                        </span>
                        <span aria-hidden="true" className="ps-label shrink-0 text-ink-faint">
                          ↵
                        </span>
                      </p>
                    </div>
                  </li>
                ) : null}

                {bands.map((band, i) => {
                  const depth = i / Math.max(1, last);
                  // Цвет текста свой у воды (шкала глубин, слова рутины) и у льда
                  // (название слоя): ночью вода тёмная уже у поверхности, а лёд —
                  // ещё нет.
                  const waterDark = lightOnWater(depth, dim);
                  const iceDark = lightOnIce(depth, dim);
                  const on = current === band.key;
                  const faded = q !== '' && !scores.has(band.key);
                  const Icon = band.kind === 'dog' ? ChatIcon : ICONS[band.key];
                  const cracked = crack?.key === band.key ? crack : null;
                  const teased = !cracked && tease?.key === band.key ? tease : null;
                  const drift = drifts[i];
                  return (
                    <li
                      key={band.key}
                      id={`pult-${band.key}`}
                      role="option"
                      aria-selected={on}
                      aria-disabled={band.kind === 'soon' || undefined}
                      ref={(el) => {
                        if (el) rows.current.set(band.key, el);
                        else rows.current.delete(band.key);
                      }}
                      onPointerMove={() => band.kind !== 'soon' && !on && setPicked(band.key)}
                      // Наведение — трещина пошла, но лёд держится. Новая на каждое
                      // наведение: одна и та же линия через неделю читалась бы
                      // рисунком, а не сколом. Пальцем — нет: у касания нет
                      // «навести», только «нажать».
                      onPointerEnter={(e) => {
                        if (band.kind !== 'place' || band.here || still || crack || e.pointerType === 'touch') return;
                        const seed = (Date.now() + i * 7919) % 2147483647;
                        setTease({ key: band.key, points: crackThrough(berg.layers[i], seeded(seed)), seed });
                      }}
                      onPointerLeave={() => setTease((was) => (was?.key === band.key ? null : was))}
                      onClick={() => activate(band.key)}
                      className={`relative ${band.kind === 'soon' ? 'cursor-default' : 'cursor-pointer'}`}
                      style={{ background: waterAt(depth, dim) }}
                    >
                      {drift ? (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute top-1/2 hidden select-none whitespace-nowrap text-sm tracking-wide xl:block ${
                            waterDark ? 'text-surface' : 'text-ink'
                          }`}
                          style={{
                            [drift.side]: `${drift.inset}%`,
                            opacity: 0.1 + 0.2 * depth,
                            transform: 'translateY(-50%)',
                            animation: still
                              ? undefined
                              : `undertow ${drift.seconds}s ease-in-out ${drift.delay}s infinite alternate`
                          }}
                        >
                          {drift.word}
                        </span>
                      ) : null}
                      <div className={COLUMN}>
                        <Gauge
                          marked={on}
                          dark={waterDark}
                          label={`−${meters.format(depthOf(i, bands.length))}`}
                          still={still}
                        />
                        <div className="relative flex-1">
                          <IceSlice layer={berg.layers[i]} t={depth} dim={dim} lit={on} crack={cracked?.points ?? null} />
                          {cracked && !still ? (
                            <Shards crack={cracked.points} t={depth} dim={dim} seed={cracked.seed + 1} />
                          ) : null}
                          <div
                            className={`relative flex flex-col items-center justify-center px-8 text-center transition-opacity duration-180 ${
                              band.kind === 'soon'
                                ? 'min-h-12 py-1.5'
                                : band.kind === 'dog'
                                  ? 'min-h-24 py-3'
                                  : 'min-h-[4.75rem] py-2 lg:min-h-[5.5rem]'
                            } ${faded ? 'opacity-25' : cracked ? 'opacity-55' : ''}`}
                          >
                            <span className="flex max-w-full items-center gap-2">
                              {Icon ? (
                                <Icon
                                  className={`h-4 w-4 shrink-0 lg:h-5 lg:w-5 ${iceDark ? 'text-surface/70' : 'text-ink-muted'}`}
                                />
                              ) : null}
                              <span
                                className={`truncate ${band.kind === 'soon' ? 'text-base lg:text-lg' : 'text-lg lg:text-xl'} font-medium ${
                                  band.kind === 'soon'
                                    ? iceDark
                                      ? 'text-surface/60'
                                      : 'text-ink/50'
                                    : iceDark
                                      ? 'text-surface'
                                      : 'text-ink'
                                }`}
                              >
                                {band.label}
                              </span>
                              {band.here ? (
                                <span className={`ps-label shrink-0 ${iceDark ? 'text-surface/45' : 'text-ink-faint'}`}>
                                  {t('here')}
                                </span>
                              ) : null}
                              {band.kind === 'soon' ? (
                                <span className={`ps-label shrink-0 ${iceDark ? 'text-surface/40' : 'text-ink/35'}`}>
                                  {t('soon')}
                                </span>
                              ) : null}
                            </span>
                            {band.kind !== 'soon' ? (
                              <span
                                className={`mt-0.5 block max-w-full truncate text-sm tabular-nums lg:text-base ${
                                  iceDark ? 'text-surface/70' : 'text-ink-muted'
                                }`}
                              >
                                {band.answer ? (
                                  <span key={band.answer} className="animate-rise-in block truncate">
                                    {band.answer}
                                  </span>
                                ) : loading && band.kind === 'place' && band.key !== 'profile' ? (
                                  <span className="my-1 inline-block h-3 w-28 animate-pulse rounded-sm bg-ink/10 align-middle" />
                                ) : null}
                              </span>
                            ) : null}
                          </div>
                          {/* Стрелка у выбранного слоя: он кнопка, и нажмётся сейчас
                              именно он. У правого края льда, а не рядом с названием:
                              название стоит по центру и ездить не должно. На
                              телефоне её нет — там она ложилась на ответ слоя. */}
                          {on && band.kind !== 'soon' && !cracked ? (
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 text-lg sm:block lg:text-xl ${
                                iceDark ? 'text-surface/70' : 'text-ink/55'
                              }`}
                              style={{ right: `${100 - berg.layers[i].right[1] + 4}%` }}
                            >
                              →
                            </span>
                          ) : null}
                          {/* Ключи разные: при нажатии трещина должна вырасти заново
                              от трети, а не обновиться на месте уже прорисованной. */}
                          {cracked ? (
                            <CrackLine key="crack" crack={cracked.points} seed={cracked.seed} from={cracked.from} />
                          ) : teased ? (
                            <CrackLine key={`tease-${teased.seed}`} crack={teased.points} seed={teased.seed} to={TEASE} />
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* ── Дно: дальше только тьма и подсказка по клавишам. ───────── */}
              <div className="flex flex-1 items-end justify-center bg-deep px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10">
                <p className="ps-label hidden text-surface/40 sm:block">{t('keys')}</p>
              </div>
            </div>
          </motion.div>

          {/* «Ниже — нишевее»: айсберг уходит за нижний край, и это надо
              сказать, пока человек не начал листать. Исчезает с первой
              прокруткой и пока что-то набрано. */}
          <AnimatePresence>
            {deepBelow && !scrolled && !q ? (
              <motion.p
                key="deeper"
                aria-hidden="true"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.9, duration: 0.4 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="ps-label pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-deep/85 px-3 py-1.5 text-surface"
              >
                {t('deeper')} ↓
              </motion.p>
            ) : null}
          </AnimatePresence>

          {/* Заставка — поверх всего, и красной волны тоже: волна уходит под неё,
              а айсберг под ней уже раскрылся к тому времени, как она растает. */}
          {/* Кровавая луна красит всю сцену разом: полупрозрачный винный слой в
              режиме умножения, а не своя краска у каждого слоя. */}
          {mood === 'blood' ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 mix-blend-multiply"
              style={{ background: 'rgb(var(--blood) / 0.3)' }}
            />
          ) : null}

          <AnimatePresence>
            {intro ? (
              <EpicIntro
                key="intro"
                text={intro.text}
                variant={intro.variant}
                dark={dark}
                still={still}
                onDone={endIntro}
              />
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Шкала глубин слева от айсберга: линия, засечка и метры.
 *
 * Линия рисуется по куску в каждом слое и собирается в одну, а красная точка —
 * ядро кнопки, которое показывает, где ты, — переезжает между слоями общим
 * `layoutId`: framer сам ведёт её от слоя к слою, как стрелку эхолота.
 */
function Gauge({ marked, dark, label, still }: { marked: boolean; dark: boolean; label: string; still: boolean }) {
  return (
    <div aria-hidden="true" className="relative w-16 shrink-0">
      <span className={`absolute inset-y-0 right-0 w-px ${dark ? 'bg-surface/20' : 'bg-ink/20'}`} />
      {label ? (
        <>
          <span className={`absolute right-0 top-1/2 h-px w-2 ${dark ? 'bg-surface/30' : 'bg-ink/30'}`} />
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 whitespace-nowrap text-[0.625rem] tabular-nums tracking-wide ${
              dark ? 'text-surface/45' : 'text-ink/45'
            }`}
          >
            {label}
          </span>
        </>
      ) : null}
      {marked ? (
        <motion.span
          layoutId="pult-marker"
          // Без движения — сразу на месте: пружина framer сама на
          // `prefers-reduced-motion` не смотрит.
          transition={still ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
          className="absolute right-[-5px] top-1/2 -mt-[5px] h-2.5 w-2.5 rounded-full bg-reactor"
        />
      ) : null}
    </div>
  );
}

