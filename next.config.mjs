import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
