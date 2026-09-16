'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { motion, useDragControls, useMotionValue } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { addNote, editNote, removeNote, styleNote } from '@/lib/todos/actions';
import {
  DEFAULT_COLOR,
  DEFAULT_PIN,
  NOTE_COLORS,
  NOTE_H,
  NOTE_PINS,
  NOTE_W,
  PAPER,
  freeSpot,
  type NoteColor,
  type NotePin
} from '@/lib/todos/notes';

/** Ниже этой ширины доска перестаёт быть доской и показывается списком. */
const NARROW = 560;

export type BoardNote = {
  id: string;
  title: string;
  done: boolean;
  x: number;
  y: number;
  color: NoteColor;
  pin: NotePin;
  author: string;
  mine: boolean;
};

/**
 * Доска задач: листочки, которые можно двигать, красить и перекалывать.
 *
 * Состояние держится здесь, а на сервер уходит следом. Перетаскивание, правка
 * буквы и смена цвета обязаны быть мгновенными — ждать ответа на каждое
 * движение мыши значит сделать доску неотзывчивой, а ради чего она тогда доска.
 * Кнопка слева внизу показывает, догнал ли сервер.
 *
 * Положение хранится **в долях** ширины и высоты, а не в пикселях: у телефона и
 * у монитора доска разная, и запомненные пиксели увели бы половину записок за
 * край. В самом движении доли превращаются в пиксели и обратно — это и есть вся
 * возня с размером доски ниже.
 */
export function Board({
  notes,
  shared,
  canEdit
}: {
  notes: BoardNote[];
  shared: boolean;
  canEdit: boolean;
}) {
  const t = useTranslations('todos');
  const board = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [local, setLocal] = useState(notes);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [draft, setDraft] = useState('');

  // Пришли другие данные с сервера — берём их. Своё состояние тут не источник
  // правды, а опережение: оно живёт ровно до следующего ответа.
  useEffect(() => setLocal(notes), [notes]);

  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const watch = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const send = useCallback(
    (action: (prev: object, data: FormData) => Promise<unknown>, fields: Record<string, string>) => {
      const data = new FormData();
      for (const [key, value] of Object.entries(fields)) data.set(key, value);
      startSaving(async () => {
        await action({}, data);
      });
    },
    []
  );

  const patch = (id: string, change: Partial<BoardNote>) =>
    setLocal((all) => all.map((note) => (note.id === id ? { ...note, ...change } : note)));

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    const spot = freeSpot(local.map(({ x, y }) => ({ x, y })));
    setDraft('');
    send(addNote, {
      title,
      shared: String(shared),
      x: String(spot.x),
      y: String(spot.y),
      color: DEFAULT_COLOR,
      pin: DEFAULT_PIN
    });
  };

  const narrow = size.w > 0 && size.w < NARROW;
  const current = local.find((note) => note.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-3">
      {canEdit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('newNote')}
            maxLength={200}
            className="min-w-0 flex-1 rounded border-2 border-rule bg-canvas px-3 py-2.5 text-base text-ink outline-none transition-colors focus:border-ink placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="ps-label rounded border-2 border-transparent bg-accent px-4 py-2.5 text-accent-ink transition-opacity hover:opacity-85 disabled:opacity-30"
          >
            {t('add')}
          </button>
        </form>
      ) : null}

      {/* Доска. Пробковой фактуры нарочно нет: сайт рисует блоками и линиями, и
          деревянная доска посреди него смотрелась бы наклейкой из другого набора.
          Держат листочки крепления, а не фон. */}
      <div
        ref={board}
        onPointerDown={(e) => {
          if (e.target === board.current) setSelected(null);
        }}
        className="relative min-h-[26rem] overflow-hidden rounded-block border-2 border-dashed border-rule-soft bg-sunk sm:min-h-[32rem]"
      >
        {local.length === 0 ? (
          <p className="ps-label absolute inset-0 grid place-items-center">{t('empty')}</p>
        ) : null}

        {local.map((note) => (
          <Note
            key={note.id}
            note={note}
            size={size}
            narrow={narrow}
            canEdit={canEdit}
            selected={note.id === selected}
            onSelect={() => setSelected(note.id)}
            onMove={(x, y) => {
              patch(note.id, { x, y });
              send(styleNote, { id: note.id, x: String(x), y: String(y) });
            }}
            onText={(title) => {
              patch(note.id, { title });
              send(editNote, { id: note.id, title });
            }}
          />
        ))}
      </div>

      {/* Нижняя панель: слева состояние сохранения, по центру вид выбранного
          листочка, справа — расширенный режим, которого пока нет. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-block border-2 border-rule bg-surface p-2">
        <span className="ps-label px-2" aria-live="polite">
          {saving ? t('saving') : t('saved')}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {current && canEdit ? (
            <>
              {NOTE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={t(`colors.${color}`)}
                  aria-pressed={current.color === color}
                  onClick={() => {
                    patch(current.id, { color });
                    send(styleNote, { id: current.id, color });
                  }}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    PAPER[color]
                  } ${current.color === color ? 'border-ink' : 'border-rule-soft'}`}
                />
              ))}

              <span className="mx-1 h-6 w-px bg-rule-soft" />

              {NOTE_PINS.map((pin) => (
                <button
                  key={pin}
                  type="button"
                  aria-label={t(`pins.${pin}`)}
                  aria-pressed={current.pin === pin}
                  onClick={() => {
                    patch(current.id, { pin });
                    send(styleNote, { id: current.id, pin });
                  }}
                  className={`grid h-8 w-8 place-items-center rounded border-2 transition-colors ${
                    current.pin === pin
                      ? 'border-ink bg-sunk'
                      : 'border-rule-soft hover:bg-sunk'
                  }`}
                >
                  <Fastener pin={pin} small />
                </button>
              ))}

              <span className="mx-1 h-6 w-px bg-rule-soft" />

              <button
                type="button"
                onClick={() => {
                  patch(current.id, { done: !current.done });
                  send(styleNote, { id: current.id, done: String(!current.done) });
                }}
                className="ps-label rounded border-2 border-rule px-3 py-2 transition-colors hover:bg-sunk"
              >
                {current.done ? t('undo') : t('done')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setLocal((all) => all.filter((note) => note.id !== current.id));
                  send(removeNote, { id: current.id });
                }}
                className="ps-label rounded border-2 border-rule px-3 py-2 transition-colors hover:bg-sunk"
              >
                {t('remove')}
              </button>
            </>
          ) : (
            <span className="ps-label px-2">{t('pickNote')}</span>
          )}
        </div>

        {/* Расширенный режим ещё не построен. Честная заглушка, как пять строк в
            шторке: кнопка, ведущая в пустоту, хуже, чем кнопка, которая молчит. */}
        <span className="ps-label cursor-not-allowed rounded border-2 border-dashed border-rule-soft px-3 py-2 text-ink-faint">
          {t('pro')}
        </span>
      </div>
    </div>
  );
}

