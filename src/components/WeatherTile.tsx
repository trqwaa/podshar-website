import { getTranslations } from 'next-intl/server';

import { WeatherPanel } from '@/components/WeatherPanel';
import { ZONE } from '@/lib/calendar/scales';
import {
  PART_HOURS,
  getWeather,
  type Condition,
  type DayForecast,
  type PartName,
  type Weather
} from '@/lib/weather';
import type { Locale } from '@/i18n/routing';

/**
 * The sky over Zurich, in the same shape as the date tile beside it: a big
 * number, a line of words under it, one quiet line of detail.
 *
 * A server component that waits for the provider, so it must always sit inside
 * a `<Suspense>` with `WeatherPending` as the fallback. The page then streams
 * without it and the tile arrives when the answer does. Why a third party is
 * allowed near a page render at all — and how it is fenced — is in
 * `lib/weather.ts`.
 */
export async function WeatherTile({
  locale,
  className = ''
}: {
  /**
   * Handed down, never asked for.
   *
   * `PatchList` takes it the same way, and for the same reason: the page
   * already resolved it out of its own params, and a component that calls
   * `getLocale()` instead reaches for request state from inside a tree that is
   * meant to be renderable without one.
   */
  locale: Locale;
  className?: string;
}) {
  const [t, tHome, weather] = await Promise.all([
    getTranslations({ locale, namespace: 'weather' }),
    getTranslations({ locale, namespace: 'home' }),
    getWeather()
  ]);
  const label = `${t('label')} · ${t('place')}`;

  if (!weather) {
    return (
      <Frame label={label} className={className}>
        <p className="text-base font-medium text-ink-muted">{t('unavailable')}</p>
      </Frame>
    );
  }

  const deg = (n: number) => `${Math.round(n)}°`;
  const night = !weather.isDay;
  // Only a clear sky reads differently at night. A cloud is a cloud.
  const key = weather.condition === 'clear' && night ? 'clearNight' : weather.condition;

  return (
    <WeatherPanel
      label={label}
      more={t('more')}
      className={className}
      title={t('weekTitle')}
      hint={t('weekHint')}
      close={tHome('close')}
      week={<Forecast weather={weather} locale={locale} />}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold leading-tight tabular-nums text-ink">
            {deg(weather.temp)}
          </p>
          <p className="mt-1 text-base font-medium text-ink-muted">{t(`conditions.${key}`)}</p>
        </div>
        <WeatherIcon condition={weather.condition} night={night} />
      </div>
      {/* «Макс» и «мин» словами, а не «10°…21°»: два числа через многоточие не
          говорят, какое из них днём, и именно на это пожаловались. */}
      <p className="text-sm tabular-nums text-ink-muted">
        {t('feels', { temp: Math.round(weather.feels) })} &middot;{' '}
        {t('high', { temp: Math.round(weather.max) })} &middot;{' '}
        {t('low', { temp: Math.round(weather.min) })} &middot;{' '}
        {weather.rain > 0 ? t('rain', { chance: Math.round(weather.rain) }) : t('dry')}
      </p>
    </WeatherPanel>
  );
}

const deg = (n: number) => `${Math.round(n)}°`;

/**
 * Everything behind the tile: right now, the next day by the hour, and the
 * week day by day.
 *
 * Rendered on the server and handed to the panel as a node, so the whole of
 * this file — the provider call, the four catalogues, the date formatting —
 * stays where it already was and the client shell never learns what the
 * weather is.
 *
 * It used to be one thin row a day with `10°…21°` on the right, and it was read
 * as small and as saying too little: which of the two numbers is the night? Now
 * every number carries its word — «макс», «мин», «утро», «вечер» — and the
 * panel says what the week is going to feel like, not only its extremes.
 */
async function Forecast({ weather, locale }: { weather: Weather; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'weather' });
  if (weather.days.length === 0) return <p className="text-base text-ink-muted">{t('unavailable')}</p>;

  return (
    <div className="flex flex-col gap-8 pt-4">
      <Now weather={weather} locale={locale} />
      {weather.hours.length > 0 ? <Hours weather={weather} locale={locale} /> : null}
      <Days days={weather.days} locale={locale} />
    </div>
  );
}

