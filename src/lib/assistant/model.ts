import Anthropic from '@anthropic-ai/sdk';

import { ALL_PLACES } from '@/lib/navigation';

/**
 * Which model answers as Podshar.
 *
 * Sonnet, by the owner's call, after Opus looked expensive. It holds the voice
 * noticeably less well on its own, which is why the brief below carries far more
 * explicit instruction than a stronger model would need — that is the trade, and
 * it is a fair one at a fifth of the price.
 *
 * This is the cost dial and the only line that needs changing: add the model to
 * `PRICE_PER_MTOK` and nothing else here is model-specific.
 */
const MODEL: keyof typeof PRICE_PER_MTOK = 'claude-sonnet-5';

/**
 * Generous on purpose, and not a cost control.
 *
 * Thinking tokens are drawn from the same allowance as the reply, so a tight cap
 * does not buy a short answer — it buys an answer truncated mid-sentence once
 * the model happens to think for a moment. Brevity is asked for in the brief,
 * where it belongs; billing only counts what is actually produced, and a pug
 * told to say one sentence does not say two thousand tokens.
 */
const MAX_TOKENS = 2000;

/** Live destinations, which is also the only set the navigate tool will accept. */
const LIVE_HREFS = ALL_PLACES.filter((p) => p.status === 'live').map((p) => p.href);

/**
 * The one tool he has.
 *
 * The enum is the whole point: a model asked to produce a URL will eventually
 * produce a plausible one that 404s. Here the only values that exist are the
 * pages that exist, and `strict` makes the API enforce that rather than trusting
 * the model to have read the brief.
 */
const NAVIGATE: Anthropic.Beta.BetaTool = {
  name: 'navigate',
  description:
    'Take the person to a page of this site. Only call this when they actually want to go somewhere.',
  input_schema: {
    type: 'object',
    properties: {
      href: { type: 'string', enum: LIVE_HREFS, description: 'The page to open.' }
    },
    required: ['href'],
    additionalProperties: false
  },
  strict: true
};

/**
 * Dollars per million tokens, per model.
 *
 * A snapshot, not a source of truth — Anthropic's price list is. It exists so
 * the log line below reads in money rather than in tokens: "this message cost
 * $0.002" is a sentence the owner of this site can act on, and "1576
 * cache_read_input_tokens" is not.
 *
 * Keyed by model deliberately. A single flat table silently lies the moment
 * someone moves the dial above — which is exactly what happened once here, and
 * it under-reported by two and a half times. Cached reads bill at a tenth.
 */
const PRICE_PER_MTOK = {
  // `serverFallbacks`: whether the model accepts the server-side retry that
  // rescues a safety refusal. Opus does; Sonnet answers a request carrying it
  // with a flat 400, which is a whole afternoon of the dog being mysteriously
  // stupid if you assume the parameter is harmless everywhere. It rides here so
  // that switching the dial above cannot leave it behind.
  'claude-opus-5': { input: 5, output: 25, serverFallbacks: true },
  'claude-sonnet-5': { input: 2, output: 10, serverFallbacks: false },
  'claude-haiku-4-5': { input: 1, output: 5, serverFallbacks: false }
} as const;

/**
 * One line per answer, in money.
 *
 * Worth the noise: the bill is the one thing about this feature nobody can see
 * from the outside, and a guess about it — mine included — has already been
 * wrong once. Watch `cached`: it should carry nearly the whole prompt. If it
 * ever drops to zero, something that changes per request has crept into the
 * brief and the price roughly triples.
 */
function logSpend(usage: Anthropic.Beta.BetaUsage) {
  const price = PRICE_PER_MTOK[MODEL];
  const cached = usage.cache_read_input_tokens ?? 0;
  const written = usage.cache_creation_input_tokens ?? 0;
  // Three different rates: fresh input, a cached read at a tenth, and writing
  // the cache at a quarter over input — that write is why the first message
  // after a quiet spell costs several times the ones that follow it.
  const dollars =
    (usage.input_tokens * price.input +
      written * price.input * 1.25 +
      cached * price.input * 0.1 +
      usage.output_tokens * price.output) /
    1_000_000;

  console.log(
    `[podshar] ${MODEL} · in ${usage.input_tokens} (+${cached} cached) · ` +
      `out ${usage.output_tokens} · ~$${dollars.toFixed(4)}`
  );
}

