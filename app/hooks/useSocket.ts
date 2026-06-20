'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

// Global socket instance - shared across all components
let globalSocket: Socket | null = null;

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // If socket already exists globally, reuse it
    if (globalSocket && globalSocket.connected) {
      console.log('♻️ Reusing existing socket connection:', globalSocket.id);
      setSocket(globalSocket);
      return;
    }

    // Create new socket connection only if none exists
    if (!globalSocket) {
      console.log('🔌 Creating new socket connection to:', SOCKET_URL);
      globalSocket = io(SOCKET_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling'],
      });

      globalSocket.on('connect', () => {
        console.log('✅ Connected to game server:', globalSocket?.id);
      });

      globalSocket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from game server:', reason);
      });

      globalSocket.on('error', (error: { message: string }) => {
        console.error('Socket error:', error.message);
      });

      setSocket(globalSocket);
    }

    // Don't disconnect on unmount - keep connection alive for navigation
    return () => {
      console.log('🔄 Component unmounting, keeping socket alive');
    };
  }, []);

  return socket;
}

// Cleanup function to manually disconnect (call on app exit, not page navigation)
export function disconnectSocket() {
  if (globalSocket) {
    console.log('🔌 Manually disconnecting socket');
    globalSocket.disconnect();
    globalSocket = null;
  }
}

// Helper hook for multiplayer game room
export function useGameRoom() {
  const socket = useSocket();

  const createRoom = (data: {
    userId: string;
    mapId: string;
    gameMode: 'single-player' | 'multiplayer';
    characterId: number;
    playerName?: string;
  }) => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit('create-room', data);

      socket.once('room-created', (response) => {
        resolve(response);
      });

      socket.once('error', (error) => {
        reject(error);
      });
    });
  };

  const joinRoom = (data: {
    roomCode: string;
    userId: string;
    characterId: number;
    playerName?: string;
  }) => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit('join-room', data);

      socket.once('player-joined', (response) => {
        resolve(response);
      });

      socket.once('error', (error) => {
        reject(error);
      });
    });
  };

  const setPlayerReady = (roomCode: string, userId: string) => {
    if (socket) {
      socket.emit('player-ready', { roomCode, userId });
    }
  };

  const sendGameState = (roomCode: string, gameState: any) => {
    if (socket) {
      socket.emit('game-state-update', { roomCode, gameState });
    }
  };

  const sendPlayerInput = (roomCode: string, input: any) => {
    if (socket) {
      socket.emit('player-input', { roomCode, input });
    }
  };

  const sendGameFinished = (roomCode: string, results: any) => {
    if (socket) {
      socket.emit('game-finished', { roomCode, results });
    }
  };

  return {
    socket,
    createRoom,
    joinRoom,
    setPlayerReady,
    sendGameState,
    sendPlayerInput,
    sendGameFinished,
  };
}
