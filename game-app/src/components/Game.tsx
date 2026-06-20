import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import GameCanvas from '@/components/GameCanvas';
import GameHUD from '@/components/GameHUD';
import MobileControls from '@/components/MobileControls';
import LandscapePrompt from '@/components/LandscapePrompt';
import ConnectionStatus from '@/components/ConnectionStatus';
import VoiceChat from '@/components/VoiceChat';
import GameMenu from '@/components/GameMenu';
import NetStats from '@/components/NetStats';

export interface GameProps {
  onGameEnd: () => void;
}

export function Game({ onGameEnd }: GameProps) {
  const { gamePhase, countdownTimer, players, userId } = useGameStore();
  const [mobileDirection, setMobileDirection] = useState({ x: 0, y: 0 });
  const [mobilePowerUpPressed, setMobilePowerUpPressed] = useState(false);

  const currentPlayer = players.find(
    (p) => p.userId === userId || (!p.isBot && players.length > 0)
  );
  const powerUpReady = currentPlayer?.powerUpReady ?? false;
  const powerUpActive = currentPlayer?.powerUpActive ?? false;
  const powerUpCooldown = currentPlayer?.powerUpCooldown ?? 0;
  const powerUpCooldownMax = currentPlayer?.powerUpCooldownMax ?? 15000;

  useEffect(() => {
    const isMobile = window.innerWidth <= 1024;
    if (isMobile) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.touchAction = 'none';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.touchAction = '';
    };
  }, []);

  useEffect(() => {
    const keys: { [key: string]: boolean } = {};
    if (Math.abs(mobileDirection.x) > 0.2 || Math.abs(mobileDirection.y) > 0.2) {
      if (mobileDirection.y < -0.2) keys['w'] = true;
      if (mobileDirection.y > 0.2) keys['s'] = true;
      if (mobileDirection.x < -0.2) keys['a'] = true;
      if (mobileDirection.x > 0.2) keys['d'] = true;
    }
    Object.keys(keys).forEach((key) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    });
    return () => {
      Object.keys(keys).forEach((key) => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key }));
      });
    };
  }, [mobileDirection]);

  useEffect(() => {
    if (mobilePowerUpPressed) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      setTimeout(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
        setMobilePowerUpPressed(false);
      }, 100);
    }
  }, [mobilePowerUpPressed]);

  useEffect(() => {
    if (gamePhase === 'ended') onGameEnd();
  }, [gamePhase, onGameEnd]);

  return (
    <main
      className="h-screen w-screen overflow-hidden relative touch-none"
      style={{ touchAction: 'none', background: '#14141f' }}
    >
      <LandscapePrompt />
      <NetStats />
      <GameHUD />
      <ConnectionStatus />
      <VoiceChat />
      <GameMenu />
      <div className="absolute inset-0 w-full h-full">
        <GameCanvas />
      </div>
      <AnimatePresence>
        {gamePhase === 'countdown' && (
          <motion.div
            key={`countdown-${countdownTimer}`}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-[65] flex items-center justify-center pointer-events-none"
          >
            <div className="px-panel px-6 py-4 sm:px-10 sm:py-6">
              <p className="px-heading text-3xl sm:text-5xl md:text-6xl" style={{ color: '#ffc93c', textShadow: '4px 4px 0 #11111c' }}>
                {countdownTimer > 0 ? countdownTimer : 'GO!'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <MobileControls
        onDirectionChange={setMobileDirection}
        onPowerUpPress={() => setMobilePowerUpPressed(true)}
        powerUpReady={powerUpReady}
        powerUpActive={powerUpActive}
        powerUpCooldown={powerUpCooldown}
        powerUpCooldownMax={powerUpCooldownMax}
      />
    </main>
  );
}

export default Game;
