import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Choose Your Dino',
  description: 'Pick your character. Each dino handles differently — speed, size, and power-up affinity.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
