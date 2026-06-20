'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { characters } from '../data/characters';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bot, Lock, Users, Zap } from 'lucide-react';

const spriteNameById: Record<string, string> = {
  doux: 'doux',
  mort: 'mort',
  tard: 'tard',
  vita: 'vita',
};

const SpritePreview = ({ character }: { character: any }) => {
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % 6);
    }, 110);
    return () => window.clearInterval(id);
  }, []);

  const frameSize = 24;
  const cols = 24;
  const runFrame = 4 + frameIdx; // Dino run strip section
  const bgX = -((runFrame % cols) * frameSize);
  const bgY = -(Math.floor(runFrame / cols) * frameSize);
  const spriteName = spriteNameById[character.spriteId] ?? 'doux';

  return (
    <div className="w-20 h-20 md:w-24 md:h-24 relative overflow-hidden">
      <div
        className="absolute"
        style={{
          width: frameSize,
          height: frameSize,
          left: '50%',
          top: '50%',
          backgroundImage: `url(/assets/characters/dino_${spriteName}.png)`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${bgX}px ${bgY}px`,
          imageRendering: 'pixelated',
          transform: 'translate(-50%, -50%) scale(2.9)',
          transformOrigin: 'center',
        }}
      />
    </div>
  );
};

export default function CharacterSelection() {
  const router = useRouter();
  const { gameMode, setCharacter, lockedCharacters, clearLockedCharacters, initUserId } = useGameStore();

  useEffect(() => {
    initUserId();
    if (!gameMode) {
      router.push('/mode-selection');
    }
  }, [gameMode, router, initUserId]);

  // Re-choosing is always allowed: clear any leftover locks from a previous visit so
  // your own earlier pick never shows as "taken" when you navigate back here. (Locks
  // are local-only and nothing server-side populates them.)
  useEffect(() => {
    clearLockedCharacters();
  }, [clearLockedCharacters]);

  const handleCharacterSelect = (character: any) => {
    // Check if character is already locked
    if (lockedCharacters.includes(character.id)) {
      return; // Don't allow selection of locked character
    }

    setCharacter(character);

    // For multiplayer, go to lobby (map selection happens after room creation)
    // For single-player, go to map selection
    if (gameMode === 'multiplayer') {
      router.push('/multiplayer-lobby');
    } else {
      router.push('/map-selection');
    }
  };

  if (!gameMode) return null;

  return (
    <main className="h-screen h-[100dvh] w-full flex flex-col overflow-y-auto px-solid-bg p-2 md:p-4 relative">
      {/* Removed neon background lines for solid look */}

      <div className="w-full max-w-7xl mx-auto my-auto text-center space-y-4 md:space-y-8 p-2 md:p-4 relative z-10 pb-6 md:pb-4">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="py-2 md:py-0"
        >
          <h1 className="text-xl md:text-4xl mb-2 md:mb-4 title-pixel">
            SELECT CHARACTER
          </h1>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block"
          >
            <p className="pixel-font text-[10px] md:text-base mb-4 md:mb-8 px-4 md:px-6 py-2 md:py-3 border-[3px] border-[#11111c] bg-[#ffc93c] text-[#2b2410] uppercase tracking-wider inline-flex items-center justify-center gap-2">
              {gameMode === 'single-player' ? <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />}
              {gameMode === 'single-player' ? 'SINGLE PLAYER' : 'MULTIPLAYER'}
            </p>
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {characters.map((character, index) => {
            const isLocked = lockedCharacters.includes(character.id);
            
            return (
              <motion.div
                key={character.id}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={!isLocked ? { y: -10, scale: 1.05 } : {}}
                whileTap={!isLocked ? { scale: 0.95 } : {}}
                onClick={() => !isLocked && handleCharacterSelect(character)}
                className={`relative group ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                {/* Locked Overlay */}
                {isLocked && (
                  <div className="absolute inset-0 z-20 bg-[#4d2813]/80 backdrop-blur-sm flex items-center justify-center pixel-border border-[#e8503a]">
                    <div className="text-center">
                      <Lock className="w-8 h-8 md:w-14 md:h-14 mx-auto mb-1 md:mb-2 text-[#e8503a]" />
                      <p className="text-[#e8503a] font-black text-sm md:text-xl uppercase">Locked</p>
                      <p className="text-[#f4e7c3]/70 text-xs md:text-sm mt-0.5 md:mt-1">Already Taken</p>
                    </div>
                  </div>
                )}
                
                {/* Removed blur drop shadow */}
                <div className="relative pixel-panel p-3 md:p-6 transition-all"
                  style={{ borderColor: character.color }}
                >
                {/* Character Icon with Sprite */}
                <div
                  className="w-20 h-20 md:w-32 md:h-32 mx-auto mb-2 md:mb-4 flex items-center justify-center pixel-border relative overflow-hidden shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
                  style={{ backgroundColor: character.color }}
                >
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="relative z-10">
                    <SpritePreview character={character} />
                  </div>
                </div>

                {/* Character Name */}
                <h3 className="text-sm md:text-2xl font-black text-white mb-1.5 md:mb-3 uppercase tracking-wider">{character.name}</h3>
                
                {/* Speed Info */}
                <div className="bg-[#4d2813] p-1.5 md:p-3 mb-2 md:mb-4 pixel-border">
                  <div className="flex items-center justify-center gap-1 md:gap-2 mb-0.5 md:mb-1">
                    <Zap className="w-3 h-3 md:w-4 md:h-4 text-[#ffc93c]" />
                    <p className="pixel-font text-[#ffc93c] text-[10px] md:text-xs uppercase">Movement Speed</p>
                  </div>
                  <p className="font-bold text-[#f4e7c3] text-xs md:text-sm">Speed: {character.speed.toFixed(1)}/5.0</p>
                </div>

                {/* Stats */}
                <div className="space-y-1.5 md:space-y-3 mb-2 md:mb-4">
                  <div>
                    <div className="flex justify-between items-center mb-0.5 md:mb-1">
                      <span className="text-[10px] md:text-xs font-bold text-gray-300 uppercase flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 md:w-3 md:h-3" /> Speed
                      </span>
                      <span className="text-xs md:text-sm font-black text-white">{character.speed.toFixed(1)}/5.0</span>
                    </div>
                    <div className="w-full bg-[#261309] h-2 md:h-3 pixel-border overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(character.speed / 5) * 100}%` }}
                        transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
                        className="h-full"
                        style={{
                          background: character.color,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Select Button */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="w-full py-1.5 md:py-2 pixel-button text-center flex items-center justify-center font-black text-xs md:text-sm uppercase tracking-wider"
                  style={{
                    backgroundColor: character.color,
                    borderColor: '#261309'
                  }}
                >
                  Choose
                </motion.div>
              </div>
            </motion.div>
          );
          })}
        </div>

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            onClick={() => router.push('/mode-selection')}
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
