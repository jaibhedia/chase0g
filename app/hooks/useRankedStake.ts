'use client';

/**
 * The ranked staking flow, as one hook: allowance -> approve -> join -> watch the pot.
 *
 * ERC-20 makes staking two transactions, and that is the part players get stuck on. The
 * hook models it as a single `step` the UI can render literally, so a player always knows
 * whether they are approving or actually entering.
 *
 * `pot` is read from the chain rather than tracked locally, because agents and other
 * players join the same escrow — the pot moves without this browser doing anything.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, type Hex } from 'viem';
import {
  CHASE_STAKE_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  chaseStakeAbi,
  erc20Abi,
  matchIdFor,
} from '@/lib/arc/chaseStake';

export type StakeStep =
  | 'disconnected'
  | 'loading'
  | 'needs-approval'
  | 'approving'
  | 'ready-to-join'
  | 'joining'
  | 'joined'
  | 'settled';

export function useRankedStake(roomCode: string | null, stakeAmount: bigint) {
  const { address, isConnected } = useAccount();
  const matchId: Hex | undefined = roomCode ? matchIdFor(roomCode) : undefined;
  const enabled = Boolean(matchId && address);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, CHASE_STAKE_ADDRESS] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: balance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: hasJoined, refetch: refetchJoined } = useReadContract({
    address: CHASE_STAKE_ADDRESS,
    abi: chaseStakeAbi,
    functionName: 'joined',
    args: matchId && address ? [matchId, address] : undefined,
    query: { enabled },
  });

  // Polled rather than event-subscribed: the pot changes when *other* players and agents
  // join, and a plain HTTP RPC has no subscription to hang a watcher on.
  const { data: match, refetch: refetchMatch } = useReadContract({
    address: CHASE_STAKE_ADDRESS,
    abi: chaseStakeAbi,
    functionName: 'getMatch',
    args: matchId ? [matchId] : undefined,
    query: { enabled: Boolean(matchId), refetchInterval: 4000 },
  });

  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  // An approval only shows up in `allowance` once it is mined, and a join only shows up in
  // `joined`. Without waiting on the receipt the UI sits on "needs approval" after the
  // player already approved, and they approve a second time.
  const [pendingHash, setPendingHash] = useState<Hex | undefined>();
  const { isSuccess: pendingMined, isLoading: pendingWaiting } = useWaitForTransactionReceipt({
    hash: pendingHash,
    query: { enabled: Boolean(pendingHash) },
  });

  useEffect(() => {
    if (!pendingMined) return;
    refetchAllowance();
    refetchJoined();
    refetchMatch();
    setPendingHash(undefined);
  }, [pendingMined, refetchAllowance, refetchJoined, refetchMatch]);

  const approve = useCallback(async () => {
    // Approve exactly the stake, not the usual unbounded allowance. Players are trusting
    // a hackathon contract with real USDC; a per-match approval bounds what a bug can take.
    const hash = await writeContractAsync({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [CHASE_STAKE_ADDRESS, stakeAmount],
    });
    setPendingHash(hash);
    return hash;
  }, [writeContractAsync, stakeAmount]);

  const join = useCallback(async () => {
    if (!matchId) throw new Error('No room code — nothing to join.');
    // `createMatch` opens the escrow and joins in one call, so only the first player in a
    // room calls it. Everyone after joins the escrow that already exists.
    const exists = match && match[0] !== '0x0000000000000000000000000000000000000000';
    const hash = await writeContractAsync({
      address: CHASE_STAKE_ADDRESS,
      abi: chaseStakeAbi,
      functionName: exists ? 'join' : 'createMatch',
      args: exists ? [matchId] : [matchId, stakeAmount],
    } as never);
    setPendingHash(hash);
    return hash;
  }, [writeContractAsync, matchId, match, stakeAmount]);

  const settled = match?.[4] ?? false;
  // BigInt(0), not 0n: tsconfig targets ES2017, which rejects bigint literals.
  const pot = match?.[2] ?? BigInt(0);

  // Order matters: settled and joined are chain facts and outrank any in-flight local
  // state, so a confirmed join never flickers back to a pending label.
  const busy = isWriting || pendingWaiting;
  let step: StakeStep = 'loading';
  if (!isConnected) step = 'disconnected';
  else if (settled) step = 'settled';
  else if (hasJoined) step = 'joined';
  else if (busy) step = allowance !== undefined && allowance < stakeAmount ? 'approving' : 'joining';
  else if (allowance === undefined) step = 'loading';
  else if (allowance < stakeAmount) step = 'needs-approval';
  else step = 'ready-to-join';

  return {
    step,
    matchId,
    pot,
    potFormatted: formatUnits(pot, USDC_DECIMALS),
    stakeFormatted: formatUnits(stakeAmount, USDC_DECIMALS),
    balance,
    balanceFormatted: balance === undefined ? null : formatUnits(balance, USDC_DECIMALS),
    hasEnough: balance === undefined ? true : balance >= stakeAmount,
    players: match?.[5] ?? [],
    settled,
    approve,
    join,
    refresh: () => {
      refetchAllowance();
      refetchJoined();
      refetchMatch();
    },
  };
}
