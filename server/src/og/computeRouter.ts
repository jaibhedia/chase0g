/**
 * 0G Compute Router client — the AI-native core of Chase · Zero.
 *
 * The 0G Compute Router exposes an OpenAI-compatible endpoint backed by a
 * decentralized GPU marketplace: one API key, one balance, automatic provider
 * failover. We talk to it with the stock `openai` SDK pointed at the router base
 * URL. This is where 0G does real work — every agent "brain" decision is an
 * inference request served by 0G providers.
 *
 * SECURITY: OG_ROUTER_API_KEY is a *funded* key (it spends real testnet/mainnet
 * balance). It lives ONLY in the server env. It is never prefixed NEXT_PUBLIC_
 * and never shipped to the browser.
 *
 * Get a key + deposit tokens at https://pc.0g.ai, then set OG_MODEL to a chat
 * model from the live catalog there.
 */
import OpenAI from 'openai';

const baseURL = process.env.OG_ROUTER_BASE_URL || 'https://router-api.0g.ai/v1';
const apiKey = process.env.OG_ROUTER_API_KEY || '';

/** The chat model id (from the pc.0g.ai catalog). Required for live inference. */
export const OG_MODEL = process.env.OG_MODEL || '';

/**
 * True only when the server is actually configured to reach 0G Compute. The whole
 * app keys off this: when false, agents fall back to scripted steering and the
 * client shows the "AI: 0G offline" pill — the criterion #01 on/off proof.
 */
export const ogComputeEnabled = Boolean(apiKey && OG_MODEL);

/** Lazily-created singleton OpenAI client pointed at the 0G Compute Router. */
let client: OpenAI | null = null;
export function getOgClient(): OpenAI | null {
  if (!ogComputeEnabled) return null;
  if (!client) client = new OpenAI({ baseURL, apiKey });
  return client;
}

if (!ogComputeEnabled) {
  console.warn(
    '[0G] Compute Router NOT configured (need OG_ROUTER_API_KEY + OG_MODEL). ' +
      'Agents will use scripted fallback and report "AI offline".',
  );
} else {
  console.log(`[0G] Compute Router ready → ${baseURL} (model: ${OG_MODEL})`);
}
