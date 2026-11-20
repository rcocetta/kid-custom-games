# Oli's Scooter Dash — game build plan

Endless runner in the genre of the Chrome offline runner, using our own assets from `assets.js`.
Read `../CLAUDE.md` (repo ground rules) and `STATE.md` (asset API) first. This plan is the spec.

## Decisions (from the user)

- Title on splash: **"Oli's Scooter Dash"**.
- **Landscape only.** In portrait show a "Please turn your phone sideways" screen and pause.
- One hit on an obstacle = **game over** (crash pose), tap/press to restart.
- Food collectibles = **+100** points with the `scorePopup(100, 'EAT WELL!')` popup.
- Controls: keyboard **and** touch with **top half = jump, bottom half (hold) = duck, plus on-screen buttons**.
- Font: local `fonts/Fredoka.ttf` via `@font-face` (no Google Fonts, no external requests).
- Splash: big front face (`kidFace()`), title, instructions on how to start. On start the face
  **shrinks and flies to sit next to the points** (HUD avatar), then play begins.
- Responsive; works on phones/tablets (touch) and desktop (keyboard).

## Files

| File | Role |
|---|---|
| `index.html` | Entry point. Canvas + DOM overlays (splash, HUD, game over, rotate notice, touch buttons). CSS inline. Loads `assets.js` then `game.js` with plain `<script src>`. |
| `game.js` | All game code. Split into a **DOM-free core** (`createGame`) and a **browser shell** (input, canvas sizing, overlays, loop). See "Code structure". |
| `STATE.md` | Update at the end: game files, controls, tuning constants, what's next. |

Publishing (handled by CI, not by the game task): a repo-root `build.sh` copies each game's
runtime files into `docs/<game>/` and generates `docs/index.html` listing the games; GitHub Pages
serves `docs/`. So the game must only reference files inside its own folder (relative paths).

No other files. No npm deps at runtime. Relative paths only. No storage except `localStorage` key
`jumpnduck:best` (try/catch every access) with a "Reset best score" control.

## Code structure (`game.js`)

```js
// Pure core — no window/document access. Testable headless.
function createGame({ rand = Math.random } = {}) -> {
  state,                 // 'ready' | 'playing' | 'over'
  world: { W, H },       // world units; H fixed = 400, W set by resize()
  resize(aspect),        // W = round(H * aspect), clamp aspect to [1.3, 2.6]
  start(), reset(),
  update(dt, input),     // dt seconds (clamp to 0.05); input = { jump: bool (edge), duck: bool (held) }
  render(ctx, images, scale), // draws whole scene in world units; ctx already scaled by caller
  score, best, events,   // events: array the shell drains each frame: {type:'food', x, y} | {type:'crash'} | {type:'milestone'}
}
// Browser shell: loads images, sizes canvas (DPR aware), handles input, overlays, rAF loop.
```
Expose `window.JumpNDuck = { createGame, loadImages }` so a headless test can use the core.
At the bottom, start the shell only `if (typeof document !== 'undefined')`.

### Sprite images
`loadImages(GameAssets)` → `Promise<map>`: for every SVG string, `new Image()` with
`src = GameAssets.toDataUrl(svg)`; await `img.decode()` (fallback onload). Keep each image's
**viewBox** (parse from the SVG string: `viewBox="x y w h"`) with it: `{ img, vb:{x,y,w,h} }`.
Images to load: kid ride/push/jump/duck/gameover, kidFace, seagull up/down, pigeon up/down,
cactus tall/small/double, poop, rock small/big/pile, food ×5, scorePopup, background
mountains/sea/ground/oldTown/nomade/ferrisWheel/boat. (Rasterize SVG at a size large enough
for crisp DPR rendering: set width/height attributes on the SVG root before converting, e.g. 2–3× its draw size.)

Draw helper: `drawSprite(ctx, sprite, x, y, scale)` draws viewBox-space onto world-space:
`ctx.drawImage(img, x + (vb.x)*scale?...)` — simplest: treat each image as covering its viewBox, draw at
world rect `(x, y, vb.w*scale, vb.h*scale)` where (x, y) is the world position of the viewBox's top-left.

## World layout (H = 400 world units, y down)

