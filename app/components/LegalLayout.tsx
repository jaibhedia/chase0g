import Link from 'next/link';
import type { ReactNode } from 'react';

/** Shared chrome for the Privacy / Terms pages — pixel panel on the adventure
 *  background, matching brand.md. Server component (no client JS needed). */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="adventure-bg pixel-grid min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/"
          className="font-heading text-[10px] text-[#5FCDE4] transition-colors hover:text-[#FFC93C]"
        >
          {'<'} Back to game
        </Link>

        <article className="pixel-panel mt-4 p-6 text-[#f4e7c3] md:p-10">
          <h1 className="title-pixel font-heading text-lg leading-relaxed md:text-2xl">{title}</h1>
          <p className="font-body mt-3 text-sm opacity-60">Last updated: {updated}</p>
          <div className="font-body legal-prose mt-6 space-y-5 text-base leading-relaxed">
            {children}
          </div>
        </article>

        <p className="font-body mt-6 text-center text-xs text-[#f4e7c3]/40">
          © 2026 Chase Dinosaurs
        </p>
      </div>
    </main>
  );
}

/** Section heading shared by the legal pages. */
export function LegalHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-heading mt-8 text-sm leading-relaxed text-[#FFC93C] first:mt-0">
      {children}
    </h2>
  );
}
