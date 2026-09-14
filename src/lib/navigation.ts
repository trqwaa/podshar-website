/**
 * The map of the site, and everything Podshar knows about it.
 *
 * One file on purpose. It was already the rule for routes — "adding a route
 * means touching this file plus four JSON catalogues and nothing else" — and
 * the dog is held to the same rule: a section he can name, walk you to, or
 * admit does not exist yet is a section described *here*. Two lists would drift
 * apart within a week, and a guide who knows about a page the router does not
 * is worse than no guide.
 *
 * `PRIMARY_NAV_SLOTS` is what the drawer shows: five reserved rows, rendered as
 * "in progress" and deliberately inert. The destinations behind them are not
 * decided yet, and five buttons named after pages that do not exist is worse
 * than five that admit they are placeholders. Five is a ceiling, not a target:
 * a drawer that lists everything is an index, and there is no index page.
 *
 * Three fields carry the guide:
 *
 *   status    `planned` is not decoration. Every section below one is a page
 *             that does not exist, and until v0.14 the assistant cheerfully
 *             pushed you to it — straight into a 404. He now says it is not
 *             built instead of pretending to walk you there.
 *   terms     lowercase fragments in all four languages. Matched loosely so
 *             that Russian and Ukrainian case endings do not each need a row:
 *             "галере" catches галерея, галереи, галерею, галереї.
 *   elements  the things you can point at on that page. This is what lets him
 *             answer "what is this red button" instead of only "where is X".
 *
 * Invariant, and the only thing that can break silently: a `live` place needs
 * `guide.<id>.here` in all four catalogues, and every element of a live place
 * needs `guide.<id>.<elementId>`. A missing key throws at render.
 */

export type PlaceStatus = 'live' | 'planned';

/** Something on a page that can be pointed at and asked about. */
export type PlaceElement = { id: string; terms: string[] };

export type Place = {
  /** Also the key under `guide` in the message catalogues. */
  id: string;
  href: string;
  status: PlaceStatus;
  /** Key inside the `nav` namespace. */
  labelKey: string;
  terms: string[];
  elements?: PlaceElement[];
};

export type NavGroup = { titleKey: string; items: Place[] };

export const PRIMARY_NAV_SLOTS = 5;

/**
 * The homepage. Not part of `NAV_GROUPS` because it is not a nav destination —
 * nobody needs a menu row for the page the wordmark already returns to — but it
 * is very much a place, and right now it is the only one that exists.
 */
export const HOME: Place = {
  id: 'home',
  href: '/',
  status: 'live',
  labelKey: 'home',
  terms: ['главн', 'домой', 'головн', 'додому', 'home', 'startseite', 'haupt'],
  elements: [
    { id: 'greeting', terms: ['приветств', 'вітанн', 'greeting', 'begrüss', 'hallo sag'] },
    { id: 'reactor', terms: ['пх', 'кнопк', 'красн', 'червон', 'реактор', 'button', 'knopf', 'rote'] },
    { id: 'today', terms: ['дата', 'число', 'часы', 'годин', 'час', 'время', 'clock', 'time', 'date', 'uhr', 'datum'] },
    { id: 'member', terms: ['профил', 'профіл', 'аккаунт', 'акаунт', 'кто я', 'хто я', 'who am i', 'profile', 'profil', 'konto'] },
    { id: 'quote', terms: ['цитат', 'мысл', 'думк', 'quote', 'thought', 'spruch', 'gedank'] },
    {
      id: 'patches',
      terms: [
        'патч', 'patch', 'обновл', 'оновл', 'верси', 'версі', 'version',
        'changelog', 'änderung', 'neuerung', 'что нового', 'що нового',
        'what changed', 'was neu'
      ]
    },
    {
      id: 'weather',
      // No bare 'rain': a stem matches anywhere in the message, and "rain" sits
      // inside "train", "brain" and "drain" — "next train" was answered with
      // the weather. The leading space keeps it a word start. For the same
      // reason no 'зонт' (inside "горизонт") and no 'schirm' ("bildschirm").
      terms: [
        'погод', 'дожд', 'температур', 'холодн', 'жарк', 'парасол', 'дощ',
        'weather', ' rain', 'rainy', 'raining', 'umbrella', 'wetter', 'regen', 'regnet'
      ]
    },
    {
      id: 'presence',
      terms: [
        'кто тут', 'кто онлайн', 'онлайн', 'трётся', 'хто тут', 'вештаєт',
        'who is here', "who's here", 'loiter', 'online', 'wer ist da', 'wer hier', 'rumlung'
      ]
    },
    {
      id: 'trains',
      terms: [
        'поезд', 'электричк', 'вокзал', 'станци', 'потяг', 'станці', 'sbb', 'hb',
        'train', 'station', 'zug', 'bahnhof'
      ]
    },
    { id: 'drawer', terms: ['меню', 'шторк', 'menu', 'menü', 'навигац', 'навігац'] },
    { id: 'dog', terms: ['мопс', 'собак', 'пёс', 'пес', 'mops', 'pug', 'hund', 'ты кто', 'ти хто', 'who are you'] }
  ]
};

