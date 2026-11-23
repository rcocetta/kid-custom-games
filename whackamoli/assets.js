/*
 * ARTWORK: (c) 2026 Riccardo Cocetta. All rights reserved; personal, non-commercial use only.
 * The drawings in this file are NOT covered by the repository's MIT License (see LICENSE).
 * Oli, the background tiles, kidFace() and the popup are copied/adapted from jumpnduck/assets.js.
 */
/*
 * Whack-a-m-Oli — drawing assets (Oli in the gondola, cable, hammer, HUD bits, background).
 * Every sprite is an SVG string drawn in code, in the jumpnduck style: #2E2A36 outline (width 4),
 * outlined round-capped limbs (limb()), big head, blonde hair, green eyes, green tee, pink cheeks.
 * Plain script, no dependencies, works from file://. Everything is on window.WAMAssets.
 *
 * Canvas use:  const img = new Image(); img.src = WAMAssets.toDataUrl(WAMAssets.oli('idle', 'right'));
 *
 * ================================ API ================================
 * oli(pose, facing)      pose: oliPoses = 'idle' | 'windup' | 'throw' | 'cheer' | 'sad'
 *                        facing: 'right' (default) | 'left' (mirrored around the anchor x).
 *   The WHOLE gondola: trolley (2 orange wheels sitting on the cable) + hanger rods + open basket
 *   + Oli visible from the waist up (the basket's front rim is drawn over his waist).
 *   Every pose and both facings share ONE viewBox, so poses can be swapped without jitter:
 *     oliViewBox = { x: -24, y: -72, w: 248, h: 288 }          ('-24 -72 248 288')
 *     oliAnchor  = { x: 100, y: -40 }  the point on the CABLE CENTRELINE under the trolley.
 *                  Put this point on the cable (world y of the cable) at the gondola's x.
 *     oliScale   = 0.46 suggested world units per viewBox unit: trolley top to basket bottom
 *                  (-62..212 = 274 units) is then ~126 world units; whole image 114 x 132.
 *     oliHand    = { x: 168, y: 130 } where the hammer leaves his hand in 'throw' (facing right;
 *                  mirror x around oliAnchor.x for 'left'), handy as the launch point.
 *   idle   leaning on the rim, hammer in his near hand, ready.
 *   windup hammer raised behind his head (leaning back), other arm aiming forward.
 *   throw  arm swung forward over the basket edge, hand empty, leaning forward, swoosh.
 *   cheer  both arms up + sparkles (level up).          sad  droopy, teary, hands on the rim (game over).
 *
 * cable()                horizontally tileable steel cable strip. Tile 120 x 16 (cableTile), centreline
 *                        y = 8 (cableCentre). Draw at the same scale as oli() (oliScale) so it matches.
 * pylon(height = 640)    optional end post: lattice tower with a sheave the cable runs over.
 *                        viewBox '-60 -30 120 (height + 30)'; (0, 0) = cable centreline on top of the
 *                        sheave, ground (base bottom) at y = height. Choose height = (grassY - cableY) / scale.
 * hammer()               toy mallet (wooden handle, red rubber head, yellow caps), head pointing UP,
 *                        drawn centred on its pivot (centre of mass) at (0, 0) of viewBox '-56 -56 112 112'
 *                        (hammerViewBox). Length 78 units: scale 0.44 => ~34 world units. Rotate around
 *                        the image centre on the canvas.
 * hammerTrail()          motion arcs for the spin, same viewBox/centre as hammer(); draw it UNDER the
 *                        hammer, rotated with it. Arcs trail a CLOCKWISE spin (facing right); mirror
 *                        (scale -1, 1) for a counter-clockwise spin.
 * marker()               faint dotted landing ring, viewBox '-40 -14 80 28' (markerViewBox); (0, 0) = the
 *                        landing point on the grass line.
 * kidFace()              HUD avatar (copied from jumpnduck), viewBox '0 -6 120 126'.
 * scorePopup(points = 100, label = 'BONK!', ribbon = orange)   viewBox 0 0 220 130.
 * levelBanner(n)         "LEVEL n!" banner, viewBox 0 0 300 130.
 * background.mountains() / .sea()   tiles 800 x 160 / 800 x 60 (background.tiles), preserveAspectRatio none.
 * background.oldTown() / .sun() / .boat()   single sprites (as in jumpnduck). background.sky = gradient colours.
 * palette, toDataUrl(svg), oliPoses, oliViewBox, oliAnchor, oliScale, oliHand.
 * Text uses Fredoka when the page has loaded it (fallback Arial Rounded / Arial Black).
 */