export type Turn = { role: 'user' | 'assistant'; content: string };
export type Answer = { reply: string; route?: string };

/**
 * One piece of an answer on its way out.
 *
 * Text arrives in as many beats as the model takes to write it; a route, if he
 * decided to move, arrives once and last. Last on purpose: the page must not
 * change under someone who is still reading the sentence explaining why it is
 * about to.
 */
export type Beat = { text: string } | { route: string };

/** How much of the conversation travels with each turn. Four exchanges is enough
 *  for "and what about that one" to make sense, and cheap enough to send always. */
const HISTORY_TURNS = 8;

/**
 * Trim the log into something the API will accept.
 *
 * The rule it does not bend on is that a conversation starts with a `user` turn.
 * The panel opens with the dog describing the page, so the log always *begins*
 * with an assistant turn — sent as-is that is a 400, which would silently demote
 * every reply to the keyword fallback and look like the model being stupid
 * rather than absent. Enforced here rather than in the browser because this is
 * the module that talks to the API, and a client is not a place to keep someone
 * else's invariants.
 */
function usableHistory(history: Turn[]): Anthropic.Beta.BetaMessageParam[] {
  const recent = history.slice(-HISTORY_TURNS);
  const start = recent.findIndex((turn) => turn.role === 'user');
  if (start === -1) return [];

  return recent
    .slice(start)
    .map((turn) => ({ role: turn.role, content: turn.content }));
}

/** True when there is a key to spend. Without one the caller falls back. */
export const modelConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * A reply has to contain words.
 *
 * Since the emoji set opened up, some messages reliably come back as nothing but
 * an emoji — "🥀" on its own to someone describing a bad day. In their own chat
 * that is a real and rather good reply; in a panel whose whole job is answering
 * questions it is indistinguishable from the site having broken, and the person
 * cannot tell which it was.
 *
 * The brief asks for words twice, in the two places the model weights most, and
 * it still does this about four times in five on the inputs that invite it. So
 * the rule lives here instead: an instruction that is only obeyed sometimes is
 * not a rule.
 */
const hasWords = (text: string) => /\p{L}/u.test(text);

/**
 * One response, poured out as it is written.
 *
 * Only `text_delta` is forwarded. The model thinks first and those deltas come
 * down the same pipe; they are working notes, not an answer, and putting them on
 * screen would be both a lie about what he said and a leak of the reasoning the
 * brief tells him to keep to himself.
 *
 * Whitespace is flattened for the same reason it always was — the bubble is a
 * single `<p>`, so a blank line the model intended becomes an invisible double
 * space. Doing it to the whole accumulated string rather than to each fragment
 * is what makes it safe: a run of spaces split across two deltas still collapses
 * to one. Normalising is prefix-stable, so what has already been sent never has
 * to be taken back, and each turn of the loop emits only the tail that is new.
 *
 * The wordless-reply rule survives streaming by holding everything back until
 * the first letter appears. In practice that is the first delta, so it costs
 * nothing visible; and if a letter never comes, nothing was ever sent and the
 * caller is free to fall back to the keyword table exactly as before. That is
 * the whole reason for the gate: text already on screen cannot be unsaid.
 */
async function* pour(
  stream: AsyncIterable<Anthropic.Beta.BetaRawMessageStreamEvent>,
  out: { said: string }
): AsyncGenerator<Beat> {
  let raw = '';
  let sent = '';
  let opened = false;

  for await (const event of stream) {
    if (event.type !== 'content_block_delta' || event.delta.type !== 'text_delta') continue;
    raw += event.delta.text;

    // `trimStart` and not `trim`: a trailing space is not rubbish mid-stream, it
    // is the gap before the next word arriving.
    const norm = raw.replace(/\s+/g, ' ').trimStart();
    if (!opened) {
      if (!hasWords(norm)) continue;
      opened = true;
    }
    if (norm.length <= sent.length) continue;

    const piece = norm.slice(sent.length);
    sent = norm;
    yield { text: piece };
  }

  out.said = sent.trim();
  if (!opened && raw.trim()) console.warn(`[podshar] wordless reply discarded: ${raw.trim()}`);
}

function navigationIn(content: Anthropic.Beta.BetaContentBlock[]) {
  return content.find(
    (block): block is Anthropic.Beta.BetaToolUseBlock =>
      block.type === 'tool_use' && block.name === 'navigate'
  );
}

