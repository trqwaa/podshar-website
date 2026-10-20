import 'server-only';

/**
 * The weather where the three of them live, for the tile on the homepage.
 *
 * One place, not one per viewer. The site's day already rolls over at Zurich
 * midnight for everybody, and the seed stores this same point as home — Zürich
 * HB, which is also where the SBB lookups start. A tile that showed each person
 * their own sky would be three answers to "what is it like out", and this page
 * is the shared one.
 *
 * Open-Meteo, because it needs no key: nothing to add on Vercel, nothing to
 * leak, nothing to expire. `OPENWEATHER_API_KEY` in the template belongs to the
 * worker the architecture plans, which will write `WeatherSnapshot` rows; once
 * that exists, this function reads the newest row instead and nothing above it
 * has to change.
 *
 * Until then this bends the house rule that a page never waits on a third
 * party, so it is fenced in three ways. The answer is cached for fifteen
 * minutes and shared by everyone, so the provider hears from us four times an
 * hour at most. The tile streams in behind a Suspense boundary, so the page does
 * not wait for it at all. And any failure — slow, down, malformed — comes back
 * as `null`, which the tile renders as an honest "no weather", never an error.
 */

const HOME = { latitude: 47.3769, longitude: 8.5417 };
const REVALIDATE_SECONDS = 15 * 60;
/**
 * Старше этого «сейчас» уже не сейчас.
 *
 * Next отдаёт протухший ответ, пока свежий едет в фоне. Обычно это минуты, но
 * после тихой ночи первый утренний заход получает вчерашние 23:45, а при сбое
 * у провайдера старое не сменяется вовсе. Тогда провайдера спрашиваем ещё раз,
 * напрямую, мимо кеша, — и только если и это не вышло, честное «погоды нет»,
 * а не ночная температура под словом «сейчас».
 */
const STALE_MS = 3 * 3600_000;
const TIMEOUT_MS = 2500;

export type Condition =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'showers'
  | 'thunder';

/** One hour of the strip at the top of the panel. */
export type HourForecast = {
  /** `2026-10-16T14:00` — Zurich wall-clock time, exactly as the provider writes it. */
  time: string;
  temp: number;
  condition: Condition;
  isDay: boolean;
  /** Chance of rain or snow in that hour, 0–100. */
  rain: number;
};

/**
 * One moment of a day: the temperature and the sky at a fixed hour.
 *
 * `15°…25°` on its own never said which was the morning and which the
 * afternoon — that was the complaint that started this. Four fixed moments
 * answer it in the words a forecast is read in: night, morning, day, evening.
 */
export type DayPart = { temp: number; condition: Condition; isDay: boolean; rain: number };

/**
 * The hour that stands for each part of the day: the middle of its six hours.
 * Night is the small hours *of that date*, the way a printed forecast means it.
 */
export const PART_HOURS = { night: 3, morning: 9, day: 15, evening: 21 } as const;
export type PartName = keyof typeof PART_HOURS;

/** One row in the week: what a day looks like from a distance. */
export type DayForecast = {
  /** `2026-09-23`, already in Zurich days — the provider is asked in that zone. */
  date: string;
  condition: Condition;
  min: number;
  max: number;
  /** Chance of rain or snow at some point that day, 0–100. */
  rain: number;
  /** How much falls over the whole day, in millimetres. */
  precip: number;
  /** Strongest sustained wind and strongest gust, km/h. `null` when not sent. */
  wind: number | null;
  gusts: number | null;
  /** `07:45`, Zurich time. `null` when not sent. */
  sunrise: string | null;
  sunset: string | null;
  /** Missing parts are left out rather than guessed — see `DayPart`. */
  parts: Partial<Record<PartName, DayPart>>;
};

