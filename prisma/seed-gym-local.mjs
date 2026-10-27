/**
 * Демо-данные зала для локальной базы — и только для неё.
 *
 * Заводит троих тестовых участников с дневниками разного качества, чтобы
 * подвал, критик и страницы было видно сразу, а не на пустом месте:
 * «качок» — всё по плану, «соня» — план есть, сна нет, «фастфуд» — ни плана,
 * ни совести. Пароль у троих общий, случайный, пишется в файл из аргумента.
 *
 * Отказывается работать, если база не на этой машине: на общей базе это
 * завело бы троих чужих людей рядом с настоящими.
 *
 *   DATABASE_URL=postgresql://postgres@localhost:5433/podshar_local \
 *   node prisma/seed-gym-local.mjs ../gym-logins.md
 */
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const [loginsFile] = process.argv.slice(2);
const url = process.env.DATABASE_URL ?? '';
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
  console.error('refusing: DATABASE_URL does not point at a database on this machine');
  process.exit(1);
}
if (!loginsFile) {
  console.error('usage: node prisma/seed-gym-local.mjs <file for the test password>');
  process.exit(1);
}
const prisma = new PrismaClient();

const ZONE = 'Europe/Zurich';
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const shift = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
function offsetMinutes(date) {
  const tz = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, timeZoneName: 'shortOffset' }).formatToParts(date).find((p) => p.type === 'timeZoneName').value;
  const m = tz.match(/GMT([+-]\d+)(?::(\d+))?/);
  return m ? Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] || 0) : 0;
}
function zurichAt(day, clock) {
  const [y, mo, d] = day.split('-').map(Number);
  const [h, mi] = clock.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const rough = offsetMinutes(new Date(wall));
  const exact = offsetMinutes(new Date(wall - rough * 60000));
  return new Date(wall - exact * 60000);
}
const weekday = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};
const today = dayKey(new Date());

const FOOD = {
  oats: ['овсянка (сухая)', 379, 13.2, 6.5, 67.7, 80],
  whey: ['протеин (сывороточный)', 380, 75, 6, 8, 30],
  banana: ['банан', 89, 1.1, 0.3, 23, 120],
  'chicken-breast': ['куриная грудка, готовая', 165, 31, 3.6, 0, 200],
  rice: ['рис, варёный', 130, 2.7, 0.3, 28, 250],
  'cottage-cheese': ['творог 5%', 121, 17, 5, 1.8, 200],
  salmon: ['лосось, запечённый', 206, 22, 12, 0, 160],
  potatoes: ['картошка, варёная', 87, 1.9, 0.1, 20, 300],
  eggs: ['яйцо куриное', 143, 12.6, 9.5, 0.7, 165],
  'wholegrain-bread': ['хлеб цельнозерновой', 247, 13, 3.4, 41, 80],
  buckwheat: ['гречка, варёная', 110, 4.2, 1.1, 21.3, 250],
  'beef-steak': ['говяжий стейк', 250, 26, 17, 0, 200],
  salad: ['овощной салат', 18, 0.9, 0.2, 3.9, 200],
  nuts: ['орехи', 600, 20, 52, 18, 30],
  'big-mac': ['биг мак', 251, 11.4, 13.7, 20.5, 219],
  fries: ['картошка фри', 288, 4.5, 13.5, 38.7, 111],
  cola: ['кола', 42, 0, 0, 10.6, 500],
  doner: ['дёнер', 215, 12, 10, 20, 400],
  'energy-drink': ['энергетик', 45, 0, 0, 11, 500],
  pizza: ['пицца', 266, 11, 10, 33, 330],
  chips: ['чипсы', 536, 7, 35, 53, 90],
  pasta: ['макароны, варёные', 158, 5.8, 0.9, 31, 250],
  croissant: ['круассан', 406, 8, 21, 46, 60]
};
const JUNK = new Set(['big-mac', 'fries', 'cola', 'doner', 'energy-drink', 'pizza', 'chips']);
const foodRow = (userId, day, meal, id) => {
  const [name, kcal, p, f, c, grams] = FOOD[id];
  const k = grams / 100;
  return {
    userId, eatenOn: day, meal, food: id, name, grams,
    kcal: Math.round(kcal * k), protein: Math.round(p * k * 10) / 10, fat: Math.round(f * k * 10) / 10, carbs: Math.round(c * k * 10) / 10,
    junk: JUNK.has(id)
  };
};

async function member(handle, displayName, password) {
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  return prisma.user.upsert({
    where: { handle },
    update: { displayName, passwordHash },
    create: { handle, displayName, email: `${handle}@gym.local`, passwordHash, locale: 'ru' }
  });
}

