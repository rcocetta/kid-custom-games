# Taekwondo Master — working state

1-player vs CPU side-view taekwondo fighting game. Spec: `SPEC.md`; plan and phases: `PLAN.md`; move notes: `research.md`.

**Status (2026-11-21):** Spins are sampled with a monotone cubic through their keyframes in real seconds (steady turn speed, no stall at each key) plus an automatic sideways arm/leg splay near front/back views; the standing rear roundhouse (back kick) is now HIGH (foot at head height). Earlier (2026-11-20): Review 2 poses pass: standing punches hit face height (HIGH), duck is a deep crouch (head ~145, under a standing HIGH punch) with all low moves lowered to match, high/mid blocks reach further forward. Review 2: rig has a continuous body `turn`; the 12 spinning moves in `poses.js` re-authored as real 360 spins (head spots first, dwit chagi thrust, hook sweep, backfist whip, low = floor sweep). Review 1 feedback applied (side-on balanced stance, `open` chest-turn key, boys short hair). P2 done (fighter rig, looks, stance/idle/walk, portraits, belt badges, review page).
Waiting for **Review 1** (characters & arena). Verified headless only (no real browser in this env).

## Files

| File | What it is | Phase |
|---|---|---|
| `assets.js` | Palette, **fighter rig**, looks, portraits, belt badges. `window.TKDAssets`. Plain `<script src>`, works from `file://`. | P2 |
| `Assets.html` | Review page: Oli + Dani (both facings, back view), 8 random opponents + Reroll, portraits (5 expressions), belt ladder, idle/walk animated on canvas, **pose lab** (one slider per pose key, live preview, copy/load pose JSON), and (P4) a **Moves** section: pair view (reach + target height), animated tile per move/state with real timings, slow-motion, character/facing switch, static chamber/extension/retract rows. | P2/P4 |
| `fonts/Fredoka.ttf` | Copied from `jumpnduck/`, loaded with `@font-face`. | P2 |
| `poses.js` | All move + state animations on the rig (`window.TKDPoses`), loaded after assets.js/moves.js. | P4 |
| `arena.js`, `Arena.html` | Outdoor Antibes training hall (`window.TKDArena`). | P3 |
| `game.js`, `moves.js`, `test/` | Fight engine core + tests. | P5 |

## Game shell (P6)

- **Files:** `index.html` (entry, inline CSS, overlays), `game.js` (core `createFight` + browser shell, `window.TKD.shell` test hook). Script order: arena, assets, moves, poses, cpu, audio, game; cpu.js/audio.js are guarded (`window.X &&`), a stand-in CPU is used if cpu.js is missing.
- **Screens** (DOM overlays, one page): title (Tournament / Practice / sound toggle / Reset progress with confirm / control legend) -> character (Oli, Dani) -> belt ladder (8 badges, current highlighted, opponent portrait, Fight!) -> fight (HUD, "Round N", "Fight!", "KO!"/"Time!" cards, match-over panel: win -> bow + win pose, next belt; lose -> "Try again!" same belt) -> trophy screen after Black (SVG trophy, confetti, trophy count; ladder resets to White). Practice: White belt, no damage/timer, hit counter, legend strip.
- **Controls:** arrows; `KeyA/S/Z/X` = back punch / front punch / back kick / front kick (AZERTY Q/S/W/X, same keys); `KeyP` pause; `Esc` "Leave the fight?" (also steps back on menus). Attacks are press edges with a 0.12 s buffer. Touch (coarse pointer): joystick bottom-left (dead zone 0.3, 4 dirs + diagonals), 2x2 buttons bottom-right (top: back/front punch, bottom: back/front kick), pause button top-centre.
- **Pause:** P / button, Esc, tab hidden, portrait ("Turn your phone sideways" overlay).
- **Storage** (all try/catch): `taekwondo:progress` `{character, beltIndex}`, `taekwondo:trophies`, `taekwondo:mute` (also written by audio.js). Reset progress clears progress + trophies.
- **Rendering:** arena layers rasterised once into an offscreen canvas per size; fighters = `forFighter` -> `drawFighter` -> `drawToCanvas` at `floorY - f.y`; DPR capped at 2. Pose + primitives cost ~0.45 ms per fighter (node), so about 1 ms/frame for both. Effects: star burst, BLOCK! puff, floating damage numbers, shake on spinning hits / KO.
- **Verified:** node stub-DOM smoke test (title to trophy, pause/Esc/portrait/hidden, storage throwing, practice, reset); `fight-mock` PNG for layout. **Not verified:** real browser (real canvas, fonts, touch/pointer events, safe-area, audio, rendering speed).

## Style rules (keep consistent)

