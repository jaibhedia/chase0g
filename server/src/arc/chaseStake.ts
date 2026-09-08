/**
 * Arc — ChaseStake settlement client.
 *
 * When a ranked match ends the server posts the winner to the ChaseStake escrow on Arc,
 * which pays the whole USDC pot out in one transfer. The `replayRoot` we pass is the
 * same 0G Storage Merkle root already produced for the match replay, so a payout row is
 * traceable end to end: pot -> winner -> replay -> the agents' decision transcript.
 *
 * Gating mirrors the existing 0G modules:
 *   - writes need ARC_PRIVATE_KEY + ARC_CHASESTAKE_ADDRESS
 *   - reads need only ARC_CHASESTAKE_ADDRESS
 * Missing config degrades to a no-op rather than throwing.
 *
 * Free Play safety: `settleMatch` first checks whether the room has a match on-chain at
 * all. Unstaked rooms simply have none, so calling this for every finished match is safe
 * and needs no caller-side branching.
 *
 * SECURITY: ARC_PRIVATE_KEY is the escrow's settlement authority. Server env only, never
 * NEXT_PUBLIC_, never in a browser bundle.
 */
import { ethers } from 'ethers';

const RPC = process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network';
const PRIVATE_KEY = process.env.ARC_PRIVATE_KEY || '';
const ADDRESS = process.env.ARC_CHASESTAKE_ADDRESS || '';

/** USDC's ERC-20 view on Arc: 6 decimals. Display and stakes use this. */
export const USDC_DECIMALS = 6;

/** True when finished matches can be settled on-chain. */
export const arcEnabled = Boolean(PRIVATE_KEY && ADDRESS);
/** True when pot/match state can be read (no funded key required). */
export const arcReadEnabled = Boolean(ADDRESS);

const ABI = [
  'function createMatch(bytes32 matchId, uint256 stake)',
  'function join(bytes32 matchId)',
  'function settle(bytes32 matchId, address winner, string replayRoot)',
  'function refund(bytes32 matchId)',
  'function exists(bytes32 matchId) view returns (bool)',
  'function joined(bytes32 matchId, address player) view returns (bool)',
  'function getMatch(bytes32 matchId) view returns (address host, uint256 stake, uint256 pot, uint64 deadline, bool settled, address[] players)',
];

let provider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!provider) provider = new ethers.JsonRpcProvider(RPC);
  return provider;
}

let readContract: ethers.Contract | null = null;
function getReadContract(): ethers.Contract | null {
  if (!arcReadEnabled) return null;
  if (!readContract) readContract = new ethers.Contract(ADDRESS, ABI, getProvider());
  return readContract;
}

let writeContract: ethers.Contract | null = null;
function getWriteContract(): ethers.Contract | null {
  if (!arcEnabled) return null;
  if (!writeContract) {
    const key = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
    writeContract = new ethers.Contract(ADDRESS, ABI, new ethers.Wallet(key, getProvider()));
  }
  return writeContract;
}

/**
 * Room code -> on-chain match id. Deterministic keccak256 of the room code, so the
 * browser can derive the same id without asking the server for it.
 */
export function matchIdFor(roomCode: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(roomCode));
}

export interface ArcMatch {
  matchId: string;
  host: string;
  stake: string; // USDC, human-readable
  pot: string; // USDC, human-readable
  deadline: number; // unix seconds
  settled: boolean;
  players: string[];
}

/** Read a room's escrow state. Returns null for rooms with no on-chain match. */
export async function getArcMatch(roomCode: string): Promise<ArcMatch | null> {
  const c = getReadContract();
  if (!c) return null;
  const matchId = matchIdFor(roomCode);
  try {
    if (!(await c.exists(matchId))) return null;
    const m = await c.getMatch(matchId);
    return {
      matchId,
      host: m.host,
      stake: ethers.formatUnits(m.stake, USDC_DECIMALS),
      pot: ethers.formatUnits(m.pot, USDC_DECIMALS),
      deadline: Number(m.deadline),
      settled: m.settled,
      players: [...m.players],
    };
  } catch (err) {
    console.warn('[arc] getMatch failed:', (err as Error).message);
    return null;
  }
}

export interface SettleResult {
  txHash: string;
  pot: string;
  winner: string;
  explorer: string;
}

/**
 * Settle a finished ranked match. Safe to call for every match:
 *   - not configured        -> null
 *   - room was not staked   -> null (no on-chain match)
 *   - already settled       -> null
 *   - winner has no wallet  -> null
 * Only a genuine, unsettled, staked match with a participating winner produces a tx.
 */
export async function settleMatch(
  roomCode: string,
  winnerAddress: string | null | undefined,
  replayRoot: string,
): Promise<SettleResult | null> {
  const c = getWriteContract();
  if (!c) return null;

  if (!winnerAddress || !ethers.isAddress(winnerAddress)) {
    console.warn(`[arc] skip settle room=${roomCode}: winner has no valid wallet address`);
    return null;
  }

  const matchId = matchIdFor(roomCode);
  try {
    const existing = await getArcMatch(roomCode);
    if (!existing) return null; // Free Play room — nothing staked, nothing to settle.
    if (existing.settled) {
      console.log(`[arc] match already settled room=${roomCode}`);
      return null;
    }
    if (!(await c.joined(matchId, winnerAddress))) {
      // The contract would revert anyway; failing here keeps the log readable.
      console.warn(`[arc] skip settle room=${roomCode}: winner ${winnerAddress} did not join`);
      return null;
    }

    const tx = await c.settle(matchId, winnerAddress, replayRoot || '');
    const receipt = await tx.wait();
    const txHash = receipt?.hash ?? tx.hash;
    console.log(
      `[arc] settled room=${roomCode} winner=${winnerAddress} pot=${existing.pot} USDC tx=${txHash}`,
    );
    return {
      txHash,
      pot: existing.pot,
      winner: winnerAddress,
      explorer: `https://testnet.arcscan.app/tx/${txHash}`,
    };
  } catch (err) {
    console.warn(`[arc] settle failed room=${roomCode}:`, (err as Error).message);
    return null;
  }
}

if (!arcEnabled) {
  console.warn(
    '[arc] settlement disabled (need ARC_PRIVATE_KEY + ARC_CHASESTAKE_ADDRESS). ' +
      'Ranked matches will play out but will not pay out.',
  );
} else {
  console.log(`[arc] ChaseStake ready → ${ADDRESS} via ${RPC}`);
}
