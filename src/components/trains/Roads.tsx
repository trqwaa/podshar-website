'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';

import { BookmarkIcon, HomeIcon, PencilIcon, TrashIcon } from '@/components/Icons';
import { Link } from '@/i18n/routing';
import { removeRoad, renameRoad, saveRoad, setHomeStation } from '@/lib/travel/actions';
import type { Journey, SavedRoad, Station } from '@/lib/types';

/**
 * Сохранённые дороги.
 *
 * Первый заход сделал их закладкой: нажал кружок — заполнилась форма. Владелец
 * спросил ровно то, что следовало: «ну и смысл этих дорог». Смысла и не было —
 * они экономили два нажатия, а ради двух нажатий запоминать нечего.
 *
 * Смысл у сохранённой дороги может быть только один: сайт знает, что ты ездишь
 * этим маршрутом, и **сам показывает ближайший поезд**, не дожидаясь вопроса.
 * То же, что плитка «как свалить с HB» делает для дома, только для твоей
 * дороги — и на этом она перестаёт быть закладкой и становится причиной
 * открыть раздел.
 *
 * Отсюда же и то, что у дороги стало одно представление вместо трёх. Было:
 * кружок наверху, строка в списке внизу, форма сохранения под каждым поиском.
 * Стало: одна карточка, на которой и время, и переименование, и «забыть».
 */

function Saving({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 shrink-0 rounded border-2 border-ink px-5 text-base font-medium text-ink transition-colors duration-drape ease-drape hover:bg-sunk disabled:opacity-40"
    >
      {label}
    </button>
  );
}

/**
 * Запомнить показанную сейчас дорогу.
 *
 * Свёрнута в кружок, пока не нажали: развёрнутая форма висела под каждым
 * найденным маршрутом и по весу не отличалась от самого поиска, а нужна она
 * один раз на ту дорогу, которой ездишь.
 */
