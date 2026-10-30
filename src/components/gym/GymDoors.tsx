import { Link } from '@/i18n/routing';
import type { Mood } from '@/lib/sun';
import { CHROME, IRON, IRON_EDGE, RUST, STEEL, WOOD, floorOf, wallOf } from './basement-colors';

export type Room = 'training' | 'food' | 'sleep';

const PATH: Record<Room, '/gym/training' | '/gym/food' | '/gym/sleep'> = { training: '/gym/training', food: '/gym/food', sleep: '/gym/sleep' };
const ORDER: Room[] = ['training', 'food', 'sleep'];

/*
 * Отклик предметов — CSS по наведению на дверь целиком, как в подвале: штанга
 * приподнимается, мел пылит, скакалка качается; холодильник открывается, в
 * микроволновке загорается свет; подушка проминается, над ней всплывают «z» и
 * ярче горит гирлянда. «z» тлеют и сами, медленно, — матрас и так манит.
 */
const CSS = `
.gd-bar,.gd-door,.gd-pillow,.gd-puff,.gd-cold,.gd-z,.gd-glow,.gd-sway{transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .35s}
.gd-door{transform-box:fill-box;transform-origin:100% 50%}
.gd-pillow{transform-box:fill-box;transform-origin:50% 100%}
.gd-sway{transform-box:view-box;transform-origin:20px 24px}
.gd-puff,.gd-cold,.gd-glow{opacity:0}
.gd-z{opacity:.35;transform:translateY(4px)}
.gd-idle{animation:gd-float 4.2s ease-in-out infinite alternate}
.group:is(:hover,:focus-visible) .gd-bar{transform:translateY(-10px)}
.group:is(:hover,:focus-visible) .gd-puff{opacity:.9;transform:translateY(-6px)}
.group:is(:hover,:focus-visible) .gd-sway{transform:rotate(9deg)}
.group:is(:hover,:focus-visible) .gd-door{transform:scaleX(.12)}
.group:is(:hover,:focus-visible) .gd-cold,.group:is(:hover,:focus-visible) .gd-glow{opacity:1}
.group:is(:hover,:focus-visible) .gd-pillow{transform:scale(1.06,1.2)}
.group:is(:hover,:focus-visible) .gd-z{opacity:1;transform:none}
@keyframes gd-float{from{translate:0 2px}to{translate:0 -3px}}
@media (prefers-reduced-motion:reduce){.gd-idle{animation:none}.gd-bar,.gd-door,.gd-pillow,.gd-puff,.gd-cold,.gd-z,.gd-glow,.gd-sway{transition:none}}
`;

/*
 * Предмет рисуется в кадре 240×120, а стена и пол тянутся за него на SIDE в
 * обе стороны и на ряды вверх. На широком экране дверь ниже, чем велит её
 * ширина, — по бокам тогда видна та же стена, а не пустота и не раздутый
 * на полэкрана холодильник. Чтобы стена по бокам не стояла голой, у каждой
 * двери там свои вещи: ближние видны с ноутбука, дальние — на большом мониторе.
 */
const SIDE = 480;
const ROWS = [-5, -4, -3, -2, -1, 0, 1, 2, 3];
const COLS = Array.from({ length: 21 }, (_, i) => i - 8);

/** Бытовое — из токенов, смесью, как железо подвала в `basement-colors.ts`. */
const APPLIANCE = 'color-mix(in oklab, rgb(var(--surface)) 92%, rgb(var(--ink)))';
const LEATHER = 'color-mix(in oklab, rgb(var(--loss)) 55%, rgb(var(--ink)))';
const ROPE = 'color-mix(in oklab, rgb(var(--win)) 55%, rgb(var(--water)))';
const CARDBOARD = 'color-mix(in oklab, rgb(var(--amber)) 30%, rgb(var(--surface)))';
const GLASS = 'color-mix(in oklab, rgb(var(--water)) 60%, rgb(var(--surface)))';
const BANANA = 'color-mix(in oklab, rgb(var(--amber)) 30%, rgb(var(--halo)))';
const CLAY = 'color-mix(in oklab, rgb(var(--amber)) 55%, rgb(var(--loss)))';

