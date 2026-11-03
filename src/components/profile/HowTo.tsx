import { PugFace } from '@/components/gym/PugFace';

/**
 * Картинки к подключениям (1.55B): цепочка значков, по которой бегут точки,
 * и шаги с номером и значком вместо сплошного текста. Просьба владельца —
 * «иллюстрация для тех, кто не читает»: сначала видно, откуда куда идёт сон
 * или уведомление, потом — что нажимать.
 *
 * Не гифка, а SVG и CSS: ничего не весит, не мылится на ретине, красится
 * токенами и стоит, когда просят меньше движения (общее правило в
 * `globals.css`). Значки свои и нарочно общие — без чужих логотипов.
 */

const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONS = {
  watch: (
    <>
      <rect x="4" y="4" width="8" height="8" rx="2" />
      <path d="M6 4V1.5h4V4M6 12v2.5h4V12M8 6.5V8l1.2 1" />
    </>
  ),
  google: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="3" />
      <path d="M4 8.5h1.8l1-2.5 2 5 1.2-2.5H12" />
    </>
  ),
  health: <path d="M8 13.2S2.5 9.8 2.5 6.1A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.1c0 3.7-5.5 7.1-5.5 7.1Z" />,
  shortcut: (
    <>
      <rect x="2" y="2" width="7.5" height="7.5" rx="2" />
      <rect x="6.5" y="6.5" width="7.5" height="7.5" rx="2" />
    </>
  ),
  list: <path d="M5.5 4.5h8M5.5 8h8M5.5 11.5h8M2.5 4.5h.01M2.5 8h.01M2.5 11.5h.01" />,
  send: <path d="M2.5 8 13.5 2.5 10 13.5 7.5 9 2.5 8ZM7.5 9l6-6.5" />,
  safari: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="m10.5 5.5-1.6 3.4-3.4 1.6 1.6-3.4z" />
    </>
  ),
  share: <path d="M8 10V2.5M5.5 5 8 2.5 10.5 5M5 7H3.5v6.5h9V7H11" />,
  home: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="3" />
      <path d="M8 5.5v5M5.5 8h5" />
    </>
  ),
  bell: <path d="M4 11V7.5a4 4 0 0 1 8 0V11l1 1.5H3L4 11ZM6.5 14h3" />
} as const;

export type Glyph = keyof typeof ICONS;

export function Icon({ name, className = 'h-4 w-4' }: { name: Glyph; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} {...LINE} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/**
 * Цепочка: значки по очереди вспыхивают, по стрелкам между ними бегут
 * точки — сон или уведомление «едет» слева направо. Последний — мопс, то
 * есть подшар.
 */
export function Flow({ steps, label }: { steps: { icon: Glyph | 'pug'; label: string }[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex items-start justify-between gap-0.5 rounded-[12px] bg-canvas px-1.5 py-3 sm:gap-1 sm:px-2">
      {steps.map((step, i) => (
        <div key={step.label} className="contents">
          {i > 0 ? (
            <svg viewBox="0 0 24 8" className="mt-3.5 h-2 min-w-1.5 flex-1 text-ink-faint sm:mt-4" aria-hidden="true">
              <path d="M1 4h22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 4" className="animate-flow-dash" />
            </svg>
          ) : null}
          <div className="flex w-12 shrink-0 flex-col items-center gap-1 text-center sm:w-14">
            <span className="relative grid h-9 w-9 place-items-center rounded-full bg-surface text-ink sm:h-10 sm:w-10">
              <span
                aria-hidden="true"
                className="absolute inset-0 animate-step-pulse rounded-full border-2 border-accent"
                style={{ animationDelay: `${i * 0.45}s` }}
              />
              {step.icon === 'pug' ? <PugFace face="happy" className="h-7 w-7 sm:h-8 sm:w-8" /> : <Icon name={step.icon} className="h-[1.1rem] w-[1.1rem] sm:h-5 sm:w-5" />}
            </span>
            <span className="text-[0.65rem] leading-tight text-ink-muted">{step.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Шаги из одной строки каталога — по строке на шаг, номер и значок у каждого. */
export function Steps({ text, icons }: { text: string; icons: Glyph[] }) {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);
  return (
    <ol className="flex flex-col gap-2.5">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-ink">
            <Icon name={icons[i] ?? 'list'} />
            <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-ink text-[0.6rem] font-bold text-surface">{i + 1}</span>
          </span>
          <p className="pt-1 text-sm leading-relaxed text-ink">{line}</p>
        </li>
      ))}
    </ol>
  );
}
