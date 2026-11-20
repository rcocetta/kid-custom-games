/*
 * Taekwondo Master review pages: shared helpers (window.TKDReview).  Plain script, works from file://.
 * One rAF loop per page (30 fps cap, paused when the tab is hidden); a canvas "item" is only drawn while it is
 * on screen (IntersectionObserver) and in the active tab group.  Static items draw once (and again on a change).
 * Needs assets.js first; moves.js + poses.js for the move/state helpers.
 */
(function () {
  'use strict';
  const A = window.TKDAssets;
  const R = { A, ver: 0, clock: 0, group: null };
  window.TKDReview = R;
  const $ = (id) => document.getElementById(id);
  R.$ = $;
  const FPS = 30, STEP = 1 / 40; // frame cap; cache quantisation of animation time (sim seconds)

  R.el = (tag, cls, text, parent) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };

  // ---------- shared settings ----------
  R.state = { look: 'oli', mirror: false, slow: false, opp: A.randomOpponent('green') };
  R.lookObj = () => (R.state.look === 'opp' ? R.state.opp : A.looks[R.state.look]);
  R.facing = () => (R.state.mirror ? -1 : 1);
  R.speed = () => (R.state.slow ? 0.25 : 1);
  R.bump = () => { R.ver++; items.forEach((it) => { it.dirty = true; }); }; // look/facing changed: drop caches, redraw

  R.header = (current, title, blurb) => {
    const h = R.el('header');
    R.el('h1', null, title, h);
    if (blurb) R.el('p', null, blurb, h);
    const nav = R.el('nav', null, null, h);
    [['Assets.html', 'Index'], ['Characters.html', 'Characters'], ['Moves.html', 'Moves'], ['States.html', 'States'],
      ['Poser.html', 'Poser'], ['Arena.html', 'Arena']].forEach(([href, t]) => {
      const a = R.el('a', href === current ? 'cur' : '', t, nav); a.href = href;
    });
    document.body.insertBefore(h, document.body.firstChild);
  };

  // controls: spec { look, mirror, slow, reroll }
  R.controls = (parent, spec) => {
    const c = R.el('div', 'controls', null, parent);
    if (spec.look) {
      c.append('Fighter ');
      const s = R.el('select', null, null, c);
      [['oli', 'Oli'], ['dani', 'Dani'], ['opp', 'Random opponent']].forEach(([v, t]) => { const o = R.el('option', null, t, s); o.value = v; });
      s.value = R.state.look;
      s.onchange = () => { R.state.look = s.value; R.bump(); };
    }
    const chk = (label, key) => {
      const l = R.el('label', null, null, c); const i = R.el('input', null, null, l); i.type = 'checkbox';
      l.append(' ' + label);
      i.onchange = () => { R.state[key] = i.checked; R.bump(); };
    };
    if (spec.mirror) chk('facing left', 'mirror');
    if (spec.slow) chk('slow motion (x0.25)', 'slow');
    if (spec.reroll) {
      const b = R.el('button', null, 'New opponent', c);
      b.onclick = () => { R.state.opp = A.randomOpponent('green'); R.bump(); if (R.onReroll) R.onReroll(); };
    }
    return c;
  };

  // ---------- canvas items ----------
  const items = [];
  const dprOf = () => Math.min(2, window.devicePixelRatio || 1);
  let io = null;
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((es) => es.forEach((e) => {
      const it = e.target._item; if (!it) return;
      it.visible = e.isIntersecting;
      if (it.visible) it.dirty = true;
      else it.cache = null; // free path caches of tiles scrolled away
    }), { rootMargin: '80px' });
  }
  /**
   * R.item({ canvas, w, h, animated, group, draw(ctx, t, item) })  w/h = logical drawing size.
   * The backing store is w*dpr x h*dpr (dpr capped at 2), allocated on first draw.
   */
  R.item = (o) => {
    const it = Object.assign({ visible: !io, dirty: true, animated: false, group: null, ver: 0, cache: null }, o);
    it.ctx = it.canvas.getContext('2d');
    it.canvas.style.aspectRatio = it.w + ' / ' + it.h;
    it.canvas._item = it;
    items.push(it);
    if (io) io.observe(it.canvas);
    return it;
  };
  function paint(it, t) {
    const k = dprOf();
    const pw = Math.round(it.w * k), ph = Math.round(it.h * k);
    if (it.canvas.width !== pw || it.canvas.height !== ph) { it.canvas.width = pw; it.canvas.height = ph; }
    it.ctx.setTransform(k, 0, 0, k, 0, 0);
    it.ctx.clearRect(0, 0, it.w, it.h);
    if (it.ver !== R.ver) { it.cache = null; it.ver = R.ver; }
    it.draw(it.ctx, t, it);
  }
  R.drawItem = (it) => { it.dirty = true; };

  // cached primitives for an animated item: build(tq) -> prims, keyed by quantised time
  R.cached = (it, t, build) => {
    if (!it.cache || it.cache.size > 240) it.cache = new Map();
    const idx = Math.round(t / STEP);
    let v = it.cache.get(idx);
    if (!v) { v = build(idx * STEP); it.cache.set(idx, v); }
    return v;
  };

  // ---------- the loop ----------
  let last = null, lastDraw = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = null; return; }
    if (ts - lastDraw < 1000 / FPS - 2) return;
    lastDraw = ts;
    if (last != null) R.clock += Math.min(0.1, (ts - last) / 1000) * R.speed();
    last = ts;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.visible || (it.group && it.group !== R.group)) continue;
      if (it.animated || it.dirty) { it.dirty = false; paint(it, R.clock); }
    }
  }
  R.start = () => requestAnimationFrame(frame);
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', () => { last = null; });

  // ---------- tabs: lazy panels, only the active group is drawn ----------
  R.tabs = (parent, names, build) => {
    const bar = R.el('div', 'controls', null, parent);
    const panels = {}, btns = {};
    function show(n) {
      R.group = n;
      names.forEach((m) => { panels[m].style.display = m === n ? '' : 'none'; btns[m].classList.toggle('on', m === n); });
      if (!panels[n]._built) { panels[n]._built = true; build(n, panels[n]); }
      items.forEach((it) => { if (it.group === n) it.dirty = true; });
    }
    names.forEach((n) => {
      btns[n] = R.el('button', 'tab', n, bar); btns[n].onclick = () => show(n);
      panels[n] = R.el('div', null, null, parent); panels[n].style.display = 'none';
    });
    show(names[0]);
  };

  // ---------- fighter drawing ----------
  R.ground = (ctx, w, h) => { ctx.fillStyle = '#DCE6F5'; ctx.fillRect(0, h * 0.91, w, h * 0.09); };

  // animated tile: sample(t) -> { pose, expr, y };  len = loop length (s)
  R.tile = (parent, o) => {
    const d = R.el('div', 'tile', null, parent);
    const cv = R.el('canvas', null, null, d);
    R.el('div', 'nm', o.name, d);
    if (o.ko) R.el('div', 'ko', o.ko, d);
    if (o.extra) R.el('div', 'muted', o.extra, d);
    const W = 220, H = 330, sc = 0.72;
    return R.item({ canvas: cv, w: W, h: H, animated: true, group: o.group || null, draw(ctx, clock, it) {
      const prims = R.cached(it, clock % o.len, (t) => {
        const r = o.sample(t), f = R.facing();
        return A.drawFighter(R.lookObj(), r.pose, { facing: f, expression: r.expr, x: f > 0 ? 70 : 150, y: 300 - r.y * sc, scale: sc });
      });
      ctx.fillStyle = '#DCE6F5'; ctx.fillRect(0, 300, W, 30);
      A.drawToCanvas(ctx, prims);
    } });
  };

  // static fighter canvas (drawn once, redrawn on a settings change): poseFn() -> { pose, expr, y }
  R.still = (parent, o) => {
    const cv = R.el('canvas', null, null, parent);
    const W = o.w || 400, H = o.h || 440;
    return R.item({ canvas: cv, w: W, h: H, group: o.group || null, draw(ctx) {
      const r = o.pose();
      const prims = A.drawFighter(o.look ? o.look() : R.lookObj(), r.pose, { facing: o.fixedFacing || R.facing(), expression: r.expr || 'fierce', x: W * 0.5, y: H * 0.9 - (r.y || 0), scale: o.scale || 1 });
      ctx.fillStyle = '#DCE6F5'; ctx.fillRect(0, H * 0.91, W, H * 0.09);
      A.drawToCanvas(ctx, prims);
    } });
  };

  // ---------- move helpers (need moves.js + poses.js) ----------
  R.initMoves = () => {
    const M = window.TKDMoves, TP = window.TKDPoses;
    const T = M.tuning, JV = 4 * T.jumpHeight / T.jumpDuration, G = 8 * T.jumpHeight / (T.jumpDuration * T.jumpDuration);
    const PAUSE = 0.35;
    const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
    const mv = { M, TP, JV, G, PAUSE };
    mv.jumpY = (t) => Math.max(0, JV * t - 0.5 * G * t * t);
    mv.label = (m) => {
      const b = TP.info.moves[m.spin ? m.limb + '_spin' : m.limb];
      const v = TP.info.variants[m.variant];
      return { en: v ? cap(v) + ' ' + b.en.toLowerCase() : b.en, ko: (m.variant === 'jump' ? 'Ttwieo ' : '') + b.ko };
    };
    mv.fighterAt = (m, t) => {
      const air = m.variant === 'jump';
      const y = air ? mv.jumpY(t) : 0;
      if (t < m.total) {
        const phase = t < m.startup ? 'startup' : t < m.startup + m.active ? 'active' : 'recovery';
        const pt = phase === 'startup' ? t / m.startup : phase === 'active' ? (t - m.startup) / m.active : (t - m.startup - m.active) / m.recovery;
        return { action: 'attack', moveId: m.id, phase, phaseT: pt, y, vy: JV - G * t, x: 0, facing: 1 };
      }
      if (y > 0) return { action: 'jump', y, vy: JV - G * t, x: 0, facing: 1 };
      return { action: 'idle', y: 0, vy: 0, x: 0, facing: 1 };
    };
    mv.loopLen = (m) => Math.max(m.total, m.variant === 'jump' ? T.jumpDuration : 0) + PAUSE;
    mv.moveSample = (m) => (t) => { const f = mv.fighterAt(m, t); const r = TP.forFighter(f, { time: t }); return { pose: r.pose, expr: r.expression, y: f.y }; };
    mv.moveTile = (parent, m, group) => {
      const l = mv.label(m);
      return R.tile(parent, { name: l.en, ko: l.ko, extra: `${m.level} - dmg ${m.damage} - ${m.startup}/${m.active}/${m.recovery}s`, len: mv.loopLen(m), sample: mv.moveSample(m), group });
    };
    const stateLen = (st) => TP.states[st].loop ? Math.max(TP.duration(st) * (st === 'idle' ? 1 : 2), 0.7) : TP.duration(st) + PAUSE + 0.2;
    mv.stateTile = (parent, st, group) => {
      const i = TP.info.states[st];
      return R.tile(parent, { name: i.en, ko: i.ko, extra: st, len: stateLen(st), group, sample: (t) => {
        const d = TP.duration(st), u = TP.states[st].loop ? t / d : Math.min(t / d, 1);
        return { pose: TP.sample(st, u), expr: TP.expression(st), y: st === 'jump' ? mv.jumpY(t) : st === 'hitAir' ? 70 : 0 };
      } });
    };
    // static key-frame row: chamber / extension / retract, drawn once
    mv.keyRow = (parent, m, group) => {
      const l = mv.label(m), kf = TP.keyFrames(m.id);
      const row = R.el('div', 'krow', null, parent);
      const lab = R.el('div', 'lab', null, row);
      R.el('b', null, l.en, lab); lab.append(document.createElement('br'), l.ko, document.createElement('br'), `${m.level} - dmg ${m.damage}`);
      ['chamber', 'extension', 'retract'].forEach((k) => {
        const h = R.el('div', 'kf', null, row);
        const air = m.variant === 'jump' ? 90 : 0;
        const cv = R.el('canvas', null, null, h);
        R.item({ canvas: cv, w: 300, h: 330, group, draw(ctx) {
          const f = R.facing();
          A.drawToCanvas(ctx, A.drawFighter(R.lookObj(), kf[k], { facing: f, expression: 'fierce', x: f > 0 ? 130 : 170, y: 300 - air * 0.8, scale: 0.8 }));
        } });
        R.el('div', 'muted', k, h);
      });
    };
    // pair view: attacker + opponent, target heights, reach line
    mv.pairView = (parent, moves, group) => {
      const c = R.el('div', 'controls', 'Move ', parent);
      const sel = R.el('select', null, null, c);
      moves.forEach((m) => { const o = R.el('option', null, mv.label(m).en + ' [' + m.id + ']', sel); o.value = m.id; });
      sel.value = M.moves.backKick_stand ? 'backKick_stand' : moves[0].id;
      const info = R.el('span', 'muted', '', c);
      const cv = R.el('canvas', null, null, parent);
      const LV = { HIGH: 250, MID: 170, LOW: 60 };
      R.item({ canvas: cv, w: 620, h: 450, animated: true, group, draw(pc, clock) {
        const m = M.moves[sel.value], FY = 410, X0 = 120;
        info.textContent = `${m.level}, reach ${m.reach}`;
        pc.fillStyle = '#DCE6F5'; pc.fillRect(0, FY, 620, 40);
        pc.font = '12px sans-serif';
        Object.keys(LV).forEach((k) => {
          pc.strokeStyle = k === m.level ? '#E5383B' : '#B9C4D8'; pc.setLineDash([6, 6]);
          pc.beginPath(); pc.moveTo(0, FY - LV[k]); pc.lineTo(620, FY - LV[k]); pc.stroke();
          pc.fillStyle = '#7a8599'; pc.fillText(k, 4, FY - LV[k] - 3);
        });
        pc.strokeStyle = '#E5383B'; pc.beginPath(); pc.moveTo(X0 + m.reach, FY - 310); pc.lineTo(X0 + m.reach, FY); pc.stroke(); pc.setLineDash([]);
        const f = mv.fighterAt(m, clock % mv.loopLen(m));
        const r = TP.forFighter(f, { time: clock });
        const look = R.lookObj();
        A.drawToCanvas(pc, A.drawFighter(R.state.look === 'opp' ? A.looks.oli : R.state.opp, TP.sample('idle', clock / 0.72), { facing: -1, x: X0 + m.reach, y: FY }));
        A.drawToCanvas(pc, A.drawFighter(look, r.pose, { facing: 1, expression: r.expression, x: X0, y: FY - f.y }));
        const sk = A.skeleton(look, r.pose, { x: X0, y: FY - f.y });
        const tip = m.limb.indexOf('Kick') > 0 ? sk[(m.limb === 'frontKick' && !m.spin ? 'f' : 'b') + 'Toe'] : sk[(m.limb === 'frontPunch' ? 'f' : 'b') + 'Fist'];
        pc.strokeStyle = '#E5383B'; pc.lineWidth = 3; pc.beginPath(); pc.arc(tip[0], tip[1], 7, 0, 7); pc.stroke(); pc.lineWidth = 1;
      } });
      sel.onchange = () => { items.forEach((it) => { it.dirty = true; }); };
    };
    return mv;
  };
})();
