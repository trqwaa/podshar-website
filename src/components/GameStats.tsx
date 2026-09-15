'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import type { BrawlProfile, DotaProfile } from '@/lib/types';

/**
 * Медали доты — те самые, что на Dotabuff.
 *
 * Названия не переводятся, как и ранги Brawl Stars. Никто из играющих не говорит
 * «Крестоносец» — говорят Crusader или «кресты», на всех четырёх языках сайта
 * одинаково. Перевод был бы вежливее и при этом менее понятен тем троим, ради
 * кого всё это пишется. То же исключение, что у списка патчей и у «HB».
 */
const MEDALS = [
  'Herald',
  'Guardian',
  'Crusader',
  'Archon',
  'Legend',
  'Ancient',
  'Divine',
  'Immortal'
];

/**
 * Сколько пикселей занимает значок ранга.
 *
 * Было 52 — ровно под две строки текста рядом. Со строкой матчей и ником строк
 * стало больше, и значок рядом с ними читался мелким: он тут главное, а выглядел
 * припиской к тексту.
 */
const SIZE = 58;

// `linked` обязателен: маршрут возвращает его из каждой ветки. Необязательное
// поле тут означало бы, что «не привязан» и «не смогли посмотреть» приезжают
// одним и тем же `undefined`, а это два разных ответа человеку.
type Answer = {
  dota: DotaProfile | null;
  dotaLinked: boolean;
  brawl: BrawlProfile | null;
  brawlLinked: boolean;
};

type State = { kind: 'wait' } | { kind: 'off' } | ({ kind: 'got' } & Answer);

/**
 * Цифры из игр, которые шторка спрашивает сама, уже после загрузки страницы.
 *
 * Запрос идёт из браузера, а не из рендера, и это не лень, а единственный
 * возможный вариант: то, что вызывается в `(app)/layout.tsx`, ждёт вся страница
 * целиком (см. `api/games/route.ts`), так что один медленный ответ подвесил бы
 * главную из-за плитки, лежащей в закрытой шторке. Здесь ждёт только шторка — и
 * только тогда, когда её открыли.
 *
 * Обе игры одним компонентом и одним запросом. Открытие шторки — одно событие.
 *
 * Ни одно из состояний не молчит. «Не дозвонились» и «аккаунт не привязан» —
 * разные вещи, и человек, глядящий на пустой блок, должен понимать, чинить ему
 * что-то или нет.
 */
