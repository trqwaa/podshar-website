/**
 * Чтение чужих выгрузок: Strong, FatSecret.
 *
 * Таблица разбирается целиком, а не по строкам: в заметках Strong бывают
 * переносы внутри кавычек. Разделитель — тот, которого в заголовке больше:
 * европейский Strong пишет через точку с запятой и с десятичной запятой
 * («82,5»), и разбивка ещё и по запятым рвала бы вес надвое.
 */

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const head = src.slice(0, Math.max(0, src.search(/\r?\n/)) || src.length);
  const count = (ch: string) => head.split(ch).length - 1;
  const delimiter = [',', ';', '\t'].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ',');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/** Число из таблицы: «82,5», «82.5», «1 234», «1,234.5», «250 g». Пусто или не число — `null`. */
export function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  let v = raw.replace(/[\s  ]/g, '').match(/-?\d[\d.,]*/)?.[0];
  if (!v) return null;
  if (v.includes(',') && v.includes('.')) {
    // Оба знака — десятичный тот, что правее: «1.234,5» и «1,234.5».
    v = v.lastIndexOf(',') > v.lastIndexOf('.') ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  } else if (v.includes(',')) {
    // «1,234» — тысячи по-американски, «82,5» — десятичная запятая.
    v = /^-?[1-9]\d{0,2}(,\d{3})+$/.test(v) ? v.replace(/,/g, '') : v.replace(',', '.');
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Номер колонки: первая, чьё имя подходит под одно из выражений и не подходит под `not`. */
export function column(header: string[], patterns: RegExp[], not?: RegExp): number {
  for (const p of patterns) {
    const i = header.findIndex((h) => p.test(h) && !(not && not.test(h)));
    if (i >= 0) return i;
  }
  return -1;
}

const MONTHS: [RegExp, number][] = [
  [/^(jan|янв|січ|jän)/, 1],
  [/^(feb|фев|лют)/, 2],
  [/^(mar|mär|мар|бер)/, 3],
  [/^(apr|апр|кві)/, 4],
  [/^(may|mai|ма[йя]|трав)/, 5],
  [/^(jun|июн|чер)/, 6],
  [/^(jul|июл|лип)/, 7],
  [/^(aug|авг|серп)/, 8],
  [/^(sep|сен|вер)/, 9],
  [/^(oct|okt|окт|жов)/, 10],
  [/^(nov|ноя|лис)/, 11],
  [/^(dec|dez|дек|груд)/, 12]
];

const pad = (n: number) => String(n).padStart(2, '0');
const valid = (y: number, m: number, d: number) => (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);

/**
 * День из чего угодно: «2026-10-30», «30.10.2026», «10/30/2026», «Friday,
 * October 30, 2026», «30 октября 2026», «30. Oktober 2026». Косая черта — это
 * американский порядок «месяц/день», если первое число не больше двенадцати.
 */
export function parseDay(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  let m = v.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) return valid(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return +m[1] > 12 ? valid(y, +m[2], +m[1]) : valid(y, +m[1], +m[2]);
  }
  const year = v.match(/\b(20\d{2})\b/);
  if (!year) return null;
  const words = v.replace(/[.,]/g, ' ').split(/\s+/);
  const month = words.map((w) => MONTHS.find(([re]) => re.test(w))?.[1]).find(Boolean);
  const day = words.map((w) => (/^\d{1,2}$/.test(w) ? +w : null)).find((d) => d !== null);
  return month && day ? valid(+year[1], month, day) : null;
}
