/**
 * 0G Storage — Phase 2 of the 0G integration (verifiable match replays).
 *
 * When a match ends we bundle the final result together with the match's REAL AI
 * decision transcript (every intent the 0G Compute brains returned, timestamped) and
 * upload it to 0G Storage. The network returns a Merkle root hash that uniquely +
 * verifiably addresses that bundle — we surface it on the results screen as proof the
 * agents actually reasoned on 0G (and link the storage tx on the Galileo explorer).
 *
 * Like Compute, this is gracefully degradable: if no funded storage wallet is
 * configured (OG_STORAGE_PRIVATE_KEY), `ogStorageEnabled` is false and uploads are
 * skipped — the game still finishes, just without the verifiable artifact.
 */
import { Indexer, ZgFile } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const RPC = process.env.OG_EVM_RPC || 'https://evmrpc-testnet.0g.ai';
const INDEXER_URL = process.env.OG_STORAGE_INDEXER || 'https://indexer-storage-testnet-turbo.0g.ai';
// One funded Galileo testnet wallet powers both Storage (Phase 2) and Chain (Phase 3).
const PRIVATE_KEY = process.env.OG_PRIVATE_KEY || process.env.OG_STORAGE_PRIVATE_KEY || '';

/** True when a funded storage wallet is configured → replays get uploaded to 0G. */
export const ogStorageEnabled = !!PRIVATE_KEY;

export interface ReplayUploadResult {
  rootHash: string;
  txHash: string;
}

let indexer: Indexer | null = null;
let signer: ethers.Wallet | null = null;

function getStorage(): { indexer: Indexer; signer: ethers.Wallet } | null {
  if (!ogStorageEnabled) return null;
  if (!indexer || !signer) {
    try {
      const provider = new ethers.JsonRpcProvider(RPC);
      signer = new ethers.Wallet(PRIVATE_KEY, provider);
      indexer = new Indexer(INDEXER_URL);
    } catch (err) {
      console.warn('[0G Storage] init failed:', (err as Error).message);
      return null;
    }
  }
  return { indexer, signer };
}

/**
 * Upload a replay bundle (JSON) to 0G Storage. Returns the Merkle root hash + the
 * storage transaction hash, or null on any failure (so the caller degrades quietly).
 */
export async function uploadReplay(bundle: unknown): Promise<ReplayUploadResult | null> {
  const s = getStorage();
  if (!s) return null;

  const tmpPath = join(tmpdir(), `chase-replay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  let file: ZgFile | null = null;
  try {
    await writeFile(tmpPath, JSON.stringify(bundle));
    file = await ZgFile.fromFilePath(tmpPath);

    const [tree, treeErr] = await file.merkleTree();
    if (treeErr) throw treeErr;
    const rootHash = tree?.rootHash();
    if (!rootHash) throw new Error('empty merkle root');

    // Cast: the 0G SDK pins ethers' CommonJS Signer type while our ethers resolves to
    // the ESM build — nominally incompatible (#private) though identical at runtime.
    const [tx, upErr] = await s.indexer.upload(file, RPC, s.signer as unknown as Parameters<typeof s.indexer.upload>[2]);
    if (upErr) throw upErr;

    return { rootHash, txHash: tx?.txHash ?? '' };
  } catch (err) {
    console.warn('[0G Storage] upload failed:', (err as Error).message);
    return null;
  } finally {
    if (file) await file.close().catch(() => {});
    await unlink(tmpPath).catch(() => {});
  }
}
