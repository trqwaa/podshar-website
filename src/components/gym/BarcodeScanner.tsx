'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';

import { Modal } from '@/components/Modal';
import type { Locale } from '@/i18n/routing';
import { addFood } from '@/lib/gym/actions';
import type { Barcoded } from '@/lib/gym/barcode';
import { lookupBarcode } from '@/lib/gym/food-actions';
import { BUTTON, CHIP, CHIP_OFF, GHOST, INPUT } from './styles';
import { ErrorLine, parseNumber, useGymAction } from './ui';

/**
 * Сканер штрихкода: навёл камеру на упаковку — продукт с КБЖУ из Open Food
 * Facts, вписал граммы — записано (1.53).
 *
 * В Safari на айфоне своего распознавания штрихкодов нет, поэтому библиотека —
 * и она грузится, только когда сканер открыли: остальным страницам зала
 * лишние сотни килобайт ни к чему. Камера — задняя, видео без звука и внутри
 * страницы (`playsInline`), иначе айфон разворачивает его на весь экран.
 */

type Stop = { stop: () => void };

function Camera({ onCode, onFail }: { onCode: (code: string) => void; onFail: () => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  // Колбэки через ссылку: камера включается один раз за открытие, а не на
  // каждый рендер родителя.
  const said = useRef({ onCode, onFail });
  said.current = { onCode, onFail };
  useEffect(() => {
    let controls: Stop | null = null;
    let done = false;
    void (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (done || !video.current) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current, (result, _error, ctrl) => {
          if (!result || done) return;
          done = true;
          ctrl.stop();
          said.current.onCode(result.getText());
        });
        if (done) controls.stop();
      } catch {
        if (!done) said.current.onFail();
      }
    })();
    return () => {
      done = true;
      controls?.stop();
    };
  }, []);
  return (
    <div className="relative overflow-hidden rounded-[14px] bg-ink">
      <video ref={video} muted playsInline className="aspect-[4/3] w-full object-cover" />
      {/* Рамка-прицел: куда подставить штрихкод. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-1/2 h-24 -translate-y-1/2 rounded-[10px] border-2 border-surface/80" />
    </div>
  );
}

export function BarcodeScanner({ day, meal }: { day: string; meal: string }) {
  const t = useTranslations('gym');
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [looking, setLooking] = useState(false);
  const [product, setProduct] = useState<Barcoded | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [grams, setGrams] = useState('');
  const { run, pending, error } = useGymAction();

  const close = () => {
    setOpen(false);
    setProduct(null);
    setProblem(null);
    setGrams('');
  };

  const found = async (code: string) => {
    setLooking(true);
    const result = await lookupBarcode({ code }).catch(() => ({ error: 'generic' }) as { error: string; product?: undefined });
    setLooking(false);
    if (result.product) {
      setProduct(result.product);
      setGrams(String(result.product.serving ?? 100));
    } else setProblem(result.error ?? 'generic');
  };

  const amount = parseNumber(grams) ?? 0;
  const k = amount / 100;
  const per = product?.per100;
  const say = (key: string) => (t.has(`errors.${key}`) ? t(`errors.${key}`) : t('errors.generic'));

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${GHOST} inline-flex items-center gap-1.5`}>
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M2 4V2.5h2.5M11.5 2.5H14V4M14 12v1.5h-2.5M4.5 13.5H2V12M5 5v6M7 5v6M9.5 5v6M11 5v6" />
        </svg>
        {t('scanner.open')}
      </button>
      {open
        ? createPortal(
            <Modal title={t('scanner.title')} close={t('picker.close')} onClose={close}>
              <div className="flex flex-col gap-3">
                {product ? (
                  <>
                    <p className="font-semibold text-ink">{product.name}</p>
                    <p className="text-xs tabular-nums text-ink-muted">
                      {t('scanner.per100')}: {Math.round(per!.kcal)} {t('food.kcal')} · {t('food.protein')} {per!.protein} · {t('food.fat')} {per!.fat} · {t('food.carbs')} {per!.carbs}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1 text-sm text-ink-muted">
                        <input autoFocus value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="decimal" aria-label={t('food.grams')} className={`${INPUT} w-24`} />
                        {t('food.grams')}
                      </label>
                      {[50, 100, 200].map((g) => (
                        <button key={g} type="button" onClick={() => setGrams(String(g))} className={`${CHIP} ${CHIP_OFF}`}>
                          {g} {t('food.grams')}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-ink">
                      {Math.round(per!.kcal * k)} {t('food.kcal')} · {t('food.protein')} {Math.round(per!.protein * k)} · {t('food.fat')} {Math.round(per!.fat * k)} · {t('food.carbs')} {Math.round(per!.carbs * k)}
                    </p>
                    <button
                      type="button"
                      disabled={pending || amount <= 0}
                      className={`${BUTTON} self-start`}
                      onClick={async () => {
                        const result = await run(addFood, {
                          day,
                          meal,
                          locale,
                          name: product.name,
                          grams: amount,
                          kcal: per!.kcal * k,
                          protein: per!.protein * k,
                          fat: per!.fat * k,
                          carbs: per!.carbs * k,
                          fiber: per!.fiber === null ? null : per!.fiber * k,
                          sugar: per!.sugar === null ? null : per!.sugar * k
                        });
                        if (result.ok) close();
                      }}
                    >
                      {t('scanner.add', { meal: t(`food.meals.${meal}`) })}
                    </button>
                    <ErrorLine message={error} />
                  </>
                ) : problem ? (
                  <>
                    <p role="status" className="text-sm font-medium text-loss">
                      {say(problem)}
                    </p>
                    <button type="button" onClick={() => setProblem(null)} className={`${GHOST} self-start`}>
                      {t('scanner.again')}
                    </button>
                  </>
                ) : looking ? (
                  <p role="status" className="text-sm text-ink-muted">
                    {t('scanner.looking')}
                  </p>
                ) : (
                  <>
                    <Camera onCode={found} onFail={() => setProblem('cameraDenied')} />
                    <p className="text-xs text-ink-muted">{t('scanner.hint')}</p>
                  </>
                )}
              </div>
            </Modal>,
            document.body
          )
        : null}
    </>
  );
}
