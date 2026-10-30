import { Link } from '@/i18n/routing';
import type { Mood } from '@/lib/sun';
import { CHROME, IRON, IRON_EDGE, RUST, STEEL, WOOD, floorOf, wallOf } from './basement-colors';

export type Room = 'training' | 'food' | 'sleep';

const PATH: Record<Room, '/gym/training' | '/gym/food' | '/gym/sleep'> = { training: '/gym/training', food: '/gym/food', sleep: '/gym/sleep' };
const ORDER: Room[] = ['training', 'food', 'sleep'];

/*
 * Отклик предметов — CSS по наведению на дверь целиком, как в подвале: штанга
 * приподнимается и мел пылит, холодильник открывается, подушка проминается и
 * над ней всплывают «z». «z» тлеют и сами, медленно, — матрас и так манит.
 */
const CSS = `
.gd-bar,.gd-door,.gd-pillow,.gd-puff,.gd-cold,.gd-z{transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .35s}
.gd-door{transform-box:fill-box;transform-origin:100% 50%}
.gd-pillow{transform-box:fill-box;transform-origin:50% 100%}
.gd-puff,.gd-cold{opacity:0}
.gd-z{opacity:.35;transform:translateY(4px)}
.gd-idle{animation:gd-float 4.2s ease-in-out infinite alternate}
.group:is(:hover,:focus-visible) .gd-bar{transform:translateY(-10px)}
.group:is(:hover,:focus-visible) .gd-puff{opacity:.9;transform:translateY(-6px)}
.group:is(:hover,:focus-visible) .gd-door{transform:scaleX(.12)}
.group:is(:hover,:focus-visible) .gd-cold{opacity:1}
.group:is(:hover,:focus-visible) .gd-pillow{transform:scale(1.06,1.2)}
.group:is(:hover,:focus-visible) .gd-z{opacity:1;transform:none}
@keyframes gd-float{from{translate:0 2px}to{translate:0 -3px}}
@media (prefers-reduced-motion:reduce){.gd-idle{animation:none}.gd-bar,.gd-door,.gd-pillow,.gd-puff,.gd-cold,.gd-z{transition:none}}
`;

/*
 * Предмет рисуется в кадре 240×120, а стена и пол тянутся за него на SIDE в
 * обе стороны и на ряды вверх. На широком экране дверь ниже, чем велит её
 * ширина, — по бокам тогда видна та же стена, а не пустота и не раздутый
 * на полэкрана холодильник.
 */
const SIDE = 480;
const ROWS = [-5, -4, -3, -2, -1, 0, 1, 2, 3];
const COLS = Array.from({ length: 21 }, (_, i) => i - 8);

/** Бетонная стена с полом — фон любой двери; темнеет к ночи, как подвал. */
function Wall({ mood, room }: { mood: Mood; room: Room }) {
  const dark = mood !== 'day';
  const light = `gd-light-${room}`;
  const line = dark ? 'rgb(var(--surface) / 0.07)' : 'rgb(var(--ink) / 0.09)';
  return (
    <>
      <rect x={-SIDE} y={-120} width={240 + 2 * SIDE} height={218} style={{ fill: wallOf(mood) }} />
      <g style={{ stroke: line }} strokeWidth={1.6}>
        {ROWS.map((row) => (
          <g key={row}>
            <path d={`M${-SIDE} ${row * 24 + 2}H${240 + SIDE}`} />
            {COLS.map((col) => (
              <path key={col} d={`M${col * 60 + (row % 2 ? 30 : 0)} ${row * 24 + 2}V${row * 24 + 26}`} />
            ))}
          </g>
        ))}
      </g>
      <rect x={-SIDE} y={98} width={240 + 2 * SIDE} height={22} style={{ fill: floorOf(mood) }} />
      <path d={`M${-SIDE} 108H${240 + SIDE}`} style={{ stroke: dark ? 'rgb(var(--surface) / 0.06)' : 'rgb(var(--ink) / 0.12)' }} strokeWidth={1.2} />
      {/* Свет лампочки сверху — пятном со спадом до нуля, как в подвале; пятно
          своё у предмета, а не растянутое на всю стену. */}
      <radialGradient id={light} gradientUnits="userSpaceOnUse" cx={120} cy={0} r={180} gradientTransform="matrix(1 0 0 0.5 0 0)">
        <stop offset="0" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: dark ? 0.32 : 0.18 }} />
        <stop offset="1" style={{ stopColor: 'rgb(var(--halo))', stopOpacity: 0 }} />
      </radialGradient>
      <rect x={-SIDE} y={-120} width={240 + 2 * SIDE} height={240} fill={`url(#${light})`} />
    </>
  );
}

