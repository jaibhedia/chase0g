import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Choose Your Mode',
  description:
    'Play solo against AI opponents, or take on real players in a ranked match with USDC on the line.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
