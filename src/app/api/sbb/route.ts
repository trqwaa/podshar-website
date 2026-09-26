import { NextResponse } from 'next/server';

import { authConfigured, guestModeAllowed } from '@/lib/auth/config';
import { readSession } from '@/lib/auth/session';
import { searchStations } from '@/lib/sbb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Подсказки станций, пока человек печатает.
 *
 * Своим маршрутом, а не серверным действием: подсказка живёт ровно до
 * следующей нажатой буквы, и предыдущий запрос надо уметь бросить на полпути.
 * `fetch` с `AbortController` это умеет, серверное действие — нет, и без этого
 * ответы приходят не в том порядке, в каком их спрашивали: набрал «zür», потом
 * «zürich», а в списке осело то, что нашлось по трём буквам.
 *
 * Закрыт сессией, как `/api/games` и `/api/assistant`. У SBB потолок около
 * тысячи запросов в сутки на адрес, а подсказка дёргается на каждую букву:
 * открытый наружу, этот маршрут выжёг бы суточную норму за минуту, и поезда
 * пропали бы у всех троих. Падение `readSession` считается отсутствием сессии.
 *
 * Сами имена станций Next держит сутки (`STATION_TTL`), поэтому повторный
 * набор того же куска наружу не ходит вовсе.
 */
export async function POST(request: Request) {
  if (!authConfigured()) return answer([]);

  if (!guestModeAllowed()) {
    let signedIn = false;
    try {
      signedIn = Boolean(await readSession());
    } catch {
      signedIn = false;
    }
    if (!signedIn) return NextResponse.json({ error: 'signedOut' }, { status: 401 });
  }

  let query = '';
  try {
    const body = (await request.json()) as { q?: unknown };
    query = typeof body?.q === 'string' ? body.q : '';
  } catch {
    return answer([]);
  }

  try {
    return answer(await searchStations(query));
  } catch (error) {
    // Нет подсказок — это пустой список, а не пятисотка: человек всё ещё может
    // дописать название целиком, и ронять ему форму незачем.
    console.warn('[podshar] SBB не ответили на поиск станции:', error instanceof Error ? error.message : error);
    return answer([]);
  }
}

function answer(stations: { id: string; name: string }[]) {
  return NextResponse.json(
    { stations },
    { headers: { 'cache-control': 'private, no-store' } }
  );
}
