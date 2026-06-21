'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Coins, Lock } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { cosmetics, cosmeticCategories } from '../data/cosmetics';
import { Button } from '@/components/ui/button';

// The store mechanics (coins, ownership, equip) are wired in the store, but real assets
// + purchasing are not live yet — flip this to true when the catalog ships.
const STORE_LIVE = false;

export default function AssetStore() {
  const router = useRouter();
  const { coins, ownedCosmetics, initCosmetics, purchaseCosmetic, equipCosmetic } = useGameStore();

  useEffect(() => {
    initCosmetics();
  }, [initCosmetics]);

  return (
    <main className="h-screen h-[100dvh] w-full px-solid-bg flex flex-col overflow-y-auto p-4">
      <div className="w-full max-w-6xl mx-auto my-auto py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="inline-block pixel-panel px-5 py-3">
            <h1 className="pixel-font text-sm md:text-2xl title-pixel">ASSET STORE</h1>
          </div>
          <div className="inline-flex items-center gap-2 pixel-panel px-4 py-2">
            <Coins className="w-5 h-5 text-[#ffc93c]" />
            <span className="text-[#f4e7c3] font-bold text-lg">{coins.toLocaleString()}</span>
            <span className="text-[#f4e7c3]/60 text-sm uppercase tracking-wider">coins</span>
          </div>
        </div>

        {/* Coming-soon banner */}
        {!STORE_LIVE && (
          <div className="mb-6 p-4 pixel-border bg-[#4d2813] flex items-center gap-3">
            <Lock className="w-5 h-5 text-[#ffc93c] shrink-0" />
            <p className="text-[#f4e7c3] text-sm md:text-base">
              <span className="font-bold text-[#ffc93c]">Coming Soon.</span> Browse the cosmetics
              dropping to Chase · Zero — skins, trails, taunts and emotes. Purchasing goes live with
              the first asset pack.
            </p>
          </div>
        )}

        {/* Categories */}
        <div className="space-y-8">
          {cosmeticCategories.map((cat) => {
            const items = cosmetics.filter((c) => c.type === cat.type);
            if (items.length === 0) return null;
            return (
              <section key={cat.type}>
                <div className="mb-3">
                  <h2 className="pixel-font text-xl font-bold text-[#f4e7c3]">{cat.label}</h2>
                  <p className="text-[#f4e7c3]/60 text-sm">{cat.blurb}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {items.map((item, i) => {
                    const owned = ownedCosmetics.includes(item.id);
                    const affordable = coins >= item.price;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.04, 0.3) }}
                        className="relative p-4 pixel-panel flex flex-col"
                      >
                        <span
                          className="w-full h-16 border-2 border-[#261309] mb-3"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-bold text-sm text-[#f4e7c3]">{item.name}</span>
                        <span className="text-[#f4e7c3]/55 text-xs mb-3 flex-1">{item.description}</span>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-[#ffc93c] text-sm font-bold">
                            <Coins className="w-4 h-4" /> {item.price}
                          </span>
                          {owned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => equipCosmetic(item.id, item.type)}
                            >
                              Equip
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              disabled={!STORE_LIVE || !affordable}
                              onClick={() => STORE_LIVE && purchaseCosmetic(item.id, item.price)}
                            >
                              {!STORE_LIVE ? (
                                <span className="inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Soon</span>
                              ) : affordable ? 'Buy' : 'Need coins'}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Back */}
        <div className="mt-8 text-center">
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
