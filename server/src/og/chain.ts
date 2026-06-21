/**
 * 0G Chain — Phase 3 of the 0G integration (on-chain tournament leaderboard).
 *
 * After a match's replay is stored on 0G Storage, the server posts the result to the
 * ChaseLeaderboard contract on the Galileo testnet, linking the winner + score to the
 * replay's 0G Storage root hash. Reads are public, so the results screen can render a
 * trustless leaderboard where every row is verifiable back to its replay + AI transcript.
 *
 * Gated like Compute/Storage:
 *   - writes need OG_PRIVATE_KEY + OG_LEADERBOARD_ADDRESS
 *   - reads need only OG_LEADERBOARD_ADDRESS (+ RPC)
 * Missing config degrades to a no-op (empty leaderboard / skipped submit).
 */
import { ethers } from 'ethers';

const RPC = process.env.OG_EVM_RPC || 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.OG_PRIVATE_KEY || process.env.OG_STORAGE_PRIVATE_KEY || '';
const LEADERBOARD_ADDRESS = process.env.OG_LEADERBOARD_ADDRESS || '';

/** True when results can be posted on-chain. */
export const ogChainEnabled = !!(PRIVATE_KEY && LEADERBOARD_ADDRESS);
/** True when the leaderboard can be read (no funded key required). */
export const ogChainReadEnabled = !!LEADERBOARD_ADDRESS;

const ABI = [
  'function submitMatch(string winner, uint256 score, string rootHash) returns (uint256)',
  'function totalMatches() view returns (uint256)',
  'function getRecent(uint256 n) view returns (tuple(string winner,uint256 score,string rootHash,uint64 timestamp,address submitter)[])',
];

let provider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!provider) provider = new ethers.JsonRpcProvider(RPC);
  return provider;
}

let writeContract: ethers.Contract | null = null;
function getWriteContract(): ethers.Contract | null {
  if (!ogChainEnabled) return null;
  if (!writeContract) {
    try {
      const wallet = new ethers.Wallet(PRIVATE_KEY, getProvider());
      writeContract = new ethers.Contract(LEADERBOARD_ADDRESS, ABI, wallet);
    } catch (err) {
      console.warn('[0G Chain] init failed:', (err as Error).message);
      return null;
    }
  }
  return writeContract;
}

let readContract: ethers.Contract | null = null;
function getReadContract(): ethers.Contract | null {
  if (!ogChainReadEnabled) return null;
  if (!readContract) readContract = new ethers.Contract(LEADERBOARD_ADDRESS, ABI, getProvider());
  return readContract;
}

export interface LeaderboardRow {
  winner: string;
  score: number;
  rootHash: string;
  timestamp: number;
}

/** Post a finished match to the on-chain leaderboard. Returns the tx hash, or null. */
export async function submitMatch(
  winner: string,
  score: number,
  rootHash: string,
): Promise<{ txHash: string } | null> {
  const c = getWriteContract();
  if (!c) return null;
  try {
    const tx = await c.submitMatch(
      String(winner ?? '').slice(0, 64),
      BigInt(Math.max(0, Math.floor(score || 0))),
      String(rootHash ?? ''),
    );
    const receipt = await tx.wait();
    return { txHash: receipt?.hash ?? tx.hash };
  } catch (err) {
    console.warn('[0G Chain] submit failed:', (err as Error).message);
    return null;
  }
}

/** Read the most recent `n` matches (newest first). Empty on any failure. */
export async function getRecent(n = 10): Promise<LeaderboardRow[]> {
  const c = getReadContract();
  if (!c) return [];
  try {
    const rows = await c.getRecent(BigInt(n));
    return (rows as any[]).map((r) => ({
      winner: String(r.winner ?? r[0] ?? ''),
      score: Number(r.score ?? r[1] ?? 0),
      rootHash: String(r.rootHash ?? r[2] ?? ''),
      timestamp: Number(r.timestamp ?? r[3] ?? 0),
    }));
  } catch (err) {
    console.warn('[0G Chain] read failed:', (err as Error).message);
    return [];
  }
}
