# kid-custom-games

Small browser games made for kids. Your kid is the hero, and the scenery is your town. Your kid
plays and tests every version, and their feedback shapes what gets fixed. The games are free to
play, run offline, and collect no data.

This repo is meant to be **forked**. Swap in your own kid, characters and places, and you get a
private games site on GitHub Pages that your kid can install on a phone or tablet like an app.

## The games

| Game | What it is |
|------|------------|
| 🛴 **[jumpnduck](jumpnduck/)** | Endless runner. Ride a scooter along the seafront, jump over obstacles, duck under seagulls and grab food for points. **Keys:** Space/↑ to jump, ↓ to duck. **Touch:** tap the top half to jump, hold the bottom half to duck. |
| 🥋 **[taekwondo](taekwondo/)** | One-player taekwondo against the computer. *Tournament*: work up the belts from white to black, best of 3 rounds. *Practice*: pick the opponent's belt, with no damage and no timer. **Keys:** arrows to move, A/S to punch, Z/X to kick, hold back to block. **Touch:** joystick plus attack buttons. |
| 🔨 **[whackamoli](whackamoli/)** | Arcade. Ride a cable-car gondola over a field and throw hammers at the moles before they eat your food. Five lives, and it speeds up every 1000 points. **Keys:** ←/→ or A/D to move, Space to throw, P/Esc to pause, M to mute. **Touch:** drag to move, tap to throw (landscape only). |

Each game has a `STATE.md` describing how it works and what's left to do.

## How it's built (and why it's easy to change)

- **Plain HTML, CSS and JavaScript.** No npm, no bundler, no framework. Every game is one
  `index.html` plus a few `.js` files.
- **The art is drawn in code.** Characters and backgrounds are drawings in each game's
  `assets.js` (plus `field.js` in Whack-a-m-Oli), and the sounds are synthesised in `audio.js`.
  The only image file is each game's `cover.svg` for the home page, and it is put together from
  those same drawings.
- **Works offline and from `file://`.** Double-click `index.html` and the game runs.
- **No data collection.** No analytics, ads, accounts or network calls. High scores and progress
  stay in the browser's `localStorage`, and each game has a reset button.
- **Phone, tablet and keyboard.** Every game has touch controls.
- **Same look everywhere.** The home page shows a picture card for each game, and every game's
  start screen has a bold outlined title and a round 🏠 button back to the list of games.

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

