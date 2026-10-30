'use client';

import { createContext, useContext } from 'react';

/**
 * Общее для рисунков мопса: первый кадр и краски.
 *
 * Кадр — «часть → атрибут → значение». Его считает `PugRig` и при рендере
 * (сервер отдаёт мопса уже в позе), и в каждом кадре анимации, где пишет
 * атрибуты прямо в DOM по `data-part`.
 */

export type Frame = Map<string, Record<string, string>>;

export const Initial = createContext<Frame>(new Map());

export function Part({ name, children, ...rest }: { name: string; children?: React.ReactNode } & React.SVGProps<SVGGElement>) {
  const initial = useContext(Initial);
  return (
    <g data-part={name} {...rest} {...initial.get(name)}>
      {children}
    </g>
  );
}

/** То же для отдельного пути: `d` у конечностей спереди меняется каждый кадр. */
export function PartPath({ name, ...rest }: { name: string } & React.SVGProps<SVGPathElement>) {
  const initial = useContext(Initial);
  return <path data-part={name} {...rest} {...initial.get(name)} />;
}

const mix = (a: string, pa: number, b: string) => `color-mix(in oklab, rgb(var(--${a})) ${pa}%, rgb(var(--${b})))`;

/**
 * Краски — смеси существующих токенов, своих цветов у мопса два (`--pug`,
 * `--pug-mask`). Майка — серая, как застиранная хлопковая «борцовка» из
 * старого зала; шорты почти чёрные; худи — тёмно-серое.
 */
export const C = {
  skin: 'rgb(var(--pug))',
  skinFar: mix('pug', 76, 'pug-mask'),
  /** Объём: тень мышцы — заливкой поверх шерсти, а не тенью. */
  shade: 'rgb(var(--pug-mask) / 0.16)',
  shadeDeep: 'rgb(var(--pug-mask) / 0.3)',
  light: 'rgb(var(--surface) / 0.22)',
  /** Блик на мышце: еле заметный, иначе рука в пятнах. */
  sheen: 'rgb(var(--surface) / 0.13)',
  mask: 'rgb(var(--pug-mask))',
  ink: 'rgb(var(--ink))',
  tank: mix('ink', 10, 'surface'),
  tankShade: mix('ink', 24, 'surface'),
  tankFar: mix('ink', 30, 'surface'),
  shorts: mix('ink', 82, 'surface'),
  shortsFar: mix('ink', 90, 'surface'),
  stripe: mix('ink', 40, 'surface'),
  /** Худи дня отдыха — тёмный, выношенный, как у Левроуна на фото: светло-серый капюшон вокруг морды читался платком. */
  hoodie: mix('ink', 64, 'surface'),
  hoodieFar: mix('ink', 74, 'surface'),
  hoodieInner: mix('ink', 88, 'surface'),
  /** Вытертое и складки на свету: потёртый трикотаж светлеет, а не темнеет. */
  hoodieWorn: mix('ink', 56, 'surface'),
  iron: mix('deep', 90, 'surface'),
  ironEdge: mix('deep', 70, 'surface'),
  chrome: mix('ink', 30, 'surface'),
  frame: mix('ink', 62, 'canvas'),
  pad: mix('ink', 80, 'canvas'),
  padTop: mix('ink', 70, 'canvas'),
  tongue: mix('loss', 45, 'note-pink'),
  sweat: 'rgb(var(--water))',
  white: 'rgb(var(--surface))',
  /** Свечение экрана телефона на морде в день отдыха. */
  screen: 'rgb(var(--halo))'
};

/** Обводка: тот же путь толще и тушью, под заливкой. Суставы не режутся линией. */
export const LINE = { stroke: C.ink, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, fill: C.ink };
