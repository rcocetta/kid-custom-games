/*
 * Game assets: every sprite is drawn as SVG in code, so the same file feeds
 * both Assets.html (the portfolio) and, later, the game itself.
 *
 * Load with a plain <script src="assets.js"></script> (works from file://).
 * Everything is exposed on window.GameAssets.
 *
 * To use a sprite on a <canvas> later:
 *   const img = new Image();
 *   img.src = GameAssets.toDataUrl(GameAssets.kid('ride'));
 */
(function () {
  // ---------- Palette ----------
  const C = {
    outline: '#2E2A36',
    skin: '#FFDCC2',
    skinShade: '#F2B996',
    cheek: '#FF9AA2',
    hair: '#FFD34E',
    hairShade: '#E5A82A',
    eyeGreen: '#3FAE5A',
    shirt: '#52C25A',
    shirtShade: '#3E9C47',
    jeans: '#4A7BD0',
    jeansShade: '#3A62A8',
    shoe: '#FFFFFF',
    sole: '#D5D9E2',
    scooter: '#26262E',
    scooterHi: '#55555F',
    wheel: '#FF8A1F',
    wheelShade: '#D9650A',
    hub: '#FFE6CC',
    mouth: '#8E2F3C',
    tongue: '#FF7F8E',
    tear: '#7FD0FF',
    star: '#FFD34E',
  };
  const O = C.outline;
  const SW = 4; // outline width

  // ---------- Drawing helpers ----------
  // A limb drawn as a thick rounded stroke with an outline around it.
  function limb(points, color, width) {
    const d = 'M' + points.map((p) => p.join(' ')).join(' L');
    const common = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
    return (
      `<path d="${d}" ${common} stroke="${O}" stroke-width="${width + SW * 2}"/>` +
      `<path d="${d}" ${common} stroke="${color}" stroke-width="${width}"/>`
    );
  }

  // Shoe pointing right; (x, y) is roughly the heel-top. Sole bottom = y + 6.
  function shoe(x, y) {
    return (
      `<path d="M${x - 9} ${y + 3} Q${x - 10} ${y - 7} ${x} ${y - 7} Q${x + 12} ${y - 6} ${x + 15} ${y + 2} ` +
      `Q${x + 15} ${y + 6} ${x + 9} ${y + 6} L${x - 5} ${y + 6} Q${x - 9} ${y + 6} ${x - 9} ${y + 3} Z" ` +
      `fill="${C.shoe}" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<path d="M${x - 6} ${y + 2.5} L${x + 11} ${y + 2.5}" stroke="${C.sole}" stroke-width="2.5" stroke-linecap="round"/>`
    );
  }

  function wheel(cx, cy) {
    // Outer group positions the wheel; inner .wheel group can be spun with CSS.
    return (
      `<g transform="translate(${cx} ${cy})"><g class="wheel">` +
      `<circle r="15" fill="${C.wheel}" stroke="${O}" stroke-width="${SW}"/>` +
      `<circle r="9" fill="none" stroke="${C.wheelShade}" stroke-width="2.5"/>` +
      `<path d="M-9 0 L9 0 M0 -9 L0 9" stroke="${C.wheelShade}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<circle r="4.5" fill="${C.hub}" stroke="${O}" stroke-width="2.5"/>` +
      `<circle cx="-5" cy="-7" r="2.2" fill="#FFFFFF" opacity="0.7"/>` +
      `</g></g>`
    );
  }

  // ---------- Parts of the kid on the scooter ----------
  // Stem geometry: upright for riding, tipped forward (low) for ducking.
  const STEMS = {
    upright: { top: [151, 118], bar: [[140, 119], [164, 116]], shine: 'M153 130 L156 150' },
    low: { top: [204, 182], bar: [[198, 180], [220, 178]], shine: 'M174 198 L188 190' },
  };

  function scooter(stemKind = 'upright') {
    const st = STEMS[stemKind];
    return (
      // rear fender / brake
      limb([[38, 204], [44, 194], [60, 192]], C.scooter, 6) +
      // stem + joint to deck
      limb([[160, 214], st.top], C.scooter, 8) +
      limb([[138, 200], [154, 190]], C.scooter, 9) +
      // handlebar
      limb(st.bar, C.scooter, 7) +
      // deck
      `<rect x="42" y="194" width="110" height="13" rx="6.5" fill="${C.scooter}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M52 198.5 L140 198.5" stroke="${C.scooterHi}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<path d="${st.shine}" stroke="${C.scooterHi}" stroke-width="2.5" stroke-linecap="round"/>` +
      wheel(52, 214) +
      wheel(160, 214)
    );
  }

  function torso() {
    return (
      // jeans waist
      `<path d="M81 148 L120 148 L120 160 Q120 167 113 167 L88 167 Q81 167 81 160 Z" fill="${C.jeans}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      // t-shirt
      `<path d="M83 118 Q83 106 95 106 L107 106 Q119 106 119 118 L121 150 Q121 157 114 157 L88 157 Q81 157 81 150 Z" fill="${C.shirt}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M89 120 L88 150" stroke="${C.shirtShade}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>`
    );
  }

  function arm(shoulder, elbow, hand, back) {
    const skin = back ? C.skinShade : C.skin;
    const shirt = back ? C.shirtShade : C.shirt;
    const sleeveEnd = [
      shoulder[0] + (elbow[0] - shoulder[0]) * 0.55,
      shoulder[1] + (elbow[1] - shoulder[1]) * 0.55,
    ];
    return (
      limb([shoulder, elbow, hand], skin, 9) +
      limb([shoulder, sleeveEnd], shirt, 14) +
      `<circle cx="${hand[0]}" cy="${hand[1]}" r="6.5" fill="${skin}" stroke="${O}" stroke-width="3.5"/>`
    );
  }

  function xEye(cx, cy) {
    return `<path d="M${cx - 6} ${cy - 6} L${cx + 6} ${cy + 6} M${cx + 6} ${cy - 6} L${cx - 6} ${cy + 6}" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`;
  }

  function eye(cx, cy) {
    return (
      `<ellipse cx="${cx}" cy="${cy}" rx="7.5" ry="9.5" fill="#FFFFFF" stroke="${O}" stroke-width="3"/>` +
      `<circle cx="${cx + 1.5}" cy="${cy + 1}" r="5.5" fill="${C.eyeGreen}"/>` +
      `<circle cx="${cx + 1.8}" cy="${cy + 1.3}" r="2.8" fill="${O}"/>` +
      `<circle cx="${cx - 0.5}" cy="${cy - 2}" r="1.9" fill="#FFFFFF"/>`
    );
  }

  // ko = game-over face: X eyes, worried brows, wobbly frown, a tear.
  function head(ko = false) {
    return (
      // head
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
      // eyebrows
      (ko
        ? `<path d="M99 52 Q105 52 112 47" fill="none" stroke="${C.hairShade}" stroke-width="3.5" stroke-linecap="round"/>` +
          `<path d="M122 46 Q128 51 134 52" fill="none" stroke="${C.hairShade}" stroke-width="3.5" stroke-linecap="round"/>` +
          xEye(106, 68) +
          xEye(128, 66)
        : `<path d="M99 55 Q105 51 112 54" fill="none" stroke="${C.hairShade}" stroke-width="3.5" stroke-linecap="round"/>` +
          `<path d="M122 53 Q128 50 134 53" fill="none" stroke="${C.hairShade}" stroke-width="3.5" stroke-linecap="round"/>` +
          eye(106, 68) +
          eye(128, 66)) +
      // cheeks
      `<ellipse cx="98" cy="84" rx="7" ry="4.5" fill="${C.cheek}" opacity="0.55"/>` +
      `<ellipse cx="131" cy="82" rx="4.5" ry="4" fill="${C.cheek}" opacity="0.55"/>` +
      // nose
      `<path d="M136 74 Q141 78 135 82" fill="none" stroke="${C.skinShade}" stroke-width="3" stroke-linecap="round"/>` +
      (ko
        ? // wobbly frown + a big tear rolling down
          `<path d="M110 96 Q114 88 120 91 Q126 94 132 89 Q128 99 120 98 Q114 97 110 96 Z" fill="${C.mouth}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
          `<path d="M104 77 Q98 86 98 90 A6 6 0 0 0 110 90 Q110 86 104 77 Z" fill="${C.tear}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
          `<circle cx="102" cy="88" r="1.6" fill="#FFFFFF"/>`
        : // big smile
          `<path d="M108 88 Q120 106 135 86 Q121 93 108 88 Z" fill="${C.mouth}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
          `<ellipse cx="121" cy="96" rx="5" ry="2.4" fill="${C.tongue}"/>`)
    );
  }

  // Leg layouts per pose: [hip, (knee), foot]; shoe drawn at the foot.
  const POSES = {
    // both feet on the deck, cruising
    ride: {
      behind: [],
      onDeck: [
        [[90, 162], [86, 186]],
        [[110, 162], [114, 186]],
      ],
      tilt: 0,
    },
    // back foot kicking the ground
    push: {
      behind: [[[92, 162], [80, 192], [66, 220]]],
      onDeck: [[[110, 162], [116, 186]]],
      tilt: 0,
    },
    // knees tucked, scooter tilted up
    jump: {
      behind: [],
      onDeck: [
        [[90, 162], [102, 174], [86, 186]],
        [[110, 162], [126, 172], [114, 186]],
      ],
      tilt: -8,
    },
  };

  function legs(list, back) {
    return list
      .map((pts) => {
        const foot = pts[pts.length - 1];
        return limb(pts, back ? C.jeansShade : C.jeans, 12) + shoe(foot[0], foot[1] + 2);
      })
      .join('');
  }

  // Shoe facing backwards (mirrored), for legs stretched out behind.
  const shoeBack = (x, y) => `<g transform="translate(${2 * x} 0) scale(-1 1)">${shoe(x, y)}</g>`;

  // Duck pose: lying belly-down on the deck, bum up, stem tipped forward and low.
  // Same drawing scale as the other poses, just a lower/wider viewBox.
  function kidDuck() {
    const body =
      // back leg (knee on the deck, lower leg lying flat behind)
      limb([[74, 162], [60, 188], [40, 186]], C.jeansShade, 12) + shoeBack(38, 184) +
      scooter('low') +
      // arms reach forward under the head to the handlebar
      arm([126, 176], [164, 194], [200, 180], true) +
      arm([130, 182], [170, 198], [210, 178], false) +
      // front leg
      limb([[84, 164], [70, 190], [50, 188]], C.jeans, 12) + shoeBack(48, 186) +
      // lying torso + bum in the air
      limb([[88, 158], [126, 176]], C.shirt, 30) +
      `<path d="M96 156 L104 176" stroke="${C.shirtShade}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>` +
      `<ellipse cx="80" cy="155" rx="18" ry="16" fill="${C.jeans}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M70 146 Q76 141 84 141" fill="none" stroke="#7FA6E6" stroke-width="3.5" stroke-linecap="round"/>` +
      // head, chin resting near the front of the deck
      `<g transform="translate(52 84)">${head()}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 74 204 161" class="sprite kid kid-duck">${body}</svg>`;
  }

  function star(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 ? r * 0.48 : r;
      pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
    }
    return `<path d="M${pts.join(' L')} Z" fill="${C.star}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>`;
  }

  // Game over: fell off the scooter, sitting on the ground, X eyes and a tear.
  function kidGameOver() {
    const body =
      // the scooter tumbled behind him, front wheel in the air
      `<g transform="translate(-112 0) rotate(-22 52 229)">${scooter()}</g>` +
      // arm propped on the ground behind
      arm([92, 178], [76, 200], [66, 222], true) +
      // legs splayed out in front
      limb([[98, 214], [142, 220]], C.jeansShade, 12) + shoe(146, 222) +
      limb([[104, 210], [128, 196], [150, 218]], C.jeans, 12) + shoe(154, 220) +
      // bum on the ground + torso leaning back
      `<ellipse cx="100" cy="216" rx="19" ry="12" fill="${C.jeans}" stroke="${O}" stroke-width="${SW}"/>` +
      limb([[102, 206], [95, 174]], C.shirt, 32) +
      `<path d="M87 180 L92 204" stroke="${C.shirtShade}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>` +
      // head tilted back
      `<g transform="translate(-6 62) rotate(-10 98 64)">${head(true)}</g>` +
      // other arm propped on the ground in front
      arm([104, 180], [122, 198], [124, 222], false) +
      // dizzy stars
      star(54, 46, 9) + star(92, 22, 7) + star(140, 36, 8);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-82 10 262 225" class="sprite kid kid-gameover">${body}</svg>`;
  }

  /** Kid on scooter. pose: 'ride' | 'push' | 'jump' | 'duck' | 'gameover'. Returns an SVG string. */
  function kid(pose = 'ride') {
    if (pose === 'duck') return kidDuck();
    if (pose === 'gameover') return kidGameOver();
    const p = POSES[pose] || POSES.ride;
    const body =
      legs(p.behind, true) +
      scooter() +
      legs(p.onDeck, false) +
      arm([93, 120], [112, 132], [143, 120], true) +
      torso() +
      head() +
      arm([110, 120], [126, 132], [154, 117], false);
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 -10 165 245" class="sprite kid kid-${pose}">` +
      `<g transform="rotate(${p.tilt} 100 170)">${body}</g></svg>`
    );
  }

  // ---------- Seagull (flying obstacle, faces left toward the kid) ----------
  const G = {
    white: '#FFFFFF',
    belly: '#E9EEF5',
    wing: '#B9C4D2',
    wingFar: '#97A3B3',
    wingTip: '#3A3F4A',
    beak: '#FFC93C',
    beakDot: '#E8413C',
    feet: '#FF9A3C',
  };
  Object.assign(C, {
    gullWhite: G.white, gullWing: G.wing, gullTip: G.wingTip, gullBeak: G.beak, gullFeet: G.feet,
  });

  // Wing shapes per frame: [main wing path, black tip path]
  const WINGS = {
    up: [
      'M80 74 C80 42 98 18 128 6 C140 1 146 8 141 17 C135 28 138 34 131 43 C126 51 129 58 123 65 L124 76 Z',
      'M119 12 C129 4 144 0 141 17 C138 24 136 28 132 34 C125 28 121 21 119 12 Z',
    ],
    down: [
      'M82 78 L124 76 C129 85 126 92 133 100 C139 107 136 114 142 123 C145 132 136 137 127 131 C104 119 88 102 82 78 Z',
      'M125 115 C132 110 139 115 142 123 C145 132 136 137 127 131 C123 126 122 120 125 115 Z',
    ],
  };

  // Shared wing drawer for all birds. extra = additional markings drawn on the wing.
  function birdWing(frame, far, colors, extra = '') {
    const [main, tip] = WINGS[frame];
    const t = far ? ' transform="translate(-16 2) scale(0.98)"' : '';
    const fill = far ? colors.wingFar : colors.wing;
    return (
      `<g${t}>` +
      `<path d="${main}" fill="${fill}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      extra +
      `<path d="${tip}" fill="${colors.wingTip}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `</g>`
    );
  }
  const gullWing = (frame, far) => birdWing(frame, far, G);

  // Body + head + tail drawn as one silhouette: all outlines first, then all fills on top.
  function birdBody(headR, color) {
    const shapes = [
      '<ellipse cx="104" cy="82" rx="46" ry="27"/>',
      `<circle cx="${62 + (25 - headR) * 0.6}" cy="${64 + (25 - headR) * 0.4}" r="${headR}"/>`,
      '<path d="M140 74 L176 64 Q182 76 172 82 Q182 88 176 96 L140 94 Z" stroke-linejoin="round"/>',
    ];
    return (
      `<g fill="${O}" stroke="${O}" stroke-width="${SW * 2}" stroke-linejoin="round">${shapes.join('')}</g>` +
      `<g fill="${color}">${shapes.join('')}</g>`
    );
  }

  /** Seagull. frame: 'up' | 'down' (alternate them to flap). Returns an SVG string. */
  function seagull(frame = 'up') {
    if (!WINGS[frame]) frame = 'up';
    // Body + head + tail share one silhouette: draw all outlines first, then all fills on top.
    const shapes = [
      '<ellipse cx="104" cy="82" rx="46" ry="27"/>',
      '<circle cx="62" cy="64" r="25"/>',
      '<path d="M140 74 L176 64 Q182 76 172 82 Q182 88 176 96 L140 94 Z" stroke-linejoin="round"/>',
    ];
    const outline = `<g fill="${O}" stroke="${O}" stroke-width="${SW * 2}" stroke-linejoin="round">${shapes.join('')}</g>`;
    const fill = `<g fill="${G.white}">${shapes.join('')}</g>`;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 0 186 140" class="sprite seagull seagull-${frame}">` +
      gullWing(frame, true) +
      // tucked orange feet
      `<path d="M106 104 Q110 116 118 112 Q116 106 114 102 Z M120 104 Q126 116 133 110 Q130 105 127 101 Z" fill="${G.feet}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      outline +
      fill +
      // belly shade + grey tail tips
      `<ellipse cx="110" cy="96" rx="30" ry="8" fill="${G.belly}"/>` +
      `<path d="M166 68 L176 64 Q182 76 172 82 Q182 88 176 96 L166 95" fill="${G.wing}"/>` +
      // beak with the red dot
      `<path d="M42 60 Q24 60 14 69 Q24 77 42 74 Z" fill="${G.beak}" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>` +
      `<path d="M18 69 L40 68" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<circle cx="28" cy="72" r="2.8" fill="${G.beakDot}"/>` +
      // cheeky eye + eyebrow
      `<ellipse cx="56" cy="58" rx="7.5" ry="8.5" fill="#FFFFFF" stroke="${O}" stroke-width="3"/>` +
      `<circle cx="53.5" cy="59" r="4.2" fill="${O}"/>` +
      `<circle cx="52" cy="56.5" r="1.6" fill="#FFFFFF"/>` +
      `<path d="M46 45 Q55 45 66 51" fill="none" stroke="${G.wingFar}" stroke-width="4" stroke-linecap="round"/>` +
      `<ellipse cx="66" cy="72" rx="6" ry="3.8" fill="${C.cheek}" opacity="0.5"/>` +
      gullWing(frame, false) +
      `</svg>`
    );
  }

  // ---------- Pigeon (second flying obstacle, same flight frames as the seagull) ----------
  const PG = {
    body: '#9AA7BD',
    head: '#808DA6',
    belly: '#B9C3D4',
    wing: '#AEB9CB',
    wingFar: '#8793A8',
    wingTip: '#4A5263',
    bar: '#3E4555',
    neckGreen: '#4FB89A',
    neckPurple: '#9B6FC0',
    eye: '#FF8A3D',
    beak: '#4A4450',
    cere: '#EEF0F4',
    tailBand: '#3E4555',
  };
  Object.assign(C, { pigeon: PG.body, pigeonNeck: PG.neckGreen, pigeonEye: PG.eye });

  // Two dark bars across each wing, per frame
  const PIGEON_BARS = {
    up: 'M90 50 L124 47 M88 61 L120 61',
    down: 'M98 94 L124 94 M106 106 L132 106',
  };

  /** Pigeon. frame: 'up' | 'down'. Returns an SVG string. */
  function pigeon(frame = 'up') {
    if (!WINGS[frame]) frame = 'up';
    const bars = `<path d="${PIGEON_BARS[frame]}" stroke="${PG.bar}" stroke-width="4" stroke-linecap="round"/>`;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 0 186 140" class="sprite pigeon pigeon-${frame}">` +
      birdWing(frame, true, PG, bars) +
      // tucked pink feet
      `<path d="M106 104 Q110 116 118 112 Q116 106 114 102 Z M120 104 Q126 116 133 110 Q130 105 127 101 Z" fill="#F08A9A" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      birdBody(21, PG.body) +
      // head colour, belly, dark tail band
      `<circle cx="64.4" cy="65.6" r="21" fill="${PG.head}"/>` +
      `<ellipse cx="108" cy="96" rx="32" ry="8" fill="${PG.belly}"/>` +
      `<path d="M166 68 L176 64 Q182 76 172 82 Q182 88 176 96 L166 95" fill="${PG.tailBand}"/>` +
      // shiny green/purple neck
      `<path d="M50 80 Q68 94 88 80" fill="none" stroke="${PG.neckGreen}" stroke-width="8" stroke-linecap="round"/>` +
      `<path d="M54 86 Q70 96 86 86" fill="none" stroke="${PG.neckPurple}" stroke-width="4" stroke-linecap="round"/>` +
      // short beak with white bump
      `<path d="M47 64 Q36 66 31 71 Q37 74 47 72 Z" fill="${PG.beak}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<ellipse cx="45" cy="64" rx="4" ry="2.6" fill="${PG.cere}" stroke="${O}" stroke-width="1.5"/>` +
      // big orange eye, slightly surprised
      `<circle cx="58" cy="60" r="8" fill="#FFFFFF" stroke="${O}" stroke-width="3"/>` +
      `<circle cx="57" cy="60.5" r="5" fill="${PG.eye}"/>` +
      `<circle cx="56.5" cy="60.8" r="2.6" fill="${O}"/>` +
      `<circle cx="55" cy="58" r="1.5" fill="#FFFFFF"/>` +
      `<ellipse cx="70" cy="73" rx="5" ry="3.2" fill="${C.cheek}" opacity="0.45"/>` +
      birdWing(frame, false, PG, bars) +
      `</svg>`
    );
  }

  // ---------- Ground obstacles: poop + rocks ----------
  const P = { poop: '#8B5A2B', poopShade: '#6B4220', poopShine: '#B9844E', stink: '#9BCB5A' };
  const R = { rock: '#A7AEBB', rockShade: '#848C9A', rockShine: '#D3D8E0', moss: '#8CC56A' };
  Object.assign(C, { poop: P.poop, rock: R.rock });

  // Ground line is at the bottom of each viewBox, so sprites can sit on y = ground.
  /** Smiling poop. Returns an SVG string. */
  function poop() {
    const tier = (cx, cy, rx, ry) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${P.poop}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M${cx - rx + 8} ${cy + ry * 0.35} Q${cx} ${cy + ry + 1} ${cx + rx - 8} ${cy + ry * 0.35}" fill="none" stroke="${P.poopShade}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M${cx - rx * 0.62} ${cy - ry * 0.35} Q${cx - rx * 0.35} ${cy - ry * 0.75} ${cx - rx * 0.05} ${cy - ry * 0.72}" fill="none" stroke="${P.poopShine}" stroke-width="3.5" stroke-linecap="round"/>`;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -8 120 108" class="sprite poop">` +
      // stink wiggles
      `<path d="M30 30 Q24 22 30 14 Q36 6 30 -2" fill="none" stroke="${P.stink}" stroke-width="3.5" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M92 32 Q86 24 92 16 Q98 8 92 0" fill="none" stroke="${P.stink}" stroke-width="3.5" stroke-linecap="round" opacity="0.8"/>` +
      tier(60, 80, 46, 16) +
      tier(60, 60, 34, 14) +
      tier(60, 42, 22, 11) +
      // swirly tip
      `<path d="M54 33 Q54 20 64 18 Q72 17 70 24" fill="${P.poop}" stroke="${O}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>` +
      // happy face
      `<ellipse cx="49" cy="59" rx="5.5" ry="6.5" fill="#FFFFFF" stroke="${O}" stroke-width="2.5"/>` +
      `<ellipse cx="71" cy="59" rx="5.5" ry="6.5" fill="#FFFFFF" stroke="${O}" stroke-width="2.5"/>` +
      `<circle cx="50" cy="60" r="3" fill="${O}"/><circle cx="72" cy="60" r="3" fill="${O}"/>` +
      `<circle cx="48.8" cy="57.8" r="1.2" fill="#FFFFFF"/><circle cx="70.8" cy="57.8" r="1.2" fill="#FFFFFF"/>` +
      `<path d="M49 77 Q60 90 71 77 Q60 81 49 77 Z" fill="${C.mouth}" stroke="${O}" stroke-width="2.8" stroke-linejoin="round"/>` +
      `<ellipse cx="40" cy="71" rx="5" ry="3" fill="${C.cheek}" opacity="0.45"/>` +
      `<ellipse cx="80" cy="71" rx="5" ry="3" fill="${C.cheek}" opacity="0.45"/>` +
      `</svg>`
    );
  }

  // Each rock: list of [outline path, shine path, crack path]
  const ROCKS = {
    small: {
      viewBox: '0 30 120 60',
      parts: [[
        'M14 86 C8 70 18 56 34 52 C40 44 56 42 66 46 C80 44 96 52 100 64 C108 70 108 80 104 86 Z',
        'M30 60 Q40 52 54 52',
        'M78 56 L84 64 L80 70',
      ]],
    },
    big: {
      viewBox: '0 4 120 86',
      parts: [[
        'M10 86 C4 66 10 44 26 34 C30 20 46 12 62 16 C80 10 100 24 104 42 C114 52 114 74 108 86 Z',
        'M26 46 Q36 28 56 24',
        'M70 40 L78 52 L72 60 L78 70',
      ]],
    },
    pile: {
      viewBox: '0 30 120 60',
      parts: [
        ['M44 86 C40 66 50 48 66 44 C76 36 96 38 104 52 C112 60 114 74 112 86 Z', 'M58 56 Q66 48 78 48', 'M94 52 L98 62 L94 68'],
        ['M6 86 C4 70 16 58 34 58 C50 58 62 72 60 86 Z', 'M16 70 Q22 64 30 64', ''],
      ],
    },
  };

  function rockPart([d, shine, crack]) {
    return (
      `<path d="${d}" fill="${R.rock}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="${shine}" fill="none" stroke="${R.rockShine}" stroke-width="4" stroke-linecap="round"/>` +
      (crack ? `<path d="${crack}" fill="none" stroke="${R.rockShade}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : '')
    );
  }

  /** Rock. variant: 'small' | 'big' | 'pile'. Returns an SVG string. */
  function rock(variant = 'small') {
    const r = ROCKS[variant] || ROCKS.small;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r.viewBox}" class="sprite rock rock-${variant}">` +
      r.parts.map(rockPart).join('') +
      (variant === 'big'
        ? `<path d="M40 22 Q48 12 58 18 Q66 12 72 20 Q62 26 50 26 Q42 26 40 22 Z" fill="${R.moss}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>`
        : '') +
      `</svg>`
    );
  }

  // ---------- Cactus ----------
  const K = { green: '#5DBB63', shade: '#46984C', shine: '#8FD98F', flower: '#FF7EB6', flowerMid: '#FFD34E' };
  Object.assign(C, { cactus: K.green, cactusFlower: K.flower });
  const CACTUS_BASE = 78; // trunk bottom; rounded end sits on the ground at ~y 92

  function cactusPlant(x, top, w, arms, face) {
    const armW = Math.round(w * 0.55);
    let s = arms.map((a) => limb(a, K.green, armW)).join('');
    s += limb([[x, CACTUS_BASE], [x, top]], K.green, w);
    // ribs + shine
    s += `<path d="M${x - w * 0.22} ${CACTUS_BASE + 4} L${x - w * 0.22} ${top + (face ? 34 : 6)} M${x + w * 0.22} ${CACTUS_BASE + 4} L${x + w * 0.22} ${top + (face ? 34 : 6)}" stroke="${K.shade}" stroke-width="2.5" stroke-linecap="round"/>`;
    s += `<path d="M${x - w * 0.3} ${top + 2} Q${x - w * 0.2} ${top - w * 0.3} ${x} ${top - w * 0.38}" fill="none" stroke="${K.shine}" stroke-width="3" stroke-linecap="round"/>`;
    // little spines along the edges
    const spines = [];
    for (let y = top + 8; y < CACTUS_BASE; y += 14) {
      spines.push(`M${x - w / 2 - 2} ${y} l-5 -2`, `M${x + w / 2 + 2} ${y + 7} l5 -2`);
    }
    for (const a of arms) {
      const tip = a[a.length - 1];
      spines.push(`M${tip[0] - armW / 2 - 2} ${tip[1] + 6} l-4 -2`, `M${tip[0] + armW / 2 + 2} ${tip[1] + 10} l4 -2`);
    }
    s += `<path d="${spines.join(' ')}" stroke="${O}" stroke-width="2.2" stroke-linecap="round"/>`;
    if (face) {
      s += `<circle cx="${x - 6}" cy="${top + 16}" r="2.8" fill="${O}"/><circle cx="${x + 6}" cy="${top + 16}" r="2.8" fill="${O}"/>` +
        `<circle cx="${x - 6.8}" cy="${top + 15}" r="1" fill="#FFFFFF"/><circle cx="${x + 5.2}" cy="${top + 15}" r="1" fill="#FFFFFF"/>` +
        `<path d="M${x - 5} ${top + 23} Q${x} ${top + 28} ${x + 5} ${top + 23}" fill="none" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>` +
        `<ellipse cx="${x - 10}" cy="${top + 22}" rx="3.5" ry="2.2" fill="${C.cheek}" opacity="0.6"/>` +
        `<ellipse cx="${x + 10}" cy="${top + 22}" rx="3.5" ry="2.2" fill="${C.cheek}" opacity="0.6"/>`;
    }
    return s;
  }

  function cactusFlower(x, y) {
    const petals = [0, 72, 144, 216, 288]
      .map((a) => {
        const r = (a * Math.PI) / 180;
        return `<circle cx="${(x + Math.sin(r) * 5).toFixed(1)}" cy="${(y - Math.cos(r) * 5).toFixed(1)}" r="4.2" fill="${K.flower}" stroke="${O}" stroke-width="2"/>`;
      })
      .join('');
    return petals + `<circle cx="${x}" cy="${y}" r="3" fill="${K.flowerMid}"/>`;
  }

  const CACTI = {
    tall: {
      viewBox: '6 -4 108 100',
      draw: () =>
        cactusPlant(60, 22, 26, [[[60, 62], [34, 62], [34, 42]], [[60, 50], [86, 50], [86, 30]]], true) +
        cactusFlower(60, 6),
    },
    small: {
      viewBox: '28 30 64 66',
      draw: () => cactusPlant(60, 56, 24, [[[60, 70], [78, 70], [78, 58]]], false) + cactusFlower(60, 42),
    },
    double: {
      viewBox: '6 4 130 92',
      draw: () =>
        cactusPlant(108, 54, 22, [[[108, 68], [124, 68], [124, 56]]], false) +
        cactusPlant(56, 30, 26, [[[56, 64], [32, 64], [32, 46]], [[56, 52], [80, 52], [80, 38]]], true),
    },
  };

  /** Cactus. variant: 'tall' | 'small' | 'double'. Returns an SVG string. */
  function cactus(variant = 'tall') {
    const c = CACTI[variant] || CACTI.tall;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${c.viewBox}" class="sprite cactus cactus-${variant}">${c.draw()}</svg>`;
  }

  // ---------- Collectibles: yummy food ----------
  const F = {
    meat: '#D98A3D', meatShade: '#B86A28', meatShine: '#F5BC72', bone: '#FFF4DC',
    broc: '#4CAF50', brocShade: '#3A8F3E', brocShine: '#7FD17F', stem: '#A8D86E',
    carrot: '#FF8A2A', carrotShade: '#E0680F', leaf: '#5DBB63',
    steak: '#B5482E', steakShade: '#8E3320', fat: '#FFE3C8', grill: '#6E2416',
    eggWhite: '#FFFFFF', eggShade: '#EEF0F4', yolk: '#FFC21A', yolkShine: '#FFE27A',
  };
  Object.assign(C, { chicken: F.meat, broccoli: F.broc, carrot: F.carrot, steak: F.steak, yolk: F.yolk });

  // Little happy face shared by all foods; (x, y) is between the eyes.
  function foodFace(x, y) {
    return (
      `<circle cx="${x - 7}" cy="${y}" r="2.8" fill="${O}"/><circle cx="${x + 7}" cy="${y}" r="2.8" fill="${O}"/>` +
      `<circle cx="${x - 7.8}" cy="${y - 1}" r="1" fill="#FFFFFF"/><circle cx="${x + 6.2}" cy="${y - 1}" r="1" fill="#FFFFFF"/>` +
      `<path d="M${x - 5} ${y + 5} Q${x} ${y + 10} ${x + 5} ${y + 5}" fill="none" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<ellipse cx="${x - 12}" cy="${y + 5}" rx="3.5" ry="2.2" fill="${C.cheek}" opacity="0.6"/>` +
      `<ellipse cx="${x + 12}" cy="${y + 5}" rx="3.5" ry="2.2" fill="${C.cheek}" opacity="0.6"/>`
    );
  }

  // Draw several shapes as one silhouette: outlines first, then fills.
  function blob(shapes, fill) {
    return (
      `<g fill="${O}" stroke="${O}" stroke-width="${SW * 2}" stroke-linejoin="round">${shapes}</g>` +
      `<g fill="${fill}">${shapes}</g>`
    );
  }

  const FOODS = {
    chicken: () =>
      // bone with two knobs
      limb([[56, 62], [78, 84]], F.bone, 10) +
      `<circle cx="84" cy="80" r="6.5" fill="${F.bone}" stroke="${O}" stroke-width="3.5"/>` +
      `<circle cx="78" cy="90" r="6.5" fill="${F.bone}" stroke="${O}" stroke-width="3.5"/>` +
      // meat
      `<path d="M30 16 C52 6 78 20 76 44 C75 58 66 64 58 68 C48 74 26 72 18 58 C10 42 14 24 30 16 Z" fill="${F.meat}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M22 56 Q36 70 58 64" fill="none" stroke="${F.meatShade}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M26 26 Q34 18 46 17" fill="none" stroke="${F.meatShine}" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="64" cy="30" r="2.2" fill="${F.meatShade}"/><circle cx="22" cy="42" r="2" fill="${F.meatShade}"/><circle cx="68" cy="52" r="1.8" fill="${F.meatShade}"/>` +
      foodFace(44, 40),

    broccoli: () =>
      limb([[50, 86], [50, 60]], F.stem, 18) +
      blob(
        '<circle cx="32" cy="42" r="15"/><circle cx="50" cy="30" r="17"/><circle cx="68" cy="42" r="15"/>' +
          '<circle cx="40" cy="54" r="12"/><circle cx="60" cy="54" r="12"/><circle cx="50" cy="46" r="14"/>',
        F.broc
      ) +
      `<path d="M24 50 Q32 58 40 56 M60 58 Q70 58 76 48" fill="none" stroke="${F.brocShade}" stroke-width="3.5" stroke-linecap="round"/>` +
      `<circle cx="42" cy="22" r="3" fill="${F.brocShine}"/><circle cx="26" cy="36" r="2.5" fill="${F.brocShine}"/><circle cx="64" cy="32" r="2.5" fill="${F.brocShine}"/>` +
      `<path d="M44 78 L44 86" stroke="#8FC257" stroke-width="3" stroke-linecap="round"/>` +
      foodFace(50, 42),

    carrot: () =>
      // leaves
      `<g fill="${F.leaf}" stroke="${O}" stroke-width="3.5" stroke-linejoin="round">` +
      `<ellipse cx="40" cy="18" rx="6" ry="13" transform="rotate(-30 40 18)"/>` +
      `<ellipse cx="60" cy="18" rx="6" ry="13" transform="rotate(30 60 18)"/>` +
      `<ellipse cx="50" cy="13" rx="6.5" ry="14"/></g>` +
      // body
      `<path d="M30 32 Q50 20 70 32 Q68 62 54 90 Q50 96 46 90 Q32 62 30 32 Z" fill="${F.carrot}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M54 56 L60 55 M50 72 L55 71 M40 60 L45 62 M47 80 L51 80" stroke="${F.carrotShade}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M36 36 Q38 46 40 52" fill="none" stroke="#FFB673" stroke-width="3.5" stroke-linecap="round"/>` +
      foodFace(50, 42),

    steak: () =>
      // fat rim + meat
      `<path d="M14 48 C12 26 38 14 60 18 C84 22 92 44 86 62 C80 80 54 84 34 78 C18 72 16 62 14 48 Z" fill="${F.fat}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M22 48 C21 32 40 24 58 26 C76 29 82 45 78 58 C73 72 54 75 38 70 C26 66 23 58 22 48 Z" fill="${F.steak}"/>` +
      // marbling
      `<path d="M60 34 Q68 40 66 50 M70 60 Q62 64 58 70" fill="none" stroke="${F.fat}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
      // grill marks
      `<path d="M28 40 L44 30 M26 56 L50 38 M34 66 L54 52" stroke="${F.grill}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>` +
      `<path d="M28 30 Q38 22 50 22" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.7"/>` +
      foodFace(44, 50),

    egg: () =>
      `<path d="M18 52 C12 32 30 16 48 22 C64 12 88 24 84 44 C92 62 76 82 56 78 C38 88 14 74 18 52 Z" fill="${F.eggWhite}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M24 64 Q34 76 50 74" fill="none" stroke="${F.eggShade}" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="50" cy="48" r="18" fill="${F.yolk}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M38 42 Q41 34 49 32" fill="none" stroke="${F.yolkShine}" stroke-width="3.5" stroke-linecap="round"/>` +
      foodFace(50, 48),
  };

  /** Food collectible. kind: 'chicken' | 'broccoli' | 'carrot' | 'steak' | 'egg'. Returns an SVG string. */
  function food(kind = 'chicken') {
    const draw = FOODS[kind] || FOODS.chicken;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 0 96 100" class="sprite food food-${kind}">${draw()}</svg>`;
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
      `<path d="M38 48 Q45 44 52 47" fill="none" stroke="${C.hairShade}" stroke-width="3.5" stroke-linecap="round"/>` +
      `<path d="M68 47 Q75 44 82 48" fill="none" stroke="${C.hairShade}" stroke-width="3.5" stroke-linecap="round"/>` +
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

  // ---------- Background: Antibes seafront (tileable layers for parallax) ----------
  // Each layer's left and right edges match, so it can repeat horizontally forever.
  const BG = {
    sky: '#BFE6FF', skyLow: '#EAF7FF',
    mountFar: '#B8C5E0', mountNear: '#8FA3C8', mountLine: '#6F80A6', snow: '#FFFFFF', snowShade: '#DCE6F5',
    sea: '#3FA2DE', seaDeep: '#2C88C9', seaLight: '#8FD3F5',
    curb: '#C5C9D0', curbLine: '#A9AEB7', curbFace: '#9DA2AC', asphalt: '#7E838D', asphaltDot: '#727780', lane: '#F4F4F4', groundLine: '#5E636D',
    hull: '#FFFFFF', sail: '#FFFFFF', boatStripe: '#2C88C9', mast: '#5E636D',
  };
  Object.assign(C, { sky: BG.sky, mountains: BG.mountNear, snow: BG.snow, sea: BG.sea, sidewalk: BG.curb, asphalt: BG.asphalt });

  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const f1 = (n) => n.toFixed(1);

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

  /** Grey city ground: sidewalk/promenade on top (the riding line), curb, asphalt with lane dashes. Tile: 400 x 60. */
  function bgGround() {
    let joints = '', dashes = '', dots = '';
    for (let x = 0; x < 400; x += 50) {
      joints += `M${x + 25} 4 L${x + 25} 20 `;
      dashes += `M${x + 12} 44 L${x + 38} 44 `;
    }
    [[30, 34], [95, 52], [160, 38], [230, 56], [290, 33], [350, 50], [70, 56], [200, 48], [380, 37]].forEach(([x, y]) => {
      dots += `<circle cx="${x}" cy="${y}" r="1.6" fill="${BG.asphaltDot}"/>`;
    });
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 60" preserveAspectRatio="none" class="bg bg-ground">` +
      `<rect width="400" height="60" fill="${BG.asphalt}"/>` +
      `<rect width="400" height="22" fill="${BG.curb}"/>` +
      `<path d="${joints}" stroke="${BG.curbLine}" stroke-width="2"/>` +
      `<path d="M0 8 L400 8" stroke="#D6D9DF" stroke-width="2"/>` +
      `<rect y="22" width="400" height="6" fill="${BG.curbFace}"/>` +
      `<path d="M0 22 L400 22 M0 28 L400 28" stroke="${BG.groundLine}" stroke-width="1.5"/>` +
      `<path d="${dashes}" stroke="${BG.lane}" stroke-width="3.5" stroke-linecap="round"/>` +
      dots +
      `<path d="M0 1.5 L400 1.5" stroke="${BG.groundLine}" stroke-width="3"/>` +
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

  /** "Nomade" — the white letter-sculpture on the Antibes bastion: a crouching figure hugging its knees,
   *  made of steel letters, on a stepped pedestal. Its own sprite (a landmark, not an obstacle).
   *  viewBox 200 x 230; the pedestal bottom (y = 226) is the ground line. */
  function nomade() {
    const body =
      'M50 198 C20 170 22 122 48 102 C56 96 60 90 60 82 C48 72 48 42 64 28 C80 14 106 16 115 34 ' +
      'C122 46 118 58 108 62 C102 66 96 72 92 80 C96 90 104 98 112 104 C118 92 138 88 152 98 ' +
      'C168 110 170 150 162 198 Z';
    // Steel letters filling the figure (clipped to the body shape)
    const phrase = 'ANTIBESNOMADEMERSOLEILJOUERRIRESCOOTERAMISPLAGEVAGUEMONTAGNEPORTBATEAU';
    let letters = '', k = 0;
    for (let y = 26, row = 0; y < 200; y += 11, row++) {
      for (let x = 28 + (row % 2) * 5; x < 172; x += 10) {
        const ch = phrase[k++ % phrase.length];
        const rot = ((k * 37) % 30) - 15;
        letters += `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y - 3})">${ch}</text>`;
      }
    }
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 6 200 224" class="sprite nomade">` +
      `<defs><clipPath id="nomade-body"><path d="${body}"/></clipPath></defs>` +
      // pedestal: two beige steps
      `<rect x="14" y="204" width="172" height="12" rx="3" fill="#F0DCCB" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<rect x="4" y="214" width="192" height="12" rx="3" fill="#E6CDB8" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M20 208 L180 208" stroke="#FBEFE5" stroke-width="2" stroke-linecap="round"/>` +
      // shadow of the open mesh on the pedestal
      `<ellipse cx="100" cy="205" rx="66" ry="4" fill="#9FB0C8" opacity="0.6"/>` +
      // figure: pale see-through body, white letters, outline
      `<path d="${body}" fill="#DCE6F4"/>` +
      `<g clip-path="url(#nomade-body)" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="11" ` +
      `fill="#FFFFFF" stroke="#A9B8CE" stroke-width="1.6" paint-order="stroke" text-anchor="middle">${letters}</g>` +
      // the curve where the knees meet the chest, and the arm hugging them
      `<path d="M112 104 C108 132 112 170 118 198" fill="none" stroke="#8D9DB6" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="${body}" fill="none" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      // a soft shine
      `<path d="M70 34 Q80 24 94 24" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>` +
      `</svg>`
    );
  }

  /** Ferris wheel (like the one at the port). White frame, colourful gondolas, little lights.
   *  The wheel is <g class="ferris-wheel"> (rotate around 100,96) and each gondola is <g class="gondola">
   *  with its own transform-origin, so CSS can spin the wheel and counter-spin gondolas to keep them upright.
   *  viewBox 200 x 230; base bottom (y = 226) is the ground line. */
  function ferrisWheel() {
    const cx = 100, cy = 96, R = 78;
    const frame = '#F4F6FA', spoke = '#9AA3B5';
    const cols = ['#FF5D5D', '#FFC93C', '#4A9BE8', '#5DBB63', '#FF8AC4', '#FF8A1F', '#9B6FC0', '#3CC6C0'];
    let spokes = '', lights = '', gondolas = '';
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      spokes += `M${cx} ${cy} L${f1(cx + Math.cos(a) * R)} ${f1(cy + Math.sin(a) * R)} `;
    }
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI * 2 * (i + 0.5)) / 24;
      lights += `<circle cx="${f1(cx + Math.cos(a) * R)}" cy="${f1(cy + Math.sin(a) * R)}" r="2.3" fill="#FFE27A"/>`;
    }
    cols.forEach((col, i) => {
      const a = (Math.PI * 2 * i) / cols.length - Math.PI / 2;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      gondolas +=
        `<g class="gondola" style="transform-origin:${f1(x)}px ${f1(y)}px">` +
        `<path d="M${f1(x)} ${f1(y)} L${f1(x)} ${f1(y + 6)}" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>` +
        `<path d="M${f1(x - 11)} ${f1(y + 8)} Q${f1(x)} ${f1(y + 2)} ${f1(x + 11)} ${f1(y + 8)} Z" fill="${col}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
        `<rect x="${f1(x - 10)}" y="${f1(y + 8)}" width="20" height="14" rx="5" fill="${col}" stroke="${O}" stroke-width="2.5"/>` +
        `<rect x="${f1(x - 6)}" y="${f1(y + 11)}" width="12" height="5" rx="2" fill="#FFFFFF" opacity="0.85"/>` +
        `</g>`;
    });
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 230" class="sprite ferris">` +
      `<g class="ferris-wheel" style="transform-origin:${cx}px ${cy}px">` +
      `<path d="${spokes}" stroke="${spoke}" stroke-width="2.5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${O}" stroke-width="11"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${frame}" stroke-width="5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${R - 14}" fill="none" stroke="${spoke}" stroke-width="2.5"/>` +
      lights +
      gondolas +
      `</g>` +
      // A-frame legs, hub and base
      limb([[cx, cy], [64, 216]], frame, 7) +
      limb([[cx, cy], [136, 216]], frame, 7) +
      limb([[72, 202], [128, 202]], frame, 5) +
      `<circle cx="${cx}" cy="${cy}" r="10" fill="${C.wheel}" stroke="${O}" stroke-width="3.5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${O}"/>` +
      `<rect x="46" y="212" width="108" height="14" rx="5" fill="#E3C99A" stroke="${O}" stroke-width="3.5"/>` +
      `<path d="M54 217 L146 217" stroke="#F3DDB4" stroke-width="2" stroke-linecap="round"/>` +
      `</svg>`
    );
  }

  function toDataUrl(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  window.GameAssets = {
    palette: C,
    kid,
    kidPoses: [...Object.keys(POSES), 'duck', 'gameover'],
    kidFace,
    seagull,
    seagullFrames: Object.keys(WINGS),
    pigeon,
    pigeonFrames: Object.keys(WINGS),
    poop,
    rock,
    rockVariants: Object.keys(ROCKS),
    cactus,
    cactusVariants: Object.keys(CACTI),
    food,
    foodKinds: Object.keys(FOODS),
    background: { mountains: bgMountains, sea: bgSea, ground: bgGround, boat, oldTown, nomade, ferrisWheel, tiles: { mountains: [800, 160], sea: [800, 60], ground: [400, 60] }, groundRideLine: 6 },
    toDataUrl,
  };
})();
