'use client';

/**
 * Sign-in gate for multiplayer, placed at the door rather than at the stake.
 *
 * Every multiplayer room in Chase is a ranked room — the lobby mounts the stake panel
 * unconditionally — so a wallet is needed for any room a player creates or joins. The
 * login prompt used to live inside that panel, which put it *after* the room existed.
 * The bad path was concrete: you create a room, send the code to a friend, they join,
 * and only then do you both meet a sign-in wall, with a live room and a waiting
 * opponent behind it. Whoever bails leaves the other in an empty room.
 *
 * Gating entry also matches what players already expect from web3 games: connect first,
 * then lobby. And the wallet address is the identity settlement pays out to, so it needs
 * to exist before there is a match to settle.
 *
 * Single-player never renders this — it routes to /character-selection and stays
 * walletless.
 */
import { usePrivy } from '@privy-io/react-auth';
import { ReactNode, createContext, useContext, useEffect, useRef } from 'react';
import { WALLET_ENABLED } from '../providers/WalletProvider';

const WalletAddressContext = createContext<string | null>(null);

/**
 * The signed-in player's Arc address, or null when there isn't one.
 *
 * Components below the gate can't call `useAccount`/`usePrivy` directly: with no Privy
 * app id neither provider is mounted and both throw. The gate already branches on that,
 * so it publishes the address here and everything downstream reads it unconditionally.
 *
 * The lobby sends this to the server on create/join, which is what lets settlement turn
 * the winning userId back into a payable address at match end.
 */
export function useWalletAddress(): string | null {
  return useContext(WalletAddressContext);
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen h-[100dvh] w-full px-solid-bg flex flex-col overflow-y-auto p-4">
      <div className="w-full max-w-md mx-auto my-auto">
        <h1 className="text-2xl md:text-4xl font-bold text-white text-center mb-8">
          Multiplayer
        </h1>
        <div className="p-6 pixel-panel text-center">{children}</div>
      </div>
    </div>
  );
}

/**
 * The real gate. Split into its own component so `usePrivy` is only ever called inside a
 * mounted PrivyProvider — see WALLET_ENABLED.
 */
function PrivyGate({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  const { ready, authenticated, login, user } = usePrivy();

  // Privy restores an existing session asynchronously. Rendering the sign-in button
  // during that window would flash "sign in" at players who already are.
  if (!ready) {
    return (
      <Screen>
        <p className="text-[#f4e7c3]/60">Loading wallet…</p>
      </Screen>
    );
  }

  if (!authenticated) {
    return (
      <Screen>
        <h2 className="pixel-font text-2xl font-bold text-[#f4e7c3] mb-3">Sign in to play</h2>
        <p className="text-[#f4e7c3]/70 mb-6 text-sm leading-relaxed">
          Multiplayer matches are ranked — each one holds a USDC pot the winner takes.
          Sign in with your email and we&apos;ll set up a wallet for you. No extension,
          no seed phrase.
        </p>
        <button
          onClick={login}
          className="w-full px-6 py-3 bg-[#ffc93c] text-[#1a1a1a] pixel-font font-bold hover:brightness-110 transition"
        >
          Sign in with email
        </button>
        <button
          onClick={onBack}
          className="w-full mt-3 px-6 py-2 text-[#f4e7c3]/60 text-sm hover:text-[#f4e7c3] transition"
        >
          Back to mode select
        </button>
      </Screen>
    );
  }

  // Embedded wallets are provisioned on login, but `user.wallet` can still be briefly
  // absent on the first render after sign-in. Publishing null for that tick is correct:
  // the lobby simply sends no address until it has one.
  return (
    <WalletAddressContext.Provider value={user?.wallet?.address ?? null}>
      <AutoFund address={user?.wallet?.address ?? null} />
      {children}
    </WalletAddressContext.Provider>
  );
}

/**
 * Funds a freshly-created wallet without asking.
 *
 * A new player has no USDC and no idea they need any, so there is nothing useful to put
 * behind a button — a button here is just a step between a player and the thing they came
 * to do. This fires the moment an address exists and renders nothing.
 *
 * Every guard that matters lives on the server (one claim per address, recipient must be
 * broke, faucet keeps a reserve). The ref here only stops React's double-invoked effects
 * in development from firing two requests for the same address; the server would refuse
 * the second anyway.
 */
function AutoFund({ address }: { address: string | null }) {
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!address || attempted.current === address) return;
    attempted.current = address;

    const base = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    fetch(`${base}/arc/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) console.log(`[faucet] funded with ${d.amount} USDC — ${d.txHash}`);
      })
      // Silent by design. Every refusal is either "you already have money" or "the faucet
      // is off", and neither is something to interrupt a player with. If funding did fail
      // and they are actually broke, the stake panel says so at the point it matters.
      .catch(() => {});
  }, [address]);

  return null;
}

export function MultiplayerAuthGate({
  children,
  onBack,
}: {
  children: ReactNode;
  onBack: () => void;
}) {
  // No app id configured: let multiplayer through unauthenticated rather than making the
  // whole mode unreachable. Matches still play; the stake panel reports that ranked is
  // unconfigured and nothing pays out.
  if (!WALLET_ENABLED) return <>{children}</>;

  return (
    <PrivyGate onBack={onBack}>{children}</PrivyGate>
  );
}
