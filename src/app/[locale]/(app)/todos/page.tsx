import { getTranslations } from 'next-intl/server';

import { Board } from '@/components/todos/Board';
import { ListSwitch } from '@/components/todos/ListSwitch';
import { readSession } from '@/lib/auth/session';
import { boardNotes } from '@/lib/todos/board';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'todos' });
  return { title: t('title') };
}

/**
 * Доска задач: два списка на одном экране.
 *
 * Какой открыт — в адресной строке, как масштаб у календаря: ссылку можно
 * бросить в чат, «назад» работает, перезагрузка не теряет место. Личный лежит в
 * аккаунте, а не в браузере: выбор владельца, и он правильный — список, который
 * есть на ноуте и пропал на телефоне, перестают вести на второй день.
 */
export default async function TodosPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ list?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'todos' });

  const shared = query.list !== 'mine';
  const session = await readSession();
  const notes = session ? await boardNotes(session.userId, shared) : [];

  return (
    <div className="grid grid-cols-1 content-start gap-3 p-3 sm:gap-4 sm:p-4">
      <section className="block-card animate-rise-in flex flex-wrap items-end justify-between gap-4 px-6 py-6 sm:px-8">
        <div>
          <h1 className="text-2xl font-semibold leading-tight text-ink sm:text-3xl">
            {t('title')}
          </h1>
          <p className="ps-label">{shared ? t('hintShared') : t('hintMine')}</p>
        </div>
        <ListSwitch shared={shared} />
      </section>

      <section className="block-card animate-rise-in p-3 [animation-delay:60ms] sm:p-4">
        <Board notes={notes} shared={shared} canEdit={Boolean(session)} />
      </section>
    </div>
  );
}
