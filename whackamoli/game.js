/* Whack-a-m-Oli — game code.
 * Part 1: DOM-free core (createGame) — testable headless (node).
 * Part 2: browser shell (input, canvas sizing, overlays, loop) — added in phase C2; only starts when `document` exists.
 * Exposed as window.WhackAMOli = { createGame }.
 * World: height H = 400 units, width = H * aspect (landscape). y grows downwards.
 */
(function () {
  'use strict';

  // ---------- Tuning constants ----------
  const H = 400;               // world height (units)
  const CABLE_Y = 40;          // y of the cable the gondola hangs from
  const GRASS_Y = 350;         // top of the grass: moles / food stand on this line
  const GONDOLA_W = 80;        // gondola basket width (clamp keeps it fully on screen)
  const GONDOLA_SPEED = 230;   // u/s when left/right is held
  const GONDOLA_TOUCH_MAX = 420; // u/s cap while easing toward a touch targetX
  const GONDOLA_EASE = 12;     // 1/s: how hard the gondola chases targetX
  const HAND_DX = 30;          // hammer starts this far in front of the gondola centre...
  const HAND_Y = CABLE_Y + 78; // ...at this height (Oli's hand in the sprite: WAMAssets.oliHand)
  const HAMMER_VX = 135;       // throw speed along the facing direction (u/s), plus the gondola's (smoothed) speed
  const AIM_SMOOTH = 0.12;     // s: time constant smoothing the gondola speed used by the throw AND the marker,
                               // so the marker doesn't jitter and always shows exactly where a throw lands
  const FACING_DEADZONE = 25;  // u/s: slower moves (touch jitter) don't flip the facing
  const HAMMER_VY = -240;      // initial vertical speed (negative = up): small lob, then a fast drop
  const GRAVITY = 1600;        // u/s^2 (strong: the hammer accelerates down hard) -> still throw lands ~117 units ahead (see launchRange)
  const HAMMER_SPIN = 14;      // rad/s
  const HAMMER_R = 13;         // hammer hit radius
  const THROW_COOLDOWN = 0.35; // s between throws
  const MAX_HAMMERS = 3;       // hammers in the air at once
  const MOLE_W = 50, MOLE_H = 40; // mole hit box size at critter scale 1 (see setCritterScale)
  const MOLE_EMERGE = 0.4;     // s popping out of the grass (not hittable)
  const MOLE_TURN = 0.3;       // s pause at the screen edge before heading for the food
  const MOLE_EAT = 1.0;        // s munching before the food is gone (still hittable)
  const MOLE_BONK = 0.6;       // s dizzy after a hit
  const MOLE_DIVE = 0.35;      // s sinking back into the grass
  const MOLE_POINTS = 100;     // points per mole
  const SPAWN_BASE = 3.0;      // s between moles at level 1
  const SPAWN_FACTOR = 0.85, SPAWN_MIN = 0.9; // per level interval multiplier / floor
  const FIRST_SPAWN = 1.0;     // s before the first mole
  const MOLE_SPEED = 55;       // u/s at level 1 (slow)
  const SPEED_FACTOR = 1.12, SPEED_MAX = 150; // per level multiplier / cap
  const MOLE_FAR = 0.25;       // spawn at least this fraction of W away from its target food
  const LEVEL_POINTS = 1000;   // score per level
  const TWO_FOOD_LEVEL = 3;    // from this level on, two foods sit on the grass
  const FOOD_RESPAWN = 1.5;    // s until a new food appears after one was eaten
  const FOOD_MARGIN = 90;      // foods stay this far from the screen edges
  const FOOD_MIN_GAP = 160;    // two foods keep at least this distance
  const FOODS_TO_LOSE = 5;     // eaten foods = game over
  const FOOD_KINDS = ['carrot', 'broccoli', 'steak'];
  const FOOD_DRAW = 0.9;       // food sprite scale (viewBox -> world units); user: doubled from 0.45 so it's bigger and nicer
  const EAT_REACH = 30;        // moles stop this far from the food's centre (× critter scale) to eat: nose at the food's edge

  // Range of a still throw (flat ground at GRASS_Y), analytic.
  function flightTime() {
    const a = 0.5 * GRAVITY, b = HAMMER_VY, c = HAND_Y - GRASS_Y;
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  }

  // ---------- Core ----------
  function createGame(opts) {
    opts = opts || {};
    const rand = opts.rand || Math.random;
    const world = { W: 711, H };
    const rr = (a, b) => a + rand() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    let state, score, level, foodLeft, gx, gvx, facing, cooldown, spawnT, foodTimers, overT, playT;
    // Critter scale: moles, food and their effects are drawn (and hit-tested) this much bigger.
    // The shell raises it on small (phone) screens so they stay visible and cute.
    let critK = 1;
    let aimVx = 0;               // smoothed gondola speed (see AIM_SMOOTH)
    const moleW = () => MOLE_W * critK, moleH = () => MOLE_H * critK;
    let hammers, moles, foods, events = [];
    // visual-only state (animation timers, effects); never read by the rules
    let animT = 0, poseClock = 99, cheerT = 0, lostT = 0, banner = null, puffs = [], popups = [];
    function emit(e) {
      events.push(e);
      if (e.type === 'throw') poseClock = 0;
      else if (e.type === 'hit') popups.push({ x: e.x, t: 0 });
      else if (e.type === 'ground' || e.type === 'emerge') puffs.push({ x: e.x, t: 0 });
      else if (e.type === 'eat') { puffs.push({ x: e.x, t: 0 }); lostT = 0.8; }
      else if (e.type === 'levelUp') { banner = { t: 0, level: e.level }; cheerT = 1.8; }
    }
    const markerOf = () => {
      const dir = facing === 'left' ? -1 : 1;
      return gx + dir * HAND_DX + (dir * HAMMER_VX + aimVx) * flightTime();
    };

    function reset() {
      state = 'ready'; score = 0; level = 1; foodLeft = FOODS_TO_LOSE;
      gx = world.W / 2; gvx = 0; aimVx = 0; facing = 'right'; cooldown = 0; overT = 0; playT = 0;
      spawnT = FIRST_SPAWN; foodTimers = [];
      hammers = []; moles = []; foods = []; events = [];
      g.newBest = false;
      poseClock = 99; cheerT = 0; lostT = 0; banner = null; puffs = []; popups = [];
    }

    function resize(aspect) {
      const a = Math.min(2.6, Math.max(1.3, aspect || 1.78));
      world.W = Math.round(H * a);
      gx = clamp(gx, GONDOLA_W / 2, world.W - GONDOLA_W / 2);
      for (const m of moles) m.x = clamp(m.x, moleW() / 2, world.W - moleW() / 2);
      for (const f of foods) f.x = clamp(f.x, FOOD_MARGIN * 0.5, world.W - FOOD_MARGIN * 0.5);
    }

    function start() {
      reset();
      state = 'playing';
      spawnFood();
    }

    // ----- food -----
    function desiredFoods() { return level >= TWO_FOOD_LEVEL ? 2 : 1; }
    function spawnFood() {
      const W = world.W;
      let x = rr(FOOD_MARGIN, W - FOOD_MARGIN);
      for (let i = 0; i < 30; i++) {
        const c = rr(FOOD_MARGIN, W - FOOD_MARGIN);
        x = c;
        if (foods.every((f) => Math.abs(f.x - c) >= FOOD_MIN_GAP)) break;
      }
      const kind = FOOD_KINDS[Math.floor(rand() * FOOD_KINDS.length) % FOOD_KINDS.length];
      const f = { x, y: GRASS_Y, kind, age: 0 };
      foods.push(f);
      emit({ type: 'foodSpawn', x, kind });
    }
    function updateFoods(dt) {
      for (const f of foods) f.age += dt;
      // keep the right number of foods (existing + pending)
      while (foods.length + foodTimers.length < desiredFoods() && foodLeft > 0) foodTimers.push(FOOD_RESPAWN);
      for (let i = foodTimers.length - 1; i >= 0; i--) {
        foodTimers[i] -= dt;
        if (foodTimers[i] <= 0) { foodTimers.splice(i, 1); spawnFood(); }
      }
    }
    function nearestFood(x) {
      let best = null;
      for (const f of foods) if (!best || Math.abs(f.x - x) < Math.abs(best.x - x)) best = f;
      return best;
    }

    // ----- moles -----
    function interval() { return Math.max(SPAWN_MIN, SPAWN_BASE * Math.pow(SPAWN_FACTOR, level - 1)); }
    function moleSpeed() { return Math.min(SPEED_MAX, MOLE_SPEED * Math.pow(SPEED_FACTOR, level - 1)); }

    function spawnMole() {
      if (!foods.length) return false;
      const W = world.W;
      const food = foods.length > 1 ? foods[Math.floor(rand() * foods.length) % foods.length] : foods[0];
      const lo = moleW() / 2, hi = W - moleW() / 2;
      let x = null;
      for (let i = 0; i < 20 && x === null; i++) {
        const c = rr(lo, hi);
        if (Math.abs(c - food.x) >= MOLE_FAR * W) x = c;
      }
      if (x === null) x = food.x < W / 2 ? hi - 20 : lo + 20;
      const m = {
        x, state: 'emerge', t: 0, dir: x < food.x ? -1 : 1, food,
        speed: moleSpeed() * rr(0.92, 1.08), depth: 0, id: ++moleId,
      };
      moles.push(m);
      emit({ type: 'emerge', x });
      return true;
    }
    let moleId = 0;

    const HITTABLE = { away: 1, turn: 1, toFood: 1, eat: 1 };
    function moleBox(m) {
      return { x0: m.x - moleW() / 2, x1: m.x + moleW() / 2, y0: GRASS_Y - moleH(), y1: GRASS_Y + 4 };
    }

    function dive(m) { m.state = 'dive'; m.t = 0; }
    function retarget(m) {
      const f = nearestFood(m.x);
      if (f) { m.food = f; return true; }
      return false;
    }

    function updateMole(m, dt) {
      m.t += dt;
      const W = world.W, lo = moleW() / 2, hi = W - moleW() / 2;
      switch (m.state) {
        case 'emerge':
          m.depth = Math.min(1, m.t / MOLE_EMERGE);
          if (m.t >= MOLE_EMERGE) { m.state = 'away'; m.t = 0; m.depth = 1; }
          return;
        case 'bonk':
          if (m.t >= MOLE_BONK) dive(m);
          return;
        case 'dive':
          m.depth = Math.max(0, 1 - m.t / MOLE_DIVE);
          if (m.t >= MOLE_DIVE) m.dead = true;
          return;
      }
      // moving / eating states: the food may be gone
      if (!foods.includes(m.food) && !retarget(m)) { dive(m); return; }
      if (m.state === 'away') {
        m.x += m.dir * m.speed * dt;
        if (m.x <= lo || m.x >= hi) {
          m.x = clamp(m.x, lo, hi); m.state = 'turn'; m.t = 0;
        }
      } else if (m.state === 'turn') {
        if (m.t >= MOLE_TURN) { m.state = 'toFood'; m.t = 0; }
      } else if (m.state === 'toFood') {
        const d = m.food.x - m.x;
        m.dir = d < 0 ? -1 : 1;
        const step = m.speed * dt;
        const reach = EAT_REACH * critK;
        if (Math.abs(d) - reach <= step) { m.x = m.food.x - m.dir * reach; m.state = 'eat'; m.t = 0; }
        else m.x += m.dir * step;
      } else if (m.state === 'eat') {
        if (m.t >= MOLE_EAT) {
          const f = m.food;
          foods.splice(foods.indexOf(f), 1);
          foodLeft--;
          emit({ type: 'eat', x: f.x, kind: f.kind });
          dive(m);
          if (foodLeft <= 0) gameOver();
        }
      }
    }

    // ----- hammers -----
    function throwHammer() {
      const dir = facing === 'left' ? -1 : 1;
      hammers.push({
        x: gx + dir * HAND_DX, y: HAND_Y,
        vx: dir * HAMMER_VX + aimVx, vy: HAMMER_VY, angle: 0, dir,
        landX: markerOf(),   // where it will land: drawn as its own marker while it flies
      });
      cooldown = THROW_COOLDOWN;
      emit({ type: 'throw', x: gx, dir });
    }

    function stepHammers(dt) {
      for (const h of hammers) {
        h.vy += GRAVITY * dt;
        h.x += h.vx * dt; h.y += h.vy * dt;
        h.angle += h.dir * HAMMER_SPIN * dt;
        // mole hit?
        for (const m of moles) {
          if (!HITTABLE[m.state]) continue;
          const b = moleBox(m);
          const cx = clamp(h.x, b.x0, b.x1), cy = clamp(h.y, b.y0, b.y1);
          if ((h.x - cx) * (h.x - cx) + (h.y - cy) * (h.y - cy) <= HAMMER_R * HAMMER_R) {
            h.done = true;
            m.state = 'bonk'; m.t = 0;
            score += MOLE_POINTS;
            emit({ type: 'hit', x: m.x, y: GRASS_Y - moleH(), points: MOLE_POINTS });
            checkLevel();
            break;
          }
        }
        if (h.done) continue;
        if (h.y >= GRASS_Y) { h.done = true; emit({ type: 'ground', x: h.x, y: GRASS_Y }); }
        else if (h.x < -30 || h.x > world.W + 30) h.done = true;
      }
      hammers = hammers.filter((h) => !h.done);
    }

    function checkLevel() {
      const lv = 1 + Math.floor(score / LEVEL_POINTS);
      while (level < lv) { level++; emit({ type: 'levelUp', level }); }
    }

    function gameOver() {
      if (state === 'gameover') return;
      state = 'gameover'; overT = 0;
      if (score > g.best) { g.best = score; g.newBest = true; }
      emit({ type: 'gameover', score });
    }

    // ----- update -----
    function update(dt, input) {
      dt = Math.min(dt, 0.1);
      input = input || {};
      animT += dt; poseClock += dt; cheerT -= dt; lostT -= dt;
      if (banner && (banner.t += dt) > 2) banner = null;
      for (const p of puffs) p.t += dt;
      for (const p of popups) p.t += dt;
      puffs = puffs.filter((p) => p.t < 0.4);
      popups = popups.filter((p) => p.t < 1.2);
      if (state === 'gameover') {
        overT += dt;
        for (const m of moles) updateMole(m, dt);   // moles finish their animation (food gone, they dive)
        moles = moles.filter((m) => !m.dead);
        return;
      }
      if (state !== 'playing') return;
      // sub-step so fast hammers never tunnel through a mole
      const n = Math.max(1, Math.ceil(dt / (1 / 60)));
      for (let i = 0; i < n; i++) step(dt / n, input, i === 0 && !!input.throw);
    }

    function step(dt, input, wantThrow) {
      playT += dt;
      // throw first, from the state that was on screen, so the hammer lands exactly on the marker the player saw
      cooldown = Math.max(0, cooldown - dt);
      if (wantThrow && cooldown <= 0 && hammers.length < MAX_HAMMERS) throwHammer();
      // gondola
      const oldX = gx;
      let vx = 0;
      if (input.left) vx -= GONDOLA_SPEED;
      if (input.right) vx += GONDOLA_SPEED;
      if (vx === 0 && typeof input.targetX === 'number') {
        vx = clamp((input.targetX - gx) * GONDOLA_EASE, -GONDOLA_TOUCH_MAX, GONDOLA_TOUCH_MAX);
      }
      gx = clamp(gx + vx * dt, GONDOLA_W / 2, world.W - GONDOLA_W / 2);
      gvx = (gx - oldX) / dt;
      aimVx += (gvx - aimVx) * Math.min(1, dt / AIM_SMOOTH);
      if (gvx > FACING_DEADZONE) facing = 'right'; else if (gvx < -FACING_DEADZONE) facing = 'left';

      // spawning
      spawnT -= dt;
      if (spawnT <= 0) { if (spawnMole()) spawnT += interval(); else spawnT = 0.2; }

      stepHammers(dt);
      for (const m of moles) updateMole(m, dt);
      moles = moles.filter((m) => !m.dead);
      if (state === 'playing') updateFoods(dt);
    }

    // ---------- Render (sprites) ----------
    // images: map of loaded <img>/canvas by key (built by the shell, see index.html); scale = canvas px per world unit.
    // Keys: oli-<pose><facing>, hammer, trail, marker, cable, pylon, popup, banner<n>, mountains, sea, town, sun, boat,
    // grass, mole-<frame>, puff0-2, stars0-5, food-<kind>, eaten-<kind>.
    const S = 0.46, MS = 0.5, FS = FOOD_DRAW, HS = 0.44;
    const MOLE_VB = { x: -60, y: -80, w: 120, h: 80 };
    const OLI_VB = { x: -24, y: -72, w: 248, h: 288 }, OLI_ANCHOR = { x: 100, y: -40 };
    const PYLON_UNITS = Math.round((GRASS_Y - CABLE_Y) / S);
    const FOOD_DEF = { w: 60, h: 80 };
    function render(ctx, images, scale) {
      const W = world.W;
      const im = (k, x, y, w, h) => { const i = images[k]; if (i) ctx.drawImage(i, x, y, w, h); };
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const sky = (images.sky || { top: '#8fd3ff', bottom: '#d9f3ff' });
      const gr = ctx.createLinearGradient(0, 0, 0, GRASS_Y);
      gr.addColorStop(0, sky.top); gr.addColorStop(1, sky.bottom);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      im('sun', W * 0.8 - 45, 70, 90, 90);
      const tileH = (k, y, tw, th, off) => {
        if (!images[k]) return;
        for (let x = -(((off % tw) + tw) % tw); x < W; x += tw) ctx.drawImage(images[k], x, y, tw + 0.6, th);
      };
      tileH('mountains', 168, 480, 112, animT * 2);
      ctx.fillStyle = '#6FC1E8'; ctx.fillRect(0, 282, W, 80);
      im('town', 14, 206, 212, 80);
      tileH('sea', 276, 400, 48, animT * 14);
      const bx = ((animT * 12) % (W + 120)) - 60; im('boat', W - bx - 20, 284, 34, 28);
      // pylons + cable
      for (const px of [30, W - 30]) im('pylon', px - 60 * S, CABLE_Y - 30 * S, 120 * S, (PYLON_UNITS + 30) * S);
      const cw = 120 * S, ch = 16 * S;
      for (let x = 30; x < W - 30; x += cw) im('cable', x, CABLE_Y - 8 * S, Math.min(cw, W - 30 - x) + 0.6, ch);
      // grass (the tile ends a few units above the bottom edge; fill the rest with soil)
      ctx.fillStyle = '#8A5E3A'; ctx.fillRect(0, GRASS_Y + 40, W, H - GRASS_Y - 40);
      for (let x = 0; x < W; x += 400) im('grass', x, GRASS_Y - 16, 400.6, 60);
      // food
      for (const f of foods) {
        const vb = (images.foodVB && images.foodVB[f.kind]) || FOOD_DEF;
        const eating = moles.some((m) => m.food === f && m.state === 'eat');
        const u = Math.min(1, f.age / 0.25), pop = u < 1 ? 1 + 0.25 * Math.sin(u * Math.PI) : 1;
        const w = vb.w * FS * critK * u * pop, h = vb.h * FS * critK * u * pop;
        im((eating ? 'eaten-' : 'food-') + f.kind, f.x - w / 2, GRASS_Y - h, w, h);
      }
      // landing marker
      // landing markers: one (solid) under each flying hammer's real landing spot, one (faint) for the next throw
      const mark = (mx, alpha) => {
        if (mx < 10 || mx > W - 10) return;
        ctx.globalAlpha = alpha; im('marker', mx - 20 * critK, GRASS_Y - 7 * critK, 40 * critK, 14 * critK); ctx.globalAlpha = 1;
      };
      if (state === 'playing') { for (const h of hammers) mark(h.landX, 1); mark(markerOf(), hammers.length ? 0.55 : 1); }
      // moles
      for (const m of moles) {
        let frame = 'walk1';
        const a = Math.floor((animT + m.id * 0.07) / 0.16) % 2;
        if (m.state === 'emerge') frame = 'emerge';
        else if (m.state === 'away' || m.state === 'toFood') frame = a ? 'walk2' : 'walk1';
        else if (m.state === 'turn') frame = 'turn';
        else if (m.state === 'eat') frame = Math.floor((animT + m.id * 0.07) / 0.25) % 2 ? 'eat2' : 'eat1';
        else if (m.state === 'bonk') frame = 'bonk';
        else if (m.state === 'dive') frame = 'dive';
        const i = images['mole-' + frame];
        if (i) {
          ctx.save(); ctx.translate(m.x, GRASS_Y); if (m.dir < 0) ctx.scale(-1, 1);
          const ms = MS * critK;
          ctx.drawImage(i, MOLE_VB.x * ms, MOLE_VB.y * ms, MOLE_VB.w * ms, MOLE_VB.h * ms); ctx.restore();
        }
        const k = critK;
        if (m.state === 'bonk') im('stars' + (Math.floor(m.t * 8) % 6), m.x - 17 * k + m.dir * 6 * k, GRASS_Y - 44 * k, 34 * k, 14 * k);
        if (m.state === 'dive' && m.t < 0.36) im('puff' + Math.min(2, Math.floor(m.t / 0.12)), m.x - 25 * k, GRASS_Y - 32 * k, 50 * k, 32 * k);
      }
      for (const p of puffs) im('puff' + Math.min(2, Math.floor(p.t / 0.12)), p.x - 25 * critK, GRASS_Y - 32 * critK, 50 * critK, 32 * critK);
      // hammers
      const hs = 112 * HS;
      for (const h of hammers) {
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.angle);
        if (h.dir < 0) ctx.scale(-1, 1);
        im('trail', -hs / 2, -hs / 2, hs, hs); ctx.restore();
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.angle);
        im('hammer', -hs / 2, -hs / 2, hs, hs); ctx.restore();
      }
      // Oli in the gondola (on the title screen he drifts along the cable)
      let ox = gx, face = facing, pose = 'idle';
      if (state === 'ready') { ox = W / 2 + Math.sin(animT * 0.6) * W * 0.28; face = Math.cos(animT * 0.6) >= 0 ? 'right' : 'left'; }
      else if (state === 'gameover') pose = 'sad';
      else if (cheerT > 0) pose = 'cheer';
      else if (poseClock < 0.25) pose = 'throw';
      else if (poseClock < 0.35) pose = 'windup';
      const bob = state === 'ready' ? Math.sin(animT * 2.4) * 2 : 0;
      im('oli-' + pose + face, ox - (OLI_ANCHOR.x - OLI_VB.x) * S, CABLE_Y - (OLI_ANCHOR.y - OLI_VB.y) * S + bob, OLI_VB.w * S, OLI_VB.h * S);
      // "+100" popups and the level banner
      for (const p of popups) {
        const u = p.t / 1.2, s = u < 0.2 ? 0.3 + u / 0.2 * 0.7 : 1, w = 110 * s, h = 65 * s;
        ctx.globalAlpha = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
        im('popup', p.x - w / 2, GRASS_Y - 36 * critK - u * 44 - h - 6, w, h); ctx.globalAlpha = 1;
      }
      if (banner) {
        const u = banner.t, s = u < 0.3 ? u / 0.3 : 1, w = 220 * s, h = w * 130 / 300;
        ctx.globalAlpha = u > 1.6 ? Math.max(0, 1 - (u - 1.6) / 0.4) : 1;
        im('banner' + banner.level, W / 2 - w / 2, 140 - h / 2, w, h); ctx.globalAlpha = 1;
      }
    }
    const g = {
      world, resize, start, reset, update, render,
      setCritterScale(k) { critK = Math.max(0.5, Math.min(2, +k || 1)); },
      get critterScale() { return critK; },
      best: opts.best || 0, newBest: false,
      get state() { return state; },
      get score() { return score; },
      get level() { return level; },
      get foodLeft() { return foodLeft; },
      get facing() { return facing; },
      get lostT() { return lostT; },
      get events() { const e = events; events = []; return e; },
      // test/debug access
      get gondola() { return { x: gx, vx: gvx, facing, cooldown, w: GONDOLA_W, handY: HAND_Y }; },
      get hammers() { return hammers; },
      get moles() { return moles; },
      get foods() { return foods; },
      get markerX() { return markerOf(); },
      get spawnInterval() { return interval(); },
      get moleSpeed() { return moleSpeed(); },
      CONST: { H, CABLE_Y, GRASS_Y, MOLE_W, MOLE_H, MOLE_EMERGE, MOLE_EAT, MOLE_BONK, MOLE_DIVE, MOLE_TURN, MOLE_POINTS,
        LEVEL_POINTS, THROW_COOLDOWN, MAX_HAMMERS, FOOD_RESPAWN, HAMMER_R, launchRange: HAMMER_VX * flightTime() },
    };
    reset();
    return g;
  }

  const api = { createGame };
  if (typeof window !== 'undefined') window.WhackAMOli = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // ---------- Browser shell ----------
  if (typeof document === 'undefined') return;
  const A = window.WAMAssets, F = window.WAMField;
  if (!A || !F) return;

  const BEST_KEY = 'whackamoli:best', MUTE_KEY = 'whackamoli:mute';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const readBest = () => Math.max(0, parseInt(store.get(BEST_KEY), 10) || 0);
  const $ = (id) => document.getElementById(id);
  const MAX_ASPECT = 2.1;          // world width is capped at ~840 units (letterbox beyond that)
  const OVER_DELAY = 0.5, OVER_LOCK = 700;

  const canvas = $('game'), ctx = canvas.getContext('2d');
  const game = createGame({ best: readBest() });
  const images = { sky: A.background.sky };
  let phase = 'loading';           // loading | title | playing | paused | over
  let scale = 1, aspectUsed = 0;
  let overT = 0, overShownAt = 0;
  const keys = { left: false, right: false, space: false };
  let tapBuf = 0, targetX;
  let pausedBy = '';

  // ----- images -----
  function load(key, svg, lib) {
    return new Promise((res) => {
      const i = new Image();
      i.onload = () => { images[key] = i; res(); };
      i.onerror = () => res();
      i.src = lib.toDataUrl(svg);
    });
  }
  function ensureBanner(n) { if (!images['banner' + n]) load('banner' + n, A.levelBanner(n), A); }
  function loadAll() {
    const jobs = [];
    for (const p of A.oliPoses) for (const f of ['left', 'right']) jobs.push(load('oli-' + p + f, A.oli(p, f), A));
    jobs.push(load('hammer', A.hammer(), A), load('trail', A.hammerTrail(), A), load('marker', A.marker(), A));
    jobs.push(load('cable', A.cable(), A), load('pylon', A.pylon(Math.round((game.CONST.GRASS_Y - game.CONST.CABLE_Y) / A.oliScale)), A));
    jobs.push(load('popup', A.scorePopup(), A));
    for (let n = 2; n <= 12; n++) jobs.push(load('banner' + n, A.levelBanner(n), A));
    const bg = A.background;
    jobs.push(load('mountains', bg.mountains(), A), load('sea', bg.sea(), A), load('town', bg.oldTown(), A),
      load('sun', bg.sun(), A), load('boat', bg.boat(), A));
    jobs.push(load('grass', F.grass(), F));
    for (const f of F.moleFrames) jobs.push(load('mole-' + f, F.mole(f), F));
    for (let i = 0; i < 3; i++) jobs.push(load('puff' + i, F.dirtPuff(i), F));
    for (let i = 0; i < 6; i++) jobs.push(load('stars' + i, F.dizzyStars(i * Math.PI / 3), F));
    images.foodVB = {};
    for (const k of F.foodKinds) {
      images.foodVB[k] = F.foodViewBox(k);
      jobs.push(load('food-' + k, F.food(k), F), load('eaten-' + k, F.foodEaten(k), F));
    }
    return Promise.all(jobs);
  }

  // ----- sizing -----
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const aspect = Math.max(1.3, Math.min(MAX_ASPECT, vw / vh));
    if (aspect !== aspectUsed) { aspectUsed = aspect; game.resize(aspect); }
    // Phones (short screens): bigger moles and food so they stay visible and cute.
    // 800px tall -> 1, 390px (phone landscape) -> 1.5, 320px and below -> 1.7.
    game.setCritterScale(Math.max(1, Math.min(1.7, 1 + (520 - vh) / 260)));
    const W = game.world.W, H = game.world.H;
    const cssW = Math.min(vw, vh * W / H), cssH = cssW * H / W;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.style.left = (vw - cssW) / 2 + 'px'; canvas.style.top = (vh - cssH) / 2 + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    scale = cssH / H;
    const portrait = vh > vw;
    $('rotate').classList.toggle('show', portrait);
    if (portrait && phase === 'playing') pause('rotate');
  }

  // ----- screens -----
  function setPhase(p) {
    phase = p;
    document.body.dataset.phase = p;
    $('splash').hidden = p !== 'title' && p !== 'loading';
    $('hud').classList.toggle('show', p === 'playing' || p === 'paused');
    $('pause').hidden = p !== 'paused';
    $('over').classList.toggle('show', false);
  }
  function showTitle() {
    setPhase('title');
    const b = game.best;
    $('splashBest').textContent = b > 0 ? 'Best: ' + b : '';
    $('resetRow').hidden = b <= 0;
    resetAsk(false);
  }
  function play() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    keys.left = keys.right = keys.space = false; tapBuf = 0; targetX = undefined;
    game.start();
    syncHud(true);
    setPhase('playing');
    if (window.WAMAudio && WAMAudio.play) WAMAudio.play('start');
  }
  function pause(why) {
    if (phase !== 'playing') return;
    pausedBy = why || '';
    keys.left = keys.right = keys.space = false;
    setPhase('paused');
  }
  function resume() {
    if (phase !== 'paused' || $('rotate').classList.contains('show')) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    setPhase('playing');
  }
  function showOver() {
    $('overScore').textContent = game.score;
    $('overBest').textContent = 'Best ' + game.best;
    $('overNew').hidden = !game.newBest;
    $('over').classList.add('show');
    overShownAt = performance.now();
  }
  function againOk() { return phase === 'over' && $('over').classList.contains('show') && performance.now() - overShownAt > OVER_LOCK; }

  function resetAsk(on) { $('resetBtn').hidden = on; $('resetSure').hidden = !on; }

  // ----- HUD -----
  const lifeImgs = [];
  let lastLeft = -1, lastScore = -1, lastLevel = -1;
  function buildHud() {
    const url = (eaten) => F.toDataUrl(F.foodIcon('carrot', eaten));
    const row = $('lives');
    window.__lifeUrl = [url(false), url(true)];
    for (let i = 0; i < 5; i++) { const im = new Image(); im.alt = ''; im.src = window.__lifeUrl[0]; row.appendChild(im); lifeImgs.push(im); }
    $('avatarSlot').innerHTML = A.kidFace();
    $('avatarSlot').classList.add('filled');
    $('splashFace').innerHTML = A.kidFace();
  }
  function syncHud(force) {
    if (force || game.score !== lastScore) {
      $('score').textContent = game.score;
      if (!force) { const el = $('score'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
      lastScore = game.score;
    }
    if (force || game.level !== lastLevel) { $('level').textContent = 'Level ' + game.level; lastLevel = game.level; }
    const left = game.foodLeft;
    if (force || left !== lastLeft) {
      for (let i = 0; i < lifeImgs.length; i++) {
        const lost = i >= left;
        lifeImgs[i].src = window.__lifeUrl[lost ? 1 : 0];
        lifeImgs[i].classList.remove('pop');
        if (!force && lost && i === left) { void lifeImgs[i].offsetWidth; lifeImgs[i].classList.add('pop'); }
      }
      lastLeft = left;
    }
  }

  // ----- sound hook (audio.js is optional) -----
  const hasAudio = () => !!(window.WAMAudio && typeof WAMAudio.play === 'function');
  let muted = store.get(MUTE_KEY) === '1';
  function applyMute() {
    if (window.WAMAudio) { try { if (WAMAudio.setMuted) WAMAudio.setMuted(muted); else WAMAudio.muted = muted; } catch (e) { /* ignore */ } }
    $('mute').textContent = muted ? '🔇' : '🔊';
    $('mute').setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
  }

  function handleEvents() {
    for (const e of game.events) {
      if (hasAudio() && !muted) { try { WAMAudio.play(e.type, e); } catch (err) { /* ignore */ } }
      if (e.type === 'levelUp') ensureBanner(e.level + 1);
      if (e.type === 'gameover') {
        if (game.newBest) store.set(BEST_KEY, String(game.best));
        phase = 'over'; document.body.dataset.phase = 'over'; overT = 0;
        keys.left = keys.right = keys.space = false;
      }
    }
  }

  // ----- input -----
  function onKeyDown(e) {
    const k = e.key;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === ' ' || k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') e.preventDefault();
    if (phase === 'title') { if ((k === 'Enter' || k === ' ') && !e.repeat) play(); return; }
    if (phase === 'over') { if ((k === 'Enter' || k === ' ') && !e.repeat && againOk()) play(); return; }
    if (phase === 'paused') { if ((k === 'p' || k === 'P' || k === 'Escape' || k === 'Enter' || k === ' ') && !e.repeat) resume(); return; }
    if (phase !== 'playing') return;
    if (k === 'p' || k === 'P' || k === 'Escape') { if (!e.repeat) pause('key'); return; }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; targetX = undefined; }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; targetX = undefined; }
    else if (k === ' ') keys.space = true;
  }
  function onKeyUp(e) {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
    else if (k === ' ') keys.space = false;
  }
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (phase !== 'playing' || drag) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    drag = { id: e.pointerId, x0: e.clientX, gx0: game.gondola.x, moved: 0, t0: performance.now() };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || phase !== 'playing') return;
    const dx = e.clientX - drag.x0;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    if (drag.moved >= 10) targetX = drag.gx0 + dx / scale;
  });
  const endDrag = (e, cancel) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!cancel && phase === 'playing' && drag.moved < 10 && performance.now() - drag.t0 < 400) tapBuf = 0.15;
    drag = null;
  };
  canvas.addEventListener('pointerup', (e) => endDrag(e, false));
  canvas.addEventListener('pointercancel', (e) => endDrag(e, true));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ----- loop -----
  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
    if (phase === 'playing') {
      tapBuf = Math.max(0, tapBuf - dt);
      const input = { left: keys.left, right: keys.right, throw: keys.space || tapBuf > 0 };
      if (typeof targetX === 'number') input.targetX = targetX;
      game.update(dt, input);
      if (input.throw && game.gondola.cooldown > 0) tapBuf = 0;
      handleEvents();
      if (phase === 'playing') syncHud(false);
    } else if (phase === 'over') {
      game.update(dt, {}); handleEvents(); syncHud(false);
      overT += dt;
      if (overT >= OVER_DELAY && !$('over').classList.contains('show')) showOver();
    } else if (phase === 'title' || phase === 'loading') {
      game.update(dt, {});
    }
    if (phase !== 'loading') game.render(ctx, images, canvas.width / game.world.W);
    requestAnimationFrame(frame);
  }

  function checkPause() { if (document.hidden) pause('hidden'); }

  // ----- boot -----
  $('playBtn').addEventListener('click', play);
  $('againBtn').addEventListener('click', () => { if (againOk()) play(); });
  $('resumeBtn').addEventListener('click', resume);
  $('pauseBtn').addEventListener('click', () => pause('button'));
  $('resetBtn').addEventListener('click', () => resetAsk(true));
  $('resetNo').addEventListener('click', () => resetAsk(false));
  $('resetYes').addEventListener('click', () => { store.del(BEST_KEY); game.best = 0; showTitle(); });
  $('mute').addEventListener('click', () => { muted = !muted; store.set(MUTE_KEY, muted ? '1' : '0'); applyMute(); });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => { keys.left = keys.right = keys.space = false; });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));
  document.addEventListener('visibilitychange', checkPause);

  const coarse = !!(window.matchMedia && matchMedia('(any-pointer: coarse)').matches);
  $('howKeys').hidden = coarse; $('howTouch').hidden = !coarse;
  $('mute').hidden = !hasAudio();
  applyMute();
  buildHud();
  setPhase('loading');
  resize();
  requestAnimationFrame(frame);
  loadAll().then(() => {
    $('playBtn').disabled = false;
    showTitle();
    resize();
  });
  window.__wam = { game, images, get phase() { return phase; } };
})();
