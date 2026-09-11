import * as Phaser from 'phaser';
import { useGameStore, Player, GameObject, AgentIntent, MinimapDot } from '@/store/gameStore';
import { characters } from '@/data/characters';
import { audioManager } from '@/utils/audioManager';
import { PLAYER_SIZE, TAG_DISTANCE, TAG_COOLDOWN, GAME_DURATION, checkCollision, createMapObjects, findSafeSpawnPosition } from './gameShared';
import { getGameSocket } from '@/lib/socketBridge';

const CHAR_SPRITES: Record<string, { name: string }> = {
  doux: { name: 'doux' },
  mort: { name: 'mort' },
  tard: { name: 'tard' },
  vita: { name: 'vita' },
};

const SPRITE_SCALE = 4;
/** How often the client asks 0G Compute for fresh agent intents (slow tier). The
 *  LLM only sets strategy at this cadence; per-frame steering stays local. */
// 0G strategy cadence. Kept conservative to respect the testnet router rate limit —
// the local fast-tier steering reacts instantly between ticks, so the LLM only needs
// to refresh high-level strategy/taunts occasionally.
const AGENT_TICK_MS = 5000;
/** How long an overhead taunt bubble stays up after it arrives. */
const TAUNT_TTL_MS = 4000;
/** First power-up unlocks 15s into the match (matches the base reload cadence). */
const POWER_UP_UNLOCK_TIME_MS = 15000;
/** Bot move speed = character.speed * mult * dt (human baseline uses 120 px/s). */
/** Bot speed when carrying the egg — close to hunters so a holder can actually flee + juke. */
const BOT_SPEED_HOLDER = 110;
/** Bot speed when chasing the egg-holder (slightly faster than the holder, so they can close gaps). */
const BOT_SPEED_HUNTER = 118;
const CHASE_FLEE_RADIUS = 380;
const CHASE_FLEE_PUSH = 2.6;
/** Same-frame retake protection: after an egg transfer, the previous holder can't yank it back inside this window. */
const TAG_BACK_BLOCK_MS = 1000;
/** Slight speed penalty for the egg-holder so they can be caught without relying completely on power-ups. */
const EGG_HOLDER_SPEED_MULT = 0.95;
/** After grabbing/stealing the egg, the new holder is steal-proof for this long (keep-away grace). */
const EGG_GRACE_MS = 1800;
const TECH_ROOM_BG_KEY = 'tech_room_bg';
const TECH_TILE_SIZE = 32;
// Pixel-art source tiles are 16px; we render the world at 2x so each tile occupies a
// 32px world cell (TECH_TILE_SIZE), keeping collision / spawn / camera maths simple.
const SRC_TILE = 16;     // tile size in the source sheets
const WORLD_SCALE = 2;   // 16px art → 32px world cell
// ── FreeEnviro grassland pack (16px sheet). One spritesheet provides BOTH the grass
// ground tile (a tilemap frame) and the tree/bush/dirt art (named sub-rect frames).
const TS_ENVIRO = 'ts_enviro';
const GRASS_SRC_X = 80;       // grass fill cell on the sheet (col5,row1)
const GRASS_SRC_Y = 16;
const GRASS_FILL_KEY = 'grass_fill'; // standalone 16px grass texture for seamless tiling
// Multiplayer uses FIXED map dimensions (not screen-derived) so every client in a
// room builds an IDENTICAL forest — same bounds, same obstacle layout — instead of
// each player seeing a differently-sized map and a different random layout.
// Arena is 25% smaller on each axis than the original 240×160 so players cross paths
// faster and the egg changes hands more often.
const MP_MAP_COLS = 180;
const MP_MAP_ROWS = 120;
const SUMMER_SCENE_KEYS = [
  'summer_scene_1',
  'summer_scene_2',
  'summer_scene_3',
] as const;
const INFERNO_BG_1_KEY = 'inferno_bg_1';
const INFERNO_BG_2_KEY = 'inferno_bg_2';
const DUNGEON_DETAIL_TILE_KEY = 'dungeon_detail_tile';
const MAX_SIM_DELTA = 1 / 30;
const LOCAL_PLAYER_SPRITE_FOLLOW = 1;
const REMOTE_PLAYER_SPRITE_FOLLOW = 0.4;
/** Cap (ms) on how far a remote player is dead-reckoned past its last packet, so a
 *  player who suddenly stops barely drifts. ~3 packets at the 30Hz send rate. */
const REMOTE_EXTRAPOLATE_MS = 110;
const CAMERA_FOLLOW_LERP_X = 0.24;
const CAMERA_FOLLOW_LERP_Y = 0.24;
const CAMERA_MAX_LEAD_X = 40;
const CAMERA_MAX_LEAD_Y = 30;
/** Gentle follow zoom — keeps the player framed without hiding the arena. */
const CAMERA_ZOOM = 1.3;
/**
 * Map props. Each is a real sub-rect (source px) of a sheet, drawn as one image at
 * `scale` (default WORLD_SCALE), anchored to the art's bottom-centre — so tall art
 * (tree canopies) overhangs upward while only the base footprint blocks movement.
 */
interface PropFrame { tex: string; sx: number; sy: number; sw: number; sh: number; cw: number; ch: number; scale?: number; }
const PROP_FRAMES: Record<string, PropFrame> = {
  // ── FreeEnviro grassland props (sheet TS_ENVIRO). Rects = tight alpha bounding
  // boxes measured from the sheet. Trees/bushes block only at their base; the
  // plateau is a raised mound landmark. `scale` overrides WORLD_SCALE so canopies
  // read at reference proportions. Dirt patches + grass tufts are decals (drawn
  // directly by buildGrassland, never collide) — cw/ch unused for those.
  tree_a:     { tex: TS_ENVIRO, sx: 15,  sy: 94,  sw: 17, sh: 34, cw: 16, ch: 10, scale: 2.0 },
  tree_b:     { tex: TS_ENVIRO, sx: 48,  sy: 94,  sw: 16, sh: 34, cw: 16, ch: 10, scale: 2.0 },
  tree_c:     { tex: TS_ENVIRO, sx: 80,  sy: 94,  sw: 16, sh: 34, cw: 16, ch: 10, scale: 2.0 },
  bush_md:    { tex: TS_ENVIRO, sx: 128, sy: 32,  sw: 48, sh: 48, cw: 50, ch: 30, scale: 1.5 },
  bush_dk:    { tex: TS_ENVIRO, sx: 192, sy: 32,  sw: 48, sh: 48, cw: 50, ch: 30, scale: 1.5 },
  plateau:    { tex: TS_ENVIRO, sx: 16,  sy: 16,  sw: 48, sh: 64, cw: 80, ch: 48, scale: 1.6 },
  dirt_big:   { tex: TS_ENVIRO, sx: 4,   sy: 196, sw: 55, sh: 41, cw: 0,  ch: 0 },
  dirt_long:  { tex: TS_ENVIRO, sx: 13,  sy: 261, sw: 96, sh: 36, cw: 0,  ch: 0 },
  dirt_small: { tex: TS_ENVIRO, sx: 150, sy: 278, sw: 19, sh: 17, cw: 0,  ch: 0 },
  clover:     { tex: TS_ENVIRO, sx: 155, sy: 200, sw: 66, sh: 47, cw: 0,  ch: 0 },
  tuft_a:     { tex: TS_ENVIRO, sx: 83,  sy: 165, sw: 25, sh: 12, cw: 0,  ch: 0 },
  tuft_b:     { tex: TS_ENVIRO, sx: 208, sy: 118, sw: 16, sh: 9,  cw: 0,  ch: 0 },
};

export class GameScene extends Phaser.Scene {
  private mapWidth = 1600;
  private mapHeight = 1000;
  private mapId = 'map-1';
  private gameMode = 'single-player';
  private serverStartTime: number | null = null;
  /** Shared room code (multiplayer) — seeds the map so all clients build the same forest. */
  private roomCode: string | null = null;
  /** Online-multiplayer netcode state. */
  private localUserId?: string;
  private isOnlineMp = false;
  private netBound = false;
  private lastNetSend = 0;
  /** Last position/flags actually broadcast, so idle frames can be skipped instead
   *  of re-sending an identical packet 30×/s. A low-rate keepalive still fires so a
   *  late-joining/recovering peer always has a fresh snapshot to dead-reckon from. */
  private lastSent?: { x: number; y: number; vx: number; vy: number; hasEgg: boolean; isInvincible: boolean; t: number };
  /** Last network snapshot per remote player ('mp-<userId>') for velocity
   *  extrapolation — lets remote players glide smoothly between packets. */
  private remoteNet: Record<string, { x: number; y: number; vx: number; vy: number; t: number }> = {};
  private onRemoteInput?: (payload: any) => void;
  private onEggState?: (payload: any) => void;
  /** Online-MP agent-fill: this client is the single authority that STEERS the
   *  fill-agents and broadcasts their state. Computed deterministically (smallest
   *  human user_id) so every client agrees on exactly one driver — no double spend,
   *  no fighting over bot movement. Non-authority clients render them off the network. */
  private agentAuthority = false;
  private onAgentState?: (payload: any) => void;
  private lastAgentStateSend = 0;

  // Window-level input handlers (bound in create, removed on shutdown). Window-level
  // — not canvas-scoped — so movement keeps working even when a HUD button has focus.
  private onWinKeyDown?: (e: KeyboardEvent) => void;
  private onWinKeyUp?: (e: KeyboardEvent) => void;
  private onWinBlur?: () => void;
  private onWinVisibility?: () => void;

  // --- 0G Compute agent brains (slow tier) ---
  private agentNetBound = false;
  private lastAgentTick = 0;
  private onAgentIntents?: (payload: any) => void;
  /** Last-known 0G Compute status (pushed to the store for the HUD pill). */
  private ogEnabled = false;
  private ogSource: 'og' | 'cache' | 'fallback' = 'fallback';
  // --- Match-end settlement result (arrives over `replay-stored`) ---
  private replayNetBound = false;
  private onReplayStored?: (payload: any) => void;
  private replayRequested = false;
  /** Throttle for pushing minimap blips to the store (~12Hz). */
  private lastMinimap = 0;
  /** Overhead taunt speech bubbles, keyed by player id (behavior stays in the HUD panel). */
  private tauntBubbles: Record<string, Phaser.GameObjects.Text> = {};

  private gsPlayers: Player[] = [];
  private gsObjects: GameObject[] = [];
  private gsKeys: { [key: string]: boolean } = {};
  private lastTagTime = 0;
  /** New egg holder is steal-proof until this timestamp (keep-away grace). */
  private eggGraceUntil = 0;
  private tagBackBlock: { newChaserId: string; prevChaserId: string; until: number } | null = null;
  private gameStartTime = 0;
  private currentPhase: 'countdown' | 'playing' = 'countdown';
  private countdownTimer = 3;
  private gameTimer = GAME_DURATION;
  private phaseAccum = 0;
  /** Last whole-second of the server clock we snapshotted on (MP wall-clock path). */
  private lastClockSec = -1;
  /** Guards endGame() against being fired twice once the server clock hits zero. */
  private matchEnded = false;

  private playerSprites: { [id: string]: Phaser.GameObjects.Container } = {};
  private objSprites: { [id: string]: Phaser.GameObjects.Container } = {};
  /** Egg-on-the-ground visual; null while a player is carrying it. */
  private eggSprite: Phaser.GameObjects.Container | null = null;
  /** Edge-of-screen pointer toward the egg while it's off-camera. Created lazily. */
  private eggArrow: Phaser.GameObjects.Triangle | null = null;
  /** Last egg-tint state applied per sprite, so the per-frame draw can skip no-op writes. */
  private spriteTinted: Record<string, boolean> = {};
  private infernoSlowZones: Array<{ x: number; y: number; width: number; height: number }> = [];
  /** Interior room rects (tile coords) produced by the active map builder, used to
   *  scatter furniture/cover inside rooms without blocking doorways. */
  private mapRooms: Array<{ c0: number; r0: number; c1: number; r1: number; floor?: number }> = [];
  private mapDoorCells: Set<string> = new Set();
  private playerVelocity: Record<string, { vx: number; vy: number }> = {};
  private cameraTarget?: Phaser.GameObjects.Zone;
  private camTargetX = 0;
  private camTargetY = 0;
  private powerUpAuras: Record<string, Phaser.GameObjects.Arc> = {};
  /** Bot movement: detect stuck and recover (inferno collision is tight). */
  private botStuckAccum: Record<string, { x: number; y: number; t: number }> = {};

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Assets live under the Vite base URL (`/` in dev, `/game-app/` in the embedded
    // production build), so prefix every load with BASE_URL or they 404 in prod.
    const base = import.meta.env.BASE_URL;
    // FreeEnviro grassland sheet — grass ground tile + tree/bush/dirt art. This single
    // sheet is the ONLY map tileset; ground is a seamless TileSprite, props are sub-rect
    // frames drawn as scaled images.
    this.load.spritesheet(TS_ENVIRO, `${base}assets/maps/FreeEnviro_Sheet_16px.png`, {
      frameWidth: SRC_TILE, frameHeight: SRC_TILE,
    });
    for (const [id, cfg] of Object.entries(CHAR_SPRITES)) {
      this.load.spritesheet(`dino_${id}`, `${base}assets/characters/dino_${cfg.name}.png`, {
        frameWidth: 24,
        frameHeight: 24,
      });
    }
  }

  init(data: any) {
    this.mapId = data.mapId || 'map-1';
    this.mapWidth = data.mapWidth || 1600;
    this.mapHeight = data.mapHeight || 1000;
    this.gameMode = data.gameMode || 'single-player';
    this.serverStartTime = data.serverStartTime || null;
    this.roomCode = data.roomCode || null;
    this.localUserId = useGameStore.getState().userId || undefined;
    this.isOnlineMp = this.gameMode === 'multiplayer' && !useGameStore.getState().multiplayerHiddenFill;
    this.agentAuthority = this.computeAgentAuthority();
  }

  /**
   * Online-MP only: am I the one client that drives the fill-agents? Pick the
   * connected human with the smallest user_id — a deterministic choice every client
   * computes identically, so exactly one client steers the bots, emits the 0G
   * agent-tick (no duplicate inference spend), and broadcasts agent positions. If
   * the authority drops, the next-smallest naturally takes over on the next match.
   * Single-player / hidden-fill don't use this (they always own their own bots).
   */
  private computeAgentAuthority(): boolean {
    if (!this.isOnlineMp) return true;
    const roster = useGameStore.getState().roomPlayers || [];
    const ids = roster.map((p: any) => String(p.user_id)).filter(Boolean).sort();
    return ids.length === 0 || ids[0] === String(this.localUserId);
  }

