import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

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
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
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
