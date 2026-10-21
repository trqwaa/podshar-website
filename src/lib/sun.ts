/**
 * Восход и закат над Цюрихом — чтобы пульт знал, что уже вечер.
 *
 * Считается, а не спрашивается у погоды: пульт живёт в браузере на каждой
 * странице, а погода — на сервере и только на главной. Формула — стандартное
 * уравнение восхода (средняя аномалия, уравнение центра, склонение, часовой
 * угол на −0.833°: радиус диска плюс рефракция у горизонта). Для наших целей
 * минуты не важны, но точность у неё в пределах пары минут.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
/** Юлианская дата полуночи 1 января 1970 и эпоха J2000. */
const J1970 = 2440588;
const J2000 = 2451545;
/** Наклон земной оси. */
const TILT = 23.4397 * RAD;
/** Цюрих, Хауптбанхоф: от него на сайте считается всё «здесь». */
const LAT = 47.3779 * RAD;
const WEST = -8.5403 * RAD;

const toDays = (ms: number) => ms / DAY_MS - 0.5 + J1970 - J2000;
const fromJulian = (j: number) => (j + 0.5 - J1970) * DAY_MS;

/** Восход и закат того дня, в который попадает момент `at`, мс. */
export function sunTimes(at: number): { rise: number; set: number } {
  const cycle = Math.round(toDays(at) - 0.0009 - WEST / (2 * Math.PI));
  const mean = 0.0009 + WEST / (2 * Math.PI) + cycle;
  const anomaly = RAD * (357.5291 + 0.98560028 * mean);
  const centre = RAD * (1.9148 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly) + 0.0003 * Math.sin(3 * anomaly));
  const longitude = anomaly + centre + RAD * 102.9372 + Math.PI;
  const declination = Math.asin(Math.sin(TILT) * Math.sin(longitude));
  const noon = J2000 + mean + 0.0053 * Math.sin(anomaly) - 0.0069 * Math.sin(2 * longitude);
  const angle = Math.acos(
    (Math.sin(-0.833 * RAD) - Math.sin(LAT) * Math.sin(declination)) / (Math.cos(LAT) * Math.cos(declination))
  );
  const half = angle / (2 * Math.PI);
  return { rise: fromJulian(noon - half), set: fromJulian(noon + half) };
}

/**
 * Какое сейчас небо: день, сумерки или ночь.
 *
 * Сумерки — полчаса до заката и час с четвертью после, утром — от сорока минут
 * до восхода до получаса после. Не «после восьми — ночь»: в Цюрихе зимой в
 * пять уже темно, а летом в девять ещё светло.
 */
export type Mood = 'day' | 'dusk' | 'night';

export function moodAt(at: number): Mood {
  const { rise, set } = sunTimes(at);
  const min = 60_000;
  if ((at >= set - 30 * min && at <= set + 75 * min) || (at >= rise - 40 * min && at <= rise + 30 * min)) return 'dusk';
  return at > rise && at < set ? 'day' : 'night';
}
