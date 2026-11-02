import 'server-only';

/**
 * Продукт по штрихкоду — из Open Food Facts, открытой базы упаковок. Ключа не
 * нужно; ответ сутки лежит в кеше Next: состав пачки не меняется. Не нашлось,
 * нет калорий или база молчит — `null`, и человек пишет еду словами.
 *
 * Ходит сервер, а не браузер: в браузер чужие адреса не пускаем.
 */
export type Barcoded = {
  code: string;
  name: string;
  /** На 100 г, как на этикетке. */
  per100: { kcal: number; protein: number; fat: number; carbs: number; fiber: number | null; sugar: number | null };
  /** Порция с упаковки, граммы — если указана. */
  serving: number | null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function productByBarcode(code: string): Promise<Barcoded | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_de,product_name_fr,product_name_en,brands,nutriments,serving_quantity`,
      {
        headers: { 'user-agent': 'Podshar/1.0 (private site; www.podshar.ch)' },
        next: { revalidate: 86_400 },
        signal: AbortSignal.timeout(6000)
      }
    );
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
    const full = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name}, ${brand}` : name;
    return {
      code,
      name: full.toLowerCase().slice(0, 80),
      per100: {
        kcal,
        protein: num(n.proteins_100g) ?? 0,
        fat: num(n.fat_100g) ?? 0,
        carbs: num(n.carbohydrates_100g) ?? 0,
        fiber: num(n.fiber_100g),
        sugar: num(n.sugars_100g)
      },
      serving: num(p.serving_quantity)
    };
  } catch (error) {
    console.warn('[podshar] open food facts:', error instanceof Error ? error.message : error);
    return null;
  }
}
