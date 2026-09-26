import 'server-only';

import type { BoardRow, Journey, Leg, Station } from '@/lib/types';

/**
 * Всё, что мы спрашиваем у железной дороги, в одном месте.
 *
 * `transport.opendata.ch` — без ключа, по тем же соображениям, что и погода:
 * ключ надо где-то держать, кому-то отдавать при передаче проекта и не забыть
 * положить на Vercel во все три среды. Взамен там нет вещей, которые есть у
 * самих SBB: сбои на линии («на S9 авария») этот источник не отдаёт вовсе, а
 * опоздание конкретного поезда — отдаёт.
 *
 * Ограничения у него настоящие: порядка тысячи запросов в сутки на адрес и
 * около трёх в секунду. Нас трое, но поиск маршрута человек дёргает подряд —
 * поправил время, поменял станцию, — поэтому каждый ответ кладётся в кеш Next
 * на срок, который имеет смысл для этих данных, а не «на минуту, потому что
 * так принято»:
 *
 * - имена станций живут сутки: станции не переезжают;
 * - табло и маршруты — минуту: достаточно, чтобы трое подряд не били по API,
 *   и мало, чтобы поезд на экране ещё стоял на перроне;
 * - поиск на будущее (не «сейчас») — десять минут: расписание на завтра за
 *   минуту не меняется, а человек, который подбирает время, шлёт запрос на
 *   каждое нажатие.
 *
 * Время у SBB приходит со смещением (`+02:00`), поэтому `Date.parse` даёт
 * верный момент сам. Показывать его надо в цюрихском поясе — то же правило,
 * что у календаря: человек в Киеве, который увидит «18:04» по-своему, придёт
 * на вокзал не тогда.
 */

const API = 'https://transport.opendata.ch/v1';
const TIMEOUT_MS = 6000;

/** Zürich HB — отсюда считается «свалить домой», и это же станция по умолчанию. */
export const HB_STOP = '8503000';

export const STATION_TTL = 86_400;
export const LIVE_TTL = 60;
export const PLANNED_TTL = 600;

/**
 * Запрос с потолком по времени.
 *
 * Гонка, а не `AbortController`: отменённый запрос не попадает в кеш Next, и
 * следующий человек ждёт ровно столько же. Проигравший в гонке ответ спокойно
 * долетает и ложится в кеш — его получит следующий.
 */