/** Стойка со штангой — в тренировку. */
function Rack() {
  return (
    <>
      <g style={{ fill: STEEL }}>
        <rect x={66} y={24} width={7} height={76} />
        <rect x={167} y={24} width={7} height={76} />
        <rect x={62} y={21} width={116} height={6} rx={2} />
        <rect x={56} y={97} width={128} height={5} rx={2} />
        <rect x={72} y={52} width={10} height={5} rx={1.5} />
        <rect x={158} y={52} width={10} height={5} rx={1.5} />
      </g>
      <g className="gd-bar">
        <rect x={42} y={49} width={156} height={4} rx={2} className="fill-sunk" />
        {[48, 57, 183, 192].map((x, i) => (
          <rect key={x} x={x - 4} y={i % 3 === 0 ? 33 : 37} width={8} height={i % 3 === 0 ? 36 : 28} rx={2} style={{ fill: i % 3 === 0 ? IRON : IRON_EDGE }} />
        ))}
      </g>
      {/* Лямки на крюке и мел в миске. */}
      <path d="M78 60C77 70 81 78 78 86M82 60C82 71 86 79 83 88" style={{ stroke: 'color-mix(in oklab, rgb(var(--loss)) 55%, rgb(var(--ink)))' }} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M196 88H218L215 94H199Z" style={{ fill: STEEL }} />
      <path d="M198 88C201 84 213 84 216 88Z" className="fill-surface" />
      <g className="gd-puff fill-surface/80">
        <circle cx={203} cy={80} r={3} />
        <circle cx={209} cy={76} r={3.8} />
        <circle cx={214} cy={81} r={2.6} />
      </g>
    </>
  );
}

/** Холодильник — в питание. Откроешь — внутри еда. */
function Fridge() {
  const body = 'color-mix(in oklab, rgb(var(--surface)) 92%, rgb(var(--ink)))';
  return (
    <>
      <rect x={82} y={18} width={76} height={82} rx={10} style={{ fill: body }} className="stroke-ink/40" strokeWidth={2} />
      <rect x={87} y={48} width={66} height={48} rx={4} style={{ fill: 'color-mix(in oklab, rgb(var(--surface)) 94%, rgb(var(--water)))' }} />
      <rect x={87} y={48} width={66} height={48} rx={4} className="gd-cold fill-halo/30" />
      {[64, 80].map((y) => (
        <line key={y} x1={88} y1={y} x2={152} y2={y} className="stroke-ink/25" strokeWidth={1.5} />
      ))}
      {/* Полки: банка, яйца, курица. */}
      <rect x={95} y={52} width={7} height={12} rx={1.5} className="fill-loss" />
      <ellipse cx={113} cy={60} rx={3.2} ry={4} className="fill-surface stroke-ink/40" strokeWidth={0.8} />
      <ellipse cx={120} cy={60} rx={3.2} ry={4} className="fill-surface stroke-ink/40" strokeWidth={0.8} />
      <path d="M131 64C130 58 137 55 142 58C146 61 145 64 141 64Z" style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 35%, rgb(var(--surface)))' }} className="stroke-ink/40" strokeWidth={0.8} />
      <circle cx={100} cy={75} r={4.5} className="fill-win" />
      <path d="M118 80C120 73 132 73 134 80Z" style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 45%, rgb(var(--surface)))' }} className="stroke-ink/40" strokeWidth={0.8} />
      <rect x={140} y={70} width={7} height={10} rx={1.5} className="fill-note-mint stroke-ink/40" strokeWidth={0.8} />
      {/* Верхняя дверца и ручки. */}
      <rect x={84} y={20} width={72} height={26} rx={8} style={{ fill: body }} />
      <line x1={84} y1={47} x2={156} y2={47} className="stroke-ink/30" strokeWidth={2} />
      <rect x={90} y={27} width={4} height={13} rx={1.5} style={{ fill: CHROME }} />
      <g className="gd-door">
        <rect x={84} y={48} width={72} height={50} rx={7} style={{ fill: body }} className="stroke-ink/30" strokeWidth={1.5} />
        <rect x={90} y={54} width={4} height={20} rx={1.5} style={{ fill: CHROME }} />
        {/* Магниты: банан и пицца. */}
        <path d="M118 60C122 66 130 66 134 60C130 63 122 63 118 60Z" className="fill-halo stroke-ink/40" strokeWidth={0.8} />
        <path d="M124 72L138 72L131 86Z" style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 60%, rgb(var(--surface)))' }} className="stroke-ink/40" strokeWidth={0.8} />
        <circle cx={130} cy={76} r={1.4} className="fill-loss/70" />
      </g>
      <rect x={86} y={22} width={2.5} height={74} rx={1.2} className="fill-surface/50" />
    </>
  );
}

