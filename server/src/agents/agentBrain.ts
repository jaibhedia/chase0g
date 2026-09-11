/**
 * Agent brains — the "slow tier" of Chase · Zero's two-tier AI.
 *
 * Every few seconds the host client sends a compact world snapshot. We turn it
 * into a prompt, run ONE inference request on the 0G Compute Router, and get back
 * a high-level intent per agent (what to do + persona + a one-line taunt). The
 * Phaser client then executes that intent every frame (the "fast tier"). The LLM
 * never steers per-frame — it only sets strategy — so the match stays cheap and
 * responsive while still being driven by real decentralized inference.
 *
 * Resilience: hard request timeout, retry-once, and a per-room last-good cache so
 * a hiccup degrades to the previous decision (or scripted fallback) instead of a
 * stall. This keeps the game playable for judges even if 0G blips.
 */
import type OpenAI from 'openai';
import { getAiClient, AI_MODEL } from '../ai/provider';
import type { PlayerRecord } from '../graph/playerRecords';

export type AgentMode = 'hunt' | 'flee' | 'guard' | 'intercept' | 'roam';
export type AgentPersona = 'aggressive' | 'sneaky' | 'cocky' | 'cautious';

export interface Intent {
  agentId: string;
  mode: AgentMode;
  targetId?: string;
  persona?: AgentPersona;
  taunt?: string;
}

export interface SnapshotPlayer {
  id: string;
  kind: 'human' | 'agent';
  x: number;
  y: number;
  hasEgg: boolean;
  persona?: AgentPersona;
  /** Privy user id, sent by the host client so the server can resolve this player's
   *  wallet (and therefore their on-chain record). Absent for bots. */
  userId?: string;
  /**
   * This player's staking history, read from the ChaseStake subgraph and attached by
   * the server before inference. Absent for bots, for wallet-less Free Play players,
   * and for anyone with no settled match yet.
   */
  record?: PlayerRecord;
}

export interface AgentSnapshot {
  roomCode: string;
  map: { w: number; h: number };
  /** holderId null → egg is loose on the ground (or not yet picked up). */
  egg: { x: number; y: number; holderId: string | null };
  players: SnapshotPlayer[];
}

export type IntentSource = 'og' | 'cache' | 'fallback';

const MODES: AgentMode[] = ['hunt', 'flee', 'guard', 'intercept', 'roam'];
const PERSONAS: AgentPersona[] = ['aggressive', 'sneaky', 'cocky', 'cautious'];
// Real qwen2.5-omni round-trips run ~2–3s, so a tight 2.5s timeout would kill valid
// responses. 6s leaves headroom; the per-room in-flight guard prevents overlap.
const REQUEST_TIMEOUT_MS = 6000;
// Bounded so intent JSON can't run away, but well within the model's [10,2048] range.
const MAX_TOKENS = 800;
const MAX_TAUNT_LEN = 80;
// After a 429 we stop calling 0G for a while so we don't keep hammering the limit;
// agents run on cached intents + local steering meanwhile.
const RATE_LIMIT_BACKOFF_MS = 20000;
// A 402 "insufficient balance" won't self-heal mid-session (needs a top-up at
// pc.testnet.0g.ai), so we back off much longer instead of retrying every tick + spamming.
const BALANCE_BACKOFF_MS = 300_000; // 5 min
let backoffUntil = 0;
let balanceWarned = false;

/** Last successful decision per room — degrade to this on a transient failure. */
const lastGood = new Map<string, Intent[]>();

/** One timestamped row of the match's AI decision transcript (Phase 2 / 0G Storage):
 *  exactly what the 0G Compute brains decided, when. Bundled into the verifiable
 *  replay uploaded to 0G Storage at match end. */
export interface TranscriptEntry {
  t: number;
  source: IntentSource;
  /** holder player id at decision time (null = egg loose), for replay context. */
  holderId: string | null;
  intents: Intent[];
}
/** Rolling per-room transcript. Capped so a long match can't grow unbounded. */
const transcripts = new Map<string, TranscriptEntry[]>();
const MAX_TRANSCRIPT = 400;

/** The match's recorded AI decisions (for the 0G Storage replay bundle). */
export function getTranscript(roomCode: string): TranscriptEntry[] {
  return transcripts.get(roomCode) ?? [];
}

function recordTranscript(roomCode: string, entry: TranscriptEntry): void {
  const arr = transcripts.get(roomCode) ?? [];
  arr.push(entry);
  if (arr.length > MAX_TRANSCRIPT) arr.splice(0, arr.length - MAX_TRANSCRIPT);
  transcripts.set(roomCode, arr);
}

export function forgetRoom(roomCode: string): void {
  lastGood.delete(roomCode);
  transcripts.delete(roomCode);
}

