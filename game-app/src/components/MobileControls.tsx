import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { PowerUpHudCluster } from '@/components/PowerUpHudCluster';
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice';

interface MobileControlsProps {
  onDirectionChange: (direction: { x: number; y: number }) => void;
  onPowerUpPress: () => void;
  powerUpReady?: boolean;
  powerUpActive?: boolean;
  powerUpCooldown?: number;
  powerUpCooldownMax?: number;
}

export default function MobileControls({
  onDirectionChange,
  onPowerUpPress,
  powerUpReady = false,
  powerUpActive = false,
  powerUpCooldown = 0,
  powerUpCooldownMax,
}: MobileControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const [isTouching, setIsTouching] = useState(false);
  const touchIdRef = useRef<number | null>(null);
  // Shared detection — identical to GameHUD, so controls + HUD never disagree.
  const showControls = useIsTouchDevice();
  const selectedCharacter = useGameStore((s) => s.selectedCharacter);
  const cooldownMax = powerUpCooldownMax ?? selectedCharacter?.powerUp?.cooldown ?? 15000;
  const activeDuration = selectedCharacter?.powerUp?.duration ?? 3000;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (!joystickRef.current) return;

      const touch = Array.from(e.changedTouches).find(t => {
        const rect = joystickRef.current!.getBoundingClientRect();
        return (
          t.clientX >= rect.left &&
          t.clientX <= rect.right &&
          t.clientY >= rect.top &&
          t.clientY <= rect.bottom
        );
      });

      if (touch) {
        e.preventDefault();
        touchIdRef.current = touch.identifier;
        setIsTouching(true);
        handleTouchMove(e);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!joystickRef.current || touchIdRef.current === null) return;

      e.preventDefault();

      const touch = Array.from(e.touches).find(t => t.identifier === touchIdRef.current);
      if (!touch) return;

      const rect = joystickRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = touch.clientX - centerX;
      const deltaY = touch.clientY - centerY;

      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const maxDistance = 48;

      let x = deltaX;
      let y = deltaY;

      if (distance > maxDistance) {
        x = (deltaX / distance) * maxDistance;
        y = (deltaY / distance) * maxDistance;
      }

      setJoystickPosition({ x, y });
      onDirectionChange({ x: x / maxDistance, y: y / maxDistance });
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
      if (touch) {
        e.preventDefault();
        touchIdRef.current = null;
        setIsTouching(false);
        setJoystickPosition({ x: 0, y: 0 });
        onDirectionChange({ x: 0, y: 0 });
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onDirectionChange]);

  if (!showControls) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      {/* Power-up button — bottom-left, thumb-reachable, clear of the home indicator. */}
      <div
        className="absolute pointer-events-auto flex items-center"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
          left: 'calc(env(safe-area-inset-left, 0px) + 0.75rem)',
        }}
      >
        <PowerUpHudCluster
          powerUpReady={powerUpReady}
          powerUpActive={powerUpActive}
          powerUpCooldown={powerUpCooldown}
          cooldownMax={cooldownMax}
          activeDuration={activeDuration}
          onActivate={onPowerUpPress}
          size={72}
        />
      </div>

      {/* Twin-stick style joystick — pixel-themed (sharp corners per brand, no blur/gradient).
          Responsive: smaller on phones, larger on tablets/iPads. */}
      <div
        className="absolute pointer-events-auto flex flex-col items-center gap-1.5"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
          right: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
        }}
      >
        <div
          ref={joystickRef}
          className="relative w-32 h-32 sm:w-36 sm:h-36 md:w-44 md:h-44 overflow-hidden border-[3px] border-[#11111c] bg-[#1a160f] shadow-[0_4px_0_rgba(0,0,0,0.5),inset_0_0_22px_rgba(0,0,0,0.55)]"
        >
          {/* Recessed track frames */}
          <div className="absolute inset-2 border-2 border-[#4d2813]" />
          <div className="absolute inset-6 border border-[#4d2813]/60" />

          {/* Direction hints */}
          <div className="absolute inset-0 pointer-events-none text-[#f4e7c3]/80">
            <span className="absolute left-1/2 -translate-x-1/2 top-1 text-base leading-none">▲</span>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-1 text-base leading-none">▼</span>
            <span className="absolute top-1/2 -translate-y-1/2 left-1.5 text-base leading-none">◀</span>
            <span className="absolute top-1/2 -translate-y-1/2 right-1.5 text-base leading-none">▶</span>
          </div>

          {/* Thumb knob — solid sun fill (no gradient), 64px so the centering offset holds. */}
          <motion.div
            className="absolute left-1/2 top-1/2 w-16 h-16 border-[3px] border-[#11111c] flex items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.5)]"
            style={{
              x: joystickPosition.x - 32,
              y: joystickPosition.y - 32,
              background: '#ffc93c',
            }}
            animate={{ scale: isTouching ? 1.06 : 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <div className="w-5 h-5 bg-[#11111c]/30 border border-[#11111c]/50" />
          </motion.div>
        </div>
        <p className="px-heading text-[9px] tracking-widest uppercase text-[#f4e7c3]">Move</p>
      </div>
    </div>
  );
}
