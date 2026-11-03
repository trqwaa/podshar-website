'use client';

import { useEffect, useRef, type ComponentProps } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { Link } from '@/i18n/routing';
import { TAB } from './styles';

type Href = ComponentProps<typeof Link>['href'];

/**
 * Вкладки зала — ссылки, а не состояние (`?tab=`, `?who=`): ссылку можно
 * кинуть в чат, и «назад» работает. Выбранную подсвечивает плашка, которая
 * переезжает от вкладки к вкладке. На телефоне ряд листается вбок, а не
 * переносится на вторую строку: две строки вкладок съедали пол-экрана.
 */
export function GymTabs({
  id,
  label,
  items
}: {
  /** Свой у каждого ряда: плашки двух рядов на одной странице не должны путаться. */
  id: string;
  label: string;
  /** Значок перед подписью (1.56) — у вкладок тренировки; «чей дневник» без них. */
  items: { key: string; href: Href; label: string; current: boolean; dot?: boolean; icon?: React.ReactNode }[];
}) {
  const still = useReducedMotion();
  const row = useRef<HTMLElement | null>(null);
  const current = items.find((item) => item.current)?.key;
  // Выбранная вкладка не должна стоять за краем ряда: на телефоне «цели и
  // замеры» открывались, а вкладку было не видно.
  useEffect(() => {
    const nav = row.current;
    const tab = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !tab) return;
    const box = nav.getBoundingClientRect();
    const at = tab.getBoundingClientRect();
    nav.scrollTo({ left: Math.max(0, nav.scrollLeft + at.left - box.left - (box.width - at.width) / 2), behavior: 'auto' });
  }, [current]);
  return (
    <nav ref={row} aria-label={label} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-1 rounded-full bg-sunk p-1">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.current ? 'page' : undefined}
            className={`${TAB} transition-colors ${item.current ? 'text-surface' : 'text-ink-muted hover:text-ink'}`}
          >
            {item.current ? (
              <motion.span
                layoutId={`gym-tab-${id}`}
                className="absolute inset-0 rounded-full bg-ink"
                transition={still ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 36 }}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              {item.icon}
              {item.label}
              {item.dot ? <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-win align-middle" /> : null}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
