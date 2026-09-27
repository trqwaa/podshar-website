'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/routing';
import type { Station } from '@/lib/types';
import { SearchIcon } from '@/components/Icons';
import { StationField } from './StationField';
import { WhenField } from './WhenField';

/**
 * Откуда и куда — нарисованным маршрутом, а не двумя прямоугольниками.
 *
 * Третий заход, и снова по жалобе владельца: «у нас выглядит сложнее, чем у
 * SBB». Так и было. Коробка с полями, коробка с кнопками, коробка с дорогами —
 * каждая честная, а вместе они читались как анкета. Сайт, где задачи живут
 * листочками на булавках, не должен спрашивать про поезд бланком.
 *
 * Поэтому здесь нарисован сам маршрут: закрашенная точка — откуда, пустая —
 * куда, подчёркивания под именами станций работают линией, перевёртыш сидит
 * между ними. Это те же точки и та же нитка, которой потом покажется найденная
 * поездка, — поиск выглядит как свой собственный ответ.
 *
 * Всё остальное — день, час, сторона отсчёта — уведено вниз и сделано тише:
 * эти три вещи трогают редко, а занимали они столько же места, сколько сам
 * маршрут.
 *
 * Найденное живёт в адресной строке, а не в состоянии: ссылку можно бросить в
 * чат, «назад» работает, перезагрузка не теряет место. Кнопка поиска не
 * нажимается, пока обе станции не **выбраны из списка**: раньше форма
 * принимала набранный текст и подставляла не ту станцию молча.
 */
export function SearchForm({
  from,
  to,
  at,
  arriving,
  home,
  friends,
  known
}: {
  from: Station | null;
  to: Station | null;
  /** «ГГГГ-ММ-ДДTЧЧ:ММ» по цюрихскому времени, или пусто — значит «сейчас». */
  at: string;
  arriving: boolean;
  home: Station | null;
  friends: { name: string; station: Station }[];
  /** Свои станции — их поле предлагает до того, как начали печатать. */
  known: Station[];
}) {
  const t = useTranslations('trains');
  const router = useRouter();

  const [a, setA] = useState<Station | null>(from);
  const [b, setB] = useState<Station | null>(to);
  const [day, setDay] = useState(at.slice(0, 10));
  const [clock, setClock] = useState(at.slice(11, 16));
  const [arrive, setArrive] = useState(arriving);

  const ready = Boolean(a?.id && b?.id && a.id !== b.id);
  const anyQuick = Boolean(home) || friends.length > 0;

  function go(next?: { from?: Station | null; to?: Station | null }) {
    const one = next?.from !== undefined ? next.from : a;
    const two = next?.to !== undefined ? next.to : b;
    if (!one?.id || !two?.id || one.id === two.id) return;

    const params = new URLSearchParams({ from: one.id, to: two.id });
    // Выбран день без часа — берём текущий по Цюриху: человек, ткнувший
    // «завтра», имел в виду «в это же время», а не «в полночь».
    if (day) params.set('at', `${day}T${clock || nowInZurich()}`);
    if (arrive) params.set('mode', 'arrive');
    router.push(`/trains?${params.toString()}`);
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        go();
      }}
    >
      {/* Каждому своё поле — свой блок. Владелец про это сказал прямо: всё в
          одной рамке читается кашей, и волосяные линии внутри неё не спасают.
          Раскладка — по его же наброску: широкий блок с маршрутом сверху, под
          ним два рядом, снизу полоса готовых дорог.

          `z-30` — списки станций всплывают отсюда и должны лежать поверх
          соседних блоков, а не под ними. */}
      <div className="block-card relative z-30 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end sm:gap-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-end gap-3">
          <Dot />
          <StationField name="from" label={t('from')} station={a} onPick={setA} suggest={known} bare />
        </div>

        <button
          type="button"
          onClick={() => {
            const was = a;
            setA(b);
            setB(was);
          }}
          className="grid h-10 w-10 shrink-0 place-items-center self-center rounded-full border-2 border-rule text-ink-muted transition-colors duration-drape ease-drape hover:bg-sunk hover:text-ink sm:mb-0 sm:self-end"
          aria-label={t('swap')}
          title={t('swap')}
        >
          <svg
            viewBox="0 0 16 16"
            // Стрелки показывают ту сторону, в которую концы поменяются
            // местами: на телефоне поля друг под другом, на столе — рядом.
            className="h-4 w-4 sm:-rotate-90"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M4.5 2.5v11M4.5 13.5 2 11M11.5 13.5v-11M11.5 2.5 14 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex min-w-0 flex-1 items-end gap-3">
          <Dot hollow />
          <StationField name="to" label={t('to')} station={b} onPick={setB} suggest={known} bare />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="block-card relative z-20 min-w-0 flex-1">
          <WhenField
            day={day}
            clock={clock}
            arrive={arrive}
            bare
            onChange={(next) => {
              if (next.day !== undefined) setDay(next.day);
              if (next.clock !== undefined) setClock(next.clock);
              if (next.arrive !== undefined) setArrive(next.arrive);
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!ready}
          className="flex items-center justify-center gap-2 rounded-block border-2 border-ink bg-ink px-8 py-4 text-base font-medium text-canvas transition-opacity duration-drape ease-drape disabled:cursor-not-allowed disabled:opacity-30 sm:py-0"
        >
          <SearchIcon className="h-5 w-5" />
          {t('search')}
        </button>
      </div>

      {!ready && (a?.id || b?.id) ? (
        <p className="px-2 text-sm text-ink-faint sm:px-3">{t('pickBoth')}</p>
      ) : null}

      {/* Дом и свои — «подставить и сразу искать»: человек, нажавший «домой»,
          пришёл за поездом, а не за заполненной формой. Сохранённых дорог тут
          нет намеренно: они лежат ниже карточками и показывают время сами. */}
      {anyQuick ? (
        <div className="block-card flex flex-wrap items-center gap-2 px-5 py-4 sm:px-6">
          <span className="ps-label me-1 text-ink-faint">{t('quick')}</span>

          {home ? (
            <Quick
              onClick={() => {
                setB(home);
                go({ to: home });
              }}
            >
              {t('toHome')}
            </Quick>
          ) : null}

          {friends.map((friend) => (
            <Quick
              key={friend.station.id}
              onClick={() => {
                setB(friend.station);
                go({ to: friend.station });
              }}
            >
              {t('toFriend', { name: friend.name })}
            </Quick>
          ))}
        </div>
      ) : null}
    </form>
  );
}

/** Конец маршрута: закрашенная точка — откуда, пустая — куда. */
function Dot({ hollow = false }: { hollow?: boolean }) {
  return (
    <span className="mb-1.5 flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden="true">
      <span className={`block h-3 w-3 rounded-full border-2 border-ink ${hollow ? 'bg-canvas' : 'bg-ink'}`} />
    </span>
  );
}

/** «ЧЧ:ММ» прямо сейчас в Цюрихе — в поясе сайта, а не браузера. */
function nowInZurich(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
}

function Quick({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border-2 border-rule px-3 py-1.5 text-sm text-ink-muted transition-colors duration-drape ease-drape hover:bg-sunk hover:text-ink"
    >
      {children}
    </button>
  );
}
