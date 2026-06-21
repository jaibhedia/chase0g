import type { CosmeticType } from '../store/gameStore';

/**
 * Asset-store catalog (Phase: Coming Soon). These describe the cosmetic mechanics the
 * store renders — the actual purchasable assets/art are added later. The store UI is
 * gated behind `STORE_LIVE = false`, so nothing here is buyable yet.
 *
 * `color` is a placeholder swatch the store shows until real preview art is dropped in.
 */
export interface Cosmetic {
  id: string;
  name: string;
  type: CosmeticType;
  /** Optional: ties a skin/trail to one of the 4 base characters (char-1..char-4). */
  characterId?: string;
  /** Soft-currency price (mechanic only while the store is Coming Soon). */
  price: number;
  /** Placeholder preview swatch until real art lands. */
  color: string;
  description: string;
}

export const cosmeticCategories: { type: CosmeticType; label: string; blurb: string }[] = [
  { type: 'skin', label: 'Skins', blurb: 'Alternate looks for your dino.' },
  { type: 'trail', label: 'Trails', blurb: 'Leave a signature streak as you run.' },
  { type: 'taunt', label: 'Taunts', blurb: 'Trash-talk lines for the chase.' },
  { type: 'emote', label: 'Emotes', blurb: 'Quick reactions mid-match.' },
];

export const cosmetics: Cosmetic[] = [
  // --- Skins (per character) ---
  { id: 'skin-doux-gold', name: 'Golden Doux', type: 'skin', characterId: 'char-1', price: 500, color: '#FFD54A', description: 'A gilded shimmer for Doux.' },
  { id: 'skin-mort-frost', name: 'Frostbite Mort', type: 'skin', characterId: 'char-2', price: 500, color: '#7FD4FF', description: 'An icy palette for Mort.' },
  { id: 'skin-tard-toxic', name: 'Toxic Tard', type: 'skin', characterId: 'char-3', price: 500, color: '#9BE15D', description: 'A radioactive green for Tard.' },
  { id: 'skin-vita-magma', name: 'Magma Vita', type: 'skin', characterId: 'char-4', price: 750, color: '#FF7A3C', description: 'Molten plates for Vita.' },

  // --- Trails ---
  { id: 'trail-ember', name: 'Ember Trail', type: 'trail', price: 250, color: '#FF6B3C', description: 'A blazing orange streak.' },
  { id: 'trail-neon', name: 'Neon Trail', type: 'trail', price: 250, color: '#36F1CD', description: 'A glowing cyan wake.' },
  { id: 'trail-violet', name: 'Violet Trail', type: 'trail', price: 300, color: '#A78BFA', description: 'A dreamy purple streak.' },

  // --- Taunts ---
  { id: 'taunt-catch-me', name: '"Catch me if you can!"', type: 'taunt', price: 150, color: '#FFC93C', description: 'Classic chase bravado.' },
  { id: 'taunt-too-slow', name: '"Too slow!"', type: 'taunt', price: 150, color: '#FFC93C', description: 'A little extra salt.' },

  // --- Emotes ---
  { id: 'emote-laugh', name: 'Laugh', type: 'emote', price: 100, color: '#6AB04C', description: 'Rub in the win.' },
  { id: 'emote-gg', name: 'GG', type: 'emote', price: 100, color: '#6AB04C', description: 'Good game, well played.' },
];
