import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { saveNightFor } from '@/lib/gym/diary';
import { nightFrom } from '@/lib/gym/sleep-phases';

export const runtime = 'nodejs';

/**
 * Сон с телефона (1.53). Быструю команду человек собирает сам по шагам из
 * настроек; каждое утро она шлёт сюда ночь с личным ключом в заголовке
 * `Authorization: Bearer …`.
 *
 * С 1.55 — образцами из «Здоровья» (`samples`: начало, конец, что это было),
 * и тогда в дневник ложатся фазы: глубокий и быстрый сон. Так приходят и часы
 * Fitbit — через приложение Google Health, которое пишет в «Здоровье»:
 * напрямую из Google сайт не читает, это проект в Google Cloud, а владелец
 * решил без него (3 ноября 2026). Старая команда с одними `start` и `end`
 * работает как раньше.
 *
 * Сессии здесь нет и быть не может — запрос делает телефон, а не браузер, —
 * поэтому кто это, решает ключ: в базе лежит только его SHA-256
 * (`lib/connections.ts`).
 */
const Sample = z.object({ start: z.string().max(40), end: z.string().max(40), value: z.union([z.string().max(60), z.number()]) });
const Body = z.union([
  z.object({ samples: z.array(Sample).min(1).max(600) }),
  z.object({ start: z.string().min(10).max(40), end: z.string().min(10).max(40) })
]);

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (token.length < 20) return NextResponse.json({ error: 'no key' }, { status: 401 });
  const row = await prisma.countdown.findFirst({
    where: { key: { startsWith: 'sleep-token:' }, label: createHash('sha256').update(token).digest('hex') },
    select: { key: true }
  });
  if (!row) return NextResponse.json({ error: 'wrong key' }, { status: 401 });

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'need samples, or start and end' }, { status: 400 });
  const night = nightFrom('samples' in body.data ? body.data.samples : [{ start: body.data.start, end: body.data.end, value: 'asleep' }]);
  if (!night) return NextResponse.json({ error: 'no sleep in samples' }, { status: 400 });

  const result = await saveNightFor(row.key.slice('sleep-token:'.length), night);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ ok: true, night: result.night, hours: Math.round(night.minutes / 6) / 10, deep: night.deep, rem: night.rem });
}
