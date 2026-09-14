import { NextResponse } from 'next/server';

import { authConfigured, guestModeAllowed } from '@/lib/auth/config';
import { readSession } from '@/lib/auth/session';
import { currentDota } from '@/lib/games';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Цифры из игр — для шторки, которая спрашивает их уже после загрузки страницы.
 *
 * Отдельным маршрутом, а не в `getQuickStats`, по одной жёсткой причине:
 * `getQuickStats` вызывается в `(app)/layout.tsx`, то есть его ждёт **каждая
 * страница сайта**. Один медленный ответ OpenDota означал бы, что вся главная
 * висит из-за плитки, лежащей в закрытой шторке. Здесь же за ожидание платит
 * только та шторка, и только когда её открыли.
 *
 * Закрыт сессией, как `/api/assistant` и `/api/presence`: отвечает он про
 * конкретного человека, и падение `readSession` считается отсутствием сессии —
 * сломанная база должна закрывать дверь, а не открывать.
 *
 * POST, а не GET, по двум причинам сразу, и первая уже успела укусить. Ответ
 * здесь у каждого свой и меняется — а GET браузеру разрешено запомнить, и он
 * запомнил: аккаунт привязали, а шторка ещё долго показывала «привязать
 * аккаунт», потому что отдавала сохранённый ответ, полученный до привязки. И
 * вторая: этот запрос **пишет** — он сохраняет снимок, когда сходил за свежим.
 * GET по всем правилам обязан быть безобидным. `/api/presence` POST ровно
 * поэтому же.
 *
 * `linked` возвращается из каждой ветки, даже когда и так понятно. Без него
 * поле приезжает `undefined`, на той стороне это ложь, и «не привязан» тогда
 * значит то же, что «мы не смогли посмотреть».
 */
export async function POST() {
  if (!authConfigured()) return answer({ dota: null, linked: false });

  let userId: string | null = null;
  if (!guestModeAllowed()) {
    const session = await readSession().catch(() => null);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    userId = session.userId;
  }
  // Гость без базы: показывать нечего и привязывать некуда.
  if (!userId) return answer({ dota: null, linked: false });

  try {
    // Аккаунт не привязан — это не сбой, а самый обычный случай: так выглядит
    // человек, который в доту не играет. Плитка скажет это словами.
    const { player, linked } = await currentDota(userId);
    return answer({ dota: player, linked });
  } catch (error) {
    // `linked: true` намеренно: аккаунт, скорее всего, на месте, сломались мы.
    // Сказать «привяжи аккаунт» тому, кто его уже привязал, — худший из ответов.
    console.warn('[podshar] games: could not read stats:', error);
    return answer({ dota: null, linked: true });
  }
}

/** Свой у каждого и меняется — ни браузеру, ни прокси его держать не надо. */
function answer(body: { dota: unknown; linked: boolean }) {
  return NextResponse.json(body, {
    headers: { 'cache-control': 'private, no-store' }
  });
}
