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
import { getOgClient, OG_MODEL } from '../og/computeRouter';

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

/** Last successful decision per room — degrade to this on a transient failure. */
const lastGood = new Map<string, Intent[]>();

export function forgetRoom(roomCode: string): void {
  lastGood.delete(roomCode);
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
Coordinate: don't send every agent at the same target the same way — mix hunt and intercept, let one guard.
Respond ONLY with strict JSON: {"intents":[{"agentId","mode","targetId","persona","taunt"}, ...]} with exactly one entry per agent. No prose.`;

function buildUserPrompt(snap: AgentSnapshot, agents: SnapshotPlayer[]): string {
  const holder = snap.egg.holderId;
  const compact = {
    map: snap.map,
    egg: holder ? { heldBy: holder } : { loose: true, x: Math.round(snap.egg.x), y: Math.round(snap.egg.y) },
    players: snap.players.map((p) => ({
      id: p.id,
      kind: p.kind,
      x: Math.round(p.x),
      y: Math.round(p.y),
      hasEgg: p.hasEgg,
      ...(p.persona ? { persona: p.persona } : {}),
    })),
    youControl: agents.map((a) => ({ agentId: a.id, persona: a.persona ?? 'aggressive' })),
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
): Promise<Intent[]> {
  // NOTE: no response_format json_object — qwen2.5-omni rejects JSON mode
  // ("model_not_capable"). We instruct JSON in the prompt and parse it from text.
  const completion = await og.chat.completions.create(
    {
      model: OG_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(snap, agents) },
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
  const og = getOgClient();
  const agents = snap.players.filter((p) => p.kind === 'agent');
  if (!og || agents.length === 0) {
    return { intents: lastGood.get(snap.roomCode) ?? [], source: 'fallback' };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const intents = await callOnce(og, snap, agents);
      lastGood.set(snap.roomCode, intents);
      return { intents, source: 'og' };
    } catch (err) {
      if (attempt === 1) {
        console.warn('[0G] inference failed, degrading:', (err as Error).message);
      }
    }
  }
  const cached = lastGood.get(snap.roomCode);
  return { intents: cached ?? [], source: cached ? 'cache' : 'fallback' };
}
