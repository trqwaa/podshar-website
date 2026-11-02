'use server';

import { z } from 'zod';

import { readSession } from '@/lib/auth/session';
import { routing } from '@/i18n/routing';
import { productByBarcode, type Barcoded } from './barcode';
import { Day, MEALS, addFoodsFor } from './diary';
import { estimateMeal, type MealItem } from './food-estimate';

/**
 * Еда через мопса — словами и по фото. Только для себя и с потолком: каждый
 * раз — платный вызов модели.
 *
 * Словами — сразу в дневник, по Enter: так попросил владелец, в зале некогда
 * подтверждать. Отменить можно одной кнопкой — ответ несёт номера записей.
 * Фото — с подтверждением: на снимке мопс ошибается чаще, лишнее снимается
 * галочкой до записи.
 *
 * Снимок нигде не остаётся: ни в базе, ни на диске. Он уходит модели и
 * забывается вместе с запросом; в дневник ложатся только продукты, граммы и
 * КБЖУ. База на троих — полгигабайта на всё.
 *
 * Потолок — в памяти процесса, а не в базе: на Vercel у каждого экземпляра
 * свой счётчик. Держит от двойного нажатия и от очереди подряд; честный
 * суточный лимит, если понадобится, — строкой в базе, как у разносов критика.
 */
const LIMITS = { photo: { cooldown: 8_000, cap: 40 }, text: { cooldown: 2_000, cap: 120 } };
const recent = new Map<string, number[]>();

function spend(userId: string, kind: keyof typeof LIMITS): string | null {
  const key = `${kind}:${userId}`;
  const now = Date.now();
  const mine = (recent.get(key) ?? []).filter((at) => now - at < 86_400_000);
  if (mine.length && now - mine[mine.length - 1] < LIMITS[kind].cooldown) return kind === 'photo' ? 'photoCooldown' : 'foodCooldown';
  if (mine.length >= LIMITS[kind].cap) return kind === 'photo' ? 'photoCap' : 'foodCap';
  recent.set(key, [...mine, now]);
  return null;
}

/** Фото до сжатия в браузере ~200 КБ; всё, что больше 2 МБ в base64, — не то, что мы отправляли. */
const MAX_BASE64 = 2_800_000;

export async function estimatePhoto(input: unknown): Promise<{ items?: MealItem[]; error?: string }> {
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
  const limited = spend(session.userId, 'photo');
  if (limited) return { error: limited };

  const { image, mediaType, locale } = parsed.data;
  const result = await estimateMeal({ image: { data: image, mediaType }, locale });
  // Ошибки фото — свои слова: «разносов хватит» у критика тут не к месту.
  return 'error' in result ? { error: result.error === 'noModel' ? 'photoNoModel' : result.error } : { items: result.items };
}

export type LoggedMeal = { ids?: string[]; items?: MealItem[]; error?: string };

/** «Два яйца и тост с маслом» — разобрать и сразу записать в приём пищи. */
export async function logMeal(input: unknown): Promise<LoggedMeal> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };
  const parsed = z
    .object({ text: z.string().trim().min(2).max(400), day: Day, meal: z.enum(MEALS), locale: z.enum(routing.locales) })
    .safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const limited = spend(session.userId, 'text');
  if (limited) return { error: limited };

  const { text, day, meal, locale } = parsed.data;
  const result = await estimateMeal({ text, locale });
  if ('error' in result) return { error: result.error === 'noModel' ? 'foodNoModel' : 'foodNotFood' };

  const saved = await addFoodsFor(session.userId, {
    day,
    meal,
    items: result.items.map((i) => ({
      name: i.name,
      grams: i.grams,
      kcal: i.kcal,
      protein: i.protein,
      fat: i.fat,
      carbs: i.carbs,
      fiber: i.fiber,
      sugar: i.sugar,
      junk: i.fast_food
    }))
  });
  return saved.ok ? { ids: saved.ids, items: result.items } : { error: saved.error };
}

/** Штрихкод с упаковки — продукт и КБЖУ на 100 г. Бесплатно: модель не зовётся. */
export async function lookupBarcode(input: unknown): Promise<{ product?: Barcoded; error?: string }> {
  const session = await readSession();
  if (!session) return { error: 'signedOut' };
  const code = z
    .string()
    .regex(/^\d{8,14}$/)
    .safeParse((input as { code?: unknown })?.code);
  if (!code.success) return { error: 'invalid' };
  const product = await productByBarcode(code.data);
  return product ? { product } : { error: 'barcodeUnknown' };
}
