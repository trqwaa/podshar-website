/**
 * The address a link in a letter may point at.
 *
 * The reset link used to be built from whatever `Host` the request arrived
 * with. That is the textbook way to lose an account: ask for a reset on someone
 * else's address with `Host: attacker.example`, and the genuine letter from our
 * genuine domain carries a link to the attacker's server — with a live token in
 * it, delivered the moment the owner clicks. On Vercel a forged host is hard to
 * land, because routing itself goes by host; but a defence that holds only
 * because of how today's hosting routes requests is not a defence.
 *
 * So the host is only *chosen from* this list, never taken on trust. A request
 * on www.podshar.ch produces a link there, and anything else — a preview URL, a
 * forged header — gets the canonical address. The bare podshar.ch redirects to
 * www (Vercel does that), and since 1.42A so does the old vercel.app address
 * (`next.config.mjs`). A link built on either still lands on the right site.
 *
 * Its own module, with no imports, so it can be checked with forged headers
 * directly rather than by waiting for a letter.
 */
export const CANONICAL_ORIGIN = 'https://www.podshar.ch';

const ALLOWED_HOSTS = new Set(['www.podshar.ch', 'podshar.ch', 'podshar-website.vercel.app']);

export function linkOrigin(host: string | null, production: boolean): string {
  const name = (host ?? '').trim().toLowerCase();
  if (ALLOWED_HOSTS.has(name)) return `https://${name}`;
  // A laptop is not a target worth defending, and the link has to work there.
  if (!production && /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(name)) return `http://${name}`;
  return CANONICAL_ORIGIN;
}
