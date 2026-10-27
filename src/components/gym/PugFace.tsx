import type { Face } from '@/lib/gym/critic';

/**
 * Морда мопса анфас — то, чем он реагирует на дневник.
 *
 * Одна голова и набор выражений поверх: веки, брови, рот и то, что вокруг
 * (зеленца, когда от фастфуда плохо, «z» над невыспавшимся, капля у
 * переспавшего). Без состояния и без скриптов: выражение выбирает сервер
 * (`critic.ts`), моргание и плывущие «z» — CSS, и `prefers-reduced-motion`
 * гасит их общим правилом в `globals.css`.
 *
 * Тени нет ни у чего: объём — заливками и линиями, как везде на сайте.
 */

const SKIN = 'fill-pug';
const MASK = 'fill-pug-mask';
const TONGUE = { fill: 'color-mix(in oklab, rgb(var(--loss)) 45%, rgb(var(--note-pink)))' };

function Eye({ cx, face, side }: { cx: number; face: Face; side: -1 | 1 }) {
  const cy = 60;
  const wide = face === 'shocked';
  const iris = wide ? 6 : 8.6;
  const look = face === 'sad' ? -1.5 : face === 'proud' ? 1.5 * side : 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={15.5} className={MASK} />
      <circle cx={cx} cy={cy} r={11.2} className="fill-surface" />
      <circle cx={cx + 1 + look} cy={cy + 1} r={iris} className="fill-ink" />
      <circle cx={cx + 4 + look} cy={cy - 3} r={face === 'sad' ? 3.6 : 2.6} className="fill-surface" />
      {face === 'sad' ? <circle cx={cx - 2} cy={cy + 5} r={1.4} className="fill-surface" /> : null}
    </g>
  );
}

/** Верхнее веко: доля закрытия 0–1, наклон — для злости и гордости. */
function Lid({ cx, close, tilt = 0, blink = false }: { cx: number; close: number; tilt?: number; blink?: boolean }) {
  const top = 60 - 11.6;
  const edge = top + 23.2 * close;
  return (
    <path
      d={`M${cx - 12.5} ${top - 1}H${cx + 12.5}V${edge + tilt}Q${cx} ${edge + 2 + (tilt > 0 ? tilt / 2 : 0)} ${cx - 12.5} ${edge - tilt}Z`}
      className={`${MASK} ${blink ? 'animate-pug-blink' : ''}`}
      style={blink ? { transformOrigin: `${cx}px ${top}px` } : undefined}
    />
  );
}

