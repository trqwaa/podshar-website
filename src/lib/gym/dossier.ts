import 'server-only';

import { shiftDay } from '@/lib/calendar/scales';

import type { Dossier } from './critic';
import { gymProfile, junkNames, weekDigest, type WeekDigest } from './data';

/**
 * Всё, на что смотрит критик, одним походом в базу: профиль, две недели
 * дневника и фастфуд по названиям. Подвал, страница критика и разнос моделью
 * берут одно и то же досье — так правила и модель не спорят о фактах.
 */
export async function dossierFor(userId: string, today: string): Promise<{ dossier: Dossier; digest: WeekDigest }> {
  const [profile, digest, junk] = await Promise.all([
    gymProfile(userId, today),
    weekDigest(userId, today),
    junkNames(userId, shiftDay(today, -6), today)
  ]);
  return {
    digest,
    dossier: {
      today,
      goal: profile.goal,
      age: profile.age,
      weightKg: profile.weightKg,
      targets: profile.targets,
      plan: digest.plan,
      workouts: digest.workouts,
      food: digest.food,
      junkNames: junk,
      sleep: digest.sleep,
      weights: digest.weights
    }
  };
}