export function SaveRoad({ from, to }: { from: Station; to: Station }) {
  const t = useTranslations('trains');
  const [state, action] = useActionState(saveRoad, {});
  const [open, setOpen] = useState(false);

  if (state.ok) {
    return (
      <p role="status" className="px-1 pt-1 text-sm text-win">
        {t('remembered')}
      </p>
    );
  }

  if (!open) {
    return (
      <div className="px-1 pt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border-2 border-rule px-3 py-1.5 text-sm text-ink-muted transition-colors duration-drape ease-drape hover:bg-sunk hover:text-ink"
        >
          <BookmarkIcon />
          {t('rememberRoad')}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 px-1 pt-1">
      <input type="hidden" name="from" value={from.id} />
      <input type="hidden" name="to" value={to.id} />
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="ps-label text-ink-faint">{t('roadName')}</span>
        <input
          name="label"
          maxLength={40}
          autoFocus
          placeholder={`${from.name} → ${to.name}`}
          autoComplete="off"
          className="h-11 w-full rounded border-2 border-rule bg-canvas px-3 text-[1rem] text-ink outline-none transition-colors duration-drape ease-drape focus:border-ink sm:text-base placeholder:text-ink-faint"
        />
      </label>
      <Saving label={t('remember')} />
      {state.error ? <p className="w-full text-sm text-loss">{t(`errors.${state.error}`)}</p> : null}
    </form>
  );
}

/**
 * Одна дорога с ближайшим поездом.
 *
 * Поездку считает сервер и передаёт сюда готовой; браузер добавляет только
 * «через сколько» — оно другое каждую минуту и, написанное на сервере, было бы
 * расхождением гидратации. Время на обеих сторонах пишется по Цюриху, поэтому
 * «05:34» совпадает.
 */
export function RoadRow({
  road,
  next,
  failed,
  serverNow
}: {
  road: SavedRoad;
  next: Journey | null;
  /** SBB не ответили — это не то же самое, что «поездов больше нет». */
  failed: boolean;
  serverNow: number;
}) {
  const t = useTranslations('trains');
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [renameState, rename] = useActionState(renameRoad, {});
  const [, remove] = useActionState(removeRoad, {});
  const [now, setNow] = useState(serverNow);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(tick);
  }, []);

  const clock = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Zurich'
  });

  const mins = next ? Math.round((next.departs + next.delay * 60_000 - now) / 60_000) : 0;
  const leaving = Boolean(mounted && next && mins >= 0 && mins < 180);

  return (
    <li className="rounded-block border-2 border-rule bg-canvas p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
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

        {editing ? null : (
          <div className="flex shrink-0 items-center gap-3">
            {/* Значками, а не словами: две подписи в углу карточки спорили с
                названием дороги за внимание. Слово никуда не делось — оно в
                `aria-label` и во всплывающей подсказке. */}
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={t('rename')}
              title={t('rename')}
              className="grid h-8 w-8 place-items-center rounded-full border-2 border-transparent text-ink-faint transition-colors duration-drape ease-drape hover:border-rule hover:text-ink"
            >
              <PencilIcon />
            </button>
            <form action={remove}>
              <input type="hidden" name="id" value={road.id} />
              <button
                type="submit"
                aria-label={t('forget')}
                title={t('forget')}
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-transparent text-ink-faint transition-colors duration-drape ease-drape hover:border-rule hover:text-loss"
              >
                <TrashIcon />
              </button>
            </form>
          </div>
        )}
      </div>

      {editing ? (
        <form
          action={(data) => {
            rename(data);
            setEditing(false);
          }}
          className="mt-3 flex items-end gap-2"
        >
          <input type="hidden" name="id" value={road.id} />
          <input
            name="label"
            defaultValue={road.label ?? ''}
            maxLength={40}
            autoFocus
            aria-label={t('rename')}
            className="h-11 min-w-0 flex-1 rounded border-2 border-rule bg-canvas px-3 text-[1rem] text-ink outline-none transition-colors duration-drape ease-drape focus:border-ink sm:text-base"
          />
          <Saving label={t('save')} />
        </form>
      ) : (
        // Строка с поездом — она же дверь: нажал и попал в поиск по этой дороге,
        // где видно все варианты, а не только ближайший.
        <Link
          href={`/trains?from=${road.fromId}&to=${road.toId}`}
          className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 transition-colors duration-drape ease-drape"
        >
          {next ? (
            <>
              <span className="text-2xl font-medium tabular-nums leading-none text-ink">
                {clock.format(next.departs)}
              </span>
              {next.legs[0] ? (
                <span className="rounded border border-rule px-1.5 py-0.5 text-xs font-medium text-ink-muted">
                  {next.legs[0].line}
                </span>
              ) : null}
              {next.delay > 0 ? (
                <span className="text-sm font-medium text-loss">{t('delay', { min: next.delay })}</span>
              ) : null}
              {next.platform ? (
                <span className="text-sm text-ink-muted">{t('platform', { platform: next.platform })}</span>
              ) : null}
              <span className="text-sm text-ink-muted">{t('transfers', { count: next.transfers })}</span>
              {leaving ? (
                <span className="ps-label ms-auto shrink-0 text-ink-faint">
                  {mins === 0 ? t('now') : t('leavesIn', { min: mins })}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-base text-ink-muted">{failed ? t('unavailable') : t('gone')}</span>
          )}
        </Link>
      )}

      {renameState.error ? (
        <p className="mt-2 text-sm text-loss">{t(`errors.${renameState.error}`)}</p>
      ) : null}
    </li>
  );
}

/**
 * Сделать показанную станцию своей.
 *
 * Было отдельное поле «твоя станция» под табло — и станцию на этой вкладке
 * спрашивали дважды: сверху «какое табло смотрим», снизу «какая станция твоя»,
 * двумя одинаковыми полями подряд. Но человек, открывший табло, **уже** выбрал
 * станцию наверху; спрашивать её второй раз незачем. Осталась кнопка.
 */
export function MakeHome({ station, isHome }: { station: Station | null; isHome: boolean }) {
  const t = useTranslations('trains');
  const [state, action] = useActionState(setHomeStation, {});

  if (!station) return null;

  if (isHome && !state.station) {
    return (
      <form action={action} className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <HomeIcon className="h-4 w-4 text-ink" />
          {t('isHome')}
        </p>
        <input type="hidden" name="stop" value="" />
        <button type="submit" className="ps-label text-ink-faint transition-colors hover:text-loss">
          {t('dropHome')}
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="stop" value={station.id} />
      <button
        type="submit"
        className="flex items-center gap-2 rounded-full border-2 border-rule px-3 py-1.5 text-sm text-ink-muted transition-colors duration-drape ease-drape hover:bg-sunk hover:text-ink"
      >
        <HomeIcon />
        {t('makeHome')}
      </button>
      {state.error ? <p className="text-sm text-loss">{t(`errors.${state.error}`)}</p> : null}
      {state.station ? (
        <p role="status" className="text-sm text-win">
          {t('homeSaved', { station: state.station })}
        </p>
      ) : null}
    </form>
  );
}
