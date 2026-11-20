# Taekwondo Master — working state

1-player vs CPU side-view taekwondo fighting game. Spec: `SPEC.md`; plan and phases: `PLAN.md`; move notes: `research.md`.

**Status (2026-11-20):** Review 1 feedback applied (side-on balanced stance, `open` chest-turn key, boys short hair). P2 done (fighter rig, looks, stance/idle/walk, portraits, belt badges, review page).
Waiting for **Review 1** (characters & arena). Verified headless only (no real browser in this env).

## Files

| File | What it is | Phase |
|---|---|---|
| `assets.js` | Palette, **fighter rig**, looks, portraits, belt badges. `window.TKDAssets`. Plain `<script src>`, works from `file://`. | P2 |
| `Assets.html` | Review page: Oli + Dani (both facings, back view), 8 random opponents + Reroll, portraits (5 expressions), belt ladder, idle/walk animated on canvas, **pose lab** (one slider per pose key, live preview, copy/load pose JSON). | P2 |
| `fonts/Fredoka.ttf` | Copied from `jumpnduck/`, loaded with `@font-face`. | P2 |
| `arena.js`, `Arena.html` | Outdoor Antibes training hall (`window.TKDArena`). | P3 |
| `game.js`, `moves.js`, `test/` | Fight engine core + tests. | P5 |

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
| `armSwap`, `legSwap` | 1 = draw the back arm / leg near (hips or shoulders turned, e.g. rear roundhouse `legSwap: 1`, rear straight punch `armSwap: 1`). XOR with `back`. |
| `ground` | 0 = no auto-grounding (hip placed at `x, y`). |

`f` = front/lead limb (toward the opponent), `b` = back/rear. Draw order (back = 0): far arm, far leg, neck, near leg,
jacket + belt, near arm, head. The **stance** (Review 1: side-on, weight centred, hips between the feet): torso 1, head −2, open 0,
front arm 86/58, back arm 30/74, front leg 29/23/6 (flat), back leg −10/26/−24 (heel slightly up). `idle` and walk frames are built as offsets from the stance (`D({...})` in assets.js),
so retuning the stance moves them too. Use the **pose lab** in `Assets.html` to author poses and copy the JSON.

## Dev notes

- Visual checks: render to PNG with `@resvg/resvg-js` in the session scratch dir (`global.window = {}`, `require('./assets.js')`,
  `toSvg(drawFighter(...))`). Never install npm packages in the repo.
- Path transform supports only absolute `M L Q C Z` (circles are built from cubic curves) so mirroring and rotation are exact.

## Next

- **Review 1** (user): faces, proportions, limb length, gi, belts, random opponents, Dani's belt colour.
- P4: `poses.js` with all moves using this rig (rear kicks probably want `legSwap: 1`; spins use `back`).
