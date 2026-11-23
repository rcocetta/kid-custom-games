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
  const HAND_DX = 20;          // hammer starts this far in front of the gondola centre...
  const HAND_Y = CABLE_Y + 70; // ...at this height (Oli's hand)
  const HAMMER_VX = 100;       // throw speed along the facing direction (u/s), added to gondola velocity
  const HAMMER_VY = -180;      // initial vertical speed (negative = up); a soft lob
  const GRAVITY = 900;         // u/s^2  -> still throw lands ~116 units ahead (see launchRange)
  const HAMMER_SPIN = 14;      // rad/s
  const HAMMER_R = 13;         // hammer hit radius
  const THROW_COOLDOWN = 0.35; // s between throws
  const MAX_HAMMERS = 3;       // hammers in the air at once
  const MOLE_W = 50, MOLE_H = 40; // mole hit box size
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
    let hammers, moles, foods, events = [];
    const markerOf = () => {
      const dir = facing === 'left' ? -1 : 1;
      return gx + dir * HAND_DX + (dir * HAMMER_VX + gvx) * flightTime();
    };

    function reset() {
      state = 'ready'; score = 0; level = 1; foodLeft = FOODS_TO_LOSE;
      gx = world.W / 2; gvx = 0; facing = 'right'; cooldown = 0; overT = 0; playT = 0;
      spawnT = FIRST_SPAWN; foodTimers = [];
      hammers = []; moles = []; foods = []; events = [];
      g.newBest = false;
    }

    function resize(aspect) {
      const a = Math.min(2.6, Math.max(1.3, aspect || 1.78));
      world.W = Math.round(H * a);
      gx = clamp(gx, GONDOLA_W / 2, world.W - GONDOLA_W / 2);
      for (const m of moles) m.x = clamp(m.x, MOLE_W / 2, world.W - MOLE_W / 2);
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
      events.push({ type: 'foodSpawn', x, kind });
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
      const lo = MOLE_W / 2, hi = W - MOLE_W / 2;
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
      events.push({ type: 'emerge', x });
      return true;
    }
    let moleId = 0;

    const HITTABLE = { away: 1, turn: 1, toFood: 1, eat: 1 };
    function moleBox(m) {
      return { x0: m.x - MOLE_W / 2, x1: m.x + MOLE_W / 2, y0: GRASS_Y - MOLE_H, y1: GRASS_Y + 4 };
    }

    function dive(m) { m.state = 'dive'; m.t = 0; }
    function retarget(m) {
      const f = nearestFood(m.x);
      if (f) { m.food = f; return true; }
      return false;
    }

    function updateMole(m, dt) {
      m.t += dt;
      const W = world.W, lo = MOLE_W / 2, hi = W - MOLE_W / 2;
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
        if (Math.abs(d) <= step) { m.x = m.food.x; m.state = 'eat'; m.t = 0; }
        else m.x += m.dir * step;
      } else if (m.state === 'eat') {
        if (m.t >= MOLE_EAT) {
          const f = m.food;
          foods.splice(foods.indexOf(f), 1);
          foodLeft--;
          events.push({ type: 'eat', x: f.x, kind: f.kind });
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
        vx: dir * HAMMER_VX + gvx, vy: HAMMER_VY, angle: 0, dir,
      });
      cooldown = THROW_COOLDOWN;
      events.push({ type: 'throw', x: gx, dir });
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
            events.push({ type: 'hit', x: m.x, y: GRASS_Y - MOLE_H, points: MOLE_POINTS });
            checkLevel();
            break;
          }
        }
        if (h.done) continue;
        if (h.y >= GRASS_Y) { h.done = true; events.push({ type: 'ground', x: h.x, y: GRASS_Y }); }
        else if (h.x < -30 || h.x > world.W + 30) h.done = true;
      }
      hammers = hammers.filter((h) => !h.done);
    }

    function checkLevel() {
      const lv = 1 + Math.floor(score / LEVEL_POINTS);
      while (level < lv) { level++; events.push({ type: 'levelUp', level }); }
    }

    function gameOver() {
      if (state === 'gameover') return;
      state = 'gameover'; overT = 0;
      if (score > g.best) { g.best = score; g.newBest = true; }
      events.push({ type: 'gameover', score });
    }

    // ----- update -----
    function update(dt, input) {
      dt = Math.min(dt, 0.1);
      input = input || {};
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
      if (gx - oldX > 1e-6) facing = 'right'; else if (gx - oldX < -1e-6) facing = 'left';

      cooldown = Math.max(0, cooldown - dt);
      if (wantThrow && cooldown <= 0 && hammers.length < MAX_HAMMERS) throwHammer();

      // spawning
      spawnT -= dt;
      if (spawnT <= 0) { if (spawnMole()) spawnT += interval(); else spawnT = 0.2; }

      stepHammers(dt);
      for (const m of moles) updateMole(m, dt);
      moles = moles.filter((m) => !m.dead);
      if (state === 'playing') updateFoods(dt);
    }

    // ---------- Render (placeholder shapes; C2 swaps in sprites) ----------
    function drawSky(ctx) {
      ctx.fillStyle = '#9ad7ff'; ctx.fillRect(0, 0, world.W, GRASS_Y);
    }
    function drawGrass(ctx) {
      ctx.fillStyle = '#5cb85c'; ctx.fillRect(0, GRASS_Y, world.W, H - GRASS_Y);
      ctx.fillStyle = '#3f9a3f'; ctx.fillRect(0, GRASS_Y, world.W, 5);
    }
    function drawCable(ctx) {
      ctx.strokeStyle = '#2E2A36'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, CABLE_Y); ctx.lineTo(world.W, CABLE_Y); ctx.stroke();
    }
    function drawGondola(ctx) {
      ctx.strokeStyle = '#2E2A36'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(gx, CABLE_Y); ctx.lineTo(gx, CABLE_Y + 20); ctx.stroke();
      ctx.fillStyle = '#c0392b'; ctx.fillRect(gx - GONDOLA_W / 2, CABLE_Y + 50, GONDOLA_W, 40);
      ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(gx, CABLE_Y + 38, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2E2A36'; // facing marker
      const d = facing === 'left' ? -1 : 1;
      ctx.fillRect(gx + d * 20 - 3, CABLE_Y + 66, 6, 6);
    }
    function drawMarker(ctx) {
      if (state !== 'playing') return;
      const mx = markerOf();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(mx + i * 9, GRASS_Y + 8, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    function drawHammer(ctx, h) {
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.angle);
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-3, -14, 6, 28);
      ctx.fillStyle = '#7f8c8d'; ctx.fillRect(-12, -16, 24, 10);
      ctx.restore();
    }
    const MOLE_COLOR = {
      emerge: '#a0724a', away: '#8b5e3c', turn: '#d9a066', toFood: '#8b5e3c', eat: '#e67e22', bonk: '#f1c40f', dive: '#6e4a2e',
    };
    function drawMole(ctx, m) {
      const cy = GRASS_Y - (MOLE_H / 2) * m.depth + 2;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, world.W, GRASS_Y + 4); ctx.clip(); // hide the part still underground
      ctx.fillStyle = MOLE_COLOR[m.state] || '#8b5e3c';
      ctx.beginPath(); ctx.ellipse(m.x, cy + (MOLE_H / 2) * (1 - m.depth) + 0, MOLE_W / 2, MOLE_H / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#2E2A36';
      ctx.fillRect(m.x + m.dir * 10 - 2, cy - 8, 4, 4);
      if (m.state === 'bonk') {
        ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('* * *', m.x, GRASS_Y - MOLE_H - 6);
      }
    }
    const FOOD_COLOR = { carrot: '#f39c12', broccoli: '#27ae60', steak: '#c0392b' };
    function drawFood(ctx, f) {
      ctx.fillStyle = FOOD_COLOR[f.kind] || '#fff';
      ctx.beginPath(); ctx.arc(f.x, GRASS_Y - 12, 12, 0, Math.PI * 2); ctx.fill();
    }
    function drawHud(ctx) {
      ctx.fillStyle = '#2E2A36'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('Score ' + score + '   Level ' + level + '   Food ' + foodLeft + '   Best ' + g.best, 10, H - 12);
    }

    function render(ctx, images, scale) {
      void images; void scale;
      drawSky(ctx); drawCable(ctx); drawGrass(ctx);
      for (const f of foods) drawFood(ctx, f);
      drawMarker(ctx);
      for (const m of moles) drawMole(ctx, m);
      drawGondola(ctx);
      for (const h of hammers) drawHammer(ctx, h);
      drawHud(ctx);
    }

    const g = {
      world, resize, start, reset, update, render,
      best: opts.best || 0, newBest: false,
      get state() { return state; },
      get score() { return score; },
      get level() { return level; },
      get foodLeft() { return foodLeft; },
      get facing() { return facing; },
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
  // TODO (phase C2): input (keyboard + touch), canvas sizing, sprites via assets.js/field.js,
  // screens (title, HUD, pause, game over, rotate notice), localStorage (whackamoli:best / :mute), game loop.
  // Must only start when `typeof document !== 'undefined'`.
})();
