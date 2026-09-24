/**
 * Справочник героев и бравлеров, и какие иконки лежат у нас в `public/`.
 *
 * Сгенерирован скриптом 24 сентября 2026 из OpenDota (`heroStats`) и BrawlAPI
 * (`/v1/brawlers`), руками не править — только дописывать новое.
 *
 * Лежит в коде, а не спрашивается на лету, по правилу проекта: рендер не ходит в
 * чужой API. Чтобы подписать героя в строке матча, страница иначе ждала бы
 * OpenDota, а та отвечает то за четверть секунды, то за одиннадцать. Имена
 * героев не меняются годами; новый герой, вышедший после генерации, рисуется
 * номером и квадратом с буквами, а не ломает строку.
 *
 * Иконки у нас по той же причине, по которой у нас медали: путь на чужом CDN
 * однажды сменят, и картинка пропадёт молча. Обновить: скачать недостающее в
 * `public/dota/heroes/<key>.png` и `public/brawl/brawlers/<id>.png`, дописать сюда.
 */

export const DOTA_HEROES: Readonly<Record<number, { key: string; name: string }>> = {
  "1": {
    key: "antimage",
    name: "Anti-Mage"
  },
  "2": {
    key: "axe",
    name: "Axe"
  },
  "3": {
    key: "bane",
    name: "Bane"
  },
  "4": {
    key: "bloodseeker",
    name: "Bloodseeker"
  },
  "5": {
    key: "crystal_maiden",
    name: "Crystal Maiden"
  },
  "6": {
    key: "drow_ranger",
    name: "Drow Ranger"
  },
  "7": {
    key: "earthshaker",
    name: "Earthshaker"
  },
  "8": {
    key: "juggernaut",
    name: "Juggernaut"
  },
  "9": {
    key: "mirana",
    name: "Mirana"
  },
  "10": {
    key: "morphling",
    name: "Morphling"
  },
  "11": {
    key: "nevermore",
    name: "Shadow Fiend"
  },
  "12": {
    key: "phantom_lancer",
    name: "Phantom Lancer"
  },
  "13": {
    key: "puck",
    name: "Puck"
  },
  "14": {
    key: "pudge",
    name: "Pudge"
  },
  "15": {
    key: "razor",
    name: "Razor"
  },
  "16": {
    key: "sand_king",
    name: "Sand King"
  },
  "17": {
    key: "storm_spirit",
    name: "Storm Spirit"
  },
  "18": {
    key: "sven",
    name: "Sven"
  },
  "19": {
    key: "tiny",
    name: "Tiny"
  },
  "20": {
    key: "vengefulspirit",
    name: "Vengeful Spirit"
  },
  "21": {
    key: "windrunner",
    name: "Windranger"
  },
  "22": {
    key: "zuus",
    name: "Zeus"
  },
  "23": {
    key: "kunkka",
    name: "Kunkka"
  },
  "25": {
    key: "lina",
    name: "Lina"
  },
  "26": {
    key: "lion",
    name: "Lion"
  },
  "27": {
    key: "shadow_shaman",
    name: "Shadow Shaman"
  },
  "28": {
    key: "slardar",
    name: "Slardar"
  },
  "29": {
    key: "tidehunter",
    name: "Tidehunter"
  },
  "30": {
    key: "witch_doctor",
    name: "Witch Doctor"
  },
  "31": {
    key: "lich",
    name: "Lich"
  },
  "32": {
    key: "riki",
    name: "Riki"
  },
  "33": {
    key: "enigma",
    name: "Enigma"
  },
  "34": {
    key: "tinker",
    name: "Tinker"
  },
  "35": {
    key: "sniper",
    name: "Sniper"
  },
  "36": {
    key: "necrolyte",
    name: "Necrophos"
  },
  "37": {
    key: "warlock",
    name: "Warlock"
  },
  "38": {
    key: "beastmaster",
    name: "Beastmaster"
  },
  "39": {
    key: "queenofpain",
    name: "Queen of Pain"
  },
  "40": {
    key: "venomancer",
    name: "Venomancer"
  },
  "41": {
    key: "faceless_void",
    name: "Faceless Void"
  },
  "42": {
    key: "skeleton_king",
    name: "Wraith King"
  },
  "43": {
    key: "death_prophet",
    name: "Death Prophet"
  },
  "44": {
    key: "phantom_assassin",
    name: "Phantom Assassin"
  },
  "45": {
    key: "pugna",
    name: "Pugna"
  },
  "46": {
    key: "templar_assassin",
    name: "Templar Assassin"
  },
  "47": {
    key: "viper",
    name: "Viper"
  },
  "48": {
    key: "luna",
    name: "Luna"
  },
  "49": {
    key: "dragon_knight",
    name: "Dragon Knight"
  },
  "50": {
    key: "dazzle",
    name: "Dazzle"
  },
  "51": {
    key: "rattletrap",
    name: "Clockwerk"
  },
  "52": {
    key: "leshrac",
    name: "Leshrac"
  },
  "53": {
    key: "furion",
    name: "Nature's Prophet"
  },
  "54": {
    key: "life_stealer",
    name: "Lifestealer"
  },
  "55": {
    key: "dark_seer",
    name: "Dark Seer"
  },
  "56": {
    key: "clinkz",
    name: "Clinkz"
  },
  "57": {
    key: "omniknight",
    name: "Omniknight"
  },
  "58": {
    key: "enchantress",
    name: "Enchantress"
  },
  "59": {
    key: "huskar",
    name: "Huskar"
  },
  "60": {
    key: "night_stalker",
    name: "Night Stalker"
  },
  "61": {
    key: "broodmother",
    name: "Broodmother"
  },
  "62": {
    key: "bounty_hunter",
    name: "Bounty Hunter"
  },
  "63": {
    key: "weaver",
    name: "Weaver"
  },
  "64": {
    key: "jakiro",
    name: "Jakiro"
  },
  "65": {
    key: "batrider",
    name: "Batrider"
  },
  "66": {
    key: "chen",
    name: "Chen"
  },
  "67": {
    key: "spectre",
    name: "Spectre"
  },
  "68": {
    key: "ancient_apparition",
    name: "Ancient Apparition"
  },
  "69": {
    key: "doom_bringer",
    name: "Doom"
  },
  "70": {
    key: "ursa",
    name: "Ursa"
  },
  "71": {
    key: "spirit_breaker",
    name: "Spirit Breaker"
  },
  "72": {
    key: "gyrocopter",
    name: "Gyrocopter"
  },
  "73": {
    key: "alchemist",
    name: "Alchemist"
  },
  "74": {
    key: "invoker",
    name: "Invoker"
  },
  "75": {
    key: "silencer",
    name: "Silencer"
  },
  "76": {
    key: "obsidian_destroyer",
    name: "Outworld Devourer"
  },
  "77": {
    key: "lycan",
    name: "Lycan"
  },
  "78": {
    key: "brewmaster",
    name: "Brewmaster"
  },
  "79": {
    key: "shadow_demon",
    name: "Shadow Demon"
  },
  "80": {
    key: "lone_druid",
    name: "Lone Druid"
  },
  "81": {
    key: "chaos_knight",
    name: "Chaos Knight"
  },
  "82": {
    key: "meepo",
    name: "Meepo"
  },
  "83": {
    key: "treant",
    name: "Treant Protector"
  },
  "84": {
    key: "ogre_magi",
    name: "Ogre Magi"
  },
  "85": {
    key: "undying",
    name: "Undying"
  },
  "86": {
    key: "rubick",
    name: "Rubick"
  },
  "87": {
    key: "disruptor",
    name: "Disruptor"
  },
  "88": {
    key: "nyx_assassin",
    name: "Nyx Assassin"
  },
  "89": {
    key: "naga_siren",
    name: "Naga Siren"
  },
  "90": {
    key: "keeper_of_the_light",
    name: "Keeper of the Light"
  },
  "91": {
    key: "wisp",
    name: "Io"
  },
  "92": {
    key: "visage",
    name: "Visage"
  },
  "93": {
    key: "slark",
    name: "Slark"
  },
  "94": {
    key: "medusa",
    name: "Medusa"
  },
  "95": {
    key: "troll_warlord",
    name: "Troll Warlord"
  },
  "96": {
    key: "centaur",
    name: "Centaur Warrunner"
  },
  "97": {
    key: "magnataur",
    name: "Magnus"
  },
  "98": {
    key: "shredder",
    name: "Timbersaw"
  },
  "99": {
    key: "bristleback",
    name: "Bristleback"
  },
  "100": {
    key: "tusk",
    name: "Tusk"
  },
  "101": {
    key: "skywrath_mage",
    name: "Skywrath Mage"
  },
  "102": {
    key: "abaddon",
    name: "Abaddon"
  },
  "103": {
    key: "elder_titan",
    name: "Elder Titan"
  },
  "104": {
    key: "legion_commander",
    name: "Legion Commander"
  },
  "105": {
    key: "techies",
    name: "Techies"
  },
  "106": {
    key: "ember_spirit",
    name: "Ember Spirit"
  },
  "107": {
    key: "earth_spirit",
    name: "Earth Spirit"
  },
  "108": {
    key: "abyssal_underlord",
    name: "Underlord"
  },
  "109": {
    key: "terrorblade",
    name: "Terrorblade"
  },
  "110": {
    key: "phoenix",
    name: "Phoenix"
  },
  "111": {
    key: "oracle",
    name: "Oracle"
  },
  "112": {
    key: "winter_wyvern",
    name: "Winter Wyvern"
  },
  "113": {
    key: "arc_warden",
    name: "Arc Warden"
  },
  "114": {
    key: "monkey_king",
    name: "Monkey King"
  },
  "119": {
    key: "dark_willow",
    name: "Dark Willow"
  },
  "120": {
    key: "pangolier",
    name: "Pangolier"
  },
  "121": {
    key: "grimstroke",
    name: "Grimstroke"
  },
  "123": {
    key: "hoodwink",
    name: "Hoodwink"
  },
  "126": {
    key: "void_spirit",
    name: "Void Spirit"
  },
  "128": {
    key: "snapfire",
    name: "Snapfire"
  },
  "129": {
    key: "mars",
    name: "Mars"
  },
  "131": {
    key: "ringmaster",
    name: "Ring Master"
  },
  "135": {
    key: "dawnbreaker",
    name: "Dawnbreaker"
  },
  "136": {
    key: "marci",
    name: "Marci"
  },
  "137": {
    key: "primal_beast",
    name: "Primal Beast"
  },
  "138": {
    key: "muerta",
    name: "Muerta"
  },
  "145": {
    key: "kez",
    name: "Kez"
  },
  "155": {
    key: "largo",
    name: "Largo"
  }
};

