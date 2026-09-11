# World ID integration feedback — Chase Dinosaurs

Submitted for the **Selfie Check** track, ETHOnline 2026.

**What we built:** World ID Selfie Check as a sybil gate on a USDC faucet. New players are
given 2 USDC so they can afford a ranked buy-in; the faucet previously keyed uniqueness on
an Arc address and a Privy user id, both of which are free to mint. Selfie Check's
nullifier is the only key that actually costs something to forge.

Integration: [`server/src/world/selfieCheck.ts`](server/src/world/selfieCheck.ts),
[`app/components/WorldFaucetGate.tsx`](app/components/WorldFaucetGate.tsx).

---

## 1. Docs and integration flow

### 🐞 The Selfie Check example is missing a required parameter

On [/world-id/idkit/credentials](https://docs.world.org/world-id/idkit/credentials), the
Selfie Check snippet is:

```tsx
<IDKitRequestWidget
  app_id="app_xxxxx"
  action="my-action"
  rp_context={rpContext}
  preset={preset}
  handleVerify={handleVerify}
  onSuccess={(result) => { /* ... */ }}
/>
```

Copying this verbatim **fails to compile**. `IDKitRequestConfig` requires
`allow_legacy_proofs`, which the example omits:

```
error TS2322: Property 'allow_legacy_proofs' is missing in type '{ ... }'
  but required in type 'IDKitRequestConfig'.
```

The `proofOfHuman` and `passport` examples on the same page *do* include it
(`allow_legacy_proofs={true}`) — Selfie Check is the one that doesn't. Since Selfie Check
is issued as a 3.0-era credential, `true` appears to be the required value, but the docs
never say so. A reader following the Selfie Check path specifically is the one reader who
won't see a correct example.

**Suggested fix:** add `allow_legacy_proofs={true}` to both the JS and React Selfie Check
snippets, and state which value Selfie Check needs in the "Common parameters" table — that
table currently explains the flag generically ("`true` while accepting World ID 3.0
fallback proofs") without saying which presets are 3.0-era.

### 🐞 `selfieCheckLegacy` naming vs. "Selfie Check (Beta)"

The docs present the offering as **Selfie Check (Beta)** but the SDK path is
`selfieCheckLegacy`. Searching the docs for "Selfie Check" doesn't obviously lead you to a
symbol called `...Legacy`, and `deviceLegacy` is separately marked **Deprecated** on the
same page — so the natural read of "legacy" is "don't use this", which is the opposite of
the intent. A one-line note explaining that `Legacy` refers to the *protocol version* the
credential is issued under, not its deprecation status, would remove the hesitation.

### ✅ What worked well

- **`signRequest` is pure JS, no WASM.** Worth advertising louder — it meant the RP
  signing step dropped into an existing Node service with no build changes at all.
- **"Forward the IDKit result payload as-is. No field remapping is required."** Exactly the
  sentence you want at that step. It removed a whole class of guesswork.
- **The nullifier explanation in Step 6** is genuinely good: it states plainly that the
  Portal only confirms *validity* and that replay prevention is the integrator's job. That
  distinction is the single easiest thing to get wrong, and the docs lead with it.
- **`signal` binding** is well explained, and the note that "your backend should enforce
  the same value" is the right warning in the right place.

### 🔧 Two separate human-gated approvals to test one credential

Getting to a first test proof requires **two** independent approvals from a human, and they
are documented in different places:

1. **Sandbox access** — a Google Form ([link](https://forms.gle/mqbaiwMvX5MzmKdY8)),
   referenced from the resources list.
2. **The Selfie Check beta feature flag on your specific app** — "request access through
   your World point of contact", mentioned only in the second paragraph of the sandbox
   testing guide.

Nothing connects them. A developer who finds the form first can reasonably believe they're
unblocked, submit it, start building, and only discover the second gate when they open the
testing guide — by which point they've serialised two unknown turnarounds instead of
requesting both at once. We hit exactly this.

**Suggested fix:** state both prerequisites together, up front, on
[How to get access](https://docs.world.org/world-id/sandbox/sandbox-access) — ideally as a
checklist ("you need: sandbox access **and** the beta flag on your app_id"). Even better,
let the Developer Portal show a per-app Selfie Check status so you can see which of the two
you're still waiting on. On a time-boxed build like a hackathon, a serialised approval is
the difference between shipping and not.

### 🐞 Two apps called "World ID", and nothing tells you which one you need

Testing staging requires the **sandbox** app (`org.world.id.sandbox`, distributed by Firebase
App Distribution). The Play Store app is **production**. They share a name, and the
integration docs never mention that a second app exists.

What happened to us: IDKit rendered its QR, we scanned it with the World App we already had
from the Play Store, and nothing happened — no error naming the mismatch, just a flow that
went nowhere. We assumed our integration was broken and went looking in our own code. The
actual cause was that a `environment: "staging"` request cannot be answered by the
production app at all.

The sandbox app arrives by Firebase email whose subject is *"You've been invited to test
World ID for Android"* — which reads like a generic beta invite for World ID, not like the
prerequisite for testing your own integration. Nothing connects it to the `environment`
parameter you set in code.

**Suggested fix:** on the [Integrate IDKit](https://docs.world.org/world-id/idkit/integrate)
page, right where `environment` is introduced, state plainly: *staging requires the sandbox
app, which is a different install from the Play Store World App.* A mismatch is also worth a
real error — when a production app receives a staging request (or vice versa), surfacing
"this request is for the sandbox app" would have saved us the entire detour.

### 🔧 Gap: nothing says nullifier casing can vary

Nullifiers are documented as "0x-prefixed hex strings representing 256-bit integers", and
the docs recommend storing them as numbers. We store them as normalised lowercase strings.
Either is fine — but the docs should state outright that **a case-sensitive string
comparison is a vulnerability**, because "store as hex string" is the obvious first
implementation and it silently allows a double claim if casing ever differs between
responses. The current wording ("to avoid parsing and casing issues that can lead to
security vulnerabilities") gestures at this but doesn't say what the failure actually is.

---

## 2. Developer Portal

> **TODO — fill in after creating the app at developer.world.org.**
>
> Cover: how easy it was to find where to create an app; whether `app_id` / `rp_id` /
> `signing_key` were clearly labelled and clearly marked as secret-vs-public; whether
> enabling Selfie Check required a separate step; search and product discovery; whether
> any debugging guidance existed when a proof failed.

---

## 3. Sandbox App

> **TODO — fill in after sandbox access is granted**
> (requested via https://forms.gle/mqbaiwMvX5MzmKdY8) **and** the Selfie Check beta flag is
> enabled on our `app_id`.
>
> Cover: how long each of the two approvals took; test-user setup; which proof states were
> reproducible (success, cancel, timeout, already-verified, rejected); whether error codes
> surfaced to `onError` were specific enough to act on; any edge case that could not be
> simulated.

Tested on **Android** (private Google Play testing link) with the **Web app / Hot**
surface — desktop browser, QR handoff to the phone, proof returned to the originating web
session. This is the flow real players will use, since the game runs in a browser.

Two things we specifically want to test and could not without sandbox access:

1. **Repeat claim by the same person.** The whole feature rests on the second attempt
   producing the *same* nullifier. We verified our ledger rejects a duplicate nullifier in
   isolation, but not that World actually returns a stable one across sessions.
2. **Expired RP signature.** Our signatures carry a 300s TTL and we deliberately re-fetch
   per attempt rather than once on mount. We'd like to confirm the failure mode a user
   sees when one does expire, since our guess is it surfaces as a generic verification
   failure rather than anything indicating staleness.

---

## 4. What was confusing, missing, or hard to test

| Issue | Severity | Notes |
|---|---|---|
| Selfie Check example omits required `allow_legacy_proofs` | **High** — doesn't compile | Only the Selfie Check example is affected |
| `selfieCheckLegacy` naming reads as deprecated | Medium | Sits next to an actually-deprecated `deviceLegacy` |
| Casing-as-vulnerability not stated outright | Medium | Obvious implementation is the unsafe one |
| Two apps named "World ID" (Play Store = production, Firebase = sandbox), undocumented | **High** — silent dead end | Scanning with the wrong one fails with no error naming the mismatch |
| Two separate human approvals (sandbox + per-app beta flag), documented apart | **High** — serialises two unknown turnarounds | Easy to request only one and think you're unblocked |
| Sandbox access is a Google Form with unknown turnaround | Medium | Blocks end-to-end testing; a self-serve staging path would help |
| No documented way to reset a test user's nullifier | Low | Makes "already claimed" hard to test repeatedly |

---

## 5. Would we keep this in production?

Yes — and specifically *because* it's the low-assurance credential. The risk being managed
is 2 USDC of testnet money per person. Orb Proof of Human would be stronger and would also
mean telling a browser-game player to go find an Orb, which would simply end the session.
Selfie Check is proportionate to the actual threat, and that proportionality is the thing
that made it adoptable here. The clearest way to describe it: *it's the amount of certainty
the risk justifies, and no more.*
