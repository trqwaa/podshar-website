import 'server-only';

import { getMessages } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

/**
 * Which translations travel to the browser, per half of the site.
 *
 * Until this existed the root layout handed `NextIntlClientProvider` the whole
 * catalogue, and next-intl serialises whatever it is given into the page. So
 * the login screen — the one page a stranger can open — shipped every string on
 * the site: the dog's description of each section and what is on it, the
 * profile and calendar forms, 124 greetings and 120 quotes. Nothing secret in
 * there, but it is a private site's whole map and every in-joke, handed to
 * someone who has not been let in. And 38 KB of it on every signed-in page,
 * most of which no client component ever reads.
 *
 * Server components do not need any of this: `getTranslations` reads the
 * catalogue on the server and only the rendered text goes out. These lists are
 * for components marked `'use client'`, and only for them.
 *
 * **A new client component that calls `useTranslations('x')` needs `x` here**,
 * in the list for the half it renders in. Missing, it shows the raw key
 * instead of the text and logs a missing-message error in the console.
 *
 * A path is dotted and may use `*` for one level: `guide.*.here` is the opening
 * line of every section and none of the element descriptions under it.
 */

/** Login, join and reset. The only half a stranger can reach. */
export const SIGNED_OUT = ['auth', 'reset', 'home.language'] as const;

/**
 * Everything behind the login.
 *
 * Deliberately not listed, because no client component reads them:
 * `greeting` (the four lines of the day are rendered on the server), `quotes`
 * (the quote arrives as a string), `weather` (the panel gets server-rendered
 * rows), `meta`, `auth`, `reset`, and all of `guide` except each section's
 * opening line — the element descriptions are for the dog's brief and the
 * keyword fallback, both on the server.
 */
export const SIGNED_IN = [
  'home',
  'nav',
  'sidebar',
  'patches',
  'assistant',
  'guide.*.here',
  'presence',
  'trains',
  'games',
  'calendar',
  'todos',
  'profile'
] as const;

type Tree = { [key: string]: string | Tree };

export async function clientMessages(locale: Locale, paths: readonly string[]): Promise<Tree> {
  return pick((await getMessages({ locale })) as Tree, paths);
}

export function pick(source: Tree, paths: readonly string[]): Tree {
  const out: Tree = {};
  for (const path of paths) copy(source, out, path.split('.'), path, true);
  return out;
}

function copy(
  from: Tree,
  to: Tree,
  [head, ...rest]: string[],
  path: string,
  /** False once a wildcard has been passed: below `*`, a sibling without the key is normal. */
  strict: boolean
) {
  const wild = head === '*';
  const keys = wild ? Object.keys(from) : [head];

  for (const key of keys) {
    const value = from[key];

    if (value === undefined) {
      if (!strict) continue;
      // A name spelt wrong in the lists above. Loud in development, where it
      // costs a glance; a warning in production, where throwing here would
      // take every page of the half down with it over one missing label.
      const problem = `[podshar] client-messages: "${path}" names nothing in the catalogue`;
      if (process.env.NODE_ENV !== 'production') throw new Error(problem);
      console.warn(problem);
      continue;
    }

    if (rest.length === 0) {
      to[key] = value;
      continue;
    }

    // Under a wildcard some siblings are plain strings (`guide.hello` next to
    // `guide.home`); they simply have no `here` to take.
    if (typeof value !== 'object') continue;

    const branch = (to[key] ??= {}) as Tree;
    copy(value, branch, rest, path, strict && !wild);
  }
}
