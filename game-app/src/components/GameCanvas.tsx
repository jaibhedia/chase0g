import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { initializeGame } from '@/scene/gameEngine';
import { useSocket } from '@/providers/SocketProvider';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { selectedMap, gameMode, serverStartTime, setPlayers } = useGameStore();
  const { socket } = useSocket();

  useEffect(() => {
    if (gameMode !== 'multiplayer' || !socket) return;

    const handleGameStateUpdate = ({ players: serverPlayers }: any) => {
      if (useGameStore.getState().multiplayerHiddenFill) return;
      if (serverPlayers && Array.isArray(serverPlayers)) {
        setPlayers(serverPlayers);
      }
    };

    const handlePlayerUpdate = ({ playerId, position, state }: any) => {
      if (useGameStore.getState().multiplayerHiddenFill) return;
      const store = useGameStore.getState();
      store.updatePlayer(playerId, { ...position, ...state });
    };

    socket.on('game-state-update', handleGameStateUpdate);
    socket.on('player-update', handlePlayerUpdate);

    return () => {
      socket.off('game-state-update', handleGameStateUpdate);
      socket.off('player-update', handlePlayerUpdate);
    };
  }, [socket, gameMode, setPlayers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !selectedMap) return;
    if (gameMode === 'multiplayer' && !serverStartTime) return;

    let cleanupFn: (() => void) | undefined;
    let disposed = false;
    let initTimer: number | null = null;
    let rafId: number | null = null;

    const runInit = async () => {
      if (disposed) return;
      try {
        const cleanup =
          gameMode === 'multiplayer'
            ? await initializeGame(container, serverStartTime!)
            : await initializeGame(container);
        if (disposed) {
          cleanup?.();
          return;
        }
        cleanupFn = cleanup;
      } catch (err) {
        console.error('Failed to initialize Phaser game engine', err);
      }
    };

    const startWhenSized = (attempt = 0) => {
      if (disposed) return;
      if ((container.clientWidth > 0 && container.clientHeight > 0) || attempt >= 8) {
        runInit();
        return;
      }
      rafId = window.requestAnimationFrame(() => startWhenSized(attempt + 1));
    };

    initTimer = window.setTimeout(() => startWhenSized(), 120);

    return () => {
      disposed = true;
      if (initTimer !== null) window.clearTimeout(initTimer);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      cleanupFn?.();
    };
  }, [selectedMap, gameMode, serverStartTime]);

  return (
    <div className="w-full h-full relative" id="game-canvas-container">
      <div
        ref={containerRef}
        className="w-full h-full bg-gradient-to-br from-slate-950 to-violet-950 touch-none absolute inset-0 z-0"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
