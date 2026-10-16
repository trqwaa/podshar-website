import { execSync } from 'node:child_process';

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Which commit this build is, and when it was built.
 *
 * Shown under the patch list and sent as `X-Podshar-Build` on every response.
 * Autodeploy once sat on three pushes for a day without a word (see CLAUDE.md),
 * and the only way to tell was to build locally and compare stylesheet hashes.
 * Now one look says which commit is live:
 *
 *   curl -sI https://podshar-website.vercel.app/ru/login | grep -i x-podshar-build
 *
 * Vercel hands the commit over as an environment variable during the build. A
 * local build asks git instead. Neither answering is not a reason to fail the
 * build, it is "unknown" on the screen.
 *
 * The repository is public, so the commit says nothing a reader of GitHub does
 * not already know. That is the difference from `X-Powered-By`, which is turned
 * off below: that one names a framework and its exploits, this one names a
 * commit anyone can open.
 */
function buildInfo() {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      sha = '';
    }
  }
  return { sha: /^[0-9a-f]{7,40}$/.test(sha) ? sha : 'unknown', at: new Date().toISOString() };
}

const BUILD = buildInfo();

/**
 * Security headers, on every response.
 *
 * Until these existed the site sent none at all. The ones that matter here:
 *
 *   frame-ancestors / X-Frame-Options   nobody may put this site in a frame.
 *     Without it any page on the internet could load the signed-in site in an
 *     invisible iframe over its own button and borrow a click — "delete this
 *     event", "sign out everywhere". Both headers, because older browsers only
 *     know the second.
 *   Referrer-Policy: same-origin   the invite and reset links carry their token
 *     in the query string. A browser follows its own default otherwise, and a
 *     secret should not depend on which browser someone happens to use.
 *   nosniff   a file is what its content type says, not what the browser guesses.
 *   Permissions-Policy   the site uses no camera, microphone or location, so it
 *     says so, and a script that got in somehow could not ask for them either.
 *   Cross-Origin-Opener-Policy   a page this site links to gets no handle back
 *     on our window.
 *
 * The CSP deliberately stops short of `script-src`. Next injects inline scripts
 * for hydration, and a script policy needs a nonce threaded through every
 * render — a larger change with its own ways to break the site. What is here
 * closes framing, `<base>` hijacking, form hijacking and plugins, and cannot
 * break a page that works today.
 *
 * No `includeSubDomains` on HSTS: podshar.ch carries mail records on its
 * subdomains, and pinning HTTPS on names that are not websites buys nothing and
 * could one day block something.
 */
const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The framework's own banner: it tells a scanner which exploits to try first.
  poweredByHeader: false,
  // Inlined at build time, so the page shows the build it belongs to and not
  // whatever a server happens to have in its environment later.
  env: { PODSHAR_BUILD_SHA: BUILD.sha, PODSHAR_BUILD_AT: BUILD.at },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [...SECURITY_HEADERS, { key: 'X-Podshar-Build', value: BUILD.sha.slice(0, 7) }]
      }
    ];
  },
  images: {
    // Scraped media is proxied through our own /api/media/[id] route so that we
    // never hotlink third-party CDNs and never leak the group's IP addresses.
    remotePatterns: [
      { protocol: 'https', hostname: '**.podshar.internal' },
      // Аватарка из Steam — исключение, которое правилу выше не противоречит.
      // Правило про то, чтобы **браузер** не ходил на чужие CDN: так утекают
      // наши адреса. С `next/image` он туда и не ходит — картинку забирает и
      // пережимает наш сервер, а браузер получает её уже со своего домена.
      { protocol: 'https', hostname: 'avatars.steamstatic.com' }
    ]
  }
};

export default withNextIntl(nextConfig);
