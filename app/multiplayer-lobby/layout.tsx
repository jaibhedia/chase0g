import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Page-level metadata for a client route.
 *
 * `page.tsx` here is a client component and cannot export `metadata`, so the title lives
 * in a layout that renders its children untouched. Without this the route inherited the
 * site-wide title, and every tab in a multi-tab session read identically — which is
 * exactly the situation you're in while testing two players side by side.
 */
export const metadata: Metadata = {
  title: 'Multiplayer Lobby',
  description:
    'Create or join a room, stake USDC on Arc, and play a ranked chase match. Winner takes the pot.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
