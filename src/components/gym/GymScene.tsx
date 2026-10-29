'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
 * картину. На доске мелом — кружки с буквами: кто из троих в какой день
 * качается. Предметы отзываются: штанга приподнимается, мел пылит,
 * холодильник открывается, над подушкой всплывают «z». Остальное — для души:
 * лампочку можно раскачать, магнитофон включить, портреты качнуть, за окном
 * пройдёт кот.
 *
 * На телефоне подвал не сжимается в полоску и не листается вбок: та же
 * комната стоит вертикально (`TALL`). Предметы — те же рисунки: каждый
 * нарисован в координатах широкой сцены и переставлен на своё место в
 * высокой (`Place`). Обе сцены лежат в разметке, видна одна — по ширине
 * экрана, CSS, без мигания при загрузке.
 */

export type BoardRow = { day: string; title: string; today: boolean; crew: string[] };
export type SceneKind = 'workout' | 'plan' | 'food' | 'sleep';
export type SceneLink = { kind: SceneKind; href: React.ComponentProps<typeof Link>['href']; label: string; line: string | null };
export type Legend = 'ronnie' | 'levrone' | 'arnold' | 'dorian' | 'vlasov' | 'alekseyev' | 'kirpach';
export type LegendWords = { id: Legend; name: string; title: string };
type Sky = { condition: Condition; wind: number | null };
type Look = ReturnType<typeof skyLook>;

const WALL: Record<Mood, number> = { day: 22, dusk: 40, night: 62, blood: 64 };
const LIGHT: Record<Mood, number> = { day: 0.14, dusk: 0.24, night: 0.42, blood: 0.34 };
/** Луч из окна: днём заметный, на закате тусклый, ночью его нет. */
const BEAM: Record<Mood, number> = { day: 0.14, dusk: 0.08, night: 0, blood: 0 };
const PLATES: Record<Showcase, number> = { bench: 200, row: 100, squat: 180 };


type Item = 'window' | 'slogan' | 'board' | 'rack' | 'tree' | 'cross' | 'dbs' | 'boombox' | 'fridge' | 'stool' | 'mattress';
type Box = [number, number, number, number];
/** Куда переставлен предмет: точка широкой сцены (x, y) уходит в (dx + s·x, dy + s·y). `null` — предмета нет. */
type Place = { s: number; dx: number; dy: number } | null;

const KEEP: Place = { s: 1, dx: 0, dy: 0 };
/** Предмет так, чтобы его точка `from` в широкой сцене легла в `to`, с масштабом `s`. */
const put = (s: number, from: [number, number], to: [number, number]): Place => ({ s, dx: to[0] - from[0] * s, dy: to[1] - from[1] * s });
const move = (p: Place, x: number, y: number): [number, number] => (p ? [p.dx + p.s * x, p.dy + p.s * y] : [x, y]);
const moveBox = (p: Place, [x, y, w, h]: Box): Box => {
  const [a, b] = move(p, x, y);
  const s = p?.s ?? 1;
  return [a, b, w * s, h * s];
};
const transformOf = (p: Place) =>
  p && (p.s !== 1 || p.dx !== 0 || p.dy !== 0) ? `translate(${p.dx.toFixed(2)} ${p.dy.toFixed(2)})${p.s === 1 ? '' : ` scale(${p.s})`}` : undefined;

/** Предметы-ссылки в координатах широкой сцены: что нажимается, где надпись и по чему она идёт. */
const HITS: Record<SceneKind, { item: Item; box: Box; at: [number, number]; on: 'wall' | 'chalk' | 'light'; start?: boolean }> = {
  workout: { item: 'rack', box: [24, 140, 222, 312], at: [132, 186], on: 'wall' },
  plan: { item: 'board', box: [648, 44, 290, 256], at: [680, 80], on: 'chalk', start: true },
  food: { item: 'fridge', box: [786, 296, 152, 160], at: [862, 330], on: 'light' },
  sleep: { item: 'mattress', box: [26, 452, 280, 72], at: [200, 495], on: 'light' }
};

type Layout = {
  w: number;
  h: number;
  /** Где стена встречается с полом. */
  floor: number;
  /** Лампочка: x провода и высота колбы. */
  lamp: [number, number];
  place: Record<Item, Place>;
  /** Рамки легенд: x каждой по порядку, все на одной высоте. */
  hall: number[];
  /** Мопс, фраза (x, y, ширина), тычок — в единицах своей сцены. */
  pug: Box;
  phrase: [number, number, number];
  poke: Box;
  /** Шрифты в `cqw` — долях ширины сцены: на телефоне доли крупнее, пиксели те же. */
  size: { label: Record<SceneKind, number>; phrase: number; tip: number };
  beam: string;
  light: { cx: number; cy: number; r: number; sy: number };
  vents: number[];
  valve: number;
  drip: number;
  cracks: string[];
  clock: [number, number] | null;
};

