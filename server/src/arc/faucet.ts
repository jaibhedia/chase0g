/**
 * Testnet USDC drip for new players.
 *
 * A player signs in with an email, Privy hands them a brand-new embedded wallet, and
 * that wallet has nothing in it. Telling them to go find a testnet faucet and paste an
 * address is where a demo loses its audience — so the game funds the first match itself,
 * automatically, with no button to press.
 *
 * One native transfer covers everything. Arc's USDC precompile at 0x3600… is a 6-decimal
 * *view* over the native balance, not a separate token:
 *
 *   native 19970118975457968496 (18dp) / 1e12 == erc20 balanceOf 19970118 (6dp)
 *
 * verified exactly on-chain. So sending native USDC gives the player gas *and* the
 * balance that approve/join spend. There is nothing to mint and no second transfer.
 *
 * Runs on its own key (FAUCET_PRIVATE_KEY), deliberately not the settlement key. A faucet
 * hands money to anyone who asks; settlement holds the escrow's authority. Sharing one
 * wallet would mean a drained faucet is also a match that cannot pay out.
 */
import { ethers } from 'ethers';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { worldEnabled } from '../world/selfieCheck';

/** Drip size. Two matches at the 1 USDC default buy-in, plus room for gas. */
const DRIP_USDC = 2n;
/** Native is 18dp even though the ERC-20 view is 6dp — see the module note. */
const DRIP_WEI = DRIP_USDC * 10n ** 18n;

/**
 * Don't top up someone who can already play. Anyone above this has no need for a drip,
 * and it stops a returning player from claiming again from a fresh browser profile.
 */
const ALREADY_FUNDED_WEI = 1n * 10n ** 18n;

/** Leave enough behind to cover gas on the sends themselves. */
const RESERVE_WEI = 1n * 10n ** 18n;

const RPC = process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network';
const PRIVATE_KEY = process.env.FAUCET_PRIVATE_KEY || '';

export const faucetEnabled = Boolean(PRIVATE_KEY);

/**
 * Who has already been served, persisted across restarts.
 *
 * This was a bare in-memory Set, which quietly meant "once per address *per server
 * process*" — every restart re-armed everyone, and a dev server restarts constantly. On
 * a wallet holding a fixed amount of testnet USDC that is the difference between a
 * faucet and a leak.
 *
 * Three independent keys, because they fail differently: an address stops the same wallet
 * claiming twice, a Privy user id stops one account claiming again from a wallet it
 * re-provisioned, and a World ID nullifier stops one *person* claiming from a fresh email.
 * Any one matching is enough to refuse.
 *
 * The nullifier is the only key of the three that costs anything to forge. An address and
 * a user id are both free to mint — Privy signs you in with an email, so ten inboxes are
 * ten "new players" — which made the first two keys a speed bump rather than a limit. The
 * nullifier is per-person and unlinkable, so it is the one that actually holds.
 */
const CLAIMS_FILE = join(process.cwd(), '.faucet-claims.json');

interface ClaimRecord {
  addresses: string[];
  userIds: string[];
  nullifiers: string[];
}

function loadClaims(): { addresses: Set<string>; userIds: Set<string>; nullifiers: Set<string> } {
  try {
    const raw = JSON.parse(readFileSync(CLAIMS_FILE, 'utf8')) as Partial<ClaimRecord>;
    return {
      addresses: new Set(Array.isArray(raw.addresses) ? raw.addresses : []),
      userIds: new Set(Array.isArray(raw.userIds) ? raw.userIds : []),
      // Absent in ledgers written before the World gate existed; an empty set is the
      // correct reading of "nobody has proved humanity yet".
      nullifiers: new Set(Array.isArray(raw.nullifiers) ? raw.nullifiers : []),
    };
  } catch {
    // Missing or corrupt file means nobody has claimed yet, which is the safe reading on
    // a testnet faucet: it costs play money, and refusing everyone would be worse.
    return { addresses: new Set(), userIds: new Set(), nullifiers: new Set() };
  }
}

const claimed = loadClaims();

/** Write via temp + rename so a crash mid-write cannot leave a truncated ledger. */
function persistClaims(): void {
  try {
    const tmp = `${CLAIMS_FILE}.tmp`;
    const data: ClaimRecord = {
      addresses: [...claimed.addresses],
      userIds: [...claimed.userIds],
      nullifiers: [...claimed.nullifiers],
    };
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, CLAIMS_FILE);
  } catch (e) {
    // A failed write degrades to in-memory-only for this process rather than failing the
    // drip that already succeeded. Worth a line in the log, since it means restarts will
    // re-arm these addresses.
    console.warn(`[faucet] could not persist claims: ${(e as Error).message}`);
  }
}

let sending = false;

export type FaucetResult =
  | { ok: true; txHash: string; amount: string }
  | { ok: false; reason: string };

function wallet(): ethers.Wallet | null {
  if (!PRIVATE_KEY) return null;
  return new ethers.Wallet(PRIVATE_KEY, new ethers.JsonRpcProvider(RPC));
}

/**
 * Would this player actually be funded, ignoring the World gate?
 *
 * Exists so the client never asks for a selfie it has no use for. With the gate on, a
 * no-proof request cannot be distinguished from an unfunded one without this, so a player
 * who already has 5 USDC would be prompted to verify and then told they didn't need to —
 * friction spent for nothing, on the credential whose entire selling point is low
 * friction. Runs every check `dripTo` runs except the World requirement, and sends
 * nothing.
 */
