# kid-custom-games — ground rules

These apply to **every game** in this repo. Per-game details live in each game's `STATE.md`.

## 1. No data collection

- Nothing leaves the device. No analytics, telemetry, tracking pixels, crash reporting,
  ads, accounts, logins, or backend/API calls of any kind.
- No `fetch`/XHR/WebSocket/beacon to send data anywhere.
- Client-side state is fine when it makes the game more fun: high scores, best streaks,
  unlocked items, "games played", the kid's chosen name/colour, settings (sound on/off).
  - Store it in `localStorage` only, under a per-game key prefix (e.g. `jumpnduck:best`).
  - Wrap every read/write in `try/catch`; the game must work fine if storage is
    empty, blocked, or throws (private mode, `file://`).
  - Offer a way to reset it (e.g. a "reset scores" button) when a game stores anything.

## 2. Each game is a single-page static HTML app

- One folder per game, entry point `<game>/index.html`. Everything runs in that one page —
  screens (menu, play, game over) are switched in JS, not by navigating to other pages.
- Plain HTML/CSS/JS. No build step, no bundler, no npm dependencies at runtime, no frameworks
  that need compiling. Extra local files (`game.js`, `assets.js`) are fine, loaded with plain
  `<script src="...">` so the game also works when opened straight from `file://`.
- Assets are drawn in code (SVG/canvas) or committed to the repo. No hotlinking.
- Must work on a phone/tablet (touch controls) as well as with a keyboard.

## 3. Hosted on GitHub Pages

- Games are developed in their own folders. `./build.sh` copies each game's runtime files into
  `docs/<game>/` and regenerates `docs/index.html` (the list of games). It is a plain copy step
  (no bundling/compiling).
- **CI publishes, not people**: `.github/workflows/pages.yml` runs `build.sh` on every PR (build
  check only) and on every push to `main` builds and deploys `docs/` to GitHub Pages. So only what
  is merged to `main` goes live — keep unfinished work on branches.
- `docs/` is generated and git-ignored: never commit it or edit it by hand. Run `./build.sh`
  locally only to preview the published site.
- Use **relative paths only** (`assets.js`, `../`), never absolute `/...` — the site lives
  under `/<repo-name>/`.
- Paths are case-sensitive on Pages: the reference must match the filename exactly.
- No server-side features: no redirects, rewrites, custom headers, or server code.
