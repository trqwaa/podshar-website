'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import type { News, NewsEntry } from '@/lib/news';
import { PersonButton } from './PersonPeek';
import { ScrollPane } from './ScrollPane';
import { TagIcon } from './Icons';
import { MemberAvatar } from './profile/MemberAvatar';

/**
 * Новости на главной: одна плитка, которая листается.
 *
 * Окна за ней нет — решение владельца от 20 октября 2026: новости — то, что
 * видно сразу, а не после клика. Сверху «дальше в календаре» синей карточкой,
 * под ней что нового у остальных, ниже неделя календаря. Листается колесом,
 * ползунком и пальцем; почему ползунок свой — в `ScrollPane`.
 *
 * Карточка того же синего, что весь интерактив сайта, и это намеренно: на
 * рабочем портале владельца, откуда взят образец, ближайшая встреча стоит
 * именно так, и глаз находит её первой. Красный — нет: он только у ядра
 * кнопки ПХ. Над ней, пока не вписан день рождения, — тёмная карточка с
 * напоминанием: владелец просил, чтобы её было не пропустить.
 *
 * Все строки приходят с сервера готовыми (`lib/news.ts`), здесь только
 * раскладка и «непрочитано».
 *
 * Непрочитанное — чужое, что появилось после прошлого раза, когда плитка
 * побыла на экране. Именно на экране, а не на странице: на телефоне плитка
 * ниже кнопки, и открыть главную ещё не значит её увидеть. Точки стоят до
 * следующего захода — иначе по списку не понять, что в нём новое. Хранится в
 * браузере зрителя: это удобство, а не данные, и потерять его — значит один
 * раз увидеть точки заново. Считается после монтирования: сервер не знает,
 * когда ты смотрел, и точки, нарисованные им, разошлись бы с браузером при
 * гидратации.
 */

const SEEN_KEY = 'podshar:news-seen';
/** Номер последнего увиденного патча: у патчей нет часа, и время их не различает. */
const SEEN_PATCH_KEY = 'podshar:news-seen-patch';
/** Первый раз: «новым» считается то, что появилось за последние двое суток. */
const FIRST_LOOK_MS = 2 * 86_400_000;
/** Сколько плитка должна пробыть на экране, чтобы новое стало прочитанным. */
const LOOK_MS = 2000;