/** Небо в окошке у матраса — того же часа, что за окном подвала. */
const SKY: Record<Mood, string> = {
  day: 'color-mix(in oklab, rgb(var(--water)) 75%, rgb(var(--surface)))',
  dusk: 'color-mix(in oklab, rgb(var(--amber)) 45%, rgb(var(--deep)))',
  night: 'rgb(var(--deep))',
  blood: 'color-mix(in oklab, rgb(var(--blood)) 45%, rgb(var(--deep)))'
};

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
      {/* Труба под потолком — через все двери, как в подвале. */}
      <rect x={-SIDE} y={5} width={240 + 2 * SIDE} height={6} style={{ fill: STEEL }} />
      <rect x={-SIDE} y={5.6} width={240 + 2 * SIDE} height={1.4} className="fill-surface/15" />
      {COLS.filter((col) => col % 2 === 0).map((col) => (
        <rect key={col} x={col * 60 + 4} y={3.5} width={5} height={9} rx={1} style={{ fill: RUST }} />
      ))}
      <rect x={-SIDE} y={98} width={240 + 2 * SIDE} height={22} style={{ fill: floorOf(mood) }} />
      <path d={`M${-SIDE} 108H${240 + SIDE}`} style={{ stroke: dark ? 'rgb(var(--surface) / 0.06)' : 'rgb(var(--ink) / 0.12)' }} strokeWidth={1.2} />
      <path d={`M${-SIDE} 98H${240 + SIDE}`} style={{ stroke: RUST }} strokeOpacity={0.25} strokeWidth={1} />
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

/** Гантель боком: две головы и гриф между ними. `size` — от гантели на полу. */
function Dumbbell({ x, y, size = 1, tilt = 0 }: { x: number; y: number; size?: number; tilt?: number }) {
  const head = 7 * size;
  const tall = 12 * size;
  const grip = 14 * size;
  return (
    <g transform={tilt ? `rotate(${tilt} ${x} ${y})` : undefined}>
      <rect x={x - grip / 2} y={y - 1.5 * size} width={grip} height={3 * size} rx={1} style={{ fill: CHROME }} />
      {[x - grip / 2 - head, x + grip / 2].map((left) => (
        <rect key={left} x={left} y={y - tall / 2} width={head} height={tall} rx={2 * size} style={{ fill: IRON }} className="stroke-surface/25" strokeWidth={0.8} />
      ))}
    </g>
  );
}

/**
 * Стойка со штангой — в тренировку. Вокруг то, что валяется в любом подвальном
 * зале: скакалка на гвозде, гиря, гантели на полу, бутылка воды. Дальше по
 * стене — ряд гантелей, скамья с блином, груша и зеркало.
 */
