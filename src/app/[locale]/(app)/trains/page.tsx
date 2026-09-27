import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { Hint } from '@/components/Hint';
import { BoardIcon, RouteIcon } from '@/components/Icons';
import { Board } from '@/components/trains/Board';
import { BoardPicker } from '@/components/trains/BoardPicker';
import { Journeys } from '@/components/trains/Journeys';
import { MakeHome, SaveRoad } from '@/components/trains/Roads';
import { SavedRoads } from '@/components/trains/SavedRoads';
import { SearchForm } from '@/components/trains/SearchForm';
import { Link } from '@/i18n/routing';
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

type Query = {
  from?: string;
  to?: string;
  at?: string;
  mode?: string;
  board?: string;
  view?: string;
  /** Сколько лишних порций поездок подгрузить: 0, 1 или 2. */
  more?: string;
};

/**
 * Поезда: как отсюда попасть туда.
 *
 * Третий заход по виду, и каждый предыдущий чинил то, на что жаловался
 * владелец. Сперва было шесть одинаковых белых карточек в столбик — «монотонно,
 * не понять, где что». Потом стало три, и жалоба сменилась на точную: «у нас
 * выглядит сложнее, чем у SBB», и ещё — «нахрена внизу опять выбери станцию».
 *
 * Обе верные, и обе про одно: страница спрашивала бланком. Сайт, где задачи
 * живут листочками на булавках, не должен выглядеть анкетой.
 *
 * Сейчас так:
 *
 *   1. **панель** — заголовок, переключатель «маршрут / табло» и сам маршрут,
 *      нарисованный точками и линией, а не двумя полями в рамках;
 *   2. **ответ** — блоками, как на табло у SBB: чем едешь, время с ниткой,
 *      мелочи снизу. Плоский список строк читался таблицей;
 *   3. **своё** — тихим хвостом под ответом, без карточки.
 *
 * Домашняя станция переехала на вкладку табло. На поиске станции выбирают и
 * так, двумя полями, и третье поле внизу спрашивало о том же в третий раз;
 * табло — единственное место, где вопрос «какая станция твоя» стоит сам по
 * себе.
 *
 * Выбранное живёт в адресной строке — станции, время, режим, вкладка, станция
 * табло, — по той же причине, что масштаб календаря: ссылку можно бросить в
 * чат, «назад» работает, перезагрузка не теряет место.
 *
 * Разговоры с SBB завёрнуты в `<Suspense>`. Панель и дороги рисуются мгновенно
 * из базы, расписание доезжает следом — иначе человек смотрел бы на пустой
 * экран из-за того, чего не спрашивал.
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

  const more = Math.min(2, Math.max(0, Number(query.more) || 0));
  const onBoard = query.view === 'board';
  // Табло: что попросили, иначе станция поиска, иначе своя, иначе HB.
  const asked = pickStop(query.board);
  const boardStop = asked ?? from?.id ?? home?.id ?? HB_STOP;
  const boardStation = asked ? await look(asked) : (from ?? home);
  const serverNow = Date.now();

  // Свои станции: дом, станции остальных и оба конца каждой сохранённой
  // дороги. Поле предлагает их до того, как человек начал печатать: девять
  // поездок из десяти идут по тем же четырём станциям, и заставлять вспоминать
  // точное название незачем.
  const known: Station[] = [];
  for (const station of [
    home,
    ...friends.map((friend) => friend.station),
    ...roads.flatMap((road) => [
      { id: road.fromId, name: road.fromName },
      { id: road.toId, name: road.toName }
    ])
  ]) {
    if (station && !known.some((had) => had.id === station.id)) known.push(station);
  }

  // Возврат к маршруту не теряет уже найденное.
  const backToRoute = from && to ? `/trains?from=${from.id}&to=${to.id}` : '/trains';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-3 sm:p-4">
      {/* `relative z-20` — не украшение: списки станций и панель «когда»
          всплывают внутри этой карточки, а секции ниже идут в потоке после
          неё и рисовались поверх. Панель открывалась и оказывалась под
          первой же найденной поездкой. */}
      <section className="block-card animate-rise-in relative z-20 flex flex-col gap-6 px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {/* Над заголовком — название раздела, а не пересказ заголовка: «куда
                едем» дважды подряд читалось как заикание. */}
            <p className="ps-label">{t('title')}</p>
            <h1 className="text-greeting font-medium leading-none text-ink">{t('heading')}</h1>
          </div>

          {/* Две вкладки — ссылками, а не состоянием: обе половины считаются на
              сервере, и обе должны жить в адресе. Вид тот же, что у масштабов
              календаря, — на сайте это уже язык «выбери одно из». */}
          <nav className="flex shrink-0 items-center gap-1" aria-label={t('kicker')}>
            <Tab href={backToRoute} on={!onBoard} icon={<RouteIcon />}>
              {t('tabRoute')}
            </Tab>
            <Tab href={`/trains?view=board&board=${boardStop}`} on={onBoard} icon={<BoardIcon />}>
              {t('boardTitle')}
            </Tab>
          </nav>
        </div>

        {onBoard ? (
          <BoardPicker station={boardStation} />
        ) : (
          // `key` по концам маршрута — не украшение. Состояние формы заводится
          // от свойств один раз, при монтировании; без ключа переход по
          // сохранённой дороге менял адрес, а поля оставались пустыми, и
          // казалось, что нажатие не сработало.
          <SearchForm
            key={`${from?.id ?? ''}-${to?.id ?? ''}`}
            from={from}
            to={to}
            at={at}
            arriving={arriving}
            home={home}
            friends={friends}
            known={known}
          />
        )}
      </section>

      {onBoard ? (
        <>
          <section className="animate-rise-in flex flex-col gap-3 px-2 [animation-delay:60ms] sm:px-3">
            <p className="ps-label normal-case text-ink-faint">{boardStation?.name ?? t('boardStation')}</p>
            <Suspense key={boardStop} fallback={<Waiting text={t('asking')} />}>
              <BoardFor stop={boardStop} serverNow={serverNow} />
            </Suspense>
          </section>

          {/* Станция спрашивается один раз — наверху. Здесь только «сделать
              своей»: человек уже смотрит на её табло, второе такое же поле
              внизу спрашивало о том же ещё раз. */}
          <section
            id="station"
            className="animate-rise-in flex scroll-mt-20 flex-col gap-2 border-t border-rule-soft px-2 pt-5 [animation-delay:120ms] sm:px-3"
          >
            <Hint label={t('whatIsThis')}>{t('homeHint')}</Hint>
            <MakeHome station={boardStation} isHome={Boolean(home && boardStation && home.id === boardStation.id)} />
          </section>
        </>
      ) : (
        <>
          {from && to ? (
            <section className="animate-rise-in flex flex-col gap-3 px-2 [animation-delay:60ms] sm:px-3">
              <p className="ps-label normal-case text-ink-faint">
                {from.name} → {to.name}
              </p>

              <Suspense fallback={<Waiting text={t('asking')} />}>
                <Found
                  from={from.id}
                  to={to.id}
                  at={at}
                  arriving={arriving}
                  more={more}
                  serverNow={serverNow}
                />
              </Suspense>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {more < 2 ? (
                  <Link
                    href={`/trains?from=${from.id}&to=${to.id}${at ? `&at=${at}` : ''}${
                      arriving ? '&mode=arrive' : ''
                    }&more=${more + 1}`}
                    scroll={false}
                    className="rounded-full border-2 border-rule px-4 py-1.5 text-sm text-ink-muted transition-colors duration-drape ease-drape hover:bg-sunk hover:text-ink"
                  >
                    {t('later')}
                  </Link>
                ) : null}
                <SaveRoad from={from} to={to} />
              </div>
            </section>
          ) : null}

          {/* Дороги показывают ближайший поезд сами — ради этого их и
              сохраняют. Закладка, которая только заполняет форму, экономит два
              нажатия и не стоит того, чтобы её заводить. */}
          <section
            id="roads"
            className="animate-rise-in flex scroll-mt-20 flex-col gap-3 border-t border-rule-soft px-2 pt-6 [animation-delay:120ms] sm:px-3"
          >
            <p className="ps-label">{t('roadsTitle')}</p>
            <SavedRoads roads={roads} serverNow={serverNow} />
          </section>
        </>
      )}

    </div>
  );
}

