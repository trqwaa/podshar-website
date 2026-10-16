import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { authConfigured, guestModeAllowed } from '@/lib/auth/config';
import { readSession } from '@/lib/auth/session';
import { currentBrawl, currentDota } from '@/lib/games';

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
 * Страница зовёт это уже после отрисовки и по ответу перечитывает себя. Мету
 * бравла здесь больше не считаем: с 1.17 она приходит с SeeMeta готовой, см.
 * `lib/brawl-meta.ts`.
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

  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'private, no-store' } });
}
