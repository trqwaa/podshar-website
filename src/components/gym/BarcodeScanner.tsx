'use client';

import { useEffect, useRef } from 'react';

/**
 * Камера сканера штрихкода (1.53): навёл на упаковку — отдала цифры кода. С
 * 1.54 сканер живёт в кладовке (`Pantry.tsx`), отсюда — только камера.
 *
 * В Safari на айфоне своего распознавания штрихкодов нет, поэтому библиотека —
 * и она грузится, только когда сканер открыли: остальным страницам зала
 * лишние сотни килобайт ни к чему. Камера — задняя, видео без звука и внутри
 * страницы (`playsInline`), иначе айфон разворачивает его на весь экран.
 */

type Stop = { stop: () => void };

export function Camera({ onCode, onFail }: { onCode: (code: string) => void; onFail: () => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  // Колбэки через ссылку: камера включается один раз за открытие, а не на
  // каждый рендер родителя.
  const said = useRef({ onCode, onFail });
  said.current = { onCode, onFail };
  useEffect(() => {
    let controls: Stop | null = null;
    let done = false;
    void (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (done || !video.current) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current, (result, _error, ctrl) => {
          if (!result || done) return;
          done = true;
          ctrl.stop();
          said.current.onCode(result.getText());
        });
        if (done) controls.stop();
      } catch {
        if (!done) said.current.onFail();
      }
    })();
    return () => {
      done = true;
      controls?.stop();
    };
  }, []);
  return (
    <div className="relative overflow-hidden rounded-[14px] bg-ink">
      <video ref={video} muted playsInline className="aspect-[4/3] w-full object-cover" />
      {/* Рамка-прицел: куда подставить штрихкод, и красный луч кассы поперёк. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-1/2 h-24 -translate-y-1/2 rounded-[10px] border-2 border-surface/80" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-[16%] top-1/2 h-0.5 -translate-y-1/2 animate-pantry-laser rounded-full bg-laser" />
    </div>
  );
}
