/* Taekwondo Master — game code.
 * Part 1: DOM-free core (createFight) — testable headless (node --test taekwondo/test/).
 * Part 2: browser shell (P6) — only starts when `document` exists (needs index.html).
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
  // Canvas rendering, DOM screens, input (keyboard + touch), pause, storage. Needs index.html.
  if (typeof document !== 'undefined') (function () {
    const W = window, A = W.TKDAssets, PO = W.TKDPoses, AR = W.TKDArena;
    if (!A || !PO || !AR) return;
    const $ = function (id) { return document.getElementById(id); };
    const WORLD_W = AR.width || 1200, WORLD_H = AR.height || 520, FLOOR = AR.floorY;
    const INK = '#2E2A36';
    const KEY = { progress: 'taekwondo:progress', trophies: 'taekwondo:trophies', mute: 'taekwondo:mute' };
    const ATT = ['backPunch', 'frontPunch', 'backKick', 'frontKick'];
    const CODE_ATT = { KeyA: 'backPunch', KeyS: 'frontPunch', KeyZ: 'backKick', KeyX: 'frontKick' };
    const CODE_DIR = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const BUFFER = 0.12; // s an attack press waits for the fighter to be free

    // ---------- storage (never throws) ----------
    function sget(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
    function sset(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* blocked */ } }
    function sdel(k) { try { window.localStorage.removeItem(k); } catch (e) { /* blocked */ } }
    function loadProgress() {
      try {
        const o = JSON.parse(sget(KEY.progress));
        if (o && (o.character === 'oli' || o.character === 'dani')) {
          const b = Math.floor(Number(o.beltIndex));
          return { character: o.character, beltIndex: b >= 0 && b < A.belts.length ? b : 0 };
        }
      } catch (e) { /* ignore */ }
      return null;
    }
    function saveProgress() { sset(KEY.progress, JSON.stringify({ character: S.character, beltIndex: S.beltIndex })); }
    function loadTrophies() { const n = parseInt(sget(KEY.trophies), 10); return n > 0 ? n : 0; }

    // ---------- state ----------
    const S = {
      screen: 'title', mode: 'tournament', character: 'oli', beltIndex: 0, trophies: 0, hasProgress: false,
      fight: null, cpu: null, playerLook: null, oppLook: null, paused: false, overlay: null, confirmFrom: null, onYes: null,
      fx: [], shake: 0, clock: 0, overShown: false, champion: false, beatenBelt: '', cardKey: '', avT: [0, 0],
    };
    const kd = {};                       // held keys by event.code
    const edge = {};                     // attack -> seconds of buffer left
    const touch = { left: false, right: false, up: false, down: false };

    function sfx(name, o) { try { if (W.TKDAudio) W.TKDAudio.play(name, o); } catch (e) { /* ignore */ } }
    function unlockAudio() { try { if (W.TKDAudio) W.TKDAudio.unlock(); } catch (e) { /* ignore */ } }
    function focus(id) { try { $(id).focus(); } catch (e) { /* ignore */ } }
    function blurActive() { try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) { /* ignore */ } }

    // ---------- icons / small art ----------
    const ICON = {
      soundOn: '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z" fill="#2E2A36"/><path d="M16 8q3 4 0 8M19 5q6 7 0 14" fill="none" stroke="#2E2A36" stroke-width="2" stroke-linecap="round"/></svg>',
      soundOff: '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z" fill="#2E2A36"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="#2E2A36" stroke-width="2.4" stroke-linecap="round"/></svg>',
      fist: '<svg viewBox="0 0 40 40"><rect x="8" y="10" width="24" height="20" rx="8" fill="#fff" stroke="#2E2A36" stroke-width="3"/><path d="M15 11v8M21 11v8M27 11v8" stroke="#2E2A36" stroke-width="2.5" stroke-linecap="round"/><path d="M10 28q10 5 20 0" fill="none" stroke="#2E2A36" stroke-width="2.5" stroke-linecap="round"/></svg>',
      foot: '<svg viewBox="0 0 40 40"><path d="M9 30q-2-9 6-12l4-9q3-3 6 0l1 9q8 3 6 10q-1 4-5 4H13q-4 0-4-2z" fill="#fff" stroke="#2E2A36" stroke-width="3" stroke-linejoin="round"/><path d="M14 31h18" stroke="#2E2A36" stroke-width="2.5" stroke-linecap="round"/></svg>',
    };
    const LEGEND =
      '<span class="kbonly"><kbd>←</kbd><kbd>→</kbd> walk</span><span class="kbonly"><kbd>↑</kbd> jump</span><span class="kbonly"><kbd>↓</kbd> duck</span>' +
      '<span class="kbonly">Back punch <kbd>A</kbd> <small>(AZERTY <kbd>Q</kbd>)</small></span><span class="kbonly">Front punch <kbd>S</kbd></span>' +
      '<span class="kbonly">Back kick <kbd>Z</kbd> <small>(AZERTY <kbd>W</kbd>)</small></span><span class="kbonly">Front kick <kbd>X</kbd></span>' +
      '<span class="kbonly"><kbd>P</kbd> pause</span><span class="kbonly"><kbd>Esc</kbd> leave</span>' +
      '<span class="touchonly">Joystick to move, 4 buttons to hit</span><span>Hold <b>back</b> + a hit = SPIN!</span>';

    function trophySvg() {
      const g = '#FFD34E', gs = '#E5A82A', gl = '#FFF1A8';
      const st = 'stroke="' + INK + '" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">' +
        '<path d="M40 48Q2 46 8 84Q14 112 48 110" fill="none" stroke="' + INK + '" stroke-width="18" stroke-linecap="round"/><path d="M40 48Q2 46 8 84Q14 112 48 110" fill="none" stroke="' + g + '" stroke-width="10" stroke-linecap="round"/>' +
        '<path d="M160 48Q198 46 192 84Q186 112 152 110" fill="none" stroke="' + INK + '" stroke-width="18" stroke-linecap="round"/><path d="M160 48Q198 46 192 84Q186 112 152 110" fill="none" stroke="' + g + '" stroke-width="10" stroke-linecap="round"/>' +
        '<rect x="48" y="196" width="104" height="30" rx="9" fill="#8B5A2B" ' + st + '/><rect x="68" y="204" width="64" height="14" rx="5" fill="' + g + '" ' + st.replace('4"', '3"') + '/>' +
        '<rect x="86" y="158" width="28" height="42" fill="' + gs + '" ' + st + '/>' +
        '<ellipse cx="100" cy="196" rx="30" ry="9" fill="' + g + '" ' + st + '/>' +
        '<path d="M40 24H160V80Q160 150 100 162Q40 150 40 80Z" fill="' + g + '" ' + st + '/>' +
        '<path d="M52 36V80Q52 122 78 140" fill="none" stroke="' + gl + '" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M100 54L109 74L131 76L114 91L119 112L100 101L81 112L86 91L69 76L91 74Z" fill="#fff" ' + st.replace('4"', '3"') + '/>' +
        '</svg>';
    }

    // ---------- screens ----------
    const SCREENS = ['title', 'chars', 'ladder', 'over', 'trophy', 'pause', 'confirm'];
    function showOnly(name) { SCREENS.forEach(function (n) { $(n).hidden = n !== name; }); }
    function hide(name) { $(name).hidden = true; }
    function setScreen(s) { S.screen = s; document.body.setAttribute('data-screen', s); }
    function belt() { return A.belts[S.beltIndex]; }

    function goTitle() {
      S.fight = null; S.paused = false; S.overlay = null;
      setScreen('title'); showOnly('title');
      $('hud').hidden = true; $('legendStrip').hidden = true; $('card').className = ''; S.cardKey = '';
      const bits = [];
      if (S.hasProgress) bits.push('Belt: ' + belt().name);
      if (S.trophies > 0) bits.push('Trophies: ' + S.trophies);
      $('titleInfo').textContent = bits.join('  ·  ');
      updateMute();
      focus('btnTournament');
    }
    function goChars(mode) {
      S.mode = mode; setScreen('chars'); showOnly('chars');
      $('pickOli').className = 'pick' + (S.character === 'oli' ? ' sel' : '');
      $('pickDani').className = 'pick' + (S.character === 'dani' ? ' sel' : '');
      focus(S.character === 'dani' ? 'pickDani' : 'pickOli');
    }
    function pickCharacter(c) {
      if (c !== S.character) { S.character = c; }
      if (S.mode === 'practice') { S.beltIndex = 0; S.oppLook = A.randomOpponent('white', Math.random); startFight(); return; }
      if (!S.hasProgress) S.beltIndex = 0;
      S.hasProgress = true; saveProgress();
      goLadder();
    }
    function goLadder() {
      setScreen('ladder'); showOnly('ladder');
      const bl = belt();
      S.playerLook = A.looks[S.character];
      S.oppLook = A.randomOpponent(bl.key, Math.random);
      const el = $('belts'); el.innerHTML = '';
      A.belts.forEach(function (b, i) {
        const d = document.createElement('div');
        d.className = 'belt' + (i === S.beltIndex ? ' cur' : '') + (i < S.beltIndex ? ' done' : '');
        d.innerHTML = A.beltBadge(b) + '<div>' + b.name + '</div>';
        el.appendChild(d);
      });
      $('vsTitle').textContent = 'vs ' + bl.name + ' belt';
      $('ladMe').innerHTML = A.portrait(S.playerLook, 'normal'); $('ladMeName').textContent = S.playerLook.name;
      $('ladOpp').innerHTML = A.portrait(S.oppLook, 'fierce'); $('ladOppName').textContent = S.oppLook.name;
      focus('btnFight');
    }

    // ---------- fight setup ----------
    function standInCpu() {
      let cd = 0.8;
      return {
        params: { speedMul: 0.85 },
        update: function (dt, fight, me) {
          const f = fight.fighters[me], o = fight.fighters[1 - me], inp = {};
          cd -= dt;
          if (Math.abs(o.x - f.x) > 190) inp[f.facing > 0 ? 'right' : 'left'] = true;
          else if (cd <= 0) { cd = 0.6 + Math.random(); inp[ATT[Math.floor(Math.random() * 4)]] = true; }
          return inp;
        },
      };
    }
    function startFight() {
      const practice = S.mode === 'practice';
      S.playerLook = A.looks[S.character];
      const bi = practice ? 0 : S.beltIndex;
      S.fight = createFight({ mode: practice ? 'practice' : 'tournament', arena: { floorY: FLOOR, minX: AR.minX, maxX: AR.maxX } });
      S.cpu = (W.TKDCpu && W.TKDCpu.createCpu) ? W.TKDCpu.createCpu(bi, Math.random) : standInCpu();
      if (S.cpu.params && S.cpu.params.speedMul) S.fight.fighters[1].speedMul = S.cpu.params.speedMul;
      S.fx = []; S.shake = 0; S.overShown = false; S.champion = false; S.paused = false; S.overlay = null; S.cardKey = ''; S.avT = [0, 0];
      Object.keys(edge).forEach(function (k) { edge[k] = 0; });
      setScreen('fight'); showOnly('none');
      $('hud').hidden = false;
      $('timer').hidden = practice; $('hits').hidden = !practice;
      $('pipsL').hidden = practice; $('pipsR').hidden = practice;
      $('legendStrip').hidden = !practice;
      $('avL').innerHTML = A.portrait(S.playerLook, 'normal');
      $('avR').innerHTML = A.portrait(S.oppLook, 'fierce');
      $('nameL').textContent = S.playerLook.name; $('nameR').textContent = S.oppLook.name;
      $('beltR').innerHTML = A.beltBadge(A.belts[bi]);
      ['barL', 'barR'].forEach(function (id) { $(id).style.width = '100%'; });
      blurActive();
      hudUpdate(true);
    }

    // ---------- input ----------
    function pressAttack(a) { if (S.screen === 'fight' && !S.paused) edge[a] = BUFFER; }
    function readInput(dt) {
      const inp = {
        left: !!(kd.ArrowLeft || touch.left), right: !!(kd.ArrowRight || touch.right),
        up: !!(kd.ArrowUp || touch.up), down: !!(kd.ArrowDown || touch.down),
      };
      ATT.forEach(function (a) {
        if (edge[a] > 0) { inp[a] = true; edge[a] -= dt; }
      });
      return inp;
    }
    function clearEdges() { ATT.forEach(function (a) { edge[a] = 0; }); }

    function onKeyDown(e) {
      unlockAudio();
      const c = e.code;
      if (c === 'Escape') { e.preventDefault(); if (!e.repeat) onEscape(); return; }
      if (S.screen !== 'fight') return;
      if (c === 'KeyP') { e.preventDefault(); if (!e.repeat) togglePause(); return; }
      if (CODE_DIR[c] || CODE_ATT[c] || c === 'Space') {
        e.preventDefault();
        if (CODE_ATT[c] && !e.repeat && !kd[c]) pressAttack(CODE_ATT[c]);
        kd[c] = true;
      }
    }
    function onKeyUp(e) { kd[e.code] = false; }
    function clearKeys() { Object.keys(kd).forEach(function (k) { kd[k] = false; }); touch.left = touch.right = touch.up = touch.down = false; }

    function onEscape() {
      if (S.overlay === 'confirm') { confirmNo(); return; }
      if (S.screen === 'fight') { openConfirm(leaveText(), leaveFight, S.overlay === 'pause' ? 'pause' : 'play'); return; }
      if (S.screen === 'chars') goTitle();
      else if (S.screen === 'ladder') { abandonTournament(); goChars(S.mode); }
      else if (S.screen === 'trophy') trophyDone();
    }

    // ---------- pause / confirm ----------
    function pauseGame() {
      if (S.screen !== 'fight' || S.paused) return;
      S.paused = true; S.overlay = 'pause'; clearKeys(); clearEdges();
      $('pauseLegend').innerHTML = LEGEND;
      $('pause').hidden = false; focus('btnResume');
    }
    function resumeGame() {
      S.paused = false; S.overlay = null; hide('pause'); hide('confirm'); blurActive();
    }
    function togglePause() {
      if (S.overlay === 'confirm') return;
      if (S.paused) resumeGame(); else pauseGame();
    }
    function openConfirm(title, onYes, from) {
      S.confirmFrom = from; S.onYes = onYes; $('confirmTitle').textContent = title;
      if (S.screen === 'fight') { S.paused = true; clearKeys(); clearEdges(); }
      hide('pause'); S.overlay = 'confirm'; $('confirm').hidden = false; focus('confirmNo');
    }
    function confirmNo() {
      hide('confirm');
      if (S.screen === 'fight') {
        if (S.confirmFrom === 'pause') { S.overlay = 'pause'; $('pause').hidden = false; focus('btnResume'); } else resumeGame();
      } else { S.overlay = null; }
    }
    function confirmYes() {
      const f = S.onYes; hide('confirm'); S.overlay = null; S.onYes = null;
      if (f) f();
    }
    // Leaving a tournament (Esc / pause Quit / match-over Quit / back from the ladder) starts it again from White.
    function abandonTournament() {
      if (S.mode !== 'tournament') return;
      S.beltIndex = 0; S.hasProgress = false; sdel(KEY.progress);
    }
    function leaveText() { return S.mode === 'tournament' ? 'Leave the tournament? You will start again from White belt.' : 'Leave the fight?'; }
    function leaveFight() { S.paused = false; S.overlay = null; hide('pause'); hide('confirm'); abandonTournament(); goTitle(); }

    function checkOrientation() {
      const portrait = window.innerHeight > window.innerWidth;
      $('rotate').classList.toggle('show', portrait);
      if (portrait) pauseGame();
    }

    // ---------- mute ----------
    function isMuted() { try { return W.TKDAudio ? !!W.TKDAudio.isMuted() : sget(KEY.mute) === '1'; } catch (e) { return false; } }
    function updateMute() { $('btnMute').innerHTML = (isMuted() ? ICON.soundOff : ICON.soundOn) + (isMuted() ? 'Sound off' : 'Sound on'); }
    function toggleMute() {
      const m = !isMuted();
      try { if (W.TKDAudio) W.TKDAudio.setMuted(m); } catch (e) { /* ignore */ }
      sset(KEY.mute, m ? '1' : '0');
      updateMute();
    }

    // ---------- engine events ----------
    function worldY(h) { return FLOOR - h; }
    function addFx(o) { o.t = 0; S.fx.push(o); }
    function handleEvents(evs) {
      const F = S.fight.fighters;
      evs.forEach(function (e) {
        switch (e.type) {
          case 'attack': sfx('whoosh'); if (e.attacker === 0) clearEdges(); break;
          case 'hit':
            sfx(e.move.indexOf('Punch') >= 0 ? 'punch' : 'kick');
            F[e.defender].hitLevel = e.level;
            S.avT[e.defender] = 0.45; setAvatar(e.defender, 'hurt');
            addFx({ k: 'star', x: e.x, y: worldY(e.y - 0), life: 0.4 });
            if (e.damage > 0) addFx({ k: 'num', x: e.x, y: worldY(e.y) - 30, text: '-' + Math.round(e.damage), life: 0.9 });
            if (e.move.indexOf('_spin_') >= 0) S.shake = 0.25;
            break;
          case 'block':
            sfx('block');
            addFx({ k: 'block', x: e.x, y: worldY(e.y), life: 0.6 });
            if (e.damage > 0) addFx({ k: 'num', x: e.x, y: worldY(e.y) - 50, text: '-' + Math.round(e.damage), life: 0.8, small: true });
            break;
          case 'ko': sfx('ko'); S.shake = 0.2; break;
          case 'roundStart': case 'fight': sfx('bell'); break;
          case 'matchEnd': matchEnded(e.winner); break;
          default: break;
        }
      });
    }
    function setAvatar(i, expr) { $(i === 0 ? 'avL' : 'avR').innerHTML = A.portrait(i === 0 ? S.playerLook : S.oppLook, expr); }

    function matchEnded(winner) {
      S.beatenBelt = belt().name;
      sfx(winner === 0 ? 'win' : 'lose');
      if (S.mode !== 'tournament' || winner !== 0) return;
      if (S.beltIndex < A.belts.length - 1) { S.beltIndex++; }
      else { S.champion = true; S.beltIndex = 0; S.trophies++; sset(KEY.trophies, String(S.trophies)); }
      saveProgress();
    }
    function showOver() {
      S.overShown = true;
      const f = S.fight, won = f.winner === 0;
      $('over').hidden = false;
      if (won) {
        $('overTitle').textContent = 'You beat the ' + S.beatenBelt + ' belt!';
        $('overSub').textContent = S.champion ? 'That was the Black belt!' : 'Next: ' + belt().name + ' belt';
        $('overMain').textContent = S.champion ? 'Get the trophy!' : 'Continue';
        $('overMain').onclick = S.champion ? goTrophy : goLadder;
      } else {
        $('overTitle').textContent = 'Try again!';
        $('overSub').textContent = 'The ' + belt().name + ' belt won this time.';
        $('overMain').textContent = 'Retry';
        $('overMain').onclick = function () { hide('over'); startFight(); };
      }
      focus('overMain');
    }
    function goTrophy() {
      hide('over'); $('hud').hidden = true; $('card').className = ''; S.cardKey = ''; S.fight = null;
      setScreen('trophy'); showOnly('trophy');
      $('trophyArt').innerHTML = trophySvg();
      $('trophyFace').innerHTML = A.portrait(S.playerLook, 'happy');
      $('trophyCount').textContent = 'Trophies: ' + S.trophies;
      const c = $('confetti'); c.innerHTML = '';
      const cols = ['#FF8A1F', '#FFD34E', '#2DC653', '#3D6FD8', '#E5383B', '#8E5BD6', '#FF9AA2'];
      for (let i = 0; i < 40; i++) {
        const p = document.createElement('i');
        p.style.left = (Math.random() * 100).toFixed(1) + '%';
        p.style.background = cols[i % cols.length];
        p.style.animationDuration = (3 + Math.random() * 3).toFixed(2) + 's';
        p.style.animationDelay = (-Math.random() * 6).toFixed(2) + 's';
        c.appendChild(p);
      }
      sfx('trophy');
      focus('trophyBtn');
    }
    function trophyDone() { $('confetti').innerHTML = ''; goTitle(); }

    // ---------- HUD ----------
    function setTxt(el, v) { if (el._v !== v) { el._v = v; el.textContent = v; } }
    function hudUpdate() {
      const f = S.fight; if (!f) return;
      const F = f.fighters;
      [0, 1].forEach(function (i) {
        const bar = $(i === 0 ? 'barL' : 'barR'), e = Math.max(0, F[i].energy);
        const w = e.toFixed(1) + '%';
        if (bar._w !== w) {
          bar._w = w; bar.style.width = w;
          bar.style.background = e > 50 ? '#2DC653' : e > 25 ? '#FFB020' : '#E5383B';
        }
        const pips = $(i === 0 ? 'pipsL' : 'pipsR'), key = F[i].roundsWon;
        if (pips._k !== key) {
          pips._k = key;
          pips.innerHTML = [0, 1].map(function (n) { return '<b' + (n < key ? ' class="on"' : '') + '></b>'; }).join('');
        }
      });
      if (f.practice) setTxt($('hits'), 'Hits ' + F[0].hitsLanded);
      else {
        const t = Math.ceil(f.timeLeft);
        setTxt($('timer'), String(t));
        $('timer').classList.toggle('low', t <= 10);
      }
    }
    function setCard(key, html, cls) {
      if (S.cardKey === key) return;
      S.cardKey = key;
      const c = $('card');
      c.className = '';
      if (!key) return;
      c.innerHTML = html; c.className = 'show ' + (cls || '');
    }
    function cardUpdate() {
      const f = S.fight, T = f.stateT;
      if (f.state === 'intro') {
        if (T < 1.2) setCard('r' + f.round + f.mode, f.practice ? 'Practice' : 'Round ' + f.round, '');
        else setCard('fight', 'Fight!', 'fight');
      } else if (f.state === 'fighting') {
        if (T < 0.5 && S.cardKey === 'fight') return;
        setCard('', '');
      } else if (f.state === 'roundOver') {
        const r = f.roundReason, w = f.roundWinner;
        const sub = w === 0 ? 'You win the round!' : w === 1 ? S.oppLook.name + ' wins the round' : 'Round again!';
        setCard('ro' + f.round + r + w, (r === 'ko' ? 'KO!' : r === 'time' ? 'Time!' : 'Draw!') + '<small>' + sub + '</small>', r === 'ko' ? 'ko' : '');
      } else setCard('', '');
    }

    // ---------- simulation step ----------
    function step(dt) {
      S.clock += dt;
      if (S.shake > 0) S.shake = Math.max(0, S.shake - dt);
      if (S.screen !== 'fight' || S.paused || !S.fight) return;
      const f = S.fight;
      S.fx.forEach(function (x) { x.t += dt; });
      S.fx = S.fx.filter(function (x) { return x.t < x.life; });
      [0, 1].forEach(function (i) { if (S.avT[i] > 0) { S.avT[i] -= dt; if (S.avT[i] <= 0) setAvatar(i, i === 0 ? 'normal' : 'fierce'); } });
      let in0 = {}, in1 = {};
      if (f.state === 'fighting') {
        in0 = readInput(dt);
        if (S.cpu) in1 = S.cpu.update(dt, f, 1) || {};
      } else clearEdges();
      f.update(dt, in0, in1);
      handleEvents(f.drainEvents());
      hudUpdate(); cardUpdate();
      if (f.state === 'matchOver' && !S.overShown && f.stateT > 1.6) showOver();
    }

    // ---------- rendering ----------
    const canvas = $('game'), ctx = canvas.getContext('2d');
    let dpr = 1, sc = 1, offX = 0, offY = 0, cw = 0, ch = 0, bg = null, bgImgs = null;

    function loadBg() {
      const keys = ['sky', 'far', 'hall', 'floor'];
      const imgs = {}; let left = keys.length;
      keys.forEach(function (k) {
        const im = new Image();
        im.onload = function () { imgs[k] = im; if (--left === 0) { bgImgs = imgs; buildBg(); } };
        im.onerror = function () { if (--left === 0) { bgImgs = imgs; buildBg(); } };
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(AR.layers[k]);
      });
    }
    function buildBg() {
      if (!bgImgs) return;
      bg = document.createElement('canvas');
      bg.width = Math.max(1, Math.round(WORLD_W * sc * dpr)); bg.height = Math.max(1, Math.round(WORLD_H * sc * dpr));
      const g = bg.getContext('2d');
      ['sky', 'far', 'hall', 'floor'].forEach(function (k) { if (bgImgs[k]) g.drawImage(bgImgs[k], 0, 0, bg.width, bg.height); });
    }
    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cw = Math.max(1, Math.round(w * dpr)); ch = Math.max(1, Math.round(h * dpr));
      canvas.width = cw; canvas.height = ch; canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      sc = Math.min(w / WORLD_W, h / WORLD_H);
      offX = (w - WORLD_W * sc) / 2 * dpr; offY = (h - WORLD_H * sc) / 2 * dpr;
      buildBg();
      checkOrientation();
    }

    function drawFighter(f, look, opp, fight) {
      const end = f.action === 'win' || f.action === 'ko' || f.action === 'defeat';
      let time = S.clock, pose, expr;
      if (end) time = fight.state === 'matchOver' ? TUNE.roundOverTime + fight.stateT : fight.stateT;
      const bowDur = PO.duration('bow') || 1.2;
      if (fight.state === 'matchOver' && fight.winner === f.index && fight.stateT < bowDur) {
        pose = PO.sample('bow', fight.stateT / bowDur); expr = PO.expression('bow');
      } else {
        const r = PO.forFighter(f, { time: (fight.state === 'matchOver' && fight.winner === f.index) ? fight.stateT - bowDur : time, threat: opp.move ? opp.move.level : 'MID' });
        pose = r.pose; expr = r.expression;
      }
      const prims = A.drawFighter(look, pose, { facing: f.facing, expression: expr });
      ctx.save(); ctx.translate(f.x, FLOOR - f.y); A.drawToCanvas(ctx, prims); ctx.restore();
    }
    function star(cx, cy, r1, r2, n) {
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = Math.PI * i / n - Math.PI / 2, r = i % 2 ? r2 : r1;
        ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
    }
    function label(text, x, y, size, fill) {
      ctx.font = '700 ' + size + 'px Fredoka, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = size / 4;
      ctx.strokeStyle = INK; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
    }
    function drawFx(x) {
      const p = x.t / x.life;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p * p);
      if (x.k === 'star') {
        ctx.fillStyle = '#FFD34E'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        star(x.x, x.y, 18 + 50 * p, 8 + 20 * p, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; star(x.x, x.y, 8 + 20 * p, 4 + 8 * p, 6); ctx.fill();
      } else if (x.k === 'block') {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x.x, x.y, 14 + 34 * p, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        label('BLOCK!', x.x, x.y - 30 - 30 * p, 30, '#3D6FD8');
      } else if (x.k === 'num') {
        label(x.text, x.x, x.y - 60 * p, x.small ? 24 : 34, x.small ? '#fff' : '#FF5A4F');
      }
      ctx.restore();
    }
    function render() {
      const k = sc * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#BFE6FF'; ctx.fillRect(0, 0, cw, ch);
      let sx = 0, sy = 0;
      if (S.shake > 0) { const a = 9 * dpr * S.shake / 0.25; sx = (Math.random() - 0.5) * a; sy = (Math.random() - 0.5) * a; }
      if (bg) {
        ctx.drawImage(bg, offX + sx, offY + sy);
        // letterbox bands: carry the deck colour down and the sky up
        ctx.fillStyle = '#A5703E';
        ctx.fillRect(0, offY + sy + bg.height, cw, ch);
      }
      if (S.screen !== 'fight' || !S.fight) return;
      const f = S.fight, F = f.fighters;
      // Zoom out on the fighters (not the arena) when the HUD would cover their heads (short phone screens):
      // scale about the centre of the floor line so feet stay on the mats and the heads drop below the HUD.
      let z = 1;
      const hudEl = document.getElementById('hud');
      if (hudEl) {
        const hb = (hudEl.getBoundingClientRect().bottom + Math.max(8, window.innerHeight * 0.04)) * dpr; // HUD bottom + a clear gap, canvas px
        const head = FLOOR - 320;                                           // top of a standing fighter's head + hair
        if (offY + head * k < hb) z = Math.max(0.65, (offY + FLOOR * k - hb) / ((FLOOR - head) * k));
      }
      const kz = k * z;
      ctx.setTransform(kz, 0, 0, kz, offX + sx + (1 - z) * (WORLD_W / 2) * k, offY + sy + (1 - z) * FLOOR * k);
      F.forEach(function (fi) { // shadows
        const s = Math.max(0.4, 1 - fi.y / 220);
        ctx.fillStyle = 'rgba(46,42,54,.22)';
        ctx.beginPath(); ctx.ellipse(fi.x, FLOOR + 4, 62 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
      });
      const order = F[0].action === 'attack' || F[1].action !== 'attack' ? [1, 0] : [0, 1];
      order.forEach(function (i) { drawFighter(F[i], i === 0 ? S.playerLook : S.oppLook, F[1 - i], f); });
      S.fx.forEach(drawFx);
    }

    // ---------- loop ----------
    let last = 0;
    function frame(ts) {
      window.requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
      last = ts;
      step(dt); render();
    }

    // ---------- touch controls ----------
    function buildTouch() {
      const defs = [['backPunch', 'fist', 'back'], ['frontPunch', 'fist', 'front'], ['backKick', 'foot', 'back'], ['frontKick', 'foot', 'front']];
      const box = $('btns');
      defs.forEach(function (d) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'tbtn'; b.setAttribute('aria-label', d[2] + ' ' + (d[1] === 'fist' ? 'punch' : 'kick'));
        b.innerHTML = ICON[d[1]] + '<span>' + d[2] + '</span>';
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); unlockAudio(); b.classList.add('down'); pressAttack(d[0]); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { b.addEventListener(n, function () { b.classList.remove('down'); }); });
        box.appendChild(b);
      });
      const joy = $('joy'), knob = $('knob'); let pid = null;
      function upd(e) {
        const r = joy.getBoundingClientRect(), hw = r.width / 2;
        let dx = (e.clientX - (r.left + hw)) / hw, dy = (e.clientY - (r.top + r.height / 2)) / hw;
        const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
        touch.left = dx < -0.3; touch.right = dx > 0.3; touch.up = dy < -0.4; touch.down = dy > 0.4;
        knob.style.transform = 'translate(' + (dx * 45).toFixed(0) + '%,' + (dy * 45).toFixed(0) + '%)';
      }
      function rel() { pid = null; touch.left = touch.right = touch.up = touch.down = false; knob.style.transform = ''; }
      joy.addEventListener('pointerdown', function (e) {
        e.preventDefault(); unlockAudio(); if (pid !== null) return; pid = e.pointerId;
        try { joy.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
        upd(e);
      });
      joy.addEventListener('pointermove', function (e) { if (e.pointerId === pid) { e.preventDefault(); upd(e); } });
      ['pointerup', 'pointercancel'].forEach(function (n) { joy.addEventListener(n, function (e) { if (e.pointerId === pid) rel(); }); });
    }

    // ---------- boot ----------
    function boot() {
      const p = loadProgress();
      if (p) { S.character = p.character; S.beltIndex = p.beltIndex; S.hasProgress = true; }
      S.trophies = loadTrophies();
      try { if (W.TKDAudio && sget(KEY.mute) === '1') W.TKDAudio.setMuted(true); } catch (e) { /* ignore */ }
      $('titleOli').innerHTML = A.portrait(A.looks.oli, 'happy');
      $('titleDani').innerHTML = A.portrait(A.looks.dani, 'happy');
      $('faceOli').innerHTML = A.portrait(A.looks.oli, 'happy');
      $('faceDani').innerHTML = A.portrait(A.looks.dani, 'happy');
      $('titleLegend').innerHTML = LEGEND; $('legendStrip').innerHTML = '<div class="legend">' + LEGEND + '</div>';
      $('btnTournament').onclick = function () { goChars('tournament'); };
      $('btnPractice').onclick = function () { goChars('practice'); };
      $('btnMute').onclick = toggleMute;
      $('btnReset').onclick = function () {
        openConfirm('Reset progress?', function () {
          sdel(KEY.progress); sdel(KEY.trophies); S.hasProgress = false; S.beltIndex = 0; S.trophies = 0; S.character = 'oli'; goTitle();
        });
      };
      $('pickOli').onclick = function () { pickCharacter('oli'); };
      $('pickDani').onclick = function () { pickCharacter('dani'); };
      $('charsBack').onclick = goTitle;
      $('ladBack').onclick = function () { abandonTournament(); goChars(S.mode); };
      $('btnFight').onclick = startFight;
      $('overQuit').onclick = function () { hide('over'); abandonTournament(); goTitle(); };
      $('trophyBtn').onclick = trophyDone;
      $('pauseBtn').onclick = function () { blurActive(); togglePause(); };
      $('btnResume').onclick = resumeGame;
      $('btnQuit').onclick = function () { openConfirm(leaveText(), leaveFight, 'pause'); };
      $('confirmYes').onclick = confirmYes; $('confirmNo').onclick = confirmNo;
      document.addEventListener('click', function (e) { if (e.target && e.target.tagName === 'BUTTON') sfx('blip'); });
      document.addEventListener('pointerdown', unlockAudio);
      document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', clearKeys);
      window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize);
      document.addEventListener('visibilitychange', function () { if (document.hidden) pauseGame(); });
      document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      buildTouch();
      loadBg(); resize(); goTitle();
      window.requestAnimationFrame(frame);
    }
    const TUNE = api.tuning;
    api.shell = { state: S, step: step, render: render, edge: edge, kd: kd, touch: touch, resize: resize };
    boot();
  })();
})(typeof globalThis !== 'undefined' ? globalThis : this);
