# `@chase/contracts-arc`

USDC match-stake escrow for Chase, on [Arc](https://arc.network) — Circle's L1 where
USDC *is* the gas token. MIT licensed. Built during ETHOnline 2026 (Continuity Track).

## Network

| | Testnet | Mainnet |
|---|---|---|
| Chain ID | `5042002` (`0x4CEF52`) | `5042` (`0x13B2`) |
| RPC | `https://rpc.testnet.arc.network` | `https://rpc.arc.network` |
| Explorer | https://testnet.arcscan.app | https://arcscan.app |
| Faucet | https://faucet.circle.com | — |

**USDC ERC-20:** `0x3600000000000000000000000000000000000000` · 6 decimals · CCTP domain `26`

## ⚠️ The one thing to get right about Arc

USDC is the **native gas asset**. There is no separate native token plus a USDC token —
it is **one pool of funds with two interfaces**:

| View | Decimals | Use for |
|---|---|---|
| Native | 18 | gas and `msg.value` only |
| ERC-20 (`0x3600…0000`) | **6** | balances, transfers, approvals, all display |

Consequences for this package:

- The escrow moves USDC via the **ERC-20 interface** (`transferFrom` / `approve`), never
  `msg.value`. Stakes are 6-decimal amounts: `1 USDC == 1_000_000`.
- **Never** read the native balance and the ERC-20 balance and add or display them
  separately — that double-counts the same money.
- **Never** call `decimals()` on a native sentinel (`0xEeee…`, `0x0000…`); it reverts.
- USDC ↔ native is not a swap. Reject any code path that tries to convert between them.

## A1 — connectivity check

```bash
npm install
node script/check-arc.mjs 0xYourAddress
```

Verifies the RPC answers on chain `5042002`, that USDC's ERC-20 interface is live at the
documented address, and that your wallet holds testnet USDC. Fund at
https://faucet.circle.com first.

Last verified: **Sep 8, 2026** — chain `5042002`, USDC at 6 decimals. ✅

## A2 — `ChaseStake` (next)

Four functions, deliberately minimal:

```solidity
createMatch(bytes32 matchId, uint256 stake)                   // host opens, sets stake
join(bytes32 matchId)                                          // USDC transferFrom into escrow
settle(bytes32 matchId, address winner, string replayRoot)     // server only; pays the pot
refund(bytes32 matchId)                                        // timeout escape hatch
```

`replayRoot` is the 0G Storage Merkle root of the match replay, so a payout is traceable
to the recorded match and its AI decision transcript.
