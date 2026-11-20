/*
 * Taekwondo Master — drawing assets: palette, posable FIGHTER RIG, looks, portraits, belts.
 * Plain script, no dependencies, works from file://.  Everything is on window.TKDAssets.
 *
 * Style = Oli's Scooter Dash (jumpnduck/assets.js): thick #2E2A36 outline (4), outlined round-capped
 * limbs, big head, dot eyes, pink cheeks — but with longer arms and legs so the kicks read well.
 *
 * ============================== HOW THE RIG WORKS ==============================
 *
 * drawFighter(look, pose, opts) -> array of PRIMITIVES, in draw order:
 *     { d: 'M.. L.. Q.. C.. Z', fill?: '#hex', stroke?: '#hex', width?: n, opacity?: n }
 *   Paint each one: fill first, then stroke (round caps + joins).  toSvg() and drawToCanvas() do it.
 *   opts: { facing: 1 (right, default) | -1 (left, mirrored), expression: 'normal'|'fierce'|'hurt'|'ko'|'happy',
 *           x: 0, y: 0, scale: 1  (where the feet point lands in the target space), ground: true }
 *
 * FIGHTER SPACE: SVG units, y DOWN.  The fighter stands at x = 0 with the lowest point of the body on y = 0
 *   (automatic grounding, see `ground` below), so he is ~300 units tall (Oli ~305, Dani ~335) and occupies
 *   y = -300..0.  The game translates/scales with opts.x / opts.y / opts.scale.
 *
 * POSE = a plain object of numbers.  Missing keys count as 0.  All angles in DEGREES.
 *   Everything is described FACING RIGHT; "forward" = toward the opponent.  Mirroring is done by opts.facing.
 *
 *   x, y      root (hip) offset, applied AFTER grounding.  x > 0 = forward, y < 0 = up (a jump: y = -60).
 *   rot       whole-body pitch around the hip.  > 0 = top tips FORWARD (clockwise when facing right).
 *             Use it for falls / KO / spins in the air.  Legs and torso both hang off it.
 *   torso     torso lean relative to rot.  > 0 = lean forward.  (stance ~ 8)
 *   head      head tilt relative to the torso.  > 0 = nod forward / chin down, < 0 = look up.
 *   fShoulder, bShoulder   upper-arm angle relative to the torso, measured from "hanging straight down":
 *             0 = hanging, 90 = pointing straight forward, 180 = straight up, < 0 = swung backward.
 *   fElbow, bElbow         elbow bend: 0 = straight arm, + = forearm folds forward/up (natural bend, ~0..150).
 *   fHip, bHip             thigh angle (relative to rot) from straight down: + = knee lifts forward
 *             (90 = thigh horizontal, chambered kick), - = leg back.
 *   fKnee, bKnee           knee bend: 0 = straight leg, + = shin folds backward (natural bend, ~0..150).
 *   fAnkle, bAnkle         foot angle: 0 = foot at 90 deg to the shin (flat on the floor when the shin is vertical),
 *             + = toes point down/away (pointed foot, instep kick), - = toes pulled up (heel / ball-of-foot kick).
 *             A flat foot needs ankle = shin direction, where shin direction = hip - knee - rot (e.g. back leg
 *             with hip -24, knee 14 -> shin -38 -> flat foot at ankle -38; a raised heel is a bit higher, ~ -18).
 *   fHand, bHand           0 = fist, 1 = open hand (knife hand / bow / block).  >= 0.5 draws open.
 *   back      0 or 1.  1 = the fighter has turned his BACK to the viewer (mid-spin): the back limbs become the
 *             near ones, the head shows the back of the hair, the jacket shows its back (no V, no knot).
 *             Angles keep their meaning (forward is still toward the facing direction).  lerpPose blends it
 *             as a number; >= 0.5 draws the back view, so an interpolated spin swaps sides at the midpoint.
 *             A full spin = stance -> back:1 keyframe(s) -> stance, with `rot`/limbs doing the rest.
 *   open      0..1 chest turn.  0 (default) = side-on profile: front shoulder leads, V-neck seen edge-on, belt knot at
 *             the front edge.  1 = chest opened toward the viewer (3/4 view: full V, knot in the middle) - e.g. for a
 *             rear straight punch or the bow/win pose.  Blends linearly.
 *   turn      body yaw in degrees (lerps the shortest way, so keep keyframes < 180 apart).  0 = side-on facing the
 *             opponent, 90 = chest to the viewer, 180 = back to the opponent (the other side, seen facing away),
 *             270 / -90 = back to the viewer, 360 = side-on again.  Limbs are projected (foreshortened), near/far
 *             limbs swap by depth, the jacket blends profile -> front / back view, the knot slides round.
 *             Real spinning kicks turn the back first: 0 -> -90 -> -180 (extension) -> -270 -> -360.
 *   headTurn  extra head yaw on top of turn (spotting: the head leads).  The head shows profile right / front face /
 *             profile left / back of the head by quadrant of turn + headTurn.
 *   fHipOut, bHipOut, fArmOut, bArmOut   swing that limb's plane outward around the vertical axis (degrees):
 *             0 = the limb moves in the forward/back plane, 90 = the same angles now point out to the side
 *             (hook kick sweeping across, knees splayed in a squat seen from the front).
 *   armSwap, legSwap  0 or 1 (>= 0.5 = on).  Swap which arm / leg is drawn near, WITHOUT the back view: e.g. a rear-leg
 *             roundhouse turns the hips so the kicking (back) leg crosses in front -> legSwap: 1; a rear straight
 *             punch -> armSwap: 1.  Combined with `back` by XOR.
 *   ground    (optional) 1/0, default 1.  1 = shift the figure so its lowest point (soles, knees, bum, head,
 *             hands) touches y = 0, then add x/y.  0 = no grounding: the hip sits at (x, y) - for poses that are
 *             positioned by hand.
 *
 *   "f" = FRONT limb (lead arm/leg, toward the opponent), "b" = BACK limb (rear).  When back = 0 the front
 *   limbs are drawn NEAR the viewer (over the body) and the back limbs FAR (behind, darker gi shade).
 *   Draw order (back = 0): far arm, far leg, neck, near leg, jacket + belt, near arm, head.
 *   (The jacket skirt is drawn over the near thigh, which is how a dobok really hangs.)
 *
 * lerpPose(a, b, t): angles take the SHORTEST way round (wrapped to +-180), x / y / back / hands are linear.
 *   So for a 360 spin of `rot`, put keyframes less than 180 deg apart.
 * rigInfo: segment lengths per build ('kid' = Oli and opponents, 'adult' = Dani) + the conventions above.
 * skeleton(look, pose, opts) -> world joint positions (hip, shoulders, elbows, wrists, fists, knees, ankles,
 *   toes, head centre) for effects / hit sparks.
 */
