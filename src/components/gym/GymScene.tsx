'use client';

import { useId } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import type { Showcase } from '@/lib/gym/exercises';
import type { FridgeGroup } from '@/lib/gym/foods';
import type { Mood } from '@/lib/sun';
import { PugRig } from './PugRig';

/**
 * Подвальная качалка — вход в зал.
 *
 * Старый подвал, где тренировались легенды: бетон в трещинах, трубы под
 * потолком, ржавая стойка, лямки на крюке, мел в миске, гантельный ряд,
 * кроссовер у стены и зал славы — портреты мопсов-легенд в рамках.
 *
 * Тот же подход, что у пульта-айсберга: сцена рисуется SVG, свет и небо
 * зависят от настоящего заката над Цюрихом (`lib/sun.ts`, настроение считает
 * сервер — так первый HTML уже правильного цвета). Днём из окна под
 * потолком падает луч, ночью светит только лампочка. Живое двигается
 * покадрово мимо React — мопс (`PugRig`) — или CSS-анимацией.
 *
 * Мопс в центре делает упражнение дня по плану смотрящего: жмёт 200, тянет 100
 * к поясу или приседает. День без тренировки — сидит на скамье лицом к тебе,
 * в капюшоне и в телефоне.
 *
 * Меню — предметы подвала: стойка — качалка, холодильник — питание, матрас —
 * сон. Ссылка — весь предмет, а не только табличка; наведёшь — предмет
 * отзывается: холодильник открывается, штанга приподнимается, над подушкой
 * всплывают «z», табличка бледнеет, чтобы было видно, что за ней. У
 * холодильника стоит то, что съедено сегодня: бургер, если был мак, рис с
 * курицей, если всё чисто.
 */

export type BoardRow = { day: string; title: string; today: boolean };

export type SceneLink = { href: string; label: string; line: string | null; kind: 'training' | 'food' | 'sleep' };

const WALL: Record<Mood, number> = { day: 22, dusk: 40, night: 62, blood: 64 };
const LIGHT: Record<Mood, number> = { day: 0.14, dusk: 0.24, night: 0.42, blood: 0.34 };
/** Луч из окна: днём заметный, на закате тусклый, ночью его нет. */
const BEAM: Record<Mood, number> = { day: 0.14, dusk: 0.08, night: 0, blood: 0 };
const PLATES: Record<Showcase, number> = { bench: 200, row: 100, squat: 180 };

/** Где на сцене предметы-ссылки: доли сцены 960 × 540 и табличка внутри. */
const HITS: Record<SceneLink['kind'], { box: [number, number, number, number]; sign: [string, string]; tilt: number }> = {
  training: { box: [24, 140, 220, 312], sign: ['50%', '30%'], tilt: -4 },
  food: { box: [734, 296, 204, 160], sign: ['62%', '10%'], tilt: 3 },
  sleep: { box: [26, 452, 280, 72], sign: ['42%', '24%'], tilt: -2 }
};

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;

const IRON = 'color-mix(in oklab, rgb(var(--deep)) 90%, rgb(var(--surface)))';
const RUST = 'color-mix(in oklab, rgb(var(--ink)) 72%, rgb(var(--amber)))';
const STEEL = 'color-mix(in oklab, rgb(var(--ink)) 70%, rgb(var(--sunk)))';
const WOOD = 'color-mix(in oklab, rgb(var(--amber)) 55%, rgb(var(--ink)))';

type Legend = 'ronnie' | 'levrone' | 'arnold' | 'dorian' | 'vlasov' | 'alekseyev';
const LEGENDS: Legend[] = ['ronnie', 'levrone', 'arnold', 'dorian', 'vlasov', 'alekseyev'];