/**
 * Только имена. Роли тут нет нарочно: поле `class` у BrawlAPI вопреки названию
 * отдаёт игровую подсказку («Collect Caterpillars To Become More Powerful»), а не
 * роль, и по-английски на любом языке сайта.
 */
export const BRAWLERS: Readonly<Record<number, { name: string }>> = {
  "16000000": {
    name: "Shelly"
  },
  "16000001": {
    name: "Colt"
  },
  "16000002": {
    name: "Bull"
  },
  "16000003": {
    name: "Brock"
  },
  "16000004": {
    name: "Rico"
  },
  "16000005": {
    name: "Spike"
  },
  "16000006": {
    name: "Barley"
  },
  "16000007": {
    name: "Jessie"
  },
  "16000008": {
    name: "Nita"
  },
  "16000009": {
    name: "Dynamike"
  },
  "16000010": {
    name: "El Primo"
  },
  "16000011": {
    name: "Mortis"
  },
  "16000012": {
    name: "Crow"
  },
  "16000013": {
    name: "Poco"
  },
  "16000014": {
    name: "Bo"
  },
  "16000015": {
    name: "Piper"
  },
  "16000016": {
    name: "Pam"
  },
  "16000017": {
    name: "Tara"
  },
  "16000018": {
    name: "Darryl"
  },
  "16000019": {
    name: "Penny"
  },
  "16000020": {
    name: "Frank"
  },
  "16000021": {
    name: "Gene"
  },
  "16000022": {
    name: "Tick"
  },
  "16000023": {
    name: "Leon"
  },
  "16000024": {
    name: "Rosa"
  },
  "16000025": {
    name: "Carl"
  },
  "16000026": {
    name: "Bibi"
  },
  "16000027": {
    name: "8-Bit"
  },
  "16000028": {
    name: "Sandy"
  },
  "16000029": {
    name: "Bea"
  },
  "16000030": {
    name: "Emz"
  },
  "16000031": {
    name: "Mr. P"
  },
  "16000032": {
    name: "Max"
  },
  "16000034": {
    name: "Jacky"
  },
  "16000035": {
    name: "Gale"
  },
  "16000036": {
    name: "Nani"
  },
  "16000037": {
    name: "Sprout"
  },
  "16000038": {
    name: "Surge"
  },
  "16000039": {
    name: "Colette"
  },
  "16000040": {
    name: "Amber"
  },
  "16000041": {
    name: "Lou"
  },
  "16000042": {
    name: "Byron"
  },
  "16000043": {
    name: "Edgar"
  },
  "16000044": {
    name: "Ruffs"
  },
  "16000045": {
    name: "Stu"
  },
  "16000046": {
    name: "Belle"
  },
  "16000047": {
    name: "Squeak"
  },
  "16000048": {
    name: "Grom"
  },
  "16000049": {
    name: "Buzz"
  },
  "16000050": {
    name: "Griff"
  },
  "16000051": {
    name: "Ash"
  },
  "16000052": {
    name: "Meg"
  },
  "16000053": {
    name: "Lola"
  },
  "16000054": {
    name: "Fang"
  },
  "16000056": {
    name: "Eve"
  },
  "16000057": {
    name: "Janet"
  },
  "16000058": {
    name: "Bonnie"
  },
  "16000059": {
    name: "Otis"
  },
  "16000060": {
    name: "Sam"
  },
  "16000061": {
    name: "Gus"
  },
  "16000062": {
    name: "Buster"
  },
  "16000063": {
    name: "Chester"
  },
  "16000064": {
    name: "Gray"
  },
  "16000065": {
    name: "Mandy"
  },
  "16000066": {
    name: "R-T"
  },
  "16000067": {
    name: "Willow"
  },
  "16000068": {
    name: "Maisie"
  },
  "16000069": {
    name: "Hank"
  },
  "16000070": {
    name: "Cordelius"
  },
  "16000071": {
    name: "Doug"
  },
  "16000072": {
    name: "Pearl"
  },
  "16000073": {
    name: "Chuck"
  },
  "16000074": {
    name: "Charlie"
  },
  "16000075": {
    name: "Mico"
  },
  "16000076": {
    name: "Kit"
  },
  "16000077": {
    name: "Larry & Lawrie"
  },
  "16000078": {
    name: "Melodie"
  },
  "16000079": {
    name: "Angelo"
  },
  "16000080": {
    name: "Draco"
  },
  "16000081": {
    name: "Lily"
  },
  "16000082": {
    name: "Berry"
  },
  "16000083": {
    name: "Clancy"
  },
  "16000084": {
    name: "Moe"
  },
  "16000085": {
    name: "Kenji"
  },
  "16000086": {
    name: "Shade"
  },
  "16000087": {
    name: "Juju"
  },
  "16000088": {
    name: "Buzz Lightyear"
  },
  "16000089": {
    name: "Meeple"
  },
  "16000090": {
    name: "Ollie"
  },
  "16000091": {
    name: "Lumi"
  },
  "16000092": {
    name: "Finx"
  },
  "16000093": {
    name: "Jae-Yong"
  },
  "16000094": {
    name: "Kaze"
  },
  "16000095": {
    name: "Alli"
  },
  "16000096": {
    name: "Trunk"
  },
  "16000097": {
    name: "Mina"
  },
  "16000098": {
    name: "Ziggy"
  },
  "16000099": {
    name: "Pierce"
  },
  "16000100": {
    name: "Gigi"
  },
  "16000101": {
    name: "Glowy"
  },
  "16000102": {
    name: "Sirius"
  },
  "16000103": {
    name: "Najia"
  },
  "16000104": {
    name: "Damian"
  },
  "16000105": {
    name: "Starr Nova"
  },
  "16000106": {
    name: "Bolt"
  },
  "16000107": {
    name: "Nori"
  },
  "16000108": {
    name: "Wendy"
  },
  "16000109": {
    name: "Cosmo"
  },
  "16000110": {
    name: "Vince"
  }
};

