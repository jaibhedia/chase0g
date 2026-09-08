/**
 * Arc testnet — viem chain definition.
 *
 * Arc's native gas asset is USDC, not a separate token. That is the whole reason ranked
 * stakes live here: a player funds one asset and it covers both the stake and the gas to
 * post it. Everywhere else this flow needs two balances and a fee that moves against you
 * between approving and joining.
 *
 * `nativeCurrency.decimals` is 6, matching USDC. Do not copy the 18 that most chain
 * configs carry — viem uses it to format balances, and 18 here silently renders every
 * balance a trillion times too small.
 */
import { defineChain } from 'viem';

export const ARC_TESTNET_ID = 5042002;

/** Mainnet is 5042; A6 adds it. Testnet is where the hackathon build settles. */
export const arcTestnet = defineChain({
  id: ARC_TESTNET_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

/** Link a hash to the explorer — used by the stake panel and the results screen. */
export function arcTxUrl(hash: string): string {
  return `${arcTestnet.blockExplorers.default.url}/tx/${hash}`;
}
