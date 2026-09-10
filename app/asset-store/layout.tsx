import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Asset Store',
  description: 'Skins, characters and cosmetics for Chase Dinosaurs.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