export type Weather = {
  temp: number;
  feels: number;
  condition: Condition;
  isDay: boolean;
  min: number;
  max: number;
  /** Chance of rain or snow at some point today, 0–100. */
  rain: number;
  /** Right now, km/h and percent. `null` when the provider leaves them out. */
  wind: number | null;
  gusts: number | null;
  humidity: number | null;
  /**
   * The next twenty-four hours, starting with the one we are in.
   *
   * Sliced at render time, not when the answer was cached: the answer lives for
   * fifteen minutes, and a strip that starts at the hour the cache was filled
   * would show an hour that is already over.
   */
  hours: HourForecast[];
  /**
   * The week, today first.
   *
   * Comes down in the same request as the tile's own numbers, because it is the
   * same request either way: the provider bills nothing and the answer is
   * cached for fifteen minutes and shared. Fetching the week separately when
   * the panel opens would mean a second round trip in front of someone who has
   * already clicked, for data we could have had for free.
   *
   * May be empty if the provider sends a shape we do not recognise. The panel
   * then says there is no forecast, which is true, rather than rendering rows
   * of nothing.
   */
  days: DayForecast[];
};

/**
 * WMO weather codes, folded into the handful of things a tile can say.
 *
 * The provider distinguishes thirty-odd codes — light, moderate and dense
 * drizzle, freezing or not. Nobody deciding whether to take a jacket needs that
 * resolution, and every extra state is four more strings in four catalogues.
 */
export function conditionOf(code: number): Condition {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95) return 'thunder';
  return 'cloudy';
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const orNull = (v: unknown): number | null => (finite(v) ? v : null);

/** `2026-10-16T07:45` → `07:45`. The provider already speaks Zurich time. */
const clock = (v: unknown): string | null =>
  typeof v === 'string' && /T\d{2}:\d{2}/.test(v) ? v.slice(v.indexOf('T') + 1, v.indexOf('T') + 6) : null;

/** This hour in Zurich, written the way the provider writes its hours. */
function zurichHour(at: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Zurich',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:00`;
}

