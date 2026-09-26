'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/routing';
import type { Station } from '@/lib/types';
import { StationField } from './StationField';

/**
 * Какой станции смотрим табло.
 *
 * Сохранять выбор некуда и незачем: табло смотрят стоя на перроне, один раз.
 * Поэтому станция живёт в адресе (`?board=`), а не в настройках, — и ссылкой
 * на табло своей станции можно поделиться.
 */
export function BoardPicker({ station }: { station: Station | null }) {
  const t = useTranslations('trains');
  const router = useRouter();
  const [picked, setPicked] = useState<Station | null>(station);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (picked?.id) router.push(`/trains?board=${picked.id}`);
      }}
    >
      <StationField name="board" label={t('boardStation')} station={picked} onPick={setPicked} />
      <button
        type="submit"
        disabled={!picked?.id}
        className="rounded border-2 border-ink px-4 py-2.5 text-sm font-medium text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
      >
        {t('show')}
      </button>
    </form>
  );
}
