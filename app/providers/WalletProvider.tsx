'use client';

/**
 * Wallet stack for ranked play: Privy for login, wagmi for contract calls.
 *
 * Chase's players are gamers, not crypto users. Privy lets them sign in with an email and
 * get an embedded wallet — no extension, no seed phrase — while anyone who already has a
 * wallet can still connect one. Both land in the same wagmi hooks downstream, so the
 * staking UI never branches on how the player got here.
 *
 * `@privy-io/wagmi`'s WagmiProvider is a drop-in for wagmi's own, with one difference that
 * matters: it will not attempt a reconnect for an embedded wallet Privy hasn't restored
 * yet. Importing WagmiProvider from `wagmi` here instead produces embedded wallets that
 * appear disconnected on a hard refresh.
 *
 * Free Play never mounts a wallet — this only gates ranked, where real USDC is at stake.
 */
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'wagmi';
import { ReactNode, useState } from 'react';
import { arcTestnet } from '@/lib/arc/chain';

const wagmiConfig = createConfig({
  chains: [arcTestnet],
  transports: { [arcTestnet.id]: http() },
});

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

/**
 * Whether the Privy tree is actually mounted below this provider.
 *
 * Anything calling `usePrivy()` must check this first: with no app id we render children
 * unwrapped, and the hook throws outside its provider. Branch on it at the *component*
 * boundary, never inside a component that also calls the hook — a conditional `usePrivy()`
 * would break the rules of hooks. It reads from a NEXT_PUBLIC_ constant, so the value is
 * fixed at build time and the branch never flips between renders.
 */
export const WALLET_ENABLED = Boolean(PRIVY_APP_ID);

export function WalletProvider({ children }: { children: ReactNode }) {
  // One QueryClient per mount, created in state so React 19's double-invoked renders in
  // development don't hand wagmi a fresh cache on every render.
  const [queryClient] = useState(() => new QueryClient());

  // Without an app id Privy throws on mount. A missing key should cost you the staking
  // button, not the whole game, so render the app unwrapped and let the stake panel
  // report that ranked play is unconfigured.
  if (!PRIVY_APP_ID) return <>{children}</>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Email first: the point is that a player who has never held crypto can still
        // stake. `users-without-wallets` provisions the embedded wallet on first login.
        loginMethods: ['email', 'wallet'],
        // Privy v3 nests this per chain family — a flat `createOnLogin` is the v2 shape
        // and silently provisions nothing.
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
        // Sun + Ink from brand.md, so the Privy modal reads as part of the game.
        appearance: { theme: 'dark', accentColor: '#FFC93C' },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
