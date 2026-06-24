'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Twitter, Send, Play, ShoppingBag, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameStore } from './store/gameStore';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();
  const initUserId = useGameStore((s) => s.initUserId);

  useEffect(() => {
    initUserId();
  }, [initUserId]);

  return (
    <main className="h-screen h-[100dvh] w-full flex flex-col relative overflow-y-auto">
      {/* Main Menu Background — 16:9 art with logo + dinos. `object-cover` fills the
          whole viewport edge-to-edge (no green letterbox), `object-top` anchors the art
          to the top so the logo never crops; only the bottom grass is trimmed on taller
          screens. The Play button is a separate overlay below, so cropping doesn't hide it. */}
      <div className="absolute inset-0 z-0 bg-[#1a3a1a]">
        <img
          src="/assets/main_bg.png"
          alt="Chase Dinosaurs"
          className="w-full h-full object-cover object-top"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Play Button - positioned at the bottom */}
      <div className="flex-1" />
      <div
        className="relative z-10 flex flex-col items-center gap-2.5 sm:gap-4 px-4"
        style={{
          // Keep the footer/socials above the landscape home indicator on phones.
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.4 }}
        >
          <Button
            variant="default"
            size="xl"
            onClick={() => router.push('/mode-selection')}
            className="px-10 sm:px-16 md:px-24 text-base sm:text-lg md:text-2xl py-3 sm:py-4 md:py-6 [&_svg]:size-4 sm:[&_svg]:size-5 md:[&_svg]:size-6"
          >
            <Play className="fill-current" />
            Play
          </Button>
        </motion.div>

        {/* Secondary nav — Store + Tournament (both Coming Soon) */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push('/asset-store')}
            className="relative pixel-button flex items-center gap-2 px-4 py-2 text-sm opacity-90 hover:opacity-100 transition-opacity"
          >
            <ShoppingBag className="w-4 h-4" /> Store
            <span className="absolute -top-2 -right-2 bg-[#ffc93c] text-[#261309] text-[8px] font-bold uppercase px-1 py-0.5 pixel-border">Soon</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/tournament')}
            className="relative pixel-button flex items-center gap-2 px-4 py-2 text-sm opacity-90 hover:opacity-100 transition-opacity"
          >
            <Trophy className="w-4 h-4" /> Tournament
            <span className="absolute -top-2 -right-2 bg-[#ffc93c] text-[#261309] text-[8px] font-bold uppercase px-1 py-0.5 pixel-border">Soon</span>
          </button>
        </div>

        {/* Socials */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <a
            href="https://t.me/shantanucsd"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 sm:w-14 sm:h-14 pixel-button flex items-center justify-center !p-0 opacity-80 hover:opacity-100 transition-opacity"
          >
            <Send className="w-4 h-4 sm:w-6 sm:h-6" />
          </a>
          <a
            href="https://x.com/ShantanuSwami11"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 sm:w-14 sm:h-14 pixel-button flex items-center justify-center !p-0 opacity-80 hover:opacity-100 transition-opacity"
          >
            <Twitter className="w-4 h-4 sm:w-6 sm:h-6" />
          </a>
        </div>

        <div className="flex items-center gap-3 text-[#f4e7c3]/50 text-[10px] sm:text-xs">
          <Link href="/privacy" className="hover:text-[#FFC93C] transition-colors">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" className="hover:text-[#FFC93C] transition-colors">Terms</Link>
        </div>
        <p className="text-[#f4e7c3]/50 text-[10px] sm:text-xs">© 2026 Chase Dinosaurs</p>
      </div>
    </main>
  );
}
