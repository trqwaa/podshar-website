'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { motion, useDragControls, useMotionValue } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { addNote, editNote, removeNote, styleNote } from '@/lib/todos/actions';
import {
  DEFAULT_COLOR,
  DEFAULT_PIN,
  NOTE_COLORS,
  NOTE_PINS,
  PAPER,
  clampH,
  clampW,
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
  w: number;
  h: number;
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
  // Кто сверху. Обычный счётчик в ref, а не состояние: поднимать листочек
  // приходится ровно в тот момент, когда начинается перетаскивание, и лишняя
  // перерисовка там роняет жест — об это уже спотыкались с выбором записки.
  const layer = useRef(1);

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
    const spot = freeSpot(local.map(({ x, y, w, h }) => ({ x, y, w, h })));
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
            layer={layer}
            onMove={(x, y) => {
              patch(note.id, { x, y });
              send(styleNote, { id: note.id, x: String(x), y: String(y) });
            }}
            onResize={(w, h) => {
              patch(note.id, { w, h });
              send(styleNote, { id: note.id, w: String(w), h: String(h) });
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
  layer,
  onSelect,
  onMove,
  onResize,
  onText
}: {
  note: BoardNote;
  size: { w: number; h: number };
  narrow: boolean;
  canEdit: boolean;
  selected: boolean;
  layer: React.MutableRefObject<number>;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onText: (title: string) => void;
}) {
  const t = useTranslations('todos');
  const controls = useDragControls();
  const self = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const w = useMotionValue(0);
  const h = useMotionValue(0);
  // Слой — тоже motion value. Тронутый листочек обязан оказаться поверх того,
  // на который его тянут, а не как ляжет порядок в разметке.
  const z = useMotionValue(0);
  const [text, setText] = useState(note.title);

  const toFront = () => z.set((layer.current += 1));

  useEffect(() => setText(note.title), [note.title]);

  // Доли превращаются в пиксели здесь и только здесь: и при первой отрисовке, и
  // каждый раз, когда доска меняет размер.
  useEffect(() => {
    if (size.w === 0) return;
    x.set(note.x * size.w);
    y.set(note.y * size.h);
    w.set(note.w * size.w);
    h.set(note.h * size.h);
  }, [note.x, note.y, note.w, note.h, size.w, size.h, x, y, w, h]);

  const drop = () => {
    const box = self.current?.parentElement?.getBoundingClientRect();
    const mine = self.current?.getBoundingClientRect();
    if (!box || !mine) return;
    // Прижимаем к доске: отпущенный за краем листочек иначе было бы не достать.
    const nx = Math.min(Math.max((mine.left - box.left) / box.width, 0), 1 - note.w);
    const ny = Math.min(Math.max((mine.top - box.top) / box.height, 0), 1 - note.h);
    x.set(nx * box.width);
    y.set(ny * box.height);
    onMove(nx, ny);
  };

  /**
   * Тянем за угол — меняем размер.
   *
   * Слушатели вешаются на окно, а не на сам угол: угол уезжает из-под пальца на
   * первом же пикселе, и элемент перестаёт слышать движение. Та же причина, по
   * которой так сделано окно мопса.
   */
  const startResize = (event: React.PointerEvent) => {
    event.stopPropagation();
    if (!canEdit || narrow || size.w === 0) return;
    toFront();

    const fromX = event.clientX;
    const fromY = event.clientY;
    const wasW = w.get();
    const wasH = h.get();

    const move = (e: PointerEvent) => {
      w.set(clampW((wasW + (e.clientX - fromX)) / size.w) * size.w);
      h.set(clampH((wasH + (e.clientY - fromY)) / size.h) * size.h);
    };
    const letGo = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', letGo);
      window.removeEventListener('pointercancel', letGo);
      onResize(w.get() / size.w, h.get() / size.h);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', letGo);
    window.addEventListener('pointercancel', letGo);
  };

  return (
    <motion.div
      ref={self}
      drag={canEdit && !narrow}
      dragControls={controls}
      dragListener={false}
      dragMomentum={false}
      onDragEnd={drop}
      style={narrow ? undefined : { x, y, width: w, height: h, zIndex: z }}
      // Выбор по клику, а не по нажатию. Нажатие — начало перетаскивания, а
      // смена состояния в этот же момент перерисовывает записку и роняет
      // только что начатый жест. Тот же урок, что у окна мопса.
      onClick={onSelect}
      className={`${narrow ? 'relative mb-2 w-full' : 'absolute left-0 top-0 will-change-transform'} ${
        PAPER[note.color]
      } flex flex-col rounded-sm p-2 pt-4 ${
        selected ? 'outline outline-2 outline-ink' : ''
      } ${note.done ? 'opacity-55' : ''}`}
    >
      {/* Крепление — оно же ручка, и ручка во всю верхнюю кромку, а не сама
          булавка. Тащат за верх, а не за текст: иначе перетаскивание и
          выделение слова дерутся за один жест. Одиннадцать пикселей булавки
          были бы честной целью только для мыши и очень твёрдой руки. */}
      <span
        onPointerDown={(e) => {
          if (!canEdit || narrow) return;
          toFront();
          controls.start(e);
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
        // Пустой заголовок снимает листочек с доски — стирание и есть способ
        // его убрать. Подсказка появляется ровно тогда, когда текста уже нет, и
        // предупреждает до того, как уйдёт фокус, а не после.
        placeholder={canEdit ? t('emptyRemoves') : undefined}
        // 16px до `sm`: ниже шестнадцати iOS зумит всю страницу при фокусе, и с
        // доски уезжает всё остальное. Ниже 560px доска и так показывается
        // списком в полную ширину, так что крупному тексту есть где стоять.
        className={`min-h-0 w-full flex-1 resize-none bg-transparent text-[1rem] leading-snug text-ink outline-none placeholder:text-ink/35 sm:text-[0.8125rem] ${
          note.done ? 'line-through' : ''
        }`}
      />

      <span className="ps-label block truncate text-ink/50">
        <span className="normal-case">{note.author}</span>
      </span>

      {/* Угол для размера. Две косые чёрточки — этого хватает, чтобы его нашли,
          и не хватает, чтобы он спорил с текстом за внимание. */}
      {canEdit && !narrow ? (
        <span
          onPointerDown={startResize}
          aria-hidden="true"
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        >
          <span className="absolute bottom-1 right-1 h-2 w-2 border-b border-r border-ink/35" />
        </span>
      ) : null}
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
      // Была тень, чтобы булавка казалась выпуклой. На сайте ничего не
      // отбрасывает тень, и цвет в ней был сырым rgb мимо токенов. Объём
      // теперь даёт ободок тем же токеном, что и у остальных креплений.
      className="block rounded-full border border-ink/25 bg-ink/70"
      style={{ width: px(11), height: px(11) }}
    />
  );
}
