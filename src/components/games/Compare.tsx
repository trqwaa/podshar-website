import { getTranslations } from 'next-intl/server';

import { BrawlerIcon, Delta, HeroIcon, ResultChip } from '@/components/games/bits';
import { Medal } from '@/components/games/Overview';
import { MemberAvatar } from '@/components/profile/MemberAvatar';
import type { Locale } from '@/i18n/routing';
import { brawler, dotaHero } from '@/lib/game-catalog';
import { compareToday, type MemberDay } from '@/lib/games-board';

/**
 * Сравнение: все трое, обе игры, только сегодня.
 *
 * Вопрос тут один — «кто сколько за сегодня поднял или слил», — поэтому сверху
 * ответ на него одной строкой на игру, а ниже по каждому человеку его день
 * целиком: какие матчи, на ком, чем кончились. Не привязал аккаунт — строка так
 * и говорит, без пустых нулей, которые читались бы как «играл и ничего не
 * добился».
 */
export async function Compare({ locale, userId }: { locale: Locale; userId: string }) {
  const [t, { members }] = await Promise.all([
    getTranslations({ locale, namespace: 'gamesBoard' }),
    compareToday(userId)
  ]);

  // Лидер и аутсайдер дня — отдельно по каждой игре: складывать птс доты с
  // кубками бравла значит сравнивать метры с килограммами.
  const verdict = (pick: (m: MemberDay) => number | null) => {
    const played = members.map((m) => ({ m, v: pick(m) })).filter((x): x is { m: MemberDay; v: number } => x.v !== null);
    if (!played.length) return null;
    const sorted = [...played].sort((a, b) => b.v - a.v);
    return { best: sorted[0], worst: sorted.length > 1 ? sorted[sorted.length - 1] : null };
  };
  const dota = verdict((m) => (m.dota.totals.wins + m.dota.totals.losses ? m.dota.totals.delta ?? 0 : null));
  const brawl = verdict((m) => (m.brawl.totals.wins + m.brawl.totals.losses ? m.brawl.totals.delta ?? 0 : null));

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4">
      <section className="block-card animate-rise-in flex flex-col gap-4 p-6 [animation-delay:60ms]">
        <div>
          <h2 className="text-xl font-semibold leading-tight text-ink">{t('compareTitle')}</h2>
          <p className="ps-label mt-1">{t('compareHint')}</p>
        </div>

        {!dota && !brawl ? (
          <p className="text-base text-ink-muted">{t('nobodyPlayed')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: t('views.dota'), v: dota, unit: t('mmr'), estimated: true },
              { label: t('views.brawl'), v: brawl, unit: t('trophies'), estimated: false }
            ].map((g) =>
              g.v ? (
                <div key={g.label} className="rounded-sm bg-sunk px-4 py-3">
                  <p className="ps-label">{g.label}</p>
                  <p className="mt-1 text-base text-ink">
                    {/* «Тащит» — только если правда в плюсе. Когда в минусе все,
                        лучший из них не тащит, а слил меньше остальных. */}
                    <span className="text-ink-muted">{g.v.best.v > 0 ? t('leader') : t('leastBad')}: </span>
                    <span className="font-semibold normal-case">{g.v.best.m.displayName}</span>{' '}
                    <Delta value={g.v.best.v} estimated={g.estimated} /> <span className="text-ink-muted">{g.unit}</span>
                  </p>
                  {g.v.worst && g.v.worst.v < g.v.best.v ? (
                    <p className="text-base text-ink">
                      <span className="text-ink-muted">{g.v.worst.v < 0 ? t('loser') : t('leastGood')}: </span>
                      <span className="font-semibold normal-case">{g.v.worst.m.displayName}</span>{' '}
                      <Delta value={g.v.worst.v} estimated={g.estimated} /> <span className="text-ink-muted">{g.unit}</span>
                    </p>
                  ) : null}
                </div>
              ) : null
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        {members.map((m, i) => (
          <section
            key={m.handle}
            className="block-card animate-rise-in flex flex-col gap-4 p-6"
            style={{ animationDelay: `${120 + i * 60}ms` }}
          >
            <header className="flex items-center gap-3">
              <MemberAvatar preset={m.avatarPreset} displayName={m.displayName} className="h-10 w-10" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold normal-case leading-tight text-ink">{m.displayName}</p>
                <p className="ps-label">{m.me ? t('you') : `@${m.handle}`}</p>
              </div>
            </header>

            <DayBlock
              label={t('views.dota')}
              linked={m.dota.linked}
              notLinked={t('othersNotLinked')}
              none={t('todayNone')}
              unit={t('mmr')}
              day={m.dota.totals}
              badge={m.dota.profile?.medal ? <Medal medal={m.dota.profile.medal} stars={m.dota.profile.stars} size={32} /> : null}
              chips={m.dota.today.map((x) => ({
                id: x.id,
                result: x.result,
                icon: <HeroIcon hero={dotaHero(Number(x.character))} size={24} />,
                title: dotaHero(Number(x.character)).name
              }))}
              letters={[t('win'), t('loss'), t('draw')]}
            />

            <DayBlock
              label={t('views.brawl')}
              linked={m.brawl.linked}
              notLinked={t('othersNotLinked')}
              none={t('todayNone')}
              unit={t('trophies')}
              day={m.brawl.totals}
              badge={
                m.brawl.profile ? (
                  <span className="text-sm tabular-nums text-ink-muted">{t('trophiesNow', { trophies: m.brawl.profile.trophies })}</span>
                ) : null
              }
              chips={m.brawl.today.map((x) => ({
                id: x.id,
                result: x.result,
                icon: <BrawlerIcon brawler={brawler(Number(x.character))} size={24} />,
                title: brawler(Number(x.character)).name
              }))}
              letters={[t('win'), t('loss'), t('draw')]}
            />
          </section>
        ))}
      </div>

      <p className="ps-label px-2">{t('estimated')}</p>
    </div>
  );
}

function DayBlock({
  label,
  linked,
  notLinked,
  none,
  unit,
  day,
  badge,
  chips,
  letters
}: {
  label: string;
  linked: boolean;
  notLinked: string;
  none: string;
  unit: string;
  day: MemberDay['dota']['totals'];
  badge: React.ReactNode;
  chips: { id: string; result: 'WIN' | 'LOSS' | 'DRAW'; icon: React.ReactNode; title: string }[];
  letters: [string, string, string];
}) {
  const played = day.wins + day.losses;
  return (
    <div className="ps-rule flex flex-col gap-2 pt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="ps-label">{label}</p>
        {badge}
      </div>
      {!linked ? (
        <p className="text-base text-ink-faint">{notLinked}</p>
      ) : !played ? (
        <p className="text-base text-ink-faint">{none}</p>
      ) : (
        <>
          <p className="flex items-baseline gap-2 text-xl">
            <span className="font-semibold tabular-nums text-ink">
              {day.wins}–{day.losses}
            </span>
            {day.delta !== null ? (
              <span className="text-base">
                <Delta value={day.delta} estimated={day.estimated} /> <span className="text-ink-muted">{unit}</span>
              </span>
            ) : null}
          </p>
          {/* Сегодняшние игры рядком: на ком и чем кончилось. Свежая — слева. */}
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <li key={c.id} title={c.title} className="flex items-center gap-1 rounded-sm bg-sunk p-1">
                {c.icon}
                <ResultChip result={c.result} letter={c.result === 'WIN' ? letters[0] : c.result === 'LOSS' ? letters[1] : letters[2]} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
