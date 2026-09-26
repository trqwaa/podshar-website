'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

import { removeRoad, renameRoad, saveRoad, setHomeStation } from '@/lib/travel/actions';
import type { SavedRoad, Station } from '@/lib/types';
import { StationField } from './StationField';

/**
 * Сохранённые дороги и домашняя станция.
 *
 * Дорога — это пара станций, которой ездят постоянно. Своё название
 * необязательно: без него в списке стоит «откуда → куда», и этого обычно
 * хватает. Название нужно тем, у кого две дороги между одними и теми же
 * станциями отличаются смыслом, а не концами, — «в школу» и «к бабушке».
 *
 * Переименование — поле прямо в строке, а не окно: менять название будут редко,
 * но когда будут, ради одного слова открывать диалог обидно. Пустое название не
 * удаляет дорогу, а снимает имя: удаление — отдельная кнопка, и путать их
 * нельзя.
 */

function Saving({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border-2 border-ink px-4 py-2 text-sm font-medium text-ink transition-opacity disabled:opacity-40"
    >
      {label}
    </button>
  );
}

/** Запомнить показанную сейчас дорогу. */
export function SaveRoad({ from, to }: { from: Station; to: Station }) {
  const t = useTranslations('trains');
  const [state, action] = useActionState(saveRoad, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="from" value={from.id} />
      <input type="hidden" name="to" value={to.id} />
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="ps-label">{t('roadName')}</span>
        <input
          name="label"
          maxLength={40}
          placeholder={`${from.name} → ${to.name}`}
          autoComplete="off"
          className="w-full rounded border-2 border-rule bg-canvas px-3 py-2 text-[1rem] text-ink outline-none transition-colors focus:border-ink sm:text-[0.9375rem] placeholder:text-ink-faint"
        />
      </label>
      <Saving label={t('remember')} />
      {state.error ? <p className="w-full text-sm text-loss">{t(`errors.${state.error}`)}</p> : null}
      {state.ok ? <p className="w-full text-sm text-win">{t('remembered')}</p> : null}
    </form>
  );
}

/** Список дорог: открыть, переименовать, убрать. */
export function Roads({ roads }: { roads: SavedRoad[] }) {
  const t = useTranslations('trains');

  if (roads.length === 0) {
    return <p className="text-base text-ink-muted">{t('noRoads')}</p>;
  }

  return (
    <ul className="flex flex-col">
      {roads.map((road) => (
        <Road key={road.id} road={road} label={t('rename')} />
      ))}
    </ul>
  );
}

function Road({ road, label }: { road: SavedRoad; label: string }) {
  const t = useTranslations('trains');
  const [editing, setEditing] = useState(false);
  const [renameState, rename] = useActionState(renameRoad, {});
  const [, remove] = useActionState(removeRoad, {});

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-rule py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-ink">
          {road.label || `${road.fromName} → ${road.toName}`}
        </p>
        {road.label ? (
          <p className="truncate text-sm text-ink-faint">
            {road.fromName} → {road.toName}
          </p>
        ) : null}
      </div>

      {editing ? (
        <form
          action={(data) => {
            rename(data);
            setEditing(false);
          }}
          className="flex w-full items-end gap-2 sm:w-auto"
        >
          <input type="hidden" name="id" value={road.id} />
          <input
            name="label"
            defaultValue={road.label ?? ''}
            maxLength={40}
            autoFocus
            aria-label={label}
            className="min-w-0 flex-1 rounded border-2 border-rule bg-canvas px-3 py-2 text-[1rem] text-ink outline-none transition-colors focus:border-ink sm:w-52 sm:text-[0.9375rem]"
          />
          <Saving label={t('save')} />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ps-label text-ink-faint transition-colors hover:text-ink"
        >
          {label}
        </button>
      )}

      <form action={remove}>
        <input type="hidden" name="id" value={road.id} />
        <button type="submit" className="ps-label text-ink-faint transition-colors hover:text-loss">
          {t('forget')}
        </button>
      </form>

      {renameState.error ? (
        <p className="w-full text-sm text-loss">{t(`errors.${renameState.error}`)}</p>
      ) : null}
    </li>
  );
}

/**
 * Домашняя станция.
 *
 * Переехала сюда из профиля целиком: настройка поездная, и место ей рядом с
 * поездами. Отсюда её берут плитка на главной и «домой» в поиске.
 */
export function HomeStation({ station }: { station: Station | null }) {
  const t = useTranslations('trains');
  const [state, action] = useActionState(setHomeStation, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <StationField name="stop" label={t('homeStation')} station={station} />
      <Saving label={t('save')} />
      {state.error ? <p className="w-full text-sm text-loss">{t(`errors.${state.error}`)}</p> : null}
      {state.station ? (
        <p role="status" className="w-full text-sm text-win">
          {t('homeSaved', { station: state.station })}
        </p>
      ) : null}
    </form>
  );
}
