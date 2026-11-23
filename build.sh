#!/usr/bin/env bash
# Publish every game in this repo into docs/ for GitHub Pages (run by CI: .github/workflows/pages.yml).
#
# A game is a top-level directory (not hidden, not "docs") containing index.html.
# A game's home-page card shows <game>/cover.svg (a 400x260 picture) when the game has one;
# otherwise the emoji from <meta name="game-emoji" content="🥋"> (default 🛴).
# For each game: docs/<game>/ is replaced by a copy of the game folder, minus *.md, a test/ folder
# files and dotfiles. docs/index.html is regenerated with one card per game.
# Files in site/ (manifest, service worker, icons; not *.md or *.py) are copied to the
# root of docs/ so the home page can be installed as an app.
# Nothing outside docs/ is ever written.
#
# Usage: ./build.sh   (works from any directory)
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$SCRIPT_DIR"

DOCS="docs"
INDEX="$DOCS/index.html"
DEFAULT_EMOJI="🛴"
SITE="site"

shopt -s nullglob

# Escape text for use inside HTML element content or a quoted attribute.
html_escape() {
  printf '%s' "$1" \
    | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' \
          -e 's/"/\&quot;/g' -e "s/'/\&#39;/g"
}

# Print the content of <meta name="game-emoji" content="..."> in an HTML file (empty if none).
get_emoji() {
  tr -d '\r' < "$1" | tr '\n' ' ' \
    | { grep -o '<meta[^>]*name="game-emoji"[^>]*>' || true; } | head -n 1 \
    | sed -e 's/.*content="\([^"]*\)".*/\1/'
}

# Print the text of the first <title> in an HTML file, whitespace-trimmed.
get_title() {
  tr -d '\r' < "$1" | tr '\n' ' ' \
    | sed -e 's/.*<title[^>]*>//I' -e 's/<\/title>.*//I' \
    | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/[[:space:]][[:space:]]*/ /g'
}

# 1. Find games.
games=()
for dir in */; do
  name="${dir%/}"
  case "$name" in
    .*|docs) continue ;;
  esac
  [[ -f "$name/index.html" ]] || continue
  games+=("$name")
done

mkdir -p -- "$DOCS"

