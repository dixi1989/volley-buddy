/* Volley-Buddy – Frontend: Canvas-Rendering, Eingabe, Menüs, Highscore, Sound */
(function () {
  'use strict';
  const { C, Sim, LEVELS } = VB;
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');

  /* ------------------------------------------------------------ Speicher */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignorieren */ } }
  };
  const settings = Object.assign({ level: 'mittel', target: 11, muted: false }, store.get('vb_settings', {}));
  let scores = store.get('vb_scores', []);
  let duel = store.get('vb_duel', [0, 0]);
  let lastName = store.get('vb_name', '');
  const saveSettings = () => store.set('vb_settings', settings);

  $('level').value = settings.level; $('target').value = String(settings.target);

  /* ------------------------------------------------------------- Zustand */
  let phase = 'menu';           // menu | scores | play | pause | over
  let game = null, demo = null, pending = null;
  const COLORS = { blue: '#3aa0ff', red: '#ff5a55', green: '#4cd964', yellow: '#ffc933' };

  function setPhase(p) {
    phase = p;
    $('menu').hidden = p !== 'menu';
    $('scores').hidden = p !== 'scores';
    $('pause').hidden = p !== 'pause';
    $('over').hidden = p !== 'over';
  }

  /* -------------------------------------------------------------- Layout */
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

  /* --------------------------------------------------------------- Audio */
  let ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
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
      case 'hit': tone(170 + e.power * 130, 0.1, 'square', 0.1, -70); if (e.smash) tone(90, 0.25, 'sawtooth', 0.16, -40); break;
      case 'smashStart': tone(520, 0.14, 'sawtooth', 0.06, -250); break;
      case 'jump': tone(260, 0.07, 'sine', 0.05, 160); break;
      case 'net': tone(320, 0.06, 'triangle', 0.1, -90); break;
      case 'wall': tone(230, 0.05, 'triangle', 0.07, -60); break;
      case 'point':
        if (e.scored) { tone(523, 0.14, 'triangle', 0.12); tone(659, 0.2, 'triangle', 0.12, 0, 0.1); }
        else tone(300, 0.25, 'triangle', 0.1, -120);
        break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.13, 0, i * 0.13)); break;
    }
  }

  /* ------------------------------------------------------------- Eingabe */
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
    const a = read(MAP.P1), c = read(MAP.P2);   // Solo: beides gilt
    return { left: a.left || c.left, right: a.right || c.right, jump: a.jump || c.jump, special: a.special || c.special };
  }
  const GAME_CODES = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyD', 'KeyS',
    'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'Numpad0']);

  addEventListener('keydown', e => {
    audio();
    const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT');
    if (typing) {
      if (e.target.id === 'nameInput' && e.key === 'Enter') { commitScore(); $('btnAgain').focus(); }
      return;
    }
    if (phase === 'play' || phase === 'pause') {
      // Ctrl+W/A/D etc. soweit der Browser es zulässt unterdrücken
      if (GAME_CODES.has(e.code) || e.ctrlKey) e.preventDefault();
    }
    if (e.repeat) { keys.add(e.code); return; }
    keys.add(e.code);
    if (e.code === 'KeyM') { settings.muted = !settings.muted; saveSettings(); }
    if (e.code === 'KeyF') {
      try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } catch (err) { /* nicht erlaubt */ }
    }
    if (phase === 'play' && (e.code === 'KeyP' || e.code === 'Escape')) setPhase('pause');
    else if (phase === 'pause' && (e.code === 'KeyP' || e.code === 'Escape')) setPhase('play');
    if (phase === 'menu') {
      if (e.code === 'Digit1') startGame('duel');
      if (e.code === 'Digit2') startGame('team');
      if (e.code === 'Digit3') startGame('solo');
    }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); if (phase === 'play') setPhase('pause'); });
  addEventListener('beforeunload', e => { if (phase === 'play' || phase === 'pause') { e.preventDefault(); e.returnValue = ''; } });

  /* -------------------------------------------------------- Spiel starten */
  function startGame(mode) {
    settings.level = $('level').value; settings.target = +$('target').value; saveSettings();
    const H = (color, label) => ({ controller: 'human', color, label });
    const A = (color) => ({ controller: 'ai', color, label: 'KI' });
    let teams, names;
    if (mode === 'duel') { teams = [[H(COLORS.blue, 'P1')], [H(COLORS.red, 'P2')]]; names = ['Spieler 1', 'Spieler 2']; }
    else if (mode === 'team') { teams = [[H(COLORS.blue, 'P1'), H(COLORS.green, 'P2')], [A(COLORS.red), A(COLORS.yellow)]]; names = ['Ihr', 'KI']; }
    else { teams = [[H(COLORS.blue, 'Du')], [A(COLORS.red)]]; names = ['Du', 'KI']; }
    game = new Sim({ teams, level: settings.level, target: settings.target });
    game.mode = mode; game.teamNames = names;
    // Tastenzuordnung
    const humans = game.blobs.filter(b => b.controller === 'human');
    humans.forEach(b => { b.keymap = mode === 'solo' ? 'BOTH' : (b.label === 'P1' ? 'P1' : 'P2'); });
    pending = null;
    setPhase('play');
  }

  /* ----------------------------------------------------------- Spielende */
  function showOver() {
    const w = game.winner, s = game.score;
    const mult = LEVELS[game.level].mult;
    let title, info = `${s[0]} : ${s[1]} · längster Ballwechsel: ${game.longestRally}`;
    $('nameBox').hidden = true; pending = null;
    if (game.mode === 'duel') {
      duel[w]++; store.set('vb_duel', duel);
      title = `🏆 Spieler ${w + 1} gewinnt!`;
      info += ` · Bilanz ${duel[0]}:${duel[1]}`;
    } else if (w === 0) {
      title = '🏆 Gewonnen!';
      const score = Math.round((s[0] - s[1]) * 100 * mult + game.longestRally * 10);
      info += ` · Punkte: ${score}`;
      pending = { score, pts: [s[0], s[1]], mode: game.mode, level: game.level, rally: game.longestRally, target: game.target };
      if (scores.length < 10 || score > scores[scores.length - 1].score) {
        $('nameBox').hidden = false; $('nameInput').value = lastName;
        setTimeout(() => { $('nameInput').focus(); $('nameInput').select(); }, 50);
      } else pending = null;
    } else title = 'Verloren …';
    $('overTitle').textContent = title; $('overInfo').textContent = info;
    setPhase('over');
  }
  function commitScore() {
    if (!pending || $('nameBox').hidden) return;
    const name = ($('nameInput').value || 'Anonym').trim().slice(0, 12) || 'Anonym';
    lastName = name; store.set('vb_name', name);
    scores.push(Object.assign({ name, date: Date.now() }, pending));
    scores.sort((a, b) => b.score - a.score); scores = scores.slice(0, 10);
    store.set('vb_scores', scores);
    pending = null; $('nameBox').hidden = true;
  }

  function renderScores() {
    const ol = $('scoreList'); ol.innerHTML = '';
    if (!scores.length) { const li = document.createElement('li'); li.textContent = 'Noch keine Einträge – schlag die KI!'; ol.appendChild(li); }
    scores.forEach(s => {
      const li = document.createElement('li');
      const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = s.score;
      const nm = document.createElement('b'); nm.textContent = s.name;
      const sm = document.createElement('small');
      sm.textContent = ` ${s.pts[0]}:${s.pts[1]} · ${s.mode === 'team' ? '2:2' : '1:1'} KI ${s.level} · Rally ${s.rally} · ${new Date(s.date).toLocaleDateString('de-DE')}`;
      li.append(sc, nm, sm); ol.appendChild(li);
    });
    $('duelStats').textContent = `Duell-Bilanz (1:1 lokal): Spieler 1 ${duel[0]} – ${duel[1]} Spieler 2`;
  }

  /* ---------------------------------------------------------- UI-Buttons */
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => startGame(b.dataset.mode)));
  $('btnScores').onclick = () => { renderScores(); setPhase('scores'); };
  $('btnScoresBack').onclick = () => setPhase('menu');
  let clearArmed = false;
  $('btnScoresClear').onclick = () => {
    const btn = $('btnScoresClear');
    if (!clearArmed) { clearArmed = true; btn.textContent = 'Wirklich löschen?'; setTimeout(() => { clearArmed = false; btn.textContent = 'Zurücksetzen'; }, 3000); return; }
    clearArmed = false; btn.textContent = 'Zurücksetzen';
    scores = []; duel = [0, 0]; store.set('vb_scores', scores); store.set('vb_duel', duel); renderScores();
  };
  $('btnResume').onclick = () => setPhase('play');
  $('btnQuit').onclick = () => { game = null; setPhase('menu'); };
  $('btnAgain').onclick = () => { commitScore(); startGame(game.mode); };
  $('btnMenu').onclick = () => { commitScore(); game = null; setPhase('menu'); };
  $('level').onchange = $('target').onchange = () => { settings.level = $('level').value; settings.target = +$('target').value; saveSettings(); };

  let installEvt = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('btnInstall').hidden = false; });
  $('btnInstall').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('btnInstall').hidden = true; };

  /* ------------------------------------------------------------- Rendering */
  function drawBall(ball, rotRef) {
    const r = C.BALL_R;
    const gh = Math.max(0, C.GROUND - ball.y);
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.06, 0.25 - gh / 1500)})`;
    ctx.beginPath(); ctx.ellipse(ball.x, C.GROUND + 4, r * Math.max(0.4, 1 - gh / 800), 4, 0, 0, 7); ctx.fill();
    if (ball.y < -r) { // über dem Bildschirm: Pfeil
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

  function drawHUD(g) {
    const names = g.teamNames || ['', ''];
    const cols = [g.blobs[0].color, g.blobs[g.blobs.length - 1].color];
    ctx.fillStyle = 'rgba(8,28,48,.62)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(300, 8, 200, 52, 12) : ctx.rect(300, 8, 200, 52); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = '800 32px system-ui,sans-serif';
    ctx.fillStyle = cols[0]; ctx.fillText(g.score[0], 348, 44);
    ctx.fillStyle = cols[1]; ctx.fillText(g.score[1], 452, 44);
    ctx.fillStyle = '#fff'; ctx.font = '700 18px system-ui'; ctx.fillText(':', 400, 41);
    ctx.font = '600 10px system-ui'; ctx.fillStyle = '#b9d6ee'; ctx.fillText('bis ' + g.target, 400, 55);
    // Aufschlag-Marker
    const sx = g.serving === 0 ? 318 : 482;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, 22, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#f2b705'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 5, 22); ctx.lineTo(sx + 5, 22); ctx.stroke();
    // Namen
    ctx.font = '700 13px system-ui'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText(names[0], 14, 24);
    ctx.textAlign = 'right'; ctx.fillText(names[1], C.W - 14, 24);
    // Berührungen (3 Punkte je Seite)
    for (let t = 0; t < 2; t++) {
      const used = g.lastTouchTeam === t ? g.touches[t] : 0;
      for (let i = 0; i < 3; i++) {
        const cx = t === 0 ? 20 + i * 16 : C.W - 20 - i * 16;
        ctx.beginPath(); ctx.arc(cx, 40, 5, 0, 7);
        ctx.fillStyle = i < used ? (used >= 3 ? '#ff6b5e' : '#ffe066') : 'rgba(255,255,255,.28)'; ctx.fill();
      }
    }
    if (settings.muted) { ctx.textAlign = 'right'; ctx.font = '16px system-ui'; ctx.fillText('🔇', C.W - 12, C.H - 10); }
    // Meldungen
    ctx.textAlign = 'center';
    if (g.state === 'serve' && phase !== 'menu') {
      ctx.font = '700 22px system-ui'; ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 4;
      const txt = `Aufschlag: ${names[g.serving]}`; ctx.strokeText(txt, 400, 110); ctx.fillText(txt, 400, 110);
    } else if (g.messageTimer > 0 && g.message) {
      ctx.font = '800 30px system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 5;
      ctx.strokeText(g.message, 400, 130); ctx.fillText(g.message, 400, 130);
    }
  }

  function render(t) {
    const g = game || demo;
    Scene.drawBackground(ctx, t);
    if (!g) return;
    g._ballRot = g._ballRot || { rot: 0 };
    g.blobs.forEach(b => Scene.drawBlob(ctx, b, g.ball, t));
    drawBall(g.ball, g._ballRot);
    if (phase !== 'menu' && phase !== 'scores') drawHUD(g);
  }

  /* ------------------------------------------------------------ Hauptschleife */
  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0, demoDone = 0;
  function newDemo() {
    const A = c => ({ controller: 'ai', color: c, label: 'KI' });
    demo = new Sim({ teams: [[A(COLORS.blue), A(COLORS.green)], [A(COLORS.red), A(COLORS.yellow)]], level: 'mittel', target: 5 });
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
      } else if (phase === 'menu' || phase === 'scores') {
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
