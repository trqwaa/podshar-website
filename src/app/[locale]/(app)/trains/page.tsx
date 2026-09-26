import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { Board } from '@/components/trains/Board';
import { BoardPicker } from '@/components/trains/BoardPicker';
import { Journeys } from '@/components/trains/Journeys';
import { HomeStation, Roads, SaveRoad } from '@/components/trains/Roads';
import { SearchForm } from '@/components/trains/SearchForm';
import { readSession } from '@/lib/auth/session';
import { resolveLocale } from '@/lib/locale';
import { HB_STOP, journeys, stationBoard, stationById } from '@/lib/sbb';
import { homeStation, otherStations, savedRoads } from '@/lib/travel/saved';
import type { Station } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'trains' });
  return { title: t('title') };
}

type Query = { from?: string; to?: string; at?: string; mode?: string; board?: string };

/**
 * Поезда: как отсюда попасть туда.
 *
 * Поиск, табло станции и сохранённые дороги на одной странице. Всё, что человек
 * выбрал, живёт в адресной строке — станции, время, режим, станция табло, — по
 * той же причине, что масштаб календаря: ссылку можно бросить в чат, «назад»
 * работает, перезагрузка не теряет место.
 *
 * Разговоры с SBB завёрнуты в `<Suspense>`, каждый в свой. Каркас, форма и
 * список дорог рисуются мгновенно из базы, а расписание доезжает следом —
 * иначе одна медленная поездка держала бы и табло, и список, и человек смотрел
 * бы на пустой экран из-за того, чего не спрашивал.
 *
 * Домашняя станция переехала сюда из профиля вместе со всем поездным: настройка
 * поездная, и место ей рядом с поездами, а не между паролем и приглашениями.
 */
export default async function TrainsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Query>;
}) {
  const locale = resolveLocale((await params).locale);
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'trains' });

  const session = await readSession();
  const [home, friends, roads] = session
    ? await Promise.all([
        homeStation(session.userId),
        otherStations(session.userId),
        savedRoads(session.userId)
      ])
    : [null, [], []];

  // Номера из адреса — это чужой ввод. Имена к ним берутся у SBB, а не из
  // ссылки: иначе подсунутое имя станции стояло бы в заголовке страницы.
  const [from, to] = await Promise.all([look(query.from), look(query.to)]);
  const arriving = query.mode === 'arrive';
  const at = typeof query.at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(query.at) ? query.at : '';

  // Табло: что попросили, иначе станция поиска, иначе своя, иначе HB.
  const boardStop = pickStop(query.board) ?? from?.id ?? home?.id ?? HB_STOP;
  const serverNow = Date.now();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-3 sm:gap-4 sm:p-4">
      <header className="block-card animate-rise-in flex flex-col gap-2 px-6 py-8 sm:px-8">
        <p className="ps-label">{t('kicker')}</p>
        <h1 className="text-greeting font-medium leading-tight text-ink">{t('title')}</h1>
        <p className="max-w-xl text-base leading-relaxed text-ink-muted">{t('intro')}</p>
      </header>

      <section className="block-card animate-rise-in flex flex-col gap-4 px-6 py-6 [animation-delay:60ms] sm:px-8">
        <SearchForm
          from={from}
          to={to}
          at={at}
          arriving={arriving}
          home={home}
          friends={friends}
          roads={roads}
        />
      </section>

      {from && to ? (
        <section className="block-card animate-rise-in flex flex-col gap-4 px-6 py-6 [animation-delay:90ms] sm:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="ps-label normal-case">
              {from.name} → {to.name}
            </p>
            <p className="ps-label text-ink-faint">{arriving ? t('arriveBy') : t('leaveAt')}</p>
          </div>

          <Suspense fallback={<Waiting text={t('asking')} />}>
            <Found from={from.id} to={to.id} at={at} arriving={arriving} serverNow={serverNow} />
          </Suspense>

          <div className="border-t border-rule pt-4">
            <SaveRoad from={from} to={to} />
          </div>
        </section>
      ) : null}

      <section className="block-card animate-rise-in flex flex-col gap-4 px-6 py-6 [animation-delay:120ms] sm:px-8">
        <p className="ps-label">{t('boardTitle')}</p>
        <BoardPicker station={boardStop === from?.id ? from : boardStop === home?.id ? home : null} />
        <Suspense key={boardStop} fallback={<Waiting text={t('asking')} />}>
          <BoardFor stop={boardStop} serverNow={serverNow} />
        </Suspense>
      </section>

      <section
        id="roads"
        className="block-card animate-rise-in flex scroll-mt-20 flex-col gap-4 px-6 py-6 [animation-delay:150ms] sm:px-8"
      >
        <div className="flex flex-col gap-1">
          <p className="ps-label">{t('roadsTitle')}</p>
          <p className="text-sm text-ink-muted">{t('roadsHint')}</p>
        </div>
        <Roads roads={roads} />
      </section>

      <section
        id="station"
        className="block-card animate-rise-in flex scroll-mt-20 flex-col gap-4 px-6 py-6 [animation-delay:180ms] sm:px-8"
      >
        <div className="flex flex-col gap-1">
          <p className="ps-label">{t('homeTitle')}</p>
          <p className="text-sm text-ink-muted">{t('homeHint')}</p>
        </div>
        <HomeStation station={home} />
      </section>
    </div>
  );
}

