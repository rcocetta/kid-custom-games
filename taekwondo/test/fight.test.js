// NOTE: tests only (node --test taekwondo/test/). build.sh copies the game folder minus *.md and
// dotfiles, so this folder would be published to GitHub Pages unless build.sh excludes `test/`.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createFight, Moves } = require('../game.js');

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, a + ' vs ' + b);

function mk(opts) {
  const f = createFight(Object.assign({ skipIntro: true }, opts));
  f.fighters[0].x = 500; f.fighters[1].x = 620; // 120 apart: in range of everything
  return f;
}
function run(f, secs, i0, i1) {
  const n = Math.round(secs / 0.016);
  for (let i = 0; i < n; i++) f.update(0.016, i0, i1);
}
// press one key (edge) with optional held keys, then let the move finish
function press(f, i, key, held, secs) {
  const inp = Object.assign({ [key]: true }, held || {});
  const ins = [null, null]; ins[i] = inp;
  f.update(0.016, ins[0], ins[1]);
  const hold = Object.assign({}, held || {});
  const h = [null, null]; h[i] = hold;
  run(f, secs === undefined ? 0.9 : secs, h[0], h[1]);
}
const energyLost = f => 100 - f.fighters[1].energy;

test('move table covers 24 moves with PLAN levels', () => {
  assert.strictEqual(Moves.list.length, 24);
  const lv = id => Moves.moves[id].level;
  assert.strictEqual(lv('frontPunch_stand'), 'HIGH');
  assert.strictEqual(lv('backPunch_stand'), 'HIGH');
  assert.strictEqual(lv('frontKick_stand'), 'MID');
  assert.strictEqual(lv('backKick_stand'), 'HIGH');
  assert.strictEqual(lv('backKick_jump'), 'HIGH');
  assert.strictEqual(lv('backKick_low'), 'LOW');
  assert.strictEqual(lv('frontKick_spin_stand'), 'HIGH');
  assert.strictEqual(lv('frontPunch_spin_stand'), 'HIGH');
  assert.strictEqual(lv('backKick_spin_stand'), 'MID');
  assert.strictEqual(lv('backPunch_spin_stand'), 'MID');
  assert.strictEqual(lv('backKick_spin_jump'), 'HIGH');
  assert.strictEqual(lv('backKick_spin_low'), 'LOW');
});

test('base damage values 4 / 6 / 8 / 10', () => {
  const cases = { frontPunch: 4, backPunch: 6, frontKick: 8, backKick: 10 };
  for (const [key, dmg] of Object.entries(cases)) {
    const f = mk();
    press(f, 0, key);
    near(energyLost(f), dmg);
  }
});

test('low and jumping versions keep base damage', () => {
  let f = mk(); press(f, 0, 'backKick', { down: true }); near(energyLost(f), 10);
  f = mk(); press(f, 0, 'frontKick', { up: true }); near(energyLost(f), 8);
});

test('spinning kicks are x1.2, spinning punches base damage', () => {
  let f = mk(); press(f, 0, 'backKick', { left: true }); near(energyLost(f), 12);
  f = mk(); press(f, 0, 'frontKick', { left: true }); near(energyLost(f), 9.6);
  f = mk(); press(f, 0, 'backPunch', { left: true }); near(energyLost(f), 6);
  f = mk(); press(f, 0, 'frontPunch', { left: true }); near(energyLost(f), 4);
});

test('back + attack spins (spin move id, HIGH for front limb, MID for back limb)', () => {
  const f = mk();
  f.update(0.016, { frontKick: true, left: true }, null);
  assert.strictEqual(f.fighters[0].moveId, 'frontKick_spin_stand');
  assert.strictEqual(f.fighters[0].action, 'attack');
  assert.strictEqual(f.fighters[0].phase, 'startup');
  const g = mk();
  g.update(0.016, { backKick: true, left: true }, null);
  assert.strictEqual(g.fighters[0].moveId, 'backKick_spin_stand');
});

