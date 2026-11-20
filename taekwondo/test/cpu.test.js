'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createFight } = require('../game.js');
const { belts, createCpu } = require('../cpu.js');

function seeded(seed) {
  let s = seed >>> 0;
  return function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const NEUTRAL = () => ({ left: false, right: false, up: false, down: false, backPunch: false, frontPunch: false, backKick: false, frontKick: false });
const AKEYS = ['backPunch', 'frontPunch', 'backKick', 'frontKick'];

// player bots (fighter 0, faces right: toward = 'right')
const bots = {
  masher(rand) {
    let cd = 0;
    return (dt, f) => {
      const i = NEUTRAL(); cd -= dt;
      const d = f.fighters[1].x - f.fighters[0].x;
      if (d > 170) i.right = true;
      if (cd <= 0) { cd = 0.12 + rand() * 0.25; i[AKEYS[Math.floor(rand() * 4)]] = true; if (rand() < 0.2) i.down = true; if (rand() < 0.1) i.up = true; }
      return i;
    };
  },
  turtle() { return () => { const i = NEUTRAL(); i.left = true; return i; }; },
  walker(rand) {
    let cd = 0;
    return (dt, f) => {
      const i = NEUTRAL(); cd -= dt;
      const d = f.fighters[1].x - f.fighters[0].x;
      if (d > 140) i.right = true;
      else if (cd <= 0) { cd = 0.35 + rand() * 0.15; i.frontPunch = true; }
      return i;
    };
  },
};

function playMatch(belt, botName, seed) {
  const rand = seeded(seed);
  const fight = createFight({ skipIntro: true, rand: seeded(seed + 1) });
  const cpu = createCpu(belt, seeded(seed + 2));
  fight.fighters[1].speedMul = cpu.params.speedMul;
  const bot = bots[botName](seeded(seed + 3));
  const dt = 1 / 60;
  for (let n = 0; n < 60 * 700 && fight.state !== 'matchOver'; n++) {
    const in0 = fight.state === 'fighting' ? bot(dt, fight) : NEUTRAL();
    const in1 = cpu.update(dt, fight, 1);
    fight.update(dt, in0, in1);
  }
  return fight.winner === 1;
}
function winRate(belt, botName, n) {
  let w = 0;
  for (let i = 0; i < n; i++) if (playMatch(belt, botName, 1000 * belt + i * 7 + 13)) w++;
  return w / n;
}

test('interface shape', () => {
  assert.strictEqual(belts.length, 8);
  assert.deepStrictEqual(belts.map(b => b.name), ['White', 'Yellow', 'Orange', 'Green', 'Purple', 'Blue', 'Red', 'Black']);
  assert.strictEqual(belts[0].reactionMs, 650); assert.strictEqual(belts[7].reactionMs, 150);
  assert.strictEqual(belts[0].comboChance, 0); assert.strictEqual(belts[2].comboChance, 0); assert.ok(belts[3].comboChance > 0);
  assert.strictEqual(belts[1].spinChance, 0); assert.ok(belts[2].spinChance > 0);
  assert.strictEqual(belts[7].comboChance, 0.5); assert.strictEqual(belts[7].spinChance, 0.3);
  const fight = createFight({ skipIntro: true });
  const inp = createCpu(3).update(0.016, fight, 1);
  assert.deepStrictEqual(Object.keys(inp).sort(), Object.keys(NEUTRAL()).sort());
  for (const k of Object.keys(inp)) assert.strictEqual(typeof inp[k], 'boolean');
});

test('deterministic with a seeded rand', () => {
  const trace = () => {
    const fight = createFight({ skipIntro: true, rand: seeded(5) });
    const cpu = createCpu(4, seeded(9)); const bot = bots.masher(seeded(3));
    const log = [];
    for (let i = 0; i < 1500; i++) {
      const in1 = cpu.update(1 / 60, fight, 1); log.push(JSON.stringify(in1));
      fight.update(1 / 60, bot(1 / 60, fight), in1);
    }
    return log.join('|') + fight.fighters[0].energy + ',' + fight.fighters[1].energy;
  };
  assert.strictEqual(trace(), trace());
});

test('attack keys are single-frame edges', () => {
  const fight = createFight({ skipIntro: true });
  const cpu = createCpu(7, seeded(1)); const bot = bots.turtle();
  let prev = false, attacks = 0;
  for (let i = 0; i < 3000; i++) {
    const in1 = cpu.update(1 / 60, fight, 1);
    const a = AKEYS.some(k => in1[k]);
    if (a) attacks++;
    assert.ok(!(a && prev), 'attack key held two frames in a row');
    prev = a;
    fight.update(1 / 60, bot(), in1);
  }
  assert.ok(attacks > 3);
});

test('win rate rises with belt', { timeout: 600000 }, () => {
  const N = 40;
  const names = Object.keys(bots);
  const rates = belts.map((b, k) => names.map(n => winRate(k, n, N)));
  const avg = rates.map(r => r.reduce((a, b) => a + b, 0) / r.length);
  const pct = x => String(Math.round(x * 100)).padStart(4) + '%';
  console.log('\nCPU win rate (' + N + ' matches each)\nbelt     ' + names.map(n => n.padStart(6)).join('') + '   avg');
  belts.forEach((b, k) => console.log(b.name.padEnd(8) + ' ' + rates[k].map(pct).join('  ') + '  ' + pct(avg[k])));
  const masher = rates.map(r => r[0]);
  assert.ok(masher[0] < 0.5, 'White should lose most matches to the masher');
  assert.ok(avg[7] > avg[3] + 0.2, 'Black clearly beats Green');
  assert.ok(avg[3] >= avg[0] && avg[5] > avg[0] + 0.15, 'Green >= White, Blue clearly above White');
  assert.ok(masher[7] > masher[5] && masher[5] > masher[0], 'masher win rate rises');
  for (let k = 1; k < 8; k++) assert.ok(avg[k] >= avg[k - 1] - 0.12, 'roughly monotonic at ' + belts[k].name);
});
