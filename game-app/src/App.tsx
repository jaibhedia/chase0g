import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Game } from '@/components/Game';
import { SocketProvider } from '@/providers/SocketProvider';

// Prod default = '' → same-origin relative paths (the Next shell hosts this game on
// the same domain); dev default = the Next dev server. Override via VITE_LANDING_URL.
const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:3000');

export default function App() {
  const [ready, setReady] = useState(false);
  const { selectedCharacter, selectedMap } = useGameStore();

  useEffect(() => {
    // The Next shell hands off the config via the URL hash (works cross-origin in
    // dev where the shell is on :3000 and this game is on :5173). Fall back to
    // localStorage for the same-origin production build.
    const readConfig = (): any | null => {
      const m = window.location.hash.match(/[#&]config=([^&]+)/);
      if (m) {
        try {
          const cfg = JSON.parse(decodeURIComponent(m[1]));
          try { localStorage.setItem('chase-game-config', JSON.stringify(cfg)); } catch { /* ignore */ }
          // Config via the hash = a fresh launch from the menus (not a refresh), so
          // drop any old in-progress snapshot — this is a NEW game.
          try { localStorage.removeItem('chase-game-snapshot'); } catch { /* ignore */ }
          // Strip the hash so a manual refresh doesn't replay stale config.
          history.replaceState(null, '', window.location.pathname + window.location.search);
          return cfg;
        } catch { /* fall through */ }
      }
      const raw = localStorage.getItem('chase-game-config');
      if (raw) { try { return JSON.parse(raw); } catch { /* ignore */ } }
      return null;
    };

    const config = readConfig();
    if (!config) {
      window.location.href = LANDING_URL || '/';
      return;
    }
    useGameStore.setState({
      gameMode: config.gameMode,
      selectedCharacter: config.selectedCharacter,
      selectedMap: config.selectedMap,
      userId: config.userId,
      serverStartTime: config.serverStartTime ?? null,
      roomPlayers: config.roomPlayers ?? [],
      roomCode: config.roomCode ?? null,
      multiplayerHiddenFill: config.multiplayerHiddenFill ?? false,
    });
    setReady(true);
  }, []);

  if (!ready || !selectedCharacter || !selectedMap) return null;

  const handleGameEnd = () => {
    const { winner, players, gameMessage, replay } = useGameStore.getState();
    // Include the 0G Storage replay info in the handoff: localStorage is per-origin, so
    // in dev (game on :5173, results on :3000) the hash is the only channel that crosses.
    const result = JSON.stringify({ winner, players, gameMessage, replay });
    // Same cross-origin handoff as the inbound config: pass via URL hash, keep
    // localStorage as the same-origin fallback.
    try { localStorage.setItem('chase-game-result', result); } catch { /* ignore */ }
    window.location.href = `${LANDING_URL}/results#result=${encodeURIComponent(result)}`;
  };

  return (
    <SocketProvider>
      <Game onGameEnd={handleGameEnd} />
    </SocketProvider>
  );
}
