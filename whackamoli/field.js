/**
 * Whack-a-m-Oli — field art: grass strip, moles, dirt, stars, food. Everything is drawn in code
 * as SVG strings (same look as jumpnduck: outline #2E2A36 width 4, friendly faces, pink cheeks).
 * Self-contained: nothing is loaded at runtime.
 *
 *   <script src="field.js"></script>   ->   window.WAMField
 *   const img = new Image(); img.src = WAMField.toDataUrl(WAMField.mole('walk1'));
 *
 * All sprite sizes below are in SVG user units. "Mole scale": the mole-family sprites (mole, mound,
 * dirtPuff, dizzyStars) are drawn at 2x the world size, so draw them at width = viewBox.w * 0.5
 * (the mole is then ~50 world units long, ~38 tall).
 *
 * API (every call returns an SVG string; pass it to toDataUrl for an <img>/canvas drawImage)
 *   grass()              tile 400 x 60 (grassTile = {w:400,h:60}), tiles horizontally with no seam.
 *                        grassLine = 16: the y inside the tile where moles/food stand (feet touch it).
 *                        Draw the tile at world y = groundY - grassLine so groundY is the standing line.
 *                        Tufts reach up to y~5, soil runs from y~30 down to 60.
 *   mole(frame)          frame in moleFrames = emerge walk1 walk2 turn eat1 eat2 bonk dive.
 *                        Faces RIGHT (mirror for left). moleViewBox = {x:-60,y:-80,w:120,h:80}:
 *                        the bottom edge (y=0) is the grass line, x=0 is the mole's position (centre
 *                        of the body). Draw at (px - 30, groundY - 40) size 60 x 40 world units (scale 0.5).
 *                        Every frame uses the same box, so frames never jitter.
 *                        A walking mole is ~104 units long in the box = ~52 world.
 *   mound()              fresh dirt pile, viewBox "-45 -34 90 34" (bottom y=0 = grass line, centred),
 *                        mole scale (draw 45 x 17 world). Emerge frame already contains its own mound.
 *   dirtPuff(frame)      frame 0,1,2: flying clods. viewBox "-50 -64 100 64", mole scale, bottom = grass
 *                        line, centred on the spot. Play 0 -> 1 -> 2 (~0.1 s each) for emerge / dive /
 *                        hammer hitting the grass.
 *   dizzyStars(phase)    ring of 3 yellow stars, viewBox "-34 -14 68 28", mole scale. phase (radians,
 *                        default 0) rotates them; animate it. Draw centred above the bonked head
 *                        (head top is about y=-62 in the mole box).
 *   food(kind)           kind in foodKinds = carrot broccoli steak. Bottom edge of the viewBox = the
 *                        surface it rests on (grass line), horizontally centred. World scale 1:1
 *                        recommended size ~ 0.45 (about 40 units tall); the viewBox is per kind:
 *                        see foodViewBox(kind) = {x,y,w,h}.
 *   foodEaten(kind)      same viewBox, bitten with crumbs around it (use when a mole munches / on loss).
 *   foodIcon(kind, eaten) small HUD icon, viewBox "0 0 40 40" (eaten = grey silhouette with a bite).
 *
 * Exports: palette, moleFrames, foodKinds, moleViewBox, grassTile, grassLine, foodViewBox, toDataUrl.
 */