function Rack() {
  return (
    <>
      {/* Груша на цепи от трубы — дальше всех. */}
      <path d="M-160 11V29" style={{ stroke: STEEL }} strokeWidth={1.6} strokeDasharray="2.5 1.5" />
      <rect x={-171} y={29} width={22} height={54} rx={8} style={{ fill: LEATHER }} />
      <rect x={-171} y={37} width={22} height={2.5} className="fill-ink/25" />
      <rect x={-171} y={72} width={22} height={2.5} className="fill-ink/25" />
      {/* Ряд гантелей: мелкие сверху, тяжёлые снизу. */}
      <g style={{ fill: STEEL }}>
        <rect x={-106} y={58} width={3} height={42} />
        <rect x={-17} y={58} width={3} height={42} />
        <rect x={-108} y={64} width={96} height={3} rx={1} />
        <rect x={-108} y={84} width={96} height={3} rx={1} />
      </g>
      {[0, 1, 2, 3].map((i) => (
        <Dumbbell key={i} x={-90 + i * 20} y={64 - 6 * (0.5 + i * 0.05)} size={0.5 + i * 0.05} />
      ))}
      {[0, 1, 2].map((i) => (
        <Dumbbell key={i} x={-86 + i * 26} y={84 - 6 * (0.7 + i * 0.05)} size={0.7 + i * 0.05} />
      ))}
      {/* Скамья и блин у стены. */}
      <g style={{ fill: STEEL }}>
        <rect x={262} y={84} width={4} height={15} />
        <rect x={306} y={84} width={4} height={15} />
        <rect x={257} y={98} width={14} height={3} rx={1} />
        <rect x={301} y={98} width={14} height={3} rx={1} />
      </g>
      <rect x={254} y={77} width={62} height={8} rx={3} style={{ fill: LEATHER }} />
      <circle cx={334} cy={88} r={12} style={{ fill: IRON }} />
      <circle cx={334} cy={88} r={7.5} fill="none" style={{ stroke: IRON_EDGE }} strokeWidth={2} />
      <circle cx={334} cy={88} r={2} className="fill-sunk" />
      {/* Зеркало — какой зал без него. */}
      <rect x={362} y={22} width={50} height={68} rx={2} style={{ fill: 'color-mix(in oklab, rgb(var(--water)) 70%, rgb(var(--sunk)))', stroke: WOOD }} strokeWidth={2.5} />
      <path d="M372 40L388 28M374 56L402 34" className="stroke-surface/60" strokeWidth={2} strokeLinecap="round" />

      {/* Скакалка на гвозде — качнётся, если навести, — и гиря под ней. */}
      <g className="gd-sway">
        <path d="M20 24C8 34 8 56 15 64M20 24C32 34 33 56 26 64" fill="none" style={{ stroke: ROPE }} strokeWidth={1.6} strokeLinecap="round" />
        <rect x={12.5} y={63} width={5} height={12} rx={2} className="fill-ink/70" />
        <rect x={23.5} y={63} width={5} height={12} rx={2} className="fill-ink/70" />
      </g>
      <circle cx={20} cy={24} r={1.6} className="fill-ink/60" />
      <path d="M23 92C22 81 38 81 37 92" fill="none" style={{ stroke: IRON }} strokeWidth={3.2} />
      <circle cx={30} cy={96} r={8.5} style={{ fill: IRON }} />
      <path d="M24 92A8.5 8.5 0 0 1 30 87.5" fill="none" className="stroke-surface/25" strokeWidth={1.4} strokeLinecap="round" />

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
      <path d="M78 60C77 70 81 78 78 86M82 60C82 71 86 79 83 88" style={{ stroke: LEATHER }} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M196 88H218L215 94H199Z" style={{ fill: STEEL }} />
      <path d="M198 88C201 84 213 84 216 88Z" className="fill-surface" />
      <g className="gd-puff fill-surface/80">
        <circle cx={203} cy={80} r={3} />
        <circle cx={209} cy={76} r={3.8} />
        <circle cx={214} cy={81} r={2.6} />
      </g>
      {/* Гантели брошены на пол перед стойкой, вода — у стены. */}
      <Dumbbell x={102} y={112} />
      <Dumbbell x={140} y={110} size={0.9} tilt={-8} />
      <rect x={223} y={82} width={9} height={20} rx={3} style={{ fill: GLASS }} className="stroke-ink/30" strokeWidth={0.8} />
      <rect x={224.5} y={78} width={6} height={5} rx={1} className="fill-ink/70" />
    </>
  );
}

/**
 * Холодильник — в питание. Откроешь — внутри еда. Рядом стол с микроволновкой
 * и шейкером, полка с протеином, мёдом и бананами, под ней — коробки от пиццы,
 * на холодильнике — хлопья. Дальше по стене — кухонный шкафчик с чайником,
 * мешок риса, кулер, весы и мусорка.
 */
