'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import type { Showcase } from '@/lib/gym/exercises';
import type { FridgeGroup } from '@/lib/gym/foods';
import type { Mood } from '@/lib/sun';
import type { Condition } from '@/lib/weather';
import { PugRig } from './PugRig';

/**
 * Подвальная качалка — вход в зал.
 *
 * Старый подвал, где тренировались легенды: бетонные блоки, трубы под
 * потолком, ржавая стойка, лямки на крюке, мел в миске, блины на стойке,
 * гантельный ряд, кроссовер у стены и зал славы — мопсы-легенды в рамках.
 *
 * Тот же подход, что у пульта-айсберга: сцена рисуется SVG, свет и небо — по
 * настоящему закату над Цюрихом (`lib/sun.ts`, настроение считает сервер, так
 * что первый HTML уже нужного цвета), а погода в окне — настоящая цюрихская и
 * приходит после отрисовки (`/api/gym/sky`): тучи, дождь, снег, туман, гроза.
 * Объём — заливками: блоки бетона разной светлоты, пол в перспективе, конус
 * света от лампочки, зерно поверх, — теней нет, как везде на сайте.
 *
 * Мопс в центре делает упражнение дня по плану смотрящего: жмёт 200, тянет 100
 * к поясу или приседает. День без тренировки — сидит на скамье в капюшоне.
 * Его фраза печатается по буквам прямо на стене, а не висит пузырём поверх
 * картины; ткнёшь в мопса — огрызнётся новой.
 *
 * Разделы — предметы подвала: стойка — тренировка, доска — план, холодильник
 * — питание, матрас — сон. Ссылка — весь предмет; надпись вдоль него
 * полупрозрачная и проявляется и растёт при наведении, чтобы не портить
 * картину. Предметы отзываются: штанга приподнимается, мел пылит, холодильник
 * открывается, над подушкой всплывают «z». Остальное — для души: лампочку
 * можно раскачать, магнитофон включить, портреты качнуть, за окном пройдёт кот.
 *
 * На телефоне подвал не сжимается в полоску: он остаётся высоким и листается
 * вбок, начиная с мопса.
 */

export type BoardRow = { day: string; title: string; today: boolean };
export type SceneKind = 'workout' | 'plan' | 'food' | 'sleep';
export type SceneLink = { kind: SceneKind; href: React.ComponentProps<typeof Link>['href']; label: string; line: string | null };
export type Legend = 'ronnie' | 'levrone' | 'arnold' | 'dorian' | 'vlasov' | 'alekseyev' | 'kirpach';
export type LegendWords = { id: Legend; name: string; title: string };
type Sky = { condition: Condition; wind: number | null };

const WALL: Record<Mood, number> = { day: 22, dusk: 40, night: 62, blood: 64 };
const LIGHT: Record<Mood, number> = { day: 0.14, dusk: 0.24, night: 0.42, blood: 0.34 };
/** Луч из окна: днём заметный, на закате тусклый, ночью его нет. */
const BEAM: Record<Mood, number> = { day: 0.14, dusk: 0.08, night: 0, blood: 0 };
const PLATES: Record<Showcase, number> = { bench: 200, row: 100, squat: 180 };

/**
 * Предметы-ссылки: прямоугольник в единицах сцены 960 × 540 и где надпись.
 * `on` — по чему надпись: по стене (цвет зависит от часа), по мелу или по
 * светлому предмету.
 */
const HITS: Record<SceneKind, { box: [number, number, number, number]; at: [number, number]; on: 'wall' | 'chalk' | 'light'; size: number; start?: boolean }> = {
  workout: { box: [24, 140, 222, 312], at: [132, 186], on: 'wall', size: 2.6 },
  plan: { box: [648, 44, 290, 256], at: [680, 80], on: 'chalk', size: 2.3, start: true },
  // Мельче остальных: «харчування» шире холодильника.
  food: { box: [736, 296, 202, 160], at: [862, 330], on: 'light', size: 1.95 },
  sleep: { box: [26, 452, 280, 72], at: [200, 495], on: 'light', size: 2.6 }
};

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;

const IRON = 'color-mix(in oklab, rgb(var(--deep)) 90%, rgb(var(--surface)))';
const IRON_EDGE = 'color-mix(in oklab, rgb(var(--deep)) 70%, rgb(var(--surface)))';
const RUST = 'color-mix(in oklab, rgb(var(--ink)) 72%, rgb(var(--amber)))';
const STEEL = 'color-mix(in oklab, rgb(var(--ink)) 70%, rgb(var(--sunk)))';
const WOOD = 'color-mix(in oklab, rgb(var(--amber)) 55%, rgb(var(--ink)))';
const CHROME = 'color-mix(in oklab, rgb(var(--ink)) 30%, rgb(var(--surface)))';
const SOVIET = 'color-mix(in oklab, rgb(var(--loss)) 85%, rgb(var(--ink)))';

/** Бетонные блоки: каждый чуть светлее или темнее соседа — стена, а не обои. */
const BLOCKS = Array.from({ length: 10 }, (_, row) =>
  Array.from({ length: 10 }, (_, col) => {
    const x = col * 120 - (row % 2 ? 60 : 0);
    // Детерминированный «шум»: одна и та же стена на сервере и в браузере.
    const k = (((row * 37 + col * 61 + row * col * 11) % 9) - 4) / 4;
    return { x, y: row * 46 - 12, k };
  })
).flat();

/** Капли дождя в окне: одна раскладка на все грозы, дважды по высоте окна — для бесшовного цикла. */
const DROPS = Array.from({ length: 34 }, (_, i) => ({ x: 70 + ((i * 53) % 182), y: 30 + ((i * 29) % 66) }));
const FLAKES = Array.from({ length: 22 }, (_, i) => ({ x: 72 + ((i * 47) % 178), y: 30 + ((i * 31) % 66), r: 1 + (i % 3) * 0.4 }));

/** Погода в окне: девять состояний неба сводятся к пелене, осадкам, туману и грозе. */
function skyLook(sky: Sky | null) {
  const wind = Math.min(1, Math.max(0, (sky?.wind ?? 8) / 45));
  const look = (overcast: number, fall: 'none' | 'drizzle' | 'rain' | 'pour' | 'snow' = 'none', fog = false, storm = false) => ({ overcast, fall, fog, storm, wind });
  switch (sky?.condition) {
    case 'partly':
      return look(0.3);
    case 'cloudy':
      return look(0.75);
    case 'fog':
      return look(0.55, 'none', true);
    case 'drizzle':
      return look(0.7, 'drizzle');
    case 'rain':
      return look(0.8, 'rain');
    case 'showers':
      return look(0.75, 'pour');
    case 'snow':
      return look(0.7, 'snow');
    case 'thunder':
      return look(0.9, 'pour', false, true);
    default:
      return look(0);
  }
}

/** Мех легенд: Ронни и Левроун — чёрные мопсы, Кирпач — загорелый, остальные — палевые. */
const FUR: Partial<Record<Legend, string>> = {
  ronnie: 'color-mix(in oklab, rgb(var(--pug-mask)) 86%, rgb(var(--pug)))',
  levrone: 'color-mix(in oklab, rgb(var(--pug-mask)) 74%, rgb(var(--pug)))',
  kirpach: 'color-mix(in oklab, rgb(var(--pug)) 80%, rgb(var(--amber)))'
};
const BLACK_MASK = 'color-mix(in oklab, rgb(var(--ink)) 88%, rgb(var(--pug-mask)))';

/**
 * Портрет мопса-легенды: старая фотография в деревянной рамке на гвоздике.
 * У каждого — своя пасхалка: Ронни — чёрный мопс с золотой «1» и «yeah
 * buddy», Левроун — чёрный, с высоким флэттопом девяностых и серебряной «2»,
 * Арнольд — с причёской семидесятых и сигарой, Дориан — «тень» в капюшоне,
 * Власов — в очках и красном трико СССР, Алексеев — в том же трико и самый
 * широкий, Кирпач — загорелый, с укладкой, бородой и медалью на сине-жёлтой
 * ленте.
 */
