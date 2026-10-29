import { initialOf, type GymMember, type GymWeek } from '@/lib/gym/data';

/**
 * Кто когда в зале — неделя столбиками: под днём буквы тех, у кого на доске в
 * этот день есть упражнения. Чтобы глянуть, кто идёт, а не спрашивать в
 * группе. Сегодня подсвечено; кто качается прямо сейчас — с зелёной точкой.
 *
 * Буквы, а не имена: семь столбиков должны влезть в телефон. Кто есть кто —
 * строкой под неделей.
 */
export function GymCrew({
  week,
  members,
  names,
  today,
  words
}: {
  week: GymWeek;
  members: GymMember[];
  names: string[];
  /** День недели сегодня: понедельник — 0. */
  today: number;
  words: { title: string; now: string | null; done: string | null };
}) {
  const named = (id: string) => members.find((m) => m.id === id)?.displayName ?? '?';
  return (
    <section className="rounded-[10px] border-2 border-rule-soft p-3 sm:p-4">
      <h2 className="ps-label">{words.title}</h2>
      <ol className="mt-2 grid grid-cols-7 gap-1">
        {names.map((day, i) => (
          <li key={day} aria-current={i === today ? 'date' : undefined} className={`flex min-w-0 flex-col items-center gap-1 rounded-[8px] py-1.5 ${i === today ? 'bg-sunk' : ''}`}>
            <span className={`text-xs font-semibold ${i === today ? 'text-ink' : 'text-ink-muted'}`}>{day}</span>
            {week.days[i].map((id) => (
              <span
                key={id}
                title={named(id)}
                className="relative grid h-6 w-6 place-items-center rounded-full border-2 border-ink text-[0.7rem] font-bold lowercase leading-none text-ink"
              >
                {initialOf(named(id))}
                {i === today && week.now.includes(id) ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-win" /> : null}
              </span>
            ))}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-ink-muted">{members.map((m) => `${initialOf(m.displayName)} — ${m.displayName}`).join(' · ')}</p>
      {words.now ? <p className="mt-1 text-sm font-medium text-win">{words.now}</p> : null}
      {words.done ? <p className="mt-1 text-sm text-ink">{words.done}</p> : null}
    </section>
  );
}
