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
export const MEDALS = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'];

/**
 * Как подписать ранг, на котором посчитана мета.
 *
 * Отдельной статистики по Immortal у OpenDota нет, и мета для него считается по
 * Divine и выше. Написать «мета на Immortal» было бы враньём о выборке.
 */
export const metaRankName = (bracket: number) => (bracket === 8 ? 'Divine+' : MEDALS[bracket - 1]);

/** Плашка исхода. Цвет ускоряет чтение, буква оставляет смысл тому, кто цвета не различает. */
export function ResultChip({ result, letter }: { result: 'WIN' | 'LOSS' | 'DRAW'; letter: string }) {
  const tone = result === 'WIN' ? 'bg-win' : result === 'LOSS' ? 'bg-loss' : 'bg-ink-faint';
  return (
    <span
      aria-hidden="true"
      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-sm text-[0.625rem] font-bold leading-none text-surface ${tone}`}
    >
      {letter}
    </span>
  );
}

/** Процент победы с тем же светофором, что в шторке: 51 и выше — зелёный, до 45 — красный. */
export function Pct({ value, className = '' }: { value: number; className?: string }) {
  const pct = value * 100;
  const tone = pct >= 51 ? 'text-win' : pct >= 45 ? 'text-amber' : 'text-loss';
  return <span className={`font-semibold tabular-nums ${tone} ${className}`}>{pct.toFixed(1)}%</span>;
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
  items
}: {
  label: string;
  items: { href: string; text: string; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          // Уже на телефоне: четыре вида в 390px помещаются в одну строку только так.
          className={`h-10 rounded border-2 px-3 text-base leading-[2.1] transition-colors duration-drape ease-drape sm:px-4 ${
            item.active ? 'border-ink bg-ink text-canvas' : 'border-rule text-ink-muted hover:bg-sunk hover:text-ink'
          }`}
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
