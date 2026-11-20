/* Taekwondo Master — CPU opponent. window.TKDCpu / module.exports = { belts, createCpu }.
 *
 * createCpu(beltIndex, rand = Math.random) -> { params, update(dt, fight, me) }
 *   update returns an input object { left, right, up, down, backPunch, frontPunch, backKick, frontKick }
 *   for fighter index `me`. Attack keys are press edges (true for one frame only), movement keys are held.
 *   The CPU only reads fight state (positions, actions, moves, phases). The opponent is perceived through a
 *   short history buffer, `reactionMs` late. The shell should set fighters[me].speedMul = cpu.params.speedMul
 *   (the core applies it to walk + attack speed).
 *
 * belts[i] = { name, reactionMs, blockChance, blockRightHeight, accuracy, aggression, comboChance, spinChance,
 *   speedMul }  (PLAN table, linear White -> Black; combos start at Green, spins at Orange) plus extras:
 *   preferredDist   distance (units) the CPU likes to stand at while waiting
 *   punishChance    chance to counter-attack an opponent in recovery / an airborne opponent
 *   jumpChance      chance per attack decision to jump in (up + forward, then attack in the air)
 *   duckChance      against HIGH attacks, chance to duck (dodge) instead of block standing
 *   lowDefence      chance to jump a LOW attack instead of duck-blocking it
 *   smartLevel      chance to pick the attack level that suits the opponent's stance
 */