function Portrait({ who, x, title, name, onPick }: { who: Legend; x: number; title: string; name: string; onPick: () => void }) {
  const skin = FUR[who] ?? 'rgb(var(--pug))';
  const black = who === 'ronnie' || who === 'levrone';
  const mask = black ? BLACK_MASK : 'rgb(var(--pug-mask))';
  const wide = who === 'alekseyev' ? 1.12 : 1;
  return (
    <g transform={`translate(${x} 30)`} className="gs-frame cursor-pointer" onClick={onPick}>
      <title>{title}</title>
      <g className="gs-tilt">
        {/* Гвоздь и бечёвка. */}
        <path d="M20-8L4-2M20-8L36-2" className="stroke-ink/40" strokeWidth={0.8} />
        <circle cx={20} cy={-8} r={1.5} className="fill-ink/70" />
        <rect x={-3} y={-3} width={46} height={56} rx={2} style={{ fill: WOOD }} />
        <rect x={-1.6} y={-1.6} width={43.2} height={1.4} className="fill-surface/15" />
        <rect x={0} y={0} width={40} height={50} style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 22%, rgb(var(--surface)))' }} />
        {/* Плечи качка; у Алексеева шире всех. */}
        <path transform={`translate(20 0) scale(${wide} 1) translate(-20 0)`} d="M1 50C2 41 8 37 14 36C16 34 18 33 20 33C22 33 24 34 26 36C32 37 38 41 39 50Z" style={{ fill: skin }} />
        {who === 'kirpach' ? <path d="M9 50C10 45 12 42 14 41M31 50C30 45 28 42 26 41" fill="none" style={{ stroke: 'rgb(var(--pug-mask))' }} strokeOpacity={0.35} strokeWidth={0.8} /> : null}
        {who === 'vlasov' || who === 'alekseyev' ? (
          <>
            {/* Красное трико сборной: лямки и грудь, буквы белым. */}
            <path d={who === 'alekseyev' ? 'M5 50C6 44 9 41 12 40L15 39C16 43 18 45 20 45C22 45 24 43 25 39L28 40C31 41 34 44 35 50Z' : 'M7 50C8 45 10 42 13 41L15 40C16 43 18 45 20 45C22 45 24 43 25 40L27 41C30 42 32 45 33 50Z'} style={{ fill: SOVIET }} />
            <text x={20} y={49} textAnchor="middle" className="fill-surface" style={{ font: '800 3.6px var(--font-sans), sans-serif' }}>
              СССР
            </text>
          </>
        ) : null}
        {who === 'dorian' ? (
          <>
            {/* «Тень»: худи с капюшоном вокруг головы. */}
            <path d="M2 50C3 41 9 37 14 36L20 38L26 36C31 37 37 41 38 50Z" style={{ fill: STEEL }} />
            <path d="M6 36C4 18 10 7 20 7C30 7 36 18 34 36C30 30 28 24 20 24C12 24 10 30 6 36Z" style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 55%, rgb(var(--sunk)))' }} />
          </>
        ) : null}
        <ellipse cx={20} cy={22} rx={12 * (who === 'alekseyev' ? 1.06 : 1)} ry={10.6} style={{ fill: skin }} />
        {/* Причёски — до ушей: уши ложатся поверх. */}
        {who === 'levrone' ? (
          <>
            <rect x={10} y={4.5} width={20} height={9} rx={1.6} className="fill-ink" />
            <path d="M10.5 8H29.5" className="stroke-surface/15" strokeWidth={0.7} />
          </>
        ) : null}
        {who === 'arnold' ? <path d="M8 19C7 10 13 5.5 21 5.5C28 5.5 33 9.5 32.5 16C30 12.5 26 11.5 22 12.5C17 10.5 12 13 8 19Z" style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 45%, rgb(var(--ink)))' }} /> : null}
        {who === 'vlasov' || who === 'alekseyev' ? <path d="M9 16C10 10 15 8.2 20 8.2C25 8.2 30 10 31 16C27 13 13 13 9 16Z" className="fill-ink/85" /> : null}
        {who === 'kirpach' ? <path d="M9 15C9 8 14 4.6 21 4.6C27 4.6 31.5 7.5 31 12.5C28.5 10 24.5 9.8 21 10.8C17 9.8 12.5 11.5 9 15Z" style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 30%, rgb(var(--ink)))' }} /> : null}
        {who === 'ronnie' ? <ellipse cx={17} cy={14.5} rx={4} ry={1.8} className="fill-surface/25" /> : null}
        {who === 'dorian' ? null : (
          <>
            {/* Уши-«пуговки» падают вперёд. */}
            <path d="M10 14C7 13 5 16 6 21C8 21 10 19 12 16Z" style={{ fill: mask }} />
            <path d="M30 14C33 13 35 16 34 21C32 21 30 19 28 16Z" style={{ fill: mask }} />
          </>
        )}
        <path d="M15 15Q20 12.6 25 15" fill="none" style={{ stroke: black ? 'rgb(var(--surface))' : mask }} strokeWidth={0.9} strokeOpacity={black ? 0.18 : 0.6} />
        <path d="M11.6 21.6C11.6 17.8 28.4 17.8 28.4 21.6C28.4 29.6 24.4 32.6 20 32.6C15.6 32.6 11.6 29.6 11.6 21.6Z" style={{ fill: mask }} />
        {who === 'kirpach' ? <path d="M12.4 26C13 31 16 33.6 20 33.6C24 33.6 27 31 27.6 26C25 29 15 29 12.4 26Z" style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 30%, rgb(var(--ink)))' }} /> : null}
        {black ? (
          <>
            <circle cx={15.8} cy={21} r={2.9} className="fill-surface/80" />
            <circle cx={24.2} cy={21} r={2.9} className="fill-surface/80" />
          </>
        ) : null}
        <circle cx={15.8} cy={21} r={2.4} className="fill-ink" />
        <circle cx={24.2} cy={21} r={2.4} className="fill-ink" />
        <circle cx={16.4} cy={20.3} r={0.7} className="fill-surface" />
        <circle cx={24.8} cy={20.3} r={0.7} className="fill-surface" />
        {who === 'dorian' ? <path d="M12.6 17.6L18 19.2M27.4 17.6L22 19.2" className="stroke-ink" strokeWidth={1.1} strokeLinecap="round" /> : null}
        {who === 'vlasov' ? (
          <path d="M12.2 21a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0M20.6 21a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0M19.4 20.6H20.6M12.2 20.4L9.6 19M27.8 20.4L30.4 19" fill="none" className="stroke-surface" strokeWidth={0.9} />
        ) : null}
        <path d="M16 24.6Q20 22.8 24 24.6" fill="none" style={{ stroke: black ? 'rgb(var(--surface))' : skin }} strokeWidth={0.8} strokeOpacity={black ? 0.25 : 0.6} />
        <ellipse cx={20} cy={26} rx={2.2} ry={1.4} className="fill-ink" />
        {who === 'ronnie' ? (
          <>
            {/* «Yeah buddy!» — рот открыт, на груди золото с единицей. */}
            <ellipse cx={20} cy={29.8} rx={2.4} ry={1.8} className="fill-loss/70" />
            <path d="M16 36L20 42L24 36" fill="none" className="stroke-halo" strokeWidth={1.1} />
            <circle cx={20} cy={44.4} r={3.6} className="fill-halo stroke-amber" strokeWidth={0.8} />
            <text x={20} y={46} textAnchor="middle" className="fill-amber" style={{ font: '800 4.6px var(--font-sans), sans-serif' }}>
              1
            </text>
          </>
        ) : null}
        {who === 'levrone' ? (
          <>
            <path d="M16 36L20 42L24 36" fill="none" className="stroke-accent" strokeWidth={1.1} />
            <circle cx={20} cy={44.4} r={3.6} className="fill-sunk stroke-ink/40" strokeWidth={0.8} />
            <text x={20} y={46} textAnchor="middle" className="fill-ink/70" style={{ font: '800 4.6px var(--font-sans), sans-serif' }}>
              2
            </text>
          </>
        ) : null}
        {who === 'kirpach' ? (
          <>
            {/* Лента — синяя и жёлтая. */}
            <path d="M16 35.5L18.6 41.6" style={{ stroke: 'color-mix(in oklab, rgb(var(--accent)) 80%, rgb(var(--ink)))' }} strokeWidth={1.6} />
            <path d="M24 35.5L21.4 41.6" style={{ stroke: 'color-mix(in oklab, rgb(var(--note-yellow)) 40%, rgb(var(--halo)))' }} strokeWidth={1.6} />
            <circle cx={20} cy={44.4} r={3.4} className="fill-halo stroke-amber" strokeWidth={0.8} />
          </>
        ) : null}
        {who === 'arnold' ? (
          <>
            <path d="M17.5 29.4Q20 31 22.5 29.4" fill="none" className="stroke-surface/50" strokeWidth={0.7} />
            <rect x={22} y={27.5} width={9} height={2.4} rx={1} style={{ fill: RUST }} />
            <rect x={30} y={27.6} width={1.4} height={2.2} className="fill-loss/80" />
            <path d="M32 26Q34 22 31 19Q34 17 32 13" fill="none" className="stroke-ink/30" strokeWidth={0.9} />
          </>
        ) : null}
        {who === 'alekseyev' ? <path d="M15 30.6Q20 32.6 25 30.6" fill="none" className="stroke-surface/40" strokeWidth={0.7} /> : null}
        {/* Стекло: блик по диагонали. */}
        <path d="M0 0H14L0 18Z" className="fill-surface/10" />
        <rect x={4} y={55} width={32} height={9} rx={1.5} style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 40%, rgb(var(--surface)))' }} />
        <text x={20} y={61.6} textAnchor="middle" className="fill-ink" style={{ font: '700 6.2px var(--font-sans), sans-serif' }}>
          {name}
        </text>
      </g>
    </g>
  );
}

