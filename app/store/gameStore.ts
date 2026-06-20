import { create } from 'zustand';

export type GameMode = 'single-player' | 'multiplayer';
export type GamePhase = 'countdown' | 'playing' | 'ended';
// NOTE: these must match the types the game-app engine handles in activatePowerUp
// (speed-boost / earthquake / shield / teleport). The selected character object is
// passed verbatim to the game-app, so a type it doesn't handle = a dead powerup.
export type PowerUpType = 'speed-boost' | 'earthquake' | 'shield' | 'teleport' | 'punch' | 'invisibility' | 'force-field';

export interface PowerUp {
  name: string;
  description: string;
  duration: number;
  cooldown: number;
  type: PowerUpType;
}

export type CharacterSpriteId = 'doux' | 'mort' | 'tard' | 'vita';

export interface Character {
  id: string;
  name: string;
  speed: number;
  color: string;
  image?: string;
  /** Which dino sprite sheet to use in-game. */
  spriteId: CharacterSpriteId;
  powerUp: PowerUp;
}

export interface GameMap {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
}

export interface Player {
  id: string;
  x: number;
  y: number;
  character: Character;
  isBot: boolean;
  /** True for the player currently holding the egg. At most one true at a time. */
  hasEgg: boolean;
  /** Cumulative ms this player has held the egg this round (HUD + tiebreaker). */
  eggHoldCount: number;
  /** Opaque per-session player ID (auto-generated guest token, persisted in localStorage). */
  userId?: string;
  targetX?: number;  // For bot AI movement
  targetY?: number;  // For bot AI movement
  powerUpReady?: boolean;
  powerUpActive?: boolean;
  powerUpCooldown?: number;
  isInvisible?: boolean;
  speedBoostActive?: boolean;
  trail?: Array<{ x: number; y: number; alpha: number }>;
}

export interface GameObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'furniture' | 'wall' | 'hiding-spot';
  color: string;
  propType?: string;
  isPushable?: boolean;
  vx?: number;
  vy?: number;
  mass?: number;
}

const USER_ID_STORAGE_KEY = 'chaseUserId';

function generateGuestId(): string {
  const rand = Math.random().toString(36).slice(2, 11);
  return `guest_${rand}`;
}

interface GameState {
  // Player setup
  userId: string | null;
  gameMode: GameMode | null;
  selectedCharacter: Character | null;
  selectedMap: GameMap | null;
  lockedCharacters: string[]; // Character IDs that are already taken

  // Game state
  gamePhase: GamePhase;
  players: Player[];
  gameObjects: GameObject[];
  timeRemaining: number;
  countdownTimer: number;

  // Egg state — one egg per round, on the ground OR carried by exactly one player.
  /** ID of the player currently holding the egg, or null while the egg sits on the floor. */
  eggOwnerId: string | null;
  /** World position of the egg while it's on the ground; null while a player carries it. */
  eggPosition: { x: number; y: number } | null;

  // Game results
  winner: Player | null;
  gameMessage: string;
  serverStartTime: number | null; // For multiplayer synchronization
  roomPlayers: any[]; // Players from multiplayer lobby
  roomCode: string | null; // Active multiplayer room (for reconnect/voice)
  /** Host waited alone; game runs as MP UI with local bots (no copy in UI). */
  multiplayerHiddenFill: boolean;

  // Actions
  setUserId: (id: string | null) => void;
  /** Load existing guest id from localStorage, or mint a new one. Idempotent. */
  initUserId: () => string;
  setGameMode: (mode: GameMode) => void;
  setCharacter: (character: Character) => void;
  setMap: (map: GameMap) => void;
  setGamePhase: (phase: GamePhase) => void;
  setPlayers: (players: Player[]) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  setGameObjects: (objects: GameObject[]) => void;
  setTimeRemaining: (time: number) => void;
  setCountdownTimer: (time: number) => void;
  setGameResult: (winner: Player | null, message: string) => void;
  setServerStartTime: (time: number | null) => void;
  setRoomPlayers: (players: any[]) => void;
  setRoomCode: (code: string | null) => void;
  setMultiplayerHiddenFill: (value: boolean) => void;
  setEgg: (ownerId: string | null, position: { x: number; y: number } | null) => void;
  lockCharacter: (characterId: string) => void;
  unlockCharacter: (characterId: string) => void;
  clearLockedCharacters: () => void;
  resetGame: () => void;
}

const initialState = {
  userId: null,
  gameMode: null,
  selectedCharacter: null,
  selectedMap: null,
  lockedCharacters: [] as string[],
  gamePhase: 'countdown' as GamePhase,
  players: [],
  gameObjects: [],
  timeRemaining: 120,
  countdownTimer: 3,
  eggOwnerId: null as string | null,
  eggPosition: null as { x: number; y: number } | null,
  winner: null,
  gameMessage: '',
  serverStartTime: null,
  roomPlayers: [],
  roomCode: null,
  multiplayerHiddenFill: false,
};

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,

  setUserId: (id) => set({ userId: id }),
  initUserId: () => {
    const existing = get().userId;
    if (existing) return existing;
    if (typeof window === 'undefined') return '';
    let id = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (!id) {
      id = generateGuestId();
      window.localStorage.setItem(USER_ID_STORAGE_KEY, id);
    }
    set({ userId: id });
    return id;
  },
  setGameMode: (mode) => set({ gameMode: mode }),
  setCharacter: (character) => set({ selectedCharacter: character }),
  setMap: (map) => set({ selectedMap: map }),
  setGamePhase: (phase) => set({ gamePhase: phase }),
  setPlayers: (players) => set({ players }),
  updatePlayer: (id, updates) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  setGameObjects: (objects) => set({ gameObjects: objects }),
  setTimeRemaining: (time) => set({ timeRemaining: time }),
  setCountdownTimer: (time) => set({ countdownTimer: time }),
  setGameResult: (winner, message) =>
    set({ winner, gameMessage: message, gamePhase: 'ended' }),
  setServerStartTime: (time) => set({ serverStartTime: time }),
  setRoomPlayers: (players) => set({ roomPlayers: players }),
  setRoomCode: (code) => set({ roomCode: code }),
  setMultiplayerHiddenFill: (value) => set({ multiplayerHiddenFill: value }),
  setEgg: (ownerId, position) => set({ eggOwnerId: ownerId, eggPosition: position }),
  lockCharacter: (characterId) =>
    set((state) => ({
      lockedCharacters: [...state.lockedCharacters, characterId],
    })),
  unlockCharacter: (characterId) =>
    set((state) => ({
      lockedCharacters: state.lockedCharacters.filter((id) => id !== characterId),
    })),
  clearLockedCharacters: () => set({ lockedCharacters: [] }),
  resetGame: () => set({ ...initialState, userId: get().userId }),
}));