const WIDE: Layout = {
  w: 960,
  h: 540,
  floor: 448,
  lamp: [470, 78],
  place: { window: KEEP, slogan: KEEP, board: KEEP, rack: KEEP, tree: KEEP, cross: KEEP, dbs: KEEP, boombox: KEEP, fridge: KEEP, stool: KEEP, mattress: KEEP },
  hall: [266, 316, 366, 416, 506, 556, 606],
  pug: [256, 73, 405, 380],
  phrase: [259, 103, 394],
  poke: [365, 184, 211, 259],
  size: { label: { workout: 2.6, plan: 2.3, food: 1.95, sleep: 2.6 }, phrase: 2.05, tip: 1.5 },
  beam: 'M80 100L240 100L560 470L230 470Z',
  light: { cx: 470, cy: 110, r: 520, sy: 0.8 },
  vents: [90, 330, 600, 860],
  valve: 550,
  drip: 712,
  cracks: ['M300 168L310 186L305 200L316 222L312 236M310 186L322 192', 'M938 150L928 170L933 188L924 206M928 170L918 174'],
  clock: null
};

/**
 * Телефон: та же комната стоя. Под потолком легенды, под ними окно слева и
 * доска справа, лампочка между ними; ниже фраза мопса и сам мопс крупно
 * посередине. У левой стены часы, лозунг и стойка, у правой — холодильник;
 * на полу спереди гантели, магнитофон, табурет с едой и матрас. Стойке с
 * блинами места нет — блины висят на штанге.
 */
const TALL: Layout = {
  w: 540,
  h: 840,
  floor: 680,
  lamp: [250, 160],
  place: {
    window: put(1, [66, 26], [24, 106]),
    slogan: put(0.85, [130, 134], [84, 448]),
    board: put(0.8156, [652, 50], [296, 108]),
    rack: put(0.72, [30, 452], [4, 684]),
    tree: null,
    cross: put(0.62, [296, 446], [156, 680]),
    dbs: put(0.8, [596, 450], [300, 778]),
    boombox: put(1, [330, 456], [306, 812]),
    fridge: put(0.82, [792, 452], [420, 684]),
    stool: put(1, [744, 448], [478, 748]),
    mattress: put(0.95, [34, 516], [14, 823])
  },
  hall: [34, 86, 138, 318, 370, 422, 474],
  pug: [86, 339.6, 368, 345],
  phrase: [30, 316, 480],
  poke: [170, 400, 200, 250],
  size: { label: { workout: 4.4, plan: 3.6, food: 3.1, sleep: 4.4 }, phrase: 4.3, tip: 3 },
  beam: 'M38 188L198 188L420 690L210 690Z',
  light: { cx: 250, cy: 200, r: 600, sy: 1.15 },
  vents: [60, 300, 470],
  valve: 400,
  drip: 452,
  cracks: ['M150 300L160 318L155 332L166 354M160 318L172 324', 'M528 360L518 380L523 398L514 416'],
  clock: [84, 246]
};

/** Бетонные блоки: каждый чуть светлее или темнее соседа — стена, а не обои. Детерминированно: одна стена на сервере и в браузере. */
function blocksOf(w: number, floor: number) {
  const rows = Math.ceil((floor + 12) / 46);
  const cols = Math.ceil(w / 120) + 1;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      x: col * 120 - (row % 2 ? 60 : 0),
      y: row * 46 - 12,
      k: (((row * 37 + col * 61 + row * col * 11) % 9) - 4) / 4
    }))
  ).flat();
}

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;

const IRON = 'color-mix(in oklab, rgb(var(--deep)) 90%, rgb(var(--surface)))';
const IRON_EDGE = 'color-mix(in oklab, rgb(var(--deep)) 70%, rgb(var(--surface)))';
const RUST = 'color-mix(in oklab, rgb(var(--ink)) 72%, rgb(var(--amber)))';
const STEEL = 'color-mix(in oklab, rgb(var(--ink)) 70%, rgb(var(--sunk)))';
const WOOD = 'color-mix(in oklab, rgb(var(--amber)) 55%, rgb(var(--ink)))';
const CHROME = 'color-mix(in oklab, rgb(var(--ink)) 30%, rgb(var(--surface)))';
const SOVIET = 'color-mix(in oklab, rgb(var(--loss)) 85%, rgb(var(--ink)))';

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


