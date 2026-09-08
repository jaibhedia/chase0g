/**
 * Arc Testnet chain config — shared by scripts and (later) the app.
 *
 * The one thing to internalise about Arc: **USDC is the native gas asset.**
 * There is no separate "native token" plus a "USDC token" — it is ONE pool of
 * funds exposed through two interfaces:
 *
 *   - native view: 18 decimals, used only for gas and msg.value
 *   - ERC-20 view: 6 decimals, at USDC_ADDRESS below
 *
 * Never add the two together and never "convert" between them; both are the
 * same money. Everything user-facing (balances, stakes, the pot) uses the
 * 6-decimal ERC-20 view.
 */
import { defineChain } from 'viem';

/** USDC ERC-20 interface on Arc. 6 decimals. Use this for stakes and display. */
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
export const USDC_DECIMALS = 6;

export const EURC_ADDRESS = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a';

/** CCTP domain for Arc, for any future cross-chain USDC transfer. */
export const ARC_CCTP_DOMAIN = 26;

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network'],
      webSocket: ['wss://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
});

/** Arc mainnet — used by the A6 deploy script. Not live for us until Sep 30. */
export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_MAINNET_RPC_URL || 'https://rpc.arc.network'] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://arcscan.app' } },
});

export const FAUCET_URL = 'https://faucet.circle.com';

/** Minimal ERC-20 surface the escrow and scripts need. */
export const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
];
