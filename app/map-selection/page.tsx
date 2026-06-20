'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { gameMaps } from '../data/maps';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, Maximize2, Package, Sparkles, Swords } from 'lucide-react';

const MAP_PREVIEW_IMAGES: Record<string, string[]> = {
  'map-1': ['/assets/maps/forest.png'],
};

const MapPreview = ({ mapId }: { mapId: string }) => {
  const images = MAP_PREVIEW_IMAGES[mapId] || ['/assets/maps/all_tiles_free.png'];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    if (images.length <= 1) return;
    const timer = window.setInterval(() => {
      setIdx((prev) => (prev + 1) % images.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [mapId, images.length]);

  return (
    <div className="relative h-full w-full">
      <Image
        src={images[idx]}
        alt={`Preview for ${mapId}`}
        fill
        priority
        className="object-cover transition-opacity duration-300"
        sizes="(max-width: 768px) 100vw, 33vw"
      />
      {images.length > 1 && (
        <div className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
          {idx + 1}/{images.length}
        </div>
      )}
    </div>
  );
};

export default function MapSelection() {
  const router = useRouter();
  const { gameMode, selectedCharacter, setMap, initUserId } = useGameStore();

  useEffect(() => {
    initUserId();
    if (!gameMode) {
      router.push('/mode-selection');
    } else if (!selectedCharacter) {
      router.push('/character-selection');
    }
  }, [gameMode, selectedCharacter, router, initUserId]);

  const handleMapSelect = (map: any) => {
    setMap(map);
    
    // Route based on game mode
    if (gameMode === 'multiplayer') {
      router.push('/multiplayer-lobby');
    } else {
      router.push('/game');
    }
  };

  if (!gameMode || !selectedCharacter) return null;

  const mapColors = ['#10b981', '#06b6d4', '#8b5cf6']; // green, cyan, purple

  return (
    <main className="h-screen h-[100dvh] w-full flex flex-col overflow-y-auto px-solid-bg p-2 md:p-4 relative">

      <div className="w-full max-w-7xl mx-auto my-auto text-center space-y-4 md:space-y-8 p-2 md:p-4 relative z-10 pb-6 md:pb-4">
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h1 className="text-xl md:text-4xl mb-2 md:mb-4 title-pixel">
            CHOOSE ARENA
          </h1>
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-6">
            <div className="px-3 md:px-4 py-1.5 md:py-2 border-[3px] border-[#11111c] bg-[#6ab04c]">
              <p className="pixel-font text-[9px] md:text-xs text-[#0e2a08] uppercase">
                {selectedCharacter.name}
              </p>
            </div>
            <Swords className="w-5 h-5 md:w-6 md:h-6 text-[#f4e7c3]" />
            <div className="px-3 md:px-4 py-1.5 md:py-2 border-[3px] border-[#11111c] bg-[#ffc93c]">
              <p className="pixel-font text-[9px] md:text-xs text-[#2b2410] uppercase">
                {gameMode === 'single-player' ? 'SINGLE PLAYER' : 'MULTIPLAYER'}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-3 md:gap-8">
          {gameMaps.map((map, index) => {
            const mapColor = mapColors[index % mapColors.length];
            return (
            <motion.div
              key={map.id}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                delay: index * 0.2,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
              whileHover={{ scale: 1.05, rotate: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleMapSelect(map)}
              className="relative group cursor-pointer w-full max-w-md"
            >
              <div 
                className="absolute inset-0 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: mapColor }}
              />
              <div className="relative pixel-panel p-3 md:p-6 group-hover:scale-105 transition-all overflow-hidden"
                style={{ borderColor: mapColor }}
              >
                {/* Map Preview with Actual Map Layout */}
                <div className="relative aspect-video bg-[#14141f] mb-2 md:mb-4 overflow-hidden border-[3px] border-[#11111c]">
                  <MapPreview mapId={map.id} />
                </div>

                {/* Map Name */}
                <h3 className="text-sm md:text-3xl font-black text-white mb-1.5 md:mb-3 uppercase tracking-wider">{map.name}</h3>
                
                {/* Description */}
                <p className="text-green-200 mb-2 md:mb-4 font-bold text-[10px] md:text-base">{map.description}</p>
                
                {/* Map Stats */}
                <div className="space-y-1 md:space-y-2 mb-2 md:mb-4">
                  <div className="flex items-center justify-between bg-[#4d2813] p-1.5 md:p-3 pixel-border">
                    <div className="flex items-center gap-1 md:gap-2">
                      <Maximize2 className="w-2.5 h-2.5 md:w-4 md:h-4 text-[#ffc93c]" />
                      <span className="text-[10px] md:text-sm font-bold text-[#ffc93c]">Dimensions</span>
                    </div>
                    <span className="text-[10px] md:text-sm font-black text-[#f4e7c3]">{map.width} × {map.height}</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#4d2813] p-1.5 md:p-3 pixel-border">
                    <div className="flex items-center gap-1 md:gap-2">
                      <Package className="w-3.5 h-3.5 md:w-5 md:h-5 text-[#ffc93c]" />
                      <span className="text-[10px] md:text-sm font-bold text-[#ffc93c]">Hiding Spots</span>
                    </div>
                    <span className="text-[10px] md:text-sm font-black text-[#f4e7c3]">
                      {map.id === 'map-1' ? 'Many' : map.id === 'map-2' || map.id === 'map-3' ? 'Medium' : 'Few'}
                    </span>
                  </div>
                </div>

                {/* Select Button */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="w-full py-1.5 md:py-3 pixel-button flex items-center justify-center font-black text-xs md:text-lg uppercase tracking-wider"
                  style={{
                    backgroundColor: mapColor,
                    borderColor: '#261309'
                  }}
                >
                  Deploy Here
                </motion.div>
              </div>
            </motion.div>
          )})}

          {/* Coming-soon placeholder — more arenas are on the way. Not selectable. */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: gameMaps.length * 0.2, type: 'spring', stiffness: 200, damping: 15 }}
            className="relative w-full max-w-md cursor-not-allowed select-none"
            aria-disabled="true"
          >
            <div
              className="relative pixel-panel p-3 md:p-6 overflow-hidden h-full flex flex-col"
              style={{ borderColor: '#5b6b7a', opacity: 0.85 }}
            >
              <div className="relative aspect-video bg-[#14141f] mb-2 md:mb-4 overflow-hidden border-[3px] border-[#11111c] flex items-center justify-center">
                <div className="flex flex-col items-center gap-1 md:gap-2 text-[#9fb0d8]">
                  <Lock className="w-7 h-7 md:w-12 md:h-12" />
                  <span className="pixel-font text-[9px] md:text-sm uppercase tracking-widest">Locked</span>
                </div>
                <div className="absolute top-2 left-2 bg-[#ffc93c] text-[#2b2410] pixel-border px-2 py-0.5 text-[8px] md:text-[10px] font-black uppercase">
                  Soon
                </div>
              </div>

              <h3 className="text-sm md:text-3xl font-black text-[#f4e7c3] mb-1.5 md:mb-3 uppercase tracking-wider">
                More Maps Coming
              </h3>
              <p className="text-[#9fb0d8] mb-2 md:mb-4 font-bold text-[10px] md:text-base">
                New arenas — deserts, ruins and more — are in the works. Stay tuned!
              </p>

              <div className="mt-auto w-full py-1.5 md:py-3 flex items-center justify-center font-black text-xs md:text-lg uppercase tracking-wider border-[3px] border-[#11111c] bg-[#4d2813] text-[#9fb0d8]">
                <span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4" /> Coming Soon</span>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            onClick={() => router.push('/character-selection')}
            variant="outline"
            size="lg"
            className="mt-8 gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </Button>
        </motion.div>
      </div>
    </main>
  );
}
