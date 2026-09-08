'use client';

/**
 * Ranked stake panel — the player-facing half of the Arc escrow.
 *
 * Shows the pot, walks the player through approve -> join, and links every transaction to
 * Arcscan. Settlement is the server's job; this panel only ever spends the player's own
 * USDC and then watches.
 *
 * IMPORTANT — `roomCode` must be the *canonical* code, the uppercase one the server
 * echoed back, not the raw text a player typed into the join box. The lobby uppercases
 * before it emits (`roomCode.toUpperCase()`), and `matchIdFor` hashes the string as-is,
 * so passing the raw input would derive a match id the server never settles and strand
 * the stake until the refund window opens.
 */
import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { parseUnits } from 'viem';
import { useRankedStake } from '@/app/hooks/useRankedStake';
import { USDC_DECIMALS } from '@/lib/arc/chaseStake';
import { arcTxUrl } from '@/lib/arc/chain';

/** Default ranked buy-in. Small on purpose — testnet USDC still has to be fauceted. */
const DEFAULT_STAKE = '1';

export function RankedStakePanel({
  roomCode,
  stake = DEFAULT_STAKE,
}: {
  roomCode: string | null;
  stake?: string;
}) {
  const { ready, authenticated, login, user } = usePrivy();
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stakeAmount = parseUnits(stake, USDC_DECIMALS);
  const s = useRankedStake(roomCode, stakeAmount);

  const run = async (fn: () => Promise<`0x${string}`>) => {
    setError(null);
    try {
      setTxHash(await fn());
    } catch (e) {
      // Wallet rejections are a normal outcome, not a failure worth a stack trace.
      const msg = e instanceof Error ? e.message : String(e);
      setError(/user rejected|denied/i.test(msg) ? 'Transaction cancelled.' : msg);
    }
  };

  if (!ready) return <Shell><p className="text-[#F4E7C3]/60">Loading wallet…</p></Shell>;

  if (!authenticated) {
    return (
      <Shell>
        <p className="mb-3 text-[#F4E7C3]/80">
          Ranked matches pay out a real USDC pot on Arc. Sign in with email — we&apos;ll make
          you a wallet, no seed phrase.
        </p>
        <Button onClick={login}>Sign in to play ranked</Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[#FFC93C] font-heading text-sm">POT</span>
        <span className="text-[#FFC93C] font-heading text-xl">{s.potFormatted} USDC</span>
      </div>

      <div className="mb-3 text-xs text-[#F4E7C3]/60">
        <div>Buy-in {s.stakeFormatted} USDC · {s.players.length} in</div>
        {s.balanceFormatted !== null && <div>Balance {s.balanceFormatted} USDC</div>}
        {user?.email?.address && <div className="truncate">{user.email.address}</div>}
      </div>

      {!s.hasEnough && s.step !== 'joined' && (
        <p className="mb-2 text-xs text-[#E8503A]">
          Not enough USDC for the buy-in.
        </p>
      )}

      {s.step === 'needs-approval' && (
        <Button disabled={!s.hasEnough} onClick={() => run(s.approve)}>
          Approve {s.stakeFormatted} USDC
        </Button>
      )}
      {s.step === 'ready-to-join' && (
        <Button disabled={!s.hasEnough} onClick={() => run(s.join)}>
          Stake &amp; enter
        </Button>
      )}
      {s.step === 'approving' && <Pending>Approving…</Pending>}
      {s.step === 'joining' && <Pending>Entering match…</Pending>}
      {s.step === 'joined' && (
        <p className="text-[#6AB04C] font-heading text-sm">You&apos;re in. Winner takes the pot.</p>
      )}
      {s.step === 'settled' && (
        <p className="text-[#6AB04C] font-heading text-sm">Match settled — pot paid out.</p>
      )}
      {s.step === 'loading' && <Pending>Reading chain…</Pending>}

      {error && <p className="mt-2 break-words text-xs text-[#E8503A]">{error}</p>}
      {txHash && (
        <a
          className="mt-2 block text-xs text-[#5FCDE4] underline"
          href={arcTxUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Arcscan ↗
        </a>
      )}
    </Shell>
  );
}

/* Sharp corners, thick ink border — matches the arcade panels used across the game. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-4 border-[#11111C] bg-[#181826] p-4 font-body text-[#F4E7C3]">
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full border-2 border-[#11111C] bg-[#FFC93C] px-4 py-2 font-heading text-xs text-[#11111C] transition-transform active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Pending({ children }: { children: React.ReactNode }) {
  return <p className="font-heading text-xs text-[#FFC93C]">{children}</p>;
}
