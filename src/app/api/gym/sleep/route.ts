import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { saveNightFor } from '@/lib/gym/diary';
import { nightsFrom, samplesFrom, samplesFromLists } from '@/lib/gym/sleep-phases';

export const runtime = 'nodejs';

/**
 * Сон с телефона (1.53). Быструю команду человек собирает сам по шагам из
 * настроек; каждое утро она шлёт сюда ночь с личным ключом в заголовке
 * `Authorization: Bearer …`.
 *
 * С 1.55 — образцами из «Здоровья» (`samples`: начало, конец, что это было),
 * и тогда в дневник ложатся фазы: глубокий и быстрый сон. Образцы — за три
 * дня, и сохраняется каждая ночь в них: половинка ночи, пойманная ночным
 * запуском, перезаписывается целой следующим. Так приходят и часы
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
const Samples = z.array(Sample).min(1).max(600);

/**
 * Три вида тела: три списка (`starts`, `ends`, `values` — команда без
 * повтора, так в шагах с 1.55A), словари (`samples` — команда с повтором)
 * и одна ночь (`start`, `end` — команда из 1.53).
 */
function samplesOf(body: unknown): unknown {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if ('starts' in b) return samplesFromLists(b.starts, b.ends, b.values);
  if ('samples' in b) return samplesFrom(b.samples);
  if (typeof b.start === 'string' && typeof b.end === 'string') return [{ start: b.start, end: b.end, value: 'asleep' }];
  return null;
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (token.length < 20) return NextResponse.json({ error: 'no key' }, { status: 401 });
  const row = await prisma.countdown.findFirst({
    where: { key: { startsWith: 'sleep-token:' }, label: createHash('sha256').update(token).digest('hex') },
    select: { key: true }
  });
  if (!row) return NextResponse.json({ error: 'wrong key' }, { status: 401 });

  const samples = Samples.safeParse(samplesOf(await request.json().catch(() => null)));
  if (!samples.success) return NextResponse.json({ error: 'need starts, ends and values of the same length' }, { status: 400 });
  const nights = nightsFrom(samples.data);
  if (!nights.length) return NextResponse.json({ error: 'no sleep in samples' }, { status: 400 });

  const userId = row.key.slice('sleep-token:'.length);
  const saved: { night: string; hours: number; deep: number | null; rem: number | null }[] = [];
  const manual: string[] = [];
  for (const night of nights) {
    const result = await saveNightFor(userId, night);
    if (result.ok && result.night && result.skipped) manual.push(result.night);
    else if (result.ok && result.night) saved.push({ night: result.night, hours: Math.round(night.minutes / 6) / 10, deep: night.deep, rem: night.rem });
  }
  if (!saved.length && !manual.length) return NextResponse.json({ error: 'range' }, { status: 422 });
  // Сверху — последняя ночь, как отвечал старый вид; все — в `nights`; вписанные руками — в `manual`.
  return NextResponse.json({ ok: true, ...saved[saved.length - 1], nights: saved, manual });
}