export const DOTA_HERO_ICONS: ReadonlySet<string> = new Set(["abaddon", "abyssal_underlord", "alchemist", "ancient_apparition", "antimage", "arc_warden", "axe", "bane", "batrider", "beastmaster", "bloodseeker", "bounty_hunter", "brewmaster", "bristleback", "broodmother", "centaur", "chaos_knight", "chen", "clinkz", "crystal_maiden", "dark_seer", "dark_willow", "dawnbreaker", "dazzle", "death_prophet", "disruptor", "doom_bringer", "dragon_knight", "drow_ranger", "earth_spirit", "earthshaker", "elder_titan", "ember_spirit", "enchantress", "enigma", "faceless_void", "furion", "grimstroke", "gyrocopter", "hoodwink", "huskar", "invoker", "jakiro", "juggernaut", "keeper_of_the_light", "kez", "kunkka", "largo", "legion_commander", "leshrac", "lich", "life_stealer", "lina", "lion", "lone_druid", "luna", "lycan", "magnataur", "marci", "mars", "medusa", "meepo", "mirana", "monkey_king", "morphling", "muerta", "naga_siren", "necrolyte", "nevermore", "night_stalker", "nyx_assassin", "obsidian_destroyer", "ogre_magi", "omniknight", "oracle", "pangolier", "phantom_assassin", "phantom_lancer", "phoenix", "primal_beast", "puck", "pudge", "pugna", "queenofpain", "rattletrap", "razor", "riki", "ringmaster", "rubick", "sand_king", "shadow_demon", "shadow_shaman", "shredder", "silencer", "skeleton_king", "skywrath_mage", "slardar", "slark", "snapfire", "sniper", "spectre", "spirit_breaker", "storm_spirit", "sven", "techies", "templar_assassin", "terrorblade", "tidehunter", "tinker", "tiny", "treant", "troll_warlord", "tusk", "undying", "ursa", "vengefulspirit", "venomancer", "viper", "visage", "void_spirit", "warlock", "weaver", "windrunner", "winter_wyvern", "wisp", "witch_doctor", "zuus"]);