export function GameStats({ open }: { open: boolean }) {
  const [state, setState] = useState<State>({ kind: 'wait' });

  /**
   * Счётчик открытий шторки — он же ключ для полосок матчей.
   *
   * Сам блок живёт в разметке всегда: закрытая шторка не снимается, у неё
   * нулевая ширина. Значит анимация появления отыгрывает при загрузке страницы,
   * когда её никто не видит, и к моменту открытия всё уже стоит на местах.
   * Смена ключа пересобирает полоску, и выезд достаётся тому, кто её открыл.
   */
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (open) setRun((n) => n + 1);
  }, [open]);

  /**
   * Спрашиваем при загрузке и заново при каждом открытии шторки.
   *
   * Иначе привязка аккаунта требовала перезагрузить сайт руками: форма в профиле
   * сохраняла всё как надо, а плитка спрашивала цифры ровно один раз за жизнь
   * страницы — и продолжала показывать то, что застала. Открытие шторки и есть
   * тот момент, когда человек на неё смотрит, значит это же и момент спросить.
   *
   * Повторный заход почти всегда стоит одного запроса к своей базе: снимок ещё
   * свежий, наружу никто не идёт. И состояние при этом не сбрасывается в
   * «ждём» — иначе каждое открытие моргало бы заглушкой поверх готовых данных.
   */
  const first = useRef(true);
  useEffect(() => {
    if (!open && !first.current) return;
    first.current = false;

    let alive = true;
    // POST и `no-store` — и то и другое против одного и того же: браузер успел
    // запомнить ответ «аккаунт не привязан», полученный до привязки, и честно
    // показывал его дальше. Ответ тут свой у каждого и меняется, держать его
    // нельзя нигде.
    fetch('/api/games', { method: 'POST', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((answer: Answer) => alive && setState({ kind: 'got', ...answer }))
      .catch(() => alive && setState({ kind: 'off' }));
    // Отменяется не запрос, а то, что случится после его возвращения: панель
    // могли уже закрыть, а `setState` на снятом компоненте — ошибка в консоли
    // на ровном месте.
    return () => {
      alive = false;
    };
  }, [open]);

  const dota = state.kind === 'got' ? state.dota : null;
  const brawl = state.kind === 'got' ? state.brawl : null;

  return (
    <div className="space-y-2">
      <Card
        label="dota"
        state={state}
        player={dota}
        linked={state.kind === 'got' ? state.dotaLinked : false}
        anchor="dota"
        // Stratz, а не Dotabuff — выбор владельца. Номер аккаунта в адресе тот
        // же самый, так что вторая ссылка при желании меняется одной строкой.
        away={dota?.accountId ? { where: 'stratz', href: `https://stratz.com/players/${dota.accountId}` } : null}
      >
        {(player) => <DotaBody player={player as DotaProfile} run={run} />}
      </Card>

      <Card
        label="brawl"
        state={state}
        player={brawl}
        linked={state.kind === 'got' ? state.brawlLinked : false}
        anchor="brawl"
        away={brawl?.tag ? { where: 'brawlify', href: `https://brawlify.com/stats/profile/${brawl.tag}` } : null}
      >
        {(player) => <BrawlBody player={player as BrawlProfile} run={run} />}
      </Card>
    </div>
  );
}

/**
 * Общая рамка и общие четыре состояния: ждём, не привязан, не дозвонились, есть.
 *
 * Одинаковы у обеих игр до последнего пикселя, и это не совпадение: две плитки
 * рядом, ведущие себя по-разному в одинаковой ситуации, читаются как поломка
 * одной из них.
 */
function Card({
  label,
  state,
  player,
  linked,
  anchor,
  away,
  children
}: {
  label: 'dota' | 'brawl';
  state: State;
  player: DotaProfile | BrawlProfile | null;
  linked: boolean;
  /** Якорь на странице профиля, куда ведёт «привязать аккаунт». */
  anchor: string;
  /** Куда сходить за подробностями. `null`, пока показывать нечего. */
  away: { where: string; href: string } | null;
  children: (player: DotaProfile | BrawlProfile) => React.ReactNode;
}) {
  const t = useTranslations('games');

  return (
    <div className="rounded border-2 border-rule bg-canvas p-3">
      {/* Подпись и выход наружу на одной строке. Ссылка появляется только
          вместе с данными: вести на чужой сайт с пустой плитки некуда. */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.7rem] lowercase leading-tight tracking-label text-ink-muted">
          {t(label)}
        </p>
        {player && away ? <Away where={away.where} href={away.href} /> : null}
      </div>

      {state.kind === 'wait' ? (
        <span className="mt-2 flex items-center gap-3">
          <span
            style={{ width: SIZE, height: SIZE }}
            className="shrink-0 animate-pulse rounded-sm bg-sunk"
          />
          <span className="h-5 flex-1 animate-pulse rounded-sm bg-sunk" />
        </span>
      ) : player ? (
        children(player)
      ) : linked ? (
        <p className="mt-2 text-sm text-ink-muted">{t('quiet')}</p>
      ) : (
        // Не играет, или ещё не сказал где. Ссылка ведёт прямо к нужному полю:
        // человек нажал её ради одного поля, и искать его среди пяти блоков —
        // работа, которую он не просил. Якоря стоят в `(app)/profile/page.tsx`.
        <p className="mt-2 text-sm text-ink-muted">
          <Link
            href={`/profile#${anchor}`}
            className="underline decoration-rule underline-offset-4 hover:text-ink"
          >
            {t('link')}
          </Link>
        </p>
      )}
    </div>
  );
}

/**
 * «Подробности там».
 *
 * Название сервиса словом, а не одной стрелкой: стрелка говорит «уйдёшь
 * отсюда», но не говорит куда, а это как раз то, что человек хочет знать до
 * нажатия. Отрицательные поля растягивают область нажатия за счёт отступов
 * карточки, не раздвигая строку.
 */
function Away({ where, href }: { where: string; href: string }) {
  const t = useTranslations('games');

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('openOn', { where })}
      className="-my-2 -me-1 inline-flex shrink-0 items-center gap-1 rounded px-1 py-2 text-[0.7rem] lowercase tracking-label text-ink-faint transition-colors duration-drape hover:text-ink focus-visible:text-ink"
    >
      {where}
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className="h-2.5 w-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9 9 3" />
        <path d="M4.5 3H9v4.5" />
      </svg>
    </a>
  );
}

/** Ник, и у доты ещё аватарка. Строка «чей это аккаунт» перед самими цифрами. */
function Who({ name, avatar }: { name: string | null; avatar?: string | null }) {
  if (!name) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      {avatar ? (
        // Через `next/image`, а не напрямую: картинку забирает и пережимает наш
        // сервер, браузер получает её со своего домена. Это и есть соблюдение
        // правила из `next.config.mjs` — не пускать зрителей на чужие CDN.
        <Image
          src={avatar}
          alt=""
          width={44}
          height={44}
          className="h-[22px] w-[22px] shrink-0 rounded-full border border-rule-soft object-cover"
        />
      ) : null}
      {/* `normal-case`: ник — имя человека, строчить его нельзя. */}
      <p className="truncate text-sm font-medium normal-case text-ink">{name}</p>
    </div>
  );
}

