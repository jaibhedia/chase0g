import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Not indexed on purpose. This route is a hand-off shell that redirects into the Vite
 * game with match config in the URL hash — landing on it from a search result means
 * arriving with no match to play, so it should never be a search result.
 */
export const metadata: Metadata = {
  title: 'Playing',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