async function wipe(userId) {
  await prisma.gymSession.deleteMany({ where: { userId } });
  await prisma.gymPlanDay.deleteMany({ where: { userId } });
  await prisma.gymGoal.deleteMany({ where: { userId } });
  await prisma.bodyMeasure.deleteMany({ where: { userId } });
  await prisma.foodEntry.deleteMany({ where: { userId } });
  await prisma.sleepEntry.deleteMany({ where: { userId } });
  await prisma.gymVerdict.deleteMany({ where: { userId } });
  await prisma.gymProfile.deleteMany({ where: { userId } });
}

async function plan(userId, days) {
  for (const [weekdayIndex, title, items] of days) {
    await prisma.gymPlanDay.create({
      data: {
        userId, weekday: weekdayIndex, title,
        items: { create: items.map(([exercise, sets, reps, weight], i) => ({ exercise, sets, reps, weight, position: i + 1 })) }
      }
    });
  }
}

async function workout(userId, day, start, minutes, title, blocks) {
  const startedAt = zurichAt(day, start);
  await prisma.gymSession.create({
    data: {
      userId, scheduledFor: startedAt, completedAt: new Date(startedAt.getTime() + minutes * 60000), focus: title,
      sets: {
        create: blocks.flatMap(([exercise, sets], block) =>
          sets.map(([weight, reps], index) => ({ exercise, block, index, weight, reps, done: true, doneAt: new Date(startedAt.getTime() + (block * 12 + index * 3) * 60000) }))
        )
      }
    }
  });
}

async function sleepNight(userId, night, bed, wake, source = 'manual') {
  const wakeAt = zurichAt(night, wake);
  let bedAt = zurichAt(night, bed);
  if (bedAt >= wakeAt) bedAt = zurichAt(shift(night, -1), bed);
  await prisma.sleepEntry.create({ data: { userId, night, bedAt, wakeAt, minutes: Math.round((wakeAt - bedAt) / 60000), source } });
}

const password = randomBytes(9).toString('base64url');
const kach = await member('test-kach', 'тест · качок', password);
const sonya = await member('test-sonya', 'тест · соня', password);
const junk = await member('test-fastfood', 'тест · фастфуд', password);
for (const u of [kach, sonya, junk]) await wipe(u.id);

// ── Качок: всё по плану ────────────────────────────────────────────────────
await prisma.gymProfile.create({ data: { userId: kach.id, goal: 'hypertrophy', heightCm: 180, sex: 'male', activity: 'mid', bornYear: 2008 } });
const KACH_PLAN = [
  [0, 'грудь и трицепс', [['bench-press', 4, 8, 80], ['incline-bench', 3, 10, 60], ['dips', 3, 10, null], ['triceps-pushdown', 3, 12, 25]]],
  [1, 'спина', [['barbell-row', 4, 8, 70], ['pull-up', 4, 8, null], ['lat-pulldown', 3, 12, 55], ['biceps-curl', 3, 10, 30]]],
  [3, 'ноги', [['squat', 5, 5, 100], ['rdl', 3, 8, 80], ['leg-press', 3, 12, 160], ['calf-raise', 4, 15, 60]]],
  [5, 'плечи и руки', [['ohp', 4, 6, 45], ['lateral-raise', 3, 15, 10], ['hammer-curl', 3, 12, 14]]]
];
await plan(kach.id, KACH_PLAN);
for (let back = 13; back >= 1; back--) {
  const day = shift(today, -back);
  const w = weekday(day);
  const planDay = KACH_PLAN.find((p) => p[0] === w);
  if (!planDay) continue;
  const bump = back > 6 ? 0 : 2.5;
  await workout(kach.id, day, '17:30', 62, planDay[1], planDay[2].map(([exercise, sets, reps, weight]) => [exercise, Array.from({ length: sets }, () => [weight ? weight + bump : null, reps])]));
}
for (let back = 9; back >= 0; back--) {
  const day = shift(today, -back);
  const rows = [foodRow(kach.id, day, 'breakfast', 'oats'), foodRow(kach.id, day, 'breakfast', 'whey'), foodRow(kach.id, day, 'breakfast', 'banana'),
    foodRow(kach.id, day, 'lunch', 'chicken-breast'), foodRow(kach.id, day, 'lunch', 'rice'), foodRow(kach.id, day, 'lunch', 'salad')];
  if (back > 0) rows.push(foodRow(kach.id, day, 'dinner', back % 2 ? 'salmon' : 'beef-steak'), foodRow(kach.id, day, 'dinner', back % 2 ? 'potatoes' : 'buckwheat'),
    foodRow(kach.id, day, 'snack', 'cottage-cheese'), foodRow(kach.id, day, 'snack', 'nuts'));
  await prisma.foodEntry.createMany({ data: rows });
}
for (let back = 13; back >= 0; back--) {
  const night = shift(today, -back);
  await sleepNight(kach.id, night, back % 3 ? '23:10' : '23:40', back % 2 ? '07:20' : '07:40', back > 7 ? 'zepp' : 'manual');
}
for (const [back, w, b, c, waist] of [[28, 72.4, 36.5, 101, 79], [21, 72.6, 36.7, 101.5, 79], [14, 72.9, 36.9, 102, 79.2], [7, 73.1, 37.1, 102.5, 79.1], [0, 73.4, 37.2, 103, 79.3]]) {
  const takenOn = shift(today, -back);
  await prisma.bodyMeasure.createMany({ data: [
    { userId: kach.id, part: 'weight', value: w, takenOn },
    { userId: kach.id, part: 'biceps', value: b, takenOn },
    { userId: kach.id, part: 'chest', value: c, takenOn },
    { userId: kach.id, part: 'waist', value: waist, takenOn }
  ] });
}
await prisma.gymGoal.createMany({ data: [
  { userId: kach.id, kind: 'lift', subject: 'bench-press', target: 100 },
  { userId: kach.id, kind: 'bodyweight', target: 76 },
  { userId: kach.id, kind: 'measure', subject: 'biceps', target: 40, deadline: shift(today, 120) }
] });

