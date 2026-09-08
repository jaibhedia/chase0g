/**
 * A1 — Arc Testnet connectivity check.
 *
 * Proves three things before any contract work starts:
 *   1. the RPC answers and reports the chain id we expect
 *   2. USDC's ERC-20 interface is live at the documented address
 *   3. the wallet we're about to deploy with actually holds testnet USDC
 *
 * Usage:
 *   node script/check-arc.mjs 0xYourAddress
 *   ARC_ADDRESS=0x... node script/check-arc.mjs
 */
import { createPublicClient, http, formatUnits, isAddress } from 'viem';
import { arcTestnet, USDC_ADDRESS, USDC_DECIMALS, erc20Abi, FAUCET_URL } from './arc.mjs';

const EXPECTED_CHAIN_ID = 5042002;

const address = process.argv[2] || process.env.ARC_ADDRESS || '';

const client = createPublicClient({ chain: arcTestnet, transport: http() });

let failed = false;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const bad = (msg) => {
  console.log(`  ❌ ${msg}`);
  failed = true;
};

console.log(`\nArc Testnet check — ${arcTestnet.rpcUrls.default.http[0]}\n`);

// 1. RPC reachable, correct chain
try {
  const [chainId, blockNumber] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
  ]);
  if (chainId === EXPECTED_CHAIN_ID) {
    ok(`RPC live — chain ${chainId}, block ${blockNumber}`);
  } else {
    bad(`wrong chain: expected ${EXPECTED_CHAIN_ID}, got ${chainId}`);
  }
} catch (err) {
  bad(`RPC unreachable — ${err.shortMessage || err.message}`);
  console.log('\nCannot continue without an RPC connection.\n');
  process.exit(1);
}

// 2. USDC ERC-20 interface live at the documented address
try {
  const decimals = await client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'decimals',
  });
  if (Number(decimals) === USDC_DECIMALS) {
    ok(`USDC ERC-20 at ${USDC_ADDRESS} — ${decimals} decimals`);
  } else {
    bad(`USDC decimals mismatch: expected ${USDC_DECIMALS}, got ${decimals}`);
  }
} catch (err) {
  bad(`USDC ERC-20 read failed — ${err.shortMessage || err.message}`);
}

// 3. Wallet funded
if (!address) {
  console.log('  ⏭  No address given — skipping balance check.');
  console.log('     Pass one: node script/check-arc.mjs 0xYourAddress');
} else if (!isAddress(address)) {
  bad(`"${address}" is not a valid address`);
} else {
  try {
    const balance = await client.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    });
    const usdc = formatUnits(balance, USDC_DECIMALS);
    // On Arc the native balance is the SAME money in an 18-decimal view, so we
    // deliberately report only the ERC-20 view. Reporting both would double-count.
    if (balance > 0n) {
      ok(`${address} holds ${usdc} USDC`);
    } else {
      bad(`${address} has 0 USDC — fund it at ${FAUCET_URL}`);
    }
  } catch (err) {
    bad(`balance read failed — ${err.shortMessage || err.message}`);
  }
}

console.log(
  failed
    ? '\nA1 incomplete — fix the ❌ above before starting A2.\n'
    : '\nA1 complete. Ready for A2 (ChaseStake escrow).\n'
);
process.exit(failed ? 1 : 0);
