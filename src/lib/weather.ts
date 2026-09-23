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

/** One row in the week: what a day looks like from a distance. */
export type DayForecast = {
  /** `2026-09-23`, already in Zurich days — the provider is asked in that zone. */
  date: string;
  condition: Condition;
  min: number;
  max: number;
  /** Chance of rain or snow at some point that day, 0–100. */
  rain: number;
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

export async function getWeather(): Promise<Weather | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(HOME.latitude),
    longitude: String(HOME.longitude),
    current: 'temperature_2m,apparent_temperature,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'Europe/Zurich',
    // Seven, not one: the tile reads the first day and the panel behind it
    // reads all of them. One request serves both, and asking for six more days
    // costs nothing here — the answer is one JSON body either way.
    forecast_days: '7'
  }).toString();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // A race rather than an abort signal: a slow answer that loses the race
    // still finishes and lands in the cache, so the next visitor gets it.
    const response = await Promise.race([
      fetch(url, { next: { revalidate: REVALIDATE_SECONDS } }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer in ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
      })
    ]);
    if (!response.ok) throw new Error(`provider answered ${response.status}`);

    const data = await response.json();
    const now = data?.current;
    const today = data?.daily;
    const needed = [
      now?.temperature_2m,
      now?.apparent_temperature,
      now?.weather_code,
      today?.temperature_2m_min?.[0],
      today?.temperature_2m_max?.[0]
    ];
    if (!needed.every(finite)) throw new Error('unexpected response shape');

    const chance = today?.precipitation_probability_max?.[0];

    // The week is assembled defensively and separately from the numbers above:
    // a missing day must cost the panel that row, never the tile its
    // temperature. Anything that does not parse is dropped rather than rendered
    // as a dash, and an empty list is a legitimate answer.
    const dates: unknown[] = Array.isArray(today?.time) ? today.time : [];
    const days: DayForecast[] = dates.flatMap((date, i) => {
      const min = today?.temperature_2m_min?.[i];
      const max = today?.temperature_2m_max?.[i];
      const code = today?.weather_code?.[i];
      if (typeof date !== 'string' || !finite(min) || !finite(max) || !finite(code)) return [];
      const wet = today?.precipitation_probability_max?.[i];
      return [{ date, condition: conditionOf(code), min, max, rain: finite(wet) ? wet : 0 }];
    });

    return {
      temp: now.temperature_2m,
      feels: now.apparent_temperature,
      condition: conditionOf(now.weather_code),
      isDay: now.is_day !== 0,
      min: today.temperature_2m_min[0],
      max: today.temperature_2m_max[0],
      // Some forecast models leave this out; "no chance given" reads as dry.
      rain: finite(chance) ? chance : 0,
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
