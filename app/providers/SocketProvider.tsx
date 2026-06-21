'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

interface SocketContextType {
  socket: Socket | null;
  createRoom: (data: {
    userId: string;
    mapId: string;
    gameMode: 'single-player' | 'multiplayer';
    characterId: number;
    playerName?: string;
    isPublic?: boolean;
    maxPlayers?: number;
    gameTime?: number;
  }) => Promise<any>;
  joinRoom: (data: {
    roomCode: string;
    userId: string;
    characterId: number;
    playerName?: string;
  }) => Promise<any>;
  setPlayerReady: (isReady: boolean, roomCode?: string, userId?: string) => void;
  chooseCharacter: (characterId: number, playerName: string, roomCode: string, userId: string) => void;
  startGame: () => void;
  leaveRoom: () => void;
  sendGameState: (roomCode: string, gameState: any) => void;
  sendPlayerInput: (roomCode: string, playerId: string, position: any, velocity: any) => void;
  sendGameFinished: (roomCode: string, results: any) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  // Force a re-render once the socket instance exists so consumers (lobby, game)
  // receive the live ref instead of the initial null.
  const [, setSocketReady] = useState(false);

  useEffect(() => {
    // Only create socket once when provider mounts
    if (!socketRef.current) {
      console.log('🔌 Creating persistent socket connection to:', SOCKET_URL);
      
      socketRef.current = io(SOCKET_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling'],
      });

      const socket = socketRef.current;
      setSocketReady(true); // publish the live socket to consumers

      socket.on('connect', () => {
        console.log('✅ Connected to game server:', socket.id);
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from game server:', reason);
        // Auto-reconnect if disconnected
        if (reason === 'io server disconnect') {
          socket.connect();
        }
      });

      socket.on('error', (error: any) => {
        // "Room not found" / "Room full" are routine, user-recoverable outcomes that the
        // create/join flows already surface in the UI — don't spam the error console.
        const msg = error?.message || String(error);
        if (msg === 'Room not found' || msg === 'Room full') return;
        console.error('❌ Socket error:', msg);
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected after', attemptNumber, 'attempts');
      });

      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 Reconnection attempt', attemptNumber);
      });

      socket.on('reconnect_error', (error) => {
        console.error('❌ Reconnection error:', error?.message);
      });

      socket.on('reconnect_failed', () => {
        console.error('❌ Reconnection failed after max attempts');
      });
    }

    // NEVER disconnect - socket persists for entire app lifetime
    return () => {
      console.log('⚠️ SocketProvider unmounting - this should only happen on app exit');
      // Don't disconnect here either - let browser handle cleanup
    };
  }, []);

  const createRoom = (data: {
    userId: string;
    mapId: string;
    gameMode: 'single-player' | 'multiplayer';
    characterId: number;
    playerName?: string;
    isPublic?: boolean;
  }) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not connected'));
        return;
      }

      console.log('📤 Emitting create-room:', data);
      
      // Set a timeout in case backend doesn't respond
      const timeout = setTimeout(() => {
        console.log('⏰ Create room timeout - cleaning up listeners');
        socketRef.current?.off('room-created');
        socketRef.current?.off('error');
        reject(new Error('Create room timeout - no response from server'));
      }, 10000);

      socketRef.current.once('room-created', (response) => {
        clearTimeout(timeout);
        console.log('📥 Received room-created:', response);
        socketRef.current?.off('error');
        resolve(response);
      });

      socketRef.current.once('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ Room creation error:', error);
        socketRef.current?.off('room-created');
        reject(error);
      });

      socketRef.current.emit('create-room', data);
    });
  };

  const joinRoom = (data: {
    roomCode: string;
    userId: string;
    characterId: number;
    playerName?: string;
  }) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not connected'));
        return;
      }

      console.log('📤 Emitting join-room:', data);
      
      // Set a timeout in case backend doesn't respond
      const timeout = setTimeout(() => {
        console.log('⏰ Join room timeout - cleaning up listeners');
        socketRef.current?.off('room-joined');
        socketRef.current?.off('player-joined');
        socketRef.current?.off('error');
        reject(new Error('Join room timeout - no response from server'));
      }, 10000);

      // Listen for BOTH possible response events from backend
      const handleSuccess = (response: any) => {
        clearTimeout(timeout);
        console.log('📥 Received join response:', response);
        socketRef.current?.off('room-joined');
        socketRef.current?.off('player-joined');
        socketRef.current?.off('error');
        resolve(response);
      };

      socketRef.current.once('room-joined', handleSuccess);
      socketRef.current.once('player-joined', handleSuccess); // Fallback if backend sends this

      socketRef.current.once('error', (error) => {
        clearTimeout(timeout);
        socketRef.current?.off('room-joined');
        socketRef.current?.off('player-joined');
        reject(error); // the caller (lobby) surfaces this in the UI
      });

      socketRef.current.emit('join-room', data);
    });
  };

  const setPlayerReady = (isReady: boolean, roomCode?: string, userId?: string) => {
    // Send roomCode/userId so the server can resolve the player even if this socket
    // lost its server-side binding (e.g. after a lobby refresh/reconnect).
    socketRef.current?.emit('set-ready', { isReady, roomCode, userId });
  };

  // Claim a character in the lobby. The server validates uniqueness and broadcasts the
  // updated roster (or replies 'character-taken' if someone grabbed it first).
  const chooseCharacter = (characterId: number, playerName: string, roomCode: string, userId: string) => {
    socketRef.current?.emit('set-character', { characterId, playerName, roomCode, userId });
  };

  const startGame = () => {
    if (socketRef.current) {
      socketRef.current.emit('start-game');
    }
  };

  // Leave the current room WITHOUT disconnecting the persistent socket, so the user
  // can immediately create or join another room.
  const leaveRoom = () => {
    socketRef.current?.emit('leave-room');
  };

  const sendGameState = (roomCode: string, gameState: any) => {
    if (socketRef.current) {
      socketRef.current.emit('game-state-update', { roomCode, gameState });
    }
  };

  const sendPlayerInput = (roomCode: string, playerId: string, position: any, velocity: any) => {
    if (socketRef.current) {
      socketRef.current.emit('player-input', { 
        roomCode, 
        playerId, 
        position, 
        velocity 
      });
    }
  };

  const sendGameFinished = (roomCode: string, results: any) => {
    if (socketRef.current) {
      socketRef.current.emit('game-finished', { roomCode, results });
    }
  };

  return (
    <SocketContext.Provider value={{ 
      socket: socketRef.current,
      createRoom,
      joinRoom,
      setPlayerReady,
      chooseCharacter,
      startGame,
      leaveRoom,
      sendGameState,
      sendPlayerInput,
      sendGameFinished,
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
}
