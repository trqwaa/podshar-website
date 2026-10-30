import type { Mood } from '@/lib/sun';

/**
 * Цвета подвала — одни на сцену и на «двери» внизу страниц зала. Все из
 * токенов, смесью: железо, сталь, ржавчина, дерево — цвета предметов, а не
 * оформления, своих токенов им не нужно.
 */
export const INK = 'rgb(var(--ink))';
export const IRON = 'color-mix(in oklab, rgb(var(--deep)) 90%, rgb(var(--surface)))';
export const IRON_EDGE = 'color-mix(in oklab, rgb(var(--deep)) 70%, rgb(var(--surface)))';
export const RUST = 'color-mix(in oklab, rgb(var(--ink)) 72%, rgb(var(--amber)))';
export const STEEL = 'color-mix(in oklab, rgb(var(--ink)) 70%, rgb(var(--sunk)))';
export const WOOD = 'color-mix(in oklab, rgb(var(--amber)) 55%, rgb(var(--ink)))';
export const CHROME = 'color-mix(in oklab, rgb(var(--ink)) 30%, rgb(var(--surface)))';
export const SOVIET = 'color-mix(in oklab, rgb(var(--loss)) 85%, rgb(var(--ink)))';

/** Насколько тёмен бетон в это время суток — по закату, как небо в окне. */
export const WALL: Record<Mood, number> = { day: 22, dusk: 40, night: 62, blood: 64 };
export const wallOf = (mood: Mood) => `color-mix(in oklab, rgb(var(--ink)) ${WALL[mood]}%, rgb(var(--sunk)))`;
export const floorOf = (mood: Mood) => `color-mix(in oklab, rgb(var(--ink)) ${Math.min(90, WALL[mood] + 46)}%, rgb(var(--sunk)))`;
