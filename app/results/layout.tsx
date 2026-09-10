import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Not indexed: results render from the previous match's state, so this page is empty for
 * anyone who arrives without having just played one.
 */
export const metadata: Metadata = {
  title: 'Match Results',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
