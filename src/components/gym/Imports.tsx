'use client';

import { useTranslations } from 'next-intl';

import { importFatsecret, importSleep, importStrong } from '@/lib/gym/actions';
import { CsvImport } from './CsvImport';

/**
 * Загрузки чужих выгрузок — Strong, FatSecret и Zepp Life — с 1.55 в
 * настройках, под подключениями, а не внизу страниц зала: нужны они раз в
 * жизни, а там были текстом, мимо которого листаешь каждый день (просьба
 * владельца от 3 ноября 2026).
 *
 * Строки — из раздела зала: на странице настроек у этого куска свой
 * провайдер с одними ими (`IMPORTS` в `client-messages.ts`).
 */
export function Imports() {
  const t = useTranslations('gym');
  return (
    <section className="block-card flex flex-col gap-3 p-4 sm:p-6">
      <h2 className="text-xl font-semibold lowercase text-ink">{t('imports.title')}</h2>
      <CsvImport
        action={importStrong}
        title={t('strong.title')}
        hint={t('strong.hint')}
        button={t('strong.button')}
        done={(r) =>
          [
            t('strong.done', { n: r.count ?? 0, sets: r.sets ?? 0 }),
            r.skipped ? t('strong.skipped', { n: r.skipped }) : null,
            r.unknown ? t('strong.unknown', { n: r.unknown }) : null
          ]
            .filter(Boolean)
            .join(' · ')
        }
      />
      <CsvImport
        action={importFatsecret}
        title={t('fatsecret.title')}
        hint={t('fatsecret.hint')}
        button={t('fatsecret.button')}
        done={(r) => t('fatsecret.done', { n: r.count ?? 0, days: r.days ?? 0 })}
      />
      <CsvImport
        action={importSleep}
        title={t('sleep.import.title')}
        hint={t('sleep.import.hint')}
        button={t('sleep.import.button')}
        done={(r) => [t('sleep.import.done', { n: r.count ?? 0 }), r.skipped ? t('sleep.import.skipped', { n: r.skipped }) : null].filter(Boolean).join(' · ')}
      />
    </section>
  );
}
