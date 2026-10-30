import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/routing';
import { FoodDiary } from '@/components/gym/FoodDiary';
import { GymHeader } from '@/components/gym/GymHeader';
import { PugFace } from '@/components/gym/PugFace';
import { dayKey, shiftDay } from '@/lib/calendar/scales';
import { sharedDayIndex } from '@/lib/day';
import { GymDoors } from '@/components/gym/GymDoors';
import { gymContext } from '@/lib/gym/context';
import { foodDayFace } from '@/lib/gym/critic';
import { foodDay, foodTotals, gymProfile, recentFoods } from '@/lib/gym/data';
import { DEFAULTS, targetsFor } from '@/lib/gym/norms';
import { resolveLocale } from '@/lib/locale';
import { moodAt } from '@/lib/sun';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'gym' });
  return { title: `${t('menu.food')} · ${t('title')}` };
}

/**
 * Питание: дневник одного дня. День — в адресе (`?day=`), как у календаря:
 * вчерашний ужин можно дописать утром, и ссылка на «смотри, что он ел в
 * пятницу» открывает пятницу.
 */
export default async function FoodPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ who?: string; day?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'gym' });
  const { session, members, member, mine } = await gymContext(query.who);

  const now = new Date();
  const today = dayKey(now);
  const asked = query.day && /^\d{4}-\d{2}-\d{2}$/.test(query.day) && query.day <= today ? query.day : today;
  const day = asked;
  const id = member?.id ?? null;

  const [profile, entries, recent, week] = id
    ? await Promise.all([gymProfile(id, today), foodDay(id, day), mine ? recentFoods(id) : Promise.resolve([]), foodTotals(id, shiftDay(day, -6), day)])
    : [null, [], [], []];
  const targets = profile?.targets ?? targetsFor({ ...DEFAULTS, sex: 'male', activity: 'mid', goal: 'hypertrophy' });
  const totals = entries.reduce((s, e) => ({ kcal: s.kcal + e.kcal, protein: s.protein + e.protein }), { kcal: 0, protein: 0 });
  const reaction = foodDayFace(
    { kcal: totals.kcal, protein: totals.protein, entries: entries.length, junkNames: entries.filter((e) => e.junk).map((e) => e.name) },
    targets,
    profile?.goal ?? 'hypertrophy',
    locale,
    sharedDayIndex(now) + entries.length,
    day === today
  );

  const whoQuery = member && !mine ? { who: member.handle } : {};
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${day}T12:00:00Z`))
    .toLowerCase();
  const short = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(day, i - 6));
  const peak = Math.max(targets.kcal * 1.3, ...week.map((w) => w.kcal));

  return (
    <div className="grid grid-cols-1 content-start gap-3 p-3 sm:gap-4 sm:p-4">
      <GymHeader
        title={t('food.title')}
        hint={t('food.hint')}
        back={t('back')}
        path="/gym/food"
        members={members}
        memberId={id}
        selfId={session?.userId ?? null}
        labels={{
          who: t('who.label'),
          mine: t('who.mine'),
          avatar: t('avatar'),
          readOnly: !member ? t('who.guest') : mine ? null : t('food.readOnly'),
          extraQuery: day === today ? {} : { day }
        }}
      />

      <section className="block-card animate-rise-in grid grid-cols-1 gap-5 p-4 [animation-delay:60ms] sm:p-6 lg:grid-cols-[minmax(0,1fr),18rem]">
        <div className="min-w-0">
          <nav aria-label={t('food.pickDay')} className="mb-4 flex flex-wrap items-center gap-2">
            <Link href={{ pathname: '/gym/food', query: { ...whoQuery, day: shiftDay(day, -1) } }} className="ps-press rounded border-2 border-rule px-2.5 py-1 text-sm hover:border-ink" aria-label={t('food.prev')}>
              ←
            </Link>
            <span className="text-lg font-semibold text-ink">{dayLabel}</span>
            {day < today ? (
              <Link
                href={{ pathname: '/gym/food', query: { ...whoQuery, ...(shiftDay(day, 1) === today ? {} : { day: shiftDay(day, 1) }) } }}
                className="ps-press rounded border-2 border-rule px-2.5 py-1 text-sm hover:border-ink"
                aria-label={t('food.next')}
              >
                →
              </Link>
            ) : null}
            {day !== today ? (
              <Link href={{ pathname: '/gym/food', query: whoQuery }} className="ps-label hover:underline">
                {t('food.today')}
              </Link>
            ) : null}
          </nav>
          <FoodDiary key={`${id}-${day}`} day={day} entries={entries} targets={targets} recent={recent} editable={mine} />
        </div>

        <aside className="flex flex-col gap-4 lg:border-l-2 lg:border-rule-soft lg:pl-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <PugFace face={reaction.face} className="h-32 w-32" title={reaction.line} />
            <p className="rounded-[12px] border-2 border-ink px-3 py-2 text-sm font-semibold leading-snug text-ink">{reaction.line}</p>
          </div>
          <div>
            <p className="ps-label">{t('food.week')}</p>
            <ol className="mt-2 flex h-28 items-end gap-1.5" aria-label={t('food.week')}>
              {days.map((d) => {
                const w = week.find((x) => x.day === d);
                const height = w ? Math.max(4, Math.round((w.kcal / peak) * 100)) : 2;
                return (
                  <li key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <Link
                      href={{ pathname: '/gym/food', query: { ...whoQuery, ...(d === today ? {} : { day: d }) } }}
                      title={w ? `${Math.round(w.kcal)} ${t('food.kcal')}` : t('food.empty')}
                      className={`block w-full rounded-t-[4px] ${w?.junk ? 'bg-loss/70' : 'bg-accent/70'} ${d === day ? 'outline outline-2 outline-ink' : ''}`}
                      style={{ height: `${height}%` }}
                    />
                    <span className={`text-[0.65rem] ${d === day ? 'font-bold text-ink' : 'text-ink-muted'}`}>{short.format(new Date(`${d}T12:00:00Z`)).toLowerCase()}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-1 text-xs text-ink-muted">
              {t('food.norm')}: {targets.kcal} {t('food.kcal')}
            </p>
          </div>
        </aside>
      </section>
      <GymDoors
        current="food"
        query={whoQuery}
        mood={moodAt(Date.now())}
        words={{
          title: t('doors.title'),
          rooms: {
            training: { label: t('menu.training'), hint: t('menuHint.training') },
            food: { label: t('menu.food'), hint: t('menuHint.food') },
            sleep: { label: t('menu.sleep'), hint: t('menuHint.sleep') }
          }
        }}
      />
    </div>
  );
}
