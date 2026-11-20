'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createFight, Moves } = require('../game.js');
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
  kid(rand) {            // young kid: wanders, swings now and then, ~400 ms late sometimes blocks
    let cd = 0.5, mode = 1, modeT = 0, guard = 0; const seen = [];
    return (dt, f) => {
      const i = NEUTRAL(); cd -= dt; modeT -= dt; guard -= dt;
      const me = f.fighters[0], o = f.fighters[1], d = o.x - me.x;
      seen.push({ t: (seen.length ? seen[seen.length - 1].t : 0) + dt, a: !!o.move && o.phase !== 'recovery' });
      while (seen.length > 40) seen.shift();
      const late = seen.length >= 25 && seen[seen.length - 25].a;
      if (late && guard <= 0 && rand() < 0.25) guard = 0.45;
      if (modeT <= 0) { modeT = 0.3 + rand() * 0.6; mode = rand() < 0.6 ? 1 : (rand() < 0.5 ? 0 : -1); }
      if (guard > 0) i.left = true;
      else if (mode > 0 && d > 150) i.right = true;
      else if (mode < 0) i.left = true;
      if (guard <= 0 && cd <= 0 && d < 230) { cd = 0.25 + rand() * 0.4; i[AKEYS[Math.floor(rand() * 4)]] = true; }
      return i;
    };
  },
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
  assert.strictEqual(belts[0].reactionMs, Math.round(650 / 1.2)); assert.strictEqual(belts[7].reactionMs, Math.round(150 / 1.2)); // HARDER = 1.2
  assert.strictEqual(belts[0].comboChance, 0); assert.strictEqual(belts[2].comboChance, 0); assert.ok(belts[3].comboChance > 0);
  assert.strictEqual(belts[1].spinChance, 0); assert.ok(belts[2].spinChance > 0);
  assert.strictEqual(belts[7].comboChance, 0.6); assert.strictEqual(belts[7].spinChance, 0.36);
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
  const cpu = createCpu(7, seeded(1)); const bot = bots.kid(seeded(4));
  let prev = false, attacks = 0;
  for (let i = 0; i < 3000; i++) {
    const in1 = cpu.update(1 / 60, fight, 1);
    const a = AKEYS.some(k => in1[k]);
    if (a) attacks++;
    assert.ok(!(a && prev), 'attack key held two frames in a row');
    prev = a;
    fight.update(1 / 60, bot(1 / 60, fight), in1);
  }
  assert.ok(attacks > 3);
});

// A bot walks in and throws one kind of attack (standing or low); returns the CPU's block rate (blocks / (blocks + hits)).
function blockRate(belt, limb, low, n) {
  let hit = 0, block = 0;
  for (let m = 0; m < n; m++) {
    const rnd = seeded(500 + m * 31 + belt);
    const f = createFight({ skipIntro: true, rand: rnd });
    const c = createCpu(belt, seeded(900 + m * 17 + belt));
    f.fighters[1].speedMul = c.params.speedMul;
    const reach = Moves.moves[limb + (low ? '_low' : '_stand')].reach;
    let t = 0, cd = 0.5;
    while (t < 30 && f.state === 'fighting') {
      const p = f.fighters[0], o = f.fighters[1], inp = NEUTRAL();
      if (p.move && low) inp.down = true;
      if (Math.abs(o.x - p.x) > reach - 20) inp.right = true;
      else if (!p.move && (cd -= 1 / 60) < 0) { inp[limb] = true; inp.down = low; cd = 0.4 + rnd() * 0.6; }
      f.update(1 / 60, inp, c.update(1 / 60, f, 1)); t += 1 / 60;
      for (const e of f.drainEvents()) if (e.attacker === 0) { if (e.type === 'hit') hit++; else if (e.type === 'block') block++; }
    }
  }
  return block / Math.max(1, block + hit);
}

test('CPU blocks LOW attacks too, more at higher belts', { timeout: 300000 }, () => {
  const rows = [3, 5, 7].map(k => ({ k, low: blockRate(k, 'backKick', true, 40), mid: blockRate(k, 'backKick', false, 40) }));
  console.log('\nblock rate  low / mid');
  rows.forEach(r => console.log(belts[r.k].name.padEnd(6), Math.round(r.low * 100) + '% / ' + Math.round(r.mid * 100) + '%'));
  assert.ok(rows[0].low >= 0.04, 'Green blocks some low attacks');
  assert.ok(rows[2].low >= 0.25, 'Black blocks low attacks often');
  assert.ok(rows[2].low > rows[0].low, 'Black blocks low more than Green');
  assert.ok(rows[2].low >= 0.6 * rows[2].mid, 'Black blocks low about as often as mid');
  assert.ok(rows[2].low < 0.95, 'never a perfect low block');
});

test('win rate rises with belt', { timeout: 600000 }, () => {
  const N = 100;
  const names = Object.keys(bots);
  const rates = belts.map((b, k) => names.map(n => winRate(k, n, N)));
  const avg = rates.map(r => r.reduce((a, b) => a + b, 0) / r.length);
  const pct = x => String(Math.round(x * 100)).padStart(4) + '%';
  console.log('\nCPU win rate (' + N + ' matches each)\nbelt     ' + names.map(n => n.padStart(6)).join('') + '   avg');
  belts.forEach((b, k) => console.log(b.name.padEnd(8) + ' ' + rates[k].map(pct).join('  ') + '  ' + pct(avg[k])));
  assert.ok(avg[0] < 0.3, 'White stays easy (vs scripted bots; the real kid tested at Review 3)');
  assert.ok(avg[7] > 0.7, 'Black is hard');
  assert.ok(avg[7] > avg[3] + 0.15 && avg[3] >= avg[0], 'Black >> Green >= White');
  for (let k = 1; k < 8; k++) assert.ok(avg[k] >= avg[k - 1] - 0.03, 'average rises at ' + belts[k].name);
  names.forEach((n, j) => { for (let k = 1; k < 8; k++) assert.ok(rates[k][j] >= rates[k - 1][j] - 0.15, n + ' bot: no big drop at ' + belts[k].name); });
});
