import { AnimatePresence, motion } from 'framer-motion';
import { useSocket } from '@/providers/SocketProvider';
import { useGameStore } from '@/store/gameStore';

/**
 * Pro-game-style connection banner. While the socket is re-establishing after a
 * drop or refresh, a non-blocking "Reconnecting…" pill shows so the player knows
 * the game is recovering (their slot is held server-side for 30s).
 */
export default function ConnectionStatus() {
  const { connectionStatus } = useSocket();
  const gameMode = useGameStore((s) => s.gameMode);

  // Only meaningful for online play, and only when not happily connected.
  const show = gameMode === 'multiplayer' && connectionStatus !== 'connected';

  const label =
    connectionStatus === 'disconnected' ? 'Disconnected' : 'Reconnecting…';
  const color = connectionStatus === 'disconnected' ? '#e8503a' : '#ffc93c';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-20 left-0 right-0 z-[70] flex justify-center pointer-events-none"
        >
          <div className="flex items-center gap-2.5 px-panel px-4 py-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full animate-pulse"
              style={{ background: color }}
            />
            <span className="px-heading text-[10px] uppercase tracking-widest" style={{ color }}>
              {label}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
