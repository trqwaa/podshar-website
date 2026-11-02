import { Link } from '@/i18n/routing';
import type { GymMember } from '@/lib/gym/data';
import { GymTabs } from './GymTabs';
import { PugAvatar } from './PugAvatar';

/**
 * Шапка каждой страницы зала: аватар мопса-качка, название, назад в подвал и
 * чей дневник открыт. Переключатель — ссылки с `?who=`, а не состояние: так
 * чужой дневник открывается ссылкой из чата, и «назад» работает.
 *
 * С 1.52 без подписи под названием: «качалка», «питание», «сон» говорят сами
 * за себя, а строка пояснений на телефоне отодвигала дневник за экран.
 */
export function GymHeader({
  title,
  back,
  path,
  members,
  memberId,
  selfId,
  labels
}: {
  title: string;
  /** Подпись ссылки назад в подвал; нет — это и есть подвал. */
  back?: string | null;
  path: '/gym' | '/gym/training' | '/gym/food' | '/gym/sleep';
  members: GymMember[];
  memberId: string | null;
  selfId: string | null;
  labels: { who: string; mine: string; avatar: string; readOnly: string | null; extraQuery?: Record<string, string> };
}) {
  return (
    <section className="block-card animate-rise-in flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-7 sm:py-5">
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-rule bg-sunk sm:h-20 sm:w-20">
          <PugAvatar className="h-full w-full translate-y-[6%] scale-110" title={labels.avatar} />
        </span>
        <div className="min-w-0">
          {back ? (
            <Link href="/gym" className="ps-label underline-offset-4 hover:underline">
              ← {back}
            </Link>
          ) : null}
          <h1 className="text-2xl font-semibold leading-tight text-ink sm:text-3xl">{title}</h1>
        </div>
      </div>

      {members.length > 1 ? (
        <div className="flex min-w-0 max-w-full flex-col items-start gap-1.5 sm:items-end">
          <span className="ps-label">{labels.who}</span>
          <GymTabs
            id="who"
            label={labels.who}
            items={[...members]
              // Свой — первым: его открывают чаще всего, и на телефоне он виден без прокрутки ряда.
              .sort((a, b) => Number(b.id === selfId) - Number(a.id === selfId))
              .map((m) => ({
                key: m.id,
                href: { pathname: path, query: { ...(labels.extraQuery ?? {}), ...(m.id === selfId ? {} : { who: m.handle }) } },
                label: m.id === selfId ? labels.mine : m.displayName,
                current: m.id === memberId
              }))}
          />
        </div>
      ) : null}
      {labels.readOnly ? (
        <p className="flex w-full items-center gap-2 rounded-full bg-sunk px-3.5 py-2 text-sm text-ink-muted">
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" />
            <circle cx="8" cy="8" r="2" />
          </svg>
          {labels.readOnly}
        </p>
      ) : null}
    </section>
  );
}
