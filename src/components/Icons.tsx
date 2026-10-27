/**
 * Значки: одна линия, один размер, один набор правил.
 *
 * Рисуются обводкой в `currentColor`, поэтому цвет берут от текста рядом и не
 * требуют своих токенов. Сетка 16×16 и толщина 1.5 — на этой толщине они стоят
 * рядом с `ps-label` и не выглядят ни жирнее, ни бледнее букв.
 *
 * Все помечены `aria-hidden`: значок никогда не единственный носитель смысла.
 * Там, где рядом нет слова, у кнопки обязан быть `aria-label` — правило про
 * доступность, которое на этом сайте не шутит.
 */

type IconProps = { className?: string };

function Frame({ className = 'h-4 w-4', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Лупа — искать. */
export function SearchIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.4 10.4 3 3" />
    </Frame>
  );
}

/** Карандаш — переименовать. */
export function PencilIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M11.3 2.4 13.6 4.7 5.6 12.7l-3 .7.7-3z" />
      <path d="m9.9 3.8 2.3 2.3" />
    </Frame>
  );
}

/** Корзина — забыть. */
export function TrashIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M2.8 4.2h10.4M6.4 4.2V2.8h3.2v1.4M4.2 4.2l.6 8.2a.9.9 0 0 0 .9.8h4.6a.9.9 0 0 0 .9-.8l.6-8.2" />
    </Frame>
  );
}

/** Закладка — запомнить дорогу. */
export function BookmarkIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 2.6h8v10.8L8 10.4l-4 3z" />
    </Frame>
  );
}

/** Домик — своя станция. */
export function HomeIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M2.6 7 8 2.6 13.4 7" />
      <path d="M4.2 8.2v5.2h7.6V8.2" />
    </Frame>
  );
}

/** Точка — линия — точка: маршрут из конца в конец. */
export function RouteIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="3.4" cy="8" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="12.6" cy="8" r="1.8" />
      <path d="M5.6 8h4.8" />
    </Frame>
  );
}

/** Строки табло. */
export function BoardIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M2.6 4.4h10.8M2.6 8h10.8M2.6 11.6h7.2" />
    </Frame>
  );
}

/** Булавка на карте — станция в списке своих. */
export function PinIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M8 14s4.4-4.2 4.4-7.4A4.4 4.4 0 0 0 3.6 6.6C3.6 9.8 8 14 8 14Z" />
      <circle cx="8" cy="6.5" r="1.5" />
    </Frame>
  );
}

/** Часы — то, чем уже ездили. У SBB в списке своих стоит ровно он. */
export function ClockIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 4.8V8l2.2 1.5" />
    </Frame>
  );
}

/** Крестик — убрать из списка. */
export function CrossIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="m4.6 4.6 6.8 6.8M11.4 4.6l-6.8 6.8" />
    </Frame>
  );
}

/** Каска строителя — «тут ещё стройка». */
export function HardHatIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M2.2 11.4h11.6" />
      <path d="M3.4 11.4V9.2a4.6 4.6 0 0 1 9.2 0v2.2" />
      <path d="M6.6 5.1V3.2h2.8v1.9" />
    </Frame>
  );
}

/** Листок календаря — даты. */
export function CalendarIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <rect x="2.6" y="3.6" width="10.8" height="9.8" rx="1.4" />
      <path d="M2.6 6.8h10.8M5.6 2.2v2.6M10.4 2.2v2.6" />
    </Frame>
  );
}

/** Записка с загнутым углом — задачи на доске. */
export function NoteIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M3 2.8h10v6.6l-3.6 3.8H3z" />
      <path d="M13 9.4H9.4v3.8" />
    </Frame>
  );
}

/** Геймпад — игры. */
export function GamepadIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4.8 4.6h6.4a3 3 0 0 1 2.9 2.3l.7 3.3a1.6 1.6 0 0 1-2.7 1.4L10.6 10H5.4l-1.5 1.6a1.6 1.6 0 0 1-2.7-1.4l.7-3.3a3 3 0 0 1 2.9-2.3Z" />
      <path d="M5.4 6.6v2M4.4 7.6h2M10.6 7.2h.01M11.6 8.2h.01" />
    </Frame>
  );
}

/** Гантель — зал. */
export function DumbbellIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M5.2 8h5.6M3.6 5.2v5.6M5.2 4.4v7.2M12.4 5.2v5.6M10.8 4.4v7.2M1.8 8h1.8M12.4 8h1.8" />
    </Frame>
  );
}

/** Ярлык с номером — версии и патчи. */
export function TagIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M2.6 2.6h5.2l5.6 5.6-5.2 5.2-5.6-5.6z" />
      <circle cx="5.4" cy="5.4" r="0.9" />
    </Frame>
  );
}

/** Человек — профиль. */
export function UserIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="8" cy="5.4" r="2.6" />
      <path d="M2.8 13.6a5.2 5.2 0 0 1 10.4 0" />
    </Frame>
  );
}

/** Облачко реплики — спросить мопса. */
export function ChatIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M2.6 3.4h10.8v7.2H7.2l-3 2.4v-2.4H2.6z" />
    </Frame>
  );
}
