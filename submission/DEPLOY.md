# Deploy — Chase Dinosaurs

Two services. **Order matters**: the backend goes first because the frontend needs its URL.

| Part | Host | Why |
|---|---|---|
| Next shell + bundled game | **Vercel** | `build:all` bundles the Phaser game into `public/game-app/` |
| Socket.IO server | **Render** | Vercel is serverless — it cannot hold a WebSocket open |

**Never copy a secret into a file in this repo.** Everything marked 🔐 is typed into a
dashboard. Values live in `server/.env` locally.

---

## Step 1 — Backend to Render (do this first)

**Dashboard → New → Blueprint → point at this repo.** It reads [`render.yaml`](../render.yaml)
and prompts for every `sync: false` value.

### Paste these exactly

```
ARC_TESTNET_RPC_URL      https://rpc.testnet.arc.network
ARC_CHASESTAKE_ADDRESS   0xD648def45026f437351D797dC3574fa97507BA83
SUBGRAPH_URL             https://api.studio.thegraph.com/query/1760131/chase/0.98.1
WORLD_APP_ID             app_246b28f61c476307fde86d8517f99736
WORLD_RP_ID              rp_9c749a0082505220
WORLD_ENVIRONMENT        staging
OG_ROUTER_BASE_URL       https://router.0g.ai/v1
OG_MODEL                 qwen2.5-omni
OG_AGENT_TICK_SECONDS    5
NODE_ENV                 production
```

### 🔐 Copy from `server/.env` — never from chat, never into git

```
ARC_PRIVATE_KEY          settlement authority — without it matches never pay out
FAUCET_PRIVATE_KEY       separate wallet that drips 2 USDC to new players
WORLD_SIGNING_KEY        signs World ID proof requests
OG_ROUTER_API_KEY        0G Compute — without it agents fall back to scripted
```

### Leave blank for now

```
CORS_ORIGIN              ← set in Step 3, once you have the Vercel URL
```

Your URL will be **`https://chase-dinosaurs.onrender.com`**.

> ⚠️ **The free plan spins down after ~15 min idle and cold-starts in ~50s.** To a judge
> that's a dead link. Either upgrade to **Starter ($7)**, or point
> [cron-job.org](https://cron-job.org) at `/health` every 10 minutes. Decide now, not Sunday.

### Verify before moving on

```bash
curl https://chase-dinosaurs.onrender.com/health
```

Then check the Render **Logs** tab for the boot lines. Every one of these must be present:

```
[ai]     Provider ready → 0G Compute (model: qwen2.5-omni)
[arc]    ChaseStake ready → 0xD648…BA83
[faucet] 0xe49a…9EfA holds N USDC
[graph]  subgraph configured — agents will factor in on-chain records
[world]  Selfie Check armed
```

**Any line saying `disabled` or `not configured` is a missing key, not a bug.** Fix it here
before deploying the frontend — a silently half-off backend is the worst failure mode,
because nothing errors.

---

## Step 2 — Frontend to Vercel

**Import the repo.** `vercel.json` already sets `buildCommand: npm run build:all`.

> **Do not let it default to `npm run build`.** That compiles only the Next shell and leaves
> `public/game-app/` empty — the site looks perfect until someone presses Play and gets a 404,
> with nothing in the build output warning you.

### Environment variables

```
NEXT_PUBLIC_SOCKET_URL             https://chase-dinosaurs.onrender.com
NEXT_PUBLIC_PRIVY_APP_ID           cmtt7l9wx00bg0bl7wn9q6csh
NEXT_PUBLIC_ARC_TESTNET_RPC_URL    https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_CHASESTAKE_ADDRESS 0xD648def45026f437351D797dC3574fa97507BA83
NEXT_PUBLIC_SUBGRAPH_URL           https://api.studio.thegraph.com/query/1760131/chase/0.98.1
NEXT_PUBLIC_SITE_URL               https://chase.abstractstudio.in
```

All `NEXT_PUBLIC_` — these ship to the browser by design. No secrets here, ever.

Set `NEXT_PUBLIC_SITE_URL` to whatever domain you actually serve. It drives canonical URLs,
`og:image` and the sitemap; wrong, and every shared link previews against a domain that
isn't yours.

---

## Step 3 — Introduce them to each other

Two settings, both easy to forget, and the symptom for each is "lobby loads but nothing works."

**On Render** → Environment → set and redeploy:
```
CORS_ORIGIN    https://chase.abstractstudio.in
```
Comma-separate if you also want the `*.vercel.app` preview URL.

**In the [Privy dashboard](https://dashboard.privy.io)** → your app → **Allowed origins**:
```
https://chase.abstractstudio.in
```
Miss this and sign-in fails on production while working perfectly on localhost.

---

## Step 4 — Verify the live site

Walk it in an incognito window:

- [ ] Landing page loads, tab shows the **golden egg** favicon
- [ ] Paste the URL into Slack/Discord/X — preview shows the **dinosaur key art**, not a grey card
- [ ] **Play** → single-player runs *(if this 404s, `build:all` didn't run)*
- [ ] **Multiplayer** → sign in with a fresh email → wallet appears
- [ ] Faucet: either 2 USDC lands, or the **Claim 2 USDC** card appears if World is armed
- [ ] Create a room → console shows `[agents] humans=1 agents=3 authority=true`
- [ ] Stake → tx confirms on `testnet.arcscan.app`
- [ ] Finish a match → settlement tx → leaderboard updates

### If something's wrong

| Symptom | Cause |
|---|---|
| Play button 404s | `build:all` didn't run — check Vercel's build command |
| Lobby never connects | `CORS_ORIGIN` on Render, or `NEXT_PUBLIC_SOCKET_URL` on Vercel |
| Sign-in fails only on prod | Privy allowed origins |
| First load takes ~50s | Render free plan cold start |
| Agents don't move | Check `[ai]` boot line — 0G key missing |
| No leaderboard | `SUBGRAPH_URL` unset, or no settled matches yet |
| Matches don't pay out | `ARC_PRIVATE_KEY` unset — check the `[arc]` boot line |

---

## Custom domain (optional)

Vercel → Settings → Domains → add `chase.abstractstudio.in`, then the CNAME it gives you at
your DNS provider. **Then go back and update `CORS_ORIGIN` on Render** — a new domain is a new
origin, and the socket server will refuse it until you say so.
