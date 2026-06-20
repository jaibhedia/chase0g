'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, User, Users } from 'lucide-react';

export default function ModeSelection() {
  const router = useRouter();
  const { setGameMode, gameMode, resetGame, userId, initUserId } = useGameStore();

  useEffect(() => {
    if (!userId) initUserId();
  }, [userId, initUserId]);

  const handleModeSelect = (mode: 'single-player' | 'multiplayer') => {
    setGameMode(mode);
    router.push('/character-selection');
  };

  const handleBackToHome = () => {
    resetGame();
    router.push('/');
  };

  return (
    <main className="h-screen h-[100dvh] w-full flex flex-col overflow-y-auto px-solid-bg p-4 relative">

      <div className="w-full max-w-6xl mx-auto my-auto text-center space-y-4 md:space-y-8 p-2 md:p-4 relative z-10">
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="py-2 md:py-0"
        >
          <div className="mx-auto inline-block pixel-panel px-5 py-3">
            <h1 className="pixel-font text-sm md:text-2xl title-pixel">
              CHASE MODE SELECTION
            </h1>
          </div>
          <p className="mt-5 text-base md:text-xl text-[#f4e7c3] uppercase tracking-widest pixel-shadow">
            Pick Your Arena Style
          </p>
        </motion.div>

        <div className="relative flex flex-col md:grid md:grid-cols-2 gap-4 md:gap-8 mt-4 md:mt-12 pb-20 md:pb-0">
          {/* Removed neon dividing line */}
          {/* Single Player Card */}
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleModeSelect('single-player')}
            className="relative group cursor-pointer"
          >
            <div className="relative pixel-panel p-4 md:p-8 overflow-hidden">
              
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mb-3 md:mb-6"
              >
                <User className="w-12 md:w-24 h-12 md:h-24 mx-auto text-blue-400 drop-shadow-2xl" />
              </motion.div>
              
              <h2 className="pixel-font text-2xl md:text-4xl text-white mb-2 md:mb-4 tracking-wider">
                SOLO
              </h2>
              
              <div className="bg-[#4d2813] pixel-border p-2 md:p-4 mb-3 md:mb-6">
                <p className="text-[#ffc93c] font-bold text-sm md:text-lg">
                  Play against AI bots in a fast-paced chase game!
                </p>
              </div>

              <ul className="text-left space-y-2 md:space-y-3 text-[#f4e7c3] mb-3 md:mb-6 text-xs md:text-base">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 md:w-5 md:h-5 text-[#6ab04c] shrink-0 mt-0.5" />
                  <span>Compete against smart AI opponents</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 md:w-5 md:h-5 text-[#6ab04c] shrink-0 mt-0.5" />
                  <span>Perfect for practicing your skills</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 md:w-5 md:h-5 text-[#6ab04c] shrink-0 mt-0.5" />
                  <span>Quick matches, instant action</span>
                </li>
              </ul>

              <Button variant="game" size="lg" className="w-full">
                PLAY SOLO
              </Button>
            </div>
          </motion.div>

          {/* Multiplayer Card */}
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
            whileHover={{ scale: 1.05, rotate: 2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleModeSelect('multiplayer')}
            className="relative group cursor-pointer"
          >
            <div className="relative pixel-panel p-4 md:p-8 overflow-hidden">
              
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                className="mb-3 md:mb-6"
              >
                <Users className="w-12 md:w-24 h-12 md:h-24 mx-auto text-green-400 drop-shadow-2xl" />
              </motion.div>
              
              <h2 className="pixel-font text-2xl md:text-4xl text-white mb-2 md:mb-4 tracking-wider">
                MULTIPLAYER
              </h2>
              
              <div className="bg-[#4d2813] pixel-border p-2 md:p-4 mb-3 md:mb-6">
                <p className="text-[#6ab04c] font-bold text-sm md:text-lg">
                  Compete with real players + AI in chaotic chases!
                </p>
              </div>

              <ul className="text-left space-y-2 md:space-y-3 text-[#f4e7c3] mb-3 md:mb-6 text-xs md:text-base">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 md:w-5 md:h-5 text-[#ffc93c] shrink-0 mt-0.5" />
                  <span>Play with friends and other players</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 md:w-5 md:h-5 text-[#ffc93c] shrink-0 mt-0.5" />
                  <span>Unpredictable and exciting gameplay</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 md:w-5 md:h-5 text-[#ffc93c] shrink-0 mt-0.5" />
                  <span>More players, more chaos!</span>
                </li>
              </ul>

              <Button variant="default" size="lg" className="w-full">
                PLAY MULTIPLAYER
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Back Button */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 md:mt-8 pb-4"
        >
          <Button
            onClick={handleBackToHome}
            variant="outline"
            size="lg"
          >
            <ArrowLeft className="mr-2 h-4 md:h-5 w-4 md:w-5" />
            Back to Home
          </Button>
        </motion.div>
      </div>
    </main>
  );
}
