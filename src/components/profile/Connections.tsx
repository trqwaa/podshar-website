'use client';

import { useEffect, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { createSleepToken, dropPush, revokeSleepToken, savePush } from '@/lib/connections';

/**
 * Подключения (1.53): сон из «Здоровья» айфона и утренние уведомления мопса.
 *
 * Сон — быстрой командой, которую человек собирает сам: сайт не может
 * залезть в «Здоровье», а команда — может. Отсюда — личный ключ (показывается
 * один раз, в базе только его отпечаток), адрес и шаги.
 *
 * Уведомления на айфоне бывают только у сайта, добавленного на экран
 * «Домой»; в обычной вкладке Safari подписаться нечем — тогда здесь об этом и
 * сказано. Состояние — этого телефона: подписка у каждого устройства своя.
 */

type PushState = 'checking' | 'notReady' | 'install' | 'unsupported' | 'denied' | 'off' | 'on';

const CARD = 'flex flex-col gap-3 rounded-[14px] bg-sunk p-4';
const BTN = 'ps-press rounded-full bg-ink px-4 py-2 text-sm font-semibold lowercase text-surface transition-opacity hover:opacity-90 disabled:opacity-40';
const SOFT = 'ps-press rounded-full bg-canvas px-4 py-2 text-sm font-semibold lowercase text-ink transition-colors hover:bg-rule-soft disabled:opacity-40';

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function Connections({ sleepSince, pushKey, sleepUrl }: { sleepSince: number | null; pushKey: string | null; sleepUrl: string }) {
  const t = useTranslations('connections');
  const locale = useLocale();
  const [busy, start] = useTransition();
  const [since, setSince] = useState(sleepSince);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [push, setPush] = useState<PushState>('checking');

  useEffect(() => {
    void (async () => {
      if (!pushKey) return setPush('notReady');
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setPush(/iPhone|iPad/.test(navigator.userAgent) && !standalone ? 'install' : 'unsupported');
      if (Notification.permission === 'denied') return setPush('denied');
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      setPush((await reg?.pushManager.getSubscription()) ? 'on' : 'off');
    })().catch(() => setPush('unsupported'));
  }, [pushKey]);

  const enable = () =>
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        if ((await Notification.requestPermission()) !== 'granted') return setPush('denied');
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(pushKey ?? '') });
        setPush((await savePush(sub.toJSON())).ok ? 'on' : 'off');
      } catch {
        setPush('unsupported');
      }
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await dropPush({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setPush('off');
    });

  const sinceText = since ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(since) : null;

  return (
    <section className="block-card flex flex-col gap-4 p-4 sm:p-6">
      <h2 className="text-xl font-semibold lowercase text-ink">{t('title')}</h2>

      <div className={CARD}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold text-ink">{t('sleepTitle')}</h3>
          <span className={`text-xs font-semibold ${since ? 'text-win' : 'text-ink-muted'}`}>{since ? t('sleepOn', { date: sinceText ?? '' }) : t('sleepOff')}</span>
        </div>
        <p className="text-sm text-ink-muted">{t('sleepWhat')}</p>
        {token ? (
          <div className="flex flex-col gap-2 rounded-[10px] bg-canvas p-3">
            <p className="ps-label">{t('sleepKey')}</p>
            <code className="break-all text-sm text-ink">{token}</code>
            <button
              type="button"
              className={`${BTN} self-start`}
              onClick={() => {
                void navigator.clipboard?.writeText(token).then(() => setCopied(true));
              }}
            >
              {copied ? t('copied') : t('copy')}
            </button>
            <p className="ps-label mt-1">{t('sleepUrl')}</p>
            <code className="break-all text-sm text-ink">{sleepUrl}</code>
            <p className="ps-label mt-1">{t('sleepHow')}</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{t('sleepSteps')}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className={BTN}
            onClick={() =>
              start(async () => {
                const result = await createSleepToken();
                if (result.token) {
                  setToken(result.token);
                  setCopied(false);
                  setSince(Date.now());
                }
              })
            }
          >
            {since ? t('sleepNew') : t('sleepGet')}
          </button>
          {since ? (
            <button
              type="button"
              disabled={busy}
              className={SOFT}
              onClick={() =>
                start(async () => {
                  if ((await revokeSleepToken()).ok) {
                    setSince(null);
                    setToken(null);
                  }
                })
              }
            >
              {t('sleepRevoke')}
            </button>
          ) : null}
        </div>
      </div>

      <div className={CARD}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold text-ink">{t('pushTitle')}</h3>
          <span className={`text-xs font-semibold ${push === 'on' ? 'text-win' : 'text-ink-muted'}`}>{push === 'on' ? t('pushOn') : t('pushOffLabel')}</span>
        </div>
        <p className="text-sm text-ink-muted">{t('pushWhat')}</p>
        {push === 'off' ? (
          <button type="button" disabled={busy} onClick={enable} className={`${BTN} self-start`}>
            {t('pushEnable')}
          </button>
        ) : push === 'on' ? (
          <button type="button" disabled={busy} onClick={disable} className={`${SOFT} self-start`}>
            {t('pushDisable')}
          </button>
        ) : push === 'checking' ? null : (
          <p className="text-sm font-medium text-ink">{t(push === 'notReady' ? 'pushNotReady' : push === 'install' ? 'pushInstall' : push === 'denied' ? 'pushDenied' : 'pushUnsupported')}</p>
        )}
      </div>
    </section>
  );
}
