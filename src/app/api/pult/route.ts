import { NextResponse } from 'next/server';

import { guestModeAllowed } from '@/lib/auth/config';
import { readSession } from '@/lib/auth/session';
import { routing, type Locale } from '@/i18n/routing';
import { pultAnswers } from '@/lib/pult';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Живые ответы для пульта: по строке на раздел.
 *
 * Своим маршрутом, а не в разметке страницы: пульт открывается с любой
 * страницы, а ждать поезда и погоду при каждом её показе нельзя — «рендер не
 * ходит в чужой API». Браузер просит это заранее, когда курсор подбирается к
 * кнопке, и к нажатию всё уже лежит.
 *
 * Закрыт сессией, как остальные: здесь чужой календарь и чужая доска. Падение
 * `readSession` считается отсутствием сессии.
 */
export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get('locale');
  const locale: Locale = routing.locales.includes(asked as Locale) ? (asked as Locale) : routing.defaultLocale;

  let userId = '';
  let handle = 'guest';
  if (!guestModeAllowed()) {
    const session = await readSession().catch(() => null);
    if (!session) return NextResponse.json({ error: 'signedOut' }, { status: 401 });
    userId = session.userId;
    handle = session.user.handle;
  }

  const answers = await pultAnswers({ locale, userId, handle });
  return NextResponse.json({ answers }, { headers: { 'cache-control': 'private, no-store' } });
}
