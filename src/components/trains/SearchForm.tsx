'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { DayField } from '@/components/calendar/DayField';
import { useRouter } from '@/i18n/routing';
import type { SavedRoad, Station } from '@/lib/types';
import { StationField } from './StationField';

/**
 * Откуда, куда и когда.
 *
 * Найденное живёт в адресной строке, а не в состоянии, — то же решение, что у
 * масштаба календаря и списка задач: ссылку можно бросить в чат, «назад»
 * работает, перезагрузка не теряет место. Поэтому форма не хранит результат,
 * она только переписывает адрес, а считает уже страница на сервере.
 *
 * Кнопка поиска не нажимается, пока обе станции не **выбраны**. Раньше в такой
 * форме принимался набранный текст, и человек, написавший «Bern» без выбора,
 * получал молча не ту станцию. Лучше не пустить, чем соврать.
 *
 * Раскладка держится на двух правилах, и оба из жалобы владельца «кнопки лежат
 * незакономерно». Первое: **всё в одном ряду одного роста** (`h-11`) — поля,
 * переключатели и кнопка, — иначе глаз не видит ряда, он видит россыпь.
 * Второе: **каждая группа названа**. «когда» подписывает день, час и выбор
 * между отправлением и прибытием; «быстро» подписывает готовые дороги. Без
 * подписей это восемь одинаковых прямоугольников, про которые надо вспоминать,
 * что есть что.
 *
 * День выбирается **нашей сеткой** (`DayField` из календаря), а не системным
 * `<input type="date">`: системный говорит на языке браузера, а не страницы —
 * на русской странице он писал `TT.mm.jjjj`, потому что Edge тут немецкий.
 * Час остаётся системным `type="time"`: он рисует только два числа.
 */
export function SearchForm({
  from,
  to,
  at,
  arriving,
  home,
  friends,
  roads
}: {
  from: Station | null;
  to: Station | null;
  /** «ГГГГ-ММ-ДДTЧЧ:ММ» по цюрихскому времени, или пусто — значит «сейчас». */
  at: string;
  arriving: boolean;
  home: Station | null;
  friends: { name: string; station: Station }[];
  roads: SavedRoad[];
}) {
  const t = useTranslations('trains');
  const router = useRouter();

  const [a, setA] = useState<Station | null>(from);
  const [b, setB] = useState<Station | null>(to);
  const [clock, setClock] = useState(at.slice(11, 16));
  const [arrive, setArrive] = useState(arriving);
  const form = useRef<HTMLFormElement>(null);

  const ready = Boolean(a?.id && b?.id && a.id !== b.id);
  const anyQuick = Boolean(home) || friends.length > 0 || roads.length > 0;

  function go(next?: { from?: Station | null; to?: Station | null }) {
    const one = next?.from !== undefined ? next.from : a;
    const two = next?.to !== undefined ? next.to : b;
    if (!one?.id || !two?.id || one.id === two.id) return;

    // День лежит в скрытом поле `DayField`, а не в состоянии: свой компонент
    // календаря ведёт его сам, и читать его через форму дешевле, чем добавлять
    // ему обратный вызов ради одного места.
    const day = String(new FormData(form.current ?? undefined).get('day') ?? '');

    const params = new URLSearchParams({ from: one.id, to: two.id });
    // Выбран день без часа — берём текущий по Цюриху: человек, ткнувший
    // «завтра», имел в виду «в это же время», а не «в полночь».
    if (day) params.set('at', `${day}T${clock || nowInZurich()}`);
    if (arrive) params.set('mode', 'arrive');
    router.push(`/trains?${params.toString()}`);
  }

  return (
    <form
      ref={form}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        go();
      }}
    >
      {/* Концы маршрута — главное на форме, поэтому они одни в своём ряду и
          занимают всю ширину. Перевёртыш стоит между ними, а не сбоку: он про
          то, что слева и справа, и на своём месте не требует подписи. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <StationField name="from" label={t('from')} station={a} onPick={setA} />

        <button
          type="button"
          onClick={() => {
            const was = a;
            setA(b);
            setB(was);
          }}
          className="-my-1 grid h-11 w-11 shrink-0 place-items-center self-center rounded border-2 border-rule text-ink-muted transition-colors duration-drape ease-drape hover:bg-sunk hover:text-ink sm:my-0 sm:self-end"
          aria-label={t('swap')}
          title={t('swap')}
        >
          <svg
            viewBox="0 0 16 16"
            // Поля на телефоне стоят друг под другом, на столе — рядом.
            // Стрелки показывают то направление, в котором поменяются местами.
            className="h-4 w-4 sm:-rotate-90"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M4.5 2.5v11M4.5 13.5 2 11M11.5 13.5v-11M11.5 2.5 14 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <StationField name="to" label={t('to')} station={b} onPick={setB} />
      </div>

      {/* Когда ехать и в какую сторону считать — один ряд, всё ростом `h-11`.
          Группу держит близость: день, час и выбор стоят вплотную, а кнопка
          поиска отжата в конец ряда, потому что она не про время. */}
      <div className="flex flex-wrap items-end gap-x-2 gap-y-4">
        <DayField name="day" label={t('day')} value={at.slice(0, 10)} clearable />

        <label className="flex flex-col gap-1">
          <span className="ps-label">{t('clock')}</span>
          <input
            type="time"
            value={clock}
            onChange={(event) => setClock(event.target.value)}
            className="h-11 rounded border-2 border-rule bg-canvas px-3 text-[1rem] text-ink outline-none transition-colors duration-drape ease-drape focus:border-ink sm:text-base"
          />
        </label>

        <div className="ms-1 flex items-end gap-1" role="group" aria-label={t('when')}>
          <Toggle on={!arrive} onClick={() => setArrive(false)}>
            {t('leaveAt')}
          </Toggle>
          <Toggle on={arrive} onClick={() => setArrive(true)}>
            {t('arriveBy')}
          </Toggle>
        </div>

        <button
          type="submit"
          disabled={!ready}
          className="h-11 w-full rounded border-2 border-ink bg-ink px-6 text-base font-medium text-canvas transition-opacity duration-drape ease-drape disabled:cursor-not-allowed disabled:opacity-30 sm:ms-auto sm:w-auto"
        >
          {t('search')}
        </button>
      </div>

      {!ready && (a?.id || b?.id) ? <p className="text-sm text-ink-faint">{t('pickBoth')}</p> : null}

      {/* Быстрые дороги. Каждая — «подставить и сразу искать»: человек, нажавший
          «домой», пришёл за поездом, а не за заполненной формой. */}
      {anyQuick ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
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

          {roads.map((road) => (
            <Quick
              key={road.id}
              onClick={() => {
                const one = { id: road.fromId, name: road.fromName };
                const two = { id: road.toId, name: road.toName };
                setA(one);
                setB(two);
                go({ from: one, to: two });
              }}
            >
              {road.label || `${road.fromName} → ${road.toName}`}
            </Quick>
          ))}
        </div>
      ) : null}
    </form>
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

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`h-11 rounded border-2 px-3 text-base transition-colors duration-drape ease-drape ${
        on ? 'border-ink bg-ink text-canvas' : 'border-rule text-ink-muted hover:bg-sunk hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
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