/**
 * Ask Podshar, and hand back the answer as it is written.
 *
 * Yields nothing at all for every failure — no key, no balance, a rate limit, a
 * refusal, a dropped connection — so the caller can fall back to the keyword
 * router instead of showing an error: a dumber dog is a much better outcome than
 * a broken one, and the person on the other end cannot tell which half answered.
 * The one thing that cannot be undone is text already sent, which is why the
 * word gate in `pour` holds the first fragment back until it is sure.
 *
 * Streaming rather than one lump, because the wait is the complaint. He thinks
 * for a second or two before the first word, and under a single response that
 * silence was the whole visible behaviour: nothing, nothing, nothing, a finished
 * paragraph. The tokens arrive over the same seconds either way; this is only
 * the difference between watching someone write and watching a blank panel.
 *
 * Thinking stays on with effort turned down. Turning it off on this model has a
 * documented failure mode where the tool call is written into the visible text
 * instead of being made — which here would mean the dog saying "taking you
 * there" while the page never changes.
 */
export async function* streamPodshar({
  brief,
  history,
  message
}: {
  brief: string;
  history: Turn[];
  message: string;
}): AsyncGenerator<Beat> {
  if (!modelConfigured()) return;

  // A key created without a workspace is rejected — "not scoped to a workspace"
  // — unless the request names one. A key made *inside* a workspace carries that
  // itself and needs nothing here, which is why this is optional and why the
  // simpler fix is usually a differently-created key. Kept because this is the
  // wall the project actually walked into, not a hypothetical one.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic(
    workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}
  );
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...usableHistory(history),
    { role: 'user' as const, content: message }
  ];

  // If a safety classifier declines a turn, the same request is retried
  // server-side on another model instead of the dog going quiet. Costs nothing
  // when it never fires, which here is nearly always — but only Opus takes it.
  const rescue: Pick<
    Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
    'betas' | 'fallbacks'
  > = PRICE_PER_MTOK[MODEL].serverFallbacks
    ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }
    : {};

  const ask = (turns: Anthropic.Beta.BetaMessageParam[]) =>
    client.beta.messages.stream({
      ...rescue,
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // The brief is identical on every turn, so it is worth caching: it is by
      // far the largest part of the request and it never changes within a day.
      system: [{ type: 'text', text: brief, cache_control: { type: 'ephemeral' } }],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      tools: [NAVIGATE],
      messages: turns
    });

  // Filled in by `pour` once each response has run dry. Read afterwards rather
  // than returned, because the generator's yields are the text and there is
  // nowhere else to put the total.
  const out = { said: '' };

  try {
    const first = ask(messages);
    yield* pour(first, out);

    // Available only once the stream has ended: the tool call, the stop reason
    // and the bill all belong to the assembled message, not to any one delta.
    const whole = await first.finalMessage();
    logSpend(whole.usage);
    if (whole.stop_reason === 'refusal') return;

    const nav = navigationIn(whole.content);
    const href = nav ? String((nav.input as { href: string }).href) : undefined;

    // Usually he says something *and* calls the tool, which is one round trip.
    if (out.said) {
      if (href) yield { route: href };
      return;
    }

    // He only moved. Hand the tool its result so he can also say something —
    // arriving somewhere in silence reads like the site glitched.
    if (!nav) return;
    const second = ask([
      ...messages,
      { role: 'assistant', content: whole.content },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: nav.id, content: 'done' }]
      }
    ]);
    yield* pour(second, out);
    logSpend((await second.finalMessage()).usage);
    if (out.said && href) yield { route: href };
  } catch (error) {
    // No key, no balance, rate limit, network, a malformed request — all the
    // same from here: the keyword router answers instead and the person sees a
    // reply either way. But they are not the same to whoever has to work out
    // why the dog went stupid, and a silent downgrade is unfixable. This line
    // is the only place that distinction survives; on Vercel it lands in the
    // function log.
    //
    // A break *after* the first words have gone out is the one case this cannot
    // paper over: those words are already on screen, so the reply simply stops
    // where it stopped. Rare, and the alternative — a second answer appended
    // underneath the half of one — is worse.
    console.warn(
      '[podshar] model call failed, falling back to the keyword table:',
      error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error
    );
  }
}