export function PugFace({ face, className = '', title }: { face: Face; className?: string; title?: string }) {
  const tint =
    face === 'sick'
      ? 'rgb(var(--queasy) / 0.42)'
      : face === 'angry'
        ? 'rgb(var(--loss) / 0.3)'
        : face === 'overslept'
          ? 'rgb(var(--ink) / 0.08)'
          : null;
  const lids: Record<Face, { close: number; tilt?: number }> = {
    happy: { close: 0 },
    proud: { close: 0.32, tilt: 2 },
    meh: { close: 0.48 },
    sad: { close: 0.1, tilt: -3 },
    angry: { close: 0.36, tilt: 5 },
    sick: { close: 0.42, tilt: -2 },
    sleepy: { close: 0.66 },
    overslept: { close: 0.55 },
    shocked: { close: 0 }
  };
  const lid = lids[face];

  return (
    <svg viewBox="0 0 120 120" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={className}>
      {/* Уши — тёмные «розочкой», за головой. */}
      <path d="M22 22C8 24 4 42 12 52C20 44 27 35 32 27Z" className={MASK} />
      <path d="M98 22C112 24 116 42 108 52C100 44 93 35 88 27Z" className={MASK} />
      {face === 'overslept' ? <path d="M56 14C52 4 60 2 60 10C62 2 70 4 64 14" className="stroke-pug-mask" strokeWidth={2.2} fill="none" /> : null}

      <ellipse cx={60} cy={62} rx={48} ry={46} className={`${SKIN} stroke-ink`} strokeWidth={2.5} />
      {tint ? <ellipse cx={60} cy={62} rx={46.6} ry={44.6} style={{ fill: tint }} /> : null}
      {/* Щёки надуты: сейчас вырвет. */}
      {face === 'sick' ? (
        <g style={{ fill: 'rgb(var(--queasy) / 0.5)' }}>
          <circle cx={22} cy={82} r={11} />
          <circle cx={98} cy={82} r={11} />
        </g>
      ) : null}

      {/* Морщины на лбу. У злого собраны к переносице. */}
      <path
        d={face === 'angry' ? 'M44 36Q56 42 60 34Q64 42 76 36M48 44Q60 40 72 44' : 'M42 36Q60 29 78 36M47 43Q60 38 73 43'}
        className="stroke-pug-mask"
        strokeWidth={2.6}
        fill="none"
        strokeLinecap="round"
      />

      {/* Маска: морда тёмная. */}
      <path d="M60 52C77 50 93 58 95 74C97 92 80 105 60 105C40 105 23 92 25 74C27 58 43 50 60 52Z" className={MASK} />

      <Eye cx={40} face={face} side={-1} />
      <Eye cx={80} face={face} side={1} />
      {face === 'overslept' ? (
        <>
          <path d="M28.5 61Q40 66 51.5 61" className="stroke-pug" strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <circle cx={40} cy={60} r={13.6} className={MASK} />
          <path d="M29 60Q40 66 51 60" className="stroke-pug/80" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <Lid cx={80} close={lid.close} />
        </>
      ) : lid.close > 0 ? (
        <>
          <Lid cx={40} close={lid.close} tilt={lid.tilt} />
          <Lid cx={80} close={lid.close} tilt={-(lid.tilt ?? 0)} />
        </>
      ) : (
        <>
          <Lid cx={40} close={1} blink />
          <Lid cx={80} close={1} blink />
        </>
      )}

      {/* Брови. */}
      {face === 'angry' ? <path d="M27 44L50 52M93 44L70 52" className="stroke-ink" strokeWidth={4} strokeLinecap="round" /> : null}
      {face === 'sad' ? <path d="M28 50L50 42M92 50L70 42" className="stroke-ink" strokeWidth={3.4} strokeLinecap="round" /> : null}
      {face === 'proud' ? <path d="M28 44Q39 40 50 45M70 40Q81 33 92 38" className="stroke-ink" strokeWidth={3.4} fill="none" strokeLinecap="round" /> : null}
      {face === 'shocked' ? <path d="M28 40Q39 33 50 39M70 39Q81 33 92 40" className="stroke-ink" strokeWidth={3.2} fill="none" strokeLinecap="round" /> : null}

      {/* Мешки под глазами — у невыспавшегося. */}
      {face === 'sleepy' ? (
        <path d="M29 76Q40 81 51 76M69 76Q80 81 91 76" className="stroke-pug/70" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      ) : null}

      {/* Нос и складка над ним. */}
      <path d="M41 71Q60 62 79 71" className="stroke-pug/50" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M49 76C49 70 71 70 71 76C71 82 65 85 60 85C55 85 49 82 49 76Z" className="fill-ink" />
      <ellipse cx={55} cy={77} rx={2.2} ry={1.4} className="fill-pug-mask" />
      <ellipse cx={65} cy={77} rx={2.2} ry={1.4} className="fill-pug-mask" />

      {/* Рот. */}
      <Mouth face={face} />

      {/* Сверху — то, что вокруг морды. */}
      {face === 'sleepy' ? (
        <g className="fill-ink" style={{ font: '700 14px var(--font-sans), sans-serif' }}>
          <text x={92} y={22} className="animate-pug-z">z</text>
          <text x={102} y={12} className="animate-pug-z [animation-delay:0.9s]" style={{ fontSize: 10 }}>
            z
          </text>
        </g>
      ) : null}
      {face === 'sick' || face === 'shocked' ? (
        <path d="M100 30C96 36 96 40 100 41C104 40 104 36 100 30Z" className="fill-water stroke-ink/40" strokeWidth={1} />
      ) : null}
      {face === 'angry' ? (
        <path d="M92 18L98 24M98 18L92 24M95 16V26" className="stroke-loss" strokeWidth={2.6} strokeLinecap="round" />
      ) : null}
      {face === 'overslept' ? (
        <>
          <path d="M14 72Q22 70 26 76" className="stroke-pug-mask/50" strokeWidth={1.6} fill="none" />
          <path d="M70 100C70 106 72 110 74 110C76 110 77 106 74 100Z" className="fill-water animate-pug-drip" style={{ transformOrigin: '72px 100px' }} />
        </>
      ) : null}
    </svg>
  );
}

