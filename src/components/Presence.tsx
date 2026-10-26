'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { PersonButton } from './PersonPeek';
import { MemberAvatar } from './profile/MemberAvatar';
import type { PresenceEntry } from '@/lib/types';

/** One heartbeat this often while the tab is in front of somebody. */
const BEAT_MS = 45_000;
/** Seen this recently counts as here: two missed beats and a little slack. */
const ONLINE_MS = 2 * 60_000;
/** How the heartbeat hands its answer to the board. */
const EVENT = 'podshar:presence';

type Payload = { people: PresenceEntry[]; now?: number };

/**
 * Разница часов сервера и зрителя по последнему ответу пульса.
 *
 * Снаружи компонента: при «назад» Next поднимает главную из своего кеша, со
 * старым `serverNow` двадцатиминутной давности, и разница, посчитанная по нему,
 * сделала бы ушедшего снова «тут». Ответ пульса свежий всегда, поэтому, раз он
 * был, верим ему; `serverNow` — только до первого пульса.
 */
let beatSkew: number | null = null;

/**
 * The heartbeat. Mounted once, in the shell, so every signed-in page counts —
 * someone reading the patch list is on the site as much as someone on the
 * homepage.
 *
 * It beats only while the tab is visible. A tab left open behind something
 * else is not somebody being here, and without this it would keep a person
 * "here" all night.
 *
 * The answer is announced as a window event rather than kept anywhere, which is
 * how the board stays current without asking again itself: one request per
 * beat, not two.
 */
export function PresenceBeat() {
  useEffect(() => {
    let alive = true;

    const beat = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/presence', { method: 'POST' });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as Payload;
        // Здесь, а не только на доске: пульс бьётся на любой странице, и к
        // возвращению на главную разница уже свежая.
        if (typeof data.now === 'number') beatSkew = data.now - Date.now();
        window.dispatchEvent(new CustomEvent<Payload>(EVENT, { detail: data }));
      } catch {
        // Offline, or the server blinked. The next beat will do.
      }
    };

    beat();
    const timer = setInterval(beat, BEAT_MS);
    // Coming back to the tab counts at once, not up to 45 seconds later.
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}

/**
 * Who is loitering on the site right now, and when the others last were.
 *
 * You are always "here" — you are the one reading it — which also means the
 * tile never shows you as gone for the few seconds before your first beat lands.
 *
 * Rendered on the server with the server's clock and hydrated with the same
 * one, so both sides agree on who is here. The "seen 5 minutes ago" line is
 * written only after mount: a relative time is a different string a second
 * later, and a different string on the server than in the browser is a
 * hydration error.
 */
export function PresenceBoard({
  initial,
  me,
  serverNow,
  className = ''
}: {
  initial: PresenceEntry[];
  /** Your handle. */
  me: string;
  serverNow: number;
  className?: string;
}) {
  const t = useTranslations('presence');
  const locale = useLocale();
  const [people, setPeople] = useState(initial);
  const [now, setNow] = useState(serverNow);
  const [mounted, setMounted] = useState(false);
  /**
   * На сколько часы сервера впереди часов зрителя.
   *
   * «Когда был» пишет сервер, а сравнивался он с часами компьютера, на котором
   * открыт сайт. Спешат они на полторы минуты — и друг, который здесь, выглядел
   * ушедшим; отстают — и ушедший «был тут» лишние минуты. Разница берётся из
   * времени отрисовки страницы, а потом из каждого ответа пульса: тот приносит
   * своё `now`.
   */
  const skew = useRef(0);

  useEffect(() => {
    setMounted(true);
    skew.current = beatSkew ?? serverNow - Date.now();
    setNow(Date.now() + skew.current);

    const onBeat = (e: Event) => {
      const data = (e as CustomEvent<Payload>).detail;
      if (typeof data?.now === 'number') {
        beatSkew = data.now - Date.now();
        skew.current = beatSkew;
      }
      if (!data?.people?.length) return;
      setPeople(data.people);
      setNow(Date.now() + skew.current);
    };
    window.addEventListener(EVENT, onBeat);
    // "5 minutes ago" has to become "6 minutes ago" without a new answer.
    const tick = setInterval(() => setNow(Date.now() + skew.current), 30_000);

    return () => {
      window.removeEventListener(EVENT, onBeat);
      clearInterval(tick);
    };
  }, [serverNow]);

  const rtf = useMemo(() => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }), [locale]);
  const ago = (ms: number) => {
    const minutes = Math.round(ms / 60_000);
    if (minutes < 60) return rtf.format(-Math.max(1, minutes), 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    return rtf.format(-Math.round(hours / 24), 'day');
  };

  const isHere = (p: PresenceEntry) =>
    p.handle === me || (p.lastSeen !== null && now - p.lastSeen < ONLINE_MS);

  // Here first, you first among those, then whoever was seen most recently.
  const sorted = [...people].sort((a, b) => {
    const byHere = Number(isHere(b)) - Number(isHere(a));
    if (byHere) return byHere;
    if (a.handle === me) return -1;
    if (b.handle === me) return 1;
    return (b.lastSeen ?? -1) - (a.lastSeen ?? -1);
  });

  const others = people.filter((p) => p.handle !== me);
  const othersHere = others.filter(isHere).length;
  const summary =
    othersHere === 0
      ? t('alone')
      : othersHere === others.length
        ? t('all')
        : t('some', { count: othersHere + 1, total: people.length });

  return (
    <section
      className={`block-card animate-rise-in flex flex-col gap-4 p-6 [animation-delay:240ms] ${className}`}
    >
      <p className="ps-label">{t('label')}</p>

      <ul className="flex flex-col gap-3">
        {sorted.map((person) => {
          const here = isHere(person);
          const status = here
            ? t('here')
            : person.lastSeen === null
              ? t('never')
              : mounted
                ? t('seen', { ago: ago(now - person.lastSeen) })
                : ' ';

          return (
            <li key={person.handle}>
              {/* Человек — кнопка: нажал — окошко его профиля (`PersonPeek`). */}
              <PersonButton
                who={{ name: person.displayName, avatarPreset: person.avatarPreset, handle: person.handle }}
                className="flex w-full items-center gap-3"
              >
                <span className="relative shrink-0">
                  <MemberAvatar
                    preset={person.avatarPreset}
                    displayName={person.displayName}
                    className={`h-9 w-9 transition-opacity duration-drape ${here ? '' : 'opacity-45'}`}
                  />
                  {/* A filled dot for here, an empty ring for not — shape, not
                      colour, so it reads without the palette's help. */}
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${
                      here ? 'bg-ink' : 'bg-surface ring-1 ring-inset ring-rule'
                    }`}
                  />
                </span>
                {/* Строчные теги: внутри кнопки блочным не место. */}
                <span className="block min-w-0">
                  <span className="block truncate text-base font-semibold leading-tight text-ink">
                    {person.displayName}
                    {person.handle === me ? (
                      <span className="ps-label ms-2 text-ink-faint">{t('you')}</span>
                    ) : null}
                  </span>
                  <span className="block text-sm text-ink-muted">{status}</span>
                </span>
              </PersonButton>
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-ink-muted">{summary}</p>
    </section>
  );
}
