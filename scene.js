/* Volley-Buddy – Scene: lively beach background, gummy-bear characters and power-up visuals (rendering only) */
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

  /* ------------------------------------------------------ Jelly wobble */
  function jstate(b) {
    return b.j || (b.j = { sq: 0, sqv: 0, lean: 0, leanv: 0, w: 0, ph: 0, pvx: 0, pvy: 0 });
  }
  /* per simulation step: spring-damper model for squash, lean and wobble */
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
    j.w = Math.min(0.22, j.w + 0.13 + 0);
    j.sqv += 0.14;
  }

  /* Gummy bear: body parts as wobbly ellipses, filled together, translucent and glossy */
  function addPart(ctx, p, D) {
    const N = 20, pts = [], cr = cos(p[4]), sr = sin(p[4]);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, lx = cos(a) * p[2], ly = sin(a) * p[3];
      pts.push(D(p[0] + lx * cr - ly * sr, p[1] + lx * sr + ly * cr));
    }
    ctx.moveTo((pts[N - 1][0] + pts[0][0]) / 2, (pts[N - 1][1] + pts[0][1]) / 2);
    for (let i = 0; i < N; i++) {
      const q = pts[(i + 1) % N];
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + q[0]) / 2, (pts[i][1] + q[1]) / 2);
    }
    ctx.closePath();
  }

  function drawBlob(ctx, b, ball, t) {
    const R = C.BLOB_R, j = jstate(b);
    // ground shadow
    const hgt = Math.max(0, (C.GROUND - R) - b.y);
    ctx.fillStyle = `rgba(60,40,10,${0.26 - Math.min(0.16, hgt / 800)})`;
    ctx.beginPath(); ctx.ellipse(b.x, C.GROUND + 5, R * 1.05 * (1 - hgt / 650), 6.5, 0, 0, TAU); ctx.fill();

    const sq = j.sq + sin(t * 3.4 + b.id * 1.7) * 0.014;            // calm "breathing"
    const sy = Math.max(0.6, 1 - sq), sx = 1 + sq * 0.8;
    const moving = Math.abs(b.vx) > 0.1, air = !b.onGround;
    const armDy = air ? -8 : (moving ? sin(t * 12 + b.id) * 2.2 : 0);
    const stepx = moving && !air ? sin(t * 14 + b.id) * 2.5 : 0;
    const parts = [
      [0, 6, 21, 23, 0], [0, -13, 16.5, 16, 0],                        // belly, head
      [-12.5, -26.5, 6.2, 6.2, 0], [12.5, -26.5, 6.2, 6.2, 0],         // ears
      [-22.5, 4 + armDy, 6.5, 9, -0.35 + (air ? -0.5 : 0)], [22.5, 4 + armDy, 6.5, 9, 0.35 + (air ? 0.5 : 0)], // arms
      [-11 + stepx, 24, 8.5, 6, 0], [11 - stepx, 24, 8.5, 6, 0]        // feet
    ];
    // Deformation: squash (anchored at the bottom), lean (top lags behind), wobble
    const D = (x, y) => {
      let xx = x * sx, yy = (y - R) * sy + R;
      const top = Math.max(0, Math.min(1.1, (R - y) / (2 * R)));
      xx += j.lean * R * 0.55 * top * top + j.w * R * 0.3 * sin(y * 0.16 + j.ph);
      yy += j.w * R * 0.22 * sin(x * 0.16 + j.ph * 1.2);
      return [xx, yy];
    };
    const build = list => { ctx.beginPath(); for (const p of list) addPart(ctx, p, D); };

    ctx.save(); ctx.translate(b.x, b.y);
    // outline first (only the outer edge stays visible), then the shared fill
    build(parts);
    ctx.lineJoin = 'round'; ctx.lineWidth = 4.5; ctx.strokeStyle = shade(b.color, -0.55); ctx.stroke();
    const g = ctx.createRadialGradient(-10, -14, 2, -2, -2, 50);
    g.addColorStop(0, shade(b.color, 0.65)); g.addColorStop(0.3, shade(b.color, 0.2));
    g.addColorStop(0.65, b.color); g.addColorStop(1, shade(b.color, -0.42));
    ctx.fillStyle = g; ctx.fill();

    ctx.save(); ctx.clip();
    const ao = ctx.createLinearGradient(0, -2, 0, 32);
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(10,20,40,.36)');
    ctx.fillStyle = ao; ctx.fillRect(-60, -60, 120, 120);
    const sub = ctx.createRadialGradient(4, 8, 1, 4, 8, 28);               // light inside the jelly
    sub.addColorStop(0, 'rgba(255,255,230,.32)'); sub.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = sub; ctx.fillRect(-60, -60, 120, 120);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; build([[0, 9, 13, 14, 0]]); ctx.fill();            // belly
    ctx.fillStyle = 'rgba(255,255,255,.22)'; build([[-12.5, -26, 3.2, 3.4, 0], [12.5, -26, 3.2, 3.4, 0]]); ctx.fill(); // inner ears
    ctx.fillStyle = 'rgba(255,255,255,.30)'; build([[0, -8.5, 7.5, 5.5, 0]]); ctx.fill();       // snout
    build(parts);
    const rim = ctx.createLinearGradient(-30, -30, 30, 30);
    rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(0.55, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(255,255,255,.55)');
    ctx.lineWidth = 6; ctx.strokeStyle = rim; ctx.stroke();
    ctx.restore();

    // highlights
    const gloss = (x, y, rx, ry, rot, a) => {
      const p = D(x, y);
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(rot);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      sg.addColorStop(0, `rgba(255,255,255,${a})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore();
    };
    gloss(-7, -21, 7, 3.6, -0.6, 0.9); gloss(-11, 1, 5, 9, 0.25, 0.55);
    gloss(-14, -28.5, 2.6, 1.8, -0.5, 0.8); gloss(14, -28.5, 2.2, 1.6, 0.5, 0.5);
    gloss(-24, -1 + armDy, 2.6, 4.2, -0.3, 0.55); gloss(-13, 22, 3.6, 2, 0, 0.5);
    gloss(9, 21, 5, 3, 0, 0.16);

    // Alman Mode: white socks in sandals
    if (b.alman) {
      [-11 + stepx, 11 - stepx].forEach(fx => {
        const sole = D(fx, 28.6), sock = D(fx, 23.4);
        ctx.fillStyle = '#7b4a22'; ctx.strokeStyle = 'rgba(40,20,5,.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(sole[0], sole[1], 9.8 * sx, 3.3 * sy, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath(); ctx.ellipse(sock[0], sock[1] - 0.6, 8 * sx, 5.3 * sy, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 0.9;
        for (let k = -4; k <= 4; k += 2) { ctx.beginPath(); ctx.moveTo(sock[0] + k * sx, sock[1] - 4 * sy); ctx.lineTo(sock[0] + k * sx, sock[1] + 3 * sy); ctx.stroke(); }
        const a0 = D(fx - 8.5, 27.2), a1 = D(fx, 19.8), a2 = D(fx + 8.5, 27.2);
        ctx.strokeStyle = '#7b4a22'; ctx.lineWidth = 2.1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.quadraticCurveTo(a1[0], a1[1], a2[0], a2[1]); ctx.stroke();
        ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.arc(a1[0], a1[1] + 2.2 * sy, 1.3, 0, TAU); ctx.fill();   // buckle
      });
    }

    // face: black bead eyes follow the ball
    const dx = ball.x - b.x, dy = ball.y - b.y, d = Math.hypot(dx, dy) || 1;
    [-6.5, 6.5].forEach(o => {
      const p = D(o, -16.5), px = p[0] + dx / d * 1.7, py = p[1] + dy / d * 1.7;
      ctx.fillStyle = '#16202b'; ctx.beginPath(); ctx.ellipse(px, py, 3 * sx, 3.4 * sy, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - 1, py - 1.2, 1, 0, TAU); ctx.fill();
    });
    const np = D(0, -11.3);
    ctx.fillStyle = shade(b.color, -0.7); ctx.beginPath(); ctx.ellipse(np[0], np[1], 3, 2, 0, 0, TAU); ctx.fill();
    const m0 = D(-3.2, -6.6), m1 = D(0, -4.2), m2 = D(3.2, -6.6);
    ctx.strokeStyle = shade(b.color, -0.65); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.quadraticCurveTo(m1[0], m1[1], m2[0], m2[1]); ctx.stroke();
    // Alman Mode: bucket hat with little German flags
    if (b.alman) {
      const hp = D(0, -21);
      ctx.save(); ctx.translate(hp[0], hp[1]); ctx.rotate(j.lean * 0.3 - 0.05); ctx.scale(sx, sy);
      bucketHat(ctx, 21, 15, 11.5, 5.8);
      ctx.restore();
    }

    ctx.restore();

    // name tag
    ctx.font = '700 11px system-ui,sans-serif'; ctx.textAlign = 'center';
    const ly = b.y - R - 9 - (b.alman ? 11 : 0);   // sit above the hat
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.strokeText(b.label, b.x, ly, 96);
    ctx.fillStyle = 'rgba(10,25,45,.85)'; ctx.fillText(b.label, b.x, ly, 96);
  }

  /* ------------------------------------------------------ Background */
  /* Palm tree in local coordinates: foot at (0,0), crown at (34,-158); s scales, flip mirrors */
  function drawPalm(ctx, x, by, s, flip, t, seed) {
    ctx.save(); ctx.translate(x, by); ctx.scale(flip * s, s);
    const top = [34, -158], ctl = [-6, -78];
    const at = u => [2 * (1 - u) * u * ctl[0] + u * u * top[0], 2 * (1 - u) * u * ctl[1] + u * u * top[1]];
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
    ctx.restore();
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
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, 330);
    sky.addColorStop(0, '#3d9be8'); sky.addColorStop(0.7, '#9fd8fb'); sky.addColorStop(1, '#d6f0ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // sun with rotating rays
    ctx.save(); ctx.translate(660, 78); ctx.rotate(t * 0.05);
    ctx.fillStyle = 'rgba(255,248,190,.13)';
    for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, -210); ctx.lineTo(14, -210); ctx.fill(); }
    ctx.restore();
    const sg = ctx.createRadialGradient(660, 78, 6, 660, 78, 80);
    sg.addColorStop(0, '#fffbe0'); sg.addColorStop(0.3, 'rgba(255,240,150,.95)'); sg.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = sg; ctx.fillRect(560, 0, 200, 170);
    // clouds (different speeds and sizes)
    [[0.7, 62, 1.0, 0], [1.1, 128, 0.75, 260], [0.5, 205, 1.25, 520], [0.9, 40, 0.6, 700], [0.4, 262, 0.9, 120]].forEach(([sp, y, s, o]) => {
      const x = ((t * sp * 7 + o) % (W + 240)) - 120;
      ctx.fillStyle = 'rgba(255,255,255,.88)';
      ctx.beginPath();
      ctx.ellipse(x, y, 44 * s, 14 * s, 0, 0, TAU); ctx.ellipse(x + 26 * s, y - 11 * s, 28 * s, 16 * s, 0, 0, TAU);
      ctx.ellipse(x - 26 * s, y - 6 * s, 24 * s, 13 * s, 0, 0, TAU); ctx.ellipse(x + 4 * s, y - 16 * s, 22 * s, 14 * s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(170,205,235,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 7 * s, 40 * s, 6 * s, 0, 0, TAU); ctx.fill();
    });
    // seagulls
    [[26, 96, 0], [38, 150, 2.1], [20, 52, 4.0]].forEach(([sp, y, ph], i) => {
      const x = (((t * sp + i * 330) % (W + 80)) + W + 80) % (W + 80) - 40;
      gull(ctx, x, y + sin(t * 0.9 + ph) * 8, t, ph);
    });

    // sea
    const sea = ctx.createLinearGradient(0, 300, 0, 388);
    sea.addColorStop(0, '#58b4e6'); sea.addColorStop(0.5, '#2f94d2'); sea.addColorStop(1, '#1f78b5');
    ctx.fillStyle = sea; ctx.fillRect(0, 300, W, 90);
    // distant island with a tiny palm
    ctx.fillStyle = '#6fae7a'; ctx.beginPath(); ctx.ellipse(120, 301, 48, 8, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#f0d58f'; ctx.beginPath(); ctx.ellipse(120, 301, 52, 3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(125, 300); ctx.quadraticCurveTo(128, 288, 133, 282); ctx.stroke();
    ctx.fillStyle = '#2f9e44';
    for (let i = 0; i < 5; i++) { const a = -2.8 + i * 0.6 + sin(t * 1.4 + i) * 0.05; ctx.beginPath(); ctx.moveTo(133, 282); ctx.quadraticCurveTo(133 + cos(a) * 9, 276 + sin(a) * 6, 133 + cos(a) * 15, 284 + sin(a) * 4); ctx.quadraticCurveTo(133 + cos(a) * 8, 282, 133, 282); ctx.fill(); }
    // sailboat
    sailboat(ctx, ((t * 5 + 420) % (W + 120)) - 60, 303, t);
    sailboat(ctx, 700 - ((t * 2.5) % 260), 306, t + 3);
    // wave lines in 5 layers (parallax)
    for (let k = 0; k < 5; k++) {
      const y0 = 312 + k * 15, amp = 1.6 + k * 0.7, wl = 60 + k * 12, sp = (0.7 + k * 0.25) * (k % 2 ? 1 : -1);
      ctx.beginPath();
      for (let x = -10; x <= W + 10; x += 8) { const y = y0 + sin(x / wl * TAU + t * sp * 1.6) * amp; if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = `rgba(255,255,255,${0.16 + k * 0.05})`; ctx.lineWidth = 1.4 + k * 0.25; ctx.stroke();
    }
    // sparkles on the water
    for (let i = 0; i < 34; i++) {
      const x = (i * 137.5) % W, y = 304 + ((i * 53) % 78);
      const a = Math.pow(Math.max(0, sin(t * 2.2 + i * 1.7)), 8);
      if (a > 0.05) { ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`; ctx.fillRect(x - 3, y, 6, 1.4); ctx.fillRect(x - 0.7, y - 2, 1.4, 5); }
    }
    // jumping fish every ~11 s
    const fp = (t % 11) / 1.1;
    if (fp < 1) {
      const fx = 300 + ((Math.floor(t / 11) * 173) % 300), u = fp;
      const fy = 336 - sin(u * Math.PI) * 26, ang = (u - 0.5) * 2.2;
      ctx.save(); ctx.translate(fx + u * 40, fy); ctx.rotate(ang);
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 3.6, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-13, -4); ctx.lineTo(-13, 4); ctx.fill(); ctx.restore();
    }

    // beach: sand
    const shore = x => 384 + sin(x * 0.012 + 0.6) * 3;
    ctx.beginPath(); ctx.moveTo(0, shore(0));
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, shore(x));
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const sand = ctx.createLinearGradient(0, 380, 0, H);
    sand.addColorStop(0, '#f8e4ac'); sand.addColorStop(0.5, '#f0d18a'); sand.addColorStop(1, '#dfb766');
    ctx.fillStyle = sand; ctx.fill();
    // wet strip + foam line (waves wash back and forth)
    const wet = 0.5 + 0.5 * sin(t * 0.9);
    ctx.beginPath(); ctx.moveTo(0, shore(0));
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, shore(x) + 4 + wet * 7 + sin(x * 0.03 + t * 1.5) * 1.5);
    for (let x = W; x >= 0; x -= 10) ctx.lineTo(x, shore(x));
    ctx.closePath(); ctx.fillStyle = 'rgba(190,150,80,.28)'; ctx.fill();
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) { const y = shore(x) + 3 + wet * 7 + sin(x * 0.03 + t * 1.5) * 1.5; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + wet * 0.3})`; ctx.lineWidth = 2.5; ctx.stroke();
    // sand details
    ctx.fillStyle = 'rgba(160,120,50,.25)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((i * 211) % W, 412 + ((i * 37) % 34), 1.1, 0, TAU); ctx.fill(); }
    // shells
    [[150, 432, '#ffd8c8'], [330, 440, '#fff1d6'], [560, 430, '#ffc9d9'], [700, 441, '#fff1d6']].forEach(([x, y, c]) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, 6, 4, 0.3, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(150,90,60,.5)'; ctx.lineWidth = 0.8;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + k * 2.2, y - 4); ctx.stroke(); }
    });
    // starfish
    ctx.save(); ctx.translate(450, 436); ctx.fillStyle = '#ff8a5c';
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.2 : 8, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(cos(a) * r, sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
    // crab scuttles sideways back and forth
    const cu = t * 0.35, cxp = 600 + sin(cu) * 140, dir = cos(cu);
    ctx.save(); ctx.translate(cxp, 0); ctx.scale(dir > 0 ? 1 : 1, 1); crab(ctx, 0, 436, t); ctx.restore();
    // footprints
    ctx.fillStyle = 'rgba(150,110,50,.22)';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(40 + i * 17, 426 + (i % 2) * 8, 3.2, 5, 0.3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(0, C.GROUND + 1, W, 2);

    // palm trees at the edges (sway in the wind)
    // (small palms along the shore so the beach feels lush – small in the back, large in front)
    drawPalm(ctx, 300, 386, 0.3, 1, t, 5.1); drawPalm(ctx, 520, 386, 0.32, -1, t, 3.7);
    drawPalm(ctx, 170, 390, 0.5, 1, t, 1.6); drawPalm(ctx, 640, 390, 0.48, -1, t, 4.4);
    drawPalm(ctx, 92, 398, 0.72, -1, t, 0.9); drawPalm(ctx, 712, 398, 0.7, 1, t, 2.9);
    drawPalm(ctx, 22, C.GROUND + 8, 1, 1, t, 0.4);
    drawPalm(ctx, W - 22, C.GROUND + 8, 1, -1, t, 2.3);

    // net post
    ctx.fillStyle = 'rgba(60,40,10,.22)'; ctx.beginPath(); ctx.ellipse(C.NET_X, C.GROUND + 6, 19, 4.5, 0, 0, TAU); ctx.fill();
    const x0 = C.NET_X - C.NET_HW, w = C.NET_HW * 2, h = C.GROUND - C.NET_TOP;
    const pg = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    pg.addColorStop(0, '#d2d6da'); pg.addColorStop(0.4, '#ffffff'); pg.addColorStop(1, '#a9afb6');
    ctx.fillStyle = pg; ctx.fillRect(x0, C.NET_TOP, w, h);
    ctx.fillStyle = '#e8453c';
    for (let y = C.NET_TOP + 14; y < C.GROUND - 6; y += 28) ctx.fillRect(x0, y, w, 10);
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(C.NET_X, C.NET_TOP, C.NET_HW, Math.PI, 0); ctx.fill();
  }



  /* ------------------------------------------------------ Alman hat */
  function flagPatch(ctx, x, y, w, h, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    const s = h / 3;
    ctx.fillStyle = '#141414'; ctx.fillRect(-w / 2, -h / 2, w, s);
    ctx.fillStyle = '#dd0000'; ctx.fillRect(-w / 2, -h / 2 + s, w, s);
    ctx.fillStyle = '#ffce00'; ctx.fillRect(-w / 2, -h / 2 + 2 * s, w, s);
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 0.6; ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
  /* bucket hat covered in small German flags; origin = centre of the brim, crown grows upwards */
  function bucketHat(ctx, bw, ch, tw, brimRy) {
    const cwb = bw * 0.64;
    ctx.lineJoin = 'round';
    // brim
    ctx.fillStyle = '#f6f1e2'; ctx.strokeStyle = 'rgba(80,70,50,.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, bw, brimRy, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // crown
    ctx.beginPath(); ctx.moveTo(-cwb, 0); ctx.lineTo(-tw, -ch);
    ctx.quadraticCurveTo(0, -ch - brimRy * 1.3, tw, -ch); ctx.lineTo(cwb, 0);
    ctx.quadraticCurveTo(0, brimRy * 0.95, -cwb, 0); ctx.closePath();
    const g = ctx.createLinearGradient(-cwb, 0, cwb, 0);
    g.addColorStop(0, '#e9e2cf'); g.addColorStop(0.45, '#fffdf4'); g.addColorStop(1, '#ddd5c0');
    ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip();
    const w = Math.max(5, bw * 0.44), h = w * 0.64;
    for (let r = 0; r < 3; r++) for (let c = -1; c <= 1; c++) {
      flagPatch(ctx, c * (w + 1.5) + (r % 2 ? w * 0.5 : 0), -ch * 0.18 - r * (h + 1.5), w, h, (c + r) % 2 ? 0.12 : -0.1);
    }
    ctx.restore();
    // stitching on the brim
    ctx.strokeStyle = 'rgba(120,100,70,.55)'; ctx.lineWidth = 0.8; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.86, brimRy * 0.78, 0, 0, Math.PI); ctx.stroke(); ctx.setLineDash([]);
  }

  /* ------------------------------------------------------ Power-ups */
  function drawItemIcon(ctx, type, x, y, size) {
    if (type === 'alman') {
      ctx.save(); ctx.translate(x, y + 6 * size / 30); ctx.rotate(-0.08); const k = size / 30; ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(1, 5, 15, 3, 0, 0, TAU); ctx.fill();
      bucketHat(ctx, 15.5, 12.5, 8.5, 4.6);
      ctx.restore(); return;
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12); const k = size / 30; ctx.scale(k, k);
    // folded fluffy towel
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(1, 9, 13, 3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.2;
    const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dfe8f1');
    ctx.fillStyle = g; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-13, -8, 26, 16, 4); else ctx.rect(-13, -8, 26, 16);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff7aa8'; ctx.fillRect(-8, -8, 4, 16); ctx.fillStyle = '#4fc3f7'; ctx.fillRect(2, -8, 4, 16);
    ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i += 3) { ctx.beginPath(); ctx.moveTo(-13, i); ctx.lineTo(-16, i + 0.8); ctx.moveTo(13, i); ctx.lineTo(16, i + 0.8); ctx.stroke(); }
    ctx.restore();
  }

  function drawPowerup(ctx, pu, t) {
    const x = pu.x, y = pu.by;
    const fade = pu.landed && pu.ttl < 90 ? (Math.floor(t * 8) % 2 ? 0.35 : 1) : 1;
    ctx.save(); ctx.globalAlpha = fade;
    const pulse = 0.85 + 0.15 * sin(t * 5);
    const gl = ctx.createRadialGradient(x, y, 4, x, y, 40 * pulse);
    gl.addColorStop(0, 'rgba(255,245,170,.75)'); gl.addColorStop(1, 'rgba(255,245,170,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, 40 * pulse, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - 7, y - 11, 6, 3, -0.6, 0, TAU); ctx.fill();
    drawItemIcon(ctx, pu.type, x, y + 1, 28);
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = t * 1.4 + i * Math.PI / 2, sx = x + cos(a) * 30, sy = y + sin(a) * 30, r = 2.5 + 1.5 * sin(t * 6 + i);
      ctx.beginPath(); ctx.moveTo(sx - r, sy); ctx.lineTo(sx + r, sy); ctx.moveTo(sx, sy - r); ctx.lineTo(sx, sy + r); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTowel(ctx, cx, w, accent, grow, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, C.GROUND + 4); ctx.scale(1, grow);
    const h = 9, x0 = -w / 2;
    ctx.fillStyle = 'rgba(60,40,10,.25)'; ctx.beginPath(); ctx.ellipse(0, 1, w / 2 + 4, 3.5, 0, 0, TAU); ctx.fill();
    // fringe at both short ends
    ctx.strokeStyle = '#fffdf5'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (let i = 1; i < 9; i += 1.5) { ctx.beginPath(); ctx.moveTo(x0, -i); ctx.lineTo(x0 - 4, -i + 0.8); ctx.moveTo(-x0, -i); ctx.lineTo(-x0 + 4, -i + 0.8); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ece3d2');
    ctx.fillStyle = g; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, -h, w, h, 4); else ctx.rect(x0, -h, w, h);
    ctx.fill(); ctx.strokeStyle = 'rgba(120,90,50,.45)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillRect(x0 + w * 0.12, -h, 7, h); ctx.fillRect(x0 + w * 0.12 + 11, -h, 3, h);
    ctx.fillRect(-x0 - w * 0.12 - 7, -h, 7, h); ctx.fillRect(-x0 - w * 0.12 - 14, -h, 3, h);
    // fluffy loops along the top edge
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.4;
    for (let x = x0 + 5; x < -x0 - 3; x += 6) { ctx.beginPath(); ctx.arc(x, -h, 2.4, Math.PI, 0); ctx.stroke(); }
    ctx.restore();
  }

  function drawTowels(ctx, g, t) {
    for (let team = 0; team < 2; team++) {
      const left = g.towels[team];
      if (left <= 0) continue;
      const owner = g.blobs.find(b => b.team === team);
      const accent = owner ? owner.color : '#4fc3f7';
      const grow = Math.min(1, (C_TOWEL - left) / 18 + 0.1);
      const alpha = left < 180 && Math.floor(t * 6) % 2 ? 0.4 : 1;
      VB.towelRects(team).forEach(([a, b]) => drawTowel(ctx, (a + b) / 2, b - a, accent, grow, alpha));
    }
  }
  const C_TOWEL = C.TOWEL_FRAMES;

  root.Scene = { drawBackground, drawBlob, jelly, poke, drawPowerup, drawTowels, drawItemIcon };
})(typeof self !== 'undefined' ? self : this);
