# Podshar

A private hub for three friends. Not a product and not a portfolio piece — an
internal site that is meant to be pleasant, faintly ironic, and obviously
handmade.

Everything is behind a login, and there is no way to sign up: registration
accepts an invite token and nothing else, which is what keeps the site at
exactly three people.

## What is actually built

| | |
|---|---|
| Sign-in | Own session auth — a random cookie, its SHA-256 in Postgres, sign-out deletes the row |
| Registration | Invite-only. The token is shown once and only its hash is stored |
| Password reset | By email, through Resend, from a verified domain |
| Profile | Display name, handle, avatar from eight presets, password, home station |
| Home | The reactor button, a greeting and a thought for the day, the date, the weather, who is around, and the next train home for each person |
| The dog | An assistant in the corner. Claude answers; a keyword table answers when Claude cannot |
| Patches | A changelog with its own page, opened from the drawer as a panel |
| Languages | English, Russian, Ukrainian, German |

Five rows in the drawer say "in development" on purpose: the sections have not
been chosen yet, and five links into a 404 are worse than honest placeholders.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind 3 · next-intl 3 · Prisma 6 ·
PostgreSQL on Neon · framer-motion 13 · the Anthropic SDK · Manrope.

Hosted on Vercel. A push to `main` deploys production by itself.

## Running it locally

Node 20.11 or newer.

```bash
npm install
npx prisma generate     # npm blocks postinstall scripts, so this is separate
npm run dev
```

Open <http://localhost:3000>. The root path redirects on `Accept-Language`;
`/en`, `/ru`, `/uk` and `/de` all work directly.

**A database is optional in development.** Without one the site opens as a
guest, and the homepage, the greeting, the reactor and the dog all work — which
is enough for most front-end work. In production the opposite rule applies: no
database means the site is closed, not open. That rule exists because the
inverse once left a private site readable by the whole internet for a day over
a single unset variable.

Secrets go in `.env.local`, which is gitignored. `.env.example` lists every
variable with a note on what breaks without it; nothing in it is required to
start the dev server. Neon fills the database URLs in for you:

```bash
neon link --project-id <project> --branch production -y
```

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | `prisma generate`, then a production build |
| `npm run start` | Serve a build |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run deploy` | Push a production deploy to Vercel without a commit |
| `npm run db:push` | Push the schema without writing a migration |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Seed invites and starting data — prints each token once |
| `npm run db:studio` | Prisma Studio |

The three database scripts run against **one shared Postgres branch**. There is
no per-developer database: `db:push` and `db:migrate` change the tables for all
three people at once. Read that sentence twice before running either.

## Layout

```
src/
  app/[locale]/(app)/    pages behind the login, plus the shell
  app/[locale]/(auth)/   login, join, reset — no shell
  app/api/               the assistant and the presence beat
  components/            the reactor, the vines, the drawer, the dog, the tiles
  i18n/                  routing, request config, messages/{en,ru,uk,de}.json
  lib/auth/              config, cookie, password, session, actions, profile
  lib/assistant/         the dog: brief, model call, fallback table, quota
  lib/                   session, navigation, patches, weather, presence, trains
prisma/                  schema.prisma and seed.ts
docs/                    architecture, how to resume, agent handovers, history
```

The shell is a drawer and a canvas. The drawer is a real flex sibling whose
width animates from zero, so opening it **pushes** the canvas rather than
floating over it.

`prisma/schema.prisma` is much larger than what the site uses — it covers the
whole intended scope rather than the current screen, so most of its tables are
still empty.

## Design tokens

Four greys and one accent, defined once as CSS variables in
[globals.css](src/app/globals.css) and exposed to Tailwind by name.

| Token | Value | Role |
|---|---|---|
| `canvas` | `#f2f2f2` | Page ground |
| `surface` | `#ffffff` | Block fill — the one raised surface |
| `sunk` | `#eaeaea` | Recessed fill, for the block the eye should reach last |
| `ink` | `#1f1f1f` | Text and outlines |
| `accent` | `#3b6ea5` | The one interactive colour |

`--reactor` (`#d93a34`) sits outside the palette deliberately: it is a warning
light, not a brand colour, and it should read as foreign wherever it appears.
A second palette, "Paper", is defined under `[data-palette='paper']`.

They are stored as raw channel numbers rather than hex so Tailwind's opacity
modifiers keep working — `text-ink/60`, `border-ink/20`. Nothing casts a
shadow; depth comes from the fills and from hairline rules.

Do not write a raw hex value or a magic layout number in a component. Adding a
colour means adding a token, and that friction is what keeps the palette small.

Both typefaces carry Cyrillic, which is not optional here: the greeting renders
in Russian and Ukrainian, and a fallback face mid-word would wreck the one
piece of typography the cover is built around.

## Four languages

Path-prefixed via `next-intl`, one JSON catalogue per locale under
`src/i18n/messages/`, kept at exact key parity — a missing key does not
degrade, it throws while rendering. All four are edited together.

Adding a destination means touching `src/lib/navigation.ts` and those four
files, and nothing else. That file is the single source of truth for what
exists: the dog uses it to decide where it can lead you and to admit when a
section is not built yet.

The changelog in `src/lib/patches.ts` is the one deliberate exception — the
entries are not translated. The list grows with every change, and four texts
per entry would mean that sooner or later somebody forgets the German one and
`/de` stops opening.

## The documentation that is actually maintained

This file is the shop window. The working notes live next to the code:

| | |
|---|---|
| [CLAUDE.md](CLAUDE.md) | The decision record: what was decided, and why. Read first |
| [docs/RESUME.md](docs/RESUME.md) | How a cold session picks the project back up |
| [docs/HANDOFF.md](docs/HANDOFF.md) | The last handover between the two people working on this |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | The full intended scope and the roadmap |
| [docs/HISTORY.md](docs/HISTORY.md) | The prompt archive. Large; open it for a specific old episode |
| `git log` | The same story, shorter. Commit messages here carry the "why" |

`CLAUDE.md` and `docs/ARCHITECTURE.md` disagree in places. `CLAUDE.md` is the
one that is kept current; where they conflict, the code decides.

## A note on this repository being public

It is, and that is a choice, so a few things must never land in it: no secrets,
no invite tokens, and no link to the Telegram group. The group link is read
from `TELEGRAM_INVITE_URL` on the server and handed only to pages behind the
login — without the variable the icon in the footer simply is not drawn.

From the env files, only `.env.example` is tracked.

## Licence

Private. Not for distribution.
