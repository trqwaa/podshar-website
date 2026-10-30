import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/routing';
import { BodyPanel } from '@/components/gym/BodyPanel';
import { ExerciseLibrary, type RecordCard } from '@/components/gym/ExerciseLibrary';
import { GymCrew } from '@/components/gym/GymCrew';
import { GymHeader } from '@/components/gym/GymHeader';
import { History } from '@/components/gym/History';
import { PlanBoard } from '@/components/gym/PlanBoard';
import { Workout } from '@/components/gym/Workout';
import { TAB } from '@/components/gym/styles';
import { dayKey } from '@/lib/calendar/scales';
import { GymDoors } from '@/components/gym/GymDoors';
import { gymContext, gymMood, weekdayNames } from '@/lib/gym/context';
import { activeWorkout, bestLifts, goalsOf, gymProfile, gymWeek, measuresOf, planOf, previousSets, recentWorkouts, recordsOf, weekdayOf, type RecordSet } from '@/lib/gym/data';
import { pickLine } from '@/lib/gym/critic';
import { exerciseOf } from '@/lib/gym/exercises';
import { REST_SECONDS } from '@/lib/gym/norms';
import { birthdayOf } from '@/lib/birthdays';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'gym' });
  return { title: `${t('menu.training')} · ${t('title')}` };
}

const TABS = ['board', 'workout', 'history', 'body', 'library'] as const;
type Tab = (typeof TABS)[number];

/**
 * Качалка: доска с планом, тренировка, история, цели и замеры, упражнения.
 *
 * Вкладка — в адресе (`?tab=`), как масштаб календаря: ссылку можно кинуть,
 * «назад» работает. Идущая тренировка открывает вкладку тренировки сама —
 * зашёл посреди подхода, а тебе показывают доску, это мимо.
 */
