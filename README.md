# Chase · Zero — a 0G-native AI agent arena

> Built for **The Zero Cup**, 0G's global vibe-coding tournament. Full product spec: [`SPEC.md`](SPEC.md).

A fast multiplayer "egg-tag" arena where **your opponents are AI agents whose brains run on [0G Compute](https://docs.0g.ai/).** One golden egg; the holder flees, everyone else hunts. Each agent forms its own strategy, has a personality, and trash-talks you in real time — because a real LLM is reasoning about the match on 0G's decentralized inference network.

### Why 0G is load-bearing (not a bolt-on)

The intelligence of the opponents *is* the product, and 0G produces it:

- **0G key set** → agents hunt / flee / guard / intercept, coordinate, and taunt. The arena feels alive.
- **0G key removed** → agents collapse to dumb fallback steering and an **"AI: 0G ○ offline"** pill appears.

That on/off difference is the proof for the tournament's #1 entry rule: *remove 0G and the app is meaningfully different.*

### 0G integration (phased to the tournament rounds)

| Service | Real work it does | Round |
|---|---|---|
| **0G Compute** (Router) | LLM inference sets each agent's strategy + persona + live taunt | JUN 23 |
| **0G Storage** | Verifiable match replays + the agents' full decision transcript (content root hash shown as proof) | JUN 28 |
| **0G Chain** (Galileo) | Trustless on-chain leaderboard linking score → replay hash | JUL 4–8 |

> **0G keys are server-side only** (`server/` env). They are never prefixed `NEXT_PUBLIC_` and never reach the browser bundles or git — a leaked funded key spends real testnet balance. See [`.env.example`](.env.example).

### The Graph — the agents' on-chain threat model

The AI opponents don't just see the arena, they see **who they're playing**. Every match is
staked in USDC through the `ChaseStake` escrow on Arc; a subgraph indexes that escrow, and
the agent brains read it to decide **who to hunt**.

```
ChaseStake (Arc)  ──events──▶  subgraph  ──GraphQL──▶  server  ──▶  0G Compute
  MatchStaked                  (Studio)     records      join       agent intents
  MatchSettled                                         userId→wallet   (who to hunt)
```

A player who is up 4 USDC across six matches gets marked as the primary threat: agents
prioritise them over a closer but unproven player, guard their escape lanes before they
ever touch the egg, and taunt them about it by name. A player with no history draws a
single hunter. **Record changes priority between targets; geometry still decides the
mechanics.**

| Piece | Where |
|---|---|
| Subgraph (schema, mappings, manifest) | [`subgraph/`](subgraph/) |
| Live-data reader (cached, non-blocking) | [`server/src/graph/playerRecords.ts`](server/src/graph/playerRecords.ts) |
| userId → wallet → record join | `withOnChainRecords()` in [`server/src/index.ts`](server/src/index.ts) |
| Threat-assessment prompt | `SYSTEM_PROMPT` in [`server/src/agents/agentBrain.ts`](server/src/agents/agentBrain.ts) |
| Player-facing leaderboard | [`app/components/Leaderboard.tsx`](app/components/Leaderboard.tsx) |

Data is live from Subgraph Studio, never mocked. The reader is a **synchronous cache read**
that never awaits inside the match loop — a slow or unreachable subgraph costs the 6s
inference budget nothing, and the agents simply degrade to spatial-only reasoning. Verify
the source yourself:

```bash
curl -s -X POST "$SUBGRAPH_URL" -H 'Content-Type: application/json' \
  -d '{"query":"{ players(first: 10, orderBy: netProfit, orderDirection: desc) { id matchesPlayed matchesWon netProfit } }"}'
```

### Base gameplay (carried over from the Chase engine)

- 6 characters each with a unique power-up (unlocks at 15s)
- Single player (vs AI agents) or multiplayer (2–4 players via Socket.io)
- Proximity voice chat, installable landscape PWA

### Power-Ups

| Character | Power-Up |
|---|---|
| Skinny Flash | Speed Trail — 2.5x speed for 3s |
| Fat Jumper | Earthquake — stuns nearby players |
| Muscle Man | Power Punch — knocks back target |
| Alien Walker | Teleport — instant repositioning |
| Shadow Creep | Invisibility — vanish for 5s |
| Dog Hybrid | Force Field — invulnerable for 3s |

Controls: **WASD / Arrow Keys** to move, **SPACEBAR** to use power-up.

---

## Tech Stack

Three parts, each self-contained:

- **Landing** (`app/`): Next.js 14 + TypeScript, Tailwind, Zustand
- **Game** (`game-app/`): React + TypeScript (Vite) + Phaser 3
- **Backend** (`server/`): Express + Node + TypeScript with Socket.IO (run via `tsx`)
- **Database**: Supabase (PostgreSQL)

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

**`.env.local`** (the Next shell — these ship to the browser, so nothing secret):

```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_PRIVY_APP_ID=            # https://dashboard.privy.io — without it, ranked play is disabled
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_CHASESTAKE_ADDRESS=0xD648def45026f437351D797dC3574fa97507BA83
NEXT_PUBLIC_SUBGRAPH_URL=            # Subgraph Studio query URL — powers the leaderboard
```

**`server/.env`** (never committed — see `server/.env.example` for the annotated version):

```bash
ARC_PRIVATE_KEY=        # settlement authority; the wallet ChaseStake records as `server`
FAUCET_PRIVATE_KEY=     # SEPARATE wallet that drips 2 USDC to each new player
OG_ROUTER_API_KEY=      # 0G Compute — without it agents fall back to scripted play
SUBGRAPH_URL=           # same Studio URL; lets agents factor in players' on-chain records
```

The faucet and settlement keys are deliberately different wallets: the faucet gives money to
anyone who asks, while the settlement key holds the escrow's authority. One wallet for both
means a drained faucet is also a match that cannot pay out.

Each key degrades to a no-op rather than crashing, so the server boots with none of them —
it just logs which features are off. Check the boot lines to see what's live.

---

## Local Development

Three independent parts. The **Next.js shell** (`app/`) serves landing/selection/results, the
**Vite + Phaser game** (`game-app/`) runs gameplay, and the **Express backend** (`server/`)
relays multiplayer. Shell ↔ game hand off via the URL hash (works cross-origin in dev):
selecting a map redirects :3000 → :5173, finishing redirects back to :3000/results.

```bash
# one-time: install each part's deps
npm install
cd game-app && npm install && cd ..
cd server   && npm install && cd ..

# Terminal 1 — Next.js shell (landing / selection / results)
npm run dev          # http://localhost:3000

# Terminal 2 — Vite + Phaser game
npm run dev:game     # http://localhost:5173

# Terminal 3 — Express + Socket.IO backend (multiplayer, staking, faucet, 0G)
npm run socket:dev   # http://localhost:3001
```

Open [http://localhost:3000](http://localhost:3000) and start a match.

**All three are required.** Terminal 2 is not optional in dev: `/game` points at
`localhost:5173`, and if that server isn't up the game page 404s with no error explaining
why. Terminal 3 is required for anything multiplayer, staked, or AI.

Verify everything is actually live before testing — the socket server prints what it can do:

```
[ai]     Provider ready → 0G Compute (model: qwen2.5-omni)
[arc]    ChaseStake ready → 0xD648…BA83
[faucet] 0xe49a…9EfA holds 20.00 USDC — roughly 9 more players
```

Any line that says *disabled* or *not configured* is a missing key, not a bug.

### Testing two players

Use **two different browser profiles** (a normal window and an incognito one), not two tabs.
Tabs share one Privy session, so you would be playing yourself from a single wallet. Sign in
with a different email in each; both are funded automatically on first sign-in.

### Production build

```bash
npm run build:all    # builds game-app (base=/game-app/), copies dist → public/game-app, then next build
```

**Use `build:all`, never plain `npm run build`.** `build` compiles only the Next shell and
leaves `public/game-app/` empty, producing a site that looks fine until someone presses Play
and gets a 404 — with nothing in the build output warning you.

The game is served from `/game-app/index.html` on the **same domain** as the shell. The shell auto-
targets that path in production (no env needed); the game uses same-origin relative paths to return
to the lobby/results.

---

## Deployment

Two services: the **Next shell with the game embedded** (Vercel) and the **Socket.IO server** (Render).

### 1. Socket server → Render
- Push the repo, then Render → **New → Blueprint** (uses [`render.yaml`](render.yaml)): `rootDir: server`,
  `npm install` + `npm start`, health check `/health`. PORT is injected by Render automatically.
- Set **`CORS_ORIGIN`** to your site URL (`https://chase.abstractstudio.in`). Leave
  unset to allow any origin.


### 2. Next shell + game → Vercel
- Import the repo. [`vercel.json`](vercel.json) sets the build command to **`npm run build:all`**, which
  bundles the game into `public/game-app/` before `next build`.
- Set these **Environment Variables** (Production):

  | Variable | Value |
  | --- | --- |
  | `NEXT_PUBLIC_SOCKET_URL` | your Render URL (`https://chase.onrender.com`) |
  | `VITE_SOCKET_URL` | same Render URL (read by the game build) |

  `NEXT_PUBLIC_GAME_URL` and `VITE_LANDING_URL` are **not needed** — the embedded same-origin paths
  are the production defaults.
- Deploy. After it's live, confirm `CORS_ORIGIN` on Render matches the Vercel domain.

See per-app [`​.env.example`](.env.example), [`game-app/.env.example`](game-app/.env.example), and
[`server/.env.example`](server/.env.example) for the full variable reference.

---

## Project Structure

```
chase/
├── app/                    # Next.js shell — landing, selection, results
│   ├── components/         # AudioInitializer, etc.
│   ├── data/               # characters.ts, maps.ts
│   ├── store/              # gameStore.ts (Zustand)
│   ├── utils/              # audioManager.ts
│   ├── game/page.tsx       # writes localStorage config, redirects to the game
│   └── page.tsx            # Landing page
├── game-app/               # Vite + React + Phaser — the actual game
│   └── src/
│       ├── scene/          # gameEngine.ts, gameScene.ts, gameShared.ts (Phaser)
│       ├── components/     # GameCanvas, GameHUD, MobileControls
│       ├── store/ data/    # standalone copies kept in sync with app/
│       └── App.tsx         # reads the handoff config, boots the scene
├── server/                 # Express + Node + TypeScript backend (Socket.IO)
│   ├── src/index.ts        # rooms + lobby/game relay
│   └── package.json        # self-contained; run with `tsx`
├── public/assets/          # Shell sprites; game-app/public/assets holds the tiles
├── render.yaml             # Render blueprint
└── supabase_schema.sql     # Database schema
```

> The three parts are intentionally self-contained — `app/`, `game-app/`, and `server/` each
> have their own `package.json` and don't import from each other. The game keeps its own copies
> of `store/`, `data/`, and `audioManager` so it runs without Next.js SSR/StrictMode. There is
> no shared `game/` folder — don't reintroduce cross-imports.

---

## License

This repository is **dual-licensed**:

| Path | License |
|---|---|
| `packages/` — all ETHOnline 2026 hackathon work | **MIT** — see [`packages/LICENSE`](packages/LICENSE) |
| Everything else — the Chase game engine | **Proprietary** — see [`LICENSE`](LICENSE) |

**`packages/` (MIT).** Every artifact built during ETHOnline 2026 under the Continuity
Track — the Arc staking contracts and The Graph subgraph — is open source and free to
use, copy, modify, and distribute. See [`packages/README.md`](packages/README.md).

**Everything else (proprietary).** © 2026 Shantanu Swami. All rights reserved. Provided
for review (e.g. hackathon judging) only. No permission is granted to use, copy, modify,
distribute, or create derivative works without the author's prior written consent.
