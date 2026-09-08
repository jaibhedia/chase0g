/**
 * ChaseStake — browser-side contract binding.
 *
 * The server has its own ethers client at `server/src/arc/chaseStake.ts` for settlement.
 * This is the read/write surface the *player* touches: approve, join, watch the pot.
 * Settlement stays server-only — the browser never holds the settlement key.
 *
 * Kept as a const-asserted ABI rather than an imported artifact so wagmi can infer
 * argument and return types at the call site.
 */
import { keccak256, toBytes, type Address, type Hex } from 'viem';

/**
 * Room code -> on-chain match id.
 *
 * Must stay byte-identical to `matchIdFor` in `server/src/arc/chaseStake.ts`, which is
 * `ethers.keccak256(ethers.toUtf8Bytes(roomCode))`. viem's `toBytes` on a string is the
 * same UTF-8 encoding, so the two agree.
 *
 * Neither side normalizes case, and that is deliberate: `genRoomCode` only ever emits
 * uppercase, and a mis-cased code fails the room lookup long before it reaches Arc.
 * Adding a `toUpperCase()` on one side only would silently point a stake at a match id
 * the server never settles.
 */
export function matchIdFor(roomCode: string): Hex {
  return keccak256(toBytes(roomCode));
}

/** Deployed on Arc testnet. Public address, safe to ship in the client bundle. */
export const CHASE_STAKE_ADDRESS = (process.env.NEXT_PUBLIC_ARC_CHASESTAKE_ADDRESS ||
  '0xD648def45026f437351D797dC3574fa97507BA83') as Address;

/**
 * Arc's USDC precompile. The contract hardcodes this same address as a constant, so it
 * is fixed by the chain, not configuration.
 */
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as Address;

export const USDC_DECIMALS = 6;

export const chaseStakeAbi = [
  {
    type: 'function',
    name: 'createMatch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'stake', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'join',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refund',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'exists',
    stateMutability: 'view',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'joined',
    stateMutability: 'view',
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getMatch',
    stateMutability: 'view',
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    outputs: [
      { name: 'host', type: 'address' },
      { name: 'stake', type: 'uint256' },
      { name: 'pot', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
      { name: 'settled', type: 'bool' },
      { name: 'players', type: 'address[]' },
    ],
  },
  {
    type: 'event',
    name: 'PlayerJoined',
    inputs: [
      { name: 'matchId', type: 'bytes32', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'stake', type: 'uint256', indexed: false },
      { name: 'pot', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MatchSettled',
    inputs: [
      { name: 'matchId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'pot', type: 'uint256', indexed: false },
      { name: 'replayRoot', type: 'string', indexed: false },
    ],
  },
] as const;

/** Minimal ERC-20 surface: joining needs an allowance, the UI needs a balance. */
export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