/**
 * Фраза мопса печатается по буквам, и курсор идёт за последней буквой, а не
 * ждёт в конце строки: буквы дописываются прямо в DOM, мимо React, — как кадры
 * мопса. На запятых и точках мопс задумывается. Без движения — сразу целиком.
 */
function Typed({ text, delay, still }: { text: string; delay: number; still: boolean }) {
  const out = useRef<HTMLSpanElement | null>(null);
  const caret = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = out.current;
    const cur = caret.current;
    if (!el || !cur) return;
    if (still) {
      el.textContent = text;
      cur.hidden = true;
      return;
    }
    const chars = Array.from(text);
    let n = 0;
    let timer = 0;
    el.textContent = '';
    cur.hidden = false;
    const step = () => {
      n += 1;
      el.textContent = chars.slice(0, n).join('');
      if (n < chars.length) timer = window.setTimeout(step, /[,.;:!?—]/.test(chars[n - 1]) ? 260 : 34 + (n % 4) * 9);
      else timer = window.setTimeout(() => (cur.hidden = true), 1600);
    };
    timer = window.setTimeout(step, delay * 1000);
    return () => window.clearTimeout(timer);
  }, [text, delay, still]);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        <span ref={out} />
        <span ref={caret} className="gs-caret">
          ▍
        </span>
      </span>
    </>
  );
}

