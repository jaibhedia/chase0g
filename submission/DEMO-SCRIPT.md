# Demo video script — Chase Dinosaurs

**Target: 3:00.** Fits The Graph's 2–4 min window and every other track's ≤5 min cap.

**Hard requirements this script satisfies:**

| Track | Requirement | Where |
|---|---|---|
| The Graph | Live data, meaningful reasoning not raw output | 1:20–2:15 |
| Privy | One functional financial flow, explain the UX win | 0:30–0:50 |
| World | Working app, credential as abuse-prevention signal | 0:50–1:05 |
| Arc | Working frontend + backend, USDC, multi-step settlement | 1:05–1:25, 2:15–2:40 |

**Record before you script-read.** Play a real match first, capture the footage, *then*
write voiceover to what actually happened. A scripted match that goes wrong on camera is
worse than an unscripted one narrated well.

---

## 0:00 – 0:15 · COLD OPEN

> **Do not explain anything yet.** Open on the moment nobody else has.

**On screen:** Mid-match. You're holding the egg, running. A dinosaur closes in. Its speech
bubble reads something like *"up 4 USDC? not after this."* Hold on the bubble for a beat.

**VO:**
> That dinosaur just read the blockchain.
>
> It checked my staking record, decided I was the biggest threat on the map, and came
> straight for me. Let me show you how.

*Cut to title card.*

---

## 0:15 – 0:30 · WHAT IT IS

**On screen:** Fast gameplay montage. Four players, one golden egg, the timer running down.

**VO:**
> Chase Dinosaurs is a sixty-second multiplayer chase game. One golden egg — whoever holds
> it is the target, everyone else hunts them.
>
> Every ranked match escrows real USDC on Arc. Winner takes the pot.

---

## 0:30 – 0:50 · PRIVY — GETTING IN

**On screen:** Fresh incognito window → landing page → **Multiplayer** → sign-in screen.
Type an email. Show the wallet appearing in the top bar.

**VO:**
> Onboarding is one email address. Privy provisions an embedded wallet — no extension, no
> seed phrase, nothing to install.
>
> This matters more than it sounds. The player needs a funded wallet on a chain they've
> never heard of before they can play a browser game. That's normally where everyone
> leaves.

---

## 0:50 – 1:05 · WORLD ID — THE FAUCET GATE

**On screen:** The **"Claim 2 USDC"** card. Click **Verify & claim**, QR appears, scan with
phone, Selfie Check completes, card flips to *"2 USDC sent to your wallet."*

**VO:**
> New players get two USDC free so they can afford a buy-in. Which makes the faucet worth
> attacking — sign-in is just an email, so ten inboxes would be twenty dollars.
>
> World ID Selfie Check closes that. One live human, one claim. We never learn a name and
> never see a face — just a nullifier that proves this person hasn't claimed before.

> 💡 **If the beta flag hasn't landed**, record this section with the gate armed and narrate
> up to the QR, then cut. Don't fake a completion.

---

## 1:05 – 1:25 · ARC — THE STAKE

**On screen:** Lobby, stake panel. Click to stake 1 USDC. Show the tx confirming. Cut to
the ChaseStake contract on `testnet.arcscan.app` with the pot visible.

**VO:**
> Both players stake into an escrow contract on Arc, Circle's L1. The pot is locked — not
> in our database, in a contract.
>
> Arc is stablecoin-native, so USDC pays for gas too. One transfer funds the buy-in and
> the fee. There's no second token a player has to go acquire.

---

## 1:25 – 2:15 · THE GRAPH — THE CENTREPIECE

> **Give this the most time.** It's the differentiator and the biggest prize.

**On screen:** Split or cut between three things — (1) the subgraph in Studio showing synced
status, (2) a terminal running the live GraphQL query and returning real player records,
(3) gameplay where a bot converges on the highest-net player.

**VO:**
> Here's the part that isn't a leaderboard.
>
> A subgraph indexes every stake and settlement out of the escrow. That's public — anyone
> can run this query and get the same table we do.
>
> But the game doesn't just *display* it. Before every AI decision, the server joins each
> player to their on-chain record and hands it to the model.
>
> So the agents don't only see where you are. They see that you're up four USDC across six
> matches — and they treat you as the primary threat. They'll leave a closer player alone
> and mark the proven winner instead. Guard your escape lane before you've even touched
> the egg.
>
> The Graph isn't decoration here. Take the subgraph away and the opponents get measurably
> dumber.

**On screen for the last line:** the `SYSTEM_PROMPT` threat-assessment block in
`agentBrain.ts`, scrolled to the "proven winner" rules.

---

## 2:15 – 2:40 · SETTLEMENT — CLOSING THE LOOP

**On screen:** Timer hits zero → results screen → winner → settlement tx hash → click
through to arcscan showing `MatchSettled` and the transfer.

**VO:**
> Match ends, the server settles on-chain, the winner is paid from escrow. Here's the
> transaction.
>
> And that settlement is what the subgraph indexes — which updates the records the agents
> read in the next match. The loop closes on itself.

---

## 2:40 – 3:00 · CLOSE

**On screen:** Leaderboard with real rows. Then a clean title card with the URL.

**VO:**
> Privy gets you in. World ID keeps the faucet honest. Arc holds the money. The Graph makes
> the opponents smart.
>
> Sixty seconds, one egg, real stakes. Chase Dinosaurs.

---

## Shot list — capture these before writing anything

- [ ] Bot taunt referencing a USDC record *(the cold open — reshoot until you get a good one)*
- [ ] Fresh incognito → email sign-in → wallet appears
- [ ] Claim card → QR → verification → funded confirmation
- [ ] Stake tx confirming in the panel
- [ ] ChaseStake contract page on arcscan with a live pot
- [ ] Subgraph Studio page: synced, no indexing errors
- [ ] Terminal: live GraphQL query returning real rows
- [ ] Gameplay: bot visibly converging on the top-net player
- [ ] Results screen → settlement tx → arcscan `MatchSettled`
- [ ] Leaderboard with more than one real row

## Recording notes

- **1080p minimum, 60fps for gameplay.** A 30fps capture of a 60fps game looks broken.
- **Record VO separately** and lay it over. Live-narrating while playing produces both bad
  play and bad narration.
- **Mute game audio under VO**, bring it up in the gameplay-only beats.
- **No dead air at the start.** Judges watch a lot of these; the first three seconds decide
  whether they're paying attention.
- **Say the sponsor names out loud.** Judges scoring one track need to hear their product
  named and see it working.

## Still outstanding for Arc

Arc requires an **architecture diagram** alongside the video. Not optional — it's in their
qualification list. A single clean diagram covering: browser → Privy wallet → socket server
→ ChaseStake on Arc → subgraph → back into the agent brains.