async function ask(path: string, params: Record<string, string>, revalidate: number) {
  const url = new URL(`${API}/${path}`);
  url.search = new URLSearchParams(params).toString();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      fetch(url, { next: { revalidate } }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`SBB не ответили за ${TIMEOUT_MS}мс`)), TIMEOUT_MS);
      })
    ]);
    if (!response.ok) throw new Error(`SBB ответили ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

const ms = (iso: unknown) => (typeof iso === 'string' ? Date.parse(iso) : NaN);
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const late = (v: unknown) => (Number.isFinite(v) ? Math.max(0, Number(v)) : 0);

/**
 * Как поезд называется на табло.
 *
 * У SBB название разложено на категорию и номер (`S` + `9`, `IC` + `8`), и
 * писать их слитно нельзя: `S9` — это линия, а `IC8` читается как ерунда.
 * Пешие отрезки номера не имеют вовсе.
 */
function lineName(journey: unknown): string {
  const j = (journey ?? {}) as Record<string, unknown>;
  const category = text(j.category);
  const number = text(j.number) ?? (Number.isFinite(j.number) ? String(j.number) : null);
  if (!category) return '—';
  if (!number) return category;
  return category === 'S' || category === 'SN' ? `${category}${number}` : `${category} ${number}`;
}

/**
 * Станции по набранному куску имени.
 *
 * Отдаём список, а не первое совпадение. Старое поле в профиле брало первое и
 * называло найденное вслух — это работало ровно до тех пор, пока человек не
 * набирал «Bahnhof» или «Zürich»: угадать за него нельзя, а молча взять не ту
 * станцию значит показывать ему чужие поезда, и он об этом не узнает.
 */
const UMLAUT: Record<string, string> = { a: 'ä', o: 'ö', u: 'ü' };

/**
 * «zuri» → «züri».
 *
 * У источника дырка в поиске по началу слова: «zur» находит Bad Zurzach,
 * «zür» — Zürich HB, а «zuri» и «zuric» не находят ничего, кроме улицы в
 * Лугано. Слово целиком («zurich») он разбирает, огрызок — нет. Для страны,
 * где умляут в каждом втором названии, это значит, что человек без умляута на
 * клавиатуре не находит свой же вокзал.
 *
 * Меняется только **первая** подходящая гласная: перебирать все сочетания
 * значило бы слать по запросу на букву, а у нас потолок около тысячи в сутки.
 * Одной замены хватает на Zürich, Bülach, Köniz, Wädenswil.
 */
function withUmlaut(query: string): string | null {
  if (/[äöüÄÖÜ]/.test(query)) return null;
  const at = query.search(/[aouAOU]/);
  if (at < 0) return null;
  const letter = query[at];
  const swapped = UMLAUT[letter.toLowerCase()];
  return query.slice(0, at) + (letter === letter.toUpperCase() ? swapped.toUpperCase() : swapped) + query.slice(at + 1);
}

function collect(data: unknown, into: Station[], limit: number) {
  const stations = dig(data, 'stations');
  for (const s of Array.isArray(stations) ? stations : []) {
    const raw = dig(s, 'id');
    const id = raw == null ? null : String(raw);
    const name = text(dig(s, 'name'));
    // У остановок без своего номера (адреса, конторы) расписания нет.
    if (!id || !name || !/^\d+$/.test(id)) continue;
    if (into.some((had) => had.id === id)) continue;
    into.push({ id, name });
    if (into.length >= limit) return;
  }
}

export async function searchStations(query: string, limit = 7): Promise<Station[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const out: Station[] = [];
  collect(await ask('locations', { query: clean, type: 'station' }, STATION_TTL), out, limit);

  // Переспрашиваем только когда набранное почти ничего не дало: в обычном
  // случае это ноль лишних запросов наружу.
  if (out.length < 3) {
    const second = withUmlaut(clean);
    if (second) {
      collect(await ask('locations', { query: second, type: 'station' }, STATION_TTL), out, limit);
    }
  }

  // Те, что начинаются с набранного, — выше: человек, напечатавший «bern»,
  // ищет Bern, а не «Pratteln, Zurlinden», который тоже совпал где-то внутри.
  // Умляуты при сравнении складываются, иначе «zuri» не считается началом
  // «Zürich» и вокзал уезжает под улицу в Лугано.
  const head = fold(clean);
  return out.sort((a, b) => Number(fold(b.name).startsWith(head)) - Number(fold(a.name).startsWith(head)));
}

const fold = (s: string) =>
  s.toLowerCase().replace(/[äöüß]/g, (c) => (c === 'ä' ? 'a' : c === 'ö' ? 'o' : c === 'ü' ? 'u' : 'ss'));

/**
 * Одна станция по номеру.
 *
 * Нужна дважды: назвать станцию человеку, когда номер приехал из ссылки, и
 * проверить на сервере то, что пришло из формы. Имя и координаты берём отсюда,
 * а не из скрытого поля: браузеру верить незачем, а координаты потом уезжают в
 * `locations` и по ним же считается погода.
 *
 * Координаты у SBB перепутаны местами относительно того, что подсказывают
 * буквы: `x` — это широта, `y` — долгота.
 */
export async function stationById(
  id: string
): Promise<(Station & { latitude: number; longitude: number }) | null> {
  if (!/^\d+$/.test(id)) return null;
  const data = await ask('locations', { query: id }, STATION_TTL);
  const first = (Array.isArray(data?.stations) ? data.stations : [])[0];
  const name = text(first?.name);
  if (!name) return null;
  return {
    id,
    name,
    latitude: Number(first?.coordinate?.x) || 0,
    longitude: Number(first?.coordinate?.y) || 0
  };
}

/** Достать вложенное поле из того, что прислал чужой сервер, ничего не обещая про форму. */
function dig(value: unknown, ...path: string[]): unknown {
  let at = value;
  for (const key of path) {
    if (typeof at !== 'object' || at === null) return undefined;
    at = (at as Record<string, unknown>)[key];
  }
  return at;
}

function legsOf(sections: unknown): Leg[] {
  const out: Leg[] = [];

  for (const section of Array.isArray(sections) ? sections : []) {
    const journey = dig(section, 'journey');
    // Пеший переход между перронами — не поезд, в список не идёт.
    if (!journey) continue;

    const departs = ms(dig(section, 'departure', 'departure'));
    const arrives = ms(dig(section, 'arrival', 'arrival'));
    if (!Number.isFinite(departs) || !Number.isFinite(arrives)) continue;

    out.push({
      line: lineName(journey),
      // Куда едет сам поезд — это написано на его лбу, а не станция пересадки.
      head: text(dig(journey, 'to')),
      from: text(dig(section, 'departure', 'station', 'name')) ?? '?',
      to: text(dig(section, 'arrival', 'station', 'name')) ?? '?',
      departs,
      arrives,
      platform: text(dig(section, 'departure', 'platform')),
      delay: late(dig(section, 'departure', 'delay'))
    });
  }

  return out;
}

export type JourneyQuery = {
  from: string;
  to: string;
  /** Момент, от которого считаем. Пусто — «сейчас». */
  when?: Date | null;
  /** `when` — это когда надо быть на месте, а не когда выезжать. */
  arriving?: boolean;
  limit?: number;
};

/**
 * Варианты поездки, самый ранний первым.
 *
 * Дата и время передаются раздельно и по цюрихскому поясу — API так устроен.
 * Собирать их из `toISOString()` нельзя: он отдаёт UTC, и летом поиск уезжал бы
 * на два часа назад.
 */
export async function journeys(q: JourneyQuery): Promise<Journey[]> {
  const params: Record<string, string> = {
    from: q.from,
    to: q.to,
    limit: String(q.limit ?? 6)
  };

  if (q.when) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Zurich',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(q.when);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    params.date = `${get('year')}-${get('month')}-${get('day')}`;
    params.time = `${get('hour')}:${get('minute')}`;
    if (q.arriving) params.isArrivalTime = '1';
  }

  // Поиск «сейчас» живёт минуту, поиск на будущее — десять: расписание на
  // завтра за минуту не меняется, а человек, подбирающий время, шлёт запрос
  // на каждое нажатие.
  const data = await ask('connections', params, q.when ? PLANNED_TTL : LIVE_TTL);
  const out: Journey[] = [];

  for (const c of Array.isArray(data?.connections) ? data.connections : []) {
    const departs = ms(c?.from?.departure);
    const arrives = ms(c?.to?.arrival);
    if (!Number.isFinite(departs) || !Number.isFinite(arrives)) continue;

    const legs = legsOf(c?.sections);
    out.push({
      departs,
      arrives,
      minutes: Math.max(0, Math.round((arrives - departs) / 60_000)),
      delay: late(c?.from?.delay),
      platform: text(c?.from?.platform),
      // Пересадки считаем по отрезкам, а не по полю `transfers`: оно считает и
      // пешие переходы, поэтому «пересадка» появлялась там, где надо просто
      // перейти перрон.
      transfers: Math.max(0, legs.length - 1),
      legs
    });
  }

  return out.sort((a, b) => a.departs - b.departs);
}

/** Табло станции: что уходит в ближайшее время. */
export async function stationBoard(stop: string, limit = 12): Promise<BoardRow[]> {
  const data = await ask('stationboard', { id: stop, limit: String(limit), type: 'departure' }, LIVE_TTL);
  const out: BoardRow[] = [];

  for (const e of Array.isArray(data?.stationboard) ? data.stationboard : []) {
    const departs = ms(e?.stop?.departure);
    if (!Number.isFinite(departs)) continue;
    out.push({
      line: lineName(e),
      head: text(e?.to) ?? '?',
      departs,
      delay: late(e?.stop?.delay),
      platform: text(e?.stop?.platform)
    });
  }

  return out.sort((a, b) => a.departs - b.departs);
}
