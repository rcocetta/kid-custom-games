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

## 3. Every game has the same "shell"

New games must ship these from the start (all three existing games do; copy from them):

- **Home-page cover** — `<game>/cover.svg`, 400×260, a little scene composed from the game's
  own drawings (character in action + its background), not an emoji. `build.sh` shows it on
  the game's card; without it the card falls back to the `game-emoji` meta. Put the artwork
  copyright comment at the top, like the other covers. Make it by loading the game's asset
  scripts in a page, nesting their SVG strings at fixed x/y/width/height inside one
  `viewBox="0 0 400 260"` SVG, and saving the result (throwaway script in the scratchpad;
  only the SVG is committed). Check it renders next to the other cards.
- **Splash / title screen** with:
  - a **readable title**: bright fill + thick dark outline, as in Whack-a-m-Oli's `h1`
    (`color: #3CC75A; -webkit-text-stroke: clamp(6px, 2vh, 11px) var(--ink); paint-order: stroke fill;`).
    Never a green outline on green text.
  - a **home button** top-left: the `.home-btn` link (round white button with the house
    SVG, `href="../index.html"`, `aria-label="All games"`) copied from any existing game,
    placed inside the splash element so it only shows on the splash, never during play. If
    the splash starts the game on "tap anywhere", that handler must ignore `.home-btn`.
- Check the splash in phone landscape (844×390 and 667×320) and on desktop: the title, the
  home button and the start button must all fit without overlapping.

## 4. Hosted on GitHub Pages

- Games are developed in their own folders. `./build.sh` copies each game's runtime files into
  `docs/<game>/` and regenerates `docs/index.html` (the list of games). It is a plain copy step
  (no bundling/compiling).
- The home page is installable as an app: `site/` holds its manifest, service worker (offline
  cache of this site's own files only) and icons; `build.sh` copies them into the root of `docs/`.
- **CI publishes, not people**: `.github/workflows/pages.yml` runs `build.sh` on every PR (build
  check only) and on every push to `main` builds and deploys `docs/` to GitHub Pages. So only what
  is merged to `main` goes live — keep unfinished work on branches.
- `docs/` is generated and git-ignored: never commit it or edit it by hand. Run `./build.sh`
  locally only to preview the published site.
- Use **relative paths only** (`assets.js`, `../`), never absolute `/...` — the site lives
  under `/<repo-name>/`.
- Paths are case-sensitive on Pages: the reference must match the filename exactly.
- No server-side features: no redirects, rewrites, custom headers, or server code.
