import type { Locale } from '@/i18n/routing';

import type { Words } from './exercises';

/**
 * Справочник еды для дневника питания — как в FatSecret, только свой и короткий.
 *
 * Значения на 100 г (напитки — на 100 мл, это одно и то же с точностью, до
 * которой кто-то взвешивает колу). Цифры — средние по открытым таблицам
 * (USDA, таблицы состава российских продуктов, сайты сетей фастфуда), а не
 * этикетка конкретного магазина: дневник — для того, чтобы видеть порядок
 * величин, а не третий знак.
 *
 * `quality` — то, на что смотрит лицо мопса: `junk` — фастфуд, сладкая вода,
 * алкоголь и прочее, от чего ему плохо; `meh` — терпимо, но гордиться нечем.
 *
 * Своя еда, которой здесь нет, вводится руками; её «качество» угадывает
 * `junkByName` по названию.
 */

export type Quality = 'clean' | 'meh' | 'junk';

/** Порция, которую предлагает форма. Название — ключ `gym.food.unit.*` в каталогах. */
export type Unit = 'piece' | 'can' | 'pack' | 'slice' | 'scoop' | 'tbsp' | 'bowl' | 'serving' | 'bottle' | 'glass';

export type Food = {
  id: string;
  name: Words;
  /** На 100 г: ккал, белки, жиры, углеводы. */
  per100: { kcal: number; p: number; f: number; c: number };
  portion: { unit: Unit; grams: number };
  quality: Quality;
};

const food = (
  id: string,
  [ru, en, uk, de]: [string, string, string, string],
  [kcal, p, f, c]: [number, number, number, number],
  [unit, grams]: [Unit, number],
  quality: Quality = 'clean'
): Food => ({ id, name: { ru, en, uk, de }, per100: { kcal, p, f, c }, portion: { unit, grams }, quality });

