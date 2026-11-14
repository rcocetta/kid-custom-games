# Jump n Duck — working state

A kid's endless-runner game (genre: Chrome-dino-style runner) with our own original cartoon assets.
The kid rides a scooter, jumps over ground obstacles, ducks under flying ones, and collects food.

**Status (2026-11-14):** asset phase. No game logic yet — only the asset portfolio page.

## Files

| File | What it is |
|---|---|
| `assets.js` | All sprites, drawn in code as SVG strings. Exposed on `window.GameAssets`. Load with a plain `<script src="assets.js">` (works from `file://`, no server). |
| `Assets.html` | Portfolio page showing every asset + an animated preview scene (kid rides, Space/click to jump, birds fly by, obstacles and food scroll past, score badge ticks up). |
| `STATE.md` | This file. |

## Style rules (keep consistent)

- Rounded, cartoonish, thick dark outline `#2E2A36`, outline width 4 (`SW`).
- Limbs/stems drawn with `limb(points, color, width)` = outlined round-capped stroke.
- Multi-shape silhouettes: draw all outlines first, then all fills (`blob()` / `birdBody()`).
- Friendly faces on obstacles & food: dot eyes, small smile, pink cheeks (`foodFace()`).
- Everything faces/moves **right-to-left** toward the kid; the kid faces right.
- Palette lives in `GameAssets.palette` (each asset adds its colours there).
- Font on the page: Fredoka (Google Fonts).

## Asset API (`window.GameAssets`)

| Call | Variants | Notes |
|---|---|---|
| `kid(pose)` | `kidPoses`: `ride`, `push`, `jump` | Kid on scooter, big head, blonde, green eyes, green tee, jeans, white shoes; black scooter, orange wheels. Wheels are `<g class="wheel">` — spin with CSS. Ride/push alternate for the run cycle. |
| `kidFace()` | — | Front-facing portrait, used in the score badge (HUD). |
| `seagull(frame)` | `seagullFrames`: `up`, `down` | Flying obstacle. Alternate frames to flap. |
| `pigeon(frame)` | `pigeonFrames`: `up`, `down` | Flying obstacle, same wing shapes as seagull. |
| `cactus(variant)` | `cactusVariants`: `tall`, `small`, `double` | Ground obstacle; tall one has a face + flower. |
| `poop()` | — | Ground obstacle, original drawing (not the emoji glyph), smiling, stink lines. |
| `rock(variant)` | `rockVariants`: `small`, `big`, `pile` | Ground obstacle. |
| `food(kind)` | `foodKinds`: `chicken`, `broccoli`, `carrot`, `steak`, `egg` | Collectibles with happy faces. |
| `toDataUrl(svg)` | — | Turn an SVG string into an image URL for `<canvas>` drawing. |

Ground obstacles: the bottom of each viewBox is the ground line.

## Still to do (assets)

- [ ] **Duck pose** for the kid (crouched low on the scooter) — needed to pass under birds.
- [ ] **Game-over pose** (e.g. dizzy / fallen off).
- [ ] **Background**: sky, clouds, hills/trees/buildings, ground tile.
- [ ] Decide the final page title (currently says "Scooter Dash" in `Assets.html` header; game name is "Jump n Duck").

## Next phase (game)

- `index.html` + `game.js` in this folder, canvas-based, reusing `assets.js` via `toDataUrl`.
- Core loop like the Chrome runner: speed increases over time, random ground/flying obstacles,
  jump (Space/Up/tap), duck (Down/swipe), collect food for points, score badge with `kidFace()`.
- Rules will be amended gradually with the user — ask before inventing rule changes.

## Dev notes

- No headless browser works in this WSL env (Playwright Chromium lacks `libnspr4`).
  Visual checks were done by rendering SVGs to PNG with `@resvg/resvg-js` in a scratch dir:
  set `global.window = {}`, `require('./assets.js')`, render `GameAssets.*()` output.
