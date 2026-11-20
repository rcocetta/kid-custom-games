/* Taekwondo Master: synthesised sound effects (Web Audio, no audio files).
 * Exposes window.TKDAudio = { unlock, play, setMuted, isMuted }.
 * Every call is safe: without Web Audio, or with storage blocked, it does nothing. */
(function () {
  'use strict';

  var KEY = 'taekwondo:mute';
  var JITTERED = { whoosh: 1, punch: 1, kick: 1, block: 1 }; // repeats vary by +-5%
  var ctx = null;     // AudioContext, created by unlock()
  var master = null;  // master gain -> limiter -> speakers
  var noise = null;   // shared 1 s white-noise buffer
  var muted = readMute();

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
        master.gain.value = 0.5;
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

  // Gain envelope: quick attack to `peak`, exponential decay to silence over `dur`.
  function shape(node, t, peak, attack, dur) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    g.connect(master);
  }

  // Oscillator note gliding from f0 to f1 Hz.
  function tone(type, f0, f1, t, dur, peak, attack) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
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

  // Each sound: (t = start time, v = volume 0..1, p = pitch multiplier).
  var SOUNDS = {
    whoosh: function (t, v, p) {
      hiss('bandpass', 500 * p, 2200 * p, 1.2, t, 0.2, 0.35 * v, 0.04);
    },
    punch: function (t, v, p) {
      tone('sine', 170 * p, 70 * p, t, 0.14, 0.7 * v, 0.005);
      hiss('highpass', 2000 * p, 2000 * p, 0.7, t, 0.04, 0.25 * v, 0.002);
    },
    kick: function (t, v, p) {
      tone('sine', 120 * p, 40 * p, t, 0.22, 0.85 * v, 0.005);
      hiss('lowpass', 700 * p, 300 * p, 0.7, t, 0.09, 0.3 * v, 0.003);
    },
    block: function (t, v, p) {
      tone('triangle', 900 * p, 650 * p, t, 0.07, 0.4 * v, 0.002);
      hiss('bandpass', 2600 * p, 2600 * p, 3, t, 0.035, 0.35 * v, 0.002);
    },
    ko: function (t, v, p) {
      tone('triangle', 700 * p, 140 * p, t, 0.65, 0.35 * v, 0.01);   // "bwoing"
      tone('sine', 90 * p, 45 * p, t + 0.6, 0.3, 0.6 * v, 0.005);    // thud
    },
    bell: function (t, v, p) {
      // Inharmonic partials give a gong-like shimmer.
      [[1, 0.3], [2.76, 0.12], [5.4, 0.05]].forEach(function (k) {
        tone('sine', 523 * p * k[0], 523 * p * k[0], t, 2.0, k[1] * v, 0.003);
      });
    },
    win: function (t, v, p) {
      var notes = [523, 659, 784, 1047, 1319];
      notes.forEach(function (hz, i) {
        var last = i === notes.length - 1;
        tone('triangle', hz * p, hz * p, t + i * 0.12, last ? 0.8 : 0.22, 0.3 * v, 0.01);
      });
    },
    lose: function (t, v, p) {
      // Descending "wah-wah-wah-waaah".
      tone('triangle', 392 * p, 392 * p, t, 0.28, 0.3 * v, 0.01);
      tone('triangle', 349 * p, 349 * p, t + 0.3, 0.28, 0.3 * v, 0.01);
      tone('triangle', 330 * p, 330 * p, t + 0.6, 0.28, 0.3 * v, 0.01);
      tone('triangle', 311 * p, 233 * p, t + 0.9, 0.8, 0.3 * v, 0.01);
    },
    blip: function (t, v, p) {
      tone('sine', 880 * p, 1320 * p, t, 0.06, 0.25 * v, 0.003);
    },
    trophy: function (t, v, p) {
      // [pitch, start, length] fanfare, plus a held C major chord at the end.
      var melody = [[392, 0, 0.13], [523, 0.13, 0.13], [659, 0.26, 0.13], [784, 0.39, 0.35],
        [659, 0.8, 0.13], [784, 0.93, 0.13], [1047, 1.06, 0.85]];
      melody.forEach(function (n) {
        tone('triangle', n[0] * p, n[0] * p, t + n[1], n[2], 0.28 * v, 0.01);
        tone('sine', n[0] * p / 2, n[0] * p / 2, t + n[1], n[2], 0.1 * v, 0.01);
      });
      [523, 659, 784].forEach(function (hz) {
        tone('sine', hz * p, hz * p, t + 1.06, 0.9, 0.1 * v, 0.05);
      });
    }
  };

  // Play a named sound. opts: { volume: 0..1, pitch: multiplier }.
  function play(name, opts) {
    try {
      if (muted || !ctx || ctx.state === 'suspended' || ctx.state === 'closed') return;
      var fn = SOUNDS[name];
      if (!fn) return;
      opts = opts || {};
      var v = Number(opts.volume);
      v = isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
      var p = Number(opts.pitch) > 0 ? Number(opts.pitch) : 1;
      if (JITTERED[name]) p *= 1 + (Math.random() * 2 - 1) * 0.05;
      fn(ctx.currentTime + 0.01, v, p);
    } catch (e) { /* never let audio break the game */ }
  }

  function setMuted(on) {
    muted = !!on;
    writeMute(muted);
  }

  function isMuted() {
    return muted;
  }

  window.TKDAudio = { unlock: unlock, play: play, setMuted: setMuted, isMuted: isMuted };
})();
