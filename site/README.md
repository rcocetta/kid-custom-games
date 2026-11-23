# site/ — home page app files

Files `build.sh` copies into the root of `docs/` so the games home page can be installed
as an app (Chrome "Install", Android "Add to Home screen", iOS "Add to Home Screen").

- `manifest.webmanifest` — app name, colours, icons.
- `sw.js` — service worker: home page and already-played games keep working offline.
- `Fredoka.ttf` (+ `Fredoka-OFL.txt`, its licence) — the home page font, same as the games use.
- `*.png` — icons, drawn by `make_icons.py` (run `python3 site/make_icons.py` after changing it).

This folder has no `index.html`, so `build.sh` does not treat it as a game.
