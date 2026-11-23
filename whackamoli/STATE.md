# Whack-a-m-Oli — working state

A kid's arcade game: Oli rides a cable-car basket across the top of the screen and throws spinning hammers
at moles that come out of the grass to eat his food. Brief: `SPEC.md`. Decisions and phases: `PLAN.md`.

**Status (2026-11-23):** art done and reviewed once; game playable (title, play, level up, pause, game over);
sound done. Next: the user's play-test (Review 2) and the final hammer rules.

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
- Hammer (user: short, soft throw that drops fast): thrown forward in the facing direction (last move direction). The gondola's
  speed is NOT added (user: the target must match the throw), so the marker is always the same distance in front of Oli;
  slow moves (< 25 u/s, touch jitter) don't flip the facing;
  gravity 1600, throw 135 forward / 240 up → a still throw lands ~117 units ahead in ~0.7 s. Cooldown 0.35 s, max 3 in the air.
  A dotted marker shows where it will land.
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
- World: H = 400, W from the aspect, capped at 2.1:1 (letterboxed) so the moles stay big on wide screens.
- Critter scale (user: moles/food too small on phones): `game.setCritterScale(k)` grows moles, food, mounds, puffs, stars,
  marker and the mole hit box. The shell sets k from the screen height: 800 px → 1, 390 px → 1.5, ≤ 320 px → 1.7.

## Open / to review

- Final hammer rules from the user (currently "arc forward").
- Level 1 may feel slow (a mole takes ~20 s to walk out and back).
- The dive frame's raised feet can look like bunny ears at small size.
- Oli's throw pose shows on release, then windup while re-arming (the core throws instantly).
