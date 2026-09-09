/**
 * Arc testnet — viem chain definition.
 *
 * Arc's native gas asset is USDC, not a separate token. That is the whole reason ranked
 * stakes live here: a player funds one asset and it covers both the stake and the gas to
 * post it. Everywhere else this flow needs two balances and a fee that moves against you
 * between approving and joining.
 *
 * `nativeCurrency.decimals` is 18, even though the gas asset is USDC. Arc denominates
 * the *native* balance in 18 decimals and exposes the same funds through the ERC-20
 * precompile at 6. Both readings are real and they disagree by 1e12:
 *
 *   eth_getBalance      -> 19970118975457968496  (18dp) = 19.970119 USDC
 *   USDC.balanceOf()    -> 19970118              ( 6dp) = 19.970118 USDC
 *
 * viem formats native balances with this field, so putting 6 here renders gas balances
 * a trillion times too large. Stake amounts are a separate concern: those move through
 * the ERC-20 and use USDC_DECIMALS (6) from chaseStake.ts.
 */
import { defineChain } from 'viem';

export const ARC_TESTNET_ID = 5042002;

/** Mainnet is 5042; A6 adds it. Testnet is where the hackathon build settles. */
export const arcTestnet = defineChain({
  id: ARC_TESTNET_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
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