/** Где у иконки еды низ: еда стоит на табурете, а не висит над ним. */
const FOOD_BOTTOM: Record<FridgeGroup, number> = {
  burger: 9,
  fries: 8,
  soda: 8,
  pizza: 6,
  doner: 8,
  chicken: 6.6,
  rice: 9,
  shaker: 8,
  eggs: 6.6,
  veg: 7,
  fruit: 6.4,
  sweets: 6,
  dairy: 8,
  fish: 6
};

/** То, что съедено сегодня, — у холодильника и на его полках. */
function FoodIcon({ kind, x, y }: { kind: FridgeGroup; x: number; y: number }) {
  const g = (children: React.ReactNode) => <g transform={`translate(${x} ${y})`}>{children}</g>;
  const bun = 'color-mix(in oklab, rgb(var(--amber)) 45%, rgb(var(--surface)))';
  switch (kind) {
    case 'burger':
      return g(
        <>
          <path d="M-11-4C-11-14 11-14 11-4Z" style={{ fill: bun }} className="stroke-ink/50" strokeWidth={1} />
          <rect x={-12} y={-4} width={24} height={3} className="fill-win/70" />
          <rect x={-11.5} y={-1} width={23} height={4.4} rx={2} style={{ fill: RUST }} />
          <rect x={-12} y={3.4} width={24} height={2} className="fill-halo" />
          <path d="M-11 5.4H11C11 10 -11 10 -11 5.4Z" style={{ fill: bun }} className="stroke-ink/50" strokeWidth={1} />
        </>
      );
    case 'fries':
      return g(
        <>
          {[-6, -3, 0, 3, 6].map((dx) => (
            <rect key={dx} x={dx - 1.2} y={-16 + Math.abs(dx) * 0.6} width={2.4} height={12} className="fill-halo stroke-amber/60" strokeWidth={0.5} />
          ))}
          <path d="M-9-6H9L7 8H-7Z" className="fill-loss" />
        </>
      );
    case 'soda':
      return g(
        <>
          <rect x={-5.5} y={-14} width={11} height={22} rx={2.4} className="fill-loss stroke-ink/50" strokeWidth={1} />
          <rect x={-5.5} y={-6} width={11} height={5} className="fill-surface/70" />
        </>
      );
    case 'pizza':
      return g(
        <>
          <path d="M-12 6L12 6L0-12Z" style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 60%, rgb(var(--surface)))' }} className="stroke-ink/50" strokeWidth={1} />
          <circle cx={-3} cy={1} r={1.8} className="fill-loss/80" />
          <circle cx={3} cy={2.4} r={1.8} className="fill-loss/80" />
          <circle cx={0} cy={-4} r={1.6} className="fill-loss/80" />
        </>
      );
    case 'doner':
      return g(
        <>
          <path d="M-7-12C-3-14 3-14 7-12L5 8H-5Z" style={{ fill: bun }} className="stroke-ink/50" strokeWidth={1} />
          <path d="M-5-10H5V-2H-5Z" style={{ fill: RUST }} />
          <path d="M-5-4H5" className="stroke-win" strokeWidth={2} />
        </>
      );
    case 'chicken':
      return g(
        <>
          <path d="M-10 0C-10-8 0-11 6-7C11-4 11 4 5 6C-1 8-10 6-10 0Z" style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 35%, rgb(var(--surface)))' }} className="stroke-ink/50" strokeWidth={1} />
          <path d="M-4-4Q0-6 4-3" fill="none" className="stroke-amber/50" strokeWidth={1} />
        </>
      );
    case 'rice':
      return g(
        <>
          <path d="M-12-2H12C12 6 6 9 0 9C-6 9-12 6-12-2Z" className="fill-sunk stroke-ink/50" strokeWidth={1} />
          <path d="M-10-2C-8-9 8-9 10-2Z" className="fill-surface stroke-ink/30" strokeWidth={0.8} />
        </>
      );
    case 'shaker':
      return g(
        <>
          <rect x={-6} y={-12} width={12} height={20} rx={2} className="fill-note-mint stroke-ink/50" strokeWidth={1} />
          <rect x={-6.5} y={-16} width={13} height={5} rx={1.5} className="fill-ink" />
        </>
      );
    case 'eggs':
      return g(
        <>
          <ellipse cx={-5} cy={0} rx={4.4} ry={5.6} className="fill-surface stroke-ink/40" strokeWidth={1} />
          <ellipse cx={4} cy={1} rx={4.4} ry={5.6} className="fill-surface stroke-ink/40" strokeWidth={1} />
        </>
      );
    case 'veg':
      return g(
        <>
          <circle cx={-4} cy={-4} r={5} className="fill-win" />
          <circle cx={3} cy={-6} r={4.4} className="fill-win/80" />
          <rect x={-1.5} y={-2} width={3} height={9} className="fill-win/60" />
        </>
      );
    case 'fruit':
      return g(
        <>
          <path d="M-10 2C-6 8 6 8 10-4C6 2-4 4-10 2Z" className="fill-halo stroke-amber/70" strokeWidth={1} />
          <circle cx={4} cy={-6} r={4.6} className="fill-loss/80" />
        </>
      );
    case 'sweets':
      return g(
        <>
          <path d="M-8-4H8V6H-8Z" style={{ fill: RUST }} />
          <path d="M-8-4L-11-7M-8 6L-11 9M8-4L11-7M8 6L11 9" className="stroke-ink/50" strokeWidth={1.2} />
        </>
      );
    case 'dairy':
      return g(
        <>
          <path d="M-6-8L-3-14H3L6-8V8H-6Z" className="fill-surface stroke-ink/50" strokeWidth={1} />
          <rect x={-6} y={-4} width={12} height={5} className="fill-accent/60" />
        </>
      );
    case 'fish':
      return g(<path d="M-12 0C-6-8 6-8 10 0C6 8-6 8-12 0ZM10 0L15-5V5Z" className="fill-water stroke-ink/50" strokeWidth={1} />);
  }
}

/** Фраза мопса печатается по буквам; без движения — сразу целиком. */
function Typed({ text, delay, still }: { text: string; delay: number; still: boolean }) {
  const chars = Array.from(text);
  const step = 0.042;
  const end = delay + chars.length * step;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {chars.map((c, i) => (
          <span key={i} className={still ? undefined : 'gs-ch'} style={still ? undefined : { animationDelay: `${(delay + i * step).toFixed(3)}s` }}>
            {c}
          </span>
        ))}
        {still ? null : (
          <span className="gs-caret" style={{ animationDelay: `0s, ${(end + 1.4).toFixed(2)}s` }}>
            ▍
          </span>
        )}
      </span>
    </>
  );
}

