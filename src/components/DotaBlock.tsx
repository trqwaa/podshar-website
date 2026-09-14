'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import type { DotaProfile } from '@/lib/types';

/**
 * Медаль в доте — та самая, что на Dotabuff.
 *
 * Названия не переводятся. Никто из играющих не говорит «Крестоносец» — говорят
 * Crusader или «кресты», на всех четырёх языках сайта одинаково. Перевод был бы
 * вежливее и при этом менее понятен тем троим, ради кого всё это пишется. То же
 * исключение, что у списка патчей и у «HB».
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
 * Сколько пикселей занимает медаль в шторке.
 *
 * Было 52 — ровно под две строки текста рядом. С полоской матчей строк стало
 * три, и медаль рядом с ними читалась мелкой: она тут главное, а выглядела
 * припиской к тексту.
 */
const SIZE = 58;

// `linked` обязателен: маршрут возвращает его из каждой ветки. Необязательное
// поле тут означало бы, что «не привязан» и «не смогли посмотреть» приезжают
// одним и тем же `undefined`, а это два разных ответа человеку.
type Answer = { dota: DotaProfile | null; linked: boolean };
type State = { kind: 'wait' } | { kind: 'none' } | { kind: 'off' } | (Answer & { kind: 'got' });

/**
 * Цифры из доты, которые шторка спрашивает сама, уже после загрузки страницы.
 *
 * Запрос идёт из браузера, а не из рендера, и это не лень, а единственный
 * возможный вариант: `getQuickStats` ждёт вся страница целиком (см.
 * `api/games/route.ts`), так что один медленный ответ OpenDota подвесил бы
 * главную из-за плитки, лежащей в закрытой шторке. Здесь ждёт только шторка — и
 * только тогда, когда её открыли.
 *
 * Ни одно из состояний не молчит. «Не дозвонились» и «аккаунт не привязан» —
 * разные вещи, и человек, глядящий на пустой блок, должен понимать, чинить ему
 * что-то или нет.
 */
export function DotaBlock({ open }: { open: boolean }) {
  const t = useTranslations('games');
  const [state, setState] = useState<State>({ kind: 'wait' });

  /**
   * Счётчик открытий шторки — он же ключ для полоски матчей.
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
      .then((answer: Answer) => {
        if (!alive) return;
        if (answer.dota) setState({ kind: 'got', ...answer });
        else setState({ kind: answer.linked ? 'off' : 'none' });
      })
      .catch(() => alive && setState({ kind: 'off' }));
    // Отменяется не запрос, а то, что случится после его возвращения: панель
    // могли уже закрыть, а `setState` на снятом компоненте — ошибка в консоли
    // на ровном месте.
    return () => {
      alive = false;
    };
  }, [open]);

  return (
    <div className="rounded border-2 border-rule bg-canvas p-3">
      <p className="text-[0.7rem] lowercase leading-tight tracking-label text-ink-muted">
        {t('dota')}
      </p>

      {state.kind === 'wait' ? (
        <span className="mt-2 flex items-center gap-3">
          <span
            style={{ width: SIZE, height: SIZE }}
            className="shrink-0 animate-pulse rounded-sm bg-sunk"
          />
          <span className="h-5 flex-1 animate-pulse rounded-sm bg-sunk" />
        </span>
      ) : null}

      {/* Не играет, или ещё не сказал где. Ссылка ведёт туда, где это чинится —
          иначе строка сообщает о проблеме и бросает с ней наедине. */}
      {state.kind === 'none' ? (
        <p className="mt-2 text-sm text-ink-muted">
          {/* Прямо к полю, а не на верх профиля: человек нажал «привязать
              аккаунт» ради одного поля, и искать его среди пяти блоков — работа,
              которую он не просил. Якорь стоит в `(app)/profile/page.tsx`. */}
          <Link
            href="/profile#dota"
            className="underline decoration-rule underline-offset-4 hover:text-ink"
          >
            {t('link')}
          </Link>
        </p>
      ) : null}

      {state.kind === 'off' ? <p className="mt-2 text-sm text-ink-muted">{t('quiet')}</p> : null}

      {state.kind === 'got' && state.dota ? <Rank player={state.dota} run={run} /> : null}
    </div>
  );
}

function Rank({ player, run }: { player: DotaProfile; run: number }) {
  const t = useTranslations('games');
  const total = player.wins + player.losses;

  return (
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
        <p className="truncate text-sm tabular-nums text-ink-muted">
          {player.leaderboard
            ? t('place', { place: player.leaderboard })
            : total
              ? t('record', { wins: player.wins, losses: player.losses })
              : (player.name ?? '')}
        </p>
        {player.recent.length ? <Streak results={player.recent} run={run} /> : null}
      </div>
    </div>
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
      className="mt-1.5 flex gap-1"
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
