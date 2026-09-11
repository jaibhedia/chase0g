# Architecture — Chase Dinosaurs

Required deliverable for the Arc track ("working frontend and backend plus an architecture
diagram"). Renders natively on GitHub and in the ETHGlobal showcase.

---

## System

```mermaid
flowchart TB
    subgraph browser["🖥️ Browser"]
        NEXT["Next.js shell<br/><i>auth gate · lobby · stake panel · leaderboard</i>"]
        PHASER["Phaser game app<br/><i>60s match loop · 60fps render</i>"]
    end

    subgraph srv["⚙️ Socket server — Express + Socket.IO"]
        ROOMS["Room & match state<br/><i>authoritative</i>"]
        BRAIN["Agent brain orchestrator<br/><i>snapshot → intents</i>"]
        FAUCET["Faucet<br/><i>2 USDC, one per human</i>"]
        SETTLE["Settlement authority<br/><i>onlyServer signer</i>"]
    end

    subgraph arc["⛓️ Arc testnet — chain 5042002"]
        ESCROW["ChaseStake escrow<br/>0xD648…BA83"]
        USDC["USDC precompile<br/>0x3600…0000"]
    end

    PRIVY["🔑 Privy<br/><i>embedded wallet</i>"]
    WORLD["👤 World ID<br/><i>Selfie Check</i>"]
    GRAPH["📊 The Graph<br/><i>ChaseStake subgraph</i>"]
    OG["🧠 0G Compute<br/><i>qwen2.5-omni</i>"]

    NEXT -->|"email sign-in"| PRIVY
    PRIVY -->|"wallet address"| NEXT
    NEXT -->|"claim + proof"| FAUCET
    FAUCET -->|"verify proof"| WORLD
    FAUCET -->|"2 USDC transfer"| USDC
    NEXT -->|"stake 1 USDC<br/>signed by embedded wallet"| ESCROW

    NEXT -.->|"mounts"| PHASER
    PHASER <-->|"Socket.IO<br/>positions · egg · events"| ROOMS
    PHASER -->|"world snapshot<br/>every few seconds"| BRAIN

    BRAIN -->|"query player records"| GRAPH
    BRAIN -->|"prompt + on-chain records"| OG
    OG -->|"intents: mode · target · taunt"| BRAIN
    BRAIN -->|"agent-intents"| PHASER

    ROOMS -->|"match result"| SETTLE
    SETTLE -->|"settle(matchId, winner)"| ESCROW
    ESCROW -->|"pot → winner"| USDC

    ESCROW ==>|"MatchStaked · MatchSettled"| GRAPH
    GRAPH -->|"leaderboard"| NEXT

    classDef sponsor fill:#261309,stroke:#ffc93c,stroke-width:2px,color:#f4e7c3
    classDef chain fill:#11111c,stroke:#5fcde4,stroke-width:2px,color:#f4e7c3
    class PRIVY,WORLD,GRAPH,OG sponsor
    class ESCROW,USDC chain
```

**The closed loop is the thick edge.** Settlement writes to the escrow → the escrow's
events are indexed by the subgraph → the subgraph feeds the agent brains → the agents play
differently against proven winners → which changes who wins the next match → which settles
back to the escrow.

---

## Match lifecycle — where the money moves

```mermaid
sequenceDiagram
    autonumber
    participant P as Player
    participant W as Privy wallet
    participant S as Socket server
    participant E as ChaseStake escrow
    participant G as Subgraph
    participant AI as 0G Compute

    Note over P,W: Onboarding — once
    P->>W: sign in with email
    W-->>P: embedded wallet provisioned
    P->>S: claim faucet + World ID proof
    S->>S: verify proof, check nullifier
    S->>W: 2 USDC

    Note over P,E: Ranked match
    P->>E: stake 1 USDC
    E->>G: MatchStaked
    P->>S: ready

    loop every few seconds during the 60s match
        S->>G: player records (cached, non-blocking)
        G-->>S: played / won / netProfit
        S->>AI: world snapshot + on-chain records
        AI-->>S: intents — who to hunt, taunts
        S-->>P: agent-intents
    end

    Note over S,E: Settlement
    S->>E: settle(matchId, winner)
    E->>W: pot → winner
    E->>G: MatchSettled
    G-->>P: leaderboard updates
```

---

## Why each piece is load-bearing

| Component | Remove it and… |
|---|---|
| **Arc + ChaseStake** | No stakes. The game still runs, but nothing is at risk and nothing pays out. |
| **Privy** | No wallet without an extension and a seed phrase. Onboarding drops to near zero. |
| **World ID** | The faucet is keyed on email — ten inboxes, twenty USDC. |
| **The Graph** | Agents lose their threat model and fall back to pure geometry. Measurably dumber. |
| **0G Compute** | Agents fall back to scripted steering; no strategy, no taunts. |

---

## Runtime notes for reviewers

**Three processes in development:**

```bash
npm run dev          # Next shell        → :3000
npm run dev:game     # Phaser game app   → :5173
npm run socket:dev   # Socket + chain    → :3001
```

**Production is one command** — `npm run build:all`. Plain `npm run build` leaves
`public/game-app/` empty and the Play button 404s.

**Arc specifics worth knowing:**

- Chain id **5042002**, RPC `https://rpc.testnet.arc.network`, explorer
  `https://testnet.arcscan.app`
- The USDC precompile at `0x3600…0000` is a **6-decimal view over the 18-decimal native
  balance** (`native / 1e12 == balanceOf`). One native transfer funds gas *and* the stake —
  which is why the faucet sends a single transaction and the player never needs a second
  token.
- Settlement is `onlyServer`; `refund()` opens after `REFUND_DELAY = 1 hour` so a match
  that never settles is always recoverable by the players.

**Trust boundaries** — everything that matters is server-side or on-chain:

- World ID proofs are verified against World's Developer Portal by the server. A browser
  asserting `verified: true` is worth nothing.
- The settlement key never reaches the client; `settle()` reverts for any other caller.
- The subgraph endpoint is public and unauthenticated **by design** — anyone can run the
  same query and reproduce the leaderboard without trusting us.