function Note({
  note,
  size,
  narrow,
  canEdit,
  selected,
  onSelect,
  onMove,
  onText
}: {
  note: BoardNote;
  size: { w: number; h: number };
  narrow: boolean;
  canEdit: boolean;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onText: (title: string) => void;
}) {
  const controls = useDragControls();
  const self = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [text, setText] = useState(note.title);

  useEffect(() => setText(note.title), [note.title]);

  // Доли превращаются в пиксели здесь и только здесь: и при первой отрисовке, и
  // каждый раз, когда доска меняет размер.
  useEffect(() => {
    if (size.w === 0) return;
    x.set(note.x * size.w);
    y.set(note.y * size.h);
  }, [note.x, note.y, size.w, size.h, x, y]);

  const drop = () => {
    const box = self.current?.parentElement?.getBoundingClientRect();
    const mine = self.current?.getBoundingClientRect();
    if (!box || !mine) return;
    // Прижимаем к доске: отпущенный за краем листочек иначе было бы не достать.
    const nx = Math.min(Math.max((mine.left - box.left) / box.width, 0), 1 - NOTE_W);
    const ny = Math.min(Math.max((mine.top - box.top) / box.height, 0), 1 - NOTE_H);
    x.set(nx * box.width);
    y.set(ny * box.height);
    onMove(nx, ny);
  };

  return (
    <motion.div
      ref={self}
      drag={canEdit && !narrow}
      dragControls={controls}
      dragListener={false}
      dragMomentum={false}
      onDragEnd={drop}
      style={narrow ? undefined : { x, y, width: `${NOTE_W * 100}%` }}
      // Выбор по клику, а не по нажатию. Нажатие — начало перетаскивания, а
      // смена состояния в этот же момент перерисовывает записку и роняет
      // только что начатый жест. Тот же урок, что у окна мопса.
      onClick={onSelect}
      className={`${narrow ? 'relative mb-2 w-full' : 'absolute left-0 top-0'} ${
        PAPER[note.color]
      } rounded-sm p-2 pt-4 shadow-[0_2px_6px_rgb(0_0_0/0.12)] ${
        selected ? 'outline outline-2 outline-ink' : ''
      } ${note.done ? 'opacity-55' : ''}`}
    >
      {/* Крепление — оно же ручка, и ручка во всю верхнюю кромку, а не сама
          булавка. Тащат за верх, а не за текст: иначе перетаскивание и
          выделение слова дерутся за один жест. Одиннадцать пикселей булавки
          были бы честной целью только для мыши и очень твёрдой руки. */}
      <span
        onPointerDown={(e) => {
          if (canEdit && !narrow) controls.start(e);
        }}
        className={`absolute -top-2 left-0 flex h-6 w-full items-center justify-center ${
          canEdit && !narrow ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <Fastener pin={note.pin} />
      </span>

      <textarea
        value={text}
        readOnly={!canEdit}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text.trim() !== note.title) onText(text.trim());
        }}
        rows={3}
        className={`w-full resize-none bg-transparent text-[0.8125rem] leading-snug text-ink outline-none ${
          note.done ? 'line-through' : ''
        }`}
      />

      <span className="ps-label block truncate text-ink/50">
        <span className="normal-case">{note.author}</span>
      </span>
    </motion.div>
  );
}

/** Булавка, скотч, магнит и скрепка. Нарисованы разметкой — четыре формы этого стоят. */
function Fastener({ pin, small = false }: { pin: NotePin; small?: boolean }) {
  const scale = small ? 0.75 : 1;
  const px = (n: number) => `${n * scale}px`;

  if (pin === 'tape') {
    return (
      <span
        aria-hidden="true"
        className="block -rotate-6 rounded-[1px] bg-ink/15"
        style={{ width: px(38), height: px(12) }}
      />
    );
  }
  if (pin === 'magnet') {
    return (
      <span
        aria-hidden="true"
        className="block rounded-sm border border-ink/30 bg-reactor"
        style={{ width: px(14), height: px(14) }}
      />
    );
  }
  if (pin === 'clip') {
    return (
      <span
        aria-hidden="true"
        className="block rounded-b-sm border-x-2 border-b-2 border-ink/45"
        style={{ width: px(16), height: px(13) }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="block rounded-full bg-ink/70 shadow-[0_1px_2px_rgb(0_0_0/0.35)]"
      style={{ width: px(11), height: px(11) }}
    />
  );
}
