/**
 * Какая сборка сейчас на сайте — коммит и время сборки.
 *
 * Значения вписываются в код при сборке (`env` в `next.config.mjs`), поэтому
 * страница показывает ту сборку, к которой сама относится, а не то, что лежит
 * в окружении сервера. Тот же коммит уходит заголовком `X-Podshar-Build`: по
 * нему видно, доехал ли пуш, без входа на сайт и без локальной сборки.
 */
const sha = process.env.PODSHAR_BUILD_SHA ?? 'unknown';
const at = process.env.PODSHAR_BUILD_AT ? new Date(process.env.PODSHAR_BUILD_AT) : null;

export const BUILD = {
  /** Полный хеш или `unknown`, если ни Vercel, ни git его не назвали. */
  sha,
  /** Семь знаков — столько показывает GitHub, и этого хватает, чтобы найти коммит. */
  short: sha === 'unknown' ? sha : sha.slice(0, 7),
  at: at && !Number.isNaN(at.getTime()) ? at : null,
  /** Репозиторий публичный, так что ссылка ведёт туда же, куда может зайти любой. */
  url: sha === 'unknown' ? null : `https://github.com/trqwaa/podshar-website/commit/${sha}`
};
