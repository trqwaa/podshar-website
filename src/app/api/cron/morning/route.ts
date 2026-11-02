import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import webpush from 'web-push';

import { prisma } from '@/lib/db';
import { dayKey } from '@/lib/calendar/scales';
import { planOf, weekdayOf } from '@/lib/gym/data';
import { trainsOn } from '@/lib/gym/exercises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Утреннее уведомление от мопса (1.53): раз в день по расписанию Vercel
 * (`vercel.json`), каждому подписанному телефону — что сегодня по плану.
 * Готовыми фразами из каталога, без модели: это бесплатно.
 *
 * Звать может только Vercel: он кладёт `CRON_SECRET` в заголовок. Нет ключей
 * уведомлений — молчит, а не падает. Телефон отписался (404 или 410 от службы
 * уведомлений) — его строчка удаляется, мусор не копится.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return NextResponse.json({ sent: 0, reason: 'no keys' });
  webpush.setVapidDetails('https://www.podshar.ch', publicKey, privateKey);

  const rows = await prisma.countdown.findMany({ where: { key: { startsWith: 'push:' } }, select: { key: true, label: true } });
  const ids = [...new Set(rows.map((row) => row.key.split(':')[1]))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, locale: true } });
  const weekday = weekdayOf(dayKey(new Date()));

  let sent = 0;
  for (const id of ids) {
    const locale = users.find((u) => u.id === id)?.locale ?? 'ru';
    const t = await getTranslations({ locale, namespace: 'push' });
    const day = (await planOf(id)).find((d) => d.weekday === weekday);
    const body = day && trainsOn(day.title, day.items.length) ? t('train', { title: day.title || t('workout') }) : t('rest');
    const payload = JSON.stringify({ title: t('title'), body, url: `/${locale}/gym` });
    for (const row of rows.filter((r) => r.key.split(':')[1] === id)) {
      try {
        await webpush.sendNotification(JSON.parse(row.label), payload, { TTL: 6 * 3600 });
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await prisma.countdown.delete({ where: { key: row.key } }).catch(() => undefined);
        else console.warn('[podshar] push не ушёл:', status, error instanceof Error ? error.message : error);
      }
    }
  }
  return NextResponse.json({ sent });
}
