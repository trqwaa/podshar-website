import 'server-only';

import { zurichAt } from '@/lib/calendar/events';
import { dayKey } from '@/lib/calendar/scales';

/**
 * Импорт сна из файла.
 *
 * У Zepp Life (бывший Mi Fit) нет открытого API. Свои данные он отдаёт двумя
 * путями: синхронизацией в Apple Health / Health Connect и выгрузкой архива
 * по запросу (в приложении: профиль → настройки → «экспорт данных», архив
 * приходит на почту). В архиве папка `SLEEP` с CSV такого вида:
 *
 *   date,deepSleepTime,shallowSleepTime,wakeTime,start,stop,REMTime,naps
 *
 * Минуты сна — суммой фаз, начало и конец — секунды эпохи или дата со смещением.
 * Колонки `REMTime` и `naps` есть не в каждой версии, поэтому они необязательны.
 *
 * Второй формат — простой CSV из любой другой программы: колонка с началом и
 * колонка с концом сна (`bedtime`/`start`/`sleep start`… и `wake`/`end`/`stop`…).
 * Время без пояса читается по Цюриху, как всё на сайте.
 */

export type ImportedNight = {
  night: string;
  bedAt: Date;
  wakeAt: Date;
  minutes: number;
  deep: number | null;
  rem: number | null;
};

/** Сколько ночей за раз: архив за пять лет — это 1800 строк, а не повод держать запрос минуту. */
export const MAX_NIGHTS = 400;

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if ((ch === ',' || ch === ';') && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Секунды или миллисекунды эпохи, ISO, «2024-01-01 23:10:00+0000» или местное «2024-01-01 23:10». */
function parseMoment(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{9,13}$/.test(value)) {
    const n = Number(value);
    return new Date(value.length >= 13 ? n : n * 1000);
  }
  const local = value.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})[ T](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (local) {
    const [, y, mo, d, h, mi] = local;
    return zurichAt(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`, `${h.padStart(2, '0')}:${mi}`);
  }
  const normal = value.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const at = new Date(normal);
  return Number.isNaN(at.getTime()) ? null : at;
}

const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Колонка по первому подходящему имени из списка — порядок имён и есть
 * приоритет. Не наоборот: у Zepp `wakeTime` — это минуты, пролежанные без сна,
 * а не время подъёма, и стоит она раньше `stop`; поиск «по порядку колонок»
 * брал её за конец сна.
 */
function pick(header: string[], names: string[]): number {
  const clean = header.map((h) => h.replace(/[\s_-]/g, ''));
  for (const name of names) {
    const i = clean.indexOf(name.replace(/[\s_-]/g, ''));
    if (i >= 0) return i;
  }
  return -1;
}

export function parseSleepCsv(text: string): { nights: ImportedNight[]; format: 'zepp' | 'generic' | null } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { nights: [], format: null };
  const header = splitCsv(lines[0]).map((h) => h.toLowerCase());

  const deepCol = pick(header, ['deepsleeptime']);
  const lightCol = pick(header, ['shallowsleeptime']);
  const remCol = pick(header, ['remtime']);
  const zepp = deepCol >= 0 && lightCol >= 0;

  const startCol = pick(header, ['start', 'bedtime', 'sleepstart', 'starttime', 'start time', 'begin', 'from', 'einschlafen']);
  const stopCol = pick(header, ['stop', 'end', 'sleepend', 'endtime', 'end time', 'wakeup', 'wake up', 'wake', 'to', 'aufwachen', ...(zepp ? [] : ['waketime'])]);
  if (startCol < 0 || stopCol < 0) return { nights: [], format: null };

  const byNight = new Map<string, ImportedNight>();
  for (const line of lines.slice(1)) {
    const cells = splitCsv(line);
    const bedAt = parseMoment(cells[startCol] ?? '');
    const wakeAt = parseMoment(cells[stopCol] ?? '');
    if (!bedAt || !wakeAt || wakeAt <= bedAt) continue;
    const span = Math.round((wakeAt.getTime() - bedAt.getTime()) / 60_000);
    // Больше суток подряд — не ночь, а сломанная строка.
    if (span < 30 || span > 20 * 60) continue;
    const deep = zepp ? num(cells[deepCol]) : null;
    const rem = zepp && remCol >= 0 ? num(cells[remCol]) : null;
    const phases = zepp ? num(cells[deepCol]) + num(cells[lightCol]) + (rem ?? 0) : 0;
    const minutes = phases > 0 ? Math.min(phases, span) : span;
    const night = dayKey(wakeAt);
    // Две записи на одно утро (дневной сон, перезапуск часов) — берём длинную.
    const seen = byNight.get(night);
    if (!seen || seen.minutes < minutes) byNight.set(night, { night, bedAt, wakeAt, minutes, deep, rem });
  }

  const nights = [...byNight.values()].sort((a, b) => b.night.localeCompare(a.night)).slice(0, MAX_NIGHTS);
  return { nights, format: zepp ? 'zepp' : 'generic' };
}
