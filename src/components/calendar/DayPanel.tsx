'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';

import { saveEvent, deleteEvent, type CalendarState } from '@/lib/calendar/actions';
import type { Locale } from '@/i18n/routing';
import { DayField } from './DayField';

const ZONE = 'Europe/Zurich';

/** То, что пережило дорогу с сервера: даты приезжают датами, всё прочее строками. */
export type DayEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  author: string;
};

/**
 * Выбранный день: что в нём есть и что можно добавить.
 *
 * Клиентский, потому что здесь живут две вещи, которых у сервера быть не может:
 * какое событие сейчас правят и раскрыты ли необязательные поля. Сами данные
 * приходят сверху уже готовыми — компонент ничего не загружает.
 *
 * Время везде печатается **в цюрихском поясе явно**, а не в поясе зрителя.
 * Иначе один и тот же сбор в 20:00 человек из Киева увидел бы в 21:00, и это
 * была бы не любезность, а расхождение в общем календаре.
 */
export function DayPanel({
  day,
  events,
  canEdit
}: {
  day: string;
  events: DayEvent[];
  canEdit: boolean;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale() as Locale;
  const [editing, setEditing] = useState<DayEvent | null>(null);
  const [adding, setAdding] = useState(false);

  // Переключились на другой день — черновик к нему уже не относится.
  useEffect(() => {
    setEditing(null);
    setAdding(false);
  }, [day]);

  const heading = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: ZONE
  }).format(new Date(`${day}T12:00:00Z`));

  const clock = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONE
  });

  return (
    <section className="block-card animate-rise-in flex flex-col gap-5 p-6 [animation-delay:60ms] sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-xl font-semibold leading-tight text-ink first-letter:uppercase">{heading}</h2>
        {canEdit && !adding && !editing ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ps-label rounded border-2 border-rule px-3 py-2 transition-colors hover:bg-sunk"
          >
            {t('add')}
          </button>
        ) : null}
      </header>

      {events.length === 0 && !adding ? <p className="ps-label">{t('empty')}</p> : null}

      {events.length > 0 ? (
        <ul className="flex flex-col">
          {events.map((event, index) =>
            editing?.id === event.id ? (
              <li key={event.id} className={index > 0 ? 'ps-rule pt-4' : ''}>
                <EventForm
                  day={day}
                  event={event}
                  onDone={() => setEditing(null)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li
                key={event.id}
                className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 ${
                  index > 0 ? 'ps-rule' : ''
                }`}
              >
                {/* Ширины под «19:30» не хватает на «весь день», и он переносился
                    на две строки. Колонка считается по длинному из двух. */}
                <span className="ps-label w-20 shrink-0 tabular-nums">
                  {event.allDay ? t('allDay') : clock.format(new Date(event.startsAt))}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-base leading-snug text-ink">{event.title}</span>
                  {event.location || event.description ? (
                    <span className="mt-0.5 block text-sm leading-snug text-ink-muted">
                      {[event.location, event.description].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </span>

                <span className="ps-label shrink-0">
                  <span className="normal-case">{event.author}</span>
                </span>

                {canEdit ? (
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setEditing(event);
                      }}
                      className="ps-label text-ink-faint transition-colors hover:text-ink"
                    >
                      {t('edit')}
                    </button>
                    <RemoveButton id={event.id} label={t('remove')} />
                  </span>
                ) : null}
              </li>
            )
          )}
        </ul>
      ) : null}

      {adding ? (
        <EventForm day={day} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
      ) : null}
    </section>
  );
}

function RemoveButton({ id, label }: { id: string; label: string }) {
  const [state, action] = useActionState<CalendarState, FormData>(deleteEvent, {});

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <Submit label={label} className="ps-label text-ink-faint transition-colors hover:text-ink" />
      {state.error ? <span className="sr-only">{state.error}</span> : null}
    </form>
  );
}

/**
 * Одна форма на добавление и на правку.
 *
 * Разница между ними — скрытое поле `id`, и только оно: две формы разъехались бы
 * в первый же раз, когда в одну добавят поле, а про вторую забудут.
 *
 * Видны три поля — что, когда, во сколько. Остальное под «подробнее»: обычная
 * запись в общий календарь это «баскет, в четверг, в семь», и требовать от неё
 * место, конец и описание значит сделать частый случай неудобным ради редкого.
 */
function EventForm({
  day,
  event,
  onDone,
  onCancel
}: {
  day: string;
  event?: DayEvent;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('calendar');
  const [state, action] = useActionState<CalendarState, FormData>(saveEvent, {});
  const [more, setMore] = useState(Boolean(event?.location || event?.description || event?.endsAt));
  const first = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  // Сервер сказал «сохранено» — закрываем. Своего состояния «получилось» у формы
  // нет: страница всё равно перерисуется с новыми данными.
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const hhmm = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: ZONE
        }).format(new Date(iso))
      : '';

  const isoDay = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat('en-CA', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          timeZone: ZONE
        }).format(new Date(iso))
      : '';

  return (
    <form action={action} className="flex flex-col gap-3 py-2">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}

      <Field label={t('what')}>
        <input
          ref={first}
          name="title"
          defaultValue={event?.title ?? ''}
          maxLength={120}
          required
          className="w-full rounded border-2 border-rule bg-canvas px-3 py-2.5 text-base text-ink outline-none transition-colors focus:border-ink"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <DayField name="day" label={t('when')} value={event ? isoDay(event.startsAt) : day} />
        <Field label={t('at')}>
          <input
            type="time"
            name="time"
            defaultValue={event && !event.allDay ? hhmm(event.startsAt) : ''}
            className="w-full rounded border-2 border-rule bg-canvas px-3 py-2.5 text-base text-ink outline-none transition-colors focus:border-ink"
          />
        </Field>
      </div>

      {more ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <DayField
              name="endDay"
              label={t('untilDay')}
              value={isoDay(event?.endsAt ?? null)}
              clearable
            />
            <Field label={t('untilTime')}>
              <input
                type="time"
                name="endTime"
                defaultValue={hhmm(event?.endsAt ?? null)}
                className="w-full rounded border-2 border-rule bg-canvas px-3 py-2.5 text-base text-ink outline-none transition-colors focus:border-ink"
              />
            </Field>
          </div>
          <Field label={t('where')}>
            <input
              name="location"
              defaultValue={event?.location ?? ''}
              maxLength={120}
              className="w-full rounded border-2 border-rule bg-canvas px-3 py-2.5 text-base text-ink outline-none transition-colors focus:border-ink"
            />
          </Field>
          <Field label={t('details')}>
            <textarea
              name="description"
              defaultValue={event?.description ?? ''}
              maxLength={1000}
              rows={2}
              className="w-full resize-y rounded border-2 border-rule bg-canvas px-3 py-2.5 text-base text-ink outline-none transition-colors focus:border-ink"
            />
          </Field>
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Submit
          label={t('save')}
          className="ps-label rounded border-2 border-transparent bg-accent px-3.5 py-2.5 text-accent-ink transition-opacity hover:opacity-85 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={onCancel}
          className="ps-label rounded border-2 border-rule px-3.5 py-2.5 transition-colors hover:bg-sunk"
        >
          {t('cancel')}
        </button>
        {!more ? (
          <button
            type="button"
            onClick={() => setMore(true)}
            className="ps-label ms-auto text-ink-faint transition-colors hover:text-ink"
          >
            {t('moreFields')}
          </button>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-reactor">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="ps-label">{label}</span>
      {children}
    </label>
  );
}

function Submit({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {label}
    </button>
  );
}
