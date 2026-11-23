/* Beach Volley Hero – Scene: lively beach background, pixel heroes with weapons and power-up visuals (rendering only) */
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

  /* ------------------------------------------------------ Pixel people */
  /* Blocky pixel figures on a 2 px grid (so they stay crisp in the low-res pixel renderer): the Pixel Hero, a Ninja, Santa and the neutral figures McRib, Transformer, Cloudy, Gagari and Kindi.
   * The player's colour is always the swimwear. All of them share the body; the variants differ in head gear, face and extras. */
  const OUT = '#2a1740';
  const SKIN = ['#d99a63', '#b57545'];
  const HAIR = ['#4a2d18', '#2e1a0d'];
  const BUN = ['#e0a050', '#b87a30'];             // McRib: burger bun
  const CHOC = ['#7a4524', '#5a3018'];            // Kindi: chocolate
  const SUIT = ['#eef1f7', '#c5cbdc'];            // Gagari: space suit
  const METAL = ['#b3bccb', '#7f8a9e'];            // robot plating
  const NH = '#232b4a', NH2 = '#151a30';          // ninja cloth
  const WH = '#f6f6fa', WH2 = '#cfcfdd';          // santa beard / hair
  const RED = '#d7263d', RED2 = '#a01a2c';
  const KEB = ['#a35a2c', '#7a4120'];             // Kebabi: roasted doner meat
  const CAP = ['#2f6fd6', '#1f4a9e', '#6aa0f0'];    // Kebabi's baseball cap: base, shadow, light

  function drawPerson(ctx, b, ball, t) {
    const R = C.BLOB_R, j = jstate(b), v = b.style;
    const ninja = v === 'ninja', santa = v === 'santa', adv = v === 'adventurer', robot = v === 'cyborg', cow = v === 'cowboy', kebab = v === 'kebabi';
    const mcrib = v === 'mcrib', car = v === 'transformer', cloudy = v === 'cloudy', gagari = v === 'gagari', kindi = v === 'kindi';
    const custom = kebab || mcrib || car || cloudy || gagari || kindi;      // own body and face instead of the shared torso / head
    const hgt = Math.max(0, (C.GROUND - R) - b.y);
    ctx.fillStyle = `rgba(60,40,10,${0.26 - Math.min(0.16, hgt / 800)})`;
    ctx.beginPath(); ctx.ellipse(b.x, C.GROUND + 5, R * 0.85 * (1 - hgt / 650), 6, 0, 0, TAU); ctx.fill();

    const gx = Math.round(b.x / 2) * 2, gy = Math.round(b.y / 2) * 2;
    const moving = Math.abs(b.vx) > 0.1, air = !b.onGround;
    const ph = Math.floor(t * 9 + b.id) % 2;                          // walk cycle
    const cy = j.sq > 0.16 ? 2 : (j.sq < -0.14 ? -2 : 0);              // crouch on landing, stretch on take-off
    const sk = robot ? METAL : kebab ? KEB : mcrib ? BUN : kindi ? CHOC : gagari ? SUIT : SKIN, hr = HAIR, col = b.color;
    const dark = shade(col, -0.38), light = shade(col, 0.4);
    ctx.save(); ctx.translate(gx, gy);
    if (b.aura) {                                                      // Aura+10: glowing ring showing the enlarged hit box
      const ar = R * 1.3, pulse = 0.85 + 0.15 * sin(t * 6);
      ctx.strokeStyle = `rgba(255,236,140,${0.8 * pulse})`; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 20;
      ctx.beginPath(); ctx.arc(0, 0, ar, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,225,90,${0.12 * pulse})`; ctx.beginPath(); ctx.arc(0, 0, ar, 0, TAU); ctx.fill();
    }
    const fill = [], ol = [];
    const part = (x, y, w, h, c, outline) => { fill.push([x, y, w, h, c]); if (outline) ol.push([x, y, w, h]); };
    const dx = ball.x - b.x, dy = ball.y - b.y;
    const ox = dx > 10 ? 2 : (dx < -10 ? 0 : 1), oy = dy < -30 ? 0 : 2;    // where the eyes look
    const eye = (x, y) => { part(x, y + cy, 4, 6, '#fff', false); part(x + ox, y + cy + oy, 2, 4, '#1b2230', false); };
    const ey = mcrib ? -24 : car ? -24 : cloudy ? -10 : gagari ? -24 : kindi ? -20 : -16;   // top of the eyes (the Aura+10 sunglasses sit there)
    const wob = i => Math.round(sin(t * 7 + i * 0.75 + b.id * 2) * (moving || air ? 2 : 1.2)) * 2;   // Gagari's wobbling body, snapped to the 2 px grid

    // legs
    const lift = s => (air ? 2 : (moving && ph === s ? 2 : 0));
    const legTop = gagari ? 22 : 16;
    if (!cloudy) [[-11, 0], [1, 1]].forEach(([x, s]) => {
      const h = (30 - legTop) - cy - lift(s);
      part(x, legTop + cy, 10, h, sk[0], true); part(x + 8, legTop + cy, 2, h, sk[1]);
      if (kebab || kindi || car) {                                                              // white sneakers (Transformer: with a stripe in the car's colour)
        part(x - 1, 30 - lift(s) - 4, 12, 4, '#f6f6fa', true); part(x - 1, 30 - lift(s) - 2, 12, 2, '#c9cfdc', false);
        if (car) part(x - 1, 30 - lift(s) - 4, 12, 2, col, false);
      }
      if (mcrib) { part(x - 1, 30 - lift(s) - 8, 12, 8, '#7a4a22', true); part(x - 1, 30 - lift(s) - 2, 12, 2, '#4a2a12', false); part(x + 9, 30 - lift(s) - 6, 3, 2, '#ffd23f', false); }   // cowboy boots + spurs
      if (gagari) { part(x - 1, 30 - lift(s) - 6, 12, 6, col, true); part(x - 1, 30 - lift(s) - 6, 12, 2, light, false); }   // space boots
      if (ninja) { part(x, 30 - lift(s) - 6, 10, 6, NH, false); part(x, 30 - lift(s) - 8, 10, 2, col, false); }   // boots with a coloured wrap
    });
    // torso (Santa gets a belly, the ninja pecs and abs)
    if (kebab) {
      // the body is a doner spit: wide at the top, narrowing downwards, in slices of roasted meat
      const HW = [14, 14, 14, 12, 12, 12, 10, 10, 10, 10];
      HW.forEach((hw, i) => {
        const y = -26 + i * 4 + cy, h = i === 9 ? 6 : 4;
        const face = i >= 1 && i <= 4;                                  // lighter patch so the face stays readable
        part(-hw, y, hw * 2, h, face ? (i % 2 ? '#d6945a' : '#cc8a50') : (i % 2 ? '#b0642f' : '#9a5326'), true); part(hw - 2, y, 2, h, face ? '#a86a38' : KEB[1], false);
        if (!face) part(-hw + 2 + ((i * 6) % 14), y + 2, 2, 2, '#d08a4a', false);   // crispy bits
      });
    }
    else if (mcrib) {
      // a burger: bottom bun, tomato, patty, cheese, lettuce with a neckerchief in the player's colour, top bun with sesame
      part(-14, 12 + cy, 28, 6, BUN[0], true); part(-14, 16 + cy, 28, 2, BUN[1], false);
      part(-14, 8 + cy, 28, 4, '#e0392b', true);
      part(-14, -4 + cy, 28, 12, '#6b3a1d', true); part(-14, 0 + cy, 28, 2, '#4a2410', false); part(-8, -2 + cy, 2, 2, '#8a5430', false); part(6, 4 + cy, 4, 2, '#8a5430', false);
      part(-14, -8 + cy, 28, 4, '#ffcf3a', true); part(-8, -4 + cy, 4, 4, '#ffcf3a', false); part(6, -4 + cy, 4, 2, '#ffcf3a', false);
      part(-16, -12 + cy, 32, 4, '#58c24a', true); part(-16, -8 + cy, 6, 2, '#58c24a', false); part(-6, -8 + cy, 6, 2, '#58c24a', false); part(6, -8 + cy, 6, 2, '#58c24a', false);
      part(-10, -12 + cy, 20, 4, col, true); part(-2, -8 + cy, 4, 4, col, true); part(-10, -12 + cy, 20, 2, light, false);
      part(-8, -30 + cy, 16, 2, BUN[0], true); part(-12, -28 + cy, 24, 2, BUN[0], true); part(-14, -26 + cy, 28, 14, BUN[0], true);
      part(-14, -26 + cy, 28, 2, '#f0c070', false); part(12, -26 + cy, 2, 14, BUN[1], false); part(-14, -14 + cy, 28, 2, BUN[1], false);
      [[-12, -22], [10, -22], [-2, -26], [-12, -16], [10, -16]].forEach(([x, y]) => part(x, y + cy, 2, 2, '#fff3c4', false));   // sesame seeds
    }
    else if (car) {
      // front view of a little car: cabin with a windshield (eyes!), hood, headlights, grille, bumper
      part(-16, -12 + cy, 32, 28, col, true); part(-16, -12 + cy, 32, 2, light, false); part(14, -12 + cy, 2, 28, dark, false); part(-16, 14 + cy, 32, 2, dark, false);
      part(-10, -30 + cy, 20, 18, col, true); part(-10, -30 + cy, 20, 2, light, false); part(8, -30 + cy, 2, 18, dark, false);
      part(-8, -28 + cy, 16, 14, '#bfe6ff', true); part(-8, -28 + cy, 16, 2, '#e8f6ff', false);
      part(-20, -14 + cy, 4, 4, dark, true); part(16, -14 + cy, 4, 4, dark, true);               // side mirrors
      part(-14, -6 + cy, 8, 6, '#fff3b0', true); part(6, -6 + cy, 8, 6, '#fff3b0', true); part(-12, -4 + cy, 4, 2, '#ffffff', false); part(8, -4 + cy, 4, 2, '#ffffff', false);
      part(-4, -6 + cy, 8, 10, '#2b2b3a', true); part(-4, -4 + cy, 8, 2, '#8a93a6', false); part(-4, 0 + cy, 8, 2, '#8a93a6', false);
      part(-16, 8 + cy, 32, 4, '#dfe3ec', true); part(-16, 10 + cy, 32, 2, '#a9b1c4', false);
      part(-6, 12 + cy, 12, 4, '#f6f6fa', true); part(-4, 13 + cy, 8, 2, '#c9cfdc', false);        // number plate
    }
    else if (cloudy) {
      // a grumpy thundercloud: puffy silhouette, angry brows, a lightning bolt in the player's colour dangling below
      const CL = ['#8e97b8', '#5f6788', '#bcc4de'];
      // silhouette with three humps on top, lumps at the sides and three drops hanging from the bottom
      part(-20, -30 + cy, 12, 6, CL[0], true); part(-6, -34 + cy, 14, 8, CL[0], true); part(8, -30 + cy, 12, 6, CL[0], true);
      part(-26, -22 + cy, 52, 32, CL[0], true); part(-30, -16 + cy, 6, 18, CL[0], true); part(24, -16 + cy, 6, 18, CL[0], true);
      part(-22, 10 + cy, 12, 6, CL[0], true); part(-6, 10 + cy, 12, 8, CL[0], true); part(10, 10 + cy, 12, 6, CL[0], true);
      part(-26, 2 + cy, 52, 8, CL[1], false); part(-30, 0 + cy, 6, 4, CL[1], false); part(24, 0 + cy, 6, 4, CL[1], false);
      part(-22, 10 + cy, 12, 6, CL[1], false); part(-6, 10 + cy, 12, 8, CL[1], false); part(10, 10 + cy, 12, 6, CL[1], false); part(24, -22 + cy, 2, 24, CL[1], false);
      part(-18, -28 + cy, 8, 2, CL[2], false); part(-4, -32 + cy, 8, 2, CL[2], false); part(-24, -20 + cy, 6, 2, CL[2], false); part(10, -28 + cy, 6, 2, CL[2], false);
      // angry brows, eyes that follow the ball, frown
      part(-14, -16 + cy, 6, 2, '#1b1b2a', false); part(-10, -14 + cy, 6, 2, '#1b1b2a', false); part(-6, -12 + cy, 4, 2, '#1b1b2a', false);
      part(8, -16 + cy, 6, 2, '#1b1b2a', false); part(4, -14 + cy, 6, 2, '#1b1b2a', false); part(2, -12 + cy, 4, 2, '#1b1b2a', false);
      [-12, 4].forEach(x => { part(x, -10 + cy, 8, 8, '#fff', true); part(x + ox * 2, -10 + cy + (oy ? 2 : 0), 4, 4, '#1b2230', false); });
      part(-8, 6 + cy, 16, 2, '#1b1b2a', false); part(-10, 8 + cy, 2, 2, '#1b1b2a', false); part(8, 8 + cy, 2, 2, '#1b1b2a', false);
      const sp = Math.floor(t * 8 + b.id) % 3;                                                    // little sparks crackle around the cloud
      [[-32, -26], [30, -24], [-34, 8], [32, 10], [0, -40]].forEach(([x, y], k) => { if ((k + sp) % 3 === 0) { part(x, y + cy, 4, 2, '#ffe94a', false); part(x + 2, y + 2 + cy, 2, 4, '#ffe94a', false); } });
      const zap = Math.floor(t * 9 + b.id) % 2;                                                   // the bolt flickers
      part(0, 18 + cy, 6, 4, col, true); part(-4, 22 + cy, 8, 4, col, true); part(zap ? -2 : 2, 26 + cy, 4, 4, col, true); part(0, 18 + cy, 6, 2, light, false);
    }
    else if (gagari) {
      // an astronaut whose body is far too long and wobbles like jelly
      for (let i = 0; i < 8; i++) {
        const y = -8 + i * 4 + cy, xo = wob(i);
        part(-11 + xo, y, 22, 4, i % 2 ? SUIT[0] : '#e4e8f2', true); part(9 + xo, y, 2, 4, SUIT[1], false);
        if (i === 1) { part(-6 + xo, y, 12, 8, '#9aa3bd', true); part(-4 + xo, y + 2, 2, 2, col, false); part(0 + xo, y + 2, 2, 2, '#7be08a', false); part(-4 + xo, y + 4, 8, 2, '#5d6779', false); }
        if (i === 5) part(-11 + xo, y, 22, 2, col, false);
      }
      const x0 = wob(-1);
      part(-8 + x0, -34 + cy, 16, 2, SUIT[0], true); part(-12 + x0, -32 + cy, 24, 24, SUIT[0], true); part(10 + x0, -32 + cy, 2, 24, SUIT[1], false);
      part(-10 + x0, -30 + cy, 20, 18, '#1c2a5a', true); part(-10 + x0, -30 + cy, 20, 2, '#d9b84a', false); part(-8 + x0, -28 + cy, 6, 2, '#8fb4ff', false); part(-8 + x0, -26 + cy, 2, 2, '#8fb4ff', false);
      part(-12 + x0, -10 + cy, 24, 4, '#9aa3bd', true); part(-12 + x0, -10 + cy, 24, 2, col, false);
    }
    else if (kindi) {
      // a chocolate bar with legs: top half unwrapped, milk cream where the wrapper tore, the wrapper (player colour) hangs on as trousers
      part(-12, -28 + cy, 24, 36, CHOC[0], true); part(10, -28 + cy, 2, 36, CHOC[1], false);
      part(-10, -26 + cy, 6, 2, '#9a6038', false); part(-12, -4 + cy, 24, 2, CHOC[1], false);
      part(-12, 4 + cy, 24, 4, '#f4ecd8', true); part(-12, 2 + cy, 4, 2, '#f4ecd8', false); part(-4, 2 + cy, 4, 2, '#f4ecd8', false); part(4, 2 + cy, 6, 2, '#f4ecd8', false);
      part(-14, 10 + cy, 28, 8, col, true); [-14, -6, 2, 10].forEach(x => part(x, 8 + cy, 4, 2, col, true));   // torn top edge
      part(-14, 10 + cy, 28, 2, light, false); part(-14, 14 + cy, 28, 2, '#ffffff', false);
      part(-13, 18 + cy, 12, 4, col, false); part(1, 18 + cy, 12, 4, col, false); part(-13, 20 + cy, 12, 2, dark, false); part(1, 20 + cy, 12, 2, dark, false);
    }
    else if (santa) { part(-14, 0 + cy, 28, 16, sk[0], true); part(12, 0 + cy, 2, 16, sk[1]); }
    else { part(-12, -2 + cy, 24, 18, sk[0], true); part(10, -2 + cy, 2, 18, sk[1]); }
    if (ninja) {
      part(0, 0 + cy, 2, 8, sk[1]);
      part(-10, 0 + cy, 8, 2, sk[1]); part(2, 0 + cy, 8, 2, sk[1]); part(-6, 4 + cy, 12, 2, sk[1]);
    }
    // arms (raised when jumping, swinging when running); the ninja has stronger ones with gloves and wristbands
    if (gagari) {
      [[-20, 0], [12, 1]].forEach(([x, s]) => {
        const off = air ? -14 : (moving ? ((s + ph) % 2 ? 2 : -2) : 0);
        for (let k = 0; k < 3; k++) {
          const xo = wob(k + 1) + (s ? 0 : 0), y = -4 + k * 6 + cy + (k === 0 ? 0 : off);
          part(x + xo, y, 8, 6, k === 2 ? col : SUIT[0], true); if (k < 2) part(x + xo + (s ? 6 : 0), y, 2, 6, SUIT[1], false);
        }
      });
    } else if (!cloudy && !car) {
      const aw = ninja ? 10 : 8;
      [[ninja ? -22 : kebab ? -18 : mcrib ? -24 : -20, 0], [kebab ? 10 : mcrib ? 16 : 12, 1]].forEach(([x, s]) => {
        const off = air ? -14 : (moving ? ((s + ph) % 2 ? 2 : -2) : 0), y = -2 + cy + off;
        part(x, y, aw, 18, sk[0], true); part(x + (s ? aw - 2 : 0), y, 2, 18, sk[1]);
        if (ninja) { part(x, y + 10, aw, 8, NH, false); part(x, y + 8, aw, 2, col, false); }
      });
    }
    // head
    if (!custom) { part(-12, -26 + cy, 24, 24, sk[0], true); part(10, -26 + cy, 2, 24, sk[1]); part(-12, -4 + cy, 24, 2, sk[1]); }
    if (kebab) {
      // face on the spit: big eyes that follow the ball, moustache, a grin
      [-8, 4].forEach(x => { part(x, -16 + cy, 4, 6, '#fff', false); part(x + ox, -16 + cy + oy, 2, 4, '#1b2230', false); });
      part(-8, -10 + cy, 6, 2, '#2e1a0d', false); part(2, -10 + cy, 6, 2, '#2e1a0d', false); part(-10, -8 + cy, 2, 2, '#2e1a0d', false); part(8, -8 + cy, 2, 2, '#2e1a0d', false);
      part(-4, -6 + cy, 8, 2, '#4a1f0e', false); part(-6, -8 + cy, 2, 2, '#4a1f0e', false); part(4, -8 + cy, 2, 2, '#4a1f0e', false);
      // baseball cap: crown with a badge, visor, button, and the skewer poking out of the top
      part(-2, -44 + cy, 4, 8, METAL[0], true); part(-4, -46 + cy, 8, 2, METAL[1], true);
      part(-12, -36 + cy, 24, 8, CAP[0], true); part(-12, -36 + cy, 24, 2, CAP[2], false); part(10, -36 + cy, 2, 8, CAP[1], false);
      part(-4, -34 + cy, 8, 4, '#f6f6fa', false); part(-2, -32 + cy, 4, 2, RED, false); part(-2, -38 + cy, 4, 2, CAP[1], false);
      part(-14, -28 + cy, 28, 4, CAP[1], true); part(-14, -28 + cy, 28, 2, CAP[0], false);
    } else if (mcrib) {
      eye(-8, ey); eye(4, ey);
      part(-8, -16 + cy, 6, 2, '#4a2410', false); part(2, -16 + cy, 6, 2, '#4a2410', false); part(-4, -14 + cy, 8, 2, '#7a3b12', false);   // moustache + smirk
    } else if (car) {
      eye(-6, ey); eye(2, ey);
    } else if (gagari) {
      const x0 = wob(-1);
      [-8, 4].forEach(x => { part(x + x0, ey + cy, 4, 6, '#fff', false); part(x + x0 + ox, ey + cy + oy, 2, 4, '#1b2230', false); });
      part(-4 + x0, -14 + cy, 8, 2, '#cfe0ff', false); part(-6 + x0, -16 + cy, 2, 2, '#cfe0ff', false); part(4 + x0, -16 + cy, 2, 2, '#cfe0ff', false);
    } else if (kindi) {
      eye(-8, ey); eye(4, ey);
      part(-4, -10 + cy, 8, 2, '#2a1008', false); part(-6, -12 + cy, 2, 2, '#2a1008', false); part(4, -12 + cy, 2, 2, '#2a1008', false);
      part(-10, -12 + cy, 4, 2, '#d06a5a', false); part(6, -12 + cy, 4, 2, '#d06a5a', false);
    } else if (cloudy) {
      // (face is part of the cloud above)
    } else if (ninja) {
      // black hood with a face slit, headband with flying tails
      part(-12, -26 + cy, 24, 24, NH, false); part(-12, -6 + cy, 24, 2, NH2, false); part(10, -26 + cy, 2, 24, NH2, false);
      part(-10, -18 + cy, 20, 8, sk[0], false); part(-10, -12 + cy, 20, 2, sk[1], false);
      [-8, 4].forEach(x => { part(x, -16 + cy, 4, 6, '#fff', false); part(x + ox, -16 + cy + oy, 2, 4, '#1b2230', false); });
      part(-10, -18 + cy, 6, 2, '#0e1122', false); part(-4, -16 + cy, 2, 2, '#0e1122', false);       // fierce brows
      part(4, -18 + cy, 6, 2, '#0e1122', false); part(2, -16 + cy, 2, 2, '#0e1122', false);
      part(-4, -6 + cy, 8, 2, NH2, false);
      part(-12, -24 + cy, 24, 4, col, false); part(-4, -24 + cy, 8, 4, '#d8dde8', false); part(-2, -22 + cy, 4, 2, '#8a93a6', false);
      const w = Math.floor(sin(t * 6 + b.id) * 1.5) * 2;
      part(12, -24 + cy, 4, 4, col, true); part(16, -22 + cy + w, 6, 4, col, true); part(20, -20 + cy + w * 2, 6, 4, dark, true);
    } else if (robot) {
      // cyborg: dark steel skull with glowing red eyes that follow the ball, exposed jaw, scar plate; chest plate with a red core
      part(-12, -26 + cy, 24, 4, '#d4dbe8', false); part(-12, -6 + cy, 24, 4, '#5d6779', false);
      part(-10, -18 + cy, 20, 8, '#10151f', true);
      [-8, 2].forEach(x => { part(x + (ox - 1) * 2, -16 + cy + (oy ? 1 : 0), 6, 4, '#ff2a2a', false); part(x + (ox - 1) * 2 + 2, -16 + cy, 2, 2, '#ffd0d0', false); });
      part(-8, -6 + cy, 16, 2, '#10151f', false); [-6, -2, 2, 6].forEach(x => part(x, -6 + cy, 2, 2, '#aab6c8', false));
      part(4, -26 + cy, 8, 4, '#3a4252', false); part(6, -22 + cy, 2, 6, '#3a4252', false);            // damaged plate
      part(-14, -16 + cy, 2, 8, METAL[1], false); part(12, -16 + cy, 2, 8, METAL[1], false);
      part(-8, 2 + cy, 16, 2, METAL[1], false); part(-2, 5 + cy, 4, 4, '#ff2a2a', false); part(-6, 6 + cy, 2, 2, '#aab6c8', false); part(4, 6 + cy, 2, 2, '#aab6c8', false);
    } else {
      // short hair; Santa has white hair under the hat
      const h0 = santa ? WH : hr[0], h1 = santa ? WH2 : hr[1];
      part(-12, -26 + cy, 24, 8, h0, false); part(-8, -20 + cy, 16, 2, h0, false);
      part(-12, -18 + cy, 4, 6, h0, false); part(8, -18 + cy, 4, 6, h0, false);
      part(-12, -22 + cy, 24, 2, h1, false);
      // face: eyes follow the ball
      [-8, 4].forEach(x => { part(x, -16 + cy, 4, 6, '#fff', false); part(x + ox, -16 + cy + oy, 2, 4, '#1b2230', false); });
      part(-8, -18 + cy, 4, 2, santa ? WH : hr[1], false); part(4, -18 + cy, 4, 2, santa ? WH : hr[1], false);
      if (santa) { part(-10, -8 + cy, 4, 2, '#f08a9a', false); part(6, -8 + cy, 4, 2, '#f08a9a', false); }
      part(-2, -10 + cy, 4, 2, santa ? '#e0766a' : sk[1], false); part(-4, -6 + cy, 8, 2, '#8a3a3a', false);
    }
    // swimwear in the player's colour (the new neutral figures show their colour on their own clothing / paint instead)
    if (!(mcrib || car || cloudy || gagari || kindi)) {
      part(-12, 8 + cy, 24, 2, dark, false); part(-12, 10 + cy, 24, 6, col, false); part(-12, 12 + cy, 24, 2, light, false);
      [-11, 1].forEach(x => { part(x, 16 + cy, 10, 6, col, false); part(x, 20 + cy, 10, 2, dark, false); });
      if (santa) { part(-14, 8 + cy, 28, 2, dark, false); part(-14, 10 + cy, 28, 4, col, false); }
    }
    // Santa's beard
    if (santa) {
      part(-12, -10 + cy, 24, 12, WH, true); part(-12, 0 + cy, 24, 2, WH2, false); part(-6, 2 + cy, 12, 2, WH2, true);
      part(-10, -10 + cy, 20, 2, WH, false); part(-2, -12 + cy, 4, 4, '#e0766a', false); part(-2, -4 + cy, 4, 2, '#b5453a', false);
    }
    // Alman Mode: white socks in sandals
    if (b.alman && !cloudy) {
      [[-11, 0], [1, 1]].forEach(([x, s]) => {
        const bot = 30 - lift(s);
        part(x, bot - 8, 10, 6, '#ffffff', false); part(x, bot - 6, 10, 2, '#7b4a22', false); part(x - 2, bot - 2, 14, 2, '#7b4a22', false);
      });
    }
    // Aura+10: sunglasses
    if (b.aura) {
      const gxo = gagari ? wob(-1) : 0;
      part(-10 + gxo, ey - 1 + cy, 9, 7, '#10151f', true); part(1 + gxo, ey - 1 + cy, 9, 7, '#10151f', true); part(-1 + gxo, ey + cy, 2, 2, '#10151f', false);
      part(-8 + gxo, ey + cy, 3, 2, '#7da2e6', false); part(3 + gxo, ey + cy, 3, 2, '#7da2e6', false);
      part(-12 + gxo, ey + cy, 2, 2, '#10151f', false); part(10 + gxo, ey + cy, 2, 2, '#10151f', false);
    }
    // Santa hat: white brim, red body drooping to the right, white pom-pom
    if (santa) {
      part(-14, -28 + cy, 28, 6, WH, true); part(-12, -34 + cy, 24, 6, RED, true); part(-10, -38 + cy, 18, 4, RED, true);
      part(6, -40 + cy, 12, 4, RED, true); part(14, -38 + cy, 8, 6, WH, true); part(-12, -30 + cy, 24, 2, RED2, false);
    }
    // Adventurer: brown fedora with a dark band, leather satchel strap across the chest, stubble
    if (adv) {
      part(-12, -12 + cy, 24, 2, '#6b4a2b', false);                                                        // stubble shadow
      part(-8, -2 + cy, 4, 4, '#7a4f2a', true); part(-4, 2 + cy, 4, 4, '#7a4f2a', true); part(0, 6 + cy, 4, 4, '#7a4f2a', true); part(4, 10 + cy, 4, 4, '#7a4f2a', true);
      part(4, 12 + cy, 10, 6, '#8a5a30', true); part(6, 14 + cy, 6, 2, '#c9a24a', false);                  // satchel at the hip
      part(-20, -32 + cy, 40, 6, '#7a4f2a', true); part(-12, -42 + cy, 24, 12, '#8b5e34', true);          // brim + crown
      part(-12, -36 + cy, 24, 4, '#3a2412', false); part(-12, -42 + cy, 24, 2, '#a4733f', false); part(-2, -44 + cy, 4, 2, '#8b5e34', false);
    }
    // Cowboy: tan hat with upturned brim and red band, red neckerchief, sheriff star, spurs
    if (cow) {
      part(-12, -8 + cy, 24, 6, '#d7263d', false); part(-8, -2 + cy, 16, 4, '#d7263d', false); part(-4, 2 + cy, 8, 2, '#a01a2c', false);   // neckerchief
      part(-8, 4 + cy, 6, 6, '#ffd23f', true); part(-6, 6 + cy, 2, 2, '#b8860b', false);                                                         // star
      [-11, 1].forEach(x => part(x + 8, 28, 4, 2, '#ffd23f', false));                                                                              // spurs
      part(-20, -32 + cy, 40, 6, '#c89a5a', true); part(-24, -36 + cy, 8, 6, '#c89a5a', true); part(16, -36 + cy, 8, 6, '#c89a5a', true);         // brim, curled up
      part(-12, -46 + cy, 24, 14, '#d9ad6b', true); part(-4, -48 + cy, 8, 4, '#d9ad6b', true); part(-12, -38 + cy, 24, 4, '#a01a2c', false);   // crown + band
    }
    // McRib: the same kind of cowboy hat, with the band in the player's colour
    if (mcrib) {
      part(-20, -32 + cy, 40, 6, '#c89a5a', true); part(-24, -36 + cy, 8, 6, '#c89a5a', true); part(16, -36 + cy, 8, 6, '#c89a5a', true);
      part(-12, -46 + cy, 24, 14, '#d9ad6b', true); part(-4, -48 + cy, 8, 4, '#d9ad6b', true); part(-12, -38 + cy, 24, 4, col, false); part(-12, -38 + cy, 24, 2, light, false);
    }
    ctx.fillStyle = OUT;
    ol.forEach(([x, y, w, h]) => ctx.fillRect(x - 2, y - 2, w + 4, h + 4));
    fill.forEach(([x, y, w, h, c]) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); });
    // Cloudy: after firing, lightning crackles around the cloud in every direction
    if (cloudy && b.fight && b.swing > 0) {
      ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 3; ctx.lineJoin = 'miter';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath(); ctx.moveTo(cos(a) * 28, sin(a) * 28); ctx.lineTo(cos(a + 0.18) * 38, sin(a + 0.18) * 38); ctx.lineTo(cos(a - 0.12) * 46, sin(a - 0.12) * 46); ctx.stroke();
      }
    }
    // Alman Mode: bucket hat with little German flags (sits on top of whatever the figure wears)
    if (b.alman) { ctx.save(); ctx.translate(0, (kebab ? -34 : santa ? -34 : adv ? -38 : cow || mcrib ? -46 : robot ? -26 : ninja ? -24 : car || cloudy ? -30 : gagari ? -34 : kindi ? -28 : -22) + cy); bucketHat(ctx, 18, 12, 10, 5); ctx.restore(); }
    if (b.fight) drawWeapon(ctx, b, t, cy);
    ctx.restore();
  }

  /* Volley Fight weapons, held in the hand on the net side. Idle: resting up and forward; swing: sweeps through the auto-aimed angle. */
  const WEAPONS = {
    katana(ctx) {      // long slightly curved blade, gold guard, dark wrapped handle
      px(ctx, -8, -2, 12, 4, '#2a1f33'); px(ctx, -8, -2, 2, 4, '#c9a24a');
      px(ctx, 4, -3, 4, 6, '#d7b24a'); px(ctx, 8, -2, 46, 4, '#e8eef6'); px(ctx, 8, 0, 46, 2, '#aab6c8'); px(ctx, 54, -2, 4, 2, '#e8eef6');
    },
    kebabknife(ctx) {  // long slim doner knife: black handle with rivets, narrow blade with a scrap of meat on it
      px(ctx, -8, -2, 12, 4, '#1b1b22'); px(ctx, -4, -1, 2, 2, '#aab6c8'); px(ctx, 0, -1, 2, 2, '#aab6c8');
      px(ctx, 4, -4, 3, 8, '#8a93a6'); px(ctx, 7, -2, 47, 4, '#e8eef6'); px(ctx, 7, 0, 47, 2, '#aab6c8'); px(ctx, 54, -1, 4, 2, '#e8eef6');
      px(ctx, 30, -4, 6, 2, '#a35a2c'); px(ctx, 32, -6, 2, 2, '#d08a4a');
    },
    sword(ctx) {       // broad blade, crossguard, brown grip
      px(ctx, -8, -2, 10, 4, '#6b3f1d'); px(ctx, -8, -3, 2, 6, '#c9a24a');
      px(ctx, 2, -8, 4, 16, '#c9a24a'); px(ctx, 6, -4, 38, 8, '#dfe6f0'); px(ctx, 6, 0, 38, 4, '#9fb0c8'); px(ctx, 44, -2, 4, 4, '#dfe6f0');
    },
    rod(ctx) {         // Santa's birch rod: bundle of twigs with a ribbon
      px(ctx, -6, -2, 12, 4, '#8a5a30'); px(ctx, 4, -3, 4, 6, '#d7263d');
      px(ctx, 8, -3, 38, 3, '#a8763f'); px(ctx, 8, 0, 36, 3, '#7a4f2a');
      px(ctx, 40, -8, 10, 2, '#a8763f'); px(ctx, 44, -4, 12, 2, '#7a4f2a'); px(ctx, 44, 2, 12, 2, '#a8763f'); px(ctx, 40, 6, 10, 2, '#7a4f2a');
    },
    bat(ctx) {         // wooden baseball bat with a taped handle and a knob
      px(ctx, -8, -3, 4, 6, '#8a5a30'); px(ctx, -4, -2, 14, 4, '#f0e6d0'); px(ctx, 10, -3, 8, 6, '#d7b070');
      px(ctx, 18, -5, 28, 10, '#e6c086'); px(ctx, 18, 1, 28, 4, '#b88a4a'); px(ctx, 46, -4, 4, 8, '#e6c086'); px(ctx, 24, -5, 2, 10, '#c9a060');
    },
    kick(ctx) {        // a human leg: thigh, knee, shin and a big white sneaker (the swing goes from below to above)
      px(ctx, 0, -5, 22, 10, '#d99a63'); px(ctx, 0, 1, 22, 4, '#b57545'); px(ctx, 22, -4, 20, 8, '#d99a63'); px(ctx, 22, 1, 20, 3, '#b57545');
      px(ctx, 38, -7, 14, 14, '#f6f6fa'); px(ctx, 38, 3, 14, 4, '#c9cfdc'); px(ctx, 50, -5, 6, 10, '#f6f6fa'); px(ctx, 38, -7, 14, 2, '#d7263d');
    },
    pickle(ctx, t, ext) {   // gherkin cannon: green tube with bumps and a dark muzzle
      px(ctx, -8, -2, 12, 8, '#3a7a26'); px(ctx, 4, -5, 26, 10, '#6fcf4a'); px(ctx, 4, 1, 26, 4, '#4aa334');
      px(ctx, 10, -7, 2, 2, '#8fe06a'); px(ctx, 18, -7, 2, 2, '#8fe06a'); px(ctx, 14, 5, 2, 2, '#3a7a26'); px(ctx, 24, 5, 2, 2, '#3a7a26');
      px(ctx, 30, -7, 4, 14, '#3a7a26');
      if (ext > 0) { px(ctx, 34, -6, 8, 12, '#d6f5a0'); px(ctx, 42, -3, 4, 6, '#a6e060'); }
    },
    bolt() {},         // Cloudy has no handheld weapon: the lightning comes out of the cloud itself (see drawPerson)
    hole(ctx, t, ext) {     // black hole cannon: wide dark barrel with a swirling purple mouth
      px(ctx, -10, -4, 16, 10, '#3a3f55'); px(ctx, -6, -6, 6, 4, '#5b6578'); px(ctx, 6, -7, 24, 14, '#1c2033'); px(ctx, 6, -7, 24, 3, '#2d3350');
      px(ctx, 30, -10, 6, 20, '#8a5be0'); px(ctx, 32, -6, 4, 12, '#07000f');
      const sp = Math.floor(t * 12) % 4; px(ctx, 36 + sp, -2, 4, 4, '#c9a8ff');
      if (ext > 0) { px(ctx, 38, -9, 8, 18, '#a77bff'); px(ctx, 44, -5, 6, 10, '#07000f'); }
    },
    shotgun(ctx, t, ext) {  // pump-action shotgun
      px(ctx, -10, -3, 14, 8, '#6b3f1d'); px(ctx, -12, -2, 4, 10, '#4a2a12'); px(ctx, 4, -4, 28, 4, '#3d4658'); px(ctx, 4, 0, 28, 3, '#5b6578');
      px(ctx, 12, 3, 10, 4, '#8a5a30'); px(ctx, 32, -4, 4, 6, '#aab6c8');
      if (ext > 0) { px(ctx, 36, -8, 8, 14, '#fff3b0'); px(ctx, 44, -6, 8, 10, '#ff9a3c'); px(ctx, 40, -12, 4, 4, '#ffd23f'); }
    },
    revolver(ctx, t, ext) { // six-shooter
      px(ctx, -6, -2, 8, 10, '#6b3f1d'); px(ctx, -6, -4, 14, 6, '#aab6c8'); px(ctx, 6, -4, 6, 8, '#8a93a6'); px(ctx, 12, -4, 14, 4, '#c8d0de'); px(ctx, 24, -6, 2, 2, '#e8eef6');
      if (ext > 0) { px(ctx, 26, -6, 8, 10, '#fff3b0'); px(ctx, 34, -4, 6, 6, '#ff9a3c'); }
    },
    lasso(ctx, t, ext) {   // coiled rope with a spinning loop
      px(ctx, -6, -2, 14, 4, '#b98a4a');
      const L = 34 + ext * 80, w = 16 + ext * 14, sp = Math.floor(t * 18) % 4;
      ctx.fillStyle = '#d9b36a';
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU + sp * 0.4, x = 8 + L * 0.5 + cos(a) * L * 0.5, y = sin(a) * w * 0.5;
        ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 4, 4);
      }
      px(ctx, 8, -1, L * 0.5, 2, '#b98a4a');
    }
  };
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  function drawWeapon(ctx, b, t, cy) {
    const dir = b.team === 0 ? 1 : -1, kind = VB.FIGURES[b.style].weapon, SW = C.WEAPON_SWING, ranged = VB.kindOf(b.style) === 'ranged';
    if (kind === 'bolt') return;
    if (kind === 'kick' && b.swing <= 0) return;                       // the leg only shows while kicking
    const rev = !ranged && VB.MELEE[kind].rev ? -1 : 1;                   // rev: the swing goes upward (kick from below)
    const p = b.swing > 0 ? 1 - b.swing / SW : -1;                      // swing progress 0..1, -1 = idle
    const rest = rev === -1 ? (dir === 1 ? 0.9 : Math.PI - 0.9) : (dir === 1 ? -1.15 : Math.PI + 1.15);   // a leg rests down and forward, a blade up and forward
    const idle = ranged ? (b.aim || VB.shotAngle(b)) : rest;                       // a ranged weapon always shows its line of fire
    const ang = ranged ? (b.swing > 0 ? (b.aim || 0) : idle) : (p < 0 ? idle : (b.aim || 0) + (p - 0.5) * 2.2 * dir * rev);
    ctx.save(); if (kind === 'kick') ctx.translate(dir * 6, 18 + cy); else ctx.translate(dir * 14, 4 + cy);
    if (p >= 0 && !ranged) {                                                       // slash trail
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 0, 58, (b.aim || 0) - 1.1 * dir * rev, ang, dir * rev < 0); ctx.closePath(); ctx.fill();
    }
    ctx.rotate(ang); ctx.scale(1, dir === -1 ? -1 : 1);
    ctx.imageSmoothingEnabled = false;
    WEAPONS[kind](ctx, t, ranged ? (b.swing > 6 ? 1 : 0) : (p < 0 ? 0 : Math.sin(p * Math.PI)));
    ctx.restore();
  }

  /* Projectiles of ranged weapons: shotgun pellets (k 0) and revolver bullets (k 1) */
  function drawShots(ctx, shots, t) {
    for (const s of shots) {
      const a = Math.atan2(s.vy, s.vx);
      ctx.save(); ctx.translate(Math.round(s.x), Math.round(s.y)); ctx.rotate(a);
      if (s.k === 2) {          // gherkin slice: round green disc with a lighter middle and seeds
        ctx.scale(1.7, 1.7); ctx.rotate(t * 12);
        ctx.fillStyle = '#3f8f2a'; ctx.fillRect(-7, -5, 14, 10); ctx.fillRect(-5, -7, 10, 14);
        ctx.fillStyle = '#a6e060'; ctx.fillRect(-5, -3, 10, 6); ctx.fillRect(-3, -5, 6, 10);
        ctx.fillStyle = '#e8f6b0'; ctx.fillRect(-3, -1, 2, 2); ctx.fillRect(1, -3, 2, 2); ctx.fillRect(1, 1, 2, 2);
      } else if (s.k === 3) {   // lightning bolt: zigzag with a glow
        ctx.fillStyle = 'rgba(255,240,100,0.3)'; ctx.fillRect(-12, -6, 24, 12);
        ctx.fillStyle = '#ffe94a'; ctx.fillRect(-10, -1, 6, 4); ctx.fillRect(-6, -4, 6, 4); ctx.fillRect(-2, -1, 6, 4); ctx.fillRect(2, -3, 8, 4);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-4, -3, 2, 2); ctx.fillRect(4, -2, 4, 2);
      } else if (s.k === 4) {   // black hole: dark core with a spinning purple ring
        ctx.rotate(-t * 8);
        ctx.fillStyle = '#07000f'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#a77bff'; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      } else if (s.k === 1) {
        ctx.fillStyle = 'rgba(255,214,90,0.3)'; ctx.fillRect(-30, -2, 26, 4);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(-6, -3, 12, 6); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -2, 8, 4);
      } else {
        ctx.fillStyle = 'rgba(255,154,60,0.35)'; ctx.fillRect(-14, -2, 12, 4);
        ctx.fillStyle = '#ff9a3c'; ctx.fillRect(-4, -4, 8, 8); ctx.fillStyle = '#fff3b0'; ctx.fillRect(-2, -2, 4, 4);
      }
      ctx.restore();
    }
  }

  /* Short visual effects of events: fx = [{ x, y, arrive, t0 }], drawn with the time t (seconds) – black hole swallowing / spitting out the ball */
  function drawFx(ctx, fx, t) {
    for (const f of fx) {
      const a = (t - f.t0) / 0.5;
      if (a < 0 || a > 1) continue;
      const r = f.arrive ? 8 + 34 * a : 42 - 34 * a;
      ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y)); ctx.rotate(t * 10);
      ctx.strokeStyle = `rgba(167,123,255,${1 - a})`; ctx.lineWidth = 4; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = `rgba(7,0,15,${0.8 * (1 - a)})`; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawLabel(ctx, b) {
    ctx.font = '700 12px "Jersey 10", system-ui, sans-serif'; ctx.textAlign = 'center';
    const ly = b.y - C.BLOB_R - 9 - (b.alman ? 11 : 0) - (b.style === 'santa' || b.style === 'cowboy' || b.style === 'kebabi' || b.style === 'mcrib' ? 12 : b.style === 'gagari' ? 4 : 0);   // sit above the hat
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.strokeText(b.label, b.x, ly, 96);
    ctx.fillStyle = 'rgba(30,12,60,.95)'; ctx.fillText(b.label, b.x, ly, 96);
    if (b.fight && b.cd > 0) {                                           // weapon recharge bar
      const w = 34, f = 1 - b.cd / VB.cdMax(b.style);
      ctx.fillStyle = 'rgba(30,12,60,.8)'; ctx.fillRect(b.x - w / 2 - 1, ly + 4, w + 2, 6);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(b.x - w / 2, ly + 5, w * f, 4);
    }
  }

  function drawBlob(ctx, b, ball, t) { drawPerson(ctx, b, ball, t); }

  /* A figure for the selection screens (no ball, standing still) */
  function preview(ctx, spec, t) {
    const b = { x: 0, y: C.GROUND - C.BLOB_R - 2, vx: 0, vy: 0, id: 0, team: 0, label: '', color: spec.color, style: spec.style, onGround: true, alman: false, aura: false, fight: false };
    drawBlob(ctx, b, { x: 80, y: b.y - 40 }, t);
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
      ctx.strokeStyle = i % 2 ? '#6a3f8f' : '#58327d'; ctx.lineWidth = 13 - i * 0.5;
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
      ctx.fillStyle = i % 2 ? '#1f7f93' : '#2aa3a8'; ctx.fill();
      ctx.strokeStyle = '#17315f'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo(mx, my + 2, tx, ty); ctx.stroke();
    }
    ctx.fillStyle = '#3d2260';
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
    ctx.fillStyle = '#ffe9f6'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, -2); ctx.lineTo(-12, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ee1a8c'; ctx.beginPath(); ctx.moveTo(2, -22); ctx.lineTo(2, -2); ctx.lineTo(13, -2); ctx.closePath(); ctx.fill();
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

  function drawBeach(ctx, t, net) {
    const W = C.W, H = C.H;
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, 330);
    sky.addColorStop(0, '#23b0d8'); sky.addColorStop(0.32, '#6f6bdc'); sky.addColorStop(0.68, '#f066b8'); sky.addColorStop(1, '#ffb08c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // sun with rotating rays
    ctx.save(); ctx.translate(660, 78); ctx.rotate(t * 0.05);
    ctx.fillStyle = 'rgba(255,170,225,.16)';
    for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, -210); ctx.lineTo(14, -210); ctx.fill(); }
    ctx.restore();
    const sg = ctx.createRadialGradient(660, 78, 6, 660, 78, 80);
    sg.addColorStop(0, '#fff3fa'); sg.addColorStop(0.3, 'rgba(255,150,210,.95)'); sg.addColorStop(1, 'rgba(255,110,190,0)');
    ctx.fillStyle = sg; ctx.fillRect(560, 0, 200, 170);
    // clouds (different speeds and sizes)
    [[0.7, 62, 1.0, 0], [1.1, 128, 0.75, 260], [0.5, 205, 1.25, 520], [0.9, 40, 0.6, 700], [0.4, 262, 0.9, 120]].forEach(([sp, y, s, o]) => {
      const x = ((t * sp * 7 + o) % (W + 240)) - 120;
      ctx.fillStyle = 'rgba(255,196,232,.9)';
      ctx.beginPath();
      ctx.ellipse(x, y, 44 * s, 14 * s, 0, 0, TAU); ctx.ellipse(x + 26 * s, y - 11 * s, 28 * s, 16 * s, 0, 0, TAU);
      ctx.ellipse(x - 26 * s, y - 6 * s, 24 * s, 13 * s, 0, 0, TAU); ctx.ellipse(x + 4 * s, y - 16 * s, 22 * s, 14 * s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(110,70,190,.38)'; ctx.beginPath(); ctx.ellipse(x, y + 7 * s, 40 * s, 6 * s, 0, 0, TAU); ctx.fill();
    });
    // seagulls
    [[26, 96, 0], [38, 150, 2.1], [20, 52, 4.0]].forEach(([sp, y, ph], i) => {
      const x = (((t * sp + i * 330) % (W + 80)) + W + 80) % (W + 80) - 40;
      gull(ctx, x, y + sin(t * 0.9 + ph) * 8, t, ph);
    });

    // sea
    const sea = ctx.createLinearGradient(0, 300, 0, 388);
    sea.addColorStop(0, '#5fe0dc'); sea.addColorStop(0.45, '#22b3d0'); sea.addColorStop(1, '#3a4fb0');
    ctx.fillStyle = sea; ctx.fillRect(0, 300, W, 90);
    // distant island with a tiny palm
    ctx.fillStyle = '#5b3f9a'; ctx.beginPath(); ctx.ellipse(120, 301, 48, 8, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffc3a8'; ctx.beginPath(); ctx.ellipse(120, 301, 52, 3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(125, 300); ctx.quadraticCurveTo(128, 288, 133, 282); ctx.stroke();
    ctx.fillStyle = '#3c2a85';
    for (let i = 0; i < 5; i++) { const a = -2.8 + i * 0.6 + sin(t * 1.4 + i) * 0.05; ctx.beginPath(); ctx.moveTo(133, 282); ctx.quadraticCurveTo(133 + cos(a) * 9, 276 + sin(a) * 6, 133 + cos(a) * 15, 284 + sin(a) * 4); ctx.quadraticCurveTo(133 + cos(a) * 8, 282, 133, 282); ctx.fill(); }
    // sailboat
    sailboat(ctx, ((t * 5 + 420) % (W + 120)) - 60, 303, t);
    sailboat(ctx, 700 - ((t * 2.5) % 260), 306, t + 3);
    // wave lines in 5 layers (parallax)
    for (let k = 0; k < 5; k++) {
      const y0 = 312 + k * 15, amp = 1.6 + k * 0.7, wl = 60 + k * 12, sp = (0.7 + k * 0.25) * (k % 2 ? 1 : -1);
      ctx.beginPath();
      for (let x = -10; x <= W + 10; x += 8) { const y = y0 + sin(x / wl * TAU + t * sp * 1.6) * amp; if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = `rgba(255,225,245,${0.2 + k * 0.05})`; ctx.lineWidth = 1.4 + k * 0.25; ctx.stroke();
    }
    // sparkles on the water
    for (let i = 0; i < 34; i++) {
      const x = (i * 137.5) % W, y = 304 + ((i * 53) % 78);
      const a = Math.pow(Math.max(0, sin(t * 2.2 + i * 1.7)), 8);
      if (a > 0.05) { ctx.fillStyle = `rgba(255,200,235,${a * 0.95})`; ctx.fillRect(x - 3, y, 6, 1.4); ctx.fillRect(x - 0.7, y - 2, 1.4, 5); }
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
    sand.addColorStop(0, '#ffd2b4'); sand.addColorStop(0.5, '#f6a98f'); sand.addColorStop(1, '#c46f93');
    ctx.fillStyle = sand; ctx.fill();
    // wet strip + foam line (waves wash back and forth)
    const wet = 0.5 + 0.5 * sin(t * 0.9);
    ctx.beginPath(); ctx.moveTo(0, shore(0));
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, shore(x) + 4 + wet * 7 + sin(x * 0.03 + t * 1.5) * 1.5);
    for (let x = W; x >= 0; x -= 10) ctx.lineTo(x, shore(x));
    ctx.closePath(); ctx.fillStyle = 'rgba(150,70,150,.3)'; ctx.fill();
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) { const y = shore(x) + 3 + wet * 7 + sin(x * 0.03 + t * 1.5) * 1.5; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + wet * 0.3})`; ctx.lineWidth = 2.5; ctx.stroke();
    // sand details
    ctx.fillStyle = 'rgba(100,40,130,.25)';
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
    ctx.fillStyle = 'rgba(90,40,130,.24)';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(40 + i * 17, 426 + (i % 2) * 8, 3.2, 5, 0.3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(0, C.GROUND + 1, W, 2);

    // palm trees at the edges (sway in the wind)
    // (small palms along the shore so the beach feels lush – small in the back, large in front)
    drawPalm(ctx, 300, 386, 0.3, 1, t, 5.1); drawPalm(ctx, 520, 386, 0.32, -1, t, 3.7);
    drawPalm(ctx, 170, 390, 0.5, 1, t, 1.6); drawPalm(ctx, 640, 390, 0.48, -1, t, 4.4);
    drawPalm(ctx, 92, 398, 0.72, -1, t, 0.9); drawPalm(ctx, 712, 398, 0.7, 1, t, 2.9);
    drawPalm(ctx, 22, C.GROUND + 8, 1, 1, t, 0.4);
    drawPalm(ctx, W - 22, C.GROUND + 8, 1, -1, t, 2.3);

    drawNet(ctx, net ? net.b : C.NET_X, net ? net.t : C.NET_X);
  }

  /* The net post from its foot (bx) to its top (tx); they differ while Faulty Level makes it lean. */
  function drawNet(ctx, bx, tx, stripe) {
    const H = C.GROUND - C.NET_TOP, L = Math.hypot(tx - bx, H), ang = Math.atan2(tx - bx, H);
    ctx.fillStyle = 'rgba(60,20,90,.28)'; ctx.beginPath(); ctx.ellipse(bx, C.GROUND + 6, 19, 4.5, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(bx, C.GROUND); ctx.rotate(ang);
    const x0 = -C.NET_HW, w = C.NET_HW * 2;
    const pg = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    pg.addColorStop(0, '#8fdde8'); pg.addColorStop(0.4, '#ffffff'); pg.addColorStop(1, '#4fa9c4');
    ctx.fillStyle = pg; ctx.fillRect(x0, -L, w, L);
    ctx.fillStyle = stripe || '#ee1a8c';
    for (let y = 14; y < L - 6; y += 28) ctx.fillRect(x0, -L + y, w, 10);
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, -L, C.NET_HW, Math.PI, 0); ctx.fill();
    ctx.restore();
  }



  /* ------------------------------------------------------ Stages */
  /* All stages share the court (ground at C.GROUND, net in the middle); only the backdrop differs. The beach is drawBeach() above. */
  const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };   // deterministic pseudo random 0..1

  function drawStars(ctx, t, n, y1, seed) {
    for (let i = 0; i < n; i++) {
      const x = rnd(i, seed) * C.W, y = rnd(i, seed + 1) * y1, tw = 0.5 + 0.5 * sin(t * (1 + rnd(i, 3) * 2) + i);
      ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * tw})`; const s = rnd(i, 5) > 0.85 ? 3 : 2; ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, s, s);
    }
  }

  function drawMoon(ctx, t, net) {
    const W = C.W, H = C.H;
    const sky = ctx.createLinearGradient(0, 0, 0, 400); sky.addColorStop(0, '#05041a'); sky.addColorStop(0.6, '#13124a'); sky.addColorStop(1, '#2a1f6b');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    drawStars(ctx, t, 90, 300, 1);
    // shooting star every ~9 s
    const sp = (t % 9) / 0.9;
    if (sp < 1) { const x = 600 - sp * 380, y = 40 + sp * 120; ctx.strokeStyle = `rgba(255,255,255,${1 - sp})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 34, y - 11); ctx.stroke(); }
    // Earth with a glow, clouds and a day/night edge
    const ex = 150, ey = 120, er = 56;
    const gl = ctx.createRadialGradient(ex, ey, er * 0.9, ex, ey, er * 1.9); gl.addColorStop(0, 'rgba(110,170,255,.45)'); gl.addColorStop(1, 'rgba(110,170,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(ex - 120, ey - 120, 240, 240);
    ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.clip();
    ctx.fillStyle = '#2a6fd8'; ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
    ctx.fillStyle = '#3fae5a';
    [[-20, -22, 22, 14], [10, -8, 20, 24], [-34, 10, 16, 12], [18, 26, 18, 10]].forEach(([dx, dy, w, h]) => { ctx.beginPath(); ctx.ellipse(ex + dx, ey + dy, w, h, 0.4, 0, TAU); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 4; i++) { const cx = ex - er + ((t * 3 + i * 40) % (er * 2.6)) - 8; ctx.beginPath(); ctx.ellipse(cx, ey - 30 + i * 18, 18, 5, 0, 0, TAU); ctx.fill(); }
    const sh = ctx.createLinearGradient(ex - er, 0, ex + er, 0); sh.addColorStop(0, 'rgba(0,0,30,0)'); sh.addColorStop(0.55, 'rgba(0,0,30,0)'); sh.addColorStop(1, 'rgba(0,0,30,.65)');
    ctx.fillStyle = sh; ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
    ctx.restore();
    // far crater ridge
    ctx.fillStyle = '#3b3a6e'; ctx.beginPath(); ctx.moveTo(0, 372);
    [[60, 340], [130, 360], [210, 330], [300, 358], [380, 345], [470, 362], [560, 336], [660, 360], [740, 344], [800, 366]].forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(W, 390); ctx.lineTo(0, 390); ctx.closePath(); ctx.fill();
    // moon station: glass dome with windows, antenna with a blinking light, solar panels, a module
    ctx.fillStyle = '#8f93b8'; ctx.fillRect(560, 340, 150, 40);
    ctx.fillStyle = '#6b6f98'; ctx.fillRect(560, 366, 150, 14);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = (Math.floor(t * 0.6 + i * 1.7) % 3 === 0) ? '#5a5f86' : '#ffe58a'; ctx.fillRect(572 + i * 22, 350, 12, 9); }
    const dg = ctx.createLinearGradient(0, 296, 0, 340); dg.addColorStop(0, 'rgba(150,220,255,.85)'); dg.addColorStop(1, 'rgba(90,150,230,.55)');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.ellipse(610, 340, 46, 44, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(610, 340, 46, 44, 0, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(610, 296); ctx.lineTo(610, 340); ctx.moveTo(576, 316); ctx.lineTo(644, 316); ctx.stroke();
    ctx.fillStyle = '#c9ccec'; ctx.fillRect(700, 300, 4, 44); ctx.fillStyle = Math.floor(t * 1.6) % 2 ? '#ff3b3b' : '#6a1a1a'; ctx.fillRect(697, 296, 10, 6);
    ctx.fillStyle = '#2a3f9a'; ctx.fillRect(500, 352, 56, 22); ctx.fillStyle = '#4f6ad8'; for (let i = 0; i < 4; i++) ctx.fillRect(504 + i * 13, 355, 10, 16);
    ctx.fillStyle = '#c9ccec'; ctx.fillRect(552, 362, 12, 4);
    // lunar ground
    const gr = ctx.createLinearGradient(0, 384, 0, H); gr.addColorStop(0, '#c9c9dc'); gr.addColorStop(0.5, '#9b9bb8'); gr.addColorStop(1, '#6a6a92');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 386);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 384 + sin(x * 0.02) * 3); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    [[110, 420, 34, 8], [300, 436, 26, 6], [470, 416, 40, 9], [650, 432, 30, 7], [760, 418, 22, 5], [200, 440, 18, 4]].forEach(([x, y, w, h]) => {
      ctx.fillStyle = 'rgba(60,60,100,.45)'; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(230,230,250,.5)'; ctx.beginPath(); ctx.ellipse(x - 2, y - 2, w - 3, h - 2, 0, Math.PI, 0); ctx.fill();
    });
    ctx.fillStyle = 'rgba(70,70,110,.35)'; for (let i = 0; i < 30; i++) ctx.fillRect(Math.round(rnd(i, 9) * W / 2) * 2, 408 + Math.round(rnd(i, 8) * 36 / 2) * 2, 2, 2);
    // planted flag
    ctx.fillStyle = '#e8e8f4'; ctx.fillRect(52, 342, 3, 50);
    ctx.fillStyle = '#ee1a8c'; ctx.fillRect(55, 344, 30, 8 + Math.floor(sin(t * 0.8) * 1)); ctx.fillStyle = '#69cbdc'; ctx.fillRect(55, 352, 30, 8);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, C.GROUND + 1, W, 2);
    drawNet(ctx, ...net, '#69cbdc');
  }

  function drawWater(ctx, t, net) {
    const W = C.W, H = C.H;
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#59e0ee'); bg.addColorStop(0.35, '#1c9ccc'); bg.addColorStop(0.75, '#16508f'); bg.addColorStop(1, '#0c2a63');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // sun rays from the surface
    for (let i = 0; i < 7; i++) {
      const x0 = 40 + i * 120 + sin(t * 0.4 + i) * 20, w = 26 + (i % 3) * 14;
      const rg = ctx.createLinearGradient(0, 0, 0, 340); rg.addColorStop(0, 'rgba(255,255,255,.28)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + w, 0); ctx.lineTo(x0 + w - 70, 340); ctx.lineTo(x0 - 70 - w * 0.3, 340); ctx.closePath(); ctx.fill();
    }
    // surface line
    ctx.beginPath(); for (let x = 0; x <= W; x += 8) { const y = 14 + sin(x * 0.03 + t * 1.3) * 3; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2.5; ctx.stroke();
    // sunken ship in the distance
    ctx.fillStyle = '#1b4478'; ctx.beginPath(); ctx.moveTo(520, 372); ctx.lineTo(540, 332); ctx.lineTo(650, 326); ctx.lineTo(690, 352); ctx.lineTo(676, 372); ctx.closePath(); ctx.fill();
    ctx.fillRect(572, 276, 5, 56); ctx.fillStyle = '#1f5088'; ctx.beginPath(); ctx.moveTo(577, 282); ctx.lineTo(618, 306); ctx.lineTo(577, 322); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0f2f5c'; for (let i = 0; i < 4; i++) ctx.fillRect(560 + i * 26, 344, 10, 10);
    // jellyfish
    [[120, 120, 0], [690, 170, 2.2], [300, 200, 4]].forEach(([x, y, ph]) => {
      const p = 0.5 + 0.5 * sin(t * 2 + ph), yy = y + sin(t * 0.5 + ph) * 18;
      ctx.fillStyle = 'rgba(255,170,230,.55)'; ctx.beginPath(); ctx.ellipse(x, yy, 16, 10 + p * 3, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,240,.6)'; ctx.lineWidth = 1.5;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * 6, yy); ctx.quadraticCurveTo(x + k * 6 + sin(t * 3 + k + ph) * 4, yy + 12, x + k * 6, yy + 24); ctx.stroke(); }
    });
    // schools of fish
    for (let f = 0; f < 3; f++) {
      const dir = f % 2 ? -1 : 1, sp = 18 + f * 9, yb = 90 + f * 70;
      for (let i = 0; i < 6; i++) {
        const x = ((((t * sp * dir + i * 22 + f * 230) % (W + 120)) + (W + 120)) % (W + 120)) - 60, y = yb + sin(t * 1.5 + i * 0.9) * 6 + (i % 3) * 9;
        ctx.fillStyle = ['#ffd166', '#ff8a5c', '#9be9ff'][f]; ctx.beginPath(); ctx.ellipse(x, y, 7, 3.2, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - dir * 6, y); ctx.lineTo(x - dir * 11, y - 3.5); ctx.lineTo(x - dir * 11, y + 3.5); ctx.fill();
      }
    }
    // sea floor: sand, ripples, coral, seaweed, chest
    const sand = ctx.createLinearGradient(0, 384, 0, H); sand.addColorStop(0, '#f0d79a'); sand.addColorStop(1, '#a98255');
    ctx.fillStyle = sand; ctx.beginPath(); ctx.moveTo(0, 388);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 386 + sin(x * 0.015) * 4); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,40,.25)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); for (let x = 0; x <= W; x += 10) { const y = 404 + k * 12 + sin(x * 0.04 + k) * 2; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
    const coral = (x, y, c, s) => { ctx.fillStyle = c; for (let i = -2; i <= 2; i++) { const h = (26 - Math.abs(i) * 6) * s; ctx.fillRect(x + i * 6 * s - 2, y - h, 5 * s, h); ctx.beginPath(); ctx.arc(x + i * 6 * s + 0.5, y - h, 3.5 * s, 0, TAU); ctx.fill(); } };
    coral(80, 392, '#ff6f91', 1); coral(720, 392, '#ffb347', 1.1); coral(240, 394, '#c77dff', 0.7); coral(560, 394, '#ff6f91', 0.7);
    const weed = (x, h, c) => { ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, 394); for (let y = 0; y <= h; y += 6) ctx.lineTo(x + sin(t * 1.4 + y * 0.09 + x) * (3 + y * 0.12), 394 - y); ctx.stroke(); };
    [30, 44, 150, 330, 480, 620, 760, 774].forEach((x, i) => weed(x, 40 + (i % 3) * 14, i % 2 ? '#2fbf71' : '#1f9a5a'));
    ctx.fillStyle = '#7a4a22'; ctx.fillRect(160, 416, 36, 22); ctx.fillStyle = '#5a3414'; ctx.fillRect(160, 416, 36, 6); ctx.fillStyle = '#ffd23f'; ctx.fillRect(174, 422, 8, 8);
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(0, C.GROUND + 1, W, 2);
    // rising bubbles (in front)
    for (let i = 0; i < 26; i++) {
      const sp = 14 + rnd(i, 2) * 20, x = rnd(i, 1) * W + sin(t * 1.2 + i) * 6, y = H - (((t * sp + rnd(i, 4) * H) % (H + 20)));
      const r = 2 + rnd(i, 6) * 4; ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - r * 0.4, y - r * 0.5, 1.5, 1.5);
    }
    drawNet(ctx, ...net, '#2fbf71');
  }

  function drawDoner(ctx, t, net) {
    const W = C.W, H = C.H;
    // wall: warm tiles with a pattern
    ctx.fillStyle = '#f3e3c4'; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < 330; y += 30) for (let x = ((y / 30) % 2) * 20; x < W; x += 40) {
      ctx.fillStyle = (x / 40 + y / 30) % 3 === 0 ? '#e3694a' : '#e9d3a6'; ctx.fillRect(x + 1, y + 1, 38, 28);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 1, y + 1, 38, 3);
    }
    ctx.fillStyle = 'rgba(40,20,0,.18)'; ctx.fillRect(0, 0, W, H);
    // neon sign
    const on = Math.floor(t * 7) % 23 !== 0;
    ctx.fillStyle = '#1b1030'; ctx.fillRect(260, 76, 280, 56); ctx.strokeStyle = on ? '#ff3b7a' : '#6a2a44'; ctx.lineWidth = 4; ctx.strokeRect(264, 80, 272, 48);
    ctx.textAlign = 'center'; ctx.font = '700 44px "Jersey 10", system-ui, sans-serif';
    ctx.fillStyle = on ? '#ffe45e' : '#6b6030'; ctx.shadowColor = on ? '#ffb000' : 'transparent'; ctx.shadowBlur = on ? 12 : 0; ctx.fillText('DÖNER', 400, 118); ctx.shadowBlur = 0;
    // string lights with chilies
    ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= W; x += 10) { const y = 146 + Math.abs(sin(x / 800 * Math.PI * 4)) * 14; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    for (let i = 0; i < 16; i++) { const x = 25 + i * 50, y = 146 + Math.abs(sin(x / 800 * Math.PI * 4)) * 14; ctx.fillStyle = i % 2 ? '#d7263d' : `rgba(255,228,120,${0.7 + 0.3 * sin(t * 3 + i)})`; ctx.beginPath(); if (i % 2) { ctx.ellipse(x, y + 8, 3, 8, 0, 0, TAU); } else ctx.arc(x, y + 6, 5, 0, TAU); ctx.fill(); }
    // menu board
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(30, 176, 150, 90); ctx.fillStyle = '#3d2a1a'; ctx.fillRect(34, 180, 142, 82);
    [['#ffe45e', 0], ['#9be9ff', 1], ['#ff8a5c', 2], ['#b5f0a0', 3]].forEach(([c, i]) => { ctx.fillStyle = c; ctx.fillRect(44, 190 + i * 18, 70 + (i * 17) % 40, 6); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(138, 190 + i * 18, 28, 6); });
    // clock
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(700, 200, 26, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 4; ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(700, 200); ctx.lineTo(700 + cos(t * 0.1) * 14, 200 + sin(t * 0.1) * 14); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(700, 200); ctx.lineTo(700 + cos(t * 1.2) * 20, 200 + sin(t * 1.2) * 20); ctx.stroke();
    // evil eye charm
    ctx.fillStyle = '#2a64d6'; ctx.beginPath(); ctx.arc(600, 200, 14, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(600, 200, 9, 0, TAU); ctx.fill(); ctx.fillStyle = '#69cbdc'; ctx.beginPath(); ctx.arc(600, 200, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#10151f'; ctx.beginPath(); ctx.arc(600, 200, 2.4, 0, TAU); ctx.fill();
    // counter with food
    ctx.fillStyle = '#7b4a22'; ctx.fillRect(0, 300, W, 86); ctx.fillStyle = '#9a6030'; ctx.fillRect(0, 300, W, 8); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(0, 372, W, 14);
    [[300, '#e0392b'], [340, '#58c24a'], [380, '#f6e9c8'], [420, '#e0a050']].forEach(([x, c]) => { ctx.fillStyle = '#c9ccd8'; ctx.fillRect(x, 286, 34, 16); ctx.fillStyle = c; ctx.fillRect(x + 3, 280, 28, 8); });
    // the big rotating doner spit (left, behind the court)
    const sx = 235, sw = (t * 2);
    ctx.fillStyle = '#9aa3b8'; ctx.fillRect(sx - 2, 214, 4, 90);
    for (let i = 0; i < 14; i++) {
      const y = 222 + i * 5, hw = 12 + Math.min(i, 10) * 1.6 - (i > 10 ? (i - 10) * 3 : 0);
      ctx.fillStyle = (i + Math.floor(sw * 2)) % 2 ? '#a35a2c' : '#8a4821'; ctx.fillRect(sx - hw, y, hw * 2, 5);
      ctx.fillStyle = 'rgba(255,220,150,.45)'; ctx.fillRect(sx - hw + ((sw * 14 + i * 9) % (hw * 2 - 2)), y + 1, 3, 2);
    }
    const hg = ctx.createRadialGradient(sx + 40, 262, 4, sx + 40, 262, 50); hg.addColorStop(0, 'rgba(255,120,40,.4)'); hg.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = hg; ctx.fillRect(sx - 10, 210, 100, 100);
    // steam above the counter
    for (let i = 0; i < 6; i++) { const x = 330 + i * 18, y = 270 - (((t * 14 + i * 13) % 40)); ctx.fillStyle = `rgba(255,255,255,${0.35 - ((270 - y) / 40) * 0.3})`; ctx.beginPath(); ctx.arc(x + sin(t * 2 + i) * 3, y, 4, 0, TAU); ctx.fill(); }
    // checkered floor
    ctx.fillStyle = '#e9e2d0'; ctx.fillRect(0, 386, W, H - 386);
    for (let y = 386, r = 0; y < H; y += 16, r++) for (let x = (r % 2) * 32 - 32; x < W; x += 64) { ctx.fillStyle = '#2b2b3a'; ctx.fillRect(x, y, 32, 16); }
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(0, C.GROUND + 1, W, 2);
    // a fly buzzing about
    const fx = 560 + sin(t * 2.3) * 120, fy = 230 + sin(t * 3.1) * 40; ctx.fillStyle = '#10151f'; ctx.fillRect(fx, fy, 3, 3); ctx.fillStyle = 'rgba(200,220,255,.6)'; ctx.fillRect(fx - 2, fy - 2 + (Math.floor(t * 30) % 2), 3, 2);
    drawNet(ctx, ...net, '#b0642f');
  }

  function drawHole(ctx, t, net) {
    const W = C.W, H = C.H, P = C.NET_X, PY = 135;
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#05010f'); bg.addColorStop(0.7, '#150a33'); bg.addColorStop(1, '#2b1068');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    drawStars(ctx, t, 110, 380, 7);
    // nebula glow
    const ng = ctx.createRadialGradient(P, PY, 10, P, PY, 300); ng.addColorStop(0, 'rgba(255,120,60,.30)'); ng.addColorStop(0.4, 'rgba(180,60,200,.18)'); ng.addColorStop(1, 'rgba(60,20,120,0)');
    ctx.fillStyle = ng; ctx.fillRect(0, 0, W, 330);
    // accretion disk: tilted swirling rings
    ctx.save(); ctx.translate(P, PY); ctx.scale(1, 0.34);
    for (let k = 0; k < 9; k++) {
      const r = 128 - k * 10, a = t * (0.5 + k * 0.12);
      const hue = ['#ffe9c0', '#ffc46b', '#ff9a3c', '#ff6a4d', '#ee1a8c', '#b36bff', '#7a4bd8', '#ff9a3c', '#ffe9c0'][k];
      ctx.strokeStyle = hue; ctx.globalAlpha = 0.55; ctx.lineWidth = 8; ctx.setLineDash([30 + k * 6, 14 + k * 3]); ctx.lineDashOffset = -a * 40;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.restore();
    // event horizon with a bright rim and a lens glint
    const rim = ctx.createRadialGradient(P, PY, 22, P, PY, 44); rim.addColorStop(0, 'rgba(0,0,0,1)'); rim.addColorStop(0.7, 'rgba(0,0,0,1)'); rim.addColorStop(0.85, 'rgba(255,200,120,.9)'); rim.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(P, PY, 44, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(P, PY, 28, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(P - 12 + Math.round(sin(t) * 2), PY - 10, 6, 2);
    // matter spiralling in
    for (let i = 0; i < 28; i++) {
      const ph = (t * 0.25 + i / 28) % 1, a = i * 2.4 + ph * 5, r = 230 * (1 - ph) + 30;
      ctx.fillStyle = `rgba(255,${160 + Math.round(ph * 80)},${100 + Math.round(ph * 120)},${0.15 + ph * 0.6})`; ctx.fillRect(P + cos(a) * r, PY + sin(a) * r * 0.55, 2 + ph * 2, 2 + ph * 2);
    }
    // drifting asteroids
    [[0, 300, 190, 9], [1, 250, 170, 6], [2, 340, 205, 11]].forEach(([i, r, sy, sz]) => {
      const a = t * (0.05 + i * 0.02) + i * 2.1, x = P + cos(a) * r, y = PY + 40 + sin(a) * sy * 0.45;
      ctx.fillStyle = '#4a4070'; ctx.beginPath(); ctx.ellipse(x, y, sz, sz * 0.75, a, 0, TAU); ctx.fill(); ctx.fillStyle = '#6d62a0'; ctx.fillRect(x - sz * 0.5, y - sz * 0.5, sz * 0.5, 2);
    });
    // arena floor: floating glass plate with a neon grid and glowing rim
    ctx.fillStyle = '#1a0e44'; ctx.beginPath(); ctx.moveTo(0, 392); ctx.lineTo(W, 392); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    const fg = ctx.createLinearGradient(0, 388, 0, H); fg.addColorStop(0, 'rgba(180,100,255,.55)'); fg.addColorStop(1, 'rgba(60,20,140,.1)'); ctx.fillStyle = fg; ctx.fillRect(0, 388, W, H - 388);
    ctx.strokeStyle = 'rgba(120,230,255,.45)'; ctx.lineWidth = 1.4;
    for (let x = -80; x <= W + 80; x += 40) { ctx.beginPath(); ctx.moveTo(P + (x - P) * 0.55, 394); ctx.lineTo(P + (x - P) * 1.5, H); ctx.stroke(); }
    for (let y = 398, k = 0; y < H; k++, y += 10 + k * 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = `rgba(120,230,255,${0.7 + 0.3 * sin(t * 3)})`; ctx.fillRect(0, 390, W, 3);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, C.GROUND + 1, W, 2);
    // energy pylons at the edges
    [40, W - 40].forEach((x, i) => { ctx.fillStyle = '#2a1a66'; ctx.fillRect(x - 6, 300, 12, 90); ctx.fillStyle = `rgba(255,120,220,${0.6 + 0.4 * sin(t * 4 + i)})`; ctx.beginPath(); ctx.arc(x, 296, 9, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,120,220,.15)'; ctx.fillRect(x - 3, 0, 6, 296); });
    drawNet(ctx, ...net, '#b36bff');
  }

  /* The backdrop of the chosen stage (default: the beach). net = { b, t } while the net leans (Faulty Level). */
  function drawBackground(ctx, t, net, stage) {
    const args = [net ? net.b : C.NET_X, net ? net.t : C.NET_X];
    if (stage === 'moon') return drawMoon(ctx, t, args);
    if (stage === 'water') return drawWater(ctx, t, args);
    if (stage === 'doner') return drawDoner(ctx, t, args);
    if (stage === 'hole') return drawHole(ctx, t, args);
    drawBeach(ctx, t, net);
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
    if (type === 'aura') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.06); const k = size / 30; ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(0, 10, 15, 2.6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#0a0c10'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-14, -3); ctx.lineTo(-17.5, -6); ctx.moveTo(14, -3); ctx.lineTo(17.5, -6); ctx.stroke();   // temples
      ctx.beginPath(); ctx.moveTo(-3, -2); ctx.quadraticCurveTo(0, -5, 3, -2); ctx.stroke();                                // bridge
      const lg = ctx.createLinearGradient(0, -6, 0, 9); lg.addColorStop(0, '#4a78c0'); lg.addColorStop(0.45, '#141b2b'); lg.addColorStop(1, '#05070a');
      [-8.8, 8.8].forEach(cx => {
        ctx.fillStyle = lg; ctx.strokeStyle = '#05070a'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(cx - 8.2, -4.5); ctx.lineTo(cx + 8.2, -4.5); ctx.quadraticCurveTo(cx + 8.2, 8.5, cx + 1, 8.5);
        ctx.quadraticCurveTo(cx - 8.2, 8.5, cx - 8.2, -4.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(cx - 3.2, -1.6, 3.4, 1.1, -0.55, 0, TAU); ctx.fill();
      });
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-6, -8.5); ctx.lineTo(6, -8.5); ctx.stroke();   // little shine
      ctx.restore(); return;
    }
    if (type === 'alman') {
      ctx.save(); ctx.translate(x, y + 6 * size / 30); ctx.rotate(-0.08); const k = size / 30; ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(1, 5, 15, 3, 0, 0, TAU); ctx.fill();
      bucketHat(ctx, 15.5, 12.5, 8.5, 4.6);
      ctx.restore(); return;
    }
    if (type === 'level') {   // a broken spirit level: yellow bar, cracked, bubble stuck at the end of its vial
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.24); const k = size / 30; ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(1, 9, 15, 2.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffc933'; ctx.strokeStyle = '#6b4300'; ctx.lineWidth = 1.8;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-15, -6, 30, 12, 2.5); else ctx.rect(-15, -6, 30, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e0a21c'; ctx.fillRect(-14, 3, 28, 2.4); ctx.fillStyle = '#ff5a55'; ctx.fillRect(-14.2, -5, 3.2, 10); ctx.fillRect(11, -5, 3.2, 10);
      ctx.fillStyle = '#d6f5c4'; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 1.2;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-6.5, -3.4, 13, 6.8, 3.2); else ctx.rect(-6.5, -3.4, 13, 6.8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(3.6, 0, 2.3, 2, 0, 0, TAU); ctx.fill(); ctx.stroke();   // bubble far off-centre
      ctx.beginPath(); ctx.moveTo(-1.6, -3.4); ctx.lineTo(-1.6, 3.4); ctx.moveTo(1.6, -3.4); ctx.lineTo(1.6, 3.4); ctx.stroke();
      ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 1.3; ctx.beginPath();                                                      // crack
      ctx.moveTo(9.5, -6); ctx.lineTo(7.2, -2.2); ctx.lineTo(10.2, 0.6); ctx.lineTo(8, 6); ctx.stroke();
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
    const fade = 1;
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

  root.Scene = { drawBackground, drawNet, drawBlob, drawLabel, drawShots, drawFx, preview, jelly, poke, drawPowerup, drawTowels, drawItemIcon };
})(typeof self !== 'undefined' ? self : this);
