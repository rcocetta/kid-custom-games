/* Taekwondo Master — gameplay data only (no drawing). window.TKDMoves / module.exports.
 * World units: a fighter is ~300 tall, the arena ~1200 wide. Times in seconds.
 * Pose/keyframe data lives in poses.js (another file); move ids here are the shared key.
 *
 * Move id: `${limb}_${variant}` or `${limb}_spin_${variant}`,
 *   limb    = frontPunch | backPunch | frontKick | backKick
 *   variant = stand | jump | low
 */
(function (root) {
  'use strict';

  const TUNING = {
    fighterHeight: 300,
    bodyWidth: 70,          // min distance between two grounded fighters' centres
    walkFwd: 240,           // units / s
    walkBack: 190,
    airSpeed: 300,          // horizontal control while jumping
    jumpDuration: 0.62,     // s, ground to ground
    jumpHeight: 110,        // units
    passHeight: 30,         // above this a jumper can pass through the opponent
    lowDodgeHeight: 25,     // above this LOW attacks miss
    knockbackTime: 0.12,    // s over which knockback distance is covered
    blockedKnockbackMul: 0.6,
    blockDamageMul: 0.2, // Review 3: a block lets only 20% of the damage through
    spinKickDamageMul: 1.2,
    introTime: 2.6,         // bow (1.6 s) + guard up (0.3 s) during "Round N", then "Fight!" (0.7 s)
    roundOverTime: 2.6,
    startOffset: 150,       // start distance from arena centre
    defaultArena: { floorY: 470, minX: 80, maxX: 1120 },
  };

  // Base (standing, non-spinning) data per limb.
  const BASE = {
    //             dmg  start  act   rec   reach hitstun blockstun knockback
    frontPunch: { damage: 4,  startup: 0.08, active: 0.08, recovery: 0.14, reach: 150, hitstun: 0.22, blockstun: 0.12, knockback: 25 },
    backPunch:  { damage: 6,  startup: 0.10, active: 0.08, recovery: 0.18, reach: 175, hitstun: 0.22, blockstun: 0.12, knockback: 30 },
    frontKick:  { damage: 8,  startup: 0.10, active: 0.10, recovery: 0.18, reach: 190, hitstun: 0.26, blockstun: 0.14, knockback: 45 },
    backKick:   { damage: 10, startup: 0.16, active: 0.10, recovery: 0.26, reach: 225, hitstun: 0.28, blockstun: 0.16, knockback: 60 },
  };
  // Spinning versions: slower start, much longer recovery (risky), longer reach, more knockback.
  const SPIN = {
    frontPunch: { startup: 0.24, active: 0.10, recovery: 0.36, reach: 175 },
    backPunch:  { startup: 0.26, active: 0.10, recovery: 0.36, reach: 180 },
    frontKick:  { startup: 0.28, active: 0.10, recovery: 0.40, reach: 235 },
    backKick:   { startup: 0.30, active: 0.10, recovery: 0.42, reach: 245 },
  };
  const LIMBS = ['frontPunch', 'backPunch', 'frontKick', 'backKick'];
  const VARIANTS = ['stand', 'jump', 'low'];

  function round1(n) { return Math.round(n * 10) / 10; }

  function levelFor(limb, variant, spin) {
    if (variant === 'jump') return 'HIGH';
    if (variant === 'low') return 'LOW';
    if (!spin) return limb === 'frontKick' ? 'MID' : 'HIGH'; // punches + rear roundhouse go for the head, front-leg kick for the body
    return limb.indexOf('front') === 0 ? 'HIGH' : 'MID'; // front limb spin -> head, back limb spin -> body
  }

  function moveId(limb, variant, spin) {
    return spin ? limb + '_spin_' + variant : limb + '_' + variant;
  }

  const moves = {};
  const list = [];
  [false, true].forEach(function (spin) {
    LIMBS.forEach(function (limb) {
      VARIANTS.forEach(function (variant) {
        const b = BASE[limb];
        const s = spin ? SPIN[limb] : b;
        const isKick = limb.indexOf('Kick') > 0;
        const m = {
          id: moveId(limb, variant, spin),
          limb: limb,
          variant: variant,
          spin: spin,
          level: levelFor(limb, variant, spin),
          damage: round1(b.damage * (spin && isKick ? TUNING.spinKickDamageMul : 1)),
          startup: s.startup,
          active: s.active,
          recovery: s.recovery,
          reach: s.reach,
          hitstun: spin ? b.hitstun + 0.06 : b.hitstun,
          blockstun: spin ? b.blockstun + 0.04 : b.blockstun,
          knockback: spin ? Math.round(b.knockback * 1.4) : b.knockback,
        };
        m.total = m.startup + m.active + m.recovery;
        moves[m.id] = m;
        list.push(m);
      });
    });
  });

  const api = { tuning: TUNING, moves: moves, list: list, limbs: LIMBS, variants: VARIANTS, moveId: moveId };
  if (typeof window !== 'undefined') window.TKDMoves = api;
  else if (root) root.TKDMoves = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
