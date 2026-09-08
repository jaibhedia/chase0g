# AI Tool Usage Disclosure — ETHOnline 2026

Submitted per the ETHOnline 2026 rule on **Use of AI Tools**, which requires
attribution of where and how AI tools were used, and — where a spec-driven workflow is
used — that all spec files, prompts, and planning artifacts ship in the repository.

**Tool used:** Claude Code (Claude Opus 5), used as a pair programmer.
**Planning artifact:** [`plan.md`](plan.md) — committed, and revised in-repo across the
event so its history is auditable alongside the code.

---

## How to verify what was built during the hackathon

The repository is tagged at its pre-hackathon state:

```bash
git diff pre-ethonline2026..main --stat     # everything new
git log pre-ethonline2026..main --oneline   # commit-by-commit progress
```

Tag `pre-ethonline2026` points at `599d858`, the last commit before ETHOnline 2026.

---

## Division of work

**Human (Shantanu Swami)** — product direction and every decision that shaped the build:
which sponsor tracks to target and why; the two-lane design that keeps Free Play
walletless while Ranked carries the Web3 layer; the escrow's trust model; scope calls
under a 5-day deadline; all game design, pixel art, audio, and level design; and review
of every contract change before deployment. Mentor feedback (0x, Julio Cruz, Edgar
Navarro, tingowiggle) was gathered and triaged by the author.

**AI (Claude Code)** — implementation assistance under that direction: research into
sponsor requirements, drafting code to specification, test authoring, and documentation.

---

## Where AI was used, by file

### Pre-hackathon code (`app/`, `game-app/`, `server/`, `contracts/ChaseLeaderboard.sol`)
Built before ETHOnline 2026 and **not submitted as hackathon work**. See `plan.md` for
the full continuity disclosure of what existed beforehand.

### Hackathon work

| File | AI involvement | Human review |
|---|---|---|
| `plan.md` | Drafted from sponsor research and mentor feedback; strategy decided by the author | Scope, tracks, and cut list set by author |
| `packages/LICENSE`, `packages/README.md` | Drafted | Reviewed |
| `LICENSE`, `README.md` (license split) | Edited to carve out `packages/` | Reviewed |
| `packages/contracts-arc/script/arc.mjs` | Written by AI from Circle's published Arc network docs | Verified against live testnet |
| `packages/contracts-arc/script/check-arc.mjs` | Written by AI | Run against Arc testnet; output verified |
| `packages/contracts-arc/src/ChaseStake.sol` | Drafted by AI to a human-specified four-function interface | **Read line by line before deploy** |
| `packages/contracts-arc/test/*.sol` | Test suite authored by AI | Cases reviewed for coverage of the trust model |
| `packages/contracts-arc/script/Deploy.s.sol` | Written by AI | Reviewed; run by the author with their own key |

*This table is updated as features land. Rows are added in the same commit as the code
they describe.*

---

## Standards held to

1. **No unreviewed money code.** `ChaseStake.sol` holds real USDC. Every line was read
   and understood by the author before deployment. The contract was also shared with a
   sponsor mentor for independent review.
2. **Granular commits.** One commit per feature, never a bulk dump — both because the
   rules require visible progress and because it keeps the diff reviewable.
3. **Verified, not assumed.** Network details (chain ID `5042002`, USDC ERC-20 at
   `0x3600…0000`, 6 decimals) were checked against the live chain rather than taken
   from model output. The check script in `packages/contracts-arc/` is the receipt.
4. **The author can explain any of it.** Anything that could not be explained on demand
   was not shipped.

---

## Corrections AI made during the build

Recorded because they show the research was verified rather than trusted:

- An early draft of the plan claimed Arc's full $10,000 pool was continuity-exclusive.
  It is not — continuity access is $1,666 + $1,500.
- An early draft targeted World's **Selfie Check** bounty. Selfie Check is
  *Start from Scratch*; the continuity door is **AgentKit**.
- An early draft assumed the submission deadline was Sep 14. It is
  **Sep 13, 12:00 pm EDT**.
- An early draft proposed an npm SDK for The Graph. That targets the *From Scratch*
  tooling track; the continuity track is **Best AI Use Case**.
