'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth/session';

/**
 * Подключения из настроек (1.53): ключ для быстрой команды айфона, которая
 * каждое утро шлёт сон из «Здоровья», и подписка телефона на уведомления.
 *
 * **Без миграции** — в `countdowns`, как дни рождения: `sleep-token:<id>` —
 * SHA-256 ключа (сам ключ показывается один раз, как приглашение),
 * `push:<id>:<хеш адреса>` — подписка одного телефона. По строчке на человека
 * и на телефон: база от этого не пухнет. Удаляя человека, убери и их.
 */

const sha = (value: string) => createHash('sha256').update(value).digest('hex');

export async function createSleepToken(): Promise<{ token?: string; error?: string }> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };
  const token = randomBytes(24).toString('base64url');
  const key = `sleep-token:${session.userId}`;
  await prisma.countdown.upsert({
    where: { key },
    update: { label: sha(token), targetAt: new Date() },
    create: { key, label: sha(token), targetAt: new Date() }
  });
  revalidatePath('/[locale]/(app)/profile', 'page');
  return { token };
}

export async function revokeSleepToken(): Promise<{ ok?: boolean; error?: string }> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };
  await prisma.countdown.deleteMany({ where: { key: `sleep-token:${session.userId}` } });
  revalidatePath('/[locale]/(app)/profile', 'page');
  return { ok: true };
}

const Subscription = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(5).max(100) })
});

/** Больше пяти телефонов у одного человека — это мусор от переустановок. */
const MAX_DEVICES = 5;

export async function savePush(input: unknown): Promise<{ ok?: boolean; error?: string }> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };
  const parsed = Subscription.safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const prefix = `push:${session.userId}:`;
  const key = `${prefix}${sha(parsed.data.endpoint).slice(0, 16)}`;
  const mine = await prisma.countdown.findMany({ where: { key: { startsWith: prefix } }, orderBy: { targetAt: 'asc' }, select: { key: true } });
  const extra = mine.filter((row) => row.key !== key).slice(0, Math.max(0, mine.length - MAX_DEVICES + 1));
  await prisma.$transaction([
    prisma.countdown.deleteMany({ where: { key: { in: extra.map((row) => row.key) } } }),
    prisma.countdown.upsert({
      where: { key },
      update: { label: JSON.stringify(parsed.data), targetAt: new Date() },
      create: { key, label: JSON.stringify(parsed.data), targetAt: new Date() }
    })
  ]);
  return { ok: true };
}

export async function dropPush(input: unknown): Promise<{ ok?: boolean; error?: string }> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };
  const endpoint = z.string().url().max(1000).safeParse((input as { endpoint?: unknown })?.endpoint);
  if (!endpoint.success) return { error: 'invalid' };
  await prisma.countdown.deleteMany({ where: { key: `push:${session.userId}:${sha(endpoint.data).slice(0, 16)}` } });
  return { ok: true };
}