- `GROUND_Y = 352` — riding line (kid wheels / obstacle bottoms touch this).
- Ground tile layer: top at `GROUND_Y - 5` (tile's sidewalk top line is at 6/60 of its height), height 54 → fills to 400.
- Sea band: top at 292, bottom 350 (behind ground). Draw sea tile stretched to height 58.
- Mountains: bottom at 300, height 120 (tile drawn 600×120 world units).
- Sky: vertical gradient `#BFE6FF` → `#EAF7FF` from 0 to 300. Clouds: 3–5 soft white rounded blobs (draw with arcs), very slow.
- Old town: occasional landmark, height ~80, base at y ≈ 300 (sits in the sea just below horizon).
- Nomade / ferris wheel: occasional decorations standing on the promenade behind the kid, base at GROUND_Y, height ~130 (nomade) / ~150 (ferris); never at the same time. Not collidable.
- Sailboat: occasional, on the sea, ~30 high.
- Kid x: `KID_X = 70` (left edge of the ride sprite's scooter area). Everything else scrolls right→left.

### Kid sprite alignment (important)
All kid poses share one drawing scale. In sprite (viewBox) space the wheels touch the ground at
**y = 229**, and sprite x = 20 is the kid anchor. Draw every pose with `K = 0.6` world units per sprite unit:
`worldX = KID_X + (vb.x - 20) * K`, `worldY = kidGroundY - (229 - vb.y) * K`, size `vb.w*K × vb.h*K`.
`kidGroundY = GROUND_Y + jumpOffset` (jumpOffset ≤ 0 while airborne). So ride ≈ 147 tall, duck ≈ 97 tall.

### Parallax speeds (fraction of game speed)
mountains 0.08, old town 0.12, sea 0.2, boat 0.25, clouds 0.04, nomade/ferris 0.5, ground/obstacles/food 1.0.
Tiles repeat seamlessly: keep an offset per layer, draw `ceil(W / tileW) + 1` copies.

## Gameplay

- Obstacle gaps are time-based: 2–4 s apart at the start, shrinking to 0.9–2 s at top speed, plus a 12% chance of a +1.5 s breather; first obstacle after a 900-unit warm-up.
- Speed (world units/s): start `300`, `+7` per second of play, max `680`.
- Score: `distance * 0.025` (≈ 7–17 pts/s), shown as an integer. Food `+100`. Milestone event every 500 pts (HUD pop).
- **Jump**: `v0 = -760`, gravity `2300` → peak ≈ 125 units, airtime ≈ 0.66 s. Jump only when on the ground.
  While airborne, holding duck = fast fall (gravity × 3). Pose `jump` while airborne.
- **Duck**: while held and on the ground → pose `duck`. Release → ride.
- **Ride animation**: alternate `ride` / `push` (push ~1 frame in 4, every ~0.12–0.2 s, faster with speed).
- **Obstacles** (scale so they have these world heights; width follows viewBox aspect):
  cactus tall 72, cactus small 46, cactus double 62, poop 44, rock small 30, rock big 56, rock pile 36.
  Bottom of the viewBox sits on `GROUND_Y + 2`.
- **Birds** (seagull/pigeon, width 84, flap frames every 0.15 s), appear once score ≥ 250, ~25% of spawns:
  - *low bird* (bottom at GROUND_Y − 40): jump over it.
  - *duck bird* (bottom at GROUND_Y − 104): too high to hit a ducking kid, too low to jump over → **duck**.
  - Birds move at game speed + 40 (they fly toward the kid).
- **Spawning**: next obstacle when the last one is `gap` away from the right edge;
  `gap = speed * 0.75 + rand * speed * 0.9` world units (min 260). Never two hazards closer than the kid can handle.
- **Food**: ~45% of gaps get one food item placed in the middle of the gap. Food height 40.
  70% floating at jump height (center y ≈ GROUND_Y − 150, reachable only by jumping), 30% low
  (center y ≈ GROUND_Y − 70, caught by riding through). Gentle bob (±4 units, sine).
  Caught → remove, `+100`, emit `{type:'food'}`, show popup.
- **Hitboxes** (forgiving — this is for a small kid): axis-aligned rects shrunk from the drawn sprite:
  kid: inset 22% left/right, 12% top, 6% bottom of its drawn rect (duck uses its own lower rect);
  obstacles: inset 15% each side, 10% top; birds: inset 18% horizontally, 25% vertically; food: no inset.
- **Crash**: on any obstacle/bird overlap → state `over`, pose `gameover` (drawn where the kid is,
  same anchoring), world stops scrolling, emit `{type:'crash'}`, update best.

## Screens & UI (DOM overlays in `index.html`, styled like `Assets.html`: Fredoka, rounded, thick dark outline `#2E2A36`, orange accent `#FF8A1F`)

1. **Splash** (state `ready`): the scene behind scrolls slowly (attract mode, no obstacles).
   Centered card-less layout: big `kidFace()` (inline SVG, ~38vh), title "Oli's Scooter Dash"
   (Fredoka 700, white with dark outline/shadow), instructions:
   - "Tap the top · Space · ↑ — JUMP"
   - "Hold the bottom · ↓ — DUCK"
   - "Eat good food: +100!"
   - big orange **Play** button ("Tap to start" / "Press Space").
   Best score shown if > 0, plus a small "Reset best score" text button (asks confirm()).
2. **Start transition**: FLIP animation — measure the splash face rect and the HUD avatar slot rect,
   animate the face element (CSS transform translate+scale, ~650 ms, ease-in-out) into the slot;
   fade out title/instructions at the same time; then hide the splash face, show the HUD avatar, call `game.start()`.
3. **HUD** (playing): top-left pill: round avatar (`kidFace()`) + points (tabular numbers, pops on +100 and milestones);
   top-right: "Best N". `+100 EAT WELL!` popup: draw the popup sprite on canvas at the food position
   (or a DOM element) — scale-in burst, float up 60 units, fade out over ~1.1 s.
4. **Game over**: canvas shows crash pose; overlay card: "Oops!", score, best ("New best!" if beaten),
   **Play again** button (also Space/Enter/tap anywhere after a 700 ms lockout so a held jump doesn't instantly restart).
   Restart goes straight to playing (face stays in HUD).
5. **Rotate notice**: when `innerHeight > innerWidth`: full-screen message with a rotating-phone icon
   (CSS) "Turn your phone sideways to play"; pause the game while shown.
6. **Touch buttons**: shown when `matchMedia('(pointer: coarse)')` matches: big round **DUCK** (bottom-left) and
   **JUMP** (bottom-right), ~18vh, semi-transparent white with dark outline. They work alongside the
   top-half/bottom-half rule. Buttons must not also trigger the half-screen handler (stopPropagation).

## Input (shell)

- Keyboard: Space / ArrowUp / W = jump (edge-triggered on keydown, ignore repeats); ArrowDown / S = duck (held);
  Space/Enter also start (splash) and restart (game over). `preventDefault` for these keys.
- Pointer: `pointerdown` on the play area: y < 50% → jump; y ≥ 50% → duck held until that pointer's `pointerup/cancel`.
  Support multiple pointers (duck with one thumb, jump with the other).
- CSS: `touch-action: none; user-select: none;` on body/canvas; viewport meta `width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no`.
- Pause when `document.hidden` (visibilitychange) and on rotate notice; resume on return.

## Canvas sizing

Canvas fills the viewport (`100vw × 100dvh`, `position: fixed`). On resize: CSS size = viewport,
backing store = CSS size × `devicePixelRatio` (cap DPR at 2). `scale = canvas.height / H`;
`game.resize(cssWidth / cssHeight)`. Render with `ctx.setTransform(scale,0,0,scale,0,0)`.
Main loop: `requestAnimationFrame`, `dt = min(0.05, (now - last)/1000)`.

## Verification (headless, no browser available in this environment)

Use `@napi-rs/canvas` (install it in a scratch dir outside the repo and `require` it from there;
keep test scripts in that scratch dir, **not in the repo**):
- `global.window = {}`; load `assets.js` and `game.js` (they must not touch `document` at load).
- Load images with `@napi-rs/canvas`'s `loadImage(GameAssets.toDataUrl(svg))` (it rasterizes SVG) into the same `{img, vb}` shape.
- Simulate: start, run `update(1/60, input)` with scripted jumps/ducks; render frames to PNG at 1280×720 and 844×390 (phone landscape):
  splash-attract frame, mid-run with an obstacle + food, a jump, a duck under a duck-bird, the crash frame.
- Assert: food caught while jumping adds 100; ducking under a duck-bird survives; standing into one crashes;
  a 60 s auto-play bot (jump when an obstacle is near, duck for duck-birds) survives a reasonable time.
- Also `node --check game.js` and parse-check the inline scripts of `index.html`.
