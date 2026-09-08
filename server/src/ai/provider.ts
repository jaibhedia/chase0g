/**
 * The agent brain's LLM provider — deliberately vendor-neutral.
 *
 * Every provider we care about speaks the OpenAI chat-completions wire format, so the
 * choice of vendor is three environment variables, not a code change. The agents'
 * *behaviour* is the product; who serves the tokens is an implementation detail.
 *
 *   AI_BASE_URL   OpenAI-compatible endpoint. Omit for api.openai.com.
 *   AI_API_KEY    key for that endpoint
 *   AI_MODEL      model id
 *
 * If those are unset we fall back to the 0G Compute Router variables the project
 * already used (OG_ROUTER_BASE_URL / OG_ROUTER_API_KEY / OG_MODEL), so existing
 * deployments keep working untouched.
 *
 * Why this exists: the demo cannot depend on one provider's testnet credits staying
 * alive. Swapping providers must be an env change made in under a minute, including
 * on submission morning.
 *
 * SECURITY: the key is *funded* and lives only in the server env. Never prefixed
 * NEXT_PUBLIC_, never shipped to the browser.
 */
import OpenAI from 'openai';

const baseURL = process.env.AI_BASE_URL || process.env.OG_ROUTER_BASE_URL || undefined;
const apiKey = process.env.AI_API_KEY || process.env.OG_ROUTER_API_KEY || '';

/** Chat model id. Required for live inference. */
export const AI_MODEL = process.env.AI_MODEL || process.env.OG_MODEL || '';

/** True only when the server can actually reach a model. */
export const aiEnabled = Boolean(apiKey && AI_MODEL);

/**
 * Human-readable provider name, shown in /health and the in-game AI pill.
 * Derived from the endpoint host so the HUD never claims the wrong vendor.
 */
export const aiProviderName: string =
  process.env.AI_PROVIDER_NAME ||
  (() => {
    if (!baseURL) return 'OpenAI';
    try {
      const host = new URL(baseURL).host;
      if (host.includes('0g.ai') || host.includes('integratenetwork')) return '0G Compute';
      return host;
    } catch {
      return 'custom';
    }
  })();

let client: OpenAI | null = null;

/** Lazily-created singleton pointed at whichever provider is configured. */
export function getAiClient(): OpenAI | null {
  if (!aiEnabled) return null;
  if (!client) client = new OpenAI({ baseURL, apiKey });
  return client;
}

if (!aiEnabled) {
  console.warn(
    '[ai] No LLM provider configured (need AI_API_KEY + AI_MODEL, or the OG_ROUTER_* ' +
      'equivalents). Agents will use scripted fallback and report "AI offline".',
  );
} else {
  console.log(`[ai] Provider ready → ${aiProviderName} (model: ${AI_MODEL})`);
}
