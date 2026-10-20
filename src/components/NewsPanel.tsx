'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import type { News, NewsEntry } from '@/lib/news';
import { Modal } from './Modal';
import { TagIcon } from './Icons';
import { MemberAvatar } from './profile/MemberAvatar';

/**
 * Новости на главной: плитка и окно за ней.
 *
 * Плитка — кнопка, как у погоды: на ней «дальше в календаре» синей карточкой и
 * две последние новости, а всё остальное — в окне. Карточка того же синего,
 * что весь интерактив сайта, и это намеренно: на рабочем портале владельца,
 * откуда взят образец, ближайшая встреча стоит именно так, и глаз находит её
 * первой. Красный — нет: он только у ядра кнопки ПХ.
 *
 * Все строки приходят с сервера готовыми (`lib/news.ts`), здесь только
 * раскладка и «непрочитано».
 *
 * Непрочитанное — что появилось после последнего открытия окна, и только
 * чужое. Хранится в браузере зрителя: это удобство, а не данные, и потерять
 * его — значит один раз увидеть точки заново. Считается после монтирования:
 * сервер не знает, когда ты смотрел, и точки, нарисованные им, разошлись бы с
 * браузером при гидратации.
 */

const SEEN_KEY = 'podshar:news-seen';
/** Первый раз: «новым» считается то, что появилось за последние двое суток. */
const FIRST_LOOK_MS = 2 * 86_400_000;

