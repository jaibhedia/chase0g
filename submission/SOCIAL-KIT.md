# Social kit — Chase Dinosaurs

**Your handle:** `@ShantanuSwami11` · **Site:** https://chase.abstractstudio.in

**Sponsor handles** — tag only the ones you actually submitted to. Tagging a sponsor you
didn't build for reads as spam and they do notice.

| Sponsor | X handle |
|---|---|
| The Graph | `@graphprotocol` |
| Privy | `@privy_io` |
| Arc | `@arc` (Circle: `@circle`) |
| World | `@worldnetwork` |
| ETHGlobal | `@ETHGlobal` |

---

## 1. Launch post — the one that matters

Lead with the strangest true fact. Not the stack.

> The AI opponents in my game read the blockchain before deciding who to chase.
>
> If you're up money across past matches, they mark you as the threat — gang up on you,
> cut your escape route, and taunt you about your balance.
>
> 60 seconds. One egg. Real USDC on the line.
>
> [60s gameplay clip, ending on a taunt]

**Why this and not "I built a web3 game with X, Y, Z":** the first line has to survive
someone scrolling past. "AI opponents read the blockchain" is a claim that stops a thumb.
A stack list never is.

---

## 2. Technical thread (post after the launch post lands)

**1/**
> Everyone builds a leaderboard with a subgraph.
>
> I fed mine to the AI opponents instead.
>
> Here's how Chase Dinosaurs works 🧵

**2/**
> Every ranked match escrows USDC in a contract on @arc — Circle's stablecoin L1.
>
> Two players stake, winner takes the pot, settlement is on-chain.
>
> Arc is stablecoin-native so USDC pays gas too. No second token to go acquire.

**3/**
> A subgraph on @graphprotocol indexes every stake and settlement out of that escrow.
>
> Public endpoint — anyone can run the same query and get the same data. No database, no
> trusting me.

**4/**
> The interesting part:
>
> Before each AI decision, the server joins every player to their on-chain record and
> hands it to the model.
>
> The agents don't just see where you are. They see that you're up 4 USDC across 6
> matches.

**5/**
> So they play differently.
>
> A proven winner becomes the primary target — even over someone standing closer. A second
> agent guards their escape lane before they've touched the egg.
>
> Take the subgraph away and the opponents get measurably dumber.

**6/**
> Onboarding is an email address. @privy_io provisions an embedded wallet — no extension,
> no seed phrase.
>
> New players get 2 USDC automatically so they can afford a buy-in.

**7/**
> Which makes the faucet worth attacking. Sign-in is just email, so ten inboxes would be
> twenty dollars.
>
> @worldnetwork Selfie Check closes it. One live human, one claim.
>
> No name, no face stored — just a nullifier proving you haven't claimed before.

**8/**
> Built for @ETHGlobal ETHOnline 2026.
>
> Play: chase.abstractstudio.in
> Code: github.com/jaibhedia/chasedinosaurs
>
> [demo video]

---

## 3. Short variants

**Punchy:**
> Made a game where the AI checks your on-chain record before deciding whether you're
> worth chasing.
>
> Turns out "the bots gang up on whoever's winning" is a great rubber-band mechanic.

**The hook nobody else has:**
> My game's AI opponents taunt you using your actual USDC balance.
>
> Indexed from the escrow contract by @graphprotocol, fed straight into the model's
> targeting.

**Builder angle:**
> Shipped in one day:
> · AI opponents that read a subgraph to pick targets
> · USDC escrow + on-chain settlement
> · Email → wallet, no seed phrase
> · Proof-of-human gate on the faucet
>
> 60-second matches. Real stakes.

---

## 4. Discord — ETHGlobal / sponsor channels

Different room, different register. These people build; skip the marketing voice.

**#showcase:**
> **Chase Dinosaurs** — 60-second multiplayer chase game, ranked matches escrow USDC on Arc.
>
> The bit I think is actually novel: the AI opponents query our ChaseStake subgraph before
> choosing targets. A player who's up money across past matches gets marked as the primary
> threat over a closer but unproven one. The Graph is load-bearing for gameplay, not just
> the leaderboard.
>
> Play: chase.abstractstudio.in
> Code: github.com/jaibhedia/chasedinosaurs
> Demo: [link]
>
> Happy to go into the join — userId → wallet → indexed record — if useful to anyone.

**In a sponsor's own channel** — one specific thing, not the whole pitch:
> Used Selfie Check as a sybil gate on a USDC faucet. Faucet was keyed on email, so ten
> inboxes was twenty dollars; the nullifier is the only key that costs anything to forge.
>
> Wrote up integration feedback here: [WORLD-FEEDBACK.md link] — including one docs bug
> (the Selfie Check example omits `allow_legacy_proofs`, so it doesn't compile as written).

---

## 5. Farcaster

Crypto-native audience, so skip the explanation and go straight to the mechanism.

> the AI in my game reads your on-chain staking record before deciding who to chase
>
> up money? you're the target. proven winner gets marked over whoever's closest
>
> subgraph → agent prompt → targeting. 60s matches, USDC escrow on arc
>
> chase.abstractstudio.in

---

## 6. Posting sequence

| When | What |
|---|---|
| Submission day | Launch post + clip. Highest-energy window. |
| +2 hours | Technical thread, quote-tweeting your own launch post |
| +1 day | Discord showcase + individual sponsor channels |
| +2 days | Farcaster, plus one short variant on X |
| Results day | Win or not — post what you learned. Best follower growth of the whole cycle. |

## Rules

- **Clip before words.** A silent autoplaying 10-second loop of a dinosaur taunting you
  outperforms any sentence you can write.
- **Never open with the stack.** Nobody has ever stopped scrolling for "built with X, Y and
  Z." Open with the weird thing; the stack lives in the thread.
- **One claim per post.** Every post that makes two points makes neither.
- **Reply to your own thread with the demo video.** Threads with a video in the last post
  get watched more than ones with it in the first.
- **Tag only where you submitted.** Four honest tags beat eight opportunistic ones.