- Same as Oli's Scooter Dash: thick `#2E2A36` outline, width 4; limbs = outlined round-capped strokes
  (outline stroke under a fill stroke); one body part = one silhouette (all outlines, then all fills).
- Big cartoon head (radius 44, Dani 0.92x), dot-ish round eyes with highlight, pink cheeks, small smile —
  but **long arms and legs** (kid: thigh 64, shin 60, upper arm 48, forearm 46; ~305 units tall).
- Dobok: loose sleeves/trousers with flared cuffs, V-neck with crossed lapels, belt with knot + two tails,
  bare feet and fists. White gi = white fill + outline + light grey fold shading; far limbs a shade darker.
- Gi colours: Oli white, Dani pink, opponents green. Belts in `TKDAssets.belts` (White → Black, black has a gold bar).
- Everything is drawn in code (SVG path data). No images.

## Assets API (`window.TKDAssets`)

| Call | Notes |
|---|---|
| `drawFighter(look, pose, opts)` | → array of primitives `{d, fill?, stroke?, width?, opacity?}` in draw order (paint fill, then stroke, round caps/joins). `opts`: `facing` 1/-1, `expression` `'normal'\|'fierce'\|'hurt'\|'ko'\|'happy'` (`ko` adds dizzy stars), `x`, `y`, `scale`, `ground` (default true). |
| `toSvg(prims, viewBox)` | → SVG string. Default viewBox `-200 -340 400 360` fits a standing fighter (feet on y = 0). |
| `drawToCanvas(ctx, prims)` | Paints with `new Path2D(d)` (cached on the primitive). Translate the ctx to the feet point first, or pass `opts.x/y/scale`. |
| `lerpPose(a, b, t)` | Angles the shortest way round; `x`, `y`, `back`, hands, swaps, `ground` linear. |
| `poses` | `stance`, `idle[3]` (bounce, ~0.24 s per frame), `walkFwd[3]`, `walkBack[3]` (~0.14 s per frame). |
| `skeleton(look, pose, opts)` | World positions of joints: `hip, neck, head, headR, f/bShoulder, Elbow, Wrist, Fist, Hip, Knee, Ankle, Toe` (for hit sparks). |
| `rigInfo` | Segment lengths per build, key list, conventions (same as below). |
| `looks.oli`, `looks.dani` | Look objects. |
| `randomOpponent(belt, rand)` | Random look: skin {light, dark, eastAsian (almond eyes, black/dark hair)}, gender (female = eyelashes, earrings, softer mouth), hair: boys short only, girls {short, long, ponytail}, plausible hair/eye colour, green gi, the given belt, a first name. `rand` defaults to `Math.random`. |
| `portrait(look, expression)` | Front-facing face + gi shoulders, SVG string, viewBox `0 -10 120 134`. Oli = jumpnduck `kidFace`. |
| `beltBadge(belt)` | Tied belt icon, SVG string, viewBox `0 0 120 80`. |
| `belts`, `belt[key]`, `palette`, `builds` | Data. |

**Look** = `{ name, skin: 'light'|'fair'|'eastAsian'|'dark', hairStyle: 'oli'|'short'|'long'|'ponytail', hairColor: 'blonde'|'lightBrown'|'brown'|'darkBrown'|'black'|'red', eyeColor: 'green'|'brown'|'darkBrown'|'blue'|'hazel', gender, gi: 'white'|'pink'|'green', belt: key, build: 'kid'|'adult', eyeShape?: 'round'|'almond' }`.
Dani: fair skin, brown ponytail, brown eyes, pink gi, adult build (~335 tall), **black belt (my pick, not in the spec)**.

## Pose format (for P4)

A pose is a plain object of numbers (degrees); missing keys = 0. Described **facing right**; mirroring is `opts.facing`.
Fighter space is SVG units, y down; after grounding the lowest body point is on y = 0.