function Fridge() {
  return (
    <>
      {/* Мешок риса — дальше всех. */}
      <path d="M-184 100C-188 86-182 72-176 68H-160C-154 72-148 86-152 100Z" style={{ fill: CARDBOARD }} className="stroke-ink/30" strokeWidth={1.2} />
      <path d="M-178 71C-172 67-164 67-158 71" fill="none" className="stroke-ink/40" strokeWidth={1.4} />
      {/* Кухонный шкафчик: на столешнице чайник и доска, на стене ящик. */}
      <rect x={-100} y={16} width={60} height={24} rx={1.5} style={{ fill: APPLIANCE }} className="stroke-ink/30" strokeWidth={1.2} />
      <path d="M-70 17V39" className="stroke-ink/25" strokeWidth={1} />
      <rect x={-104} y={66} width={92} height={34} style={{ fill: APPLIANCE }} className="stroke-ink/30" strokeWidth={1.2} />
      <path d="M-58 68V98" className="stroke-ink/25" strokeWidth={1} />
      <circle cx={-62} cy={80} r={1.3} style={{ fill: CHROME }} />
      <circle cx={-54} cy={80} r={1.3} style={{ fill: CHROME }} />
      <rect x={-107} y={62} width={98} height={5} rx={1} style={{ fill: WOOD }} />
      <path d="M-96 62L-94 47H-80L-78 62Z" className="fill-ink/75" />
      <path d="M-80 50C-74 50-74 58-79 58" fill="none" className="stroke-ink/75" strokeWidth={1.6} />
      <path d="M-95 51L-100 47" className="stroke-ink/75" strokeWidth={2} strokeLinecap="round" />
      <rect x={-68} y={40} width={14} height={22} rx={3} style={{ fill: 'color-mix(in oklab, rgb(var(--amber)) 40%, rgb(var(--surface)))' }} className="stroke-ink/30" strokeWidth={0.8} />
      <circle cx={-61} cy={45} r={1.6} className="fill-ink/30" />
      {/* Кулер, весы на полу и мусорка. */}
      <rect x={258} y={60} width={26} height={40} rx={2} style={{ fill: APPLIANCE }} className="stroke-ink/30" strokeWidth={1.2} />
      <rect x={264} y={68} width={5} height={4} rx={1} className="fill-loss/80" />
      <rect x={273} y={68} width={5} height={4} rx={1} className="fill-ink/40" />
      <rect x={266} y={56} width={10} height={5} style={{ fill: GLASS }} />
      <rect x={260} y={24} width={22} height={34} rx={7} style={{ fill: GLASS }} className="stroke-ink/25" strokeWidth={1} />
      <rect x={298} y={103} width={26} height={6} rx={2} className="fill-surface stroke-ink/30" strokeWidth={0.8} />
      <rect x={306} y={104.5} width={10} height={2.5} rx={0.5} className="fill-win/70" />
      <rect x={356} y={80} width={20} height={20} rx={2} style={{ fill: STEEL }} />
      <rect x={354} y={77} width={24} height={4} rx={1.5} style={{ fill: STEEL }} />

      {/* Стол: микроволновка — наведёшь, загорится, — и шейкер с протеином. */}
      <rect x={8} y={66} width={66} height={4} rx={1} style={{ fill: WOOD }} />
      <rect x={12} y={70} width={3} height={30} style={{ fill: WOOD }} />
      <rect x={67} y={70} width={3} height={30} style={{ fill: WOOD }} />
      <rect x={14} y={44} width={36} height={22} rx={3} style={{ fill: APPLIANCE }} className="stroke-ink/40" strokeWidth={1.2} />
      <rect x={17} y={48} width={22} height={14} rx={2} style={{ fill: 'color-mix(in oklab, rgb(var(--ink)) 72%, rgb(var(--surface)))' }} />
      <g className="gd-glow">
        <rect x={17} y={48} width={22} height={14} rx={2} className="fill-halo/80" />
        <ellipse cx={28} cy={59} rx={7} ry={1.6} className="fill-surface" />
      </g>
      <rect x={42} y={48} width={5} height={14} rx={1} className="fill-ink/10" />
      <circle cx={44.5} cy={52} r={1.1} className="fill-ink/50" />
      <circle cx={44.5} cy={57} r={1.1} className="fill-ink/50" />
      <rect x={56} y={50} width={10} height={16} rx={2} style={{ fill: GLASS }} className="stroke-ink/40" strokeWidth={0.8} />
      <rect x={57} y={58} width={8} height={7.5} rx={1} className="fill-amber/40" />
      <rect x={55} y={46} width={12} height={5} rx={1.5} className="fill-ink/75" />
      <rect x={59} y={43} width={4} height={3.5} rx={1} className="fill-ink/75" />
      {/* Полка: протеин, мёд и бананы; под ней — коробки от пиццы. */}
      <rect x={166} y={44} width={66} height={4} rx={1} style={{ fill: WOOD }} />
      <path d="M172 48V55L179 48ZM226 48V55L219 48Z" style={{ fill: WOOD }} />
      <rect x={172} y={27} width={18} height={17} rx={3} className="fill-ink/80" />
      <rect x={172} y={31} width={18} height={7} className="fill-surface/85" />
      <rect x={171} y={24} width={20} height={4} rx={1.5} className="fill-ink/90" />
      <rect x={196} y={31} width={11} height={13} rx={2} className="fill-amber/60 stroke-ink/30" strokeWidth={0.8} />
      <rect x={195.5} y={28.5} width={12} height={3} rx={1} className="fill-loss/80" />
      <path d="M212 37C215 44 227 43 229 35C226 40 217 41 212 37Z" style={{ fill: BANANA }} className="stroke-ink/40" strokeWidth={0.8} />
      <path d="M211 40C214 46 226 46 229 38C226 42 216 43 211 40Z" style={{ fill: BANANA }} className="stroke-ink/40" strokeWidth={0.8} />
      {[180, 184, 178].map((x, i) => (
        <rect key={i} x={x} y={95 - i * 5} width={46} height={5} rx={0.8} style={{ fill: CARDBOARD }} className="stroke-ink/35" strokeWidth={0.8} />
      ))}
      <circle cx={201} cy={87.5} r={1.6} className="fill-loss/80" />
      {/* Хлопья на холодильнике. */}
      <rect x={128} y={4} width={16} height={14} rx={1} className="fill-note-peach stroke-ink/30" strokeWidth={0.8} />
      <rect x={130} y={7} width={12} height={5} rx={1} className="fill-surface/70" />

      <rect x={82} y={18} width={76} height={82} rx={10} style={{ fill: APPLIANCE }} className="stroke-ink/40" strokeWidth={2} />
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
      <rect x={84} y={20} width={72} height={26} rx={8} style={{ fill: APPLIANCE }} />
      <line x1={84} y1={47} x2={156} y2={47} className="stroke-ink/30" strokeWidth={2} />
      <rect x={90} y={27} width={4} height={13} rx={1.5} style={{ fill: CHROME }} />
      <g className="gd-door">
        <rect x={84} y={48} width={72} height={50} rx={7} style={{ fill: APPLIANCE }} className="stroke-ink/30" strokeWidth={1.5} />
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

/** Лампочки гирлянды — точки на провисших дугах провода. */
const BULBS: [number, number][] = [
  [25.5, 20.3],
  [41, 22],
  [56.5, 20.3],
  [87.5, 20.3],
  [103, 22],
  [118.5, 20.3],
  [149.5, 20.3],
  [165, 22],
  [180.5, 20.3],
  [209.8, 19.7],
  [223.1, 20.3]
];
const BULB_FILL = ['fill-halo', 'fill-note-pink', 'fill-note-mint', 'fill-note-yellow'];

/**
 * Матрас на полу — в сон. Над подушкой тлеют «z», над матрасом гирлянда:
 * вечером и ночью горит сама, наведёшь — ярче. Рядом ящик с будильником и
 * тапки. Дальше по стене — батарея с носком, окошко с небом этого часа (ночью
 * с луной, в кровавый час — с красной), цветок, сумка и часы.
 */
function Mattress({ mood }: { mood: Mood }) {
  const lit = mood !== 'day';
  const night = mood === 'night' || mood === 'blood';
  return (
    <>
      {/* Часы и полотенце — дальше всех. */}
      <circle cx={-150} cy={40} r={12} className="fill-surface stroke-ink/40" strokeWidth={1.5} />
      <path d="M-150 40V32M-150 40L-144 43" className="stroke-ink/70" strokeWidth={1.4} strokeLinecap="round" />
      <circle cx={380} cy={30} r={1.6} className="fill-ink/60" />
      <path d="M372 32H388V64C388 66 386 67 384 67H376C374 67 372 66 372 64Z" className="fill-note-sky stroke-ink/25" strokeWidth={0.8} />
      {/* Батарея, на ней сохнет носок. */}
      <rect x={-96} y={60} width={70} height={30} rx={3} style={{ fill: APPLIANCE }} className="stroke-ink/25" strokeWidth={1} />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${-89 + i * 7} 63V87`} className="stroke-ink/15" strokeWidth={1.4} />
      ))}
      <rect x={-92} y={90} width={3} height={9} style={{ fill: STEEL }} />
      <rect x={-33} y={90} width={3} height={9} style={{ fill: STEEL }} />
      <path d="M-70 57H-62V71C-62 74-60 75-57 76C-53 77-53 83-57 83C-61 83-66 81-68 78C-70 76-70 74-70 71Z" className="fill-note-mint stroke-ink/30" strokeWidth={0.8} />
      {/* Окошко под потолком, цветок и сумка на полу. */}
      <rect x={252} y={16} width={40} height={24} rx={1} style={{ fill: SKY[mood] }} />
      {night ? <circle cx={283} cy={24} r={3.6} style={{ fill: mood === 'blood' ? 'rgb(var(--blood))' : 'rgb(var(--surface) / 0.85)' }} /> : null}
      <path d="M265 16V40M279 16V40" style={{ stroke: STEEL }} strokeWidth={1.6} />
      <rect x={252} y={16} width={40} height={24} rx={1} fill="none" style={{ stroke: STEEL }} strokeWidth={2.4} />
      <g className="fill-win/75">
        <ellipse cx={262} cy={76} rx={3.5} ry={9} transform="rotate(-25 262 76)" />
        <ellipse cx={268} cy={72} rx={3.5} ry={11} />
        <ellipse cx={274} cy={76} rx={3.5} ry={9} transform="rotate(25 274 76)" />
      </g>
      <path d="M258 86H278L275 100H261Z" style={{ fill: CLAY }} />
      <path d="M300 87C302 77 324 77 326 87" fill="none" className="stroke-ink/70" strokeWidth={2} />
      <rect x={292} y={86} width={42} height={14} rx={6} className="fill-ink/75 stroke-surface/20" strokeWidth={0.8} />
      <path d="M298 91H328" className="stroke-surface/25" strokeWidth={1} />

      {/* Гирлянда на гвоздях. */}
      {lit ? (
        <g className="fill-halo/30">
          {BULBS.map(([x, y]) => (
            <circle key={x} cx={x} cy={y + 2.6} r={4.5} />
          ))}
        </g>
      ) : null}
      <g className="gd-glow fill-halo/45">
        {BULBS.map(([x, y]) => (
          <circle key={x} cx={x} cy={y + 2.6} r={5.5} />
        ))}
      </g>
      <path d="M10 15Q41 29 72 15Q103 29 134 15Q165 29 196 15Q217 25 236 17" fill="none" className="stroke-ink/45" strokeWidth={0.8} />
      {[10, 72, 134, 196, 236].map((x) => (
        <circle key={x} cx={x} cy={x === 236 ? 17 : 15} r={1} className="fill-ink/50" />
      ))}
      {BULBS.map(([x, y], i) => (
        <ellipse key={x} cx={x} cy={y + 2.6} rx={1.7} ry={2.3} className={BULB_FILL[i % BULB_FILL.length]} />
      ))}
      {/* Ящик вместо тумбочки и будильник на нём. */}
      <rect x={3} y={84} width={24} height={16} rx={1} style={{ fill: WOOD }} />
      <path d="M3 89.5H27M3 95H27" className="stroke-ink/25" strokeWidth={1} />
      <circle cx={10.5} cy={70.5} r={2.3} style={{ fill: CHROME }} />
      <circle cx={19.5} cy={70.5} r={2.3} style={{ fill: CHROME }} />
      <circle cx={15} cy={77} r={6.5} className="fill-surface stroke-ink/50" strokeWidth={1.2} />
      <path d="M15 77V73.2M15 77L17.6 78.6" className="stroke-ink/70" strokeWidth={1} strokeLinecap="round" />
      <path d="M11 83L9.5 84.5M19 83L20.5 84.5" className="stroke-ink/50" strokeWidth={1} />

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
      {/* Тапки у матраса. */}
      <ellipse cx={214} cy={112} rx={8} ry={3.2} className="fill-note-pink stroke-ink/30" strokeWidth={0.8} />
      <ellipse cx={228} cy={114.5} rx={8} ry={3.2} className="fill-note-pink stroke-ink/30" strokeWidth={0.8} />
      <path d="M209 111.5C211 108.5 217 108.5 219 111.5M223 114C225 111 231 111 233 114" fill="none" className="stroke-ink/30" strokeWidth={2.2} strokeLinecap="round" />
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
                {room === 'training' ? <Rack /> : room === 'food' ? <Fridge /> : <Mattress mood={mood} />}
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
