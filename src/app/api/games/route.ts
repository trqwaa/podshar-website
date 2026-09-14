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
 */
export async function GET() {
  if (!authConfigured()) return NextResponse.json({ dota: null });

  let userId: string | null = null;
  if (!guestModeAllowed()) {
    const session = await readSession().catch(() => null);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    userId = session.userId;
  }
  if (!userId) return NextResponse.json({ dota: null });

  try {
    // Аккаунт не привязан — это не сбой, а самый обычный случай: так выглядит
    // человек, который в доту не играет. Плитка скажет это словами.
    const { player, linked } = await currentDota(userId);
    return NextResponse.json({ dota: player, linked });
  } catch (error) {
    console.warn('[podshar] games: could not read stats:', error);
    return NextResponse.json({ dota: null, linked: true });
  }
}
