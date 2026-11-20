/* Taekwondo Master — game code.
 * Part 1: DOM-free core (createFight) — testable headless (node --test taekwondo/test/).
 * Part 2: browser shell (P6) — only starts when `document` exists. Not written yet.
 * Exposed as window.TKD = { createFight, Moves, ... } and module.exports.
 *
 * Fight object (read by the renderer/shell):
 *   state 'intro'|'fighting'|'roundOver'|'matchOver', stateT (s in this state), stateDur,
 *   round (1..), timeLeft (null in practice), roundWinner (0|1|-1 draw|null), roundReason ('ko'|'time'|'draw'),
 *   winner (match winner, set in matchOver), events[] (use drainEvents()), fighters[0|1].
 * Fighter: x, y (height above floor), vx, vy, facing (+1 right / -1 left), energy 0..100,
 *   action 'idle'|'walkFwd'|'duck'|'block'|'jump'|'attack'|'hit'|'blockstun'|'ko'|'win'|'defeat'
 *     ('block' = holding back, also while walking back: look at vx; 'walkBack' is not emitted),
 *   blockLevel 'stand'|'duck', blocking (bool), ducking (bool),
 *   moveId / move (table entry) / phase 'startup'|'active'|'recovery' / phaseT 0..1 / moveP 0..1 overall,
 *   roundsWon, hitsLanded (practice counter), speedMul (CPU difficulty: walk + attack speed).
 * Events: attack, whiff, hit, block {attacker, defender, move, level, damage, x, y};
 *   fight, roundStart {round}, ko {fighter}, timeUp, roundEnd {winner, reason, round, roundsWon}, matchEnd {winner}.
 */
