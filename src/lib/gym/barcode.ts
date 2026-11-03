import 'server-only';

import type { Kind, Letter } from './grade';

/**
 * Продукт по штрихкоду — из Open Food Facts, открытой базы упаковок. Ключа не
 * нужно; ответ сутки лежит в кеше Next: состав пачки не меняется. Не нашлось,
 * нет калорий или база молчит — `null`, и человек пишет еду словами.
 *
 * Ходит сервер, а не браузер: в браузер чужие адреса не пускаем. Фото пачки —
 * тоже через нас, `/api/gym/pantry/photo`.
 *
 * С 1.54 кроме КБЖУ берётся то, из чего кладовка считает оценку (`grade.ts`):
 * Nutri-Score, который база посчитала с поправкой на категорию, группа
 * переработки NOVA и число добавок.
 */
export type Barcoded = {
  code: string;
  name: string;
  brand: string;
  /** Фото пачки в Open Food Facts, 200 px. В браузер — только через наш маршрут. */
  image: string | null;
  kind: Kind;
  /** На 100 г, у напитков — на 100 мл, как на этикетке. */
  per100: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber: number | null;
    sugar: number | null;
    satFat: number | null;
    salt: number | null;
  };
  /** Порция с упаковки, граммы — если указана. */
  serving: number | null;
  nutri: { grade: Letter; score: number } | null;
  nova: 1 | 2 | 3 | 4 | null;
  additives: number | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const FIELDS = [
  'product_name',
  'product_name_de',
  'product_name_fr',
  'product_name_en',
  'brands',
  'nutriments',
  'serving_quantity',
  'product_quantity_unit',
  'nutriscore_grade',
  'nutriscore_score',
  'nutriscore_data',
  'nova_group',
  'additives_n',
  'image_front_small_url'
].join(',');

export async function productByBarcode(code: string): Promise<Barcoded | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, {
      headers: { 'user-agent': 'Podshar/1.0 (private site; www.podshar.ch)' },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    const p = data.product;
    if (data.status !== 1 || !p) return null;
    const n = (p.nutriments ?? {}) as Record<string, unknown>;
    // Калорий нет — бывают только килоджоули: 1 ккал = 4,184 кДж.
    const kj = num(n['energy_100g']);
    const kcal = num(n['energy-kcal_100g']) ?? (kj === null ? null : Math.round(kj / 4.184));
    if (kcal === null) return null;
    const name = [p.product_name, p.product_name_de, p.product_name_fr, p.product_name_en].find((x): x is string => typeof x === 'string' && x.trim() !== '')?.trim() ?? code;
    const brand = typeof p.brands === 'string' ? p.brands.split(',')[0].trim() : '';

    // Категория для порогов Nutri-Score: база знает её точно, иначе — по «мл» на пачке.
    const flags = (p.nutriscore_data ?? {}) as Record<string, unknown>;
    const kind = flags.is_water ? 'water' : flags.is_beverage ? 'drink' : flags.is_fat_oil_nuts_seeds ? 'fat' : p.product_quantity_unit === 'ml' ? 'drink' : 'food';
    const grade = typeof p.nutriscore_grade === 'string' && /^[a-e]$/.test(p.nutriscore_grade) ? (p.nutriscore_grade as Letter) : null;
    const score = typeof p.nutriscore_score === 'number' ? p.nutriscore_score : null;
    const nova = typeof p.nova_group === 'number' && [1, 2, 3, 4].includes(p.nova_group) ? (p.nova_group as 1 | 2 | 3 | 4) : null;
    const image = typeof p.image_front_small_url === 'string' && p.image_front_small_url.startsWith('https://images.openfoodfacts.org/') ? p.image_front_small_url : null;

    return {
      code,
      name: name.toLowerCase().slice(0, 80),
      brand: brand.toLowerCase().slice(0, 40),
      image,
      kind,
      per100: {
        kcal,
        protein: num(n.proteins_100g) ?? 0,
        fat: num(n.fat_100g) ?? 0,
        carbs: num(n.carbohydrates_100g) ?? 0,
        fiber: num(n.fiber_100g),
        sugar: num(n.sugars_100g),
        satFat: num(n['saturated-fat_100g']),
        salt: num(n.salt_100g)
      },
      serving: num(p.serving_quantity),
      nutri: grade && score !== null ? { grade, score } : null,
      nova,
      additives: num(p.additives_n)
    };
  } catch (error) {
    console.warn('[podshar] open food facts:', error instanceof Error ? error.message : error);
    return null;
  }
}