(function () {
  // ---------- Palette (Oli's colours are the jumpnduck ones) ----------
  const C = {
    outline: '#2E2A36',
    skin: '#FFDCC2',
    skinShade: '#F2B996',
    cheek: '#FF9AA2',
    hair: '#FFD34E',
    hairShade: '#E5A82A',
    brow: '#B07A1E',
    eyeGreen: '#3FAE5A',
    shirt: '#52C25A',
    shirtShade: '#3E9C47',
    jeans: '#4A7BD0',
    jeansShade: '#3A62A8',
    mouth: '#8E2F3C',
    tongue: '#FF7F8E',
    tear: '#7FD0FF',
    star: '#FFD34E',
    wheel: '#FF8A1F',      // trolley wheels: same orange as the scooter wheels
    wheelShade: '#D9650A',
    hub: '#FFE6CC',
    steel: '#9AA3B5',
    steelShade: '#6E778A',
    steelLight: '#C9D0DC',
    trolley: '#26262E',
    trolleyHi: '#55555F',
    basket: '#4A9BE8',
    basketShade: '#2F78C4',
    basketInside: '#24508A',
    basketLight: '#9FD0FF',
    stripe: '#FFFFFF',
    wood: '#E0A35E',
    woodShade: '#B97A3A',
    woodLight: '#F5C98E',
    rubber: '#E8413C',
    rubberShade: '#B82A2A',
    rubberLight: '#FF8F86',
    cap: '#FFC93C',
    capShade: '#E0A21C',
    marker: '#FFFFFF',
  };
  const O = C.outline;
  const SW = 4; // outline width
  const f1 = (n) => n.toFixed(1);

  // ---------- Drawing helpers (from jumpnduck) ----------
  // A limb drawn as a thick rounded stroke with an outline around it.
  function limb(points, color, width) {
    const d = 'M' + points.map((p) => p.map(f1).join(' ')).join(' L');
    const common = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
    return (
      `<path d="${d}" ${common} stroke="${O}" stroke-width="${width + SW * 2}"/>` +
      `<path d="${d}" ${common} stroke="${color}" stroke-width="${width}"/>`
    );
  }

  const handCircle = (hand, back) =>
    `<circle cx="${f1(hand[0])}" cy="${f1(hand[1])}" r="6.5" fill="${back ? C.skinShade : C.skin}" stroke="${O}" stroke-width="3.5"/>`;

  // Arm: shoulder -> elbow -> hand, with a t-shirt sleeve. back = the far arm (shaded).
  function arm(shoulder, elbow, hand, back) {
    const skin = back ? C.skinShade : C.skin;
    const shirt = back ? C.shirtShade : C.shirt;
    const sleeveEnd = [
      shoulder[0] + (elbow[0] - shoulder[0]) * 0.55,
      shoulder[1] + (elbow[1] - shoulder[1]) * 0.55,
    ];
    return limb([shoulder, elbow, hand], skin, 9) + limb([shoulder, sleeveEnd], shirt, 14) + handCircle(hand, back);
  }

  function star(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 ? r * 0.48 : r;
      pts.push(`${f1(cx + Math.cos(a) * rr)} ${f1(cy + Math.sin(a) * rr)}`);
    }
    return `<path d="M${pts.join(' L')} Z" fill="${C.star}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>`;
  }

  // Little yellow stars + twinkles
  function sparkles(list) {
    return list
      .map(([x, y, r], i) =>
        i % 2
          ? `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z" fill="#FFF1B8" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`
          : star(x, y, r))
      .join('');
  }

  // ---------- Oli's head (jumpnduck head(), side view facing right, centre 98,64 r 44) ----------
  function eye(cx, cy) {
    return (
      `<ellipse cx="${cx}" cy="${cy}" rx="7.5" ry="9.5" fill="#FFFFFF" stroke="${O}" stroke-width="3"/>` +
      `<circle cx="${cx + 1.5}" cy="${cy + 1}" r="5.5" fill="${C.eyeGreen}"/>` +
      `<circle cx="${cx + 1.8}" cy="${cy + 1.3}" r="2.8" fill="${O}"/>` +
      `<circle cx="${cx - 0.5}" cy="${cy - 2}" r="1.9" fill="#FFFFFF"/>`
    );
  }

  // Sad eye: looking down, heavy upper lid.
  function sadEye(cx, cy) {
    return (
      `<ellipse cx="${cx}" cy="${cy}" rx="7.5" ry="9.5" fill="#FFFFFF"/>` +
      `<circle cx="${cx + 1}" cy="${cy + 3.5}" r="5.5" fill="${C.eyeGreen}"/>` +
      `<circle cx="${cx + 1.2}" cy="${cy + 4}" r="2.8" fill="${O}"/>` +
      `<circle cx="${cx - 1}" cy="${cy + 1.5}" r="1.7" fill="#FFFFFF"/>` +
      // drooping lid covers the top of the eye
      `<path d="M${cx - 8} ${cy - 1} Q${cx} ${cy - 13} ${cx + 8} ${cy + 1} Q${cx} ${cy - 3} ${cx - 8} ${cy - 1} Z" fill="${C.skin}"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="7.5" ry="9.5" fill="none" stroke="${O}" stroke-width="3"/>` +
      `<path d="M${cx - 7.5} ${cy - 1} Q${cx} ${cy - 4} ${cx + 7.5} ${cy + 1}" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`
    );
  }

  // expr: 'normal' | 'sad'
  function head(expr = 'normal') {
    const sad = expr === 'sad';
    return (
      `<circle cx="98" cy="64" r="44" fill="${C.skin}" stroke="${O}" stroke-width="${SW}"/>` +
      // hair (back + fringe)
      `<path d="M56 76 C44 40 66 13 100 15 C131 15 151 34 144 60 C136 48 126 46 118 51 C113 42 103 40 96 49 C89 42 79 45 73 55 C69 61 66 68 64 76 Z" ` +
      `fill="${C.hair}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      // top tuft
      `<path d="M92 18 C86 4 99 -4 110 3 C103 7 102 11 107 17" fill="${C.hair}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"/>` +
      // hair shine
      `<path d="M72 34 Q84 24 98 24" fill="none" stroke="#FFF1B8" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M120 26 Q132 32 137 42" fill="none" stroke="${C.hairShade}" stroke-width="3.5" stroke-linecap="round"/>` +
      // ear
      `<circle cx="62" cy="72" r="10" fill="${C.skin}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M60 67 Q66 72 61 77" fill="none" stroke="${C.skinShade}" stroke-width="2.5" stroke-linecap="round"/>` +
      // eyebrows (worried when sad)
      (sad
        ? `<path d="M99 56 Q105 55 112 50" fill="none" stroke="${C.brow}" stroke-width="3.5" stroke-linecap="round"/>` +
          `<path d="M122 49 Q128 53 134 55" fill="none" stroke="${C.brow}" stroke-width="3.5" stroke-linecap="round"/>`
        : `<path d="M99 55 Q105 51 112 54" fill="none" stroke="${C.brow}" stroke-width="3.5" stroke-linecap="round"/>` +
          `<path d="M122 53 Q128 50 134 53" fill="none" stroke="${C.brow}" stroke-width="3.5" stroke-linecap="round"/>`) +
      (sad ? sadEye(106, 68) + sadEye(128, 66) : eye(106, 68) + eye(128, 66)) +
      // cheeks
      `<ellipse cx="98" cy="84" rx="7" ry="4.5" fill="${C.cheek}" opacity="0.55"/>` +
      `<ellipse cx="131" cy="82" rx="4.5" ry="4" fill="${C.cheek}" opacity="0.55"/>` +
      // nose
      `<path d="M136 74 Q141 78 135 82" fill="none" stroke="${C.skinShade}" stroke-width="3" stroke-linecap="round"/>` +
      (sad
        ? // small wobbly frown + a tear rolling down
          `<path d="M111 96 Q116 89 122 91 Q127 93 131 90" fill="none" stroke="${O}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` +
          `<path d="M104 78 Q98 87 98 91 A6 6 0 0 0 110 91 Q110 87 104 78 Z" fill="${C.tear}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
          `<circle cx="102" cy="89" r="1.6" fill="#FFFFFF"/>`
        : // big smile
          `<path d="M108 88 Q120 106 135 86 Q121 93 108 88 Z" fill="${C.mouth}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
          `<ellipse cx="121" cy="96" rx="5" ry="2.4" fill="${C.tongue}"/>`)
    );
  }

  // t-shirt torso (jumpnduck torso(), the jeans waist hides inside the basket)
  function torso() {
    return (
      `<path d="M81 148 L120 148 L120 166 Q120 172 113 172 L88 172 Q81 172 81 166 Z" fill="${C.jeans}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M83 118 Q83 106 95 106 L107 106 Q119 106 119 118 L121 150 Q121 157 114 157 L88 157 Q81 157 81 150 Z" fill="${C.shirt}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M89 120 L88 150" stroke="${C.shirtShade}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>`
    );
  }

  // ---------- Hammer: toy mallet, head UP, pivot (centre of mass) at 0,0 ----------
  const HAMMER_GRIP = 34; // y of the hand grip on the handle
  function hammerBody() {
    return (
      // wooden handle + knob
      limb([[0, -10], [0, 40]], C.wood, 9) +
      `<path d="M-1.5 -4 L-1.5 26" stroke="${C.woodLight}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<rect x="-7" y="28" width="14" height="16" rx="5" fill="${C.cap}" stroke="${O}" stroke-width="3"/>` +
      `<path d="M-7 33 L7 33 M-7 38 L7 38" stroke="${C.capShade}" stroke-width="2"/>` +
      // soft rubber head with yellow end caps
      `<rect x="-24" y="-36" width="48" height="28" rx="9" fill="${C.rubber}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M-18 -13 L18 -13" stroke="${C.rubberShade}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M-17 -30 Q-6 -33 6 -31" fill="none" stroke="${C.rubberLight}" stroke-width="3.5" stroke-linecap="round"/>` +
      `<rect x="-34" y="-39" width="13" height="34" rx="6" fill="${C.cap}" stroke="${O}" stroke-width="${SW}"/>` +
      `<rect x="21" y="-39" width="13" height="34" rx="6" fill="${C.cap}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M-30 -33 L-30 -24 M25 -33 L25 -24" stroke="#FFF1B8" stroke-width="3" stroke-linecap="round"/>`
    );
  }

  /** Spinning hammer for the canvas. viewBox -56 -56 112 112, pivot at the centre. */
  function hammer() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-56 -56 112 112" class="sprite hammer">${hammerBody()}</svg>`;
  }

  /** Motion arcs for a clockwise spin, same viewBox/centre as hammer(). Draw under the hammer. */
  function hammerTrail() {
    const arc = (r, a0, a1, w, op) => {
      const p = (a) => [Math.cos((a * Math.PI) / 180) * r, Math.sin((a * Math.PI) / 180) * r];
      const [x0, y0] = p(a0), [x1, y1] = p(a1);
      const d = `M${f1(x0)} ${f1(y0)} A${r} ${r} 0 0 1 ${f1(x1)} ${f1(y1)}`;
      return (
        `<path d="${d}" fill="none" stroke="${O}" stroke-width="${w + 3}" stroke-linecap="round" opacity="${op * 0.35}"/>` +
        `<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`
      );
    };
    // the hammer head points up (-90 deg); arcs trail behind it going clockwise
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-56 -56 112 112" class="sprite hammer-trail">` +
      arc(46, -200, -110, 5, 0.9) + arc(38, -185, -120, 4, 0.7) + arc(46, 0, 70, 4, 0.55) + arc(30, -170, -125, 3, 0.5) +
      `</svg>`
    );
  }

  /** Faint dotted landing ring on the grass. (0,0) = landing point. viewBox -40 -14 80 28. */
  function marker() {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -14 80 28" class="sprite marker">` +
      `<ellipse cx="0" cy="0" rx="30" ry="9" fill="${C.marker}" opacity="0.18"/>` +
      `<ellipse cx="0" cy="0" rx="30" ry="9" fill="none" stroke="${C.marker}" stroke-width="3" stroke-dasharray="0.1 7.5" stroke-linecap="round" opacity="0.85"/>` +
      `<ellipse cx="0" cy="0" rx="14" ry="4.2" fill="none" stroke="${C.marker}" stroke-width="2.5" stroke-dasharray="0.1 6" stroke-linecap="round" opacity="0.7"/>` +
      `<circle cx="0" cy="0" r="2.6" fill="${C.marker}" opacity="0.9"/>` +
      `</svg>`
    );
  }

  // ---------- The gondola ----------
  const VB = { x: -24, y: -72, w: 248, h: 288 };
  const ANCHOR = { x: 100, y: -40 };   // cable centreline under the trolley
  const RIM = { cx: 100, cy: 152, rx: 64, ry: 10 }; // basket opening (ellipse)
  const BASKET_BOTTOM = 212;

  function wheel(cx, cy, r) {
    return (
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.wheel}" stroke="${O}" stroke-width="3.5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.58}" fill="none" stroke="${C.wheelShade}" stroke-width="2.5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${C.hub}" stroke="${O}" stroke-width="2.5"/>` +
      `<circle cx="${cx - r * 0.35}" cy="${cy - r * 0.5}" r="1.8" fill="#FFFFFF" opacity="0.7"/>`
    );
  }

  // Trolley riding on the cable + hanger rods down to the rim ends. Drawn behind everything.
  function trolleyAndHanger() {
    const cy = ANCHOR.y, ax = ANCHOR.x;
    const joint = [ax, -12];
    return (
      // hanger rods (behind Oli)
      limb([joint, [RIM.cx - RIM.rx + 4, RIM.cy - 2]], C.steel, 5) +
      limb([joint, [RIM.cx + RIM.rx - 4, RIM.cy - 2]], C.steel, 5) +
      limb([[ax, cy + 8], joint], C.steel, 7) +
      `<circle cx="${joint[0]}" cy="${joint[1]}" r="6" fill="${C.steelLight}" stroke="${O}" stroke-width="3"/>` +
      // wheels sit ON the cable (their bottom touches the centreline)
      wheel(ax - 15, cy - 10, 10) +
      wheel(ax + 15, cy - 10, 10) +
      // side plate in front of the cable
      `<rect x="${ax - 26}" y="${cy - 9}" width="52" height="19" rx="8" fill="${C.trolley}" stroke="${O}" stroke-width="3.5"/>` +
      `<path d="M${ax - 18} ${cy - 3.5} L${ax + 18} ${cy - 3.5}" stroke="${C.trolleyHi}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<circle cx="${ax - 15}" cy="${cy + 3}" r="2.4" fill="${C.trolleyHi}"/><circle cx="${ax + 15}" cy="${cy + 3}" r="2.4" fill="${C.trolleyHi}"/>`
    );
  }

  // Basket interior + back rim, drawn behind Oli.
  function basketBack() {
    const { cx, cy, rx, ry } = RIM;
    return (
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.basketInside}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M${cx - rx + 6} ${cy - 2} A${rx - 6} ${ry - 3} 0 0 1 ${cx + rx - 6} ${cy - 2}" fill="none" stroke="${C.basketShade}" stroke-width="4" stroke-linecap="round"/>`
    );
  }

  // Basket body + front lip, drawn in front of Oli's waist.
  function basketFront() {
    const { cx, cy, rx, ry } = RIM;
    const L = cx - rx, R = cx + rx, B = BASKET_BOTTOM;
    const body = `M${L} ${cy} A${rx} ${ry} 0 0 0 ${R} ${cy} L${R - 10} ${B - 12} Q${R - 12} ${B} ${R - 24} ${B} L${L + 24} ${B} Q${L + 12} ${B} ${L + 10} ${B - 12} Z`;
    return (
      `<path d="${body}" fill="${C.basket}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      // shade on the bottom + white stripe + shine
      `<path d="M${L + 14} ${B - 14} Q${cx} ${B - 8} ${R - 14} ${B - 14}" fill="none" stroke="${C.basketShade}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M${L + 6} ${cy + 24} Q${cx} ${cy + 36} ${R - 6} ${cy + 24}" fill="none" stroke="${O}" stroke-width="13" stroke-linecap="round"/>` +
      `<path d="M${L + 6} ${cy + 24} Q${cx} ${cy + 36} ${R - 6} ${cy + 24}" fill="none" stroke="${C.stripe}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M${L + 12} ${cy + 12} L${L + 18} ${B - 22}" stroke="${C.basketLight}" stroke-width="4" stroke-linecap="round" opacity="0.8"/>` +
      // rivets
      [L + 22, cx - 20, cx + 20, R - 22].map((x, i) => `<circle cx="${x}" cy="${B - 26 + (i === 1 || i === 2 ? 3 : 0)}" r="2.6" fill="${C.basketShade}" stroke="${O}" stroke-width="1.5"/>`).join('') +
      // thick front lip of the rim
      `<path d="M${L} ${cy} A${rx} ${ry} 0 0 0 ${R} ${cy}" fill="none" stroke="${O}" stroke-width="13" stroke-linecap="round"/>` +
      `<path d="M${L} ${cy} A${rx} ${ry} 0 0 0 ${R} ${cy}" fill="none" stroke="${C.basketLight}" stroke-width="6" stroke-linecap="round"/>` +
      // bolts where the rods hold the rim
      `<circle cx="${L + 4}" cy="${cy - 1}" r="4" fill="${C.steelLight}" stroke="${O}" stroke-width="2.5"/>` +
      `<circle cx="${R - 4}" cy="${cy - 1}" r="4" fill="${C.steelLight}" stroke="${O}" stroke-width="2.5"/>`
    );
  }

  // Hammer held in a hand: grip at the hand, rotated by deg (0 = head up, + = clockwise).
  const heldHammer = (hand, deg) =>
    `<g transform="translate(${f1(hand[0])} ${f1(hand[1])}) rotate(${deg}) translate(0 ${-HAMMER_GRIP})">${hammerBody()}</g>`;

  // Rotate a point around the waist (for leaning).
  const WAIST = [100, 156];
  function rot(p, deg) {
    const a = (deg * Math.PI) / 180, dx = p[0] - WAIST[0], dy = p[1] - WAIST[1];
    return [WAIST[0] + dx * Math.cos(a) - dy * Math.sin(a), WAIST[1] + dx * Math.sin(a) + dy * Math.cos(a)];
  }

  /*
   * Poses (all facing right, in viewBox units).
   *   lean:   upper-body tilt around the waist, + = forward.   headTilt: extra head tilt (+ = chin down).
   *   back / front: [elbow, hand] of the far / near arm (shoulders follow the lean).
   *   backOnRim: redraw the far hand on top of the rim.     hammer: { arm: 'back'|'front', deg }.
   */
  const POSES = {
    idle: {
      lean: 0, headTilt: 0,
      back: [[80, 140], [70, 148]], backOnRim: true,
      front: [[128, 142], [148, 148]],
      hammer: { arm: 'front', deg: 40 },
    },
    windup: {
      lean: -7, headTilt: -3,
      back: [[64, 104], [52, 72]],
      front: [[132, 122], [154, 110]],
      hammer: { arm: 'back', deg: -40 },
    },
    throw: {
      lean: 10, headTilt: 4,
      back: [[80, 130], [70, 138]],
      front: [[140, 126], [168, 130]],
      swoosh: true,
    },
    cheer: {
      lean: 0, headTilt: -4,
      back: [[66, 104], [46, 76]],
      front: [[138, 104], [156, 72]],
      sparkles: [[22, 40, 9], [178, 26, 7], [196, 92, 6], [10, 104, 6], [150, -2, 5]],
    },
    sad: {
      lean: 8, headTilt: 10, expr: 'sad',
      back: [[82, 142], [74, 148]], backOnRim: true,
      front: [[124, 144], [134, 150]],
    },
  };

  function oliBody(p) {
    const backShoulder = rot([93, 120], p.lean), frontShoulder = rot([110, 120], p.lean);
    const hb = p.hammer && p.hammer.arm === 'back', hf = p.hammer && p.hammer.arm === 'front';
    const upper =
      `<g transform="rotate(${p.lean} ${WAIST[0]} ${WAIST[1]})">` +
      torso() +
      `<g transform="rotate(${p.headTilt} 98 104)">${head(p.expr)}</g>` +
      `</g>`;
    let s = '';
    // far arm (behind torso + head); a hammer in it goes behind it too
    if (hb) s += heldHammer(p.back[1], p.hammer.deg);
    s += arm(backShoulder, p.back[0], p.back[1], true);
    s += upper;
    s += basketFront();
    if (p.backOnRim) s += handCircle(p.back[1], true);
    // near arm in front of everything; its hammer between the arm and the hand
    s += limb([frontShoulder, p.front[0], p.front[1]], C.skin, 9) +
      limb([frontShoulder, [frontShoulder[0] + (p.front[0][0] - frontShoulder[0]) * 0.55, frontShoulder[1] + (p.front[0][1] - frontShoulder[1]) * 0.55]], C.shirt, 14);
    if (hf) s += heldHammer(p.front[1], p.hammer.deg);
    s += handCircle(p.front[1], false);
    if (p.swoosh) {
      s += `<path d="M170 86 Q190 98 192 120" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.9"/>` +
        `<path d="M164 100 Q178 106 182 120" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.7"/>`;
    }
    if (p.sparkles) s += sparkles(p.sparkles);
    return s;
  }

  /** Oli in the gondola. pose: oliPoses; facing: 'right' | 'left'. Shared viewBox oliViewBox. */
  function oli(pose = 'idle', facing = 'right') {
    const p = POSES[pose] || POSES.idle;
    const inner = trolleyAndHanger() + basketBack() + oliBody(p);
    const g = facing === 'left' ? `<g transform="translate(${2 * ANCHOR.x} 0) scale(-1 1)">${inner}</g>` : inner;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" class="sprite oli oli-${pose} oli-${facing}">` +
      g + `</svg>`
    );
  }

  // ---------- Cable + pylon ----------
  const CABLE_TILE = [120, 16], CABLE_Y = 8;
  /** Tileable steel cable. Tile 120 x 16, centreline at y = 8. */
  function cable() {
    let strands = '';
    for (let x = 0; x < CABLE_TILE[0]; x += 6) strands += `M${x + 1} ${CABLE_Y + 1.6} L${x + 4} ${CABLE_Y - 1.6} `;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CABLE_TILE[0]} ${CABLE_TILE[1]}" preserveAspectRatio="none" class="sprite cable">` +
      `<path d="M0 ${CABLE_Y} L${CABLE_TILE[0]} ${CABLE_Y}" stroke="${O}" stroke-width="8"/>` +
      `<path d="M0 ${CABLE_Y} L${CABLE_TILE[0]} ${CABLE_Y}" stroke="${C.steel}" stroke-width="3.5"/>` +
      `<path d="${strands}" stroke="${C.steelShade}" stroke-width="1.6" stroke-linecap="round"/>` +
      `</svg>`
    );
  }

  /** End post: steel lattice tower with a sheave on top. (0,0) = cable centreline, ground at y = height. */
  function pylon(height = 640) {
    const h = height, topY = 26, spread = 40;
    const legX = (y, side) => side * (12 + ((y - topY) / (h - topY - 16)) * (spread - 12));
    let lattice = '';
    const step = 46;
    let side = -1;
    for (let y = topY; y + step < h - 16; y += step) {
      lattice += `M${f1(legX(y, side))} ${y} L${f1(legX(y + step, -side))} ${y + step} `;
      lattice += `M${f1(legX(y, -1))} ${y} L${f1(legX(y, 1))} ${y} `;
      side = -side;
    }
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -30 120 ${h + 30}" class="sprite pylon">` +
      // lattice + legs
      `<path d="${lattice}" stroke="${O}" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="${lattice}" stroke="${C.steel}" stroke-width="3" stroke-linecap="round"/>` +
      limb([[-12, topY], [-spread, h - 16]], C.steel, 6) +
      limb([[12, topY], [spread, h - 16]], C.steel, 6) +
      // concrete feet
      `<rect x="${-spread - 14}" y="${h - 18}" width="28" height="18" rx="4" fill="#C5C9D0" stroke="${O}" stroke-width="3.5"/>` +
      `<rect x="${spread - 14}" y="${h - 18}" width="28" height="18" rx="4" fill="#C5C9D0" stroke="${O}" stroke-width="3.5"/>` +
      // head: cross beam + sheave the cable runs over
      `<rect x="-30" y="16" width="60" height="14" rx="6" fill="${C.basket}" stroke="${O}" stroke-width="3.5"/>` +
      limb([[0, 12], [0, 22]], C.steel, 6) +
      `<circle cx="0" cy="12" r="12" fill="${C.wheel}" stroke="${O}" stroke-width="3.5"/>` +
      `<circle cx="0" cy="12" r="6.5" fill="none" stroke="${C.wheelShade}" stroke-width="2.5"/>` +
      `<circle cx="0" cy="12" r="3.5" fill="${C.hub}" stroke="${O}" stroke-width="2.5"/>` +
      `</svg>`
    );
  }

  // ---------- Level banner ----------
  const FONT = `font-family="Fredoka, 'Arial Rounded MT Bold', 'Arial Black', Arial, sans-serif" font-weight="700" text-anchor="middle"`;
  /** "LEVEL n!" banner for level up. viewBox 0 0 300 130. */
  function levelBanner(n = 2) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 130" class="sprite level-banner">` +
      `<path d="M30 58 L8 50 L18 70 L8 90 L36 84 Z M270 58 L292 50 L282 70 L292 90 L264 84 Z" fill="${C.rubberShade}" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>` +
      `<rect x="26" y="40" width="248" height="58" rx="29" fill="${C.rubber}" stroke="${O}" stroke-width="5"/>` +
      `<path d="M48 50 L252 50" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.4"/>` +
      `<text x="150" y="86" ${FONT} font-size="42" fill="${C.star}" stroke="${O}" stroke-width="8" stroke-linejoin="round" paint-order="stroke" letter-spacing="2">LEVEL ${n}!</text>` +
      star(38, 22, 11) + star(262, 20, 9) + star(150, 16, 8) + star(250, 116, 8) + star(52, 114, 7) +
      `</svg>`
    );
  }

  // ---------- Effects ----------
  /** "+100 BONK!" popup when a mole is hit. viewBox 0 0 220 130. */
  function scorePopup(points = 100, label = 'BONK!', ribbon = C.wheel) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 130" class="sprite popup">` +
      star(24, 30, 10) + star(198, 22, 8) + star(204, 92, 9) + star(16, 96, 7) +
      `<path d="M30 54 l6 -6 M190 50 l-6 -6 M40 16 l3 8 M178 112 l-4 -6" stroke="${C.wheel}" stroke-width="3.5" stroke-linecap="round"/>` +
      `<text x="110" y="70" ${FONT} font-size="58" fill="${C.star}" stroke="${O}" stroke-width="9" stroke-linejoin="round" paint-order="stroke">+${points}</text>` +
      `<g transform="rotate(-4 110 98)">` +
      `<rect x="44" y="80" width="132" height="34" rx="17" fill="${ribbon}" stroke="${O}" stroke-width="4"/>` +
      `<path d="M58 86 L162 86" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.45"/>` +
      `<text x="110" y="105" ${FONT} font-size="20" fill="#FFFFFF" stroke="${O}" stroke-width="4" stroke-linejoin="round" paint-order="stroke" letter-spacing="1">${label}</text>` +
      `</g></svg>`
    );
  }

  // ---------- Front-facing portrait (for the score / HUD) ----------
  function frontEye(cx, cy) {
    return (
      `<ellipse cx="${cx}" cy="${cy}" rx="8" ry="10" fill="#FFFFFF" stroke="${O}" stroke-width="3"/>` +
      `<circle cx="${cx}" cy="${cy + 1}" r="6" fill="${C.eyeGreen}"/>` +
      `<circle cx="${cx}" cy="${cy + 1.3}" r="3" fill="${O}"/>` +
      `<circle cx="${cx - 2}" cy="${cy - 1.8}" r="2" fill="#FFFFFF"/>`
    );
  }

  /** Kid's face looking at the player. Returns an SVG string. */
  function kidFace() {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -6 120 126" class="sprite kid-face">` +
      // shoulders in the green t-shirt + neck
      `<path d="M20 122 Q22 98 44 93 L76 93 Q98 98 100 122 Z" fill="${C.shirt}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<rect x="51" y="86" width="18" height="14" rx="5" fill="${C.skinShade}" stroke="${O}" stroke-width="3"/>` +
      `<path d="M48 94 Q60 104 72 94" fill="none" stroke="${C.shirtShade}" stroke-width="4" stroke-linecap="round"/>` +
      // ears
      `<circle cx="21" cy="62" r="9" fill="${C.skin}" stroke="${O}" stroke-width="${SW}"/>` +
      `<circle cx="99" cy="62" r="9" fill="${C.skin}" stroke="${O}" stroke-width="${SW}"/>` +
      // head
      `<circle cx="60" cy="56" r="40" fill="${C.skin}" stroke="${O}" stroke-width="${SW}"/>` +
      // hair: cap + fringe, and the top tuft
      `<path d="M20 60 C14 24 40 8 60 10 C82 8 106 24 100 60 C96 48 90 41 82 39 C78 32 70 30 62 37 C56 30 46 31 40 39 C31 41 24 49 20 60 Z" ` +
      `fill="${C.hair}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M55 12 C51 0 63 -6 72 0 C66 3 65 7 68 12" fill="${C.hair}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<path d="M30 30 Q40 20 54 18" fill="none" stroke="#FFF1B8" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M84 20 Q94 28 97 40" fill="none" stroke="${C.hairShade}" stroke-width="3.5" stroke-linecap="round"/>` +
      // eyebrows + eyes
      `<path d="M38 48 Q45 44 52 47" fill="none" stroke="${C.brow}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M68 47 Q75 44 82 48" fill="none" stroke="${C.brow}" stroke-width="4" stroke-linecap="round"/>` +
      frontEye(45, 60) +
      frontEye(75, 60) +
      // nose, cheeks, big smile
      `<path d="M57 70 Q60 73 63 70" fill="none" stroke="${C.skinShade}" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="34" cy="75" rx="6.5" ry="4.2" fill="${C.cheek}" opacity="0.55"/>` +
      `<ellipse cx="86" cy="75" rx="6.5" ry="4.2" fill="${C.cheek}" opacity="0.55"/>` +
      `<path d="M46 77 Q60 96 74 77 Q60 83 46 77 Z" fill="${C.mouth}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<ellipse cx="60" cy="86" rx="5.5" ry="2.6" fill="${C.tongue}"/>` +
      `</svg>`
    );
  }

  // ---------- Background: Antibes seafront (copied from jumpnduck; tileable layers for parallax) ----------
  // Each layer's left and right edges match, so it can repeat horizontally forever.
  const BG = {
    sky: '#BFE6FF', skyLow: '#EAF7FF',
    mountFar: '#B8C5E0', mountNear: '#8FA3C8', mountLine: '#6F80A6', snow: '#FFFFFF', snowShade: '#DCE6F5',
    sea: '#3FA2DE', seaDeep: '#2C88C9', seaLight: '#8FD3F5',
    hull: '#FFFFFF', sail: '#FFFFFF', boatStripe: '#2C88C9', mast: '#5E636D',
  };
  Object.assign(C, { sky: BG.sky, mountains: BG.mountNear, snow: BG.snow, sea: BG.sea });

  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  // Ridge of peaks + snowcaps. pts alternate valley/peak and start/end at the same height.
  function ridge(pts, fill, snowFill, bottom, snowMinHeight) {
    const top = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
    // fill without outline (so tile edges don't show a seam), then outline only the ridge line
    let out =
      `<path d="${top} L${pts[pts.length - 1][0]} ${bottom} L${pts[0][0]} ${bottom} Z" fill="${fill}"/>` +
      `<path d="${top}" fill="none" stroke="${BG.mountLine}" stroke-width="3" stroke-linejoin="round"/>`;
    for (let i = 1; i < pts.length - 1; i++) {
      const pk = pts[i], l = pts[i - 1], r = pts[i + 1];
      if (pk[1] > l[1] || pk[1] > r[1] || Math.min(l[1], r[1]) - pk[1] < snowMinHeight) continue; // only real peaks
      const t = 0.55;
      const L = lerp(pk, l, t), R = lerp(pk, r, t);
      const m1 = lerp(L, R, 0.33), m2 = lerp(L, R, 0.66);
      const zig = `L${f1(m1[0])} ${f1(m1[1] - 6)} L${f1((m1[0] + m2[0]) / 2)} ${f1((m1[1] + m2[1]) / 2 + 4)} L${f1(m2[0])} ${f1(m2[1] - 6)}`;
      out += `<path d="M${pk[0]} ${pk[1]} L${f1(L[0])} ${f1(L[1])} ${zig} L${f1(R[0])} ${f1(R[1])} Z" fill="${snowFill}" stroke="${BG.mountLine}" stroke-width="2.5" stroke-linejoin="round"/>`;
    }
    return out;
  }

  /** Snowy mountains across the sea. Tile: 800 x 160. */
  function bgMountains() {
    const far = [[0, 100], [90, 52], [170, 88], [260, 26], [340, 82], [420, 48], [500, 86], [600, 22], [680, 78], [760, 52], [800, 100]];
    const near = [[0, 124], [60, 74], [120, 114], [190, 44], [250, 100], [310, 66], [370, 110], [450, 34], [520, 104], [580, 70], [640, 114], [710, 48], [770, 104], [800, 124]];
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 160" preserveAspectRatio="none" class="bg bg-mountains">` +
      ridge(far, BG.mountFar, BG.snowShade, 162, 30) +
      ridge(near, BG.mountNear, BG.snow, 162, 30) +
      `</svg>`
    );
  }

  /** The Mediterranean: calm bands, little waves and sparkles. Tile: 800 x 60. */
  function bgSea() {
    const waves = [[60, 20], [210, 38], [330, 16], [470, 44], [560, 26], [700, 40], [130, 50], [400, 30], [640, 12]]
      .map(([x, y]) => `<path d="M${x} ${y} q6 -5 12 0 q6 5 12 0" fill="none" stroke="${BG.seaLight}" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>`)
      .join('');
    const sparkles = [[160, 14], [520, 22], [740, 30], [290, 46]]
      .map(([x, y]) => `<path d="M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z" fill="#FFFFFF"/>`)
      .join('');
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 60" preserveAspectRatio="none" class="bg bg-sea">` +
      `<rect width="800" height="60" fill="${BG.sea}"/>` +
      `<rect y="34" width="800" height="26" fill="${BG.seaDeep}" opacity="0.5"/>` +
      `<rect width="800" height="5" fill="${BG.seaLight}"/>` +
      `<path d="M0 1.5 L800 1.5" stroke="${BG.mountLine}" stroke-width="3"/>` +
      waves + sparkles +
      `</svg>`
    );
  }
  /** Little sailboat that drifts on the sea. */
  function boat() {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 70" class="sprite boat">` +
      `<path d="M38 8 L38 52" stroke="${BG.mast}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M41 10 Q62 30 64 48 L41 48 Z" fill="${BG.sail}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M35 16 Q22 34 18 48 L35 48 Z" fill="${BG.sail}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M8 52 L72 52 Q66 64 56 64 L22 64 Q12 64 8 52 Z" fill="${BG.hull}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M14 57 L67 57" stroke="${BG.boatStripe}" stroke-width="3" stroke-linecap="round"/>` +
      `</svg>`
    );
  }

  /** Antibes old town on the water: ramparts, rocks, pastel houses, two stone towers, jetty + lighthouse.
   *  A single landmark (not a tile): base sits on the sea surface at y = 160. viewBox 420 x 170. */
  function oldTown() {
    const line = '#8A6A4A';
    const stone = '#E3C99A', stoneShade = '#CDAE7C', tower = '#D9B98A', towerShade = '#BF9E6C';
    const roof = '#D4693F', win = '#4D5E80', rock = '#B08F6E', rockShade = '#957457';
    const st = `stroke="${line}" stroke-width="2.5" stroke-linejoin="round"`;
    let s = '';

    // Towers first (houses overlap their bases)
    s += `<rect x="62" y="44" width="22" height="80" fill="${tower}" ${st}/>` +
      `<path d="M60 46 L86 46" stroke="${line}" stroke-width="3" stroke-linecap="round"/>` +
      `<rect x="68" y="54" width="4" height="8" rx="1.5" fill="${win}"/><rect x="74" y="54" width="4" height="8" rx="1.5" fill="${win}"/>` +
      `<rect x="78" y="46" width="5" height="78" fill="${towerShade}" opacity="0.5"/>`;
    // Tall castle tower with battlements + flag
    s += `<path d="M161 26 L161 8" stroke="${line}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M161 9 L172 12 L161 15 Z" fill="${C.wheel}" ${st}/>` +
      `<path d="M146 124 L146 22 L150 22 L150 27 L156 27 L156 22 L160 22 L160 27 L166 27 L166 22 L170 22 L170 27 L176 27 L176 22 L180 22 L180 124 Z" fill="${tower}" ${st}/>` +
      `<rect x="172" y="30" width="7" height="94" fill="${towerShade}" opacity="0.5"/>` +
      `<rect x="158" y="44" width="6" height="10" rx="3" fill="${win}"/>`;

    // Houses: [x, width, top, colour]; back row then front row
    const houses = [
      [8, 30, 78, '#F6DDB0'], [36, 26, 72, '#F2C27B'], [90, 50, 64, '#E9C08A'], [184, 30, 84, '#F2A9A0'], [212, 26, 96, '#F6DDB0'],
      [0, 26, 96, '#E9967A'], [24, 30, 90, '#F2C27B'], [52, 26, 100, '#F6DDB0'], [76, 34, 92, '#F2A9A0'],
      [108, 30, 98, '#F2C27B'], [136, 24, 106, '#E9967A'], [178, 32, 102, '#F6DDB0'], [226, 28, 106, '#F2C27B'],
    ];
    for (const [x, w, top, col] of houses) {
      s += `<rect x="${x}" y="${top}" width="${w}" height="${122 - top}" fill="${col}" ${st}/>`;
      s += `<rect x="${x - 2}" y="${top - 5}" width="${w + 4}" height="7" rx="2.5" fill="${roof}" ${st}/>`;
      for (let y = top + 8; y < 114; y += 12) {
        for (let wx = x + 5; wx + 4 < x + w - 2; wx += 10) s += `<rect x="${wx}" y="${y}" width="4" height="6" rx="1" fill="${win}"/>`;
      }
    }

    // Ramparts: high wall on the left, lower wall to the right
    s += `<path d="M-2 118 L152 118 L152 124 L252 124 L252 162 L-2 162 Z" fill="${stone}" ${st}/>` +
      `<path d="M0 132 L150 132 M0 146 L150 146 M152 138 L250 138 M40 118 L40 132 M96 132 L96 146 M128 118 L128 132 M20 146 L20 160 M190 124 L190 138 M224 138 L224 152" stroke="${stoneShade}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M0 121 L152 121" stroke="#F3DDB4" stroke-width="2"/>`;

    // Rocks at the foot of the walls
    s += `<path d="M150 162 Q152 144 166 142 Q172 132 186 136 Q196 128 210 136 Q224 132 232 142 Q248 138 256 148 Q272 146 284 162 Z" fill="${rock}" ${st}/>` +
      `<path d="M170 150 Q180 146 188 150 M214 146 Q222 144 228 150 M248 154 Q256 152 262 156" fill="none" stroke="${rockShade}" stroke-width="2" stroke-linecap="round"/>`;

    // Jetty with a little red lighthouse
    s += `<rect x="250" y="152" width="166" height="9" rx="3" fill="${stoneShade}" ${st}/>` +
      `<rect x="296" y="132" width="8" height="21" rx="2" fill="#E04848" ${st}/>` +
      `<path d="M294 133 L306 133 L300 126 Z" fill="#E04848" ${st}/>` +
      `<rect x="297" y="140" width="6" height="3" fill="#FFFFFF"/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 4 424 160" class="sprite oldtown">${s}</svg>`;
  }
  /** Cartoon sun for the sky: soft glow, rounded rays, gentle happy face. viewBox 120 x 120. */
  function sun() {
    let rays = '';
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const r1 = 36, r2 = i % 2 ? 50 : 55;
      rays += `M${f1(60 + Math.cos(a) * r1)} ${f1(60 + Math.sin(a) * r1)} L${f1(60 + Math.cos(a) * r2)} ${f1(60 + Math.sin(a) * r2)} `;
    }
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="sprite sun">` +
      `<defs><radialGradient id="sun-glow"><stop offset="0.45" stop-color="#FFF6C8" stop-opacity="0.85"/><stop offset="1" stop-color="#FFF6C8" stop-opacity="0"/></radialGradient></defs>` +
      `<circle cx="60" cy="60" r="60" fill="url(#sun-glow)"/>` +
      `<path d="${rays}" stroke="#E0A21C" stroke-width="9" stroke-linecap="round"/>` +
      `<path d="${rays}" stroke="#FFC93C" stroke-width="5" stroke-linecap="round"/>` +
      `<circle cx="60" cy="60" r="32" fill="#FFD34E" stroke="#E0A21C" stroke-width="3.5"/>` +
      `<path d="M42 50 Q52 38 66 38" fill="none" stroke="#FFF1B8" stroke-width="4" stroke-linecap="round"/>` +
      // closed happy eyes + smile + cheeks
      `<path d="M47 60 Q51 55 55 60 M65 60 Q69 55 73 60" fill="none" stroke="#C47A12" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M50 68 Q60 77 70 68" fill="none" stroke="#C47A12" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="44" cy="67" rx="4.5" ry="3" fill="#FF9A6A" opacity="0.6"/><ellipse cx="76" cy="67" rx="4.5" ry="3" fill="#FF9A6A" opacity="0.6"/>` +
      `</svg>`
    );
  }

  function toDataUrl(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  window.WAMAssets = {
    palette: C,
    oli,
    oliPoses: Object.keys(POSES),
    oliViewBox: { ...VB },
    oliAnchor: { ...ANCHOR },
    oliScale: 0.46,
    oliHand: { x: 168, y: 130 },
    cable,
    cableTile: CABLE_TILE.slice(),
    cableCentre: CABLE_Y,
    pylon,
    hammer,
    hammerTrail,
    hammerViewBox: { x: -56, y: -56, w: 112, h: 112 },
    marker,
    markerViewBox: { x: -40, y: -14, w: 80, h: 28 },
    kidFace,
    scorePopup,
    levelBanner,
    background: {
      mountains: bgMountains, sea: bgSea, oldTown, sun, boat,
      tiles: { mountains: [800, 160], sea: [800, 60] },
      sky: { top: BG.sky, bottom: BG.skyLow },
    },
    toDataUrl,
  };
})();
