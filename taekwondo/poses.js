/*
 * Taekwondo Master — poses and move animations for the fighter rig.  window.TKDPoses.
 * Plain script, load after assets.js (and moves.js, for the timings).  Works from file://.
 *
 * ============================== API ==============================
 *
 * TKDPoses.sample(name, t)  -> pose (plain object, see assets.js / STATE.md for the format)
 *     name  a move id from moves.js ('backKick_stand', 'frontPunch_spin_low', ...) or a state name (below).
 *     t     0..1.  Move: normalised time over startup + active + recovery, using the moves.js timings
 *           (so t = moveP).  State: 0..1 over one cycle / one run of that state (see duration()).
 *           Loops (idle, walk, win, ...) wrap t; one-shots clamp it.
 * TKDPoses.sampleMove(id, phase, phaseT)  -> pose.  phase 'startup'|'active'|'recovery', phaseT 0..1 inside it.
 * TKDPoses.expression(name)  -> 'normal'|'fierce'|'hurt'|'ko'|'happy' for that move / state.
 * TKDPoses.duration(name)    -> seconds for one run of a state (loops: one cycle); for a move its total time.
 * TKDPoses.forFighter(f, opts) -> { pose, expression, name }
 *     f      the engine fighter (game.js): action, moveId, phase, phaseT, vx, vy, x, y, facing, blocking, ducking,
 *            blockLevel, stunT.  Optional extra field the shell may set: f.hitLevel ('HIGH'|'MID'|'LOW', picks the
 *            hit reaction; default HIGH).
 *     opts   { time }   seconds, drives idle bounce / win pump / KO fall (the shell's animation clock; KO, win and
 *                       defeat want "seconds since that state began").  Default 0.
 *            { threat } level ('HIGH'|'MID'|'LOW') of the opponent's current attack: picks olgul vs momtong
 *                       makki when blocking standing.  Default MID.
 *     Walking is driven by distance, not time (feet stay planted): the stride phase comes from f.x * f.facing.
 *     The pose NEVER contains the jump height: the shell places the fighter at floor - f.y.  pose.x (a small
 *     forward lunge on attacks) is in fighter space: it goes through drawFighter, so it flips with opts.facing.
 * TKDPoses.keyFrames(id)  -> { chamber, extension, retract } poses of a move (for static previews).
 * TKDPoses.moveIds, TKDPoses.stateNames, TKDPoses.info (English + Korean names).
 * TKDPoses.jumpY(sec)  -> engine jump height after `sec` seconds (preview helper, same parabola as game.js).
 *
 * States: idle, walkFwd, walkBack, jump (push-off, tuck, reach, land), duck, blockHigh (olgul makki),
 * blockMid (momtong makki), blockLow (arae makki, ducking), hit (head), hitBody, hitLow, hitAir, blockstun,
 * blockstunLow, bow (kyungye), win, defeated (time-up loss), ko.
 *
 * HOW A MOVE IS BUILT: keyframes on a phase axis 0..3 (0 = start, 1 = end of startup = first active frame,
 * 2 = end of active, 3 = end of recovery).  Startup: base -> chamber -> extension (the snap is in the last part),
 * active: hold the extension, recovery: retract through the chamber back to the base (stance; the duck for low
 * moves; the air tuck for jumping moves).  Spins: base -> wind-up -> back turned to the viewer (back: 1) ->
 * extension facing the opponent -> recovery with a settling crouch.
 */
