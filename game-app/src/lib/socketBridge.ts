import type { Socket } from 'socket.io-client';

// Bridges the React-owned socket to the Phaser scene (which lives outside React),
// so the scene can wire multiplayer netcode without any mount/connect race.
let current: Socket | null = null;

export const setGameSocket = (s: Socket | null) => {
  current = s;
};

export const getGameSocket = (): Socket | null => current;
