import { AnimatePresence, motion } from 'framer-motion';
import { Play, RotateCcw, Users, Home } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';

// '' in prod → same-origin relative paths; the Next dev server in dev.
const LANDING = import.meta.env.VITE_LANDING_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:3000');

/**
 * In-game pause menu. It's shown whenever the store is `paused` (the HUD ☰ button
 * sets that), so opening the menu also freezes the simulation in gameScene.update().
 */
export default function GameMenu() {
  const paused = useGameStore((s) => s.paused);
  const setPaused = useGameStore((s) => s.setPaused);

  const clear = (keys: string[]) => { try { keys.forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } };

  const resume = () => setPaused(false);
  const restart = () => { clear(['chase-game-snapshot']); window.location.reload(); };
  const toLobby = () => { clear(['chase-game-snapshot', 'chase-game-config']); window.location.href = `${LANDING}/multiplayer-lobby`; };
  const toMenu = () => { clear(['chase-game-snapshot', 'chase-game-config']); window.location.href = LANDING || '/'; };

  const items: Array<{ label: string; icon: typeof Play; onClick: () => void; tone: string }> = [
    { label: 'Resume', icon: Play, onClick: resume, tone: '#6ab04c' },
    { label: 'Restart match', icon: RotateCcw, onClick: restart, tone: '#5fcde4' },
    { label: 'Lobby', icon: Users, onClick: toLobby, tone: '#ffc93c' },
    { label: 'Main menu', icon: Home, onClick: toMenu, tone: '#e8503a' },
  ];

  return (
    <AnimatePresence>
      {paused && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/55" onClick={resume} />
          <motion.div
            className="relative px-panel px-4 py-4 sm:px-8 sm:py-7 flex flex-col items-stretch gap-2 sm:gap-3 w-[min(82vw,320px)] max-h-[88dvh] overflow-y-auto"
            initial={{ scale: 0.85, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <p className="px-heading text-center text-base sm:text-2xl mb-0.5 sm:mb-1" style={{ color: '#ffc93c', textShadow: '3px 3px 0 #11111c' }}>
              PAUSED
            </p>
            {items.map(({ label, icon: Icon, onClick, tone }) => (
              <button
                key={label}
                onClick={onClick}
                className="px-chip flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 transition-all hover:brightness-110 active:translate-y-px"
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" style={{ color: tone }} />
                <span className="px-heading text-[10px] sm:text-xs uppercase tracking-wider text-[#f4e7c3]">{label}</span>
              </button>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
