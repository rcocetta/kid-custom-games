# kid-custom-games

Small browser games made for kids. Your kid is the hero, and the scenery is your town. The kid
plays and tests every version, and their feedback shapes what gets fixed. The games are free to
play, run offline, and collect no data.

This repo is meant to be **forked**. Swap in your own kid, characters and places, and you get a
private games site on GitHub Pages that your kid can install on a phone or tablet like an app.

## The games

| Game | What it is |
|------|------------|
| 🛴 **[jumpnduck](jumpnduck/)** | Endless runner. Ride a scooter along the seafront, jump over obstacles, duck under seagulls and grab food for points. **Keys:** Space/↑ to jump, ↓ to duck. **Touch:** tap the top half to jump, hold the bottom half to duck. |
| 🥋 **[taekwondo](taekwondo/)** | One-player taekwondo against the computer. *Tournament*: work up the belts from white to black, best of 3 rounds. *Practice*: pick the opponent's belt, with no damage and no timer. **Keys:** arrows to move, A/S to punch, Z/X to kick, hold back to block. **Touch:** joystick plus attack buttons. |

Each game has a `STATE.md` describing how it works and what's left to do.

## How it's built (and why it's easy to change)

- **Plain HTML, CSS and JavaScript.** No npm, no bundler, no framework. Every game is one
  `index.html` plus a few `.js` files.
- **The art is drawn in code.** Characters and backgrounds are canvas drawings in each game's
  `assets.js`, and the sounds are synthesised in `audio.js`. There are no image or sound files
  to replace.
- **Works offline and from `file://`.** Double-click `index.html` and the game runs.
- **No data collection.** No analytics, ads, accounts or network calls. High scores and progress
  stay in the browser's `localStorage`, and each game has a reset button.
- **Phone, tablet and keyboard.** Every game has touch controls.

The ground rules for every game are in [CLAUDE.md](CLAUDE.md). Keep them if you add games.

## Make it yours

### 1. Fork and publish (about 5 minutes)

1. Click **Fork** on GitHub.
2. In your fork, go to **Settings → Pages → Build and deployment → Source** and choose
   **GitHub Actions**.
3. Push a change to `main`, or run the **Build and deploy Pages** workflow from the Actions tab.
4. Your site will be at `https://<your-username>.github.io/<repo-name>/`.

The workflow ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)) runs `build.sh` on
every pull request as a check, and deploys only what's on `main`. Work on a branch, open a PR,
and merge when the game is ready for your kid.

> **Privacy tip:** a GitHub Pages site is public, even when the repo is private (unless you're on
> a paid plan with private Pages). Think twice before putting your kid's full name, photo or
> street on it. A nickname and cartoon drawings are fine.

### 2. Try it locally

```bash
open jumpnduck/index.html      # or just double-click it
./build.sh                     # optional: builds the full site into docs/ to preview
```

`docs/` is generated and git-ignored, so don't commit it.

### 3. Change the hero, the names and the places

The easiest wins, roughly in order:

| What | jumpnduck | taekwondo |
|------|-----------|-----------|
| Game title (also used on the home page) | `<title>` and `<h1>` in `index.html` | `<title>` and `<h1>` in `index.html` |
| Home-page emoji | add `<meta name="game-emoji" content="🚀">` to `index.html` (default 🛴) | `<meta name="game-emoji">` in `index.html` |
| The player character | `kid`, `kidDuck`, `head`, `kidFace` drawings in `assets.js` | `LOOKS` in `assets.js` (name, skin, hair, gi, belt, build) |
| Opponents | – | `NAMES` and the opponent generator in `assets.js`, belt names in `cpu.js` |
| Scenery | background drawings in `assets.js` (boats, old town, landmarks, sun…) | `arena.js` |
| Colours | palette at the top of `assets.js`, page colours in the `:root` CSS of `index.html` | CSS variables in `index.html`, palettes and `GIS` (gi colours) in `assets.js` |
| Difficulty | constants at the top of `game.js` (`SPEED_START`, `SPEED_MAX`, `JUMP_V`, `GRAVITY`, `MIN_GAP`, …) | `HARDER` in `cpu.js`, move speeds and damage in `moves.js` |
| Sounds | – (silent) | `audio.js` |

Adding a third playable taekwondo character means adding it to `LOOKS`, adding a pick button in
`index.html`, and allowing it in the character check in `game.js` (search for `'dani'`).

**Preview pages help.** Open these straight from your file browser while you edit:

- `jumpnduck/Assets.html` shows every sprite plus an animated scene.
- `taekwondo/Assets.html` links to `Characters.html` (looks and belts), `Arena.html` (background),
  `Moves.html` and `States.html` (animations), `Sounds.html` (every sound) and `Poser.html`
  (a pose editor with sliders; see `SPEC.md` for the pose format).

### 4. Add your own game

1. Create a new top-level folder with an `index.html`, e.g. `space-hopper/index.html`.
2. Give it a `<title>` and, if you like, a `<meta name="game-emoji" content="🚀">`.
3. That's it: `build.sh` finds every top-level folder with an `index.html` and adds it to the
   home page.

Rules that keep it working on GitHub Pages:

- Use **relative paths only** (`assets.js`, `../`), never paths starting with `/`.
- Filenames are **case-sensitive** online, even if your computer doesn't care.
- Load extra files with a plain `<script src="game.js">` so the game also works from `file://`.
- If you save anything, use `localStorage` under a per-game prefix (`space-hopper:best`), wrap
  every access in `try/catch`, and add a reset button.
- Files ending in `.md` and any `test/` folder are not published.

### 5. Building with an AI assistant

These games were built together with an AI coding assistant ([Claude Code](https://claude.com/claude-code)).
[CLAUDE.md](CLAUDE.md) holds the project rules and each game's `STATE.md` holds its details, so an
assistant picks up the context on its own. Describe changes in plain words ("make the
seagulls slower", "add a purple belt"), then hand the game to your kid to test.

## Repo layout

```
jumpnduck/      game: index.html, game.js, assets.js, fonts/, STATE.md
taekwondo/      game: index.html, game.js, assets.js, arena.js, moves.js, cpu.js, audio.js,
                review pages (*.html), test/, STATE.md, SPEC.md
site/           home-page app files: manifest, service worker (offline), icons
build.sh        copies games into docs/ and writes docs/index.html
.github/        CI: build on PRs, deploy main to GitHub Pages
```

### Tests

The taekwondo game has a few Node tests (no dependencies, Node 18+):

```bash
node --test taekwondo/test/
```

Some of the computer-opponent tests take several minutes.

### Home-page app

`site/` makes the home page installable ("Add to Home Screen" on iOS/Android, "Install" in
Chrome), and its service worker caches the site for offline play. To change the icons, edit
`site/make_icons.py` and run `python3 site/make_icons.py`. See [site/README.md](site/README.md).

## License

- **Code** (HTML/JS/shell, `site/`): MIT.
- **Artwork** (characters, sprites, backgrounds, i.e. the drawings in each game's `assets.js`):
  all rights reserved, personal non-commercial use only. You may fork the repo and run the games
  for your own family. To publish your own version, replace the characters and scenery with your
  own drawings. That's the fun part anyway.
- **Fonts**: [Fredoka](https://fonts.google.com/specimen/Fredoka), SIL Open Font License 1.1
  (see `jumpnduck/fonts/OFL.txt`).

See [LICENSE](LICENSE) for details, including the note on the *Nomade* sculpture by Jaume Plensa.