  create() {
    const store = useGameStore.getState();
    const { selectedCharacter, setGamePhase, setPlayers, setGameObjects, setTimeRemaining, setCountdownTimer } = store;
    if (!selectedCharacter) return;

    this.gameStartTime = this.serverStartTime || Date.now();
    this.botStuckAccum = {};
    this.tagBackBlock = null;
    this.lastTagTime = 0;

    // Audio: load sounds (idempotent) + start the chase theme. Stop everything when
    // the scene tears down (leave / restart / navigate) so it doesn't bleed across.
    audioManager.init();
    audioManager.playTheme();
    this.events.once('shutdown', () => { audioManager.stopTheme(); audioManager.stopRunning(); });
    this.events.once('destroy', () => { audioManager.stopTheme(); audioManager.stopRunning(); });

    // Multiplayer: derive the phase + remaining time from the shared server clock so a
    // refresh/reconnect resumes the match where it is (skip the 3-2-1 if it already
    // started) instead of restarting at full time. Single-player always opens fresh.
    let startPhase: 'countdown' | 'playing' = 'countdown';
    let startCountdown = 3;
    let startTimer = GAME_DURATION;
    if (this.gameMode === 'multiplayer' && this.serverStartTime) {
      const elapsed = Math.floor((Date.now() - this.serverStartTime) / 1000);
      const afterCountdown = elapsed - 3; // 3s pre-game countdown
      if (afterCountdown >= 0) {
        startPhase = 'playing';
        startCountdown = 0;
        startTimer = Math.max(1, GAME_DURATION - afterCountdown);
      } else {
        startCountdown = Math.max(1, 3 - Math.max(0, elapsed));
      }
    }
    this.currentPhase = startPhase;
    this.countdownTimer = startCountdown;
    this.gameTimer = startTimer;
    setGamePhase(startPhase);
    setCountdownTimer(startCountdown);
    setTimeRemaining(startTimer);

    // All maps are the FreeEnviro grassland now. Multiplayer uses FIXED dimensions so
    // every client builds the SAME forest (identical bounds + obstacle layout);
    // single-player grows with the screen but stays a roomy clearing.
    const cols = this.gameMode === 'multiplayer'
      ? MP_MAP_COLS
      : Math.max(150, Math.ceil(this.scale.width / TECH_TILE_SIZE) + 6);
    const rows = this.gameMode === 'multiplayer'
      ? MP_MAP_ROWS
      : Math.max(98, Math.ceil(this.scale.height / TECH_TILE_SIZE) + 6);
    
    const borderThickness = 12;
    this.mapWidth = (cols - 2 * borderThickness) * TECH_TILE_SIZE;
    this.mapHeight = (rows - 2 * borderThickness) * TECH_TILE_SIZE;

    // Camera AND physics share the exact playable rect — the bush hedge IS the visible
    // edge, with no empty margin beyond it to wander/teleport into.
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.setBackgroundColor(0x5e8038); // grass green behind the tilemap

    // Builds the grass ground layer + dirt paths and returns every obstacle collider
    // (forest border, tree groves, bush clumps, plateau landmarks) with its propType.
    const objects = this.buildGrassland();
    this.registerAnimations();
    this.setDinoTextureFilter();
    this.registerPropFrames();
    this.gsObjects = objects;
    setGameObjects(objects);
    objects.forEach(obj => this.createObjSprite(obj));

    const players: Player[] = [];
    const humanUserId = store.userId || undefined;

    // Spawn players in a circle around the exact center of the map.
    const centerX = this.mapWidth / 2;
    const centerY = this.mapHeight / 2;
    const spawnRadius = 80;
    // Snap each ring position to the nearest open spot so nobody ever starts inside a
    // bush/tree. Deterministic (same obstacle layout + algorithm) so MP clients agree.
    const spawnAt = (angle: number) =>
      this.nearestFreePoint(centerX + Math.cos(angle) * spawnRadius, centerY + Math.sin(angle) * spawnRadius, objects);

    if (this.gameMode === 'multiplayer' && store.multiplayerHiddenFill) {
      const localSpawn = spawnAt(0);
      players.push({
        id: 'player',
        x: localSpawn.x,
        y: localSpawn.y,
        character: selectedCharacter,
        isBot: false,
        hasEgg: false,
        eggHoldCount: 0,
        userId: humanUserId,
        powerUpReady: false,
        powerUpActive: false,
        powerUpCooldown: 0,
        isInvincible: false,
        speedBoostActive: false,
      });
      const availChars = characters.filter((c) => c.id !== selectedCharacter.id);
      const shuffled = [...availChars].sort(() => Math.random() - 0.5);
      const botCount = Math.min(3, shuffled.length);
      for (let i = 0; i < botCount; i++) {
        const angle = ((i + 1) * Math.PI * 2) / (botCount + 1);
        const bp = spawnAt(angle);
        players.push({
          id: `bot-${i}`,
          x: bp.x,
          y: bp.y,
          character: shuffled[i],
          isBot: true,
          hasEgg: false,
          eggHoldCount: 0,
          userId: `guest_${(0xe700 + i).toString(16)}`,
          powerUpReady: false,
          powerUpActive: false,
          powerUpCooldown: 0,
          isInvincible: false,
          speedBoostActive: false,
        });
      }
    } else {
      // Deterministic spawn angles from the room roster so every client agrees on
      // where each player starts. Local user is 'player'; the rest are network-driven.
      const room = this.gameMode === 'multiplayer' ? (store.roomPlayers || []) : [];
      const ordered = [...room].sort((a: any, b: any) => String(a.user_id).localeCompare(String(b.user_id)));
      // Online-MP agent-fill: top up empty seats with 0G agents so a half-full room is
      // still a full match. Reserve ring slots for them up front so humans + agents all
      // get distinct, deterministic spawn points every client agrees on.
      const FILL_TARGET = 4;
      const fillCount = this.gameMode === 'multiplayer' ? Math.max(0, FILL_TARGET - ordered.length) : 0;
      const slots = Math.max(ordered.length + fillCount, 1);
      const angleAt = (i: number) => (i / slots) * Math.PI * 2;
      const localIdx = ordered.findIndex((rp: any) => rp.user_id === humanUserId);
      const la = angleAt(localIdx >= 0 ? localIdx : 0);

      const localSpawn = spawnAt(la);
      players.push({
        id: 'player', x: localSpawn.x, y: localSpawn.y, character: selectedCharacter,
        isBot: false, hasEgg: false, eggHoldCount: 0, userId: humanUserId,
        powerUpReady: false, powerUpActive: false, powerUpCooldown: 0, isInvincible: false, speedBoostActive: false
      });

      if (this.gameMode === 'single-player') {
        const availChars = characters.filter(c => c.id !== selectedCharacter.id);
        const botCount = Math.min(3, availChars.length);
        const shuffled = [...availChars].sort(() => Math.random() - 0.5);
        for (let i = 0; i < botCount; i++) {
          const angle = ((i + 1) * Math.PI * 2) / (botCount + 1);
          const bp = spawnAt(angle);
          players.push({
            id: `bot-${i}`, x: bp.x, y: bp.y, character: shuffled[i],
            isBot: true, hasEgg: false, eggHoldCount: 0,
            powerUpReady: false, powerUpActive: false, powerUpCooldown: 0, isInvincible: false, speedBoostActive: false
          });
        }
      } else {
        // Other humans in the room — driven by the network (player-input), not local AI.
        ordered.forEach((rp: any, i: number) => {
          if (rp.user_id === humanUserId) return;
          const a = angleAt(i);
          const remoteSpawn = spawnAt(a);
          const cid = Number(rp.character_id);
          const char = characters.find(c => Number(c.id.split('-')[1]) === cid) || characters[i % characters.length];
          players.push({
            id: `mp-${rp.user_id}`, x: remoteSpawn.x, y: remoteSpawn.y, character: char,
            isBot: false, hasEgg: false, eggHoldCount: 0, userId: rp.user_id,
            powerUpReady: false, powerUpActive: false, powerUpCooldown: 0, isInvincible: false, speedBoostActive: false
          });
        });

        // 0G fill-agents for the empty seats. Deterministic id/character/spawn on every
        // client; the authority steers them and broadcasts their state (see updateBots /
        // updateMultiplayerNet), non-authority clients render them off the network.
        if (fillCount > 0) {
          const usedCharNums = new Set(ordered.map((rp: any) => Number(rp.character_id)));
          const freeChars = characters
            .filter((c) => !usedCharNums.has(Number(c.id.split('-')[1])))
            .sort((a, b) => a.id.localeCompare(b.id));
          for (let i = 0; i < fillCount && i < freeChars.length; i++) {
            const bp = spawnAt(angleAt(ordered.length + i));
            players.push({
              id: `bot-${i}`, x: bp.x, y: bp.y, character: freeChars[i],
              isBot: true, hasEgg: false, eggHoldCount: 0, userId: `agent_${i}`,
              powerUpReady: false, powerUpActive: false, powerUpCooldown: 0, isInvincible: false, speedBoostActive: false
            });
          }
        }
      }
    }

    // Resume a single-player match in progress if a fresh snapshot exists (refresh
    // recovery). Otherwise: the egg spawns on the floor and the first player to
    // touch it picks it up — no "starting chaser".
    const restored = this.tryRestoreSnapshot(objects);
    const finalPlayers = restored ? restored.players : players;
    if (restored) {
      this.gameTimer = restored.gameTimer;
      this.currentPhase = 'playing';
      this.countdownTimer = 0;
      setCountdownTimer(0);
      setTimeRemaining(this.gameTimer);
      setGamePhase('playing');
      useGameStore.getState().setEgg(restored.eggOwnerId, restored.eggPosition);
      if (!restored.eggOwnerId && restored.eggPosition) this.spawnWorldEgg(restored.eggPosition.x, restored.eggPosition.y);
    } else {
      // Place the egg in the open centre of the map (snapped clear of any obstacle).
      const eggPt = this.nearestFreePoint(centerX, centerY, objects);
      store.setEgg(null, { x: eggPt.x, y: eggPt.y });
      this.spawnWorldEgg(eggPt.x, eggPt.y);
    }

    this.gsPlayers = finalPlayers;
    setPlayers(finalPlayers);
    finalPlayers.forEach(p => this.createPlayerSprite(p));

    // Save once a second + when the tab is hidden, so a refresh resumes here.
    this.registerSnapshotHooks();

    const humanSprite = this.playerSprites['player'];
    if (humanSprite) {
      this.cameraTarget = this.add.zone(humanSprite.x, humanSprite.y, 2, 2);
      this.camTargetX = humanSprite.x;
      this.camTargetY = humanSprite.y;
      this.cameras.main.startFollow(
        this.cameraTarget,
        true,
        CAMERA_FOLLOW_LERP_X,
        CAMERA_FOLLOW_LERP_Y
      );
      this.cameras.main.setDeadzone(28, 22);
      // Gentle follow zoom (1.3 max) — clamp down on small viewports so more of the map stays visible.
      const zoom = Math.min(CAMERA_ZOOM, Math.max(1.0, this.scale.width / 1100));
      this.cameras.main.setZoom(zoom);
      this.scale.on('resize', () => {
        const z = Math.min(CAMERA_ZOOM, Math.max(1.0, this.scale.width / 1100));
        this.cameras.main.setZoom(z);
      });
    }

    // Window-level key handling (not Phaser's canvas-scoped input): movement keeps
    // working even after clicking a HUD button, and we can clear keys on focus loss
    // so a missed keyup (Cmd+Tab on Mac, clicking away) can't leave a key "stuck"
    // and the dino drifting.
    const ARROWS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
    this.onWinKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (ARROWS.has(k)) e.preventDefault(); // arrows would scroll the page
      this.gsKeys[k] = true;
      if (k === ' ' && this.currentPhase === 'playing') {
        e.preventDefault(); // space would scroll / trigger a focused button
        const hp = this.gsPlayers.find((p) => p.id === 'player');
        if (hp && hp.powerUpReady && !hp.powerUpActive && !hp.powerUpCooldown) {
          this.activatePowerUp(hp);
        }
      }
    };
    this.onWinKeyUp = (e: KeyboardEvent) => {
      this.gsKeys[e.key.toLowerCase()] = false;
    };
    // Any focus/visibility loss → drop every held key so nothing sticks.
    this.onWinBlur = () => { this.gsKeys = {}; };
    this.onWinVisibility = () => { if (document.hidden) this.gsKeys = {}; };

    window.addEventListener('keydown', this.onWinKeyDown);
    window.addEventListener('keyup', this.onWinKeyUp);
    window.addEventListener('blur', this.onWinBlur);
    document.addEventListener('visibilitychange', this.onWinVisibility);