export const BRAWLER_ICONS: ReadonlySet<number> = new Set([16000000, 16000001, 16000002, 16000003, 16000004, 16000005, 16000006, 16000007, 16000008, 16000009, 16000010, 16000011, 16000012, 16000013, 16000014, 16000015, 16000016, 16000017, 16000018, 16000019, 16000020, 16000021, 16000022, 16000023, 16000024, 16000025, 16000026, 16000027, 16000028, 16000029, 16000030, 16000031, 16000032, 16000034, 16000035, 16000036, 16000037, 16000038, 16000039, 16000040, 16000041, 16000042, 16000043, 16000044, 16000045, 16000046, 16000047, 16000048, 16000049, 16000050, 16000051, 16000052, 16000053, 16000054, 16000056, 16000057, 16000058, 16000059, 16000060, 16000061, 16000062, 16000063, 16000064, 16000065, 16000066, 16000067, 16000068, 16000069, 16000070, 16000071, 16000072, 16000073, 16000074, 16000075, 16000076, 16000077, 16000078, 16000079, 16000080, 16000081, 16000082, 16000083, 16000084, 16000085, 16000086, 16000087, 16000088, 16000089, 16000090, 16000091, 16000092, 16000093, 16000094, 16000095, 16000096, 16000097, 16000098, 16000099, 16000100, 16000101, 16000102, 16000103, 16000104, 16000105, 16000106, 16000107, 16000108]);

/** Герой по номеру — с иконкой, если она у нас есть. */
export function dotaHero(id: number) {
  const known = DOTA_HEROES[id];
  if (!known) return { key: String(id), name: `#${id}`, hasIcon: false };
  return { ...known, hasIcon: DOTA_HERO_ICONS.has(known.key) };
}

/** Бравлер по номеру — с иконкой, если она у нас есть. */
export function brawler(id: number) {
  const known = BRAWLERS[id];
  return { id, name: known?.name ?? `#${id}`, hasIcon: BRAWLER_ICONS.has(id) };
}
