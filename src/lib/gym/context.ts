import 'server-only';

import { readSession } from '@/lib/auth/session';
import { guestModeAllowed } from '@/lib/auth/config';
import { moodAt, type Mood } from '@/lib/sun';
import { gymMembers, pickMember } from './data';

/**
 * Кто смотрит и чей дневник открыт — одно и то же на каждой странице зала.
 *
 * `who` — хендл из адреса, как масштаб у календаря: ссылку на чужой дневник
 * можно кинуть в чат. Писать при этом можно только в свой: `mine` решает,
 * будут ли на странице поля ввода, а действия ещё раз проверяют сессию.
 */
export async function gymContext(who: string | undefined) {
  const session = guestModeAllowed() ? null : await readSession();
  const members = await gymMembers();
  const { member, mine } = pickMember(members, who, session?.userId ?? null);
  return { session, members, member, mine };
}

const MOODS: readonly Mood[] = ['day', 'dusk', 'night', 'blood'];

/**
 * Небо зала — у подвала и у дверей внизу страниц. В разработке оно задаётся
 * адресом (`?mood=blood`): кровавую луну иначе ждать до двух ночи. На проде —
 * только настоящее небо.
 */
export function gymMood(asked: string | undefined, at: number): Mood {
  return process.env.NODE_ENV === 'development' && MOODS.includes(asked as Mood) ? (asked as Mood) : moodAt(at);
}

/** Короткие дни недели на языке страницы, с понедельника, строчными. */
export function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  // 5 января 2026 — понедельник.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2026, 0, 5 + i))).toLowerCase().replace(/\.$/, ''));
}
