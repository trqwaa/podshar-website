import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { authConfigured } from '@/lib/auth/config';
import { readSession } from '@/lib/auth/session';
import { newsFor } from '@/lib/news';
import { NewsPanel } from './NewsPanel';

/**
 * Новости на главной — серверная половина: достаёт ленту и календарь из базы и
 * отдаёт их `NewsPanel` готовыми строками.
 *
 * Стоит за `<Suspense>` с `NewsPending`: это запросы к базе, а не к чужому API,
 * но главная не должна ждать даже их — остальные плитки появляются сразу, а
 * эта доезжает в той же рамке, и ничего под ней не прыгает.
 */
export async function NewsTile({ locale, className = '' }: { locale: Locale; className?: string }) {
  // Кто смотрит — из сессии: от него зависит, что в ленте «чужое».
  const session = authConfigured() ? await readSession().catch(() => null) : null;
  const news = await newsFor({ userId: session?.userId ?? '', locale });
  return <NewsPanel news={news} className={className} />;
}

export async function NewsPending({ locale, className = '' }: { locale: Locale; className?: string }) {
  const t = await getTranslations({ locale, namespace: 'news' });
  return (
    <section className={`block-card flex flex-col gap-4 p-6 ${className}`}>
      <p className="ps-label flex h-5 items-center">{t('label')}</p>
      {/* Та же высота, что у ленты в `NewsPanel`, — ничего не прыгнет. */}
      <span className="flex h-80 flex-col gap-4 overflow-hidden md:h-72">
        <span className="block h-[4.75rem] shrink-0 animate-pulse rounded-block bg-sunk" />
        <span className="block h-10 shrink-0 animate-pulse rounded-sm bg-sunk" />
        <span className="block h-10 shrink-0 animate-pulse rounded-sm bg-sunk" />
        <span className="block h-10 shrink-0 animate-pulse rounded-sm bg-sunk" />
      </span>
    </section>
  );
}