(function () {
  'use strict';

  // ---------- Palette ----------
  const O = '#2E2A36';
  const SW = 4;
  const C = {
    outline: O,
    cheek: '#FF9AA2',
    mouth: '#8E2F3C',
    tongue: '#FF7F8E',
    tear: '#7FD0FF',
    star: '#FFD34E',
    teeth: '#FFFFFF',
    sweat: '#9ADCFF',
  };

  const SKINS = {
    light:     { skin: '#FFDCC2', shade: '#F2B996', cheek: '#FF9AA2', nose: '#F2B996' }, // = Oli
    fair:      { skin: '#FFE4D3', shade: '#F4BFA2', cheek: '#FF92A4', nose: '#EFB394' }, // Dani
    eastAsian: { skin: '#F8D9B8', shade: '#E6B78E', cheek: '#FF9AA2', nose: '#E2AE84' },
    dark:      { skin: '#94603F', shade: '#74472B', cheek: '#C8636B', nose: '#6A3F25' },
  };

  const HAIR = {
    blonde:     { c: '#FFD34E', shade: '#E5A82A', hi: '#FFF1B8', brow: '#B07A1E' }, // = Oli
    lightBrown: { c: '#C08A4E', shade: '#9A6833', hi: '#E3B67F', brow: '#7A4E22' },
    brown:      { c: '#8A5530', shade: '#6A3D1E', hi: '#B57D52', brow: '#4E2C14' },
    darkBrown:  { c: '#55331F', shade: '#3C2213', hi: '#80563A', brow: '#2E1A0E' },
    black:      { c: '#2F2B33', shade: '#1C1A20', hi: '#5A5563', brow: '#1C1A20' },
    red:        { c: '#D9692B', shade: '#B04E1A', hi: '#F2A06A', brow: '#94401A' },
  };

  const EYES = {
    green: '#3FAE5A', // = Oli
    brown: '#8A5A2B',
    darkBrown: '#5A3519',
    blue: '#3E8EDB',
    hazel: '#9C8A3A',
  };

  // Dobok colours. far = the limbs behind the body (slightly darker), fold = crease lines.
  const GIS = {
    white: { main: '#FFFFFF', far: '#DFE3EC', shade: '#E4E8F0', fold: '#C3CAD7', lapel: '#F1F3F8' },
    pink:  { main: '#FF9CC8', far: '#E97DAE', shade: '#F583B6', fold: '#D9649A', lapel: '#FFB8D8' },
    green: { main: '#7DD27F', far: '#5DB462', shade: '#66BD6B', fold: '#46994C', lapel: '#9BE09C' },
  };

  // Belt ladder, in order (White -> Black).
  const BELTS = [
    { key: 'white',  name: 'White',  color: '#FFFFFF', shade: '#D5DAE4' },
    { key: 'yellow', name: 'Yellow', color: '#FFD34E', shade: '#E5A82A' },
    { key: 'orange', name: 'Orange', color: '#FF8A1F', shade: '#D9650A' },
    { key: 'green',  name: 'Green',  color: '#2F9E48', shade: '#217A37' },
    { key: 'purple', name: 'Purple', color: '#8E5BD6', shade: '#6C3FB0' },
    { key: 'blue',   name: 'Blue',   color: '#3D6FD8', shade: '#2B52A8' },
    { key: 'red',    name: 'Red',    color: '#E5383B', shade: '#B32528' },
    { key: 'black',  name: 'Black',  color: '#2A2A32', shade: '#111116', stripe: '#F2C84B' },
  ];
  const BELT = {};
  BELTS.forEach((b) => (BELT[b.key] = b));

  Object.assign(C, { skins: SKINS, hair: HAIR, eyes: EYES, gis: GIS });

  // ---------- Builds (segment lengths, fighter units) ----------
  const BUILDS = {
    kid:   { thigh: 64, shin: 60, upper: 48, fore: 46, torsoH: 80, torsoW: 1, neck: 13, headScale: 1, sleeve: 25, trouser: 31 },
    adult: { thigh: 76, shin: 72, upper: 55, fore: 52, torsoH: 92, torsoW: 1.04, neck: 16, headScale: 0.92, sleeve: 25, trouser: 31 },
  };
  const ANKLE_H = 10; // ankle above the sole

  const POSE_KEYS = ['x', 'y', 'rot', 'torso', 'head', 'fShoulder', 'fElbow', 'bShoulder', 'bElbow',
    'fHip', 'fKnee', 'fAnkle', 'bHip', 'bKnee', 'bAnkle', 'fHand', 'bHand', 'open', 'back', 'armSwap', 'legSwap', 'ground',
    'turn', 'headTurn', 'fHipOut', 'bHipOut', 'fArmOut', 'bArmOut'];
  const LINEAR_KEYS = { x: 1, y: 1, back: 1, fHand: 1, bHand: 1, ground: 1, armSwap: 1, legSwap: 1, open: 1 };

  // ---------- Math / matrices ----------
  // Matrix [a, b, c, d, e, f]: (x, y) -> (a x + c y + e, b x + d y + f)
  const RAD = Math.PI / 180;
  const I = [1, 0, 0, 1, 0, 0];
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  const translate = (x, y) => [1, 0, 0, 1, x, y];
  const scaleM = (sx, sy) => [sx, 0, 0, sy == null ? sx : sy, 0, 0];
  // Clockwise (on screen, y down) rotation by `deg`.
  const rotM = (deg) => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [c, s, -s, c, 0, 0]; };
  // Frame at origin o with x-axis along unit u and y-axis = u turned 90 deg clockwise.
  const frame = (o, u, k = 1) => [u[0] * k, u[1] * k, -u[1] * k, u[0] * k, o[0], o[1]];
  // Direction for a limb angle: 0 = down, 90 = forward (+x), 180 = up.
  const dir = (a) => [Math.sin(a * RAD), Math.cos(a * RAD)];
  const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];

  // ---------- Path helpers (paths are authored in local coordinates, then transformed) ----------
  const parseCache = new Map();
  function parse(d) {
    let t = parseCache.get(d);
    if (!t) {
      t = d.match(/[MLQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi).map((s) => (/[a-z]/i.test(s) && !/e/i.test(s) ? s : +s));
      if (parseCache.size > 5000) parseCache.clear();
      parseCache.set(d, t);
    }
    return t;
  }
  const f1 = (n) => (Math.round(n * 10) / 10).toString();
  // Transform a path made of absolute M / L / Q / C / Z commands.
  function tx(d, m) {
    const t = parse(d);
    let out = '';
    for (let i = 0; i < t.length; i++) {
      const v = t[i];
      if (typeof v === 'string') { out += v; continue; }
      const x = v, y = t[++i];
      out += f1(m[0] * x + m[2] * y + m[4]) + ' ' + f1(m[1] * x + m[3] * y + m[5]) + ' ';
    }
    return out.trim();
  }
  // Ellipse as 4 cubic curves (so it survives any affine transform / mirroring).
  function ell(cx, cy, rx, ry, rotDeg) {
    const k = 0.5523;
    const pts = [
      [rx, 0], [rx, k * ry], [k * rx, ry], [0, ry], [-k * rx, ry], [-rx, k * ry], [-rx, 0],
      [-rx, -k * ry], [-k * rx, -ry], [0, -ry], [k * rx, -ry], [rx, -k * ry], [rx, 0],
    ];
    const c = Math.cos((rotDeg || 0) * RAD), s = Math.sin((rotDeg || 0) * RAD);
    const P = pts.map(([x, y]) => f1(cx + x * c - y * s) + ' ' + f1(cy + x * s + y * c));
    return `M${P[0]} C${P[1]} ${P[2]} ${P[3]} C${P[4]} ${P[5]} ${P[6]} C${P[7]} ${P[8]} ${P[9]} C${P[10]} ${P[11]} ${P[12]} Z`;
  }
  const circ = (cx, cy, r) => ell(cx, cy, r, r);
  const poly = (pts, close) => 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join(' L') + (close ? ' Z' : '');

  // ---------- Primitive emitter ----------
  // A Painter collects primitives; `m` is the current matrix applied to every local path.
  function Painter() {
    const out = [];
    let m = I;
    const P = {
      out,
      get m() { return m; },
      set m(v) { m = v; },
      // filled shape with outline
      shape(d, fill, w = SW, stroke = O, opacity) {
        const p = { d: tx(d, m), fill };
        if (w) { p.stroke = stroke; p.width = w; }
        if (opacity != null && opacity < 1) p.opacity = opacity;
        out.push(p);
      },
      fill(d, fill, opacity) { const p = { d: tx(d, m), fill }; if (opacity != null && opacity < 1) p.opacity = opacity; out.push(p); },
      line(d, color, w, opacity) {
        const p = { d: tx(d, m), stroke: color, width: w };
        if (opacity != null && opacity < 1) p.opacity = opacity;
        out.push(p);
      },
      // outlined stroke (jumpnduck `limb`)
      limb(d, color, w) { P.line(d, O, w + SW * 2); P.line(d, color, w); },
      // One silhouette: outlines of every item first, then the fills.
      // items: { d, m?, stroke: colour, w } (stroke) or { d, m?, fill: colour } (shape)
      group(items) {
        const save = m;
        items.forEach((it) => {
          m = it.m || save;
          if (it.fill) out.push({ d: tx(it.d, m), fill: O, stroke: O, width: SW * 2 });
          else out.push({ d: tx(it.d, m), stroke: O, width: it.w + SW * 2 });
        });
        items.forEach((it) => {
          m = it.m || save;
          if (it.fill) out.push({ d: tx(it.d, m), fill: it.fill });
          else out.push({ d: tx(it.d, m), stroke: it.stroke, width: it.w });
        });
        m = save;
      },
    };
    return P;
  }

  // ---------- Looks ----------
  function resolveLook(look) {
    look = look || LOOKS.oli;
    const skin = typeof look.skin === 'object' ? look.skin : SKINS[look.skin] || SKINS.light;
    const hair = typeof look.hairColor === 'object' ? look.hairColor : HAIR[look.hairColor] || HAIR.brown;
    const gi = typeof look.gi === 'object' ? look.gi : GIS[look.gi] || GIS.white;
    const belt = typeof look.belt === 'object' ? look.belt : BELT[look.belt] || BELT.white;
    const eye = EYES[look.eyeColor] || look.eyeColor || EYES.brown;
    const build = BUILDS[look.build] || BUILDS.kid;
    return {
      look, skin, hair, gi, belt, eye, build,
      style: look.hairStyle || 'short',
      female: look.gender === 'female',
      almond: look.eyeShape ? look.eyeShape === 'almond' : look.skin === 'eastAsian',
      adult: look.build === 'adult',
    };
  }

  // ---------- Eyes ----------
  // Profile/3-quarter eye (jumpnduck `eye`), or an almond eye.  lash = draw eyelashes (female cue).
  function eyeAt(P, cx, cy, L, front) {
    const off = front ? 0 : 1.5;
    if (L.almond) {
      P.shape(ell(cx, cy + 1, 7.8, 6.2), '#FFFFFF', 3);
      P.fill(circ(cx + off * 0.8, cy + 1.6, 4.9), L.eye);
      P.fill(circ(cx + off, cy + 1.8, 2.5), O);
      P.fill(circ(cx - 1 + off * 0.3, cy - 0.2, 1.6), '#FFFFFF');
      P.line(`M${cx - 8.5} ${cy + 0.5} Q${cx - 1} ${cy - 7.5} ${cx + 8.5} ${cy - 1.5}`, O, 3.6);
    } else {
      P.shape(ell(cx, cy, front ? 8 : 7.5, front ? 10 : 9.5), '#FFFFFF', 3);
      P.fill(circ(cx + off, cy + 1, front ? 6 : 5.5), L.eye);
      P.fill(circ(cx + off * 1.2, cy + 1.3, front ? 3 : 2.8), O);
      P.fill(circ(cx - (front ? 2 : 0.5), cy - 2, front ? 2 : 1.9), '#FFFFFF');
    }
  }
  function lashes(P, cx, cy, side, L) {
    // side: +1 = lashes on the right of the eye, -1 = left
    const top = L.almond ? cy - 4 : cy - 7;
    const s = side;
    P.line(`M${cx + 5 * s} ${top} L${cx + 9.5 * s} ${top - 4}`, O, 2.6);
    P.line(`M${cx + 7.5 * s} ${top + 3.5} L${cx + 12 * s} ${top + 1.5}`, O, 2.6);
  }
  const xEye = (P, cx, cy) => P.line(`M${cx - 6} ${cy - 6} L${cx + 6} ${cy + 6} M${cx + 6} ${cy - 6} L${cx - 6} ${cy + 6}`, O, 4);

  function star(P, cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rr = i % 2 ? r * 0.48 : r;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    P.shape(poly(pts, true), C.star, 2.5);
  }

  // ---------- Hair (profile, head centre 0,0, radius 44, face toward +x) ----------
  const HAIR_PROFILE = {
    oli: {
      cap: 'M-42 12 C-54 -24 -32 -51 2 -49 C33 -49 53 -30 46 -4 C38 -16 28 -18 20 -13 C15 -22 5 -24 -2 -15 C-9 -22 -19 -19 -25 -9 C-29 -3 -32 4 -34 12 Z',
      tuft: 'M-6 -46 C-12 -60 1 -68 12 -61 C5 -57 4 -53 9 -47',
      shine: 'M-26 -30 Q-14 -40 0 -40',
      shade: 'M22 -38 Q34 -32 39 -22',
    },
    short: {
      cap: 'M-43 14 C-54 -22 -31 -50 3 -49 C32 -48 51 -31 46 -7 C41 -13 34 -15 27 -12 C23 -19 14 -21 7 -16 C0 -19 -11 -15 -18 -9 C-25 -5 -29 3 -31 14 Z',
      shine: 'M-26 -31 Q-14 -41 1 -41',
      shade: 'M24 -38 Q35 -31 40 -21',
    },
    ponytail: {
      behind: 'M-34 -30 C-58 -36 -76 -12 -70 16 C-67 32 -60 46 -66 62 C-50 56 -42 40 -44 22 C-46 8 -42 -6 -30 -14 Z',
      tail: 'M-50 -12 Q-60 10 -58 34',
      cap: 'M-44 12 C-51 -26 -27 -50 5 -49 C32 -47 49 -30 46 -9 C38 -19 25 -23 12 -21 C0 -19 -12 -13 -21 -5 C-27 1 -30 8 -32 15 Z',
      tie: [-39, -19],
      shine: 'M-28 -31 Q-12 -43 6 -41',
      shade: 'M22 -40 Q34 -34 40 -24',
    },
    long: {
      behind: 'M-22 -46 C-52 -42 -64 -6 -60 30 C-58 50 -56 64 -44 69 C-32 73 -22 66 -20 56 L-24 22 Z',
      tail: 'M-46 0 Q-52 30 -46 58',
      cap: 'M-44 12 C-51 -26 -27 -50 5 -49 C34 -47 50 -29 46 -7 C40 -16 30 -20 20 -17 C10 -25 -3 -21 -11 -15 C-19 -10 -24 -2 -27 6 L-29 30 C-33 37 -40 37 -43 30 Z',
      shine: 'M-28 -31 Q-12 -43 6 -41',
      shade: 'M24 -38 Q35 -31 40 -21',
    },
  };

  // Back of the head (spinning): the hair covers nearly the whole head.
  const HAIR_BACK = {
    base: 'M-46 6 C-51 -30 -26 -51 0 -50 C26 -51 51 -30 46 6 C40 12 34 12 30 16 C24 14 18 20 12 18 C6 22 -6 22 -12 18 C-18 20 -24 14 -30 16 C-34 12 -40 12 -46 6 Z',
    oliTuft: 'M-6 -47 C-12 -61 1 -69 12 -62 C5 -58 4 -54 9 -48',
    ponytail: 'M-9 -20 C-16 2 -14 32 -5 58 C1 64 8 59 10 52 C15 30 13 2 8 -20 Z',
    long: 'M-47 2 C-52 30 -50 58 -38 66 C-14 75 14 75 38 66 C50 58 52 30 47 2 C30 14 -30 14 -47 2 Z',
  };

  // ---------- Profile head ----------
  // Local coords: head centre (0, 0), radius 44, face toward +x.  Draws behind-hair, head, hair, face.
  function drawHeadProfile(P, L, expr) {
    const s = L.skin, h = HAIR_PROFILE[L.style] || HAIR_PROFILE.short;
    const hc = L.hair;
    // hair behind the head (ponytail / long)
    if (h.behind) {
      P.shape(h.behind, hc.c, SW);
      if (h.tail) P.line(h.tail, hc.shade, 3.5);
    }
    P.shape(circ(0, 0, 44), s.skin, SW);
    P.shape(h.cap, hc.c, SW);
    if (h.tuft) P.shape(h.tuft, hc.c, SW);
    P.line(h.shine, hc.hi, 4);
    P.line(h.shade, hc.shade, 3.5);
    if (h.tie) P.shape(ell(h.tie[0], h.tie[1], 5.5, 8, -20), L.female ? '#FF5C8A' : '#4A7BD0', 3);
    // ear
    P.shape(circ(-36, 8, 10), s.skin, SW);
    P.line('M-38 3 Q-32 8 -37 13', s.shade, 2.5);
    if (L.female && L.style !== 'long') P.shape(circ(-36, 19, 2.6), '#FFD34E', 2); // small earring
    drawFaceProfile(P, L, expr);
  }

  function drawFaceProfile(P, L, expr) {
    const s = L.skin, brow = L.hair.brow;
    const ey = L.almond ? 5 : 4;
    // eyebrows
    const brows = {
      normal: ['M1 -9 Q7 -13 14 -10', 'M24 -11 Q30 -14 36 -11'],
      happy: ['M1 -11 Q7 -16 14 -12', 'M24 -13 Q30 -17 36 -13'],
      fierce: ['M0 -12 Q7 -10 15 -5', 'M23 -6 Q30 -11 37 -14'],
      hurt: ['M1 -8 Q7 -12 14 -15', 'M24 -15 Q30 -12 36 -8'],
      ko: ['M1 -12 Q7 -12 14 -17', 'M24 -18 Q30 -13 36 -12'],
    }[expr] || null;
    const b = brows || ['M1 -9 Q7 -13 14 -10', 'M24 -11 Q30 -14 36 -11'];
    P.line(b[0], brow, expr === 'fierce' ? 4.5 : 3.5);
    P.line(b[1], brow, expr === 'fierce' ? 4.5 : 3.5);
    // eyes
    if (expr === 'ko') { xEye(P, 8, 4); xEye(P, 30, 2); }
    else if (expr === 'happy') {
      P.line('M1 7 Q8 -2 15 7', O, 3.6); P.line('M24 5 Q30 -3 36 5', O, 3.6);
    } else if (expr === 'hurt') {
      P.line('M2 -1 L13 4 L3 9', O, 3.6); P.line('M36 -3 L26 2 L35 7', O, 3.6);
    } else {
      eyeAt(P, 8, ey, L); eyeAt(P, 30, ey - 2, L);
      if (L.female) { lashes(P, 8, ey, -1, L); lashes(P, 30, ey - 2, 1, L); }
      if (expr === 'fierce') { // lower the upper lids a little: determined look
        P.line(`M0 ${ey - 6} L15 ${ey - 3}`, s.skin, 4); P.line(`M0 ${ey - 5} L16 ${ey - 2}`, O, 2.5);
        P.line(`M23 ${ey - 9} L38 ${ey - 5}`, s.skin, 4); P.line(`M22 ${ey - 8} L38 ${ey - 4}`, O, 2.5);
      }
    }
    // cheeks + nose
    P.fill(ell(0, 20, 7, 4.5), s.cheek, L.female ? 0.7 : 0.55);
    P.fill(ell(33, 18, 4.5, 4), s.cheek, L.female ? 0.7 : 0.55);
    P.line('M38 10 Q43 14 37 18', s.nose, 3);
    // mouth
    if (expr === 'ko') {
      P.shape('M12 32 Q16 24 22 27 Q28 30 34 25 Q30 35 22 34 Q16 33 12 32 Z', C.mouth, 3);
      P.shape('M6 13 Q0 22 0 26 C0 31 12 31 12 26 Q12 22 6 13 Z', C.tear, 2.5);
      // dizzy stars
      star(P, -40, -62, 9); star(P, -2, -78, 7); star(P, 40, -64, 8);
    } else if (expr === 'hurt') {
      P.shape(ell(24, 29, 5.5, 6.5), C.mouth, 3);
      P.shape('M-22 -26 Q-27 -18 -27 -15 C-27 -10 -19 -10 -19 -15 Q-19 -18 -22 -26 Z', C.sweat, 2.5);
    } else if (expr === 'fierce') {
      P.shape('M11 25 Q24 21 37 22 Q35 37 24 37 Q14 37 11 25 Z', C.mouth, 3);
      P.fill('M13 26 Q24 23 35 23.5 L34.5 27 Q24 26.5 14 29 Z', C.teeth);
    } else if (expr === 'happy') {
      P.shape('M9 23 Q22 46 38 21 Q23 28 9 23 Z', C.mouth, 3);
      P.fill(ell(23, 34, 6, 3), C.tongue);
    } else {
      P.shape(L.female ? 'M11 25 Q22 39 35 23 Q22 29 11 25 Z' : 'M10 24 Q22 42 37 22 Q23 29 10 24 Z', C.mouth, 3);
      P.fill(ell(23, L.female ? 30 : 32, 5, 2.4), C.tongue);
    }
  }

  // Back view of the head (spinning).  Same local frame (face would be toward +x).
  function drawHeadBack(P, L) {
    const s = L.skin, hc = L.hair, st = L.style;
    P.shape(circ(-42, 8, 9), s.skin, SW);
    P.shape(circ(42, 8, 9), s.skin, SW);
    P.shape(circ(0, 0, 44), s.skin, SW);
    P.shape(HAIR_BACK.base, hc.c, SW);
    P.line('M-30 -30 Q-14 -42 4 -42', hc.hi, 4);
    P.line('M-24 2 Q-12 8 0 8', hc.shade, 3.5);
    if (st === 'oli') P.shape(HAIR_BACK.oliTuft, hc.c, SW);
    if (st === 'long') { P.shape(HAIR_BACK.long, hc.c, SW); P.line('M-20 24 Q-18 46 -22 62 M14 26 Q18 46 16 62', hc.shade, 3.5); }
    if (st === 'ponytail') {
      P.shape(HAIR_BACK.ponytail, hc.c, SW);
      P.line('M0 -8 Q2 22 0 48', hc.shade, 3);
      P.shape(ell(0, -20, 9, 5.5), L.female ? '#FF5C8A' : '#4A7BD0', 3);
    }
  }

  // ---------- Body parts ----------
  // Bare foot in the foot frame: ankle at (0,0), x along the foot (toes +x), sole on y = +10.
  const FOOT = 'M-11 3 C-13 -6 -5 -10 3 -9 L20 -6 C29 -5 35 -1 36 4 C37 8 35 10 31 10 L-5 10 C-10 10 -11 8 -11 3 Z';
  const FOOT_SOLE = [[-10, 10], [31, 10], [36, 4]];
  // Fist in the forearm frame: wrist at (0,0), x along the forearm.
  const FIST = ell(9, 0, 11.5, 10.5);
  // Open hand (knife hand), fingers together.
  const HAND = 'M-2 -6 C4 -9 18 -8 25 -5 C29 -3 29 3 25 4 C18 6 6 8 -2 6 Z';
  // Dobok jacket, torso frame: hip at (0,0), x forward, y down (shoulder top y = -80).
  const JACKET = 'M-31 25 L35 25 C38 4 37 -32 32 -58 C28 -74 16 -82 1 -82 C-14 -82 -26 -75 -30 -61 C-35 -38 -35 0 -31 25 Z';

  // ---------- Forward kinematics ----------
  // Shape scale along a limb: like the true foreshortening k, but never thinner than 0.45 so feet/fists stay readable.
  const shapeK = (k) => (k < 0 ? -1 : 1) * Math.max(Math.abs(k), 0.45);
  // Frame for a shape drawn along a limb whose screen x is foreshortened by k (k = 1: plain frame()).
  const kFrame = (o, u, k) => { const e = shapeK(k); return [u[0] * e, u[1], -u[1] * e, u[0], o[0], o[1]]; };
  const addK = (p, v, len, k) => [p[0] + v[0] * len * k, p[1] + v[1] * len];
  const lerpM = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  // Forward kinematics.  Limbs are solved in the body's forward/back plane, then the body TURN (yaw around the
  // vertical axis) projects them onto the screen: screen x = x cos(turn) - z sin(turn), where z is the sideways
  // offset (front limbs z > 0 = toward the viewer at turn 0).  A limb's own plane can also swing outward
  // (`*HipOut`, `*ArmOut`), so its forward reach maps to screen x by k = cos(out) cos(turn) - side sin(out) sin(turn).
  function solve(L, pose) {
    const B = L.build;
    const g = (k) => (pose && typeof pose[k] === 'number' ? pose[k] : 0);
    const rot = g('rot');
    const T = rot + g('torso');
    const open = Math.max(0, Math.min(1, g('open')));
    const tM = mul(rotM(T), scaleM(B.torsoW * (0.93 + 0.07 * open), B.torsoH / 80));
    const pelvis = rotM(rot);
    const turn = g('turn');
    let c = Math.cos(turn * RAD), s = Math.sin(turn * RAD);
    if (Math.abs(s) < 1e-9) { s = 0; c = c > 0 ? 1 : -1; }
    if (Math.abs(c) < 1e-9) c = 0;
    const turned = !(c === 1 && s === 0);
    const proj = (p, z) => (turned ? [p[0] * c - z * s, p[1]] : p);
    const J = { T, rot, tM, open, c, s, turned };

    // legs
    ['f', 'b'].forEach((side) => {
      const sg = side === 'f' ? 1 : -1;
      const out = g(side + 'HipOut') * RAD;
      const k = Math.cos(out) * c - sg * Math.sin(out) * s;
      const hipS = apply(pelvis, side === 'f' ? [5, 0] : [-5, 0]);
      const hip = proj(hipS, sg * 11);
      const thighA = g(side + 'Hip') - rot;
      const knee = addK(hip, dir(thighA), B.thigh, k);
      const shinA = thighA - g(side + 'Knee');
      const ankle = addK(knee, dir(shinA), B.shin, k);
      const footA = shinA + 90 - g(side + 'Ankle');
      const footM = kFrame(ankle, dir(footA), k);
      const tipX = (ankle[0] - hip[0]) / (Math.abs(k) > 1e-6 ? k : 1); // forward reach in the limb plane
      const depth = sg * 11 * c + hipS[0] * s + 0.5 * tipX * (Math.cos(out) * s + sg * Math.sin(out) * c);
      J[side + 'Leg'] = { hip, knee, ankle, thighA, shinA, footA, footM, k, depth, toe: apply(footM, [34, 4]) };
    });

    // arms
    ['f', 'b'].forEach((side) => {
      const sg = side === 'f' ? 1 : -1;
      const out = g(side + 'ArmOut') * RAD;
      const k = Math.cos(out) * c - sg * Math.sin(out) * s;
      const shS = apply(tM, side === 'f' ? [5 + 5 * (1 - open), -68] : [-5 - 3 * (1 - open), -70]); // side-on: front shoulder leads
      const sh = proj(shS, sg * 23);
      const upA = g(side + 'Shoulder') - T;
      const elbow = addK(sh, dir(upA), B.upper, k);
      const foreA = upA + g(side + 'Elbow');
      const wrist = addK(elbow, dir(foreA), B.fore, k);
      const handM = kFrame(wrist, dir(foreA), k);
      const tipX = (wrist[0] - sh[0]) / (Math.abs(k) > 1e-6 ? k : 1);
      const depth = sg * 23 * c + shS[0] * s + 0.5 * tipX * (Math.cos(out) * s + sg * Math.sin(out) * c);
      J[side + 'Arm'] = {
        shoulder: sh, elbow, wrist, upA, foreA, handM, k, depth,
        fist: apply(handM, [9, 0]), open: g(side + 'Hand') >= 0.5,
      };
    });

    // neck + head
    const neckS = apply(tM, [1, -79]);
    const H = T + g('head');
    const hs = B.headScale;
    const up = [Math.sin(H * RAD), -Math.cos(H * RAD)];
    const headS = add(neckS, up, B.neck + 34 * hs);
    const neckBase = proj(neckS, 0), headC = proj(headS, 0);
    J.neckBase = neckBase;
    J.headC = headC;
    J.headR = 44 * hs;
    J.back = g('back') >= 0.5;
    // which way the head is seen: profile right / front face / profile left (mirrored) / back of the head
    const phi = (turn + g('headTurn')) * RAD, ch = Math.cos(phi), sh = Math.sin(phi);
    J.headView = J.back ? 'back' : Math.abs(ch) >= Math.abs(sh) - 1e-9 ? (ch >= 0 ? 'right' : 'left') : sh > 0 ? 'front' : 'back';
    const Hs = turned || g('headTurn') ? Math.atan2(Math.sin(H * RAD) * ch, Math.cos(H * RAD)) / RAD : H;
    J.headM = mul(mul(mul(translate(headC[0], headC[1]), rotM(Hs)), scaleM(hs)), J.headView === 'left' ? scaleM(-1, 1) : I);
    // torso as drawn: lean foreshortened by the turn
    J.tMd = turned
      ? mul(rotM(Math.atan2(Math.sin(T * RAD) * c, Math.cos(T * RAD)) / RAD), scaleM(B.torsoW * (0.93 + 0.07 * open), B.torsoH / 80))
      : tM;
    J.backView = J.back || s < 0; // jacket: back details (s < 0 = back toward the viewer)
    return J;
  }

  // Lowest point of the figure (largest y) — used to stand it on the floor.
  function lowestY(J) {
    let y = -Infinity;
    const take = (p, r = 0) => { if (p[1] + r > y) y = p[1] + r; };
    ['fLeg', 'bLeg'].forEach((k) => {
      const l = J[k];
      FOOT_SOLE.forEach((p) => take(apply(l.footM, p)));
      take(l.knee, 16);
    });
    ['fArm', 'bArm'].forEach((k) => { take(J[k].fist, 10); take(J[k].elbow, 12); });
    take(apply(J.tM, [0, 25])); take(apply(J.tM, [-31, 21])); take(apply(J.tM, [35, 21]));
    take(J.headC, J.headR);
    return y;
  }

  function placement(J, pose, opts) {
    opts = opts || {};
    const facing = opts.facing === -1 ? -1 : 1;
    const s = opts.scale || 1;
    const groundOn = !(pose && pose.ground === 0) && opts.ground !== false;
    const gy = groundOn ? -lowestY(J) : 0;
    const px = (pose && pose.x) || 0, py = (pose && pose.y) || 0;
    return mul(mul(translate(opts.x || 0, opts.y || 0), scaleM(s * facing, s)), translate(px, gy + py));
  }

  // ---------- Drawing the parts ----------
  function drawLeg(P, L, leg, far, G) {
    const gi = far ? L.gi.far : L.gi.main;
    const skin = far ? L.skin.shade : L.skin.skin;
    const B = L.build;
    const sd = dir(leg.shinA), k = leg.k;
    const sdk = [sd[0] * k, sd[1]];
    const hem = add(leg.ankle, sdk, -9);
    const hemM = mul(G, kFrame(hem, sd, k));
    const footM = mul(G, leg.footM);
    P.m = G;
    P.group([
      { d: poly([hem, leg.ankle]), stroke: skin, w: 13 },
      { d: FOOT, fill: skin, m: footM },
      { d: poly([leg.hip, leg.knee, add(hem, sdk, -9)]), stroke: gi, w: B.trouser },
      { d: 'M-8 -16 L3 -18.5 Q7 -18.5 7 -14 L7 14 Q7 18.5 3 18.5 L-8 16 Z', fill: gi, m: hemM },
    ]);
    // toes + knee crease
    P.m = footM;
    P.line('M26 -2.5 Q30 1 28 5.5', L.skin.shade, 2.5);
    P.line('M19 -4 Q22 0 20 4', L.skin.shade, 2.2, 0.8);
    P.m = mul(G, kFrame(leg.knee, sd, k));
    P.line('M-6 -6 Q2 -1 -4 6', L.gi.fold, 3, 0.9);
    P.m = mul(G, kFrame(add(leg.knee, sdk, B.shin * 0.45), sd, k));
    P.line('M-4 -9 Q0 -4 -3 2', L.gi.fold, 2.5, 0.7);
  }

  function drawArm(P, L, arm, far, G) {
    const gi = far ? L.gi.far : L.gi.main;
    const skin = far ? L.skin.shade : L.skin.skin;
    const B = L.build;
    const fd = dir(arm.foreA), k = arm.k;
    const fdk = [fd[0] * k, fd[1]];
    const cuff = add(arm.elbow, fdk, B.fore * 0.7);
    const cuffM = mul(G, kFrame(cuff, fd, k));
    const handM = mul(G, arm.handM);
    P.m = G;
    P.group([
      { d: poly([cuff, arm.wrist]), stroke: skin, w: 12 },
      { d: arm.open ? HAND : FIST, fill: skin, m: handM },
      { d: poly([arm.shoulder, arm.elbow, add(cuff, fdk, -7)]), stroke: gi, w: B.sleeve },
      { d: 'M-7 -14 L3 -15.5 Q6 -15.5 6 -12 L6 12 Q6 15.5 3 15.5 L-7 14 Z', fill: gi, m: cuffM },
    ]);
    // fist details: knuckle crease + thumb
    P.m = handM;
    if (arm.open) P.line('M6 -1 L22 -0.5', L.skin.shade, 2.2, 0.9);
    else {
      P.line('M12 -7 Q16 -1 13 6', L.skin.shade, 2.5);
      P.line('M2 -6 Q8 -8 12 -4', L.skin.shade, 2.3, 0.9);
    }
    // elbow crease
    P.m = mul(G, kFrame(arm.elbow, fd, k));
    P.line('M-3 -8 Q3 -3 -2 4', L.gi.fold, 2.6, 0.9);
  }

  // Blend two paths with the same commands (number by number).
  function mix(a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const ta = parse(a), tb = parse(b);
    return ta.map((v, i) => (typeof v === 'string' ? v : f1(v + (tb[i] - v) * t))).join(' ');
  }
  // Front-view versions of the jacket shapes (same commands as the profile ones, so they can be blended).
  const JACKET_F = 'M-34 25 L34 25 C37 4 36 -32 33 -58 C29 -74 16 -82 0 -82 C-16 -82 -29 -74 -33 -58 C-36 -32 -37 4 -34 25 Z';
  const BELT_P = 'M-34 -9 L37 -9 Q39 -9 39 -6 L39 2 Q39 5 36 5 L-34 5 Q-37 5 -37 2 L-37 -6 Q-37 -9 -34 -9 Z';
  const BELT_F = 'M-35 -9 L35 -9 Q38 -9 38 -6 L38 2 Q38 5 35 5 L-35 5 Q-38 5 -38 2 L-38 -6 Q-38 -9 -35 -9 Z';

  function drawTorso(P, L, J, G, back) {
    const gi = L.gi, belt = L.belt, o = J.open; // o: 0 = side-on profile, 1 = chest opened to the viewer
    // With a body turn: profile shapes (mirrored when facing away, cos < 0) blend into the front/back view by |sin|.
    const w = J.turned ? Math.abs(J.s) : 0, sg = J.c >= 0 ? 1 : -1;
    const side = (pd, fd) => (J.turned ? mix(tx(pd, scaleM(sg, 1)), fd, w) : pd);
    P.m = mul(G, J.tMd);
    P.shape(side(JACKET, JACKET_F), gi.main, SW);
    // soft fold shading (keeps the white gi readable on a light background)
    P.line(back ? side('M-14 -64 Q-17 -30 -13 10', 'M-20 -62 Q-24 -30 -20 10') : side('M-18 -62 Q-22 -30 -18 8', 'M-24 -60 Q-27 -30 -24 8'), gi.shade, 7, 0.9);
    P.line(side('M-22 14 Q-6 18 10 14', 'M-16 14 Q0 18 16 14'), gi.fold, 2.5, 0.7);
    if (!back) {
      // V-neck: skin, then the crossed lapels, then the wrap line down to the belt
      // (profile: the V is seen edge-on, along the front edge of the jacket)
      P.shape(side(mix('M20 -81 L28 -78 L31 -56 Z', 'M3 -81 L22 -80 L25 -46 Z', o), 'M-10 -81 L10 -81 L0 -50 Z'), L.skin.skin, 0);
      P.limb(side(mix('M-6 -81 Q16 -77 31 -52', 'M-12 -81 Q10 -76 25 -44', o), 'M-17 -81 Q-8 -66 4 -46'), gi.lapel, 7);
      P.limb(side(mix('M25 -80 Q31 -68 31 -52', 'M20 -81 Q25 -64 25 -44', o), 'M16 -81 Q8 -66 -4 -46'), gi.lapel, 6);
      P.line(side(mix('M32 -48 Q33 -24 31 -4', 'M26 -40 Q26 -22 22 -4', o), 'M4 -42 Q5 -22 3 -4'), O, 3);
      P.line(side(mix('M18 -40 Q15 -20 17 -6', 'M14 -40 Q10 -20 12 -6', o), 'M-14 -40 Q-17 -20 -15 -6'), gi.fold, 2.5, 0.8);
    } else {
      P.limb(side('M-16 -79 Q0 -84 16 -79', 'M-16 -79 Q0 -84 16 -79'), gi.lapel, 7);
      P.line(side('M0 -72 L0 -8', 'M0 -72 L0 -8'), gi.fold, 2.5, 0.7);
    }
    // belt band
    P.shape(side(BELT_P, BELT_F), belt.color, SW);
    P.line(side('M-32 -2 L35 -2', 'M-34 -2 L34 -2'), belt.shade, 2, 0.6);
    if (belt.stripe) P.line(side('M-18 -2 L-4 -2', 'M-26 -2 L-12 -2'), belt.stripe, 2.5);
    if (!back) {
      // two tails + knot: slides to the front edge when side-on, to the middle in the front view
      const km = P.m;
      const kx = J.turned ? (sg * (16 + 12 * (1 - o))) * (1 - w) - 16 : 12 * (1 - o); // knot centre slides, never squashed
      P.m = mul(km, translate(kx, 0));
      P.limb('M12 1 Q9 15 6 30', belt.color, 8);
      P.limb('M19 1 Q22 14 27 27', belt.color, 8);
      if (belt.stripe) P.line('M8 20 L6.5 27', belt.stripe, 2.5);
      P.shape('M9 -11 L23 -11 Q26 -11 26 -8 L26 4 Q26 7 23 7 L9 7 Q6 7 6 4 L6 -8 Q6 -11 9 -11 Z', belt.color, SW);
      P.line('M10 -2 L22 -2', belt.shade, 2, 0.6);
      P.m = km;
    }
  }

  // ---------- drawFighter ----------
  function drawFighter(look, pose, opts) {
    opts = opts || {};
    const L = resolveLook(look);
    const J = solve(L, pose || POSES.stance);
    const G = placement(J, pose, opts);
    const P = Painter();
    const back = J.back;
    const g = (k) => (pose && typeof pose[k] === 'number' ? pose[k] : 0);
    // near/far from the depth of each limb (front limbs near at turn 0), then the back / swap overrides (XOR)
    const armB = (J.bArm.depth > J.fArm.depth) !== (back !== g('armSwap') >= 0.5);
    const legB = (J.bLeg.depth > J.fLeg.depth) !== (back !== g('legSwap') >= 0.5);
    const nearArm = armB ? J.bArm : J.fArm, farArm = armB ? J.fArm : J.bArm;
    const nearLeg = legB ? J.bLeg : J.fLeg, farLeg = legB ? J.fLeg : J.bLeg;
    const expr = opts.expression || 'normal';

    drawArm(P, L, farArm, true, G);
    drawLeg(P, L, farLeg, true, G);
    // neck
    P.m = G;
    P.limb(poly([J.neckBase, J.headC]), L.skin.shade, 18);
    drawLeg(P, L, nearLeg, false, G);
    drawTorso(P, L, J, G, J.backView);
    drawArm(P, L, nearArm, false, G);
    P.m = mul(G, J.headM);
    if (J.headView === 'back') drawHeadBack(P, L);
    else if (J.headView === 'front') { P.m = mul(P.m, mul(scaleM(44 / 40), translate(-60, -56))); drawFrontHead(P, L, expr, true); }
    else drawHeadProfile(P, L, expr);
    return P.out;
  }

  function skeleton(look, pose, opts) {
    const L = resolveLook(look);
    const J = solve(L, pose || POSES.stance);
    const G = placement(J, pose, opts);
    const w = (p) => apply(G, p);
    const res = { hip: w([0, 0]), neck: w(J.neckBase), head: w(J.headC), headR: J.headR * ((opts && opts.scale) || 1) };
    ['f', 'b'].forEach((s) => {
      const a = J[s + 'Arm'], l = J[s + 'Leg'];
      res[s + 'Shoulder'] = w(a.shoulder); res[s + 'Elbow'] = w(a.elbow); res[s + 'Wrist'] = w(a.wrist); res[s + 'Fist'] = w(a.fist);
      res[s + 'Hip'] = w(l.hip); res[s + 'Knee'] = w(l.knee); res[s + 'Ankle'] = w(l.ankle); res[s + 'Toe'] = w(l.toe);
    });
    return res;
  }

  // ---------- Output ----------
  function primAttrs(p) {
    let a = `d="${p.d}" fill="${p.fill || 'none'}"`;
    if (p.stroke) a += ` stroke="${p.stroke}" stroke-width="${p.width}" stroke-linecap="round" stroke-linejoin="round"`;
    if (p.opacity != null) a += ` opacity="${p.opacity}"`;
    return a;
  }
  function primsToSvgBody(prims) { return prims.map((p) => `<path ${primAttrs(p)}/>`).join(''); }

  /** toSvg(primitives, viewBox) -> SVG string. viewBox: '0 0 w h' string or [x, y, w, h]. */
  function toSvg(prims, viewBox) {
    const vb = Array.isArray(viewBox) ? viewBox.join(' ') : viewBox || '-200 -340 400 360';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${primsToSvgBody(prims)}</svg>`;
  }

  /** drawToCanvas(ctx, primitives): paints with Path2D (fill, then stroke; round caps/joins). */
  function drawToCanvas(ctx, prims) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < prims.length; i++) {
      const p = prims[i];
      const path = p._path || (p._path = new Path2D(p.d));
      ctx.globalAlpha = p.opacity != null ? p.opacity : 1;
      if (p.fill && p.fill !== 'none') { ctx.fillStyle = p.fill; ctx.fill(path); }
      if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.width; ctx.stroke(path); }
    }
    ctx.restore();
  }

  // ---------- Poses ----------
  function wrap(a) { a = ((a + 180) % 360 + 360) % 360 - 180; return a; }
  /** lerpPose(a, b, t): shortest-way angle interpolation; x / y / back / hands / ground linear. */
  function lerpPose(a, b, t) {
    const out = {};
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    keys.forEach((k) => {
      const va = a && typeof a[k] === 'number' ? a[k] : k === 'ground' ? 1 : 0;
      const vb = b && typeof b[k] === 'number' ? b[k] : k === 'ground' ? 1 : 0;
      out[k] = LINEAR_KEYS[k] ? va + (vb - va) * t : va + wrap(vb - va) * t;
    });
    return out;
  }

  const STANCE = {
    x: 0, y: 0, rot: 0, torso: 1, head: -2, open: 0,
    fShoulder: 86, fElbow: 58, bShoulder: 30, bElbow: 74,
    fHip: 29, fKnee: 23, fAnkle: 6,
    bHip: -10, bKnee: 26, bAnkle: -24,
    fHand: 0, bHand: 0, back: 0,
  };
  // D(delta): stance + the given offsets (keeps the frames in sync if the stance is retuned)
  const D = (delta) => { const p = Object.assign({}, STANCE); for (const k in delta) p[k] = (p[k] || 0) + delta[k]; return p; };
  const POSES = {
    stance: D({}),
    // idle bounce: stance -> dip -> slight rise (loop ~0.7 s; the guard hands stay put)
    idle: [
      D({}),
      D({ fHip: 4, fKnee: 9, fAnkle: -3, bHip: 2, bKnee: 9, bAnkle: 1, torso: 1, head: -1 }),
      D({ fHip: -1, fKnee: -5, fAnkle: 2, bHip: -1, bKnee: -5, bAnkle: 3, torso: -1 }),
    ],
    // step forward: front foot slides out, then the back foot follows
    walkFwd: [
      D({}),
      D({ fHip: 14, fKnee: 4, fAnkle: 8, bHip: 6, bKnee: 6, bAnkle: 10, torso: 2 }),
      D({ fHip: -6, fKnee: -2, fAnkle: -2, bHip: 16, bKnee: 16, bAnkle: 16, torso: 1 }),
    ],
    // step back: front foot comes back first, then the back foot slides back
    walkBack: [
      D({}),
      D({ fHip: -18, fKnee: -2, fAnkle: 10, bHip: 4, bKnee: 4, bAnkle: 4, torso: -2 }),
      D({ fHip: -4, fKnee: -6, bHip: -10, bKnee: -8, bAnkle: -8, torso: -1 }),
    ],
  };

  const rigInfo = {
    builds: BUILDS,
    ankleHeight: ANKLE_H,
    keys: POSE_KEYS,
    linearKeys: Object.keys(LINEAR_KEYS),
    height: { kid: 305, adult: 335 },
    conventions: {
      space: 'SVG units, y down; facing right; feet on y = 0 after grounding',
      limbAngles: '0 = straight down, 90 = forward, 180 = up (shoulder relative to torso, hip relative to rot)',
      bends: 'elbow + = forearm folds forward/up; knee + = shin folds backward; 0 = straight',
      ankle: '0 = foot at 90 deg to the shin; + = toes pointed away/down; flat foot when ankle = hip - knee - rot',
      rot: '+ = whole body tips forward (clockwise when facing right)',
      torso: '+ = lean forward; head + = nod forward',
      back: '0 = normal side view (front limbs near); 1 = back to the viewer (back limbs near, back of head)',
      hands: 'fHand/bHand: 0 fist, 1 open hand',
      open: 'open 0 = side-on profile (default), 1 = chest turned toward the viewer',
      turn: 'turn deg: 0 side-on, 90 chest to viewer, 180 back to opponent, 270 back to viewer; headTurn adds head yaw; *HipOut/*ArmOut swing a limb plane sideways',
      swap: 'armSwap/legSwap: 1 = draw the back arm/leg near (hip/shoulder turned), XOR with back',
    },
  };

  // ---------- Looks ----------
  const LOOKS = {
    oli: { name: 'Oli', skin: 'light', hairStyle: 'oli', hairColor: 'blonde', eyeColor: 'green', gender: 'male', gi: 'white', belt: 'blue', build: 'kid' },
    dani: { name: 'Dani', skin: 'fair', hairStyle: 'ponytail', hairColor: 'brown', eyeColor: 'brown', gender: 'female', gi: 'pink', belt: 'black', build: 'adult' },
  };

  const NAMES = {
    male: ['Leo', 'Sam', 'Max', 'Kenji', 'Noah', 'Tom', 'Ravi', 'Hugo', 'Malik', 'Jin', 'Luca', 'Theo', 'Omar', 'Yuto', 'Felix'],
    female: ['Mia', 'Lina', 'Zoe', 'Aiko', 'Chloe', 'Nora', 'Amara', 'Lea', 'Mei', 'Ines', 'Sara', 'Yuna', 'Ella', 'Jade', 'Rosa'],
  };

  /** randomOpponent(belt, rand) -> look.  rand() in [0, 1), default Math.random. */
  function randomOpponent(belt, rand) {
    rand = rand || Math.random;
    const pick = (a) => a[Math.floor(rand() * a.length) % a.length];
    const skin = pick(['light', 'dark', 'eastAsian']);
    const gender = pick(['male', 'female']);
    const hairStyle = gender === 'male' ? 'short' : pick(['short', 'long', 'ponytail']); // boys: short hair only
    const hairColor = skin === 'light' ? pick(['blonde', 'lightBrown', 'brown', 'darkBrown', 'red', 'black'])
      : skin === 'dark' ? pick(['black', 'black', 'darkBrown']) : pick(['black', 'black', 'darkBrown']);
    const eyeColor = skin === 'light' ? pick(['blue', 'green', 'brown', 'hazel']) : pick(['darkBrown', 'brown']);
    return {
      name: pick(NAMES[gender]), skin, hairStyle, hairColor, eyeColor, gender,
      gi: 'green', belt: (belt && belt.key) || belt || 'white', build: 'kid',
      eyeShape: skin === 'eastAsian' ? 'almond' : 'round',
    };
  }

  // ---------- Front portrait ----------
  const FRONT_HAIR = {
    oli: {
      cap: 'M20 60 C14 24 40 8 60 10 C82 8 106 24 100 60 C96 48 90 41 82 39 C78 32 70 30 62 37 C56 30 46 31 40 39 C31 41 24 49 20 60 Z',
      tuft: 'M55 12 C51 0 63 -6 72 0 C66 3 65 7 68 12',
      shine: 'M30 30 Q40 20 54 18', shade: 'M84 20 Q94 28 97 40',
    },
    short: {
      cap: 'M20 60 C14 24 40 8 60 10 C82 8 106 24 100 60 C98 50 93 43 86 40 C81 34 73 32 67 36 C61 31 52 31 46 36 C38 36 30 41 26 48 C23 52 21 56 20 60 Z',
      shine: 'M30 30 Q40 20 54 18', shade: 'M84 20 Q94 28 97 40',
    },
    ponytail: {
      behind: 'M88 22 C110 16 124 40 118 68 C115 84 106 94 110 108 C94 102 92 86 96 68 C99 52 99 38 88 32 Z',
      cap: 'M20 58 C15 22 40 8 60 10 C82 8 106 22 100 58 C97 44 88 34 74 30 C62 28 50 30 42 34 C32 40 24 48 20 58 Z',
      tie: [94, 26],
      shine: 'M30 30 Q40 20 54 18', shade: 'M84 20 Q94 28 97 40',
    },
    long: {
      behind: 'M18 54 C12 18 38 5 60 6 C82 5 108 18 102 54 L107 106 Q95 116 83 106 L80 72 L40 72 L37 106 Q25 116 13 106 Z',
      cap: 'M20 62 C15 22 40 8 60 10 C82 8 106 22 100 62 C98 46 90 36 76 31 C64 27 52 30 44 35 C34 41 26 50 20 62 Z',
      shine: 'M30 30 Q40 20 54 18', shade: 'M84 20 Q94 28 97 40',
    },
  };

  // Front-facing head in portrait coordinates (centre 60,56, radius 40).  behind = also draw the hair behind the head.
  function drawFrontHead(P, L, expr, behind) {
    const s = L.skin, hc = L.hair;
    const h = FRONT_HAIR[L.style] || FRONT_HAIR.short;
    if (behind) frontHairBehind(P, L);
    // ears + head
    P.shape(circ(21, 62, 9), s.skin, SW);
    P.shape(circ(99, 62, 9), s.skin, SW);
    if (L.female && L.style !== 'long') { P.shape(circ(20, 73, 2.6), '#FFD34E', 2); P.shape(circ(100, 73, 2.6), '#FFD34E', 2); }
    P.shape(circ(60, 56, 40), s.skin, SW);
    P.shape(h.cap, hc.c, SW);
    if (h.tuft) P.shape(h.tuft, hc.c, SW);
    P.line(h.shine, hc.hi, 4);
    P.line(h.shade, hc.shade, 3.5);
    // brows
    const BR = {
      normal: ['M38 48 Q45 44 52 47', 'M68 47 Q75 44 82 48'],
      happy: ['M38 45 Q45 40 52 44', 'M68 44 Q75 40 82 45'],
      fierce: ['M37 44 Q45 46 53 51', 'M67 51 Q75 46 83 44'],
      hurt: ['M38 50 Q45 47 52 42', 'M68 42 Q75 47 82 50'],
      ko: ['M38 46 Q45 46 52 41', 'M68 41 Q75 46 82 46'],
    }[expr] || ['M38 48 Q45 44 52 47', 'M68 47 Q75 44 82 48'];
    P.line(BR[0], hc.brow, expr === 'fierce' ? 4.8 : 4);
    P.line(BR[1], hc.brow, expr === 'fierce' ? 4.8 : 4);
    // eyes
    if (expr === 'ko') { xEye(P, 45, 60); xEye(P, 75, 60); }
    else if (expr === 'happy') { P.line('M37 63 Q45 53 53 63', O, 3.8); P.line('M67 63 Q75 53 83 63', O, 3.8); }
    else if (expr === 'hurt') { P.line('M38 55 L51 60 L38 65', O, 3.8); P.line('M82 55 L69 60 L82 65', O, 3.8); }
    else {
      eyeAt(P, 45, 60, L, true); eyeAt(P, 75, 60, L, true);
      if (L.female) { lashes(P, 45, 60, -1, L); lashes(P, 75, 60, 1, L); }
      if (expr === 'fierce') {
        P.line('M36 51 L54 56', s.skin, 5); P.line('M36 52 L54 57', O, 2.8);
        P.line('M84 51 L66 56', s.skin, 5); P.line('M84 52 L66 57', O, 2.8);
      }
    }
    // nose, cheeks
    P.line('M57 70 Q60 73 63 70', s.nose, 3);
    P.fill(ell(34, 75, 6.5, 4.2), s.cheek, L.female ? 0.7 : 0.55);
    P.fill(ell(86, 75, 6.5, 4.2), s.cheek, L.female ? 0.7 : 0.55);
    // mouth
    if (expr === 'ko') {
      P.shape('M46 86 Q52 78 60 81 Q68 84 74 79 Q70 90 60 89 Q52 88 46 86 Z', C.mouth, 3);
      P.shape('M36 66 Q31 75 31 79 C31 84 41 84 41 79 Q41 75 36 66 Z', C.tear, 2.5);
      star(P, 14, 8, 9); star(P, 60, -4, 7); star(P, 106, 8, 8);
    } else if (expr === 'hurt') {
      P.shape(ell(60, 83, 6, 7), C.mouth, 3);
      P.shape('M98 30 Q93 38 93 41 C93 46 101 46 101 41 Q101 38 98 30 Z', C.sweat, 2.5);
    } else if (expr === 'fierce') {
      P.shape('M45 78 Q60 74 75 78 Q72 93 60 93 Q48 93 45 78 Z', C.mouth, 3);
      P.fill('M47 79 Q60 76 73 79 L72 83 Q60 81 48 83 Z', C.teeth);
    } else if (expr === 'happy') {
      P.shape('M44 76 Q60 100 76 76 Q60 82 44 76 Z', C.mouth, 3);
      P.fill(ell(60, 87, 6.5, 3), C.tongue);
    } else {
      P.shape(L.female ? 'M48 78 Q60 93 72 78 Q60 83 48 78 Z' : 'M46 77 Q60 96 74 77 Q60 83 46 77 Z', C.mouth, 3);
      P.fill(ell(60, L.female ? 85 : 86, 5, 2.4), C.tongue);
    }
  }
  function frontHairBehind(P, L) {
    const h = FRONT_HAIR[L.style] || FRONT_HAIR.short;
    if (h.behind) P.shape(h.behind, L.hair.c, SW);
    if (h.tie) P.shape(ell(h.tie[0], h.tie[1], 6, 8, 30), L.female ? '#FF5C8A' : '#4A7BD0', 3);
  }

  /** portrait(look, expression) -> front-facing SVG string (viewBox 0 -10 120 134). */
  function portrait(look, expression) {
    const L = resolveLook(look);
    const expr = expression || 'normal';
    const P = Painter();
    const s = L.skin, gi = L.gi;
    frontHairBehind(P, L);
    // shoulders in the dobok, V-neck
    P.shape('M14 124 Q16 99 42 93 L78 93 Q104 99 106 124 Z', gi.main, SW);
    P.shape('M50 92 L70 92 L60 112 Z', s.skin, 0);
    P.shape('M51 86 L69 86 L69 96 Q60 104 51 96 Z', s.shade, 3);
    P.limb('M44 93 L61 118', gi.lapel, 7);
    P.limb('M76 93 L59 116', gi.lapel, 7);
    P.line('M30 108 Q34 116 32 124 M90 108 Q86 116 88 124', gi.fold, 3, 0.8);
    drawFrontHead(P, L, expr, false);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 120 134">${primsToSvgBody(P.out)}</svg>`;
  }

  // ---------- Belt badge ----------
  /** beltBadge(belt) -> SVG string (viewBox 0 0 120 80): a tied belt, knot and two tails. */
  function beltBadge(belt) {
    const b = typeof belt === 'object' ? belt : BELT[belt] || BELT.white;
    const P = Painter();
    // loop of the belt (seen from the front, slightly curved)
    P.shape('M8 22 Q60 12 112 22 L112 38 Q60 28 8 38 Z', b.color, SW);
    P.line('M12 30 Q60 21 108 30', b.shade, 2.5, 0.7);
    if (b.stripe) P.line('M20 29 Q30 27 38 26.5', b.stripe, 3);
    // tails
    P.limb('M52 36 Q44 52 34 68', b.color, 13);
    P.limb('M68 36 Q76 52 86 68', b.color, 13);
    P.line('M49 44 Q43 54 37 63', b.shade, 2.2, 0.6);
    P.line('M71 44 Q77 54 83 63', b.shade, 2.2, 0.6);
    if (b.stripe) P.line('M78 54 L82 61', b.stripe, 3);
    // knot
    P.shape('M50 16 Q60 13 70 16 L72 36 Q60 40 48 36 Z', b.color, SW);
    P.line('M52 26 Q60 24 68 26', b.shade, 2.5, 0.7);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">${primsToSvgBody(P.out)}</svg>`;
  }

  // ---------- Export ----------
  window.TKDAssets = {
    palette: C,
    belts: BELTS,
    belt: BELT,
    looks: LOOKS,
    builds: BUILDS,
    poses: POSES,
    rigInfo,
    drawFighter,
    skeleton,
    toSvg,
    drawToCanvas,
    lerpPose,
    randomOpponent,
    portrait,
    beltBadge,
    // low-level helpers (for P4 / UI art)
    _ell: ell,
    _tx: tx,
  };
})();