export function GymScene({
  mood,
  showcase,
  board,
  goal,
  links,
  speech,
  pokes,
  pugTitle,
  sceneLabel,
  food,
  legends
}: {
  mood: Mood;
  /** Упражнение дня или отдых. */
  showcase: Showcase | 'rest';
  board: BoardRow[];
  goal: string;
  links: SceneLink[];
  speech: string;
  /** Что мопс огрызается, когда в него тыкают: по строке на тычок, по кругу. */
  pokes: string[];
  pugTitle: string;
  sceneLabel: string;
  /** Что съедено сегодня — группами, без повторов. */
  food: FridgeGroup[];
  legends: LegendWords[];
}) {
  const t = useTranslations('gym');
  const id = `gs${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const still = Boolean(useReducedMotion());
  const dark = mood !== 'day';
  const [sky, setSky] = useState<Sky | null>(null);
  const [said, setSaid] = useState(0);
  const [music, setMusic] = useState(false);
  const [legend, setLegend] = useState<Legend | null>(null);
  const pan = useRef<HTMLDivElement | null>(null);

  // Погода — после отрисовки, своим запросом: рендер в чужой API не ходит.
  useEffect(() => {
    let gone = false;
    fetch('/api/gym/sky', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { sky?: Sky | null } | null) => {
        if (!gone && data?.sky) setSky(data.sky);
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, []);

  // Телефон: подвал шире экрана и листается — начинаем с мопса посередине.
  useLayoutEffect(() => {
    const el = pan.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  // Подпись портрета по нажатию держится три секунды: на телефоне нет наведения.
  useEffect(() => {
    if (!legend) return;
    const timer = setTimeout(() => setLegend(null), 3200);
    return () => clearTimeout(timer);
  }, [legend]);

  const look = skyLook(sky);
  const wall = `color-mix(in oklab, rgb(var(--ink)) ${WALL[mood]}%, rgb(var(--sunk)))`;
  const wallLine = dark ? 'rgb(var(--surface) / 0.07)' : 'rgb(var(--ink) / 0.09)';
  const floor = `color-mix(in oklab, rgb(var(--ink)) ${Math.min(90, WALL[mood] + 46)}%, rgb(var(--sunk)))`;
  const sky0 =
    mood === 'day'
      ? ['rgb(var(--surface))', 'rgb(var(--water))']
      : mood === 'dusk'
        ? ['color-mix(in oklab, rgb(var(--deep)) 70%, rgb(var(--water)))', 'color-mix(in oklab, rgb(var(--halo)) 60%, rgb(var(--water)))']
        : mood === 'blood'
          ? ['rgb(var(--deep))', 'color-mix(in oklab, rgb(var(--blood)) 45%, rgb(var(--deep)))']
          : ['rgb(var(--deep))', 'color-mix(in oklab, rgb(var(--deep)) 80%, rgb(var(--water)))'];
  const cloud = dark
    ? 'color-mix(in oklab, rgb(var(--deep)) 62%, rgb(var(--water)))'
    : `color-mix(in oklab, rgb(var(--surface)) ${Math.round(100 - look.overcast * 40)}%, rgb(var(--ink)))`;
  const fall = dark ? 'rgb(var(--surface) / 0.55)' : 'rgb(var(--ink) / 0.35)';
  const onStool = food.slice(0, 2);
  const onShelves = food.slice(0, 6);
  const line = said === 0 ? speech : pokes[(said - 1) % Math.max(1, pokes.length)] ?? speech;
  const tilt = (-look.wind * 22).toFixed(1);
  const shown = legends.find((l) => l.id === legend);

  // Отклик предметов — CSS по `:has()`, без состояния: ссылка лежит поверх
  // сцены, а двигается то, что нарисовано под ней.
  const css = `
.${id} .gs-door{transition:transform .55s cubic-bezier(.2,.8,.2,1);transform-box:fill-box;transform-origin:100% 50%}
.${id}:has(a[data-kind=food]:is(:hover,:focus-visible)) .gs-door{transform:scaleX(.1)}
.${id} .gs-cold{opacity:0;transition:opacity .4s}
.${id}:has(a[data-kind=food]:is(:hover,:focus-visible)) .gs-cold{opacity:1}
.${id} .gs-bar{transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.${id}:has(a[data-kind=workout]:is(:hover,:focus-visible)) .gs-bar{transform:translateY(-12px)}
.${id} .gs-puff{opacity:0;transform-box:fill-box;transform-origin:50% 100%}
.${id}:has(a[data-kind=workout]:is(:hover,:focus-visible)) .gs-puff{animation:gs-puff 1.3s ease-out}
.${id} .gs-zzz{opacity:0;transition:opacity .4s,transform .8s;transform:translateY(6px)}
.${id}:has(a[data-kind=sleep]:is(:hover,:focus-visible)) .gs-zzz{opacity:1;transform:none}
.${id} .gs-pillow{transition:transform .4s;transform-box:fill-box;transform-origin:50% 100%}
.${id}:has(a[data-kind=sleep]:is(:hover,:focus-visible)) .gs-pillow{transform:scale(1.06,1.18)}
.${id} .gs-chalk{transition:opacity .4s}
.${id}:has(a[data-kind=plan]:is(:hover,:focus-visible)) .gs-chalk{opacity:1}
.${id} .gs-label{opacity:.42;transform:var(--at);transition:opacity .3s,transform .35s cubic-bezier(.2,.8,.2,1)}
.${id} a:is(:hover,:focus-visible) .gs-label{opacity:1;transform:var(--at) scale(1.18)}
@media (hover:none){.${id} .gs-label{opacity:.72}}
.${id} .gs-tilt{transition:transform .5s cubic-bezier(.2,.8,.2,1.4);transform-box:fill-box;transform-origin:50% 0}
.${id} .gs-frame:hover .gs-tilt{transform:rotate(-5deg)}
.${id} .gs-lamp:hover .gs-swing{animation:gs-swing-hard 1.6s ease-in-out 2}
.${id} .gs-dbs:hover .gs-db{animation:gs-clink .38s ease-in-out}
.${id} .gs-tree:hover .gs-hang{animation:gs-hang 1.1s ease-in-out}
.${id} .gs-hang{transform-box:fill-box;transform-origin:50% 50%}
.${id} .gs-cat{transform:translateX(-60px)}
.${id} .gs-window:hover .gs-cat{animation:gs-cat 5s linear}
.${id} .gs-note{opacity:0}
.${id}.gs-music .gs-note{animation:gs-note 1.8s ease-out infinite}
.${id}.gs-music .gs-cone{animation:gs-beat .45s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:50% 50%}
.${id} .gs-drift{animation:gs-drift 38s ease-in-out infinite alternate}
.${id} .gs-rain{animation:gs-rain .55s linear infinite}
.${id} .gs-snow{animation:gs-snow 7s linear infinite}
.${id} .gs-flash{opacity:0;animation:thunder 7s linear infinite}
.${id} .gs-ch{opacity:0;animation:gs-type .01s linear forwards}
.${id} .gs-caret{animation:gs-caret 1s steps(1,end) infinite,gs-gone .01s linear forwards}
@keyframes gs-type{to{opacity:1}}
@keyframes gs-caret{50%{opacity:0}}
@keyframes gs-gone{to{opacity:0;visibility:hidden}}
@keyframes gs-puff{0%{opacity:.85;transform:translateY(0) scale(.5)}100%{opacity:0;transform:translateY(-30px) scale(1.7)}}
@keyframes gs-swing-hard{0%,100%{transform:rotate(0)}25%{transform:rotate(9deg)}75%{transform:rotate(-9deg)}}
@keyframes gs-clink{25%{transform:translateY(-2px) rotate(-3deg)}75%{transform:translateY(-1px) rotate(2deg)}}
@keyframes gs-hang{30%{transform:rotate(4deg)}70%{transform:rotate(-3deg)}}
@keyframes gs-cat{to{transform:translateX(260px)}}
@keyframes gs-note{0%{opacity:0;transform:translate(0,0)}20%{opacity:.9}100%{opacity:0;transform:translate(10px,-34px)}}
@keyframes gs-beat{to{transform:scale(1.18)}}
@keyframes gs-drift{from{transform:translateX(-14px)}to{transform:translateX(14px)}}
@keyframes gs-rain{from{transform:translateY(-66px)}to{transform:translateY(0)}}
@keyframes gs-snow{from{transform:translateY(-66px)}to{transform:translateY(0)}}
@media (prefers-reduced-motion: reduce){.${id} *{transition:none!important}.${id} .gs-ch{opacity:1}.${id} .gs-caret{display:none}}`;

  const labelColor = (on: 'wall' | 'chalk' | 'light') => (on === 'chalk' ? 'rgb(var(--surface))' : on === 'light' ? 'rgb(var(--ink))' : dark ? 'rgb(var(--surface))' : 'rgb(var(--ink))');

  return (
    <div>
      <div
        ref={pan}
        className="-mx-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:mx-0 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        <div
          className={`${id} ${music ? 'gs-music' : ''} relative mx-auto aspect-[16/9] h-[min(64vh,22rem)] overflow-hidden rounded-[10px] [container-type:inline-size] sm:h-auto sm:w-full`}
          aria-label={sceneLabel}
          role="group"
        >
          <style>{css}</style>
          <svg viewBox="0 0 960 540" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: sky0[0] }} />
                <stop offset="1" style={{ stopColor: sky0[1] }} />
              </linearGradient>
              {/* Спад света — по кривой и до нуля внутри сцены: пятно-эллипс
                  обрезало градиент раньше, и на стене была видна дуга, где свет
                  кончается. Теперь заливается вся сцена, а пятно — в градиенте. */}
              <radialGradient id={`${id}-light`} gradientUnits="userSpaceOnUse" cx={470} cy={110} r={520} gradientTransform="translate(470 110) scale(1 0.8) translate(-470 -110)">
                {[
                  [0, 2],
                  [0.25, 1.35],
                  [0.5, 0.75],
                  [0.7, 0.34],
                  [0.85, 0.11],
                  [1, 0]
                ].map(([at, k]) => (
                  <stop key={at} offset={at} style={{ stopColor: 'rgb(var(--halo))', stopOpacity: LIGHT[mood] * k }} />
                ))}
              </radialGradient>
              <linearGradient id={`${id}-cone`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: LIGHT[mood] * 0.9 }} />
                <stop offset="0.5" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: LIGHT[mood] * 0.35 }} />
                <stop offset="1" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: 0 }} />
              </linearGradient>
              <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: BEAM[mood] }} />
                <stop offset="1" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: 0 }} />
              </linearGradient>
              {/* Стена темнее у потолка и у пола: свет лампочки до них не добивает. */}
              <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'rgb(var(--ink))', stopOpacity: 0.22 }} />
                <stop offset="0.3" style={{ stopColor: 'rgb(var(--ink))', stopOpacity: 0 }} />
                <stop offset="0.86" style={{ stopColor: 'rgb(var(--ink))', stopOpacity: 0 }} />
                <stop offset="1" style={{ stopColor: 'rgb(var(--ink))', stopOpacity: 0.26 }} />
              </linearGradient>
              <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'rgb(var(--ink))', stopOpacity: 0.3 }} />
                <stop offset="0.35" style={{ stopColor: 'rgb(var(--ink))', stopOpacity: 0 }} />
                <stop offset="1" style={{ stopColor: 'rgb(var(--ink))', stopOpacity: 0.16 }} />
              </linearGradient>
              <linearGradient id={`${id}-fridge`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" style={{ stopColor: 'color-mix(in oklab, rgb(var(--surface)) 94%, rgb(var(--ink)))' }} />
                <stop offset="1" style={{ stopColor: 'color-mix(in oklab, rgb(var(--surface)) 78%, rgb(var(--ink)))' }} />
              </linearGradient>
              <radialGradient id={`${id}-corner`} cx="0.5" cy="0.45" r="0.75">
                <stop offset="0.6" style={{ stopColor: 'rgb(var(--ink))', stopOpacity: 0 }} />
                <stop offset="1" style={{ stopColor: 'rgb(var(--ink))', stopOpacity: dark ? 0.45 : 0.26 }} />
              </radialGradient>
              <clipPath id={`${id}-window`}>
                <rect x={74} y={34} width={172} height={66} rx={3} />
              </clipPath>
            </defs>

            {/* Стена из бетонных блоков. */}
            <rect width={960} height={448} style={{ fill: wall }} />
            {BLOCKS.map(({ x, y, k }) => (
              <rect key={`${x}:${y}`} x={x + 1.5} y={y + 1.5} width={117} height={43} rx={1.5} style={{ fill: k > 0 ? 'rgb(var(--surface))' : 'rgb(var(--ink))' }} opacity={Math.abs(k) * (dark ? 0.05 : 0.07)} />
            ))}
            <g style={{ stroke: wallLine }} strokeWidth={2.5}>
              {Array.from({ length: 10 }, (_, row) => (
                <g key={row}>
                  <line x1={0} y1={row * 46 - 12} x2={960} y2={row * 46 - 12} />
                  {Array.from({ length: 10 }, (_, col) => {
                    const x = col * 120 - (row % 2 ? 60 : 0);
                    return <line key={col} x1={x} y1={row * 46 - 12} x2={x} y2={row * 46 + 34} />;
                  })}
                </g>
              ))}
            </g>
            <rect width={960} height={448} fill={`url(#${id}-wall)`} />
            {/* Трещины ветками и подтёк от трубы. */}
            <g className="stroke-ink/25" strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M300 168L310 186L305 200L316 222L312 236M310 186L322 192" />
              <path d="M938 150L928 170L933 188L924 206M928 170L918 174" />
            </g>
            <ellipse cx={720} cy={22} rx={58} ry={30} className="fill-ink/5" />
            <path d="M712 30C710 60 716 90 712 120" className="stroke-ink/10" strokeWidth={6} strokeLinecap="round" fill="none" />

            {/* Трубы под потолком: блик сверху, хомуты, вентиль. */}
            <g>
              <rect x={0} y={4} width={960} height={10} rx={5} style={{ fill: STEEL }} />
              <rect x={0} y={5.5} width={960} height={2} className="fill-surface/15" />
              <rect x={0} y={17} width={960} height={6} rx={3} style={{ fill: RUST }} opacity={0.8} />
              {[90, 330, 600, 860].map((x) => (
                <rect key={x} x={x} y={0} width={8} height={26} rx={2} className="fill-ink/60" />
              ))}
              <circle cx={550} cy={9} r={9} fill="none" className="stroke-loss/80" strokeWidth={3} />
              <path d="M541 9H559M550 0V18" className="stroke-loss/80" strokeWidth={2} />
            </g>

            {/* Окошко у самой земли: небо и погода — цюрихские, сейчас. */}
            <g className="gs-window">
              <rect x={66} y={26} width={188} height={82} rx={5} style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 70%, rgb(var(--sunk)))' }} />
              <rect x={74} y={34} width={172} height={66} rx={3} fill={`url(#${id}-sky)`} />
              <g clipPath={`url(#${id}-window)`}>
                {dark && look.overcast < 0.5
                  ? [
                      [96, 48],
                      [130, 42],
                      [176, 54],
                      [214, 44],
                      [228, 62],
                      [150, 66]
                    ].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.3} className="fill-surface" opacity={mood === 'dusk' ? 0.35 : 0.8} />)
                  : null}
                {look.overcast < 0.7 ? (
                  <g opacity={1 - look.overcast}>
                    {mood === 'blood' ? <circle cx={206} cy={54} r={11} style={{ fill: 'color-mix(in oklab, rgb(var(--blood)) 75%, rgb(var(--halo)))' }} /> : null}
                    {mood === 'night' ? <circle cx={206} cy={52} r={9} className="fill-surface" opacity={0.85} /> : null}
                    {mood === 'day' ? <circle cx={214} cy={48} r={14} className="fill-halo" opacity={0.9} /> : null}
                  </g>
                ) : null}
                {/* Тучи: чем пасмурнее, тем их больше и тем они серее. */}
                {look.overcast > 0 ? (
                  <g className={still ? undefined : 'gs-drift'} style={{ fill: cloud }} opacity={0.5 + look.overcast * 0.5}>
                    {look.overcast > 0.6 ? <rect x={60} y={30} width={200} height={40} opacity={look.overcast - 0.4} /> : null}
                    {[
                      [104, 50, 1],
                      [178, 44, 1.2],
                      [236, 56, 0.9],
                      [140, 64, 0.8],
                      [90, 40, 0.7]
                    ]
                      .slice(0, look.overcast > 0.6 ? 5 : 3)
                      .map(([cx, cy, s], i) => (
                        <g key={i} transform={`translate(${cx} ${cy}) scale(${s})`}>
                          <ellipse rx={17} ry={7} />
                          <ellipse cx={-10} cy={2} rx={10} ry={6} />
                          <ellipse cx={11} cy={2} rx={11} ry={6} />
                          <ellipse cx={2} cy={-5} rx={10} ry={7} />
                        </g>
                      ))}
                  </g>
                ) : null}
                {look.storm ? (
                  <g className={still ? undefined : 'gs-flash'}>
                    <rect x={74} y={34} width={172} height={66} className="fill-surface" opacity={0.7} />
                    <path d="M170 34L160 54H168L156 76" fill="none" className="stroke-halo" strokeWidth={2.4} strokeLinejoin="round" />
                  </g>
                ) : null}
                {/* Трава на уровне земли: окно в подвале — у самой земли. */}
                <path
                  d="M74 100L80 88L84 100L90 84L95 100L101 90L106 100L113 86L118 100L126 90L131 100L139 84L144 100L152 92L157 100L165 86L170 100L178 90L184 100L191 84L197 100L204 91L210 100L217 86L222 100L230 90L236 100L242 86L246 100Z"
                  style={{
                    fill:
                      look.fall === 'snow'
                        ? 'color-mix(in oklab, rgb(var(--surface)) 80%, rgb(var(--water)))'
                        : dark
                          ? 'color-mix(in oklab, rgb(var(--win)) 35%, rgb(var(--deep)))'
                          : 'color-mix(in oklab, rgb(var(--win)) 70%, rgb(var(--surface)))'
                  }}
                />
                {/* Дождь и снег: две копии раскладки друг над другом — цикл без шва. */}
                {look.fall !== 'none' && look.fall !== 'snow' ? (
                  <g transform={`skewX(${tilt})`} style={{ transformOrigin: '160px 100px' }}>
                    <g className={still ? undefined : 'gs-rain'} style={{ animationDuration: look.fall === 'drizzle' ? '0.9s' : look.fall === 'pour' ? '0.4s' : undefined }}>
                      {[0, 66].map((dy) =>
                        DROPS.slice(0, look.fall === 'drizzle' ? 14 : look.fall === 'pour' ? 34 : 24).map((d, i) => (
                          <line key={`${dy}:${i}`} x1={d.x} y1={d.y + dy} x2={d.x} y2={d.y + dy + (look.fall === 'drizzle' ? 4 : 8)} style={{ stroke: fall }} strokeWidth={1} strokeLinecap="round" />
                        ))
                      )}
                    </g>
                  </g>
                ) : null}
                {look.fall === 'snow' ? (
                  <g className={still ? undefined : 'gs-snow'}>
                    {[0, 66].map((dy) =>
                      FLAKES.map((f, i) => <circle key={`${dy}:${i}`} cx={f.x} cy={f.y + dy} r={f.r} className={dark ? 'fill-surface/80' : 'fill-surface'} />)
                    )}
                  </g>
                ) : null}
                {/* Кто-то проходит мимо — видны только ботинки. */}
                {still ? null : (
                  <g className="animate-gym-walk" style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 80%, rgb(var(--sunk)))' }}>
                    <rect x={-30} y={56} width={7} height={38} rx={3} />
                    <rect x={-34} y={90} width={15} height={7} rx={3} />
                    <rect x={-14} y={58} width={7} height={36} rx={3} />
                    <rect x={-18} y={90} width={15} height={7} rx={3} />
                  </g>
                )}
                {/* Кот: проходит по траве, если засмотреться на окно. */}
                <g className="gs-cat" style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 85%, rgb(var(--sunk)))' }}>
                  <ellipse cx={20} cy={91} rx={11} ry={5} />
                  <circle cx={32} cy={86} r={4.4} />
                  <path d="M29 83L30 78L33 82ZM33 82L36 78L36.5 83Z" />
                  <path d="M10 90C4 88 3 82 6 78" fill="none" style={{ stroke: 'color-mix(in oklab, rgb(var(--ink)) 85%, rgb(var(--sunk)))' }} strokeWidth={2.4} strokeLinecap="round" />
                  <rect x={12} y={94} width={2.4} height={6} />
                  <rect x={26} y={94} width={2.4} height={6} />
                </g>
                {look.fog ? (
                  <>
                    <rect x={74} y={34} width={172} height={66} style={{ fill: dark ? 'rgb(var(--water) / 0.32)' : 'rgb(var(--surface) / 0.62)' }} />
                    <ellipse cx={130} cy={88} rx={70} ry={14} style={{ fill: dark ? 'rgb(var(--water) / 0.25)' : 'rgb(var(--surface) / 0.5)' }} />
                  </>
                ) : null}
              </g>
              <g style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 70%, rgb(var(--sunk)))' }}>
                {[112, 152, 192, 230].map((x) => (
                  <rect key={x} x={x} y={34} width={4} height={66} />
                ))}
              </g>
              {/* Стекло: два блика. Наведение ловит весь проём. */}
              <path d="M78 98L100 36H108L86 98Z" className="fill-surface/10" />
              <rect x={66} y={26} width={188} height={82} fill="transparent" />
            </g>

            {/* Зал славы: мопсы-легенды. Ронни — первый, Левроун — второй. */}
            {legends.map((l, i) => (
              <Portrait key={l.id} who={l.id} x={[266, 316, 366, 416, 506, 556, 606][i] ?? 606} title={l.title} name={l.name} onPick={() => setLegend(l.id === legend ? null : l.id)} />
            ))}

            {/* Лозунг краской по бетону, над стойкой. */}
            <text x={130} y={134} textAnchor="middle" className="fill-surface" opacity={dark ? 0.32 : 0.55} style={{ font: '800 17px var(--font-sans), sans-serif', letterSpacing: '0.12em' }}>
              {t('slogan')}
            </text>

            {/* Кроссовер у дальней стены — за мопсом, в полутени. */}
            <g opacity={0.5} style={{ fill: STEEL }}>
              <rect x={318} y={150} width={12} height={298} />
              <rect x={630} y={150} width={12} height={298} />
              <rect x={312} y={144} width={336} height={10} rx={3} />
              <rect x={296} y={372} width={22} height={74} rx={2} style={{ fill: IRON }} />
              <rect x={642} y={372} width={22} height={74} rx={2} style={{ fill: IRON }} />
              <circle cx={340} cy={166} r={6} className="fill-ink" />
              <circle cx={620} cy={166} r={6} className="fill-ink" />
              <line x1={340} y1={166} x2={346} y2={300} className="stroke-ink" strokeWidth={1.5} />
              <line x1={620} y1={166} x2={614} y2={300} className="stroke-ink" strokeWidth={1.5} />
              <rect x={341} y={298} width={10} height={14} rx={3} className="fill-ink" />
              <rect x={609} y={298} width={10} height={14} rx={3} className="fill-ink" />
            </g>

            {/* Доска с планом мелом. Заголовок «план» — надпись-ссылка поверх. */}
            <g>
              <rect x={652} y={50} width={282} height={244} rx={6} style={{ fill: WOOD }} />
              <path d="M656 58H930M656 286H930" className="stroke-ink/20" strokeWidth={1.2} />
              <rect x={662} y={60} width={262} height={224} rx={3} className="fill-chalkboard" />
              {/* Меловые разводы от тряпки. */}
              <path d="M690 250C730 238 790 262 840 246M700 214C760 206 800 224 880 210" className="stroke-surface/5" strokeWidth={10} strokeLinecap="round" fill="none" />
              <text x={906} y={92} textAnchor="end" className="fill-surface" style={{ font: '600 14px var(--font-sans), sans-serif' }} opacity={0.7}>
                {goal}
              </text>
              <line x1={680} y1={102} x2={906} y2={104} className="stroke-surface/40" strokeWidth={2} strokeLinecap="round" />
              {board.map((row, i) => {
                const y = 128 + i * 23.5;
                return (
                  <g key={row.day} style={{ font: `${row.today ? 700 : 500} 15.5px var(--font-sans), sans-serif` }}>
                    <text x={682} y={y} className="fill-surface" opacity={row.today ? 1 : 0.62}>
                      {row.day}
                    </text>
                    <text x={722} y={y} className="fill-surface" opacity={row.today ? 1 : row.title === '—' ? 0.35 : 0.72}>
                      {row.title.length > 24 ? `${row.title.slice(0, 23)}…` : row.title}
                    </text>
                    {row.today ? (
                      <ellipse cx={790} cy={y - 5} rx={118} ry={13} fill="none" className="stroke-surface/70" strokeWidth={2} transform={`rotate(-1.5 790 ${y - 5})`} />
                    ) : null}
                  </g>
                );
              })}
              {/* Наведёшь на доску — мел у полочки пылит. */}
              <g className="gs-chalk fill-surface/60" opacity={0}>
                <circle cx={752} cy={272} r={2.2} />
                <circle cx={760} cy={266} r={1.5} />
                <circle cx={744} cy={268} r={1.2} />
              </g>
              <rect x={700} y={284} width={200} height={6} rx={2} style={{ fill: WOOD }} />
              <rect x={746} y={279} width={22} height={5} rx={2} className="fill-surface" />
              <rect x={776} y={280} width={8} height={4} rx={1.5} className="fill-surface/80" />
              <path d="M846 285C844 278 852 274 864 275C874 274 882 278 882 284Z" style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 35%, rgb(var(--surface)))' }} />
            </g>

            {/* Пол — старое резиновое покрытие плитами, швы сходятся к точке за мопсом. */}
            <rect y={448} width={960} height={92} style={{ fill: floor }} />
            <g style={{ stroke: dark ? 'rgb(var(--surface) / 0.06)' : 'rgb(var(--ink) / 0.14)' }} strokeWidth={1.6}>
              {[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((i) => (
                <line key={i} x1={480 + i * 84} y1={448} x2={480 + i * 84 * 1.465} y2={540} />
              ))}
              {[465, 487, 517].map((y) => (
                <line key={y} x1={0} y1={y} x2={960} y2={y} />
              ))}
            </g>
            <rect y={448} width={960} height={92} fill={`url(#${id}-floor)`} />

            {/* Луч из окна на пол — днём. */}
            {BEAM[mood] && look.overcast < 0.7 ? <path d="M80 100L240 100L560 470L230 470Z" fill={`url(#${id}-beam)`} /> : null}

            {/* Стойка со штангой — тренировка. Ржавая, с лямками и поясом. */}
            <g style={{ fill: STEEL }}>
              <rect x={48} y={150} width={11} height={300} />
              <rect x={206} y={150} width={11} height={300} />
              <rect x={44} y={146} width={177} height={10} rx={3} />
              <rect x={34} y={444} width={196} height={8} rx={3} />
              <rect x={52} y={238} width={24} height={8} rx={2} />
              <rect x={189} y={238} width={24} height={8} rx={2} />
              {[180, 210, 270, 300, 330].map((y) => (
                <circle key={y} cx={53.5} cy={y} r={1.6} className="fill-ink/40" />
              ))}
            </g>
            <g className="fill-surface/15">
              <rect x={48} y={150} width={2.4} height={300} />
              <rect x={206} y={150} width={2.4} height={300} />
              <rect x={44} y={146} width={177} height={2} />
            </g>
            <path d="M59 300L57 320M217 280L219 305" style={{ stroke: RUST }} strokeWidth={3} opacity={0.6} />
            <g className="gs-bar">
              <rect x={30} y={234} width={206} height={6} rx={3} className="fill-sunk" />
              <rect x={30} y={234} width={206} height={1.6} rx={0.8} className="fill-surface/40" />
              {[32, 50, 214, 232].map((x, i) => (
                <g key={x}>
                  <rect x={x - 7} y={i % 3 === 0 ? 206 : 200} width={14} height={i % 3 === 0 ? 62 : 74} rx={3} style={{ fill: IRON }} />
                  <rect x={x - 6} y={i % 3 === 0 ? 208 : 202} width={2} height={i % 3 === 0 ? 58 : 70} rx={1} style={{ fill: IRON_EDGE }} />
                </g>
              ))}
            </g>
            {/* Лямки на крюке и пояс на стойке. */}
            <path d="M66 246C64 266 70 282 66 300M72 246C72 268 78 284 74 302" style={{ stroke: 'color-mix(in oklab, rgb(var(--loss)) 55%, rgb(var(--ink)))' }} strokeWidth={4} fill="none" strokeLinecap="round" />
            <rect x={203} y={300} width={16} height={56} rx={4} style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 45%, rgb(var(--ink)))' }} />
            <rect x={205} y={318} width={12} height={8} rx={1.5} className="fill-sunk/80" />

            {/* Миска с мелом на подставке; наведёшь на стойку — мел пылит. */}
            <g>
              <rect x={128} y={404} width={8} height={44} className="fill-ink/60" />
              <rect x={114} y={444} width={36} height={6} rx={2} className="fill-ink/60" />
              <path d="M108 394H156L150 406H114Z" style={{ fill: STEEL }} />
              <path d="M112 394C118 386 146 386 152 394Z" className="fill-surface" />
              <g className="gs-puff fill-surface/80">
                <circle cx={124} cy={380} r={5} />
                <circle cx={136} cy={374} r={6} />
                <circle cx={146} cy={382} r={4} />
              </g>
              <circle cx={160} cy={446} r={2} className="fill-surface/60" />
              <circle cx={168} cy={447} r={1.4} className="fill-surface/50" />
            </g>

            {/* Стойка для блинов: блины висят на рогах, рога — из стойки. */}
            <g className="gs-tree">
              <rect x={277} y={318} width={9} height={130} style={{ fill: STEEL }} />
              <rect x={258} y={443} width={48} height={7} rx={2} style={{ fill: STEEL }} />
              <rect x={277} y={318} width={2.2} height={130} className="fill-surface/15" />
              {[
                [350, -1, 20],
                [400, -1, 26],
                [372, 1, 22],
                [418, 1, 18]
              ].map(([y, side, r]) => {
                const peg = side < 0 ? 262 : 286;
                const cx = side < 0 ? 268 : 296;
                return (
                  <g key={y}>
                    <rect x={peg} y={y - 2.5} width={15} height={5} rx={2} style={{ fill: STEEL }} />
                    <g className="gs-hang">
                      <ellipse cx={cx - side * 3} cy={y} rx={6} ry={r} style={{ fill: IRON }} />
                      <ellipse cx={cx} cy={y} rx={6} ry={r} style={{ fill: IRON }} className="stroke-surface/10" strokeWidth={1} />
                      <ellipse cx={cx} cy={y} rx={2.4} ry={r * 0.2} style={{ fill: CHROME }} />
                    </g>
                    <rect x={side < 0 ? peg - 2 : peg + 13} y={y - 3} width={4} height={6} rx={1.5} style={{ fill: STEEL }} />
                  </g>
                );
              })}
            </g>

            {/* Гантельный ряд: две полки, гантели лежат торцами к нам. */}
            <g className="gs-dbs">
              <rect x={600} y={372} width={6} height={78} style={{ fill: STEEL }} />
              <rect x={738} y={372} width={6} height={78} style={{ fill: STEEL }} />
              <rect x={596} y={398} width={152} height={5} rx={1.5} style={{ fill: STEEL }} />
              <rect x={596} y={426} width={152} height={5} rx={1.5} style={{ fill: STEEL }} />
              <rect x={596} y={398} width={152} height={1.4} className="fill-surface/15" />
              {[
                ...[8, 8.6, 9.2, 9.8, 10.4].map((r, i) => ({ x: 618 + i * 26, y: 398, r })),
                ...[11, 11.8, 12.6, 13.4].map((r, i) => ({ x: 622 + i * 33, y: 426, r }))
              ].map(({ x, y, r }) => {
                const pts = Array.from({ length: 6 }, (_, k) => {
                  const a = (Math.PI / 3) * k + Math.PI / 6;
                  return `${(x + Math.cos(a) * r).toFixed(1)},${(y - r + Math.sin(a) * r).toFixed(1)}`;
                }).join(' ');
                return (
                  <g key={`${x}:${y}`} className="gs-db" style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
                    <polygon points={pts} style={{ fill: IRON }} className="stroke-ink/40" strokeWidth={1} />
                    <circle cx={x} cy={y - r} r={r * 0.32} style={{ fill: CHROME }} />
                  </g>
                );
              })}
            </g>
            {/* Гири на полу перед рядом. */}
            <g>
              <path d="M622 436C622 427 636 427 636 436" className="stroke-ink" strokeWidth={3.2} fill="none" />
              <circle cx={629} cy={439} r={9} style={{ fill: IRON }} />
              <path d="M684 432C684 421 702 421 702 432" className="stroke-ink" strokeWidth={3.6} fill="none" />
              <circle cx={693} cy={437} r={11} style={{ fill: IRON }} />
              <path d="M624 434Q629 431 634 434" className="stroke-surface/20" strokeWidth={1.2} fill="none" />
            </g>

            {/* Магнитофон у матраса: включается нажатием. */}
            <g transform="translate(322 432)">
              <rect x={-26} y={-12} width={52} height={24} rx={4} className="fill-ink/80" />
              <circle cx={-14} cy={0} r={7} className="gs-cone fill-sunk/40" />
              <circle cx={14} cy={0} r={7} className="gs-cone fill-sunk/40" />
              <rect x={-6} y={-6} width={12} height={8} rx={1.5} className="fill-sunk/30" />
              <path d="M-18-12C-18-20 18-20 18-12" className="stroke-ink/80" strokeWidth={2.4} fill="none" />
              <circle cx={20} cy={-8} r={1.4} className={music ? 'fill-loss' : 'fill-sunk/30'} />
              <g className="fill-surface" style={{ font: '700 13px var(--font-sans), sans-serif' }}>
                <text className="gs-note" x={-12} y={-20}>
                  ♪
                </text>
                <text className="gs-note" x={6} y={-24} style={{ animationDelay: '0.6s' }}>
                  ♫
                </text>
                <text className="gs-note" x={-2} y={-18} style={{ animationDelay: '1.2s' }}>
                  ♪
                </text>
              </g>
            </g>

            {/* Холодильник — питание. Внутри — то, что сегодня съедено. */}
            <g>
              <rect x={792} y={300} width={140} height={152} rx={16} fill={`url(#${id}-fridge)`} className="stroke-ink/40" strokeWidth={3} />
              <rect x={800} y={358} width={124} height={88} rx={6} style={{ fill: 'color-mix(in oklab, rgb(var(--surface)) 94%, rgb(var(--water)))' }} />
              <rect x={800} y={358} width={124} height={88} rx={6} className="gs-cold fill-halo/25" />
              {[384, 410, 436].map((y) => (
                <line key={y} x1={802} y1={y} x2={922} y2={y} className="stroke-ink/25" strokeWidth={2} />
              ))}
              {onShelves.map((kind, i) => (
                <FoodIcon key={`${kind}-${i}`} kind={kind} x={822 + (i % 3) * 40} y={(i < 3 ? 384 : 410) - FOOD_BOTTOM[kind]} />
              ))}
              <rect x={794} y={302} width={136} height={50} rx={14} fill={`url(#${id}-fridge)`} />
              <line x1={794} y1={354} x2={930} y2={354} className="stroke-ink/30" strokeWidth={3} />
              <rect x={806} y={316} width={8} height={26} rx={3} style={{ fill: CHROME }} className="stroke-ink/30" strokeWidth={1} />
              <g className="gs-door">
                <rect x={794} y={356} width={136} height={94} rx={12} fill={`url(#${id}-fridge)`} className="stroke-ink/30" strokeWidth={2} />
                <rect x={806} y={366} width={8} height={40} rx={3} style={{ fill: CHROME }} className="stroke-ink/30" strokeWidth={1} />
                {/* Магниты: банан и пицца. Пиццу мопс не одобряет, но она висит. */}
                <path d="M858 380C866 392 882 392 890 380C882 386 866 386 858 380Z" className="fill-halo stroke-ink/40" strokeWidth={1.4} />
                <path d="M889 380.5L893 377" className="stroke-ink/60" strokeWidth={2} strokeLinecap="round" />
                <path d="M868 404L892 404L880 430Z" style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 60%, rgb(var(--surface)))' }} className="stroke-ink/40" strokeWidth={1.5} />
                <circle cx={876} cy={411} r={2.5} className="fill-loss/70" />
                <circle cx={884} cy={412} r={2.5} className="fill-loss/70" />
              </g>
              <rect x={798} y={304} width={4} height={140} rx={2} className="fill-surface/50" />
            </g>
            {/* Табурет у холодильника: на нём сегодняшняя еда, а пусто — полотенце. */}
            <g>
              <rect x={744} y={404} width={46} height={6} rx={2} style={{ fill: WOOD }} />
              <rect x={744} y={404} width={46} height={1.4} className="fill-surface/20" />
              <rect x={748} y={410} width={5} height={38} style={{ fill: WOOD }} />
              <rect x={781} y={410} width={5} height={38} style={{ fill: WOOD }} />
              <rect x={750} y={428} width={34} height={3} style={{ fill: WOOD }} opacity={0.8} />
              {onStool.length ? (
                onStool.map((kind, i) => <FoodIcon key={`${kind}-${i}`} kind={kind} x={756 + i * 22} y={404 - FOOD_BOTTOM[kind]} />)
              ) : (
                <path d="M752 404C756 401 778 401 784 404L786 422C780 424 770 424 764 421Z" className="fill-surface/85 stroke-ink/30" strokeWidth={1} />
              )}
            </g>

            {/* Матрас на полу — сон. */}
            <g>
              <rect x={34} y={466} width={262} height={50} rx={14} style={{ fill: 'color-mix(in oklab, rgb(var(--note-sky)) 70%, rgb(var(--surface)))' }} className="stroke-ink/30" strokeWidth={3} />
              <path d="M40 506H290" className="stroke-ink/10" strokeWidth={4} />
              <rect x={44} y={458} width={74} height={30} rx={13} className="gs-pillow fill-surface stroke-ink/25" strokeWidth={2.5} />
              <path d="M140 470C170 462 220 464 250 472C262 476 270 488 266 500L150 504Z" style={{ fill: 'color-mix(in oklab, rgb(var(--note-mint)) 60%, rgb(var(--surface)))' }} className="stroke-ink/25" strokeWidth={2.5} />
              <g className="gs-zzz fill-surface" style={{ font: '800 22px var(--font-sans), sans-serif' }}>
                <text x={96} y={448}>z</text>
                <text x={114} y={434} style={{ fontSize: 16 }}>
                  z
                </text>
                <text x={128} y={422} style={{ fontSize: 12 }}>
                  z
                </text>
              </g>
            </g>

            {/* Свет: пятно от лампочки, конус под ней, углы темнее. */}
            <rect width={960} height={540} fill={`url(#${id}-light)`} className={still ? undefined : 'animate-gym-flicker'} />
            <rect width={960} height={540} fill={`url(#${id}-corner)`} />
            {still
              ? null
              : [0, 1, 2, 3, 4, 5].map((i) => (
                  <circle
                    key={i}
                    cx={380 + i * 34}
                    cy={160 + (i % 3) * 60}
                    r={1.6}
                    className="animate-gym-mote fill-halo"
                    style={{ animationDelay: `${-i * 2.3}s`, opacity: 0 }}
                  />
                ))}
            {/* Лампочка на проводе: качается сама, а наведёшь — раскачаешь. */}
            <g className="gs-lamp cursor-pointer">
              <g className={still ? 'gs-swing' : 'gs-swing animate-gym-swing'} style={{ transformOrigin: '470px 0px' }}>
                <path d="M456 88L484 88L650 448L290 448Z" fill={`url(#${id}-cone)`} style={{ mixBlendMode: 'screen' }} />
                <line x1={470} y1={0} x2={470} y2={64} className="stroke-ink/80" strokeWidth={2.5} />
                <rect x={463} y={58} width={14} height={10} rx={2} className="fill-ink/80" />
                <circle cx={470} cy={78} r={12} className="fill-halo stroke-ink/30" strokeWidth={2} />
                <circle cx={466} cy={74} r={3.4} className="fill-surface/70" />
                <circle cx={470} cy={70} r={26} fill="transparent" />
              </g>
            </g>
          </svg>

          {/* Зерно старой фотографии: картинкой, а не фильтром в сцене — сцена
              перерисовывается каждый кадр (лампочка качается), картинка — нет. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.09] mix-blend-multiply"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")"
            }}
          />

          {/* Мопс: рисунок 320 × 300 высотой 380 единиц сцены ложится полом на пол
              подвала (y 448), серединой — под лампочку. Огромный, как просили. */}
          <div className="pointer-events-none absolute" style={{ left: '26.7%', top: '13.5%', width: '42.2%', height: '70.4%' }}>
            <PugRig
              motion={showcase === 'rest' ? 'rest' : showcase}
              gear="barbell"
              view={showcase === 'rest' ? 'front' : 'side'}
              plate={showcase === 'rest' ? undefined : PLATES[showcase]}
              title={pugTitle}
              className="h-full w-full"
            />
          </div>
          {/* Ткнуть в мопса: огрызнётся новой фразой. */}
          <button
            type="button"
            aria-label={t('scene.poke')}
            onClick={() => setSaid((n) => n + 1)}
            className="absolute rounded-[40%] outline-none focus-visible:ring-2 focus-visible:ring-surface"
            style={{ left: '38%', top: '34%', width: '22%', height: '48%' }}
          />

          {/* Фраза мопса — на стене, по буквам. */}
          <p
            aria-live="polite"
            className="pointer-events-none absolute left-[27%] top-[19%] w-[41%] text-center font-bold leading-snug [font-size:2.05cqw]"
            style={{ color: dark ? 'rgb(var(--surface) / 0.92)' : 'rgb(var(--ink) / 0.86)' }}
          >
            <Typed key={said} text={line} delay={said === 0 ? 0.7 : 0.05} still={still} />
          </p>

          {/* Магнитофон. */}
          <button
            type="button"
            aria-label={t('scene.music')}
            aria-pressed={music}
            onClick={() => setMusic((on) => !on)}
            className="absolute rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-surface"
            style={{ left: pct(294, 960), top: pct(414, 540), width: pct(56, 960), height: pct(32, 540) }}
          />

          {/* Подпись портрета по нажатию. */}
          {shown ? (
            <span
              role="status"
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-ink/85 px-2 py-0.5 font-semibold text-surface [font-size:1.5cqw]"
              style={{ left: pct(([266, 316, 366, 416, 506, 556, 606][legends.findIndex((l) => l.id === shown.id)] ?? 606) + 20, 960), top: pct(100, 540) }}
            >
              {shown.title}
            </span>
          ) : null}

          {/* Предметы-ссылки: весь предмет нажимается, надпись — вдоль него. */}
          {links.map((link) => {
            const hit = HITS[link.kind];
            const [x, y, w, h] = hit.box;
            const at = hit.start ? 'translate(0,-50%)' : 'translate(-50%,-50%)';
            return (
              <Link
                key={link.kind}
                href={link.href}
                data-kind={link.kind}
                aria-label={link.line ? `${link.label}: ${link.line}` : link.label}
                className="absolute rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ink"
                style={{ left: pct(x, 960), top: pct(y, 540), width: pct(w, 960), height: pct(h, 540) }}
              >
                <span
                  className="gs-label absolute whitespace-nowrap font-extrabold lowercase tracking-[0.06em]"
                  style={
                    {
                      left: pct(hit.at[0] - x, w),
                      top: pct(hit.at[1] - y, h),
                      color: labelColor(hit.on),
                      fontSize: `${hit.size}cqw`,
                      // Сдвиг — переменной: строчный `transform` перебил бы рост при наведении.
                      '--at': at
                    } as React.CSSProperties
                  }
                >
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <p className="ps-label mt-1.5 text-center sm:hidden">{t('scene.swipe')}</p>
    </div>
  );
}