/** Часы на стене — цюрихское время, раз в полминуты. До первого хода стрелки стоят на 10:10, как на витрине. */
function Clock({ x, y }: { x: number; y: number }) {
  const [time, setTime] = useState<[number, number] | null>(null);
  useEffect(() => {
    const read = () => {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
      setTime([n('hour'), n('minute')]);
    };
    read();
    const timer = window.setInterval(read, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [hh, mm] = time ?? [10, 10];
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={32} style={{ fill: WOOD }} />
      <circle r={27.5} style={{ fill: 'color-mix(in oklab, rgb(var(--surface)) 90%, rgb(var(--amber)))' }} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={0} y1={-24} x2={0} y2={i % 3 ? -21.5 : -19} className="stroke-ink/60" strokeWidth={i % 3 ? 1.2 : 2.2} transform={`rotate(${i * 30})`} />
      ))}
      <line x1={0} y1={3} x2={0} y2={-14} className="stroke-ink" strokeWidth={3} strokeLinecap="round" transform={`rotate(${((hh % 12) + mm / 60) * 30})`} />
      <line x1={0} y1={4} x2={0} y2={-21} className="stroke-ink" strokeWidth={1.8} strokeLinecap="round" transform={`rotate(${mm * 6})`} />
      <circle r={2.4} className="fill-loss" />
      <path d="M-21-12A24 24 0 0 1 2-24" className="stroke-surface/60" strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Доска с планом мелом. Справа в каждой строке — кружки с буквами: кто из троих в этот день качается. */
function Board({ board, goal }: { board: BoardRow[]; goal: string }) {
  return (
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
        const room = 24 - row.crew.length * 3;
        return (
          <g key={row.day} style={{ font: `${row.today ? 700 : 500} 15.5px var(--font-sans), sans-serif` }}>
            <text x={682} y={y} className="fill-surface" opacity={row.today ? 1 : 0.62}>
              {row.day}
            </text>
            <text x={722} y={y} className="fill-surface" opacity={row.today ? 1 : row.title === '—' ? 0.35 : 0.72}>
              {row.title.length > room ? `${row.title.slice(0, room - 1)}…` : row.title}
            </text>
            {row.crew.map((c, j) => {
              const cx = 902 - (row.crew.length - 1 - j) * 18;
              return (
                <g key={j}>
                  <circle cx={cx} cy={y - 5} r={7.6} fill="none" className="stroke-surface/60" strokeWidth={1.3} />
                  <text x={cx} y={y - 1.5} textAnchor="middle" className="fill-surface" opacity={0.9} style={{ font: '700 10px var(--font-sans), sans-serif' }}>
                    {c}
                  </text>
                </g>
              );
            })}
            {row.today ? <ellipse cx={790} cy={y - 5} rx={124} ry={13} fill="none" className="stroke-surface/70" strokeWidth={2} transform={`rotate(-1.5 790 ${y - 5})`} /> : null}
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
  );
}

type Shared = {
  mood: Mood;
  still: boolean;
  look: Look;
  showcase: Showcase | 'rest';
  board: BoardRow[];
  goal: string;
  links: SceneLink[];
  line: string;
  said: number;
  music: boolean;
  legend: Legend | null;
  legends: LegendWords[];
  food: FridgeGroup[];
  pugTitle: string;
  sceneLabel: string;
  onPoke: () => void;
  onMusic: () => void;
  onLegend: (id: Legend) => void;
};

/** Сам подвал в одной раскладке: широкой или высокой. */
function Basement({ L, ...s }: Shared & { L: Layout }) {
  const t = useTranslations('gym');
  const id = `gs${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const kick = useRef<SVGGElement | null>(null);
  const { mood, still, look } = s;
  const { w, h, floor } = L;
  const [lx, ly] = L.lamp;
  const dark = mood !== 'day';
  const blocks = useMemo(() => blocksOf(w, floor), [w, floor]);

  const wall = `color-mix(in oklab, rgb(var(--ink)) ${WALL[mood]}%, rgb(var(--sunk)))`;
  const wallLine = dark ? 'rgb(var(--surface) / 0.07)' : 'rgb(var(--ink) / 0.09)';
  const floorFill = `color-mix(in oklab, rgb(var(--ink)) ${Math.min(90, WALL[mood] + 46)}%, rgb(var(--sunk)))`;
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
  const tilt = (-look.wind * 22).toFixed(1);
  const onStool = s.food.slice(0, 2);
  const onShelves = s.food.slice(0, 6);
  const shownAt = s.legends.findIndex((l) => l.id === s.legend);
  const shown = shownAt >= 0 ? s.legends[shownAt] : null;
  // Пол в перспективе: швы сходятся к точке за мопсом.
  const vy = floor - 198;
  const spread = (h - vy) / (floor - vy);
  const seams = Math.ceil(w / 2 / 84) + 2;
  // Предмет на своём месте в этой раскладке; `null` — в ней его нет.
  const at = (item: Item, node: React.ReactNode) => (L.place[item] === null ? null : <g transform={transformOf(L.place[item])}>{node}</g>);
  const box = (b: Box) => ({ left: pct(b[0], w), top: pct(b[1], h), width: pct(b[2], w), height: pct(b[3], h) });

  // Лампу раскачивает толчок поверх её собственного качания, а не замена
  // качания: замена начиналась бы с нуля и дёргала лампу с того угла, где
  // она была. Пока толчок идёт, второй не начинается.
  const swing = () => {
    const g = kick.current;
    if (!g || still || g.classList.contains('gs-kicked')) return;
    g.classList.add('gs-kicked');
  };

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
@media (hover:none){.${id} .gs-label{opacity:.78}}
.${id} .gs-tilt{transition:transform .5s cubic-bezier(.2,.8,.2,1.4);transform-box:fill-box;transform-origin:50% 0}
.${id} .gs-frame:hover .gs-tilt{transform:rotate(-5deg)}
.${id} .gs-kicked{animation:gs-swing-hard 1.6s ease-in-out 2}
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
.${id} .gs-caret{animation:gs-caret 1s steps(1,end) infinite}
@keyframes gs-caret{50%{opacity:0}}
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
@media (prefers-reduced-motion: reduce){.${id} *{transition:none!important}.${id} .gs-caret{display:none}}`;

  const labelColor = (on: 'wall' | 'chalk' | 'light') => (on === 'chalk' ? 'rgb(var(--surface))' : on === 'light' ? 'rgb(var(--ink))' : dark ? 'rgb(var(--surface))' : 'rgb(var(--ink))');

  return (
    <div
      className={`${id} ${s.music ? 'gs-music' : ''} relative w-full overflow-hidden rounded-[10px] [container-type:inline-size]`}
      style={{ aspectRatio: `${w} / ${h}` }}
      aria-label={s.sceneLabel}
      role="group"
    >
      <style>{css}</style>
      <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: sky0[0] }} />
            <stop offset="1" style={{ stopColor: sky0[1] }} />
          </linearGradient>
          {/* Спад света — по кривой и до нуля внутри сцены: пятно-эллипс
              обрезало градиент раньше, и на стене была видна дуга, где свет
              кончается. Теперь заливается вся сцена, а пятно — в градиенте. */}
          <radialGradient
            id={`${id}-light`}
            gradientUnits="userSpaceOnUse"
            cx={L.light.cx}
            cy={L.light.cy}
            r={L.light.r}
            gradientTransform={`translate(${L.light.cx} ${L.light.cy}) scale(1 ${L.light.sy}) translate(${-L.light.cx} ${-L.light.cy})`}
          >
            {[
              [0, 2],
              [0.25, 1.35],
              [0.5, 0.75],
              [0.7, 0.34],
              [0.85, 0.11],
              [1, 0]
            ].map(([offset, k]) => (
              <stop key={offset} offset={offset} style={{ stopColor: 'rgb(var(--halo))', stopOpacity: LIGHT[mood] * k }} />
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
        <rect width={w} height={floor} style={{ fill: wall }} />
        {blocks.map(({ x, y, k }) => (
          <rect key={`${x}:${y}`} x={x + 1.5} y={y + 1.5} width={117} height={43} rx={1.5} style={{ fill: k > 0 ? 'rgb(var(--surface))' : 'rgb(var(--ink))' }} opacity={Math.abs(k) * (dark ? 0.05 : 0.07)} />
        ))}
        <g style={{ stroke: wallLine }} strokeWidth={2.5}>
          {blocks.map(({ x, y }) => (
            <path key={`${x}:${y}`} d={`M${x} ${y}H${x + 120}M${x} ${y}V${y + 46}`} />
          ))}
        </g>
        <rect width={w} height={floor} fill={`url(#${id}-wall)`} />
        {/* Трещины ветками и подтёк от трубы. */}
        <g className="stroke-ink/25" strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {L.cracks.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <ellipse cx={L.drip + 8} cy={22} rx={58} ry={30} className="fill-ink/5" />
        <path d={`M${L.drip} 30C${L.drip - 2} 60 ${L.drip + 4} 90 ${L.drip} 120`} className="stroke-ink/10" strokeWidth={6} strokeLinecap="round" fill="none" />

        {/* Трубы под потолком: блик сверху, хомуты, вентиль. */}
        <g>
          <rect x={0} y={4} width={w} height={10} rx={5} style={{ fill: STEEL }} />
          <rect x={0} y={5.5} width={w} height={2} className="fill-surface/15" />
          <rect x={0} y={17} width={w} height={6} rx={3} style={{ fill: RUST }} opacity={0.8} />
          {L.vents.map((x) => (
            <rect key={x} x={x} y={0} width={8} height={26} rx={2} className="fill-ink/60" />
          ))}
          <circle cx={L.valve} cy={9} r={9} fill="none" className="stroke-loss/80" strokeWidth={3} />
          <path d={`M${L.valve - 9} 9H${L.valve + 9}M${L.valve} 0V18`} className="stroke-loss/80" strokeWidth={2} />
        </g>

        {/* Окошко у самой земли: небо и погода — цюрихские, сейчас. */}
        {at(
          'window',
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
                    .map(([cx, cy, k], i) => (
                      <g key={i} transform={`translate(${cx} ${cy}) scale(${k})`}>
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
                  {[0, 66].map((dy) => FLAKES.map((f, i) => <circle key={`${dy}:${i}`} cx={f.x} cy={f.y + dy} r={f.r} className={dark ? 'fill-surface/80' : 'fill-surface'} />))}
                </g>
              ) : null}
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
            {/* Стекло: блик. Наведение ловит весь проём. */}
            <path d="M78 98L100 36H108L86 98Z" className="fill-surface/10" />
            <rect x={66} y={26} width={188} height={82} fill="transparent" />
          </g>
        )}

        {/* Зал славы: мопсы-легенды. Ронни — первый, Левроун — второй. */}
        {s.legends.map((l, i) => (
          <Portrait key={l.id} who={l.id} x={L.hall[i] ?? L.hall[L.hall.length - 1]} title={l.title} name={l.name} onPick={() => s.onLegend(l.id)} />
        ))}

        {/* Лозунг краской по бетону, над стойкой. */}
        {at(
          'slogan',
          <text x={130} y={134} textAnchor="middle" className="fill-surface" opacity={dark ? 0.32 : 0.55} style={{ font: '800 17px var(--font-sans), sans-serif', letterSpacing: '0.12em' }}>
            {t('slogan')}
          </text>
        )}
        {L.clock ? <Clock x={L.clock[0]} y={L.clock[1]} /> : null}

        {/* Кроссовер у дальней стены — за мопсом, в полутени. */}
        {at(
          'cross',
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
        )}

        {at('board', <Board board={s.board} goal={s.goal} />)}

        {/* Пол — старое резиновое покрытие плитами, швы сходятся к точке за мопсом. */}
        <rect y={floor} width={w} height={h - floor} style={{ fill: floorFill }} />
        <g style={{ stroke: dark ? 'rgb(var(--surface) / 0.06)' : 'rgb(var(--ink) / 0.14)' }} strokeWidth={1.6}>
          {Array.from({ length: seams * 2 + 1 }, (_, k) => k - seams).map((i) => (
            <line key={i} x1={w / 2 + i * 84} y1={floor} x2={w / 2 + i * 84 * spread} y2={h} />
          ))}
          {[0.18, 0.42, 0.75].map((f) => (
            <line key={f} x1={0} y1={floor + (h - floor) * f} x2={w} y2={floor + (h - floor) * f} />
          ))}
        </g>
        <rect y={floor} width={w} height={h - floor} fill={`url(#${id}-floor)`} />

        {/* Луч из окна на пол — днём и когда не затянуто. */}
        {BEAM[mood] && look.overcast < 0.7 ? <path d={L.beam} fill={`url(#${id}-beam)`} pointerEvents="none" /> : null}

        {/* Стойка со штангой — тренировка. Ржавая, с лямками и поясом, рядом мел. */}
        {at(
          'rack',
          <g>
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
            <path d="M66 246C64 266 70 282 66 300M72 246C72 268 78 284 74 302" style={{ stroke: 'color-mix(in oklab, rgb(var(--loss)) 55%, rgb(var(--ink)))' }} strokeWidth={4} fill="none" strokeLinecap="round" />
            <rect x={203} y={300} width={16} height={56} rx={4} style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 45%, rgb(var(--ink)))' }} />
            <rect x={205} y={318} width={12} height={8} rx={1.5} className="fill-sunk/80" />
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
        )}

        {/* Стойка для блинов: блины висят на рогах, рога — из стойки. */}
        {at(
          'tree',
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
        )}

        {/* Гантельный ряд: две полки, гантели лежат торцами к нам; гири на полу. */}
        {at(
          'dbs',
          <g>
            <g className="gs-dbs">
              <rect x={600} y={372} width={6} height={78} style={{ fill: STEEL }} />
              <rect x={738} y={372} width={6} height={78} style={{ fill: STEEL }} />
              <rect x={596} y={398} width={152} height={5} rx={1.5} style={{ fill: STEEL }} />
              <rect x={596} y={426} width={152} height={5} rx={1.5} style={{ fill: STEEL }} />
              <rect x={596} y={398} width={152} height={1.4} className="fill-surface/15" />
              {[...[8, 8.6, 9.2, 9.8, 10.4].map((r, i) => ({ x: 618 + i * 26, y: 398, r })), ...[11, 11.8, 12.6, 13.4].map((r, i) => ({ x: 622 + i * 33, y: 426, r }))].map(
                ({ x, y, r }) => {
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
                }
              )}
            </g>
            <path d="M622 436C622 427 636 427 636 436" className="stroke-ink" strokeWidth={3.2} fill="none" />
            <circle cx={629} cy={439} r={9} style={{ fill: IRON }} />
            <path d="M684 432C684 421 702 421 702 432" className="stroke-ink" strokeWidth={3.6} fill="none" />
            <circle cx={693} cy={437} r={11} style={{ fill: IRON }} />
            <path d="M624 434Q629 431 634 434" className="stroke-surface/20" strokeWidth={1.2} fill="none" />
          </g>
        )}

        {/* Магнитофон стоит на полу и включается нажатием. */}
        {at(
          'boombox',
          <g transform="translate(330 444)">
            <rect x={-22} y={10} width={6} height={3} rx={1} className="fill-ink/80" />
            <rect x={16} y={10} width={6} height={3} rx={1} className="fill-ink/80" />
            <rect x={-26} y={-13} width={52} height={24} rx={4} className="fill-ink/80" />
            <circle cx={-14} cy={-1} r={7} className="gs-cone fill-sunk/40" />
            <circle cx={14} cy={-1} r={7} className="gs-cone fill-sunk/40" />
            <rect x={-6} y={-7} width={12} height={8} rx={1.5} className="fill-sunk/30" />
            <path d="M-18-13C-18-21 18-21 18-13" className="stroke-ink/80" strokeWidth={2.4} fill="none" />
            <circle cx={20} cy={-9} r={1.4} className={s.music ? 'fill-loss' : 'fill-sunk/30'} />
            <g className="fill-surface" style={{ font: '700 13px var(--font-sans), sans-serif' }}>
              <text className="gs-note" x={-12} y={-21}>
                ♪
              </text>
              <text className="gs-note" x={6} y={-25} style={{ animationDelay: '0.6s' }}>
                ♫
              </text>
              <text className="gs-note" x={-2} y={-19} style={{ animationDelay: '1.2s' }}>
                ♪
              </text>
            </g>
          </g>
        )}

        {/* Холодильник — питание. Внутри — то, что сегодня съедено. */}
        {at(
          'fridge',
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
        )}
        {/* Табурет у холодильника: на нём сегодняшняя еда, а пусто — полотенце. */}
        {at(
          'stool',
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
        )}

        {/* Матрас на полу — сон. */}
        {at(
          'mattress',
          <g>
            <rect x={34} y={466} width={262} height={50} rx={14} style={{ fill: 'color-mix(in oklab, rgb(var(--note-sky)) 70%, rgb(var(--surface)))' }} className="stroke-ink/30" strokeWidth={3} />
            <path d="M40 506H290" className="stroke-ink/10" strokeWidth={4} />
            <rect x={44} y={458} width={74} height={30} rx={13} className="gs-pillow fill-surface stroke-ink/25" strokeWidth={2.5} />
            <path d="M140 470C170 462 220 464 250 472C262 476 270 488 266 500L150 504Z" style={{ fill: 'color-mix(in oklab, rgb(var(--note-mint)) 60%, rgb(var(--surface)))' }} className="stroke-ink/25" strokeWidth={2.5} />
            <g className="gs-zzz fill-surface" style={{ font: '800 22px var(--font-sans), sans-serif' }}>
              <text x={96} y={448}>
                z
              </text>
              <text x={114} y={434} style={{ fontSize: 16 }}>
                z
              </text>
              <text x={128} y={422} style={{ fontSize: 12 }}>
                z
              </text>
            </g>
          </g>
        )}

        {/* Свет: пятно от лампочки, углы темнее, пыль в свету. Мышь свет не ловит:
            слои во всю сцену лежат поверх портретов, окна и гантелей и съедали бы
            их наведение. */}
        <rect width={w} height={h} fill={`url(#${id}-light)`} className={still ? undefined : 'animate-gym-flicker'} pointerEvents="none" />
        <rect width={w} height={h} fill={`url(#${id}-corner)`} pointerEvents="none" />
        {still
          ? null
          : [0, 1, 2, 3, 4, 5].map((i) => (
              <circle key={i} cx={lx - 90 + i * 34} cy={ly + 82 + (i % 3) * 60} r={1.6} className="animate-gym-mote fill-halo" style={{ animationDelay: `${-i * 2.3}s`, opacity: 0 }} pointerEvents="none" />
            ))}
        {/* Лампочка на проводе с конусом света: качается сама, а толкнёшь — раскачается. */}
        <g className="gs-lamp">
          <g className={still ? undefined : 'animate-gym-swing'} style={{ transformOrigin: `${lx}px 0px` }} pointerEvents="none">
            <g
              ref={kick}
              style={{ transformOrigin: `${lx}px 0px` }}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) e.currentTarget.classList.remove('gs-kicked');
              }}
            >
              <path d={`M${lx - 14} ${ly + 10}L${lx + 14} ${ly + 10}L${lx + 180} ${floor}L${lx - 180} ${floor}Z`} fill={`url(#${id}-cone)`} style={{ mixBlendMode: 'screen' }} />
              <line x1={lx} y1={0} x2={lx} y2={ly - 14} className="stroke-ink/80" strokeWidth={2.5} />
              <rect x={lx - 7} y={ly - 20} width={14} height={10} rx={2} className="fill-ink/80" />
              <circle cx={lx} cy={ly} r={12} className="fill-halo stroke-ink/30" strokeWidth={2} />
              <circle cx={lx - 4} cy={ly - 4} r={3.4} className="fill-surface/70" />
            </g>
          </g>
          {/* Зона толчка не качается: качайся она вместе с лампой, она уезжала
              бы из-под курсора и возвращалась под него, и лампу дёргало бы без
              конца — так и было у правого нижнего края. */}
          <rect x={lx - 28} y={0} width={56} height={ly + 28} fill="transparent" className="cursor-pointer" onPointerEnter={swing} onClick={swing} />
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

      {/* Мопс: рисунок 320 × 300 ложится полом на пол подвала, серединой — под лампочку. */}
      <div className="pointer-events-none absolute" style={box(L.pug)}>
        <PugRig
          motion={s.showcase === 'rest' ? 'rest' : s.showcase}
          gear="barbell"
          view={s.showcase === 'rest' ? 'front' : 'side'}
          plate={s.showcase === 'rest' ? undefined : PLATES[s.showcase]}
          title={s.pugTitle}
          className="h-full w-full"
        />
      </div>
      {/* Ткнуть в мопса: огрызнётся новой фразой. */}
      <button type="button" aria-label={t('scene.poke')} onClick={s.onPoke} className="absolute rounded-[40%] outline-none focus-visible:ring-2 focus-visible:ring-surface" style={box(L.poke)} />

      {/* Фраза мопса — на стене, по буквам. */}
      <p
        aria-live="polite"
        className="pointer-events-none absolute text-center font-bold leading-snug"
        style={{
          left: pct(L.phrase[0], w),
          top: pct(L.phrase[1], h),
          width: pct(L.phrase[2], w),
          fontSize: `${L.size.phrase}cqw`,
          color: dark ? 'rgb(var(--surface) / 0.92)' : 'rgb(var(--ink) / 0.86)'
        }}
      >
        <Typed key={s.said} text={s.line} delay={s.said === 0 ? 0.7 : 0.05} still={still} />
      </p>

      {/* Магнитофон. */}
      {L.place.boombox ? (
        <button
          type="button"
          aria-label={t('scene.music')}
          aria-pressed={s.music}
          onClick={s.onMusic}
          className="absolute rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-surface"
          style={box(moveBox(L.place.boombox, [300, 426, 60, 34]))}
        />
      ) : null}

      {/* Подпись портрета по нажатию. */}
      {shown ? (
        <span
          role="status"
          className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-ink/85 px-2 py-0.5 font-semibold text-surface"
          style={{ left: pct((L.hall[shownAt] ?? 0) + 20, w), top: pct(100, h), fontSize: `${L.size.tip}cqw` }}
        >
          {shown.title}
        </span>
      ) : null}

      {/* Предметы-ссылки: весь предмет нажимается, надпись — вдоль него. */}
      {s.links.map((link) => {
        const hit = HITS[link.kind];
        const p = L.place[hit.item];
        if (p === null) return null;
        const b = moveBox(p, hit.box);
        const [ax, ay] = move(p, hit.at[0], hit.at[1]);
        const shift = hit.start ? 'translate(0,-50%)' : 'translate(-50%,-50%)';
        return (
          <Link
            key={link.kind}
            href={link.href}
            data-kind={link.kind}
            aria-label={link.line ? `${link.label}: ${link.line}` : link.label}
            className="absolute rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ink"
            style={box(b)}
          >
            <span
              className="gs-label absolute whitespace-nowrap font-extrabold lowercase tracking-[0.06em]"
              style={
                {
                  left: pct(ax - b[0], b[2]),
                  top: pct(ay - b[1], b[3]),
                  color: labelColor(hit.on),
                  fontSize: `${L.size.label[link.kind]}cqw`,
                  // Сдвиг — переменной: строчный `transform` перебил бы рост при наведении.
                  '--at': shift
                } as React.CSSProperties
              }
            >
              {link.label}
            </span>
          </Link>
        );
      })}
    </div>
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
  /** Доска: дни недели, план смотрящего и кто из троих в какой день качается. */
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
  const still = Boolean(useReducedMotion());
  const [sky, setSky] = useState<Sky | null>(null);
  const [said, setSaid] = useState(0);
  const [music, setMusic] = useState(false);
  const [legend, setLegend] = useState<Legend | null>(null);

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

  // Подпись портрета по нажатию держится три секунды: на телефоне нет наведения.
  useEffect(() => {
    if (!legend) return;
    const timer = setTimeout(() => setLegend(null), 3200);
    return () => clearTimeout(timer);
  }, [legend]);

  const shared: Shared = {
    mood,
    still,
    look: skyLook(sky),
    showcase,
    board,
    goal,
    links,
    line: said === 0 ? speech : (pokes[(said - 1) % Math.max(1, pokes.length)] ?? speech),
    said,
    music,
    legend,
    legends,
    food,
    pugTitle,
    sceneLabel,
    onPoke: () => setSaid((n) => n + 1),
    onMusic: () => setMusic((on) => !on),
    onLegend: (id) => setLegend((current) => (current === id ? null : id))
  };

  // Обе раскладки в разметке, видна одна — по ширине экрана. Спрятанная не
  // рисуется и не считает кадров: мопс засыпает, когда его не видно.
  return (
    <>
      <div className="hidden sm:block">
        <Basement L={WIDE} {...shared} />
      </div>
      <div className="sm:hidden">
        <Basement L={TALL} {...shared} />
      </div>
    </>
  );
}
