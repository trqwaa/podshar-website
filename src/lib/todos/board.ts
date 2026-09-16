import 'server-only';

import { prisma } from '@/lib/db';
import { authConfigured } from '@/lib/auth/config';
import {
  DEFAULT_COLOR,
  DEFAULT_PIN,
  NOTE_H,
  NOTE_W,
  isColor,
  isPin,
  type NoteColor,
  type NotePin
} from './notes';

/**
 * Доска задач: что читает страница.
 *
 * Два списка на одном экране, и разница между ними — одно поле. Общий видят все
 * трое, личный — только автор. Выборка личного идёт **по автору из сессии**, а
 * не по тому, что пришло из браузера: иначе чужой личный список открывался бы
 * подстановкой идентификатора в запрос.
 */

export type Note = {
  id: string;
  title: string;
  notes: string | null;
  done: boolean;
  shared: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  color: NoteColor;
  pin: NotePin;
  author: string;
  mine: boolean;
};

/** Новая записка ложится в левый верхний угол, если места на доске ещё не знали. */
const FALLBACK = { x: 0.05, y: 0.08 };

export async function boardNotes(userId: string, shared: boolean): Promise<Note[]> {
  if (!authConfigured()) return [];

  const rows = await prisma.todoItem.findMany({
    where: shared ? { shared: true } : { shared: false, createdById: userId },
    orderBy: { position: 'asc' },
    include: { createdBy: { select: { id: true, displayName: true } } }
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    notes: row.notes,
    done: row.done,
    shared: row.shared,
    // Записки, заведённые до доски, места не имеют. Отправлять их в (0,0) стопкой
    // хуже, чем разложить — но раскладывать в чтении нельзя, порядок должен быть
    // одинаковым у всех троих, поэтому берётся индекс, который уже есть.
    x: row.x ?? FALLBACK.x,
    y: row.y ?? FALLBACK.y,
    w: row.w ?? NOTE_W,
    h: row.h ?? NOTE_H,
    color: isColor(row.color) ? row.color : DEFAULT_COLOR,
    pin: isPin(row.pin) ? row.pin : DEFAULT_PIN,
    author: row.createdBy.displayName,
    mine: row.createdBy.id === userId
  }));
}
