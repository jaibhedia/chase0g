# Chase · Zero — on-chain leaderboard (Phase 3 / 0G Chain)

`ChaseLeaderboard.sol` is a tiny contract on the **0G Galileo testnet** (an EVM chain).
The game server posts each finished match — `{ winner, score, replay rootHash }` — and
anyone can read the leaderboard back. Because the `rootHash` addresses that match's
verifiable **0G Storage** replay (result + the real **0G Compute** AI decision
transcript), every leaderboard row is trustlessly verifiable end to end.

## Deploy

```bash
cd contracts
npm install                                  # solc + ethers (one time)
OG_PRIVATE_KEY=0xYOUR_FUNDED_KEY npm run deploy
```

- Needs a **funded** Galileo testnet wallet — the same `OG_PRIVATE_KEY` the server uses.
  Get test 0G from the Galileo faucet.
- RPC defaults to `https://evmrpc-testnet.0g.ai` (override with `OG_EVM_RPC`).
- On success it prints the deployed address and writes `ChaseLeaderboard.abi.json`.

## Wire it up

Put the printed address in `server/.env`:

```
OG_LEADERBOARD_ADDRESS=0x...
```

The server then submits results after each match (linked to the 0G Storage replay) and
serves them at `GET /leaderboard`; the results screen renders the on-chain leaderboard.

> Until an address is set, Phase 3 degrades gracefully — Storage replays still work, the
> leaderboard panel just stays hidden.
