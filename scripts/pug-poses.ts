/**
 * Проверка поз мопса-тренера: `npm run gym:poses`.
 *
 * Глаз ловит не всё: колено, вывернутое назад в двадцати движениях, на
 * маленьком мопсе в сетке выглядело «примерно нормально». Здесь — то, что
 * считается: для каждого движения и каждого снаряда, который у него есть в
 * справочнике, по фазам повтора —
 *
 * - кисть достаёт до своей цели (иначе рука отрывается от грифа или рукояти);
 * - стопа достаёт до своей цели и не уходит под пол;
 * - корпус не проходит сквозь пол;
 * - ни одна деталь не прыгает за кадр анимации: перещёлкнувшийся локоть или
 *   перескочившая рука — это телепорт, а не движение.
 *
 * Выход с кодом 1, если что-то нашлось. Глазами всё равно смотреть.
 */
import { BACK, BODY, CHEST, FLOOR, GROUND, MOTIONS, loadOf, type P } from '../src/components/gym/pug-motions';
import { phaseOf, solve, widthsOf } from '../src/components/gym/pug-geometry';
import { frontFrame, frontPlan } from '../src/components/gym/pug-front';
import { sideFrame } from '../src/components/gym/pug-side';
import { EXERCISES } from '../src/lib/gym/exercises';

/** Сколько пикселей промаха терпим: полтора — это толщина контура. */
const SLACK = 2;
/** Больше этого за кадр в 60 Гц — уже не взрывное движение, а скачок. */
const JUMP = 30;

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const len = (a: P) => Math.hypot(a[0], a[1]);
const problems: string[] = [];
const live = { t: 0, breath: 0, blink: false, sweat: 0, sweatOpacity: 0, puff: 0, tongue: 0, tremble: 0, wag: 0, look: 0 };
const nums = (s: string) => (s.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

for (const motion of Object.keys(MOTIONS) as (keyof typeof MOTIONS)[]) {
  const def = MOTIONS[motion];
  const exercises = EXERCISES.filter((e) => e.motion === motion);
  const gears = motion === 'rest' ? [null] : [...new Set(exercises.map((e) => e.gear))];
  for (const gear of gears) {
    const tag = `${motion}${gear ? ` (${gear})` : ''}`;
    for (let i = 0; i <= 20; i++) {
      const p = i / 20;
      const pose = def.pose(p, gear);
      const r = solve(pose);
      const reach = BODY.upper * (pose.reachUpper ?? pose.reach ?? 1) + BODY.fore * (pose.reach ?? 1);
      for (const [name, hand] of [['кисть', pose.hand], ['дальняя кисть', pose.hand2]] as const) {
        if (hand && len(sub(hand, r.shoulder)) - reach > SLACK) problems.push(`${tag} @${p}: ${name} не достаёт до цели`);
      }
      for (const [name, foot] of [['стопа', pose.foot], ['дальняя стопа', pose.foot2]] as const) {
        if (foot && len(sub(foot, pose.hip)) - (BODY.thigh + BODY.shin) > SLACK) problems.push(`${tag} @${p}: ${name} не достаёт до цели`);
      }
      if (motion !== 'swim') {
        if (Math.max(r.leg.end[1], r.leg2.end[1]) > FLOOR + 1) problems.push(`${tag} @${p}: стопа под полом`);
        const front: P = [Math.cos(pose.torso), Math.sin(pose.torso)];
        for (const a of [pose.hip, r.neck]) {
          if (a[1] - front[1] * BACK > GROUND + 3 || a[1] + front[1] * (CHEST - 6) > GROUND + 3) problems.push(`${tag} @${p}: корпус сквозь пол`);
        }
      }
    }

    // Скачки: тот же кадр, что пишет `PugRig`, шаг — кадр при 60 Гц, два круга.
    const ex = exercises.find((e) => e.gear === gear);
    const load = loadOf(motion, gear);
    const samples = Array.from({ length: 13 }, (_, i) => {
      const pose = def.pose(i / 12, gear);
      return { r: solve(pose), z: widthsOf(pose, ex?.grip) };
    });
    const plan = frontPlan(samples, load);
    const period = def.period ?? (def.tempo === 'rep' ? 2.9 : 3.8);
    let prev: Map<string, number[]> | null = null;
    for (let f = 0; f <= Math.ceil(period * 2 * 60); f++) {
      const t = f / 60;
      const pose = def.pose(phaseOf(t, def.tempo, def.period), gear);
      const r = solve(pose);
      const cur = new Map<string, number[]>();
      const frames = [
        ['сбоку', sideFrame(r, load, live)],
        ['спереди', frontFrame(r, load, live, widthsOf(pose, ex?.grip), plan, def.props.includes('hood'))]
      ] as const;
      for (const [view, frame] of frames) {
        for (const [part, attrs] of frame) if (attrs.transform) cur.set(`${view} ${part}`, nums(attrs.transform).slice(0, 2));
      }
      if (prev) {
        for (const [key, v] of cur) {
          const q = prev.get(key);
          if (q && v.length === 2 && q.length === 2 && Math.hypot(v[0] - q[0], v[1] - q[1]) > JUMP) {
            problems.push(`${tag}: ${key} прыгает на ${Math.hypot(v[0] - q[0], v[1] - q[1]).toFixed(0)} px за кадр (t=${t.toFixed(2)})`);
          }
        }
      }
      prev = cur;
    }
  }
}

const unique = [...new Set(problems)];
if (unique.length) {
  console.log(unique.slice(0, 60).join('\n'));
  console.log(`\nнайдено: ${unique.length}`);
  process.exit(1);
}
console.log(`позы в порядке: ${Object.keys(MOTIONS).length} движений`);