(function (root) {
  'use strict';

  const M = (typeof module !== 'undefined' && module.exports) ? require('./moves.js') : root.TKDMoves;
  const T = M.tuning;
  const ATTACK_KEYS = ['backKick', 'frontKick', 'backPunch', 'frontPunch'];
  const LEVEL_Y = { HIGH: 250, MID: 170, LOW: 60 };
  const JUMP_V = 4 * T.jumpHeight / T.jumpDuration;
  const GRAVITY = 8 * T.jumpHeight / (T.jumpDuration * T.jumpDuration);

  function makeFighter(i) {
    return {
      index: i, x: 0, y: 0, vx: 0, vy: 0, facing: i === 0 ? 1 : -1, energy: 100,
      action: 'idle', blockLevel: 'stand', blocking: false, ducking: false,
      move: null, moveId: null, phase: null, phaseT: 0, moveP: 0, moveT: 0, hitDone: false,
      stunT: 0, kbT: 0, kbV: 0, roundsWon: 0, hitsLanded: 0, speedMul: 1,
      held: { fwd: false, back: false, up: false, down: false }, prevUp: false,
    };
  }

  function createFight(opts) {
    opts = opts || {};
    const practice = opts.mode === 'practice';
    const arena = Object.assign({}, T.defaultArena, opts.arena || {});
    const roundTime = opts.roundTime || 120;
    const f0 = makeFighter(0), f1 = makeFighter(1);
    const fight = {
      mode: practice ? 'practice' : 'tournament', practice: practice, arena: arena, rand: opts.rand || Math.random,
      roundTime: roundTime, state: 'intro', stateT: 0, stateDur: T.introTime, round: 1,
      timeLeft: practice ? null : roundTime, roundWinner: null, roundReason: null, winner: -1,
      fighters: [f0, f1], events: [],
    };
    const F = fight.fighters;

    function emit(e) { fight.events.push(e); }
    fight.drainEvents = function () { const e = fight.events; fight.events = []; return e; };

    function resetRound() {
      const mid = (arena.minX + arena.maxX) / 2;
      F.forEach(function (f, i) {
        Object.assign(f, {
          x: mid + (i === 0 ? -1 : 1) * T.startOffset, y: 0, vx: 0, vy: 0, facing: i === 0 ? 1 : -1,
          energy: 100, action: 'idle', blockLevel: 'stand', blocking: false, ducking: false,
          move: null, moveId: null, phase: null, phaseT: 0, moveP: 0, moveT: 0, hitDone: false,
          stunT: 0, kbT: 0, kbV: 0, prevUp: false,
        });
      });
      fight.timeLeft = practice ? null : roundTime;
      fight.roundWinner = null; fight.roundReason = null;
      fight.state = 'intro'; fight.stateT = 0; fight.stateDur = T.introTime;
      emit({ type: 'roundStart', round: fight.round });
      if (opts.skipIntro) { fight.state = 'fighting'; emit({ type: 'fight' }); }
    }

    fight.restart = function () {
      F.forEach(function (f) { f.roundsWon = 0; f.hitsLanded = 0; });
      fight.round = 1; fight.winner = -1; resetRound();
    };

    function clampX(f) { f.x = Math.max(arena.minX, Math.min(arena.maxX, f.x)); }

    function pickAttack(inp) {
      for (let i = 0; i < ATTACK_KEYS.length; i++) if (inp[ATTACK_KEYS[i]]) return ATTACK_KEYS[i];
      return null;
    }

    function startAttack(f, limb, h, airborne) {
      const variant = (airborne || h.up) ? 'jump' : (h.down ? 'low' : 'stand');
      const m = M.moves[M.moveId(limb, variant, h.back)];
      if (variant === 'jump' && !airborne) { f.y = 1e-6; f.vy = JUMP_V; f.vx = 0; }
      else if (!airborne) f.vx = 0;
      f.move = m; f.moveId = m.id; f.moveT = 0; f.moveP = 0; f.phase = 'startup'; f.phaseT = 0;
      f.hitDone = false; f.action = 'attack';
      emit({ type: 'attack', attacker: f.index, move: m.id, level: m.level, x: f.x, y: f.y });
    }

    function advanceAttack(f, dt) {
      const m = f.move;
      f.moveT += dt * f.speedMul;
      const aEnd = m.startup + m.active;
      if (f.moveT >= m.total) { endMove(f); return; }
      if (f.moveT < m.startup) { f.phase = 'startup'; f.phaseT = f.moveT / m.startup; }
      else if (f.moveT < aEnd) { f.phase = 'active'; f.phaseT = (f.moveT - m.startup) / m.active; }
      else {
        if (f.phase !== 'recovery' && !f.hitDone) emit({ type: 'whiff', attacker: f.index, move: m.id, level: m.level, x: f.x, y: f.y });
        f.phase = 'recovery'; f.phaseT = (f.moveT - aEnd) / m.recovery;
      }
      f.moveP = f.moveT / m.total;
    }

    function endMove(f) {
      const m = f.move;
      if (m && f.phase !== 'recovery' && !f.hitDone) emit({ type: 'whiff', attacker: f.index, move: m.id, level: m.level, x: f.x, y: f.y });
      f.move = null; f.moveId = null; f.phase = null; f.phaseT = 0; f.moveP = 0; f.action = f.y > 0 ? 'jump' : 'idle';
    }

    function stepFighter(f, o, inp, dt, canAct) {
      inp = inp || {};
      if (canAct) {
        const both = inp.left && inp.right;
        const toward = f.facing;
        f.held = {
          fwd: !both && !!((toward > 0 && inp.right) || (toward < 0 && inp.left)),
          back: !both && !!((toward > 0 && inp.left) || (toward < 0 && inp.right)),
          up: !!inp.up, down: !!inp.down,
        };
      } else f.held = { fwd: false, back: false, up: false, down: false };
      const h = f.held;
      let walkV = 0;

      if (canAct) {
        if (f.stunT > 0) { f.stunT -= dt; if (f.stunT <= 0) { f.stunT = 0; f.action = f.y > 0 ? 'jump' : 'idle'; } }
        if (f.stunT <= 0) {
          if (f.move) advanceAttack(f, dt);
          if (!f.move) {
            const key = pickAttack(inp);
            const airborne = f.y > 0;
            if (key) startAttack(f, key, h, airborne);
            else if (!airborne) {
              if (h.up && !f.prevUp) { f.y = 1e-6; f.vy = JUMP_V; f.action = 'jump'; f.vx = h.fwd ? T.airSpeed * f.facing : h.back ? -T.airSpeed * f.facing : 0; }
              else if (h.back) { f.action = 'block'; if (!h.down) walkV = -T.walkBack * f.facing * f.speedMul; }
              else if (h.down) f.action = 'duck';
              else if (h.fwd) { f.action = 'walkFwd'; walkV = T.walkFwd * f.facing * f.speedMul; }
              else f.action = 'idle';
            } else {
              f.action = 'jump';
              f.vx = h.fwd ? T.airSpeed * f.facing : h.back ? -T.airSpeed * f.facing : 0;
            }
          }
        }
        f.prevUp = h.up;
        f.blocking = h.back && !f.move && f.action !== 'hit';
        f.blockLevel = (h.down && f.y <= 0) ? 'duck' : 'stand';
        f.ducking = f.y <= 0 && f.action !== 'hit' && (f.move ? f.move.variant === 'low' : h.down);
        if (f.move && f.move.variant !== 'jump' && f.y <= 0) f.vx = 0;
      } else { f.blocking = false; f.ducking = false; }

      // physics
      if (f.y > 0) {
        f.vy -= GRAVITY * dt; f.y += f.vy * dt; f.x += f.vx * dt;
        if (f.y <= 0) {
          f.y = 0; f.vy = 0; f.vx = 0;
          if (f.action === 'jump') f.action = 'idle';
        }
      } else { f.x += walkV * dt; f.vx = walkV; }
      if (f.kbT > 0) { f.x += f.kbV * Math.min(dt, f.kbT); f.kbT -= dt; }
      clampX(f);
      if (canAct && !f.move) {
        const d = o.x - f.x;
        if (d !== 0) f.facing = d > 0 ? 1 : -1;
      }
    }

    function separate() {
      const a = F[0], b = F[1];
      if (a.y >= T.passHeight || b.y >= T.passHeight) return;
      const gap = Math.abs(b.x - a.x);
      if (gap >= T.bodyWidth) return;
      const lo = (a.x < b.x || (a.x === b.x && a.facing > 0)) ? a : b, hi = lo === a ? b : a;
      const push = (T.bodyWidth - gap) / 2;
      lo.x -= push; hi.x += push; clampX(lo); clampX(hi);
      if (hi.x - lo.x < T.bodyWidth) {
        if (lo.x <= arena.minX) hi.x = lo.x + T.bodyWidth; else lo.x = hi.x - T.bodyWidth;
        clampX(lo); clampX(hi);
      }
    }

    // Returns null (miss/dodged) or {blocked}.
    function evalHit(a, d) {
      const m = a.move;
      if (!m || a.phase !== 'active' || a.hitDone) return null;
      if (d.action === 'ko' || d.action === 'win' || d.action === 'defeat') return null;
      const dx = (d.x - a.x) * a.facing;
      if (dx < -T.bodyWidth * 0.25 || dx > m.reach) return null;
      if (m.level === 'HIGH' && d.ducking) return null;
      if (m.level === 'LOW' && d.y > T.lowDodgeHeight) return null;
      const covered = d.ducking ? m.level !== 'HIGH' : m.level !== 'LOW';
      return { blocked: !!(d.blocking && covered), m: m };
    }

    function applyHit(a, d, r) {
      const m = r.m;
      a.hitDone = true; a.hitsLanded++;
      const dmg = practice ? 0 : m.damage * (r.blocked ? T.blockDamageMul : 1);
      d.energy = Math.max(0, d.energy - dmg);
      if (r.blocked) { d.stunT = m.blockstun; d.action = 'blockstun'; }
      else { d.stunT = m.hitstun; d.action = 'hit'; d.move = null; d.moveId = null; d.phase = null; d.phaseT = 0; d.moveP = 0; d.vx = 0; d.blocking = false; }
      d.kbV = a.facing * m.knockback * (r.blocked ? T.blockedKnockbackMul : 1) / T.knockbackTime;
      d.kbT = T.knockbackTime;
      emit({
        type: r.blocked ? 'block' : 'hit', attacker: a.index, defender: d.index, move: m.id, level: m.level,
        damage: dmg, moveDamage: m.damage, x: (a.x + d.x) / 2, y: d.y + LEVEL_Y[m.level],
      });
    }

    function endRound(reason) {
      const e0 = F[0].energy, e1 = F[1].energy;
      const w = e0 > e1 ? 0 : e1 > e0 ? 1 : -1;
      fight.roundWinner = w; fight.roundReason = w < 0 ? 'draw' : reason;
      F.forEach(function (f) {
        f.move = null; f.moveId = null; f.phase = null; f.phaseT = 0; f.moveP = 0; f.stunT = 0; f.blocking = false; f.ducking = false;
        f.action = 'idle';
        if (w >= 0) f.action = f.index === w ? 'win' : (reason === 'ko' ? 'ko' : 'defeat');
      });
      if (w >= 0) F[w].roundsWon++;
      if (reason === 'ko' && w >= 0) emit({ type: 'ko', fighter: 1 - w });
      if (reason === 'time') emit({ type: 'timeUp' });
      fight.state = 'roundOver'; fight.stateT = 0; fight.stateDur = T.roundOverTime;
      emit({ type: 'roundEnd', winner: w, reason: fight.roundReason, round: fight.round, roundsWon: [F[0].roundsWon, F[1].roundsWon] });
    }

    fight.update = function (dt, in0, in1) {
      dt = Math.max(0, Math.min(dt || 0, 0.05));
      fight.stateT += dt;
      const inputs = [in0, in1];
      const canAct = fight.state === 'fighting';
      F.forEach(function (f, i) { stepFighter(f, F[1 - i], inputs[i], dt, canAct); });

      if (fight.state === 'intro') {
        if (fight.stateT >= fight.stateDur) { fight.state = 'fighting'; fight.stateT = 0; emit({ type: 'fight' }); }
      } else if (fight.state === 'fighting') {
        separate();
        if (!practice) fight.timeLeft = Math.max(0, fight.timeLeft - dt);
        const r0 = evalHit(F[0], F[1]), r1 = evalHit(F[1], F[0]);
        if (r0) applyHit(F[0], F[1], r0);
        if (r1) applyHit(F[1], F[0], r1);
        if (!practice) {
          if (F[0].energy <= 0 || F[1].energy <= 0) endRound('ko');
          else if (fight.timeLeft <= 0) endRound('time');
        }
      } else {
        separate();
        if (fight.state === 'roundOver' && fight.stateT >= fight.stateDur) {
          const won = F[0].roundsWon >= 2 ? 0 : F[1].roundsWon >= 2 ? 1 : -1;
          if (won >= 0) {
            fight.winner = won; fight.state = 'matchOver'; fight.stateT = 0;
            emit({ type: 'matchEnd', winner: won, roundsWon: [F[0].roundsWon, F[1].roundsWon] });
          } else {
            if (fight.roundWinner !== -1) fight.round++;
            resetRound();
          }
        }
      }
    };

    resetRound();
    return fight;
  }

  const api = { createFight: createFight, Moves: M, tuning: T };
  if (typeof window !== 'undefined') window.TKD = api;
  else if (root) root.TKD = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // --- browser shell (P6) ---
  if (typeof document !== 'undefined') {
    // Placeholder: input, canvas loop, screens, storage are added in phase P6. Nothing runs yet.
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