function Mouth({ face }: { face: Face }) {
  const lip = 'stroke-pug/70';
  switch (face) {
    case 'happy':
      return (
        <g>
          <path d="M60 85V90M46 89Q53 97 60 90Q67 97 74 89" className={lip} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <path d="M54 94C54 104 66 104 66 94Q60 97 54 94Z" style={TONGUE} />
        </g>
      );
    case 'proud':
      return <path d="M60 85V90M48 92Q55 95 60 90Q68 96 76 87" className={lip} strokeWidth={2.4} fill="none" strokeLinecap="round" />;
    case 'meh':
      return <path d="M60 85V91M49 93H71" className={lip} strokeWidth={2.4} fill="none" strokeLinecap="round" />;
    case 'sad':
      return <path d="M60 85V90M46 98Q53 89 60 92Q67 89 74 98" className={lip} strokeWidth={2.4} fill="none" strokeLinecap="round" />;
    case 'angry':
      return (
        <g>
          <path d="M46 92H74V99Q60 103 46 99Z" className="fill-surface" />
          <path d="M53 92V100M60 92V101M67 92V100M46 95.5H74" className="stroke-ink/40" strokeWidth={1.2} />
          <path d="M46 92H74V99Q60 103 46 99Z" className="stroke-ink" strokeWidth={1.6} fill="none" strokeLinejoin="round" />
        </g>
      );
    case 'sick':
      return <path d="M60 85V90M44 96Q49 90 54 96T64 96T74 94" className={lip} strokeWidth={2.4} fill="none" strokeLinecap="round" />;
    case 'sleepy':
      return (
        <g>
          <ellipse cx={60} cy={96} rx={8} ry={8.5} className="fill-ink" />
          <path d="M54 100C55 104 65 104 66 100Q60 98 54 100Z" style={TONGUE} />
        </g>
      );
    case 'overslept':
      return <path d="M60 85V90M48 94Q56 97 64 93Q70 92 74 96" className={lip} strokeWidth={2.4} fill="none" strokeLinecap="round" />;
    case 'shocked':
      return <ellipse cx={60} cy={95} rx={5.5} ry={6.5} className="fill-ink" />;
  }
}

/**
 * Аватар мопса для зала: без капюшона, в майке-алкоголичке, огромный.
 *
 * Та же морда, только поверх трапеций, которые начинаются от ушей. Им мопс
 * встречает в подвале и сидит в углу экрана, пока ты в зале.
 */
export function PugAvatar({ className = '', title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 120 120" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={className}>
      {/* Плечи и трапеции: шире головы, от ушей вниз. */}
      <path d="M2 122C2 98 14 86 30 82C36 70 48 62 60 62C72 62 84 70 90 82C106 86 118 98 118 122Z" className="fill-pug stroke-ink" strokeWidth={2.5} />
      <circle cx={17} cy={101} r={16} className="fill-pug stroke-ink" strokeWidth={2.5} />
      <circle cx={103} cy={101} r={16} className="fill-pug stroke-ink" strokeWidth={2.5} />
      <path d="M8 104Q14 96 24 96M112 104Q106 96 96 96" className="stroke-pug-mask/40" strokeWidth={1.6} fill="none" />
      {/* Майка-алкоголичка: глубокие проймы, белая. */}
      <path d="M34 122C36 108 40 96 46 82H54C52 94 55 104 60 107C65 104 68 94 66 82H74C80 96 84 108 86 122Z" className="fill-surface stroke-ink" strokeWidth={2} strokeLinejoin="round" />
      <path d="M46 112Q60 104 74 112" className="stroke-ink/25" strokeWidth={1.4} fill="none" />
      {/* Грудь в вырезе. */}
      <path d="M54 84Q60 92 66 84" className="stroke-pug-mask/40" strokeWidth={1.4} fill="none" />
      <g transform="translate(22 0) scale(0.64)">
        <PugFace face="proud" />
      </g>
    </svg>
  );
}