test('left/right are converted using facing (CPU faces left: right = back)', () => {
  const f = mk();
  f.update(0.016, null, { backKick: true, right: true });
  assert.strictEqual(f.fighters[1].moveId, 'backKick_spin_stand');
});

test('standing block reduces to 20%: MID and HIGH, not LOW', () => {
  const block = { right: true }; // CPU faces left, so right = back
  let f = mk(); press(f, 0, 'backKick', null, 0); run(f, 0.9, null, block); near(energyLost(f), 2);
  f = mk(); press(f, 0, 'backKick', { up: true }, 0); run(f, 0.9, null, block); near(energyLost(f), 2);
  f = mk(); press(f, 0, 'backKick', { down: true }, 0); run(f, 0.9, null, block); near(energyLost(f), 10);
});

test('duck block reduce to 20%: LOW and MID, but HIGH is dodged', () => {
  const duckBlock = { right: true, down: true };
  let f = mk(); press(f, 0, 'backKick', { down: true }, 0); run(f, 0.9, null, duckBlock); near(energyLost(f), 2);
  f = mk(); press(f, 0, 'frontKick', null, 0); run(f, 0.9, null, duckBlock); near(energyLost(f), 1.6);
  f = mk(); press(f, 0, 'backKick', null, 0); run(f, 0.9, null, duckBlock); near(energyLost(f), 0);
  f = mk(); press(f, 0, 'backKick', { up: true }, 0); run(f, 0.9, null, duckBlock); near(energyLost(f), 0);
});

test('block emits a block event and blockstun', () => {
  const f = mk();
  f.update(0.016, { frontKick: true }, { right: true });
  let ev = [];
  for (let i = 0; i < 40; i++) { f.update(0.016, null, { right: true }); ev = ev.concat(f.drainEvents()); }
  const b = ev.find(e => e.type === 'block');
  assert.ok(b); assert.strictEqual(b.level, 'MID'); assert.strictEqual(b.attacker, 0); near(b.damage, 1.6);
});

test('ducking dodges HIGH attacks', () => {
  const f = mk();
  press(f, 0, 'backKick', { up: true }, 0);
  run(f, 0.9, null, { down: true });
  near(energyLost(f), 0);
  assert.ok(f.drainEvents().some(e => e.type === 'whiff'));
});

test('jumping dodges LOW attacks', () => {
  const f = mk();
  f.update(0.016, null, { up: true }); // CPU jumps
  run(f, 0.1, null, {});
  assert.ok(f.fighters[1].y > 25);
  f.update(0.016, { backKick: true, down: true }, {});
  for (let i = 0; i < 12; i++) f.update(0.016, { down: true }, {}); // active window while still high
  near(energyLost(f), 0);
});

test('out of reach misses; one hit per attack', () => {
  const f = mk(); f.fighters[1].x = 900; press(f, 0, 'backKick'); near(energyLost(f), 0);
  const g = mk(); press(g, 0, 'frontPunch', null, 1.2); near(energyLost(g), 4); // not 8, 12...
});

test('hit-stun and knockback; no overlap; arena bounds', () => {
  const f = mk();
  f.update(0.016, { backKick: true }, null);
  run(f, 0.3, null, null);
  assert.ok(['hit', 'idle'].includes(f.fighters[1].action));
  assert.ok(f.fighters[1].x > 620);
  const g = mk(); g.fighters[0].x = 500; g.fighters[1].x = 520;
  run(g, 0.5, { right: true }, null);
  assert.ok(g.fighters[1].x - g.fighters[0].x >= Moves.tuning.bodyWidth - 1e-6);
  run(g, 5, { left: true }, { right: true });
  assert.ok(g.fighters[0].x >= g.arena.minX && g.fighters[1].x <= g.arena.maxX);
  run(g, 5, { right: true }, { left: true });
  assert.ok(g.fighters[0].x >= g.arena.minX && g.fighters[1].x <= g.arena.maxX);
  assert.ok(g.fighters[1].x - g.fighters[0].x >= Moves.tuning.bodyWidth - 1e-6);
});

