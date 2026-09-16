'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';

/**
 * Переключатель между общим списком и личным.
 *
 * Две ссылки, а не кнопка с состоянием: какой список открыт — это адрес, и
 * переход за другим списком всё равно идёт на сервер, потому что личный чужим
 * отдавать нельзя и фильтрует его база, а не браузер.
 */
export function ListSwitch({ shared }: { shared: boolean }) {
  const t = useTranslations('todos');

  return (
    <nav className="flex items-center gap-1" aria-label={t('whichList')}>
      {[
        { mine: false, label: t('shared') },
        { mine: true, label: t('mine') }
      ].map((option) => (
        <Link
          key={option.label}
          href={option.mine ? '/todos?list=mine' : '/todos'}
          aria-current={option.mine !== shared ? 'page' : undefined}
          className={`h-10 rounded border-2 px-4 text-base leading-[2.1] transition-colors duration-drape ease-drape ${
            option.mine !== shared
              ? 'border-ink bg-ink text-canvas'
              : 'border-rule text-ink-muted hover:bg-sunk hover:text-ink'
          }`}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
