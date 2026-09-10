import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Choose Your Arena',
  description: 'Pick the map. Every arena changes the sightlines, the cover, and how long a chase lasts.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
