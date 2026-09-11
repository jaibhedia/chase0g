# Chase Dinosaurs — Launch & Feedback Kit

Live game: **https://chase.abstractstudio.in**

---

## ⚠️ Can you upload this to itch.io? (read first)

Your game is a **hosted multiplayer web app** (Next.js menus + Vite/Phaser game + Socket.IO
server on Render), not a self-contained HTML bundle. itch's "HTML" embed expects a ZIP with an
`index.html` that runs entirely in the iframe. Three things break a straight upload:

1. **Base path** — the game is built with Vite `base: '/game-app/'`, so on itch (served from
   `html.itch.zone`) all asset URLs 404. An itch build needs `base: './'`.
2. **No menus in the bundle** — character/map selection live in the Next shell. The standalone
   game redirects to the landing URL when it gets no config handoff, so the itch iframe would
   just bounce.
3. **Multiplayer CORS** — the Render server must allow itch's iframe origin. If `CORS_ORIGIN` is
   pinned to `chase.abstractstudio.in`, the embed is blocked. (Leave it unset = allow any, or add
   itch origins.)

### Two realistic options
- **A. itch as a landing page (do this now).** Skip the embed. Fill the page with cover +
  screenshots + trailer + a big "▶ Play free in your browser → chase.abstractstudio.in" link in
  the description. Great for discovery and feedback, zero code.
