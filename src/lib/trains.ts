import 'server-only';

import { prisma } from '@/lib/db';
import { authConfigured } from '@/lib/auth/config';
import type { Departure, TrainRow } from '@/lib/types';

/**
 * The next train home from Zürich HB, for each of the three.
 *
 * Built on what the schema already had: every user may point at a `Location`
 * through `homeLocationId`, and a location carries an SBB stop id. Each person
 * sets theirs once in the trains section; this reads them and asks SBB for the
 * next few connections from HB. No migration.
 *
 * This is now read by exactly one caller: the dog's timetable lookup
 * (`assistant/lookup.ts`), which answers "when is the next train" for whoever
 * is in the chat. The homepage tile it was written for moved into `/trains` as
 * a search, and the general SBB layer lives in `lib/sbb.ts` — richer, and with
 * its own caching. Nothing here should grow: new train work belongs there.
 *
 * transport.opendata.ch, because it needs no key — the same reasoning as the
 * weather, and fenced the same way (`lib/weather.ts` has the long version):
 * cached for a minute, and a failure is a row that says SBB did not answer
 * rather than an error. A minute is the right cache for a departure board: long
 * enough that three people reloading do not hammer it, short enough that the
 * train on screen is still in the station. The caller picks the first
 * connection still in the future itself, so a cached answer that has gone a
 * minute stale shows the next train, not one that has left.
 */

/** Zürich HB — where every row starts, and the stop the seed calls home. */
export const HB_STOP = '8503000';
const API = 'https://transport.opendata.ch/v1';
const TIMEOUT_MS = 3000;

async function sbb(path: string, params: Record<string, string>, revalidate: number) {
  const url = new URL(`${API}/${path}`);
  url.search = new URLSearchParams(params).toString();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // A race rather than an abort, so a slow answer still lands in the cache.
    const response = await Promise.race([
      fetch(url, { next: { revalidate } }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer in ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
      })
    ]);
    if (!response.ok) throw new Error(`SBB answered ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const time = (iso: unknown) => (typeof iso === 'string' ? Date.parse(iso) : NaN);

/** The next few connections from HB to a stop, soonest first. Throws if SBB does not answer. */
export async function fromHB(to: string): Promise<Departure[]> {
  const data = await sbb('connections', { from: HB_STOP, to, limit: '4' }, 60);
  const out: Departure[] = [];

  for (const c of Array.isArray(data?.connections) ? data.connections : []) {
    const departs = time(c?.from?.departure);
    const arrives = time(c?.to?.arrival);
    if (!Number.isFinite(departs) || !Number.isFinite(arrives)) continue;
    const journey = c?.sections?.find((s: { journey?: unknown }) => s?.journey)?.journey;
    out.push({
      line:
        (typeof c?.products?.[0] === 'string' && c.products[0]) ||
        [journey?.category, journey?.number].filter(Boolean).join(' ') ||
        '?',
      departs,
      delay: Number.isFinite(c?.from?.delay) ? Math.max(0, c.from.delay) : 0,
      platform: typeof c?.from?.platform === 'string' && c.from.platform ? c.from.platform : null,
      arrives,
      transfers: Number.isFinite(c?.transfers) ? c.transfers : 0
    });
  }

  return out.sort((a, b) => a.departs - b.departs);
}

export async function getTrains(): Promise<TrainRow[]> {
  if (!authConfigured()) return [];

  let users;
  try {
    users = await prisma.user.findMany({
      select: {
        handle: true,
        displayName: true,
        avatarPreset: true,
        homeLocation: { select: { label: true, stopId: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
  } catch (error) {
    console.warn('[podshar] trains: could not read members:', error);
    return [];
  }

  return Promise.all(
    users.map(async (user): Promise<TrainRow> => {
      const row: TrainRow = {
        handle: user.handle,
        displayName: user.displayName,
        avatarPreset: user.avatarPreset,
        station: user.homeLocation?.label ?? null,
        atHB: false,
        departures: [],
        failed: false
      };

      const stop = user.homeLocation?.stopId;
      if (!stop) return { ...row, station: null };
      if (stop === HB_STOP) return { ...row, atHB: true };

      try {
        return { ...row, departures: await fromHB(stop) };
      } catch (error) {
        console.warn(`[podshar] SBB did not answer for ${stop}:`, error instanceof Error ? error.message : error);
        return { ...row, failed: true };
      }
    })
  );
}

// Здесь стоял `findStation`: набранное имя → первая станция из ответа SBB, для
// формы в профиле. Формы больше нет, а сам подход с тех пор запрещён — «станция
// выбирается из списка, а не угадывается»: поле, бравшее первое совпадение,
// молча подставляло чужую станцию. Тому, что пришло на замену, нужен весь
// список — это `searchStations` в `lib/sbb.ts`.
