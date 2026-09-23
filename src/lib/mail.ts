import 'server-only';

/**
 * Sending mail, as one seam.
 *
 * There is exactly one letter on this site — the password reset link — so this
 * is deliberately small: a subject, a body, an address. No templates, no HTML.
 * Plain text also happens to be the least spam-prone thing you can send, which
 * matters when three people need the letter to arrive on the day they are
 * locked out.
 *
 * Resend is called over plain `fetch` rather than through its SDK. One POST
 * with three fields does not earn a dependency, and a dependency here would be
 * one more package with network access sitting in the auth path.
 *
 * Nothing above this file knows the provider's name. Swapping Resend for SMTP
 * means rewriting `deliver` and nothing else.
 */

const ENDPOINT = 'https://api.resend.com/emails';

/**
 * Whether mail can actually go out.
 *
 * Read by the login page to decide whether to offer a "forgot password" link
 * at all. Offering a link that silently leads nowhere is worse than not
 * offering it: the person spends their locked-out evening waiting for a letter
 * that was never sent.
 */
export const mailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/**
 * Hand one letter to the provider.
 *
 * Returns whether it went. Callers must not change what they tell the visitor
 * based on the answer — a reset form that says "sent" for real addresses and
 * "failed" for the rest is an account-enumeration oracle wearing an error
 * message. The answer is for the log.
 *
 * Every failure is logged with its reason, including "not configured". A quiet
 * fallback here would be indistinguishable from a mail provider having a bad
 * day, and there would be nothing to fix it with — the same reasoning that
 * makes the dog announce his own model failures.
 */
export async function deliver({
  to,
  subject,
  text
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  if (!mailConfigured()) {
    console.warn('[podshar] mail not configured: RESEND_API_KEY or EMAIL_FROM missing');
    return false;
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
      // A provider that never answers would hold the background task until the
      // platform kills it, with nothing in the log to say why the letter never
      // came. Ten seconds is generous for one POST.
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      // The body carries the actual reason — an unverified domain, a `from`
      // that does not belong to it, a revoked key. Without it the log says
      // only "422", which is the same as saying nothing.
      console.error(`[podshar] mail failed: ${response.status} ${await response.text()}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[podshar] mail failed to send', error);
    return false;
  }
}
