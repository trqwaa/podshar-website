import { getTranslations } from 'next-intl/server';

import { BUILD } from '@/lib/build';
import { ZONE } from '@/lib/calendar/scales';
import { CURRENT_VERSION, PATCHES } from '@/lib/patches';
import { getMemberNames } from '@/lib/session';
import type { Locale } from '@/i18n/routing';

/**
 * Даты патчей разбираются в UTC. Строка вида `2026-09-08` и так означает
 * полночь UTC, и форматирование в чужой зоне сдвинуло бы половину записей на
 * день назад.
 */
function formatter(locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC'
  });
}

/**
 * Весь список, на своей странице. Прокрутки внутри нет — прокручивается
 * страница, а это и есть вся её работа.
 */
export async function PatchList({ locale }: { locale: Locale }) {
  const day = formatter(locale);
  // Одним запросом на весь список, а не по строке на патч.
  const [t, names] = await Promise.all([
    getTranslations({ locale, namespace: 'patches' }),
    getMemberNames([...new Set(PATCHES.map((patch) => patch.author))])
  ]);

  // Время сборки — по Цюриху, как всё датированное на сайте. Здесь, в отличие
  // от дат патчей, важен час: две выкатки за вечер — обычное дело.
  const built = BUILD.at
    ? new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: ZONE
      }).format(BUILD.at)
    : '—';

  return (
    <>
      {/* Номер сборки — для отладки, а не для чтения: видно, какой коммит
          сейчас отвечает, и не застрял ли автодеплой на старом. Ссылка ведёт
          на сам коммит на GitHub. */}
      {/* `normal-case`: строка каталога и так строчная, а в номере бывает буква —
          `1.16B`, — и `ps-label` превращал её в `1.16b`, которого в списке нет. */}
      <p className="ps-label pb-2 pt-1 normal-case tabular-nums">
        {t.rich('build', {
          version: CURRENT_VERSION,
          id: BUILD.short,
          when: built,
          sha: (chunks) =>
            BUILD.url ? (
              <a
                href={BUILD.url}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-rule underline-offset-2 transition-colors duration-drape ease-drape hover:text-ink"
              >
                {chunks}
              </a>
            ) : (
              chunks
            )
        })}
      </p>
      <PatchRows day={day} names={names} />
    </>
  );
}

function PatchRows({ day, names }: { day: Intl.DateTimeFormat; names: Record<string, string> }) {
  return (
    <ol>
      {PATCHES.map((patch, index) => (
        // Две раскладки одной сеткой. На узком экране номер и подпись делят
        // верхнюю строку, а текст занимает всю ширину под ними — иначе номер
        // съедает целую строку. На широком всё выстраивается в одну строку, и
        // порядок меняет `order`, а не вторая разметка: одна разметка не может
        // разъехаться сама с собой.
        <li
          key={patch.version}
          className={`grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 py-3 sm:grid-cols-[3.5rem_1fr_auto] ${
            index > 0 ? 'ps-rule' : ''
          }`}
        >
          <span className="text-base font-semibold tabular-nums text-ink sm:order-1">
            {patch.version}
          </span>
          <span className="ps-label justify-self-end tabular-nums sm:order-3">
            {day.format(new Date(patch.date))} &middot;{' '}
            {/* `ps-label` переводит всё в строчные — это верно для подписи и
                неверно для имени человека: «Trqwaa» превращался в «trqwaa».
                Дата остаётся лейблом, имя из регистра не выбивают. */}
            <span className="normal-case">
              {names[patch.author.toLowerCase()] ?? `@${patch.author}`}
            </span>
          </span>
          <span className="col-span-2 text-base leading-snug text-ink sm:order-2 sm:col-span-1">
            {patch.note}
          </span>
        </li>
      ))}
    </ol>
  );
}
