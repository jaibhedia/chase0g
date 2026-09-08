# Chase — ETHOnline 2026 · FINAL PLAN (3 Tracks)

## 🚨 **DEADLINE: Sunday Sep 13, 12:00 pm EDT** (= 9:30 pm IST Sep 13)

**Not the 14th.** Verified on the official rules page. **Today: Sep 8 → ~5 working days.**
Late submissions are not accepted. Everything below is compressed accordingly.

**Rule: build one → test one → commit one → push one.**

---

## Rules that shape the plan (from the official details page)

| Rule | Consequence |
|---|---|
| **Max 3 Partner Prizes.** Multiple tracks from one partner count as **1**. | ✅ Arc (2 bounties) + World + Graph = **exactly 3**. Our lineup fits with nothing wasted. |
| **Version control**: large single commits or missing history **may be disqualified**. | One commit per feature. No branch is required — a clean linear history is what's asked for. Tag `pre-ethonline2026` marks the baseline. |
| **AI tools**: must document where/how AI was used; spec-driven workflows must ship **all planning artifacts**. | [`AI_USAGE.md`](AI_USAGE.md) + this file are committed deliverables. |
| **AI must assist, not author.** Fully AI-built projects are ineligible for partner prizes. | Author reviews all contract code; documented in `AI_USAGE.md`. |
| **Continuity**: document pre-existing work; only new work is judged. | Disclosure table below + the git tag. |
| **Demo video**: 2–4 min, **≥720p**, no speed-up, no music-over-text, intro <20s, ≤4 bullets/slide. | Auto-rejected on upload otherwise. Budget real time. |
| **Judging**: Technicality · Originality · Practicality · **Usability (UI/UX/DX)** · WOW. | Usability is a scored criterion — Edgar's V-track earns points, it isn't decoration. |
| Async round 1 screens the top 20%, but **partner prizes are judged independently** and most prizes go to projects that don't advance. | Optimise for the 3 partner prizes, not the finalist track. |

---

## ✅ Eligibility checklist — verify TODAY

These are gates, not tasks. Any one of them missing costs everything else.

- [ ] **🚨 ETH stake placed on the Hacker Dashboard.** *"You'll need to stake ETH… to secure your spot."* Returned ~3 weeks after the event once you submit. **If you have not staked, you are not registered.** Check first, before writing another line of code.
- [ ] **Project created** on the Hacker Dashboard (name + description)
- [ ] **Continuity track selected** — "Ship a Feature" (extending an existing private/commercial product), not "Extend Open Source"
- [ ] **Pre-existing work disclosed in writing** to ETHGlobal
- [ ] **Project check-ins answered** — the dashboard notifies you, usually mid-week. Partners and staff use these to offer help; ignoring them wastes free support.
- [ ] Discord connected to the ETHGlobal account

> ⚠️ **"Partners are already judging your project."** Partner judging is asynchronous and ongoing — it doesn't start at the deadline. Keep the repo README and project page presentable from now on, not just on Sunday.

---

## Submission form — what it asks for

Two options at submission:

1. **Finalist + Partner Prizes** — you present live *if* selected (top ~20%). 7 minutes: 4 demo + 3 Q&A.
2. **Partner Prizes only** — async judging, no live session.

**Recommendation: option 1.** Partner judging is identical either way and requires nothing extra from you; the finalist path is pure upside. Only choose option 2 if a live session in EDT hours is impossible for you — judging lands after Sep 13.

**Per partner prize you must write:** how you used/integrated their tools · **feedback for them** · relevant comments. That's **three write-ups**, and it is *"the only way for partners to assess your project."*

→ Tracked as **S6** below. Budget 90 minutes; do not leave it to Sunday morning.

**Live-judging prep** (only if selected) — three questions they ask: what inspired the project · what tools you used and why · what challenges you solved and how.

---

## The 3 tracks

| # | Sponsor | Prize | $ |
|---|---|---|---|
| 1 | **Arc** | Best DeFi/Agentic App + Launch to Mainnet | **$3,166** |
| 2 | **World** | AgentKit Continuity | **$3,500** |
| 3 | **The Graph** | Best AI Use Case | **$2,500** |

**Total: $9,166**

> Arc is two bounties for one deliverable. Confirm in Arc's Discord that you can submit to both.

---

## The story (one feature, three sponsors)

