# Whack-a-m-Oli — build plan

1-player arcade game. **Spec: `SPEC.md`** (the user's brief). This plan adds the user's answers, the design
defaults and the phases run with subagents. Every agent reads `../CLAUDE.md` (ground rules), `SPEC.md` and this file first.

Branch: `whackamoli`. Folder: `whackamoli/`. Title: **Whack-a-m-Oli**. Card emoji: 🔨.

---

## 1. Decisions

### From the user (2026-11-23)
- **Side view.** A grass strip along the bottom of the screen. Moles pop out of the grass and walk left/right along it.
  Food sits on the grass. Background and style are the same as `jumpnduck` (Antibes: sky, mountains, sea, old town, sun).
- **Gondola** = an open cable-car basket hanging from a pulley on a cable across the top of the screen. Oli (same design as
  jumpnduck) is visible from the waist up and throws over the edge. The basket slides along the cable.
- **Hammer throw (for now: "arc forward")**: the hammer is thrown in an arc in the direction Oli faces, which is the last
  direction he moved. It spins while it flies. The user will define the final hammer rules later.
- **Sound:** synthesised WebAudio (like taekwondo) with a mute toggle. **Landscape only** (portrait → "turn your phone" + pause).

### Rules (from SPEC.md)
- Each mole hit = **100 points**. Moles eat **5 foods → game over**.
- A mole comes out of the grass and first walks **away** from the food (moles are blind). When it reaches the edge of the
  screen it turns around and walks back to eat it.
- Food: carrot, broccoli, steak, at a random x on the grass, far from where the mole comes out but reachable. One at a time,
  and **2 at a time** at higher levels.
- Level 1: one mole every **3 s**, moving slowly. **Every 1000 points = next level**: moles come out more often and move faster.

### Design defaults (change at a review if wanted)
- **Hammer arc:** fixed throw speed + gravity, plus the gondola's own speed, so a still throw always lands the same distance
  ahead. A faint dotted landing marker on the grass helps a young kid aim (it can be turned off at a review).
  Short cooldown (~0.35 s), at most 3 hammers in the air. A hammer hits a mole if it lands on it (or touches it on the way down).
  Hitting the grass: small dirt puff, the hammer disappears.
- **Mole states:** emerge (dirt mound + pop up, ~0.4 s, can't be hit yet) → walk away → turn at the edge → walk to the food →
  eat (~1 s munching, can still be hit, so the kid has a last chance) → dive back down. When hit: bonk, dizzy stars, "+100",
  dives into the ground. Moles walk on the grass line (no 2D depth).
- **Food:** eaten food disappears with a crumb puff, the "food left" counter drops, and a new food appears after ~1.5 s
  (at a different place). Food doesn't move. If several moles want the same food, they all go for it.
- **Levels:** every level the spawn interval ×0.85 (min 0.9 s) and mole speed ×1.12 (with a cap). 2 foods from **level 3**.
  "LEVEL 2!" banner on level up.
- **HUD:** score pill with `kidFace()` (like jumpnduck), level, and the **lives: 5 carrots** (user, 2026-11-23) in a white
  pill, top left (`WAMField.foodIcon('carrot', eaten)`); each food a mole eats turns one carrot grey with a bite, with a little pop.
- **Hammer throw (user, 2026-11-23):** shorter, softer throw, and it must accelerate down hard: gravity 1600, throw 135 forward /
  240 up → a still throw lands ~117 units ahead in ~0.7 s.
- **Best score** in `localStorage` key `whackamoli:best`, mute in `whackamoli:mute`, reset button on the title screen.
- **Keyboard:** ←/→ (and A/D) move, Space throws (keydown edge, holding repeats at the cooldown rate), Space/Enter
  starts and restarts, P / Esc pause.
- **Touch:** dragging a finger moves the gondola (relative drag, follows the finger) and sets the facing; a **tap** (short,
  hardly moved) throws. Mouse works the same way.

---

## 2. Architecture

Files (all plain `<script src>`, works from `file://`, nothing loaded from `../jumpnduck/`):

| File | Role |
|---|---|
| `index.html` | Canvas + DOM overlays (title, HUD, pause, game over, rotate notice, mute). Inline CSS. Fredoka font. |
| `assets.js` | `window.WAMAssets`: palette + helpers, Oli in the gondola (poses), gondola + cable + pulley, hammer, `kidFace()`, `scorePopup()`, background tiles (copied from `jumpnduck/assets.js`), `toDataUrl()`. |
| `field.js` | `window.WAMField`: grass strip tile, mole (all frames), dirt mound / hole, dirt puff, dizzy stars, food (carrot, broccoli, steak, copied from jumpnduck), grey "eaten" food icon for the HUD. |
| `Assets.html` | Review page: every sprite + an animated preview scene (gondola slides, hammer spins in an arc, a mole walks, turns, eats). |
| `game.js` | DOM-free core `createGame({rand})` (update/render/events, like jumpnduck) + browser shell (input, loop, screens, storage). `window.WhackAMOli`. |
| `audio.js` | WebAudio sounds + mute. |
| `STATE.md` | Working state (updated by me after each phase). |

**Style** = Oli's Scooter Dash: thick `#2E2A36` outline (width 4), outlined round-capped limbs, big head, blonde, green eyes,
green tee, dot eyes and pink cheeks on everything friendly. Moles are cute (never scary or hurt-looking; bonked = dizzy stars).

**World units:** height `H = 400`, width from the screen aspect (landscape). Cable near y≈40, grass top near y≈350.

---

## 3. Phases and agents

Model choice: **Opus** for Oli/gondola (the likeness matters most), **Sonnet** for other art and code, **Haiku** for sound,
mechanical checks and audits. Agents work only in `whackamoli/`, don't commit (I commit between phases), keep renders and
scripts in the session scratchpad, and report back briefly.

| # | Phase | Agent / model | Depends on | Output |
|---|---|---|---|---|
| A1 | **Oli + gondola + hammer** | general-purpose · **opus** | — | `assets.js`: Oli waist-up in the basket facing left/right, poses `idle`, `windup`, `throw`, `cheer` (level up), `sad` (game over); gondola, pulley, cable tile; spinning hammer (frames or one sprite rotated on canvas); `kidFace`, `scorePopup`, background tiles copied from jumpnduck. PNG contact sheet. |
| A2 | **Field + moles + food** | general-purpose · **sonnet** | — (parallel with A1) | `field.js`: grass strip tile, mole frames (`emerge`, `walk1`, `walk2`, `turn`, `eat1`, `eat2`, `bonk`, `dive`), mound/hole, dirt puff, stars, food ×3 + greyed HUD icon. PNG contact sheet. |
| C1 | **Game core** | general-purpose · **sonnet** | — (parallel, placeholder shapes) | `createGame()` in `game.js`: gondola movement, facing, hammer arc + cooldown, landing marker, mole AI (emerge/away/edge/return/eat/dive), food spawn, hits, score, levels, game over, events. Headless node tests (`node:assert`). |
| A3 | **Assets.html** | general-purpose · **sonnet** | A1, A2 | Review page + animated preview scene. |
| ⏸ | **REVIEW 1 — art** | the user | A3 | Oli and the gondola, mole, hammer, grass, food. Iterate (Sonnet tweaks, Opus for Oli). |
| C2 | **Browser shell** | general-purpose · **sonnet** | C1, Review 1 | Rendering with the sprites, screens, keyboard + touch, HUD, pause, landscape, storage + reset. Playwright screenshots (phone + desktop). |
| C3 | **Sound** | general-purpose · **haiku** | C2 | `audio.js`: throw whoosh, bonk, dirt pop, munch, food lost, level up, game over, menu blip; mute button. |
| ⏸ | **REVIEW 2 — play it** | the user | C2, C3 | Play on desktop and phone. Tune speeds, spawn rates, hammer arc, controls. Final hammer rules from the user. |
| S1 | **Checks & ship** | general-purpose · **haiku** + code-reviewer · **sonnet** | Review 2 | Ground-rules audit (no network, relative paths, filename case, storage try/catch, `file://`), `./build.sh`, card emoji, final `STATE.md`, PR (the user merges). |

Parallelism: A1 ∥ A2 ∥ C1 now; A3 after A1+A2; C2 after C1 + Review 1; C3 after C2.
