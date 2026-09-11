import { Player, GameObject } from '@/store/gameStore';

const PLAYER_SIZE = 25;
const TAG_DISTANCE = 40;
const COUNTDOWN_DURATION = 3;
/**
 * Round length in seconds.
 *
 * 60, down from 120. On a map this size two minutes is mostly dead air — the egg changes
 * hands early and the rest is a lap of the same arena. 45 was tried and read as rushed:
 * a round has to leave room for the egg to change hands more than once, or the winner is
 * just whoever grabbed it last.
 *
 * The bot difficulty ramp is expressed as a fraction of this, so it rescales on its own:
 * bots still open easy and reach medium at the whistle, just over 60 seconds instead of
 * 120, which makes the escalation more noticeable rather than less.
 *
 * Single source of truth — the server derives remaining time from its own start
 * timestamp and this constant, so there is no second number to keep in step.
 */
const GAME_DURATION = 60;
const TAG_COOLDOWN = 1200;

let isGameInitialized = false;

let sharedState: SharedState | null = null;

interface SharedState {
  players: Player[];
  objects: GameObject[];
  keys: { [key: string]: boolean };
  playerPosition: { x: number; y: number };
  lastTagTime: number;
  lastTaggedPlayerId: string | null;
  gameStartTime: number;
  earthquakeEffects: any[];
  portalEffects: any[];
  forceFieldEffects: any[];
  punchEffects: any[];
  gamePhase: string;
  countdownTimer: number;
  gameTimer: number;
}

function findSafeSpawnPosition(mapWidth: number, mapHeight: number, objects: GameObject[], existingPlayers: Player[] = [], minDistance = 220): { x: number; y: number } {
  const margin = 80;
  // More attempts + a relaxing min-distance so spread stays wide but never deadlocks
  // when rooms are tight.
  for (let attempt = 0; attempt < 90; attempt++) {
    const relax = minDistance * (1 - attempt / 90);
    const x = Math.random() * (mapWidth - margin * 2) + margin;
    const y = Math.random() * (mapHeight - margin * 2) + margin;
    const hitsFurniture = objects.some(obj => obj.type === 'furniture' && x + PLAYER_SIZE / 2 > obj.x && x - PLAYER_SIZE / 2 < obj.x + obj.width && y + PLAYER_SIZE / 2 > obj.y && y - PLAYER_SIZE / 2 < obj.y + obj.height);
    if (hitsFurniture) continue;
    const tooClose = existingPlayers.some(p => Math.hypot(p.x - x, p.y - y) < relax);
    if (!tooClose) return { x, y };
  }
  return { x: mapWidth / 2, y: mapHeight / 2 };
}

function checkCollision(x: number, y: number, size: number, objects: GameObject[], mapWidth: number, mapHeight: number): boolean {
  const m = 1;
  if (x - size / 2 < m || x + size / 2 > mapWidth - m || y - size / 2 < m || y + size / 2 > mapHeight - m) return true;
  for (const obj of objects) {
    if (obj.type === 'furniture' && x + size / 2 > obj.x && x - size / 2 < obj.x + obj.width && y + size / 2 > obj.y && y - size / 2 < obj.y + obj.height) return true;
  }
  return false;
}