export async function getWeather(): Promise<Weather | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(HOME.latitude),
    longitude: String(HOME.longitude),
    current:
      'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_gusts_10m,relative_humidity_2m',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,' +
      'precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset',
    // By the hour for the whole week: the strip reads the next day of it, and
    // the four parts of every day in the panel are read off the same list.
    // About seven kilobytes, once per fifteen minutes for everyone.
    hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
    timezone: 'Europe/Zurich',
    // Seven, not one: the tile reads the first day and the panel behind it
    // reads all of them. One request serves both, and asking for six more days
    // costs nothing here — the answer is one JSON body either way.
    forecast_days: '7'
  }).toString();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // A race rather than an abort signal: a slow answer that loses the race
    // still finishes and lands in the cache, so the next visitor gets it. One
    // budget for both tries below: the tile never waits longer than it did.
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`no answer in ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
    });
    const ask = async (init: RequestInit) => {
      const response = await Promise.race([fetch(url, init), deadline]);
      if (!response.ok) throw new Error(`provider answered ${response.status}`);
      return response.json();
    };

    // Настенное время провайдера и наше, оба в Цюрихе и без пояса, — сравнимы
    // как числа, если прочитать их одинаково.
    const hereNow = zurichHour(new Date());
    const stale = (answer: { current?: { time?: unknown } } | null) => {
      const at = typeof answer?.current?.time === 'string' ? Date.parse(`${answer.current.time}Z`) : NaN;
      return !Number.isFinite(at) || Date.parse(`${hereNow}Z`) - at > STALE_MS;
    };

    let data = await ask({ next: { revalidate: REVALIDATE_SECONDS } });
    if (stale(data)) {
      data = await ask({ cache: 'no-store' });
      if (stale(data)) throw new Error(`stale answer from ${String(data?.current?.time)}`);
    }

    const now = data?.current;
    const today = data?.daily;
    // «Сегодня» — строка с сегодняшней датой, а не нулевая: ответ, взятый до
    // полуночи и отданный после, начинался со вчера, и плитка подписывала
    // вчерашний день «сегодня».
    const todayKey = hereNow.slice(0, 10);
    const dates: unknown[] = Array.isArray(today?.time) ? today.time : [];
    const at = dates.indexOf(todayKey);
    const needed = [
      now?.temperature_2m,
      now?.apparent_temperature,
      now?.weather_code,
      today?.temperature_2m_min?.[at],
      today?.temperature_2m_max?.[at]
    ];
    if (at < 0 || !needed.every(finite)) throw new Error('unexpected response shape');

    // Hours first, because the days read their four parts out of them. Same
    // rule as the week below: an hour that does not parse is dropped, and the
    // panel shows what is left.
    const hourly = data?.hourly;
    const times: unknown[] = Array.isArray(hourly?.time) ? hourly.time : [];
    const allHours: HourForecast[] = times.flatMap((time, i) => {
      const temp = hourly?.temperature_2m?.[i];
      const code = hourly?.weather_code?.[i];
      if (typeof time !== 'string' || !finite(temp) || !finite(code)) return [];
      const wet = hourly?.precipitation_probability?.[i];
      return [
        {
          time,
          temp,
          condition: conditionOf(code),
          isDay: hourly?.is_day?.[i] !== 0,
          rain: finite(wet) ? wet : 0
        }
      ];
    });
    const byTime = new Map(allHours.map((h) => [h.time, h]));

    // The week is assembled defensively and separately from the numbers above:
    // a missing day must cost the panel that row, never the tile its
    // temperature. Anything that does not parse is dropped rather than rendered
    // as a dash, and an empty list is a legitimate answer.
    // Дни до сегодняшнего — долой, по той же причине.
    const days: DayForecast[] = dates.flatMap((date, i) => {
      if (typeof date === 'string' && date < todayKey) return [];
      const min = today?.temperature_2m_min?.[i];
      const max = today?.temperature_2m_max?.[i];
      const code = today?.weather_code?.[i];
      if (typeof date !== 'string' || !finite(min) || !finite(max) || !finite(code)) return [];
      const wet = today?.precipitation_probability_max?.[i];
      const fell = today?.precipitation_sum?.[i];

      const parts: DayForecast['parts'] = {};
      for (const [name, hour] of Object.entries(PART_HOURS) as [PartName, number][]) {
        const at = byTime.get(`${date}T${String(hour).padStart(2, '0')}:00`);
        if (at) {
          parts[name] = { temp: at.temp, condition: at.condition, isDay: at.isDay, rain: at.rain };
        }
      }

      return [
        {
          date,
          condition: conditionOf(code),
          min,
          max,
          rain: finite(wet) ? wet : 0,
          precip: finite(fell) ? fell : 0,
          wind: orNull(today?.wind_speed_10m_max?.[i]),
          gusts: orNull(today?.wind_gusts_10m_max?.[i]),
          sunrise: clock(today?.sunrise?.[i]),
          sunset: clock(today?.sunset?.[i]),
          parts
        }
      ];
    });

    // From the hour we are in, twenty-four of them. If this hour is somehow
    // not in the list (a clock far off, a provider answering for yesterday),
    // the strip starts at the first hour still ahead rather than not at all.
    const from = allHours.findIndex((h) => h.time >= hereNow);
    const hours = from < 0 ? [] : allHours.slice(from, from + 24);


    return {
      temp: now.temperature_2m,
      feels: now.apparent_temperature,
      condition: conditionOf(now.weather_code),
      isDay: now.is_day !== 0,
      // Из сырых чисел сегодняшней строки, а не из списка дней: строку с
      // испорченным кодом погоды список выбросит, и это должно стоить окну
      // одной строки, а не плитке её температуры.
      min: today.temperature_2m_min[at],
      max: today.temperature_2m_max[at],
      // Some forecast models leave this out; "no chance given" reads as dry.
      rain: finite(today?.precipitation_probability_max?.[at]) ? today.precipitation_probability_max[at] : 0,
      wind: orNull(now.wind_speed_10m),
      gusts: orNull(now.wind_gusts_10m),
      humidity: orNull(now.relative_humidity_2m),
      hours,
      days
    };
  } catch (error) {
    // Logged, like every other quiet fallback here: a tile that has said "no
    // weather" for a week is indistinguishable from a provider outage unless
    // the reason is written down somewhere.
    console.warn('[podshar] weather unavailable:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