function Tab({
  href,
  on,
  icon,
  children
}: {
  href: string;
  on: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={`flex h-11 items-center gap-2 rounded border-2 px-4 text-base transition-colors duration-drape ease-drape ${
        on ? 'border-ink bg-ink text-canvas' : 'border-rule text-ink-muted hover:bg-sunk hover:text-ink'
      }`}
    >
      {icon}
      {children}
    </Link>
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
    <p className="animate-pulse px-1 text-base text-ink-faint" role="status">
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
  more,
  serverNow
}: {
  from: string;
  to: string;
  at: string;
  arriving: boolean;
  more: number;
  serverNow: number;
}) {
  const t = await getTranslations('trains');
  const when = at ? zurich(at) : null;

  try {
    // Порции идут параллельно и склеиваются: каждая лежит в своём кеше, и
    // «ещё» второй раз стоит одного нового запроса, а не всех заново.
    const pages = await Promise.all(
      Array.from({ length: more + 1 }, (_, page) => journeys({ from, to, when, arriving, page }))
    );
    const list: typeof pages[number] = [];
    for (const page of pages) {
      for (const journey of page) {
        if (!list.some((had) => had.departs === journey.departs && had.arrives === journey.arrives)) {
          list.push(journey);
        }
      }
    }
    list.sort((a, b) => a.departs - b.departs);
    return <Journeys list={list} serverNow={serverNow} />;
  } catch (error) {
    console.warn('[podshar] SBB не ответили на поиск:', error instanceof Error ? error.message : error);
    return <p className="px-1 text-base font-medium text-ink-muted">{t('unavailable')}</p>;
  }
}

async function BoardFor({ stop, serverNow }: { stop: string; serverNow: number }) {
  const t = await getTranslations('trains');
  try {
    return <Board rows={await stationBoard(stop)} serverNow={serverNow} />;
  } catch (error) {
    console.warn('[podshar] SBB не ответили на табло:', error instanceof Error ? error.message : error);
    return <p className="px-1 text-base font-medium text-ink-muted">{t('unavailable')}</p>;
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
