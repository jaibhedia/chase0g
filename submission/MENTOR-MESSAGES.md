# Mentor messages — copy-paste

Three messages. Send #1 and #3 now (they have response latency); #2 is the AgentKit
technical question.

---

## 1. General mentor / final review

> **Chase Dinosaurs — final review before submission**
>
> 60-second multiplayer chase game. One golden egg, whoever holds it is the target. Ranked
> matches escrow real USDC on Arc, winner takes the pot. ETHOnline Continuity track — the
> game existed before (built for 0G's Zero Cup); everything on-chain was built this weekend.
>
> **What shipped**
>
> **Arc** — `ChaseStake.sol` escrow on Arc testnet, per-match USDC pot keyed by
> `keccak256(roomCode)`, with join/settle/refund and a deadline so funds can't strand. The
> server holds settlement authority and posts the payout when a match resolves. Verified
> end to end on-chain: escrow → winner, 2 USDC, `MatchSettled` indexed.
>
> **Privy** — email sign-in provisions an embedded wallet. No extension, no seed phrase. A
> new player goes from landing page to a funded wallet on a chain they've never heard of
> without ever seeing a wallet UI. Arc's USDC precompile is a 6-decimal view over the
> 18-decimal native balance, so one transfer funds gas *and* the stake — there is no second
> token to acquire.
>
> **The Graph** — a subgraph indexes the escrow. The part I care about: it isn't a
> leaderboard. Before every AI decision the server joins each player to their on-chain
> staking record and hands it to the model, so the agents prioritise players who are *up
> money* over closer but unproven ones, and taunt them about it. Remove the subgraph and the
> opponents get measurably dumber.
>
> **World** — Selfie Check gates the USDC faucet. Sign-in is an email, so ten inboxes was
> twenty dollars; the World nullifier is the only uniqueness key that costs anything to
> forge. Proofs verify server-side against the Developer Portal.
>
> **What didn't ship, and why**
>
> **World ID end-to-end is untested.** Code is complete and the gate arms correctly, but
> Selfie Check needs the beta flag on our `app_id` and I lost time to something the docs
> never mention: there are two apps called "World ID" — the Play Store one is production, the
> sandbox one ships via Firebase App Distribution. Scanning a staging QR with the production
> app fails silently with no error naming the mismatch. Written up in `WORLD-FEEDBACK.md`.
>
> **AgentKit.** Designed, not built — see the separate question below. I'd rather ship four
> integrations that work than five where one is a demo that falls over.
>
> **Arc mainnet.** Testnet only. Aware $2,500 of the Arc prize is contingent on a mainnet
> deploy by Sept 30; that's a post-submission decision, not a weekend one.
>
> **Hedera / ENS.** Skipped deliberately. ENS is Sepolia-only and a name on a leaderboard is
> exactly the cosmetic add-on their rules exclude. Hedera would have meant a second L1 with a
> different token for no product reason — it would have made the Arc story worse, not better.
>
> **What I'd most like your read on:** whether the Graph integration reads as genuinely
> load-bearing or as a leaderboard with extra steps. That's the thing I'd fix if it lands
> wrong.
>
> Repo: https://github.com/jaibhedia/chasedinosaurs

---

## 2. AgentKit question (World)

> **AgentKit: is `tryIncrementUsage` the right primitive for per-human entry limits?**
>
> Context: Chase Dinosaurs is a staked multiplayer game — ranked matches escrow real USDC on
> Arc and the winner takes the pot. We already have AI opponents (0G Compute drives their
> strategy), so agents in the arena isn't a bolt-on; it's what the game already was.
>
> I was torn between two framings for AgentKit and want your read before building.
>
> **Framing A — keep agents out.** Prove the player is human. But this doesn't need AgentKit
> at all; I'd just World-ID the human, which I've already done for the faucet.
>
> **Framing B — let agents in, accountably.** Two labelled lanes:
> - 👤 **Human lane** — verified humans
> - 🤖 **Agent lane** — AI agents, human-backed only, via AgentKit + AgentBook
>
> Nobody is deceived about who they're playing, agents are welcome, and every agent traces
> back to an accountable human. *"Chase doesn't ban bots. It makes them accountable."*
>
> **What made me commit to B:** counters are per *human*, not per wallet. Two agents backed
> by the same person share one counter. That's the thing I can't build any other way — the
> pot is real USDC, so one person fielding fifty agents breaks the game economically. Wallet
> addresses are free; humans aren't.
>
> **The question:** I want per-human ranked-entry limits via `tryIncrementUsage(endpoint,
> humanId, limit)`, backed by Postgres rather than `InMemoryAgentKitStorage`. Two parts:
>
> 1. The docs frame `free-trial` mode as metering for x402-protected API endpoints — hit the
>    limit and you fall through to payment. I want a *hard cap* on ranked entries per human,
>    where exceeding it is a refusal, not a fallback to paying. Is `tryIncrementUsage` meant
>    to be used standalone like that, or am I lifting a piece out of a flow it depends on?
>
> 2. Ranked entry in our game is a Socket.IO action, not a paid HTTP call. The plan is an
>    x402-gated `POST /agent/join` that does the admission (AgentBook resolve + per-human
>    counter), after which the agent plays over the existing socket connection. Is
>    "AgentKit for admission, not for metering the gameplay itself" a sane use, or is there a
>    pattern you'd point me at instead?
>
> Demo I have in mind: unregistered wallet refused → registered agent admitted → badge
> appears → stakes USDC → plays.

---

## 3. Souran — World Chain

> Hi Souran — building on World for ETHOnline. Chase Dinosaurs: a 60-second multiplayer chase
> game where ranked matches escrow real USDC and the winner takes the pot.
>
> **Shipped:** World ID **Selfie Check** as a sybil gate on our USDC faucet. New players get 2
> USDC free so they can afford a buy-in — and since sign-in is just an email, ten inboxes was
> twenty dollars. The nullifier is the only uniqueness key in that flow that costs anything to
> forge. Proofs verify server-side against the Developer Portal; we never see a face or a name.
>
> Deliberately the low-assurance credential rather than Orb — the risk is 2 USDC, and telling
> a browser-game player to go find an Orb would just end the session. Selfie Check is the
> amount of certainty the risk actually justifies.
>
> **Two asks:**
>
> **1. Selfie Check beta flag** on `app_246b28f61c476307fde86d8517f99736`. We have sandbox
> access (Firebase invite came through Sept 8) but I can't confirm the credential is enabled
> for our app. Testing on Android via the Play testing link.
>
> **2. A read on where we take the agent side.** We're on the Continuity track so AgentKit is
> open to us, and our game already has AI opponents — 0G Compute drives their strategy. I've
> got a two-lane design (verified humans / human-backed agents via AgentBook) and a specific
> question about whether `tryIncrementUsage` is the right primitive for per-human ranked-entry
> caps. Happy to send the detail — it's the one integration where I'd rather get your read
> before building than ship something that misuses the SDK.
>
> **Feedback doc:** we kept a running log of what was confusing or broken —
> `WORLD-FEEDBACK.md` in the repo. Two findings you may want regardless of how we place:
> - The Selfie Check example in the credentials docs omits `allow_legacy_proofs`, which
>   `IDKitRequestConfig` requires — it doesn't compile as written. The `proofOfHuman` and
>   `passport` examples on the same page do include it.
> - Two apps called "World ID" (Play Store = production, Firebase = sandbox) with nothing in
>   the integration docs saying a second app exists. Scanning a staging QR with the production
>   app fails silently. Cost me a couple of hours looking for a bug in my own code.
>
> Repo: https://github.com/jaibhedia/chasedinosaurs
