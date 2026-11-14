# Jump n Duck — working state

A kid's endless-runner game (genre: Chrome-dino-style runner) with our own original cartoon assets.
The kid rides a scooter, jumps over ground obstacles, ducks under flying ones, and collects food.

**Status (2026-11-14):** assets done; game built (`index.html` + `game.js`), verified headless only (no real browser in this env).

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
| `kid(pose)` | `kidPoses`: `ride`, `push`, `jump`, `duck`, `gameover` | Kid on scooter, big head, blonde, green eyes, green tee, jeans, white shoes; black scooter, orange wheels. Wheels are `<g class="wheel">` — spin with CSS. Ride/push alternate for the run cycle. `duck` = lying belly-down, bum up, stem tipped forward low; same drawing scale but a lower/wider viewBox (`20 74 204 161` vs `20 -10 165 245`), so size it by viewBox units, not by a fixed pixel width. `gameover` = fell off: sitting on the ground, X eyes, tear, wobbly frown, dizzy stars, scooter tipped over behind (viewBox `-82 10 262 225`). The KO face is `head(true)` inside assets.js. |
| `kidFace()` | — | Front-facing portrait. Standalone, general-purpose asset (menus, game over, etc.); the score badge (HUD) is just one user of it — keep it independent from the HUD. |
| `seagull(frame)` | `seagullFrames`: `up`, `down` | Flying obstacle. Alternate frames to flap. |
| `pigeon(frame)` | `pigeonFrames`: `up`, `down` | Flying obstacle, same wing shapes as seagull. |
| `cactus(variant)` | `cactusVariants`: `tall`, `small`, `double` | Ground obstacle; tall one has a face + flower. |
| `poop()` | — | Ground obstacle, original drawing (not the emoji glyph), smiling, stink lines. |
| `rock(variant)` | `rockVariants`: `small`, `big`, `pile` | Ground obstacle. |
| `food(kind)` | `foodKinds`: `chicken`, `broccoli`, `carrot`, `steak`, `egg` | Collectibles with happy faces. |
| `background.mountains()` / `.sea()` / `.ground()` | tiles in `background.tiles` (800×160, 800×60, 400×60) | Antibes seafront parallax layers, each seamlessly tileable horizontally (preserveAspectRatio none). Grey city ground: kid rides on the sidewalk, top ≈ `background.groundRideLine` (6 of 60). Sky = CSS gradient `#BFE6FF → #EAF7FF`; clouds are CSS blobs in Assets.html. |
| `background.nomade()` | — | **Important landmark.** *Nomade*, the white letter sculpture on the bastion: crouching figure hugging its knees, letters (kid-friendly French words) clipped inside, on a stepped beige pedestal. Decoration on the promenade, behind the kid (not an obstacle). viewBox `0 6 200 224`, pedestal bottom = ground. |
| `background.ferrisWheel()` | — | Ferris wheel (port). `<g class="ferris-wheel">` spins around (100,96); each `<g class="gondola">` has its own transform-origin and counter-spins (CSS, `transform-box: view-box`). Decoration on the promenade, alternates with Nomade in the preview. viewBox `0 0 200 230`, base bottom = ground. |
| `background.boat()` | — | Small sailboat drifting on the sea. |
| `background.oldTown()` | — | Antibes old town landmark (ramparts, pastel houses, two towers, rocks, jetty + red lighthouse), cartoon version of the user's reference photo. Not a tile: one sprite drifting at sea speed; its base (y=160 of viewBox `-4 4 424 160`) sits just below the horizon in the sea. |
| `scorePopup(points, label)` | default `100`, `'EAT WELL!'` | Bonus popup when a food collectible is caught (+100 points). Big gold number + green ribbon + stars. Text uses Fredoka when the page has it (fallback Arial Rounded/Black). Page animates it: burst in, float up, fade. |
| `toDataUrl(svg)` | — | Turn an SVG string into an image URL for `<canvas>` drawing. |

Ground obstacles: the bottom of each viewBox is the ground line.

## Still to do (assets)

