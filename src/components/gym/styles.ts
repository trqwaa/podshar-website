/**
 * Классы полей и кнопок зала — отдельно от `ui.tsx`.
 *
 * `ui.tsx` помечен `'use client'`, а всё, что серверный компонент берёт из
 * клиентского модуля, приезжает к нему ссылкой, а не строкой: шапка зала
 * получила бы класс `[object Object]`. Строки живут здесь, без директивы, и
 * их берут обе стороны.
 *
 * Поля — 16px на телефоне (`text-[1rem]`), как везде на сайте: меньше — и
 * айфон зумит страницу при тапе и оставляет её зумнутой.
 *
 * С 1.52 кнопки — таблетки без серых рамок: главная залита чернилами, прочие —
 * мягкой заливкой. Серые обводки читались как «неактивно» и были, по словам
 * владельца, безвкусными. Ростом кнопки под палец: зал смотрят с телефона.
 * Цвет у переключателей — отдельной строкой (`CHIP_ON`, `CHIP_OFF`): два
 * класса фона в одной строке спорят, и побеждает не тот, что написан позже.
 */

export const INPUT =
  'min-w-0 rounded-[12px] border-2 border-rule bg-canvas px-3 py-2 text-[1rem] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink sm:text-[0.9375rem]';
export const SMALL_INPUT =
  'w-full min-w-0 rounded-[10px] border-2 border-rule bg-canvas px-2 py-1.5 text-center text-[1rem] tabular-nums text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink sm:text-[0.9375rem]';
export const BUTTON =
  'ps-press rounded-full bg-ink px-4 py-2 text-sm font-semibold lowercase text-surface transition-opacity hover:opacity-90 disabled:opacity-40';
export const GHOST =
  'ps-press rounded-full bg-sunk px-4 py-2 text-sm font-semibold lowercase text-ink transition-colors hover:bg-rule-soft disabled:opacity-40';
export const CHIP = 'ps-press rounded-full px-3 py-1.5 text-xs font-semibold lowercase transition-colors sm:text-sm';
export const CHIP_ON = 'bg-ink text-surface';
export const CHIP_OFF = 'bg-sunk text-ink hover:bg-rule-soft';
/** Вкладки и переключатели над страницей. Подложку под выбранной рисует `GymTabs`. */
export const TAB = 'ps-press relative shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold lowercase';