    this.events.once('shutdown', () => {
      if (this.onWinKeyDown) window.removeEventListener('keydown', this.onWinKeyDown);
      if (this.onWinKeyUp) window.removeEventListener('keyup', this.onWinKeyUp);
      if (this.onWinBlur) window.removeEventListener('blur', this.onWinBlur);
      if (this.onWinVisibility) document.removeEventListener('visibilitychange', this.onWinVisibility);
      this.onWinKeyDown = this.onWinKeyUp = undefined;
      this.onWinBlur = this.onWinVisibility = undefined;
    });
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, MAX_SIM_DELTA);
    const store = useGameStore.getState();
    this.syncPlayersFromStore();
    if (this.isOnlineMp) this.updateMultiplayerNet(_time);
    // Self-gates on the presence of local bots, so it runs in single-player and
    // hidden-fill but is a no-op in true online MP (which has no bots).
    this.updateAgentBrains(_time);
    this.updateMinimap(_time);
    this.updateEggArrow();

    // The in-game menu freezes the simulation; sprites below still render so the
    // frozen world stays visible behind the overlay.
    if (!store.paused) {
      // Multiplayer: drive the countdown + match timer from the SHARED server wall-clock,
      // not from accumulated (frame-rate-clamped) dt. Frame-rate-driven timing made any
      // client below 30 FPS run the whole match in slow-motion ("stuck in countdown") and
      // drift out of sync with the host. Wall-clock = real speed + identical on every client.
      if (this.gameMode === 'multiplayer' && this.serverStartTime != null) {
        this.advanceServerClock(store);
        if (this.matchEnded) return;
      } else {
        this.phaseAccum += dt;
        if (this.phaseAccum >= 1) {
          this.phaseAccum = 0;
          if (this.currentPhase === 'countdown') {
            this.countdownTimer--;
            store.setCountdownTimer(this.countdownTimer);
            if (this.countdownTimer <= 0) {
              this.currentPhase = 'playing';
              store.setGamePhase('playing');
            }
          } else if (this.currentPhase === 'playing') {
            this.gameTimer--;
            store.setTimeRemaining(this.gameTimer);
            if (this.gameTimer <= 0) {
              this.endGame();
              return;
            }
          }
          // Snapshot live state once a second so a refresh resumes mid-match.
          this.saveSnapshot();
        }
      }

      if (this.currentPhase === 'playing') {
        this.updateMovement(dt);
        this.updateBots(dt);
        this.updateTagging();
        this.updatePowerUps(dt);
        this.updateCameraLead(dt);
      } else {
        audioManager.stopRunning(); // not in play (countdown) — no footsteps
      }
    } else {
      audioManager.stopRunning(); // paused — silence footsteps
    }

    this.gsPlayers.forEach(p => {
      const sprite = this.playerSprites[p.id];
      if (!sprite) return;
      let tx = p.x;
      let ty = p.y;
      if (p.id !== 'player') {
        // Dead-reckon remote players along their last-known velocity so they glide
        // smoothly between 30Hz packets instead of stuttering toward each stale point.
        const net = this.remoteNet[p.id];
        if (net) {
          const age = Math.min((this.time.now - net.t) / 1000, REMOTE_EXTRAPOLATE_MS / 1000);
          tx = net.x + net.vx * age;
          ty = net.y + net.vy * age;
        }
      }
      const follow = p.id === 'player' ? LOCAL_PLAYER_SPRITE_FOLLOW : REMOTE_PLAYER_SPRITE_FOLLOW;
      const nx = Phaser.Math.Linear(sprite.x, tx, follow);
      const ny = Phaser.Math.Linear(sprite.y, ty, follow);
      const dx = tx - sprite.x;
      const dy = ty - sprite.y;
      sprite.setPosition(nx, ny);
      sprite.setDepth(p.y);

      const spr = sprite.getAt(1) as Phaser.GameObjects.Sprite;
      if (!spr || spr.type !== 'Sprite') return;

      const moving = Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3;
      const sid = this.getSpriteId(p);

      if (dx > 0.25) spr.setFlipX(false);
      else if (dx < -0.25) spr.setFlipX(true);

      if (moving && !p.isInvincible) {
        spr.play(`run_${sid}_anim`, true);
      } else {
        spr.play(`idle_${sid}_anim`, true);
      }

      // Tint changes are cheap but not free, and `hasEgg` flips at most a handful of
      // times a round — so track the applied value rather than reasserting every frame.
      const wantTint = p.hasEgg;
      if (this.spriteTinted[p.id] !== wantTint) {
        if (wantTint) spr.setTint(0xfacc15);
        else spr.clearTint();
        this.spriteTinted[p.id] = wantTint;
      }

      // YOU: green, egg-holder: warm yellow, others: white.
      const isSelf = p.id === 'player';
      const markerColor = p.hasEgg ? 0xfacc15 : (isSelf ? 0x4ade80 : 0xffffff);
      /**
       * Only touch the text objects when something actually changed.
       *
       * Phaser's Text.setText and setColor both regenerate the object's texture — a
       * canvas redraw plus a GPU upload — and neither checks whether the value differs
       * first. These ran unconditionally for every player every frame, so six players at
       * 60fps cost more than a thousand texture rebuilds a second to redraw names that
       * change maybe twice a match. That is the stutter.
       *
       * setScale is cheap by comparison (no texture work), but it is guarded by the same
       * check for free.
       */
      const nameTag = sprite.getAt(2) as Phaser.GameObjects.Text;
      const marker = sprite.getAt(3) as Phaser.GameObjects.Text;
      const label = isSelf ? 'YOU' : p.character.name;
      const css = this.colorToCss(markerColor);
      if (nameTag) {
        if (nameTag.text !== label) nameTag.setText(label);
        if (nameTag.style.color !== css) nameTag.setColor(css);
        const s = isSelf ? 1.05 : 1;
        if (nameTag.scaleX !== s) nameTag.setScale(s);
      }
      if (marker) {
        if (marker.style.color !== css) marker.setColor(css);
        const s = isSelf || p.hasEgg ? 1.12 : 1;
        if (marker.scaleX !== s) marker.setScale(s);
      }

      const shadow = sprite.getAt(0) as Phaser.GameObjects.Ellipse;
      if (shadow) {
        const bob = moving ? Math.sin(this.time.now * 0.012) * 1.5 : 0;
        spr.y = -12 + bob;
      }

      sprite.setAlpha(p.isInvincible ? (p.id === 'player' ? 0.35 : 0) : 1);
    });

    this.gsObjects.forEach(obj => {
      const spr = this.objSprites[obj.id];
      if (spr) {
        spr.setPosition(obj.x + obj.width / 2, obj.y + obj.height / 2);
        spr.setDepth(obj.y + obj.height);
      }
    });

    this.renderAgentTaunts();
  }

  /** Overhead taunt bubbles above each agent (the agent's TACTIC lives in the HUD
   *  "0G Agents" panel; only the trash-talk is shown in-world, transiently, so it
   *  doesn't stack into a cluttered mess). */
  private renderAgentTaunts() {
    if (!this.gsPlayers.some((p) => p.isBot)) return;
    const nowT = Date.now();
    for (const p of this.gsPlayers) {
      if (!p.isBot) continue;
      const fresh = !!(p.taunt && p.tauntAt && nowT - p.tauntAt < TAUNT_TTL_MS);
      let bubble = this.tauntBubbles[p.id];
      if (!fresh) { bubble?.setVisible(false); continue; }
      if (!bubble) {
        bubble = this.add
          .text(0, 0, '', {
            fontFamily: 'monospace', fontSize: '12px', color: '#2b2410',
            backgroundColor: '#fde68a', padding: { x: 6, y: 3 }, align: 'center',
            wordWrap: { width: 150 },
          })
          .setOrigin(0.5, 1)
          .setDepth(100000);
        this.tauntBubbles[p.id] = bubble;
      }
      const age = nowT - (p.tauntAt as number);
      const fade = age > TAUNT_TTL_MS - 600 ? Math.max(0, (TAUNT_TTL_MS - age) / 600) : 1;
      bubble
        .setText(p.taunt as string)
        .setPosition(p.x, p.y - 74) // above the nametag so they don't overlap
        .setAlpha(fade)
        .setVisible(true);
    }
  }

  // ===================== MAP =====================

  private drawTechRoomBackground() {
    const source = this.textures.get(TECH_ROOM_BG_KEY).getSourceImage() as HTMLImageElement;
    const srcW = source?.width || 937;
    const srcH = source?.height || 835;

    const scale = this.mapHeight / srcH;
    const roomW = srcW * scale;
    const overlap = 140 * scale;
    const secondX = roomW - overlap;

    // Left section (authored room)
    this.add
      .image(0, 0, TECH_ROOM_BG_KEY)
      .setOrigin(0, 0)
      .setScale(scale)
      .setDepth(0);

    // Right section: mirrored continuation for visual variety without style break.
    this.add
      .image(secondX + roomW, 0, TECH_ROOM_BG_KEY)
      .setOrigin(1, 0)
      .setScale(scale)
      .setFlipX(true)
      .setDepth(0);

    // Blend seam so transition feels continuous.
    const seam = this.add.graphics().setDepth(1);
    seam.fillStyle(0x2f3f5d, 0.18);
    seam.fillRect(secondX - 28, 0, 56, this.mapHeight);
  }

  private drawSummerPlainsBackground() {
    const layout = this.getSummerSceneLayout();
    if (!layout || layout.length === 0) {
      this.drawFallbackBackground();
      return;
    }

    // Build a continuous summer path with integer positioning and tiny overlap.
    let x = 0;
    let idx = 0;
    while (x < this.mapWidth + 80) {
      const panel = layout[idx % layout.length];
      this.add
        .image(Math.floor(x), 0, panel.key)
        .setOrigin(0, 0)
        .setScale(panel.scale)
        .setDepth(0);

      // Slight overlap prevents any camera/background crack between panels.
      x += panel.width - panel.overlap;
      idx += 1;
    }

    const tint = this.add.graphics().setDepth(1);
    tint.fillStyle(0x102a12, 0.08);
    tint.fillRect(0, 0, this.mapWidth, this.mapHeight);
  }

  private getSummerSceneLayout(): Array<{ key: string; scale: number; width: number; overlap: number }> | null {
    const panels: Array<{
      key: string;
      scale: number;
      width: number;
      overlap: number;
    }> = [];

    SUMMER_SCENE_KEYS.forEach((key) => {
      const src = this.textures.get(key)?.getSourceImage() as HTMLImageElement | undefined;
      if (!src || !src.width || !src.height) return;
      const scale = this.mapHeight / src.height;
      const overlap = Math.max(8, Math.floor(this.mapHeight * 0.012));
      panels.push({
        key,
        scale,
        width: src.width * scale,
        overlap,
      });
    });

    return panels.length ? panels : null;
  }

  /**
   * Build the FreeEnviro grassland: a lush grass-tile ground crossed by organic dirt
   * paths + clearings, ringed by a dense forest border, with tree groves, bush clumps
   * and the occasional raised "plateau" landmark scattered between WIDE open lanes so
   * there's always a proper route to run and chase. Grass tufts + flower (clover)
   * patches add detail. Returns every obstacle collider (with its propType) for
   * createObjSprite; dirt/grass details are drawn here as non-colliding decals.
   */
  private buildGrassland(): GameObject[] {
    const cell = TECH_TILE_SIZE; // 32px world cell (one 16px tile @2x)
    const cols = Math.floor(this.mapWidth / cell);
    const rows = Math.floor(this.mapHeight / cell);
    this.infernoSlowZones = []; // the grassland has no slow zones

    // Seeded RNG so the forest regenerates IDENTICALLY on every load — this keeps
    // refresh-resume positions valid (a saved player can't land inside a tree that
    // only exists in a different random layout). In multiplayer we mix in the shared
    // room code so EVERY client in a room builds the exact same layout, while
    // different rooms still vary.
    let s = (cols * 73856093) ^ (rows * 19349663) ^ 0x9e3779b9;
    if (this.gameMode === 'multiplayer' && this.roomCode) {
      for (let i = 0; i < this.roomCode.length; i++) s = (Math.imul(s, 31) + this.roomCode.charCodeAt(i)) | 0;
    }
    const rng = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

    // 1) Lush grass ground — ONE seamless repeating TileSprite. (A tilemap of
    //    identical tiles shows hard grid-line seams at this zoom/scale, so we tile a
    //    single 16px grass texture instead — 16 is power-of-two so WebGL REPEAT is
    //    seam-free.) Crop the grass cell to its own texture to avoid atlas bleed.
    if (!this.textures.exists(GRASS_FILL_KEY)) {
      const src = this.textures.get(TS_ENVIRO).getSourceImage() as HTMLImageElement;
      const ct = this.textures.createCanvas(GRASS_FILL_KEY, SRC_TILE, SRC_TILE);
      if (ct) {
        ct.context.drawImage(src, GRASS_SRC_X, GRASS_SRC_Y, SRC_TILE, SRC_TILE, 0, 0, SRC_TILE, SRC_TILE);
        ct.refresh();
        ct.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    this.add.tileSprite(0, 0, this.mapWidth, this.mapHeight, GRASS_FILL_KEY)
      .setOrigin(0, 0)
      .setTileScale(WORLD_SCALE, WORLD_SCALE)
      .setDepth(-10);
    // Decals reference named sub-rect frames — make sure they exist before drawing.
    this.registerPropFrames();

    const objects: GameObject[] = [];
    const occupied = new Set<string>();
    const borderThickness = 12;

    // The build grid (cols×rows) tiles the playable area 1:1 (cols = mapWidth/cell), so
    // a cell maps straight to world px — NO border offset. (The old −borderThickness*cell
    // shift pushed the whole obstacle field ~384px off, so the cleared centre plaza no
    // longer lined up with where players + egg spawn → they landed in bushes.)
    const place = (type: string, c: number, r: number) => {
      let w = 36, h = 30;                                   // trees: snug trunk base
      if (type === 'plateau') { w = 72; h = 60; }
      else if (type.startsWith('bush')) { w = 56; h = 44; }
      const x = (c + 0.5) * cell;
      const y = (r + 0.5) * cell;
      objects.push({
        id: `prop-${objects.length}`,
        x, y, width: w, height: h, type: 'furniture', color: '#000', propType: type, isPushable: false
      });
    };

    // Non-colliding ground decal (dirt patch / grass tuft / flowers) — same 1:1 mapping
    // so it lines up with where players actually run.
    const decal = (name: string, c: number, r: number, depth: number, scale: number, alpha = 1) => {
      const x = (c + 0.5) * cell;
      const y = (r + 0.5) * cell;
      this.add.image(x, y, TS_ENVIRO, name).setOrigin(0.5).setScale(scale).setDepth(depth).setAlpha(alpha);
    };

    const treeType = () => (['tree_a', 'tree_b', 'tree_c'] as const)[(rng() * 3) | 0];
    const bushType = () => (rng() > 0.5 ? 'bush_md' : 'bush_dk');

    const cc = Math.floor(cols / 2);
    const cr = Math.floor(rows / 2);

    // Mark cells as occupied (reserves a rect + 1-cell padding around it)
    const reserve = (c: number, r: number, wCells: number, hCells: number) => {
      for (let i = -1; i <= wCells; i++) {
        for (let j = -1; j <= hCells; j++) occupied.add(`${c + i},${r + j}`);
      }
    };
    const isOccupied = (c: number, r: number, wCells: number, hCells: number): boolean => {
      for (let i = -1; i <= wCells; i++) {
        for (let j = -1; j <= hCells; j++) if (occupied.has(`${c + i},${r + j}`)) return true;
      }
      return false;
    };

    // ── LAYER 1: Bush border — the map is surrounded by bushes on all 4 sides
    //    (a dense, impassable hedge ring covering the FULL edge, incl. the outermost
    //    cells, so the hedge is flush with the camera/physics boundary — no gaps).
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isBorder = r < borderThickness || r > rows - borderThickness - 1 ||
                         c < borderThickness || c > cols - borderThickness - 1;
        if (isBorder) {
          place(bushType(), c, r);
          occupied.add(`${c},${r}`);
        }
      }
    }

    // ── LAYER 2: Dirt crossroads through the centre + a spawn-plaza clearing ──
    // Wide overlapping dirt patches form continuous winding paths; trees drawn later
    // sit on top, so the dirt reads as a road threading between the groves.
    const iC0 = borderThickness, iC1 = cols - borderThickness;
    const iR0 = borderThickness, iR1 = rows - borderThickness;
    for (let c = iC0; c < iC1; c += 3) {
      decal(rng() > 0.5 ? 'dirt_long' : 'dirt_big', c, cr + Math.round(rng() * 2 - 1), -9, 2, 0.95);
    }
    for (let r = iR0; r < iR1; r += 3) {
      decal(rng() > 0.5 ? 'dirt_long' : 'dirt_big', cc + Math.round(rng() * 2 - 1), r, -9, 2, 0.95);
    }
    // Big open dirt clearing where players + egg spawn.
    decal('dirt_big', cc, cr, -9, 2.6, 1);
    decal('dirt_long', cc - 2, cr + 1, -9, 2, 0.95);
    decal('dirt_long', cc + 2, cr - 1, -9, 2, 0.95);

    // ── LAYER 3: Groves / bush clumps / plateau landmarks on a plot grid, with WIDE
    //    open lanes between them (proper chase routes). Centre stays clear for spawn.
    const ROAD = 6;          // open corridor width between plots (cells, ~192px)
    const PLOT = 7;          // plot size (cells)
    const PERIOD = ROAD + PLOT;
    const plazaRadius = 12;  // keep a roomy OPEN arena at the centre for spawns + egg
                             // (10 was too tight in MP — a grove edge reached the spawn ring)

    const fillGrove = (c0: number, r0: number, density: number) => {
      for (let dr = 0; dr < PLOT; dr++) {
        for (let dc = 0; dc < PLOT; dc++) {
          if (rng() > density) continue;
          const gc = c0 + dc, gr = r0 + dr;
          if (occupied.has(`${gc},${gr}`)) continue;
          place(rng() > 0.42 ? treeType() : bushType(), gc, gr);
          occupied.add(`${gc},${gr}`);
        }
      }
    };

    for (let r = borderThickness + ROAD; r + PLOT <= rows - borderThickness; r += PERIOD) {
      for (let c = borderThickness + ROAD; c + PLOT <= cols - borderThickness; c += PERIOD) {
        const pcc = c + PLOT / 2;
        const pcr = r + PLOT / 2;
        if (Math.hypot(pcc - cc, pcr - cr) < plazaRadius) continue; // spawn plaza

        const roll = rng();
        if (roll < 0.4) {
          // Dense tree/bush grove — cover to weave through during a chase.
          fillGrove(c, r, 0.5);
        } else if (roll < 0.62) {
          // Loose bush clump around a small clearing.
          for (let k = 0; k < 4; k++) {
            const bc = c + 1 + ((rng() * (PLOT - 2)) | 0);
            const br = r + 1 + ((rng() * (PLOT - 2)) | 0);
            if (!occupied.has(`${bc},${br}`)) { place(bushType(), bc, br); occupied.add(`${bc},${br}`); }
          }
        } else if (roll < 0.74) {
          // Plateau landmark with a tree accent in a corner.
          const hc = c + 2, hr = r + 2;
          if (!isOccupied(hc, hr, 3, 3)) { place('plateau', hc, hr); reserve(hc, hr, 3, 3); }
          if (!occupied.has(`${c},${r}`)) { place(treeType(), c, r); occupied.add(`${c},${r}`); }
        } else if (roll < 0.86) {
          // Open dirt clearing dotted with flowers — a breather / sightline.
          const mc = c + (PLOT >> 1), mr = r + (PLOT >> 1);
          decal(rng() > 0.5 ? 'dirt_big' : 'dirt_long', mc, mr, -9, 2, 0.95);
          decal('clover', mc, mr, -8, 1.6, 0.9);
        }
        // else: fully open courtyard — left empty for fast running.
      }
    }

    // ── LAYER 4: Scatter ground detail (grass tufts, flowers, pebbly dirt) ──
    const scatterN = Math.floor((cols * rows) / 50);
    for (let i = 0; i < scatterN; i++) {
      const c = borderThickness + ((rng() * (cols - 2 * borderThickness)) | 0);
      const r = borderThickness + ((rng() * (rows - 2 * borderThickness)) | 0);
      if (occupied.has(`${c},${r}`)) continue;
      const k = rng();
      if (k < 0.45) decal(rng() > 0.5 ? 'tuft_a' : 'tuft_b', c, r, -8, 2, 0.9);
      else if (k < 0.7) decal('clover', c, r, -8, 1.4, 0.8);
      else if (k < 0.85) decal('dirt_small', c, r, -9, 2, 0.9);
    }

    return objects;
  }

  // ===================== REFRESH-RESUME SNAPSHOT (single-player) =====================

  /** Only local single-player (incl. solo bot-fill) snapshots; online uses server rejoin. */
  private snapshotEligible(): boolean {
    return this.gameMode !== 'multiplayer' || useGameStore.getState().multiplayerHiddenFill;
  }

  private saveSnapshot() {
    const store = useGameStore.getState();
    // Skip while paused — the menu's Leave/Restart actions clear the snapshot just
    // before navigating, and the resulting pagehide must not re-write it.
    if (!this.snapshotEligible() || this.currentPhase !== 'playing' || store.paused) return;
    try {
      const snap = {
        v: 1, savedAt: Date.now(), mapId: this.mapId, gameMode: this.gameMode,
        userId: store.userId ?? null, gameTimer: this.gameTimer,
        eggOwnerId: store.eggOwnerId, eggPosition: store.eggPosition,
        players: this.gsPlayers.map((p) => ({
          id: p.id, x: Math.round(p.x), y: Math.round(p.y), characterId: p.character.id,
          isBot: p.isBot, hasEgg: !!p.hasEgg, eggHoldCount: p.eggHoldCount ?? 0, userId: p.userId ?? null,
          powerUpReady: !!p.powerUpReady, powerUpActive: !!p.powerUpActive, powerUpCooldown: p.powerUpCooldown ?? 0,
        })),
      };
      localStorage.setItem('chase-game-snapshot', JSON.stringify(snap));
    } catch { /* ignore quota / serialise errors */ }
  }

  private clearSnapshot() {
    try { localStorage.removeItem('chase-game-snapshot'); } catch { /* ignore */ }
  }

  private registerSnapshotHooks() {
    const onVis = () => { if (document.visibilityState === 'hidden') this.saveSnapshot(); };
    const onHide = () => this.saveSnapshot();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    });
  }

  /** Rebuild the players + egg + timer from a fresh snapshot, or null to start normally. */
  private tryRestoreSnapshot(objects: GameObject[]): { players: Player[]; gameTimer: number; eggOwnerId: string | null; eggPosition: { x: number; y: number } | null } | null {
    if (!this.snapshotEligible()) return null;
    let snap: any;
    try {
      const raw = localStorage.getItem('chase-game-snapshot');
      if (!raw) return null;
      snap = JSON.parse(raw);
    } catch { return null; }
    const store = useGameStore.getState();
    if (!snap || snap.v !== 1) return null;
    if (snap.mapId !== this.mapId || snap.gameMode !== this.gameMode) return null;
    if ((snap.userId ?? null) !== (store.userId ?? null)) return null;
    if (Date.now() - (snap.savedAt || 0) > 10 * 60 * 1000) return null;
    if (!Array.isArray(snap.players) || snap.players.length === 0) return null;
    if (typeof snap.gameTimer !== 'number' || snap.gameTimer <= 0) return null;

    const players: Player[] = [];
    for (const sp of snap.players) {
      const character = characters.find((c) => c.id === sp.characterId);
      if (!character) return null;
      let x = sp.x, y = sp.y;
      if (checkCollision(x, y, PLAYER_SIZE, objects, this.mapWidth, this.mapHeight)) {
        const free = this.nearestFreePoint(x, y, objects);
        x = free.x; y = free.y;
      }
      players.push({
        id: sp.id, x, y, character, isBot: !!sp.isBot, hasEgg: !!sp.hasEgg,
        eggHoldCount: sp.eggHoldCount ?? 0, userId: sp.userId ?? undefined,
        powerUpReady: !!sp.powerUpReady, powerUpActive: !!sp.powerUpActive,
        powerUpCooldown: sp.powerUpCooldown ?? 0, isInvincible: false, speedBoostActive: false,
      });
    }
    if (!players.some((p) => p.id === 'player')) return null;
    return { players, gameTimer: snap.gameTimer, eggOwnerId: snap.eggOwnerId ?? null, eggPosition: snap.eggPosition ?? null };
  }

  /** Closest collision-free point to (x,y); falls back to a safe spawn. */
  private nearestFreePoint(x: number, y: number, objects: GameObject[]): { x: number; y: number } {
    if (!checkCollision(x, y, PLAYER_SIZE, objects, this.mapWidth, this.mapHeight)) return { x, y };
    for (let r = 16; r <= 256; r += 16) {
      for (let a = 0; a < 8; a++) {
        const nx = x + Math.cos((a / 8) * Math.PI * 2) * r;
        const ny = y + Math.sin((a / 8) * Math.PI * 2) * r;
        if (!checkCollision(nx, ny, PLAYER_SIZE, objects, this.mapWidth, this.mapHeight)) return { x: nx, y: ny };
      }
    }
    return findSafeSpawnPosition(this.mapWidth, this.mapHeight, objects);
  }

  private drawFallbackBackground() {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x2f3f5d, 1);
    g.fillRect(0, 0, this.mapWidth, this.mapHeight);
  }

  private drawInfernoBackground() {
    const layout = this.getInfernoLayout();
    if (!layout) {
      this.drawFallbackBackground();
      return;
    }

    const { scale1, scale2, width1, width2, overlap } = layout;

    // Solid underfill so any sub-pixel gap never reads as a harsh black void.
    const under = this.add.graphics().setDepth(-2);
    under.fillStyle(0x231008, 1);
    under.fillRect(0, 0, this.mapWidth, this.mapHeight);

    let x = 0;
    let useFirst = true;
    let idx = 0;

    // Cover full world width (mapWidth matches stitch from computeInfernoStitchedRightEdge).
    while (x < this.mapWidth && idx < 80) {
      const key = useFirst ? INFERNO_BG_1_KEY : INFERNO_BG_2_KEY;
      const scale = useFirst ? scale1 : scale2;
      const panelWidth = useFirst ? width1 : width2;
      this.add
        .image(Math.floor(x), 0, key)
        .setOrigin(0, 0)
        .setScale(scale)
        .setDepth(0);

      if (idx > 0) {
        const seam = this.add.graphics().setDepth(1);
        seam.fillStyle(0x2a1308, 0.07);
        seam.fillRect(Math.floor(x - overlap), 0, Math.ceil(overlap) + 2, this.mapHeight);
      }

      x += panelWidth - overlap;
      useFirst = !useFirst;
      idx++;
    }

    const overlay = this.add.graphics().setDepth(1);
    overlay.fillStyle(0x2a1308, 0.06);
    overlay.fillRect(0, 0, this.mapWidth, this.mapHeight);
  }

  private getInfernoLayout(): {
    scale1: number;
    scale2: number;
    width1: number;
    width2: number;
    overlap: number;
  } | null {
    const src1 = this.textures.get(INFERNO_BG_1_KEY)?.getSourceImage() as HTMLImageElement | undefined;
    const src2 = this.textures.get(INFERNO_BG_2_KEY)?.getSourceImage() as HTMLImageElement | undefined;
    if (!src1 || !src2 || !src1.width || !src2.width || !src1.height || !src2.height) return null;
    const scale1 = this.mapHeight / src1.height;
    const scale2 = this.mapHeight / src2.height;
    const width1 = src1.width * scale1;
    const width2 = src2.width * scale2;
    // Keep overlap strong enough to prevent visible cracks between panels.
    const overlap = Math.max(22, this.mapHeight * 0.03);
    return { scale1, scale2, width1, width2, overlap };
  }

  /** Right edge of the stitched inferno strip until at least `minRight` is covered (same overlap as draw). */
  private computeInfernoStitchedRightEdge(minRight: number): number {
    const layout = this.getInfernoLayout();
    if (!layout) return minRight;
    const { width1, width2, overlap } = layout;
    let x = 0;
    let useFirst = true;
    let maxRight = 0;
    for (let i = 0; i < 64 && maxRight < minRight + 4; i++) {
      const pw = useFirst ? width1 : width2;
      maxRight = Math.max(maxRight, x + pw);
      x += pw - overlap;
      useFirst = !useFirst;
    }
    return maxRight;
  }

  private createInfernoCollisionObjects(): GameObject[] {
    this.infernoSlowZones = [];
    const layout = this.getInfernoLayout();
    if (!layout) return [];
    const { scale1, scale2, width1, width2, overlap } = layout;

    type Rect = { x: number; y: number; w: number; h: number };
    // Tuned to the lava_realm art: avoid full-bleed slabs that blocked the north path,
    // east bridge, southern neck, and bottom entrance on panel 2.
    const panel1Blockers: Rect[] = [
      { x: 0, y: 0, w: 340, h: 150 },
      { x: 684, y: 0, w: 340, h: 150 },
      { x: 0, y: 150, w: 240, h: 100 },
      { x: 784, y: 150, w: 240, h: 100 },
      { x: 0, y: 260, w: 110, h: 360 },
      { x: 914, y: 0, w: 110, h: 220 },
      { x: 914, y: 300, w: 110, h: 260 },
      { x: 914, y: 660, w: 110, h: 160 },
      { x: 0, y: 780, w: 340, h: 244 },
      { x: 684, y: 780, w: 340, h: 244 },
      { x: 0, y: 680, w: 180, h: 110 },
      { x: 844, y: 680, w: 180, h: 110 },
    ];
    const panel2Blockers: Rect[] = [
      { x: 0, y: 0, w: 340, h: 120 },
      { x: 684, y: 0, w: 340, h: 120 },
      { x: 0, y: 120, w: 100, h: 130 },
      { x: 924, y: 120, w: 100, h: 130 },
      { x: 0, y: 210, w: 95, h: 200 },
      { x: 929, y: 210, w: 95, h: 200 },
      { x: 0, y: 760, w: 360, h: 264 },
      { x: 664, y: 760, w: 360, h: 264 },
      { x: 0, y: 640, w: 120, h: 140 },
      { x: 904, y: 640, w: 120, h: 140 },
    ];
    const panel1Slow: Rect[] = [
      { x: 150, y: 220, w: 724, h: 70 },
      { x: 130, y: 740, w: 760, h: 70 },
      { x: 320, y: 500, w: 380, h: 80 },
    ];
    const panel2Slow: Rect[] = [
      { x: 140, y: 170, w: 744, h: 70 },
      { x: 140, y: 720, w: 744, h: 70 },
      { x: 350, y: 520, w: 320, h: 90 },
    ];

    const objects: GameObject[] = [];
    let xOffset = 0;
    let useFirst = true;
    let zoneIdx = 0;

    while (xOffset < this.mapWidth) {
      const scale = useFirst ? scale1 : scale2;
      const panelW = useFirst ? width1 : width2;
      const blockers = useFirst ? panel1Blockers : panel2Blockers;
      const slows = useFirst ? panel1Slow : panel2Slow;

      for (const z of blockers) {
        const inset = 8;
        const wx = xOffset + (z.x + inset) * scale;
        const wy = (z.y + inset) * scale;
        const ww = Math.max(12, (z.w - inset * 2) * scale);
        const wh = Math.max(12, (z.h - inset * 2) * scale);
        if (wx > this.mapWidth - 8 || wx + ww < 8) continue;
        objects.push({
          id: `inferno-block-${zoneIdx++}`,
          x: Math.max(0, wx),
          y: Math.max(0, wy),
          width: Math.min(ww, this.mapWidth - Math.max(0, wx)),
          height: Math.min(wh, this.mapHeight - Math.max(0, wy)),
          type: 'furniture',
          color: '#7c2d12',
          propType: 'vent',
          isPushable: false,
        });
      }

      for (const s of slows) {
        const wx = xOffset + s.x * scale;
        const wy = s.y * scale;
        const ww = s.w * scale;
        const wh = s.h * scale;
        if (wx > this.mapWidth - 8 || wx + ww < 8) continue;
        this.infernoSlowZones.push({
          x: Math.max(0, wx),
          y: Math.max(0, wy),
          width: Math.min(ww, this.mapWidth - Math.max(0, wx)),
          height: Math.min(wh, this.mapHeight - Math.max(0, wy)),
        });
      }

      xOffset += panelW - overlap;
      useFirst = !useFirst;
    }

    return objects;
  }

  /**
   * Build a procedural set of bushes / rocks / stumps spread across the
   * stitched summer map so map-2 stops reading as a flat painted background.
   * Seeded by mapWidth so the layout is deterministic across reloads.
   */
  private createSummerPlainsCollisionObjects(): GameObject[] {
    const objects: GameObject[] = [];
    const layout = this.getSummerSceneLayout();
    const stitched = layout
      ? layout.reduce((acc, p, idx) => acc + p.width - (idx === 0 ? 0 : p.overlap), 0)
      : this.mapWidth;
    const usableW = Math.max(this.mapWidth, stitched);
    const usableH = this.mapHeight;
    const margin = Math.max(80, usableH * 0.08);
    const playableTop = margin;
    const playableBottom = usableH - margin;
    const propTypes = ['bush', 'rock', 'stump', 'plant', 'bush', 'rock'] as const;

    // Deterministic pseudo-random sequence based on integer math, so the same
    // map width always yields the same prop layout (matters for multiplayer).
    let seed = Math.floor(usableW) ^ 0x9e3779b1;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed & 0xffff) / 0x10000;
    };

    const count = Math.max(7, Math.min(14, Math.floor(usableW / 220)));
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    let attempts = 0;
    while (objects.length < count && attempts < count * 30) {
      attempts++;
      const w = 64 + Math.floor(rand() * 56);   // 64..120 px wide
      const h = 56 + Math.floor(rand() * 52);   // 56..108 px tall
      const x = margin + rand() * Math.max(1, usableW - margin * 2 - w);
      const y = playableTop + rand() * Math.max(1, playableBottom - playableTop - h);
      const pad = 24;
      const overlapsExisting = placed.some(
        (r) => x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y
      );
      if (overlapsExisting) continue;
      placed.push({ x, y, w, h });
      const propType = propTypes[objects.length % propTypes.length];
      objects.push({
        id: `summer-prop-${objects.length}`,
        x,
        y,
        width: w,
        height: h,
        type: 'furniture',
        color: '#2a4a1f',
        propType,
        isPushable: false,
      });
    }
    return objects;
  }

  private isInInfernoSlowZone(x: number, y: number, size: number): boolean {
    if (this.mapId !== 'map-3' || this.infernoSlowZones.length === 0) return false;
    const half = size / 2;
    return this.infernoSlowZones.some((z) =>
      x + half > z.x &&
      x - half < z.x + z.width &&
      y + half > z.y &&
      y - half < z.y + z.height
    );
  }

  private createTechRoomCollisionObjects(): GameObject[] {
    const srcW = 937;
    const srcH = 835;
    const scale = this.mapHeight / srcH;
    const roomW = srcW * scale;
    const overlap = 140 * scale;
    const secondX = roomW - overlap;
    type Rect = { id: string; x: number; y: number; w: number; h: number; prop?: string };
    const rects: Rect[] = [
      // Top labs / consoles
      { id: 'tl_lab', x: 24, y: 34, w: 468, h: 182, prop: 'terminal' },
      { id: 'tr_lab', x: 671, y: 140, w: 232, h: 182, prop: 'terminal' },

      // Mid room tech stations
      { id: 'mid_console_a', x: 430, y: 250, w: 94, h: 78, prop: 'terminal' },
      { id: 'mid_console_b', x: 520, y: 250, w: 94, h: 78, prop: 'terminal' },
      { id: 'mid_console_c', x: 606, y: 250, w: 108, h: 96, prop: 'terminal' },
      { id: 'right_desk_a', x: 666, y: 392, w: 114, h: 94, prop: 'terminal' },
      { id: 'right_desk_b', x: 792, y: 392, w: 112, h: 94, prop: 'terminal' },
      { id: 'right_desk_c', x: 666, y: 544, w: 114, h: 92, prop: 'terminal' },
      { id: 'right_desk_d', x: 792, y: 544, w: 112, h: 92, prop: 'terminal' },

      // Reactor columns / tanks
      { id: 'tank_left_top', x: 242, y: 455, w: 84, h: 125, prop: 'server' },
      { id: 'tank_right_top', x: 444, y: 455, w: 84, h: 125, prop: 'server' },
      { id: 'tank_mid_bottom', x: 332, y: 585, w: 82, h: 117, prop: 'server' },

      // Lower barriers and gate region
      { id: 'bottom_gate_left', x: 205, y: 616, w: 120, h: 85, prop: 'vent' },
      { id: 'bottom_gate_right', x: 421, y: 616, w: 120, h: 85, prop: 'vent' },
      { id: 'bottom_entry_block', x: 614, y: 615, w: 300, h: 102, prop: 'vent' },
    ];

    const objects: GameObject[] = [];
    const sourceInset = 12; // shrink hitboxes so visible open floor is walkable
    for (const r of rects) {
      const insetX = Math.min(sourceInset, Math.max(2, r.w * 0.2));
      const insetY = Math.min(sourceInset, Math.max(2, r.h * 0.2));
      const adjX = r.x + insetX;
      const adjY = r.y + insetY;
      const adjW = Math.max(8, r.w - insetX * 2);
      const adjH = Math.max(8, r.h - insetY * 2);

      // Original room colliders
      objects.push({
        id: `${r.id}-a`,
        x: adjX * scale,
        y: adjY * scale,
        width: adjW * scale,
        height: adjH * scale,
        type: 'furniture',
        color: '#4a5568',
        propType: r.prop,
        isPushable: false,
      });

      // Mirrored continuation colliders
      const mirroredX = secondX + (srcW - (adjX + adjW)) * scale;
      if (mirroredX < this.mapWidth - 40) {
        objects.push({
          id: `${r.id}-b`,
          x: mirroredX,
          y: adjY * scale,
          width: adjW * scale,
          height: adjH * scale,
          type: 'furniture',
          color: '#4a5568',
          propType: r.prop,
          isPushable: false,
        });
      }
    }
    return objects;
  }

  // ===================== ANIMATIONS =====================

  private registerAnimations() {
    for (const id of Object.keys(CHAR_SPRITES)) {
      const idleKey = `idle_${id}_anim`;
      const runKey = `run_${id}_anim`;

      if (!this.anims.exists(idleKey)) {
        this.anims.create({
          key: idleKey,
          // DinoSprites sheet: idle frames 0..3
          frames: this.anims.generateFrameNumbers(`dino_${id}`, { start: 0, end: 3 }),
          frameRate: 8,
          repeat: -1,
        });
      }

      if (!this.anims.exists(runKey)) {
        this.anims.create({
          key: runKey,
          // DinoSprites sheet: run frames 4..9
          frames: this.anims.generateFrameNumbers(`dino_${id}`, { start: 4, end: 9 }),
          frameRate: 12,
          repeat: -1,
        });
      }
    }
  }

  private setDinoTextureFilter() {
    for (const id of Object.keys(CHAR_SPRITES)) {
      const tex = this.textures.get(`dino_${id}`);
      if (tex) {
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    // The grassland sheet (ground + props) — keep it crisp when scaled.
    const enviro = this.textures.get(TS_ENVIRO);
    if (enviro) enviro.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  /**
   * Register the exact sub-rect frame for every prop (see PROP_FRAMES) so each can
   * be drawn as one crisp image. Idempotent.
   */
  private registerPropFrames() {
    for (const [name, f] of Object.entries(PROP_FRAMES)) {
      const tex = this.textures.get(f.tex);
      if (!tex || tex.has(name)) continue;
      tex.add(name, 0, f.sx, f.sy, f.sw, f.sh);
    }
  }

  private findTechSpawnPosition(objects: GameObject[], existingPlayers: Player[]): { x: number; y: number } {
    const srcW = 937;
    const srcH = 835;
    const scale = this.mapHeight / srcH;
    const roomW = srcW * scale;
    const overlap = 140 * scale;
    const secondX = roomW - overlap;

    // Curated open-floor anchors (source-image coordinates -> world).
    const leftAnchors = [
      { x: 255, y: 340 },
      { x: 515, y: 365 },
      { x: 705, y: 430 },
      { x: 610, y: 520 },
      { x: 300, y: 545 },
      { x: 470, y: 690 },
    ];
    const anchors: Array<{ x: number; y: number }> = [];
    for (const a of leftAnchors) {
      anchors.push({ x: a.x * scale, y: a.y * scale });
      anchors.push({ x: secondX + (srcW - a.x) * scale, y: a.y * scale });
    }

    // Shuffle anchors for variety.
    const shuffled = [...anchors].sort(() => Math.random() - 0.5);
    for (const p of shuffled) {
      const blocked = checkCollision(p.x, p.y, PLAYER_SIZE, objects, this.mapWidth, this.mapHeight);
      if (blocked) continue;
      const tooClose = existingPlayers.some((ep) => Math.hypot(ep.x - p.x, ep.y - p.y) < 120);
      if (!tooClose) return p;
    }

    return findSafeSpawnPosition(this.mapWidth, this.mapHeight, objects, existingPlayers, 120);
  }

  /** Walkable-ish anchors across stitched inferno panels (for spawns + bot patrol). */
  private getInfernoFloorCandidatePoints(): { x: number; y: number }[] {
    const layout = this.getInfernoLayout();
    if (!layout) return [];
    const { scale1, scale2, width1, width2, overlap } = layout;
    const anchorsFirst = [
      { x: 512, y: 360 },
      { x: 512, y: 480 },
      { x: 400, y: 600 },
      { x: 620, y: 600 },
      { x: 512, y: 720 },
      { x: 512, y: 260 },
      { x: 512, y: 560 },
    ];
    const anchorsSecond = [
      { x: 512, y: 360 },
      { x: 512, y: 500 },
      { x: 360, y: 480 },
      { x: 664, y: 480 },
      { x: 512, y: 220 },
      { x: 512, y: 620 },
      { x: 512, y: 400 },
    ];
    const candidates: { x: number; y: number }[] = [];
    let xOff = 0;
    let useFirst = true;
    while (xOff < this.mapWidth) {
      const sc = useFirst ? scale1 : scale2;
      const anchors = useFirst ? anchorsFirst : anchorsSecond;
      for (const a of anchors) {
        candidates.push({ x: xOff + a.x * sc, y: a.y * sc });
      }
      xOff += (useFirst ? width1 : width2) - overlap;
      useFirst = !useFirst;
    }
    return candidates;
  }

  private findInfernoSpawnPosition(objects: GameObject[], existingPlayers: Player[]): { x: number; y: number } {
    // Inferno is now a plain floor-with-walls tilemap, so the generic safe-spawn
    // (which avoids wall colliders) is all we need; lava pools are walkable.
    return findSafeSpawnPosition(this.mapWidth, this.mapHeight, objects, existingPlayers, 100);
  }

  private getSpriteId(p: Player): string {
    const ch = characters.find(c => c.id === p.character.id);
    return ch?.spriteId ?? p.character.spriteId ?? 'doux';
  }

  private colorToCss(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  // ===================== SPRITES =====================

  private createObjSprite(obj: GameObject) {
    // Walls/edges are drawn by the tilemap layer itself — only props (objects with
    // an explicit propType mapped in PROP_FRAMES) get a real image drawn on top.
    if (!obj.propType) return;
    const f = PROP_FRAMES[obj.propType];
    if (!f) return;
    // Anchor the art's bottom-centre to the collider's bottom-centre and draw it at
    // WORLD_SCALE, so tall art (tree canopies, house roofs/eaves) overhangs upward
    // while only the base footprint blocks movement.
    const baseX = obj.x + obj.width / 2;
    const baseY = obj.y + obj.height;
    const container = this.add.container(baseX, baseY);
    const shadow = this.add.ellipse(0, -2, Math.max(obj.width * 0.85, 14), Math.max(obj.height * 0.45, 8), 0x000000, 0.18);
    const img = this.add.image(0, 0, f.tex, obj.propType).setOrigin(0.5, 1).setScale(f.scale ?? WORLD_SCALE);
    container.add([shadow, img]);
    container.setDepth(baseY);
    this.objSprites[obj.id] = container;
  }

  private createPlayerSprite(p: Player) {
    const container = this.add.container(p.x, p.y);
    const sid = this.getSpriteId(p);

    const shadow = this.add.ellipse(0, 22, 50, 16, 0x000000, 0.3);
    container.add(shadow);

    const spr = this.add.sprite(0, -16, `dino_${sid}`, 0);
    spr.setScale(SPRITE_SCALE);
    spr.play(`idle_${sid}_anim`, true);
    if (p.hasEgg) spr.setTint(0xfacc15);
    container.add(spr);

    const nameTag = this.add.text(0, -58, p.character.name, {
      fontSize: '13px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(nameTag);

    const marker = this.add.text(0, -74, '▼', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(marker);

    // Egg-holder badge: a little egg perched on the dino's head so everyone can see
    // who's carrying it at a glance. Added LAST (indices 4-6) so the per-frame draw
    // loop's getAt(0..3) lookups stay valid. The sprite is rebuilt on every egg
    // handoff (rebuildPlayerSprite), so this appears/disappears with the egg.
    if (p.hasEgg) {
      const eggShadow = this.add.ellipse(0, -39, 16, 6, 0x000000, 0.25);
      const eggBody = this.add.ellipse(0, -47, 14, 18, 0xfacc15).setStrokeStyle(2, 0x7a5b16, 1);
      const eggGlint = this.add.ellipse(-2.5, -51, 4, 6, 0xfffbeb, 0.7);
      container.add([eggShadow, eggBody, eggGlint]);
    }

    container.setDepth(p.y);
    this.playerSprites[p.id] = container;
  }

  private spawnWorldEgg(x: number, y: number) {
    this.destroyWorldEgg();
    const container = this.add.container(x, y);

    // Halo behind the egg, pulsing on its own timing.
    //
    // The egg is the entire objective and at 26x34 it read as scenery — people watching
    // the game could not tell what anyone was running toward. The halo is tweened
    // separately from the container's bob so the two rhythms don't lock into one motion,
    // which is what makes it catch the eye instead of looking like part of the sprite.
    const glow = this.add.ellipse(0, 0, 64, 64, 0xfacc15, 0.22);
    this.tweens.add({
      targets: glow,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0.05,
      duration: 900,
      ease: 'Sine.Out',
      yoyo: true,
      repeat: -1,
    });

    const shadow = this.add.ellipse(0, 14, 28, 10, 0x000000, 0.35);
    const egg = this.add.ellipse(0, 0, 30, 39, 0xfacc15);
    egg.setStrokeStyle(2, 0xfffbeb, 0.95);
    const highlight = this.add.ellipse(-4, -9, 9, 13, 0xfffbeb, 0.55);
    container.add([glow, shadow, egg, highlight]);
    container.setDepth(y + 50);
    this.tweens.add({
      targets: container,
      y: y - 4,
      duration: 600,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    });
    this.eggSprite = container;
  }

  /**
   * Arrow at the screen edge pointing to the egg while it's off-camera.
   *
   * The camera follows the player, so on a map bigger than the viewport the egg is
   * usually somewhere you can't see — leaving new players wandering until they happen
   * upon it. Fixed to the camera (scrollFactor 0) and clamped inside a margin so it
   * rides the edge rather than sliding off with the world.
   */
  private ensureEggArrow(): Phaser.GameObjects.Triangle {
    if (!this.eggArrow) {
      this.eggArrow = this.add
        .triangle(0, 0, 0, -12, 10, 8, -10, 8, 0xfacc15)
        .setStrokeStyle(2, 0x7a5b16, 1)
        .setScrollFactor(0)
        .setDepth(10_000)
        .setVisible(false);
    }
    return this.eggArrow;
  }

  private updateEggArrow() {
    const egg = this.eggSprite;
    const arrow = this.ensureEggArrow();
    // Nothing to point at while someone is carrying it — the holder badge does that job.
    if (!egg) { arrow.setVisible(false); return; }

    const cam = this.cameras.main;
    const view = cam.worldView;
    if (view.contains(egg.x, egg.y)) { arrow.setVisible(false); return; }

    const margin = 44;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    // Direction from the viewport centre to the egg, in screen space.
    const dx = egg.x - (view.x + view.width / 2);
    const dy = egg.y - (view.y + view.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const maxX = cx - margin;
    const maxY = cy - margin;
    // Scale the direction out to whichever edge it reaches first, so the arrow tracks
    // the true bearing instead of snapping to a corner.
    const scale = Math.min(maxX / Math.abs(dx / len), maxY / Math.abs(dy / len));

    arrow
      .setPosition(cx + (dx / len) * scale, cy + (dy / len) * scale)
      .setRotation(Math.atan2(dy, dx) + Math.PI / 2)
      .setVisible(true);
  }

  private destroyWorldEgg() {
    // Hide rather than destroy: the arrow is reused across every pickup and respawn in a
    // round, and killTweensOf on the container doesn't reach the halo's own tween, which
    // the container destroy below takes with it.
    this.eggArrow?.setVisible(false);
    if (this.eggSprite) {
      this.tweens.killTweensOf(this.eggSprite);
      this.eggSprite.each((child: Phaser.GameObjects.GameObject) => this.tweens.killTweensOf(child));
      this.eggSprite.destroy();
      this.eggSprite = null;
    }
  }

  private rebuildPlayerSprite(p: Player) {
    const old = this.playerSprites[p.id];
    if (old) old.destroy();
    // The new sprite starts untinted, so drop the cached tint state with it — otherwise
    // the draw loop believes the tint is already applied and the egg carrier silently
    // loses their gold highlight for the rest of the round.
    delete this.spriteTinted[p.id];
    this.createPlayerSprite(p);
  }

  // ===================== GAME LOGIC =====================

  private syncPlayersFromStore() {
    if (this.gameMode !== 'multiplayer') return;
    if (useGameStore.getState().multiplayerHiddenFill) return;
    const storePlayers = useGameStore.getState().players;
    if (!storePlayers || storePlayers.length === 0) return;

    const existingById = new Map(this.gsPlayers.map((p) => [p.id, p]));
    const synced: Player[] = [];

    for (const sp of storePlayers) {
      const existing = existingById.get(sp.id);
      if (existing) {
        // The SCENE is authoritative for every live gameplay field: the local player by
        // input, fill-agents by updateBots on the authority, and remote players/agents by
        // the network handlers — all of which write gsPlayers directly. The store is only a
        // downstream mirror for React. Never feed it back onto the scene, or its stale ~1Hz
        // values clobber live state (powerUpCooldown / powerUpActive / speedBoostActive /
        // isInvincible / x / y) — which is exactly what made MP controls + power-ups feel
        // laggy and "different" from single-player. Adopt ONLY the character (assigned by
        // the lobby, which the scene may not have yet); keep everything else live.
        if (sp.character) existing.character = sp.character;
        synced.push(existing);
      } else {
        const created: Player = {
          ...sp,
          character: sp.character || this.gsPlayers.find((p) => p.id === 'player')?.character || characters[0],
          eggHoldCount: sp.eggHoldCount ?? 0,
          powerUpReady: sp.powerUpReady ?? false,
          powerUpActive: sp.powerUpActive ?? false,
          powerUpCooldown: sp.powerUpCooldown ?? 0,
          isInvincible: sp.isInvincible ?? false,
          speedBoostActive: sp.speedBoostActive ?? false,
        };
        synced.push(created);
        this.createPlayerSprite(created);
      }
    }

    const syncedIds = new Set(synced.map((p) => p.id));
    Object.keys(this.playerSprites).forEach((id) => {
      if (!syncedIds.has(id)) {
        this.playerSprites[id].destroy();
        delete this.playerSprites[id];
        delete this.remoteNet[id];
        // Keep the tint cache in step with the sprites it describes, so a player who
        // leaves and rejoins doesn't inherit a stale entry.
        delete this.spriteTinted[id];
      }
    });

    this.gsPlayers = synced;
  }

  /**
   * Online-multiplayer position sync. Broadcasts the local player's position ~20Hz and
   * applies incoming positions to the matching 'mp-<userId>' player via the store, which
   * the render loop already smoothly interpolates. Listener is bound lazily once the
   * shared socket exists, and torn down on scene shutdown.
   */
  private updateMultiplayerNet(now: number) {
    const socket = getGameSocket();
    if (!socket) return;
    if (!this.netBound) {
      this.netBound = true;
      this.onRemoteInput = (payload: any) => {
        if (!payload || payload.userId == null || payload.userId === this.localUserId) return;
        const id = `mp-${payload.userId}`;
        // Snapshot position + velocity for the render loop's dead-reckoning.
        this.remoteNet[id] = {
          x: payload.x,
          y: payload.y,
          vx: typeof payload.vx === 'number' ? payload.vx : 0,
          vy: typeof payload.vy === 'number' ? payload.vy : 0,
          t: this.time.now,
        };
        // Position feeds the SCENE directly (render dead-reckons from remoteNet; game
        // logic reads gsPlayers) — never through the zustand store, which would re-render
        // React on every 30Hz packet (the choppiness/lag the non-host client suffered).
        const gp = this.gsPlayers.find((p) => p.id === id);
        if (gp) { gp.x = payload.x; gp.y = payload.y; }
        // Only DISCRETE state (egg/shield) goes to the store/React, and only on change.
        this.applyRemoteFlags(id, gp, payload.hasEgg, payload.isInvincible);
      };
      socket.on('player-input', this.onRemoteInput);
      // Egg ownership broadcast by whichever client became the new holder.
      this.onEggState = (payload: any) => {
        if (!payload) return;
        this.applyEggState(payload.ownerUserId ?? null, payload.x ?? 0, payload.y ?? 0);
      };
      socket.on('egg-state', this.onEggState);
      // Fill-agent positions, broadcast by the authority. Non-authority clients apply
      // them to the matching 'bot-<i>' (same dead-reckoning path as remote humans).
      this.onAgentState = (payload: any) => {
        if (!payload || !Array.isArray(payload.agents) || this.agentAuthority) return;
        for (const a of payload.agents) {
          if (!a || typeof a.id !== 'string') continue;
          this.remoteNet[a.id] = {
            x: a.x, y: a.y,
            vx: typeof a.vx === 'number' ? a.vx : 0,
            vy: typeof a.vy === 'number' ? a.vy : 0,
            t: this.time.now,
          };
          // Same as remote humans: position straight to the scene, store only on flag change.
          const gp = this.gsPlayers.find((p) => p.id === a.id);
          if (gp) { gp.x = a.x; gp.y = a.y; }
          this.applyRemoteFlags(a.id, gp, a.hasEgg, a.isInvincible);
        }
      };
      socket.on('agent-state', this.onAgentState);
      this.events.once('shutdown', () => {
        if (this.onRemoteInput) socket.off('player-input', this.onRemoteInput);
        if (this.onEggState) socket.off('egg-state', this.onEggState);
        if (this.onAgentState) socket.off('agent-state', this.onAgentState);
        this.onRemoteInput = undefined;
        this.onEggState = undefined;
        this.onAgentState = undefined;
        this.netBound = false;
      });
    }

    // Authority broadcasts the fill-agents' positions ~30Hz so other clients can render
    // them. Cheap (≤3 bots, volatile) and only one client per room ever sends it.
    if (this.agentAuthority && now - this.lastAgentStateSend >= 33) {
      const bots = this.gsPlayers.filter((p) => p.isBot);
      if (bots.length > 0 && this.roomCode) {
        this.lastAgentStateSend = now;
        socket.volatile.emit('agent-state', {
          roomCode: this.roomCode,
          agents: bots.map((b) => ({
            id: b.id,
            x: Math.round(b.x),
            y: Math.round(b.y),
            hasEgg: !!b.hasEgg,
            isInvincible: !!b.isInvincible,
          })),
        });
      }
    }
    if (now - this.lastNetSend >= 33) {
      this.lastNetSend = now;
      const me = this.gsPlayers.find((p) => p.id === 'player');
      if (me && this.roomCode && this.localUserId) {
        const vel = this.playerVelocity['player'] || { vx: 0, vy: 0 };
        const x = Math.round(me.x);
        const y = Math.round(me.y);
        const vx = Math.round(vel.vx);
        const vy = Math.round(vel.vy);
        const hasEgg = !!me.hasEgg;
        const isInvincible = !!me.isInvincible;

        // Skip identical idle frames: only broadcast when something a remote peer can
        // see has actually changed, or as a ~1Hz keepalive. A still player (vx/vy 0,
        // same position/flags) costs ~1 pkt/s instead of 30 — and since remotes only
        // dead-reckon along the LAST velocity, a stopped peer (vel 0) never drifts.
        const prev = this.lastSent;
        const moving = vx !== 0 || vy !== 0;
        const changed =
          !prev ||
          prev.x !== x || prev.y !== y ||
          prev.vx !== vx || prev.vy !== vy ||
          prev.hasEgg !== hasEgg || prev.isInvincible !== isInvincible;
        const keepalive = !prev || now - prev.t >= 1000;

        if (moving || changed || keepalive) {
          this.lastSent = { x, y, vx, vy, hasEgg, isInvincible, t: now };
          // volatile: a position packet is superseded by the next one, so if this
          // socket's buffer is backed up (slow/stalled peer) drop it rather than
          // queueing — prevents a rubber-band catch-up burst when it recovers.
          socket.volatile.emit('player-input', {
            roomCode: this.roomCode,
            userId: this.localUserId,
            x,
            y,
            // Velocity (px/s) lets remote clients dead-reckon between packets.
            vx,
            vy,
            hasEgg,
            isInvincible,
          });
        }
      }
    }
  }

  /**
   * Push only DISCRETE remote state (egg/shield) to the store → React, and only when it
   * actually flips. Positions never come through here (see onRemoteInput/onAgentState),
   * so a remote player moving no longer re-renders the React tree 30×/sec.
   */
  private applyRemoteFlags(id: string, gp: Player | undefined, hasEgg: unknown, isInvincible: unknown) {
    const patch: Partial<Player> = {};
    if (typeof hasEgg === 'boolean' && gp && gp.hasEgg !== hasEgg) patch.hasEgg = hasEgg;
    if (typeof isInvincible === 'boolean' && gp && gp.isInvincible !== isInvincible) patch.isInvincible = isInvincible;
    if (Object.keys(patch).length === 0) return;
    Object.assign(gp as Player, patch);
    useGameStore.getState().updatePlayer(id, patch);
  }

  /**
   * Multiplayer match clock, derived from the shared `serverStartTime` wall-clock so it
   * advances at REAL speed and reads identically on every client, independent of frame
   * rate. (The old phaseAccum/dt path slowed the whole match on any client under 30 FPS.)
   * Layout: first 3s = countdown, then GAME_DURATION seconds of play.
   */
  private advanceServerClock(store: ReturnType<typeof useGameStore.getState>) {
    const start = this.serverStartTime as number;
    const elapsed = (Date.now() - start) / 1000;

    // Snapshot ~once per second for refresh-resume (mirrors the single-player path).
    const sec = Math.floor(elapsed);
    if (sec !== this.lastClockSec) { this.lastClockSec = sec; this.saveSnapshot(); }

    if (elapsed < 3) {
      this.currentPhase = 'countdown';
      const cd = Math.max(1, Math.ceil(3 - elapsed));
      if (cd !== this.countdownTimer) { this.countdownTimer = cd; store.setCountdownTimer(cd); }
      return;
    }

    // Countdown just finished — flip to play exactly once.
    if (this.currentPhase === 'countdown') {
      this.currentPhase = 'playing';
      this.countdownTimer = 0;
      store.setCountdownTimer(0);
      store.setGamePhase('playing');
    }

    const remaining = Math.max(0, Math.ceil(GAME_DURATION - (elapsed - 3)));
    if (remaining !== this.gameTimer) { this.gameTimer = remaining; store.setTimeRemaining(remaining); }
    if (remaining <= 0 && !this.matchEnded) {
      this.matchEnded = true;
      this.endGame();
    }
  }

  /** Tell every other client in the room who now holds the egg (or where it dropped),
   *  so they hide/show the ground egg and retint players identically. */
  private broadcastEggState(ownerUserId: string | null, x = 0, y = 0) {
    const socket = getGameSocket();
    if (!socket || !this.roomCode) return;
    socket.emit('egg-state', { roomCode: this.roomCode, ownerUserId, x, y });
  }

  /** Apply a networked egg-ownership change: retint the holder, clear everyone else,
   *  and destroy/respawn the ground egg to match. */
  private applyEggState(ownerUserId: string | null, x: number, y: number) {
    const store = useGameStore.getState();
    // Resolve by userId so it works for humans ('player'/'mp-<id>') AND fill-agents
    // ('bot-<i>', whose userId is 'agent_<i>'). Fall back to the mp- convention.
    const holderId = ownerUserId == null
      ? null
      : (this.gsPlayers.find((p) => p.userId === ownerUserId)?.id
        ?? (ownerUserId === this.localUserId ? 'player' : `mp-${ownerUserId}`));
    for (const p of this.gsPlayers) {
      const should = p.id === holderId;
      if (!!p.hasEgg !== should) {
        p.hasEgg = should;
        if (should) p.eggHoldCount = (p.eggHoldCount || 0) + 1;
        store.updatePlayer(p.id, { hasEgg: should, eggHoldCount: p.eggHoldCount ?? 0 });
        this.rebuildPlayerSprite(p);
      }
    }
    if (holderId) {
      store.setEgg(holderId, null);
      store.setLastEggHolderId(holderId);
      this.destroyWorldEgg();
      this.eggGraceUntil = Date.now() + EGG_GRACE_MS;
    } else {
      store.setEgg(null, { x, y });
      this.spawnWorldEgg(x, y);
    }
  }

  /** The egg can legitimately sit on the floor with no one carrying it, so
   *  there is no "guarantee at least one holder" fallback. Method kept as a
   *  no-op for now since callers may still reference it. */
  private ensureChaserExists() {
    return;
  }

  private updateMovement(dt: number) {
    const human = this.gsPlayers.find(p => p.id === 'player');
    if (!human) return;
    const speedMul = human.speedBoostActive ? 2.5 : 1.0;
    const infernoMul = this.isInInfernoSlowZone(human.x, human.y, PLAYER_SIZE) ? 0.72 : 1;
    const eggMul = human.hasEgg ? EGG_HOLDER_SPEED_MULT : 1;
    const now = Date.now();
    const slowEffectMul = (human.slowedUntil && human.slowedUntil > now) ? 0.3 : 1.0;
    const speedPxPerSec = human.character.speed * 120 * speedMul * infernoMul * eggMul * slowEffectMul;
    let dirX = 0;
    let dirY = 0;

    if (this.gsKeys['w'] || this.gsKeys['arrowup']) dirY -= 1;
    if (this.gsKeys['s'] || this.gsKeys['arrowdown']) dirY += 1;
    if (this.gsKeys['a'] || this.gsKeys['arrowleft']) dirX -= 1;
    if (this.gsKeys['d'] || this.gsKeys['arrowright']) dirX += 1;

    const vel = this.playerVelocity[human.id] || { vx: 0, vy: 0 };
    const hasInput = dirX !== 0 || dirY !== 0;
    let targetVx = 0;
    let targetVy = 0;
    if (hasInput) {
      const len = Math.hypot(dirX, dirY) || 1;
      targetVx = (dirX / len) * speedPxPerSec;
      targetVy = (dirY / len) * speedPxPerSec;
    }

    // Snappier accel/decel so movement feels crisp at the zoomed-in scale.
    const accelBlend = 1 - Math.exp(-26 * dt);
    const dragBlend = 1 - Math.exp(-40 * dt); // Increased friction for stopping faster
    vel.vx = Phaser.Math.Linear(vel.vx, targetVx, hasInput ? accelBlend : dragBlend);
    vel.vy = Phaser.Math.Linear(vel.vy, targetVy, hasInput ? accelBlend : dragBlend);

    /**
     * Move in small steps, sliding along walls rather than stopping dead on them.
     *
     * This used to zero the whole axis on contact (`vel.vx = 0`). Brushing a wall while
     * holding a direction therefore reset that axis every single frame, so the velocity
     * lerp never built past its first step and the player crawled — until they released
     * the keys and let it re-accelerate from clean state. That is the "I'm suddenly
     * running slow and have to let go" bug, and it triggers on any diagonal along
     * geometry, which on a map this size is most of the map.
     *
     * A blocked axis now simply doesn't advance this step, leaving the other axis at
     * full speed: you slide along the wall instead of sticking to it. The per-step offset
     * is recomputed from the live velocity too — it was derived once before the loop, so
     * a mid-loop change had no effect until the next frame.
     */
    const moveX = vel.vx * dt;
    const moveY = vel.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(moveX), Math.abs(moveY)) / 8));
    for (let i = 0; i < steps; i++) {
      const sx = (vel.vx * dt) / steps;
      const sy = (vel.vy * dt) / steps;
      if (!this.getCollidingObject(human.x + sx, human.y, PLAYER_SIZE)) human.x += sx;
      if (!this.getCollidingObject(human.x, human.y + sy, PLAYER_SIZE)) human.y += sy;
    }
    this.playerVelocity[human.id] = vel;

    // Footsteps loop while the local player is actually moving.
    if (hasInput) audioManager.startRunning();
    else audioManager.stopRunning();
  }

  private updateCameraLead(dt: number) {
    const cam = this.cameras.main;
    const human = this.gsPlayers.find((p) => p.id === 'player');
    if (!human || !cam || !this.cameraTarget) return;

    const vel = this.playerVelocity[human.id] || { vx: 0, vy: 0 };
    const speed = Math.hypot(vel.vx, vel.vy);
    const dirX = speed > 1 ? vel.vx / speed : 0;
    const dirY = speed > 1 ? vel.vy / speed : 0;
    const desiredX = human.x + dirX * CAMERA_MAX_LEAD_X;
    const desiredY = human.y + dirY * CAMERA_MAX_LEAD_Y;
    const blend = 1 - Math.exp(-13 * dt);
    this.camTargetX = Phaser.Math.Linear(this.camTargetX, desiredX, blend);
    this.camTargetY = Phaser.Math.Linear(this.camTargetY, desiredY, blend);

    const halfW = cam.width / (2 * cam.zoom);
    const halfH = cam.height / (2 * cam.zoom);
    this.camTargetX = Phaser.Math.Clamp(this.camTargetX, halfW, this.mapWidth - halfW);
    this.camTargetY = Phaser.Math.Clamp(this.camTargetY, halfH, this.mapHeight - halfH);
    this.cameraTarget.setPosition(this.camTargetX, this.camTargetY);
  }

  private getCollidingObject(x: number, y: number, sz: number): GameObject | boolean | null {
    const m = 1;
    if (x - sz / 2 < m || x + sz / 2 > this.mapWidth - m || y - sz / 2 < m || y + sz / 2 > this.mapHeight - m) return true;
    for (const o of this.gsObjects) {
      if (o.type === 'furniture' && x + sz / 2 > o.x && x - sz / 2 < o.x + o.width && y + sz / 2 > o.y && y - sz / 2 < o.y + o.height) return o;
    }
    return null;
  }

  /**
   * The "slow tier" of the AI: every AGENT_TICK_MS we ship a compact world snapshot
   * to the server, which runs ONE 0G Compute inference and returns a high-level
   * intent per bot. We apply those intents onto gsPlayers; updateBots() executes
   * them each frame. Only the client that owns the bots (single-player / hidden-fill)
   * emits — true online MP has no bots, so this is a no-op there.
   */
  private updateAgentBrains(now: number) {
    if (!this.gsPlayers.some((p) => p.isBot)) return;
    const socket = getGameSocket();
    if (!socket) return;

    if (!this.agentNetBound) {
      this.agentNetBound = true;
      this.onAgentIntents = (payload: any) => {
        if (!payload) return;
        this.ogEnabled = !!payload.ogEnabled;
        this.ogSource = payload.source || 'fallback';
        // Surface to the React HUD (the canvas-overlay DOM pill is always visible,
        // unlike a Phaser fixed-text which the HUD draws over).
        useGameStore.getState().setOgStatus({
          live: this.ogEnabled && this.ogSource !== 'fallback',
          source: this.ogSource,
        });
        const intents: AgentIntent[] = Array.isArray(payload.intents) ? payload.intents : [];
        const byId = new Map(intents.map((it) => [it.agentId, it]));
        const store = useGameStore.getState();
        const tNow = Date.now();
        for (const p of this.gsPlayers) {
          if (!p.isBot) continue;
          const it = byId.get(p.id);
          if (!it) continue;
          p.aiIntent = it;
          if (it.persona) p.persona = it.persona;
          if (it.taunt) { p.taunt = it.taunt; p.tauntAt = tNow; }
          // Dual-write to the store so the HUD "0G Agents" panel reflects live state.
          store.updatePlayer(p.id, {
            aiIntent: it,
            ...(it.persona ? { persona: it.persona } : {}),
            ...(it.taunt ? { taunt: it.taunt, tauntAt: tNow } : {}),
          });
        }
      };
      socket.on('agent-intents', this.onAgentIntents);
      this.events.once('shutdown', () => {
        if (this.onAgentIntents) socket.off('agent-intents', this.onAgentIntents);
        this.onAgentIntents = undefined;
        this.agentNetBound = false;
        Object.values(this.tauntBubbles).forEach((b) => b.destroy());
        this.tauntBubbles = {};
      });
    }

    // The intents listener above is bound on EVERY client (so taunts + the 0G pill
    // show for all), but only the authority EMITS the tick — one inference per room,
    // no duplicate spend. In single-player/hidden-fill the authority is always us.
    if (this.isOnlineMp && !this.agentAuthority) return;

    const store = useGameStore.getState();
    const holder = this.gsPlayers.find((p) => p.hasEgg);
    // Steady cadence only. (An egg-handoff event-tick was tried but it blew past the
    // testnet rate limit; the local steering already reacts to handoffs instantly.)
    if (now - this.lastAgentTick >= AGENT_TICK_MS) {
      this.lastAgentTick = now;
      const eggPos = store.eggPosition;
      socket.emit('agent-tick', {
        roomCode: this.roomCode || `solo-${this.localUserId || 'anon'}`,
        map: { w: Math.round(this.mapWidth), h: Math.round(this.mapHeight) },
        egg: {
          x: Math.round(eggPos?.x ?? 0),
          y: Math.round(eggPos?.y ?? 0),
          holderId: holder ? holder.id : null,
        },
        players: this.gsPlayers.map((p) => ({
          id: p.id,
          kind: p.isBot ? 'agent' : 'human',
          x: Math.round(p.x),
          y: Math.round(p.y),
          hasEgg: !!p.hasEgg,
          ...(p.persona ? { persona: p.persona } : {}),
          // Lets the server resolve this human to their wallet, and from there to their
          // staking record in the subgraph, before it runs inference. The local player's
          // scene id is the literal string 'player', so userId is the only stable key
          // that survives the trip. Bots have none.
          ...(!p.isBot && (p.userId || (p.id === 'player' && this.localUserId))
            ? { userId: p.userId || this.localUserId }
            : {}),
        })),
      });
    }
  }

  /** Push a throttled snapshot of world positions to the store for the minimap.
   *  ~12Hz keeps the blips smooth without flooding React with re-renders. */
  private updateMinimap(now: number) {
    if (now - this.lastMinimap < 80) return;
    this.lastMinimap = now;
    const personaColor: Record<string, string> = {
      aggressive: '#f87171', sneaky: '#a78bfa', cocky: '#fb923c', cautious: '#5fcde4',
    };
    const dots: MinimapDot[] = this.gsPlayers.map((p) => ({
      x: p.x,
      y: p.y,
      // Egg carrier = gold; you = green; agents = persona-tinted; other humans = white.
      color: p.hasEgg ? '#facc15' : p.id === 'player' ? '#4ade80' : p.isBot ? (personaColor[p.persona ?? ''] ?? '#fbbf24') : '#ffffff',
      kind: p.id === 'player' ? 'self' : p.isBot ? 'agent' : 'human',
    }));
    const egg = useGameStore.getState().eggPosition;
    if (egg) dots.push({ x: egg.x, y: egg.y, color: '#facc15', kind: 'egg' });
    useGameStore.getState().setMinimap({ w: this.mapWidth, h: this.mapHeight, dots });
  }

  private updateBots(dt: number) {
    // In online MP only the agent-authority steers the fill-agents; everyone else
    // renders them off the broadcast (updateMultiplayerNet → agent-state). Single-
    // player / hidden-fill always own their bots (agentAuthority defaults true there).
    if (this.isOnlineMp && !this.agentAuthority) return;
    const eggHolder = this.gsPlayers.find(p => p.hasEgg);
    const eggPos = useGameStore.getState().eggPosition;
    this.gsPlayers.forEach(bot => {
      if (!bot.isBot) return;
      const speedMul = bot.speedBoostActive ? 2.5 : 1.0;
      const infernoMul = this.isInInfernoSlowZone(bot.x, bot.y, PLAYER_SIZE) ? 0.72 : 1;
      // Holder is slower (target); hunters are faster (so they can close the gap).
      const baseMult = bot.hasEgg ? BOT_SPEED_HOLDER : BOT_SPEED_HUNTER;
      const now = Date.now();
      const slowEffectMul = (bot.slowedUntil && bot.slowedUntil > now) ? 0.3 : 1.0;
      // Persona (set by 0G) gives each agent a distinct feel: an aggressive bot
      // visibly presses harder than a cautious one, so the brains read differently.
      const personaMul =
        bot.persona === 'aggressive' ? 1.14 :
        bot.persona === 'cocky' ? 1.06 :
        bot.persona === 'cautious' ? 0.9 : 1.0;
      const ramp = this.botRamp();
      const speed = bot.character.speed * baseMult * dt * speedMul * infernoMul * slowEffectMul * personaMul * ramp.speed;

      // Intent set by the 0G Compute agent brain (updateAgentBrains). When absent
      // (0G offline / not yet ticked) every branch below falls through to the
      // original scripted behavior — this is the criterion #01 on/off difference.
      const intent = bot.aiIntent;

      if (bot.hasEgg) {
        // Holding the egg ALWAYS means flee — a gameplay invariant, not the LLM's call.
        const threats = this.gsPlayers.filter(p => p.id !== bot.id && !p.isInvincible);
        if (threats.length > 0) {
          let nearest = threats[0];
          let minD = Math.hypot(bot.x - nearest.x, bot.y - nearest.y);
          for (const p of threats) {
            const d = Math.hypot(bot.x - p.x, bot.y - p.y);
            if (d < minD) { minD = d; nearest = p; }
          }
          const push = CHASE_FLEE_PUSH + (1 - Math.min(minD, CHASE_FLEE_RADIUS) / CHASE_FLEE_RADIUS) * 0.9;
          this.moveTowards(bot, bot.x + (bot.x - nearest.x) * push, bot.y + (bot.y - nearest.y) * push, speed);
        } else {
          this.wander(bot, speed);
        }
      } else if (intent && (intent.mode === 'hunt' || intent.mode === 'intercept')) {
        // The LLM picks the ROLE (hunt vs intercept); the TARGET is always whoever
        // CURRENTLY holds the egg, resolved live each frame. So a stale intent can
        // never make an agent chase someone who already lost the egg — instant
        // reactivity between the slower 0G strategy ticks.
        const target = eggHolder && !eggHolder.isInvincible ? eggHolder : undefined;
        if (target) {
          if (intent.mode === 'intercept') {
            // Commits hardest to the predicted point — this is the role that cuts you off.
            const aim = this.interceptPoint(bot, target, speed, ramp.lead);
            this.moveTowards(bot, aim.x, aim.y, speed);
          } else {
            // Hunt leads less, so a pack doesn't converge on one predicted point and
            // leave the target a clear lane behind them.
            const aim = this.interceptPoint(bot, target, speed, ramp.lead * 0.6);
            this.moveTowards(bot, aim.x, aim.y, speed);
          }
        } else if (eggPos) {
          this.moveTowards(bot, eggPos.x, eggPos.y, speed);
        } else {
          this.wander(bot, speed);
        }
      } else if (intent && intent.mode === 'guard' && eggPos) {
        // 0G brain: hold station near the loose egg / chokepoint, orbiting it.
        const gx = eggPos.x + Math.cos(this.time.now * 0.0006 + bot.x) * 90;
        const gy = eggPos.y + Math.sin(this.time.now * 0.0006 + bot.y) * 90;
        this.moveTowards(bot, gx, gy, speed * 0.85);
      } else if (eggHolder && !eggHolder.isInvincible) {
        // Fallback (roam / no 0G intent): converge on the holder. Leads like hunt does,
        // so a bot with no intent yet is merely less coordinated than one with a brain,
        // not visibly broken — this is the path every bot takes for the first few
        // seconds of a round, before the first strategy tick lands.
        const aim = this.interceptPoint(bot, eggHolder, speed, ramp.lead * 0.6);
        this.moveTowards(bot, aim.x, aim.y, speed);
      } else if (eggPos) {
        // Egg is on the floor — race for it.
        this.moveTowards(bot, eggPos.x, eggPos.y, speed);
      } else {
        this.wander(bot, speed);
      }

      // Holder leans more often on its power-up (defensive); hunters less so.
      const puChance = bot.hasEgg ? 0.014 : 0.009;
      if (bot.powerUpReady && !bot.powerUpActive && !bot.powerUpCooldown && Math.random() < puChance) {
        this.activatePowerUp(bot);
      }

      const st = this.botStuckAccum[bot.id] || { x: bot.x, y: bot.y, t: 0 };
      const movedBit = Math.hypot(bot.x - st.x, bot.y - st.y);
      if (movedBit < 1.8) st.t += dt;
      else {
        st.t = 0;
        st.x = bot.x;
        st.y = bot.y;
      }
      if (st.t > 2.1) {
        const others = this.gsPlayers.filter((p) => p.id !== bot.id);
        const rescue = findSafeSpawnPosition(this.mapWidth, this.mapHeight, this.gsObjects, others, 70);
        bot.x = rescue.x;
        bot.y = rescue.y;
        bot.targetX = undefined;
        bot.targetY = undefined;
        st.t = 0;
        st.x = bot.x;
        st.y = bot.y;
        useGameStore.getState().updatePlayer(bot.id, { x: bot.x, y: bot.y });
      } else if (st.t > 1.05) {
        this.tryBotSlideOutOfCorner(bot);
        st.t = 0.55;
        st.x = bot.x;
        st.y = bot.y;
      } else if (st.t > 0.42) {
        bot.targetX = undefined;
        bot.targetY = undefined;
      }
      this.botStuckAccum[bot.id] = st;
    });
  }

  private wander(bot: Player, speed: number) {
    const close = !bot.targetX || !bot.targetY || Math.hypot(bot.x - bot.targetX, bot.y - bot.targetY) < 42;
    if (close) {
      // Pick a random open point in the forest (retry a few times to dodge trees/bushes).
      let picked = false;
      for (let t = 0; t < 8 && !picked; t++) {
        const jx = Math.random() * (this.mapWidth - 120) + 60;
        const jy = Math.random() * (this.mapHeight - 120) + 60;
        if (!checkCollision(jx, jy, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          bot.targetX = jx; bot.targetY = jy; picked = true;
        }
      }
      if (!picked) {
        const fb = findSafeSpawnPosition(this.mapWidth, this.mapHeight, this.gsObjects, this.gsPlayers.filter((p) => p.id !== bot.id), 70);
        bot.targetX = fb.x; bot.targetY = fb.y;
      }
    }
    this.moveTowards(bot, bot.targetX!, bot.targetY!, speed);
  }

  /** Nudge bots away from tight corners (inferno furniture gaps). */
  private tryBotSlideOutOfCorner(bot: Player) {
    const step = 24;
    const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];
    for (const a of angles) {
      const nx = bot.x + Math.cos(a) * step;
      const ny = bot.y + Math.sin(a) * step;
      if (!checkCollision(nx, ny, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
        bot.x = nx;
        bot.y = ny;
        return;
      }
    }
  }

  /**
   * Proactive obstacle avoidance for bots: if the path straight ahead is blocked,
   * rotate the heading to the nearest open angle so the bot flows around walls and
   * through doorways instead of jamming. Returns a unit direction.
   */
  private steerAround(player: Player, ux: number, uy: number): { x: number; y: number } {
    const near = PLAYER_SIZE * 1.7, far = PLAYER_SIZE * 3.4;
    const clearAt = (dirx: number, diry: number, d: number) =>
      !checkCollision(player.x + dirx * d, player.y + diry * d, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight);
    // Straight ahead is clear all the way — go for it.
    if (clearAt(ux, uy, near) && clearAt(ux, uy, far)) return { x: ux, y: uy };
    const base = Math.atan2(uy, ux);
    // Scan from a small deflection outward to ~135°, nearest first. Prefer an angle
    // that is open BOTH near and far (a real lane / doorway); otherwise take the
    // first that at least clears the near step so the bot keeps flowing.
    const offsets = [0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.55, -1.55, 1.95, -1.95, 2.35, -2.35];
    let nearFallback: { x: number; y: number } | null = null;
    for (const off of offsets) {
      const a = base + off;
      const cx = Math.cos(a), cy = Math.sin(a);
      if (!clearAt(cx, cy, near)) continue;
      if (clearAt(cx, cy, far)) return { x: cx, y: cy };
      if (!nearFallback) nearFallback = { x: cx, y: cy };
    }
    return nearFallback ?? { x: ux, y: uy };
  }

  /**
   * Where to aim to cut a moving target off, instead of trailing it.
   *
   * Both chase branches used to aim at (or just past) where the target *is*. A pursuer
   * that always steers at the target's current position runs the same path the target
   * already ran and closes only on the speed difference — which is why the bots looked
   * stupid: with speeds this close, a fleeing player is never caught, and the bot visibly
   * swings in behind on every turn instead of cutting the corner.
   *
   * `playerVelocity` is per-FRAME displacement, same units as `speed`, so the frames
   * needed to close the gap is just distance / speed. Aiming at where the target will be
   * after that many frames is the standard interception solution.
   *
   * The cap matters: a slowed bot produces an enormous frame count, and extrapolating a
   * target's current heading that far predicts a position it will never visit. Past a
   * point, aiming at the target itself is the better guess.
   */
  /**
   * Bot competence over the course of a round: easy at the whistle, medium by the end.
   *
   * Fixing the interception maths made the bots genuinely competent, which is worse than
   * it sounds for a first-time player — being hunted accurately in the opening seconds,
   * before you know the controls or what the egg is for, reads as unfair rather than
   * hard, and that is where people quit.
   *
   * So the round opens soft and tightens. The ceiling is deliberately *medium*, not the
   * full-strength interception: a bot that always solves the intercept perfectly is
   * unbeatable rather than fun, and the top end here still leaves a competent player
   * room to juke. Early softness comes mostly from `lead` (bad prediction reads as a bot
   * that misjudges, which looks natural) rather than from speed, since an obviously slow
   * bot just looks broken.
   */
  private botRamp(): { speed: number; lead: number } {
    const progress = 1 - Math.max(0, Math.min(1, this.gameTimer / GAME_DURATION));
    const lerp = (a: number, b: number) => a + (b - a) * progress;
    return {
      speed: lerp(0.86, 1.0),
      lead: lerp(0.3, 0.85),
    };
  }

  private interceptPoint(bot: Player, target: Player, speed: number, strength = 1): { x: number; y: number } {
    if (speed <= 0.0001) return { x: target.x, y: target.y };
    const tv = this.playerVelocity[target.id] || { vx: 0, vy: 0 };
    const dist = Math.hypot(target.x - bot.x, target.y - bot.y);
    const frames = Math.min(dist / speed, 45) * strength;
    const ax = target.x + tv.vx * frames;
    const ay = target.y + tv.vy * frames;

    /**
     * Fan the pursuers out so they surround instead of stacking.
     *
     * Separation keeps bots from overlapping each other, but every one of them still
     * solved for the same aim point and took the same line to it. The result was the
     * dogpile: a ring forms on the egg holder, one bot snatches, everyone re-converges on
     * the new holder a few pixels away, and it loops in place looking broken.
     *
     * Each bot gets a stable lateral offset from its id, applied perpendicular to its
     * approach, so they arc in from different sides. The offset shrinks with distance and
     * reaches zero on contact — they spread out across the map and still close properly
     * for the tag, rather than orbiting forever.
     */
    const dx = ax - bot.x;
    const dy = ay - bot.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return { x: ax, y: ay };
    // Stable per-bot value in [-1, 1] — same bot always takes the same side.
    let h = 0;
    for (let i = 0; i < bot.id.length; i++) h = (h * 31 + bot.id.charCodeAt(i)) | 0;
    const side = ((h % 1000) / 500) - 1;
    const lateral = Math.min(d * 0.4, 130) * side;
    return { x: ax + (-dy / d) * lateral, y: ay + (dx / d) * lateral };
  }

  private moveTowards(player: Player, tx: number, ty: number, speed: number) {
    const dx = tx - player.x,
      dy = ty - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 5) return;
    let ux = dx / dist, uy = dy / dist;
    if (player.isBot) {
      // 1. Separation / Flocking Force (prevents bot stacking/orgy)
      let sepX = 0, sepY = 0, sepCount = 0;
      this.gsPlayers.forEach(other => {
        if (other.id !== player.id && other.isBot && !other.hasEgg) {
          const ox = player.x - other.x;
          const oy = player.y - other.y;
          const odist = Math.hypot(ox, oy);
          if (odist > 0 && odist < 140) {
            const force = (140 - odist) / 140;
            sepX += (ox / odist) * force;
            sepY += (oy / odist) * force;
            sepCount++;
          }
        }
      });
      if (sepCount > 0) {
        // Blend target chase direction with separation push
        const blendedX = ux * 1.0 + sepX * 1.8;
        const blendedY = uy * 1.0 + sepY * 1.8;
        const blendedMag = Math.hypot(blendedX, blendedY);
        if (blendedMag > 0) {
          ux = blendedX / blendedMag;
          uy = blendedY / blendedMag;
        }
      }

      // 2. Obstacle Avoidance Steering
      const steered = this.steerAround(player, ux, uy);
      ux = steered.x;
      uy = steered.y;
    }
    const actualSpeed = Math.max(speed, player.isBot ? 5.5 : 0);
    const nx = player.x + ux * actualSpeed;
    const ny = player.y + uy * actualSpeed;

    const steps = Math.max(1, Math.ceil(actualSpeed / 6));
    const sx = (nx - player.x) / steps;
    const sy = (ny - player.y) / steps;
    let moved = false;
    for (let i = 0; i < steps; i++) {
      const txStep = player.x + sx;
      const tyStep = player.y + sy;
      if (!checkCollision(txStep, player.y, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
        player.x = txStep;
        moved = true;
      }
      if (!checkCollision(player.x, tyStep, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
        player.y = tyStep;
        moved = true;
      }
    }
    if (!moved && player.isBot) {
      const len = dist || 1;
      const ux = (dx / len) * actualSpeed;
      const uy = (dy / len) * actualSpeed;
      const px = -uy * 0.92;
      const py = ux * 0.92;
      const slideTries: [number, number][] = [
        [ux, 0],
        [0, uy],
        [-ux * 0.85, 0],
        [0, -uy * 0.85],
        [px, py],
        [-px, -py],
        [px * 0.6, uy * 0.6],
        [ux * 0.6, py * 0.6],
      ];
      for (const [ex, ey] of slideTries) {
        if (!checkCollision(player.x + ex, player.y + ey, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          player.x += ex;
          player.y += ey;
          moved = true;
          break;
        }
      }
    }
    if (!moved && player.isBot) {
      player.targetX = undefined;
      player.targetY = undefined;
    }
  }

  /**
   * Online-multiplayer egg authority. Only the LOCAL player ('player') can become the
   * new holder, and that transition is broadcast so every client mirrors it (hides the
   * ground egg + retints). When I'm the holder I do nothing — I wait for the taker's
   * client to claim it — which keeps exactly ONE client initiating each handoff.
   */
  private updateTaggingMp() {
    const store = useGameStore.getState();
    const now = Date.now();
    const tagDist = Math.max(TAG_DISTANCE, PLAYER_SIZE * 2.2);
    // Authority also drives the fill-agents' egg interactions (run first; the shared
    // grace/cooldown timers then gate the human flow this frame so the egg can't be
    // double-claimed). Other clients just mirror the broadcast.
    if (this.agentAuthority) this.updateBotTaggingMp(store, now, tagDist);
    const me = this.gsPlayers.find((p) => p.id === 'player');
    if (!me || me.isInvincible) return;

    // PICKUP — ground egg, and I'm the one reaching it.
    if (!this.gsPlayers.some((p) => p.hasEgg)) {
      const eggPos = store.eggPosition;
      if (eggPos && Math.hypot(me.x - eggPos.x, me.y - eggPos.y) <= tagDist) {
        me.hasEgg = true;
        me.eggHoldCount = (me.eggHoldCount || 0) + 1;
        store.updatePlayer('player', { hasEgg: true, eggHoldCount: me.eggHoldCount });
        store.setEgg('player', null);
        store.setLastEggHolderId('player');
        this.destroyWorldEgg();
        this.lastTagTime = now;
        this.eggGraceUntil = now + EGG_GRACE_MS;
        this.rebuildPlayerSprite(me);
        audioManager.play('tag');
        this.broadcastEggState(this.localUserId ?? null);
      }
      return;
    }

    // TRANSFER — I don't hold it; steal from whoever does on contact. (If I'm the
    // holder, bail — the other client initiates the steal and broadcasts it.)
    if (me.hasEgg) return;
    if (now < this.eggGraceUntil || now - this.lastTagTime < TAG_COOLDOWN) return;
    const holder = this.gsPlayers.find((p) => p.hasEgg);
    if (!holder || holder.isInvincible) return;
    if (Math.hypot(holder.x - me.x, holder.y - me.y) > tagDist) return;

    holder.hasEgg = false;
    me.hasEgg = true;
    me.eggHoldCount = (me.eggHoldCount || 0) + 1;
    store.updatePlayer(holder.id, { hasEgg: false });
    store.updatePlayer('player', { hasEgg: true, eggHoldCount: me.eggHoldCount });
    store.setEgg('player', null);
    store.setLastEggHolderId('player');
    this.lastTagTime = now;
    this.eggGraceUntil = now + EGG_GRACE_MS;
    this.rebuildPlayerSprite(holder);
    this.rebuildPlayerSprite(me);
    audioManager.play('tag');
    this.broadcastEggState(this.localUserId ?? null);
  }

  /**
   * Online-MP egg authority for the fill-agents (authority client only). Mirrors the
   * human egg flow, but per bot: a bot grabs the loose egg or steals from a HUMAN
   * holder on contact, and we broadcast the new ownership keyed by the bot's userId so
   * every client mirrors it. Bots never steal from each other (no pointless churn); the
   * shared grace/cooldown timers stop the egg ping-ponging between the two flows.
   */
  private updateBotTaggingMp(store: ReturnType<typeof useGameStore.getState>, now: number, tagDist: number) {
    const bots = this.gsPlayers.filter((p) => p.isBot && !p.isInvincible);
    if (bots.length === 0) return;

    // PICKUP — loose egg; first of my bots within range grabs it.
    if (!this.gsPlayers.some((p) => p.hasEgg)) {
      const eggPos = store.eggPosition;
      if (!eggPos) return;
      for (const bot of bots) {
        if (Math.hypot(bot.x - eggPos.x, bot.y - eggPos.y) <= tagDist) {
          bot.hasEgg = true;
          bot.eggHoldCount = (bot.eggHoldCount || 0) + 1;
          store.updatePlayer(bot.id, { hasEgg: true, eggHoldCount: bot.eggHoldCount });
          store.setEgg(bot.id, null);
          store.setLastEggHolderId(bot.id);
          this.destroyWorldEgg();
          this.lastTagTime = now;
          this.eggGraceUntil = now + EGG_GRACE_MS;
          this.rebuildPlayerSprite(bot);
          audioManager.play('tag');
          this.broadcastEggState(bot.userId ?? null);
          return;
        }
      }
      return;
    }

    // TRANSFER — a HUMAN holds it; a bot of mine steals on contact.
    if (now < this.eggGraceUntil || now - this.lastTagTime < TAG_COOLDOWN) return;
    const holder = this.gsPlayers.find((p) => p.hasEgg);
    if (!holder || holder.isInvincible || holder.isBot) return;
    for (const bot of bots) {
      if (Math.hypot(holder.x - bot.x, holder.y - bot.y) > tagDist) continue;
      holder.hasEgg = false;
      bot.hasEgg = true;
      bot.eggHoldCount = (bot.eggHoldCount || 0) + 1;
      store.updatePlayer(holder.id, { hasEgg: false });
      store.updatePlayer(bot.id, { hasEgg: true, eggHoldCount: bot.eggHoldCount });
      store.setEgg(bot.id, null);
      store.setLastEggHolderId(bot.id);
      this.lastTagTime = now;
      this.eggGraceUntil = now + EGG_GRACE_MS;
      this.rebuildPlayerSprite(holder);
      this.rebuildPlayerSprite(bot);
      audioManager.play('tag');
      this.broadcastEggState(bot.userId ?? null);
      return;
    }
  }

  private updateTagging() {
    // Online multiplayer has authoritative, networked egg ownership — handle it apart
    // from the local bot sim so the egg can't desync between clients.
    if (this.isOnlineMp) { this.updateTaggingMp(); return; }

    const store = useGameStore.getState();
    const now = Date.now();
    const effectiveTagDistance = Math.max(TAG_DISTANCE, PLAYER_SIZE * 2.2);

    // 1) PICKUP — egg sits on the ground; first player within range grabs it.
    if (!this.gsPlayers.some((p) => p.hasEgg)) {
      const eggPos = store.eggPosition;
      if (eggPos) {
        for (const p of this.gsPlayers) {
          if (p.isInvincible) continue;
          if (Math.hypot(p.x - eggPos.x, p.y - eggPos.y) <= effectiveTagDistance) {
            p.hasEgg = true;
            p.eggHoldCount = (p.eggHoldCount || 0) + 1;
            store.updatePlayer(p.id, { hasEgg: true, eggHoldCount: p.eggHoldCount });
            store.setEgg(p.id, null);
            store.setLastEggHolderId(p.id);
            this.destroyWorldEgg();
            this.lastTagTime = now;
            this.eggGraceUntil = now + EGG_GRACE_MS;
            this.rebuildPlayerSprite(p);
            audioManager.play('tag');
            break;
          }
        }
      }
      return;
    }

    // 2) TRANSFER — someone holds the egg; non-holders try to take it on contact.
    // Keep-away grace: the fresh holder is steal-proof for a beat so they can break
    // away, instead of the egg ping-ponging the instant the cooldown expires.
    if (now < this.eggGraceUntil) return;
    if (now - this.lastTagTime < TAG_COOLDOWN) return;
    if (this.tagBackBlock && now >= this.tagBackBlock.until) this.tagBackBlock = null;

    const holder = this.gsPlayers.find((p) => p.hasEgg);
    if (!holder) return;
    // If the holder has an active invincibility shield, nobody can touch them
    if (holder.isInvincible) return;
    const others = this.gsPlayers.filter((p) => !p.hasEgg && !p.isInvincible);

    for (const target of others) {
      // Same-frame retake protection: previous holder can't instantly snatch back.
      if (
        this.tagBackBlock &&
        now < this.tagBackBlock.until &&
        holder.id === this.tagBackBlock.newChaserId &&
        target.id === this.tagBackBlock.prevChaserId
      ) {
        continue;
      }
      const dist = Math.hypot(holder.x - target.x, holder.y - target.y);
      if (dist <= effectiveTagDistance) {
        // Knock the players apart so the new holder gets a moment of breathing room.
        const angle = Math.atan2(holder.y - target.y, holder.x - target.x);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const pushHolder = 50; // Reduced knockback to prevent clipping and feeling jarring
        const pullChallenger = 10;
        let hx = holder.x + cos * pushHolder;
        let hy = holder.y + sin * pushHolder;
        if (checkCollision(hx, hy, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          hx = holder.x + cos * 70;
          hy = holder.y + sin * 70;
        }
        let tx = target.x - cos * pullChallenger;
        let ty = target.y - sin * pullChallenger;
        if (checkCollision(tx, ty, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          tx = target.x;
          ty = target.y;
        }
        if (!checkCollision(hx, hy, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          holder.x = hx;
          holder.y = hy;
        }
        if (!checkCollision(tx, ty, PLAYER_SIZE, this.gsObjects, this.mapWidth, this.mapHeight)) {
          target.x = tx;
          target.y = ty;
        }

        // Hand off the egg.
        holder.hasEgg = false;
        target.hasEgg = true;
        target.eggHoldCount = (target.eggHoldCount || 0) + 1;
        store.updatePlayer(holder.id, { hasEgg: false, x: holder.x, y: holder.y });
        store.updatePlayer(target.id, { hasEgg: true, x: target.x, y: target.y, eggHoldCount: target.eggHoldCount });
        store.setEgg(target.id, null);
        store.setLastEggHolderId(target.id);
        this.lastTagTime = now;
        this.eggGraceUntil = now + EGG_GRACE_MS;
        this.tagBackBlock = {
          newChaserId: target.id,
          prevChaserId: holder.id,
          until: now + TAG_BACK_BLOCK_MS,
        };

        this.rebuildPlayerSprite(holder);
        this.rebuildPlayerSprite(target);
        audioManager.play('tag');
        break;
      }
    }
  }

  private spawnPulse(
    x: number,
    y: number,
    color: number,
    fromRadius = 22,
    toRadius = 90,
    alpha = 0.5,
    duration = 320
  ) {
    const pulse = this.add
      .circle(x, y, fromRadius, color, alpha)
      .setDepth(y + 200);
    pulse.setStrokeStyle(2, color, alpha);
    this.tweens.add({
      targets: pulse,
      radius: toRadius,
      alpha: 0,
      duration,
      ease: 'Cubic.Out',
      onComplete: () => pulse.destroy(),
    });
  }

  private attachPowerAura(playerId: string, color: number) {
    this.removePowerAura(playerId);
    const sprite = this.playerSprites[playerId];
    if (!sprite) return;
    const aura = this.add
      .circle(0, -12, 28, color, 0.22)
      .setStrokeStyle(3, color, 0.85);
    sprite.addAt(aura, 1);
    this.tweens.add({
      targets: aura,
      scale: { from: 0.9, to: 1.12 },
      alpha: { from: 0.45, to: 0.15 },
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.powerUpAuras[playerId] = aura;
  }

  private removePowerAura(playerId: string) {
    const aura = this.powerUpAuras[playerId];
    if (!aura) return;
    aura.destroy();
    delete this.powerUpAuras[playerId];
  }

  private spawnSpeedGhost(player: Player, color: number) {
    const ghost = this.add
      .circle(player.x, player.y - 12, 14, color, 0.3)
      .setDepth(player.y - 1);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 1.7,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => ghost.destroy(),
    });
  }

  private spawnPowerLabel(player: Player, text: string, color: string) {
    const label = this.add
      .text(player.x, player.y - 74, text, {
        fontSize: '16px',
        fontFamily: 'Arial Black',
        color,
        stroke: '#04111f',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(player.y + 260);
    this.tweens.add({
      targets: label,
      y: player.y - 108,
      alpha: 0,
      duration: 520,
      ease: 'Sine.Out',
      onComplete: () => label.destroy(),
    });
  }

  private spawnSparkBurst(
    x: number,
    y: number,
    color: number,
    count = 12,
    maxRadius = 110,
    duration = 340
  ) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.2, 0.2);
      const dist = Phaser.Math.FloatBetween(maxRadius * 0.55, maxRadius);
      const spark = this.add
        .circle(x, y, Phaser.Math.FloatBetween(2.5, 4.2), color, 0.85)
        .setDepth(y + 220);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.35,
        duration,
        ease: 'Cubic.Out',
        onComplete: () => spark.destroy(),
      });
    }
  }

  private updatePowerUps(_dt: number) {
    const elapsed = Date.now() - this.gameStartTime;
    const deltaMs = _dt * 1000;
    this.gsPlayers.forEach((p) => {
      // Active-effect lifetime — dt-based, so it advances only while playing (pauses
      // with the menu) and never gets dropped by background-tab timer throttling.
      // This is the fix for power-ups "getting stuck" active forever.
      if (p.powerUpActive) {
        p.powerUpActiveMs = (p.powerUpActiveMs ?? 0) - deltaMs;
        if (p.powerUpActiveMs <= 0) this.deactivatePowerUp(p);
      }

      // Keep initial power-up lock until global unlock time.
      if (elapsed < POWER_UP_UNLOCK_TIME_MS) {
        return;
      }

      const cooldown = p.powerUpCooldown ?? 0;
      if (cooldown > 0) {
        const nextCooldown = Math.max(0, cooldown - deltaMs);
        const becameReady = nextCooldown <= 0;
        p.powerUpCooldown = nextCooldown;
        if (becameReady) {
          p.powerUpReady = true;
        }
        const secA = Math.ceil(cooldown / 1000);
        const secB = Math.ceil(nextCooldown / 1000);
        if (becameReady || secA !== secB) {
          useGameStore.getState().updatePlayer(p.id, {
            powerUpCooldown: nextCooldown,
            powerUpReady: becameReady ? true : p.powerUpReady,
          });
        }
        return;
      }

      if (!p.powerUpReady && !p.powerUpActive) {
        p.powerUpReady = true;
        useGameStore.getState().updatePlayer(p.id, { powerUpReady: true, powerUpCooldown: 0 });
      }
    });
  }

  /**
   * Power-up reload cadence shortens as the clock winds down so the endgame gets
   * frantic: 15s for most of the match, 10s in the last minute, 5s in the last 30s.
   */
  private powerUpReloadMs(): number {
    if (this.gameTimer <= 30) return 5000;
    if (this.gameTimer <= 60) return 10000;
    return 15000;
  }

  private activatePowerUp(player: Player) {
    if (!player.powerUpReady || player.powerUpActive || player.powerUpCooldown) return;
    const pu = player.character.powerUp;
    player.powerUpActive = true;
    player.powerUpReady = false;
    const reloadMs = this.powerUpReloadMs();
    player.powerUpCooldown = reloadMs;
    player.powerUpCooldownMax = reloadMs;
    // Active-effect lifetime is counted down by updatePowerUps (dt-based), so it
    // can never get stuck on pause or background-tab setTimeout throttling.
    player.powerUpActiveMs = pu.type === 'teleport' ? 650 : pu.duration;
    const store = useGameStore.getState();
    store.updatePlayer(player.id, {
      powerUpActive: true,
      powerUpReady: false,
      powerUpCooldown: reloadMs,
      powerUpCooldownMax: reloadMs,
    });

    const baseColor =
      pu.type === 'speed-boost'
        ? 0x38bdf8
        : pu.type === 'earthquake'
        ? 0xf97316
        : pu.type === 'shield'
        ? 0x22c55e
        : pu.type === 'teleport'
        ? 0xa78bfa
        : 0xffffff;
    audioManager.play('power-use');
    this.spawnPulse(player.x, player.y, baseColor, 24, 76, 0.5, 260);
    this.spawnSparkBurst(player.x, player.y, baseColor, 8, 72, 260);
    this.spawnPowerLabel(player, pu.name.toUpperCase(), '#dbeafe');

    switch (pu.type) {
      case 'speed-boost':
        this.attachPowerAura(player.id, 0x38bdf8);
        player.speedBoostActive = true;
        // Self-terminating cosmetic trail (stops when speedBoostActive clears).
        this.time.addEvent({
          delay: 70,
          repeat: Math.floor(pu.duration / 70),
          callback: () => {
            if (player.speedBoostActive) {
              this.spawnSpeedGhost(player, 0x38bdf8);
              this.spawnSparkBurst(player.x, player.y - 10, 0x38bdf8, 4, 30, 180);
            }
          },
        });
        // Deactivation handled by updatePowerUps (dt-based) — see deactivatePowerUp.
        break;
      case 'earthquake':
        this.cameras.main.shake(pu.duration, 0.005);
        this.spawnPulse(player.x, player.y, 0xf97316, 40, 180, 0.5, pu.duration);
        this.spawnSparkBurst(player.x, player.y, 0xf97316, 24, 160, 420);
        this.gsPlayers.forEach(o => {
          if (o.id !== player.id && Math.hypot(o.x - player.x, o.y - player.y) < 250) {
            const slowUntil = Date.now() + 3000;
            o.slowedUntil = slowUntil;
            store.updatePlayer(o.id, { slowedUntil: slowUntil });
            this.spawnSparkBurst(o.x, o.y, 0xf97316, 10, 80, 300);
          }
        });
        // Deactivation handled by updatePowerUps (dt-based).
        break;
      case 'teleport': {
        this.attachPowerAura(player.id, 0xa78bfa);
        const sprite = this.playerSprites[player.id];
        if (sprite) {
          this.tweens.add({
            targets: sprite,
            alpha: 0.25,
            scale: 0.94,
            duration: 220,
            yoyo: true,
            ease: 'Sine.InOut',
          });
        }
        const fromX = player.x;
        const fromY = player.y;

        // Teleport RIGHT NEXT TO the egg holder (or the loose egg) so it's an offensive
        // "close the gap" move — not a random escape. Land just outside tag range on the
        // side the teleporter is coming from, snapped clear of any obstacle.
        const holder = this.gsPlayers.find((p) => p.hasEgg && p.id !== player.id);
        const eggPos = useGameStore.getState().eggPosition;
        let target: { x: number; y: number };
        if (holder) {
          const ang = Math.atan2(fromY - holder.y, fromX - holder.x);
          const gap = 64; // ~1 step outside the ~55px tag range → "very near", not on top
          target = this.nearestFreePoint(holder.x + Math.cos(ang) * gap, holder.y + Math.sin(ang) * gap, this.gsObjects);
        } else if (eggPos) {
          target = this.nearestFreePoint(eggPos.x, eggPos.y, this.gsObjects);
        } else {
          target = findSafeSpawnPosition(this.mapWidth, this.mapHeight, this.gsObjects);
        }
        const rx = target.x;
        const ry = target.y;

        // The teleport jump runs on the scene clock; the active flag itself is
        // cleared by updatePowerUps (dt-based) shortly after, like every other type.
        this.time.delayedCall(500, () => {
          this.spawnPulse(fromX, fromY, 0xa78bfa, 20, 86, 0.5, 240);
          this.spawnSparkBurst(fromX, fromY, 0xa78bfa, 12, 90, 280);

          player.x = rx;
          player.y = ry;
          store.updatePlayer(player.id, { x: rx, y: ry });

          this.spawnPulse(player.x, player.y, 0xa78bfa, 18, 80, 0.5, 260);
          this.spawnSparkBurst(player.x, player.y, 0xa78bfa, 12, 92, 280);
        });
        break;
      }
      case 'shield':
        this.attachPowerAura(player.id, 0x22c55e);
        this.spawnPulse(player.x, player.y, 0x22c55e, 28, 118, 0.6, 400);
        player.isInvincible = true;
        store.updatePlayer(player.id, { isInvincible: true });
        
        const shieldGlow = this.add.circle(player.x, player.y, 30, 0x22c55e, 0.4);
        shieldGlow.setStrokeStyle(3, 0x4ade80, 0.8);
        this.tweens.add({
          targets: shieldGlow,
          scale: 1.2,
          alpha: 0.2,
          duration: 400,
          yoyo: true,
          repeat: -1
        });
        
        const updateShieldPos = this.time.addEvent({
          delay: 16,
          repeat: -1,
          callback: () => {
            if (!player.isInvincible) {
              shieldGlow.destroy();
              updateShieldPos.remove(false);
            } else {
              shieldGlow.x = player.x;
              shieldGlow.y = player.y;
            }
          }
        });
        // Deactivation (clears isInvincible → the glow above self-destroys) is handled
        // by updatePowerUps (dt-based).
        break;
    }
  }

  /**
   * Single idempotent power-up teardown — clears the active flag and any
   * type-specific effect state, then syncs the store. Called from updatePowerUps
   * when the dt-based active timer runs out, so a power-up can NEVER stay stuck
   * (the old per-type setTimeouts could be dropped/throttled in background tabs).
   */
  private deactivatePowerUp(player: Player) {
    if (!player.powerUpActive) return;
    player.powerUpActive = false;
    player.powerUpActiveMs = 0;
    player.speedBoostActive = false;
    // isInvincible is only ever set by the shield power-up, so it's safe to clear
    // here (the shield glow's own timer self-destroys once this flag is false).
    player.isInvincible = false;
    this.removePowerAura(player.id);
    useGameStore.getState().updatePlayer(player.id, {
      powerUpActive: false,
      speedBoostActive: false,
      isInvincible: false,
    });
  }

  private endGame() {
    const store = useGameStore.getState();
    audioManager.stopTheme();
    audioManager.stopRunning();
    this.clearSnapshot(); // match over — don't resume it on a later refresh
    // Last Egg Holder Wins (or default to 0 if nobody ever held it)
    const lastHolderId = useGameStore.getState().lastEggHolderId;
    const currentHolder = this.gsPlayers.find(p => p.hasEgg);
    const winner = currentHolder || this.gsPlayers.find(p => p.id === lastHolderId) || this.gsPlayers[0];

    const grabs = winner.eggHoldCount ?? 0;
    const isLocalWinner = winner.userId === store.userId || winner.id === 'player';
    const msg = isLocalWinner
      ? `🥚 You held the egg at the end! (${grabs} steals)`
      : `🥚 ${winner.character.name} held the egg at the end! (${grabs} steals)`;
    store.setGameResult(winner, msg);
    this.requestReplayStorage(winner);
  }

  /**
   * Phase 2 — kick off the verifiable 0G Storage upload of this match's replay (result
   * + the real 0G Compute decision transcript). We bind a one-shot listener for the
   * resulting Merkle root hash, mirror it to the store + localStorage (so the cross-
   * origin results screen can read it), and emit `store-replay` to the server. The
   * roomCode MUST match the agent-tick key so the server finds this match's transcript.
   */
  private requestReplayStorage(winner: Player) {
    if (this.replayRequested) return;
    this.replayRequested = true;
    const socket = getGameSocket();
    const store = useGameStore.getState();
    store.setReplay({ storing: true, done: false });
    if (!socket) { store.setReplay({ storing: false, done: true }); return; }

    if (!this.replayNetBound) {
      this.replayNetBound = true;
      this.onReplayStored = (payload: any) => {
        if (!payload) return;
        // The settled pot, which is all `replay-stored` carries now that the 0G Storage
        // replay and 0G leaderboard are gone.
        const info = {
          storing: false,
          done: true,
          arcTxHash: payload.arcTxHash ?? null,
          arcPot: payload.arcPot ?? null,
          arcExplorer: payload.arcExplorer ?? null,
        };
        useGameStore.getState().setReplay(info);
        // Persist for the (separate) results page, which is a fresh cross-origin load.
        try { localStorage.setItem('chase-replay', JSON.stringify(info)); } catch { /* ignore */ }
      };
      socket.on('replay-stored', this.onReplayStored);
      this.events.once('shutdown', () => {
        if (this.onReplayStored) socket.off('replay-stored', this.onReplayStored);
        this.onReplayStored = undefined;
        this.replayNetBound = false;
      });
    }

    const rc = this.roomCode || `solo-${this.localUserId || 'anon'}`;
    const result = {
      winner: { id: winner.id, name: winner.character.name, userId: winner.userId ?? null, eggHoldCount: winner.eggHoldCount ?? 0 },
      players: this.gsPlayers.map((p) => ({
        id: p.id, name: p.character.name, isBot: !!p.isBot,
        userId: p.userId ?? null, eggHoldCount: p.eggHoldCount ?? 0, persona: p.persona ?? null,
      })),
    };
    // Clear any stale hash from a previous match so the results page doesn't show it.
    try { localStorage.removeItem('chase-replay'); } catch { /* ignore */ }
    socket.emit('store-replay', { roomCode: rc, result });
  }
}
