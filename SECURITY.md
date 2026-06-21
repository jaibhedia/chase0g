# Security

Status of the Chase · Zero security posture and the hardening applied to the multiplayer
backend (`server/`), the Next.js shell (`app/`), and the contracts tooling (`contracts/`).

## Secrets
- Real `.env` files (root, `server/`, `game-app/`, `contracts/`) are git-ignored and have
  **never been committed** — verified across full git history (private key + router API
  key strings absent from every revision). Only `.env.example` placeholders are tracked.
- `OG_PRIVATE_KEY` / `OG_ROUTER_API_KEY` are server-side only and are never prefixed
  `NEXT_PUBLIC_`/`VITE_`, so they cannot reach the browser bundle.

## Multiplayer backend hardening (`server/src/index.ts`)
The Socket.IO server is a relay; these guards close the abuse surface:

- **Room-membership gating** — `isRoomMember()` / `canUseRoom()` now gate every relay
  handler (`player-input`, `game-state-update`, `agent-state`, `egg-state`,
  `game-finished`, `agent-tick`, `store-replay`). A client can no longer emit into a room
  it never joined (previously any client could spoof/grief any 6-char room code).
  `canUseRoom` additionally allows single-player `solo-*` rooms (no fan-out).
- **Payload validation/sanitization** — `roomCode` must match `^[A-Z0-9]{6}$`; player
  names are clamped to 24 chars; `characterId` is clamped to 1–4; `player-input`
  coordinates/velocities are rebuilt from range-checked numbers (drops NaN/Infinity/absurd
  values). `userId` is required on create/join.
- **DoS caps** — `MAX_ROOMS = 1000` bounds the in-memory room store; a per-socket
  sliding-window limiter throttles `create-room` (10/min) and `join-room` (30/min); the
  limiter map is cleared on disconnect.
- **Frame-size cap** — `maxHttpBufferSize: 1e5` (100 KB) on the Socket.IO server mitigates
  the socket.io unbounded-binary-attachment advisory and giant-frame memory exhaustion.
- **HTTP hardening** — `helmet()` security headers, `x-powered-by` disabled, and an
  `express-rate-limit` of 120 req/min on the HTTP routes (`/health`, `/leaderboard`).
- **CORS** — defaults to reflecting any origin for local dev; logs a loud warning when
  `NODE_ENV=production` and `CORS_ORIGIN` is unset. **Set `CORS_ORIGIN` in production.**

## Dependency audit
Safe, non-breaking `npm audit fix` applied to all three packages (no protocol-breaking
major bumps):

| Package    | Before | After | Remaining |
|------------|--------|-------|-----------|
| root       | 15     | 8     | `js-yaml`, `postcss` — **dev/build-only** (jest/babel/postcss chain); `postcss` fix needs `--force`. Not shipped to users. |
| server     | 8      | 5     | `axios`, `ws` — **no upstream fix**, transitive (via the 0G SDK / socket.io), not directly reachable; giant-frame risk mitigated by `maxHttpBufferSize`. |
| contracts  | 2      | 2     | `tmp` — fix needs `--force`; **deploy-time tooling only**, not a runtime/network surface. |

Re-run `npm audit` in each package to see current detail. The remaining items are
intentionally left to avoid breaking the multiplayer protocol / build tooling.

## Known limitation (by design, for now)
`userId` is a client-supplied guest token (no auth), so it is **spoofable**. This is fine
for free cosmetic play. It **must be replaced with real authentication before any
real-money / wagered tournament mode** — which is also why staking is intentionally out of
scope and Tournaments ship as "Coming Soon" until the server is fully authoritative.
