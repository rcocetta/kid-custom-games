/* Whack-a-m-Oli: synthesised sound effects (Web Audio, no audio files).
 * Exposes window.WAMAudio = { play(type, ev), unlock(), muted, setMuted(bool) }.
 * game.js calls play(e.type, e) for every core event; the mute button lives in index.html.
 * Every call is safe: without Web Audio, or with storage blocked, it does nothing. */
(function () {
  'use strict';

  var KEY = 'whackamoli:mute';
  var MASTER = 0.35;          // quiet overall level
  var ctx = null;             // AudioContext, created by unlock() on a user gesture
  var master = null;          // master gain -> limiter -> speakers
  var noise = null;           // shared 1 s white-noise buffer
  var muted = readMute();
  var lastAt = {};            // name -> time of last play, for the overlap limit

  // Minimum gap (ms) between two plays of the same sound, so bursts never stack up.
  var GAP = {
    throw: 110, hit: 90, ground: 140, emerge: 90, eat: 160, foodSpawn: 220, start: 300
  };

  function readMute() {
    try { return window.localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }

  function writeMute(on) {
    try { window.localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* storage blocked */ }
  }

  // Create the context on a user gesture, or resume it (iOS/Safari suspend it).
  function unlock() {
    try {
      if (!ctx) {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = MASTER;
        var limiter = ctx.createDynamicsCompressor();
        master.connect(limiter);
        limiter.connect(ctx.destination);
        noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        var d = noise.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended' && ctx.resume) {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) { /* no usable Web Audio: stay silent */ }
  }

  // Gain envelope: quick attack to `peak`, exponential decay to silence at t + dur.
  function shape(node, t, peak, attack, dur) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    g.connect(master);
  }

  // Oscillator through a list of [offset seconds, frequency Hz] points (glides between them).
  function glide(type, pts, t, dur, peak, attack) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(pts[0][1], t);
    for (var i = 1; i < pts.length; i++) {
      o.frequency.exponentialRampToValueAtTime(pts[i][1], t + pts[i][0]);
    }
    shape(o, t, peak, attack, dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Filtered white-noise burst whose filter sweeps from f0 to f1 Hz.
  function hiss(filterType, f0, f1, q, t, dur, peak, attack) {
    var s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    s.connect(f);
    shape(f, t, peak, attack, dur);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  // Each sound takes (t = start time, v = volume 0..1).
  var SOUNDS = {
    // Soft air whoosh as the hammer leaves.
    throw: function (t, v) {
      hiss('bandpass', 400, 1800, 1.2, t, 0.18, 0.22 * v, 0.03);
    },
    // Cartoon boing: pitch springs up, then bounces down.
    hit: function (t, v) {
      glide('triangle', [[0, 220], [0.08, 700], [0.34, 160]], t, 0.36, 0.3 * v, 0.006);
    },
    // Soft dirt thud.
    ground: function (t, v) {
      hiss('lowpass', 500, 140, 0.7, t, 0.12, 0.22 * v, 0.004);
      glide('sine', [[0, 110], [0.12, 55]], t, 0.14, 0.3 * v, 0.004);
    },
    // Little bubble pop as a mole pops out.
    emerge: function (t, v) {
      glide('sine', [[0, 300], [0.06, 900]], t, 0.09, 0.22 * v, 0.003);
    },
    // Munch-munch, then a sad little falling tone for the lost carrot.
    eat: function (t, v) {
      hiss('lowpass', 1200, 300, 1.5, t, 0.07, 0.25 * v, 0.003);
      hiss('lowpass', 1200, 300, 1.5, t + 0.13, 0.07, 0.25 * v, 0.003);
      glide('triangle', [[0, 392], [0.3, 277]], t + 0.3, 0.34, 0.16 * v, 0.01);
    },
    // Tiny quiet sparkle when food appears.
    foodSpawn: function (t, v) {
      glide('sine', [[0, 1568]], t, 0.07, 0.07 * v, 0.004);
      glide('sine', [[0, 2093]], t + 0.05, 0.1, 0.06 * v, 0.004);
    },
    // Happy rising arpeggio.
    levelUp: function (t, v) {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (hz, i) {
        var last = i === notes.length - 1;
        glide('triangle', [[0, hz]], t + i * 0.1, last ? 0.5 : 0.16, 0.22 * v, 0.01);
      });
    },
    // Gentle descending "wah-wah-wah-waaah", not scary.
    gameover: function (t, v) {
      glide('triangle', [[0, 392]], t, 0.3, 0.2 * v, 0.01);
      glide('triangle', [[0, 349]], t + 0.3, 0.3, 0.2 * v, 0.01);
      glide('triangle', [[0, 330]], t + 0.6, 0.3, 0.2 * v, 0.01);
      glide('triangle', [[0, 311], [0.8, 233]], t + 0.9, 0.9, 0.2 * v, 0.01);
    },
    // Short friendly blip when a round starts.
    start: function (t, v) {
      glide('sine', [[0, 660], [0.1, 990]], t, 0.12, 0.2 * v, 0.004);
    }
  };

  // Play a named sound. Silent when muted, before unlock(), or when it plays too soon after itself.
  function play(name, ev) {
    try {
      if (muted || !ctx || ctx.state !== 'running') return;
      var fn = SOUNDS[name];
      if (!fn) return;
      var now = performance.now();
      var gap = GAP[name] || 0;
      if (lastAt[name] !== undefined && now - lastAt[name] < gap) return;
      lastAt[name] = now;
      fn(ctx.currentTime + 0.01, 1);
    } catch (e) { /* never let audio break the game */ }
  }

  function setMuted(on) {
    muted = !!on;
    writeMute(muted);
  }

  window.WAMAudio = {
    play: play,
    unlock: unlock,
    setMuted: setMuted,
    get muted() { return muted; },
    set muted(on) { setMuted(on); }
  };

  // Unlock on the first gesture (touch, click or key). Harmless to repeat.
  ['pointerdown', 'touchend', 'keydown'].forEach(function (type) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  });

  // M toggles mute by clicking the on-screen button, so both stay in step.
  window.addEventListener('keydown', function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== 'm' && e.key !== 'M') return;
    var btn = document.getElementById('mute');
    if (btn && !btn.hidden) btn.click();
  });
})();
