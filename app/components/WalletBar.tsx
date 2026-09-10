'use client';

/**
 * Your wallet, visible.
 *
 * Privy signs a player in with an email and silently provisions an embedded wallet, so
 * the address exists but is never shown anywhere — leaving a signed-in player with no
 * way to answer "where do I send USDC?". The stake panel only showed the email. This
 * puts the address on screen, one tap to copy, next to the balance it controls.
 *
 * The balance shown is the ERC-20 view at 0x3600…, which is the same funds the native
 * gas balance holds (the precompile is a 6-decimal view over it) and the exact number
 * approve/join spend against — so what a player reads here is what the stake panel can
 * actually move.
 */
import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { USDC_ADDRESS, USDC_DECIMALS } from '@/lib/arc/chaseStake';

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export function WalletBar() {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);

  const { data: balance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 5000 },
  });

  if (!address) return null;

  const human = balance !== undefined ? formatUnits(balance as bigint, USDC_DECIMALS) : null;
  // Funding is automatic on sign-in (see AutoFund), so an empty wallet here means the
  // drip is still confirming — or the faucet is off. Either way it resolves without the
  // player doing anything, so say so instead of offering an action.
  // Built with BigInt() rather than a 10n literal — the app's TS target predates them.
  const oneUsdc = BigInt(10) ** BigInt(USDC_DECIMALS);
  const funding = balance !== undefined && (balance as bigint) < oneUsdc;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is permission-gated and blocked outright in some embedded views. The
      // address is selectable text either way, so a failure here is not worth an error.
    }
  };

  return (
    <div className="p-4 pixel-panel mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[#ffc93c] text-xs mb-1">Your wallet</p>
          <button
            onClick={copy}
            title="Copy address"
            className="font-mono text-sm text-[#f4e7c3] hover:text-white transition break-all text-left"
          >
            {address}
          </button>
          <p className="text-[#f4e7c3]/50 text-xs mt-1">
            {copied ? 'Copied.' : 'Tap to copy'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[#ffc93c] text-xs mb-1">Balance</p>
          <p className="text-2xl font-bold text-[#f4e7c3]">
            {human === null ? '…' : `${Number(human).toFixed(2)} USDC`}
          </p>
        </div>
      </div>

      {funding && (
        <p className="text-[#f4e7c3]/70 text-sm mt-3">
          Setting you up with USDC — this takes a few seconds.
        </p>
      )}
    </div>
  );
}
