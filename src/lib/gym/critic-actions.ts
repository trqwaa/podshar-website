'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth/session';
import { dayKey } from '@/lib/calendar/scales';
import { sharedDayIndex } from '@/lib/day';
import { routing } from '@/i18n/routing';
import { verdictOf } from './critic';
import { modelVerdict } from './critic-model';
import { historyOf, recordsOf, type RecordSet } from './data';
import { dossierFor } from './dossier';
import { exerciseOf } from './exercises';
import type { GymResult } from './actions';

/** Не чаще одного разноса моделью в две минуты: кнопку жмут очередью, а платим за каждый. */
const COOLDOWN_MS = 2 * 60_000;
/** И не больше двадцати в сутки на человека — потолок, а не бюджет. */
const DAILY_CAP = 20;

/**
 * «Разнести по-взрослому». Только свой дневник: просить модель разнести
 * чужого — это потратить чужие деньги на чужое унижение, а сам он не просил.
 */
export async function askCritic(input: unknown): Promise<GymResult> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };
  const parsed = z.object({ locale: z.enum(routing.locales) }).safeParse(input);
  if (!parsed.success) return { error: 'invalid' };

  const userId = session.userId;
  const now = Date.now();
  const recent = await prisma.gymVerdict.findMany({
    where: { userId, createdAt: { gte: new Date(now - 86_400_000) } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });
  if (recent[0] && now - recent[0].createdAt.getTime() < COOLDOWN_MS) return { error: 'cooldown' };
  if (recent.length >= DAILY_CAP) return { error: 'dailyCap' };

  const today = dayKey(new Date(now));
  const [{ dossier }, records, logged] = await Promise.all([dossierFor(userId, today), recordsOf(userId), historyOf(userId)]);
  const verdict = verdictOf(dossier, parsed.data.locale, sharedDayIndex());
  // Лучшие подходы за всё время — коротко, по-английски: это данные для модели, а не текст для человека.
  const best = (s: RecordSet) => (s.weight ? `${s.weight} kg x ${s.reps ?? 0}` : s.reps ? `${s.reps} reps` : s.seconds ? `${s.seconds} s` : `${s.distance ?? 0} km`);
  const history = {
    ...logged,
    records: records.slice(0, 8).map((r) => ({
      exercise: exerciseOf(r.exercise)?.name.en ?? r.exercise,
      e1rm_kg: r.e1rm === null ? null : Math.round(r.e1rm),
      best: best(r.best),
      on: dayKey(new Date(r.best.at))
    }))
  };
  const text = await modelVerdict({ name: session.user.displayName, locale: parsed.data.locale, verdict, history });
  if (!text) return { error: 'noModel' };

  await prisma.gymVerdict.create({ data: { userId, locale: parsed.data.locale, text } });
  revalidatePath('/[locale]/(app)/gym', 'layout');
  return { ok: true };
}
