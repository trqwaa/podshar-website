'use client';

import { useEffect, useState } from 'react';
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

/** Сколько пикселей занимает медаль в шторке. */
const SIZE = 52;

type Answer = { dota: DotaProfile | null; linked?: boolean };
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
export function DotaBlock() {
  const t = useTranslations('games');
  const [state, setState] = useState<State>({ kind: 'wait' });

  useEffect(() => {
    let alive = true;
    fetch('/api/games')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((answer: Answer) => {
        if (!alive) return;
        if (answer.dota) setState({ kind: 'got', ...answer });
        else setState({ kind: answer.linked ? 'off' : 'none' });
      })
      .catch(() => alive && setState({ kind: 'off' }));
    // Отменяем не запрос, а то, что случится после: ответ всё равно ляжет в
    // кеш браузера и достанется следующему открытию бесплатно.
    return () => {
      alive = false;
    };
  }, []);

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
          <Link
            href="/profile"
            className="underline decoration-rule underline-offset-4 hover:text-ink"
          >
            {t('link')}
          </Link>
        </p>
      ) : null}

      {state.kind === 'off' ? <p className="mt-2 text-sm text-ink-muted">{t('quiet')}</p> : null}

      {state.kind === 'got' && state.dota ? <Rank player={state.dota} /> : null}
    </div>
  );
}

function Rank({ player }: { player: DotaProfile }) {
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
      </div>
    </div>
  );
}
