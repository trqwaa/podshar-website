import { Link } from '@/i18n/routing';
import type { GymMember } from '@/lib/gym/data';
import { PugAvatar } from './PugAvatar';
import { TAB } from './styles';

/**
 * Шапка каждой страницы зала: аватар мопса-качка, название, назад в подвал и
 * чей дневник открыт. Переключатель — ссылки с `?who=`, а не состояние: так
 * чужой дневник открывается ссылкой из чата, и «назад» работает.
 */
export function GymHeader({
  title,
  hint,
  back,
  path,
  members,
  memberId,
  selfId,
  labels
}: {
  title: string;
  hint?: string | null;
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
          <h1 className="text-xl font-semibold leading-tight text-ink sm:text-3xl">{title}</h1>
          {hint ? <p className="mt-1 max-w-xl text-xs text-ink-muted sm:text-sm">{hint}</p> : null}
        </div>
      </div>

      {members.length > 1 ? (
        <nav aria-label={labels.who} className="flex flex-col items-start gap-1.5 sm:items-end">
          <span className="ps-label">{labels.who}</span>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const current = m.id === memberId;
              const self = m.id === selfId;
              return (
                <Link
                  key={m.id}
                  href={{ pathname: path, query: { ...(labels.extraQuery ?? {}), ...(self ? {} : { who: m.handle }) } }}
                  aria-current={current ? 'page' : undefined}
                  className={`${TAB} ${
                    current ? 'border-ink bg-ink text-surface' : 'border-rule text-ink hover:border-ink'
                  }`}
                >
                  {self ? labels.mine : m.displayName}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
      {labels.readOnly ? <p className="w-full rounded border-2 border-dashed border-rule px-3 py-2 text-sm text-ink-muted">{labels.readOnly}</p> : null}
    </section>
  );
}
