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
 */

export const INPUT =
  'min-w-0 rounded border-2 border-rule bg-canvas px-3 py-2 text-[1rem] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink sm:text-[0.9375rem]';
export const SMALL_INPUT =
  'w-full min-w-0 rounded border-2 border-rule bg-canvas px-2 py-1.5 text-center text-[1rem] tabular-nums text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink sm:text-[0.9375rem]';
// На телефоне кнопки мельче: крупные съедали пол-экрана, а палец и так
// попадает. Поля при этом остаются 16px — правило про зум айфона.
export const BUTTON =
  'ps-press rounded border-2 border-ink bg-ink px-3 py-1.5 text-xs font-semibold lowercase text-surface hover:opacity-90 disabled:opacity-40 sm:px-4 sm:py-2 sm:text-sm';
export const GHOST =
  'ps-press rounded border-2 border-rule px-2.5 py-1.5 text-xs font-semibold lowercase text-ink hover:border-ink disabled:opacity-40 sm:px-3 sm:py-2 sm:text-sm';
export const CHIP =
  'ps-press rounded-full border-2 px-2.5 py-0.5 text-[0.7rem] font-semibold lowercase transition-colors sm:px-3 sm:py-1 sm:text-xs';
/** Вкладки и переключатели над страницей — тот же размер, что у кнопок. */
export const TAB =
  'ps-press shrink-0 rounded border-2 px-2.5 py-1 text-xs font-semibold lowercase sm:px-3 sm:py-1.5 sm:text-sm';
