/* Volley-Buddy – Szene: lebendiger Strand-Hintergrund und Wackelpudding-Figuren (nur Darstellung) */
(function (root) {
  'use strict';
  const C = VB.C, TAU = Math.PI * 2;

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  const sin = Math.sin, cos = Math.cos;

  /* ------------------------------------------------------ Wackelpudding */
  function jstate(b) {
    return b.j || (b.j = { sq: 0, sqv: 0, lean: 0, leanv: 0, w: 0, ph: 0, pvx: 0, pvy: 0 });
  }
  /* pro Simulationsschritt: Feder-Dämpfer-Modell für Stauchung, Neigung und Wabbeln */
  function jelly(b) {
    const j = jstate(b);
    const ay = b.vy - j.pvy - (b.onGround ? 0 : C.BLOB_G);
    const ax = b.vx - j.pvx;
    j.pvx = b.vx; j.pvy = b.vy;
    j.sqv = Math.max(-0.5, Math.min(0.5, j.sqv - ay * 0.024));
    j.sqv += -0.17 * j.sq - 0.085 * j.sqv;
    j.sq = Math.max(-0.4, Math.min(0.5, j.sq + j.sqv));
    j.leanv += -ax * 0.04 - 0.15 * (j.lean - b.vx * 0.03) - 0.08 * j.leanv;
    j.lean = Math.max(-0.9, Math.min(0.9, j.lean + j.leanv));
    j.w *= 0.945; j.ph += 0.55;
  }
  function poke(b, e) {
    const j = jstate(b);
    j.w = Math.min(0.22, j.w + 0.13 + (e && e.smash ? 0.08 : 0));
    j.sqv += 0.14;
  }

  function blobPath(ctx, b, t) {
    const R = C.BLOB_R, j = jstate(b);
    const sq = j.sq + sin(t * 3.4 + b.id * 1.7) * 0.014;          // ruhiges „Atmen"
    const sy = Math.max(0.6, 1 - sq), sx = 1 + sq * 0.8;
    const N = 36, pts = [];
    for (let i = 0; i < N; i++) {
      const th = (i / N) * TAU;
      const wob = 1 + j.w * sin(3 * th + j.ph) + j.w * 0.5 * sin(2 * th - j.ph * 1.3);
      let x = cos(th) * R * sx * wob, y = sin(th) * R * sy * wob;
      if (y > 0) x *= 1 + 0.09 * (y / (R * sy));                  // unten etwas breiter wie ein Pudding
      const top = (1 - y / (R * sy)) / 2;                         // 0 unten … 1 oben
      x += j.lean * R * 0.55 * top * top;
      pts.push([x, y]);
    }
    const cx = b.x, cy = b.y + R - R * sy;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const p = pts[i], q = pts[(i + 1) % N];
      const mx = cx + (p[0] + q[0]) / 2, my = cy + (p[1] + q[1]) / 2;
      if (i === 0) ctx.moveTo(cx + (pts[N - 1][0] + p[0]) / 2, cy + (pts[N - 1][1] + p[1]) / 2);
      ctx.quadraticCurveTo(cx + p[0], cy + p[1], mx, my);
    }
    ctx.closePath();
    return { cx, cy, sx, sy, j };
  }

  function drawBlob(ctx, b, ball, t) {
    const R = C.BLOB_R;
    // Bodenschatten
    const hgt = Math.max(0, (C.GROUND - R) - b.y);
    ctx.fillStyle = `rgba(60,40,10,${0.26 - Math.min(0.16, hgt / 800)})`;
    ctx.beginPath(); ctx.ellipse(b.x, C.GROUND + 5, R * 1.05 * (1 - hgt / 650), 6.5, 0, 0, TAU); ctx.fill();

    const { cx, cy, sy, j } = blobPath(ctx, b, t);
    // Grundfarbe mit Licht von links oben
    const g = ctx.createRadialGradient(cx - R * 0.32, cy - R * 0.42, 2, cx - R * 0.1, cy - R * 0.1, R * 1.55);
    g.addColorStop(0, shade(b.color, 0.65));
    g.addColorStop(0.3, shade(b.color, 0.2));
    g.addColorStop(0.7, b.color);
    g.addColorStop(1, shade(b.color, -0.42));
    ctx.fillStyle = g; ctx.fill();

    ctx.save(); ctx.clip();
    // Umgebungsverdunkelung unten
    const ao = ctx.createLinearGradient(0, cy + R * 0.1, 0, cy + R * sy);
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(10,20,40,.34)');
    ctx.fillStyle = ao; ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
    // Lichtdurchlässiger Kern (Gelee-Look), unten rechts warm
    const sub = ctx.createRadialGradient(cx + R * 0.25, cy + R * 0.3, 1, cx + R * 0.25, cy + R * 0.3, R * 0.85);
    sub.addColorStop(0, 'rgba(255,255,230,.30)'); sub.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = sub; ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
    // Randlicht unten rechts
    ctx.lineWidth = 5;
    const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(0.55, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(255,255,255,.5)');
    ctx.strokeStyle = rim; ctx.stroke();
    ctx.restore();

    // Kontur
    const ol = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    ol.addColorStop(0, shade(b.color, -0.6)); ol.addColorStop(1, shade(b.color, -0.35));
    ctx.strokeStyle = ol; ctx.lineWidth = 2; ctx.stroke();

    // Glanzlichter
    const hx = cx - R * 0.36 + j.lean * R * 0.25, hy = cy - R * 0.52 * sy;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.55);
    const sp = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.46);
    sp.addColorStop(0, 'rgba(255,255,255,.95)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sp; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.46, R * 0.24, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath(); ctx.arc(cx - R * 0.08 + j.lean * R * 0.3, cy - R * 0.68 * sy, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.beginPath(); ctx.ellipse(cx + R * 0.34, cy + R * 0.62 * sy, R * 0.28, R * 0.1, -0.2, 0, TAU); ctx.fill();

    // Augen folgen dem Ball
    const dx = ball.x - b.x, dy = ball.y - b.y, d = Math.hypot(dx, dy) || 1;
    const look = Math.max(-1, Math.min(1, dx / 120)) * 4.5;
    const ex0 = cx + look + j.lean * R * 0.38, ey = cy - 4 * sy - R * 0.02;
    [-9, 9].forEach(o => {
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(ex0 + o + 1, ey + 1.5, 6.6, 8.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex0 + o, ey, 6.5, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#14202b';
      const px = ex0 + o + dx / d * 2.6, py = ey + dy / d * 3.4;
      ctx.beginPath(); ctx.arc(px, py, 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - 1, py - 1.2, 1, 0, TAU); ctx.fill();
    });

    if (b.smash > 0) {
      ctx.save();
      ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 16;
      ctx.strokeStyle = `rgba(255,236,90,${0.4 + 0.6 * b.smash / C.SMASH_WINDOW})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, b.y, R + 7, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // Beschriftung + Smash-Balken
    ctx.font = '700 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillText(b.label, b.x, b.y - R - 14);
    const ready = 1 - b.smashCd / C.SMASH_COOLDOWN;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(b.x - 13, b.y - R - 10, 26, 4);
    ctx.fillStyle = ready >= 1 ? '#ffe066' : '#ffffffaa'; ctx.fillRect(b.x - 13, b.y - R - 10, 26 * ready, 4);
  }

  /* ------------------------------------------------------ Hintergrund */
  function drawPalm(ctx, x, flip, t, seed) {
    const base = [x, C.GROUND + 8], top = [x + flip * 34, 250], ctl = [x - flip * 6, 330];
    const at = u => [(1 - u) * (1 - u) * base[0] + 2 * (1 - u) * u * ctl[0] + u * u * top[0],
                     (1 - u) * (1 - u) * base[1] + 2 * (1 - u) * u * ctl[1] + u * u * top[1]];
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const p = at(i / 14), q = at((i + 1) / 14);
      ctx.strokeStyle = i % 2 ? '#8a5a2b' : '#7a4d23'; ctx.lineWidth = 13 - i * 0.5;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    const sway = sin(t * 1.1 + seed) * 0.05;
    for (let i = 0; i < 8; i++) {
      const a = (-Math.PI * 1.05 + (i / 7) * Math.PI * 1.1) + sway + (i % 2 ? 0.05 : -0.05);
      const len = 78 + (i % 3) * 9, droop = 32 + sin(t * 1.6 + i + seed) * 4;
      const tx = top[0] + cos(a) * len, ty = top[1] + sin(a) * len * 0.55 + droop;
      const mx = top[0] + cos(a) * len * 0.55, my = top[1] + sin(a) * len * 0.55 - 14;
      ctx.beginPath(); ctx.moveTo(top[0], top[1]);
      ctx.quadraticCurveTo(mx, my - 8, tx, ty);
      ctx.quadraticCurveTo(mx, my + 12, top[0], top[1]);
      ctx.fillStyle = i % 2 ? '#2f9e44' : '#3cb054'; ctx.fill();
      ctx.strokeStyle = '#1d6e32'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo(mx, my + 2, tx, ty); ctx.stroke();
    }
    ctx.fillStyle = '#5b3a1a';
    ctx.beginPath(); ctx.arc(top[0] - 5, top[1] + 8, 6, 0, TAU); ctx.arc(top[0] + 6, top[1] + 9, 6, 0, TAU); ctx.fill();
  }

  function gull(ctx, x, y, t, ph) {
    const a = sin(t * 7 + ph) * 5;
    ctx.beginPath(); ctx.moveTo(x - 13, y + a); ctx.quadraticCurveTo(x - 6, y - 6 - a, x, y); ctx.quadraticCurveTo(x + 6, y - 6 - a, x + 13, y + a);
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(40,60,90,.3)'; ctx.lineWidth = 4.2; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4; ctx.stroke();
  }

  function sailboat(ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y + sin(t * 1.3 + x * 0.01) * 1.6); ctx.rotate(sin(t * 1.1) * 0.03);
    ctx.fillStyle = '#7a4d23'; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.lineTo(11, 7); ctx.lineTo(-11, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, -2); ctx.lineTo(-12, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff6b5e'; ctx.beginPath(); ctx.moveTo(2, -22); ctx.lineTo(2, -2); ctx.lineTo(13, -2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5b3a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(0, 0); ctx.stroke();
    ctx.restore();
  }

  function crab(ctx, x, y, t) {
    const leg = sin(t * 14) * 2;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#d8452f'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(s * 5, 1 + i * 2); ctx.lineTo(s * (11 + i), 3 + i * 2 + (i % 2 ? leg : -leg)); ctx.stroke();
    }
    ctx.fillStyle = '#ef5a3c'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 5.5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-11, -6, 3.2, 0, TAU); ctx.arc(11, -6, 3.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ef5a3c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-10, -5); ctx.moveTo(6, -2); ctx.lineTo(10, -5); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -6, 1.8, 0, TAU); ctx.arc(3, -6, 1.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-3, -6, 0.9, 0, TAU); ctx.arc(3, -6, 0.9, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawBackground(ctx, t) {
    const W = C.W, H = C.H;
    // Himmel
    const sky = ctx.createLinearGradient(0, 0, 0, 330);
    sky.addColorStop(0, '#3d9be8'); sky.addColorStop(0.7, '#9fd8fb'); sky.addColorStop(1, '#d6f0ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // Sonne mit drehenden Strahlen
    ctx.save(); ctx.translate(660, 78); ctx.rotate(t * 0.05);
    ctx.fillStyle = 'rgba(255,248,190,.13)';
    for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, -210); ctx.lineTo(14, -210); ctx.fill(); }
    ctx.restore();
    const sg = ctx.createRadialGradient(660, 78, 6, 660, 78, 80);
    sg.addColorStop(0, '#fffbe0'); sg.addColorStop(0.3, 'rgba(255,240,150,.95)'); sg.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = sg; ctx.fillRect(560, 0, 200, 170);
    // Wolken (verschiedene Tempi und Größen)
    [[0.7, 62, 1.0, 0], [1.1, 128, 0.75, 260], [0.5, 205, 1.25, 520], [0.9, 40, 0.6, 700], [0.4, 262, 0.9, 120]].forEach(([sp, y, s, o]) => {
      const x = ((t * sp * 7 + o) % (W + 240)) - 120;
      ctx.fillStyle = 'rgba(255,255,255,.88)';
      ctx.beginPath();
      ctx.ellipse(x, y, 44 * s, 14 * s, 0, 0, TAU); ctx.ellipse(x + 26 * s, y - 11 * s, 28 * s, 16 * s, 0, 0, TAU);
      ctx.ellipse(x - 26 * s, y - 6 * s, 24 * s, 13 * s, 0, 0, TAU); ctx.ellipse(x + 4 * s, y - 16 * s, 22 * s, 14 * s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(170,205,235,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 7 * s, 40 * s, 6 * s, 0, 0, TAU); ctx.fill();
    });
    // Möwen
    [[26, 96, 0], [38, 150, 2.1], [20, 52, 4.0]].forEach(([sp, y, ph], i) => {
      const x = (((t * sp + i * 330) % (W + 80)) + W + 80) % (W + 80) - 40;
      gull(ctx, x, y + sin(t * 0.9 + ph) * 8, t, ph);
    });

    // Meer
    const sea = ctx.createLinearGradient(0, 300, 0, 388);
    sea.addColorStop(0, '#58b4e6'); sea.addColorStop(0.5, '#2f94d2'); sea.addColorStop(1, '#1f78b5');
    ctx.fillStyle = sea; ctx.fillRect(0, 300, W, 90);
    // ferne Insel mit Mini-Palme
    ctx.fillStyle = '#6fae7a'; ctx.beginPath(); ctx.ellipse(120, 301, 48, 8, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#f0d58f'; ctx.beginPath(); ctx.ellipse(120, 301, 52, 3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(125, 300); ctx.quadraticCurveTo(128, 288, 133, 282); ctx.stroke();
    ctx.fillStyle = '#2f9e44';
    for (let i = 0; i < 5; i++) { const a = -2.8 + i * 0.6 + sin(t * 1.4 + i) * 0.05; ctx.beginPath(); ctx.moveTo(133, 282); ctx.quadraticCurveTo(133 + cos(a) * 9, 276 + sin(a) * 6, 133 + cos(a) * 15, 284 + sin(a) * 4); ctx.quadraticCurveTo(133 + cos(a) * 8, 282, 133, 282); ctx.fill(); }
    // Segelboot
    sailboat(ctx, ((t * 5 + 420) % (W + 120)) - 60, 303, t);
    sailboat(ctx, 700 - ((t * 2.5) % 260), 306, t + 3);
    // Wellenlinien in 5 Ebenen (Parallaxe)
    for (let k = 0; k < 5; k++) {
      const y0 = 312 + k * 15, amp = 1.6 + k * 0.7, wl = 60 + k * 12, sp = (0.7 + k * 0.25) * (k % 2 ? 1 : -1);
      ctx.beginPath();
      for (let x = -10; x <= W + 10; x += 8) { const y = y0 + sin(x / wl * TAU + t * sp * 1.6) * amp; if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = `rgba(255,255,255,${0.16 + k * 0.05})`; ctx.lineWidth = 1.4 + k * 0.25; ctx.stroke();
    }
    // Glitzern auf dem Wasser
    for (let i = 0; i < 34; i++) {
      const x = (i * 137.5) % W, y = 304 + ((i * 53) % 78);
      const a = Math.pow(Math.max(0, sin(t * 2.2 + i * 1.7)), 8);
      if (a > 0.05) { ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`; ctx.fillRect(x - 3, y, 6, 1.4); ctx.fillRect(x - 0.7, y - 2, 1.4, 5); }
    }
    // Sprungfisch alle ~11 s
    const fp = (t % 11) / 1.1;
    if (fp < 1) {
      const fx = 300 + ((Math.floor(t / 11) * 173) % 300), u = fp;
      const fy = 336 - sin(u * Math.PI) * 26, ang = (u - 0.5) * 2.2;
      ctx.save(); ctx.translate(fx + u * 40, fy); ctx.rotate(ang);
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 3.6, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-13, -4); ctx.lineTo(-13, 4); ctx.fill(); ctx.restore();
    }

    // Strand: Sandfläche
    const shore = x => 384 + sin(x * 0.012 + 0.6) * 3;
    ctx.beginPath(); ctx.moveTo(0, shore(0));
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, shore(x));
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const sand = ctx.createLinearGradient(0, 380, 0, H);
    sand.addColorStop(0, '#f8e4ac'); sand.addColorStop(0.5, '#f0d18a'); sand.addColorStop(1, '#dfb766');
    ctx.fillStyle = sand; ctx.fill();
    // nasser Streifen + Schaumkante (Wellen schwappen vor und zurück)
    const wet = 0.5 + 0.5 * sin(t * 0.9);
    ctx.beginPath(); ctx.moveTo(0, shore(0));
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, shore(x) + 4 + wet * 7 + sin(x * 0.03 + t * 1.5) * 1.5);
    for (let x = W; x >= 0; x -= 10) ctx.lineTo(x, shore(x));
    ctx.closePath(); ctx.fillStyle = 'rgba(190,150,80,.28)'; ctx.fill();
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) { const y = shore(x) + 3 + wet * 7 + sin(x * 0.03 + t * 1.5) * 1.5; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + wet * 0.3})`; ctx.lineWidth = 2.5; ctx.stroke();
    // Sanddetails
    ctx.fillStyle = 'rgba(160,120,50,.25)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((i * 211) % W, 412 + ((i * 37) % 34), 1.1, 0, TAU); ctx.fill(); }
    // Muscheln
    [[150, 432, '#ffd8c8'], [330, 440, '#fff1d6'], [560, 430, '#ffc9d9'], [700, 441, '#fff1d6']].forEach(([x, y, c]) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, 6, 4, 0.3, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(150,90,60,.5)'; ctx.lineWidth = 0.8;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + k * 2.2, y - 4); ctx.stroke(); }
    });
    // Seestern
    ctx.save(); ctx.translate(450, 436); ctx.fillStyle = '#ff8a5c';
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.2 : 8, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(cos(a) * r, sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
    // Krabbe läuft seitlich hin und her
    const cu = t * 0.35, cxp = 600 + sin(cu) * 140, dir = cos(cu);
    ctx.save(); ctx.translate(cxp, 0); ctx.scale(dir > 0 ? 1 : 1, 1); crab(ctx, 0, 436, t); ctx.restore();
    // Fußspuren
    ctx.fillStyle = 'rgba(150,110,50,.22)';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(40 + i * 17, 426 + (i % 2) * 8, 3.2, 5, 0.3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(0, C.GROUND + 1, W, 2);

    // Palmen an den Rändern (schwingen im Wind)
    drawPalm(ctx, 22, 1, t, 0.4);
    drawPalm(ctx, W - 22, -1, t, 2.3);

    // Netzpfosten
    ctx.fillStyle = 'rgba(60,40,10,.22)'; ctx.beginPath(); ctx.ellipse(C.NET_X, C.GROUND + 6, 19, 4.5, 0, 0, TAU); ctx.fill();
    const x0 = C.NET_X - C.NET_HW, w = C.NET_HW * 2, h = C.GROUND - C.NET_TOP;
    const pg = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    pg.addColorStop(0, '#d2d6da'); pg.addColorStop(0.4, '#ffffff'); pg.addColorStop(1, '#a9afb6');
    ctx.fillStyle = pg; ctx.fillRect(x0, C.NET_TOP, w, h);
    ctx.fillStyle = '#e8453c';
    for (let y = C.NET_TOP + 14; y < C.GROUND - 6; y += 28) ctx.fillRect(x0, y, w, 10);
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(C.NET_X, C.NET_TOP, C.NET_HW, Math.PI, 0); ctx.fill();
  }

  root.Scene = { drawBackground, drawBlob, jelly, poke };
})(typeof self !== 'undefined' ? self : this);
