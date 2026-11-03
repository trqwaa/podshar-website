import 'server-only';

import { z } from 'zod';

import { prisma } from '@/lib/db';
import type { GymResult } from './actions';
import { productByBarcode, type Barcoded } from './barcode';
import { Day, MEALS, addFoodsFor, refresh } from './diary';
import { gradeOf, type Grade } from './grade';

/**
 * Кладовка (1.54): всё, что человек пикнул сканером, — его маленький дневник
 * упаковок с фото, КБЖУ и оценкой. Оттуда продукт ложится в приём пищи одной
 * кнопкой; граммы — прошлого раза, порция с пачки или 100.
 *
 * **Без миграции** — в `countdowns`, как подписки на уведомления:
 * `pantry:<id>:<штрихкод>`, в `label` — продукт JSON-ом, в `targetAt` — когда
 * его трогали последний раз (пикнул или съел): по нему порядок и уборка. Сто
 * продуктов на человека, дальше старые уходят сами. Удаляя человека, убери и
 * их.
 *
 * Числа в дневник берутся отсюда, из базы: из браузера приходят только
 * штрихкод и граммы. Функции с `userId` — не в `'use server'`-файле, по той же
 * причине, что `diary.ts`.
 */

const MAX = 100;
const Code = z.string().regex(/^\d{8,14}$/);
const prefix = (userId: string) => `pantry:${userId}:`;

type Shelved = Barcoded & { grams?: number };
export type PantryItem = Shelved & { grade: Grade };

function parse(label: string): Shelved | null {
  try {
    const item = JSON.parse(label) as Shelved;
    return typeof item?.code === 'string' && item.per100 ? item : null;
  } catch {
    return null;
  }
}

const graded = (item: Shelved): PantryItem => ({ ...item, grade: gradeOf(item) });

/**
 * Название в дневнике — с маркой, если её нет в названии. Сверяется первое
 * слово марки: в базе она бывает юридическим именем, и «coca-cola original»
 * превращался в «coca-cola original, coca-cola services sa/nv».
 */
function dishName(item: Shelved): string {
  const word = item.brand.split(/\s+/)[0];
  return (word && !item.name.includes(word) ? `${item.name}, ${item.brand}` : item.name).slice(0, 80);
}

export async function pantryOf(userId: string): Promise<PantryItem[]> {
  const rows = await prisma.countdown.findMany({
    where: { key: { startsWith: prefix(userId) } },
    orderBy: { targetAt: 'desc' },
    take: MAX,
    select: { label: true }
  });
  return rows.flatMap((row) => {
    const item = parse(row.label);
    return item ? [graded(item)] : [];
  });
}

/** Пикнул — продукт на полку, или наверх, если уже лежал: граммы прошлого раза остаются. */
export async function shelveFor(userId: string, code: unknown): Promise<{ item?: PantryItem; error?: string }> {
  const parsed = Code.safeParse(code);
  if (!parsed.success) return { error: 'invalid' };
  const product = await productByBarcode(parsed.data);
  if (!product) return { error: 'barcodeUnknown' };

  const key = prefix(userId) + product.code;
  const before = await prisma.countdown.findUnique({ where: { key }, select: { label: true } });
  const grams = before ? parse(before.label)?.grams : undefined;
  const item: Shelved = grams ? { ...product, grams } : product;
  const label = JSON.stringify(item);
  const stale = await prisma.countdown.findMany({
    where: { key: { startsWith: prefix(userId), not: key } },
    orderBy: { targetAt: 'desc' },
    skip: MAX - 1,
    select: { id: true }
  });
  await prisma.$transaction([
    prisma.countdown.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } }),
    prisma.countdown.upsert({ where: { key }, update: { label, targetAt: new Date() }, create: { key, label, targetAt: new Date() } })
  ]);
  refresh();
  return { item: graded(item) };
}

const Eat = z.object({ code: Code, meal: z.enum(MEALS), day: Day, grams: z.coerce.number().positive().max(3000).optional() });

/** Из кладовки в приём пищи. Отдаёт номера записей — для «отменить». */
export async function eatFor(userId: string, input: unknown): Promise<GymResult & { ids?: string[]; kcal?: number }> {
  const parsed = Eat.safeParse(input);
  if (!parsed.success) return { error: 'invalid' };
  const { code, meal, day } = parsed.data;
  const key = prefix(userId) + code;
  const row = await prisma.countdown.findUnique({ where: { key }, select: { label: true } });
  const item = row ? parse(row.label) : null;
  if (!item) return { error: 'pantryGone' };

  const grams = Math.round(parsed.data.grams ?? item.grams ?? item.serving ?? 100);
  const k = grams / 100;
  const per = item.per100;
  const part = (v: number | null | undefined) => (v == null ? null : v * k);
  const saved = await addFoodsFor(userId, {
    day,
    meal,
    items: [
      {
        name: dishName(item),
        grams,
        kcal: per.kcal * k,
        protein: per.protein * k,
        fat: per.fat * k,
        carbs: per.carbs * k,
        fiber: part(per.fiber),
        sugar: part(per.sugar),
        satFat: part(per.satFat),
        // Соль на этикетке — натрий в дневнике: соль делить на 2,5, граммы в миллиграммы.
        sodium: per.salt == null ? null : Math.min(20_000, (per.salt / 2.5) * 1000 * k),
        // Цифры с этикетки, а не прикидка модели: без «≈».
        estimated: false
      }
    ]
  });
  if (!saved.ok) return saved;
  await prisma.countdown.update({ where: { key }, data: { label: JSON.stringify({ ...item, grams }), targetAt: new Date() } });
  return { ok: true, ids: saved.ids, kcal: Math.round(per.kcal * k) };
}

export async function unshelveFor(userId: string, code: unknown): Promise<GymResult> {
  const parsed = Code.safeParse(code);
  if (!parsed.success) return { error: 'invalid' };
  await prisma.countdown.deleteMany({ where: { key: prefix(userId) + parsed.data } });
  refresh();
  return { ok: true };
}

/**
 * Адрес фото пачки — из чьей-нибудь кладовки, а не из запроса: иначе маршрут
 * фото стал бы прокси куда угодно. Кладовки видят все трое, поэтому и фото —
 * из любой.
 */
export async function photoOf(code: string): Promise<string | null> {
  if (!Code.safeParse(code).success) return null;
  const row = await prisma.countdown.findFirst({ where: { key: { startsWith: 'pantry:', endsWith: `:${code}` } }, select: { label: true } });
  const image = row ? parse(row.label)?.image : null;
  return image && image.startsWith('https://images.openfoodfacts.org/') ? image : null;
}
