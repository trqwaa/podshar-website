/**
 * Наборы значений для листочков — цвет бумаги и чем она держится.
 *
 * Отдельно от слоя данных и без единого импорта: доска клиентская, а читает их
 * и сервер при проверке формы. В базе лежит только имя, как у `avatarPreset` —
 * список допустимых живёт в коде, где его видно.
 */
export const NOTE_COLORS = [
  'yellow',
  'pink',
  'mint',
  'sky',
  'peach',
  'plain'
] as const;

export const NOTE_PINS = ['pin', 'tape', 'magnet', 'clip'] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];
export type NotePin = (typeof NOTE_PINS)[number];

export const DEFAULT_COLOR: NoteColor = 'yellow';
export const DEFAULT_PIN: NotePin = 'pin';

export const isColor = (v: unknown): v is NoteColor =>
  typeof v === 'string' && (NOTE_COLORS as readonly string[]).includes(v);

export const isPin = (v: unknown): v is NotePin =>
  typeof v === 'string' && (NOTE_PINS as readonly string[]).includes(v);

/** Класс бумаги. Собран таблицей, а не строкой — Tailwind не видит склеенных имён. */
export const PAPER: Record<NoteColor, string> = {
  yellow: 'bg-note-yellow',
  pink: 'bg-note-pink',
  mint: 'bg-note-mint',
  sky: 'bg-note-sky',
  peach: 'bg-note-peach',
  plain: 'bg-note-plain'
};

/**
 * Где листочек лежит на доске — в долях её ширины и высоты, а не в пикселях.
 *
 * Доска у телефона и у монитора разной ширины, и запомненные пиксели увели бы
 * половину записок за край. Доли переживают любой размер.
 */
export type Spot = { x: number; y: number };

/**
 * Размер листочка в долях доски. Здесь, а не в разметке: место под новый
 * листочек ищется по тому же следу, который он потом займёт.
 */
export const NOTE_W = 0.2;
export const NOTE_H = 0.26;

/**
 * Куда положить новый листочек, чтобы он не лёг поверх соседа.
 *
 * Свободным считается место, где **прямоугольники не пересекаются**, а не где
 * центры разошлись на глазок. Первая версия сравнивала координаты с шагом 0.05
 * при ширине листочка 0.2 — и честно клала новую записку на предыдущую, считая
 * место свободным.
 *
 * Обход идёт сеткой слева направо и сверху вниз, с зазором: доска с рядами
 * читается, доска со случайной россыпью — нет. Если рядов не хватило, листочек
 * ложится со сдвигом в свободный угол: лучше внахлёст, чем нигде.
 */
export function freeSpot(taken: Spot[]): Spot {
  const gapX = NOTE_W + 0.02;
  const gapY = NOTE_H + 0.03;
  const cols = Math.max(1, Math.floor((1 - 0.03) / gapX));
  const rows = Math.max(1, Math.floor((1 - 0.04) / gapY));

  const overlaps = (a: Spot, b: Spot) =>
    Math.abs(a.x - b.x) < NOTE_W && Math.abs(a.y - b.y) < NOTE_H;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const spot = { x: 0.03 + col * gapX, y: 0.04 + row * gapY };
      if (!taken.some((other) => overlaps(spot, other))) return spot;
    }
  }

  return { x: 0.03 + Math.random() * (1 - NOTE_W - 0.06), y: 0.04 + Math.random() * 0.4 };
}