export function NewsPanel({ news, className = '' }: { news: News; className?: string }) {
  const t = useTranslations('news');
  const tile = useRef<HTMLElement>(null);
  /** Когда видел ленту и какой последний патч в ней был. */
  const [seen, setSeen] = useState<{ at: number; seq: number | null } | null>(null);

  useEffect(() => {
    let at = NaN;
    let seq = NaN;
    try {
      at = Number(window.localStorage.getItem(SEEN_KEY));
      seq = Number(window.localStorage.getItem(SEEN_PATCH_KEY));
    } catch {
      // Приватное окно: точки покажутся за двое суток, и всё.
    }
    setSeen({
      at: Number.isFinite(at) && at > 0 ? at : Date.now() - FIRST_LOOK_MS,
      seq: Number.isFinite(seq) && seq > 0 ? seq : null
    });
  }, []);

  const lastPatch = news.feed.reduce((max, entry) => Math.max(max, entry.seq ?? 0), 0);

  // Отметка — момент, когда сервер собрал ленту, а не «сейчас» в браузере:
  // пришедшее после него на экране не было. И время это серверное, как у самих
  // записей, — часы зрителя в сравнении не участвуют. Самая свежая запись на
  // эту роль не годится: у патча нет часа, и патч с полуднем, увиденный в
  // десять утра, делал непрочитанным всё, что появлялось до полудня.
  useEffect(() => {
    const el = tile.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watch = new IntersectionObserver(
      (entries) => {
        const seen = entries[entries.length - 1];
        clearTimeout(timer);
        // Доля на экране, а не «хоть краешек»: `isIntersecting` верен и для
        // плитки, выглядывающей снизу парой строк, и для пролистанной мимо.
        if (!seen || seen.intersectionRatio < 0.6) return;
        const mark = () => {
          // Под окном — фразой дня, пультом — плитка «в кадре», но её не видно:
          // ждём, пока окно закроют.
          if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
            timer = setTimeout(mark, LOOK_MS);
            return;
          }
          watch.disconnect();
          try {
            if (news.now > Number(window.localStorage.getItem(SEEN_KEY) || 0)) {
              window.localStorage.setItem(SEEN_KEY, String(news.now));
            }
            if (lastPatch > Number(window.localStorage.getItem(SEEN_PATCH_KEY) || 0)) {
              window.localStorage.setItem(SEEN_PATCH_KEY, String(lastPatch));
            }
          } catch {
            // Без хранилища точки просто вернутся в следующий раз.
          }
        };
        timer = setTimeout(mark, LOOK_MS);
      },
      // Ноль — чтобы узнать и об уходе с экрана, а не только о пересечении 0.6.
      { threshold: [0, 0.6] }
    );
    watch.observe(el);
    return () => {
      clearTimeout(timer);
      watch.disconnect();
    };
  }, [news.now, lastPatch]);

  // Патч — по номеру, если номер уже запомнен; остальное и первый взгляд — по времени.
  const unread = (entry: NewsEntry) =>
    seen !== null &&
    !entry.mine &&
    (entry.seq !== undefined && seen.seq !== null ? entry.seq > seen.seq : entry.at > seen.at);
  const count = news.feed.filter(unread).length;

  return (
    <section
      ref={tile}
      aria-label={t('label')}
      className={`block-card animate-rise-in flex flex-col gap-4 p-6 [animation-delay:150ms] ${className}`}
    >
      {/* Высота строки — по плашке числа: число появляется после монтирования,
          и строка без запаса подрастала бы на 8 px, сдвигая всё под плиткой. */}
      <p className="ps-label flex h-5 items-center gap-2">
        {t('label')}
        {count > 0 ? <Badge count={count} label={t('unread', { n: count })} /> : null}
      </p>

      {/* Высота постоянная: плитка стоит в колонке рядом с кнопкой, и лента в
          двадцать строк вытянула бы колонку, а с ней и кнопку. */}
      <ScrollPane label={t('label')} className="h-80 md:h-72">
        <div className="flex flex-col gap-5">
          {news.askBirthday ? (
            <Link
              href="/profile#birthday"
              className="block rounded-block bg-ink px-4 py-3 text-canvas transition-opacity duration-180 hover:opacity-90"
            >
              <span className="flex items-center gap-2 text-sm opacity-80">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-canvas" />
                {t('birthdayAsk')}
              </span>
              <span className="mt-0.5 block text-base font-semibold">{t('birthdayTitle')}</span>
              <span className="block text-sm opacity-80">{t('birthdayHint')}</span>
            </Link>
          ) : null}

          {news.next ? (
            <Link
              href={news.next.href}
              className="block rounded-block bg-accent px-4 py-3 text-accent-ink transition-opacity duration-180 hover:opacity-90"
            >
              <span className="block text-sm opacity-80">{t('next')}</span>
              <span className="mt-0.5 block truncate text-base font-semibold">{news.next.title}</span>
              <span className="block truncate text-sm tabular-nums">
                {news.next.when}
                {news.next.where ? ` · ${news.next.where}` : ''}
              </span>
            </Link>
          ) : (
            <p className="text-sm text-ink-muted">{t('nothingAhead')}</p>
          )}

          <section aria-label={t('feed')}>
            <h3 className="ps-label mb-1">{t('feed')}</h3>
            {news.feed.length ? (
              <ul className="flex flex-col">
                {news.feed.map((entry) => (
                  <li key={entry.id} className="relative -mx-2 flex rounded px-2 py-2 transition-colors duration-180 hover:bg-sunk">
                    <Row entry={entry} unread={unread(entry)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">{t('feedEmpty')}</p>
            )}
          </section>

          {news.days.length ? (
            <section aria-label={t('ahead')}>
              <h3 className="ps-label mb-2">{t('ahead')}</h3>
              <ol className="flex flex-col gap-3">
                {news.days.map((day) => (
                  <li key={day.label}>
                    <p className="text-sm font-semibold text-ink">{day.label}</p>
                    {/* Пунктир слева — как у образца: дни читаются колонкой, а
                        не россыпью строк. Цвет — тот же синий, что у карточки. */}
                    <ul className="mt-1 flex flex-col border-l-2 border-dotted border-accent/50 ps-3">
                      {day.items.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={item.href}
                            className="flex items-baseline gap-3 rounded py-1 transition-colors duration-180 hover:bg-sunk"
                          >
                            <span className="w-24 shrink-0 text-xs tabular-nums text-ink-muted">{item.time}</span>
                            <span className="min-w-0 flex-1 truncate text-sm text-ink">{item.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </ScrollPane>
    </section>
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
 * под ними текст в две строки, и синяя точка у нового.
 *
 * Туда, где это случилось, ведёт вся строка — ссылкой, растянутой по ней
 * (`after:inset-0`), а не обёрткой: аватарка и имя — свои кнопки
 * (`PersonButton`), а кнопка внутри ссылки — недопустимая вложенность. Кнопки
 * стоят над растянутой ссылкой (`z-10`) и забирают свои нажатия.
 */
function Row({ entry, unread }: { entry: NewsEntry; unread: boolean }) {
  const name = (
    <span className="flex min-w-0 items-center gap-1.5">
      {unread ? <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
      <span className={`truncate text-sm text-ink ${unread ? 'font-semibold' : 'font-medium'}`}>
        {entry.who?.name ?? 'podshar'}
      </span>
    </span>
  );
  return (
    <span className="flex w-full min-w-0 items-start gap-3">
      {entry.who ? (
        <PersonButton who={entry.who} className="relative z-10 shrink-0 rounded-full">
          <MemberAvatar preset={entry.who.avatarPreset} displayName={entry.who.name} className="h-8 w-8" />
        </PersonButton>
      ) : (
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-rule text-ink-muted"
        >
          <TagIcon />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          {entry.who ? (
            <PersonButton who={entry.who} className="relative z-10 min-w-0">
              {name}
            </PersonButton>
          ) : (
            name
          )}
          <span className="shrink-0 text-xs tabular-nums text-ink-muted">{entry.when}</span>
        </span>
        <Link href={entry.href} className="line-clamp-2 text-sm text-ink-muted after:absolute after:inset-0">
          {entry.text}
        </Link>
      </span>
    </span>
  );
}