/**
 * The profile page. Like HOME it is a place but not a nav destination: you get
 * there from your own name in the drawer, not from a menu of sections. The dog
 * still has to know it exists — it is the second page on the site that does.
 */
export const PROFILE: Place = {
  id: 'profile',
  href: '/profile',
  status: 'live',
  labelKey: 'profile',
  terms: [
    'профил', 'профіл', 'настройк', 'налаштув', 'аккаунт', 'акаунт',
    'пароль', 'аватар', 'почт', 'пошт', 'мейл', 'имя смен', "ім'я змін",
    'profile', 'settings', 'account', 'password', 'avatar', 'email',
    'profil', 'einstellung', 'konto', 'passwort'
  ],
  elements: [
    { id: 'identity', terms: ['имя', "ім'я", 'хендл', 'name', 'handle', 'nick'] },
    { id: 'avatar', terms: ['аватар', 'картинк', 'фотк', 'avatar', 'picture', 'bild'] },
    { id: 'security', terms: ['пароль', 'пароля', 'безопасн', 'безпек', 'password', 'passwort', 'security'] },
    { id: 'invite', terms: ['пригласи', 'запроси', 'инвайт', 'invite', 'einladung'] },
    {
      id: 'station',
      terms: ['станци', 'станці', 'вокзал', 'поезд', 'потяг', 'station', 'train', 'bahnhof', 'zug']
    },
    {
      id: 'dota',
      // 'rang' тут нет намеренно: оно сидит внутри orange, strange и arrange, а
      // термины сверяются как подстроки. Тот же капкан, что 'rain' внутри
      // 'train'. Латинского 'dota' хватает и тем, кто пишет кириллицей.
      terms: ['дота', 'доты', 'доте', 'доту', 'dota', 'mmr', 'медал', 'medal', 'ранг', 'rank', 'steam']
    }
  ]
};

/**
 * Страница патчей. Тоже не в `NAV_GROUPS`: попасть на неё можно кнопкой с
 * главной, а пять слотов в шторке зарезервированы под разделы, которых пока нет.
 *
 * Элементов у неё нет — вся страница и есть один список, и описывать внутри
 * нечего. Кнопка на главной при этом осталась отдельным элементом `home`: это
 * два разных вопроса, «что за кнопка внизу» и «что это за страница».
 */
export const PATCHES_PLACE: Place = {
  id: 'patches',
  href: '/patches',
  status: 'live',
  labelKey: 'patches',
  terms: [
    'патч', 'patch', 'обновл', 'оновл', 'верси', 'версі', 'version',
    'changelog', 'änderung', 'neuerung', 'что нового', 'що нового',
    'what changed', 'was neu', 'история изменен', 'історія змін'
  ]
};

