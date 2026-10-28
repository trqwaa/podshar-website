import { NextResponse } from 'next/server';

import { guestModeAllowed } from '@/lib/auth/config';
import { readSession } from '@/lib/auth/session';
import { getWeather } from '@/lib/weather';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Погода для окошка в подвале зала: только небо — что там и как дует.
 *
 * Своим маршрутом, как у пульта: «рендер не ходит в чужой API», а погода —
 * чужой API. Подвал рисуется без неё, с ясным небом, и окно оживает, когда
 * ответ пришёл. Провайдер и так спрашивается раз в четверть часа на всех
 * (`getWeather`), так что лишнего похода наружу здесь нет.
 *
 * Закрыт сессией, как остальные маршруты сайта.
 */
export async function GET() {
  if (!guestModeAllowed()) {
    const session = await readSession().catch(() => null);
    if (!session) return NextResponse.json({ error: 'signedOut' }, { status: 401 });
  }
  const weather = await getWeather().catch(() => null);
  const sky = weather ? { condition: weather.condition, wind: weather.wind } : null;
  return NextResponse.json({ sky }, { headers: { 'cache-control': 'private, no-store' } });
}