const SYSTEM_PROMPT = `You are the hive-mind controlling the AI opponents in "Chase · Zero", a top-down arena game.
Rules: there is ONE egg. Whoever holds it is the target — everyone else hunts the holder. The holder is slower and must flee. If the egg is loose on the ground, race to grab it.
You control only the players whose kind is "agent". For EACH agent, choose:
- mode: one of hunt | flee | guard | intercept | roam
    hunt = chase the current egg holder directly
    flee = you hold the egg, run from the nearest threat
    intercept = cut off the holder's likely path (smarter than hunt)
    guard = hold a chokepoint / loose-egg area
    roam = no clear target, patrol
- targetId: the player id this intent is about (the holder for hunt/intercept, the nearest threat for flee). Omit for roam.
- persona: aggressive | sneaky | cocky | cautious — keep it consistent with the agent's given persona.
- taunt: ONE short in-character trash-talk line (max 12 words), matching the persona. Vary it; reference the situation.
Coordinate by distance (each agent has distToHolder/distToEgg): the CLOSEST agent should hunt directly; the others intercept to cut off the escape, or guard a lane — never all dogpile the same way. Keep each agent's tactic coherent with its "previously" mode unless the situation clearly changed.

THREAT ASSESSMENT — some human players carry a "record" field. This is their real staking history on Arc, indexed from the match-escrow contract: played (matches), won (matches), net (USDC they are up or down overall), best (biggest single pot). Use it to decide WHO IS DANGEROUS, not just who is close:
- A player with a strongly positive net, or a high won/played ratio, is a proven winner. Treat them as the primary threat. When two targets are comparable in distance, pressure THAT one: hunt them, deny them the loose egg, and have a second agent guard their escape lane even before they hold the egg.
- A player with no record, or a negative net, is unproven. Spend fewer agents on them; a single hunter is enough.
- Never let a proven winner sit unmarked while every agent chases someone with no history.
- The nearest agent still takes the direct hunt — record changes PRIORITY between targets, never basic geometry.
- Taunts may reference the record when it is notable ("up 4 USDC? not after this", "zero wins, figures"), but only when it is actually in the data. Never invent numbers.
Respond ONLY with strict JSON: {"intents":[{"agentId","mode","targetId","persona","taunt"}, ...]} with exactly one entry per agent. No prose.`;

function buildUserPrompt(snap: AgentSnapshot, agents: SnapshotPlayer[], prev?: Intent[]): string {
  const holderId = snap.egg.holderId;
  const holderP = holderId ? snap.players.find((p) => p.id === holderId) : undefined;
  const prevById = new Map((prev ?? []).map((i) => [i.agentId, i]));
  const distTo = (a: SnapshotPlayer, b?: { x: number; y: number }) =>
    b ? Math.round(Math.hypot(a.x - b.x, a.y - b.y)) : null;

  const compact = {
    map: snap.map,
    egg: holderId
      ? { heldBy: holderId, holderPos: holderP ? { x: Math.round(holderP.x), y: Math.round(holderP.y) } : undefined }
      : { loose: true, x: Math.round(snap.egg.x), y: Math.round(snap.egg.y) },
    players: snap.players.map((p) => ({
      id: p.id,
      kind: p.kind,
      x: Math.round(p.x),
      y: Math.round(p.y),
      hasEgg: p.hasEgg,
      ...(p.persona ? { persona: p.persona } : {}),
      // On-chain staking history from The Graph. Short keys and rounded USDC keep this
      // cheap — it rides along on every tick, and the model only needs the magnitudes.
      ...(p.record
        ? {
            record: {
              played: p.record.matchesPlayed,
              won: p.record.matchesWon,
              net: Number(p.record.netProfit.toFixed(2)),
              best: Number(p.record.biggestPot.toFixed(2)),
            },
          }
        : {}),
    })),
    // Per-agent context so the model can divide roles by distance and stay coherent
    // with its last decision (rolling memory) instead of re-deciding from scratch.
    youControl: agents.map((a) => ({
      agentId: a.id,
      persona: a.persona ?? 'aggressive',
      distToHolder: holderP && holderP.id !== a.id ? distTo(a, holderP) : null,
      distToEgg: !holderId ? distTo(a, snap.egg) : null,
      previously: prevById.get(a.id)?.mode ?? null,
    })),
  };
  return `Current state:\n${JSON.stringify(compact)}\n\nReturn one intent per agent in youControl.`;
}

/** Extract the JSON object from a model reply that may be wrapped in prose or a
 *  ```json fence. Returns the parsed value, or null if nothing parses. */
function extractJson(content: string): any {
  const stripped = content.replace(/```json\s*|\s*```/gi, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(stripped.slice(start, end + 1)); } catch { /* fall through */ }
    }
    return null;
  }
}