/** Матрас на полу — в сон. Над подушкой тлеют «z». */
function Mattress() {
  return (
    <>
      <rect x={30} y={80} width={180} height={24} rx={10} style={{ fill: 'color-mix(in oklab, rgb(var(--note-sky)) 70%, rgb(var(--surface)))' }} className="stroke-ink/30" strokeWidth={2} />
      <path d="M36 98H204" className="stroke-ink/10" strokeWidth={3} />
      <rect x={40} y={72} width={52} height={20} rx={9} className="gd-pillow fill-surface stroke-ink/25" strokeWidth={1.8} />
      <path d="M104 80C126 75 166 76 188 81C197 84 202 91 199 98L110 100Z" style={{ fill: 'color-mix(in oklab, rgb(var(--note-mint)) 60%, rgb(var(--surface)))' }} className="stroke-ink/25" strokeWidth={1.8} />
      <g className="gd-idle">
        <g className="gd-z fill-surface" style={{ font: '800 16px var(--font-sans), sans-serif' }}>
          <text x={96} y={62}>
            z
          </text>
          <text x={110} y={48} style={{ fontSize: 12 }}>
            z
          </text>
          <text x={121} y={37} style={{ fontSize: 9 }}>
            z
          </text>
        </g>
      </g>
    </>
  );
}

/**
 * Куда дальше из раздела зала: двери в два других — предметами подвала, а не
 * кнопками. Стойка со штангой — тренировка, холодильник — питание, матрас —
 * сон; наведёшь — предмет отзовётся, как в самом подвале. Стоят в самом низу,
 * перед подвалом сайта: дочитал раздел — вот куда идти.
 */
export function GymDoors({
  current,
  query,
  mood,
  words
}: {
  current: Room;
  /** Чей дневник открыт: дверь ведёт в тот же дневник. */
  query: { who?: string };
  mood: Mood;
  words: { title: string; rooms: Record<Room, { label: string; hint: string }> };
}) {
  return (
    <nav aria-label={words.title} className="flex flex-col gap-2">
      <style>{CSS}</style>
      <p className="ps-label px-1">{words.title}</p>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {ORDER.filter((room) => room !== current).map((room) => (
          <Link key={room} href={{ pathname: PATH[room], query }} className="group block-card ps-press flex flex-col overflow-hidden outline-none hover:border-ink focus-visible:ring-2 focus-visible:ring-ink">
            <span className="relative block">
              <svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMax meet" aria-hidden="true" className="block aspect-[2/1] w-full sm:aspect-auto sm:h-36 lg:h-44">
                <Wall mood={mood} room={room} />
                {room === 'training' ? <Rack /> : room === 'food' ? <Fridge /> : <Mattress />}
                <path d={`M${-SIDE} 98H${240 + SIDE}`} style={{ stroke: RUST }} strokeOpacity={0.25} strokeWidth={1} />
              </svg>
              {/* Старое дерево рамы — дверь в подвал, а не карточка. По краю
                  двери, а не кадра: кадр на широком экране уже двери. */}
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 border-2" style={{ borderColor: WOOD, opacity: 0.35 }} />
            </span>
            <span className="flex flex-col gap-0.5 px-3 py-2.5 sm:px-4 sm:py-3">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[clamp(0.875rem,4.4vw,1rem)] font-semibold lowercase text-ink sm:text-lg">{words.rooms[room].label}</span>
                <span aria-hidden="true" className="text-ink-faint transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
              <span className="line-clamp-2 text-xs text-ink-muted">{words.rooms[room].hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
