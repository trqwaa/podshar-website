import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { journeys } from '@/lib/sbb';
import type { SavedRoad } from '@/lib/types';
import { RoadRow } from './Roads';

/**
 * Дороги с живым временем.
 *
 * Каждая идёт к SBB за своим ближайшим поездом, и каждая в своём `<Suspense>`:
 * одна медленная дорога не держит остальные, и список появляется по строке, а
 * не целиком в конце.
 *
 * Ответы лежат в кеше Next минуту (`LIVE_TTL` в `lib/sbb.ts`), поэтому троих,
 * открывших раздел подряд, источник не замечает. Потолок в четыре дороги — не
 * про вёрстку, а про эти запросы: у `transport.opendata.ch` около тысячи
 * обращений в сутки на адрес, а раздел открывают по многу раз в день.
 * Остальные дороги никуда не деваются, они просто не спрашивают время сами.
 */

/** Сколько дорог показывают время сами. Дальше — только имя и «открыть». */
const LIVE = 4;

export async function SavedRoads({ roads, serverNow }: { roads: SavedRoad[]; serverNow: number }) {
  const t = await getTranslations('trains');

  if (roads.length === 0) {
    return <p className="text-base text-ink-muted">{t('noRoads')}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {roads.map((road, index) => (
        <Suspense
          key={road.id}
          fallback={<RoadRow road={road} next={null} failed={false} serverNow={serverNow} />}
        >
          {index < LIVE ? (
            <Live road={road} serverNow={serverNow} />
          ) : (
            <RoadRow road={road} next={null} failed={false} serverNow={serverNow} />
          )}
        </Suspense>
      ))}
    </ul>
  );
}

async function Live({ road, serverNow }: { road: SavedRoad; serverNow: number }) {
  try {
    // Просим две поездки, берём первую ещё не ушедшую: ответ живёт минуту, и за
    // эту минуту первый поезд из него может уже уйти.
    const list = await journeys({ from: road.fromId, to: road.toId, limit: 2 });
    const next = list.find((journey) => journey.departs + journey.delay * 60_000 >= Date.now()) ?? null;
    return <RoadRow road={road} next={next} failed={false} serverNow={serverNow} />;
  } catch (error) {
    console.warn(
      `[podshar] SBB не ответили про дорогу ${road.fromId}→${road.toId}:`,
      error instanceof Error ? error.message : error
    );
    return <RoadRow road={road} next={null} failed serverNow={serverNow} />;
  }
}
