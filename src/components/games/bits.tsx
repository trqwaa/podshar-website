import Image from 'next/image';

import { Link } from '@/i18n/routing';

/**
 * Мелкие части доски игр — те же, что в плитках шторки, только для сервера.
 *
 * В шторке это клиентские компоненты со своими переводами. Здесь вся доска
 * рисуется на сервере, и подписи приходят готовыми строками: браузеру незачем
 * получать раздел переводов ради трёх букв «В», «П» и «≈».
 */

/** Имена медалей — по-английски на всех языках, как в шторке: так их и называют. */
export const MEDALS = [
  'Herald',
  'Guardian',
  'Crusader',
  'Archon',
  'Legend',
  'Ancient',
  'Divine',
  'Immortal'
];

/**
 * Как подписать ранг, на котором посчитана мета.
 *
 * Отдельной статистики по Immortal у OpenDota нет, и мета для него считается по
 * Divine и выше. Написать «мета на Immortal» было бы враньём о выборке.
 */
export const metaRankName = (bracket: number) => (bracket === 8 ? 'Divine+' : MEDALS[bracket - 1]);

/** Плашка исхода. Цвет ускоряет чтение, буква оставляет смысл тому, кто цвета не различает. */
export function ResultChip({
  result,
  letter,
  spoken
}: {
  result: 'WIN' | 'LOSS' | 'DRAW';
  letter: string;
  /** Исход словом — для скринридера. Буква в плашке ему ничего не говорит. */
  spoken: string;
}) {
  const tone = result === 'WIN' ? 'bg-win' : result === 'LOSS' ? 'bg-loss' : 'bg-ink-faint';
  return (
    <>
      <span
        aria-hidden="true"
        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-sm text-[0.625rem] font-bold leading-none text-surface ${tone}`}
      >
        {letter}
      </span>
      <span className="sr-only">{spoken}</span>
    </>
  );
}

/** Процент победы с тем же светофором, что в шторке: 51 и выше — зелёный, до 45 — красный. */
export function Pct({
  value,
  locale,
  className = ''
}: {
  value: number;
  locale: string;
  className?: string;
}) {
  const pct = value * 100;
  const tone = pct >= 51 ? 'text-win' : pct >= 45 ? 'text-amber' : 'text-loss';
  // Форматом языка страницы: запятая по-русски и по-немецки, точка по-английски.
  const text = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value);
  return (
    <span className={`whitespace-nowrap font-semibold tabular-nums ${tone} ${className}`}>
      {text}
    </span>
  );
}

/** Сколько очков пришло или ушло. «≈» — когда число оценка, а не факт. */
export function Delta({ value, estimated }: { value: number | null; estimated?: boolean }) {
  if (value === null) return <span className="tabular-nums text-ink-faint">—</span>;
  const tone = value > 0 ? 'text-win' : value < 0 ? 'text-loss' : 'text-ink-muted';
  // Настоящий минус, а не дефис: цифры стоят в столбик, и дефис короче плюса.
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return (
    <span className={`font-semibold tabular-nums ${tone}`}>
      {estimated ? '≈ ' : ''}
      {sign}
      {Math.abs(value)}
    </span>
  );
}

/**
 * Иконка героя из `public/dota/heroes`. Нет файла — первые буквы имени в
 * квадрате того же размера: герой, вышедший после скачивания иконок, не должен
 * ломать строку ни битой картинкой, ни дырой.
 */
export function HeroIcon({
  hero,
  size = 28
}: {
  hero: { key: string; name: string; hasIcon: boolean } | undefined;
  size?: number;
}) {
  if (hero?.hasIcon) {
    return (
      <Image
        src={`/dota/heroes/${hero.key}.png`}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-sm"
        style={{ width: size, height: size }}
      />
    );
  }
  return <Initials name={hero?.name ?? '?'} size={size} />;
}

export function BrawlerIcon({
  brawler,
  size = 28
}: {
  brawler: { id: number; name: string; hasIcon: boolean } | undefined;
  size?: number;
}) {
  if (brawler?.hasIcon) {
    return (
      <Image
        src={`/brawl/brawlers/${brawler.id}.png`}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return <Initials name={brawler?.name ?? '?'} size={size} />;
}

function Initials({ name, size }: { name: string; size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-sm bg-sunk text-[0.625rem] font-semibold normal-case text-ink-muted"
    >
      {name.slice(0, 2)}
    </span>
  );
}

/**
 * Переключатель видов — ссылками, как список задач. Вид живёт в адресе, а не в
 * состоянии: его можно прислать в чат («глянь позор») и он откроется тем же.
 */
export function Segmented({
  label,
  items,
  fill = false
}: {
  label: string;
  items: { href: string; text: string; active: boolean }[];
  /**
   * На телефоне — сеткой два на два во всю ширину, с `sm` — обычным рядом.
   *
   * Сначала был ряд, и «бравл» в 390px уезжал на вторую строку один; ровными
   * четвертями не влезало «сравнить»; рядом с переносом на 360px выходило три
   * кнопки сверху и одна снизу — и по-немецки так было даже на 390. Два на два
   * одинаково ровно на любом языке и любой ширине.
   */
  fill?: boolean;
}) {
  return (
    <nav
      aria-label={label}
      className={
        fill ? 'grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center' : 'flex flex-wrap items-center gap-2'
      }
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={`h-10 whitespace-nowrap rounded border-2 text-center text-base leading-[2.1] transition-colors duration-drape ease-drape ${
            fill ? 'px-2 sm:px-4' : 'px-3 sm:px-4'
          } ${item.active ? 'border-ink bg-ink text-canvas' : 'border-rule text-ink-muted hover:bg-sunk hover:text-ink'}`}
        >
          {item.text}
        </Link>
      ))}
    </nav>
  );
}

/** Кнопка-ссылка второго ряда: «сравнить», «вся дота». */
export function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-2 rounded border-2 border-rule px-4 text-base text-ink transition-colors duration-drape ease-drape hover:bg-sunk"
    >
      {children}
      <span aria-hidden="true" className="text-ink-faint">
        →
      </span>
    </Link>
  );
}
