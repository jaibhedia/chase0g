import { GameMap } from '../store/gameStore';

// There is a single arena now — the green forest — used by every mode (single-player
// + multiplayer). Dimensions match the multiplayer build (MP_MAP_COLS×MP_MAP_ROWS ×
// 32px) so the displayed size is honest.
export const gameMaps: GameMap[] = [
  {
    id: 'map-1',
    name: 'Green Forest',
    description: 'A lush forest of trees, bushes, and winding dirt paths ringed by hedges',
    width: 2560,
    height: 1728,
  },
];