| Key | Meaning |
|---|---|
| `x`, `y` | Root (hip) offset after grounding. `x` + = forward, `y` − = up (jump: `y: -60`). |
| `rot` | Whole-body pitch around the hip, + = top tips forward. Falls, KO, flips. |
| `torso` | Lean relative to `rot`, + = forward (stance 8). `head`: tilt relative to torso, + = chin down. |
| `fShoulder`, `bShoulder` | Upper arm relative to the torso, from hanging down: 0 down, 90 forward, 180 up, − = back. |
| `fElbow`, `bElbow` | 0 = straight, + = forearm folds forward/up. |
| `fHip`, `bHip` | Thigh relative to `rot`, from straight down: + = knee forward/up (90 = chambered), − = back. |
| `fKnee`, `bKnee` | 0 = straight, + = shin folds back. |
| `fAnkle`, `bAnkle` | 0 = foot at 90° to the shin; + = toes pointed (instep kick), − = toes up. Flat on the floor when `ankle = hip − knee − rot`. |
| `fHand`, `bHand` | 0 fist, 1 open hand (bow, knife-hand blocks). |
| `open` | Chest turn 0..1 (linear). 0 (default) = side-on profile: front shoulder leads, V-neck edge-on, knot at the front edge, slightly narrower jacket. 1 = chest opened to the viewer (3/4: full V, knot centred), e.g. rear punch, bow, win pose. |
| `back` | 1 = back turned to the viewer (spin): back limbs drawn near, back of head/hair, jacket back. Lerps; ≥ 0.5 = back view. |
| `turn` | Body yaw, degrees (shortest-way lerp: keyframes < 180 apart). 0 side-on, 90 chest to viewer, 180 back to the opponent (other side, facing away), −90/270 back to viewer, 360 side-on. Projects the limbs (foreshortening), picks near/far limbs by depth, blends the jacket profile → front/back, slides the knot. Spins go 0 → −90 → −180 (extension) → −270 → −360. |
| `headTurn` | Head yaw added to `turn` (spotting). The head view (profile R, front face, profile L, back of head) follows the quadrant of `turn + headTurn`. |
| `noFrontFace` | 1 = never show the camera-facing face: the frontal sector of the head yaw shows the profile toward the opponent instead (set on every spin keyframe). |
| `fHipOut`, `bHipOut`, `fArmOut`, `bArmOut` | Swing that limb's plane sideways (deg): 90 = the limb's forward angles now point out to the side (hook-kick sweep, splayed squat knees). |
| `armSwap`, `legSwap` | 1 = draw the back arm / leg near (hips or shoulders turned, e.g. rear roundhouse `legSwap: 1`, rear straight punch `armSwap: 1`). XOR with `back`. |
| `ground` | 0 = no auto-grounding (hip placed at `x, y`). |

`f` = front/lead limb (toward the opponent), `b` = back/rear. Draw order (back = 0): far arm, far leg, neck, near leg,
jacket + belt, near arm, head. The **stance** (Review 1: side-on, weight centred, hips between the feet): torso 1, head −2, open 0,
front arm 86/58, back arm 30/74, front leg 29/23/6 (flat), back leg −10/26/−24 (heel slightly up). `idle` and walk frames are built as offsets from the stance (`D({...})` in assets.js),
so retuning the stance moves them too. Use the **pose lab** in `Assets.html` to author poses and copy the JSON.

## Poses API (P4, `window.TKDPoses`, `poses.js`)

Full docs in the header of `poses.js`. Short version:

| Call | Notes |
|---|---|
| `sample(name, t)` | Pose for a move id (all 24 from moves.js, t = moveP 0..1 using moves.js timings) or a state name (t over one cycle/run). |
| `sampleMove(id, phase, phaseT)` | Same, driven by the engine's phase fields. |
| `forFighter(f, {time, threat})` | Engine fighter -> `{pose, expression, name}`. Walking uses `f.x*f.facing` for the stride (feet planted); jump pose from `f.vy`; optional `f.hitLevel` picks hit/hitBody/hitLow; `time` = seconds in state for idle/win/defeat/ko; `threat` picks olgul vs momtong block. |
| `expression(name)`, `duration(name)`, `keyFrames(id)`, `jumpY(sec)`, `info` (English/Korean names), `moveIds`, `stateNames` | |

- States: idle, walkFwd, walkBack, jump, duck, blockHigh/Mid/Low, hit, hitBody, hitLow, hitAir, blockstun, blockstunLow, bow, win, defeated, ko.
- Poses never contain jump height: the shell draws at `floor - f.y`. `pose.x` is a visual forward lunge (kicks 30-55, spins up to 56) that flips with `facing`.
- Moves: keyframes on phase axis 0..3 (startup/active/recovery); spins are interpolated with a monotone cubic over real seconds (`makeSpline`), not the per-segment ease; jump moves recover into the air tuck, low moves into the duck, spins go stance -> wind-up -> `back:1` -> extension (`open:1`).
- Heights checked headless against LEVEL_Y (HIGH 250 / MID 170 / LOW 60); spins and some kicks fall 20-40 units short of full `reach` (a slide-forward would look silly).

## Dev notes

- Visual checks: render to PNG with `@resvg/resvg-js` in the session scratch dir (`global.window = {}`, `require('./assets.js')`,
  `toSvg(drawFighter(...))`). Never install npm packages in the repo.
- Path transform supports only absolute `M L Q C Z` (circles are built from cubic curves) so mirroring and rotation are exact.

## Next

- **Review 1** (user): faces, proportions, limb length, gi, belts, random opponents, Dani's belt colour.
- P6: browser shell calls `TKDPoses.forFighter`. Not verified in a real browser yet (Moves section of Assets.html only syntax-checked + node smoke test).