| What | jumpnduck | taekwondo | whackamoli |
|------|-----------|-----------|------------|
| Game title (also used on the home page) | `<title>` and `<h1>` in `index.html` | `<title>` and `<h1>` in `index.html` | `<title>` and `<h1>` in `index.html` |
| Home-page picture | `cover.svg` (see [Home-page cover](#home-page-cover)) | `cover.svg` | `cover.svg` |
| The player character | `kid`, `kidDuck`, `head`, `kidFace` drawings in `assets.js` | `LOOKS` in `assets.js` (name, skin, hair, gi, belt, build) | `oli(pose, facing)` and `kidFace` in `assets.js` |
| Opponents | – | `NAMES` and the opponent generator in `assets.js`, belt names in `cpu.js` | mole frames in `field.js` |
| Things to grab / protect | food drawings in `assets.js` | – | the foods (carrot, broccoli, steak) in `field.js` |
| Scenery | background drawings in `assets.js` (boats, old town, landmarks, sun…) | `arena.js` | background, cable and pylons in `assets.js`, grass and mounds in `field.js` |
| Colours | palette at the top of `assets.js`, page colours in the `:root` CSS of `index.html` | CSS variables in `index.html`, palettes and `GIS` (gi colours) in `assets.js` | CSS in `index.html`, colours inside the drawings |
| Difficulty | constants at the top of `game.js` (`SPEED_START`, `SPEED_MAX`, `JUMP_V`, `GRAVITY`, `MIN_GAP`, …) | `HARDER` in `cpu.js`, move speeds and damage in `moves.js` | constants at the top of `game.js` (`SPAWN_BASE`, `MOLE_SPEED`, `GONDOLA_SPEED`, `THROW_COOLDOWN`, …) |
| Sounds | – (silent) | `audio.js` | `audio.js` |

Adding a third playable taekwondo character means adding it to `LOOKS`, adding a pick button in
`index.html`, and allowing it in the character check in `game.js` (search for `'dani'`).

**Preview pages help.** Open these straight from your file browser while you edit:

- `jumpnduck/Assets.html` shows every sprite plus an animated scene.
- `whackamoli/Assets.html` shows every sprite plus an animated preview you can drive
  (←/→ and Space, or drag and tap).
- `taekwondo/Assets.html` links to `Characters.html` (looks and belts), `Arena.html` (background),
  `Moves.html` and `States.html` (animations), `Sounds.html` (every sound) and `Poser.html`
  (a pose editor with sliders; see `SPEC.md` for the pose format).

### 4. Add your own game

1. Create a new top-level folder with an `index.html`, e.g. `space-hopper/index.html`.
2. Give it a `<title>`. That's the name on its home-page card.
3. That's it: `build.sh` finds every top-level folder with an `index.html` and adds it to the
   home page.

To make it look like the other games (copy from any of them):

- **A home-page cover**: `space-hopper/cover.svg`, a 400×260 picture. Until you add one, the
  card shows an emoji instead, which you set with `<meta name="game-emoji" content="🚀">`
  (default 🛴). See [Home-page cover](#home-page-cover).
- **A readable title on the start screen**: bright fill with a thick dark outline, like
  Whack-a-m-Oli's `h1` (`-webkit-text-stroke` plus `paint-order: stroke fill`).
- **A home button**: copy the `<a class="home-btn" href="../index.html">` link and its CSS into
  your start screen, so it shows there but not during play. If tapping anywhere starts the game,
  make that tap ignore the button.
- Check the start screen on a phone in landscape as well as on a computer.

Rules that keep it working on GitHub Pages:

- Use **relative paths only** (`assets.js`, `../`), never paths starting with `/`.
- Filenames are **case-sensitive** online, even if your computer doesn't care.
- Load extra files with a plain `<script src="game.js">` so the game also works from `file://`.
- If you save anything, use `localStorage` under a per-game prefix (`space-hopper:best`), wrap
  every access in `try/catch`, and add a reset button.
- Files ending in `.md`, dotfiles and any `test/` folder are not published.

#### Home-page cover

Each cover is a little scene built from the game's own drawings, such as the hero in action in
front of the game's background. To make one, open a scratch page that loads the game's
`assets.js`, place its SVG drawings at fixed positions inside one `<svg viewBox="0 0 400 260">`,
and save the result as `cover.svg`. Only the SVG is committed. Run `./build.sh` and open
`docs/index.html` to see it next to the other cards.

### 5. Building with an AI assistant

These games were built together with an AI coding assistant ([Claude Code](https://claude.com/claude-code)).
[CLAUDE.md](CLAUDE.md) holds the project rules and each game's `STATE.md` holds its details, so an
assistant picks up the context on its own. Describe changes in plain words ("make the
seagulls slower", "add a purple belt"), then hand the game to your kid to test.

## Repo layout

```
jumpnduck/      game: index.html, game.js, assets.js, cover.svg, fonts/, STATE.md
taekwondo/      game: index.html, game.js, assets.js, arena.js, moves.js, cpu.js, audio.js,
                cover.svg, review pages (*.html), test/, STATE.md, SPEC.md
whackamoli/     game: index.html, game.js, assets.js, field.js, audio.js, cover.svg,
                Assets.html, fonts/, STATE.md, SPEC.md, PLAN.md
site/           home-page app files: manifest, service worker (offline), icons, font
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

The home page itself is written by `build.sh`: one card per game with its cover and a Play
button. To restyle it, edit the HTML and CSS inside `build.sh`.

`site/` makes the home page installable ("Add to Home Screen" on iOS/Android, "Install" in
Chrome), and its service worker caches the site for offline play. It also holds the home
page's font. To change the icons, edit
`site/make_icons.py` and run `python3 site/make_icons.py`. See [site/README.md](site/README.md).

## License

- **Code** (HTML/JS/shell, `site/`): MIT.
- **Artwork** (characters, sprites, backgrounds, i.e. the drawings in each game's `assets.js`
  and `field.js`, and the `cover.svg` pictures made from them):
  all rights reserved, personal non-commercial use only. You may fork the repo and run the games
  for your own family. To publish your own version, replace the characters and scenery with your
  own drawings. That's the fun part anyway.
- **Fonts**: [Fredoka](https://fonts.google.com/specimen/Fredoka), SIL Open Font License 1.1
  (see `jumpnduck/fonts/OFL.txt` or `site/Fredoka-OFL.txt`).

See [LICENSE](LICENSE) for details, including the note on the *Nomade* sculpture by Jaume Plensa.
