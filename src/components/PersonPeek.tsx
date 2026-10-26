'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { MemberAvatar } from './profile/MemberAvatar';

/**
 * Заготовка профилей: нажал на чью-то аватарку или ник — маленькое окошко
 * «профили скоро». Решение владельца от 26 октября 2026: страницы людей будут,
 * а пока каждый клик по человеку ведёт сюда. Когда они появятся, менять придётся
 * одно место — `PersonButton` поведёт на страницу, — а не каждую плитку.
 *
 * Окошко одно на весь сайт (`PeekHost` в шелле) и открывается событием, как
 * пульт: плитки не держат своё состояние ради него. Не модальное: прокрутку не
 * запирает и закрывается от любого нажатия мимо, Esc и прокрутки.
 */

export const PEEK_OPEN = 'podshar:peek';

export type Person = { name: string; avatarPreset: string | null; handle?: string };

type Peek = Person & {
  /** Куда ставить окошко: середина низа нажатой кнопки, в пикселях окна. */
  x: number;
  y: number;
};

/** Кто-то на сайте: его аватарка, ник или и то и другое. Нажатие — окошко профиля. */
export function PersonButton({ who, className = '', children }: { who: Person; className?: string; children: React.ReactNode }) {
  const t = useTranslations('people');
  return (
    <button
      type="button"
      aria-label={t('open', { name: who.name })}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        window.dispatchEvent(new CustomEvent<Peek>(PEEK_OPEN, { detail: { ...who, x: box.left + box.width / 2, y: box.bottom } }));
      }}
      className={`cursor-pointer text-start transition-opacity duration-180 hover:opacity-80 ${className}`}
    >
      {children}
    </button>
  );
}

/** Ширина окошка и поля до краёв окна, px. */
const WIDTH = 256;
const MARGIN = 12;

export function PeekHost() {
  const t = useTranslations('people');
  const [peek, setPeek] = useState<Peek | null>(null);
  const card = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => setPeek((event as CustomEvent<Peek>).detail);
    window.addEventListener(PEEK_OPEN, onOpen);
    return () => window.removeEventListener(PEEK_OPEN, onOpen);
  }, []);

  useEffect(() => {
    if (!peek) return;
    const close = () => setPeek(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    // Нажатие мимо — закрыть. Своё нажатие, открывшее окошко, сюда уже не
    // попадает: слушатель ставится после него.
    const onDown = (event: PointerEvent) => {
      if (!card.current?.contains(event.target as Node)) close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    // Окошко стоит у кнопки, а кнопка уехала вместе со страницей.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [peek]);

  // Под кнопкой, по её середине, но не за краем окна; не влезает снизу — над ней.
  const left = peek ? Math.min(Math.max(peek.x - WIDTH / 2, MARGIN), window.innerWidth - WIDTH - MARGIN) : 0;
  const below = peek ? peek.y + 8 : 0;
  const top = peek && below + 170 > window.innerHeight ? Math.max(MARGIN, peek.y - 210) : below;

  return (
    <AnimatePresence>
      {peek ? (
        <motion.div
          key={`${peek.name}-${peek.x}-${peek.y}`}
          ref={card}
          role="dialog"
          aria-label={peek.name}
          className="block-card fixed z-[70] flex flex-col gap-3 p-4"
          style={{ left, top, width: WIDTH }}
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-3">
            <MemberAvatar preset={peek.avatarPreset} displayName={peek.name} className="h-12 w-12" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight text-ink">{peek.name}</p>
              {peek.handle ? <p className="truncate text-sm text-ink-muted">@{peek.handle}</p> : null}
            </div>
          </div>
          <p className="ps-label">{t('soon')}</p>
          <p className="text-sm leading-relaxed text-ink-muted">{t('soonHint')}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