function createMapObjects(mapId: string, width: number, height: number): GameObject[] {
  const objects: GameObject[] = [];
  const safeWidth = width > 0 ? width : 1400;
  const safeHeight = height > 0 ? height : 900;
  const scale = Math.min(safeWidth / 1400, safeHeight / 900);
  const sx = (p: number) => p * (safeWidth / 1400);
  const sy = (p: number) => p * (safeHeight / 900);
  const sw = (s: number) => s * scale;
  const sh = (s: number) => s * scale;

  if (mapId === 'map-1') {
    objects.push(
      { id: 'top-left-console', x: sx(45), y: sy(85), width: sw(290), height: sh(110), type: 'furniture', color: '#4a5568', propType: 'terminal' },
      { id: 'top-right-lab', x: sx(980), y: sy(170), width: sw(420), height: sh(210), type: 'furniture', color: '#2d3748', propType: 'terminal' },
      { id: 'center-reactor', x: sx(545), y: sy(520), width: sw(220), height: sh(210), type: 'furniture', color: '#3a3f52', propType: 'vent' },
      { id: 'left-column', x: sx(305), y: sy(455), width: sw(120), height: sh(265), type: 'furniture', color: '#4a5568', propType: 'server' },
      { id: 'right-column', x: sx(845), y: sy(455), width: sw(120), height: sh(265), type: 'furniture', color: '#4a5568', propType: 'server' },
      { id: 'mid-desk-1', x: sx(1010), y: sy(430), width: sw(150), height: sh(95), type: 'furniture', color: '#2a4365', propType: 'terminal' },
      { id: 'mid-desk-2', x: sx(1170), y: sy(430), width: sw(150), height: sh(95), type: 'furniture', color: '#2a4365', propType: 'terminal' },
      { id: 'bottom-barrier-left', x: sx(385), y: sy(775), width: sw(210), height: sh(70), type: 'furniture', color: '#334155', propType: 'vent' },
      { id: 'bottom-barrier-right', x: sx(805), y: sy(775), width: sw(210), height: sh(70), type: 'furniture', color: '#334155', propType: 'vent' }
    );
  } else if (mapId === 'map-2') {
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        objects.push({ id: `cubicle-${row}-${col}`, x: sx(150 + col * 300), y: sy(150 + row * 250), width: sw(180), height: sh(120), type: 'furniture', color: '#2b213b', propType: 'terminal' });
      }
    }
    objects.push(
      { id: 'conf-table', x: sx(1050), y: sy(150), width: sw(250), height: sh(120), type: 'furniture', color: '#1e383e', propType: 'terminal', isPushable: true, mass: 0.5 },
      { id: 'break-counter', x: sx(150), y: sy(720), width: sw(200), height: sh(60), type: 'furniture', color: '#1a2a4a', propType: 'vent' },
      { id: 'vending', x: sx(50), y: sy(700), width: sw(70), height: sh(120), type: 'furniture', color: '#3a1b3b', propType: 'server' },
      { id: 'break-table', x: sx(400), y: sy(650), width: sw(100), height: sh(80), type: 'furniture', color: '#252042', propType: 'plant', isPushable: true, mass: 0.3 },
      { id: 'exec-desk-1', x: sx(1000), y: sy(700), width: sw(180), height: sh(90), type: 'furniture', color: '#2a1a4a', propType: 'terminal', isPushable: true, mass: 0.5 },
      { id: 'file-cab-1', x: sx(60), y: sy(60), width: sw(60), height: sh(80), type: 'furniture', color: '#1a303a', propType: 'server' },
      { id: 'storage-1', x: sx(700), y: sy(450), width: sw(100), height: sh(120), type: 'furniture', color: '#312041', propType: 'server' }
    );
  } else if (mapId === 'map-3') {
    objects.push(
      { id: 'wild-top-left', x: sx(180), y: sy(140), width: sw(170), height: sh(100), type: 'furniture', color: '#3a6b3a', propType: 'plant' },
      { id: 'wild-top-mid', x: sx(610), y: sy(130), width: sw(210), height: sh(110), type: 'furniture', color: '#2f6d52', propType: 'vent' },
      { id: 'wild-top-right', x: sx(1050), y: sy(150), width: sw(180), height: sh(95), type: 'furniture', color: '#3d5f7a', propType: 'terminal' },
      { id: 'wild-mid-left', x: sx(290), y: sy(410), width: sw(200), height: sh(120), type: 'furniture', color: '#406940', propType: 'server' },
      { id: 'wild-mid-center', x: sx(700), y: sy(430), width: sw(160), height: sh(140), type: 'furniture', color: '#46586b', propType: 'terminal', isPushable: true, mass: 0.4 },
      { id: 'wild-mid-right', x: sx(1030), y: sy(430), width: sw(210), height: sh(120), type: 'furniture', color: '#4f5f34', propType: 'plant' },
      { id: 'wild-low-left', x: sx(180), y: sy(690), width: sw(210), height: sh(120), type: 'furniture', color: '#3f4d2a', propType: 'vent' },
      { id: 'wild-low-mid', x: sx(650), y: sy(690), width: sw(180), height: sh(130), type: 'furniture', color: '#2d4f40', propType: 'server' },
      { id: 'wild-low-right', x: sx(1090), y: sy(710), width: sw(180), height: sh(100), type: 'furniture', color: '#4a5a32', propType: 'plant', isPushable: true, mass: 0.35 }
    );
  } else {
    objects.push(
      { id: 'lab-1', x: sx(150), y: sy(150), width: sw(200), height: sh(90), type: 'furniture', color: '#1a303a', propType: 'terminal', isPushable: true, mass: 0.5 },
      { id: 'lab-2', x: sx(150), y: sy(280), width: sw(200), height: sh(90), type: 'furniture', color: '#1a303a', propType: 'terminal', isPushable: true, mass: 0.5 },
      { id: 'lab-3', x: sx(400), y: sy(150), width: sw(200), height: sh(90), type: 'furniture', color: '#1a303a', propType: 'terminal', isPushable: true, mass: 0.5 },
      { id: 'lab-4', x: sx(400), y: sy(280), width: sw(200), height: sh(90), type: 'furniture', color: '#1a303a', propType: 'vent' },
      { id: 'server-1', x: sx(50), y: sy(500), width: sw(80), height: sh(250), type: 'furniture', color: '#252042', propType: 'server' },
      { id: 'server-2', x: sx(150), y: sy(500), width: sw(80), height: sh(250), type: 'furniture', color: '#252042', propType: 'server' },
      { id: 'vault', x: sx(1000), y: sy(50), width: sw(300), height: sh(200), type: 'furniture', color: '#2b213b', propType: 'server' },
      { id: 'containment', x: sx(1100), y: sy(500), width: sw(150), height: sh(150), type: 'furniture', color: '#392434', propType: 'plant', isPushable: true, mass: 0.3 },
      { id: 'equip-1', x: sx(100), y: sy(650), width: sw(120), height: sh(130), type: 'furniture', color: '#252042', propType: 'server' },
      { id: 'sink', x: sx(450), y: sy(720), width: sw(180), height: sh(70), type: 'furniture', color: '#1e383e' },
      { id: 'fume-hood', x: sx(700), y: sy(680), width: sw(200), height: sh(140), type: 'furniture', color: '#2a1a4a' }
    );
  }
  return objects;
}

export { sharedState, PLAYER_SIZE, TAG_DISTANCE, TAG_COOLDOWN, COUNTDOWN_DURATION, GAME_DURATION, checkCollision, createMapObjects, findSafeSpawnPosition };
export type { SharedState };
