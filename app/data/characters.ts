import { Character } from '../store/gameStore';

export const characters: Character[] = [
  {
    id: 'char-1',
    name: 'Doux',
    speed: 4.6,
    color: '#FFB36B',
    spriteId: 'doux',
    powerUp: {
      name: 'Speed Trail',
      description: 'Leave a blazing trail with extreme speed',
      duration: 3000,
      cooldown: 5000,
      type: 'speed-boost'
    }
  },
  {
    id: 'char-2',
    name: 'Mort',
    speed: 4.1,
    color: '#8AA8FF',
    spriteId: 'mort',
    powerUp: {
      name: 'Earthquake Jump',
      description: 'Jump and create ground cracks that stun nearby players',
      duration: 2000,
      cooldown: 5000,
      type: 'earthquake'
    }
  },
  {
    id: 'char-3',
    name: 'Tard',
    speed: 3.8,
    color: '#95D66E',
    spriteId: 'tard',
    powerUp: {
      name: 'Invincibility Shield',
      description: 'Glowing shield — become invincible so nobody can tag or steal the egg',
      duration: 3000,
      cooldown: 5000,
      type: 'shield'
    }
  },
  {
    id: 'char-4',
    name: 'Vita',
    speed: 3.3,
    color: '#64C6A8',
    spriteId: 'vita',
    powerUp: {
      name: 'Portal Teleport',
      description: 'Teleport randomly through a portal',
      duration: 1000,
      cooldown: 5000,
      type: 'teleport'
    }
  },
];
