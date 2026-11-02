import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { ZONE } from '@/lib/calendar/scales';
import { addSleepFor } from '@/lib/gym/diary';

export const runtime = 'nodejs';

/**
 * Сон из «Здоровья» айфона (1.53). Быструю команду человек собирает сам по
 * шагам из настроек; каждое утро она шлёт сюда начало и конец ночи (ISO 8601)
 * с личным ключом в заголовке `Authorization: Bearer …`.
 *
 * Сессии здесь нет и быть не может — запрос делает телефон, а не браузер, —
 * поэтому кто это, решает ключ: в базе лежит только его SHA-256
 * (`lib/connections.ts`). Записывает через `addSleepFor`, как ручной ввод:
 * ночь — по дате подъёма в Цюрихе, вторая запись за ту же ночь заменяет первую.
 */
const Body = z.object({ start: z.string().min(10).max(40), end: z.string().min(10).max(40) });

const zurich = (at: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, clock: `${get('hour')}:${get('minute')}` };
};

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (token.length < 20) return NextResponse.json({ error: 'no key' }, { status: 401 });
  const row = await prisma.countdown.findFirst({
    where: { key: { startsWith: 'sleep-token:' }, label: createHash('sha256').update(token).digest('hex') },
    select: { key: true }
  });
  if (!row) return NextResponse.json({ error: 'wrong key' }, { status: 401 });

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'need start and end' }, { status: 400 });
  const start = new Date(body.data.start);
  const end = new Date(body.data.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'bad dates' }, { status: 400 });
  }

  const bed = zurich(start);
  const wake = zurich(end);
  const result = await addSleepFor(row.key.slice('sleep-token:'.length), { night: wake.day, bed: bed.clock, wake: wake.clock });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ ok: true, night: wake.day, hours: Math.round((result.minutes ?? 0) / 6) / 10 });
}
