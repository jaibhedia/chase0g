/**
 * Testnet USDC drip for new players.
 *
 * A player signs in with an email, Privy hands them a brand-new embedded wallet, and
 * that wallet has nothing in it. Telling them to go find a testnet faucet and paste an
 * address is where a demo loses its audience — so the game funds the first match itself.
 *
 * One native transfer covers everything. Arc's USDC precompile at 0x3600… is a 6-decimal
 * *view* over the native balance, not a separate token:
 *
 *   native 19970118975457968496 (18dp) / 1e12 == erc20 balanceOf 19970118 (6dp)
 *
 * verified exactly on-chain. So sending native USDC gives the player gas *and* the
 * balance that approve/join spend. There is nothing to mint and no second transfer.
 *
 * This is testnet play money, but it is still a wallet handing out funds on request, so
 * it is bounded on every axis available: one claim per address ever, a cap on how much
 * the recipient may already hold, a floor under the faucet's own balance, and a single
 * in-flight send at a time.
 */
import { ethers } from 'ethers';

/** Drip size. Two matches at the 1 USDC default buy-in, plus room for gas. */
const DRIP_USDC = 2n;
/** Native is 18dp even though the ERC-20 view is 6dp — see the module note. */
const DRIP_WEI = DRIP_USDC * 10n ** 18n;

/**
 * Don't top up someone who can already play. Anyone above this has no need for a drip,
 * and it stops a returning player from claiming again from a fresh browser profile.
 */
const ALREADY_FUNDED_WEI = 1n * 10n ** 18n;

/** Never spend the faucet down to nothing — settlement runs from the same key. */
const RESERVE_WEI = 5n * 10n ** 18n;

const RPC = process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network';
const PRIVATE_KEY = process.env.ARC_PRIVATE_KEY || '';

export const faucetEnabled = Boolean(PRIVATE_KEY);

/**
 * Addresses already served, and whether a send is in flight.
 *
 * In memory on purpose: this is a hackathon testnet faucet, and a restart re-arming a
 * few addresses costs play money. What it must not do is serve the same address twice
 * *concurrently*, which is why claims are recorded before the await, not after.
 */
const claimed = new Set<string>();
let sending = false;

export type FaucetResult =
  | { ok: true; txHash: string; amount: string }
  | { ok: false; reason: string };

function wallet(): ethers.Wallet | null {
  if (!PRIVATE_KEY) return null;
  return new ethers.Wallet(PRIVATE_KEY, new ethers.JsonRpcProvider(RPC));
}

export async function dripTo(rawAddress: string): Promise<FaucetResult> {
  if (!ethers.isAddress(rawAddress)) return { ok: false, reason: 'Not a valid address.' };
  const to = ethers.getAddress(rawAddress);

  const w = wallet();
  if (!w) return { ok: false, reason: 'Faucet is not configured on this server.' };

  if (claimed.has(to)) return { ok: false, reason: 'This wallet has already been funded.' };
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

    // Claim before awaiting the send: two requests for the same address can otherwise
    // both pass the checks above and each get a drip.
    claimed.add(to);
    sending = true;

    const tx = await w.sendTransaction({ to, value: DRIP_WEI });
    await tx.wait();
    console.log(`[faucet] sent ${DRIP_USDC} USDC to ${to} tx=${tx.hash}`);
    return { ok: true, txHash: tx.hash, amount: DRIP_USDC.toString() };
  } catch (e) {
    // A failed send should not burn the address's one claim.
    claimed.delete(to);
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[faucet] send to ${to} failed: ${msg}`);
    return { ok: false, reason: 'Faucet transfer failed. Try again shortly.' };
  } finally {
    sending = false;
  }
}