export default async function TrainingPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ who?: string; tab?: string; mood?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'gym' });
  const { session, members, member, mine } = await gymContext(query.who);
  const today = dayKey(new Date());
  const id = member?.id ?? null;

  const active = id ? await activeWorkout(id) : null;
  const asked = TABS.includes(query.tab as Tab) ? (query.tab as Tab) : null;
  const tab: Tab = asked ?? (active ? 'workout' : 'board');

  const header = (
    <GymHeader
      title={t('menu.training')}
      hint={t('menuHint.training')}
      back={t('back')}
      path="/gym/training"
      members={members}
      memberId={id}
      selfId={session?.userId ?? null}
      labels={{
        who: t('who.label'),
        mine: t('who.mine'),
        avatar: t('avatar'),
        readOnly: !member ? t('who.guest') : mine ? null : t('who.readOnly', { name: member.displayName }),
        extraQuery: { tab }
      }}
    />
  );

  const whoQuery = member && !mine ? { who: member.handle } : {};
  const tabs = (
    <nav aria-label={t('menu.training')} className="flex flex-wrap gap-1">
      {TABS.map((name) => (
        <Link
          key={name}
          href={{ pathname: '/gym/training', query: { ...whoQuery, tab: name } }}
          aria-current={tab === name ? 'page' : undefined}
          className={`${TAB} ${
            tab === name ? 'border-ink bg-ink text-surface' : 'border-rule text-ink hover:border-ink'
          }`}
        >
          {t(`tabs.${name}`)}
          {name === 'workout' && active ? <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-win align-middle" /> : null}
        </Link>
      ))}
    </nav>
  );

  let body: React.ReactNode = null;
  if (tab === 'board') {
    const [plan, week] = await Promise.all([
      id ? planOf(id) : [],
      gymWeek(
        members.map((m) => m.id),
        today
      )
    ]);
    const nameList = (ids: string[]) => ids.map((x) => members.find((m) => m.id === x)?.displayName ?? '?').join(', ');
    body = (
      <>
        <GymCrew
          week={week}
          members={members}
          names={weekdayNames(locale)}
          today={weekdayOf(today)}
          words={{
            title: t('crew.title'),
            now: week.now.length ? t('crew.now', { names: nameList(week.now) }) : null,
            done: week.done.length ? t('crew.done', { names: nameList(week.done) }) : null
          }}
        />
        <PlanBoard days={plan} names={weekdayNames(locale)} today={weekdayOf(today)} editable={mine} />
      </>
    );
  }
  if (tab === 'workout') {
    const [plan, profile, best] = id ? await Promise.all([planOf(id), gymProfile(id, today), bestLifts(id)]) : [[], null, {}];
    const todayPlan = plan.find((d) => d.weekday === weekdayOf(today) && d.items.length > 0) ?? null;
    const exercises = [...new Set((active?.sets ?? []).map((s) => s.exercise))];
    const previous = id ? await previousSets(id, exercises) : {};
    body = (
      <Workout
        workout={active}
        previous={previous}
        best={Object.fromEntries(Object.entries(best).map(([k, v]) => [k, v.e1rm]))}
        restSeconds={REST_SECONDS[profile?.goal ?? 'hypertrophy']}
        todayPlan={
          todayPlan
            ? { title: todayPlan.title || (exerciseOf(todayPlan.items[0].exercise)?.name[locale] ?? ''), count: todayPlan.items.length }
            : null
        }
        editable={mine}
        discardLines={Array.from({ length: 6 }, (_, i) => pickLine('discardPug', locale, i))}
      />
    );
  }
  if (tab === 'history') {
    const workouts = id ? await recentWorkouts(id, 30) : [];
    body = <History workouts={workouts} editable={mine} />;
  }
  if (tab === 'body') {
    const [profile, goals, measures, best, birthday] = id
      ? await Promise.all([gymProfile(id, today), goalsOf(id), measuresOf(id), bestLifts(id), birthdayOf(id).catch(() => null)])
      : [null, [], {}, {}, null];
    if (profile) {
      body = (
        <BodyPanel
          profile={{ ...profile, ageFromBirthday: Boolean(birthday?.born) }}
          goals={goals}
          measures={measures}
          heaviest={Object.fromEntries(Object.entries(best).map(([k, v]) => [k, v.top]))}
          today={today}
          editable={mine}
        />
      );
    }
  }
  if (tab === 'library') {
    const records = id ? await recordsOf(id) : [];
    const kg = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const when = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zurich' });
    const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
    const unit = t('workout.kg');
    const lift = (s: RecordSet) => (s.weight ? `${kg.format(s.weight)} × ${s.reps ?? 0}` : `× ${s.reps ?? 0}`);
    const freshSince = Date.now() - 14 * 86_400_000;
    const cards: RecordCard[] = records.map((r) => {
      const lines: RecordCard['lines'] = [];
      let main: string;
      let badge: string;
      if (r.kind === 'weight' && r.e1rm !== null) {
        main = t('records.e1rm', { kg: kg.format(Math.round(r.e1rm * 2) / 2) });
        badge = lift(r.best);
        lines.push({ label: t('records.best'), value: lift(r.best) });
        if (r.heaviest && r.heaviest !== r.best) lines.push({ label: t('records.heaviest'), value: lift(r.heaviest) });
        if (r.volume) lines.push({ label: t('records.volume'), value: `${kg.format((r.volume.weight ?? 0) * (r.volume.reps ?? 0))} ${unit}` });
      } else if (r.kind === 'time') {
        main = clock(r.best.seconds ?? 0);
        badge = main;
      } else if (r.kind === 'cardio') {
        main = r.best.distance ? `${kg.format(r.best.distance)} ${t('workout.km')}` : clock(r.best.seconds ?? 0);
        badge = main;
        if (r.best.distance && r.best.seconds) lines.push({ label: t('workout.time'), value: clock(r.best.seconds) });
      } else {
        main = t('records.reps', { n: r.best.reps ?? 0 });
        badge = `× ${r.best.reps ?? 0}`;
        if (r.heaviest?.weight) lines.push({ label: t('records.heaviest'), value: `+${kg.format(r.heaviest.weight)} × ${r.heaviest.reps ?? 0}` });
      }
      return {
        exercise: r.exercise,
        name: exerciseOf(r.exercise)?.name[locale] ?? r.exercise,
        main,
        lines,
        when: when.format(r.best.at).toLowerCase(),
        fresh: r.best.at >= freshSince,
        sets: t('records.sets', { n: r.sets }),
        badge
      };
    });
    body = <ExerciseLibrary records={cards} />;
  }

  return (
    <div className="grid grid-cols-1 content-start gap-3 p-3 sm:gap-4 sm:p-4">
      {header}
      <section className="block-card animate-rise-in flex flex-col gap-4 p-3 [animation-delay:60ms] sm:p-6">
        {tabs}
        {body}
      </section>
      <GymDoors
        current="training"
        query={whoQuery}
        mood={gymMood(query.mood, Date.now())}
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
