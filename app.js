/* Volley-Buddy – frontend: canvas rendering, input, menus, high scores, sound */
(function () {
  'use strict';
  const { C, Sim, LEVELS } = VB;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');

  /* ------------------------------------------------------------- storage */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
    }
  };
  const LEVEL_MAP = { leicht: 'easy', mittel: 'normal', schwer: 'hard' };   // saved by earlier versions
  const LEVEL_LABEL = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
  const settings = Object.assign({ level: 'normal', target: 11, muted: false }, store.get('vb_settings', {}));
  settings.level = LEVEL_MAP[settings.level] || settings.level;
  if (!LEVELS[settings.level]) settings.level = 'normal';
  let names = Object.assign({ p1: '', p2: '' }, store.get('vb_names', {}));
  let scores = store.get('vb_scores', []);
  let duel = store.get('vb_duel', [0, 0]);
  const saveSettings = () => store.set('vb_settings', settings);

  $('level').value = settings.level; $('target').value = String(settings.target);

  /* --------------------------------------------------------------- state */
  let phase = 'menu';           // menu | setup | scores | play | pause | over
  let game = null, demo = null, setupMode = null, lastSetup = null;
  const COLORS = { blue: '#3aa0ff', red: '#ff5a55', green: '#4cd964', yellow: '#ffc933' };
  const PALETTE = [['Blue', '#3aa0ff'], ['Red', '#ff5a55'], ['Green', '#4cd964'], ['Yellow', '#ffc933'],
                   ['Orange', '#ff9a3c'], ['Purple', '#b36bff'], ['Pink', '#ff7ac8'], ['Turquoise', '#2fd9c8']];
  const looks = Object.assign({ p1: { color: PALETTE[0][1], gender: 'm' }, p2: { color: PALETTE[1][1], gender: 'm' } }, store.get('vb_looks', {}));
  function renderLooks() {
    ['p1', 'p2'].forEach((slot, n) => {
      const box = $('look' + (n + 1)), other = looks[slot === 'p1' ? 'p2' : 'p1'];
      const twoPlayers = setupMode !== 'solo';
      box.innerHTML = '';
      PALETTE.forEach(([name, col]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.background = col; b.title = name;
        if (looks[slot].color === col) b.classList.add('sel');
        if (twoPlayers && other.color === col) b.classList.add('taken');
        b.onclick = () => { if (twoPlayers && other.color === col) return; looks[slot].color = col; store.set('vb_looks', looks); renderLooks(); };
        box.appendChild(b);
      });
      const gap = document.createElement('span'); gap.className = 'gap'; box.appendChild(gap);
      [['m', '♂ Male'], ['f', '♀ Female']].forEach(([g, label]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'gd' + (looks[slot].gender === g ? ' sel' : ''); b.textContent = label;
        b.onclick = () => { looks[slot].gender = g; store.set('vb_looks', looks); renderLooks(); };
        box.appendChild(b);
      });
    });
  }

  function setPhase(p) {
    phase = p;
    $('menu').hidden = p !== 'menu';
    $('setup').hidden = p !== 'setup';
    $('scores').hidden = p !== 'scores';
    $('pause').hidden = p !== 'pause';
    $('over').hidden = p !== 'over';
  }

  /* -------------------------------------------------------------- layout */
  function resize() {
    const k = Math.min(innerWidth / C.W, innerHeight / C.H);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = Math.floor(C.W * k) + 'px';
    canvas.style.height = Math.floor(C.H * k) + 'px';
    canvas.width = Math.round(C.W * k * dpr);
    canvas.height = Math.round(C.H * k * dpr);
    ctx.setTransform(canvas.width / C.W, 0, 0, canvas.height / C.H, 0, 0);
  }
  addEventListener('resize', resize); resize();

  /* --------------------------------------------------------------- audio */
  let ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  /* Alman Mode jingle: first line of the German anthem ("Einigkeit und Recht und Freiheit", Haydn) in a cheap-organ sound,
     slightly out of tune and with a sagging last note. */
  function anthem() {
    if (settings.muted) return;
    const ac2 = audio(); if (!ac2) return;
    // [semitones above C4 (G major: D4 = 2, G4 = 7 ...), beats]   Ei - nig - keit und Recht und Frei - heit
    const song = [[2, .5], [7, 1.5], [9, .5], [11, 1], [9, 1], [12, 1], [11, 1], [9, 2.5]];
    const beat = 0.27;
    let t = ac2.currentTime + 0.02;
    song.forEach(([n, beats], i) => {
      const d = beats * beat, f = 261.63 * Math.pow(2, n / 12), last = i === song.length - 1;
      const g = ac2.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.02);
      g.gain.setValueAtTime(0.11, t + d * 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + d);
      g.connect(ac2.destination);
      [['sawtooth', 0], ['square', 7]].forEach(([type, extra]) => {
        const o = ac2.createOscillator(); o.type = type; o.frequency.value = f;
        o.detune.setValueAtTime((Math.random() - 0.5) * 50 + extra, t);          // up to +-25 cents off
        if (last) o.detune.linearRampToValueAtTime(-260, t + d);                   // the final note sags
        o.connect(g); o.start(t); o.stop(t + d + 0.05);
      });
      t += d;
    });
  }

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
  function playEvent(e) {
    switch (e.type) {
      case 'hit': tone(170 + e.power * 130, 0.1, 'square', 0.1, -70); break;
      case 'jump': tone(260, 0.07, 'sine', 0.05, 160); break;
      case 'net': tone(320, 0.06, 'triangle', 0.1, -90); break;
      case 'wall': tone(230, 0.05, 'triangle', 0.07, -60); break;
      case 'towel': tone(140, 0.16, 'sine', 0.16, -50); tone(210, 0.1, 'triangle', 0.06, 40, 0.02); break;
      case 'spawn': tone(880, 0.1, 'sine', 0.05); tone(1175, 0.14, 'sine', 0.05, 0, 0.08); break;
      case 'collect': tone(660, 0.1, 'triangle', 0.12); tone(990, 0.18, 'triangle', 0.12, 0, 0.08); break;
      case 'activate':
        if (e.item === 'alman') anthem();
        else if (e.item === 'aura') { [784, 988, 1319, 1568].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, 0, i * 0.07)); }   // cool sparkle
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
  const keys = new Set();
  const MAP = {
    P1: { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW'], special: ['ControlLeft', 'ShiftLeft'] },
    P2: { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], special: ['ControlRight', 'ShiftRight', 'Numpad0'] }
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
    audio();
    const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT');
    if (typing) {
      if (phase === 'setup' && e.key === 'Enter' && e.target.tagName === 'INPUT') beginMatch();
      else if (phase === 'setup' && e.key === 'Escape') setPhase('menu');
      return;
    }
    if (phase === 'play' || phase === 'pause') {
      // swallow Ctrl+W/A/D etc. as far as the browser allows
      if (GAME_CODES.has(e.code) || e.ctrlKey) e.preventDefault();
    }
    if (e.repeat) { keys.add(e.code); return; }
    keys.add(e.code);
    if (e.code === 'KeyM') { settings.muted = !settings.muted; saveSettings(); }
    if (e.code === 'KeyF') {
      try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } catch (err) { /* not allowed */ }
    }
    if (phase === 'play' && (e.code === 'KeyP' || e.code === 'Escape')) setPhase('pause');
    else if (phase === 'pause' && (e.code === 'KeyP' || e.code === 'Escape')) setPhase('play');
    else if (phase === 'setup' && e.code === 'Escape') setPhase('menu');
    if (phase === 'menu') {
      if (e.code === 'Digit1') openSetup('duel');
      if (e.code === 'Digit2') openSetup('team');
      if (e.code === 'Digit3') openSetup('solo');
    }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); if (phase === 'play') setPhase('pause'); });
  addEventListener('beforeunload', e => { if (phase === 'play' || phase === 'pause') { e.preventDefault(); e.returnValue = ''; } });

  /* --------------------------------------------------------- player names */
  function openSetup(mode) {
    setupMode = mode;
    $('name1').value = names.p1; $('name2').value = names.p2;
    $('row2').hidden = mode === 'solo';
    $('setupTitle').textContent = { duel: '1 vs 1 – who is playing?', team: '2 vs 2 – your team', solo: '1 vs CPU – who are you?' }[mode];
    $('lbl1').textContent = mode === 'solo' ? 'Your name' : 'Player 1';
    $('hint1').textContent = mode === 'solo' ? 'WASD or arrow keys' : 'A D · W · Ctrl';
    $('hint2').textContent = '← → · ↑ · Right Ctrl';
    if (mode !== 'solo' && looks.p1.color === looks.p2.color) looks.p2.color = (PALETTE.find(p => p[1] !== looks.p1.color) || PALETTE[1])[1];
    renderLooks();
    setPhase('setup');
    setTimeout(() => { $('name1').focus(); $('name1').select(); }, 30);
  }
  function beginMatch() {
    const clean = v => (v || '').replace(/\s+/g, ' ').trim().slice(0, 12);
    const n1 = clean($('name1').value), n2 = clean($('name2').value);
    names.p1 = n1; names.p2 = n2; store.set('vb_names', names);
    settings.level = $('level').value; settings.target = +$('target').value; saveSettings();
    startGame(setupMode, n1 || (setupMode === 'solo' ? 'You' : 'Player 1'), n2 || 'Player 2');
  }

  /* --------------------------------------------------------- start a match */
  function startGame(mode, p1, p2) {
    lastSetup = { mode, p1, p2 };
    const H = (slot, label) => ({ controller: 'human', color: looks[slot].color, gender: looks[slot].gender, label });
    const humanCols = mode === 'solo' ? [looks.p1.color] : [looks.p1.color, looks.p2.color];
    const free = PALETTE.map(p => p[1]).filter(c => !humanCols.includes(c));      // CPU bears take colors nobody chose
    let ci = 0;
    const A = () => ({ controller: 'ai', color: free[ci++ % free.length], gender: Math.random() < 0.5 ? 'm' : 'f', label: 'CPU' });
    let teams, tn;
    if (mode === 'duel') { teams = [[H('p1', p1)], [H('p2', p2)]]; tn = [p1, p2]; }
    else if (mode === 'team') { teams = [[H('p1', p1), H('p2', p2)], [A(), A()]]; tn = [p1 + ' & ' + p2, 'CPU']; }
    else { teams = [[H('p1', p1)], [A()]]; tn = [p1, 'CPU']; }
    game = new Sim({ teams, level: settings.level, target: settings.target });
    game.mode = mode; game.teamNames = tn;
    const humans = game.blobs.filter(b => b.controller === 'human');
    humans.forEach((b, i) => { b.keymap = mode === 'solo' ? 'BOTH' : (i === 0 ? 'P1' : 'P2'); });
    setPhase('play');
  }

  /* ------------------------------------------------------------ match end */
  function showOver() {
    const w = game.winner, s = game.score;
    const mult = LEVELS[game.level].mult;
    let title, info = `${s[0]} : ${s[1]} · longest rally ${game.longestRally}`, rank = '';
    if (game.mode === 'duel') {
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
    $('overTitle').textContent = title; $('overInfo').textContent = info; $('overRank').textContent = rank;
    setPhase('over');
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
      sm.textContent = ` ${s.pts[0]}:${s.pts[1]} · ${s.mode === 'team' ? '2v2' : '1v1'} CPU ${LEVEL_LABEL[lv] || lv} · rally ${s.rally} · ${new Date(s.date).toLocaleDateString('en-GB')}`;
      li.append(sc, nm, sm); ol.appendChild(li);
    });
    $('duelStats').textContent = `Duel record (local 1 vs 1): Player 1 ${duel[0]} – ${duel[1]} Player 2`;
  }

  /* ------------------------------------------------------------- UI buttons */
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => openSetup(b.dataset.mode)));
  $('btnStart').onclick = beginMatch;
  $('btnSetupBack').onclick = () => setPhase('menu');
  $('btnScores').onclick = () => { renderScores(); setPhase('scores'); };
  $('btnScoresBack').onclick = () => setPhase('menu');
  let clearArmed = false;
  $('btnScoresClear').onclick = () => {
    const btn = $('btnScoresClear');
    if (!clearArmed) { clearArmed = true; btn.textContent = 'Really reset?'; setTimeout(() => { clearArmed = false; btn.textContent = 'Reset'; }, 3000); return; }
    clearArmed = false; btn.textContent = 'Reset';
    scores = []; duel = [0, 0]; store.set('vb_scores', scores); store.set('vb_duel', duel); renderScores();
  };
  $('btnResume').onclick = () => setPhase('play');
  $('btnQuit').onclick = () => { game = null; setPhase('menu'); };
  $('btnAgain').onclick = () => startGame(lastSetup.mode, lastSetup.p1, lastSetup.p2);
  $('btnMenu').onclick = () => { game = null; setPhase('menu'); };
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
    ctx.fillStyle = '#f2b705'; ctx.fillRect(-r, -3.5, 2 * r, 7);
    ctx.fillStyle = '#2f80ed'; ctx.fillRect(-3.5, -r, 7, 2 * r);
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
    ctx.fillStyle = 'rgba(8,28,48,.62)'; rr(300, 8, 200, 52, 12); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = '800 32px system-ui,sans-serif';
    ctx.fillStyle = cols[0]; ctx.fillText(g.score[0], 348, 44);
    ctx.fillStyle = cols[1]; ctx.fillText(g.score[1], 452, 44);
    ctx.fillStyle = '#fff'; ctx.font = '700 18px system-ui'; ctx.fillText(':', 400, 41);
    ctx.font = '600 10px system-ui'; ctx.fillStyle = '#b9d6ee'; ctx.fillText('to ' + g.target, 400, 55);
    // serve marker
    const sx = g.serving === 0 ? 318 : 482;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, 22, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#f2b705'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 5, 22); ctx.lineTo(sx + 5, 22); ctx.stroke();
    // team names
    ctx.font = '700 13px system-ui'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText(names[0], 14, 24, 150);
    ctx.textAlign = 'right'; ctx.fillText(names[1], C.W - 14, 24, 150);
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
      const inv = g.inv[tm], hasHuman = g.blobs.some(b => b.team === tm && b.controller === 'human');
      for (let i = 0; i < C.PU_MAX_INV; i++) {
        const cx = tm === 0 ? 270 - i * 32 : 530 + i * 32, cy = 34, filled = i < inv.length;
        ctx.fillStyle = 'rgba(8,28,48,.55)'; rr(cx - 14, cy - 14, 28, 28, 7); ctx.fill();
        ctx.strokeStyle = filled ? 'rgba(255,230,120,.95)' : 'rgba(255,255,255,.2)'; ctx.lineWidth = filled ? 2 : 1; ctx.stroke();
        if (filled) Scene.drawItemIcon(ctx, inv[i], cx, cy + 1, 22);
      }
      if (hasHuman && inv.length) {
        ctx.font = '700 10px system-ui'; ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,236,120,${0.7 + 0.3 * Math.sin(t * 6)})`;
        ctx.fillText(g.mode === 'duel' && tm === 1 ? 'R-Ctrl' : 'Ctrl', tm === 0 ? 270 : 530, 59);
      }
      // active effects: Fluffy Towel (own half, good) and Alman Mode (slows this team down, bad)
      const fx = [];
      if (g.towels[tm] > 0) fx.push({ icon: 'towel', left: g.towels[tm], max: C.TOWEL_FRAMES, good: true });
      if (g.aura[tm] > 0) fx.push({ icon: 'aura', left: g.aura[tm], max: C.AURA_FRAMES, good: true });
      if (g.alman[tm] > 0) fx.push({ icon: 'alman', left: g.alman[tm], max: C.ALMAN_FRAMES, good: false });
      fx.forEach((f, i) => {
        const x = tm === 0 ? 180 : 515, y = 64 + i * 21;
        ctx.fillStyle = f.good ? 'rgba(8,28,48,.6)' : 'rgba(90,10,10,.65)'; rr(x, y, 105, 17, 8); ctx.fill();
        Scene.drawItemIcon(ctx, f.icon, x + 11, y + 8.5, 15);
        ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x + 23, y + 6, 58, 5);
        ctx.fillStyle = f.left < 180 ? '#ff9d8a' : (f.good ? '#7fe3a0' : '#ffce00'); ctx.fillRect(x + 23, y + 6, 58 * f.left / f.max, 5);
        ctx.font = '700 10px system-ui'; ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
        ctx.fillText(Math.ceil(f.left / 60) + 's', x + 100, y + 12);
      });
    }
    if (settings.muted) { ctx.textAlign = 'right'; ctx.font = '16px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText('🔇', C.W - 12, C.H - 10); }
    // messages
    ctx.textAlign = 'center';
    if (g.state === 'serve' && phase !== 'menu') {
      ctx.font = '700 22px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 4;
      const txt = `Serve: ${names[g.serving]}`; ctx.strokeText(txt, 400, 112); ctx.fillText(txt, 400, 112);
    } else if (g.messageTimer > 0 && g.message) {
      ctx.font = '800 28px system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 5;
      ctx.strokeText(g.message, 400, 112); ctx.fillText(g.message, 400, 112);
    }
  }

  function render(t) {
    const g = game || demo;
    Scene.drawBackground(ctx, t);
    if (!g) return;
    g._ballRot = g._ballRot || { rot: 0 };
    Scene.drawTowels(ctx, g, t);
    for (const pu of g.items) Scene.drawPowerup(ctx, pu, t);
    g.blobs.forEach(b => Scene.drawBlob(ctx, b, g.ball, t));
    drawBall(g.ball, g._ballRot);
    if (phase !== 'menu' && phase !== 'scores' && phase !== 'setup') drawHUD(g, t);
  }

  /* ------------------------------------------------------------- main loop */
  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0, demoDone = 0;
  function newDemo() {
    const A = (c, g) => ({ controller: 'ai', color: c, gender: g, label: 'CPU' });
    demo = new Sim({ teams: [[A(COLORS.blue, 'm'), A(COLORS.green, 'f')], [A(COLORS.red, 'f'), A(COLORS.yellow, 'm')]], level: 'normal', target: 5 });
    demo.teamNames = ['', '']; demoDone = 0;
  }
  newDemo();

  function frame(now) {
    acc += Math.min(100, now - last); last = now;
    while (acc >= STEP) {
      acc -= STEP;
      if (phase === 'play' || phase === 'over') {
        if (phase === 'play') game.blobs.forEach(b => { if (b.controller === 'human') Object.assign(b.input, readFor(b)); });
        game.step();
        game.blobs.forEach(Scene.jelly);
        for (const e of game.events) { playEvent(e); if (e.type === 'hit') Scene.poke(game.blobs[e.blob], e); if (e.type === 'win') showOver(); }
      } else if (phase === 'menu' || phase === 'scores' || phase === 'setup') {
        demo.step();
        demo.blobs.forEach(Scene.jelly);
        for (const e of demo.events) if (e.type === 'hit') Scene.poke(demo.blobs[e.blob], e);
        if (demo.state === 'over' && ++demoDone > 150) newDemo();
      }
    }
    render(now / 1000);
    requestAnimationFrame(frame);
  }
  setPhase('menu');
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