export const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: 'daily',
    items: [
      {
        id: 'calendar',
        href: '/calendar',
        status: 'planned',
        labelKey: 'calendar',
        terms: ['календар', 'calendar', 'kalender']
      },
      {
        id: 'todos',
        href: '/todos',
        status: 'planned',
        labelKey: 'todos',
        terms: ['todo', 'task', 'задач', 'завданн', 'aufgabe', 'дела']
      },
      {
        id: 'gym',
        href: '/gym',
        status: 'planned',
        labelKey: 'gym',
        terms: ['gym', 'зал', 'workout', 'trening', 'тренир', 'тренув', 'качал']
      },
      {
        id: 'wallOfShame',
        href: '/wall-of-shame',
        status: 'planned',
        labelKey: 'wallOfShame',
        terms: ['позор', 'ганьб', 'shame', 'schande', 'стена', 'стіна']
      }
    ]
  },
  {
    titleKey: 'culture',
    items: [
      {
        id: 'memes',
        href: '/memes',
        status: 'planned',
        labelKey: 'memes',
        terms: ['meme', 'мем', 'мемі', 'feed', 'лент']
      },
      {
        id: 'gallery',
        href: '/gallery',
        status: 'planned',
        labelKey: 'gallery',
        terms: ['gallery', 'photo', 'галере', 'фото', 'galerie', 'знімк', 'снимк']
      },
      {
        id: 'radar',
        href: '/radar',
        status: 'planned',
        labelKey: 'radar',
        terms: ['fashion', 'perfume', 'fragrance', 'мода', 'парфюм', 'парфум', 'mode', 'duft']
      },
      {
        id: 'music',
        href: '/music',
        status: 'planned',
        labelKey: 'music',
        terms: ['music', 'spotify', 'soundcloud', 'музык', 'музик', 'musik', 'трек']
      }
    ]
  },
  {
    titleKey: 'world',
    items: [
      {
        id: 'ballick',
        href: '/ballick',
        status: 'planned',
        labelKey: 'ballick',
        terms: ['ballick', 'balance', 'crypto', 'баланс', 'крипт', 'деньг', 'гроші', 'geld']
      },
      {
        id: 'traphouse',
        href: '/traphouse',
        status: 'planned',
        labelKey: 'traphouse',
        terms: ['trap', 'apartment', 'flat', 'квартир', 'wohnung', 'хата', 'жиль']
      },
      {
        id: 'geopolitics',
        href: '/map',
        status: 'planned',
        labelKey: 'geopolitics',
        terms: ['map', 'war', 'ukraine', 'карт', 'війн', 'война', 'karte']
      }
    ]
  },
  {
    titleKey: 'play',
    items: [
      {
        id: 'games',
        href: '/games',
        status: 'planned',
        labelKey: 'games',
        terms: ['game', 'tetris', 'chess', 'durak', 'игр', 'ігр', 'spiel', 'тетрис', 'шахмат', 'дурак']
      },
      {
        id: 'gameStats',
        href: '/stats',
        status: 'planned',
        labelKey: 'gameStats',
        terms: ['dota', 'brawl', 'mmr', 'stat', 'статист', 'статис']
      }
    ]
  }
];

/** Every place the dog knows, homepage first so it wins an ambiguous match. */
export const ALL_PLACES: Place[] = [
  HOME,
  PROFILE,
  PATCHES_PLACE,
  ...NAV_GROUPS.flatMap((group) => group.items)
];

/**
 * Loose, deliberately dumb matching.
 *
 * Russian and Ukrainian inflect, so a term is normally a stem matched anywhere
 * in the message: "галере" has to catch "отведи меня в галерею". That is too
 * greedy for very short terms — "пх" as a substring would fire inside half the
 * Cyrillic alphabet — so anything under four characters has to match a whole
 * word instead. Multi-word phrases ("кто я") are substrings again, since
 * splitting them into tokens is exactly what would lose the phrase.
 */
function normalise(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е');
}

function matches(message: string, terms: string[]): boolean {
  const haystack = normalise(message);
  const words = haystack.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

  return terms.some((raw) => {
    const term = normalise(raw);
    if (term.length >= 4 || term.includes(' ')) return haystack.includes(term);
    return words.includes(term);
  });
}

export function matchPlace(message: string): Place | undefined {
  return ALL_PLACES.find((place) => matches(message, place.terms));
}

export function matchElement(place: Place, message: string): PlaceElement | undefined {
  return place.elements?.find((element) => matches(message, element.terms));
}

/** `path` is the pathname with the locale prefix already stripped by next-intl. */
export function placeForPath(path: string): Place | undefined {
  const clean = path.replace(/\/+$/, '') || '/';
  return ALL_PLACES.find((place) => place.href === clean);
}

/** Phrases that mean "describe where I am standing", in all four languages. */
const LOOK_AROUND_TERMS = [
  'где я',
  'что тут',
  'что здесь',
  'что это за место',
  'осмотрись',
  'где мы',
  'де я',
  'що тут',
  'що це за місце',
  'де ми',
  'where am i',
  'what is this',
  "what's this",
  'what is here',
  'look around',
  'wo bin ich',
  'was ist das hier',
  'was gibt es hier',
  'schau dich um'
];

/** Bare hellos. Short ones are whole-word matched, so "hi" will not fire on "this". */
const HELLO_TERMS = [
  'привет',
  'привіт',
  'здарова',
  'здоров',
  'хай',
  'салам',
  'hi',
  'hey',
  'yo',
  'hello',
  'hallo',
  'servus',
  'moin'
];

/** "What am I looking at?" — answered with the current page, not with a route. */
export const asksWhereAmI = (message: string) => matches(message, LOOK_AROUND_TERMS);

/** A bare hello, with nothing else in it worth routing on. */
export const isGreeting = (message: string) => matches(message, HELLO_TERMS);
