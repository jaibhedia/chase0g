'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

// Prod default = the game bundled into this app's own /game-app/ (single-domain
// deploy); dev default = the standalone Vite server. Override via NEXT_PUBLIC_GAME_URL.
const GAME_URL =
  process.env.NEXT_PUBLIC_GAME_URL ||
  (process.env.NODE_ENV === 'production' ? '/game-app/index.html' : 'http://localhost:5173');

export default function GamePage() {
  const router = useRouter();
  const {
    gameMode,
    selectedCharacter,
    selectedMap,
    userId,
    initUserId,
    serverStartTime,
    roomPlayers,
    roomCode,
    multiplayerHiddenFill,
  } = useGameStore();

  useEffect(() => {
    if (!gameMode || !selectedCharacter || !selectedMap) {
      router.push('/');
      return;
    }
    // Multiplayer must wait for the server start time before launching the game.
    if (gameMode === 'multiplayer' && serverStartTime === null) return;

    const id = userId || initUserId();
    const serialized = JSON.stringify({
      gameMode,
      selectedCharacter,
      selectedMap,
      userId: id,
      serverStartTime: serverStartTime ?? null,
      roomPlayers: roomPlayers ?? [],
      roomCode: roomCode ?? null,
      multiplayerHiddenFill: multiplayerHiddenFill ?? false,
    });
    // localStorage only works same-origin; in dev the game runs on a different
    // origin (:5173), so also pass the config across via the URL hash. The game
    // reads the hash first and falls back to localStorage for same-origin prod.
    try { localStorage.setItem('chase-game-config', serialized); } catch { /* ignore */ }
    window.location.href = `${GAME_URL}#config=${encodeURIComponent(serialized)}`;
  }, [gameMode, selectedCharacter, selectedMap, serverStartTime]);

  return null;
}
