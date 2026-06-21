'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Brackets, Coins, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { icon: Brackets, title: 'Seasonal brackets', body: 'Climb single-elimination chase brackets across a season.' },
  { icon: Trophy, title: 'On-chain trophies', body: 'Champions are recorded on the 0G Chain leaderboard — verifiable, not just a number.' },
  { icon: Coins, title: 'Prize pools', body: 'Sponsored seasonal pools. No real-money entry until anti-cheat + authority land.' },
  { icon: ShieldCheck, title: 'Fair play first', body: 'Server-authoritative matches gate competitive play before anything is on the line.' },
];

export default function Tournament() {
  const router = useRouter();

  return (
    <main className="h-screen h-[100dvh] w-full px-solid-bg flex flex-col overflow-y-auto p-4">
      <div className="w-full max-w-4xl mx-auto my-auto text-center py-8">
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
          <div className="mx-auto inline-block pixel-panel px-5 py-3">
            <h1 className="pixel-font text-sm md:text-2xl title-pixel">TOURNAMENTS</h1>
          </div>
          <p className="mt-5 inline-block px-4 py-1 pixel-border bg-[#4d2813] text-[#ffc93c] uppercase tracking-widest text-xs font-bold">
            Coming Soon
          </p>
        </motion.div>

        <p className="mt-6 text-[#f4e7c3] text-base md:text-lg max-w-2xl mx-auto">
          Competitive Chase · Zero is on the way — ranked seasonal brackets with verifiable,
          on-chain champions powered by 0G.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mt-8 text-left">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="p-5 pixel-panel flex gap-3"
            >
              <f.icon className="w-6 h-6 text-[#ffc93c] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-[#f4e7c3]">{f.title}</h3>
                <p className="text-[#f4e7c3]/60 text-sm">{f.body}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-10">
          <Button variant="outline" onClick={() => router.push('/')}>
            <span className="inline-flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </span>
          </Button>
        </div>
      </div>
    </main>
  );
}
