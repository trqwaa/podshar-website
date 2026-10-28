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

/**
 * Остальное с этикетки, как в FatSecret: клетчатка, сахар, насыщенные жиры —
 * граммы; натрий, холестерин, калий — миллиграммы. Всё на 100 г.
 */
export type Extras = { fiber: number; sugar: number; satFat: number; sodium: number; cholesterol: number; potassium: number };

export type Food = {
  id: string;
  name: Words;
  /** На 100 г: ккал, белки, жиры, углеводы и остальное с этикетки. */
  per100: { kcal: number; p: number; f: number; c: number } & Extras;
  portion: { unit: Unit; grams: number };
  quality: Quality;
};

const food = (
  id: string,
  [ru, en, uk, de]: [string, string, string, string],
  [kcal, p, f, c]: [number, number, number, number],
  [unit, grams]: [Unit, number],
  quality: Quality = 'clean'
): Food => ({ id, name: { ru, en, uk, de }, per100: { kcal, p, f, c, ...extrasOf(id) }, portion: { unit, grams }, quality });

/**
 * Клетчатка, сахар, насыщенные жиры (г), натрий, холестерин, калий (мг) на
 * 100 г — по тем же открытым таблицам и сайтам сетей. Отдельной таблицей, чтобы
 * строки справочника выше оставались читаемыми.
 */
const EXTRA: Record<string, [number, number, number, number, number, number]> = {
  'chicken-breast': [0, 0, 1, 74, 85, 256],
  'beef-steak': [0, 0, 6.8, 60, 90, 315],
  'ground-beef': [0, 0, 6, 72, 88, 290],
  pork: [0, 0, 5, 60, 80, 360],
  salmon: [0, 0, 2.5, 60, 63, 384],
  tuna: [0, 0, 0.3, 247, 30, 237],
  eggs: [0, 0.4, 3.1, 142, 373, 138],
  'egg-whites': [0, 0.7, 0, 166, 0, 163],
  'cottage-cheese': [0, 1.8, 3, 40, 15, 112],
  skyr: [0, 4, 0.1, 50, 5, 150],
  'greek-yogurt': [0, 3.6, 1.3, 36, 10, 141],
  milk: [0, 4.7, 1.6, 44, 10, 150],
  kefir: [0, 4, 0.6, 50, 4, 150],
  cheese: [0, 2.2, 17.6, 819, 114, 121],
  whey: [1, 5, 3, 160, 100, 500],
  'protein-bar': [6, 15, 4, 250, 10, 300],
  tofu: [0.3, 0.6, 0.7, 7, 0, 121],
  lentils: [7.9, 1.8, 0.1, 2, 0, 369],
  oats: [10.6, 1, 1.2, 2, 0, 362],
  bircher: [2.5, 8, 1, 20, 3, 180],
  buckwheat: [2.7, 0.9, 0.2, 4, 0, 88],
  rice: [0.4, 0.1, 0.1, 1, 0, 35],
  pasta: [1.8, 0.6, 0.2, 1, 0, 44],
  potatoes: [1.8, 0.9, 0, 5, 0, 328],
  bread: [2.7, 5, 0.7, 490, 0, 115],
  'wholegrain-bread': [7, 4, 0.7, 450, 0, 250],
  banana: [2.6, 12.2, 0.1, 1, 0, 358],
  apple: [2.4, 10.4, 0, 1, 0, 107],
  orange: [2.4, 9.4, 0, 0, 0, 181],
  berries: [2.4, 7, 0, 1, 0, 150],
  honey: [0.2, 82, 0, 4, 0, 52],
  broccoli: [2.6, 1.7, 0, 33, 0, 316],
  salad: [1.2, 2.5, 0, 10, 0, 200],
  avocado: [6.7, 0.7, 2.1, 7, 0, 485],
  nuts: [7, 4, 4.5, 3, 0, 650],
  'peanut-butter': [6, 9, 10, 430, 0, 560],
  'olive-oil': [0, 0, 14, 2, 0, 1],
  butter: [0, 0.1, 51, 11, 215, 24],
  borscht: [1.5, 3, 0.8, 250, 5, 200],
  pelmeni: [1.5, 1, 5, 400, 40, 150],
  plov: [1, 1, 2, 300, 20, 150],
  blini: [0.8, 5, 3, 300, 60, 120],
  syrniki: [0.5, 8, 4, 200, 80, 150],
  vareniki: [1.5, 1, 1, 350, 10, 200],
  'greek-salad': [1.3, 2.5, 3.5, 380, 15, 180],
  sushi: [0.8, 4, 0.6, 400, 10, 100],
  roesti: [2, 0.5, 2, 350, 5, 400],
  cervelat: [0, 0.5, 10, 1000, 70, 200],
  sausage: [0, 1, 8, 900, 60, 180],
  croissant: [2.6, 11, 12, 470, 67, 118],
  'ice-cream': [0.7, 21, 7, 80, 44, 199],
  'dark-chocolate': [10.9, 24, 24.5, 20, 3, 715],
  'big-mac': [1.4, 4.1, 5, 460, 36, 180],
  cheeseburger: [1.3, 6, 5.3, 600, 35, 200],
  whopper: [1, 4, 4.5, 340, 30, 200],
  nuggets: [1, 0.3, 2.5, 500, 40, 250],
  fries: [3.8, 0.2, 2, 210, 0, 600],
  'fried-chicken': [0.5, 0, 4, 700, 90, 230],
  'hot-dog': [1, 4, 6.5, 750, 30, 150],
  doner: [1.5, 2, 4, 550, 30, 250],
  shawarma: [1.5, 2, 3.5, 550, 30, 250],
  pizza: [2.3, 3.6, 4.5, 600, 17, 170],
  'instant-noodles': [2.4, 2, 7.5, 1700, 0, 120],
  chips: [4.4, 0.5, 3.5, 500, 0, 1200],
  gummies: [0, 46, 0.1, 25, 0, 5],
  cola: [0, 10.6, 0, 4, 0, 2],
  'energy-drink': [0, 11, 0, 80, 0, 0],
  beer: [0, 0, 0, 4, 0, 27]
};

