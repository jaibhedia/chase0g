# Chase · Zero — Product Spec (PRD)

> A 0G-native AI agent arena. Built for **The Zero Cup** (0G's global vibe-coding tournament).

## 1. Product

**Chase · Zero** is a fast multiplayer "egg-tag" arena. One golden egg, everyone else chasing whoever holds it. The twist: **your opponents are not scripted bots — they are AI agents whose brains run on 0G Compute.** Each agent forms its own strategy, has a personality, and trash-talks you in real time, because a real LLM is reasoning about the match on 0G's decentralized inference network.

**One-liner:** *Decentralized-AI opponents you can actually outthink — powered end-to-end by 0G.*

This is an **AI-native game** in the truest sense for the tournament: the intelligence of the opponents is the product, and that intelligence is produced by 0G.

## 2. Why it qualifies (Submission Criterion #01)

> "0G has to do real work in your app: if it runs the same without it, that's a bolt-on and it doesn't qualify."

0G Compute is **load-bearing**, not decorative:

- With `OG_ROUTER_API_KEY` set → agents reason (hunt / flee / guard / intercept), coordinate, switch tactics, and taunt. The match feels alive.
- Remove the 0G key → agents collapse to dumb fallback steering, a visible **"AI: 0G ○ offline"** pill appears, and the trash-talk goes silent.

The demo video shows exactly this on/off toggle — the clearest possible proof that **the app is meaningfully different without 0G.**

Maps to the other entry criteria: **#02** built with AI coding tools (vibe coding); **#03** new work in the tournament window, reusing only our own prior engine; **#04** public repo + live build + demo video that matches the code.

## 3. 0G integration map

| Layer | 0G service | What it does (real work) | SDK / endpoint | Phase |
|---|---|---|---|---|
| **Agent brains** | **0G Compute** (Router) | LLM inference sets each agent's strategy + persona + live taunt | `openai` SDK → testnet router `https://router-api-testnet.integratenetwork.work/v1` (key from pc.testnet.0g.ai) | **1 — JUN 23** |
| **Verifiable replays** | **0G Storage** | Uploads each match's result + the agents' full timestamped decision transcript; returns a content root hash shown as proof | `@0glabs/0g-ts-sdk`, indexer `https://indexer-storage-testnet-turbo.0g.ai` | 2 — JUN 28 |
| **On-chain leaderboard** | **0G Chain** (Galileo) | Trustless tournament leaderboard; each entry links `{player, score, replayRootHash}` | EVM RPC `https://evmrpc-testnet.0g.ai`, `ChaseLeaderboard.sol` | 3 — JUL 4–8 |

**Key safety:** all 0G keys/wallets are **server-side only** (`server/` env on Render). They are never prefixed `NEXT_PUBLIC_` and never reach the `game-app`/`app` bundles or git.

## 4. Architecture — the two-tier agent loop

LLM inference is too slow/costly for per-frame steering, so control is split:

- **Slow tier (0G Compute, ~every 3.5s, server-side):** the LLM sets each agent's high-level **intent**. This is where 0G does the real work.
- **Fast tier (local, every frame, client):** the existing Phaser steering executes the current intent. We make steering *intent-driven*, we don't replace the math.

```
Phaser client (game-app)              Express server (server/)             0G Compute Router
 every ~3.5s: emit 'agent-tick' ─────► agentBrain.decideIntents(snapshot)
  { roomCode, snapshot }               openai → router-api-testnet…/v1 ──────► inference
                                       validate JSON intents  ◄──────────────  { intents }
 on 'agent-intents' ◄───────────────── io.to(room).emit('agent-intents')
 write bot.aiIntent; updateBots()
  executes it each frame (fast tier)
```

Only the **host client** (or the single-player client) emits `agent-tick`, so a 4-player room pays for one inference stream, not four.

**Intent schema** (strict JSON, one object per agent):

```jsonc
{
  "agentId": "bot-0",
  "mode": "hunt" | "flee" | "guard" | "intercept" | "roam",
  "targetId": "player",          // optional — who to hunt/intercept
  "persona": "aggressive" | "sneaky" | "cocky" | "cautious",
  "taunt": "Hand over the egg and nobody gets juked."
}
```

**Resilience:** hard ~2.5s timeout, retry-once, cache last-good intents; on failure agents use scripted fallback + the "AI offline" pill. The game is always playable for judges even if a testnet endpoint hiccups.

## 5. Gameplay

- **Egg-tag:** one egg in the arena. Touch it to hold it; holders are slower and must flee. Everyone else hunts the holder. Score = time/tag count held (existing `eggHoldCount`).
- **Modes:** single-player vs AI agents; multiplayer rooms (up to 4) with AI agents filling empty slots.
- **Agent personas:** the LLM is told each agent's persona, which colors both tactics (a *sneaky* agent ambushes from cover; an *aggressive* one rushes the holder) and taunt voice.
- Arena, power-ups, proximity voice chat, and PWA support carry over from the base engine.

## 6. Milestones (Zero Cup rounds)

| 0G deadline | Round | Deliverable |
|---|---|---|
| **JUN 23** | Group Stage | **Phase 1**: 0G Compute agent brains live, on/off proof, public repo + demo video. Qualifying MVP. |
| **JUN 28** | Round of 32 | **Phase 2**: 0G Storage verifiable replays + AI decision transcripts (root hash on results screen). |
| **JUL 4** | Round of 16 | **Phase 3**: 0G Chain `ChaseLeaderboard` deployed; results posted + read back on-chain. |
| **JUL 8** | Final lock | Polish; one build rides quarters → final. |

## 7. Env & setup

See `.env.example`. Server-side 0G vars: `OG_ROUTER_BASE_URL`, `OG_ROUTER_API_KEY`, `OG_MODEL`, `OG_AGENT_TICK_SECONDS` (Phase 1); `OG_EVM_RPC`, `OG_STORAGE_INDEXER`, `OG_PRIVATE_KEY`, `OG_LEADERBOARD_ADDRESS` (Phases 2–3).

1. **Testnet** — get a Compute Router API key at [pc.testnet.0g.ai](https://pc.testnet.0g.ai), deposit testnet 0G, and copy the FULL secret shown once on creation. Set `OG_ROUTER_BASE_URL=https://router-api-testnet.integratenetwork.work/v1`. (Mainnet equivalent: pc.0g.ai → `https://router-api.0g.ai/v1`.)
2. Pick a chat model from the live catalog (e.g. `qwen2.5-omni`); set `OG_MODEL`.
3. **Phases 2–3** — fund a Galileo testnet wallet (faucet via [docs.0g.ai](https://docs.0g.ai)); set `OG_PRIVATE_KEY`. Deploy the leaderboard: `cd contracts && npm i && npm run deploy`, then set `OG_LEADERBOARD_ADDRESS`.
4. `cd server && npm i && npm run dev`; `cd game-app && npm i && npm run dev`; `npm i && npm run dev` (Next shell).
5. Deploy: game embedded into the Next app (Vercel), socket+0G server on Render (existing `render.yaml`).

## 8. Demo plan & submission checklist

- [ ] Public repo URL (this repo).
- [ ] Live build deployed (Vercel + Render) **or** demo video.
- [ ] 60–90s demo: agents coordinating + taunting → toggle 0G key off → agents go dumb/silent → criterion #01 proof.
- [ ] Demo behavior matches committed code (no faking — criterion #08).
- [ ] Valid submission locked before the JUN 23 group-stage deadline.
