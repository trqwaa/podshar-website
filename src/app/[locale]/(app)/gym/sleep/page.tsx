import { getTranslations } from 'next-intl/server';

import { GymHeader } from '@/components/gym/GymHeader';
import { PugFace } from '@/components/gym/PugFace';
import { SleepChart, SleepLog } from '@/components/gym/SleepLog';
import { dayKey, shiftDay } from '@/lib/calendar/scales';
import { sharedDayIndex } from '@/lib/day';
import { GymDoors } from '@/components/gym/GymDoors';
import { gymContext } from '@/lib/gym/context';
import { hoursOf, nightFace } from '@/lib/gym/critic';
import { gymProfile, sleepRange } from '@/lib/gym/data';
import { DEFAULTS, sleepNormFor } from '@/lib/gym/norms';
import { resolveLocale } from '@/lib/locale';
import { moodAt } from '@/lib/sun';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'gym' });
  return { title: `${t('menu.sleep')} · ${t('title')}` };
}

/**
 * Сон: последняя ночь глазами мопса, две недели столбиками, запись ночи и
 * импорт файла. Внизу — честно, что с часами можно сделать сейчас и что потом.
 */
export default async function SleepPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ who?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'gym' });
  const { session, members, member, mine } = await gymContext(query.who);

  const now = new Date();
  const today = dayKey(now);
  const id = member?.id ?? null;
  const whoQuery = member && !mine ? { who: member.handle } : {};
  const from = shiftDay(today, -13);
  const [profile, nights] = id ? await Promise.all([gymProfile(id, today), sleepRange(id, from, today)]) : [null, []];
  const age = profile?.age ?? DEFAULTS.age;
  const norm = sleepNormFor(age);
  const last = nights[0] ?? null;
  const fresh = last && last.night >= shiftDay(today, -1) ? last : null;
  const reaction = nightFace(fresh?.minutes ?? null, age, locale, sharedDayIndex(now));
  const week = nights.filter((n) => n.night > shiftDay(today, -7));
  const avg = week.length ? week.reduce((s, n) => s + n.minutes, 0) / week.length : null;
  const days = Array.from({ length: 14 }, (_, i) => shiftDay(today, i - 13));

  return (
    <div className="grid grid-cols-1 content-start gap-3 p-3 sm:gap-4 sm:p-4">
      <GymHeader
        title={t('sleep.title')}
        hint={t('sleep.hint')}
        back={t('back')}
        path="/gym/sleep"
        members={members}
        memberId={id}
        selfId={session?.userId ?? null}
        labels={{
          who: t('who.label'),
          mine: t('who.mine'),
          avatar: t('avatar'),
          readOnly: !member ? t('who.guest') : mine ? null : t('sleep.readOnly')
        }}
      />

      <section className="block-card animate-rise-in grid grid-cols-1 gap-5 p-4 [animation-delay:60ms] sm:p-6 lg:grid-cols-[18rem,minmax(0,1fr)]">
        <aside className="flex flex-col items-center gap-2 text-center lg:border-r-2 lg:border-rule-soft lg:pr-5">
          <PugFace face={reaction.face} className="h-36 w-36" title={reaction.line} />
          <p className="rounded-[12px] border-2 border-ink px-3 py-2 text-sm font-semibold leading-snug text-ink">{reaction.line}</p>
          <p className="text-sm text-ink-muted">{t('sleep.norm', { age, low: norm.low, high: norm.high })}</p>
          {avg !== null ? <p className="text-sm font-semibold text-ink">{t('sleep.avg', { hours: hoursOf(avg, locale) })}</p> : null}
        </aside>
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <p className="ps-label mb-2">{t('sleep.week')}</p>
            <SleepChart nights={nights} days={days} norm={norm} locale={locale} />
          </div>
          <SleepLog nights={nights} today={today} editable={mine} />
        </div>
      </section>

      <section className="block-card animate-rise-in p-4 [animation-delay:120ms] sm:p-6">
        <h2 className="text-lg font-semibold text-ink">{t('sleep.connect.title')}</h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm leading-snug text-ink">
          <li>
            <span className="ps-label mr-2">zepp life</span>
            {t('sleep.connect.zepp')}
          </li>
          <li>
            <span className="ps-label mr-2">iphone</span>
            {t('sleep.connect.apple')}
          </li>
          <li>
            <span className="ps-label mr-2">android</span>
            {t('sleep.connect.android')}
          </li>
        </ul>
      </section>
      <GymDoors
        current="sleep"
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