function extrasOf(id: string): Extras {
  const [fiber, sugar, satFat, sodium, cholesterol, potassium] = EXTRA[id] ?? [0, 0, 0, 0, 0, 0];
  return { fiber, sugar, satFat, sodium, cholesterol, potassium };
}

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
  food('plov', ['плов', 'plov (pilaf)', 'плов', 'plov (pilaw)'], [180, 6, 7, 23], ['bowl', 300], 'meh'),
  food('blini', ['блины', 'blini (crêpes)', 'млинці', 'blini (crêpes)'], [230, 6, 9, 30], ['piece', 50], 'meh'),
  food('syrniki', ['сырники', 'syrniki (cottage cheese pancakes)', 'сирники', 'syrniki (quarkplätzchen)'], [220, 14, 9, 21], ['piece', 60], 'meh'),
  food('vareniki', ['вареники с картошкой', 'vareniki with potato', 'вареники з картоплею', 'wareniki mit kartoffeln'], [200, 5, 4, 36], ['serving', 250], 'meh'),
  food('greek-salad', ['греческий салат', 'greek salad', 'грецький салат', 'griechischer salat'], [110, 3, 9, 4], ['bowl', 250]),
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

const tenth = (v: number) => Math.round(v * 10) / 10;

/** КБЖУ и остальное с этикетки на порцию в граммах, округлённые, как их показывает дневник. */
export function macrosFor(item: Food, grams: number) {
  const k = grams / 100;
  const v = item.per100;
  return {
    kcal: Math.round(v.kcal * k),
    protein: tenth(v.p * k),
    fat: tenth(v.f * k),
    carbs: tenth(v.c * k),
    fiber: tenth(v.fiber * k),
    sugar: tenth(v.sugar * k),
    satFat: tenth(v.satFat * k),
    sodium: Math.round(v.sodium * k),
    cholesterol: Math.round(v.cholesterol * k),
    potassium: Math.round(v.potassium * k)
  };
}

/**
 * Что нарисовать у холодильника: еда группами, которые мопс узнаёт на глаз.
 * Человек ел в основном это — значит, это и стоит у холодильника.
 */
export type FridgeGroup = 'burger' | 'fries' | 'soda' | 'pizza' | 'doner' | 'chicken' | 'rice' | 'shaker' | 'eggs' | 'veg' | 'fruit' | 'sweets' | 'dairy' | 'fish';

const GROUP_OF: Record<string, FridgeGroup> = {
  'big-mac': 'burger', cheeseburger: 'burger', whopper: 'burger', 'hot-dog': 'burger', 'fried-chicken': 'burger', nuggets: 'burger',
  fries: 'fries', chips: 'fries',
  cola: 'soda', 'energy-drink': 'soda', beer: 'soda',
  pizza: 'pizza',
  doner: 'doner', shawarma: 'doner',
  'chicken-breast': 'chicken', 'beef-steak': 'chicken', 'ground-beef': 'chicken', pork: 'chicken', cervelat: 'chicken', sausage: 'chicken',
  rice: 'rice', buckwheat: 'rice', pasta: 'rice', potatoes: 'rice', plov: 'rice', oats: 'rice', bircher: 'rice', lentils: 'rice', pelmeni: 'rice', vareniki: 'rice',
  whey: 'shaker', 'protein-bar': 'shaker',
  eggs: 'eggs', 'egg-whites': 'eggs',
  broccoli: 'veg', salad: 'veg', 'greek-salad': 'veg', avocado: 'veg', borscht: 'veg',
  banana: 'fruit', apple: 'fruit', orange: 'fruit', berries: 'fruit',
  gummies: 'sweets', 'ice-cream': 'sweets', 'dark-chocolate': 'sweets', croissant: 'sweets', honey: 'sweets', 'instant-noodles': 'sweets',
  'cottage-cheese': 'dairy', skyr: 'dairy', 'greek-yogurt': 'dairy', milk: 'dairy', kefir: 'dairy', cheese: 'dairy', syrniki: 'dairy', blini: 'dairy',
  salmon: 'fish', tuna: 'fish', sushi: 'fish'
};

/** Группа по еде из справочника, своя еда — по названию (фастфуд узнаётся, остальное нет). */
export function fridgeGroupOf(food: string | null, name: string): FridgeGroup | null {
  if (food && GROUP_OF[food]) return GROUP_OF[food];
  const n = ` ${name.toLowerCase()} `;
  if (/бургер|burger|мак|whopper|воппер/.test(n)) return 'burger';
  if (/пицц|піц|pizza/.test(n)) return 'pizza';
  if (/шаурм|шаверм|д[её]нер|doner|döner|kebab|кебаб/.test(n)) return 'doner';
  if (/ кола|cola|пепси|pepsi|энергетик|енергетик|energy|пиво|beer|bier/.test(n)) return 'soda';
  if (/фри |fries|pommes|чипс|chips/.test(n)) return 'fries';
  if (/протеин|протеїн|whey|шейк|shake/.test(n)) return 'shaker';
  if (/кур|chicken|poulet|грудк/.test(n)) return 'chicken';
  if (/рис|rice|reis|греч|buckwheat|макарон|pasta/.test(n)) return 'rice';
  return null;
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