/** Портрет мопса-легенды: старая фотография в деревянной рамке. */
function Portrait({ who, x, title, name }: { who: Legend; x: number; title: string; name: string }) {
  const y = 30;
  const skin = 'rgb(var(--pug))';
  const mask = 'rgb(var(--pug-mask))';
  return (
    <g transform={`translate(${x} ${y})`}>
      <title>{title}</title>
      <rect x={-3} y={-3} width={46} height={56} rx={2} style={{ fill: WOOD }} />
      <rect x={0} y={0} width={40} height={50} style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 22%, rgb(var(--surface)))' }} />
      {/* Плечи качка и голова мопса. */}
      <path d="M2 50C3 41 9 37 14 36C16 34 18 33 20 33C22 33 24 34 26 36C31 37 37 41 38 50Z" style={{ fill: skin }} />
      {who === 'dorian' ? <path d="M6 36C4 18 10 8 20 8C30 8 36 18 34 36C30 30 28 24 20 24C12 24 10 30 6 36Z" style={{ fill: STEEL }} /> : null}
      <ellipse cx={20} cy={22} rx={12} ry={10.6} style={{ fill: skin }} />
      {who === 'dorian' ? null : (
        <>
          {/* Уши «пуговкой» падают вперёд, а не торчат, как у медведя. */}
          <path d="M10 14C7 13 5 16 6 21C8 21 10 19 12 16Z" style={{ fill: mask }} />
          <path d="M30 14C33 13 35 16 34 21C32 21 30 19 28 16Z" style={{ fill: mask }} />
        </>
      )}
      <path d="M15 15Q20 12.6 25 15" fill="none" style={{ stroke: mask }} strokeWidth={0.9} strokeOpacity={0.6} />
      <path d="M11.6 21.6C11.6 17.8 28.4 17.8 28.4 21.6C28.4 29.6 24.4 32.6 20 32.6C15.6 32.6 11.6 29.6 11.6 21.6Z" style={{ fill: mask }} />
      <circle cx={15.8} cy={21} r={2.4} className="fill-ink" />
      <circle cx={24.2} cy={21} r={2.4} className="fill-ink" />
      <circle cx={16.4} cy={20.3} r={0.7} className="fill-surface" />
      <circle cx={24.8} cy={20.3} r={0.7} className="fill-surface" />
      <path d="M16 24.6Q20 22.8 24 24.6" fill="none" style={{ stroke: skin }} strokeWidth={0.8} strokeOpacity={0.6} />
      <ellipse cx={20} cy={26} rx={2.2} ry={1.4} className="fill-ink" />
      {who === 'ronnie' ? (
        <>
          {/* «Yeah buddy!» — рот открыт, на груди золото. */}
          <ellipse cx={20} cy={29.8} rx={2.4} ry={1.8} className="fill-loss/70" />
          <path d="M17 36L20 42L23 36" fill="none" className="stroke-loss" strokeWidth={1.2} />
          <circle cx={20} cy={44} r={3.4} className="fill-halo stroke-amber" strokeWidth={0.8} />
        </>
      ) : null}
      {who === 'levrone' ? (
        <>
          <path d="M17 36L20 42L23 36" fill="none" className="stroke-accent" strokeWidth={1.2} />
          <circle cx={20} cy={44} r={3.4} className="fill-sunk stroke-ink/40" strokeWidth={0.8} />
        </>
      ) : null}
      {who === 'arnold' ? (
        <>
          <rect x={22} y={27.5} width={9} height={2.4} rx={1} style={{ fill: RUST }} />
          <path d="M32 26Q34 22 31 19Q34 17 32 13" fill="none" className="stroke-ink/30" strokeWidth={0.9} />
        </>
      ) : null}
      {who === 'vlasov' ? (
        <path d="M12.2 21a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0M20.6 21a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0M19.4 20.6H20.6" fill="none" className="stroke-surface" strokeWidth={0.9} />
      ) : null}
      {who === 'alekseyev' ? <path d="M13 27C15 25 18 26 20 27C22 26 25 25 27 27C27 33 24 36 20 36C16 36 13 33 13 27Z" style={{ fill: mask }} /> : null}
      <rect x={4} y={55} width={32} height={9} rx={1.5} style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 40%, rgb(var(--surface)))' }} />
      <text x={20} y={61.6} textAnchor="middle" className="fill-ink" style={{ font: '700 6.4px var(--font-sans), sans-serif' }}>
        {name}
      </text>
    </g>
  );
}

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
          <path d="M-10-4H10V6H-10Z" style={{ fill: RUST }} />
          <path d="M-10-4L-14-8M-10 6L-14 10M10-4L14-8M10 6L14 10" className="stroke-ink/50" strokeWidth={1.2} />
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

