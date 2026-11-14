/* Oli's Scooter Dash — game code.
 * Part 1: DOM-free core (createGame) — testable headless.
 * Part 2: browser shell (input, canvas sizing, overlays, loop) — only starts when `document` exists.
 * Exposed as window.JumpNDuck = { createGame, loadImages, prepareSprites }.
 */
(function () {
  'use strict';

  // ---------- Tuning constants ----------
  const H = 400;               // world height (units); width follows the screen aspect
  const GROUND_Y = 352;        // riding line: wheels / obstacle bottoms
  const KID_X = 130;            // leaves the bottom-left corner free for the DUCK touch button
  const K = 0.6;               // kid world units per sprite unit
  const KID_WHEEL_Y = 229;     // wheels' y in kid sprite space
  const KID_ANCHOR_X = 20;
  const SPEED_START = 300, SPEED_ACCEL = 7, SPEED_MAX = 680, ATTRACT_SPEED = 150;
  const SCORE_PER_UNIT = 0.025, FOOD_POINTS = 100, MILESTONE = 500;
  const BOOK_POINTS = 200, BOOK_EVERY = 5; // every 5th collectible is a red book: +200 LEARN!
  const STRONG_TIME = 3;       // seconds of muscly look after eating well (visual only)
  const JUMP_V = -860, GRAVITY = 2000, FASTFALL = 3, JUMP_BUFFER = 0.12;
  const BIRD_W = 84, BIRD_EXTRA_SPEED = 40, BIRD_MIN_SCORE = 250;
  const BIRD_LOW_BOTTOM = GROUND_Y - 40, BIRD_DUCK_BOTTOM = GROUND_Y - 104;
  const FOOD_H = 40, FOOD_CHANCE = 0.45, FOOD_HIGH_Y = GROUND_Y - 150, FOOD_LOW_Y = GROUND_Y - 70;
  const MIN_GAP = 260;
  const RASTER = 2.2;          // image pixels per (max) screen pixel when rasterising SVGs

  const OBSTACLES = [          // key, world height
    ['cactus_tall', 72], ['cactus_small', 46], ['cactus_double', 62],
    ['poop', 44], ['rock_small', 30], ['rock_big', 56], ['rock_pile', 36],
  ];

  // ---------- Sprites ----------
  function parseViewBox(svg) {
    const m = /viewBox="([-\d.\s]+)"/.exec(svg);
    const n = m[1].trim().split(/\s+/).map(Number);
    return { x: n[0], y: n[1], w: n[2], h: n[3] };
  }

  /** key -> { svg (with width/height set for crisp rasterising), vb, drawH } */
  function prepareSprites(A) {
    const defs = {};
    const add = (key, svg, drawH) => { defs[key] = { svg, drawH }; };
    for (const p of A.kidPoses) {
      const svg = A.kid(p);
      add('kid_' + p, svg, parseViewBox(svg).h * K);
    }
    // power-up (muscly) versions, same viewBoxes as the normal poses
    for (const p of ['ride', 'push', 'jump', 'duck']) {
      const svg = A.kid(p, { strong: true });
      add('kid_' + p + '_strong', svg, parseViewBox(svg).h * K);
    }
    add('kidFace', A.kidFace(), 100);
    for (const f of A.seagullFrames) add('seagull_' + f, A.seagull(f), BIRD_W * 140 / 186);
    for (const f of A.pigeonFrames) add('pigeon_' + f, A.pigeon(f), BIRD_W * 140 / 186);
    const hOf = {}; OBSTACLES.forEach(([k, h]) => { hOf[k] = h; });
    for (const v of A.cactusVariants) add('cactus_' + v, A.cactus(v), hOf['cactus_' + v]);
    add('poop', A.poop(), hOf.poop);
    for (const v of A.rockVariants) add('rock_' + v, A.rock(v), hOf['rock_' + v]);
    for (const k of A.foodKinds) add('food_' + k, A.food(k), FOOD_H);
    add('popup', A.scorePopup(FOOD_POINTS, 'EAT WELL!'), 80);
    add('book', A.book(), FOOD_H);
    add('popup_learn', A.scorePopup(BOOK_POINTS, 'LEARN!', '#E04848'), 80);
    const bg = A.background;
    add('bg_mountains', bg.mountains(), 120);
    add('bg_sea', bg.sea(), 58);
    add('bg_ground', bg.ground(), 54);
    add('bg_oldTown', bg.oldTown(), 80);
    add('bg_nomade', bg.nomade(), 130);
    add('bg_ferris', bg.ferrisWheel(), 150);
    add('bg_boat', bg.boat(), 30);
    add('bg_sun', bg.sun(), 70);
    const out = {};
    for (const key of Object.keys(defs)) {
      const d = defs[key];
      const vb = parseViewBox(d.svg);
      const ppu = (d.drawH / vb.h) * RASTER;
      const w = Math.min(2400, Math.max(8, Math.ceil(vb.w * ppu)));
      const h = Math.max(8, Math.ceil(vb.h * (w / vb.w)));
      out[key] = { svg: d.svg.replace('<svg ', `<svg width="${w}" height="${h}" `), vb, w, h };
    }
    return out;
  }

  /** Browser: rasterise every sprite into an <img>. Resolves to key -> { img, vb }. */
  function loadImages(A) {
    const sprites = prepareSprites(A);
    const map = {};
    return Promise.all(Object.keys(sprites).map((key) => {
      const s = sprites[key];
      const img = new Image();
      img.src = A.toDataUrl(s.svg);
      const done = () => { map[key] = { img, vb: s.vb }; };
      const wait = new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const p = typeof img.decode === 'function' ? img.decode().catch(() => wait) : wait;
      return p.then(done).catch(() => { /* a missing sprite just isn't drawn */ });
    })).then(() => map);
  }

  // ---------- Core ----------
  function createGame(opts) {
    opts = opts || {};
    const rand = opts.rand || Math.random;
    const A = opts.assets || (typeof window !== 'undefined' && window.GameAssets);
    if (!A) throw new Error('GameAssets missing: load assets.js first');
    const S = prepareSprites(A);
    const VB = (k) => S[k].vb;

    const world = { W: 711, H };
    const rr = (a, b) => a + rand() * (b - a);

    let state, speed, distance, bonus, playT, kidOff, kidVy, onGround, jumpBuf, runT, overT, strongT;
    let obstacles, foods, popups, deco, clouds, gapLeft, lastMilestone, moved, collectN = 0;
    let layerX, waits;
    let events = [];

    function reset() {
      state = 'ready'; speed = ATTRACT_SPEED; distance = 0; bonus = 0; playT = 0;
      kidOff = 0; kidVy = 0; onGround = true; jumpBuf = 0; runT = 0; overT = 0; strongT = 0;
      obstacles = []; foods = []; popups = []; deco = []; gapLeft = 0; lastMilestone = 0; collectN = 0;
      layerX = { mountains: 0, sea: 0, ground: 0 };
      waits = { town: 0, boat: 0, fg: 0, sun: 0 };
      moved = false;
      g.newBest = false;
      clouds = [];
      for (let i = 0; i < 5; i++) clouds.push({ x: rr(0, world.W), y: rr(24, 140), s: rr(0.7, 1.4) });
      layoutInitial();
    }

    function addTown(x) {
      const vb = VB('bg_oldTown'), s = 80 / vb.h;
      deco.push({ kind: 'town', key: 'bg_oldTown', par: 0.12, x, w: vb.w * s, h: 80, y: 300 - 80 });
    }
    // The sun drifts very slowly across the sky every now and then (behind the clouds).
    function addSun(x) {
      const h = 70;
      deco.push({ kind: 'sun', key: 'bg_sun', par: 0.04, x, w: h, h, y: rr(26, 80) });
    }
    function addBoat(x) {
      const vb = VB('bg_boat'), s = 30 / vb.h;
      deco.push({ kind: 'boat', key: 'bg_boat', par: 0.25, x, w: vb.w * s, h: 30, y: rr(318, 334) - 30 });
    }
    // Nomade / ferris wheel: far away on the shore across the water (like the old town),
    // small, slow and semi-transparent so they read as scenery, not obstacles.
    const FAR_BASE_Y = 300;      // same waterline as the old town
    function addFg(x, kind) {
      const nomade = kind === 'nomade';
      const key = nomade ? 'bg_nomade' : 'bg_ferris', vb = VB(key);
      const hh = nomade ? 62 : 78, s = hh / vb.h;
      // the sprite's ground line is at viewBox y = 226
      deco.push({ kind: 'fg', key, par: 0.12, alpha: nomade ? 0.6 : 0.45, x, w: vb.w * s, h: vb.h * s, y: FAR_BASE_Y - (226 - vb.y) * s });
    }
    function layoutInitial() {
      deco = [];
      addTown(world.W * 0.55);
      addBoat(world.W * 0.22);
      addFg(world.W * 0.06, rand() < 0.5 ? 'nomade' : 'ferris');
      waits = { town: 0, boat: 3000, fg: 0, sun: 1500 };
    }

    function updateDeco(dx, dt) {
      for (const d of deco) d.x -= dx * d.par;
      deco = deco.filter((d) => d.x + d.w > -10);
      const has = (k) => deco.some((d) => d.kind === k);
      // town and far landmarks share the shoreline: don't spawn one while the other is still entering
      const entering = (k) => deco.some((d) => d.kind === k && d.x + d.w > world.W - 60);
      for (const k of ['town', 'boat', 'fg', 'sun']) {
        if (has(k)) continue;
        if ((k === 'town' && entering('fg')) || (k === 'fg' && entering('town'))) continue;
        waits[k] -= dx;
        if (waits[k] > 0) continue;
        if (k === 'town') { addTown(world.W + 10); waits.town = rr(3000, 8000); }
        else if (k === 'boat') { addBoat(world.W + 10); waits.boat = rr(1500, 4000); }
        else if (k === 'sun') { addSun(world.W + 10); waits.sun = rr(16000, 32000); }
        else { addFg(world.W + 10, rand() < 0.5 ? 'nomade' : 'ferris'); waits.fg = rr(800, 2500); }
      }
      for (const c of clouds) {
        c.x -= dx * 0.04 + 4 * dt;
        if (c.x < -140) { c.x = world.W + rr(20, 120); c.y = rr(24, 140); c.s = rr(0.7, 1.4); }
      }
    }

    // ----- kid geometry -----
    function poseKey() {
      if (state === 'over') return 'kid_gameover';
      if (!onGround) return 'kid_jump';
      if (g._duck) return 'kid_duck';
      // A short kick (0.2 s), then a glide that gets longer as he goes faster —
      // like a real rider: one kick every ~0.8 s at the start, every ~1.6 s at top speed.
      const d = Math.min(1, Math.max(0, (speed - SPEED_START) / (SPEED_MAX - SPEED_START)));
      const cycle = 0.8 + 0.8 * d;
      return (runT % cycle) < 0.2 ? 'kid_push' : 'kid_ride';
    }
    function kidRect(key) {
      const vb = VB(key), gy = GROUND_Y + kidOff;
      return { x: KID_X + (vb.x - KID_ANCHOR_X) * K, y: gy - (KID_WHEEL_Y - vb.y) * K, w: vb.w * K, h: vb.h * K };
    }
    function kidHit() {
      const key = g._duck && onGround ? 'kid_duck' : 'kid_ride';
      const r = kidRect(key);
      const ix = key === 'kid_duck' ? 0.15 : 0.22;
      return { x: r.x + r.w * ix, y: r.y + r.h * 0.12, w: r.w * (1 - 2 * ix), h: r.h * (1 - 0.12 - 0.06) };
    }
    const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    // ----- spawning -----
    function spawnObstacle() {
      const x = world.W + 40;
      let o;
      if (g.score >= BIRD_MIN_SCORE && rand() < 0.25) {
        const duck = rand() < 0.5, sp = rand() < 0.5 ? 'seagull' : 'pigeon';
        const vb = VB(sp + '_up'), h = BIRD_W * vb.h / vb.w;
        // birds fly faster than the ground scrolls: start them further right so they
        // arrive in step with the ground-equivalent spacing
        const travel = (world.W + 40 - KID_X) / speed;
        const extra = BIRD_EXTRA_SPEED * travel / (1 - BIRD_EXTRA_SPEED / speed);
        o = { bird: true, sp, duck, t: 0, x: x + extra, w: BIRD_W, h, y: (duck ? BIRD_DUCK_BOTTOM : BIRD_LOW_BOTTOM) - h, ix: 0.18, iyt: 0.25, iyb: 0.25 };
        o.virtX = x;
      } else {
        const pick = OBSTACLES[Math.floor(rand() * OBSTACLES.length)];
        const vb = VB(pick[0]), h = pick[1];
        o = { bird: false, key: pick[0], x, w: vb.w * h / vb.h, h, y: GROUND_Y + 2 - h, ix: 0.15, iyt: 0.10, iyb: 0 };
        o.virtX = x;
      }
      obstacles.push(o);
      // Gap measured in seconds of riding: roomy and varied at the start, tighter as speed rises,
      // plus an occasional longer breather so the rhythm never feels regular.
      const d = Math.min(1, Math.max(0, (speed - SPEED_START) / (SPEED_MAX - SPEED_START)));
      let secs = (2.0 - 1.1 * d) + rand() * (2.0 - 0.9 * d);   // start: 2–4 s, top speed: 0.9–2 s
      if (rand() < 0.12) secs += 1.5;
      const gap = Math.max(MIN_GAP, speed * secs);
      gapLeft = o.w + gap;
      if (rand() < FOOD_CHANCE) {
        collectN++;
        const isBook = collectN % BOOK_EVERY === 0;
        const key = isBook ? 'book' : 'food_' + A.foodKinds[Math.floor(rand() * A.foodKinds.length)];
        const vb = VB(key), w = vb.w * FOOD_H / vb.h;
        const cy = rand() < 0.7 ? FOOD_HIGH_Y : FOOD_LOW_Y;
        foods.push({ key, x: x + o.w + gap / 2 - w / 2, w, h: FOOD_H, cy, t: rr(0, 6) });
      }
    }

    function obstacleRect(o) {
      return { x: o.x + o.w * o.ix, y: o.y + o.h * o.iyt, w: o.w * (1 - 2 * o.ix), h: o.h * (1 - o.iyt - o.iyb) };
    }

    function crash() {
      state = 'over'; overT = 0;
      if (g.score > g.best) { g.best = g.score; g.newBest = true; }
      events.push({ type: 'crash' });
    }

    function update(dt, input) {
      dt = Math.min(dt, 0.05);
      input = input || {};
      g._duck = !!input.duck && state === 'playing';

      // age popups in every state
      for (const p of popups) p.age += dt;
      popups = popups.filter((p) => p.age < 1.2);

      // the kid keeps falling after a crash, the world stops
      if (state === 'over') {
        overT += dt;
        if (!onGround) {
          kidVy += GRAVITY * dt; kidOff += kidVy * dt;
          if (kidOff >= 0) { kidOff = 0; kidVy = 0; onGround = true; }
        }
        return;
      }

      const playing = state === 'playing';
      if (playing) { playT += dt; speed = Math.min(SPEED_MAX, SPEED_START + SPEED_ACCEL * playT); }
      else speed = ATTRACT_SPEED;
      strongT = Math.max(0, strongT - dt);
      const dx = speed * dt;
      moved = true;
      layerX.mountains += dx * 0.08; layerX.sea += dx * 0.2; layerX.ground += dx;
      runT += dt;
      updateDeco(dx, dt);

      // kid physics
      if (playing && input.jump) jumpBuf = JUMP_BUFFER;
      if (jumpBuf > 0 && onGround && playing) { kidVy = JUMP_V; onGround = false; jumpBuf = 0; }
      jumpBuf = Math.max(0, jumpBuf - dt);
      if (!onGround) {
        kidVy += GRAVITY * (g._duck ? FASTFALL : 1) * dt;
        kidOff += kidVy * dt;
        if (kidOff >= 0) { kidOff = 0; kidVy = 0; onGround = true; }
      }

      if (!playing) return;

      distance += dx;
      gapLeft -= dx;
      if (gapLeft <= 0) spawnObstacle();

      for (const o of obstacles) {
        if (o.bird) { o.x -= (speed + BIRD_EXTRA_SPEED) * dt; o.t += dt; }
        else o.x -= dx;
      }
      obstacles = obstacles.filter((o) => o.x + o.w > -30);
      for (const f of foods) { f.x -= dx; f.t += dt; }

      const kr = kidHit();
      for (const o of obstacles) {
        if (hit(kr, obstacleRect(o))) { crash(); return; }
      }
      const rest = [];
      for (const f of foods) {
        const fy = f.cy + Math.sin(f.t * 5) * 4 - f.h / 2;
        if (hit(kr, { x: f.x, y: fy, w: f.w, h: f.h })) {
          const isBook = f.key === 'book';
          const px = f.x + f.w / 2, py = fy + f.h / 2;
          if (isBook) {
            bonus += BOOK_POINTS;                       // books: +200 LEARN!, no muscles
          } else {
            bonus += FOOD_POINTS;
            strongT = STRONG_TIME;   // eating well → muscly for a few seconds
          }
          // show the popup above his head so it never hides the kid
          popups.push({ x: px, y: Math.min(py, kr.y - 30), age: 0, key: isBook ? 'popup_learn' : 'popup' });
          events.push({ type: isBook ? 'book' : 'food', x: px, y: py });
        } else if (f.x + f.w > -30) rest.push(f);
      }
      foods = rest;

      const m = Math.floor(g.score / MILESTONE);
      if (m > lastMilestone) { lastMilestone = m; events.push({ type: 'milestone', value: m * MILESTONE }); }
    }

    // ----- rendering -----
    function render(ctx, images, scale) {
      scale = scale || 1;
      const W = world.W;
      const snap = (v) => Math.round(v * scale) / scale;
      const img = (key, x, y, w, h) => {
        const e = images && images[key];
        if (e) ctx.drawImage(e.img, x, y, w, h);
      };
      const tiles = (key, y, h, tileW, off) => {
        const e = images && images[key];
        if (!e) return;
        const n = Math.ceil(W / tileW) + 2, o = off % tileW, y0 = snap(y), y1 = snap(y + h);
        for (let i = 0; i < n; i++) {
          const x0 = snap(i * tileW - o), x1 = snap((i + 1) * tileW - o);
          ctx.drawImage(e.img, x0, y0, x1 - x0 + 1 / scale, y1 - y0);   // +1px overlap hides seams
        }
      };

      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, 300);
      sky.addColorStop(0, '#BFE6FF'); sky.addColorStop(1, '#EAF7FF');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W + 4, 300);
      ctx.fillStyle = '#EAF7FF'; ctx.fillRect(0, 300, W + 4, H - 300);
      // sun (behind the clouds)
      for (const d of deco) if (d.kind === 'sun') img(d.key, d.x, d.y, d.w, d.h);
      // clouds
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const c of clouds) {
        const r = 14 * c.s;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, 7); ctx.arc(c.x + r * 1.3, c.y - r * 0.4, r * 1.25, 0, 7);
        ctx.arc(c.x + r * 2.6, c.y, r * 0.95, 0, 7); ctx.rect(c.x, c.y - r * 0.2, r * 2.6, r * 1.2);
        ctx.fill();
      }
      // far layers
      tiles('bg_mountains', 300 - 120, 120, 600, layerX.mountains);
      tiles('bg_sea', 292, 58, 800 * 58 / 60, layerX.sea);
      for (const d of deco) if (d.kind === 'town') img(d.key, d.x, d.y, d.w, d.h);
      for (const d of deco) if (d.kind === 'fg') {
        ctx.save(); ctx.globalAlpha = d.alpha; img(d.key, d.x, d.y, d.w, d.h); ctx.restore();
      }
      for (const d of deco) if (d.kind === 'boat') img(d.key, d.x, d.y, d.w, d.h);
      tiles('bg_ground', GROUND_Y - 5, 54, 400 * 54 / 60, layerX.ground);

      // food
      for (const f of foods) {
        const y = f.cy + Math.sin(f.t * 5) * 4 - f.h / 2;
        img(f.key, f.x, y, f.w, f.h);
      }
      // obstacles + birds
      for (const o of obstacles) {
        const key = o.bird ? o.sp + (Math.floor(o.t / 0.15) % 2 ? '_down' : '_up') : o.key;
        img(key, o.x, o.y, o.w, o.h);
      }
      // kid
      const kk = poseKey(), kr = kidRect(kk);
      // strong look while powered up; flickers during the last 0.6 s so you see it ending
      const strongOn = strongT > 0 && state !== 'over' && S[kk + '_strong'] &&
        (strongT > 0.6 || Math.floor(strongT / 0.1) % 2 === 0);
      img(strongOn ? kk + '_strong' : kk, kr.x, kr.y, kr.w, kr.h);
      // popups
      for (const p of popups) {
        const a = p.age;
        const sc = a < 0.2 ? 0.2 + (a / 0.2) * 1.0 : a < 0.32 ? 1.2 - ((a - 0.2) / 0.12) * 0.2 : 1;
        const rise = 60 * Math.min(1, a / 1.1);
        const alpha = a < 0.7 ? 1 : Math.max(0, 1 - (a - 0.7) / 0.4);
        const w = 130 * sc, h = w * 130 / 220;
        const cx = Math.max(70, p.x), cy = p.y - rise;
        ctx.globalAlpha = alpha;
        img(p.key || 'popup', cx - w / 2, cy - h / 2, w, h);
        ctx.globalAlpha = 1;
      }
    }

    function resize(aspect) {
      const a = Math.min(2.6, Math.max(1.3, aspect || 1.78));
      world.W = Math.round(H * a);
      if (!moved) layoutInitial();
    }

    function start() {
      // fresh run; the scenery (layers, clouds, landmarks) just keeps scrolling
      state = 'playing'; speed = SPEED_START; distance = 0; bonus = 0; playT = 0;
      kidOff = 0; kidVy = 0; onGround = true; jumpBuf = 0; overT = 0;
      obstacles = []; foods = []; popups = []; lastMilestone = 0; collectN = 0;
      gapLeft = 900;   // first obstacle arrives after a short warm-up
      g.newBest = false;
      moved = true;
    }

    const g = {
      world, resize, start, reset, update, render,
      best: 0, newBest: false, _duck: false,
      get state() { return state; },
      get score() { return Math.floor(distance * SCORE_PER_UNIT + bonus); },
      get speed() { return speed; },
      get events() { const e = events; events = []; return e; },
      // test/debug access
      get obstacles() { return obstacles; },
      get foods() { return foods; },
      get deco() { return deco; },
      get kid() { return { off: kidOff, onGround, hit: kidHit(), pose: poseKey(), strong: strongT }; },
      obstacleRect, KID_X, GROUND_Y, BIRD_DUCK_BOTTOM, BIRD_LOW_BOTTOM,
    };
    reset();
    return g;
  }

  const api = { createGame, loadImages, prepareSprites };
  if (typeof window !== 'undefined') window.JumpNDuck = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // ---------- Browser shell ----------
  function startShell() {
    const $ = (id) => document.getElementById(id);
    const canvas = $('game'), ctx = canvas.getContext('2d');
    const body = document.body;
    const el = {
      score: $('score'), best: $('hudBest'), slot: $('avatarSlot'), hud: $('hud'),
      splash: $('splash'), face: $('splashFace'), play: $('playBtn'), splashBest: $('splashBest'), reset: $('resetBest'),
      over: $('over'), overScore: $('overScore'), overBest: $('overBest'), overNew: $('overNew'), again: $('againBtn'),
      rotate: $('rotate'), btnDuck: $('btnDuck'), btnJump: $('btnJump'),
    };
    const KEY = 'jumpnduck:best';
    const game = createGame();
    let images = null;
    let phase = 'loading';             // loading | splash | starting | playing | over
    let paused = false, last = performance.now(), overAt = 0, shownScore = -1;
    let jumpQueued = false;
    const keysDown = new Set(), duckPtrs = new Set();

    const readBest = () => { try { return Math.max(0, parseInt(localStorage.getItem(KEY), 10) || 0); } catch (e) { return 0; } };
    const writeBest = (v) => { try { localStorage.setItem(KEY, String(v)); } catch (e) { /* ignore */ } };
    const clearBest = () => { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };

    function setPhase(p) { phase = p; body.dataset.phase = p; }
    function showBest() {
      const b = game.best;
      el.splashBest.textContent = b > 0 ? 'Best: ' + b : '';
      el.reset.hidden = b <= 0;
      el.best.textContent = 'Best ' + b;
      el.best.hidden = b <= 0;
    }
    function bump(node) { node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop'); }

    // faces
    const faceSvg = window.GameAssets.kidFace();
    el.face.innerHTML = faceSvg;
    el.slot.innerHTML = faceSvg;

    // ----- sizing -----
    function resizeCanvas() {
      const vw = window.innerWidth, vh = window.innerHeight;
      const a = Math.min(2.6, Math.max(1.3, vw / vh));
      const cssW = Math.min(vw, vh * a), cssH = cssW / a;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
      canvas.style.left = (vw - cssW) / 2 + 'px'; canvas.style.top = (vh - cssH) / 2 + 'px';
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
      game.resize(a);
    }
    function checkPause() {
      const portrait = window.innerHeight > window.innerWidth;
      el.rotate.classList.toggle('show', portrait);
      paused = portrait || document.hidden;
      if (!paused) last = performance.now();
      if (paused) { duckPtrs.clear(); keysDown.clear(); }
    }
    function onResize() { resizeCanvas(); checkPause(); }

    // ----- flow -----
    function startPlay() {
      if (phase !== 'splash') return;
      setPhase('starting');
      el.play.blur();
      el.hud.classList.add('show');
      el.splash.classList.add('leaving');   // stops the idle bobbing before we measure
      void el.face.offsetWidth;
      const from = el.face.getBoundingClientRect(), to = el.slot.getBoundingClientRect();
      const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
      const dy = (to.top + to.height / 2) - (from.top + from.height / 2);
      const s = to.width / from.width;
      el.face.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')';
      let finished = false;
      const finish = () => {
        if (finished) return; finished = true;
        el.slot.classList.add('filled');
        el.splash.hidden = true;
        game.start();
        shownScore = -1;
        setPhase('playing');
      };
      el.face.addEventListener('transitionend', (e) => { if (e.propertyName === 'transform') finish(); });
      setTimeout(finish, 800);   // safety net if transitionend never fires
    }

    function restart() {
      if (phase !== 'over' || performance.now() - overAt < 700) return;
      el.over.classList.remove('show');
      el.again.blur();
      game.start();
      jumpQueued = false; shownScore = -1;
      setPhase('playing');
    }

    function onCrash() {
      setPhase('over');
      overAt = performance.now();
      duckPtrs.clear();
      if (game.newBest) writeBest(game.best);
      el.overScore.textContent = game.score;
      el.overBest.textContent = 'Best ' + game.best;
      el.overNew.hidden = !game.newBest;
      el.over.classList.add('show');
      showBest();
    }

    // ----- input -----
    const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
    const DUCK_KEYS = new Set(['ArrowDown', 'KeyS']);
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      const isAct = JUMP_KEYS.has(code) || DUCK_KEYS.has(code) || code === 'Enter';
      if (!isAct) return;
      e.preventDefault();
      if (e.repeat) return;
      if (phase === 'splash') { if (code === 'Space' || code === 'Enter') startPlay(); return; }
      if (phase === 'over') { if (code === 'Space' || code === 'Enter') restart(); return; }
      if (phase !== 'playing') return;
      if (JUMP_KEYS.has(code)) jumpQueued = true;
      if (DUCK_KEYS.has(code)) keysDown.add(code);
    });
    window.addEventListener('keyup', (e) => { keysDown.delete(e.code); });
    window.addEventListener('blur', () => { keysDown.clear(); duckPtrs.clear(); });

    document.addEventListener('pointerdown', (e) => {
      const t = e.target;
      if (t.closest && (t.closest('#resetBest') || t.closest('.tbtn'))) return;
      if (phase === 'splash') { startPlay(); return; }
      if (phase === 'over') { restart(); return; }
      if (phase !== 'playing' || paused) return;
      e.preventDefault();
      if (e.clientY < window.innerHeight / 2) jumpQueued = true;
      else duckPtrs.add(e.pointerId);
    });
    const release = (e) => { duckPtrs.delete(e.pointerId); };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    // on-screen buttons: handled here only (stopPropagation keeps the half-screen rule out)
    el.btnJump.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (phase === 'playing' && !paused) jumpQueued = true;
    });
    el.btnDuck.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (phase === 'playing' && !paused) duckPtrs.add(e.pointerId);
    });
    el.play.addEventListener('click', startPlay);
    el.again.addEventListener('click', restart);
    el.reset.addEventListener('click', () => {
      if (window.confirm('Reset your best score?')) { clearBest(); game.best = 0; showBest(); }
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('visibilitychange', checkPause);

    // ----- loop -----
    const input = { jump: false, duck: false };
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (paused) return;
      input.jump = jumpQueued; jumpQueued = false;
      input.duck = keysDown.size > 0 || duckPtrs.size > 0;
      game.update(dt, phase === 'playing' ? input : null);
      for (const ev of game.events) {
        if (ev.type === 'food' || ev.type === 'book') bump(el.score);
        else if (ev.type === 'milestone') bump(el.score);
        else if (ev.type === 'crash') onCrash();
      }
      const sc = game.score;
      if (sc !== shownScore) { shownScore = sc; el.score.textContent = sc; }
      const scale = canvas.height / H;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingQuality = 'high';
      game.render(ctx, images, scale);
    }

    game.best = readBest();
    showBest();
    onResize();
    requestAnimationFrame(frame);
    loadImages(window.GameAssets).then((m) => {
      images = m;
      el.play.disabled = false;
      el.play.querySelector('b').textContent = 'Play';
      setPhase('splash');
    });
    setPhase('loading');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startShell);
    else startShell();
  }
})();
