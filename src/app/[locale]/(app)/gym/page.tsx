import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/routing';
import { CriticCard } from '@/components/gym/CriticCard';
import { GymHeader } from '@/components/gym/GymHeader';
import { GymScene, type BoardRow, type Legend, type SceneLink } from '@/components/gym/GymScene';
import { dayKey } from '@/lib/calendar/scales';
import { sharedDayIndex } from '@/lib/day';
import { gymContext, weekdayNames } from '@/lib/gym/context';
import { pickLine, verdictOf, hoursOf, type Dossier } from '@/lib/gym/critic';
import { foodDay, latestVerdict, type PlanDayView, type WeekDigest } from '@/lib/gym/data';
import { dossierFor } from '@/lib/gym/dossier';
import { SHOWCASES, musclesOf, showcaseFor, type Showcase } from '@/lib/gym/exercises';
import { fridgeGroupOf, type FridgeGroup } from '@/lib/gym/foods';
import { DEFAULTS, targetsFor } from '@/lib/gym/norms';
import { resolveLocale } from '@/lib/locale';
import { moodAt } from '@/lib/sun';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'gym' });
  return { title: t('title') };
}

/** Зал славы слева направо: Ронни — первое место, Левроун — второе. */
const LEGENDS: Legend[] = ['ronnie', 'levrone', 'arnold', 'dorian', 'vlasov', 'alekseyev', 'kirpach'];

/** Пустое досье: гостевой режим разработки или человек без единой записи. */
function emptyDigest(today: string): WeekDigest {
  return { today, plan: [], todayPlan: null, active: null, workouts: [], food: [], sleep: [], weights: [] };
}

/**
 * Подвал — вход в зал.
 *
 * Сцена с мопсом, который делает упражнение дня по плану того, чей дневник
 * открыт; три предмета-ссылки; под ними — мопс-критик с приговором неделе.
 * Всё считает сервер: настроение неба по закату, упражнение дня, реплика —
 * в браузер уходит готовое.
 */