/** Coerce a raw model object into a safe Intent, clamped to known ids/enums. */
function sanitize(raw: any, agentIds: Set<string>, playerIds: Set<string>): Intent | null {
  if (!raw || typeof raw.agentId !== 'string' || !agentIds.has(raw.agentId)) return null;
  const mode: AgentMode = MODES.includes(raw.mode) ? raw.mode : 'roam';
  // Models often capitalize ("Aggressive") — normalize before the enum check.
  const personaLc = typeof raw.persona === 'string' ? (raw.persona.toLowerCase() as AgentPersona) : undefined;
  const persona: AgentPersona | undefined = personaLc && PERSONAS.includes(personaLc) ? personaLc : undefined;
  const targetId = typeof raw.targetId === 'string' && playerIds.has(raw.targetId) ? raw.targetId : undefined;
  const taunt =
    typeof raw.taunt === 'string' && raw.taunt.trim()
      ? raw.taunt.trim().slice(0, MAX_TAUNT_LEN)
      : undefined;
  return { agentId: raw.agentId, mode, targetId, persona, taunt };
}

async function callOnce(
  og: OpenAI,
  snap: AgentSnapshot,
  agents: SnapshotPlayer[],
  prev?: Intent[],
): Promise<Intent[]> {
  // NOTE: no response_format json_object — qwen2.5-omni rejects JSON mode
  // ("model_not_capable"). We instruct JSON in the prompt and parse it from text.
  const completion = await og.chat.completions.create(
    {
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(snap, agents, prev) },
      ],
      temperature: 0.9,
      max_tokens: MAX_TOKENS,
    },
    { timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 },
  );

  const content = completion.choices?.[0]?.message?.content ?? '';
  const parsed = extractJson(content);
  const rawList: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.intents) ? parsed.intents : [];

  const agentIds = new Set(agents.map((a) => a.id));
  const playerIds = new Set(snap.players.map((p) => p.id));
  const byAgent = new Map<string, Intent>();
  for (const raw of rawList) {
    const intent = sanitize(raw, agentIds, playerIds);
    if (intent) byAgent.set(intent.agentId, intent);
  }
  // "flee" only makes sense for the egg carrier; correct the model's occasional slip
  // so a non-holder that should be chasing shows (and acts as) a hunter.
  for (const a of agents) {
    const it = byAgent.get(a.id);
    if (it && it.mode === 'flee' && a.id !== snap.egg.holderId) it.mode = 'hunt';
  }
  // Guarantee exactly one intent per agent (fill any the model missed).
  return agents.map(
    (a) => byAgent.get(a.id) ?? { agentId: a.id, mode: 'roam', persona: a.persona },
  );
}

/**
 * Produce intents for every agent in the snapshot. Calls 0G Compute once (with a
 * single retry); on total failure returns the room's last-good decision, or an
 * empty list (→ scripted fallback on the client) if there's nothing cached.
 */
export async function decideIntents(
  snap: AgentSnapshot,
): Promise<{ intents: Intent[]; source: IntentSource }> {
  const og = getAiClient();
  const agents = snap.players.filter((p) => p.kind === 'agent');
  if (!og || agents.length === 0) {
    return { intents: lastGood.get(snap.roomCode) ?? [], source: 'fallback' };
  }

  const cacheResult = () => {
    const cached = lastGood.get(snap.roomCode);
    return { intents: cached ?? [], source: (cached ? 'cache' : 'fallback') as IntentSource };
  };

  // In a rate-limit backoff window: skip the call entirely, run on cached intents.
  if (Date.now() < backoffUntil) return cacheResult();

  // Feed the room's previous decision back in as rolling context so tactics stay
  // coherent across ticks instead of each call deciding blind. ONE call (no retry —
  // retrying on a 429 only makes the rate limit worse).
  const prev = lastGood.get(snap.roomCode);
  try {
    const intents = await callOnce(og, snap, agents, prev);
    lastGood.set(snap.roomCode, intents);
    balanceWarned = false; // healthy again — allow a fresh warning if it later runs dry
    // Record this real 0G decision into the match transcript (Phase 2 replay bundle).
    recordTranscript(snap.roomCode, {
      t: Date.now(),
      source: 'og',
      holderId: snap.egg.holderId,
      intents,
    });
    return { intents, source: 'og' };
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const msg = (err as Error).message || '';
    if (status === 402 || /insufficient balance/i.test(msg)) {
      backoffUntil = Date.now() + BALANCE_BACKOFF_MS;
      if (!balanceWarned) {
        balanceWarned = true;
        console.warn('[0G] Compute balance exhausted — pausing inference 5m; agents on scripted fallback. Top up at https://pc.testnet.0g.ai');
      }
    } else if (status === 429 || msg.includes('429') || /rate limit/i.test(msg)) {
      backoffUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
      console.warn(`[0G] rate limited — backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s (using cached intents)`);
    } else {
      console.warn('[0G] inference failed, degrading:', msg);
    }
    return cacheResult();
  }
}
