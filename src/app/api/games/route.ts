import { NextResponse } from 'next/server';

import { authConfigured, guestModeAllowed } from '@/lib/auth/config';
import { readSession } from '@/lib/auth/session';
import { currentBrawl, currentDota } from '@/lib/games';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Цифры из игр — для шторки, которая спрашивает их уже после загрузки страницы.
 *
 * Отдельным маршрутом, а не из рендера, по одной жёсткой причине: то, что
 * вызывается в `(app)/layout.tsx`, ждёт **каждая страница сайта**. Один
 * медленный ответ чужого сервиса означал бы, что вся главная висит из-за
 * плитки, лежащей в закрытой шторке. Здесь за ожидание платит только та
 * шторка, и только когда её открыли.
 *
 * Обе игры одним ответом. Открытие шторки — одно событие, и разбивать его на
 * два запроса значило бы удваивать и круги по сети, и поводы разъехаться.
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
  const nothing = { dota: null, dotaLinked: false, brawl: null, brawlLinked: false };
  if (!authConfigured()) return answer(nothing);

  let userId: string | null = null;
  if (!guestModeAllowed()) {
    const session = await readSession().catch(() => null);
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    userId = session.userId;
  }
  // Гость без базы: показывать нечего и привязывать некуда.
  if (!userId) return answer(nothing);

  try {
    // Параллельно: это два независимых чужих сервиса, и складывать их ожидания
    // одно за другим значило бы держать шторку вдвое дольше без всякой нужды.
    const [dota, brawl] = await Promise.all([currentDota(userId), currentBrawl(userId)]);
    return answer({
      dota: dota.player,
      dotaLinked: dota.linked,
      brawl: brawl.player,
      brawlLinked: brawl.linked
    });
  } catch (error) {
    // `linked: true` намеренно: аккаунты, скорее всего, на месте, сломались мы.
    // Сказать «привяжи аккаунт» тому, кто его уже привязал, — худший из ответов.
    console.warn('[podshar] games: could not read stats:', error);
    return answer({ dota: null, dotaLinked: true, brawl: null, brawlLinked: true });
  }
}

/** Свой у каждого и меняется — ни браузеру, ни прокси его держать не надо. */
function answer(body: {
  dota: unknown;
  dotaLinked: boolean;
  brawl: unknown;
  brawlLinked: boolean;
}) {
  return NextResponse.json(body, { headers: { 'cache-control': 'private, no-store' } });
}
