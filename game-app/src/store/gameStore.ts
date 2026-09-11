import { create } from 'zustand';

export type GameMode = 'single-player' | 'multiplayer';
export type GamePhase = 'countdown' | 'playing' | 'ended';
export type PowerUpType = 'speed-boost' | 'earthquake' | 'shield' | 'teleport';

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

/** Agent-brain intent produced by 0G Compute (mirrors server/src/agents/agentBrain.ts). */
export type AgentMode = 'hunt' | 'flee' | 'guard' | 'intercept' | 'roam';
export type AgentPersona = 'aggressive' | 'sneaky' | 'cocky' | 'cautious';
export interface AgentIntent {
  agentId: string;
  mode: AgentMode;
  targetId?: string;
  persona?: AgentPersona;
  taunt?: string;
}

/**
 * End-of-match settlement state: whether the pot has been paid and what it was.
 *
 * Still called ReplayInfo, and still delivered over `replay-stored`, because it used to
 * carry the 0G Storage replay hashes that have since been removed.
 */
export interface ReplayInfo {
  storing: boolean;
  done: boolean;
  /** Arc payout tx, pot size in USDC, explorer link. Null for an unstaked room. */
  arcTxHash: string | null;
  arcPot: string | null;
  arcExplorer: string | null;
}

/** One blip on the minimap. Fed from the scene at ~12Hz (throttled). */
export interface MinimapDot {
  x: number;
  y: number;
  color: string;
  kind: 'self' | 'agent' | 'human' | 'egg';
}

export interface Player {
  id: string;
  x: number;
  y: number;
  character: Character;
  isBot: boolean;
  hasEgg: boolean;
  eggHoldCount: number;
  userId?: string;
  targetX?: number;
  targetY?: number;
  /** High-level intent set by the 0G Compute agent brain; executed each frame by
   *  updateBots(). Absent → scripted fallback (0G offline). */
  aiIntent?: AgentIntent;
  persona?: AgentPersona;
  /** Latest taunt + when it arrived (ms), for the timed speech bubble. */
  taunt?: string;
  tauntAt?: number;
  powerUpReady?: boolean;
  powerUpActive?: boolean;
  powerUpCooldown?: number;
  /** Remaining active-effect time (ms), counted down by the dt-based update loop
   *  (NOT setTimeout) so it never gets stuck on pause or background-tab throttling. */
  powerUpActiveMs?: number;
  /** The cooldown value (ms) at the moment of activation — lets the HUD draw an
   *  accurate reload ring even though the reload time shortens late-game. */
  powerUpCooldownMax?: number;
  isInvincible?: boolean;
  slowedUntil?: number;
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
  userId: string | null;
  gameMode: GameMode | null;
  selectedCharacter: Character | null;
  selectedMap: GameMap | null;
  lockedCharacters: string[];
  gamePhase: GamePhase;
  players: Player[];
  gameObjects: GameObject[];
  timeRemaining: number;
  countdownTimer: number;
  eggOwnerId: string | null;
  eggPosition: { x: number; y: number } | null;
  lastEggHolderId: string | null;
  winner: Player | null;
  gameMessage: string;
  serverStartTime: number | null;
  roomPlayers: any[];
  roomCode: string | null;
  /** Socket server origin, handed over by the Next shell at launch. Null when the game
   *  is opened standalone, in which case SocketProvider falls back to VITE_SOCKET_URL
   *  and then localhost. Kept out of the bundle at build time on purpose — see
   *  resolveSocketUrl(). */
  socketUrl: string | null;
  multiplayerHiddenFill: boolean;
  /** In-game menu open → freeze the simulation. */
  paused: boolean;
  /** Live 0G Compute status for the HUD pill. `live` = brains are 0G-driven this
   *  tick; `source` distinguishes real inference vs cached vs scripted fallback. */
  ogStatus: { live: boolean; source: 'og' | 'cache' | 'fallback' };
  /** Throttled snapshot of world positions for the minimap (world dims + blips). */
  minimap: { w: number; h: number; dots: MinimapDot[] };
  /** 0G Storage replay state (Phase 2) for the results screen. */
  replay: ReplayInfo;

  setUserId: (id: string | null) => void;
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
  setPaused: (value: boolean) => void;
  setOgStatus: (status: { live: boolean; source: 'og' | 'cache' | 'fallback' }) => void;
  setMinimap: (minimap: { w: number; h: number; dots: MinimapDot[] }) => void;
  setReplay: (updates: Partial<ReplayInfo>) => void;
  setEgg: (ownerId: string | null, position: { x: number; y: number } | null) => void;
  setLastEggHolderId: (id: string | null) => void;
  lockCharacter: (characterId: string) => void;
  unlockCharacter: (characterId: string) => void;
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
  lastEggHolderId: null as string | null,
  winner: null,
  gameMessage: '',
  serverStartTime: null,
  roomPlayers: [],
  roomCode: null,
  socketUrl: null,
  multiplayerHiddenFill: false,
  paused: false,
  ogStatus: { live: false, source: 'fallback' as const },
  minimap: { w: 0, h: 0, dots: [] as MinimapDot[] },
  replay: { storing: false, done: false, arcTxHash: null, arcPot: null, arcExplorer: null } as ReplayInfo,
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
      players: state.players.map((p) => (p.id === id ? { ...p, ...updates } : p)),
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
  setPaused: (value) => set({ paused: value }),
  setOgStatus: (status) => set({ ogStatus: status }),
  setMinimap: (minimap) => set({ minimap }),
  setReplay: (updates) => set((state) => ({ replay: { ...state.replay, ...updates } })),
  setEgg: (ownerId, position) => set({ eggOwnerId: ownerId, eggPosition: position }),
  setLastEggHolderId: (id) => set({ lastEggHolderId: id }),
  lockCharacter: (characterId) =>
    set((state) => ({
      lockedCharacters: [...state.lockedCharacters, characterId],
    })),
  unlockCharacter: (characterId) =>
    set((state) => ({
      lockedCharacters: state.lockedCharacters.filter((id) => id !== characterId),
    })),
  resetGame: () => set({ ...initialState, userId: get().userId }),
}));
