import 'server-only';

import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth/session';
import { authConfigured } from '@/lib/auth/config';
import type { MemberProfile } from '@/lib/types';

/**
 * Session and quick-stat accessors.
 *
 * These are the two seams the rest of the UI reads through, and they still are:
 * every caller above this file is unchanged from when both returned fixtures.
 *
 * The guest values are what a signed-out visitor gets, and also what renders
 * when there is no database configured at all. Note that this file does not
 * decide who may *see* the page — the layouts do — it only answers "who is
 * this", and "nobody" is a legitimate answer.
 */

const GUEST: MemberProfile = {
  displayName: 'Guest',
  handle: 'guest',
  avatarUrl: null
};

/**
 * Ники участников — подписи под патчами.
 *
 * В `lib/patches.ts` записан хендл, а не имя, и это не лень. Хендл — ключ: он
 * переживает переименование в профиле, а запись полугодовой давности не должна
 * ссылаться на имя, которого у человека уже нет.
 *
 * Берём всю таблицу, а не `where handle in`, и раскладываем по двум ключам —
 * хендлу и имени, оба в нижнем регистре. Причина не в красоте: первая версия
 * искала точное совпадение хендла и на проде молча не нашла ничего, а под
 * патчами остались `@one` и `@two`. Пользователей трое, потолок ставят
 * приглашения, так что запрос дешёвый, а совпадение теперь переживает и другой
 * регистр, и запись, где вместо хендла написали имя.
 *
 * Пустая карта — законный ответ: без базы в разработке её просто нет. А вот
 * «база есть, а автора в ней нет» — это не норма, и об этом пишется в лог:
 * молчаливое вырождение в `@хендл` выглядит как «фича не работает», и причину
 * из интерфейса не достать.
 */
export async function getMemberNames(handles: string[]): Promise<Record<string, string>> {
  if (!authConfigured() || handles.length === 0) return {};

  try {
    const users = await prisma.user.findMany({ select: { handle: true, displayName: true } });

    const names: Record<string, string> = {};
    for (const user of users) {
      names[user.handle.toLowerCase()] = user.displayName;
      names[user.displayName.toLowerCase()] = user.displayName;
    }

    const unknown = handles.filter((handle) => !names[handle.toLowerCase()]);
    if (unknown.length > 0) {
      console.warn(
        `[podshar] авторы патчей, которых нет в базе: ${unknown.join(', ')}. ` +
          `В базе есть: ${users.map((user) => `${user.handle} (${user.displayName})`).join(', ')}`
      );
    }

    return names;
  } catch (error) {
    // Подпись под патчем не стоит того, чтобы ронять страницу. Но и молчать
    // нельзя — иначе причина потеряна навсегда.
    console.warn('[podshar] не удалось прочитать имена участников:', error);
    return {};
  }
}

export async function getCurrentMember(): Promise<MemberProfile> {
  if (!authConfigured()) return GUEST;

  const session = await readSession();
  if (!session) return GUEST;

  const { user } = session;
  return {
    displayName: user.displayName,
    handle: user.handle,
    avatarPreset: user.avatarPreset,
    // Avatars arrive with the media pipeline; the column is a reference into
    // `media_assets`, not a URL, so resolving it is a separate join later.
    avatarUrl: null
  };
}