test('facing flips when a fighter jumps over the other', () => {
  const f = mk(); f.fighters[0].x = 500; f.fighters[1].x = 570;
  assert.strictEqual(f.fighters[0].facing, 1);
  f.update(0.016, { up: true, right: true }, null);
  run(f, 0.8, { right: true }, null);
  assert.ok(f.fighters[0].x > f.fighters[1].x, 'p0 is now right of the cpu');
  assert.strictEqual(f.fighters[0].facing, -1);
  assert.strictEqual(f.fighters[1].facing, 1);
});

test('KO ends the round and awards it', () => {
  const f = mk(); f.fighters[1].energy = 5;
  press(f, 0, 'backKick', null, 0.3);
  assert.strictEqual(f.state, 'roundOver');
  assert.strictEqual(f.roundWinner, 0); assert.strictEqual(f.roundReason, 'ko');
  assert.strictEqual(f.fighters[1].action, 'ko'); assert.strictEqual(f.fighters[0].roundsWon, 1);
  assert.ok(f.drainEvents().some(e => e.type === 'ko' && e.fighter === 1));
});

test('timer end: more energy wins the round', () => {
  const f = mk({ roundTime: 2 }); f.fighters[0].energy = 60; f.fighters[1].energy = 40;
  run(f, 2.2, null, null);
  assert.strictEqual(f.state, 'roundOver');
  assert.strictEqual(f.roundWinner, 0); assert.strictEqual(f.roundReason, 'time');
  assert.ok(f.drainEvents().some(e => e.type === 'timeUp'));
});

test('draw replays the round (same round number, no win)', () => {
  const f = mk({ roundTime: 1 });
  run(f, 1.2, null, null);
  assert.strictEqual(f.roundWinner, -1);
  assert.strictEqual(f.fighters[0].roundsWon + f.fighters[1].roundsWon, 0);
  run(f, 3, null, null);
  assert.strictEqual(f.round, 1);
  assert.ok(f.state === 'intro' || f.state === 'fighting');
  assert.strictEqual(f.fighters[0].energy, 100);
});

test('best of 3: first to 2 rounds wins the match; intro precedes fighting', () => {
  const f = createFight({ mode: 'tournament' });
  assert.strictEqual(f.state, 'intro');
  const koRound = () => {
    run(f, 3, null, null); // intro
    assert.strictEqual(f.state, 'fighting');
    f.fighters[0].x = 500; f.fighters[1].x = 620; f.fighters[1].energy = 1;
    press(f, 0, 'backKick', null, 0.3);
    assert.strictEqual(f.state, 'roundOver');
    run(f, 3, null, null);
  };
  koRound();
  assert.strictEqual(f.state, 'intro'); assert.strictEqual(f.round, 2);
  koRound();
  assert.strictEqual(f.state, 'matchOver'); assert.strictEqual(f.winner, 0);
  assert.ok(f.drainEvents().some(e => e.type === 'matchEnd' && e.winner === 0));
});

test('CPU can win a match 2-1', () => {
  const f = mk(); f.fighters[0].roundsWon = 1; f.fighters[1].roundsWon = 1; f.fighters[0].energy = 1;
  press(f, 1, 'backKick', null, 0.3);
  run(f, 3, null, null);
  assert.strictEqual(f.state, 'matchOver'); assert.strictEqual(f.winner, 1);
});

test('practice mode: no damage, no timer, no round end, hits counted', () => {
  const f = mk({ mode: 'practice', roundTime: 1 });
  press(f, 0, 'backKick'); press(f, 0, 'frontKick');
  assert.strictEqual(f.fighters[1].energy, 100);
  assert.strictEqual(f.fighters[0].hitsLanded, 2);
  run(f, 5, null, null);
  assert.strictEqual(f.state, 'fighting'); assert.strictEqual(f.timeLeft, null);
  assert.ok(f.drainEvents().some(e => e.type === 'hit' && e.damage === 0));
});

test('dt is clamped to 0.05', () => {
  const f = mk({ roundTime: 120 });
  f.update(10, null, null);
  near(f.timeLeft, 120 - 0.05);
});