// ── Соня: план есть, сна нет ───────────────────────────────────────────────
await prisma.gymProfile.create({ data: { userId: sonya.id, goal: 'strength', heightCm: 176, sex: 'male', activity: 'low', bornYear: 2009 } });
await plan(sonya.id, [
  [0, 'всё тело', [['squat', 3, 5, 80], ['bench-press', 3, 5, 65], ['barbell-row', 3, 5, 55]]],
  [2, 'всё тело', [['deadlift', 3, 5, 100], ['ohp', 3, 5, 40], ['pull-up', 3, 6, null]]],
  [4, 'всё тело', [['squat', 3, 5, 80], ['bench-press', 3, 5, 65], ['barbell-row', 3, 5, 55]]]
]);
await workout(sonya.id, shift(today, -4), '19:00', 50, 'всё тело', [['squat', [[80, 5], [80, 5], [80, 4]]], ['bench-press', [[65, 5], [65, 5], [65, 3]]]]);
for (let back = 13; back >= 0; back--) {
  const night = shift(today, -back);
  const beds = ['01:40', '02:30', '00:50', '03:10', '01:15'];
  const wakes = ['07:10', '07:30', '07:00', '08:40', '07:15'];
  await sleepNight(sonya.id, night, beds[back % 5], wakes[back % 5]);
}
for (let back = 6; back >= 0; back--) {
  const day = shift(today, -back);
  await prisma.foodEntry.createMany({ data: [foodRow(sonya.id, day, 'breakfast', 'croissant'), foodRow(sonya.id, day, 'lunch', 'pasta'), foodRow(sonya.id, day, 'dinner', 'buckwheat'), foodRow(sonya.id, day, 'snack', 'energy-drink')] });
}
await prisma.bodyMeasure.create({ data: { userId: sonya.id, part: 'weight', value: 66.5, takenOn: shift(today, -3) } });

// ── Фастфуд: ни плана, ни совести ──────────────────────────────────────────
await prisma.gymProfile.create({ data: { userId: junk.id, goal: 'cut', heightCm: 182, sex: 'male', activity: 'low', bornYear: 2008 } });
for (let back = 6; back >= 0; back--) {
  const day = shift(today, -back);
  const menu = back % 2 ? ['big-mac', 'fries', 'cola'] : ['doner', 'energy-drink', 'chips'];
  await prisma.foodEntry.createMany({ data: [foodRow(junk.id, day, 'lunch', menu[0]), foodRow(junk.id, day, 'lunch', menu[1]), foodRow(junk.id, day, 'dinner', 'pizza'), foodRow(junk.id, day, 'snack', menu[2])] });
}
for (let back = 6; back >= 0; back--) await sleepNight(junk.id, shift(today, -back), back % 2 ? '00:30' : '23:50', back % 2 ? '11:40' : '10:50');

writeFileSync(loginsFile, `# Local test logins for the gym trial

Local database only (${url.replace(/\/\/[^@]*@/, '//')}), not the real Neon one.

| handle | who | what the diary shows |
|---|---|---|
| test-kach | тест · качок | plan Mon/Tue/Thu/Sat, workouts done, clean food, good sleep |
| test-sonya | тест · соня | strength plan, one workout in two weeks, sleeps 5–6 h, bed at 1–3 am |
| test-fastfood | тест · фастфуд | no plan, fast food every day, sleeps 10+ h |

Password for all three: \`${password}\`
`);
console.log('seeded', today, 'weekday', weekday(today));
await prisma.$disconnect();
