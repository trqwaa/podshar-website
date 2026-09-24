import { NextResponse, after } from 'next/server';

import { prisma } from '@/lib/db';
import { authConfigured, guestModeAllowed } from '@/lib/auth/config';
import { readSession } from '@/lib/auth/session';
import { currentBrawl, currentDota } from '@/lib/games';
import { refreshBrawlMeta } from '@/lib/brawl-meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Освежить доску игр — всех троих, а не только того, кто её открыл.
 *
 * Сравнение показывает всех, значит и обновлять надо всех: иначе «кто сколько
 * сегодня поднял» было бы честным только про того, кто последним заходил в
 * шторку. Каждый аккаунт при этом ходит наружу не чаще раза в полчаса — это
 * решают `currentDota` и `currentBrawl` своими снимками, — так что три человека,
 * открывшие доску подряд, не утроят запросы к OpenDota.
 *
 * Страница зовёт это уже после отрисовки и по ответу перечитывает себя. Мета
 * бравла пересчитывается после ответа (`after`): это пятьдесят запросов к
 * Supercell, и ждать их тому, кто смотрит на доску, незачем.
 *
 * POST и закрыт сессией по той же причине, что `/api/games`: запрос пишет в
 * базу, а отвечает про людей, чьи это дела.
 */
export async function POST() {
  if (!authConfigured()) return NextResponse.json({ ok: false });
  if (!guestModeAllowed()) {
    const session = await readSession().catch(() => null);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  await Promise.all(
    users.map((u) =>
      Promise.all([currentDota(u.id), currentBrawl(u.id)]).catch((error) => {
        console.warn('[podshar] games sync:', error);
      })
    )
  );

  after(() =>
    refreshBrawlMeta().catch((error) => console.warn('[podshar] brawl meta refresh:', error))
  );

  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'private, no-store' } });
}
