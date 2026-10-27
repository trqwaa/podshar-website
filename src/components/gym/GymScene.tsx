'use client';

import { useId } from 'react';
import { useReducedMotion } from 'framer-motion';

import { Link } from '@/i18n/routing';
import type { Showcase } from '@/lib/gym/exercises';
import type { Mood } from '@/lib/sun';
import { PugRig } from './PugRig';

/**
 * Подвальная качалка — вход в зал.
 *
 * Тот же подход, что у пульта-айсберга: сцена рисуется SVG, свет и небо
 * зависят от настоящего заката над Цюрихом (`lib/sun.ts`, настроение считает
 * сервер — так первый HTML уже правильного цвета), а живое двигается
 * покадрово мимо React — мопс (`PugRig`) — или CSS-анимацией: лампочка
 * качается на проводе, пыль плавает в свете, за окном под потолком иногда
 * проходят чьи-то ноги.
 *
 * Мопс в центре делает упражнение дня по плану смотрящего: жмёт 200, тянет 100
 * к поясу или приседает. День без тренировки — сидит на скамье в капюшоне.
 *
 * Меню — предметы подвала: стойка со штангой — качалка, холодильник —
 * питание, матрас — сон. Таблички на них — настоящие ссылки; под сценой те же
 * три пункта списком, с живой строкой у каждого, как у слоёв пульта.
 */

export type BoardRow = { day: string; title: string; today: boolean };

export type SceneLink = { href: string; label: string; line: string | null; kind: 'training' | 'food' | 'sleep' };

const WALL: Record<Mood, number> = { day: 22, dusk: 40, night: 60, blood: 62 };
const LIGHT: Record<Mood, number> = { day: 0.16, dusk: 0.26, night: 0.4, blood: 0.34 };
const PLATES: Record<Showcase, number> = { bench: 200, row: 100, squat: 180 };
const MOTION: Record<Showcase, 'bench' | 'row' | 'squat'> = { bench: 'bench', row: 'row', squat: 'squat' };

/** Где на сцене стоят таблички-ссылки: доли ширины и высоты сцены 960 × 540. */
const SIGNS: Record<SceneLink['kind'], { left: string; top: string; tilt: number }> = {
  training: { left: '13.8%', top: '29%', tilt: -4 },
  food: { left: '89.6%', top: '60%', tilt: 3 },
  sleep: { left: '17.5%', top: '86%', tilt: -2 }
};

