import { NextResponse, type NextRequest } from 'next/server';

import { guestModeAllowed } from '@/lib/auth/config';
import { readSession } from '@/lib/auth/session';
import { photoOf } from '@/lib/gym/pantry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Фото пачки из кладовки (1.54). Браузер в Open Food Facts не ходит: за
 * картинкой ходит сервер, по адресу из кладовки, а не из запроса (`photoOf`).
 * Браузер держит ответ месяц — сервер зовётся раз на продукт и телефон. В базу
 * фото не попадает, на диск тоже.
 *
 * Только JPEG, PNG и WebP: SVG с нашего адреса мог бы нести скрипт.
 *
 * Закрыт сессией, как остальные маршруты сайта.
 */
export async function GET(request: NextRequest) {
  if (!guestModeAllowed()) {
    const session = await readSession().catch(() => null);
    if (!session) return new NextResponse(null, { status: 401 });
  }
  const url = await photoOf(request.nextUrl.searchParams.get('code') ?? '').catch(() => null);
  if (!url) return new NextResponse(null, { status: 404 });
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Podshar/1.0 (private site; www.podshar.ch)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000)
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !res.body || !/^image\/(jpeg|png|webp)\b/.test(type)) return new NextResponse(null, { status: 404 });
    return new NextResponse(res.body, { headers: { 'content-type': type, 'cache-control': 'private, max-age=2592000, immutable' } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
