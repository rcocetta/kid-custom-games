# Taekwondo Master — build plan

1-player vs CPU side-view fighting game. **Spec: `SPEC.md`** (the user's brief). This plan adds the
user's answers, the design decisions, and the phases to run with subagents.
Every agent reads `../CLAUDE.md` (ground rules), `SPEC.md` and this file first.

Branch: `taekwondo-master`. Folder: `taekwondo/`. Title: **Taekwondo Master**.

---

## 1. Decisions

### From the user (2026-11-20)
- **Dani** = the user's wife (playable character, pink gi). **Oli** = same kid as Oli's Scooter Dash, white gi, blue belt.
- **Attack height matters** (see Combat rules).
- **Damage:** low and jumping versions = same as base move. **Spinning kicks = +20 %.**
- **Block:** holding *back* is enough, **but only at the right height**. Blocked hit = **20 % damage** (was half; changed at Review 3).
- **Difficulty (Review 3):** "too easy" (Oli lost at Blue on the first go) → CPU made 20 % harder (`HARDER = 1.2` in `cpu.js`).
- **Rounds:** KO (energy 0) **or** 120 s timer (more energy left wins the round). Best of 3.
- **Losing a match:** retry the **same belt**. Progress is saved (localStorage).
- **Beating the Black belt:** **trophy screen**.
- **Arena:** **outdoor training hall** with the **Antibes background**.
- **Sound:** yes, nice fighting sounds (with a mute toggle).
- **Landscape only** (portrait → "turn your phone" screen and pause).
- Agreed: physical-key controls, posable rig, CPU difficulty per belt, model split, review pauses.

- **Standing punches go for the face** (HIGH, Review 2) — so ducking dodges them. The duck must be deep and obvious.

### Design defaults (change at a review if wanted)
- **Spinning punches** keep base damage (the user only said spinning *kicks* get +20 %). Confirm at Review 1.
- **Round draw** (equal energy at time-up): replay the round.
- **Taekwondo is barefoot**: bare feet, V-neck dobok, belt with knot and two tails. No body armour (it would hide the gi colours).
- **Opponent looks** are random per match: skin {light, dark, East Asian (eye shape + black hair)}, gender (hair/face cues, subtle), hair {short, long loose, ponytail}, hair colour fits skin. Green gi, belt = level.
- **Sounds** are synthesised with WebAudio (no files, nothing to download). Optional later: a real recorded "kiai!" by Oli, committed as a small audio file.
- **Offline:** the site's service worker caches each file the first time it's fetched, so the game works offline after it's been opened once. Everything is drawn in code, so the size stays tiny (< 200 KB) and no download strategy is needed.

---

## 2. Combat rules

Three attack levels: **HIGH** (head), **MID** (body), **LOW** (legs).

| Input | Move | Level | Damage |
|---|---|---|---|
| A/Q | back-hand punch (straight, to the face) | HIGH | 6 |
| S | front-hand punch (jab, to the face) | HIGH | 4 |
| Z/W | back-leg kick (roundhouse, *dollyo chagi*) | MID | 10 |
| X | front-leg kick (front-leg / cut kick) | MID | 8 |
| Up + attack | jumping version | HIGH | same |
| Down + attack | low version (low punch / low kick) | LOW | same |
| Back + front limb | spinning, head height (spin hook kick / spinning backfist) | HIGH | kick ×1.2 |
| Back + back limb | spinning, body height (spinning back kick *dwit chagi* / spinning back punch) | MID | kick ×1.2 |
| Back + Up/Down + attack | jumping spinning (HIGH) / low spinning sweep (LOW) | | kick ×1.2 |

(Back is relative to facing. See `research.md`. The **button** picks the target height; the **animation** uses the real technique:
both spinning kicks are really kicked with the rear leg (spin hook kick → head, spinning back kick → body). Taekwondo has no spinning punches
and bans head punches / low strikes in WT sparring: in this game they're deliberate game-only moves (spinning backfist → head, spinning back punch → body).)

- **Block** = holding back when the hit lands. **Standing** block covers HIGH + MID; **ducking** block covers LOW + MID.
  So jump attacks must be blocked standing, low attacks must be blocked ducking.
- **Dodges:** a ducking fighter is not hit by HIGH attacks; a jumping fighter is not hit by LOW attacks.
- Holding back while *pressing* an attack makes it spin (it doesn't block during the attack).
- Each attack has **startup → active → recovery** times (spinning = slower startup and longer recovery: risky).
- **Hit:** short hit-stun (~0.25 s) + small knockback. **Blocked:** 20 % damage, shorter block-stun, pushback.
  Fighters can't overlap or leave the arena.
- Hit detection uses **reach + level** per move (attacker within the move's reach during active frames,
  level vs defender state), not pixel hitboxes. Simple and predictable.
- Energy 100 each. **Practice mode:** vs White belt, no damage, no timer, no rounds; Esc to leave.

### CPU difficulty per belt
One table of parameters, interpolated from White → Black:

| Param | White | Black | Meaning |
|---|---|---|---|
| `reactionMs` | 650 | 150 | delay before the CPU reacts to what the player started |
| `blockChance` | 0.10 | 0.75 | chance to block an incoming attack… |
| `blockRightHeight` | 0.50 | 0.95 | …and to pick the right height |
| `accuracy` | 0.35 | 0.90 | attacks only from the right distance |
| `aggression` | 0.25 | 0.70 | how often it attacks vs waits |
| `comboChance` | 0 (until Green) | 0.50 | 2–3 move strings |
| `spinChance` | 0 (until Orange) | 0.30 | uses spinning moves |
| `speedMul` | 0.85 | 1.10 | walk / attack speed |

The CPU only "sees" the game state (no reading of input in advance). Checked by a headless simulation:
win rate of a scripted player must drop steadily belt after belt.

---

## 3. Architecture

Files (all plain `<script src>`, works from `file://`):

| File | Role |
|---|---|
| `index.html` | Canvas + DOM overlays (title, mode, character select, belt ladder, HUD, pause, Esc confirm, round/match cards, trophy, rotate notice, touch controls). Inline CSS. |
| `assets.js` | Drawing: palette, **fighter rig**, looks, portraits, belts, UI art (trophy, belt badges). `window.TKDAssets`. |
| `arena.js` | Outdoor Antibes training hall, as layers (sky / far / hall / floor) + `floorY`, `minX/maxX`. `window.TKDArena`. Review page `Arena.html`. |
| `poses.js` | Pose data (joint angles) + move definitions (keyframes, timings, reach, level, damage). `window.TKDPoses`. |
| `game.js` | DOM-free core `createFight()` (sim, rounds, match) + browser shell (input, loop, screens, storage). `window.TKD`. |
| `cpu.js` | `createCpu(beltParams, rand)` → returns an input object each frame from the game state. Headless-testable. |
| `audio.js` | WebAudio synthesised sounds + mute. |
| `Assets.html` | Review page: every look, belt, pose and move playing in a loop, with a look randomiser and a pose-slider panel. |
| `fonts/Fredoka.ttf` | Copied from `jumpnduck/`. |
| `STATE.md` | Working state, kept up to date by every phase. |

**Fighter rig.** A skeleton (hips, torso, neck/head, 2 × upper arm/forearm/fist, 2 × thigh/shin/foot)
with joint angles + root position. Forward kinematics → a list of **primitives** `{d, fill, stroke, width}`
(SVG path data). The same primitive list is:
- drawn on canvas in the game (`new Path2D(d)`), every frame, and
- serialised to an SVG string (Assets.html, and PNG contact sheets rendered headless with `@resvg/resvg-js`).

Style = Oli's Scooter Dash (`jumpnduck/assets.js`): thick `#2E2A36` outline (width 4), outlined round-capped limbs
(outline stroke under a fill stroke), big head, dot eyes, pink cheeks — **but longer arms and legs**.
Copy what's needed (Oli's head/hair/face, background tiles) into `taekwondo/assets.js`; don't load files from `../jumpnduck/`.
Facing left = mirrored. Draw order handles the far limbs (slightly darker gi shade) behind the body.
Poses are **interpolated** between keyframes (eased), so animations are smooth with few keyframes.

**Keyboard:** `event.code` (physical keys) → works the same on QWERTY and AZERTY:
`KeyA` back punch, `KeyS` front punch, `KeyZ` back kick, `KeyX` front kick (= Q/S/W/X on AZERTY),
arrows move/jump/duck, `KeyP` pause, `Escape` → "Leave the fight?" confirm.
**Touch:** semi-transparent round joystick bottom-left (4 directions + dead zone), buttons bottom-right:
top row [back punch][front punch], bottom row [back kick][front kick]; pause button top. Multi-touch.

**Storage** (`try/catch` everywhere, reset button on the title screen): `taekwondo:progress` (current belt, chosen character),
`taekwondo:trophies` (tournaments won), `taekwondo:mute`.

**Screens:** title → mode (Tournament / Practice) → character (Oli / Dani) → belt ladder ("vs Yellow belt", opponent portrait)
→ fight ("Round 1 — Fight!", HUD: two energy bars with portraits, round pips, timer, opponent belt) → round end → match end
(win: bow + win pose → next belt; lose: KO/defeat pose → retry) → trophy after Black.

---

## 4. Phases and agents

Model choice: **Haiku** for research, mechanical work and checks; **Sonnet** for code and pose authoring;
**Opus** only for the character design (where looks matter most) and for fixes Sonnet can't nail after a review.
Each agent: works only in `taekwondo/` (unless stated), updates `STATE.md`, commits on the branch, reports back briefly.
Renders/scratch files go in the session scratchpad, not the repo.

| # | Phase | Agent / model | Depends on | Output |
|---|---|---|---|---|
| P1 | **Taekwondo research** | general-purpose · **haiku** (web) | — | `research.md`: for each move (stance/guard, punches, front-leg & rear-leg kick, spin hook kick, spinning back kick, sweep, blocks high/mid/low *makki*, bow, win pose ideas): real name, what the body does at chamber / extension / retract, rough timings. Written as body-position notes a pose author can turn into angles. |
| P2 | **Rig + looks + stance** | general-purpose · **opus** | P1 | `assets.js` rig + primitives → canvas/SVG; Oli (white gi, blue belt), Dani, opponent look generator, 8 belts, front portraits for the HUD, fighting stance + idle bounce; first `Assets.html`; PNG contact sheet. |
| P3 | **Arena** | general-purpose · **sonnet** | — (parallel with P2) | Outdoor training hall (wooden deck, mats, roof posts / pergola) in front of the Antibes tiles (mountains, sea, old town, sun) copied from `jumpnduck`. Static arena sized for the fight. |
| ⏸ | **REVIEW 1 — characters & arena** | the user | P2, P3 | Look at the contact sheet / `Assets.html`: faces, proportions, limb length, gi, belts, random opponents, arena. Iterate (Sonnet for tweaks, Opus if the drawing needs rework) until approved. |
| P4 | **All poses & moves** | general-purpose · **sonnet** | Review 1 | `poses.js`: walk fwd/back, jump, duck, 3 blocks, hit/stagger, all attacks (standing, jumping, low, 4 spinning × 3 heights), bow, win, defeated, KO (dazed with stars, kid-friendly). Animated in `Assets.html`; contact sheet of key frames. |
| P5 | **Fight engine (core)** | general-purpose · **sonnet** | P1 (parallel with P2–P4, uses placeholder timings) | `createFight()` in `game.js`: states, move timings, reach/level hit resolution, block, dodge, damage, knockback, timer, rounds, match, practice flags. Headless node tests (`node:assert`, no deps). |
| ⏸ | **REVIEW 2 — moves** | the user | P4 | Watch every move animate in `Assets.html`. Iterate on poses (Sonnet; Opus for stubborn ones). Confirm spinning-punch damage. |
| P6 | **Browser shell** | general-purpose · **sonnet** | P5, Review 2 | Rendering with the rig, all screens, keyboard + touch controls, HUD, pause/Esc, landscape, storage + reset. |
| P7 | **CPU** | general-purpose · **sonnet** | P5 | `cpu.js` + belt table; headless win-rate simulation per belt. |
| P8 | **Sound** | general-purpose · **haiku** | P6 | `audio.js`: whoosh, punch thump, kick thwack, block clack, KO, round bell, win jingle, menu blip; mute button. |
| ⏸ | **REVIEW 3 — play it** | the user | P6–P8 | Play on desktop and phone (`python3 -m http.server` on the LAN for the phone). Tune difficulty, speed, controls. |
| P9 | **Checks & ship** | general-purpose · **haiku** (+ code-reviewer · **sonnet**) | Review 3 | Ground-rules audit (no network calls, relative paths, exact filename case, storage try/catch, works from `file://`), `./build.sh` runs, `build.sh` must not publish `test/` folders, card emoji for the home page (done: `<meta name="game-emoji">`, 🥋), final `STATE.md`, PR. |

Parallelism: P2 ∥ P3 ∥ P5 after P1; P7 ∥ P6 after P5.

---

## 5. Refinement backlog (come back after Review 3)
- Spinning moves: still not fully natural (head now leads the body by a quarter turn; try a third, timing of the spot). Spinning punches read weaker than the kicks.
- Deep duck looks a bit hunched/kneeling; maybe a more upright squat.
- Reach: spinning and rear kicks are drawn 20–40 units short of their gameplay `reach`.