function DotaBody({ player, run }: { player: DotaProfile; run: number }) {
  const t = useTranslations('games');
  const total = player.wins + player.losses;

  return (
    <div>
      <Who name={player.name} avatar={player.avatar} />

      <div className="mt-2 flex items-center gap-3">
        {player.medal ? (
          // Две картинки друг на друге, как это делают и Dotabuff, и OpenDota:
          // звёзды нарисованы отдельным слоем ровно под тот же квадрат, поэтому
          // накладываются без подгонки. Лежат у нас в `public`, а не тянутся с
          // чужого сервера: путь там однажды сменят, и медаль пропадёт молча.
          <span
            style={{ width: SIZE, height: SIZE }}
            className="relative block shrink-0"
            aria-hidden="true"
          >
            <Image
              src={`/dota/medal-${player.medal}.png`}
              alt=""
              width={SIZE * 2}
              height={SIZE * 2}
              className="h-full w-full"
            />
            {player.stars > 0 ? (
              <Image
                src={`/dota/star-${player.stars}.png`}
                alt=""
                width={SIZE * 2}
                height={SIZE * 2}
                className="absolute inset-0 h-full w-full"
              />
            ) : null}
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          {/* `normal-case`: медаль — имя собственное, и `ps-label` ниже по дереву
              превратил бы Crusader в crusader. */}
          <p className="truncate text-base font-semibold normal-case leading-tight text-ink">
            {player.medal ? MEDALS[player.medal - 1] : t('unranked')}
            {player.stars > 0 ? <span className="text-ink-muted"> {player.stars}</span> : null}
          </p>
          {player.leaderboard ? (
            <p className="truncate text-sm tabular-nums text-ink-muted">
              {t('place', { place: player.leaderboard })}
            </p>
          ) : null}
          <Winrate
            wins={player.wins}
            played={total}
            title={t('winrateOf', { wins: player.wins, played: total })}
          />
        </div>
      </div>

      {player.recent.length ? <Streak results={player.recent} run={run} /> : null}
    </div>
  );
}

/**
 * Brawl Stars: значок ранга, кубки числом, под ними ранг и клуб.
 *
 * Построено как плитка доты — значок слева, текст справа. Не из лени, а по тому
 * же соображению: две плитки рядом, устроенные по-разному, читаются как поломка
 * одной из них.
 *
 * Значки лежат у нас в `public/brawl`, а не тянутся с чужого сервера: путь там
 * однажды сменят, и ранг пропадёт молча. Взяты из Brawlify/CDN на GitHub, у
 * репозитория лицензия MIT и прямая надпись «free to use for everyone». Имя
 * файла — номер ранга из API (`rankedRank`, 1–22); у них он закодирован как
 * `58000000 + номер - 1`, и это переведено при скачивании, чтобы в коде не
 * заводилась арифметика, объяснить которую потом будет некому.
 */
function BrawlBody({ player, run }: { player: BrawlProfile; run: number }) {
  const t = useTranslations('games');
  // Разряды узкими неразрывными пробелами: 68143 читается заметно хуже, чем
  // 68 143, а число тут главное на весь блок.
  const trophies = player.trophies.toLocaleString('ru-RU').replace(/\s/g, ' ');
  const under = [player.rank, player.club].filter(Boolean).join(' · ');

  return (
    <div>
      <Who name={player.name} />

      <div className="mt-2 flex items-center gap-3">
        {player.rankTier ? (
          <span
            style={{ width: SIZE, height: SIZE }}
            className="relative block shrink-0"
            aria-hidden="true"
          >
            <Image
              src={`/brawl/rank-${player.rankTier}.png`}
              alt=""
              width={SIZE * 2}
              height={SIZE * 2}
              // `object-contain`, а не растягивание по квадрату: значки разных
              // рангов идут разной ширины — от 211 до 334 при высоте около 320,
              // и каждый кривился бы по-своему.
              className="h-full w-full object-contain"
            />
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5 text-2xl font-semibold tabular-nums leading-tight text-ink">
            <Trophy />
            {trophies}
            {/* Рекорд — только когда до него не дотягиваешь. Пока стоишь на
                своём пике (а это обычное состояние) числа совпадают, и второе
                из них ничего не сообщает, только занимает место в плитке
                шириной с ладонь. Появляется ровно тогда, когда значит «ты
                просел», и тогда же объясняет себя подсказкой. */}
            {player.highest > player.trophies ? (
              <span
                className="text-sm font-medium text-ink-faint"
                title={t('peak', { peak: player.highest })}
              >
                {player.highest.toLocaleString('ru-RU').replace(/\s/g, ' ')}
              </span>
            ) : null}
          </p>
          {under ? (
            // `normal-case`: MYTHIC III и название клуба — имена собственные.
            <p className="mt-0.5 truncate text-sm normal-case text-ink-muted">{under}</p>
          ) : null}
          <Winrate
            wins={player.recentWins}
            played={player.recentPlayed}
            title={t('winrateRecent', {
              wins: player.recentWins,
              played: player.recentPlayed
            })}
          />
        </div>
      </div>

      {player.recent.length ? <Streak results={player.recent} run={run} /> : null}
    </div>
  );
}

/**
 * Кубок перед числом кубков.
 *
 * Нарисован здесь, а не взят картинкой: в наборе Brawlify его нет, а тащить
 * игровой файл с сомнительного места ради шестнадцати пикселей — плохой обмен.
 * Форма узнаваемая — чаша, две ручки, ножка на подставке, — и на своём золоте
 * читается с первого взгляда именно как кубок.
 *
 * Цвет — общий с «средним» винрейтом (`--amber`): один тон на две тёплые вещи
 * вместо двух почти одинаковых в палитре. Тон при этом приглушён замером, а не
 * вкусом: яркое золото на нашем фоне текстом нечитаемо, см. globals.css.
 */
function Trophy() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0 text-amber"
      fill="currentColor"
    >
      <path d="M6.5 2.5h11v5.2a5.5 5.5 0 0 1-11 0V2.5Z" />
      <path d="M5.5 3.6H2v2.6a4.6 4.6 0 0 0 4.2 4.6v-2.1a2.5 2.5 0 0 1-2.1-2.5v-.5h1.4V3.6Z" />
      <path d="M18.5 3.6H22v2.6a4.6 4.6 0 0 1-4.2 4.6v-2.1a2.5 2.5 0 0 0 2.1-2.5v-.5h-1.4V3.6Z" />
      <path d="M10.8 13.8h2.4v3.1h-2.4z" />
      <path d="M7.4 21.5h9.2l-1.3-3.2H8.7l-1.3 3.2Z" />
    </svg>
  );
}

/**
 * Винрейт, и цветом видно сразу, хороший он или нет.
 *
 * Пороги заданы владельцем: от 51 и выше — зелёный, 45–50 — янтарный, ниже 45 —
 * красный. Цифра при этом остаётся цифрой: цвет ускоряет чтение, но ничего не
 * сообщает сверх неё, поэтому тому, кто цвета не различает, ничего не теряется.
 *
 * За процентом стоит подпись при наведении — из чего он посчитан. У доты это
 * весь счёт побед за всё время, у Brawl Stars только журнал последних боёв, и
 * разница там не косметическая (см. `BrawlProfile.recentWins`). Одинаковые
 * снаружи числа обязаны уметь объяснить, что они разные.
 */
function Winrate({ wins, played, title }: { wins: number; played: number; title: string }) {
  if (!played) return null;

  const pct = Math.round((wins / played) * 100);
  const tone = pct >= 51 ? 'text-win' : pct >= 45 ? 'text-amber' : 'text-loss';

  return (
    <p className={`truncate text-sm font-semibold tabular-nums ${tone}`} title={title}>
      {pct}%
    </p>
  );
}

/**
 * Последние пять матчей: выиграл — зелёный, проиграл — красный.
 *
 * Плитками с буквой, а не одними буквами. Ящик в шторке серый, и просьба была
 * его оживить — цвет тут и есть то самое оживление, а буква внутри оставляет
 * смысл тому, кто цвета не различает. Так же это выглядит и на Dotabuff, откуда
 * взята медаль выше, поэтому читается без объяснений.
 *
 * Свежий слева. «Последние пять» читаются в том же порядке, в каком называются:
 * первым то, что случилось последним.
 *
 * Выезжают по очереди и заново при каждом открытии шторки — см. `run`. Ящик,
 * который каждый раз оживает на глазах, и есть разница между «данные лежат» и
 * «данные идут». Настройка «поменьше движения» гасит это глобальным правилом в
 * globals.css: плитки просто оказываются на месте.
 */
function Streak({ results, run }: { results: boolean[]; run: number }) {
  const t = useTranslations('games');
  const wins = results.filter(Boolean).length;

  return (
    // `role="img"` с подписью: вслух «в п в в п» — это шум, а не сведения.
    // Читающему с экрана достаётся итог одной фразой, плитки для него скрыты.
    <span
      key={run}
      role="img"
      aria-label={t('lastFive', { wins, losses: results.length - wins })}
      className="mt-2.5 flex gap-1"
    >
      {results.map((won, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ animationDelay: `${i * 55}ms` }}
          className={`grid h-[18px] w-[18px] shrink-0 animate-rise-in place-items-center rounded-sm text-[0.625rem] font-bold leading-none text-surface ${
            won ? 'bg-win' : 'bg-loss'
          }`}
        >
          {won ? t('win') : t('loss')}
        </span>
      ))}
    </span>
  );
}
