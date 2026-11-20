/*
 * Taekwondo Master: arena art. An outdoor training hall in Antibes, drawn as SVG strings in code
 * (same cartoon style as Oli's Scooter Dash: thick #2E2A36 rounded outline, friendly colours).
 *
 * Load with a plain <script src="arena.js"></script> (works from file://). Exposes window.TKDArena:
 *   arena()   one SVG string with every layer (viewBox 0 0 1200 520)
 *   layers    { sky, far, hall, floor }: each a full-size transparent-background SVG string (sky is opaque),
 *             to be drawn back to front on a canvas (via Image + data URL)
 *   palette   colours used
 *   floorY    y of the mat where the fighters' feet stand
 *   minX/maxX usable fighting x-range (also in bounds)
 * The background helpers (ridge, mountains, sea, boat, old town, sun, cactus) are copied from jumpnduck/assets.js.
 */
(function () {
  const W = 1200, H = 520;
  const O = '#2E2A36';
  const SW = 4;
  const C = { wheel: '#FF8A1F', cheek: '#FF9AA2' };

  // A limb drawn as a thick rounded stroke with an outline around it.
  function limb(points, color, width) {
    const d = 'M' + points.map((p) => p.join(' ')).join(' L');
    const common = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
    return (
      `<path d="${d}" ${common} stroke="${O}" stroke-width="${width + SW * 2}"/>` +
      `<path d="${d}" ${common} stroke="${color}" stroke-width="${width}"/>`
    );
  }


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


  // ================= Arena =================
  const FLOOR_Y = 462;                 // where the fighters' feet stand (on the mat)
  const MIN_X = 140, MAX_X = 1060;     // usable fighting range
  const HORIZON = 262;                 // top of the sea

  const A = {
    wood: '#C98F55', woodLight: '#E0AE78', woodShade: '#A5703E', woodDark: '#8A5A2F',
    stone: '#EBD3A8', stoneShade: '#D2B686', stoneLight: '#F6E6C4',
    pot: '#E2784A', potShade: '#BE5B33', palm: '#5DBB63', palmShade: '#46984C', palmTrunk: '#B98550',
    blue: '#3F7FE0', blueShade: '#2F63B8', blueLight: '#6FA3F0',
    red: '#EA5557', redShade: '#BF3B40', redLight: '#F58284',
    cloth: '#E8514F', white: '#FFFFFF',
  };

  const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const wrap = (body, defs = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="tkd-arena">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;

  function cloud(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})" fill="#FFFFFF" opacity="0.9">` +
      `<ellipse cx="0" cy="0" rx="46" ry="16"/><circle cx="-14" cy="-12" r="16"/><circle cx="12" cy="-18" r="20"/><circle cx="32" cy="-6" r="12"/></g>`;
  }

  // ---- sky ----
  function sky() {
    const defs = `<linearGradient id="tkd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BG.sky}"/><stop offset="1" stop-color="${BG.skyLow}"/></linearGradient>`;
    return wrap(
      `<rect width="${W}" height="${H}" fill="url(#tkd-sky)"/>` +
      cloud(430, 96, 1.1) + cloud(900, 70, 0.9) + cloud(1020, 150, 0.7) + cloud(120, 168, 0.8) +
      `<g transform="translate(214 70) scale(1.05)">${inner(sun())}</g>`,
      defs
    );
  }

  // ---- far: mountains, sea, boat, old town (horizon at y 262) ----
  function far() {
    return wrap(
      `<g transform="translate(0 40) scale(1.5)">${inner(bgMountains())}</g>` +
      `<g transform="translate(0 ${HORIZON}) scale(1.5 1)">${inner(bgSea())}</g>` +
      `<g transform="translate(360 ${HORIZON - 34}) scale(0.85)">${inner(boat())}</g>` +
      `<g transform="translate(${760 + 4 * 0.8} ${HORIZON + 40 - 160 * 0.8}) scale(0.8)">${inner(oldTown())}</g>`
    );
  }

  // ---- hall ----
  function post(x) {
    // wooden post standing on a stone foot
    const w = 52;
    return (
      `<rect x="${x - w / 2 - 8}" y="384" width="${w + 16}" height="22" rx="5" fill="${A.stone}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<rect x="${x - w / 2}" y="20" width="${w}" height="372" rx="6" fill="${A.wood}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<rect x="${x + w / 2 - 14}" y="26" width="10" height="360" fill="${A.woodShade}" opacity="0.7"/>` +
      `<path d="M${x - w / 2 + 9} 34 L${x - w / 2 + 9} 372" stroke="${A.woodLight}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M${x - 4} 110 q4 6 0 12 M${x + 2} 250 q-4 6 0 12" fill="none" stroke="${A.woodDark}" stroke-width="2.5" stroke-linecap="round"/>`
    );
  }

  function brace(x, dir) {
    // diagonal corner brace under the beam, kept near the post
    const x0 = x + dir * 26, x1 = x + dir * 96;
    return `<path d="M${x0} 150 L${x1} 52" fill="none" stroke="${O}" stroke-width="22" stroke-linecap="round"/>` +
      `<path d="M${x0} 150 L${x1} 52" fill="none" stroke="${A.wood}" stroke-width="14" stroke-linecap="round"/>`;
  }

  function pennants() {
    // little blue/red bunting hung from the beam, high above the fighters
    let s = `<path d="M96 50 Q330 100 560 54" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M640 54 Q870 100 1104 50" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`;
    const flag = (x, y, i) => `<path d="M${x - 11} ${y - 2} L${x + 11} ${y - 2} L${x} ${y + 22} Z" fill="${i % 2 ? A.blue : A.red}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>`;
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.7) / 7.8;
      s += flag(96 + t * 464, 54 + Math.sin(t * Math.PI) * 24, i);
      s += flag(640 + t * 464, 54 + Math.sin(t * Math.PI) * 24, i + 1);
    }
    return s;
  }

  function banner() {
    const x = 600;
    // hanging cloth with a swallow-tail, taeguk-style emblem and four little bars
    const cloth = `M${x - 56} 52 L${x + 56} 52 L${x + 56} 168 L${x} 148 L${x - 56} 168 Z`;
    const em = (cx, cy, r) =>
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${A.blue}" stroke="${O}" stroke-width="3"/>` +
      `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy} A${r / 2} ${r / 2} 0 0 1 ${cx} ${cy} A${r / 2} ${r / 2} 0 0 0 ${cx - r} ${cy} Z" fill="${A.red}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${O}" stroke-width="3"/>`;
    const bar = (bx, by) => `<path d="M${bx - 9} ${by} L${bx + 9} ${by}" stroke="${O}" stroke-width="5" stroke-linecap="round"/>`;
    return (
      `<path d="M${x - 40} 46 L${x - 40} 58 M${x + 40} 46 L${x + 40} 58" stroke="${O}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="${cloth}" fill="${A.cloth}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M${x - 46} 62 L${x + 46} 62" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.6"/>` +
      em(x, 100, 24) +
      bar(x - 38, 136) + bar(x + 38, 136) + bar(x - 22, 148) + bar(x + 22, 148) +
      `<rect x="${x - 62}" y="46" width="124" height="12" rx="6" fill="${A.woodLight}" stroke="${O}" stroke-width="3.5"/>`
    );
  }

  function pot(x, bottom, w, h) {
    return `<path d="M${x - w / 2} ${bottom - h} L${x + w / 2} ${bottom - h} L${x + w / 2 - 8} ${bottom} L${x - w / 2 + 8} ${bottom} Z" fill="${A.pot}" stroke="${O}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<rect x="${x - w / 2 - 4}" y="${bottom - h - 6}" width="${w + 8}" height="12" rx="4" fill="${A.pot}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M${x + w / 2 - 12} ${bottom - h + 10} L${x + w / 2 - 16} ${bottom - 5}" stroke="${A.potShade}" stroke-width="5" stroke-linecap="round"/>`;
  }

  function palm(x, bottom) {
    const top = [x + 16, bottom - 176];
    const trunkD = `M${x} ${bottom - 40} Q${x - 4} ${bottom - 110} ${top[0]} ${top[1]}`;
    const fr = (ang, len, shade) => {
      const a = (ang * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
      const P = (u, v) => `${f1(top[0] + ca * u - sa * v)} ${f1(top[1] + sa * u + ca * v)}`;
      return `<path d="M${P(0, 0)} Q${P(len * 0.5, -len * 0.4)} ${P(len, len * 0.22)} Q${P(len * 0.5, len * 0.2)} ${P(0, 0)} Z" fill="${shade ? A.palmShade : A.palm}" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/>`;
    };
    return (
      pot(x, bottom, 64, 44) +
      `<path d="${trunkD}" fill="none" stroke="${O}" stroke-width="22" stroke-linecap="round"/>` +
      `<path d="${trunkD}" fill="none" stroke="${A.palmTrunk}" stroke-width="14" stroke-linecap="round"/>` +
      `<path d="M${x - 5} ${bottom - 80} l9 -3 M${x - 3} ${bottom - 110} l9 -3 M${x + 4} ${bottom - 140} l9 -3" stroke="${A.woodShade}" stroke-width="3" stroke-linecap="round"/>` +
      fr(-170, 78, true) + fr(-120, 80, true) + fr(-60, 80, true) + fr(-10, 78, true) +
      fr(160, 70, false) + fr(-145, 84, false) + fr(-90, 86, false) + fr(-35, 84, false) + fr(15, 70, false) +
      `<circle cx="${top[0] - 5}" cy="${top[1] + 6}" r="6" fill="${A.woodShade}" stroke="${O}" stroke-width="3"/><circle cx="${top[0] + 6}" cy="${top[1] + 7}" r="6" fill="${A.woodShade}" stroke="${O}" stroke-width="3"/>`
    );
  }

  function cactusPot(x, bottom) {
    // the 'tall' cactus from the scooter game, potted
    const s = 1.35;
    const cac = `<g transform="translate(${x - 60 * s} ${bottom - 98 * s}) scale(${s})">` +
      cactusPlant(60, 22, 26, [[[60, 62], [34, 62], [34, 42]], [[60, 50], [86, 50], [86, 30]]], true) + cactusFlower(60, 6) + `</g>`;
    return cac + pot(x, bottom, 70, 40);
  }

  function hall() {
    const top = 392; // deck top edge in front of the wall; the mat sits over its lower part
    // stone balustrade (low wall along the sea), then wooden deck
    let balus = '';
    for (let x = 6; x < W; x += 30) balus += `<rect x="${x}" y="320" width="14" height="22" rx="4" fill="${A.stoneLight}" stroke="${O}" stroke-width="3"/>`;
    const wall =
      `<rect x="-4" y="316" width="${W + 8}" height="8" rx="3" fill="${A.stone}" stroke="${O}" stroke-width="${SW}"/>` +
      balus +
      `<rect x="-4" y="340" width="${W + 8}" height="10" rx="3" fill="${A.stone}" stroke="${O}" stroke-width="${SW}"/>`;

    let planks = '';
    [362, 376, 390, 404].forEach((y) => { planks += `<path d="M0 ${y} L${W} ${y}" stroke="${A.woodShade}" stroke-width="2.5"/>`; });
    [[0, 350], [1, 362], [2, 376], [3, 390]].forEach(([r, y]) => {
      for (let x = (r * 97) % 170 - 60; x < W; x += 170) planks += `<path d="M${x} ${y} L${x} ${y + 14}" stroke="${A.woodShade}" stroke-width="2.5"/>`;
    });
    const deck =
      `<rect x="-4" y="348" width="${W + 8}" height="${H}" fill="${A.wood}" stroke="${O}" stroke-width="${SW}"/>` +
      `<rect x="0" y="352" width="${W}" height="6" fill="${A.woodLight}" opacity="0.8"/>` + planks;

    // pergola: long beam, rafters sticking out on top
    let rafters = '';
    for (let x = 30; x < W; x += 80) rafters += `<rect x="${x}" y="2" width="22" height="24" rx="6" fill="${A.woodLight}" stroke="${O}" stroke-width="${SW}"/>`;
    const roof =
      rafters +
      `<rect x="-6" y="14" width="${W + 12}" height="34" rx="8" fill="${A.wood}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M10 22 L${W - 10} 22" stroke="${A.woodLight}" stroke-width="4" stroke-linecap="round"/>` +
      `<rect x="-6" y="38" width="${W + 12}" height="8" fill="${A.woodShade}" opacity="0.6"/>`;

    return wrap(
      wall + deck +
      palm(176, 404) + cactusPot(1030, 404) +
      brace(36, 1) + brace(1164, -1) +
      post(36) + post(1164) +
      roof + pennants() + banner()
    );
  }

  // ---- floor: blue and red foam mat in slight perspective ----
  function floor() {
    const yBack = 410, yMid = 448, yFront = 490, yEdge = 508;
    const cols = 10, wf = 124, x0 = -76;
    const px = (xf, y) => {
      // vertical seams lean slightly toward the vanishing point at the centre
      const k = y <= yBack ? 0.9 : y <= yMid ? 0.9 + (y - yBack) / (yMid - yBack) * 0.05 : 0.95 + (y - yMid) / (yFront - yMid) * 0.05;
      return W / 2 + (xf - W / 2) * k;
    };
    let s = `<rect x="-4" y="${yBack}" width="${W + 8}" height="${yEdge - yBack}" fill="${A.blueShade}"/>`;
    let tiles = '', edge = '';
    for (let r = 0; r < 2; r++) {
      const ya = r ? yMid : yBack, yb = r ? yFront : yMid;
      for (let i = -1; i < cols + 2; i++) {
        const xa = x0 + i * wf, xb = xa + wf;
        const blue = (i + r) % 2 === 0;
        const d = `M${f1(px(xa, ya))} ${ya} L${f1(px(xb, ya))} ${ya} L${f1(px(xb, yb))} ${yb} L${f1(px(xa, yb))} ${yb} Z`;
        tiles += `<path d="${d}" fill="${blue ? A.blue : A.red}" stroke="${blue ? A.blueShade : A.redShade}" stroke-width="3" stroke-linejoin="round"/>`;
        // soft sheen on each tile
        tiles += `<path d="M${f1(px(xa + 14, ya + 7))} ${ya + 7} L${f1(px(xb - 14, ya + 7))} ${ya + 7}" stroke="${blue ? A.blueLight : A.redLight}" stroke-width="3" stroke-linecap="round" opacity="0.85"/>`;
      }
    }
    // front face (the foam's thickness), alternating colours
    for (let i = -1; i < cols + 2; i++) {
      const xa = x0 + i * wf, xb = xa + wf, blue = (i + 1) % 2 === 0;
      edge += `<path d="M${f1(px(xa, yFront))} ${yFront} L${f1(px(xb, yFront))} ${yFront} L${f1(px(xb, yFront) + 1)} ${yEdge} L${f1(px(xa, yFront) - 1)} ${yEdge} Z" fill="${blue ? A.blueShade : A.redShade}" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>`;
    }
    s += tiles + edge +
      `<path d="M-4 ${yBack} L${W + 4} ${yBack}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M-4 ${yFront} L${W + 4} ${yFront}" stroke="${O}" stroke-width="${SW}"/>` +
      `<path d="M-4 ${yEdge} L${W + 4} ${yEdge}" stroke="${O}" stroke-width="${SW}"/>` +
      // shadow under the mat on the deck, drawn just above it
      `<rect x="-4" y="${yBack - 7}" width="${W + 8}" height="7" fill="#8A5A2F" opacity="0.35"/>` +
      `<path d="M-4 ${yEdge + 3} L${W + 4} ${yEdge + 3}" stroke="${O}" stroke-width="${SW}"/>`;
    return wrap(s);
  }

  const layers = { sky: sky(), far: far(), hall: hall(), floor: floor() };

  function arena() {
    const body = ['sky', 'far', 'hall', 'floor'].map((k) => inner(layers[k])).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="tkd-arena">${body}</svg>`;
  }

  window.TKDArena = {
    arena, layers,
    palette: Object.assign({ outline: O }, BG, A),
    width: W, height: H, viewBox: `0 0 ${W} ${H}`,
    floorY: FLOOR_Y, minX: MIN_X, maxX: MAX_X, bounds: { minX: MIN_X, maxX: MAX_X },
  };
})();
