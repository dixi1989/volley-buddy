/* Beach Volley Hero – frontend: canvas rendering, input, menus, high scores, sound */
(function () {
  'use strict';
  const { C, Sim, LEVELS, FIGURES, STAGE_IDS } = VB;
  const { Net } = VBNet;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), mainCtx = canvas.getContext('2d');
  let ctx = mainCtx;            // the world is drawn into a small canvas (pixel look), HUD and name tags into the big one
  const PIX = 2;                // size of one "pixel" in game units (2 = fine pixels, 3 = chunkier)
  const lo = document.createElement('canvas'); lo.width = C.W / PIX; lo.height = C.H / PIX;
  const loCtx = lo.getContext('2d');
  const FONT = '"Jersey 10", system-ui, sans-serif';
  try { document.fonts.load('700 14px "Jersey 10"'); } catch (e) { /* ignore */ }

  /* ------------------------------------------------------------- storage */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
    }
  };
  const LEVEL_MAP = { leicht: 'easy', mittel: 'normal', schwer: 'hard' };   // saved by earlier versions
  const LEVEL_LABEL = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
  const settings = Object.assign({ level: 'normal', target: 11, muted: false, music: true, track: 'miami', fight: false, stage: 'beach' }, store.get('vb_settings', {}));
  settings.level = LEVEL_MAP[settings.level] || settings.level;
  if (!LEVELS[settings.level]) settings.level = 'normal';
  let names = Object.assign({ p1: '', p2: '' }, store.get('vb_names', {}));
  let scores = store.get('vb_scores', []);
  let duel = store.get('vb_duel', [0, 0]);
  const saveSettings = () => store.set('vb_settings', settings);

  $('level').value = settings.level; $('target').value = String(settings.target); $('onRules').value = 'fight'; $('onTarget').value = String(settings.target);
  if (!['beach', 'moon', 'water', 'doner', 'hole', 'random'].includes(settings.stage)) settings.stage = 'beach';
  $('onStage').value = settings.stage;
  $('onStage').addEventListener('change', () => { settings.stage = $('onStage').value; saveSettings(); syncStageTiles(); });
  /* stage select: own step after the hero select (local modes) */
  function syncStageTiles() { document.querySelectorAll('#stageTiles [data-stage]').forEach(b => b.classList.toggle('sel', b.dataset.stage === settings.stage)); }
  document.querySelectorAll('#stageTiles [data-stage]').forEach(b => { b.onclick = () => { settings.stage = b.dataset.stage; $('onStage').value = settings.stage; saveSettings(); syncStageTiles(); syncSegs(); }; });
  syncStageTiles();
  const pickStage = v => v === 'random' ? STAGE_IDS[Math.floor(Math.random() * STAGE_IDS.length)] : v;
  /* pixel buttons side by side replace the dropdowns (the hidden <select> keeps the value, so the rest of the code is unchanged) */
  const SEGS = ['level', 'target', 'onRules',, 'onTarget', 'onStage'].map(id => {
    const sel = $(id), box = document.querySelector('[data-for="' + id + '"]');
    [...sel.options].forEach(o => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = o.textContent; b.dataset.v = o.value; b.dataset.k = 'seg:' + id + ':' + o.value;
      b.onclick = () => { sel.value = o.value; sel.dispatchEvent(new Event('change')); syncSegs(); };
      box.appendChild(b);
    });
    return [sel, box];
  });
  function syncSegs() { SEGS.forEach(([sel, box]) => [...box.children].forEach(b => b.classList.toggle('sel', b.dataset.v === sel.value))); }
  syncSegs();

  /* ------------------------------------------------------- touch controls */
  const touchMode = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;
  const keys = new Set();
  const TOUCH_BTNS = [...document.querySelectorAll('#touch [data-k]')];
  function releaseTouchKeys() { TOUCH_BTNS.forEach(b => { keys.delete(b.dataset.k); b.classList.remove('on'); }); }

  /* --------------------------------------------------------------- state */
  let phase = 'menu';           // menu | setup | scores | play | pause | over
  let game = null, demo = null, setupMode = null, lastSetup = null;
  let online = null;            // online match state (see 'online play' below)
  const MENU_PHASES = new Set(['menu', 'changelog', 'mode', 'setup', 'stage', 'online', 'scores', 'powerups', 'controls', 'howto']);
  const COLORS = { blue: '#3aa0ff', red: '#ff5a55', green: '#4cd964', yellow: '#ffc933' };
  const PALETTE = [['Blue', '#3aa0ff'], ['Red', '#ff5a55'], ['Green', '#4cd964'], ['Yellow', '#ffc933'],
                   ['Orange', '#ff9a3c'], ['Purple', '#b36bff'], ['Pink', '#ff7ac8'], ['Turquoise', '#2fd9c8']];
  const looks = Object.assign({ p1: { color: PALETTE[7][1], style: 'ninja' }, p2: { color: PALETTE[6][1], style: 'cowboy' } }, store.get('vb_looks', {}));
  ['p1', 'p2'].forEach(k => { if (!FIGURES[looks[k].style]) looks[k].style = k === 'p1' ? 'ninja' : 'cowboy'; });
  /* name / figure / colour picker used by the setup screen and the online lobby */
  /* Ability texts shown in the hero select (keep in sync with MELEE / RANGED in engine.js) */
  const WEAPON_INFO = {
    sword: ['Sword', 'All-rounder: solid smash, medium reach.'],
    katana: ['Katana', 'Fastest, flat smash and a short recharge.'],
    kebabknife: ['Doner knife', 'Fastest, flat smash and a short recharge (like the katana).'],
    lasso: ['Lasso', 'Very long reach: lobs the ball high over the net. Slow recharge.'],
    rod: ['Birch rod', 'The ball dips steeply behind the net. Short reach.'],
    shotgun: ['Shotgun', '3 pellets, short range, slow reload.'],
    revolver: ['Revolver', '1 bullet, fires again quickly.'],
    pickle: ['Gherkin cannon', 'Shoots gherkin slices that bend the ball into their direction. Slow to reload.'],
    kick: ['Kick', 'Kicks the ball from below: it flies up and forward. Medium reach.'],
    bolt: ['Thunder', 'Lightning bolts fly in all directions at once and bend the ball. No aiming – just press the key.'],
    hole: ['Black hole cannon', 'A hit swallows the ball: it drops from the sky at a random spot on the opponents\' side. Slow recharge.'],
    bat: ['Baseball bat', 'Fastest, flat smash and a short recharge (like the katana).'],
    bouquet: ['Rainbow bouquet', 'Fires a fan of 3 rainbow rays: they speed the ball up toward the opponents or slow it down. Slow-ish recharge.']
  };
  const figName = id => FIGURES[id].name;
  const styleOf = v => (FIGURES[v] ? v : VB.DEFAULT_FIGURE);
  function drawTile(c, spec) {
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    x.setTransform(1 / PIX, 0, 0, 1 / PIX, c.width / 2, c.height / 2 - 364 / PIX);
    Scene.preview(x, spec, 0);
  }
  const previews = [{ c: $('prev1'), slot: 'p1' }, { c: $('prev2'), slot: 'p2' }, { c: $('prevOn'), slot: 'p1' }];
  function fillLook(box, slot, other, rerender) {
    const me = looks[slot], oth = other ? looks[other] : null;
    // keep the keyboard focus on the same control after the picker is rebuilt
    const redo = () => {
      const k = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
      rerender();
      if (k) { const e = document.querySelector('[data-k="' + k + '"]'); if (e) e.focus(); }
    };
    box.innerHTML = '';
    const tiles = document.createElement('div'); tiles.className = 'tiles';
    Object.keys(FIGURES).forEach(id => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tile' + (me.style === id ? ' sel' : ''); b.dataset.k = box.id + ':f:' + id;
      const cv = document.createElement('canvas'); cv.width = cv.height = 36;
      drawTile(cv, { style: id, color: me.color });
      const cap = document.createElement('span'); cap.textContent = figName(id);
      const kind = VB.kindOf(id), cat = document.createElement('small'); cat.className = 'cat ' + kind; cat.textContent = kind === 'ranged' ? '🔫' : '⚔'; cat.title = kind === 'ranged' ? 'Ranged weapon' : 'Melee weapon';
      b.append(cv, cap, cat);
      b.onclick = () => { me.style = id; store.set('vb_looks', looks); redo(); };
      tiles.appendChild(b);
    });
    const r2 = document.createElement('div'); r2.className = 'lrow';
    const gap = document.createElement('span'); gap.className = 'gap'; r2.appendChild(gap);
    PALETTE.forEach(([name, col]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.background = col; b.title = name + (' swimwear'); b.dataset.k = box.id + ':c:' + col;
      if (me.color === col) b.classList.add('sel');
      if (oth && oth.color === col) b.classList.add('taken');
      b.onclick = () => { if (oth && oth.color === col) return; me.color = col; store.set('vb_looks', looks); redo(); };
      r2.appendChild(b);
    });
    // ability description of the (focused or selected) hero
    const desc = document.createElement('div'); desc.className = 'hdesc';
    const showDesc = id => { const w = FIGURES[id].weapon, i = WEAPON_INFO[w], ranged = VB.kindOf(id) === 'ranged'; desc.innerHTML = '<b>' + (ranged ? '🔫' : '⚔') + ' ' + i[0] + '</b> <i>' + (ranged ? 'Ranged' : 'Melee') + '</i> – ' + i[1] + (ranged ? ' A hit on an opponent stuns and pushes them back.' : ''); };
    showDesc(me.style);
    [...tiles.children].forEach(t => {
      const id = t.dataset.k.split(':')[2];
      ['mouseenter', 'focus'].forEach(ev => t.addEventListener(ev, () => showDesc(id)));
      ['mouseleave', 'blur'].forEach(ev => t.addEventListener(ev, () => showDesc(me.style)));
    });
    box.append(tiles, desc, r2);
  }
  function renderLooks() {
    const two = setupMode !== 'solo';
    fillLook($('look1'), 'p1', two ? 'p2' : null, renderLooks);
    fillLook($('look2'), 'p2', 'p1', renderLooks);
  }
  /* animated previews of the chosen figures (low-res canvas, same pixel size as in the game) */
  /* stage previews: the real backdrops, scaled down (about 12 fps) */
  let stPrevT = 0;
  function drawStagePreviews(t) {
    if (t - stPrevT < 0.08) return; stPrevT = t;
    document.querySelectorAll('#stageTiles [data-stage]').forEach((b, n) => {
      const cv = b.querySelector('canvas'), c = cv.getContext('2d'), id = b.dataset.stage, k = cv.width / C.W;
      c.setTransform(k, 0, 0, k, 0, 0); c.imageSmoothingEnabled = false;
      if (id !== 'random') { Scene.drawBackground(c, t, null, id); return; }
      const ids = ['beach', 'moon', 'water', 'doner'];     // random: four stages in quarters, a question mark on top
      ids.forEach((sid, q) => { c.save(); c.beginPath(); c.rect((q % 2) * C.W / 2, (q >> 1) * C.H / 2, C.W / 2, C.H / 2); c.clip(); Scene.drawBackground(c, t, null, sid); c.restore(); });
      c.fillStyle = 'rgba(10,5,30,.45)'; c.fillRect(0, 0, C.W, C.H);
      c.fillStyle = '#ffe45e'; c.textAlign = 'center'; c.font = '700 320px "Jersey 10", system-ui, sans-serif'; c.fillText('?', C.W / 2, C.H * 0.78);
    });
  }
  function drawPreviews(t) {
    if (phase === 'stage') drawStagePreviews(t);
    if (phase !== 'setup' && phase !== 'online') return;
    for (const p of previews) {
      if (!p.c.offsetParent) continue;
      const c = p.c.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, p.c.width, p.c.height);
      c.setTransform(1 / PIX, 0, 0, 1 / PIX, p.c.width / 2, p.c.height / 2 - 364 / PIX);
      Scene.preview(c, looks[p.slot], t);
    }
  }

  function setPhase(p) {
    syncSegs();
    phase = p;
    $('menu').hidden = p !== 'menu';
    $('modeSel').hidden = p !== 'mode';
    $('setup').hidden = p !== 'setup';
    $('stageSel').hidden = p !== 'stage';
    $('online').hidden = p !== 'online';
    $('scores').hidden = p !== 'scores';
    $('powerups').hidden = p !== 'powerups';
    $('controls').hidden = p !== 'controls';
    $('howto').hidden = p !== 'howto';
    $('changelog').hidden = p !== 'changelog';
    $('pause').hidden = p !== 'pause';
    $('over').hidden = p !== 'over';
    // keyboard navigation: focus the first button of the end-of-match / pause dialog
    if (p === 'over') $('btnAgain').focus(); else if (p === 'pause') $('btnResume').focus();
    const focusFirst = { menu: () => document.querySelector('#menu [data-rules]'), mode: () => document.querySelector('#modeSel [data-mode]'), stage: () => document.querySelector('#stageTiles .sel') || document.querySelector('#stageTiles button'), scores: () => $('btnScoresBack'), powerups: () => $('btnPowerupsBack'), controls: () => $('btnControlsBack'), howto: () => $('btnHowtoBack'), changelog: () => $('btnChangelogBack') }[p];
    if (focusFirst) { const e = focusFirst(); if (e) e.focus(); }
    $('touch').hidden = !(touchMode && p === 'play');
    if (p === 'play') { const tl = document.querySelector('#touch [data-k="TouchSpecial"] small'); if (tl) tl.textContent = game && game.fight ? 'WEAPON' : 'POWER-UP'; }
    if (p !== 'play') releaseTouchKeys();
    applyTrack();
  }
  /* ---- menu input, independent of the device ----
   * Every menu action goes through uiAction('up' | 'down' | 'left' | 'right' | 'ok' | 'back'). The keyboard is wired below; a gamepad
   * (d-pad / stick -> directions, A -> ok, B -> back) only has to call uiAction() as well, e.g. from a navigator.getGamepads() poll.
   * In play, controls are read from the `keys` set via MAP.P1 / MAP.P2: a gamepad can add its own codes there like the Touch* ones. */
  function uiAction(a) {
    if (a === 'back') { uiBack(); return; }
    if (a === 'ok') { const el = document.activeElement; if (el && el !== document.body && el.click) el.click(); return; }
    navFocus(a);
  }
  function uiBack() {
    if (phase === 'stage') setPhase('setup');
    else if (phase === 'setup') setPhase(setupMode === 'throne' ? 'menu' : 'mode');
    else if (phase === 'mode' || phase === 'scores' || phase === 'powerups' || phase === 'controls' || phase === 'howto' || phase === 'changelog') setPhase('menu');
    else if (phase === 'online') { lobbyBusy(false); leaveOnline(); setPhase('menu'); }
    else if (phase === 'play') openPause();
    else if (phase === 'pause') setPhase('play');
  }
  /* Moves the focus to the nearest control in that direction (all menus, dialogs, the hero select). */
  const NAV_PHASES = new Set(['menu', 'changelog', 'mode', 'setup', 'stage', 'online', 'scores', 'powerups', 'controls', 'howto', 'over', 'pause']);
  function navFocus(code) {
    const scope = document.querySelector('.overlay:not([hidden])');
    if (!scope) return;
    const els = [...scope.querySelectorAll('button:not([disabled]), input, select')].filter(e => e.offsetParent !== null);
    if (!els.length) return;
    const cur = scope.contains(document.activeElement) ? document.activeElement : null;
    if (!cur) { els[0].focus(); return; }
    const cr = cur.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    const horiz = code === 'left' || code === 'right', sgn = (code === 'left' || code === 'up') ? -1 : 1;
    // nearest control in that direction; a control that overlaps the current one on the other axis (same row / column) is strongly preferred
    // Passes, first match wins: (1) controls completely beyond the current one that also overlap it on the other axis (same row / column);
    // (2) up / down only: completely beyond, anywhere; (3) up / down only: any control whose centre is further that way.
    // Sideways never leaves the row, so "right" from a wide button never lands on a button of the next row.
    let best = null;
    for (const [strict, overlap] of horiz ? [[true, true]] : [[true, true], [true, false], [false, false]]) {
      let bd = Infinity;
      for (const e of els) {
        if (e === cur) continue;
        const r = e.getBoundingClientRect(), dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
        const main = (horiz ? dx : dy) * sgn;
        if (main < 4) continue;
        if (strict && !(horiz ? (sgn > 0 ? r.left >= cr.right - 2 : r.right <= cr.left + 2) : (sgn > 0 ? r.top >= cr.bottom - 2 : r.bottom <= cr.top + 2))) continue;
        const gap = horiz ? Math.max(0, Math.max(r.top, cr.top) - Math.min(r.bottom, cr.bottom)) : Math.max(0, Math.max(r.left, cr.left) - Math.min(r.right, cr.right));
        if (overlap && gap > 0) continue;
        const d = main + gap * 4;
        if (d < bd) { bd = d; best = e; }
      }
      if (best) break;
    }
    if (best) best.focus();
    else if (!horiz) { const pn = scope.querySelector('.panel'); if (pn && pn.scrollHeight > pn.clientHeight) pn.scrollTop += sgn * 80; }   // nothing to focus up / down: scroll long pages
  }

  /* -------------------------------------------------------------- layout */
  function resize() {
    const k = Math.min(innerWidth / C.W, innerHeight / C.H);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = Math.floor(C.W * k) + 'px';
    canvas.style.height = Math.floor(C.H * k) + 'px';
    canvas.width = Math.round(C.W * k * dpr);
    canvas.height = Math.round(C.H * k * dpr);
    mainCtx.setTransform(canvas.width / C.W, 0, 0, canvas.height / C.H, 0, 0);
    $('stage').style.setProperty('--k', Math.floor(C.W * k) / C.W);
  }
  addEventListener('resize', resize); resize();

  /* --------------------------------------------------------------- audio */
  let ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  /* Short techno loop at 128 BPM: four-on-the-floor kick, off-beat hi-hat, acid bass stabs.
     Aura+10 uses the plain beat; Alman Mode is a techno version of the German anthem's first line
     ("Einigkeit und Recht und Freiheit", Haydn, G major): same beat plus a clean, in-tune lead synth. */
  const ANTHEM = [[2, .5], [7, 1.5], [9, .5], [11, 1], [9, 1], [12, 1], [11, 1], [9, 2]];   // [semitones above C4, beats]
  function techno(melody) {
    if (settings.muted) return;
    const a = audio(); if (!a) return;
    const t0 = a.currentTime + 0.02, beat = 60 / 128;
    let noiseBuf = null;
    const noise = () => {
      if (!noiseBuf) { noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.1), a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      return noiseBuf;
    };
    let total = 4;
    duckMusic(8 * beat + 0.6);
    if (melody) total = Math.ceil(melody.reduce((s, m) => s + m[1], 0));
    for (let i = 0; i < total; i++) {
      const t = t0 + i * beat;
      // kick
      const k = a.createOscillator(), kg = a.createGain();
      k.type = 'sine'; k.frequency.setValueAtTime(160, t); k.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      kg.gain.setValueAtTime(0.2, t); kg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      k.connect(kg); kg.connect(a.destination); k.start(t); k.stop(t + 0.25);
      // open hi-hat on the off-beat
      const th = t + beat / 2, h = a.createBufferSource(), hf = a.createBiquadFilter(), hg = a.createGain();
      h.buffer = noise(); hf.type = 'highpass'; hf.frequency.value = 7000;
      hg.gain.setValueAtTime(0.06, th); hg.gain.exponentialRampToValueAtTime(0.001, th + 0.09);
      h.connect(hf); hf.connect(hg); hg.connect(a.destination); h.start(th); h.stop(th + 0.1);
      // acid bass stabs (two 16ths after the hat), filter sweep
      [0.5, 0.75].forEach((off, j) => {
        const tb = t + off * beat, bo = a.createOscillator(), bf = a.createBiquadFilter(), bg = a.createGain();
        bo.type = 'sawtooth'; bo.frequency.value = [55, 82.4, 55, 65.4][(i + j) % 4];
        bf.type = 'lowpass'; bf.Q.value = 9; bf.frequency.setValueAtTime(300, tb); bf.frequency.exponentialRampToValueAtTime(1800, tb + 0.06); bf.frequency.exponentialRampToValueAtTime(250, tb + 0.14);
        bg.gain.setValueAtTime(0.08, tb); bg.gain.exponentialRampToValueAtTime(0.001, tb + 0.15);
        bo.connect(bf); bf.connect(bg); bg.connect(a.destination); bo.start(tb); bo.stop(tb + 0.17);
      });
    }
    if (melody) {                       // lead synth playing the anthem, in tune, plucky filter envelope
      let t = t0;
      melody.forEach(([n, q]) => {
        const d = q * beat, f = 261.63 * Math.pow(2, n / 12);
        const g = a.createGain(), lp = a.createBiquadFilter();
        lp.type = 'lowpass'; lp.Q.value = 4;
        lp.frequency.setValueAtTime(3800, t); lp.frequency.exponentialRampToValueAtTime(900, t + Math.min(d, 0.35));
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.075, t + 0.01);
        g.gain.setValueAtTime(0.06, t + d * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + d * 0.97);
        lp.connect(g); g.connect(a.destination);
        [['sawtooth', 5], ['sawtooth', -5], ['square', 0]].forEach(([type, cents]) => {
          const o = a.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = cents;   // fixed unison detune = width, still in tune
          o.connect(lp); o.start(t); o.stop(t + d);
        });
        t += d;
      });
    }
  }

  /* ------------------------------------------------ background music + gulls
     Light 80s "Miami" synth groove (112 BPM, A minor: Am – F – C – G, two bars each): soft kick, clap, hats,
     off-beat saw bass, warm pad and a plucky arpeggio with echo. Scheduled ahead with a small look-ahead timer. */
  const TRACK_BPM = { miami: 112, techno: 132 };
  let M_STEP = 60 / TRACK_BPM[settings.track === 'techno' ? 'techno' : 'miami'] / 4;
  const CHORDS = [
    { root: 55.0, n: [220.0, 261.63, 329.63] },    // Am
    { root: 43.65, n: [174.61, 220.0, 261.63] },   // F
    { root: 65.41, n: [261.63, 329.63, 392.0] },   // C
    { root: 49.0, n: [196.0, 246.94, 293.66] }     // G
  ];
  const music = { bus: null, delay: null, timer: null, next: 0, step: 0, noise: null, cur: settings.track === 'techno' ? 'techno' : 'miami' };
  const musicOn = () => !settings.muted && settings.music;
  function musicGain() {
    if (!music.bus || !ac) return;
    music.bus.gain.setTargetAtTime(musicOn() ? 0.3 : 0, ac.currentTime, 0.08);
  }
  function noiseBuf(a) {
    if (!music.noise) { music.noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.25), a.sampleRate); const d = music.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    return music.noise;
  }
  function mTone(a, t, f, dur, type, vol, opt) {
    opt = opt || {};
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = f; if (opt.detune) o.detune.value = opt.detune;
    let node = o;
    if (opt.lp) { const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = opt.q || 1; lp.frequency.setValueAtTime(opt.lp, t); if (opt.lpEnd) lp.frequency.exponentialRampToValueAtTime(opt.lpEnd, t + dur); o.connect(lp); node = lp; }
    const att = opt.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol, t + Math.max(att, dur * (opt.hold || 0.4))); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g); g.connect(music.bus); if (opt.echo) g.connect(music.delay);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function mNoise(a, t, dur, vol, hp, bp) {
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf(a); f.type = bp ? 'bandpass' : 'highpass'; f.frequency.value = bp || hp; if (bp) f.Q.value = 0.9;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(music.bus); s.start(t); s.stop(t + dur + 0.02);
  }
  function mKick(a, t, vol, f0, f1, dur) {
    const k = a.createOscillator(), g = a.createGain(); k.type = 'sine'; k.frequency.setValueAtTime(f0, t); k.frequency.exponentialRampToValueAtTime(f1, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2)); k.connect(g); g.connect(music.bus); k.start(t); k.stop(t + (dur || 0.2) + 0.02);
  }
  function musicStep(a, step, t) {
    if (music.cur === 'techno') { technoStep(a, step, t); return; }
    const theme = themeFor(music.cur); if (theme) { theme(a, step, t); return; }
    const bar = Math.floor(step / 16), s = step % 16, ch = CHORDS[Math.floor(step / 32)];
    // drums: soft kick on every beat, clap on 2 and 4, open hat off-beat, ghost hats
    if (s % 4 === 0) { const k = a.createOscillator(), g = a.createGain(); k.type = 'sine'; k.frequency.setValueAtTime(130, t); k.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); k.connect(g); g.connect(music.bus); k.start(t); k.stop(t + 0.22); }
    if (s === 4 || s === 12) mNoise(a, t, 0.13, 0.18, 0, 1700);
    if (s % 4 === 2) mNoise(a, t, 0.09, 0.07, 7500); else if (s % 2 === 1) mNoise(a, t, 0.03, 0.025, 8500);
    // bass: syncopated 16ths, octave pops
    if ([0, 3, 6, 8, 11, 14].includes(s)) mTone(a, t, ch.root * ([6, 14].includes(s) ? 2 : 1), M_STEP * 1.6, 'sawtooth', 0.3, { lp: 700, lpEnd: 220, q: 5 });
    // warm pad, one chord every two bars
    if (s === 0 && bar % 2 === 0) ch.n.forEach(f => { [-8, 8].forEach(d => mTone(a, t, f, M_STEP * 31, 'sawtooth', 0.04, { detune: d, lp: 1100, attack: 0.9, hold: 0.9 })); });
    // arpeggio with echo (8th notes), octave up on odd bars
    if (s % 2 === 0) {
      const idx = [0, 1, 2, 1, 0, 2, 1, 2][(s / 2) % 8], f = ch.n[idx] * (bar % 2 ? 4 : 2);
      mTone(a, t, f, M_STEP * 2.2, 'triangle', 0.14, { echo: true, hold: 0.2 });
      mTone(a, t, f, M_STEP * 1.2, 'square', 0.035, { lp: 2400, echo: true, hold: 0.2 });
    }
  }
  /* Second track: driving techno (132 BPM, A minor): hard kick, off-beat open hat, clap, rolling off-beat bass, a 303-style acid line
     whose filter opens bar by bar, detuned stabs with echo, and an 8-bar arrangement (intro, bass, acid + stabs, full, fill with a snare roll). */
  const ACID = [55, 0, 55, 110, 0, 55, 65.41, 0, 55, 0, 82.41, 55, 0, 98, 55, 73.42];   // 0 = rest
  function technoStep(a, step, t) {
    const bar = Math.floor(step / 16) % 8, s = step % 16, B = music.bus;
    // kick every beat (pitch drop), in the fill bar it drops out for the last two beats
    if (s % 4 === 0 && !(bar === 7 && s >= 8)) {
      const k = a.createOscillator(), g = a.createGain(); k.type = 'sine';
      k.frequency.setValueAtTime(170, t); k.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      g.gain.setValueAtTime(0.75, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26); k.connect(g); g.connect(B); k.start(t); k.stop(t + 0.28);
    }
    // hats: open on the off-beat, ghost 16ths from bar 1
    if (s % 4 === 2) mNoise(a, t, 0.11, 0.1, 8000); else if (bar >= 1 && s % 2 === 1) mNoise(a, t, 0.03, 0.03, 9000);
    // clap on 2 and 4 from bar 2
    if (bar >= 2 && (s === 4 || s === 12)) mNoise(a, t, 0.14, 0.16, 0, 1500);
    // rolling off-beat bass from bar 2, ducked a little by the kick (short note)
    if (bar >= 2 && s % 4 === 2) mTone(a, t, 55, M_STEP * 1.7, 'sawtooth', 0.26, { lp: 420, lpEnd: 160, q: 3, hold: 0.5 });
    // acid line from bar 4: the filter opens from bar to bar, accents on every 4th note
    if (bar >= 4 && ACID[s]) {
      const open = 700 + ((bar - 4) / 3) * 2600 + (s % 4 === 3 ? 700 : 0);
      mTone(a, t, ACID[s] * 2, M_STEP * 0.9, 'sawtooth', s % 4 === 3 ? 0.17 : 0.12, { lp: open, lpEnd: 260, q: 9, hold: 0.3, echo: true });
    }
    // stabs from bar 4: Am7 chord on the off-beat 16ths
    if (bar >= 4 && bar <= 6 && [3, 7, 10, 14].includes(s)) {
      [220, 261.63, 329.63, 392].forEach((f, i) => { [-9, 9].forEach(d => mTone(a, t, f, M_STEP * 1.1, 'sawtooth', 0.03, { detune: d, lp: 2200, lpEnd: 700, hold: 0.2, echo: i === 0 })); });
    }
    // fill bar: snare roll that gets louder and a rising noise sweep
    if (bar === 7) {
      if (s >= 8) mNoise(a, t, 0.08, 0.05 + (s - 8) * 0.025, 0, 2200);
      if (s % 2 === 0) mNoise(a, t, M_STEP * 2, 0.02 + s * 0.006, 4000 + s * 450);
    }
  }
  /* Stage themes (track "Stage": each stage plays its own music during a match; the Beach keeps the Miami groove) */
  const MOON = [440, 523.25, 587.33, 659.25, 783.99, 880];
  function moonStep(a, step, t) {          // Moon Station: slow, dreamy, sparkling pentatonic blips over a deep sine pad
    const bar = Math.floor(step / 16) % 8, s = step % 16, ch = CHORDS[Math.floor(step / 32) % 4];
    if (s === 0 && bar % 2 === 0) { ch.n.forEach(f => mTone(a, t, f, M_STEP * 31, 'sine', 0.07, { attack: 1.2, hold: 0.9, echo: true })); mTone(a, t, ch.root, M_STEP * 31, 'sine', 0.16, { attack: 0.6, hold: 0.9 }); }
    if (bar >= 2 && (s === 0 || s === 8)) mKick(a, t, 0.28, 100, 42, 0.3);
    if (s % 3 === 0) mTone(a, t, MOON[(step * 5 + bar * 2) % 6], M_STEP * 3, 'sine', 0.08, { echo: true, hold: 0.15 });
    if (s === 10 && bar % 2 === 1) mTone(a, t, 1760, M_STEP * 1.5, 'square', 0.02, { lp: 3000, echo: true });
    if (s % 4 === 2) mNoise(a, t, 0.04, 0.02, 9000);
  }
  function bubble(a, t, f) {
    const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); g.connect(music.bus); g.connect(music.delay); o.start(t); o.stop(t + 0.14);
  }
  function waterStep(a, step, t) {         // Underwater: muffled heartbeat kick, wave swells, bubbles over a murky pad
    const bar = Math.floor(step / 16) % 8, s = step % 16, ch = CHORDS[Math.floor(step / 32) % 4];
    if (s === 0 && bar % 2 === 0) { ch.n.forEach(f => mTone(a, t, f / 2, M_STEP * 31, 'triangle', 0.06, { lp: 500, attack: 1.4, hold: 0.9 })); mNoise(a, t, 1.8, 0.05, 0, 500); }
    if (s % 8 === 0) mKick(a, t, 0.32, 90, 38, 0.3);
    if (s % 8 === 0 || s === 6 || s === 14) mTone(a, t, ch.root, M_STEP * 3, 'sine', 0.2, { hold: 0.5 });
    if ((step * 7) % 5 < 2 && s % 2 === 1) bubble(a, t, 500 + ((step * 53) % 9) * 120);
    if (s % 4 === 2) mNoise(a, t, 0.05, 0.015, 3000);
  }
  const HIJAZ = [440, 0, 466.16, 0, 554.37, 0, 587.33, 554.37, 466.16, 0, 440, 0, 0, 0, 415.3, 0, 440, 0, 466.16, 0, 554.37, 659.25, 0, 698.46, 659.25, 587.33, 554.37, 466.16, 440, 0, 0, 0];
  function donerStep(a, step, t) {         // Doner Shop: darbuka groove and a zurna-like lead in the hijaz scale
    const bar = Math.floor(step / 16) % 8, s = step % 16;
    if ([0, 6, 10].includes(s)) mKick(a, t, 0.4, 150, 80, 0.16);                               // dum
    if ([4, 12, 14].includes(s)) { mNoise(a, t, 0.06, 0.12, 0, 3200); mTone(a, t, 900, 0.05, 'triangle', 0.05, { hold: 0.2 }); }   // tek
    if ([2, 8, 15].includes(s)) mNoise(a, t, 0.03, 0.05, 6500);                                // ka
    if (s === 0 && bar % 2 === 0) mTone(a, t, 110, M_STEP * 31, 'sawtooth', 0.1, { lp: 500, attack: 0.5, hold: 0.9 });   // drone on A
    if (s % 4 === 0) mTone(a, t, 55, M_STEP * 2.5, 'sawtooth', 0.2, { lp: 380, lpEnd: 150, q: 3 });
    const f = HIJAZ[step % 32];
    if (f) [-12, 12].forEach(d => mTone(a, t, f, M_STEP * 1.8, 'sawtooth', 0.05, { detune: d, lp: 2600, lpEnd: 1200, echo: true, hold: 0.3 }));
  }
  function holeStep(a, step, t) {          // Black Hole Arena: dark drone, tritone arpeggio and rising swells
    const bar = Math.floor(step / 16) % 8, s = step % 16;
    if (s === 0 && bar % 2 === 0) { mTone(a, t, 43.65, M_STEP * 31, 'sawtooth', 0.2, { lp: 220, lpEnd: 90, attack: 1, hold: 0.9 }); mTone(a, t, 61.74, M_STEP * 31, 'sawtooth', 0.1, { lp: 200, attack: 1.4, hold: 0.9 }); }
    if (s % 4 === 0) mKick(a, t, 0.35, 120, 40, 0.22);
    if (s === 8 && bar % 2 === 0) mKick(a, t, 0.3, 110, 60, 0.25);
    if (s % 4 === 2) mTone(a, t, [293.66, 277.18, 233.08, 207.65][(step >> 2) % 4], M_STEP * 3, 'triangle', 0.09, { echo: true, hold: 0.2 });
    if (bar === 7 && s % 2 === 0) mNoise(a, t, M_STEP * 2, 0.02 + s * 0.004, 4000 + s * 300);
    if (bar === 0 && s === 0) mKick(a, t, 0.55, 80, 30, 0.6);
  }
  function themeFor(id) { return { moon: moonStep, water: waterStep, doner: donerStep, hole: holeStep }[id] || null; }
  const BPM_OF = id => TRACK_BPM[id] || { moon: 90, water: 84, doner: 124, hole: 100 }[id] || 112;
  function activeTrack() {
    if (settings.track === 'techno') return 'techno';
    if (settings.track === 'stage' && (phase === 'play' || phase === 'pause' || phase === 'over') && game && themeFor(game.stageId)) return game.stageId;
    return 'miami';
  }
  function applyTrack() {                  // switches the music when the track setting or the stage changes
    const nm = activeTrack(); if (nm === music.cur) return;
    music.cur = nm; M_STEP = 60 / BPM_OF(nm) / 4;
    if (music.delay) music.delay.delayTime.value = M_STEP * 3;
    music.step = 0; if (ac) music.next = ac.currentTime + 0.1;
  }
  function musicTick() {
    if (!ac) return;
    if (!musicOn()) { music.next = ac.currentTime + 0.1; return; }
    if (music.next < ac.currentTime - 0.2) music.next = ac.currentTime + 0.05;       // tab was throttled
    while (music.next < ac.currentTime + 0.3) { musicStep(ac, music.step, music.next); music.next += M_STEP; music.step = (music.step + 1) % 128; }
  }
  function startMusic() {
    const a = audio(); if (!a || music.timer) return;
    music.bus = a.createGain(); music.bus.gain.value = musicOn() ? 0.3 : 0;
    music.delay = a.createDelay(1); music.delay.delayTime.value = M_STEP * 3;                // dotted-8th echo
    const fb = a.createGain(); fb.gain.value = 0.38; const wet = a.createGain(); wet.gain.value = 0.5;
    music.delay.connect(fb); fb.connect(music.delay); music.delay.connect(wet); wet.connect(music.bus);
    music.bus.connect(a.destination);
    music.next = a.currentTime + 0.15; music.step = 0;
    music.timer = setInterval(musicTick, 80);
    scheduleGull();
  }
  function duckMusic(sec) {                                // let the power-up jingles stand out
    if (!music.bus || !ac) return;
    const t = ac.currentTime; music.bus.gain.setTargetAtTime(musicOn() ? 0.08 : 0, t, 0.05);
    setTimeout(() => musicGain(), sec * 1000);
  }
  /* seagull screech every now and then (synthesised: pitch sweep + vibrato through a band-pass) */
  function gull() {
    if (!musicOn()) return;
    const a = audio(); if (!a) return;
    const n = 2 + Math.floor(Math.random() * 3), pitch = 0.9 + Math.random() * 0.25;
    for (let i = 0; i < n; i++) {
      const t = a.currentTime + 0.03 + i * (0.36 + Math.random() * 0.06), len = i === 0 ? 0.42 : 0.3, vol = 0.05 * (1 - i * 0.18);
      const o = a.createOscillator(), bp = a.createBiquadFilter(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1350 * pitch, t); o.frequency.linearRampToValueAtTime(2500 * pitch, t + 0.09); o.frequency.linearRampToValueAtTime(1650 * pitch, t + len);
      lfo.frequency.value = 32; lg.gain.value = 70; lfo.connect(lg); lg.connect(o.frequency);
      bp.type = 'bandpass'; bp.frequency.value = 2100 * pitch; bp.Q.value = 2.2;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(bp); bp.connect(g); g.connect(a.destination);
      o.start(t); lfo.start(t); o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
    }
  }
  function scheduleGull() { setTimeout(() => { gull(); scheduleGull(); }, 14000 + Math.random() * 18000); }

  function tone(freq, dur, type, vol, slide, delay) {
    if (settings.muted) return;
    const a = audio(); if (!a) return;
    const t0 = a.currentTime + (delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  const fxs = [];                 // visual effects of events (black hole), see Scene.drawFx
  /* Winner quotes (shown in the end-of-match panel) */
  const WIN_QUOTES = {
    pixel: 'Level up! Next stage unlocked.', cyborg: 'Target eliminated.', cowboy: 'Yeehaw, partner – that was a clean shot!',
    ninja: 'Silent. Deadly. A little sandy.', kebabi: 'Extra sauce for the win!', adventurer: 'Another treasure for the collection!',
    santa: 'Ho ho ho – somebody was naughty!', mcrib: 'Now that is a juicy victory!', transformer: 'Engine at full power – roll out!',
    cloudy: 'The storm has passed – and I won!', gagari: 'Mission accomplished. Out of this world!', kindi: 'Sweet, sweet victory!',
    bruiser: 'Power and petals, baby!'
  };
  /* Weapon sounds: swing (whoosh) and hit on the ball, one per melee weapon */
  const SWING_SND = {
    sword: () => tone(700, 0.14, 'sawtooth', 0.05, -500),
    katana: () => { tone(1500, 0.1, 'sawtooth', 0.05, -1200); tone(2400, 0.05, 'triangle', 0.03, -1500, 0.02); },
    kebabknife: () => { tone(1200, 0.09, 'sawtooth', 0.05, -900); tone(300, 0.07, 'square', 0.03, -200, 0.03); },
    lasso: () => { tone(220, 0.5, 'sine', 0.06, 260); tone(330, 0.5, 'triangle', 0.03, -120, 0.1); },
    rod: () => { tone(1800, 0.08, 'square', 0.05, -1500); tone(900, 0.06, 'sawtooth', 0.04, -700, 0.05); },
    kick: () => tone(500, 0.12, 'triangle', 0.05, -380),
    bat: () => tone(420, 0.12, 'sawtooth', 0.05, -260)
  };
  const HIT_SND = {
    sword: () => { tone(1800, 0.18, 'triangle', 0.09, -200); tone(2700, 0.14, 'sine', 0.05, -100, 0.01); tone(140, 0.1, 'square', 0.1, -60); },
    katana: () => { tone(2600, 0.12, 'triangle', 0.08, -600); tone(180, 0.08, 'square', 0.1, -100); },
    kebabknife: () => { tone(150, 0.1, 'square', 0.14, -80); tone(2200, 0.08, 'triangle', 0.06, -500, 0.01); tone(90, 0.12, 'sine', 0.14, -30, 0.02); },
    lasso: () => { tone(260, 0.22, 'sine', 0.14, 300); tone(520, 0.2, 'triangle', 0.07, 200, 0.03); },
    rod: () => { tone(2000, 0.05, 'square', 0.12, -1700); tone(700, 0.1, 'sawtooth', 0.08, -500, 0.02); },
    kick: () => { tone(110, 0.2, 'sine', 0.22, -70); tone(60, 0.18, 'triangle', 0.2, -20); tone(900, 0.05, 'square', 0.05, -600); },
    bat: () => { tone(900, 0.04, 'square', 0.16, -300); tone(160, 0.14, 'triangle', 0.2, -90); tone(1800, 0.06, 'sawtooth', 0.05, -1200, 0.005); }
  };
  const weaponOfBlob = id => { const b = game && game.blobs[id]; return b && FIGURES[b.style] ? FIGURES[b.style].weapon : null; };
  function playEvent(e) {
    switch (e.type) {
      case 'hit': tone(170 + e.power * 130, 0.1, 'square', 0.1, -70); break;
      case 'shot':
        if (e.kind === 2) { tone(420, 0.08, 'triangle', 0.1, 300); tone(200, 0.1, 'square', 0.05, -100, 0.02); }
        else if (e.kind === 3) { tone(1400, 0.2, 'sawtooth', 0.08, -1100); tone(90, 0.25, 'square', 0.1, -50); tone(2200, 0.12, 'square', 0.05, -1800, 0.04); }
        else if (e.kind === 5) { tone(660, 0.1, 'triangle', 0.1, 500); tone(990, 0.1, 'sine', 0.07, 600, 0.04); tone(1480, 0.12, 'triangle', 0.05, 500, 0.08); }
        else if (e.kind === 4) { tone(300, 0.4, 'sine', 0.14, -240); tone(70, 0.45, 'triangle', 0.14, 40); }
        else if (e.heavy) { tone(110, 0.22, 'sawtooth', 0.2, -80); tone(700, 0.12, 'square', 0.08, -600); tone(70, 0.3, 'triangle', 0.16, -30, 0.05); }
        else { tone(1800, 0.09, 'square', 0.09, -1400); tone(260, 0.1, 'sawtooth', 0.06, -150, 0.02); }
        break;
      case 'hole': if (e.arrive) { tone(120, 0.35, 'sine', 0.14, 700); tone(900, 0.25, 'triangle', 0.06, 300, 0.1); } else { tone(900, 0.35, 'sine', 0.14, -800); tone(200, 0.3, 'triangle', 0.08, -100, 0.05); }
        fxs.push({ x: e.x0, y: e.y0, arrive: !!e.arrive, t0: performance.now() / 1000 }); break;
      case 'shotHit': if (e.fx === 'deflect') { tone(300, 0.14, 'triangle', 0.14, 500); tone(800, 0.1, 'square', 0.06, -300, 0.03); } else if (e.boost) { tone(500, 0.16, 'sawtooth', 0.12, 900); tone(1300, 0.08, 'square', 0.06); } else { tone(900, 0.2, 'sawtooth', 0.12, -700); tone(150, 0.14, 'triangle', 0.1, -60); } break;
      case 'swing': { const f = SWING_SND[weaponOfBlob(e.blob)]; if (f) f(); else tone(900, 0.12, 'sawtooth', 0.04, -700); break; }
      case 'weapon': { const f = HIT_SND[weaponOfBlob(e.blob)]; if (f) f(); else { tone(120, 0.16, 'square', 0.16, -60); tone(520, 0.1, 'sawtooth', 0.08, -380, 0.01); tone(1500, 0.05, 'triangle', 0.06, -600); } break; }
      case 'stun': tone(220, 0.3, 'square', 0.12, -140); tone(1300, 0.12, 'triangle', 0.07, 400, 0.02); tone(90, 0.18, 'sine', 0.16, -30); break;
      case 'jump': tone(260, 0.07, 'sine', 0.05, 160); break;
      case 'flip': tone(330, 0.16, 'triangle', 0.06, 420); break;
      case 'net': tone(320, 0.06, 'triangle', 0.1, -90); break;
      case 'wall': tone(230, 0.05, 'triangle', 0.07, -60); break;
      case 'towel': tone(140, 0.16, 'sine', 0.16, -50); tone(210, 0.1, 'triangle', 0.06, 40, 0.02); break;
      case 'spawn': tone(880, 0.1, 'sine', 0.05); tone(1175, 0.14, 'sine', 0.05, 0, 0.08); break;
      case 'collect': tone(660, 0.1, 'triangle', 0.12); tone(990, 0.18, 'triangle', 0.12, 0, 0.08); break;
      case 'activate':
        if (e.item === 'alman') techno(ANTHEM);
        else if (e.item === 'aura') techno();
        else if (e.item === 'level') { tone(520, 0.1, 'square', 0.09, -260); tone(330, 0.16, 'triangle', 0.1, -140, 0.09); tone(150, 0.24, 'sawtooth', 0.06, -50, 0.2); }
        else { tone(300, 0.28, 'sine', 0.12, 500); tone(600, 0.2, 'triangle', 0.06, 300, 0.12); }
        break;
      case 'point':
        if (e.scored) { tone(523, 0.14, 'triangle', 0.12); tone(659, 0.2, 'triangle', 0.12, 0, 0.1); }
        else tone(300, 0.25, 'triangle', 0.1, -120);
        break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.13, 0, i * 0.13)); break;
    }
  }

  /* --------------------------------------------------------------- input */
  const MAP = {
    P1: { left: ['KeyA', 'TouchLeft', 'PadLeft'], right: ['KeyD', 'TouchRight', 'PadRight'], jump: ['KeyW', 'TouchJump', 'PadJump'], special: ['ControlLeft', 'ShiftLeft', 'TouchSpecial', 'PadSpecial'] },
    P2: { left: ['ArrowLeft', 'Pad2Left'], right: ['ArrowRight', 'Pad2Right'], jump: ['ArrowUp', 'Pad2Jump'], special: ['ControlRight', 'ShiftRight', 'Numpad0', 'Pad2Special'] }
  };
  const any = arr => arr.some(c => keys.has(c));
  const read = m => ({ left: any(m.left), right: any(m.right), jump: any(m.jump), special: any(m.special) });
  function readFor(b) {
    if (b.keymap === 'P1') return read(MAP.P1);
    if (b.keymap === 'P2') return read(MAP.P2);
    const a = read(MAP.P1), c = read(MAP.P2);   // solo: both key sets work
    return { left: a.left || c.left, right: a.right || c.right, jump: a.jump || c.jump, special: a.special || c.special };
  }
  const GAME_CODES = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyD', 'KeyS',
    'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'Numpad0']);

  addEventListener('keydown', e => {
    usingPad = false;
    audio(); startMusic();
    if (/^Arrow/.test(e.code) && NAV_PHASES.has(phase)) {
      const tag = e.target && e.target.tagName, horiz = e.code === 'ArrowLeft' || e.code === 'ArrowRight';
      if (!(tag === 'INPUT' && horiz) && !(tag === 'SELECT' && !horiz)) { e.preventDefault(); if (!e.repeat) uiAction(e.code.slice(5).toLowerCase()); return; }
    }
    const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT');
    if (typing) {
      if (phase === 'setup' && e.key === 'Enter' && e.target.tagName === 'INPUT') beginMatch();
      else if (e.key === 'Escape' && (phase === 'setup' || phase === 'stage' || phase === 'online')) uiBack();
      else if (phase === 'online' && e.key === 'Enter' && e.target.id === 'onCodeIn') $('btnJoin').click();
      return;
    }
    if (phase === 'play' || phase === 'pause') {
      // swallow Ctrl+W/A/D etc. as far as the browser allows
      if (GAME_CODES.has(e.code) || e.ctrlKey) e.preventDefault();
    }
    if (e.repeat) { keys.add(e.code); return; }
    keys.add(e.code);
    if (e.code === 'KeyM') { settings.muted = !settings.muted; saveSettings(); musicGain(); }
    if (e.code === 'KeyN') toggleMusic();
    if (e.code === 'Escape') uiBack();
    if (e.code === 'KeyF') {
      try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } catch (err) { /* not allowed */ }
    }
    if (phase === 'play' && e.code === 'KeyP') openPause();
    else if (phase === 'pause' && e.code === 'KeyP') setPhase('play');
    if (phase === 'menu') {
      if (e.code === 'Digit1') openModes('classic');
      if (e.code === 'Digit2') openModes('fight');
      if (e.code === 'Digit3') $('btnOnline').click();
      if (e.code === 'Digit4') $('btnThrone').click();
    } else if (phase === 'mode') {
      if (e.code === 'Digit1') openSetup('duel');
      if (e.code === 'Digit2') openSetup('team');
      if (e.code === 'Digit3') openSetup('solo');
    }
  });
  addEventListener('pointerdown', () => { audio(); startMusic(); });
  TOUCH_BTNS.forEach(btn => {
    const code = btn.dataset.k;
    const on = () => { keys.add(code); btn.classList.add('on'); };
    const off = () => { keys.delete(code); btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); try { btn.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ } on(); });
    btn.addEventListener('pointerover', e => { if (e.buttons) on(); });      // sliding a finger from one button to the next
    ['pointerup', 'pointercancel', 'pointerout'].forEach(ev => btn.addEventListener(ev, off));
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });
  $('btnTouchPause').addEventListener('pointerdown', e => { e.preventDefault(); if (phase === 'play') openPause(); });
  if (touchMode) document.body.classList.add('touch');
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); if (phase === 'play' && !online) setPhase('pause'); });   // online: the match cannot be paused
  addEventListener('beforeunload', e => { if (phase === 'play' || phase === 'pause') { e.preventDefault(); e.returnValue = ''; } });

  function openPause() {
    $('pauseTitle').textContent = online ? 'Online match' : 'Paused';
    $('btnResume').textContent = 'Resume';
    setPhase('pause');
  }

  /* --------------------------------------------------------- player names */
  function openModes(rules) {
    settings.fight = rules === 'fight'; saveSettings();
    $('modeTitle').textContent = settings.fight ? 'Volley Fight' : 'Classic Hero Volley';
    $('modeSub').innerHTML = settings.fight ? 'Like Volleyball but WITH <span class="hot">WEAPONS</span>' : 'Classic rules with power-ups.';
    $('modeSub').classList.toggle('tagline', settings.fight);
    setPhase('mode');
  }
  function openSetup(mode) {
    setupMode = mode;
    $('name1').value = names.p1; $('name2').value = names.p2;
    const solo = mode === 'solo' || mode === 'throne';
    $('row2').hidden = solo;
    $('setupFields').classList.toggle('single', solo); $('setupPanel').classList.toggle('solo', solo);
    $('setupTitle').textContent = { duel: 'Choose your heroes', team: 'Choose your team', solo: 'Choose your hero', throne: 'Climb to the Volley Throne' }[mode];
    $('btnStart').textContent = mode === 'throne' ? 'Fight!' : 'Next ▶';
    $('lbl1').textContent = solo ? 'You' : 'Player 1';
    $('hint1').textContent = solo ? 'WASD or arrow keys' : 'A D · W · Ctrl';
    $('hint2').textContent = '← → · ↑ · Right Ctrl';
    if (!solo && looks.p1.color === looks.p2.color) looks.p2.color = (PALETTE.find(p => p[1] !== looks.p1.color) || PALETTE[1])[1];
    renderLooks();
    setPhase('setup');
    setTimeout(() => { $('name1').focus(); $('name1').select(); }, 30);
  }
  function beginMatch() {
    const clean = v => (v || '').replace(/\s+/g, ' ').trim().slice(0, 12);
    const n1 = clean($('name1').value), n2 = clean($('name2').value);
    names.p1 = n1; names.p2 = n2; store.set('vb_names', names);
    settings.level = $('level').value; settings.target = +$('target').value; saveSettings();
    pendingNames = [n1 || (setupMode === 'solo' || setupMode === 'throne' ? 'You' : 'Player 1'), n2 || 'Player 2'];
    if (setupMode === 'throne') { startGame(setupMode, pendingNames[0], pendingNames[1]); return; }
    syncStageTiles(); setPhase('stage');
  }
  let pendingNames = ['', ''];
  $('btnStageGo').onclick = () => startGame(setupMode, pendingNames[0], pendingNames[1]);
  $('btnStageBack').onclick = () => setPhase('setup');

  /* --------------------------------------------------------- start a match */
  function startGame(mode, p1, p2) {
    if (mode === 'throne') { startThrone(p1); return; }
    lastSetup = { mode, p1, p2 };
    const H = (slot, label) => ({ controller: 'human', color: looks[slot].color, style: looks[slot].style, label });
    const humanCols = mode === 'solo' ? [looks.p1.color] : [looks.p1.color, looks.p2.color];
    const free = PALETTE.map(p => p[1]).filter(c => !humanCols.includes(c));      // CPU heroes take colors nobody chose
    let ci = 0;
    const A = () => ({ controller: 'ai', color: free[ci++ % free.length], style: Object.keys(FIGURES)[Math.floor(Math.random() * Object.keys(FIGURES).length)], label: 'CPU' });
    let teams, tn;
    if (mode === 'duel') { teams = [[H('p1', p1)], [H('p2', p2)]]; tn = [p1, p2]; }
    else if (mode === 'team') { teams = [[H('p1', p1), H('p2', p2)], [A(), A()]]; tn = [p1 + ' & ' + p2, 'CPU']; }
    else { teams = [[H('p1', p1)], [A()]]; tn = [p1, 'CPU']; }
    game = new Sim({ teams, level: settings.level, target: settings.target, fight: settings.fight, stage: pickStage(settings.stage) });
    game.mode = mode; game.teamNames = tn;
    const humans = game.blobs.filter(b => b.controller === 'human');
    humans.forEach((b, i) => { b.keymap = mode === 'solo' ? 'BOTH' : (i === 0 ? 'P1' : 'P2'); });
    setPhase('play');
  }

  /* ---- Volley Throne: six random heroes, each CPU stronger than the last (levels t1 … t6), Volley Fight rules ---- */
  let throne = null;
  const THRONE_ROUNDS = 6;
  function startThrone(name) {
    const pool = Object.keys(FIGURES).filter(id => id !== looks.p1.style);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    throne = { name, opp: pool.slice(0, THRONE_ROUNDS), stages: throneStages(), round: 0, total: 0, state: 'fight' };
    startThroneRound();
  }
  /* rounds 1-5 on shuffled regular stages, the final in the Black Hole Arena */
  function throneStages() {
    const a = ['beach', 'moon', 'water', 'doner'].sort(() => Math.random() - 0.5);
    while (a.length < THRONE_ROUNDS - 1) a.push(a[a.length % 4]);
    return a.slice(0, THRONE_ROUNDS - 1).concat('hole');
  }
  function startThroneRound() {
    const r = throne.round, style = throne.opp[r];
    const free = PALETTE.map(p => p[1]).filter(c => c !== looks.p1.color);
    const teams = [[{ controller: 'human', color: looks.p1.color, style: looks.p1.style, label: throne.name }],
                   [{ controller: 'ai', color: free[(r * 3 + 1) % free.length], style, label: FIGURES[style].name }]];
    game = new Sim({ teams, level: 't' + (r + 1), target: r === THRONE_ROUNDS - 1 ? 7 : 5, fight: true, stage: throne.stages[r] });
    game.mode = 'throne'; game.teamNames = [throne.name, FIGURES[style].name];
    game.blobs.filter(b => b.controller === 'human').forEach(b => { b.keymap = 'BOTH'; });
    game.say((r === THRONE_ROUNDS - 1 ? 'Final: ' : 'Round ' + (r + 1) + '/' + THRONE_ROUNDS + ': ') + 'vs ' + FIGURES[style].name + ' · ' + game.stage.name, 150);
    lastSetup = { mode: 'throne', p1: throne.name, p2: '' };
    setPhase('play');
  }

  /* ------------------------------------------------------------ match end */
  let overTimer = 0;
  function showOver() {
    if (overTimer) return;                    // the end panel follows after a short victory pose
    const w = game.winner, s = game.score;
    const mult = LEVELS[game.level].mult;
    let title, info = `${s[0]} : ${s[1]} · longest rally ${game.longestRally}`, rank = '';
    $('btnAgain').disabled = false; $('btnAgain').textContent = 'Play again';
    if (game.mode === 'online') {
      title = w === game.localTeam ? '🏆 You win!' : `${game.teamNames[w]} wins!`;
      info += ' · online';
      $('btnAgain').disabled = false; $('btnAgain').textContent = 'Play again';
    } else if (game.mode === 'throne') {
      const r = throne.round, foe = FIGURES[throne.opp[r]].name;
      if (w === 0) {
        throne.total += Math.round((s[0] - s[1]) * 100 * (1 + r * 0.4) + game.longestRally * 10);
        if (r === THRONE_ROUNDS - 1) {
          title = '👑 You claim the Volley Throne!'; info = `All ${THRONE_ROUNDS} heroes beaten · final ${s[0]} : ${s[1]}`; throne.state = 'won';
          const entry = { name: throne.name, score: throne.total, pts: [THRONE_ROUNDS, THRONE_ROUNDS], mode: 'throne', level: 'hard', rally: game.longestRally, target: game.target, date: Date.now() };
          scores.push(entry); scores.sort((a, b) => b.score - a.score);
          const idx = scores.indexOf(entry); scores = scores.slice(0, 10); store.set('vb_scores', scores);
          rank = idx >= 0 && idx < 10 ? `New high score! Rank #${idx + 1} · ${throne.total} points` : `${throne.total} points`;
          $('btnAgain').textContent = 'New climb';
        } else {
          title = `Round ${r + 1}/${THRONE_ROUNDS} cleared!`; info = `You beat ${foe} ${s[0]} : ${s[1]}`;
          rank = `Next: ${FIGURES[throne.opp[r + 1]].name}` + (r + 1 === THRONE_ROUNDS - 1 ? ' – the final!' : ` (${r + 2}/${THRONE_ROUNDS})`);
          throne.state = 'next'; throne.round++; $('btnAgain').textContent = 'Next fight';
        }
      } else {
        title = `${foe} knocks you off the ladder`; info = `Round ${r + 1}/${THRONE_ROUNDS} · ${s[0]} : ${s[1]}`; throne.state = 'lost';
        rank = r ? `You made it past ${r} hero${r > 1 ? 'es' : ''}.` : ''; $('btnAgain').textContent = 'New climb';
      }
    } else if (game.mode === 'duel') {
      duel[w]++; store.set('vb_duel', duel);
      title = `🏆 ${game.teamNames[w]} wins!`;
      info += ` · record ${duel[0]}:${duel[1]}`;
    } else if (w === 0) {
      title = `🏆 ${game.teamNames[0]} win${game.mode === 'solo' ? 's' : ''}!`;
      const score = Math.round((s[0] - s[1]) * 100 * mult + game.longestRally * 10);
      const entry = { name: game.teamNames[0], score, pts: [s[0], s[1]], mode: game.mode, level: game.level, rally: game.longestRally, target: game.target, date: Date.now() };
      scores.push(entry); scores.sort((a, b) => b.score - a.score);
      const idx = scores.indexOf(entry);
      scores = scores.slice(0, 10); store.set('vb_scores', scores);
      rank = idx >= 0 && idx < 10 ? `New high score! Rank #${idx + 1} · ${score} points` : `${score} points`;
    } else title = 'CPU wins!';
    const wb = game.blobs.find(b => b.team === w), q = wb && WIN_QUOTES[wb.style];
    $('overQuote').textContent = q ? '“' + q + '”' : '';
    $('overTitle').textContent = title; $('overInfo').textContent = info; $('overRank').textContent = rank;
    overTimer = setTimeout(() => { overTimer = 0; if (phase === 'play' || phase === 'pause') setPhase('over'); }, 1800);
  }

  function renderScores() {
    const ol = $('scoreList'); ol.innerHTML = '';
    if (!scores.length) { const li = document.createElement('li'); li.textContent = 'No entries yet – beat the CPU!'; ol.appendChild(li); }
    scores.forEach(s => {
      const li = document.createElement('li');
      const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = s.score;
      const nm = document.createElement('b'); nm.textContent = s.name;
      const sm = document.createElement('small');
      const lv = LEVEL_MAP[s.level] || s.level;
      if (s.mode === 'throne') sm.textContent = ` 👑 Volley Throne · rally ${s.rally} · ${new Date(s.date).toLocaleDateString('en-GB')}`;
      else sm.textContent = ` ${s.pts[0]}:${s.pts[1]} · ${s.mode === 'team' ? '2v2' : '1v1'} CPU ${LEVEL_LABEL[lv] || lv} · rally ${s.rally} · ${new Date(s.date).toLocaleDateString('en-GB')}`;
      li.append(sc, nm, sm); ol.appendChild(li);
    });
    $('duelStats').textContent = `Duel record (local 1 vs 1): Player 1 ${duel[0]} – ${duel[1]} Player 2`;
  }

  /* ------------------------------------------------------------- UI buttons */
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => openSetup(b.dataset.mode)));
  $('btnStart').onclick = beginMatch;
  $('btnSetupBack').onclick = () => setPhase(setupMode === 'throne' ? 'menu' : 'mode');
  $('btnModeBack').onclick = () => setPhase('menu');
  document.querySelectorAll('[data-rules]').forEach(b => b.addEventListener('click', () => openModes(b.dataset.rules)));
  $('btnThrone').onclick = () => openSetup('throne');
  $('btnScores').onclick = () => { renderScores(); setPhase('scores'); };
  $('btnScoresBack').onclick = () => setPhase('menu');
  const PU_INFO = [
    ['towel', 'Fluffy Towel', 'Lays a towel on <i>your</i> half for 25 s. The ball bounces high off it instead of ending the rally.'],
    ['alman', 'Alman Mode', 'Your <i>opponents</i> get a bucket hat with flags, white socks and sandals for 10 s: only 80 % speed and 80 % jump height. Comes with a techno anthem.'],
    ['level', 'Faulty Level', 'A broken spirit level: for 10 s the net leans over toward <i>your</i> side – your half gets smaller, your opponents\' half bigger.'],
    ['aura', 'Aura+10', 'Cool sunglasses: for 10 s your heroes\' ball hit box is <i>30 % bigger</i>, so the ball is easier to hit. Comes with a techno beat.']
  ];
  function renderPowerups() {
    const list = $('puList'); list.innerHTML = '';
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    PU_INFO.forEach(([type, name, desc]) => {
      const card = document.createElement('div'); card.className = 'pucard';
      const cv = document.createElement('canvas'); cv.width = cv.height = 56 * dpr;
      const c2 = cv.getContext('2d'); c2.scale(dpr, dpr); Scene.drawItemIcon(c2, type, 28, 28, 38);
      const txt = document.createElement('div'); txt.innerHTML = `<b>${name}</b><span>${desc}</span>`;
      card.append(cv, txt); list.appendChild(card);
    });
  }
  $('btnPowerups').onclick = () => { renderPowerups(); setPhase('powerups'); };
  $('btnPowerupsBack').onclick = () => setPhase('menu');
  $('btnControls').onclick = () => setPhase('controls');
  $('btnControlsBack').onclick = () => setPhase('menu');
  $('btnHowto').onclick = () => setPhase('howto');
  $('btnHowtoBack').onclick = () => setPhase('menu');
  /* Music button / key N cycles: Miami -> Techno -> Stage (own theme per stage) -> Off -> Miami */
  const musicLabel = () => '🎵 Music: ' + (!settings.music ? 'Off' : settings.track === 'techno' ? 'Techno' : settings.track === 'stage' ? 'Stage' : 'Miami');
  function setTrack(tr) { settings.track = tr; applyTrack(); }
  function toggleMusic() {
    if (settings.music && settings.track === 'miami') setTrack('techno');
    else if (settings.music && settings.track === 'techno') setTrack('stage');
    else if (settings.music) settings.music = false;
    else { settings.music = true; setTrack('miami'); }
    saveSettings(); musicGain(); startMusic(); $('btnMusic').textContent = musicLabel();
  }
  $('btnMusic').onclick = toggleMusic;
  $('btnMusic').textContent = musicLabel();
  if (window.BUILD && $('buildInfo')) $('buildInfo').textContent = 'Version ' + BUILD.version;
  /* Ein Klick auf die Version öffnet das deutsche Änderungsprotokoll (letzte 3 Versionen, siehe version.js) */
  let clogAt = 0;
  const openChangelog = () => {
    if (performance.now() - clogAt < 500 || phase !== 'menu') return; clogAt = performance.now();
    const log = (window.BUILD && BUILD.log) || [], body = $('changelogBody'); body.textContent = '';
    log.slice(0, 3).forEach(e => {
      const h = document.createElement('h3'); h.textContent = e.v + (e.v === BUILD.version ? ' (aktuell)' : ''); body.appendChild(h);
      const ul = document.createElement('ul'); e.items.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }); body.appendChild(ul);
    });
    setPhase('changelog');
  };
  $('buildInfo').addEventListener('click', openChangelog);
  $('buildInfo').addEventListener('pointerup', openChangelog);       // finger taps on a tiny label: do not rely on click alone
  $('btnChangelog').onclick = openChangelog;
  $('btnChangelogBack').onclick = () => setPhase('menu');
  let clearArmed = false;
  $('btnScoresClear').onclick = () => {
    const btn = $('btnScoresClear');
    if (!clearArmed) { clearArmed = true; btn.textContent = 'Really reset?'; setTimeout(() => { clearArmed = false; btn.textContent = 'Reset'; }, 3000); return; }
    clearArmed = false; btn.textContent = 'Reset';
    scores = []; duel = [0, 0]; store.set('vb_scores', scores); store.set('vb_duel', duel); renderScores();
  };
  $('btnResume').onclick = () => setPhase('play');
  $('btnQuit').onclick = () => { if (online) leaveOnline(); game = null; setPhase('menu'); };
  $('btnAgain').onclick = () => {
    if (online) { online.myRm = true; $('btnAgain').disabled = true; $('btnAgain').textContent = 'Waiting for opponent…'; return; }
    if (lastSetup.mode === 'throne' && throne) { if (throne.state === 'next') { throne.state = 'fight'; startThroneRound(); } else startThrone(throne.name); return; }
    startGame(lastSetup.mode, lastSetup.p1, lastSetup.p2);
  };
  $('btnMenu').onclick = () => { if (online) leaveOnline(); game = null; setPhase('menu'); };
  $('level').onchange = $('target').onchange = () => { settings.level = $('level').value; settings.target = +$('target').value; saveSettings(); };

  let installEvt = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('btnInstall').hidden = false; });
  $('btnInstall').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('btnInstall').hidden = true; };

  /* ------------------------------------------------------------- rendering */
  function drawBall(ball, rotRef) {
    const r = C.BALL_R;
    const gh = Math.max(0, C.GROUND - ball.y);
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.06, 0.25 - gh / 1500)})`;
    ctx.beginPath(); ctx.ellipse(ball.x, C.GROUND + 4, r * Math.max(0.4, 1 - gh / 800), 4, 0, 0, 7); ctx.fill();
    if (ball.y < -r) { // above the screen: show an arrow
      const k = Math.max(0.5, 1 - (-ball.y) / 600);
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath();
      ctx.moveTo(ball.x, 6); ctx.lineTo(ball.x - 9 * k, 22 * k + 6); ctx.lineTo(ball.x + 9 * k, 22 * k + 6); ctx.fill();
      ctx.beginPath(); ctx.arc(ball.x, 34 * k + 8, 5 * k, 0, 7); ctx.fill();
      return;
    }
    rotRef.rot += ball.vx * 0.03;
    ctx.save(); ctx.translate(ball.x, ball.y);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
    const bg = ctx.createRadialGradient(-5, -6, 2, 0, 0, r);
    bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#d7dde3');
    ctx.fillStyle = bg; ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.rotate(rotRef.rot);
    ctx.fillStyle = '#ee1a8c'; ctx.fillRect(-r, -3.5, 2 * r, 7);
    ctx.fillStyle = '#2bb8d0'; ctx.fillRect(-3.5, -r, 7, 2 * r);
    ctx.restore();
    const sp = ctx.createRadialGradient(ball.x - 6, ball.y - 7, 0, ball.x - 6, ball.y - 7, 9);
    sp.addColorStop(0, 'rgba(255,255,255,.85)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(ball.x - 6, ball.y - 7, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, r, 0, 7); ctx.stroke();
  }

  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

  function drawHUD(g, t) {
    const names = g.teamNames || ['', ''];
    const cols = [g.blobs[0].color, g.blobs[g.blobs.length - 1].color];
    ctx.fillStyle = 'rgba(26,10,61,.7)'; rr(300, 8, 200, 52, 12); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = '800 32px ' + FONT;
    ctx.fillStyle = cols[0]; ctx.fillText(g.score[0], 348, 44);
    ctx.fillStyle = cols[1]; ctx.fillText(g.score[1], 452, 44);
    ctx.fillStyle = '#fff'; ctx.font = '700 18px ' + FONT; ctx.fillText(':', 400, 41);
    ctx.font = '600 10px ' + FONT; ctx.fillStyle = '#9fe0ec'; ctx.fillText('to ' + g.target, 400, 55);
    if (g.mode === 'throne' && throne) { ctx.font = '700 13px ' + FONT; ctx.fillStyle = '#ffd23f'; ctx.fillText(g.target === 7 && throne.round === THRONE_ROUNDS - 1 ? '👑 FINAL' : '👑 Round ' + (throne.round + 1) + '/' + THRONE_ROUNDS, 400, 76); }
    // serve marker
    const sx = g.serving === 0 ? 318 : 482;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, 22, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ee1a8c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 5, 22); ctx.lineTo(sx + 5, 22); ctx.stroke();
    // team names
    ctx.font = '700 13px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText(names[0], 14, 24, 150);
    ctx.textAlign = 'right'; ctx.fillText(names[1], C.W - 14, 24, 150);
    if (padSig) { ctx.font = '700 11px ' + FONT; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillText('Start: pause · Select: quit', C.W - 14, C.H - 8); }
    // Volley Fight: how to use the weapon (first seconds of a match)
    if (g.fight && g.frames < 480 && g.mode !== 'duel') {
      const me = g.mode === 'online' ? g.blobs[g.localTeam] : g.blobs.find(b => b.controller === 'human');
      if (me) {
        const key = usingPad ? 'RT' : touchMode ? 'the WEAPON button' : (g.mode === 'online' || g.mode === 'solo' || g.mode === 'team' ? 'Ctrl' : 'Ctrl');
        const txt = VB.kindOf(me.style) === 'ranged' ? (VB.RANGED[VB.FIGURES[me.style].weapon].ring ? 'Press ' + key + ' to shoot lightning in all directions' : 'Press ' + key + ' to shoot at the ball') : (me.style === 'transformer' ? 'Press ' + key + ' to kick the ball' : 'Press ' + key + ' to swing your weapon at the ball');
        ctx.globalAlpha = Math.min(1, (480 - g.frames) / 60);
        ctx.font = '700 16px ' + FONT; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(26,10,61,.85)'; ctx.strokeText(txt, 400, 432); ctx.fillStyle = '#ffe066'; ctx.fillText(txt, 400, 432);
        ctx.globalAlpha = 1;
      }
    }
    // touches (3 dots per side)
    for (let tm = 0; tm < 2; tm++) {
      const used = g.lastTouchTeam === tm ? g.touches[tm] : 0;
      for (let i = 0; i < 3; i++) {
        const cx = tm === 0 ? 20 + i * 16 : C.W - 20 - i * 16;
        ctx.beginPath(); ctx.arc(cx, 40, 5, 0, 7);
        ctx.fillStyle = i < used ? (used >= 3 ? '#ff6b5e' : '#ffe066') : 'rgba(255,255,255,.28)'; ctx.fill();
      }
    }
    // collected power-ups next to the score, plus active effect timers
    for (let tm = 0; tm < 2; tm++) {
      const inv = g.inv[tm], hasHuman = g.mode === 'online' ? tm === g.localTeam : g.blobs.some(b => b.team === tm && b.controller === 'human');
      for (let i = 0; i < C.PU_MAX_INV; i++) {
        const cx = tm === 0 ? 270 - i * 32 : 530 + i * 32, cy = 34, filled = i < inv.length;
        ctx.fillStyle = 'rgba(26,10,61,.62)'; rr(cx - 14, cy - 14, 28, 28, 7); ctx.fill();
        ctx.strokeStyle = filled ? 'rgba(105,203,220,.98)' : 'rgba(255,255,255,.2)'; ctx.lineWidth = filled ? 2 : 1; ctx.stroke();
        if (filled) Scene.drawItemIcon(ctx, inv[i], cx, cy + 1, 22);
      }
      if (hasHuman && inv.length) {
        ctx.font = '700 10px ' + FONT; ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,120,200,${0.75 + 0.25 * Math.sin(t * 6)})`;
        ctx.fillText(g.mode === 'duel' && tm === 1 ? 'R-Ctrl' : 'Ctrl', tm === 0 ? 270 : 530, 59);
      }
      // active effects: Fluffy Towel (own half, good) and Alman Mode (slows this team down, bad)
      const fx = [];
      if (g.towels[tm] > 0) fx.push({ icon: 'towel', left: g.towels[tm], max: C.TOWEL_FRAMES, good: true });
      if (g.aura[tm] > 0) fx.push({ icon: 'aura', left: g.aura[tm], max: C.AURA_FRAMES, good: true });
      if (g.faulty[tm] > 0) fx.push({ icon: 'level', left: g.faulty[tm], max: C.LEVEL_FRAMES, good: true });
      if (g.alman[tm] > 0) fx.push({ icon: 'alman', left: g.alman[tm], max: C.ALMAN_FRAMES, good: false });
      fx.forEach((f, i) => {
        const x = tm === 0 ? 180 : 515, y = 64 + i * 21;
        ctx.fillStyle = f.good ? 'rgba(26,10,61,.68)' : 'rgba(110,10,70,.7)'; rr(x, y, 105, 17, 8); ctx.fill();
        Scene.drawItemIcon(ctx, f.icon, x + 11, y + 8.5, 15);
        ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x + 23, y + 6, 58, 5);
        ctx.fillStyle = f.left < 180 ? '#ff9d8a' : (f.good ? '#69cbdc' : '#ff4fa3'); ctx.fillRect(x + 23, y + 6, 58 * f.left / f.max, 5);
        ctx.font = '700 10px ' + FONT; ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
        ctx.fillText(Math.ceil(f.left / 60) + 's', x + 100, y + 12);
      });
    }
    if (settings.muted) { ctx.textAlign = 'right'; ctx.font = '16px ' + FONT; ctx.fillStyle = '#fff'; ctx.fillText('🔇', C.W - 12, C.H - 10); }
    // messages
    ctx.textAlign = 'center';
    if (g.state === 'serve' && phase !== 'menu') {
      ctx.font = '700 22px ' + FONT; ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 4;
      const txt = `Serve: ${names[g.serving]}`; ctx.strokeText(txt, 400, 112); ctx.fillText(txt, 400, 112);
    } else if (g.messageTimer > 0 && g.message) {
      ctx.font = '800 28px ' + FONT; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 5;
      ctx.strokeText(g.message, 400, 112); ctx.fillText(g.message, 400, 112);
    }
  }

  function render(t) {
    const g = game || demo;
    ctx = loCtx; ctx.setTransform(1 / PIX, 0, 0, 1 / PIX, 0, 0);
    Scene.drawBackground(ctx, t, g && g.tilt ? { b: g.netBase(), t: g.netTopX() } : null, g && g.stageId);
    if (g) {
      g._ballRot = g._ballRot || { rot: 0 };
      Scene.drawTowels(ctx, g, t);
      for (const pu of g.items) Scene.drawPowerup(ctx, pu, t);
      g.blobs.forEach(b => { b.cheer = g.state === 'over' && b.team === g.winner; Scene.drawBlob(ctx, b, g.ball, t); });
      if (g.shots && g.shots.length) Scene.drawShots(ctx, g.shots, t);
      if (fxs.length) { const now = performance.now() / 1000; while (fxs.length && now - fxs[0].t0 > 0.6) fxs.shift(); Scene.drawFx(ctx, fxs, now); }
      drawBall(g.ball, g._ballRot);
    }
    // pixel look: scale the small world canvas up without smoothing, then draw crisp text on top
    ctx = mainCtx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lo, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (!g) return;
    g.blobs.forEach(b => Scene.drawLabel(ctx, b));
    if (!MENU_PHASES.has(phase)) drawHUD(g, t);
  }

  /* ------------------------------------------------------------ online play */
  /* The host runs the whole simulation (and the CPU-free 1 vs 1 rules); the guest sends its keys and renders the snapshots.
   * Everything is derived from the snapshots, so lost packets (unreliable channel) simply do not matter. */
  const cleanName = v => (v || '').replace(/\s+/g, ' ').trim().slice(0, 12);
  const goodColor = c => (PALETTE.some(p => p[1] === c) ? c : PALETTE[0][1]);
  const otherColor = c => (PALETTE.find(p => p[1] !== c) || PALETTE[1])[1];

  function renderOnlineLook() {
    fillLook($('onLook'), 'p1', null, renderOnlineLook);
  }
  function onlineStatus(text) { $('onStatus').textContent = text || ''; }
  function showLobby(text, code) {
    $('onName').value = names.p1;
    $('onChoose').hidden = false; $('onWait').hidden = true; $('onFields').hidden = false;
    lobbyBusy(false);
    if (code) $('onCodeIn').value = code;
    onlineStatus(text);
    renderOnlineLook();
    game = null; setPhase('online');
  }
  function leaveOnline(text) {
    const was = !!online;
    if (online && online.helloTimer) clearInterval(online.helloTimer);
    online = null; Net.close();
    if (was && text) showLobby(text); else if (phase === 'online' || was) { game = null; setPhase('menu'); }
  }
  function myLook() {
    names.p1 = cleanName($('onName').value); store.set('vb_names', names);
    return { n: names.p1, c: looks.p1.color, s: looks.p1.style };
  }
  function lobbyBusy(on) { $('btnCreate').disabled = $('btnJoin').disabled = on; }

  function openOnline(code) {
    if (!Net.available()) { showLobby('Online play needs the PeerJS library (vendor/peerjs.min.js) – reload the page.'); return; }
    showLobby('', code);
    setTimeout(() => (code ? $('onName') : $('onName')).focus(), 30);
  }

  function createRoom() {
    settings.fight = $('onRules').value === 'fight'; settings.target = +$('onTarget').value; settings.stage = $('onStage').value; saveSettings(); $('target').value = String(settings.target);
    const me = myLook(); lobbyBusy(true); onlineStatus('Opening a room…');
    online = { role: 'host', me, gid: 0, seq: 0, rin: { m: 0, jc: 0, sc: 0, rm: 0 }, seenJc: 0, seenSc: 0, myRm: false };
    Net.host({
      onCode(code) {
        $('onChoose').hidden = true; $('onWait').hidden = false; $('onFields').hidden = true; $('onCode').textContent = code;
        online.code = code; onlineStatus('Waiting for your friend… (keep this page open)');
      },
      onOpen() { onlineStatus('Friend connected – starting…'); },
      onData(m) {
        if (!online) return;
        if (m.t === 'h' && online.gid === 0) hostStartMatch(m);
        else if (m.t === 'i') online.rin = VBNet.cleanInput(m);
      },
      onClose() { if (online) leaveOnline('Your opponent left the match.'); },
      onError(text) { lobbyBusy(false); leaveOnline(text); showLobby(text); }
    });
  }
  function joinRoom() {
    const code = $('onCodeIn').value.toUpperCase().replace(/[^A-Z]/g, '');
    if (code.length !== 4) { onlineStatus('Enter the 4-letter room code.'); return; }
    const me = myLook(); lobbyBusy(true); onlineStatus('Connecting…');
    online = { role: 'guest', me, gid: -1, lastQ: -1, q: [], primed: false, starve: 0, pendEv: [], jc: 0, sc: 0, prev: {}, myRm: false };
    Net.join(code, {
      onOpen() {
        onlineStatus('Connected – waiting for the host…');
        const hello = () => Net.send({ t: 'h', n: me.n, c: me.c, g: me.g, s: me.s });
        hello(); online.helloTimer = setInterval(hello, 300);     // unreliable channel: repeat until the first snapshot arrives
      },
      onData(m) { if (online && m.t === 's') guestReceive(m); },
      onClose() { if (online) leaveOnline('The host left the match.'); },
      onError(text) { lobbyBusy(false); leaveOnline(text); showLobby(text); }
    });
  }

  /* ---- host ---- */
  function hostStartMatch(h) {
    const mine = online.me;
    online.guest = { name: cleanName(h.n) || 'Guest', color: goodColor(h.c), style: styleOf(h.s) };
    if (online.guest.color === mine.c) online.guest.color = otherColor(mine.c);
    newOnlineGame();
  }
  function newOnlineGame() {
    const mine = online.me, gu = online.guest;
    const hn = mine.n || 'Host';
    online.gid++; online.seq = 0; online.myRm = false;
    online.seenJc = online.rin.jc; online.seenSc = online.rin.sc; online.rin.rm = 0;
    online.cfg = { gid: online.gid, names: [hn, gu.name], colors: [mine.c, gu.color], styles: [mine.s, gu.style], target: settings.target, fight: settings.fight ? 1 : 0, stage: pickStage(settings.stage) };
    game = new Sim({ teams: [[{ controller: 'human', color: mine.c, style: mine.s, label: hn }], [{ controller: 'human', color: gu.color, style: gu.style, label: gu.name }]], level: 'normal', target: settings.target, fight: settings.fight, stage: online.cfg.stage });
    game.mode = 'online'; game.localTeam = 0; game.teamNames = [hn, gu.name];
    setPhase('play');
  }

  /* ---- guest ---- */
  function buildGuestGame(cfg) {
    online.gid = cfg.gid; online.lastQ = -1; online.q.length = 0; online.pendEv.length = 0; online.primed = false; online.myRm = false;
    if (online.helloTimer) { clearInterval(online.helloTimer); online.helloTimer = null; }
    const spec = i => ({ controller: 'human', color: goodColor(cfg.colors[i]), style: styleOf(cfg.styles && cfg.styles[i]), label: cleanName(cfg.names[i]) });
    const target = [5, 11, 15].includes(cfg.target) ? cfg.target : 11;
    game = new Sim({ teams: [[spec(0)], [spec(1)]], level: 'normal', target, fight: !!cfg.fight, stage: STAGE_IDS.includes(cfg.stage) ? cfg.stage : 'beach' });
    game.mode = 'online'; game.localTeam = 1; game.teamNames = [cleanName(cfg.names[0]), cleanName(cfg.names[1])];
    setPhase('play');
  }
  function guestReceive(m) {
    if (m.cfg && typeof m.cfg === 'object' && m.cfg.gid !== online.gid && Array.isArray(m.cfg.names) && Array.isArray(m.cfg.colors)) buildGuestGame(m.cfg);
    if (m.g !== online.gid || !game || m.q <= online.lastQ) return;
    online.lastQ = m.q; online.q.push(m);
  }

  /* one 60 Hz tick of an online match (host: simulate + send; guest: send keys + show the received state) */
  function stepOnline(now) {
    const live = phase === 'play';
    const inp = live ? readFor({ keymap: 'BOTH' }) : { left: false, right: false, jump: false, special: false };
    if (Date.now() - Net.lastRx > 6000) { leaveOnline(online.role === 'host' ? 'Your opponent disconnected.' : 'Lost the connection to the host.'); return; }

    if (online.role === 'host') {
      Object.assign(game.blobs[0].input, inp);
      const rin = online.rin, g1 = game.blobs[1].input;
      g1.left = !!(rin.m & 1); g1.right = !!(rin.m & 2);
      g1.jump = !!(rin.m & 4) || rin.jc !== online.seenJc;          // a tap whose packet was seen only as a counter change still counts
      g1.special = !!(rin.m & 8) || rin.sc !== online.seenSc;
      online.seenJc = rin.jc; online.seenSc = rin.sc;
      game.step();
      game.blobs.forEach(Scene.jelly);
      for (const e of game.events) { playEvent(e); if (e.type === 'hit') Scene.poke(game.blobs[e.blob], e); if (e.type === 'win') showOver(); }
      Net.send(VBNet.snapshot(game, ++online.seq, online.gid, (game.frames < 180 || game.frames % 60 === 0) ? online.cfg : null));
      if (phase === 'over' && online.myRm && rin.rm) newOnlineGame();
      return;
    }

    // guest: key presses (counters make short taps survive packet loss)
    const pv = online.prev;
    if (inp.jump && !pv.jump) online.jc++;
    if (inp.special && !pv.special) online.sc++;
    online.prev = inp;
    Net.send(VBNet.packInput(inp, online.jc, online.sc, online.myRm));

    // play back snapshots with a small jitter buffer
    const q = online.q;
    if (!online.primed && q.length >= 2) online.primed = true;
    if (!online.primed) return;
    if (!q.length) { if (++online.starve > 10) online.primed = false; return; }
    online.starve = 0;
    while (q.length > 3) online.pendEv.push(...q.shift().ev);        // far behind: catch up, but keep their sounds
    const s = q.shift();
    try { VBNet.applySnapshot(game, s); } catch (err) { return; }
    game.events = online.pendEv.concat(game.events); online.pendEv.length = 0;
    game.blobs.forEach(Scene.jelly);
    for (const e of game.events) {
      playEvent(e);
      if (e.type === 'hit' && game.blobs[e.blob]) Scene.poke(game.blobs[e.blob], e);
      if (e.type === 'win' && phase !== 'over') showOver();
    }
  }

  $('btnOnline').onclick = () => openOnline();
  $('btnCreate').onclick = createRoom;
  $('btnJoin').onclick = joinRoom;
  $('btnOnBack').onclick = () => { lobbyBusy(false); leaveOnline(); setPhase('menu'); };
  $('onCodeIn').oninput = () => { $('onCodeIn').value = $('onCodeIn').value.toUpperCase().replace(/[^A-Z]/g, ''); };
  $('btnShare').onclick = async () => {
    const url = location.origin + location.pathname + '?room=' + (online && online.code || '');
    const text = 'Play Beach Volley Hero with me! Room code: ' + (online && online.code);
    try {
      if (navigator.share) await navigator.share({ title: 'Beach Volley Hero', text, url });
      else { await navigator.clipboard.writeText(url); onlineStatus('Invite link copied!'); }
    } catch (err) { /* cancelled */ }
  };
  { const room = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    if (room.length === 4) setTimeout(() => openOnline(room), 0); }

  /* ------------------------------------------------------------- main loop */
  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0, demoDone = 0;
  function newDemo() {
    const A = (c, style) => ({ controller: 'ai', color: c, style, label: 'CPU' });
    demo = new Sim({ teams: [[A(COLORS.blue, 'ninja'), A(COLORS.green, 'mcrib')], [A(COLORS.red, 'cowboy'), A(COLORS.yellow, 'kindi')]], level: 'normal', target: 5 });
    demo.teamNames = ['', '']; demoDone = 0;
  }
  newDemo();

  /* ------------------------------------------------------------ gamepad */
  /* Standard layout: A = jump / select, B = back, left stick or D-pad = move, RT (or RB) = power-up / weapon, Start = pause.
   * Controller 1 plays Player 1 (the same keys as WASD + Ctrl), controller 2 plays Player 2. In the menus every controller navigates.
   * Browsers only list a controller after a button was pressed on it once. */
  const PAD = { jump: [0], special: [7, 5], left: [14], right: [15], up: [12], down: [13], ok: 0, back: 1, start: 9, select: 8, dead: 0.45 };
  const PAD_CODES = ['PadLeft', 'PadRight', 'PadJump', 'PadSpecial', 'Pad2Left', 'Pad2Right', 'Pad2Jump', 'Pad2Special'];
  let usingPad = false, padSig = '', padPrev = { ok: false, back: false, start: false, select: false }, padDir = {};
  function padStatus(list) {
    const sig = list.map(g => g.id).join('|');
    if (sig === padSig) return;
    padSig = sig;
    const short = id => id.replace(/\s*\(.*$/, '').replace(/\s*Vendor:.*$/i, '').trim().slice(0, 40) || 'Controller';
    const txt = list.length ? '🎮 ' + (list.length > 1 ? list.length + ' controllers' : short(list[0].id)) + ' connected' : '';
    const b = $('padBadge'); b.textContent = txt; b.hidden = !list.length; document.body.classList.toggle('haspad', list.length > 0);
    const st = $('padState');
    if (list.length) { st.textContent = '– ' + txt.slice(3); st.className = 'padstate on'; }
    else { st.textContent = '– no controller found (press any button on it)'; st.className = 'padstate off'; }
  }
  function pollPads() {
    const all = navigator.getGamepads ? navigator.getGamepads() : [];
    const list = [...all].filter(g => g && g.connected);
    padStatus(list);
    PAD_CODES.forEach(c => keys.delete(c));
    if (!list.length) return;
    const btn = (g, n) => !!(g.buttons[n] && (g.buttons[n].pressed || g.buttons[n].value > 0.5));
    const anyBtn = (g, arr) => arr.some(n => btn(g, n));
    const now = performance.now();
    const dirs = { left: false, right: false, up: false, down: false }, cur = { ok: false, back: false, start: false, select: false };
    list.forEach((g, i) => {
      const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
      const left = ax < -PAD.dead || anyBtn(g, PAD.left), right = ax > PAD.dead || anyBtn(g, PAD.right);
      const jump = anyBtn(g, PAD.jump), special = anyBtn(g, PAD.special);
      if (phase === 'play' && i < 2) {
        const p = i === 0 ? 'Pad' : 'Pad2';
        if (left) keys.add(p + 'Left'); if (right) keys.add(p + 'Right'); if (jump) keys.add(p + 'Jump'); if (special) keys.add(p + 'Special');
      }
      if (left) dirs.left = true; if (right) dirs.right = true;
      if (ay < -PAD.dead || anyBtn(g, PAD.up)) dirs.up = true;
      if (ay > PAD.dead || anyBtn(g, PAD.down)) dirs.down = true;
      if (btn(g, PAD.ok)) cur.ok = true; if (btn(g, PAD.back)) cur.back = true; if (btn(g, PAD.start)) cur.start = true; if (btn(g, PAD.select)) cur.select = true;
      if (left || right || jump || special || ay < -PAD.dead || ay > PAD.dead) usingPad = true;
    });
    let startUsed = false;
    // menus: directions repeat while held, A / B / Start act once per press
    if (NAV_PHASES.has(phase)) {
      for (const d of ['up', 'down', 'left', 'right']) {
        if (!dirs[d]) { padDir[d] = 0; continue; }
        if (!padDir[d]) { padDir[d] = now + 380; uiAction(d); }
        else if (now >= padDir[d]) { padDir[d] = now + 130; uiAction(d); }
      }
      if (cur.ok && !padPrev.ok) uiAction('ok');
      if (cur.back && !padPrev.back) uiAction('back');
      // Start jumps straight to Next / Fight! on the hero and stage screens, wherever the focus is
      if (cur.start && !padPrev.start && (phase === 'setup' || phase === 'stage')) { startUsed = true; $(phase === 'setup' ? 'btnStart' : 'btnStageGo').click(); }
    } else padDir = {};
    // Start = pause menu (Resume / Menu), press again to resume; Select (Back / View) = pause menu with "Menu" ready, so Select + A leaves the match
    if (cur.start && !padPrev.start && !startUsed) { if (phase === 'play') openPause(); else if (phase === 'pause') setPhase('play'); }
    if (cur.select && !padPrev.select) { if (phase === 'play') { openPause(); $('btnQuit').focus(); } else if (phase === 'pause') setPhase('play'); }
    padPrev = cur;
    // right stick scrolls long pages (How to play ...)
    const sy = Math.max(...list.map(g => Math.abs(g.axes[3] || 0) > 0.3 ? (g.axes[3] || 0) : 0), 0) || Math.min(...list.map(g => Math.abs(g.axes[3] || 0) > 0.3 ? (g.axes[3] || 0) : 0), 0);
    if (sy && NAV_PHASES.has(phase)) { const pn = document.querySelector('.overlay:not([hidden]) .panel'); if (pn) pn.scrollTop += sy * 12; }
  }
  addEventListener('gamepadconnected', () => { padSig = ''; });
  addEventListener('gamepaddisconnected', () => { padSig = ''; });

  function frame(now) {
    pollPads();
    acc += Math.min(100, now - last); last = now;
    while (acc >= STEP) {
      acc -= STEP;
      if (online && game && (phase === 'play' || phase === 'over' || phase === 'pause')) {
        stepOnline(now);
      } else if (phase === 'play' || phase === 'over') {
        if (phase === 'play') game.blobs.forEach(b => { if (b.controller === 'human') Object.assign(b.input, readFor(b)); });
        game.step();
        game.blobs.forEach(Scene.jelly);
        for (const e of game.events) { playEvent(e); if (e.type === 'hit') Scene.poke(game.blobs[e.blob], e); if (e.type === 'win') showOver(); }
      } else if (MENU_PHASES.has(phase)) {
        demo.step();
        demo.blobs.forEach(Scene.jelly);
        for (const e of demo.events) if (e.type === 'hit') Scene.poke(demo.blobs[e.blob], e);
        if (demo.state === 'over' && ++demoDone > 150) newDemo();
      }
    }
    render(now / 1000);
    drawPreviews(now / 1000);
    requestAnimationFrame(frame);
  }
  setPhase('menu');
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
