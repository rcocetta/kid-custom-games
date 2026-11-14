#!/usr/bin/env bash
# Publish every game in this repo into docs/ for GitHub Pages (run by CI: .github/workflows/pages.yml).
#
# A game is a top-level directory (not hidden, not "docs") containing index.html.
# For each game: docs/<game>/ is replaced by a copy of the game folder, minus *.md
# files and dotfiles. docs/index.html is regenerated with one card per game.
# Nothing outside docs/ is ever written.
#
# Usage: ./build.sh   (works from any directory)
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$SCRIPT_DIR"

DOCS="docs"
INDEX="$DOCS/index.html"
DEFAULT_EMOJI="🛴"

shopt -s nullglob

# Escape text for use inside HTML element content or a quoted attribute.
html_escape() {
  printf '%s' "$1" \
    | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' \
          -e 's/"/\&quot;/g' -e "s/'/\&#39;/g"
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

  rm -rf -- "$dest"
  cp -R -- "$name" "$DOCS/"
  find "$dest" -type f -name '*.md' -delete
  find "$dest" -mindepth 1 -name '.*' -prune -exec rm -rf -- {} +

  esc_name="$(html_escape "$name")"
  esc_title="$(html_escape "$title")"
  printf -v card '<a class="card" href="%s/index.html">\n  <span class="emoji" aria-hidden="true">%s</span>\n  <span class="title">%s</span>\n  <span class="play">Play</span>\n</a>\n' \
    "$esc_name" "$DEFAULT_EMOJI" "$esc_title"
  cards+="$card"
  published+=("$name|$title")
done

# 3. Regenerate docs/index.html.
{
cat <<'HEAD'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kid Custom Games</title>
<style>
  :root {
    --bg: #FFF8EC;
    --card: #FFFFFF;
    --ink: #2E2A36;
    --accent: #2DC653;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: ui-rounded, 'Segoe UI Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif;
    min-height: 100vh;
    padding: 24px 16px 40px;
  }
  header { max-width: 960px; margin: 0 auto 24px; text-align: center; }
  h1 { font-size: clamp(28px, 6vw, 40px); margin: 8px 0 4px; }
  .lead { margin: 0; font-size: 18px; opacity: 0.75; }
  main {
    max-width: 960px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 20px;
  }
  .card {
    background: var(--card);
    border-radius: 28px;
    box-shadow: 0 6px 0 rgba(46, 42, 54, 0.12);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 28px 20px 24px;
    color: var(--ink);
    text-decoration: none;
    text-align: center;
    transition: transform 0.15s ease;
  }
  .card:hover, .card:focus-visible { transform: translateY(-3px); }
  .card:focus-visible { outline: 4px solid var(--accent); outline-offset: 4px; }
  .emoji { font-size: 72px; line-height: 1; }
  .title { font-size: 20px; font-weight: 700; overflow-wrap: anywhere; }
  .play {
    margin-top: 6px;
    background: var(--accent);
    color: var(--ink);
    font-weight: 700;
    padding: 10px 28px;
    border-radius: 999px;
  }
  .empty {
    grid-column: 1 / -1;
    background: var(--card);
    border-radius: 28px;
    padding: 40px 24px;
    font-size: 20px;
    text-align: center;
    box-shadow: 0 6px 0 rgba(46, 42, 54, 0.12);
  }
</style>
</head>
<body>
<header>
  <h1>Kid Custom Games</h1>
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
</body>
</html>
TAIL
} > "$INDEX"

# 4. Tell GitHub Pages not to run Jekyll.
: > "$DOCS/.nojekyll"

# 5. Summary.
if ((${#published[@]})); then
  echo "Published ${#published[@]} game(s) to docs/:"
  for entry in "${published[@]}"; do
    echo "  - ${entry%%|*}  (\"${entry#*|}\")"
  done
else
  echo "No games found (a game is a top-level folder containing index.html)."
  echo "Wrote docs/index.html with the 'No games yet' message."
fi
