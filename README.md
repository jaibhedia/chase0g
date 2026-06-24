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

```bash
# Supabase — https://supabase.com/dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Socket.io backend URL
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

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

# Terminal 3 — Express + Socket.IO backend (only needed for multiplayer)
npm run socket:dev   # http://localhost:3001
```

Open [http://localhost:3000](http://localhost:3000) and start a match.

### Production build

```bash
npm run build:all    # builds game-app (base=/game-app/), copies dist → public/game-app, then next build
```

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

**Proprietary — © 2026 Shantanu Swami. All rights reserved.**

This code is provided for review (e.g. hackathon judging) only. No permission is
granted to use, copy, modify, distribute, or create derivative works without the
author's prior written consent. See [`LICENSE`](LICENSE).
