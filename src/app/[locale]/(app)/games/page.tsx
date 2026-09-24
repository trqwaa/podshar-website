import { getTranslations } from 'next-intl/server';

import { ActionLink, Segmented } from '@/components/games/bits';
import { BrawlFull } from '@/components/games/BrawlFull';
import { Compare } from '@/components/games/Compare';
import { DotaFull, type Tab } from '@/components/games/DotaFull';
import { GamesSync } from '@/components/games/GamesSync';
import { Overview } from '@/components/games/Overview';
import { readSession } from '@/lib/auth/session';
import { authConfigured } from '@/lib/auth/config';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'gamesBoard' });
  return { title: t('title') };
}

type View = 'overview' | 'compare' | 'dota' | 'brawl';
const VIEWS: View[] = ['overview', 'compare', 'dota', 'brawl'];
const TABS: Tab[] = ['meta', 'shame', 'honour'];

/**
 * Доска игр: дота и бравл, свои и общие.
 *
 * Четыре вида, и все живут в адресе, как масштаб календаря: `?view=compare`,
 * `?view=dota&tab=shame`. Ссылку на позор можно кинуть в чат, и она откроется
 * позором, а не обзором.
 *
 * Страница рисуется из базы и из кеша сразу, а свежие матчи догоняет
 * `GamesSync` уже после отрисовки. Медленный OpenDota не держит здесь ничего,
 * кроме одного блока меты за `<Suspense>`.
 */
export default async function GamesPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; tab?: string; rank?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : 'overview';
  const tab: Tab = TABS.includes(query.tab as Tab) ? (query.tab as Tab) : 'meta';

  const [t, session] = await Promise.all([
    getTranslations({ locale, namespace: 'gamesBoard' }),
    authConfigured() ? readSession() : Promise.resolve(null)
  ]);
  const userId = session?.userId ?? '';

  return (
    <div className="grid grid-cols-1 content-start gap-3 p-3 sm:gap-4 sm:p-4">
      <section className="block-card animate-rise-in flex flex-wrap items-end justify-between gap-4 px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-2xl font-semibold leading-tight text-ink sm:text-3xl">
            {t('title')}
          </h1>
          {/* Отступ больше, чем у соседних страниц: здесь под заголовком ещё
              строка синхронизации, и вплотную всё слипалось в один абзац. */}
          <p className="ps-label mt-2">{t('hint')}</p>
          <GamesSync working={t('syncing')} done={t('synced')} />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Segmented
            fill
            label={t('navLabel')}
            items={VIEWS.map((v) => ({
              href: v === 'overview' ? '/games' : `/games?view=${v}`,
              text: t(`views.${v}`),
              active: v === view
            }))}
          />
        </div>
      </section>

      {view === 'overview' ? (
        <>
          <Overview locale={locale} userId={userId} />
          <div className="flex justify-center">
            <ActionLink href="/games?view=compare">{t('compareCta')}</ActionLink>
          </div>
        </>
      ) : view === 'compare' ? (
        <Compare locale={locale} userId={userId} />
      ) : view === 'dota' ? (
        <DotaFull locale={locale} userId={userId} tab={tab} rank={query.rank} />
      ) : (
        <BrawlFull locale={locale} userId={userId} tab={tab} />
      )}
    </div>
  );
}
