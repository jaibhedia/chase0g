# Brand kit — Chase Dinosaurs

Generation prompts plus the design tokens already live in the codebase. **The tokens are
not suggestions** — they're pulled from `app/globals.css` and the components, so anything
generated against them will actually match the product.

---

## 1. Design tokens (already shipping — don't invent new ones)

### Colour

| Token | Hex | Role | Usage count in `app/` |
|---|---|---|---|
| Cream | `#f4e7c3` | Primary text, UI foreground | 95 |
| Gold | `#ffc93c` | Primary accent, CTAs, the egg | 73 |
| Green | `#6ab04c` | Profit, success, positive net | 24 |
| Mid brown | `#4d2813` | Panel borders, raised chrome | 22 |
| Dark brown | `#261309` | Panel fill | 18 |
| Near-black blue | `#11111c` | Page ground | 17 |
| Red | `#e8503a` | Loss, danger, negative net | 12 |
| Sky | `#5fcde4` | Secondary accent, water/highlight | 11 |
| Tan | `#c97b3c` | Tertiary, dirt/wood | 4 |

**The identity pair is gold on dark brown** (`#ffc93c` / `#261309`). Gold is the egg — the
single object the whole game revolves around. Everything else supports it.

### Typography

- **Headings / UI chrome:** `Press Start 2P` (Google Fonts) — true 8-bit, use sparingly,
  never below 10px, always with generous letter-spacing
- **Body:** `VT323` (Google Fonts) — pixel terminal face, highly legible at small sizes

Both already loaded in `app/layout.tsx` as `--font-heading` and `--font-body`.

### Rules

- **16-bit era, not 8-bit.** Reference point is SNES/Genesis, not NES. Richer palette,
  dithered shading, more colour depth than true 8-bit.
- **Hard pixel edges everywhere.** `image-rendering: pixelated`. No anti-aliasing, no soft
  shadows, no gradients that aren't dithered.
- **No modern web3 visual clichés.** No neon-on-black, no glassmorphism, no circuit-board
  motifs, no glowing hexagons. The USDC layer is infrastructure; the game is the product.

---

## 2. Logo / wordmark

```
A 16-bit pixel art logo wordmark reading "CHASE DINOSAURS", two lines,
chunky blocky pixel letterforms with a 2px hard outline and a 1px drop
shadow offset down-right. Golden yellow (#ffc93c) letters with a dark brown
(#261309) outline, sitting on transparent background. A small golden
dinosaur egg replaces the letter O in "DINOSAURS", with a subtle highlight
dot in its upper left. SNES-era 16-bit game logo aesthetic, crisp pixel
edges, no anti-aliasing, no gradients, no glow. Centred, generous padding.
```

**Variants to generate:** full colour on transparent · single-colour cream `#f4e7c3` for
dark backgrounds · single-colour `#261309` for light.

---

## 3. Key art / hero image

```
16-bit pixel art key art for a multiplayer chase game. Four distinct
cartoon dinosaurs mid-sprint across a sunlit grassy plain, viewed from a
three-quarter top-down angle. The lead dinosaur clutches a large glowing
golden egg and looks back over its shoulder in panic; the three chasing it
are close behind, one lunging. Warm palette: golden yellow #ffc93c accents,
cream #f4e7c3 highlights, deep brown #261309 shadows, green #6ab04c grass,
sky blue #5fcde4 above. SNES/Genesis era sprite work, dithered shading,
hard pixel edges, no anti-aliasing. Energetic, comedic, high motion. Wide
16:9 composition with clear empty sky in the upper third for a logo.
```

> ⚠️ Leave the upper third clear. Most generators fill the frame edge to edge and you'll
> have nowhere to place the wordmark.

---

## 4. Open Graph / social card (1200×630)

```
A 1200x630 social share card, 16-bit pixel art. Left two-thirds: three
cartoon dinosaurs chasing a fourth that carries a glowing golden egg,
side-on running poses, grassy plain, warm sunlit palette of #ffc93c gold,
#f4e7c3 cream, #261309 dark brown, #6ab04c green. Right third: solid dark
brown #261309 panel with a chunky 4px cream border, empty and flat, ready
for text overlay. Hard pixel edges, dithered shading, SNES aesthetic, no
anti-aliasing, no text in the image.
```

**Then overlay in code/Figma** (never generate text — models mangle it):
- Line 1, Press Start 2P, `#ffc93c`: **CHASE DINOSAURS**
- Line 2, VT323, `#f4e7c3`: *60 seconds. One egg. Real USDC.*

---

## 5. Favicon (already shipping — regenerate only if replacing)

Current: `/icon-192.png` + `/icon-192.svg`.

```
A 64x64 pixel art app icon: a single golden dinosaur egg, oval, with
dithered shading from bright gold #ffc93c at the top-left highlight down to
deep amber shadow, set on a solid dark brown #261309 rounded square. Two or
three small cream #f4e7c3 speckles on the shell. Heavy 2px dark outline.
Crisp pixel edges, readable at 16x16, no gradients, no text.
```

**Test at 16×16 before committing.** Most pixel icons that look great at 512 are mud at
favicon size.

---

## 6. Character sprites (direction, if extending the roster)

```
A 32x32 pixel art sprite sheet of a cartoon [DINOSAUR TYPE] character for a
top-down 16-bit game. Four-direction walk cycle, three frames each. Bold
readable silhouette, chunky proportions, oversized head, expressive single-
pixel eyes. Limited palette of 8-10 colours with dithered shading. Strong
2px dark outline so it reads against both grass and dirt. Transparent
background, no anti-aliasing, sprites evenly spaced on a grid.
```

**Silhouette test:** fill each sprite solid black. If you can't tell which character is
which, redesign before colouring. Four players on one screen at speed means silhouette is
the only thing a player actually parses.

---

## 7. Tool notes

| Tool | Use for | Watch out |
|---|---|---|
| **Midjourney** | Key art, OG cards | Add `--style raw`; it over-renders pixel art into fake-pixel illustration |
| **DALL·E / GPT Image** | Logos, icons | Best at text, still verify letterforms pixel by pixel |
| **Aseprite** | Final sprite cleanup | Generated sprites are never grid-aligned — hand-fix |
| **Stable Diffusion + pixel LoRA** | Sprite sheets | Most faithful to a real palette if you can run it |

**Always downscale-then-upscale generated "pixel art" with nearest-neighbour.** Generators
produce pixel-*styled* images at high resolution with soft edges, not true pixel art. Take
it to actual 32px/64px, then scale back up with nearest-neighbour to get honest hard edges.

---

## 8. Asset checklist

- [ ] Wordmark — colour, cream, dark (SVG + PNG @1x/@2x)
- [ ] Key art 16:9 with clear upper third
- [ ] OG card 1200×630 with text overlaid in code
- [ ] Favicon verified legible at 16×16
- [ ] Square avatar 400×400 for X / Discord / Farcaster
- [ ] One looping gameplay GIF under 5MB for social