(function () {
  'use strict';

  const A = window.TKDAssets;
  const MV = window.TKDMoves || null;
  const S = A.poses.stance;

  // ---------- pose builder ----------
  // flat(d): foot flat on the floor (ankle = hip - knee - rot) plus d (d > 0 = heel raised / toes pointed).
  const flat = (d) => ({ flat: d || 0 });
  function P(o, base) {
    const p = Object.assign({}, base || S, o);
    ['f', 'b'].forEach((s) => {
      const a = p[s + 'Ankle'];
      if (a && typeof a === 'object') p[s + 'Ankle'] = p[s + 'Hip'] - p[s + 'Knee'] - (p.rot || 0) + a.flat;
    });
    return p;
  }
  const mix = (a, b, t) => A.lerpPose(a, b, t);
  const ease = (t) => t * t * (3 - 2 * t);
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

  // ---------- movement / state poses ----------
  const DUCK = P({
    torso: 26, head: -14,
    fShoulder: 78, fElbow: 62, bShoulder: 36, bElbow: 80,
    fHip: 68, fKnee: 112, fAnkle: flat(), bHip: 22, bKnee: 96, bAnkle: flat(16),
  });
  const CROUCH = P({ // landing absorb
    torso: 14, head: -8,
    fHip: 56, fKnee: 80, fAnkle: flat(), bHip: 14, bKnee: 72, bAnkle: flat(8),
    fShoulder: 70, fElbow: 70, bShoulder: 24, bElbow: 80,
  });
  const AIR = P({ // tuck, guard up
    torso: 8, head: -4,
    fShoulder: 82, fElbow: 62, bShoulder: 30, bElbow: 78,
    fHip: 76, fKnee: 96, fAnkle: 34, bHip: 30, bKnee: 104, bAnkle: 40,
  });
  const LAUNCH = P({ // legs stretched, toes pointed, arms swinging up
    torso: -2, head: -6,
    fShoulder: 120, fElbow: 40, bShoulder: 95, bElbow: 50,
    fHip: 10, fKnee: 6, fAnkle: 70, bHip: -10, bKnee: 8, bAnkle: 70,
  });
  const REACH = P({ // legs reaching for the floor
    torso: 4, head: -4,
    fShoulder: 80, fElbow: 62, bShoulder: 30, bElbow: 78,
    fHip: 34, fKnee: 26, fAnkle: 40, bHip: -6, bKnee: 22, bAnkle: 40,
  });

  const BLOCK_HIGH = P({ // olgul makki: forearm above the forehead, other fist at the hip
    torso: -3, head: -3,
    fShoulder: 112, fElbow: 98, fHand: 0, bShoulder: -8, bElbow: 92,
  });
  const BLOCK_MID = P({ // momtong makki: forearm up in front of the chest
    torso: -2,
    fShoulder: 52, fElbow: 128, bShoulder: -8, bElbow: 92,
  });
  const BLOCK_LOW = P({ // arae makki (from the duck): forearm sweeps down over the front knee
    fShoulder: 40, fElbow: 12, bShoulder: -8, bElbow: 92,
  }, DUCK);
  const BRACE = P({ // blocked hit: both forearms in front, leaning away
    torso: -8, head: 0, x: -6,
    fShoulder: 96, fElbow: 124, bShoulder: 86, bElbow: 128,
    fHip: 26, fKnee: 34, fAnkle: flat(), bHip: -16, bKnee: 34, bAnkle: flat(10),
  });
  const BRACE_LOW = P({
    torso: 14, head: -12, x: -6,
    fShoulder: 62, fElbow: 20, bShoulder: 70, bElbow: 110,
  }, DUCK);

  const HIT_HEAD = P({ // head snaps back, staggers
    x: -14, torso: -16, head: -22,
    fShoulder: 40, fElbow: 50, bShoulder: 10, bElbow: 50,
    fHip: 12, fKnee: 14, fAnkle: 8, bHip: -26, bKnee: 22, bAnkle: flat(),
  });
  const HIT_BODY = P({ // folds over the belly
    x: -12, torso: 26, head: 12,
    fShoulder: 50, fElbow: 70, bShoulder: 40, bElbow: 80,
    fHip: 34, fKnee: 40, fAnkle: flat(), bHip: -8, bKnee: 34, bAnkle: flat(),
  });
  const HIT_LOW = P({ // legs get knocked, knees buckle
    x: -10, torso: 20, head: 6,
    fShoulder: 40, fElbow: 40, bShoulder: 20, bElbow: 60,
    fHip: 52, fKnee: 80, fAnkle: flat(), bHip: 6, bKnee: 70, bAnkle: flat(20),
  });
  const HIT_AIR = P({ // tumbling back through the air
    x: -10, rot: -38, torso: 0, head: -14,
    fShoulder: 150, fElbow: 40, bShoulder: 130, bElbow: 50,
    fHip: 40, fKnee: 70, fAnkle: 30, bHip: 10, bKnee: 40, bAnkle: 30,
  });

  const ATTENTION = P({ // feet together, arms at the sides, open hands
    torso: 0, head: 0, open: 0.6,
    fShoulder: 6, fElbow: 4, bShoulder: 2, bElbow: 4, fHand: 1, bHand: 1,
    fHip: 3, fKnee: 3, fAnkle: flat(), bHip: -3, bKnee: 3, bAnkle: flat(),
  });
  const BOW = P({ torso: 34, head: 12 }, ATTENTION);

  const WIN_A = P({ // fist pump: front fist high, other fist at the hip, chest open
    open: 1, torso: -4, head: -10,
    fShoulder: 138, fElbow: 18, bShoulder: -6, bElbow: 94,
    fHip: 22, fKnee: 14, fAnkle: flat(), bHip: -14, bKnee: 14, bAnkle: flat(6),
  });
  const WIN_B = P({ torso: -2, head: -12, fShoulder: 146, fElbow: 10,
    fHip: 16, fKnee: 38, fAnkle: flat(), bHip: -8, bKnee: 38, bAnkle: flat(10) }, WIN_A);

  const DEFEAT_A = P({ // time-up loss: head down, arms hanging, knees soft
    torso: 20, head: 26,
    fShoulder: 10, fElbow: 6, bShoulder: -6, bElbow: 8, fHand: 1, bHand: 1,
    fHip: 8, fKnee: 8, fAnkle: flat(), bHip: -6, bKnee: 8, bAnkle: flat(),
  });
  const DEFEAT_B = P({ torso: 23, head: 30, fHip: 10, fKnee: 12, bHip: -7, bKnee: 12 }, DEFEAT_A);

  const KO_FALL = P({ // knocked off balance, arms flung up
    x: -22, rot: -28, torso: -4, head: -18,
    fShoulder: 150, fElbow: 30, bShoulder: 120, bElbow: 40,
    fHip: 30, fKnee: 40, fAnkle: 20, bHip: -20, bKnee: 40, bAnkle: 20,
  });
  const KO_SIT = P({ // sitting dazed, legs out, hands on the floor behind
    x: -30, rot: -16, torso: -6, head: 10,
    fShoulder: -46, fElbow: 4, bShoulder: -58, bElbow: 4,
    fHip: 78, fKnee: 22, fAnkle: 30, bHip: 66, bKnee: 34, bAnkle: 30,
  });
  const KO_SIT2 = P({ head: 16, torso: -4, rot: -14 }, KO_SIT);

  // ---------- attacks ----------
  const MOVES = {};      // id -> { keys, chamber, extension, retract }
  const lerpKeys = (keys, c) => {
    if (c <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (c <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        return mix(a[1], b[1], ease((c - a[0]) / (b[0] - a[0])));
      }
    }
    return keys[keys.length - 1][1];
  };

  // Body styles: stand / duck (low) / air tuck (jump).
  const BODY = { stand: S, low: DUCK, jump: AIR };
  const EXT = {};
  const CHM = {};

  // ---- front punch (jab) ----
  CHM.frontPunch = {
    stand: P({ fShoulder: 38, fElbow: 122, torso: 3 }),
    low: P({ fShoulder: 30, fElbow: 120, torso: 30 }, DUCK),
    jump: P({ fShoulder: 40, fElbow: 120 }, AIR),
  };
  EXT.frontPunch = {
    stand: P({ x: 0, torso: 14, head: -6, open: 0.35, fShoulder: 94, fElbow: 0, bShoulder: 44, bElbow: 104,
      fHip: 36, fKnee: 30, fAnkle: flat(), bHip: -14, bKnee: 22, bAnkle: flat(12) }),
    low: P({ torso: 30, head: -10, open: 0.3, fShoulder: 74, fElbow: 0, bShoulder: 44, bElbow: 104 }, DUCK),
    jump: P({ torso: 10, head: -6, open: 0.35, fShoulder: 98, fElbow: 0, bShoulder: 44, bElbow: 104 }, AIR),
  };
  // ---- back punch (rear straight) ----
  CHM.backPunch = {
    stand: P({ bShoulder: 20, bElbow: 118, fShoulder: 70, fElbow: 96, torso: 4, open: 0.4 }),
    low: P({ bShoulder: 16, bElbow: 118, torso: 28, open: 0.4 }, DUCK),
    jump: P({ bShoulder: 20, bElbow: 118, open: 0.4 }, AIR),
  };
  EXT.backPunch = {
    stand: P({ x: 24, torso: 16, head: -8, open: 0.9, armSwap: 1, bShoulder: 91, bElbow: 0, fShoulder: 58, fElbow: 124,
      fHip: 42, fKnee: 42, fAnkle: flat(), bHip: -24, bKnee: 8, bAnkle: flat(26) }),
    low: P({ x: 20, torso: 32, head: -10, open: 0.9, armSwap: 1, bShoulder: 76, bElbow: 0, fShoulder: 58, fElbow: 124 }, DUCK),
    jump: P({ x: 14, torso: 12, head: -6, open: 0.9, armSwap: 1, bShoulder: 96, bElbow: 0, fShoulder: 58, fElbow: 124 }, AIR),
  };
  // ---- front kick (front-leg roundhouse) ----
  CHM.frontKick = {
    stand: P({ torso: -4, fHip: 92, fKnee: 104, fAnkle: 50, bHip: -6, bKnee: 18, bAnkle: flat(),
      fShoulder: 96, fElbow: 84, bShoulder: 36, bElbow: 90, open: 0.2 }),
    low: P({ torso: -4, fHip: 88, fKnee: 138, fAnkle: 40, bHip: 40, bKnee: 112, bAnkle: flat(), fShoulder: 96, fElbow: 84, bShoulder: 36, bElbow: 90 }, DUCK),
    jump: P({ torso: -6, fHip: 92, fKnee: 104, fAnkle: 50, bHip: 20, bKnee: 100, bAnkle: 40, fShoulder: 96, fElbow: 84 }, AIR),
  };
  EXT.frontKick = {
    stand: P({ x: 0, torso: -12, head: 0, open: 0.3, fHip: 108, fKnee: 6, fAnkle: 72, bHip: -6, bKnee: 18, bAnkle: flat(),
      fShoulder: 100, fElbow: 82, bShoulder: 38, bElbow: 92 }),
    low: P({ x: 0, torso: -8, fHip: 84, fKnee: 4, fAnkle: 70, bHip: 40, bKnee: 112, bAnkle: flat(),
      fShoulder: 96, fElbow: 84, bShoulder: 36, bElbow: 90 }, DUCK),
    jump: P({ torso: -14, open: 0.3, fHip: 100, fKnee: 4, fAnkle: 72, bHip: 20, bKnee: 100, bAnkle: 40,
      fShoulder: 100, fElbow: 82, bShoulder: 38, bElbow: 92 }, AIR),
  };
  // ---- back kick (rear roundhouse, thrown with the rear leg: legSwap) ----
  CHM.backKick = {
    stand: P({ legSwap: 1, torso: -8, open: 0.6, bHip: 86, bKnee: 108, bAnkle: 50, fHip: 6, fKnee: 20, fAnkle: flat(),
      fShoulder: 100, fElbow: 84, bShoulder: 10, bElbow: 60 }),
    low: P({ legSwap: 1, torso: -6, open: 0.6, bHip: 88, bKnee: 138, bAnkle: 40, fHip: 40, fKnee: 112, fAnkle: flat(),
      fShoulder: 100, fElbow: 84, bShoulder: 10, bElbow: 60 }, DUCK),
    jump: P({ legSwap: 1, torso: -8, open: 0.6, bHip: 86, bKnee: 108, bAnkle: 50, fHip: 26, fKnee: 98, fAnkle: 40,
      fShoulder: 100, fElbow: 84, bShoulder: 10, bElbow: 60 }, AIR),
  };
  EXT.backKick = {
    stand: P({ x: 40, legSwap: 1, rot: -8, torso: -16, head: 4, open: 0.8, bHip: 100, bKnee: 4, bAnkle: 74, fHip: 6, fKnee: 22, fAnkle: flat(),
      fShoulder: 102, fElbow: 84, bShoulder: -22, bElbow: 40 }),
    low: P({ x: 30, legSwap: 1, rot: -4, torso: -14, open: 0.8, bHip: 80, bKnee: 4, bAnkle: 70, fHip: 40, fKnee: 112, fAnkle: flat(),
      fShoulder: 102, fElbow: 84, bShoulder: -22, bElbow: 40 }, DUCK),
    jump: P({ x: 26, legSwap: 1, rot: -10, torso: -16, open: 0.8, bHip: 96, bKnee: 4, bAnkle: 74, fHip: 26, fKnee: 98, fAnkle: 40,
      fShoulder: 102, fElbow: 84, bShoulder: -22, bElbow: 40 }, AIR),
  };

  // ---- spins ----
  const spinWind = (v) => P({ back: 0, open: 0, torso: 10, head: 14, x: -4,
    fShoulder: 60, fElbow: 90, bShoulder: 30, bElbow: 80 }, BODY[v]);
  const spinTurned = (v, o) => P(Object.assign({ back: 1, torso: 14, head: 10, x: 0 }, o || {}), BODY[v]);

  const SPIN_EXT = {
    // spinning backfist: front arm whips round at head height
    frontPunch: {
      stand: P({ x: 40, open: 1, torso: 4, head: -6, fShoulder: 118, fElbow: 6, bShoulder: 50, bElbow: 110,
        fHip: 40, fKnee: 38, fAnkle: flat(), bHip: -22, bKnee: 14, bAnkle: flat(20) }),
      low: P({ x: 30, open: 1, torso: 30, head: -8, fShoulder: 72, fElbow: 8, bShoulder: 50, bElbow: 110 }, DUCK),
      jump: P({ x: 24, open: 1, torso: 6, head: -6, fShoulder: 100, fElbow: 6, bShoulder: 50, bElbow: 110 }, AIR),
    },
    // spinning back punch: rear arm at body height
    backPunch: {
      stand: P({ x: 40, open: 1, armSwap: 1, torso: 14, head: -6, bShoulder: 92, bElbow: 0, fShoulder: 60, fElbow: 124,
        fHip: 40, fKnee: 40, fAnkle: flat(), bHip: -22, bKnee: 14, bAnkle: flat(20) }),
      low: P({ x: 30, open: 1, armSwap: 1, torso: 30, head: -8, bShoulder: 72, bElbow: 0, fShoulder: 60, fElbow: 124 }, DUCK),
      jump: P({ x: 24, open: 1, armSwap: 1, torso: 12, head: -6, bShoulder: 88, bElbow: 0, fShoulder: 60, fElbow: 124 }, AIR),
    },
    // spin hook kick: rear leg whips round to the head
    frontKick: {
      stand: P({ x: 52, legSwap: 1, open: 1, rot: -22, torso: -8, head: 0, bHip: 124, bKnee: 22, bAnkle: 60, fHip: 8, fKnee: 26, fAnkle: flat(),
        fShoulder: 96, fElbow: 84, bShoulder: 30, bElbow: 40 }),
      low: P({ x: 44, legSwap: 1, open: 1, rot: -4, torso: -6, bHip: 74, bKnee: 4, bAnkle: 60, fHip: 40, fKnee: 112, fAnkle: flat(),
        fShoulder: 96, fElbow: 84, bShoulder: 30, bElbow: 40 }, DUCK),
      jump: P({ x: 36, legSwap: 1, open: 1, rot: -14, torso: -8, bHip: 86, bKnee: 12, bAnkle: 60, fHip: 30, fKnee: 98, fAnkle: 40,
        fShoulder: 96, fElbow: 84, bShoulder: 30, bElbow: 40 }, AIR),
    },
    // spinning back kick (dwit chagi): rear leg thrust straight out at the belly, body leaning away
    backKick: {
      stand: P({ x: 56, legSwap: 1, open: 1, rot: -30, torso: -10, head: 8, bHip: 84, bKnee: 4, bAnkle: 76, fHip: 4, fKnee: 24, fAnkle: flat(),
        fShoulder: 80, fElbow: 70, bShoulder: 20, bElbow: 40 }),
      low: P({ x: 50, legSwap: 1, open: 1, rot: -16, torso: -4, head: 6, bHip: 78, bKnee: 4, bAnkle: 70, fHip: 40, fKnee: 112, fAnkle: flat(),
        fShoulder: 80, fElbow: 70, bShoulder: 20, bElbow: 40 }, DUCK),
      jump: P({ x: 40, legSwap: 1, open: 1, rot: -26, torso: -10, head: 6, bHip: 80, bKnee: 4, bAnkle: 76, fHip: 30, fKnee: 98, fAnkle: 40,
        fShoulder: 80, fElbow: 70, bShoulder: 20, bElbow: 40 }, AIR),
    },
  };

  const LIMBS = ['frontPunch', 'backPunch', 'frontKick', 'backKick'];
  const VARIANTS = ['stand', 'low', 'jump'];
  const idOf = (limb, v, spin) => (spin ? limb + '_spin_' + v : limb + '_' + v);

  function buildMove(limb, v, spin) {
    const base = BODY[v];
    const isKick = limb.indexOf('Kick') > 0;
    let keys, chamber, ext, retract;
    if (!spin) {
      chamber = CHM[limb][v];
      ext = EXT[limb][v];
      retract = isKick ? mix(chamber, base, 0.35) : mix(ext, base, 0.55);
      const follow = mix(ext, chamber, 0.06);
      keys = [[0, base], [0.55, chamber], [1, ext], [2, follow], [2.35, retract], [3, base]];
    } else {
      ext = SPIN_EXT[limb][v];
      const wind = spinWind(v);
      const turned = spinTurned(v, isKick ? { bHip: 50, bKnee: 90, bAnkle: 40 } : { fShoulder: -20, fElbow: 60 });
      const turned2 = spinTurned(v, isKick ? { bHip: 70, bKnee: 60, bAnkle: 40, torso: 8 } : { bShoulder: -10, fShoulder: -30, fElbow: 30 });
      chamber = turned2;
      const settle = mix(ext, base, 0.45);
      retract = settle;
      keys = [[0, base], [0.3, wind], [0.55, turned], [0.85, turned2], [1, ext], [2, ext],
        [2.3, mix(ext, turned2, 0.35)], [2.55, settle], [3, base]];
    }
    return { keys, chamber, extension: ext, retract };
  }
  LIMBS.forEach((limb) => {
    VARIANTS.forEach((v) => {
      MOVES[idOf(limb, v, false)] = buildMove(limb, v, false);
      MOVES[idOf(limb, v, true)] = buildMove(limb, v, true);
    });
  });

  // ---------- states ----------
  // State = { keys: [[t, pose], ...] (t 0..1), loop, dur (s), expr }
  const cyc = (frames) => frames.map((p, i) => [i / frames.length, p]).concat([[1, frames[0]]]);
  const STATES = {
    idle: { keys: cyc(A.poses.idle), loop: true, dur: 0.72, expr: 'normal' },
    walkFwd: { keys: cyc(A.poses.walkFwd), loop: true, dur: 0.42, expr: 'normal' },
    walkBack: { keys: cyc(A.poses.walkBack), loop: true, dur: 0.42, expr: 'normal' },
    jump: { keys: [[0, LAUNCH], [0.08, mix(LAUNCH, AIR, 0.7)], [0.25, AIR], [0.6, AIR], [0.82, REACH], [0.94, CROUCH], [1, CROUCH]], loop: false, dur: 0.62, expr: 'normal' },
    duck: { keys: [[0, S], [0.35, DUCK], [1, DUCK]], loop: false, dur: 0.18, expr: 'normal' },
    blockHigh: { keys: [[0, S], [0.4, BLOCK_HIGH], [1, BLOCK_HIGH]], loop: false, dur: 0.15, expr: 'fierce' },
    blockMid: { keys: [[0, S], [0.4, BLOCK_MID], [1, BLOCK_MID]], loop: false, dur: 0.15, expr: 'fierce' },
    blockLow: { keys: [[0, DUCK], [0.4, BLOCK_LOW], [1, BLOCK_LOW]], loop: false, dur: 0.15, expr: 'fierce' },
    hit: { keys: [[0, mix(S, HIT_HEAD, 0.7)], [0.18, HIT_HEAD], [0.7, HIT_HEAD], [1, S]], loop: false, dur: 0.28, expr: 'hurt' },
    hitLow: { keys: [[0, mix(S, HIT_LOW, 0.7)], [0.18, HIT_LOW], [0.7, HIT_LOW], [1, S]], loop: false, dur: 0.28, expr: 'hurt' },
    hitBody: { keys: [[0, mix(S, HIT_BODY, 0.7)], [0.18, HIT_BODY], [0.7, HIT_BODY], [1, S]], loop: false, dur: 0.28, expr: 'hurt' },
    hitAir: { keys: [[0, mix(AIR, HIT_AIR, 0.7)], [0.2, HIT_AIR], [1, HIT_AIR]], loop: false, dur: 0.3, expr: 'hurt' },
    blockstun: { keys: [[0, BLOCK_MID], [0.2, BRACE], [0.75, BRACE], [1, BLOCK_MID]], loop: false, dur: 0.15, expr: 'fierce' },
    blockstunLow: { keys: [[0, BLOCK_LOW], [0.2, BRACE_LOW], [0.75, BRACE_LOW], [1, BLOCK_LOW]], loop: false, dur: 0.15, expr: 'fierce' },
    bow: { keys: [[0, ATTENTION], [0.2, ATTENTION], [0.45, BOW], [0.7, BOW], [0.9, ATTENTION], [1, ATTENTION]], loop: false, dur: 1.6, expr: 'normal' },
    win: { keys: [[0, WIN_A], [0.5, WIN_B], [1, WIN_A]], loop: true, dur: 0.7, expr: 'happy' },
    defeated: { keys: [[0, DEFEAT_A], [0.5, DEFEAT_B], [1, DEFEAT_A]], loop: true, dur: 2.4, expr: 'hurt' },
    ko: { keys: [[0, HIT_HEAD], [0.2, KO_FALL], [0.45, KO_FALL], [0.6, KO_SIT], [0.7, KO_SIT2], [0.8, KO_SIT], [1, KO_SIT]], loop: false, dur: 1.6, expr: 'ko' },
  };

  // ---------- English / Korean names ----------
  const INFO = {
    moves: {
      frontPunch: { en: 'Jab', ko: 'Jaeb jireugi' },
      backPunch: { en: 'Rear punch', ko: 'Ap jireugi' },
      frontKick: { en: 'Front-leg roundhouse', ko: 'Ap dollyeo chagi' },
      backKick: { en: 'Rear roundhouse', ko: 'Dollyeo chagi' },
      frontPunch_spin: { en: 'Spinning backfist', ko: '(game move)' },
      backPunch_spin: { en: 'Spinning back punch', ko: '(game move)' },
      frontKick_spin: { en: 'Spin hook kick', ko: 'Dwi huryeo chagi' },
      backKick_spin: { en: 'Spinning back kick', ko: 'Dwit chagi' },
    },
    variants: { stand: '', low: 'low', jump: 'jumping' },
    states: {
      idle: { en: 'Fighting stance', ko: 'Gyeorugi junbi' },
      walkFwd: { en: 'Step forward', ko: '' },
      walkBack: { en: 'Step back', ko: '' },
      jump: { en: 'Jump', ko: 'Ttwieo' },
      duck: { en: 'Duck', ko: '' },
      blockHigh: { en: 'High block', ko: 'Olgul makki' },
      blockMid: { en: 'Middle block', ko: 'Momtong makki' },
      blockLow: { en: 'Low block (ducking)', ko: 'Arae makki' },
      hit: { en: 'Hit (head)', ko: '' },
      hitBody: { en: 'Hit (body)', ko: '' },
      hitLow: { en: 'Hit (legs)', ko: '' },
      hitAir: { en: 'Hit (in the air)', ko: '' },
      blockstun: { en: 'Blocked hit', ko: '' },
      blockstunLow: { en: 'Blocked hit (ducking)', ko: '' },
      bow: { en: 'Bow', ko: 'Kyungye' },
      win: { en: 'Win', ko: '' },
      defeated: { en: 'Defeated (time up)', ko: '' },
      ko: { en: 'KO (dazed)', ko: '' },
    },
  };

  // ---------- sampling ----------
  function coordFromT(id, t) {
    const m = MV && MV.moves[id];
    const s = m ? m.startup : 0.25, a = m ? m.active : 0.12, r = m ? m.recovery : 0.4;
    const tt = clamp01(t) * (s + a + r);
    if (tt < s) return tt / s;
    if (tt < s + a) return 1 + (tt - s) / a;
    return 2 + (tt - s - a) / r;
  }
  const PHASE0 = { startup: 0, active: 1, recovery: 2 };

  function sampleMove(id, phase, phaseT) {
    const mv = MOVES[id];
    if (!mv) return S;
    return lerpKeys(mv.keys, (PHASE0[phase] || 0) + clamp01(phaseT));
  }

  function sampleState(st, t) {
    const u = st.loop ? ((t % 1) + 1) % 1 : clamp01(t);
    const keys = st.keys;
    for (let i = 1; i < keys.length; i++) {
      if (u <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        return mix(a[1], b[1], ease((u - a[0]) / (b[0] - a[0] || 1)));
      }
    }
    return keys[keys.length - 1][1];
  }

  function sample(name, t) {
    if (MOVES[name]) return lerpKeys(MOVES[name].keys, coordFromT(name, t));
    const st = STATES[name];
    return st ? sampleState(st, t) : S;
  }
  function expression(name) {
    if (MOVES[name]) return 'fierce';
    return STATES[name] ? STATES[name].expr : 'normal';
  }
  function duration(name) {
    if (MV && MV.moves[name]) return MV.moves[name].total;
    return STATES[name] ? STATES[name].dur : 0;
  }
  function keyFrames(id) {
    const m = MOVES[id];
    return m ? { chamber: m.chamber, extension: m.extension, retract: m.retract } : null;
  }

  // ---------- engine fighter -> pose ----------
  const JUMP_T = MV ? MV.tuning.jumpDuration : 0.62;
  const JUMP_H = MV ? MV.tuning.jumpHeight : 110;
  const JUMP_V = 4 * JUMP_H / JUMP_T;
  const GRAV = 8 * JUMP_H / (JUMP_T * JUMP_T);
  const jumpY = (sec) => Math.max(0, JUMP_V * sec - 0.5 * GRAV * sec * sec);

  function walkPhase(f, stride) {
    const p = (f.x || 0) * (f.facing || 1) / stride;
    return ((p % 1) + 1) % 1;
  }

  function forFighter(f, opts) {
    opts = opts || {};
    const time = opts.time || 0;
    const airborne = f.y > 0.5;
    let name = 'idle', pose;
    switch (f.action) {
      case 'attack':
        if (f.moveId && MOVES[f.moveId]) {
          return { pose: sampleMove(f.moveId, f.phase, f.phaseT), expression: 'fierce', name: f.moveId };
        }
        break;
      case 'jump': {
        name = 'jump';
        const u = 0.5 - (f.vy || 0) / (2 * JUMP_V); // 0 at take-off, 1 at landing (parabola)
        pose = sampleState(STATES.jump, u);
        break;
      }
      case 'duck':
        name = 'duck'; pose = DUCK; break;
      case 'block': {
        if (f.ducking || f.blockLevel === 'duck') { name = 'blockLow'; pose = BLOCK_LOW; break; }
        name = opts.threat === 'HIGH' ? 'blockHigh' : 'blockMid';
        const arms = name === 'blockHigh' ? BLOCK_HIGH : BLOCK_MID;
        if (Math.abs(f.vx || 0) > 20) { // walking back with the guard up: legs of the walk, arms of the block
          const w = sampleState(STATES.walkBack, 1 - walkPhase(f, 80));
          pose = Object.assign({}, arms, {
            fHip: w.fHip, fKnee: w.fKnee, fAnkle: w.fAnkle, bHip: w.bHip, bKnee: w.bKnee, bAnkle: w.bAnkle,
          });
        } else pose = arms;
        break;
      }
      case 'walkFwd':
        name = 'walkFwd'; pose = sampleState(STATES.walkFwd, walkPhase(f, 100)); break;
      case 'hit': {
        const lvl = f.hitLevel || 'HIGH';
        name = airborne ? 'hitAir' : lvl === 'LOW' ? 'hitLow' : lvl === 'MID' ? 'hitBody' : 'hit';
        pose = sampleState(STATES[name], 1 - clamp01((f.stunT || 0) / 0.28));
        break;
      }
      case 'blockstun': {
        name = (f.ducking || f.blockLevel === 'duck') ? 'blockstunLow' : 'blockstun';
        pose = sampleState(STATES[name], 1 - clamp01((f.stunT || 0) / 0.14));
        break;
      }
      case 'ko':
        name = 'ko'; pose = sampleState(STATES.ko, time / STATES.ko.dur); break;
      case 'win':
        name = 'win'; pose = sampleState(STATES.win, time / STATES.win.dur); break;
      case 'defeat':
        name = 'defeated'; pose = sampleState(STATES.defeated, time / STATES.defeated.dur); break;
      default:
        break;
    }
    if (!pose) { name = 'idle'; pose = sampleState(STATES.idle, time / STATES.idle.dur); }
    return { pose: pose, expression: STATES[name].expr, name: name };
  }

  window.TKDPoses = {
    sample, sampleMove, expression, duration, forFighter, keyFrames, jumpY,
    moveIds: Object.keys(MOVES),
    stateNames: Object.keys(STATES),
    info: INFO,
    states: STATES,
    moves: MOVES,
    base: { stance: S, duck: DUCK, air: AIR, crouch: CROUCH },
  };
})();