export function GymScene({
  mood,
  showcase,
  board,
  goal,
  boardTitle,
  links,
  speech,
  pugTitle,
  sceneLabel,
  food
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
  /** Что съедено сегодня — группами, без повторов. */
  food: FridgeGroup[];
}) {
  const t = useTranslations('gym');
  const id = `gs${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
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
  const onTable = food.slice(0, 3);
  const onShelves = food.slice(0, 6);

  // Отклик предметов на наведение — CSS по `:has()`, без состояния: ссылка
  // лежит поверх сцены, а двигается то, что нарисовано под ней.
  const css = `
.${id} .gs-door{transition:transform .55s cubic-bezier(.2,.8,.2,1);transform-box:fill-box;transform-origin:100% 50%}
.${id}:has(a[data-kind=food]:is(:hover,:focus-visible)) .gs-door{transform:scaleX(.1)}
.${id} .gs-cold{opacity:0;transition:opacity .4s}
.${id}:has(a[data-kind=food]:is(:hover,:focus-visible)) .gs-cold{opacity:1}
.${id} .gs-bar{transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.${id}:has(a[data-kind=training]:is(:hover,:focus-visible)) .gs-bar{transform:translateY(-12px)}
.${id} .gs-zzz{opacity:0;transition:opacity .4s,transform .8s;transform:translateY(6px)}
.${id}:has(a[data-kind=sleep]:is(:hover,:focus-visible)) .gs-zzz{opacity:1;transform:none}
.${id} .gs-pillow{transition:transform .4s;transform-box:fill-box;transform-origin:50% 100%}
.${id}:has(a[data-kind=sleep]:is(:hover,:focus-visible)) .gs-pillow{transform:scale(1.06,1.18)}
.${id} a[data-kind] .gs-sign{transition:opacity .3s,background-color .3s}
.${id} a[data-kind]:is(:hover,:focus-visible) .gs-sign{opacity:.55}
@media (prefers-reduced-motion: reduce){.${id} *{transition:none!important}}`;

  return (
    <div className={`${id} relative aspect-[16/9] w-full overflow-hidden rounded-[10px]`} aria-label={sceneLabel} role="group">
      <style>{css}</style>
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
          <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: BEAM[mood] }} />
            <stop offset="1" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: 0 }} />
          </linearGradient>
          <radialGradient id={`${id}-corner`} cx="0.5" cy="0.45" r="0.75">
            <stop offset="0.6" style={{ stopColor: 'rgb(var(--ink))', stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: 'rgb(var(--ink))', stopOpacity: dark ? 0.4 : 0.22 }} />
          </radialGradient>
          <clipPath id={`${id}-window`}>
            <rect x={74} y={34} width={172} height={66} rx={3} />
          </clipPath>
        </defs>

        {/* Стена из блоков: серый подвал, темнее вечером. Трещины и подтёк. */}
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
        <g className="stroke-ink/20" strokeWidth={1.4} fill="none" strokeLinecap="round">
          <path d="M300 160L312 186L306 204L318 230" />
          <path d="M610 330L598 352L606 368" />
          <path d="M940 140L926 168L932 190" />
        </g>
        <ellipse cx={720} cy={18} rx={60} ry={34} className="fill-ink/5" />
        <path d="M712 30C710 60 716 90 712 120" className="stroke-ink/10" strokeWidth={6} strokeLinecap="round" fill="none" />

        {/* Трубы под потолком, с вентилем. */}
        <g>
          <rect x={0} y={4} width={960} height={10} rx={5} style={{ fill: STEEL }} />
          <rect x={0} y={17} width={960} height={6} rx={3} style={{ fill: RUST }} opacity={0.8} />
          {[90, 330, 600, 860].map((x) => (
            <rect key={x} x={x} y={0} width={8} height={26} rx={2} className="fill-ink/60" />
          ))}
          <circle cx={550} cy={9} r={9} fill="none" className="stroke-loss/80" strokeWidth={3} />
          <path d="M541 9H559M550 0V18" className="stroke-loss/80" strokeWidth={2} />
        </g>

        {/* Окошко под потолком: небо — то же, что над Цюрихом сейчас. */}
        <g>
          <rect x={66} y={26} width={188} height={82} rx={5} style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 70%, rgb(var(--sunk)))' }} />
          <rect x={74} y={34} width={172} height={66} rx={3} fill={`url(#${id}-sky)`} />
          <g clipPath={`url(#${id}-window)`}>
            {dark
              ? [
                  [96, 48],
                  [130, 42],
                  [176, 54],
                  [214, 44],
                  [228, 62],
                  [150, 66]
                ].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.3} className="fill-surface" opacity={mood === 'dusk' ? 0.35 : 0.8} />)
              : null}
            {mood === 'blood' ? <circle cx={206} cy={54} r={11} style={{ fill: 'color-mix(in oklab, rgb(var(--blood)) 75%, rgb(var(--halo)))' }} /> : null}
            {mood === 'night' ? <circle cx={206} cy={52} r={9} className="fill-surface" opacity={0.85} /> : null}
            {mood === 'day' ? <circle cx={214} cy={48} r={14} className="fill-halo" opacity={0.9} /> : null}
            {/* Трава на уровне земли: окно в подвале — у самой земли. */}
            <path
              d="M74 100L80 88L84 100L90 84L95 100L101 90L106 100L113 86L118 100L126 90L131 100L139 84L144 100L152 92L157 100L165 86L170 100L178 90L184 100L191 84L197 100L204 91L210 100L217 86L222 100L230 90L236 100L242 86L246 100Z"
              style={{ fill: dark ? 'color-mix(in oklab, rgb(var(--win)) 35%, rgb(var(--deep)))' : 'color-mix(in oklab, rgb(var(--win)) 70%, rgb(var(--surface)))' }}
            />
            {/* Кто-то проходит мимо — видны только ботинки. */}
            {still ? null : (
              <g className="animate-gym-walk" style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 80%, rgb(var(--sunk)))' }}>
                <rect x={-30} y={56} width={7} height={38} rx={3} />
                <rect x={-34} y={90} width={15} height={7} rx={3} />
                <rect x={-14} y={58} width={7} height={36} rx={3} />
                <rect x={-18} y={90} width={15} height={7} rx={3} />
              </g>
            )}
          </g>
          <g style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 70%, rgb(var(--sunk)))' }}>
            {[112, 152, 192, 230].map((x) => (
              <rect key={x} x={x} y={34} width={4} height={66} />
            ))}
          </g>
        </g>

        {/* Зал славы: мопсы-легенды. Ронни — первый, Левроун — второй. */}
        {LEGENDS.map((who, i) => (
          <Portrait key={who} who={who} x={i < 3 ? 288 + i * 52 : 506 + (i - 3) * 52} title={t(`legends.${who}.title`)} name={t(`legends.${who}.name`)} />
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

        {/* Доска с планом мелом. */}
        <g>
          <rect x={652} y={50} width={282} height={244} rx={6} style={{ fill: WOOD }} />
          <rect x={662} y={60} width={262} height={224} rx={3} className="fill-chalkboard" />
          <ellipse cx={850} cy={240} rx={70} ry={26} className="fill-surface/5" />
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
          {/* Полочка: мел и тряпка. */}
          <rect x={700} y={284} width={200} height={6} rx={2} style={{ fill: WOOD }} />
          <rect x={746} y={279} width={22} height={5} rx={2} className="fill-surface" />
          <rect x={776} y={280} width={8} height={4} rx={1.5} className="fill-surface/80" />
          <path d="M846 285C844 278 852 274 864 275C874 274 882 278 882 284Z" style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 35%, rgb(var(--surface)))' }} />
        </g>

        {/* Пол — старое резиновое покрытие плитками. */}
        <rect y={448} width={960} height={92} style={{ fill: floor }} />
        <g className="stroke-surface/5" strokeWidth={2}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line key={i} x1={i * 140 - 20} y1={448} x2={i * 160 - 120} y2={540} />
          ))}
          <line x1={0} y1={492} x2={960} y2={492} />
        </g>
        <ellipse cx={560} cy={500} rx={60} ry={10} className="fill-surface/5" />

        {/* Луч из окна на пол — днём. */}
        {BEAM[mood] ? <path d="M80 100L240 100L560 470L230 470Z" fill={`url(#${id}-beam)`} /> : null}

        {/* Стойка со штангой — качалка. Ржавая, с лямками и поясом. */}
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
        <path d="M59 300L57 320M217 280L219 305" style={{ stroke: RUST }} strokeWidth={3} opacity={0.6} />
        <g className="gs-bar">
          <rect x={30} y={234} width={206} height={6} rx={3} className="fill-sunk" />
          {[32, 50, 214, 232].map((x, i) => (
            <rect key={x} x={x - 7} y={i % 3 === 0 ? 206 : 200} width={14} height={i % 3 === 0 ? 62 : 74} rx={3} style={{ fill: IRON }} />
          ))}
        </g>
        {/* Лямки на крюке и пояс на стойке. */}
        <path d="M66 246C64 266 70 282 66 300M72 246C72 268 78 284 74 302" style={{ stroke: 'color-mix(in oklab, rgb(var(--loss)) 55%, rgb(var(--ink)))' }} strokeWidth={4} fill="none" strokeLinecap="round" />
        <rect x={203} y={300} width={16} height={56} rx={4} style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 45%, rgb(var(--ink)))' }} />
        <rect x={205} y={318} width={12} height={8} rx={1.5} className="fill-sunk/80" />

        {/* Миска с мелом на подставке. */}
        <g>
          <rect x={128} y={404} width={8} height={44} className="fill-ink/60" />
          <rect x={114} y={444} width={36} height={6} rx={2} className="fill-ink/60" />
          <path d="M108 394H156L150 406H114Z" style={{ fill: STEEL }} />
          <path d="M112 394C118 386 146 386 152 394Z" className="fill-surface" />
          <circle cx={160} cy={446} r={2} className="fill-surface/60" />
          <circle cx={168} cy={447} r={1.4} className="fill-surface/50" />
        </g>

        {/* Стойка для блинов. */}
        <g>
          <rect x={276} y={330} width={8} height={118} style={{ fill: STEEL }} />
          <rect x={258} y={444} width={44} height={6} rx={2} style={{ fill: STEEL }} />
          {[
            [262, 352, 18],
            [298, 372, 22],
            [262, 404, 26]
          ].map(([x, y, r]) => (
            <g key={y}>
              <ellipse cx={x} cy={y} rx={6} ry={r} style={{ fill: IRON }} />
              <ellipse cx={x + (x < 280 ? 4 : -4)} cy={y} rx={5} ry={r} style={{ fill: IRON }} className="stroke-surface/10" strokeWidth={1} />
            </g>
          ))}
        </g>

        {/* Гантельный ряд, гири и шейкер. */}
        <g>
          <path d="M608 400L734 392M608 428L734 420" style={{ stroke: STEEL }} strokeWidth={6} strokeLinecap="round" />
          <rect x={612} y={400} width={6} height={48} style={{ fill: STEEL }} />
          <rect x={724} y={392} width={6} height={56} style={{ fill: STEEL }} />
          {[0, 1, 2, 3].map((i) => (
            <g key={`top${i}`} transform={`translate(${626 + i * 28} ${389 - i * 2})`}>
              <rect x={-8} y={-2} width={16} height={4} rx={2} className="fill-sunk/70" />
              <rect x={-12} y={-6 - i} width={6} height={12 + i * 2} rx={1.5} style={{ fill: IRON }} />
              <rect x={6} y={-6 - i} width={6} height={12 + i * 2} rx={1.5} style={{ fill: IRON }} />
            </g>
          ))}
          {[0, 1, 2, 3].map((i) => (
            <g key={`bot${i}`} transform={`translate(${626 + i * 28} ${416 - i * 2})`}>
              <rect x={-9} y={-2} width={18} height={4} rx={2} className="fill-sunk/70" />
              <rect x={-14} y={-8 - i} width={7} height={16 + i * 2} rx={1.5} style={{ fill: IRON }} />
              <rect x={7} y={-8 - i} width={7} height={16 + i * 2} rx={1.5} style={{ fill: IRON }} />
            </g>
          ))}
          <path d="M640 438C640 431 652 431 652 438" className="stroke-ink" strokeWidth={3} fill="none" />
          <circle cx={646} cy={442} r={8} style={{ fill: IRON }} />
          <path d="M664 436C664 427 680 427 680 436" className="stroke-ink" strokeWidth={3.4} fill="none" />
          <circle cx={672} cy={441} r={10} style={{ fill: IRON }} />
          <g transform="translate(700 432)">
            <rect x={-6} y={-12} width={12} height={20} rx={2} className="fill-note-mint stroke-ink/50" strokeWidth={1} />
            <rect x={-6.5} y={-16} width={13} height={5} rx={1.5} className="fill-ink" />
          </g>
          {/* Полотенце на ряду. */}
          <path d="M716 388C720 384 732 383 736 387L734 412C730 414 722 414 718 410Z" className="fill-surface/80 stroke-ink/30" strokeWidth={1} />
        </g>

        {/* Магнитофон у матраса. */}
        <g transform="translate(322 432)">
          <rect x={-26} y={-12} width={52} height={24} rx={4} className="fill-ink/80" />
          <circle cx={-14} cy={0} r={7} className="fill-sunk/40" />
          <circle cx={14} cy={0} r={7} className="fill-sunk/40" />
          <rect x={-6} y={-6} width={12} height={8} rx={1.5} className="fill-sunk/30" />
          <path d="M-18-12C-18-20 18-20 18-12" className="stroke-ink/80" strokeWidth={2.4} fill="none" />
        </g>

        {/* Холодильник — питание. Внутри — то, что сегодня съедено. */}
        <g>
          <rect x={792} y={300} width={140} height={152} rx={16} style={{ fill: 'color-mix(in oklab, rgb(var(--surface)) 88%, rgb(var(--ink)))' }} className="stroke-ink/40" strokeWidth={3} />
          <rect x={800} y={358} width={124} height={88} rx={6} style={{ fill: 'color-mix(in oklab, rgb(var(--surface)) 94%, rgb(var(--water)))' }} />
          <rect x={800} y={358} width={124} height={88} rx={6} className="gs-cold fill-halo/25" />
          {[384, 410, 436].map((y) => (
            <line key={y} x1={802} y1={y} x2={922} y2={y} className="stroke-ink/25" strokeWidth={2} />
          ))}
          {onShelves.map((kind, i) => (
            <FoodIcon key={`${kind}-${i}`} kind={kind} x={822 + (i % 3) * 40} y={i < 3 ? 374 : 400} />
          ))}
          <rect x={794} y={302} width={136} height={50} rx={14} style={{ fill: 'color-mix(in oklab, rgb(var(--surface)) 88%, rgb(var(--ink)))' }} />
          <line x1={794} y1={354} x2={930} y2={354} className="stroke-ink/30" strokeWidth={3} />
          <rect x={806} y={316} width={8} height={26} rx={3} className="fill-ink/50" />
          <g className="gs-door">
            <rect x={794} y={356} width={136} height={94} rx={12} style={{ fill: 'color-mix(in oklab, rgb(var(--surface)) 86%, rgb(var(--ink)))' }} className="stroke-ink/30" strokeWidth={2} />
            <rect x={806} y={366} width={8} height={40} rx={3} className="fill-ink/50" />
            {/* Магниты: банан и пицца. Пиццу мопс не одобряет, но она висит. */}
            <path d="M856 376Q872 392 890 376Q872 384 856 376Z" className="fill-halo stroke-ink/40" strokeWidth={1.5} />
            <path d="M868 404L892 404L880 430Z" style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 60%, rgb(var(--surface)))' }} className="stroke-ink/40" strokeWidth={1.5} />
            <circle cx={876} cy={411} r={2.5} className="fill-loss/70" />
            <circle cx={884} cy={412} r={2.5} className="fill-loss/70" />
          </g>
        </g>
        {/* Табурет у холодильника: сегодняшняя еда — та, что уже съедена. */}
        <g>
          <rect x={738} y={404} width={50} height={6} rx={2} style={{ fill: WOOD }} />
          <rect x={742} y={410} width={5} height={38} style={{ fill: WOOD }} />
          <rect x={779} y={410} width={5} height={38} style={{ fill: WOOD }} />
          {onTable.map((kind, i) => (
            <FoodIcon key={`${kind}-${i}`} kind={kind} x={750 + i * 15} y={394 - (i % 2) * 2} />
          ))}
        </g>

        {/* Матрас на полу — сон. */}
        <g>
          <rect x={34} y={466} width={262} height={50} rx={14} style={{ fill: 'color-mix(in oklab, rgb(var(--note-sky)) 70%, rgb(var(--surface)))' }} className="stroke-ink/30" strokeWidth={3} />
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

        {/* Свет лампочки поверх всего, что стоит у стены. Углы темнее. */}
        <ellipse cx={470} cy={300} rx={420} ry={300} fill={`url(#${id}-light)`} className={still ? undefined : 'animate-gym-flicker'} />
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
        <g className={still ? undefined : 'animate-gym-swing'} style={{ transformOrigin: '470px 0px' }}>
          <line x1={470} y1={0} x2={470} y2={64} className="stroke-ink/80" strokeWidth={2.5} />
          <rect x={463} y={58} width={14} height={10} rx={2} className="fill-ink/80" />
          <circle cx={470} cy={78} r={12} className="fill-halo stroke-ink/30" strokeWidth={2} />
        </g>
      </svg>

      {/* Мопс: рисунок 320 × 300 высотой 380 единиц сцены ложится полом на пол
          подвала (y 448), серединой — под лампочку. Огромный, как просили:
          почти во всю высоту стены. В день отдыха — лицом к зрителю. */}
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

      {/* Реплика мопса — под залом славы. */}
      <p className="absolute left-1/2 top-[16%] max-w-[40%] -translate-x-1/2 rounded-[12px] border-2 border-ink/80 bg-surface px-2.5 py-1 text-center text-[0.66rem] font-semibold leading-snug text-ink sm:top-[17%] sm:max-w-[46%] sm:px-4 sm:py-2 sm:text-[0.95rem]">
        {speech}
        <span aria-hidden="true" className="absolute -bottom-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-ink/80 bg-surface" />
      </p>

      {/* Предметы-ссылки: весь предмет нажимается, табличка — на нём. */}
      {links.map((link) => {
        const hit = HITS[link.kind];
        const [x, y, w, h] = hit.box;
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
              className="gs-sign ps-press absolute -translate-x-1/2 whitespace-nowrap rounded-[6px] border-2 border-ink bg-note-yellow px-2 py-0.5 text-[0.7rem] font-bold lowercase text-ink sm:px-3 sm:py-1 sm:text-[1rem]"
              style={{ left: hit.sign[0], top: hit.sign[1], rotate: `${hit.tilt}deg` }}
            >
              {link.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