export async function faucetEligibility(
  rawAddress: string,
  userId?: string | null,
): Promise<{ eligible: boolean; reason?: string }> {
  if (!ethers.isAddress(rawAddress)) return { eligible: false, reason: 'Not a valid address.' };
  const to = ethers.getAddress(rawAddress);
  const uid = typeof userId === 'string' && userId ? userId.slice(0, 128) : null;

  const w = wallet();
  if (!w) return { eligible: false, reason: 'Faucet is not configured on this server.' };
  if (claimed.addresses.has(to)) return { eligible: false, reason: 'This wallet has already been funded.' };
  if (uid && claimed.userIds.has(uid)) return { eligible: false, reason: 'This account has already been funded.' };

  try {
    const [recipientBalance, faucetBalance] = await Promise.all([
      w.provider!.getBalance(to),
      w.provider!.getBalance(w.address),
    ]);
    if (recipientBalance >= ALREADY_FUNDED_WEI) {
      return { eligible: false, reason: 'This wallet already has enough USDC to play.' };
    }
    if (faucetBalance < DRIP_WEI + RESERVE_WEI) {
      return { eligible: false, reason: 'Faucet is empty — ask the team to top it up.' };
    }
    return { eligible: true };
  } catch {
    // An RPC blip should not present as "you already have money" — let the caller try the
    // real claim and surface a genuine error there.
    return { eligible: true };
  }
}

/**
 * Send the drip.
 *
 * `nullifier` is a World ID Selfie Check nullifier, already verified by the caller. When
 * the World gate is configured it is REQUIRED — see `worldEnabled` — because without it
 * the only uniqueness keys are an address and an email, both free to mint. When World is
 * not configured the faucet keeps its older, weaker behaviour rather than refusing
 * everyone, since a faucet nobody can use is worse than a faucet that can be gamed for
 * play money.
 */
export async function dripTo(
  rawAddress: string,
  userId?: string | null,
  nullifier?: string | null,
): Promise<FaucetResult> {
  if (!ethers.isAddress(rawAddress)) return { ok: false, reason: 'Not a valid address.' };
  const to = ethers.getAddress(rawAddress);
  const uid = typeof userId === 'string' && userId ? userId.slice(0, 128) : null;
  const nul = typeof nullifier === 'string' && nullifier ? nullifier.toLowerCase().slice(0, 128) : null;

  const w = wallet();
  if (!w) return { ok: false, reason: 'Faucet is not configured on this server.' };

  // With the gate on, an unproven caller never reaches the balance checks below — the
  // point is to spend nothing, not to fail late.
  if (worldEnabled && !nul) {
    return { ok: false, reason: 'Verify you are a real person to claim your USDC.' };
  }

  if (claimed.addresses.has(to)) return { ok: false, reason: 'This wallet has already been funded.' };
  if (uid && claimed.userIds.has(uid)) return { ok: false, reason: 'This account has already been funded.' };
  if (nul && claimed.nullifiers.has(nul)) {
    return { ok: false, reason: 'You have already claimed from this faucet.' };
  }
  if (sending) return { ok: false, reason: 'Faucet is busy — try again in a moment.' };

  try {
    const [recipientBalance, faucetBalance] = await Promise.all([
      w.provider!.getBalance(to),
      w.provider!.getBalance(w.address),
    ]);

    if (recipientBalance >= ALREADY_FUNDED_WEI) {
      return { ok: false, reason: 'This wallet already has enough USDC to play.' };
    }
    if (faucetBalance < DRIP_WEI + RESERVE_WEI) {
      return { ok: false, reason: 'Faucet is empty — ask the team to top it up.' };
    }

    // Record before awaiting the send, and persist immediately: two requests for the same
    // address can otherwise both pass the checks above and each get a drip, and a crash
    // between sending and recording would re-arm the address on restart.
    claimed.addresses.add(to);
    if (uid) claimed.userIds.add(uid);
    if (nul) claimed.nullifiers.add(nul);
    persistClaims();
    sending = true;

    const tx = await w.sendTransaction({ to, value: DRIP_WEI });
    await tx.wait();
    console.log(`[faucet] sent ${DRIP_USDC} USDC to ${to}${uid ? ` (uid ${uid.slice(0, 16)}…)` : ''} tx=${tx.hash}`);
    return { ok: true, txHash: tx.hash, amount: DRIP_USDC.toString() };
  } catch (e) {
    // A failed send should not burn the claim.
    claimed.addresses.delete(to);
    if (uid) claimed.userIds.delete(uid);
    if (nul) claimed.nullifiers.delete(nul);
    persistClaims();
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[faucet] send to ${to} failed: ${msg}`);
    return { ok: false, reason: 'Faucet transfer failed. Try again shortly.' };
  } finally {
    sending = false;
  }
}

/** Faucet wallet address + balance, for a boot-time log and the /health payload. */
export async function faucetStatus(): Promise<{ address: string; usdc: string } | null> {
  const w = wallet();
  if (!w) return null;
  try {
    const bal = await w.provider!.getBalance(w.address);
    return { address: w.address, usdc: ethers.formatEther(bal) };
  } catch {
    return null;
  }
}