- **B. Proper embeddable build (later, ~half a day of work).** A standalone single-player-vs-bots
  build: `base: './'`, boots straight into a quick match (no shell), multiplayer optional pointing
  at Render. Then the itch "Play" button works inline. *(Ask me and I'll build this.)*

---

## itch.io form — field-by-field

| Field | What to put |
|---|---|
| **Title** | Chase Dinosaurs |
| **Project URL** | chase-dinosaurs |
| **Short description / tagline** | `Real-time multiplayer tag — chase, run, and survive 30 seconds.` |
| **Classification** | Games |
| **Kind of project** | HTML (for option B). For option A, still HTML but link in the description. |
| **Release status** | In development *(signals you want feedback)* |
| **Pricing** | $0 or donate — set suggested donation to **$0** (or remove it). No payment config needed for free. |
| **Embed — viewport** | **1280 × 720** (16:9, landscape) |
| **Embed — checkboxes** | ✅ Mobile friendly, ✅ Fullscreen button, ✅ Automatically start on page load. Leave SharedArrayBuffer + scrollbars OFF. |
| **Genre** | Action |
| **Tags (≤10)** | `multiplayer, real-time, pixel-art, arcade, tag, casual, fast-paced, cute, party-game, retro` |
| **AI disclosure** | **Yes** — see note below. |
| **Custom noun** | leave blank (defaults to "game") |
| **Community** | Enable **Comments** (free feedback channel) |
| **Cover image** | 630×500 required — you don't have one yet (only SVG icons + a 1200×630 OG). Make/crop a 630×500 PNG. *(Ask me to generate one.)* |
| **Screenshots** | 3–5: countdown, a chase mid-match, power-up active, the lobby, results. |
| **Trailer** | optional — a 20–30s screen capture helps a lot. |
| **Visibility** | Draft → review → Public. |

> **AI disclosure = Yes.** itch now requires this if *any* content is AI-generated. Your character
> art (alien, creepy-guy, etc.) looks AI-generated and the code was AI-assisted. Tick **Yes** and
> you can note "AI-assisted art and code, hand-edited." Being honest here avoids takedowns.

### Description (paste into the Description box)

```
🦖 Chase Dinosaurs

A fast-paced, top-down multiplayer tag game you play right in your browser.

One player is the CHASER. Everyone else runs. Survive 30 seconds — last one tagged wins.

▶ Play free (no install): https://chase.abstractstudio.in

• 6 characters, each with a unique power-up — Speed Trail, Earthquake, Power Punch,
  Teleport, Invisibility, Force Field (unlocks mid-round)
• Solo vs AI bots, or multiplayer with 2–4 friends via room codes
• Proximity voice chat — hear players who are close to you
• 16-bit pixel-art adventure look, CRT scanlines, chunky SNES vibes

Controls: WASD / Arrow Keys to move, SPACEBAR for your power-up.

This is an early build and I'm actively improving it — feedback very welcome!
```

---

## X / Twitter

**Main tweet:**
```
🦖 Chase Dinosaurs — a 30-second multiplayer tag game in your browser.

One chaser, everyone else runs. 6 characters, 6 power-ups, total chaos.

Free, no install 👉 chase.abstractstudio.in

#buildinpublic #gamedev #indiedev
```

**Optional thread:**
```
2/ Stack: Phaser 3 + React for the game, Socket.IO on a small Node server for real-time
netcode, Next.js shell, deployed on Vercel + Render. Pixel-art 16-bit look.

3/ Hardest part was the netcode — remote players felt laggy/choppy. Added velocity
dead-reckoning so they glide smoothly between 30Hz packets instead of stuttering. Huge difference.

4/ It's rough and I want feedback. Grab 1–3 friends, spin up a room, and tell me what feels off.
Replies/DMs open 🙏
```

**Tips:** attach a 5–10s gameplay clip or GIF (tweets with video get far more reach). Tag
`@phaser_` and post around 9–11am ET on a weekday.

---

## Reddit

Reddit hates self-promo that isn't a real post. Lead with the game + a feedback ask, reply to
every comment, never drop just a link.

**Title:**
```
[Browser] Chase Dinosaurs — a 30-second real-time multiplayer tag game (free, no install)
```

**Body:**
```
Hey all — I made Chase Dinosaurs, a fast browser game: one player is the chaser, everyone
else runs for 30 seconds. 6 characters, each with a unique power-up (speed trail, teleport,
invisibility, force field…). Play solo vs bots or multiplayer with 2–4 friends via room codes,
plus proximity voice chat.

▶ Play free, no install: https://chase.abstractstudio.in

It's an early build and I'm after honest feedback — controls, feel, lag, fun factor. What would
make you play a second round? What felt off?

Built solo with Phaser + Socket.IO; happy to go into any technical detail.
```

### Best subreddits (check each sub's rules + post day)
| Subreddit | Why / notes |
|---|---|
| r/playmygame | Made for this. Follow their required post format. |
| r/WebGames | Browser-only games, perfect fit. |
| r/io_games | .io-style real-time multiplayer — your exact niche. |
| r/IndieGaming | Big reach; lead with a GIF. |
| r/IndieDev | Dev-friendly, good for build-in-public. |
| r/gamedev | Only on **Feedback Friday** / **Screenshot Saturday** threads. |
| r/SideProject | Build-in-public crowd. |
| r/Browsergames | Smaller but on-topic. |
| r/multiplayergames | If you can get a couple people to test live. |

---

## Where to "build in public" / get early feedback

- **X**: post the clip with `#buildinpublic #gamedev #indiedev #madewithphaser`; reply to anyone who tries it.
- **Reddit**: the subs above (rotate, don't spam all at once — 1–2/day).
- **Discord**: the **Phaser** Discord `#showcase`, indie game-dev servers, `r/gamedev` Discord.
- **Hacker News**: "Show HN: Chase Dinosaurs – a 30s multiplayer tag game in the browser" (link + 2-line comment on how you built it).
- **Indie Hackers** / **SideProjectors**: build-in-public milestone posts.
- **itch.io**: the page itself + dev log posts (itch has a built-in Devlog feature — great for build-in-public updates).
- **Short-form video**: a 15–20s clip on TikTok / YouTube Shorts / Reels drives the most installs for casual games.

**Pro tip:** every post should have ONE clear ask ("play 1 round with a friend and tell me the
single most annoying thing") and a 5–10s clip. That converts far better than screenshots.
```
