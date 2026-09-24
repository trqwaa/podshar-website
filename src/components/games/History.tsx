import { getTranslations } from 'next-intl/server';

import { BrawlerIcon, Delta, HeroIcon, Pct, ResultChip } from '@/components/games/bits';
import { modeName } from '@/components/games/format';
import type { Locale } from '@/i18n/routing';
import { brawler, dotaHero } from '@/lib/game-catalog';
import { totals, type BoardMatch } from '@/lib/games-board';

/**
 * Нижняя часть боковой колонки: как ты играешь прямо сейчас.
 *
 * Колонка справа была короче списка слева втрое, и под ней стояла пустота. Сюда
 * пошло то, что полезно именно для апа, а не для красоты: форма за последние
 * десять игр, неделя одной строкой, и то, где ты сливаешь — режим в бравле,
 * герой в доте.
 */
export async function History({
  game,
  recent,
  matches,
  locale
}: {
  game: 'DOTA2' | 'BRAWL_STARS';
  /**
   * Последние игры вообще, как бы давно они ни были. Форма берётся отсюда, а не
   * из недели: у того, кто неделю не играл, последние десять игр всё равно есть.
   */
  recent: BoardMatch[];
  /** За последние семь дней, свежее первым. */
  matches: BoardMatch[];
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: 'gamesBoard' });
  const spoken = {
    WIN: t('result.WIN'),
    LOSS: t('result.LOSS'),
    DRAW: t('result.DRAW')
  };
  const letter = (r: BoardMatch['result']) =>
    r === 'WIN' ? t('win') : r === 'LOSS' ? t('loss') : t('draw');
  const icon = (m: BoardMatch, size: number) =>
    game === 'DOTA2' ? (
      <HeroIcon hero={dotaHero(Number(m.character))} size={size} />
    ) : (
      <BrawlerIcon brawler={brawler(Number(m.character))} size={size} />
    );
  const name = (character: string | null) =>
    game === 'DOTA2' ? dotaHero(Number(character)).name : brawler(Number(character)).name;

  const week = totals(matches, game);
  const unit = (n: number) => (game === 'DOTA2' ? t('mmr') : t('trophiesUnit', { n }));

  // По режимам в бравле, по героям в доте — где именно уходят очки.
  const groups = new Map<string, BoardMatch[]>();
  for (const m of matches) {
    const key = game === 'DOTA2' ? (m.character ?? '') : String(m.payload.mode ?? '');
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const breakdown = [...groups]
    .map(([key, list]) => ({
      key,
      list,
      wins: list.filter((m) => m.result === 'WIN').length
    }))
    .filter((g) => g.list.length >= 2)
    .sort((a, b) => b.list.length - a.list.length)
    .slice(0, 4);

  return (
    <>
      {recent.length ? (
        <Block title={t('form')}>
          <ul className="flex flex-wrap gap-1.5">
            {recent.slice(0, 10).map((m) => (
              <li
                key={m.id}
                title={name(m.character)}
                className="flex items-center gap-1 rounded-sm bg-sunk p-1"
              >
                {icon(m, 22)}
                <ResultChip
                  result={m.result}
                  letter={letter(m.result)}
                  spoken={`${name(m.character)}: ${spoken[m.result]}`}
                />
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      <Block title={t('week')}>
        {matches.length === 0 ? (
          <p className="text-base text-ink-faint">{t('weekNone')}</p>
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-2 text-xl">
            <span className="font-semibold tabular-nums text-ink">
              {week.wins}–{week.losses}
            </span>
            {week.wins + week.losses ? (
              <Pct
                locale={locale}
                value={week.wins / (week.wins + week.losses)}
                className="text-base"
              />
            ) : null}
            {week.delta !== null ? (
              <span className="text-base">
                <Delta value={week.delta} estimated={week.estimated} />{' '}
                <span className="text-ink-muted">{unit(Math.abs(week.delta))}</span>
              </span>
            ) : null}
          </p>
        )}
        {game === 'DOTA2' && week.rankedWins + week.rankedLosses > 0 ? (
          <p className="ps-label mt-1">
            {t('rankedShort')}: {week.rankedWins}–{week.rankedLosses}
          </p>
        ) : null}
      </Block>

      {breakdown.length ? (
        <Block title={game === 'DOTA2' ? t('weekHeroes') : t('byMode')}>
          <ul className="flex flex-col">
            {breakdown.map((g, i) => (
              <li key={g.key} className={`flex items-center gap-3 py-2 ${i > 0 ? 'ps-rule' : ''}`}>
                {game === 'DOTA2' ? icon(g.list[0], 24) : null}
                <span
                  className={`min-w-0 flex-1 truncate text-base text-ink ${game === 'DOTA2' ? 'font-medium normal-case' : ''}`}
                >
                  {game === 'DOTA2' ? name(g.key) : modeName(g.key)}
                </span>
                <span className="text-sm tabular-nums text-ink-muted">
                  {g.wins}–{g.list.length - g.wins}
                </span>
                <Pct
                  locale={locale}
                  value={g.wins / g.list.length}
                  className="w-14 text-right text-sm"
                />
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ps-rule flex flex-col gap-2 pt-4">
      <p className="ps-label">{title}</p>
      {children}
    </div>
  );
}