export default async function GymPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ who?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const { who } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'gym' });
  const { session, members, member, mine } = await gymContext(who);

  const now = new Date();
  const today = dayKey(now);
  const seed = sharedDayIndex(now);
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const score = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  const loaded = member ? await dossierFor(member.id, today) : null;
  const digest = loaded?.digest ?? emptyDigest(today);
  const dossier: Dossier = loaded?.dossier ?? {
    today,
    goal: 'hypertrophy',
    age: null,
    weightKg: null,
    targets: targetsFor({ ...DEFAULTS, sex: 'male', activity: 'mid', goal: 'hypertrophy' }),
    plan: [],
    workouts: [],
    food: [],
    junkNames: [],
    sleep: [],
    weights: []
  };
  const verdict = verdictOf(dossier, locale, seed);
  const [model, eatenToday] = member ? await Promise.all([latestVerdict(member.id, locale), foodDay(member.id, today)]) : [null, []];
  // У холодильника — то, что съедено сегодня: по группе на продукт, без повторов.
  const fridge = [...new Set(eatenToday.map((f) => fridgeGroupOf(f.food, f.name)).filter((g): g is FridgeGroup => g !== null))];

  // ── Упражнение дня ──
  const hasPlan = digest.plan.some((d) => d.items.length > 0);
  const showcase: Showcase | 'rest' = digest.todayPlan
    ? showcaseFor(digest.todayPlan.items.map((i) => i.exercise), seed)
    : hasPlan
      ? 'rest'
      : SHOWCASES[((seed % 3) + 3) % 3];
  const doneToday = digest.workouts.some((w) => w.finishedAt !== null && dayKey(new Date(w.finishedAt)) === today);
  const speechKey = doneToday
    ? 'sceneDone'
    : showcase === 'rest'
      ? 'sceneRest'
      : !hasPlan
        ? 'sceneNoPlan'
        : showcase === 'bench'
          ? 'sceneBench'
          : showcase === 'row'
            ? 'sceneRow'
            : 'sceneSquat';

  // ── Доска: семь дней с понедельника ──
  const titleOf = (day: PlanDayView | undefined) => {
    if (!day || day.items.length === 0) return t('restDay');
    if (day.title) return day.title;
    return musclesOf(day.items.map((i) => i.exercise)).map((m) => t(`muscles.${m}`)).join(' · ');
  };
  const names = weekdayNames(locale);
  const todayIndex = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const board: BoardRow[] = names.map((day, i) => ({
    day,
    title: titleOf(digest.plan.find((d) => d.weekday === i)),
    today: i === todayIndex
  }));

  // ── Живые строки у пунктов меню ──
  const doneSets = digest.active?.sets.filter((s) => s.done).length ?? 0;
  const trainingLine = digest.active
    ? t('lines.trainingActive', { n: doneSets })
    : digest.todayPlan && doneToday
      ? t('lines.trainingDone', { title: titleOf(digest.todayPlan) })
      : digest.todayPlan
        ? t('lines.trainingToday', { title: titleOf(digest.todayPlan) })
        : hasPlan
          ? t('lines.trainingRest')
          : t('lines.trainingNoPlan');
  const eaten = digest.food.find((f) => f.day === today);
  const foodLine = eaten
    ? t('lines.food', { kcal: num.format(eaten.kcal), target: num.format(dossier.targets.kcal), protein: num.format(eaten.protein) })
    : t('lines.foodEmpty');
  const night = digest.sleep.find((n) => n.night === today);
  const sleepLine = night ? t('lines.sleep', { hours: hoursOf(night.minutes, locale) }) : t('lines.sleepEmpty');
  const planDays = digest.plan.filter((d) => d.items.length > 0).length;
  const planLine = planDays ? t('lines.planWeek', { n: planDays }) : t('lines.trainingNoPlan');

  // Стойка ведёт сразу в тренировку — начать или продолжить, — а доска в план.
  const query = member && !mine ? { who: member.handle } : {};
  const links: SceneLink[] = [
    { kind: 'workout', href: { pathname: '/gym/training', query: { ...query, tab: 'workout' } }, label: t('menu.workout'), line: trainingLine },
    { kind: 'plan', href: { pathname: '/gym/training', query: { ...query, tab: 'board' } }, label: t('menu.plan'), line: planLine },
    { kind: 'food', href: { pathname: '/gym/food', query }, label: t('menu.food'), line: foodLine },
    { kind: 'sleep', href: { pathname: '/gym/sleep', query }, label: t('menu.sleep'), line: sleepLine }
  ];

  const plate = showcase === 'bench' ? 200 : showcase === 'row' ? 100 : 180;

  return (
    <div className="grid grid-cols-1 content-start gap-3 p-3 sm:gap-4 sm:p-4">
      <GymHeader
        title={t('title')}
        path="/gym"
        members={members}
        memberId={member?.id ?? null}
        selfId={session?.userId ?? null}
        labels={{
          who: t('who.label'),
          mine: t('who.mine'),
          avatar: t('avatar'),
          readOnly: !member ? t('who.guest') : mine ? null : t('who.readOnly', { name: member.displayName })
        }}
      />

      <section className="block-card animate-rise-in overflow-hidden p-2 [animation-delay:60ms] sm:p-3">
        <GymScene
          mood={moodAt(now.getTime())}
          showcase={showcase}
          board={board}
          goal={t('goalOn', { goal: t(`goals.${dossier.goal}`) })}
          links={links}
          speech={pickLine(speechKey, locale, seed)}
          pokes={Array.from({ length: 4 }, (_, i) => pickLine('scenePoke', locale, seed + i))}
          pugTitle={showcase === 'rest' ? t('pug.rest') : t(`pug.${showcase}`, { n: plate })}
          sceneLabel={t('sceneLabel')}
          food={fridge}
          legends={LEGENDS.map((id) => ({ id, name: t(`legends.${id}.name`), title: t(`legends.${id}.title`) }))}
        />
        {/* Те же четыре раздела списком: на телефоне сцена листается, а сюда
            попадаешь пальцем сразу. Два в ряд — строки не режутся до «ккал · бел…». */}
        <nav aria-label={t('title')} className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-3 sm:grid-cols-4 sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.kind}
              href={link.href}
              className="ps-press group flex min-w-0 flex-col gap-0.5 rounded-[10px] border-2 border-rule px-3 py-2.5 hover:border-ink sm:gap-1 sm:px-4 sm:py-3"
            >
              <span className="flex items-center justify-between gap-1">
                <span className="truncate text-base font-semibold lowercase text-ink sm:text-lg">{link.label}</span>
                <span aria-hidden="true" className="text-ink-faint transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
              <span className="hidden text-xs text-ink-muted sm:block">{t(`menuHint.${link.kind}`)}</span>
              {link.line ? <span className="line-clamp-2 text-xs font-medium leading-snug text-ink sm:text-sm">{link.line}</span> : null}
            </Link>
          ))}
        </nav>
      </section>

      <CriticCard
        verdict={verdict}
        mine={mine}
        model={model?.text ?? null}
        words={{
          title: t('critic.title'),
          hint: t('critic.hint'),
          areas: {
            food: t('critic.areas.food'),
            train: t('critic.areas.train'),
            sleep: t('critic.areas.sleep'),
            total: t('critic.areas.total')
          },
          noScore: t('critic.noScore'),
          advice: t('critic.advice'),
          supplements: t('critic.supplements'),
          take: t('critic.take'),
          skip: t('critic.skip'),
          disclaimer: t('critic.disclaimer'),
          onlyOwn: t('critic.onlyOwn'),
          modelSaid: model
            ? t('critic.modelSaid', {
                date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' }).format(model.at)
              })
            : null,
          score: (s) => t('critic.score', { score: score.format(s) })
        }}
      />
    </div>
  );
}