(function (root) {
  'use strict';

  const M = (typeof module !== 'undefined' && module.exports) ? require('./moves.js') : root.TKDMoves;
  const NAMES = ['White', 'Yellow', 'Orange', 'Green', 'Purple', 'Blue', 'Red', 'Black'];
  const KEYS = { frontPunch: 'frontPunch', backPunch: 'backPunch', frontKick: 'frontKick', backKick: 'backKick' };
  const LIMBS = ['frontPunch', 'backPunch', 'frontKick', 'backKick'];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function r3(n) { return Math.round(n * 1000) / 1000; }

  const belts = NAMES.map(function (name, k) {
    const t = k / 7;
    return {
      name: name,
      reactionMs: Math.round(lerp(650, 150, t)),
      blockChance: r3(lerp(0.10, 0.75, t)),
      blockRightHeight: r3(lerp(0.50, 0.95, t)),
      accuracy: r3(lerp(0.35, 0.90, t)),
      aggression: r3(lerp(0.25, 0.70, t)),
      comboChance: k < 3 ? 0 : r3(0.5 * (k - 2) / 5),
      spinChance: k < 2 ? 0 : r3(0.3 * (k - 1) / 6),
      speedMul: r3(lerp(0.85, 1.10, t)),
      preferredDist: Math.round(lerp(260, 205, t)),
      punishChance: r3(lerp(0, 0.3, t)),
      jumpChance: k < 2 ? 0 : r3(lerp(0.02, 0.12, t)),
      duckChance: r3(lerp(0.2, 0.6, t)),
      lowDefence: k < 3 ? 0 : 0.3,
      smartLevel: r3(lerp(0.0, 0.85, t)),
    };
  });

  function createCpu(beltIndex, rand) {
    rand = rand || Math.random;
    const p = belts[Math.max(0, Math.min(7, beltIndex | 0))];
    const reactionS = p.reactionMs / 1000;
    let now = 0;
    const hist = [];
    let cd = 0.6 + rand();                 // time until next decision
    let intent = null;                     // { spec, trigger, expire, jump, jumpStarted }
    let queue = [];                        // combo follow-ups (specs)
    let guardUntil = 0, wasBlockstun = false, wasHit = false;
    let gap = 0;                           // short pause between combo moves
    let def = null;                        // { until, keys }
    let seenId = 0, lastMoveP = 1, lastMoveId = null, handled = 0, punishRolled = 0, airId = 0, wasAir = false;

    function snapOf(f) {
      return { t: now, x: f.x, y: f.y, action: f.action, move: f.move, moveId: f.moveId, phase: f.phase,
        moveP: f.moveP, ducking: f.ducking, blocking: f.blocking };
    }
    function perceive() {
      const target = now - reactionS;
      let s = hist[0];
      for (let i = 0; i < hist.length && hist[i].t <= target; i++) s = hist[i];
      return s;
    }
    function specMove(s) { return M.moves[M.moveId(s.limb, s.variant, s.spin)]; }

    function chooseSpec(o, dist, forced) {
      let variant = 'stand';
      const smart = rand() < p.smartLevel;
      let limbs = LIMBS;
      if (smart && o.y > 20) limbs = ['frontPunch', 'backPunch'];          // jumper: punch the face, low would miss
      else if (smart && o.ducking) limbs = ['frontKick', 'backKick'];       // duck dodges HIGH: body kick
      else if (smart && o.blocking && rand() < 0.7) variant = 'low';        // standing block: go low
      else if (rand() < 0.12) variant = 'low';
      if (forced && forced.variant) variant = forced.variant;
      const spin = !forced && dist > 170 && rand() < p.spinChance;
      const fit = limbs.filter(function (l) { return M.moves[M.moveId(l, variant, spin)].reach >= dist - 20; });
      const pool = fit.length ? fit : limbs;
      return { limb: pool[Math.floor(rand() * pool.length)], variant: variant, spin: spin };
    }

    function newIntent(o, dist) {
      const jump = rand() < p.jumpChance;
      const spec = chooseSpec(o, dist);
      if (jump) { spec.variant = 'stand'; spec.spin = false; }
      const reach = specMove(spec).reach;
      const careful = rand() < p.accuracy;
      const trigger = careful ? reach - 20 : reach + 5 + rand() * 40;
      return { spec: spec, trigger: trigger, expire: now + 2.2, jump: jump, jumpStarted: false };
    }

    function fire(out, spec, dirKey) {
      out[KEYS[spec.limb]] = true;
      if (spec.variant === 'low') out.down = true;
      if (spec.variant === 'jump') out.up = true;
      if (spec.spin) out[dirKey === 'right' ? 'left' : 'right'] = true; // back = away from the opponent
    }

    function pickDefence(m) {
      const right = rand() < p.blockRightHeight;
      if (m.level === 'HIGH') {
        if (!right) return {};
        return rand() < p.duckChance ? { down: true } : { back: true };
      }
      if (m.level === 'MID') return right ? (rand() < 0.3 ? { back: true, down: true } : { back: true }) : { down: true };
      // LOW
      if (!right) return { back: true };
      return rand() < p.lowDefence ? { up: true } : { back: true, down: true };
    }

    function update(dt, fight, me) {
      now += dt;
      const s = fight.fighters[me], opp = fight.fighters[1 - me];
      const out = { left: false, right: false, up: false, down: false, backPunch: false, frontPunch: false, backKick: false, frontKick: false };
      hist.push(snapOf(opp));
      while (hist.length > 2 && hist[1].t < now - 1.5) hist.shift();
      if (fight.state !== 'fighting') { intent = null; queue = []; def = null; return out; }
      const stunned = s.action === 'hit' || s.action === 'blockstun' || s.action === 'ko' || s.action === 'win' || s.action === 'defeat';
      if (s.action === 'hit') { intent = null; queue = []; def = null; }
      if (stunned) { wasBlockstun = s.action === 'blockstun'; wasHit = s.action === 'hit'; return out; }
      if (wasHit) { wasHit = false; if (rand() < p.blockChance * 0.35) guardUntil = now + 0.5 + 0.3 * rand(); }
      if (wasBlockstun) {                       // just came out of a blocked hit: counter at once
        wasBlockstun = false;
        const c = Math.abs(opp.x - s.x);
        if (rand() < p.punishChance && c <= M.moves.frontPunch_stand.reach) {
          intent = null; queue = []; guardUntil = 0;
          fire(out, { limb: 'frontPunch', variant: 'stand', spin: false }, opp.x >= s.x ? 'right' : 'left');
          return out;
        }
      }

      const o = perceive();
      const dir = (opp.x - s.x) >= 0 ? 1 : -1;
      const fwdKey = dir > 0 ? 'right' : 'left', backKey = dir > 0 ? 'left' : 'right';
      const dist = Math.abs(opp.x - s.x);   // footing is read live; only attacks are perceived late
      const airborne = s.y > 0;

      // new opponent attack seen (late)?
      const om = o.move;
      if (om) {
        if (o.moveId !== lastMoveId || o.moveP < lastMoveP - 1e-6) seenId++;
        lastMoveId = o.moveId; lastMoveP = o.moveP;
      } else { lastMoveId = null; lastMoveP = 1; }
      const oppAir = o.y > 25;
      if (oppAir && !wasAir) airId++;
      wasAir = oppAir;

      // --- defence ---
      if (om && seenId !== handled && o.phase !== 'recovery') {
        handled = seenId;
        const remaining = om.startup + om.active - o.moveP * om.total - reactionS;
        if (!s.move && remaining > -0.02 && dist <= om.reach + 30 && rand() < p.blockChance) {
          def = { until: now + Math.max(remaining, 0) + 0.1, keys: pickDefence(om) };
          intent = null; queue = [];
        }
      }
      if (def && now > def.until) def = null;
      if (def && !s.move) {
        const k = def.keys;
        if (k.back) out[backKey] = true;
        if (k.down) out.down = true;
        if (k.up) out.up = true;
        return out;
      }

      // --- finish the current move / combo ---
      if (s.move) return out;
      if (gap > 0) gap -= dt;
      if (queue.length && gap <= 0) {
        const spec = queue[0];
        if (dist <= specMove(spec).reach - 10) { queue.shift(); fire(out, spec, fwdKey); return out; }
        if (dist > specMove(spec).reach + 80 || rand() < dt) queue = []; // lost the opponent
        else { out[fwdKey] = true; return out; }
      }
      if (queue.length) return out;

      // --- punish recovery / anti-air ---
      if (!airborne) {
        if (om && o.phase === 'recovery' && punishRolled !== seenId) {
          punishRolled = seenId;
          const left = om.total - o.moveP * om.total - reactionS;
          if (rand() < p.punishChance) {
            let best = null;
            LIMBS.forEach(function (l) {
              const m = M.moves[M.moveId(l, o.blocking ? 'low' : 'stand', false)];
              if (m.reach >= dist && m.startup < left && (!best || m.startup < best.m.startup)) best = { l: l, m: m };
            });
            if (best) { fire(out, { limb: best.l, variant: o.blocking ? 'low' : 'stand', spin: false }, fwdKey); return out; }
          }
        }
        if (oppAir && o.phase !== 'recovery' && punishRolled !== -airId) {
          punishRolled = -airId;
          if (rand() < p.punishChance && dist < 200) {
            fire(out, { limb: rand() < 0.5 ? 'frontPunch' : 'backPunch', variant: 'stand', spin: false }, fwdKey);
            return out;
          }
        }
      }

      // --- offence ---
      cd -= dt;
      if (!intent && cd <= 0) {
        cd = (1.2 - p.aggression) * (0.7 + 0.6 * rand()) / p.speedMul;
        const close = dist < 230 ? 1 + 0.9 * (1 - beltIndex / 7) : 1;     // more eager when the opponent is already in range
        if (rand() < Math.min(0.95, p.aggression * close)) intent = newIntent(o, dist);
        else if (dist < 200 && rand() < p.blockChance * 0.35) guardUntil = now + 0.4 + 0.4 * rand();   // pre-emptive guard
      }
      if (!intent && now < guardUntil) { out[backKey] = true; return out; }
      if (intent) {
        if (now > intent.expire) intent = null;
        else if (intent.jump && !intent.jumpStarted) {
          if (!airborne) { out.up = true; out[fwdKey] = true; intent.jumpStarted = true; return out; }
        } else if (intent.jump && !airborne) intent = null;
        else if (dist <= intent.trigger) {
          const spec = intent.spec;
          fire(out, spec, fwdKey);
          if (spec.spin) { out.up = false; }
          if (!intent.jump && rand() < p.comboChance) {
            const n = rand() < 0.5 ? 1 : 2;
            for (let i = 0; i < n; i++) queue.push(chooseSpec(o, dist, { variant: 'stand' }));
            gap = 0.02 + 0.08 * rand();
          }
          intent = null;
          return out;
        } else { out[fwdKey] = true; return out; }
      }

      // --- spacing ---
      if (!airborne) {
        if (dist > p.preferredDist + 40) out[fwdKey] = true;
        else if (dist < p.preferredDist - 60 && !oppAir) out[backKey] = true;
      }
      return out;
    }

    return { params: p, update: update };
  }

  const api = { belts: belts, createCpu: createCpu };
  if (typeof window !== 'undefined') window.TKDCpu = api;
  else if (root) root.TKDCpu = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