export const FOODS: Food[] = [
  // Белок
  food('chicken-breast', ['куриная грудка, готовая', 'chicken breast, cooked', 'куряча грудка, готова', 'hähnchenbrust, gegart'], [165, 31, 3.6, 0], ['serving', 150]),
  food('beef-steak', ['говяжий стейк', 'beef steak', 'яловичий стейк', 'rindersteak'], [250, 26, 17, 0], ['serving', 200]),
  food('ground-beef', ['фарш говяжий, жареный', 'ground beef, cooked', 'фарш яловичий, смажений', 'rinderhack, gebraten'], [250, 26, 15, 0], ['serving', 150]),
  food('pork', ['свинина, запечённая', 'pork, roasted', 'свинина, запечена', 'schweinefleisch, gebraten'], [242, 27, 14, 0], ['serving', 150]),
  food('salmon', ['лосось, запечённый', 'salmon, baked', 'лосось, запечений', 'lachs, gebacken'], [206, 22, 12, 0], ['serving', 150]),
  food('tuna', ['тунец консервированный', 'canned tuna', 'тунець консервований', 'thunfisch aus der dose'], [116, 26, 1, 0], ['can', 140]),
  food('eggs', ['яйцо куриное', 'egg', 'яйце куряче', 'ei'], [143, 12.6, 9.5, 0.7], ['piece', 55]),
  food('egg-whites', ['яичные белки', 'egg whites', 'яєчні білки', 'eiklar'], [52, 11, 0.2, 0.7], ['glass', 200]),
  food('cottage-cheese', ['творог 5%', 'cottage cheese 5%', 'сир кисломолочний 5%', 'hüttenkäse / quark 5%'], [121, 17, 5, 1.8], ['pack', 200]),
  food('skyr', ['скир', 'skyr', 'скір', 'skyr'], [63, 11, 0.2, 4], ['pack', 170]),
  food('greek-yogurt', ['греческий йогурт 2%', 'greek yogurt 2%', 'грецький йогурт 2%', 'griechischer joghurt 2%'], [73, 10, 2, 3.9], ['pack', 170]),
  food('milk', ['молоко 2.5%', 'milk 2.5%', 'молоко 2.5%', 'milch 2.5%'], [52, 2.8, 2.5, 4.7], ['glass', 250]),
  food('kefir', ['кефир 1%', 'kefir 1%', 'кефір 1%', 'kefir 1%'], [40, 3, 1, 4], ['glass', 250]),
  food('cheese', ['сыр гауда', 'gouda cheese', 'сир гауда', 'gouda'], [356, 25, 27, 2.2], ['slice', 20]),
  food('whey', ['протеин (сывороточный)', 'whey protein', 'протеїн (сироватковий)', 'whey-protein'], [380, 75, 6, 8], ['scoop', 30]),
  food('protein-bar', ['протеиновый батончик', 'protein bar', 'протеїновий батончик', 'proteinriegel'], [360, 30, 10, 40], ['piece', 60]),
  food('tofu', ['тофу', 'tofu', 'тофу', 'tofu'], [76, 8, 4.8, 1.9], ['serving', 150]),
  food('lentils', ['чечевица, варёная', 'lentils, cooked', 'сочевиця, варена', 'linsen, gekocht'], [116, 9, 0.4, 20], ['bowl', 200]),
  // Углеводы
  food('oats', ['овсянка (сухая)', 'oats (dry)', 'вівсянка (суха)', 'haferflocken (trocken)'], [379, 13.2, 6.5, 67.7], ['serving', 60]),
  food('bircher', ['бирхер-мюсли', 'bircher muesli', 'бірхер-мюслі', 'birchermüesli'], [110, 3.5, 3.5, 16], ['bowl', 250]),
  food('buckwheat', ['гречка, варёная', 'buckwheat, cooked', 'гречка, варена', 'buchweizen, gekocht'], [110, 4.2, 1.1, 21.3], ['bowl', 200]),
  food('rice', ['рис, варёный', 'rice, cooked', 'рис, варений', 'reis, gekocht'], [130, 2.7, 0.3, 28], ['bowl', 200]),
  food('pasta', ['макароны, варёные', 'pasta, cooked', 'макарони, варені', 'nudeln, gekocht'], [158, 5.8, 0.9, 31], ['bowl', 250]),
  food('potatoes', ['картошка, варёная', 'potatoes, boiled', 'картопля, варена', 'kartoffeln, gekocht'], [87, 1.9, 0.1, 20], ['serving', 250]),
  food('bread', ['хлеб белый', 'white bread', 'хліб білий', 'weißbrot'], [265, 9, 3.2, 49], ['slice', 30]),
  food('wholegrain-bread', ['хлеб цельнозерновой', 'wholegrain bread', 'хліб цільнозерновий', 'vollkornbrot'], [247, 13, 3.4, 41], ['slice', 40]),
  food('banana', ['банан', 'banana', 'банан', 'banane'], [89, 1.1, 0.3, 23], ['piece', 120]),
  food('apple', ['яблоко', 'apple', 'яблуко', 'apfel'], [52, 0.3, 0.2, 14], ['piece', 180]),
  food('orange', ['апельсин', 'orange', 'апельсин', 'orange'], [47, 0.9, 0.1, 12], ['piece', 150]),
  food('berries', ['ягоды', 'berries', 'ягоди', 'beeren'], [50, 0.8, 0.4, 11], ['bowl', 150]),
  food('honey', ['мёд', 'honey', 'мед', 'honig'], [304, 0.3, 0, 82], ['tbsp', 20]),
  // Овощи и жиры
  food('broccoli', ['брокколи', 'broccoli', 'броколі', 'brokkoli'], [34, 2.8, 0.4, 7], ['serving', 150]),
  food('salad', ['овощной салат', 'vegetable salad', 'овочевий салат', 'gemüsesalat'], [18, 0.9, 0.2, 3.9], ['bowl', 200]),
  food('avocado', ['авокадо', 'avocado', 'авокадо', 'avocado'], [160, 2, 14.7, 8.5], ['piece', 150]),
  food('nuts', ['орехи', 'nuts', 'горіхи', 'nüsse'], [600, 20, 52, 18], ['serving', 30]),
  food('peanut-butter', ['арахисовая паста', 'peanut butter', 'арахісова паста', 'erdnussbutter'], [588, 25, 50, 20], ['tbsp', 16]),
  food('olive-oil', ['оливковое масло', 'olive oil', 'оливкова олія', 'olivenöl'], [884, 0, 100, 0], ['tbsp', 13]),
  food('butter', ['сливочное масло', 'butter', 'вершкове масло', 'butter'], [717, 0.9, 81, 0.1], ['tbsp', 10]),
  // Домашнее и здешнее
  food('borscht', ['борщ', 'borscht', 'борщ', 'borschtsch'], [50, 2, 2.5, 5], ['bowl', 350]),
  food('pelmeni', ['пельмени', 'pelmeni', 'пельмені', 'pelmeni'], [275, 12, 12, 29], ['serving', 250], 'meh'),
  food('sushi', ['роллы', 'sushi rolls', 'роли', 'sushi'], [150, 6, 3.5, 23], ['serving', 250]),
  food('roesti', ['рёшти', 'rösti', 'решті', 'rösti'], [180, 2, 10, 20], ['serving', 250], 'meh'),
  food('cervelat', ['цервелат', 'cervelat', 'цервелат', 'cervelat'], [286, 12, 26, 1], ['piece', 100], 'meh'),
  food('sausage', ['колбаса варёная', 'bologna sausage', 'ковбаса варена', 'fleischwurst'], [257, 12, 22, 2], ['slice', 25], 'meh'),
  food('croissant', ['круассан', 'croissant', 'круасан', 'gipfeli'], [406, 8, 21, 46], ['piece', 60], 'meh'),
  food('ice-cream', ['мороженое', 'ice cream', 'морозиво', 'glace'], [207, 3.5, 11, 24], ['serving', 100], 'meh'),
  food('dark-chocolate', ['тёмный шоколад', 'dark chocolate', 'чорний шоколад', 'dunkle schokolade'], [598, 7.8, 42.6, 45.9], ['serving', 25], 'meh'),
  // То, от чего мопсу плохо
  food('big-mac', ['биг мак', 'big mac', 'біг мак', 'big mac'], [251, 11.4, 13.7, 20.5], ['piece', 219], 'junk'),
  food('cheeseburger', ['чизбургер', 'cheeseburger', 'чізбургер', 'cheeseburger'], [263, 13.2, 11.4, 28], ['piece', 114], 'junk'),
  food('whopper', ['воппер', 'whopper', 'вопер', 'whopper'], [227, 9.7, 13.4, 16.9], ['piece', 290], 'junk'),
  food('nuggets', ['наггетсы, 6 штук', 'nuggets, 6 pieces', 'нагетси, 6 штук', 'nuggets, 6 stück'], [260, 14.6, 15.6, 15.6], ['serving', 96], 'junk'),
  food('fries', ['картошка фри', 'french fries', 'картопля фрі', 'pommes'], [288, 4.5, 13.5, 38.7], ['serving', 111], 'junk'),
  food('fried-chicken', ['курица из kfc', 'fried chicken', 'курка з kfc', 'frittiertes poulet'], [260, 20, 16, 8], ['piece', 120], 'junk'),
  food('hot-dog', ['хот-дог', 'hot dog', 'хот-дог', 'hotdog'], [290, 10, 18, 22], ['piece', 100], 'junk'),
  food('doner', ['дёнер', 'döner kebab', 'денер', 'döner'], [215, 12, 10, 20], ['piece', 400], 'junk'),
  food('shawarma', ['шаурма', 'shawarma', 'шаурма', 'schawarma'], [215, 10, 10, 22], ['piece', 350], 'junk'),
  food('pizza', ['пицца', 'pizza', 'піца', 'pizza'], [266, 11, 10, 33], ['slice', 110], 'junk'),
  food('instant-noodles', ['доширак', 'instant noodles', 'локшина швидкого приготування', 'instant-nudeln'], [440, 9, 17, 62], ['pack', 90], 'junk'),
  food('chips', ['чипсы', 'crisps', 'чипси', 'chips'], [536, 7, 35, 53], ['pack', 90], 'junk'),
  food('gummies', ['мармеладки', 'gummy bears', 'мармеладки', 'gummibärchen'], [343, 6.9, 0.5, 77], ['pack', 100], 'junk'),
  food('cola', ['кола', 'cola', 'кола', 'cola'], [42, 0, 0, 10.6], ['can', 330], 'junk'),
  food('energy-drink', ['энергетик', 'energy drink', 'енергетик', 'energy drink'], [45, 0, 0, 11], ['can', 250], 'junk'),
  food('beer', ['пиво', 'beer', 'пиво', 'bier'], [43, 0.5, 0, 3.6], ['bottle', 500], 'junk')
];

