import 'server-only';

import { column, parseCsv, parseDay, parseNumber } from './csv';

/**
 * Импорт дневника питания из FatSecret.
 *
 * В приложении: дневник питания → экспорт → CSV (на сайте — «печать» в
 * дневнике, тоже CSV). Описания колонок FatSecret нигде не публикует, и они
 * на языке приложения, поэтому колонки ищутся по смыслу заголовка на любом из
 * наших языков: дата, приём пищи, продукт, количество, ккал, белки, жиры,
 * углеводы и остальное, что FatSecret показывает (клетчатка, сахар, натрий…).
 *
 * Отчёт бывает плоский — дата в каждой строке — и сгруппированный: строка с
 * датой, под ней строки приёмов пищи, под ними продукты, в конце итоги. Дата и
 * приём пищи поэтому запоминаются и тянутся вниз, а строки итогов и
 * подытогов пропускаются. Если в выгрузке только итоги по дням (короткий
 * отчёт), день ложится одной записью «FatSecret».
 */

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type ImportedFood = {
  day: string;
  meal: Meal;
  name: string;
  grams: number | null;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
  sugar: number | null;
  satFat: number | null;
  sodium: number | null;
  cholesterol: number | null;
  potassium: number | null;
};

/** Два года дневника — около четырёх тысяч строк; больше за раз не берём. */
export const MAX_FOOD_ROWS = 6000;

const MEAL_OF: [RegExp, Meal][] = [
  [/^(breakfast|завтрак|сніданок|frühstück|fruehstueck)/i, 'breakfast'],
  [/^(lunch|обед|обід|mittag)/i, 'lunch'],
  [/^(dinner|supper|ужин|вечеря|abend)/i, 'dinner'],
  [/^(snack|other|перекус|другое|інше|zwischen|snacks|sonstiges)/i, 'snack']
];
const mealOf = (v: string | undefined): Meal | null => {
  const t = (v ?? '').trim();
  return MEAL_OF.find(([re]) => re.test(t))?.[1] ?? null;
};
const TOTAL = /^(total|totals|итог|итого|всего|разом|усього|всього|summe|gesamt|daily total)/i;

/** Граммы из «100 g», «250 г», «1 serving (240 g)»; порция без граммов — `null`. */
function gramsOf(v: string | undefined): number | null {
  // `\b` не видит границу после кириллицы — поэтому явный запрет буквы следом.
  const m = (v ?? '').match(/(\d+(?:[.,]\d+)?)\s*(g|г|гр|gram|грам)(?![a-zа-яё])/i);
  return m ? parseNumber(m[1]) : null;
}

export function parseFatsecretCsv(text: string): { foods: ImportedFood[]; format: boolean } {
  const rows = parseCsv(text);
  // Заголовок — первая строка, где есть калории и хотя бы ещё одно из БЖУ.
  const nutrient = (h: string) => /(cal|kcal|energ|калор|ккал|енерг|kalor|prot|бел|білк|eiwei|fat|жир|fett|carb|углев|вуглев|kohlenh)/i.test(h);
  const headAt = rows.slice(0, 30).findIndex((r) => r.filter(nutrient).length >= 2 && r.some((h) => /(cal|kcal|energ|калор|ккал|енерг|kalor)/i.test(h)));
  if (headAt < 0) return { foods: [], format: false };
  const header = rows[headAt].map((h) => h.toLowerCase());
  const col = {
    date: column(header, [/^(date|дата|datum)/, /(date|дата|datum)/]),
    meal: column(header, [/(meal|при[её]м|прийом|mahlzeit)/]),
    food: column(header, [/(food|item|name|description|продукт|еда|блюдо|назв|страв|lebensmittel|bezeichnung)/]),
    amount: column(header, [/(amount|quantity|qty|serving|колич|порц|кількість|menge|portion)/]),
    kcal: column(header, [/(kcal|ккал)/, /(cal|калор|kalor|energ|енерг)/], /(fat|жир|fett)/),
    fat: column(header, [/(fat|жир|fett)/], /(sat|насыщ|насич|gesätt|trans|cal|калор)/),
    carbs: column(header, [/(carb|углев|вуглев|kohlenh)/]),
    protein: column(header, [/(prot|белк|белок|білк|eiwei)/]),
    fiber: column(header, [/(fib|клетч|клітк|ballast)/]),
    sugar: column(header, [/(sugar|сахар|цукор|zucker)/]),
    satFat: column(header, [/(sat|насыщ|насич|gesätt)/]),
    sodium: column(header, [/(sodium|натри|натрі|natrium)/]),
    cholesterol: column(header, [/(chol|холест)/]),
    potassium: column(header, [/(potas|кали[йя]|калі[йю]|kalium)/])
  };
  if (col.kcal < 0) return { foods: [], format: false };

  const num = (row: string[], i: number) => (i >= 0 ? parseNumber(row[i]) : null);
  const items: ImportedFood[] = [];
  const totals = new Map<string, ImportedFood>();
  let day: string | null = null;
  let meal: Meal = 'snack';

  for (const row of rows.slice(headAt + 1)) {
    if (items.length >= MAX_FOOD_ROWS) break;
    const first = row.find((c) => c !== '') ?? '';
    // В сгруппированном отчёте первая колонка — то дата, то приём пищи, то
    // продукт; своей колонки продукта там нет.
    const fromCol = col.date >= 0 ? parseDay(row[col.date]) : null;
    const rowDay = fromCol ?? parseDay(first);
    const named = col.food >= 0 ? row[col.food] ?? '' : rowDay ? '' : first;
    if (rowDay) day = rowDay;
    const rowMeal = mealOf(col.meal >= 0 ? row[col.meal] : '') ?? mealOf(named);
    if (rowMeal) meal = rowMeal;
    const kcal = num(row, col.kcal);
    if (!day || kcal === null) continue;

    const base = {
      day,
      meal,
      kcal: Math.round(kcal),
      protein: num(row, col.protein) ?? 0,
      fat: num(row, col.fat) ?? 0,
      carbs: num(row, col.carbs) ?? 0,
      fiber: num(row, col.fiber),
      sugar: num(row, col.sugar),
      satFat: num(row, col.satFat),
      sodium: num(row, col.sodium),
      cholesterol: num(row, col.cholesterol),
      potassium: num(row, col.potassium)
    };
    const name = named.trim();
    // Итог дня — запомнить на случай, если продуктов в выгрузке нет вовсе.
    if (TOTAL.test(first) || TOTAL.test(name) || (rowDay && (!name || parseDay(name)))) {
      totals.set(day, { ...base, meal: 'snack', name: 'FatSecret', grams: null });
      continue;
    }
    // Подытог приёма пищи или строка без названия — не продукт.
    if (!name || mealOf(name) || parseDay(name)) continue;
    items.push({ ...base, name: name.slice(0, 80), grams: gramsOf(col.amount >= 0 ? row[col.amount] : name) });
  }

  const withItems = new Set(items.map((f) => f.day));
  const foods = [...items, ...[...totals.values()].filter((t) => !withItems.has(t.day))];
  return { foods, format: true };
}