- [x] Duck pose (belly down, bum up on the deck).
- [x] Game-over pose (fallen off, X eyes, tear).
- [x] Background: Antibes — snowy mountains, sea + sailboat, grey city ground (sky/clouds kept from the page).
- [ ] Decide the final page title (currently says "Scooter Dash" in `Assets.html` header; game name is "Jump n Duck").

## Next phase (game)

- [x] `index.html` + `game.js` in this folder, canvas-based, reusing `assets.js` via `toDataUrl`.
- [x] Core loop like the Chrome runner: speed increases over time, random ground/flying obstacles,
  jump (Space/Up/tap), duck (Down/hold bottom half), collect food for +100 bonus (show `scorePopup`), score badge with `kidFace()`.
- Rules will be amended gradually with the user — ask before inventing rule changes.

## Dev notes

- No headless browser works in this WSL env (Playwright Chromium lacks `libnspr4`).
  Visual checks were done by rendering SVGs to PNG with `@resvg/resvg-js` in a scratch dir:
  set `global.window = {}`, `require('./assets.js')`, render `GameAssets.*()` output.

## Game

Files: `index.html` (canvas + DOM overlays, inline CSS), `game.js` (DOM-free core `createGame` + browser shell), `fonts/Fredoka.ttf`.
`window.JumpNDuck = { createGame, loadImages, prepareSprites }`; the shell only starts when `document` exists. Spec: `GAME_PLAN.md`.

- **Controls:** Space / Up / W = jump (keydown edge, repeats ignored); Down / S = duck (held); Space/Enter start and restart.
  Touch/mouse: top half of the screen = jump, bottom half held = duck (multi-pointer); on-screen DUCK/JUMP buttons on coarse-pointer devices
  (they `stopPropagation`, so the half-screen rule never double-fires). Jump has a 0.12 s buffer before landing.
- **Screens:** splash (attract scrolling scene, big `kidFace`, title, instructions, Play, best + reset) -> FLIP animation of the face into the HUD avatar
  (650 ms, then `game.start()`) -> playing (HUD pill + Best) -> game over card (700 ms restart lockout) -> restart goes straight to playing.
  Portrait shows a rotate notice and pauses (also paused on `visibilitychange`). Best score: `localStorage` `jumpnduck:best`.
- **Core API:** `update(dt, {jump, duck})`, `render(ctx, images, scale)`, `resize(aspect)`, `start()`, `reset()`, `score`, `best`, `newBest`, `state`;
  `game.events` is a draining getter (`food` / `crash` / `milestone`). `obstacles`, `foods`, `kid` getters exist for tests.
- **Tuning constants (top of `game.js`):** `H=400`, `GROUND_Y=352`, `KID_X=70`, `K=0.6`, speed `300 + 7/s` max `680`, `JUMP_V=-760`, `GRAVITY=2300`,
  fast-fall x3, score `0.025/unit`, food `+100`, milestone 500, birds from score 250 (~25% of spawns, width 84, +40 speed),
  low bird bottom `GROUND_Y-40`, duck bird bottom `GROUND_Y-104`, `MIN_GAP=260`, food chance 0.45 (70% high / 30% low), obstacle heights in `OBSTACLES`.
  Hitbox insets are in `kidHit()` and `spawnObstacle()`.
- **Headless tests** (scripts live in the session scratch dir, not the repo): `global.window = {}`, `require('./assets.js')`, `require('./game.js')`; build images with
  `prepareSprites(GameAssets)` + `@napi-rs/canvas` `loadImage(toDataUrl(svg))` into `{img, vb}`; drive `createGame({rand: seededRng})` with
  `update(1/60, input)`, render with `ctx.setTransform(s,0,0,s,0,0); game.render(ctx, imgs, s)`. Asserted: food +100 while jumping, duck under duck-bird
  survives, standing/jumping into it crashes, jump over low bird survives, 60 s bot survival, best/restart. A fake-DOM smoke test exercises the shell flow.
- **Known limits:** wheels and the ferris wheel don't animate (SVG CSS animations don't apply to `<img>`/canvas); the popup sprite uses its fallback font
  (SVG-in-`<img>` can't see page fonts); not tried in a real browser or on a real touch device.
