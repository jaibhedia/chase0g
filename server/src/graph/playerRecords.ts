/**
 * Player records, read from the ChaseStake subgraph on Arc.
 *
 * This is the data the 0G Compute agent brains use to decide *who to hunt*. A bot that
 * only sees positions can do geometry; a bot that also sees "this wallet is up 4 USDC
 * across six matches" can do strategy, and the two produce visibly different play.
 *
 * The hard constraint is that the brains must never wait on this. `decideIntents` runs
 * inside a 6s inference budget on a live 60-second match, so a slow or down endpoint has
 * to cost nothing rather than eat the budget. Hence the shape here:
 *
 *   - `getRecords()` is SYNCHRONOUS. It returns whatever is currently cached and never
 *     awaits anything. A cold cache returns empty and the bots fall back to pure
 *     spatial reasoning — exactly how they behaved before this existed.
 *   - It triggers a background refresh when the cache is stale, and that refresh is
 *     fire-and-forget. Nothing in the game loop observes its promise.
 *   - Every failure path is swallowed to a warn. There is no error the leaderboard
 *     being unreachable should be able to surface into a match.
 *
 * The cache is global rather than per-room because records are per-wallet and change
 * only when a match settles on-chain, so two concurrent rooms asking about the same
 * player want the same answer.
 */

const ENDPOINT = process.env.SUBGRAPH_URL || process.env.NEXT_PUBLIC_SUBGRAPH_URL || '';

/** USDC is 6dp on Arc (the precompile's view over the 18dp native balance). */
const USDC_DECIMALS = 6;

/**
 * How long a cached record stays fresh.
 *
 * A record only moves when `settle()` or `refund()` lands, which happens at most once
 * per match per player. 60s means a player's stats are at worst one match stale when the
 * bots read them — fine for "is this person winning", which is all the prompt asks.
 */
const TTL_MS = 60_000;

/** Hard cap on the fetch itself, well under the brains' own 6s budget even though
 *  nothing awaits this. Prevents a hung socket from pinning the refresh flag forever. */
const REQUEST_TIMEOUT_MS = 4000;

/** After a failure, wait this long before trying again rather than retrying every tick
 *  against an endpoint that is evidently down. */
const FAILURE_BACKOFF_MS = 120_000;

export interface PlayerRecord {
  /** Lowercased address. */
  address: string;
  matchesPlayed: number;
  matchesWon: number;
  /** Net USDC, signed. Positive = this wallet is up money. */
  netProfit: number;
  /** Biggest single pot won, in USDC. */
  biggestPot: number;
}

const cache = new Map<string, PlayerRecord>();
let lastFetchAt = 0;
let backoffUntil = 0;
let inFlight = false;
/** Logged once so a missing endpoint doesn't spam a line per tick for a whole match. */
let missingEndpointWarned = false;

function toUsdc(raw: string): number {
  // Values arrive as decimal strings of a 6dp integer, and can be negative (netProfit).
  // Number() is safe here: a pot large enough to lose precision at 2^53 would be ~9
  // billion USDC, which this testnet escrow is not going to see.
  const n = Number(raw);
  return Number.isFinite(n) ? n / 10 ** USDC_DECIMALS : 0;
}

/**
 * Pull the top wallets by matches played.
 *
 * Deliberately NOT filtered to the current room's addresses: one unparameterised query
 * caches for every room at once, and 100 rows is a smaller response than most single
 *-player lookups would be in aggregate. It also means a player who joins mid-session is
 * usually already in the cache.
 */
const QUERY = `{
  players(first: 100, orderBy: matchesPlayed, orderDirection: desc, where: { matchesPlayed_gt: 0 }) {
    id
    matchesPlayed
    matchesWon
    netProfit
    biggestPot
  }
}`;

async function refresh(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      data?: { players?: Array<Record<string, string | number>> };
      errors?: Array<{ message?: string }>;
    };
    if (json.errors?.length) throw new Error(json.errors[0]?.message || 'graphql error');
    const rows = json.data?.players;
    if (!Array.isArray(rows)) throw new Error('malformed response');

    // Replace wholesale rather than merge: a wallet that dropped out of the top 100 has
    // stale numbers, and keeping it would quietly diverge from the leaderboard.
    cache.clear();
    for (const r of rows) {
      const address = String(r.id).toLowerCase();
      cache.set(address, {
        address,
        matchesPlayed: Number(r.matchesPlayed) || 0,
        matchesWon: Number(r.matchesWon) || 0,
        netProfit: toUsdc(String(r.netProfit)),
        biggestPot: toUsdc(String(r.biggestPot)),
      });
    }
    lastFetchAt = Date.now();
    backoffUntil = 0;
  } catch (err) {
    backoffUntil = Date.now() + FAILURE_BACKOFF_MS;
    console.warn('[graph] player records refresh failed:', (err as Error).message);
  } finally {
    clearTimeout(timer);
    inFlight = false;
  }
}

/**
 * Records for the given wallets, from cache only.
 *
 * Never awaits, never throws. Kicks off a background refresh when the cache is stale.
 * Addresses are matched case-insensitively; unknown wallets are simply absent from the
 * result, which the prompt builder reads as "no on-chain history yet".
 */
export function getRecords(addresses: Array<string | null | undefined>): Map<string, PlayerRecord> {
  if (!ENDPOINT) {
    if (!missingEndpointWarned) {
      missingEndpointWarned = true;
      console.warn('[graph] SUBGRAPH_URL not set — agents will reason from positions only');
    }
    return new Map();
  }

  const now = Date.now();
  if (now - lastFetchAt > TTL_MS && now > backoffUntil && !inFlight) {
    // Fire-and-forget on purpose: this tick uses the current cache, the next one gets
    // the fresh data. Awaiting here would put a network round-trip inside the game loop.
    void refresh();
  }

  const out = new Map<string, PlayerRecord>();
  for (const a of addresses) {
    if (!a) continue;
    const rec = cache.get(a.toLowerCase());
    if (rec) out.set(a.toLowerCase(), rec);
  }
  return out;
}

/** Warm the cache at boot so the first match of a session already has records.
 *  Fire-and-forget; failure is logged by `refresh` and retried on the next tick. */
export function primeRecords(): void {
  if (!ENDPOINT) return;
  void refresh();
}

/** True when a subgraph endpoint is configured — used for the "data source" pill. */
export const GRAPH_ENABLED = Boolean(ENDPOINT);
