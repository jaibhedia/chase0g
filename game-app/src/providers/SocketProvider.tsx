import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/store/gameStore';
import { setGameSocket } from '@/lib/socketBridge';

/**
 * Where the socket server lives.
 *
 * This used to be `import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'` evaluated at
 * module scope — and Vite INLINES `import.meta.env.*` at build time. So unless
 * VITE_SOCKET_URL happened to be set in the shell that ran `npm run build:all`,
 * `localhost:3001` was compiled into the bundle permanently. The deploy then failed in the
 * worst possible way: the lobby works (the Next shell reads NEXT_PUBLIC_SOCKET_URL at
 * runtime), you press Play, and the game tries to open a WebSocket to localhost on the
 * *player's* machine. Nothing errors server-side; multiplayer is simply dead.
 *
 * The shell already hands this app a config blob at launch, so the URL now travels with it.
 * One source of truth — NEXT_PUBLIC_SOCKET_URL — and nothing about the socket endpoint is
 * frozen at build time. Resolved lazily inside the connect effect, by which point App has
 * loaded the config into the store.
 */
function resolveSocketUrl(): string {
  const fromShell = useGameStore.getState().socketUrl;
  if (fromShell) return fromShell;
  // Build-time override, for running the game standalone without the Next shell.
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL as string;
  return 'http://localhost:3001';
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface SocketContextType {
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
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
  setPlayerReady: (isReady: boolean) => void;
  startGame: () => void;
  sendGameState: (roomCode: string, gameState: any) => void;
  sendPlayerInput: (roomCode: string, playerId: string, position: any, velocity: any) => void;
  sendGameFinished: (roomCode: string, results: any) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  // Force a re-render once the socket instance exists so consumers get a live ref.
  const [, setReady] = useState(false);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(resolveSocketUrl(), {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 800,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        transports: ['websocket', 'polling'],
      });

      const socket = socketRef.current;
      setGameSocket(socket); // expose to the Phaser scene for in-game netcode

      // On every (re)connect, re-attach to our room so a refresh or a dropped
      // connection seamlessly restores the slot + in-progress match.
      const rejoinIfNeeded = () => {
        const { gameMode, roomCode, userId } = useGameStore.getState();
        if (gameMode === 'multiplayer' && roomCode && userId) {
          socket.emit('rejoin-room', { roomCode, userId });
        }
      };

      socket.on('connect', () => {
        console.log('✅ Connected to game server:', socket.id);
        setConnectionStatus('connected');
        rejoinIfNeeded();
      });

      socket.io.on('reconnect_attempt', () => setConnectionStatus('reconnecting'));
      socket.io.on('reconnect', () => setConnectionStatus('connected'));
      socket.io.on('error', () => setConnectionStatus('reconnecting'));

      socket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from game server:', reason);
        setConnectionStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
        if (reason === 'io server disconnect') {
          socket.connect();
        }
      });

      socket.on('connect_error', () => setConnectionStatus('reconnecting'));

      socket.on('rejoin-failed', ({ reason }: { reason: string }) => {
        console.warn('⚠️ Rejoin failed:', reason);
      });

      socket.on('error', (error: any) => {
        console.error('❌ Socket error:', error?.message || error);
      });

      setReady(true);
    }

    return () => {};
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
      if (!socketRef.current) { reject(new Error('Socket not connected')); return; }

      const timeout = setTimeout(() => {
        socketRef.current?.off('room-created');
        socketRef.current?.off('error');
        reject(new Error('Create room timeout'));
      }, 10000);

      socketRef.current.once('room-created', (response) => {
        clearTimeout(timeout);
        socketRef.current?.off('error');
        resolve(response);
      });

      socketRef.current.once('error', (error) => {
        clearTimeout(timeout);
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
      if (!socketRef.current) { reject(new Error('Socket not connected')); return; }

      const timeout = setTimeout(() => {
        socketRef.current?.off('room-joined');
        socketRef.current?.off('player-joined');
        socketRef.current?.off('error');
        reject(new Error('Join room timeout'));
      }, 10000);

      const handleSuccess = (response: any) => {
        clearTimeout(timeout);
        socketRef.current?.off('room-joined');
        socketRef.current?.off('player-joined');
        socketRef.current?.off('error');
        resolve(response);
      };

      socketRef.current.once('room-joined', handleSuccess);
      socketRef.current.once('player-joined', handleSuccess);

      socketRef.current.once('error', (error) => {
        clearTimeout(timeout);
        socketRef.current?.off('room-joined');
        socketRef.current?.off('player-joined');
        reject(error);
      });

      socketRef.current.emit('join-room', data);
    });
  };

  const setPlayerReady = (isReady: boolean) => {
    socketRef.current?.emit('set-ready', { isReady });
  };

  const startGame = () => {
    socketRef.current?.emit('start-game');
  };

  const sendGameState = (roomCode: string, gameState: any) => {
    socketRef.current?.emit('game-state-update', { roomCode, gameState });
  };

  const sendPlayerInput = (roomCode: string, playerId: string, position: any, velocity: any) => {
    socketRef.current?.emit('player-input', { roomCode, playerId, position, velocity });
  };

  const sendGameFinished = (roomCode: string, results: any) => {
    socketRef.current?.emit('game-finished', { roomCode, results });
  };

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      connectionStatus,
      createRoom,
      joinRoom,
      setPlayerReady,
      startGame,
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
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
}
