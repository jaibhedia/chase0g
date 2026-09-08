/**
 * End-to-end proof against the live Arc testnet deployment.
 *
 * Runs a full round on the deployed ChaseStake — approve, open a match with a stake,
 * settle it to the winner, and check the USDC actually moved. This is the A2/A3
 * "done when" criterion: a real stake -> settle -> payout on the explorer.
 *
 * The wallet plays both host and server, so the pot returns to it and the only real
 * cost is gas (paid in USDC on Arc). Uses a 0.1 USDC stake.
 *
 *   node script/e2e-testnet.mjs
 *
 * Reads ARC_PRIVATE_KEY and ARC_CHASESTAKE_ADDRESS from .env.
 */
import { readFileSync } from 'node:fs';
import {
  createWalletClient, createPublicClient, http, parseUnits, formatUnits,
  keccak256, toHex, getContract,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet, USDC_ADDRESS, USDC_DECIMALS } from './arc.mjs';

// --- config -----------------------------------------------------------------
/**
 * Minimal .env reader. Strips surrounding quotes and trailing `# ...` comments —
 * `echo "KEY=abc # note" > .env` is an easy way to end up with the comment glued to
 * the value, and foundry's own dotenv strips it, so we match that behaviour.
 */
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      const key = l.slice(0, i).trim();
      let value = l.slice(i + 1).trim();
      value = value.replace(/\s+#.*$/, '').trim(); // drop inline comment
      value = value.replace(/^["'](.*)["']$/, '$1'); // drop wrapping quotes
      return [key, value];
    }),
);

const rawKey = env.ARC_PRIVATE_KEY || process.env.ARC_PRIVATE_KEY || '';
const KEY = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
const STAKE_CONTRACT =
  env.ARC_CHASESTAKE_ADDRESS ||
  process.env.ARC_CHASESTAKE_ADDRESS ||
  '0xD648def45026f437351D797dC3574fa97507BA83';

if (!/^0x[0-9a-fA-F]{64}$/.test(KEY)) {
  console.error('ARC_PRIVATE_KEY missing or malformed in .env');
  process.exit(1);
}

const STAKE = parseUnits('0.1', USDC_DECIMALS);
const roomCode = `E2E${Date.now().toString(36).toUpperCase().slice(-3)}`;
const matchId = keccak256(toHex(roomCode));

const account = privateKeyToAccount(KEY);
const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const wallet = createWalletClient({ account, chain: arcTestnet, transport: http() });

const stakeAbi = [
  { type: 'function', name: 'createMatch', stateMutability: 'nonpayable', inputs: [{ name: 'matchId', type: 'bytes32' }, { name: 'stake', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'settle', stateMutability: 'nonpayable', inputs: [{ name: 'matchId', type: 'bytes32' }, { name: 'winner', type: 'address' }, { name: 'replayRoot', type: 'string' }], outputs: [] },
  { type: 'function', name: 'getMatch', stateMutability: 'view', inputs: [{ name: 'matchId', type: 'bytes32' }], outputs: [{ name: 'host', type: 'address' }, { name: 'stake', type: 'uint256' }, { name: 'pot', type: 'uint256' }, { name: 'deadline', type: 'uint64' }, { name: 'settled', type: 'bool' }, { name: 'players', type: 'address[]' }] },
];
const erc20Abi = [
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const usdc = (a) => formatUnits(a, USDC_DECIMALS);
const explorer = (h) => `https://testnet.arcscan.app/tx/${h}`;

console.log(`\nChaseStake e2e — ${STAKE_CONTRACT}`);
console.log(`wallet ${account.address}`);
console.log(`room   ${roomCode}  matchId ${matchId.slice(0, 18)}…\n`);

const startBal = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
console.log(`start balance      ${usdc(startBal)} USDC`);

// 1. approve
const allowance = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [account.address, STAKE_CONTRACT] });
if (allowance < STAKE) {
  const h = await wallet.writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [STAKE_CONTRACT, parseUnits('100', USDC_DECIMALS)] });
  await publicClient.waitForTransactionReceipt({ hash: h });
  console.log(`1. approve         ✅ ${explorer(h)}`);
} else {
  console.log('1. approve         ✅ already approved');
}

// 2. createMatch — host joins and the stake is escrowed
const createHash = await wallet.writeContract({ address: STAKE_CONTRACT, abi: stakeAbi, functionName: 'createMatch', args: [matchId, STAKE] });
await publicClient.waitForTransactionReceipt({ hash: createHash });
console.log(`2. createMatch     ✅ ${explorer(createHash)}`);

const afterJoin = await publicClient.readContract({ address: STAKE_CONTRACT, abi: stakeAbi, functionName: 'getMatch', args: [matchId] });
console.log(`   pot escrowed    ${usdc(afterJoin[2])} USDC · players ${afterJoin[5].length}`);

const midBal = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
const escrowBefore = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [STAKE_CONTRACT] });

// 3. settle — server pays the pot to the winner, carrying the 0G replay root
const replayRoot = '0g-replay-root-e2e-demo';
const settleHash = await wallet.writeContract({ address: STAKE_CONTRACT, abi: stakeAbi, functionName: 'settle', args: [matchId, account.address, replayRoot] });
await publicClient.waitForTransactionReceipt({ hash: settleHash });
console.log(`3. settle          ✅ ${explorer(settleHash)}`);

const finalMatch = await publicClient.readContract({ address: STAKE_CONTRACT, abi: stakeAbi, functionName: 'getMatch', args: [matchId] });
const endBal = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
const escrowBal = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [STAKE_CONTRACT] });

console.log(`\n   settled         ${finalMatch[4]}`);
console.log(`   pot after       ${usdc(finalMatch[2])} USDC`);
console.log(`   escrow paid out ${usdc(escrowBefore - escrowBal)} USDC`);
console.log(`   escrow balance  ${usdc(escrowBal)} USDC`);
console.log(`   winner net      ${usdc(endBal - midBal)} USDC  (pot minus the gas they paid)`);
// The stake round-trips back to this wallet, so the whole net change is gas.
console.log(`   end balance     ${usdc(endBal)} USDC  (total gas ${usdc(startBal - endBal)} USDC)\n`);

// Assert against the ESCROW, not the winner's wallet. On Arc gas is USDC, so the
// winner pays settle's gas out of the same pool the pot lands in — their net gain is
// always pot minus gas. The escrow's own balance is the honest measure.
const ok =
  finalMatch[4] === true &&          // marked settled
  finalMatch[2] === 0n &&            // pot zeroed
  escrowBefore === STAKE &&          // exactly the stake was held
  escrowBal === 0n &&                // nothing stranded
  escrowBefore - escrowBal === STAKE; // and all of it left

console.log(
  ok
    ? '✅ e2e PASSED — stake escrowed, full pot paid to winner, escrow empty\n'
    : '❌ e2e FAILED\n',
);
process.exit(ok ? 0 : 1);
