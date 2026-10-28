'use server';

import { z } from 'zod';

import { readSession } from '@/lib/auth/session';
import { routing } from '@/i18n/routing';
import { estimateFromPhoto, type PhotoItem } from './food-photo';

/**
 * Прикинуть еду по фото. Только для себя и с потолком: каждый снимок — платный
 * вызов модели.
 *
 * Потолок — в памяти процесса, а не в базе: на Vercel у каждого экземпляра
 * свой счётчик, и это пробная версия. Держит от двойного нажатия и от очереди
 * снимков подряд; честный суточный лимит, если раздел приживётся, — строкой
 * в базе, как у разносов критика.
 */
const COOLDOWN_MS = 8_000;
const DAILY_CAP = 40;
const recent = new Map<string, number[]>();

/** Фото до сжатия в браузере ~200 КБ; всё, что больше 2 МБ в base64, — не то, что мы отправляли. */
const MAX_BASE64 = 2_800_000;

export async function estimateMeal(input: unknown): Promise<{ items?: PhotoItem[]; error?: string }> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };
  const parsed = z
    .object({
      image: z.string().min(100).max(MAX_BASE64).regex(/^[A-Za-z0-9+/=]+$/),
      mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      locale: z.enum(routing.locales)
    })
    .safeParse(input);
  if (!parsed.success) return { error: 'invalid' };

  const now = Date.now();
  const mine = (recent.get(session.userId) ?? []).filter((at) => now - at < 86_400_000);
  if (mine.length && now - mine[mine.length - 1] < COOLDOWN_MS) return { error: 'photoCooldown' };
  if (mine.length >= DAILY_CAP) return { error: 'photoCap' };
  recent.set(session.userId, [...mine, now]);

  const result = await estimateFromPhoto(parsed.data);
  // Ошибки фото — свои слова: «разносов хватит» у критика тут не к месту.
  return 'error' in result ? { error: result.error === 'noModel' ? 'photoNoModel' : result.error } : { items: result.items };
}
