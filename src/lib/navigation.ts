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
 * Закладки в шторке: разделы, до которых хочется дотянуться из любого места.
 *
 * Список, а не «все живые места»: шторка — это не оглавление. Главная достижима
 * по логотипу, профиль лежит в своём блоке над ним, патчи — строкой под ним. В
 * закладки идёт то, за чем иначе пришлось бы идти через весь хаб.
 *
 * Пока задан руками, и это временно по замыслу: каждый должен собирать свой
 * набор сам, добавляя и убирая блоки. Когда до этого дойдут руки, порядок
 * переедет в базу на человека, а этот массив останется тем, что видит новичок.
 * Остаток до `PRIMARY_NAV_SLOTS` шторка добивает честными заглушками.
 */
export const BOOKMARKS: string[] = ['calendar', 'todos', 'trains', 'games'];

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
    { id: 'today', terms: ['дата', 'число', 'часы', 'годин', 'час', 'время', 'день', 'сегодня', 'сьогодні', 'clock', 'time', 'date', 'uhr', 'datum', 'heute'] },
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
    { id: 'dog', terms: ['мопс', 'собак', 'пёс', 'пес', 'mops', 'pug', 'hund', 'ты кто', 'кто ты', 'ти хто', 'хто ти', 'who are you'] }
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
      id: 'dota',
      // 'rang' тут нет намеренно: оно сидит внутри orange, strange и arrange, а
      // термины сверяются как подстроки. Тот же капкан, что 'rain' внутри
      // 'train'. Латинского 'dota' хватает и тем, кто пишет кириллицей.
      terms: ['дота', 'доты', 'доте', 'доту', 'dota', 'mmr', 'медал', 'medal', 'ранг', 'rank', 'steam']
    },
    {
      id: 'brawl',
      // 'tag' тут нет: оно сидит внутри vintage и stage. Тот же капкан, что
      // 'rain' внутри 'train' и 'rang' внутри 'orange'.
      terms: ['бравл', 'brawl', 'кубк', 'кубок', 'трофе', 'pokal', 'supercell']
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
        status: 'live',
        labelKey: 'calendar',
        terms: [
          'календар', 'calendar', 'kalender', 'встреч', 'зустріч', 'termin',
          'событи', 'поді', 'расписани', 'розклад', 'когда мы', 'коли ми',
          'планы на', 'плани на',
          // Продублированы из `elements` нарочно: списки служат разным шагам.
          // «что у нас на неделе» и «покажи месяц» — это про раздел, и без них
          // самые естественные вопросы про календарь не попадали никуда.
          // Неделя перечислена падежами, а не стемом: «недел» целиком сидит
          // внутри «понедельник», и «в понедельник занят» уезжало в календарь.
          'месяц', 'місяц', 'month', 'monat',
          'неделя', 'неделе', 'неделю', 'недели', 'тижд', 'тижн', 'week', 'woche'
        ],
        elements: [
          { id: 'grid', terms: ['сетк', 'сітк', 'месяц', 'місяц', 'month', 'monat', 'grid', 'год', 'рік', 'year', 'jahr'] },
          { id: 'scale', terms: ['масштаб', 'вид', 'неделя', 'неделе', 'неделю', 'недели', 'тижд', 'тижн', 'week', 'woche', 'переключ', 'перемк', 'switch'] },
          { id: 'now', terms: ['линия', 'лінія', 'сейчас', 'зараз', 'текущ', 'поточн', 'line', 'now', 'linie', 'jetzt'] },
          { id: 'day', terms: ['день', 'сегодня', 'сьогодні', 'today', 'tag', 'heute'] },
          { id: 'add', terms: ['добав', 'додат', 'создат', 'створит', 'add', 'new', 'hinzu', 'дата', 'дату', 'datum'] }
        ]
      },
      {
        id: 'todos',
        href: '/todos',
        status: 'live',
        labelKey: 'todos',
        terms: [
          // Здесь стояли голые 'справ' и 'дела'. Оба — подстроки бытовых слов:
          // «справ» сидит в «справа», а на сайте шторка слева и чат справа, так
          // что «что за окошко справа» уводило в задачи; «дела» сидит в
          // «сделал». Украинское «справи» не спасает: оно сидит в «справился» и
          // «исправить». Остались только те же слова в составе фраз.
          'todo', 'task', 'задач', 'завданн', 'aufgabe',
          'список дел', 'список справ', 'доск', 'дошк', 'board', 'brett',
          'записк', 'стикер', 'sticker', 'zettel',
          // Продублированы из `elements`, по той же причине, что у календаря.
          'цвет', 'колір', 'личн', 'особист', 'напомин', 'нагада', 'erinner'
        ],
        // Порядок значим: `matchElement` берёт первое совпадение. Узкое идёт
        // раньше широкого, иначе «какой цвет у листочка» отвечает про доску —
        // слово «листочка» совпало первым, хотя спрашивали про цвет.
        elements: [
          { id: 'style', terms: ['цвет', 'колір', 'булавк', 'скотч', 'магнит', 'магніт', 'скрепк', 'color', 'pin', 'tape', 'farbe'] },
          { id: 'board', terms: ['доск', 'дошк', 'board', 'brett', 'листоч', 'записк', 'стикер'] },
          { id: 'lists', terms: ['личн', 'особист', 'общий', 'спільн', 'мой', 'мій', 'shared', 'private', 'eigen', 'gemeinsam'] },
          // Голого 'про' тут стоять не может: это предлог, и «расскажи про
          // доску» отвечало бы про PRO-режим. Режим называют или латиницей,
          // или двумя словами.
          { id: 'pro', terms: ['pro', 'про режим', 'про-режим', 'расширен', 'розширен', 'подробн', 'докладн'] }
        ]
      },
      {
        id: 'trains',
        href: '/trains',
        status: 'live',
        labelKey: 'trains',
        // Голого `train` тут нет намеренно: оно сидит внутри `training` и
        // `trainer`, а это слова зала. `trains` в них не помещается, а
        // `train ` с пробелом ловит «my train is late», но не «training».
        // Сильные слова стоят и здесь, и в элементах намеренно. `matchElement`
        // вызывается только после того, как совпал сам раздел, поэтому слово,
        // лежащее лишь в элементе, не найдёт ничего: «покажи табло» не
        // попадало никуда, пока `табло` было только внизу.
        //
        // `дорог` тут нет: оно сидит внутри «дорого» и «дорогой», а термины
        // сверяются как подстроки. Тот же капкан, что `rain` внутри `train`.
        // Понятие ловится словом `маршрут`, а `дорог` осталось элементу.
        terms: [
          'поезд', 'потяг', 'электричк', 'вокзал', 'станци', 'станці', 'перрон',
          'табло', 'маршрут', 'ехать', 'їхати', 'свалить', 'доеха', 'доїха',
          'опозда', 'запізн',
          'sbb', 'hb', 'trains', 'train ', 'by train', 'zug', 'bahn', 'bahnhof',
          'fahrplan', 'abfahrt', 'departure', 'timetable'
        ],
        elements: [
          { id: 'search', terms: ['найти', 'знайти', 'маршрут', 'откуда', 'куда', 'звідки', 'куди', 'search', 'route', 'suche', 'verbindung'] },
          { id: 'board', terms: ['табло', 'уходит', 'відправ', 'board', 'anzeige', 'tafel'] },
          { id: 'roads', terms: ['сохран', 'збереж', 'дорог', 'запомн', 'saved', 'gespeichert', 'favorit'] },
          { id: 'station', terms: ['домашн', 'домашню', 'свою станцию', 'мою станцию', 'home station', 'heimat'] }
        ]
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
        terms: ['стена позора', 'стену позора', 'стене позора', 'стіна ганьби', 'стіну ганьби', 'wall of shame', 'schandmauer', 'стена', 'стіна']
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
        // 'мем' короче четырёх букв, поэтому сравнивается целым словом — и «мемы»
        // мимо него проходили. Добавлены падежи, которыми это слово и живёт.
        terms: ['meme', 'мем', 'мемы', 'мемов', 'мемас', 'мемі', 'мемів', 'feed', 'лент']
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
        status: 'live',
        labelKey: 'games',
        // Дота и бравл: матчи, мета, позор и почёт. Здесь стояли тетрис, шахматы и
        // дурак — это был замысел, а раздел в итоге стал доской наших игр.
        //
        // «игры» падежами, а не стемом `игр`: короче четырёх букв термин
        // сверяется только целым словом, и «игры» мимо него проходили — тот же
        // капкан, что был с «мем». «Мета» и «позор» сюда не идут: «мета» сидит в
        // «комета» и «метал», а «позор» принадлежит стене позора; на самой
        // странице игр их узнают элементы ниже.
        terms: [
          'игры', 'игру', 'играх', 'ігри', 'ігор', 'games', 'game', 'spiel',
          'дота', 'доты', 'доте', 'доту', 'dota', 'бравл', 'brawl',
          'ммр', 'mmr', 'птс', 'катк', 'стата', 'статист', 'stats'
        ],
        elements: [
          { id: 'compare', terms: ['сравн', 'порівн', 'compar', 'vergleich'] },
          { id: 'shame', terms: ['позор', 'ганьб', 'shame', 'schande', 'слив'] },
          { id: 'honour', terms: ['почёт', 'почет', 'шана', 'шану', 'honour', 'honor', ' ehre'] },
          { id: 'meta', terms: ['мета', 'меты', 'мету', 'meta', 'сборк', 'збірк', 'build'] },
          { id: 'dota', terms: ['дота', 'доты', 'доте', 'доту', 'dota', 'герой', 'героя', 'героев', 'hero'] },
          { id: 'brawl', terms: ['бравл', 'brawl', 'кубк', 'trophy', 'trophä'] },
          { id: 'overview', terms: ['обзор', 'огляд', 'overview', 'übersicht'] }
        ]
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
  'за страниц',
  'що за сторінк',
  'what page',
  'welche seite',
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