const BY_ID = new Map(FOODS.map((f) => [f.id, f]));

export const foodOf = (id: string): Food | undefined => BY_ID.get(id);

/** КБЖУ на порцию в граммах, округлённые так, как их показывает дневник. */
export function macrosFor(item: Food, grams: number) {
  const k = grams / 100;
  return {
    kcal: Math.round(item.per100.kcal * k),
    protein: Math.round(item.per100.p * k * 10) / 10,
    fat: Math.round(item.per100.f * k * 10) / 10,
    carbs: Math.round(item.per100.c * k * 10) / 10
  };
}

/**
 * Фастфуд по названию — для своей еды, которой нет в справочнике.
 *
 * Подстроки на четырёх языках. Узнаёт сети, бургеры, шаурму, газировку и
 * энергетики. Ложная тревога лучше пропуска: мопсу плохо от «бургера
 * домашнего» — переживёт, а «мак» в дневнике без реакции — уже не мопс.
 *
 * Пробелы по краям — не опечатка, а тот же капкан, что у терминов мопса:
 * «кола» сидит в «школа», «cola» — в «chocolate», «мака» — в «макароны»,
 * «фри» — во «фрикадельках». Такие слова сверяются с границей слова.
 */
const JUNK_WORDS = [
  'макдон', ' мак ', ' мака ', ' маке ', ' маку ', 'mcdonald', 'mcd', 'kfc', 'кфс', 'burger king', 'бургер кинг', ' бк ',
  'бургер', 'burger', 'воппер', 'whopper', 'наггет', 'нагет', 'nugget', ' фри ', 'fries', 'pommes',
  'шаурм', 'шаверм', 'шавух', 'döner', 'doner', 'дёнер', 'денер', 'кебаб', 'kebab', 'хот-дог', 'хотдог', 'hot dog', 'hotdog',
  'пицц', 'піц', 'pizza', 'чипс', 'chips', 'crisps', ' кола', '-кола', ' cola', '-cola', 'пепси', 'pepsi', 'фанта', 'fanta',
  'спрайт', 'sprite', 'энергетик', 'енергетик', 'energy drink', 'red bull', 'редбул', 'монстр', 'monster', 'доширак',
  'роллтон', 'ramen', 'пиво', 'beer', 'bier', 'водк', 'vodka', 'сникерс', 'snickers', ' марс ', 'twix', 'твикс', 'харибо',
  'haribo', ' торт', ' cake', ' kuchen', 'пончик', 'donut', 'пирожн'
];

export function junkByName(name: string): boolean {
  const hay = ` ${name.toLowerCase().replace(/ё/g, 'е')} `;
  return JUNK_WORDS.some((word) => hay.includes(word.replace(/ё/g, 'е')));
}

/** Поиск по справочнику: на любом из четырёх языков, по началу слова или подстроке. */
export function searchFoods(query: string, locale: Locale, limit = 12): Food[] {
  const q = query.trim().toLowerCase().replace(/ё/g, 'е');
  if (!q) return [];
  const scored: { item: Food; score: number }[] = [];
  for (const item of FOODS) {
    let best = 0;
    for (const [lang, raw] of Object.entries(item.name) as [Locale, string][]) {
      const name = raw.toLowerCase().replace(/ё/g, 'е');
      const own = lang === locale ? 1 : 0;
      if (name.startsWith(q)) best = Math.max(best, 4 + own);
      else if (name.split(/[\s,()-]+/).some((word) => word.startsWith(q))) best = Math.max(best, 3 + own);
      else if (name.includes(q)) best = Math.max(best, 1 + own);
    }
    if (best > 0) scored.push({ item, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item);
}
