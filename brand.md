# Chase Dinosaurs — Brand & UI System

**Direction:** 16-bit Adventure — a cozy SNES-RPG pixel-art look, dark night base so chunky
panels and sun-yellow accents pop. Subtle CRT scanlines over everything. Sharp corners only.

## Palette

| Token | Hex | Role |
|---|---|---|
| Sky | `#5FCDE4` | secondary actions / info accents (`game` button) |
| Grass | `#6AB04C` | **primary** actions / success |
| Earth | `#C97B3C` | secondary buttons / wood panels |
| Cream | `#F4E7C3` | body text on dark, parchment panels |
| Sun | `#FFC93C` | **accent** — titles, timer, highlights |
| Danger | `#E8503A` | destructive / defeat |
| Ink | `#11111C` / `#181826` | outlines, deep background |

shadcn HSL tokens live in [app/globals.css](app/globals.css) `:root` (mirrored for the game in
[game-app/src/index.css](game-app/src/index.css)). `--radius: 0` — nothing is rounded.

## Typography
- **Headings / labels:** `Press Start 2P` (`--font-heading`, class `.pixel-font` / `.font-heading`).
- **Body:** `VT323` (`--font-body`) — a readable pixel font. Loaded via `next/font` in the shell
  and via Google Fonts `@import` in the game.

## Pixel chrome (use these, don't hand-roll)
- `.pixel-panel` — dark stepped-border panel (chunky ink outline + inner highlight + hard drop
  shadow, no blur). `.pixel-panel-cream` for parchment. `.pixel-border` to wrap any element.
- `.adventure-bg` + `.pixel-grid` — the standard page background.
- `.title-pixel` (sun text + hard ink shadow), `.pixel-shadow` (hard offset text shadow).
- Buttons: the shadcn `Button` is pixel-styled. Variants → `default`=grass, `secondary`=earth,
  `neon`=sun, `game`=sky, `destructive`=danger, `outline`/`ghost`/`link`. They press down on
  `:active` and play the click SFX.
- In the game HUD: `.px-panel`, `.px-chip`, `.px-heading`, `.px-shadow`.
- Scanlines: a single `<div className="scanlines" />` is mounted in `app/layout.tsx` and
  `game-app/.../Game.tsx`. Respects `prefers-reduced-motion`.

## Do / Don't
- **Do** use solid palette fills, sharp corners, 8px-grid spacing, hard (offset) shadows.
- **Don't** use gradients, neon glows, `backdrop-blur`, or rounded corners — a global
  `border-radius: 0 !important` enforces the last one.
- Keep `image-rendering: pixelated` on all sprites/tiles.

## In-game maps (Phaser tilemaps, 32px)
All three maps are real tilemaps built in [game-app/src/scene/gameScene.ts](game-app/src/scene/gameScene.ts):
office (`Room_Builder_free_32x32`), Summer Plains (`summer_plains_tiles`, grass + water rim),
Inferno Keep (`all_tiles_free`, stone + brick + lava slow-zones).
