/**
 * World ID Selfie Check — the faucet's proof-of-human gate.
 *
 * WHY THIS EXISTS
 *
 * The faucet hands 2 USDC to every new player so they can afford a ranked buy-in without
 * hunting for a testnet drip. Its uniqueness keys were an Arc address and a Privy user id,
 * and both are free to mint: Privy signs you in with an email, so ten inboxes are ten
 * "new players" and twenty USDC. That is a real sybil hole in a faucet holding real
 * (testnet) money, and it gets worse the moment the faucet is worth anything.
 *
 * Selfie Check closes it with the weakest credential that actually works. We do not need
 * to know who anyone is — we need to know that two claims did not come from the same
 * person. A World ID nullifier is exactly that and nothing more: deterministic per
 * (person, app, action), unlinkable across apps, and carrying no identity. One live human
 * gets one drip; their face never reaches this server and neither does their name.
 *
 * It is deliberately the low-assurance credential rather than Orb Proof of Human. Orb
 * would be stronger and would also mean "go find an Orb before you can play a browser
 * game", which is the wrong trade for a 2 USDC faucet. Selfie Check is the amount of
 * certainty the risk actually justifies.
 *
 * DEGRADATION
 *
 * Unconfigured, `worldEnabled` is false and the faucet keeps its old address + userId
 * keys. Nothing here is load-bearing for gameplay — it gates free money, not the match.
 */
import { signRequest } from '@worldcoin/idkit-core/signing';

const APP_ID = process.env.WORLD_APP_ID || '';
const RP_ID = process.env.WORLD_RP_ID || '';
const SIGNING_KEY = process.env.WORLD_SIGNING_KEY || '';

/**
 * The action scopes the nullifier. Every person who verifies against this string produces
 * the same nullifier every time, and a different one for any other action or app — so
 * this value IS the uniqueness domain. Changing it re-arms every past claimant, which is
 * why it is a constant here and not configuration.
 */
export const WORLD_ACTION = 'chase-faucet-claim';

/** Staging routes to World's simulator/sandbox; production needs a real World App. */
const ENVIRONMENT = process.env.WORLD_ENVIRONMENT === 'production' ? 'production' : 'staging';

const VERIFY_URL = 'https://developer.world.org/api/v4';

export const worldEnabled = Boolean(APP_ID && RP_ID && SIGNING_KEY);

/** Public, non-secret config the browser needs to open the IDKit widget. */
export function worldConfig() {
  return {
    enabled: worldEnabled,
    appId: APP_ID,
    rpId: RP_ID,
    action: WORLD_ACTION,
    environment: ENVIRONMENT,
  };
}

/**
 * Sign a proof request so World can tell it really came from this app.
 *
 * Must stay server-side: the signing key is what stops anyone else from issuing proof
 * requests in our name, so it never goes near `NEXT_PUBLIC_` or the browser bundle.
 */
export function signProofRequest(): {
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
} | null {
  if (!worldEnabled) return null;
  try {
    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: SIGNING_KEY,
      action: WORLD_ACTION,
    });
    return { nonce, created_at: createdAt, expires_at: expiresAt, signature: sig };
  } catch (e) {
    console.warn('[world] could not sign proof request:', (e as Error).message);
    return null;
  }
}

export type VerifyResult =
  | { ok: true; nullifier: string }
  | { ok: false; reason: string };

/**
 * Pull the nullifier out of an IDKit response.
 *
 * The payload shape differs between protocol 3.0 (legacy, `nullifier` per response) and
 * 4.0, and a response can carry more than one credential, so take the first nullifier
 * present rather than assuming a position. Normalised to lowercase hex because the same
 * nullifier can arrive cased differently and a case-sensitive ledger lookup would let the
 * same person claim twice — the exact bug this module exists to prevent.
 */
export function extractNullifier(payload: unknown): string | null {
  const responses = (payload as { responses?: unknown })?.responses;
  if (!Array.isArray(responses)) return null;
  for (const r of responses) {
    const n = (r as { nullifier?: unknown })?.nullifier;
    if (typeof n === 'string' && n.startsWith('0x') && n.length > 2) return n.toLowerCase();
  }
  return null;
}

/**
 * Verify a proof with World's Developer Portal and return its nullifier.
 *
 * The portal answers one question — "is this proof cryptographically valid" — and that is
 * all it answers. Whether this particular human has already been served is ours to decide,
 * so the caller checks the returned nullifier against the faucet ledger. Verifying without
 * that second step would accept the same valid proof forever.
 */
export async function verifyProof(idkitResponse: unknown): Promise<VerifyResult> {
  if (!worldEnabled) return { ok: false, reason: 'World ID is not configured on this server.' };
  if (!idkitResponse || typeof idkitResponse !== 'object') {
    return { ok: false, reason: 'Malformed proof.' };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`${VERIFY_URL}/verify/${RP_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Forwarded as-is: the docs are explicit that no field remapping is required, and
      // reshaping it here would be a second place for the payload format to drift.
      body: JSON.stringify(idkitResponse),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`[world] verify rejected (${res.status}): ${detail.slice(0, 200)}`);
      return { ok: false, reason: 'That proof could not be verified.' };
    }

    // Trust the portal for validity, but read the nullifier from the proof we were given
    // rather than from the portal's echo, so the value we key the ledger on is the one
    // the user actually presented.
    const nullifier = extractNullifier(idkitResponse);
    if (!nullifier) return { ok: false, reason: 'Proof carried no nullifier.' };
    return { ok: true, nullifier };
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'timed out' : (e as Error).message;
    console.warn('[world] verify failed:', msg);
    return { ok: false, reason: 'Could not reach World ID. Try again shortly.' };
  } finally {
    clearTimeout(timer);
  }
}
