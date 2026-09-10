import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Tournament',
  description: 'Bracketed Chase Dinosaurs tournaments with a pooled USDC prize.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