function pickStop(value: unknown): string | null {
  return typeof value === 'string' && /^\d{3,12}$/.test(value) ? value : null;
}

/** Номер из адреса — в станцию с настоящим именем. Не нашлась или SBB молчат — просто нет. */
async function look(value: unknown): Promise<Station | null> {
  const stop = pickStop(value);
  if (!stop) return null;
  try {
    return await stationById(stop);
  } catch {
    return null;
  }
}

function Waiting({ text }: { text: string }) {
  return (
    <p className="animate-pulse text-base text-ink-faint" role="status">
      {text}
    </p>
  );
}

/**
 * Найденные поездки.
 *
 * Отдельным компонентом, чтобы `<Suspense>` было что ждать: у Next граница
 * ожидания работает вокруг того, кто сам уходит в ожидание, а не вокруг куска
 * разметки.
 */
async function Found({
  from,
  to,
  at,
  arriving,
  serverNow
}: {
  from: string;
  to: string;
  at: string;
  arriving: boolean;
  serverNow: number;
}) {
  const t = await getTranslations('trains');

  // Локальное время Цюриха, набранное человеком. `new Date('...T18:00')` без
  // пояса читается как местное время сервера — на Vercel это UTC, и поиск
  // уезжал бы на два часа. Поэтому час и день едут в SBB строками, а сюда
  // передаётся только момент «примерно тогда», от которого он считает.
  const when = at ? zurich(at) : null;

  try {
    const list = await journeys({ from, to, when, arriving });
    return <Journeys list={list} serverNow={serverNow} />;
  } catch (error) {
    console.warn('[podshar] SBB не ответили на поиск:', error instanceof Error ? error.message : error);
    return <p className="text-base font-medium text-ink-muted">{t('unavailable')}</p>;
  }
}

async function BoardFor({ stop, serverNow }: { stop: string; serverNow: number }) {
  const t = await getTranslations('trains');
  try {
    return <Board rows={await stationBoard(stop)} serverNow={serverNow} />;
  } catch (error) {
    console.warn('[podshar] SBB не ответили на табло:', error instanceof Error ? error.message : error);
    return <p className="text-base font-medium text-ink-muted">{t('unavailable')}</p>;
  }
}

/**
 * «2026-09-27T18:00», набранное человеком, — в настоящий момент времени.
 *
 * Считается через смещение Цюриха в этот день, а не `new Date(строка)`:
 * без пояса строка читается как местное время сервера, а сервер на Vercel
 * живёт в UTC. Летом это ровно два часа мимо.
 */
function zurich(local: string): Date {
  const naive = new Date(`${local}:00Z`);
  const shown = new Date(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Zurich',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(naive)
  );
  return new Date(naive.getTime() + (naive.getTime() - shown.getTime()));
}
