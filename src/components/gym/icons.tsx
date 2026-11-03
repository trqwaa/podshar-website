/**
 * Значки зала — вместо мелких надписей там, где действие понятно по картинке
 * (1.54A, просьба владельца: «больше пиктограмм, галочку, и чтобы её было
 * видно»; с 1.56 — и у вкладок, целей и нормы). Рисуются цветом текста,
 * размер задаёт место, где они стоят; подпись для скринридера — у кнопки, не
 * здесь. Без 'use client': их берут и серверные страницы.
 */

const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} {...LINE} aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} {...LINE} aria-hidden="true">
      <path d="M2.5 4.5h11M6.5 4.5V2.8h3v1.7M4.2 4.5l.7 9h6.2l.7-9M6.8 7v4M9.2 7v4" />
    </svg>
  );
}

export function PencilIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} {...LINE} aria-hidden="true">
      <path d="M10.8 2.7l2.5 2.5-7.6 7.6-3.2.7.7-3.2zM9.3 4.2l2.5 2.5" />
    </svg>
  );
}

function Glyph({ d, className, children }: { d?: string; className: string; children?: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className={className} {...LINE} aria-hidden="true">
      {d ? <path d={d} /> : null}
      {children}
    </svg>
  );
}

/** Вкладки тренировки (1.56): доска, тренировка, история, цели и замеры, упражнения. */
export const BoardIcon = ({ className = 'h-4 w-4' }: { className?: string }) => <Glyph className={className} d="M2.5 3h11v7.5h-11zM5 13.5l1.2-3M11 13.5l-1.2-3M5 5.5h4M5 8h6" />;
export const StopwatchIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <Glyph className={className} d="M8 9V6.5M6.5 1.8h3M8 1.8v2">
    <circle cx="8" cy="9" r="5" />
  </Glyph>
);
export const HistoryIcon = ({ className = 'h-4 w-4' }: { className?: string }) => <Glyph className={className} d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8M2.6 2.6v2.8h2.8M8 5.5V8l1.8 1.3" />;
export const TargetIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <Glyph className={className}>
    <circle cx="8" cy="8" r="6" />
    <circle cx="8" cy="8" r="3.2" />
    <circle cx="8" cy="8" r="0.6" />
  </Glyph>
);
export const DumbbellIcon = ({ className = 'h-4 w-4' }: { className?: string }) => <Glyph className={className} d="M1.5 8h13M3.5 5.5v5M5.5 4.2v7.6M10.5 4.2v7.6M12.5 5.5v5" />;

/** Основная цель (1.56): масса растёт, сила — железо, сушка — огонь. */
export const GrowIcon = ({ className = 'h-4 w-4' }: { className?: string }) => <Glyph className={className} d="M2 12l3.8-3.8 2.8 2.3L14 5M10.3 5H14v3.7" />;
export const FlameIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <Glyph className={className} d="M8 14c2.8 0 4.5-1.9 4.5-4.4 0-3.2-2.9-4.6-3.1-7.6-1.8 1.2-3 3-2.7 5-1-.4-1.6-1.3-1.7-2.2C3.9 6 3.5 7.4 3.5 9.6 3.5 12.1 5.2 14 8 14Z" />
);
export const InfoIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <Glyph className={className} d="M8 7.3V11M8 4.9h.01">
    <circle cx="8" cy="8" r="6" />
  </Glyph>
);
