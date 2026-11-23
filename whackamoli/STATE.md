# Whack-a-m-Oli — working state

A kid's arcade game: Oli rides a cable-car basket across the top of the screen and throws spinning hammers
at moles that come out of the grass to eat his food. Brief: `SPEC.md`. Decisions and phases: `PLAN.md`.

**Status (2026-11-23):** done and play-tested by the user (desktop + phone); PR opened. The final hammer rules are still to
come from the user (currently "arc forward" + gondola speed).

## Files

| File | What it is |
|---|---|
| `index.html` | Canvas + DOM overlays (title, HUD, pause, game over, rotate notice, mute), inline CSS. Card emoji 🔨. |
| `assets.js` | `window.WAMAssets`: Oli in the gondola (`oli(pose, facing)`, poses idle/windup/throw/cheer/sad), cable, pylon, hammer, marker, `kidFace`, `scorePopup`, `levelBanner`, Antibes background (copied from jumpnduck). API doc at the top. |
| `field.js` | `window.WAMField`: grass tile, mole frames (emerge, walk1/2, turn, eat1/2, bonk, dive), mound, dirt puffs, dizzy stars, food (carrot, broccoli, steak), eaten food, HUD food icons. API doc at the top. |
| `game.js` | DOM-free core `createGame()` (rules, sprite render) + browser shell. `window.WhackAMOli`. |
| `audio.js` | `window.WAMAudio`: WebAudio synthesised sounds (throw, bonk, thud, pop, munch, sparkle, level up, game over, start) + mute (M key or button, bottom right). |
| `Assets.html` | Art review page: every sprite + an animated preview you can drive (←/→, Space, drag/tap). |

## Rules as built

- Mole hit = 100 points. Lives = 5 carrots (HUD, top left); each food a mole eats costs one; 0 = game over.
- Moles come out of a mound, walk away from the food (blind), turn at the screen edge, walk back and eat (~1 s, still hittable).
- Level = 1 + score / 1000. Per level: spawn interval ×0.85 (from 3 s, min 0.9 s), mole speed ×1.12 (from 55, cap 150). 2 foods from level 3.
- Hammer (user: short, soft throw that drops fast): thrown forward in the facing direction (last move direction) **plus the
  gondola's speed** (user likes it: moving throws go further). That speed is smoothed (`AIM_SMOOTH` 0.12 s) and used by both the throw
  and the marker, and the throw happens before the gondola moves in a frame, so a hammer lands exactly on the marker that was on screen.
  Each flying hammer keeps its own marker (`landX`, solid); the marker for the next throw is faint while hammers fly.
  Slow moves (< 25 u/s, touch jitter) don't flip the facing;
  gravity 1600, throw 135 forward / 240 up → a still throw lands ~117 units ahead in ~0.7 s. Cooldown 0.35 s, max 3 in the air.
  A dotted marker shows where it will land.
- Food is drawn at `FOOD_DRAW` 0.9 (user: doubled, desktop and phone); moles stop `EAT_REACH` 30 (× critter scale) from its centre to eat.
- Tuning constants are at the top of `game.js`.

## Controls

Keyboard: ←/→ or A/D move, Space throws (hold = repeat), Enter/Space start/restart, P/Esc pause.
Touch/mouse: drag moves the gondola (and sets facing), a short tap throws. Landscape only (portrait = "turn your phone" + pause).

## Storage

`whackamoli:best`, `whackamoli:mute` in localStorage, all in try/catch; "reset scores" on the title screen.

## Dev notes

- Headless tests (not in the repo, session scratchpad): `global.window = {}`, `require('./game.js')`, drive `createGame({rand})` with
  `update(1/60, input)`. Covered: movement/clamp/facing, landing = `markerX`, hit + bonk, emerge not hittable, the full mole walk, food
  stolen → retarget/dive, game over + best, levels + 2 foods, determinism, a bot outlives a no-op player.
- Visual checks: `./build.sh`, serve `docs/`, Playwright screenshots at 1280×800, 844×390, 667×320 and portrait.
- World: H = 400, W from the aspect, capped at 2.45:1 (letterboxed beyond).
- HUD band (user: the cable must not run through the HUD): the shell measures the HUD's bottom and pushes the world down just
  enough that the pylon tops start below it.
- Full-bleed background (user): the canvas always covers the whole screen; the playable area is fitted inside (centred sideways,
  on the bottom edge) and `render(ctx, images, scale, {top, left, right, bottom})` fills the margins with sky, mountains, sea,
  grass and soil.
- Sprites are rasterised above their viewBox size (`load(..., res)`: 2.5 default, moles 3.5, food 4) so they stay sharp.
- Eaten food: a 3-circle scalloped bite with an outline (`biteCircles`), also on the grey HUD icon.
- Critter scale (user: moles/food too small on phones): `game.setCritterScale(k)` grows moles, food, mounds, puffs, stars,
  marker and the mole hit box. The shell sets k from the screen height: 800 px → 1, 390 px → 1.5, ≤ 320 px → 1.7.

## Open / to review

- Final hammer rules from the user (currently "arc forward").
- Level 1 may feel slow (a mole takes ~20 s to walk out and back).
- The dive frame's raised feet can look like bunny ears at small size.
- Oli's throw pose shows on release, then windup while re-arming (the core throws instantly).