/** Right now, with the four facts a tile has no room for. */
async function Now({ weather, locale }: { weather: Weather; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'weather' });
  const night = !weather.isDay;
  const key = weather.condition === 'clear' && night ? 'clearNight' : weather.condition;
  const today = weather.days[0];

  const facts: [string, string][] = [
    [t('facts.feels'), deg(weather.feels)],
    ...(weather.wind !== null
      ? [
          [
            t('facts.wind'),
            weather.gusts !== null && weather.gusts > weather.wind
              ? t('windGusts', { speed: Math.round(weather.wind), gusts: Math.round(weather.gusts) })
              : t('speed', { speed: Math.round(weather.wind) })
          ] as [string, string]
        ]
      : []),
    ...(weather.humidity !== null
      ? [[t('facts.humidity'), t('share', { value: Math.round(weather.humidity) })] as [string, string]]
      : []),
    ...(today?.sunrise && today.sunset
      ? [[t('facts.sun'), `${today.sunrise} – ${today.sunset}`] as [string, string]]
      : [])
  ];

  return (
    <section
      aria-label={t('now')}
      className="grid grid-cols-1 gap-5 rounded-[14px] bg-sunk p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10 sm:p-6"
    >
      <div className="flex items-center gap-4">
        <WeatherIcon condition={weather.condition} night={night} size="lg" />
        <div>
          <p className="ps-label">{t('now')}</p>
          <p className="text-4xl font-semibold leading-none tabular-nums text-ink">
            {deg(weather.temp)}
          </p>
          <p className="mt-1.5 text-base font-medium text-ink-muted">{t(`conditions.${key}`)}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="ps-label">{label}</dt>
            <dd className="text-base font-medium tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The next day, every two hours.
 *
 * Every two, not every one: twelve cells fit the panel on a desktop as they
 * are, while twenty-four would need a sideways scroll that a mouse cannot
 * find. On a phone the twelve do scroll sideways, and that is the gesture a
 * thumb tries first.
 */
async function Hours({ weather, locale }: { weather: Weather; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'weather' });
  const hours = weather.hours.filter((_, i) => i % 2 === 0);
  // Строка с шансом дождя — только если он где-то есть. Под десять процентов
  // это «может, покапает», и цифра там только шумит; а пустая строка под всеми
  // двенадцатью часами читалась как недорисованная.
  const wet = hours.some((hour) => hour.rain >= 10);

  return (
    <section aria-label={t('hoursTitle')}>
      <h3 className="ps-label mb-3">{t('hoursTitle')}</h3>
      <ol className="scroll-quiet -mx-1 flex overflow-x-auto overscroll-x-contain pb-1">
        {hours.map((hour, index) => (
          <li
            key={hour.time}
            className="flex w-14 shrink-0 flex-col items-center gap-1.5 px-1 py-1 text-center"
          >
            <span className="ps-label tabular-nums">
              {index === 0 ? t('now') : hour.time.slice(11, 16)}
            </span>
            <WeatherIcon condition={hour.condition} night={!hour.isDay} size="sm" />
            <span className="text-base font-semibold tabular-nums text-ink">{deg(hour.temp)}</span>
            {/* Место под цифру остаётся и у сухих часов, чтобы ряд не прыгал. */}
            {wet ? (
              <span className="h-4 text-xs tabular-nums text-ink-muted">
                {hour.rain >= 10 ? t('share', { value: Math.round(hour.rain) }) : ''}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The week, one block a day.
 *
 * Zurich days, like everything dated on this site. The forecast was asked for
 * in that zone, and the weekday written over a row has to agree with it, or on
 * a Sunday night Monday's row is labelled Sunday.
 */
async function Days({ days, locale }: { days: DayForecast[]; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'weather' });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: ZONE });
  // Месяц словом, как в списке патчей. Числами `en` читается как 09/23 —
  // американский порядок, который в Швейцарии значит двадцать третье сентября
  // или девятое двадцать третьего, смотря кто смотрит. Слово не двусмысленно.
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: ZONE });

  return (
    <section aria-label={t('daysTitle')}>
      <h3 className="ps-label mb-1">{t('daysTitle')}</h3>
      <ol>
        {days.map((day, index) => {
          // Noon, not midnight. `2026-09-23` parsed bare is midnight UTC, which
          // any zone west of London reads as the evening before — and then the
          // weekday written over the row is off by one. The middle of the day
          // is far from every boundary.
          const at = new Date(`${day.date}T12:00:00Z`);
          const wet =
            day.rain > 0 || day.precip > 0
              ? [
                  t('rain', { chance: Math.round(day.rain) }),
                  ...(day.precip >= 0.1 ? [t('precip', { mm: day.precip })] : [])
                ].join(', ')
              : t('dry');
          const wind =
            day.wind !== null
              ? day.gusts !== null && day.gusts > day.wind
                ? t('windDayGusts', { speed: Math.round(day.wind), gusts: Math.round(day.gusts) })
                : t('windDay', { speed: Math.round(day.wind) })
              : null;
          const partsWet = Object.values(day.parts).some((part) => (part?.rain ?? 0) >= 10);

          return (
            <li key={day.date} className={`flex flex-col gap-3 py-5 ${index > 0 ? 'ps-rule' : ''}`}>
              {/* На телефоне макс и мин всегда второй строкой. С переносом по
                  месту они прыгали: у «sonntag» влезали в строку, у «montag»
                  уже нет, и соседние дни выглядели свёрстанными по-разному. */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <p className="flex items-baseline gap-2">
                  {/* `lowercase`: немецкий и английский пишут день недели с
                      заглавной, а видимые названия на сайте — строчными. */}
                  <span className="text-lg font-semibold lowercase leading-tight text-ink">
                    {index === 0 ? t('today') : weekday.format(at)}
                  </span>
                  <span className="ps-label">{date.format(at)}</span>
                </p>
                <p className="flex items-baseline gap-3 text-base tabular-nums">
                  <span className="font-semibold text-ink">
                    {t('high', { temp: Math.round(day.max) })}
                  </span>
                  <span className="text-ink-muted">{t('low', { temp: Math.round(day.min) })}</span>
                </p>
              </div>

              <p className="flex items-center gap-3 text-base text-ink">
                <WeatherIcon condition={day.condition} night={false} size="sm" />
                <span>{t(`conditions.${day.condition}`)}</span>
              </p>

              {Object.keys(day.parts).length > 0 ? (
                <ul className="grid grid-cols-4 gap-1 rounded-[12px] bg-sunk px-2 py-3 sm:gap-2 sm:px-4">
                  {(Object.keys(PART_HOURS) as PartName[]).map((name) => {
                    const part = day.parts[name];
                    return (
                      <li key={name} className="flex min-w-0 flex-col items-center gap-1 text-center">
                        <span className="ps-label truncate">{t(`parts.${name}`)}</span>
                        {part ? (
                          <>
                            <span className="flex items-center gap-1.5">
                              <WeatherIcon condition={part.condition} night={!part.isDay} size="xs" />
                              <span className="text-base font-semibold tabular-nums text-ink">
                                {deg(part.temp)}
                              </span>
                            </span>
                            {partsWet ? (
                              <span className="h-4 text-xs tabular-nums text-ink-muted">
                                {part.rain >= 10 ? t('share', { value: Math.round(part.rain) }) : ''}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-base text-ink-faint">—</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <p className="text-sm text-ink-muted">
                {wet}
                {wind ? <> &middot; {wind}</> : null}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * What holds the tile's place while the answer is on its way — the same frame
 * and roughly the same height, so nothing below it moves when the real one
 * lands.
 */
export function WeatherPending({ label, className = '' }: { label: string; className?: string }) {
  return (
    <Frame label={label} className={className}>
      <span className="inline-block h-9 w-20 animate-pulse rounded-sm bg-sunk" />
      <span className="inline-block h-4 w-44 animate-pulse rounded-sm bg-sunk" />
    </Frame>
  );
}

function Frame({
  label,
  className,
  children
}: {
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`block-card animate-rise-in flex flex-col gap-4 p-6 [animation-delay:150ms] ${className}`}
    >
      <p className="ps-label">{label}</p>
      {children}
    </section>
  );
}

/**
 * One stroke icon per condition, drawn like every other icon on the site.
 *
 * Paths from Feather (MIT), except fog, which Feather does not have. Fewer
 * pictures than conditions on purpose: "partly cloudy" and "overcast" are the
 * same cloud to anyone glancing at a phone, and the words under the number say
 * which it is.
 */
const ICON_SIZE = { xs: 'h-5 w-5', sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-12 w-12' } as const;

function WeatherIcon({
  condition,
  night,
  size = 'md'
}: {
  condition: Condition;
  night: boolean;
  /** `md` is the tile; the panel behind it uses the rest. */
  size?: keyof typeof ICON_SIZE;
}) {
  const rainCloud = 'M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25';

  const shape = (() => {
    switch (condition) {
      case 'clear':
        return night ? (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </>
        );
      case 'fog':
        return <path d="M3 9h18M5 13h14M7 17h10" />;
      case 'drizzle':
        return (
          <>
            <path d={rainCloud} />
            <path d="M8 13v2M8 19v2M12 15v2M12 21v2M16 13v2M16 19v2" />
          </>
        );
      case 'rain':
      case 'showers':
        return (
          <>
            <path d={rainCloud} />
            <path d="M8 13v8M12 15v8M16 13v8" />
          </>
        );
      case 'snow':
        return (
          <>
            <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
            <path d="M8 16h.01M8 20h.01M12 18h.01M12 22h.01M16 16h.01M16 20h.01" />
          </>
        );
      case 'thunder':
        return (
          <>
            <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
            <path d="M13 11l-4 6h6l-4 6" />
          </>
        );
      default:
        return <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />;
    }
  })();

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`shrink-0 text-ink ${ICON_SIZE[size]}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shape}
    </svg>
  );
}
