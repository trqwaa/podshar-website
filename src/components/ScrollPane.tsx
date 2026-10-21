'use client';

import { useEffect, useRef } from 'react';

/**
 * Лента, которая листается внутри плитки, со своим ползунком.
 *
 * Свой, а не системный: на телефоне и на маке системный виден только во время
 * прокрутки, а здесь ползунок и есть то, что говорит «плитка листается», —
 * владелец просил, чтобы его было видно. Листает всё равно браузер — колесом,
 * пальцем, клавишами; ползунок показывает место, тянется мышью и пальцем, а
 * нажатие на полосу мимо него переносит ленту туда.
 *
 * Положение пишется прямо в DOM из обработчика прокрутки, без React-состояния:
 * перерисовывать компонент на каждый кадр прокрутки сайт себе не позволяет
 * нигде. Края, за которыми есть ещё, растворяются — `.scroll-pane` в
 * `globals.css`.
 *
 * Рассчитана на плитку с `p-6`: лента выступает в её поля — слева на 0.5rem,
 * чтобы фону строки под мышью было куда лечь, справа на 1.25rem, где стоит
 * ползунок, — и текст остаётся вровень с подписью плитки.
 */
export function ScrollPane({
  label,
  className = '',
  children
}: {
  /** Имя области для скринридера. */
  label: string;
  /** Здесь задаётся высота, и она должна быть постоянной: иначе листать нечего. */
  className?: string;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLSpanElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = box.current;
    const track = rail.current;
    const bar = thumb.current;
    if (!el || !track || !bar) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const extra = el.scrollHeight - el.clientHeight;
      const scrolls = extra > 1;
      track.hidden = !scrolls;
      el.toggleAttribute('data-top', scrolls && el.scrollTop > 1);
      el.toggleAttribute('data-more', scrolls && el.scrollTop < extra - 1);
      if (!scrolls) return;
      const room = track.clientHeight;
      const size = Math.max(32, (el.clientHeight / el.scrollHeight) * room);
      bar.style.height = `${size}px`;
      bar.style.transform = `translateY(${(el.scrollTop / extra) * (room - size)}px)`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    draw();
    el.addEventListener('scroll', schedule, { passive: true });
    // Лента может вырасти и после первого кадра: догрузился шрифт, аватары.
    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    if (el.firstElementChild) resize.observe(el.firstElementChild);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', schedule);
      resize.disconnect();
    };
  }, []);

  // Захват указателя держит жест, даже когда палец съехал с полоски.
  const drag = (event: React.PointerEvent<HTMLSpanElement>) => {
    const el = box.current;
    const track = rail.current;
    const bar = event.currentTarget;
    if (!el || !track) return;
    event.preventDefault();
    event.stopPropagation();
    bar.setPointerCapture(event.pointerId);
    const from = event.clientY;
    const start = el.scrollTop;
    const ratio = (el.scrollHeight - el.clientHeight) / Math.max(1, track.clientHeight - bar.offsetHeight);
    const move = (e: PointerEvent) => {
      el.scrollTop = start + (e.clientY - from) * ratio;
    };
    const stop = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', stop);
      bar.removeEventListener('pointercancel', stop);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', stop);
    bar.addEventListener('pointercancel', stop);
  };

  const jump = (event: React.PointerEvent<HTMLSpanElement>) => {
    const el = box.current;
    const bar = thumb.current;
    // Пальцем — нет: полоса стоит у края плитки, и свайп страницы, начатый на
    // ней, сначала уносил бы ленту в случайное место. У системных полос прыжок
    // по нажатию — тоже только мышиный.
    if (!el || !bar || event.pointerType === 'touch') return;
    const { top, height } = event.currentTarget.getBoundingClientRect();
    const share = (event.clientY - top - bar.offsetHeight / 2) / Math.max(1, height - bar.offsetHeight);
    el.scrollTop = Math.min(1, Math.max(0, share)) * (el.scrollHeight - el.clientHeight);
  };

  return (
    <div className={`relative -me-5 -ms-2 ${className}`}>
      <div ref={box} role="region" aria-label={label} className="scroll-pane h-full overflow-y-auto pe-5 ps-2">
        <div>{children}</div>
      </div>
      <span
        ref={rail}
        aria-hidden="true"
        hidden
        onPointerDown={jump}
        className="absolute inset-y-1 end-0 w-3 cursor-pointer"
      >
        <span className="pointer-events-none absolute inset-y-0 start-1 w-1 rounded-full bg-rule-soft" />
        <span
          ref={thumb}
          onPointerDown={drag}
          className="group absolute inset-x-0 top-0 cursor-grab touch-none active:cursor-grabbing"
        >
          <span className="pointer-events-none absolute inset-y-0 start-1 w-1 rounded-full bg-ink/30 transition-colors duration-180 group-hover:bg-ink/55 group-active:bg-ink/55" />
        </span>
      </span>
    </div>
  );
}