(function () {
  // ---------- Palette ----------
  const C = {
    outline: '#2E2A36',
    cheek: '#FF9AA2',
    star: '#FFD34E',
    grass: '#7BD35A', grassDark: '#5DB246', grassLight: '#A6E88A',
    soil: '#A9774C', soilDark: '#8A5E3A', soilLight: '#C79566', pebble: '#D9C4A8', pebbleShade: '#B79F82',
    fur: '#8D7160', furShade: '#6F5546', furLight: '#AD917F',
    pink: '#FF9FB5', pinkLight: '#FFC4D2', pinkShade: '#EE7C98',
    claw: '#FFF4DC', white: '#FFFFFF',
    eyeWhite: '#FFFFFF', mouth: '#8E2F3C',
  };
  const O = C.outline;
  const SW = 4;
  const f1 = (n) => (Math.round(n * 10) / 10).toString();

  // ---------- Helpers (copied from jumpnduck/assets.js) ----------
  function limb(points, color, width) {
    const d = 'M' + points.map((p) => p.join(' ')).join(' L');
    const common = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
    return (
      `<path d="${d}" ${common} stroke="${O}" stroke-width="${width + SW * 2}"/>` +
      `<path d="${d}" ${common} stroke="${color}" stroke-width="${width}"/>`
    );
  }
  function blob(shapes, fill) {
    return (
      `<g fill="${O}" stroke="${O}" stroke-width="${SW * 2}" stroke-linejoin="round">${shapes}</g>` +
      `<g fill="${fill}">${shapes}</g>`
    );
  }
  function star(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 ? r * 0.48 : r;
      pts.push(`${f1(cx + Math.cos(a) * rr)} ${f1(cy + Math.sin(a) * rr)}`);
    }
    return `<path d="M${pts.join(' L')} Z" fill="${C.star}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  function toDataUrl(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const svgWrap = (vb, cls, inner) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="sprite ${cls}">${inner}</svg>`;

  // ---------- Grass strip ----------
  const grassTile = { w: 400, h: 60 };
  const grassLine = 16;

  function grass() {
    // top edge: flat at y=16 with little tufts; none touches x=0 / x=400 so the tile has no seam
    const tufts = [28, 74, 118, 171, 226, 262, 313, 357];
    let top = 'M0 16 ';
    tufts.forEach((x, i) => {
      const h = 7 + (i % 3) * 2;
      top += `L${x - 7} 16 L${x - 3} ${16 - h} L${x} 16 L${x + 3} ${16 - h - 3} L${x + 7} 16 `;
    });
    top += 'L400 16';
    let blades = '';
    [[52, 24], [140, 22], [198, 25], [290, 23], [336, 24], [388, 22], [8, 24]].forEach(([x, y]) => {
      blades += `M${x} ${y} L${x + 2} ${y - 7} M${x + 5} ${y} L${x + 6} ${y - 5} `;
    });
    let wave = 'M0 30 ';
    for (let x = 0; x < 400; x += 40) wave += `Q${x + 10} 36 ${x + 20} 31 T${x + 40} 30 `;
    let pebbles = '';
    [[34, 42, 5, 3.5], [96, 52, 4, 3], [150, 40, 3.5, 2.6], [212, 50, 6, 4], [266, 41, 4, 3], [318, 53, 5, 3.5], [372, 43, 4, 3], [190, 34, 3, 2.4]].forEach(
      ([x, y, rx, ry]) => {
        pebbles += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${C.pebble}" stroke="${C.soilDark}" stroke-width="1.8"/>`;
      }
    );
    let dots = '';
    [[60, 36], [120, 46], [180, 56], [240, 38], [300, 47], [345, 36], [14, 50], [395, 54]].forEach(([x, y]) => {
      dots += `<circle cx="${x}" cy="${y}" r="1.6" fill="${C.soilDark}"/>`;
    });
    return svgWrap(
      '0 0 400 60',
      'grass',
      `<rect y="28" width="400" height="32" fill="${C.soil}"/>` +
        `<rect y="48" width="400" height="12" fill="${C.soilDark}" opacity="0.35"/>` +
        dots +
        pebbles +
        `<path d="${top} L400 32 L0 32 Z" fill="${C.grass}"/>` +
        `<rect y="22" width="400" height="8" fill="${C.grassDark}" opacity="0.55"/>` +
        `<path d="${blades}" stroke="${C.grassLight}" stroke-width="2" stroke-linecap="round" fill="none"/>` +
        `<path d="${wave}" fill="none" stroke="${C.outline}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="${top}" fill="none" stroke="${C.outline}" stroke-width="3" stroke-linejoin="round"/>`
    );
  }

  // ---------- Dirt ----------
  function moundShapes() {
    // pile centred on x=0, bottom y=0
    return (
      `<path d="M-40 0 C-38 -12 -24 -24 -8 -26 C8 -28 26 -18 40 0 Z" fill="${C.soil}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M-30 -6 C-26 -14 -18 -19 -10 -20" fill="none" stroke="${C.soilLight}" stroke-width="3.5" stroke-linecap="round"/>` +
      `<path d="M16 -8 Q24 -6 30 -2 M-6 -10 Q2 -8 6 -4" fill="none" stroke="${C.soilDark}" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="-20" cy="-4" r="3" fill="${C.pebble}" stroke="${C.soilDark}" stroke-width="1.8"/>` +
      `<circle cx="26" cy="-12" r="2.6" fill="${C.pebble}" stroke="${C.soilDark}" stroke-width="1.8"/>`
    );
  }
  function mound() {
    return svgWrap('-45 -34 90 34', 'mound', moundShapes());
  }

  function clod(x, y, r, rot) {
    return (
      `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r * 0.78)}" transform="rotate(${rot} ${f1(x)} ${f1(y)})" ` +
      `fill="${C.soil}" stroke="${O}" stroke-width="3"/>`
    );
  }
  function dirtPuff(frame = 0) {
    const f = Math.max(0, Math.min(2, frame | 0));
    const spread = [0.55, 1, 1.15][f];
    const rise = [0.6, 1, 0.55][f];
    const size = [1, 0.85, 0.6][f];
    const clods = [
      [-26, -26, 7, 20], [-10, -42, 6, -30], [10, -44, 6.5, 40], [28, -28, 7, -10], [0, -20, 5.5, 60], [-36, -10, 5, 0], [36, -12, 5, 25],
    ];
    let s = '';
    clods.forEach(([x, y, r, rot], i) => {
      const cx = x * spread;
      const cy = i === 4 ? -22 * rise - (f === 2 ? 0 : 0) : y * rise + (f === 2 ? 10 : 0);
      s += clod(cx, Math.min(-4, cy), r * size, rot);
    });
    // a little dust puff on the ground
    s += `<ellipse cx="0" cy="-4" rx="${f1(24 * spread)}" ry="5" fill="${C.soilLight}" opacity="0.8"/>`;
    return svgWrap('-50 -64 100 64', 'dirt-puff', s);
  }

  // ---------- Dizzy stars ----------
  function dizzyStars(phase = 0) {
    let s = '';
    const order = [];
    for (let i = 0; i < 3; i++) {
      const a = phase + (i * Math.PI * 2) / 3;
      order.push([Math.sin(a) * 24, Math.cos(a) * 3.5, Math.cos(a)]);
    }
    order.sort((a, b) => a[2] - b[2]); // back first
    order.forEach(([x, y, d]) => (s += star(x, y, 7 + d * 1.5)));
    return svgWrap('-34 -14 68 28', 'dizzy-stars', s);
  }

  // ---------- Mole ----------
  // Coordinates: x=0 body centre, y=0 grass line, facing right. Feet rest at y=-2 (outline reaches ~0).
  const moleViewBox = { x: -60, y: -80, w: 120, h: 80 };
  const MOLE_K = 0.8; // art is drawn big, then scaled so the mole fits the box
  const moleFrames = ['emerge', 'walk1', 'walk2', 'turn', 'eat1', 'eat2', 'bonk', 'dive'];

  function paw(x, y, rot, opts = {}) {
    // pink hand; claws point along +x of its own frame
    const s = opts.s || 1;
    return (
      `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${rot}) scale(${s})">` +
      [-5, 0, 5]
        .map((dy) => `<ellipse cx="11" cy="${dy}" rx="4.2" ry="2.3" fill="${C.claw}" stroke="${O}" stroke-width="2.4"/>`)
        .join('') +
      `<ellipse cx="0" cy="0" rx="11" ry="8.5" fill="${C.pink}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M-3 -3 Q2 -5 6 -3" fill="none" stroke="${C.pinkLight}" stroke-width="2.4" stroke-linecap="round"/>` +
      `</g>`
    );
  }
  function foot(x, y, rot = 0) {
    return (
      `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${rot})">` +
      `<ellipse cx="0" cy="0" rx="11" ry="5.5" fill="${C.pink}" stroke="${O}" stroke-width="${SW}"/>` +
      [4, 8].map((dx) => `<path d="M${dx + 3} -1 L${dx + 3} 2" stroke="${O}" stroke-width="2" stroke-linecap="round"/>`).join('') +
      `</g>`
    );
  }

  function closedEye(x, y) {
    return `<path d="M${x - 5} ${y + 1} Q${x} ${y - 5} ${x + 5} ${y + 1}" fill="none" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/>`;
  }
  function spiralEye(x, y) {
    return (
      `<circle cx="${x}" cy="${y}" r="6.5" fill="${C.white}" stroke="${O}" stroke-width="2.5"/>` +
      `<path d="M${x} ${y} m0 -1 a1.5 1.5 0 1 1 -1.6 1.6 a3 3 0 1 1 4 2.4" fill="none" stroke="${O}" stroke-width="1.8" stroke-linecap="round" transform="translate(0 0)"/>`
    );
  }

  /**
   * Head drawn around (hx, hy) = centre of the skull. Snout points +x.
   * opts: eye ('happy'|'dizzy'|'sniff'), mouth ('smile'|'chew1'|'chew2'|'o'), cheek (bulge scale), rot (deg around hx,hy), bump
   */
  function head(hx, hy, opts = {}) {
    const eye = opts.eye || 'happy';
    const mouth = opts.mouth || 'smile';
    const cheekR = opts.cheek || 1;
    const rot = opts.rot || 0;
    let s = `<g transform="rotate(${rot} ${hx} ${hy})">`;
    // ears
    s += `<ellipse cx="${hx - 10}" cy="${hy - 19}" rx="5" ry="4.5" fill="${C.furShade}" stroke="${O}" stroke-width="3"/>`;
    // skull + snout silhouette
    const shapes = `<circle cx="${hx}" cy="${hy}" r="22"/><ellipse cx="${hx + 20}" cy="${hy + 6}" rx="15" ry="11"/>`;
    s += blob(shapes, C.fur);
    // lighter muzzle
    s += `<ellipse cx="${hx + 20}" cy="${hy + 8}" rx="12" ry="8" fill="${C.furLight}"/>`;
    if (opts.bump) {
      s += `<ellipse cx="${hx - 4}" cy="${hy - 21}" rx="9" ry="7" fill="${C.fur}" stroke="${O}" stroke-width="3.2"/>` +
        `<path d="M${hx - 8} ${hy - 22} Q${hx - 4} ${hy - 26} ${hx} ${hy - 22}" fill="none" stroke="${C.furLight}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="M${hx - 7} ${hy - 16} l2 -3 l2 3" fill="none" stroke="${C.pinkShade}" stroke-width="0"/>`;
    }
    // nose
    s += `<ellipse cx="${hx + 34}" cy="${hy + 3}" rx="7.5" ry="6.5" fill="${C.pink}" stroke="${O}" stroke-width="3.5"/>` +
      `<ellipse cx="${hx + 32}" cy="${hy + 1}" rx="2.4" ry="1.8" fill="${C.pinkLight}"/>`;
    // cheek
    s += `<ellipse cx="${hx + 9}" cy="${hy + 10}" rx="${f1(6 * cheekR)}" ry="${f1(4.2 * cheekR)}" fill="${C.cheek}" opacity="0.85"/>`;
    // eye
    const ex = hx + 12, ey = hy - 4;
    if (eye === 'dizzy') s += spiralEye(ex, ey);
    else if (eye === 'sniff') s += `<path d="M${ex - 5} ${ey + 1} Q${ex} ${ey - 5} ${ex + 5} ${ey + 1}" fill="none" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/>`;
    else s += closedEye(ex, ey);
    // mouth
    const mx = hx + 24, my = hy + 14;
    if (mouth === 'smile') s += `<path d="M${mx - 6} ${my - 3} Q${mx - 1} ${my + 3} ${mx + 5} ${my - 2}" fill="none" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>`;
    else if (mouth === 'chew1') s += `<path d="M${mx - 7} ${my - 3} Q${mx - 1} ${my + 6} ${mx + 6} ${my - 2} Q${mx - 1} ${my} ${mx - 7} ${my - 3} Z" fill="${C.mouth}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>`;
    else if (mouth === 'chew2') s += `<path d="M${mx - 6} ${my - 2} Q${mx} ${my + 1} ${mx + 5} ${my - 2}" fill="none" stroke="${O}" stroke-width="2.8" stroke-linecap="round"/>`;
    else s += `<path d="M${mx - 7} ${my - 3} L${mx + 6} ${my - 3} Q${mx - 0.5} ${my + 8} ${mx - 7} ${my - 3} Z" fill="${C.mouth}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>`; // open grin (wide D, reads as a mouth, not an eye)
    s += `</g>`;
    return s;
  }

  // body + tail
  function body(cx, cy, opts = {}) {
    const sy = opts.sy || 1;
    const rot = opts.rot || 0;
    let s = `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(1 ${sy})">`;
    // tail
    s += limb([[-38, -6], [-47, -15]], C.pink, 6);
    s += blob(`<ellipse cx="0" cy="0" rx="37" ry="26"/>`, C.fur);
    s += `<path d="M-30 12 Q0 26 28 14" fill="none" stroke="${C.furShade}" stroke-width="4" stroke-linecap="round" opacity="0.55"/>`;
    s += `<path d="M-26 -16 Q-12 -24 6 -23" fill="none" stroke="${C.furLight}" stroke-width="4" stroke-linecap="round"/>`;
    s += `</g>`;
    return s;
  }

  // standing mole on four feet; opts: stride (-1..1), bob, headOpts, pawsUp
  function standing(o = {}) {
    const bob = o.bob || 0;
    const st = o.stride || 0;
    const by = -32 + bob;
    let s = '';
    // far legs (behind body)
    s += foot(-30 - st * 7, -6 - Math.max(0, st) * 4, 0);
    s += body(-8, by);
    // near back foot
    s += foot(-26 + st * 8, -6 - Math.max(0, -st) * 4, 0);
    // head
    s += head(22, -42 + bob + (o.headDy || 0), o.headOpts);
    // near arm + paw
    if (o.pawsUp) {
      s += limb([[18, -24 + bob], [40, -26 + bob]], C.fur, 10);
      s += paw(48, -28 + bob, -40 + (o.pawWiggle || 0));
    } else {
      const px = 30 + st * 8, py = -9 - Math.max(0, -st) * 5;
      s += limb([[14, -22 + bob], [px - 4, py - 4]], C.fur, 12);
      s += paw(px + 2, py, st < 0 ? -25 : 10, { s: 1.1 });
    }
    return s;
  }

  function moleEmerge() {
    // head + two paws peeking over a clean dirt mound (body hidden behind it)
    let s = head(2, -38, { mouth: 'smile', cheek: 1.1 });
    s += `<g transform="translate(0 4) scale(1.3 1.1)">` +
      `<path d="M-40 0 C-38 -12 -24 -24 -8 -26 C8 -28 26 -18 40 0 Z" fill="${C.soil}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M-28 -6 C-24 -13 -18 -18 -11 -20" fill="none" stroke="${C.soilLight}" stroke-width="3.5" stroke-linecap="round"/></g>`;
    s += paw(-30, -30, -105, { s: 1 }) + paw(34, -28, -75, { s: 1 });
    s += clod(-56, -26, 4.5, 10) + clod(60, -30, 4, 30);
    return s;
  }

  function moleDive() {
    // head-first dive: only the bum, tail and kicking back feet stick up out of a dirt hole
    let s = `<ellipse cx="0" cy="-3" rx="46" ry="10" fill="${C.soilDark}" stroke="${O}" stroke-width="${SW}"/>`;
    // body: round bum up, front end down in the hole
    s += `<g transform="rotate(-8 0 -26)">` + blob(`<ellipse cx="0" cy="-26" rx="27" ry="30"/>`, C.fur) +
      `<path d="M-16 -46 Q-8 -54 4 -52" fill="none" stroke="${C.furLight}" stroke-width="4" stroke-linecap="round"/></g>`;
    // little tail on the bum, back feet kicking up (soles up, toes pointing to the sky)
    s += limb([[-26, -34], [-36, -40]], C.pink, 5);
    s += foot(-18, -62, -105) + foot(20, -58, -75);
    // front lip of the hole hides where the mole goes in
    s += `<path d="M-48 -3 C-40 12 40 12 48 -3 C42 -16 28 -20 0 -20 C-28 -20 -42 -16 -48 -3 Z" fill="${C.soil}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>`;
    s += `<path d="M-34 -8 Q-24 -14 -10 -14" fill="none" stroke="${C.soilLight}" stroke-width="3.5" stroke-linecap="round"/>`;
    s += clod(-50, -34, 6, 10) + clod(52, -40, 6.5, 30) + clod(44, -62, 4.5, 0) + clod(-44, -56, 4, 0);
    return s;
  }

  function moleBody(frame) {
    switch (frame) {
      case 'emerge': return moleEmerge();
      case 'walk1': return standing({ stride: 1, bob: 0 });
      case 'walk2': return standing({ stride: -1, bob: -1.5 });
      case 'turn': {
        let s = standing({ stride: 0, headOpts: { eye: 'sniff', mouth: 'o', rot: -22 }, headDy: -2 });
        // question mark
        s += `<g transform="translate(8 -80)"><path d="M-8 -8 C-8 -18 8 -18 8 -8 C8 -2 0 -2 0 6" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` +
          `<path d="M-8 -8 C-8 -18 8 -18 8 -8 C8 -2 0 -2 0 6" fill="none" stroke="${C.star}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>` +
          `<circle cx="0" cy="15" r="5.5" fill="${O}"/><circle cx="0" cy="15" r="2.4" fill="${C.star}"/></g>`;
        return s;
      }
      case 'eat1': return standing({ pawsUp: true, headOpts: { mouth: 'chew1', cheek: 1.8 }, pawWiggle: 0 });
      case 'eat2': return standing({ pawsUp: true, bob: 1, headOpts: { mouth: 'chew2', cheek: 2.3 }, pawWiggle: -10 });
      case 'bonk': {
        let s = standing({ bob: 3, stride: 0, headDy: 2, headOpts: { eye: 'dizzy', mouth: 'o', bump: true, rot: 8 } });
        return s;
      }
      case 'dive': return moleDive();
      default: return standing({});
    }
  }

  function mole(frame = 'walk1') {
    if (moleFrames.indexOf(frame) < 0) frame = 'walk1';
    const v = moleViewBox;
    return svgWrap(`${v.x} ${v.y} ${v.w} ${v.h}`, 'mole mole-' + frame, `<g transform="translate(0 -1.5) scale(${MOLE_K})">${moleBody(frame)}</g>`);
  }

  // ---------- Food (copied from jumpnduck/assets.js, then re-anchored to the grass) ----------
  const F = {
    broc: '#4CAF50', brocShade: '#3A8F3E', brocShine: '#7FD17F', stem: '#A8D86E',
    carrot: '#FF8A2A', carrotShade: '#E0680F', leaf: '#5DBB63',
    steak: '#B5482E', steakShade: '#8E3320', fat: '#FFE3C8', grill: '#6E2416',
  };

  function foodFace(x, y) {
    return (
      `<circle cx="${x - 7}" cy="${y}" r="2.8" fill="${O}"/><circle cx="${x + 7}" cy="${y}" r="2.8" fill="${O}"/>` +
      `<circle cx="${x - 7.8}" cy="${y - 1}" r="1" fill="#FFFFFF"/><circle cx="${x + 6.2}" cy="${y - 1}" r="1" fill="#FFFFFF"/>` +
      `<path d="M${x - 5} ${y + 5} Q${x} ${y + 10} ${x + 5} ${y + 5}" fill="none" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<ellipse cx="${x - 12}" cy="${y + 5}" rx="3.5" ry="2.2" fill="${C.cheek}" opacity="0.6"/>` +
      `<ellipse cx="${x + 12}" cy="${y + 5}" rx="3.5" ry="2.2" fill="${C.cheek}" opacity="0.6"/>`
    );
  }

  // Each kind: draw(eaten) in the jumpnduck 96x100-ish coordinates, plus a viewBox whose bottom edge
  // is the resting surface. Content is (outline included) inside the viewBox.
  const FOODS = {
    carrot: {
      // carrot lies on its side? No: stands tip-down, so the tip is planted in the grass.
      vb: [10, -6, 80, 104],   // top at -6: the leaf tips (with their outline) reach y = -3
      draw: (bite) =>
        `<g fill="${F.leaf}" stroke="${O}" stroke-width="3.5" stroke-linejoin="round">` +
        `<ellipse cx="40" cy="18" rx="6" ry="13" transform="rotate(-30 40 18)"/>` +
        `<ellipse cx="60" cy="18" rx="6" ry="13" transform="rotate(30 60 18)"/>` +
        `<ellipse cx="50" cy="13" rx="6.5" ry="14"/></g>` +
        `<path d="M30 32 Q50 20 70 32 Q68 62 54 90 Q50 96 46 90 Q32 62 30 32 Z" fill="${F.carrot}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
        `<path d="M54 56 L60 55 M50 72 L55 71 M40 60 L45 62 M47 80 L51 80" stroke="${F.carrotShade}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M36 36 Q38 46 40 52" fill="none" stroke="#FFB673" stroke-width="3.5" stroke-linecap="round"/>` +
        (bite ? '' : foodFace(50, 42)),
      bite: { cx: 69, cy: 64, r: 10 },
      sil: '<path d="M30 32 Q50 20 70 32 Q68 62 54 90 Q50 96 46 90 Q32 62 30 32 Z"/>',
    },
    broccoli: {
      vb: [12, 8, 76, 82],
      draw: (bite) =>
        limb([[50, 86], [50, 60]], F.stem, 18) +
        blob(
          '<circle cx="32" cy="42" r="15"/><circle cx="50" cy="30" r="17"/><circle cx="68" cy="42" r="15"/>' +
            '<circle cx="40" cy="54" r="12"/><circle cx="60" cy="54" r="12"/><circle cx="50" cy="46" r="14"/>',
          F.broc
        ) +
        `<path d="M24 50 Q32 58 40 56 M60 58 Q70 58 76 48" fill="none" stroke="${F.brocShade}" stroke-width="3.5" stroke-linecap="round"/>` +
        `<circle cx="42" cy="22" r="3" fill="${F.brocShine}"/><circle cx="26" cy="36" r="2.5" fill="${F.brocShine}"/><circle cx="64" cy="32" r="2.5" fill="${F.brocShine}"/>` +
        (bite ? '' : foodFace(50, 42)),
      bite: { cx: 85, cy: 46, r: 12 },
      sil: '<circle cx="32" cy="42" r="15"/><circle cx="50" cy="30" r="17"/><circle cx="68" cy="42" r="15"/>' +
        '<circle cx="40" cy="54" r="12"/><circle cx="60" cy="54" r="12"/><circle cx="50" cy="46" r="14"/>',
    },
    steak: {
      vb: [6, 8, 88, 82],
      draw: (bite) =>
        `<path d="M14 48 C12 26 38 14 60 18 C84 22 92 44 86 62 C80 80 54 84 34 78 C18 72 16 62 14 48 Z" fill="${F.fat}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
        `<path d="M22 48 C21 32 40 24 58 26 C76 29 82 45 78 58 C73 72 54 75 38 70 C26 66 23 58 22 48 Z" fill="${F.steak}"/>` +
        `<path d="M60 34 Q68 40 66 50 M70 60 Q62 64 58 70" fill="none" stroke="${F.fat}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
        `<path d="M28 40 L44 30 M26 56 L50 38 M34 66 L54 52" stroke="${F.grill}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>` +
        `<path d="M28 30 Q38 22 50 22" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.7"/>` +
        (bite ? '' : foodFace(44, 50)),
      bite: { cx: 88, cy: 44, r: 13 },
      sil: '<path d="M14 48 C12 26 38 14 60 18 C84 22 92 44 86 62 C80 80 54 84 34 78 C18 72 16 62 14 48 Z"/>',
    },
  };
  const foodKinds = Object.keys(FOODS);
  const foodViewBox = (kind) => {
    const v = (FOODS[kind] || FOODS.carrot).vb;
    return { x: v[0], y: v[1], w: v[2], h: v[3] };
  };
  const vbStr = (kind) => (FOODS[kind] || FOODS.carrot).vb.join(' ');

  function food(kind = 'carrot') {
    if (!FOODS[kind]) kind = 'carrot';
    return svgWrap(vbStr(kind), 'food food-' + kind, FOODS[kind].draw(false));
  }

  // The bite: 3 overlapping circles (a scalloped cartoon bite) on the food's right side.
  function biteCircles(b) {
    const r = b.r;
    return [[b.cx, b.cy - r * 1.05, r], [b.cx - r * 0.45, b.cy, r * 1.05], [b.cx, b.cy + r * 1.05, r]];
  }
  // bitten: the bite is cut from the food with a mask; its edge gets the usual dark outline
  // (clipped to the food's silhouette so it never shows in the air); crumbs on the ground.
  function foodEaten(kind = 'carrot') {
    if (!FOODS[kind]) kind = 'carrot';
    const fd = FOODS[kind];
    const cs = biteCircles(fd.bite);
    const id = 'bite-' + kind, cid = 'bitesil-' + kind;
    const [vx, vy, vw, vh] = fd.vb;
    const bx = vx + vw / 2;
    const circ = (fill, extra) => cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${extra || ''}/>`).join('');
    let s =
      `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${vx - 10}" y="${vy - 10}" width="${vw + 20}" height="${vh + 20}">` +
      `<rect x="${vx - 10}" y="${vy - 10}" width="${vw + 20}" height="${vh + 20}" fill="#fff"/>${circ('#000')}</mask>` +
      `<clipPath id="${cid}">${fd.sil}</clipPath></defs>`;
    s += `<g mask="url(#${id})">${fd.draw(true)}${foodFace(kind === 'carrot' ? 50 : kind === 'steak' ? 44 : 50, kind === 'steak' ? 50 : 42)}` +
      `<g clip-path="url(#${cid})">${circ('none', ` stroke="${O}" stroke-width="${SW * 2}"`)}</g></g>`;
    // crumbs at the base
    const base = vy + vh - 3;
    [[-26, 0, 3.2], [-14, -2, 2.4], [18, 0, 3], [30, -1, 2.2], [6, 0, 2]].forEach(([dx, dy, r]) => {
      const col = kind === 'carrot' ? F.carrot : kind === 'broccoli' ? F.broc : F.steak;
      s += `<circle cx="${bx + dx}" cy="${base + dy}" r="${r}" fill="${col}" stroke="${O}" stroke-width="1.8"/>`;
    });
    return svgWrap(vbStr(kind), 'food food-eaten food-' + kind, s);
  }

  function foodIcon(kind = 'carrot', eaten = false) {
    if (!FOODS[kind]) kind = 'carrot';
    const fd = FOODS[kind];
    const [vx, vy, vw, vh] = fd.vb;
    const k = 34 / Math.max(vw, vh);
    const tx = (40 - vw * k) / 2 - vx * k, ty = (40 - vh * k) / 2 - vy * k;
    if (!eaten) {
      return svgWrap('0 0 40 40', 'food-icon food-icon-' + kind, `<g transform="translate(${f1(tx)} ${f1(ty)}) scale(${f1(k)})">${fd.draw(false)}</g>`);
    }
    const b = fd.bite;
    const id = 'iconbite-' + kind;
    return svgWrap(
      '0 0 40 40',
      'food-icon food-icon-eaten food-icon-' + kind,
      `<defs><filter id="grey-${kind}"><feColorMatrix type="saturate" values="0"/></filter><mask id="${id}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="160" height="160"><rect x="-20" y="-20" width="160" height="160" fill="#fff"/>` +
        biteCircles(b).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000"/>`).join('') + `</mask></defs>` +
        `<g transform="translate(${f1(tx)} ${f1(ty)}) scale(${f1(k)})" mask="url(#${id})">` +
        `<g filter="url(#grey-${kind})" opacity="0.6">${fd.draw(true)}</g></g>`
    );
  }

  window.WAMField = {
    palette: C,
    grass,
    grassTile,
    grassLine,
    mole,
    moleFrames,
    moleViewBox,
    mound,
    dirtPuff,
    dizzyStars,
    food,
    foodEaten,
    foodIcon,
    foodKinds,
    foodViewBox,
    toDataUrl,
  };
})();