export function NewsPanel({ news, className = '' }: { news: News; className?: string }) {
  const t = useTranslations('news');
  const tHome = useTranslations('home');
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<number | null>(null);

  useEffect(() => {
    let stored = NaN;
    try {
      stored = Number(window.localStorage.getItem(SEEN_KEY));
    } catch {
      // Приватное окно: точки покажутся за двое суток, и всё.
    }
    setSeenAt(Number.isFinite(stored) && stored > 0 ? stored : Date.now() - FIRST_LOOK_MS);
  }, []);

  const unread = (entry: NewsEntry) => seenAt !== null && !entry.mine && entry.at > seenAt;
  const count = news.feed.filter(unread).length;

  // Открыл окно — значит увидел. Точки при этом стоят, пока окно открыто:
  // иначе нельзя было бы понять, что из списка новое. Гаснут при закрытии.
  const show = () => {
    setOpen(true);
    try {
      window.localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      // Без хранилища точки просто вернутся в следующий раз.
    }
  };
  const hide = () => {
    setOpen(false);
    setSeenAt(Date.now());
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`block-card animate-rise-in flex w-full flex-col gap-4 p-6 text-left transition-colors duration-drape ease-drape [animation-delay:150ms] hover:bg-sunk ${className}`}
      >
        <p className="flex items-baseline justify-between gap-3">
          <span className="ps-label flex items-center gap-2">
            {t('label')}
            {count > 0 ? <Badge count={count} label={t('unread', { n: count })} /> : null}
          </span>
          <span aria-hidden="true" className="ps-label">
            {t('more')}&nbsp;›
          </span>
        </p>

        {news.next ? (
          <span className="block rounded-block bg-accent px-4 py-3 text-accent-ink">
            <span className="block text-sm opacity-80">{t('next')}</span>
            <span className="mt-0.5 block truncate text-base font-semibold">{news.next.title}</span>
            <span className="block text-sm tabular-nums">{news.next.when}</span>
          </span>
        ) : (
          <span className="text-sm text-ink-muted">{t('nothingAhead')}</span>
        )}

        {news.feed.length ? (
          <span className="flex flex-col gap-3">
            {news.feed.slice(0, 2).map((entry) => (
              <Row key={entry.id} entry={entry} unread={unread(entry)} compact />
            ))}
          </span>
        ) : (
          <span className="text-sm text-ink-muted">{t('feedEmpty')}</span>
        )}
      </button>

      <AnimatePresence>
        {open ? (
          <Modal key="news" title={t('title')} hint={t('hint')} close={tHome('close')} onClose={hide}>
            <div className="flex flex-col gap-10 pt-4">
              <section aria-label={t('ahead')}>
                <h3 className="ps-label mb-3">{t('ahead')}</h3>
                {news.next ? (
                  <Link
                    href={news.next.href}
                    className="block rounded-block bg-accent px-5 py-4 text-accent-ink transition-opacity duration-180 hover:opacity-90"
                  >
                    <span className="block text-sm opacity-80">{t('next')}</span>
                    <span className="mt-1 block text-lg font-semibold leading-tight">{news.next.title}</span>
                    <span className="mt-0.5 block text-base tabular-nums">
                      {news.next.when}
                      {news.next.where ? ` · ${news.next.where}` : ''}
                    </span>
                  </Link>
                ) : (
                  <p className="text-base text-ink-muted">{t('nothingAhead')}</p>
                )}

                {news.days.length ? (
                  <ol className="mt-6 flex flex-col gap-5">
                    {news.days.map((day) => (
                      <li key={day.label}>
                        <p className="text-base font-semibold text-ink">{day.label}</p>
                        {/* Пунктир слева — как у образца: дни читаются колонкой, а
                            не россыпью строк. Цвет — тот же синий, что у карточки. */}
                        <ul className="mt-2 flex flex-col border-l-2 border-dotted border-accent/50 ps-3">
                          {day.items.map((item) => (
                            <li key={item.id}>
                              <Link
                                href={item.href}
                                className="flex items-baseline gap-3 rounded py-1.5 transition-colors duration-180 hover:bg-sunk"
                              >
                                <span className="w-28 shrink-0 text-sm tabular-nums text-ink-muted">{item.time}</span>
                                <span className="min-w-0 flex-1 truncate text-base text-ink">{item.title}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>

              <section aria-label={t('feed')}>
                <h3 className="ps-label mb-3 flex items-center gap-2">
                  {t('feed')}
                  {count > 0 ? <Badge count={count} label={t('unread', { n: count })} /> : null}
                </h3>
                {news.feed.length ? (
                  <ul className="flex flex-col">
                    {news.feed.map((entry) => (
                      <li key={entry.id}>
                        <Link
                          href={entry.href}
                          className="-mx-2 flex rounded px-2 py-2.5 transition-colors duration-180 hover:bg-sunk"
                        >
                          <Row entry={entry} unread={unread(entry)} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-base text-ink-muted">{t('feedEmpty')}</p>
                )}
              </section>
            </div>
          </Modal>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/** Число новых — тёмной плашкой. Само число без слова; слово — для скринридера. */
function Badge({ count, label }: { count: number; label: string }) {
  return (
    <span
      aria-label={label}
      className="inline-grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-ink px-1.5 text-[0.6875rem] font-semibold tabular-nums leading-none tracking-normal text-canvas"
    >
      {count}
    </span>
  );
}

/**
 * Строка ленты: кто, когда, что. Как во входящих: имя жирным, время справа,
 * под ними одна строка, и синяя точка у нового.
 */
function Row({ entry, unread, compact = false }: { entry: NewsEntry; unread: boolean; compact?: boolean }) {
  const size = compact ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <span className="flex w-full min-w-0 items-start gap-3">
      {entry.who ? (
        <MemberAvatar preset={entry.who.avatarPreset} displayName={entry.who.name} className={size} />
      ) : (
        <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full border-2 border-rule text-ink-muted ${size}`}>
          <TagIcon />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            {unread ? <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
            <span className={`truncate text-ink ${unread ? 'font-semibold' : 'font-medium'} ${compact ? 'text-sm' : 'text-base'}`}>
              {entry.who?.name ?? 'podshar'}
            </span>
          </span>
          <span className="shrink-0 text-xs tabular-nums text-ink-muted">{entry.when}</span>
        </span>
        <span className="block truncate text-sm text-ink-muted">{entry.text}</span>
      </span>
    </span>
  );
}