export function GymScene({
  mood,
  showcase,
  board,
  goal,
  boardTitle,
  links,
  speech,
  pugTitle,
  sceneLabel
}: {
  mood: Mood;
  /** Упражнение дня или отдых. */
  showcase: Showcase | 'rest';
  board: BoardRow[];
  goal: string;
  boardTitle: string;
  links: SceneLink[];
  speech: string;
  pugTitle: string;
  sceneLabel: string;
}) {
  const id = useId().replace(/:/g, '');
  const still = Boolean(useReducedMotion());
  const dark = mood !== 'day';
  const wall = `color-mix(in oklab, rgb(var(--ink)) ${WALL[mood]}%, rgb(var(--sunk)))`;
  const wallLine = dark ? 'rgb(var(--surface) / 0.06)' : 'rgb(var(--ink) / 0.07)';
  const floor = `color-mix(in oklab, rgb(var(--ink)) ${Math.min(90, WALL[mood] + 46)}%, rgb(var(--sunk)))`;
  const sky =
    mood === 'day'
      ? ['rgb(var(--surface))', 'rgb(var(--water))']
      : mood === 'dusk'
        ? ['color-mix(in oklab, rgb(var(--deep)) 70%, rgb(var(--water)))', 'color-mix(in oklab, rgb(var(--halo)) 60%, rgb(var(--water)))']
        : mood === 'blood'
          ? ['rgb(var(--deep))', 'color-mix(in oklab, rgb(var(--blood)) 45%, rgb(var(--deep)))']
          : ['rgb(var(--deep))', 'color-mix(in oklab, rgb(var(--deep)) 80%, rgb(var(--water)))'];

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[10px]" aria-label={sceneLabel} role="group">
      <svg viewBox="0 0 960 540" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: sky[0] }} />
            <stop offset="1" style={{ stopColor: sky[1] }} />
          </linearGradient>
          <radialGradient id={`${id}-light`} cx="0.5" cy="0.18" r="0.7">
            <stop offset="0" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: LIGHT[mood] * 2 }} />
            <stop offset="0.45" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: LIGHT[mood] }} />
            <stop offset="1" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: 0 }} />
          </radialGradient>
          <clipPath id={`${id}-window`}>
            <rect x={74} y={30} width={172} height={66} rx={3} />
          </clipPath>
        </defs>

        {/* Стена из блоков: серый подвал, темнее вечером. */}
        <rect width={960} height={540} style={{ fill: wall }} />
        <g style={{ stroke: wallLine }} strokeWidth={2}>
          {Array.from({ length: 10 }, (_, row) => (
            <g key={row}>
              <line x1={0} y1={row * 46} x2={960} y2={row * 46} />
              {Array.from({ length: 9 }, (_, col) => {
                const x = col * 120 + (row % 2 ? 60 : 0);
                return <line key={col} x1={x} y1={row * 46} x2={x} y2={row * 46 + 46} />;
              })}
            </g>
          ))}
        </g>

        {/* Окошко под потолком: небо — то же, что над Цюрихом сейчас. */}
        <g>
          <rect x={66} y={22} width={188} height={82} rx={5} style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 70%, rgb(var(--sunk)))' }} />
          <rect x={74} y={30} width={172} height={66} rx={3} fill={`url(#${id}-sky)`} />
          <g clipPath={`url(#${id}-window)`}>
            {dark
              ? [
                  [96, 44],
                  [130, 38],
                  [176, 50],
                  [214, 40],
                  [228, 58],
                  [150, 62]
                ].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.3} className="fill-surface" opacity={mood === 'dusk' ? 0.35 : 0.8} />)
              : null}
            {mood === 'blood' ? <circle cx={206} cy={50} r={11} style={{ fill: 'color-mix(in oklab, rgb(var(--blood)) 75%, rgb(var(--halo)))' }} /> : null}
            {mood === 'day' ? <circle cx={214} cy={44} r={14} className="fill-halo" opacity={0.9} /> : null}
            {/* Трава на уровне земли: окно в подвале — у самой земли. */}
            <path
              d="M74 96L80 84L84 96L90 80L95 96L101 86L106 96L113 82L118 96L126 86L131 96L139 80L144 96L152 88L157 96L165 82L170 96L178 86L184 96L191 80L197 96L204 87L210 96L217 82L222 96L230 86L236 96L242 82L246 96Z"
              style={{ fill: dark ? 'color-mix(in oklab, rgb(var(--win)) 35%, rgb(var(--deep)))' : 'color-mix(in oklab, rgb(var(--win)) 70%, rgb(var(--surface)))' }}
            />
            {/* Кто-то проходит мимо — видны только ботинки. */}
            {still ? null : (
              <g className="animate-gym-walk" style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 80%, rgb(var(--sunk)))' }}>
                <rect x={-30} y={52} width={7} height={38} rx={3} />
                <rect x={-34} y={86} width={15} height={7} rx={3} />
                <rect x={-14} y={54} width={7} height={36} rx={3} />
                <rect x={-18} y={86} width={15} height={7} rx={3} />
              </g>
            )}
          </g>
          <g style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 70%, rgb(var(--sunk)))' }}>
            {[112, 152, 192, 230].map((x) => (
              <rect key={x} x={x} y={30} width={4} height={66} />
            ))}
          </g>
        </g>

        {/* Доска с планом мелом. */}
        <g>
          <rect x={652} y={50} width={282} height={244} rx={6} style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 55%, rgb(var(--ink)))' }} />
          <rect x={662} y={60} width={262} height={224} rx={3} className="fill-chalkboard" />
          <g className="fill-surface" style={{ font: '600 21px var(--font-sans), sans-serif' }} opacity={0.9}>
            <text x={680} y={92}>{boardTitle}</text>
            <text x={906} y={92} textAnchor="end" style={{ font: '600 14px var(--font-sans), sans-serif' }} opacity={0.75}>
              {goal}
            </text>
          </g>
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
          {/* Полочка с мелом. */}
          <rect x={700} y={284} width={200} height={6} rx={2} style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 55%, rgb(var(--ink)))' }} />
          <rect x={760} y={279} width={22} height={5} rx={2} className="fill-surface" />
        </g>

        {/* Пол — резиновое покрытие. */}
        <rect y={448} width={960} height={92} style={{ fill: floor }} />
        <g className="stroke-surface/5" strokeWidth={2}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line key={i} x1={i * 140 - 20} y1={448} x2={i * 160 - 120} y2={540} />
          ))}
        </g>

        {/* Стойка со штангой — качалка. */}
        <g style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 75%, rgb(var(--sunk)))' }}>
          <rect x={48} y={150} width={11} height={300} />
          <rect x={206} y={150} width={11} height={300} />
          <rect x={44} y={146} width={177} height={10} rx={3} />
          <rect x={34} y={444} width={196} height={8} rx={3} />
          <rect x={52} y={238} width={24} height={8} rx={2} />
          <rect x={189} y={238} width={24} height={8} rx={2} />
        </g>
        <g>
          <rect x={30} y={234} width={206} height={6} rx={3} className="fill-sunk" />
          {[32, 50, 214, 232].map((x, i) => (
            <rect key={x} x={x - 7} y={i % 3 === 0 ? 206 : 200} width={14} height={i % 3 === 0 ? 62 : 74} rx={3} style={{ fill: 'color-mix(in oklab, rgb(var(--deep)) 92%, rgb(var(--surface)))' }} />
          ))}
        </g>
        {/* Блины на полу у стойки. */}
        <g style={{ fill: 'color-mix(in oklab, rgb(var(--deep)) 92%, rgb(var(--surface)))' }}>
          <ellipse cx={258} cy={446} rx={9} ry={30} />
          <ellipse cx={270} cy={446} rx={9} ry={30} />
          <ellipse cx={282} cy={450} rx={7} ry={22} />
        </g>

        {/* Холодильник — питание. */}
        <g>
          <rect x={792} y={300} width={140} height={152} rx={16} style={{ fill: 'color-mix(in oklab, rgb(var(--surface)) 88%, rgb(var(--ink)))' }} className="stroke-ink/40" strokeWidth={3} />
          <line x1={794} y1={352} x2={930} y2={352} className="stroke-ink/30" strokeWidth={3} />
          <rect x={806} y={316} width={8} height={26} rx={3} className="fill-ink/50" />
          <rect x={806} y={364} width={8} height={40} rx={3} className="fill-ink/50" />
          {/* Магниты: банан и пицца. Пиццу мопс не одобряет, но она висит. */}
          <path d="M856 326Q872 342 890 326Q872 334 856 326Z" className="fill-halo stroke-ink/40" strokeWidth={1.5} />
          <path d="M868 384L892 384L880 410Z" style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 60%, rgb(var(--surface)))' }} className="stroke-ink/40" strokeWidth={1.5} />
          <circle cx={876} cy={391} r={2.5} className="fill-loss/70" />
          <circle cx={884} cy={392} r={2.5} className="fill-loss/70" />
        </g>

        {/* Матрас на полу — сон. */}
        <g>
          <rect x={34} y={466} width={262} height={50} rx={14} style={{ fill: 'color-mix(in oklab, rgb(var(--note-sky)) 70%, rgb(var(--surface)))' }} className="stroke-ink/30" strokeWidth={3} />
          <rect x={44} y={458} width={74} height={30} rx={13} className="fill-surface stroke-ink/25" strokeWidth={2.5} />
          <path d="M140 470C170 462 220 464 250 472C262 476 270 488 266 500L150 504Z" style={{ fill: 'color-mix(in oklab, rgb(var(--note-mint)) 60%, rgb(var(--surface)))' }} className="stroke-ink/25" strokeWidth={2.5} />
        </g>

        {/* Свет лампочки поверх всего, что стоит у стены. */}
        <ellipse cx={470} cy={300} rx={420} ry={300} fill={`url(#${id}-light)`} className={still ? undefined : 'animate-gym-flicker'} />
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
        <g className={still ? undefined : 'animate-gym-swing'} style={{ transformOrigin: '470px 0px' }}>
          <line x1={470} y1={0} x2={470} y2={64} className="stroke-ink/80" strokeWidth={2.5} />
          <rect x={463} y={58} width={14} height={10} rx={2} className="fill-ink/80" />
          <circle cx={470} cy={78} r={12} className="fill-halo stroke-ink/30" strokeWidth={2} />
        </g>
      </svg>

      {/* Мопс: рисунок 320 × 300 высотой 380 единиц сцены ложится своим полом
          (y 296) на пол подвала (y 448), серединой — под лампочку. Огромный,
          как просили: почти во всю высоту стены. */}
      <div className="pointer-events-none absolute" style={{ left: '26.7%', top: '13.5%', width: '42.2%', height: '70.4%' }}>
        <PugRig
          motion={showcase === 'rest' ? 'rest' : MOTION[showcase]}
          gear="barbell"
          plate={showcase === 'rest' ? undefined : PLATES[showcase]}
          title={pugTitle}
          className="h-full w-full"
        />
      </div>

      {/* Реплика мопса. */}
      <p className="absolute left-1/2 top-[3%] max-w-[36%] -translate-x-1/2 sm:max-w-[46%] rounded-[12px] border-2 border-ink/80 bg-surface px-3 py-1.5 text-center text-[0.72rem] font-semibold leading-snug text-ink sm:top-[6%] sm:px-4 sm:py-2 sm:text-[0.95rem]">
        {speech}
        <span aria-hidden="true" className="absolute -bottom-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-ink/80 bg-surface" />
      </p>

      {/* Таблички-ссылки на предметах. */}
      {links.map((link) => {
        const sign = SIGNS[link.kind];
        return (
          <Link
            key={link.kind}
            href={link.href}
            className="ps-press group absolute -translate-x-1/2 rounded-[6px] border-2 border-ink bg-note-yellow px-2 py-0.5 text-[0.7rem] font-bold lowercase text-ink hover:bg-surface focus-visible:bg-surface sm:px-3 sm:py-1 sm:text-[1rem]"
            style={{ left: sign.left, top: sign.top, rotate: `${sign.tilt}deg` }}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
