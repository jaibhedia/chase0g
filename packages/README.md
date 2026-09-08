# `packages/` — ETHOnline 2026 open-source work

**Everything in this directory is MIT licensed** (see [`LICENSE`](LICENSE)) and was built
during ETHOnline 2026 (Sep 4–16, 2026) under the **Continuity Track**.

The Chase game engine in the repository root remains proprietary. This directory is the
open-source layer added during the hackathon, per the Continuity Track requirement that
all new work be open source.

## What's here

| Package | Purpose | Track |
|---|---|---|
| `contracts-arc/` | `ChaseStake` — USDC match-stake escrow on Arc | Arc |
| `subgraph/` | Indexes `ChaseStake` (Arc) + `ChaseLeaderboard` (0G Chain) | The Graph |

## What existed before the hackathon

Nothing in this directory. See the root [`plan.md`](../plan.md) for the full
continuity disclosure: what shipped before the event, and what was built during it.

## Running these

Each package has its own README with setup steps. They are independent of the
proprietary game code and can be built, tested, and deployed on their own.