> **The game existed. The hackathon turned its AI opponents into economic actors.**
> They got an identity (World), a wallet (Arc), and live data to reason over (Graph).

```
0G agent brain (already built)
   ├─ WORLD  → agent has a verified identity, registered in AgentBook
   ├─ GRAPH  → agent reads its own on-chain match history to pick a strategy
   └─ ARC    → agent stakes USDC, plays, and claims winnings by itself
                        ↓
                  produces new on-chain data → the next agent reads it → loop closes
```

Remove any one layer and the loop breaks. That's the answer to *"why these three sponsors?"*

---

## ⛔ Not building (protects ~2 days)

| Skipped | Why |
|---|---|
| **GCP migration** | Judges never see infra. Do **paid Render + keep-alive ping** instead — 10 min, kills cold starts. Migrate after the 14th. |
| **Bigger field + obstacles** | Not judged. Risks breaking a working engine 6 days out. |
| **Mobile optimization** | Julio's fix: **demo in browser mobile mode.** Zero engineering. |
| **Asset store / NFTs / tiers** | No track pays for it. |
| **npm SDK** | Targets Graph's *From Scratch* tooling track. Not yours. |
| **Extra arenas, character redesign** (Edgar #5) | Real polish, but days of art. Post-hackathon. |
| **Difficulty calibration / practice round** (Edgar #4) | You control the demo build — just play the round you rehearsed. |
| **Screen shake, particles, juice** (Edgar #6) | Genuine improvement, zero prize impact. Post-hackathon. |

---

# FEATURE LIST

## 🚨 S0 — License fix (BLOCKER, do first)
Continuity rules: new work must be open source. Your `LICENSE` says all-rights-reserved. **Disqualifying as-is.**
- Create `packages/` with its own MIT `LICENSE`
- Root LICENSE: *"Code under `/packages/` is licensed separately under MIT."*
- README states the split (engine stays proprietary)

**Done when:** a stranger can legally clone, build, run everything in `packages/`.
`chore: MIT-license all hackathon work under packages/`

---

## TRACK 1 · ARC — agents that transact — $3,166

### A1 — Arc testnet setup
Chain ID `5042002`, RPC + explorer in `.env.example`, faucet USDC in wallet.
**Done when:** a viem script prints your USDC balance on Arc.
`feat(arc): testnet config + connectivity check`

### A2 — `ChaseStake` escrow ⭐ the core
Four functions. 0x said *"dead simple"* — keep it that way.
```solidity
createMatch(bytes32 matchId, uint256 stake)
join(bytes32 matchId)                                        // USDC transferFrom
settle(bytes32 matchId, address winner, string replayRoot)   // server only
refund(bytes32 matchId)                                      // timeout escape hatch
```
Tests: happy path · double-join reverts · non-server settle reverts · refund after timeout.
**Never skip `refund`** — an escrow that can trap funds reads as unfinished.
**Done when:** `forge test` green + a real stake→settle→payout tx on Arc explorer.
`feat(arc): ChaseStake USDC escrow + tests + testnet deploy`
📩 **Send to 0x the moment it compiles.**

### A3 — Server settles matches
`server/src/arc/` calls `settle()` on match end, reusing the **existing 0G replay root**.
**Done when:** finish a real match → payout tx on explorer.
`feat(arc): server settles finished matches on-chain`

### A4 — Wallet + staking UI
No wallet code exists anywhere today. **Budget a full day.**
wagmi + viem → connect → approve USDC → stake → live pot → winner claims.
**Done when:** clean browser, two windows, full stake→play→claim round.
`feat(arc): wallet connect + ranked staking flow`

### A5 — Agents hold wallets ⭐ your Arc differentiator
Most entries only do human payments. Yours: each 0G agent gets a Circle Wallet, stakes to enter, claims on win — **no human in the loop.** Surface the reasoning from your existing 0G transcript: *"agent evaluated pot odds → staked 1 USDC."*
**Done when:** a match runs with zero human stakers; agents fund, play, settle themselves.
`feat(arc): autonomous agent wallets — agents stake and claim USDC`

### A6 — Mainnet-ready
Deploy script + mainnet config (chain `5042`). Bounty allows *"deployment-ready"* — full deadline is **Sep 30**, after submission.
`feat(arc): mainnet deploy script + config`

---

## TRACK 2 · WORLD — AgentKit — $3,500 (biggest single prize)

### ⚠️ What AgentKit actually is (researched Sep 8 — corrects the earlier assumption)

AgentKit (Beta) **extends x402**. It is a *server-side gate on your API* that lets you
tell human-backed agents apart from bots and scripts:

> *"Enable agentic traffic to access api endpoints while blocking malicious actors, scalpers and spam."*

- `npm install @worldcoin/agentkit`
- Agents register a wallet: `npx @worldcoin/agentkit-cli register <agent-address>` —
  gasless via hosted relay, registered on **World Chain**, prompts World App verification
- At request time AgentKit resolves a registered wallet to an **anonymous human identifier**
- Server side: `createAgentBookVerifier()` + `createAgentkitHooks({ agentBook, storage, mode })`,
  wired into an x402 resource server. Hono is the reference; **Express and Next.js are supported**
- `free-trial` mode gives registered agents N free calls before x402 payment resumes
- x402 payments settle on **World Chain and Base** — separate from Arc match stakes

**Therefore: AgentKit does not apply to NPCs running inside our own server.** It only
becomes load-bearing if Chase exposes an **open agent-entry API** that *other people's*
agents call. That is the feature.

### W1 — Open the arena: agent-entry API
`POST /agent/join` on the existing Express server — any developer can point their AI
agent at Chase and have it compete for real USDC.
`feat(world): open agent-entry API for third-party AI agents`

### W2 — AgentKit as the bouncer ⭐ the actual prize
Wrap that endpoint with AgentKit hooks. Registered human-backed agents get in on
`free-trial`; unregistered bots fall through to x402 payment or are refused.
Because AgentBook resolves to **one anonymous human identifier per human**, we rate-limit
**per human, not per wallet** — which is what actually stops a bot farm from spinning up
1,000 wallets to farm the pot.

That is precisely the bounty's ask: a **risk, eligibility, fairness, and abuse-prevention**
signal. Register our own 0G agents in AgentBook too, so they resolve like any other entrant.
**Done when:** an unregistered wallet is refused entry and a registered one is admitted.
`feat(world): AgentKit gate on agent entry — human-backed agents only`

### 🔑 Why this is the strongest version of the whole project
One endpoint carries all three sponsors:

```
POST /agent/join
  ├─ WORLD  AgentKit verifies the caller is human-backed   → fairness
  ├─ GRAPH  agent queries the subgraph for opponent history → strategy
  └─ ARC    agent stakes USDC into ChaseStake               → skin in the game
```

Chase stops being "a game with Web3 features" and becomes **an open arena where anyone's
AI agent can compete for money, with proof-of-human as the anti-abuse layer.** That is a
Web3-native product answer to Edgar's strategic question, not a bolt-on.

### W3 — Sandbox App testing
Test the whole flow remotely via the World ID Sandbox App (required).

### W4 — `WORLD_FEEDBACK.md` ⚠️ HARD REQUIREMENT
Write it **while integrating**, not after. Cover: AgentKit docs + integration flow · Developer Portal navigation, search, debugging · Sandbox states, proof flows, test users, errors, edge cases · what was confusing, missing, broken, hard to test.
**Most teams skip this. It's an hour and it's free points.**
`docs(world): AgentKit + Sandbox integration feedback`

---

## TRACK 3 · THE GRAPH — agents that read data — $2,500

Continuity track is **AI Use Case**, not tooling. The agent must *consume* Graph data and *act* on it. A dashboard does not qualify.

### G1 — Subgraph
Index `ChaseStake` (Arc) + `ChaseLeaderboard` (0G Chain). Cross-chain is itself the story.
`feat(graph): subgraph over ChaseStake + ChaseLeaderboard`

### G2 — Deploy to Subgraph Studio
**Live data only — mocked or local-only is explicitly disqualified.**

### G3 — Agents query it ⭐ the actual prize
Agent brain queries pre-match: opponent win rate, stake history, pot size → feeds strategy + taunts.
`feat(graph): agents query live match history to pick strategy`

### G4 — On/off proof
**Done when:** disabling the subgraph visibly degrades agent behavior. Same proof style you already use for 0G.

---

## SHARED — required, not optional

- **S1** — Tournament page: replace the "Coming Soon" stub with the real ranked flow
- **S2** — **Architecture diagram** (Arc hard-requires it)
- **S3** — **Demo video 2–4 min**: 30s what existed → 2min what shipped → 30s why it's verifiable
- **S4** — Register as Continuity Project + disclose prior work in writing
- **S5** — Paid Render + keep-alive ping (10 min, protects the demo)
- **S6** — **Three partner write-ups** (Arc, World, Graph): how you integrated their tools + feedback + comments. Required by the submission form; *"the only way for partners to assess your project."* ~90 min. **Write each one the day that track lands, while it's fresh** — not on Sunday.
- **S7** — [`AI_USAGE.md`](AI_USAGE.md) kept current: the AI rule requires documenting *which files* AI touched. One row per feature, added in the same commit as the code.

---

## TRACK 4 · VISIBILITY — Edgar's feedback — $0 direct, multiplies all three

Edgar's core hit: *"The ETH/Web3 layer is invisible… judges need to see the Web3 value. Don't make judges hunt for it."* You can win all three integrations and still lose if a judge can't see them in 60 seconds. These are cheap and they multiply everything above.

### 🔑 The two-lane decision (resolves Edgar vs. your playtests)
Edgar says *add wallet connect*. Your own playtesting said *keep onboarding frictionless, no wallets*. **Both are right — for different players.** So:

| Lane | Entry | Purpose |
|---|---|---|
| **Free Play** (default) | No wallet, no signup — unchanged | Protects the frictionless onboarding your testers demanded |
| **Ranked** (opt-in) | Wallet → World ID → USDC stake | Where all three sponsors live |

Nothing about the current first-time experience regresses. The Web3 layer is *additive and opt-in*. **Say this explicitly in the demo video** — it's a mature product answer, and it turns a perceived weakness into a deliberate design decision.

### V1 — Two-slide intro (Edgar #1)
*"I thought it was a racing game."* If a mentor missed the core mechanic, a judge will too.
> Slide 1: **"One golden egg. Grab it."**
> Slide 2: **"Hold it for 30s. The AI is hunting you."**
Skippable, shows once (localStorage).
`feat(onboarding): two-slide intro explaining the chase mechanic`

### V2 — Sponsor HUD ⭐ highest leverage in this section (Edgar #3)
Make each integration visible *during* play, not buried in a menu:
- 🌍 **"Verified Human"** badge on ranked players — *World*
- 💰 **Live pot: 4 USDC on Arc** in the HUD — *Arc*
- 📊 Agent panel shows **"read 47 past matches"** before it picks a strategy — *The Graph*
- Results screen: three tx links — Arc payout · 0G replay · subgraph query

**Done when:** a judge who mutes the video can still name all three sponsors.
`feat(ui): sponsor visibility HUD — World badge, Arc pot, Graph signal`

### V3 — Make the egg unmissable (Edgar #1, #5)
The central objective reads as small. Glow + pulse + offscreen arrow. ~30 min, fixes real comprehension.
**Also: put the egg on the cover art.** It's the centerpiece and it's missing.
`feat(game): egg glow, pulse, and offscreen indicator`

---

## Schedule

| Date | Ship | Unlocks |
|---|---|---|
| **Sep 8** ✅ | S0 ✅, A1 ✅, A2 ✅ (26/26 tests) · deploy · S4, S5 · DM 0x · ask World Discord re AgentKit | eligible |
| **Sep 9** | A3 server settlement, A4 wallet + stake UI, **V2 Arc pot** | **Arc $3,166 reachable** |
| **Sep 10** | A5 agent wallets, A6 mainnet script, **V3** · **S6 Arc write-up** | Arc differentiated |
| **Sep 11** | W1–W4 + **V2 Verified badge** · **S6 World write-up** | **World $3,500** |
| **Sep 12** | G1–G4 + **V2 Graph signal**, **V1**, S1 · **S6 Graph write-up** | **Graph $2,500** |
| **Sep 13 AM** | S2 diagram, S3 video → **submit by 12:00 pm EDT** | 🚀 |

Each track's partner write-up (S6) is done the day that track lands, while the friction is fresh. Sunday morning is video and diagram only — nothing else fits.

**V2 is built incrementally** — each track adds its own HUD element the day it lands. Never a separate task, never deferred to the end.

**Cut order under pressure:** S1 → G → W → A5.
**Never cut:** S0, A2, V2, S2, S3.
**Arc alone (S0 + A1–A4 + V2/V3 + S2/S3) is a complete valid submission by Sep 10 night.**

---

## Continuity disclosure (goes in submission + README)

**Before (19 commits, HEAD `599d858`):** Next.js shell · Phaser 3 engine · Express + Socket.IO multiplayer · 6 characters + power-ups · **0G Compute** agent brains · **0G Storage** replays · **0G Chain** leaderboard · Supabase. Tournament + asset-store pages were **"Coming Soon" stubs**.

**Absent before:** any wallet code (no wagmi/viem/MiniKit anywhere) · any World, Arc, or Graph integration · any staking, escrow, or subgraph.

| Feature | Track | Commit | Done |
|---|---|---|---|
| S0 License split | — | `0bd6f25` | [x] |
| A1 Arc setup | Arc | `f3f04bf` | [x] |
| A2 ChaseStake escrow | Arc | `62896aa` | [x] — 26/26 tests; **awaiting deploy** |
| A3 Server settlement | Arc | | [ ] |
| A4 Wallet + stake UI | Arc | | [ ] |
| A5 Agent wallets | Arc | | [ ] |
| A6 Mainnet-ready | Arc | | [ ] |
| W1 AgentKit | World | | [ ] |
| W2 AgentBook | World | | [ ] |
| W3 Sandbox testing | World | | [ ] |
| W4 Feedback doc | World | | [ ] |
| G1 Subgraph | Graph | | [ ] |
| G2 Studio deploy | Graph | | [ ] |
| G3 Agent queries | Graph | | [ ] |
| G4 On/off proof | Graph | | [ ] |
| V1 Intro slides | visibility | | [ ] |
| V2 Sponsor HUD | visibility | | [ ] |
| V3 Egg glow + cover art | visibility | | [ ] |
| S1 Tournament page | all | | [ ] |
| S2 Diagram | all | | [ ] |
| S3 Video | all | | [ ] |

---

## AI usage log

Rules require real version control — *single large commits are presumed unqualified.* One commit per feature.
**Read every line of `packages/contracts-arc/` before deploy.** Real USDC settles against it. If you can't explain a function to a judge, don't ship it.

| Date | Tool | What | Reviewed | Commit |
|---|---|---|---|---|
| Sep 7 | Claude Opus 5 | Sponsor research, repo audit | ✅ | — |
| Sep 8 | Claude Opus 5 | Final 3-track plan | ✅ | — |

---

## Risks

| Risk | Impact | Fix |
|---|---|---|
| Proprietary license | **Fatal** | S0, today |
| Zero wallet code today | High | Full day for A4; wagmi + viem only |
| AgentKit new / thin docs | Med | Ask World Discord **today**, not Friday. Friction → feedback doc points |
| Scope creep (GCP, obstacles) | High | Cut list is binding |
| Backend lag ruins demo | Med | S5; record demo on a warm instance |
| Circle Agent Stack not GA | Med | Fallback: plain USDC ERC-20 + viem |
| Web3 layer invisible to judges | **High** | V2 sponsor HUD — Edgar caught this; it's the cheapest fix on the board |

---

## Mentor feedback → what we did

**0x** — *"Keep the scope small… the staking contract can likely be dead simple."* Offered contract review.
→ Cut list is binding. A2 is four functions. **DM him the spec Day 1.**

**Julio** — Sponsors ask what existed vs. what you added; push new World/Arc features; differentiate on Graph. Demo in browser mobile mode.
→ Disclosure table; AgentKit + Arc continuity tracks; G3 is a *novel* use (agents as data consumers, not a dashboard); mobile optimization cut entirely.

**Edgar** — Onboarding missing (looked like a racing game) · **Web3 layer invisible** · sponsor visibility must be obvious in 60s · egg too small · difficulty · juice · *"Are you building a game with Web3 as a layer, or a Web3 experience that happens to be a game?"*
→ V1, V2, V3 built. Difficulty/juice/arenas cut with reasons stated.

**On Edgar's strategic question** — you don't have to choose, and the answer is already stronger than "a game with Web3 bolted on":

> **AI agents that hold wallets, earn a verified identity, read on-chain history, and stake real money autonomously — is a Web3-native idea.** The game is the arena where you can *watch* it happen.

That's a Web3-first narrative that keeps you a game developer. Lead the pitch with the agent economy; the pixel art is what makes people stay and watch it. Don't apologize for the game being fun.
