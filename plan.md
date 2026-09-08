# Chase — ETHOnline 2026 · FINAL PLAN (3 Tracks)

**Submit: Sep 14** · **Today: Sep 8** · **6 days** · Solo
**Rule: build one → test one → commit one → push one.**

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

### W1 — AgentKit integration
Agents are provably **human-backed**, not scripts. Gate ranked entry on it.
`feat(world): AgentKit identity for AI agents`

### W2 — AgentBook
Register + resolve each agent through AgentBook.
**Done when:** an agent resolves in AgentBook and the app gates on that.
`feat(world): register agents in AgentBook`

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
| **Sep 8** | S0, S4, S5, A1, **V3** · DM 0x · ask World Discord about AgentKit | eligible |
| **Sep 9** | A2 escrow + tests + deploy | Arc unblocked |
| **Sep 10** | A3, A4 + **V2 Arc pot** | **Arc $3,166 reachable** |
| **Sep 11** | A5, A6 | Arc differentiated |
| **Sep 12** | W1–W4 + **V2 Verified badge** | **World $3,500** |
| **Sep 13** | G1–G4 + **V2 Graph signal**, **V1** | **Graph $2,500** |
| **Sep 14** | S1, S2, S3 → submit | 🚀 |

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
| S0 License split | — | | [ ] |
| A1 Arc setup | Arc | | [ ] |
| A2 ChaseStake escrow | Arc | | [ ] |
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