# Remove stale game folders from docs/ (games that no longer exist in the repo).
for old in "$DOCS"/*/; do
  old_name="$(basename -- "$old")"
  keep=0
  for name in ${games[@]+"${games[@]}"}; do
    [[ "$name" == "$old_name" ]] && keep=1
  done
  if [[ $keep -eq 0 ]]; then
    rm -rf -- "$old"
    echo "Removed stale docs/$old_name/"
  fi
done

# 2. Copy each game into docs/<game>/ and collect its card.
cards=""
published=()
for name in ${games[@]+"${games[@]}"}; do
  dest="$DOCS/$name"
  title="$(get_title "$name/index.html")"
  [[ -n "$title" ]] || title="$name"
  emoji="$(get_emoji "$name/index.html")"
  [[ -n "$emoji" ]] || emoji="$DEFAULT_EMOJI"

  rm -rf -- "$dest"
  cp -R -- "$name" "$DOCS/"
  find "$dest" -type f -name '*.md' -delete
  find "$dest" -mindepth 1 -name '.*' -prune -exec rm -rf -- {} +
  rm -rf -- "$dest/test"

  esc_name="$(html_escape "$name")"
  esc_title="$(html_escape "$title")"
  if [[ -f "$name/cover.svg" ]]; then
    art_class="cover"
    printf -v art '<img src="%s/cover.svg" alt="" width="400" height="260">' "$esc_name"
  else
    printf -v art '<span class="emoji">%s</span>' "$(html_escape "$emoji")"
    art_class="cover cover-emoji"
  fi
  printf -v card '<a class="card" href="%s/index.html">\n  <span class="%s" aria-hidden="true">%s</span>\n  <span class="title">%s</span>\n  <span class="play">Play</span>\n</a>\n' \
    "$esc_name" "$art_class" "$art" "$esc_title"
  cards+="$card"
  published+=("$name|$title")
done

# 3. Copy the home page app files (manifest, service worker, icons) into docs/.
for f in "$SITE"/*; do
  [[ -f "$f" ]] || continue
  case "$f" in
    *.md|*.py) continue ;;
  esac
  cp -- "$f" "$DOCS/"
done

# 4. Regenerate docs/index.html.
{
cat <<'HEAD'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kid Custom Games</title>
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#2DC653">
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="Kid Games">
<style>
  @font-face { font-family: 'Fredoka'; src: url('Fredoka.ttf') format('truetype'); font-weight: 300 700; font-display: swap; }
  :root {
    --ink: #2E2A36;
    --card: #FFFFFF;
    --accent: #2DC653;
    --accent-dark: #178A3A;
    --sky: #8FD3FF;
    --sky-low: #EAF7FF;
    --sea: #3FA9E0;
    --sand: #FFE3A3;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    color: var(--ink);
    font-family: 'Fredoka', ui-rounded, 'Segoe UI Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif;
    min-height: 100vh;
    padding: 20px 16px 0;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(ellipse 90px 34px at 12% 16%, #fff 98%, transparent 100%),
      radial-gradient(ellipse 60px 26px at 17% 12%, #fff 98%, transparent 100%),
      radial-gradient(ellipse 110px 38px at 86% 30%, #fff 98%, transparent 100%),
      radial-gradient(ellipse 70px 28px at 80% 26%, #fff 98%, transparent 100%),
      linear-gradient(var(--sky), var(--sky-low) 70%);
  }
  header { max-width: 960px; margin: 0 auto 28px; text-align: center; position: relative; }
  h1 {
    font-size: clamp(38px, 9vw, 68px);
    font-weight: 700;
    line-height: 1;
    margin: 12px 0 10px;
    letter-spacing: 0.01em;
  }
  h1 .w { display: inline-block; white-space: nowrap; margin: 0 0.12em; }
  h1 .l {
    display: inline-block;
    color: var(--c);
    -webkit-text-stroke: 0.09em var(--ink);
    paint-order: stroke fill;
    text-shadow: 0 0.07em 0 var(--ink);
    transform: rotate(var(--r, 0deg));
    animation: bob 2.4s ease-in-out infinite;
    animation-delay: var(--d, 0s);
  }
  @keyframes bob { 50% { transform: translateY(-0.08em) rotate(var(--r, 0deg)); } }
  .lead {
    display: inline-block;
    margin: 6px 0 0;
    font-size: 20px;
    font-weight: 600;
    background: var(--card);
    border: 3px solid var(--ink);
    border-radius: 999px;
    padding: 6px 20px;
    box-shadow: 0 4px 0 var(--ink);
    transform: rotate(-2deg);
  }
  main {
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 28px;
    padding: 8px 4px 0;
  }
  .card {
    --tilt: -1.5deg;
    --band: #FFD34E;
    background: var(--card);
    border: 4px solid var(--ink);
    border-radius: 26px;
    box-shadow: 0 8px 0 var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 10px 10px 18px;
    color: var(--ink);
    text-decoration: none;
    text-align: center;
    transform: rotate(var(--tilt));
    transition: transform 0.18s cubic-bezier(.3, 1.6, .5, 1), box-shadow 0.18s;
  }
  .card:nth-child(3n + 2) { --tilt: 1.2deg; --band: #FF9AA2; }
  .card:nth-child(3n + 3) { --tilt: -0.8deg; --band: #8FD3FF; }
  .card:hover, .card:focus-visible { transform: rotate(0deg) translateY(-6px) scale(1.03); box-shadow: 0 14px 0 var(--ink); }
  .card:active { transform: rotate(0deg) translateY(4px); box-shadow: 0 3px 0 var(--ink); }
  .card:focus-visible { outline: 5px solid var(--accent); outline-offset: 5px; }
  .cover {
    display: block;
    width: 100%;
    aspect-ratio: 400 / 260;
    border: 3px solid var(--ink);
    border-radius: 18px;
    overflow: hidden;
    background: #BFE6FF;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cover img { display: block; width: 100%; height: 100%; transition: transform 0.3s ease; }
  .card:hover .cover img, .card:focus-visible .cover img { transform: scale(1.06); }
  .cover-emoji { background: var(--band); }
  .emoji { font-size: 96px; line-height: 1; }
  .title { font-size: 24px; font-weight: 700; overflow-wrap: anywhere; padding: 0 6px; }
  .play {
    background: var(--accent);
    color: #fff;
    -webkit-text-stroke: 4px var(--ink);
    paint-order: stroke fill;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 8px 30px 8px 24px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    box-shadow: inset 0 -5px 0 var(--accent-dark), 0 4px 0 var(--ink);
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .play::before {
    content: '';
    width: 0; height: 0;
    border-style: solid;
    border-width: 9px 0 9px 15px;
    border-color: transparent transparent transparent #fff;
    filter: drop-shadow(0 0 0 var(--ink)) drop-shadow(1.5px 0 0 var(--ink)) drop-shadow(-1.5px 0 0 var(--ink)) drop-shadow(0 1.5px 0 var(--ink)) drop-shadow(0 -1.5px 0 var(--ink));
  }
  .card:hover .play, .card:focus-visible .play { animation: wiggle 0.5s ease-in-out infinite; }
  @keyframes wiggle { 25% { transform: rotate(-4deg); } 75% { transform: rotate(4deg); } }
  .shore {
    margin: auto -16px 0;
    padding-top: 48px;
  }
  .shore svg { display: block; width: 100%; height: 46px; margin-bottom: -1px; }
  footer {
    background: var(--sand);
    margin: 0 -16px;
    padding: 10px 16px 28px;
    text-align: center;
  }
  .gh {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--ink);
    text-decoration: none;
    font-size: 16px;
    font-weight: 600;
    padding: 10px 18px;
    border-radius: 999px;
    opacity: 0.8;
  }
  .gh:hover, .gh:focus-visible { opacity: 1; background: rgba(255, 255, 255, 0.6); }
  .gh:focus-visible { outline: 4px solid var(--accent); outline-offset: 2px; }
  .gh svg { width: 24px; height: 24px; flex: none; }
  .empty {
    grid-column: 1 / -1;
    background: var(--card);
    border: 4px solid var(--ink);
    border-radius: 26px;
    padding: 40px 24px;
    font-size: 22px;
    text-align: center;
    box-shadow: 0 8px 0 var(--ink);
  }
  /* Phone in landscape: little height, so a one-line header and the cards side by side. */
  @media (orientation: landscape) and (max-height: 500px) {
    body { padding: 10px 12px 0; }
    header { display: flex; align-items: center; justify-content: center; gap: 18px; margin-bottom: 14px; }
    h1 { font-size: clamp(26px, 5vw, 38px); margin: 0; }
    .lead { font-size: 15px; padding: 4px 14px; margin: 0; flex: none; }
    main { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 18px; padding-top: 4px; }
    .card { padding: 7px 7px 12px; gap: 7px; border-width: 3px; border-radius: 20px; box-shadow: 0 6px 0 var(--ink); }
    .cover { border-radius: 14px; }
    .title { font-size: 18px; }
    .play { font-size: 18px; padding: 5px 22px 5px 18px; -webkit-text-stroke-width: 3px; }
    .play::before { border-width: 7px 0 7px 12px; }
    .shore { padding-top: 28px; }
    footer { padding: 4px 16px 14px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before { animation: none !important; transition: none !important; }
  }
</style>
</head>
<body>
<header>
  <h1 aria-label="Kid Custom Games">
    <span class="w" aria-hidden="true"><span class="l" style="--c:#FFD34E;--r:-6deg">K</span><span class="l" style="--c:#FF9AA2;--r:4deg;--d:.15s">i</span><span class="l" style="--c:#8FD3FF;--r:-3deg;--d:.3s">d</span></span>
    <span class="w" aria-hidden="true"><span class="l" style="--c:#2DC653;--r:5deg;--d:.45s">C</span><span class="l" style="--c:#FF8A1F;--r:-4deg;--d:.6s">u</span><span class="l" style="--c:#FFD34E;--r:3deg;--d:.75s">s</span><span class="l" style="--c:#FF9AA2;--r:-5deg;--d:.9s">t</span><span class="l" style="--c:#8FD3FF;--r:4deg;--d:1.05s">o</span><span class="l" style="--c:#2DC653;--r:-3deg;--d:1.2s">m</span></span>
    <span class="w" aria-hidden="true"><span class="l" style="--c:#FF8A1F;--r:6deg;--d:1.35s">G</span><span class="l" style="--c:#FFD34E;--r:-4deg;--d:1.5s">a</span><span class="l" style="--c:#FF9AA2;--r:3deg;--d:1.65s">m</span><span class="l" style="--c:#8FD3FF;--r:-5deg;--d:1.8s">e</span><span class="l" style="--c:#2DC653;--r:4deg;--d:1.95s">s</span></span>
  </h1>
  <p class="lead">Pick a game to play!</p>
</header>
<main>
HEAD
if ((${#published[@]})); then
  printf '%s' "$cards"
else
  cat <<'EMPTY'
  <p class="empty">No games yet. Check back soon!</p>
EMPTY
fi
cat <<'TAIL'
</main>
<div class="shore" aria-hidden="true">
  <svg viewBox="0 0 1200 46" preserveAspectRatio="none">
    <path d="M0 14 Q50 2 100 14 T200 14 T300 14 T400 14 T500 14 T600 14 T700 14 T800 14 T900 14 T1000 14 T1100 14 T1200 14 V46 H0 Z" fill="#3FA9E0"/>
    <path d="M0 14 Q50 2 100 14 T200 14 T300 14 T400 14 T500 14 T600 14 T700 14 T800 14 T900 14 T1000 14 T1100 14 T1200 14" fill="none" stroke="#2E2A36" stroke-width="4"/>
    <path d="M0 34 Q60 24 120 34 T240 34 T360 34 T480 34 T600 34 T720 34 T840 34 T960 34 T1080 34 T1200 34 V47 H0 Z" fill="#FFE3A3"/>
    <path d="M0 34 Q60 24 120 34 T240 34 T360 34 T480 34 T600 34 T720 34 T840 34 T960 34 T1080 34 T1200 34" fill="none" stroke="#2E2A36" stroke-width="4"/>
  </svg>
</div>
<footer>
  <a class="gh" href="https://github.com/rcocetta/kid-custom-games" target="_blank" rel="noopener noreferrer">
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
    <span>Find it on GitHub</span>
  </a>
</footer>
<script>
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
</script>
</body>
</html>
TAIL
} > "$INDEX"

# 5. Tell GitHub Pages not to run Jekyll.
: > "$DOCS/.nojekyll"

# 6. Summary.
if ((${#published[@]})); then
  echo "Published ${#published[@]} game(s) to docs/:"
  for entry in "${published[@]}"; do
    echo "  - ${entry%%|*}  (\"${entry#*|}\")"
  done
else
  echo "No games found (a game is a top-level folder containing index.html)."
  echo "Wrote docs/index.html with the 'No games yet' message."
fi
