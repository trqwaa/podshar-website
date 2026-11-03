/**
 * Значки зала — вместо мелких надписей там, где действие понятно по картинке
 * (1.54A, просьба владельца: «больше пиктограмм, галочку, и чтобы её было
 * видно»). Рисуются цветом текста, размер задаёт место, где они стоят;
 * подпись для скринридера — у кнопки, не здесь.
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
