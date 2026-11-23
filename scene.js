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
  /* Blocky pixel figures on a 2 px grid (so they stay crisp in the low-res pixel renderer): the Pixel Hero, a Ninja and Santa / Mrs. Claus.
   * The player's colour is always the swimwear. All of them share the body; the variants differ in head gear, face and extras. */
  const OUT = '#2a1740';
  const SKIN = { m: ['#d99a63', '#b57545'], f: ['#f1bf98', '#d4946b'] };
  const HAIR = { m: ['#4a2d18', '#2e1a0d'], f: ['#e6b035', '#b8821c'] };
  const METAL = ['#b3bccb', '#7f8a9e'];            // robot plating
  const NH = '#232b4a', NH2 = '#151a30';          // ninja cloth
  const WH = '#f6f6fa', WH2 = '#cfcfdd';          // santa beard / hair
  const RED = '#d7263d', RED2 = '#a01a2c';

  function drawPerson(ctx, b, ball, t) {
    const R = C.BLOB_R, j = jstate(b), fem = b.gender === 'f', v = b.style;
    const ninja = v === 'ninja', santa = v === 'santa', adv = v === 'adventurer', robot = v === 'cyborg', cow = v === 'cowboy';
    const hgt = Math.max(0, (C.GROUND - R) - b.y);
    ctx.fillStyle = `rgba(60,40,10,${0.26 - Math.min(0.16, hgt / 800)})`;
    ctx.beginPath(); ctx.ellipse(b.x, C.GROUND + 5, R * 0.85 * (1 - hgt / 650), 6, 0, 0, TAU); ctx.fill();

    const gx = Math.round(b.x / 2) * 2, gy = Math.round(b.y / 2) * 2;
    const moving = Math.abs(b.vx) > 0.1, air = !b.onGround;
    const ph = Math.floor(t * 9 + b.id) % 2;                          // walk cycle
    const cy = j.sq > 0.16 ? 2 : (j.sq < -0.14 ? -2 : 0);              // crouch on landing, stretch on take-off
    const sk = robot ? METAL : SKIN[fem ? 'f' : 'm'], hr = HAIR[fem ? 'f' : 'm'], col = b.color;
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

    // legs
    const lift = s => (air ? 2 : (moving && ph === s ? 2 : 0));
    [[-11, 0], [1, 1]].forEach(([x, s]) => {
      const h = 14 - cy - lift(s);
      part(x, 16 + cy, 10, h, sk[0], true); part(x + 8, 16 + cy, 2, h, sk[1]);
      if (ninja) { part(x, 30 - lift(s) - 6, 10, 6, NH, false); part(x, 30 - lift(s) - 8, 10, 2, col, false); }   // boots with a coloured wrap
    });
    // torso (Santa gets a belly, the ninja pecs and abs)
    if (santa && !fem) { part(-14, 0 + cy, 28, 16, sk[0], true); part(12, 0 + cy, 2, 16, sk[1]); }
    else { part(-12, -2 + cy, 24, 18, sk[0], true); part(10, -2 + cy, 2, 18, sk[1]); }
    if (ninja) {
      part(0, 0 + cy, 2, 8, sk[1]);
      if (!fem) { part(-10, 0 + cy, 8, 2, sk[1]); part(2, 0 + cy, 8, 2, sk[1]); part(-6, 4 + cy, 12, 2, sk[1]); }
    }
    // arms (raised when jumping, swinging when running); the ninja has stronger ones with gloves and wristbands
    const aw = ninja ? 10 : 8;
    [[ninja ? -22 : -20, 0], [12, 1]].forEach(([x, s]) => {
      const off = air ? -14 : (moving ? ((s + ph) % 2 ? 2 : -2) : 0), y = -2 + cy + off;
      part(x, y, aw, 18, sk[0], true); part(x + (s ? aw - 2 : 0), y, 2, 18, sk[1]);
      if (ninja) { part(x, y + 10, aw, 8, NH, false); part(x, y + 8, aw, 2, col, false); }
    });
    // head
    part(-12, -26 + cy, 24, 24, sk[0], true); part(10, -26 + cy, 2, 24, sk[1]); part(-12, -4 + cy, 24, 2, sk[1]);
    const dx = ball.x - b.x, dy = ball.y - b.y;
    const ox = dx > 10 ? 2 : (dx < -10 ? 0 : 1), oy = dy < -30 ? 0 : 2;
    if (ninja) {
      // black hood with a face slit, headband with flying tails (and a ponytail for her)
      part(-12, -26 + cy, 24, 24, NH, false); part(-12, -6 + cy, 24, 2, NH2, false); part(10, -26 + cy, 2, 24, NH2, false);
      part(-10, -18 + cy, 20, 8, sk[0], false); part(-10, -12 + cy, 20, 2, sk[1], false);
      [-8, 4].forEach(x => { part(x, -16 + cy, 4, 6, '#fff', false); part(x + ox, -16 + cy + oy, 2, 4, '#1b2230', false); });
      part(-10, -18 + cy, 6, 2, '#0e1122', false); part(-4, -16 + cy, 2, 2, '#0e1122', false);       // fierce brows
      part(4, -18 + cy, 6, 2, '#0e1122', false); part(2, -16 + cy, 2, 2, '#0e1122', false);
      part(-4, -6 + cy, 8, 2, NH2, false);
      part(-12, -24 + cy, 24, 4, col, false); part(-4, -24 + cy, 8, 4, '#d8dde8', false); part(-2, -22 + cy, 4, 2, '#8a93a6', false);
      const w = Math.floor(sin(t * 6 + b.id) * 1.5) * 2;
      part(12, -24 + cy, 4, 4, col, true); part(16, -22 + cy + w, 6, 4, col, true); part(20, -20 + cy + w * 2, 6, 4, dark, true);
      if (fem) { part(-18, -22 + cy, 6, 4, col, true); part(-18, -18 + cy, 4, 12, NH, true); }
    } else if (robot) {
      // cyborg: dark steel skull with glowing red eyes that follow the ball, exposed jaw, scar plate; chest plate with a red core
      part(-12, -26 + cy, 24, 4, '#d4dbe8', false); part(-12, -6 + cy, 24, 4, '#5d6779', false);
      part(-10, -18 + cy, 20, 8, '#10151f', true);
      [-8, 2].forEach(x => { part(x + (ox - 1) * 2, -16 + cy + (oy ? 1 : 0), 6, 4, '#ff2a2a', false); part(x + (ox - 1) * 2 + 2, -16 + cy, 2, 2, '#ffd0d0', false); });
      part(-8, -6 + cy, 16, 2, '#10151f', false); [-6, -2, 2, 6].forEach(x => part(x, -6 + cy, 2, 2, '#aab6c8', false));
      part(4, -26 + cy, 8, 4, '#3a4252', false); part(6, -22 + cy, 2, 6, '#3a4252', false);            // damaged plate
      part(-14, -16 + cy, 2, 8, METAL[1], false); part(12, -16 + cy, 2, 8, METAL[1], false);
      if (fem) { part(-14, -22 + cy, 4, 4, METAL[1], true); part(-18, -18 + cy, 4, 16, '#3a4252', true); part(-18, -4 + cy, 4, 4, col, true); }   // cable ponytail
      part(-8, 2 + cy, 16, 2, METAL[1], false); part(-2, 5 + cy, 4, 4, '#ff2a2a', false); part(-6, 6 + cy, 2, 2, '#aab6c8', false); part(4, 6 + cy, 2, 2, '#aab6c8', false);
    } else {
      // hair: short for him, long for her; Santa / Mrs. Claus have white hair under the hat
      const h0 = santa ? WH : hr[0], h1 = santa ? WH2 : hr[1];
      part(-12, -26 + cy, 24, 8, h0, false); part(-8, -20 + cy, 16, 2, h0, false);
      part(-12, -18 + cy, 4, fem ? 22 : 6, h0, false); part(8, -18 + cy, 4, fem ? 22 : 6, h0, false);
      part(-12, -22 + cy, 24, 2, h1, false);
      if (fem && !santa) { part(-12, -30 + cy, 8, 6, col, true); part(-10, -28 + cy, 4, 2, light, false); }   // bow in her colour
      // face: eyes follow the ball
      [-8, 4].forEach(x => { part(x, -16 + cy, 4, 6, '#fff', false); part(x + ox, -16 + cy + oy, 2, 4, '#1b2230', false); });
      if (!fem) { part(-8, -18 + cy, 4, 2, santa ? WH : hr[1], false); part(4, -18 + cy, 4, 2, santa ? WH : hr[1], false); }
      else { part(-10, -8 + cy, 4, 2, '#f08a9a', false); part(6, -8 + cy, 4, 2, '#f08a9a', false); }
      if (santa && !fem) { part(-10, -8 + cy, 4, 2, '#f08a9a', false); part(6, -8 + cy, 4, 2, '#f08a9a', false); }
      part(-2, -10 + cy, 4, 2, santa && !fem ? '#e0766a' : sk[1], false); part(-4, -6 + cy, 8, 2, '#8a3a3a', false);
      if (santa && fem) { part(-10, -17 + cy, 8, 7, '#bfe3f7', true); part(2, -17 + cy, 8, 7, '#bfe3f7', true); part(-2, -15 + cy, 4, 2, '#4a3a2a', false); }   // round glasses
    }
    // swimwear in the player's colour
    if (!fem) {
      part(-12, 8 + cy, 24, 2, dark, false); part(-12, 10 + cy, 24, 6, col, false); part(-12, 12 + cy, 24, 2, light, false);
      [-11, 1].forEach(x => { part(x, 16 + cy, 10, 6, col, false); part(x, 20 + cy, 10, 2, dark, false); });
      if (santa) { part(-14, 8 + cy, 28, 2, dark, false); part(-14, 10 + cy, 28, 4, col, false); }
    } else {
      part(-10, 2 + cy, 8, 6, col, false); part(2, 2 + cy, 8, 6, col, false); part(-10, 2 + cy, 2, 2, light, false); part(2, 2 + cy, 2, 2, light, false);
      part(-8, -2 + cy, 2, 4, col, false); part(6, -2 + cy, 2, 4, col, false); part(-2, 4 + cy, 4, 2, dark, false);
      part(-10, 10 + cy, 20, 2, col, false); part(-8, 12 + cy, 16, 2, col, false); part(-6, 14 + cy, 12, 2, col, false);
      part(-12, 10 + cy, 2, 2, col, false); part(10, 10 + cy, 2, 2, col, false); part(-10, 10 + cy, 2, 2, light, false);
    }
    // Santa's beard
    if (santa && !fem) {
      part(-12, -10 + cy, 24, 12, WH, true); part(-12, 0 + cy, 24, 2, WH2, false); part(-6, 2 + cy, 12, 2, WH2, true);
      part(-10, -10 + cy, 20, 2, WH, false); part(-2, -12 + cy, 4, 4, '#e0766a', false); part(-2, -4 + cy, 4, 2, '#b5453a', false);
    }
    // Alman Mode: white socks in sandals
    if (b.alman) {
      [[-11, 0], [1, 1]].forEach(([x, s]) => {
        const bot = 30 - lift(s);
        part(x, bot - 8, 10, 6, '#ffffff', false); part(x, bot - 6, 10, 2, '#7b4a22', false); part(x - 2, bot - 2, 14, 2, '#7b4a22', false);
      });
    }
    // Aura+10: sunglasses
    if (b.aura) {
      part(-10, -17 + cy, 9, 7, '#10151f', true); part(1, -17 + cy, 9, 7, '#10151f', true); part(-1, -16 + cy, 2, 2, '#10151f', false);
      part(-8, -16 + cy, 3, 2, '#7da2e6', false); part(3, -16 + cy, 3, 2, '#7da2e6', false);
      part(-12, -16 + cy, 2, 2, '#10151f', false); part(10, -16 + cy, 2, 2, '#10151f', false);
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
      if (fem) { part(-18, -26 + cy, 6, 4, hr[0], true); part(-20, -22 + cy, 6, 14, hr[0], true); part(-20, -10 + cy, 6, 4, col, true); }   // braid
    }
    // Cowboy: tan hat with upturned brim and red band, red neckerchief, sheriff star, spurs
    if (cow) {
      part(-12, -8 + cy, 24, 6, '#d7263d', false); part(-8, -2 + cy, 16, 4, '#d7263d', false); part(-4, 2 + cy, 8, 2, '#a01a2c', false);   // neckerchief
      part(-8, 4 + cy, 6, 6, '#ffd23f', true); part(-6, 6 + cy, 2, 2, '#b8860b', false);                                                         // star
      [-11, 1].forEach(x => part(x + 8, 28, 4, 2, '#ffd23f', false));                                                                              // spurs
      part(-20, -32 + cy, 40, 6, '#c89a5a', true); part(-24, -36 + cy, 8, 6, '#c89a5a', true); part(16, -36 + cy, 8, 6, '#c89a5a', true);         // brim, curled up
      part(-12, -46 + cy, 24, 14, '#d9ad6b', true); part(-4, -48 + cy, 8, 4, '#d9ad6b', true); part(-12, -38 + cy, 24, 4, '#a01a2c', false);   // crown + band
      if (fem) { part(-18, -26 + cy, 6, 4, hr[0], true); part(-20, -22 + cy, 6, 14, hr[0], true); part(-20, -10 + cy, 6, 4, col, true); }
    }
    ctx.fillStyle = OUT;
    ol.forEach(([x, y, w, h]) => ctx.fillRect(x - 2, y - 2, w + 4, h + 4));
    fill.forEach(([x, y, w, h, c]) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); });
    // Alman Mode: bucket hat with little German flags (sits on top of whatever the figure wears)
    if (b.alman) { ctx.save(); ctx.translate(0, (santa ? -34 : adv ? -38 : cow ? -46 : robot ? -26 : ninja ? -24 : -22) + cy); bucketHat(ctx, 18, 12, 10, 5); ctx.restore(); }
    if (b.fight) drawWeapon(ctx, b, t, cy);
    ctx.restore();
  }

  /* Volley Fight weapons, held in the hand on the net side. Idle: resting up and forward; swing: sweeps through the auto-aimed angle. */
  const WEAPONS = {
    katana(ctx) {      // long slightly curved blade, gold guard, dark wrapped handle
      px(ctx, -8, -2, 12, 4, '#2a1f33'); px(ctx, -8, -2, 2, 4, '#c9a24a');
      px(ctx, 4, -3, 4, 6, '#d7b24a'); px(ctx, 8, -2, 46, 4, '#e8eef6'); px(ctx, 8, 0, 46, 2, '#aab6c8'); px(ctx, 54, -2, 4, 2, '#e8eef6');
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
    const p = b.swing > 0 ? 1 - b.swing / SW : -1;                      // swing progress 0..1, -1 = idle
    const idle = ranged ? VB.shotAngle(b) : (dir === 1 ? -1.15 : Math.PI + 1.15);   // a ranged weapon always shows its line of fire
    const ang = ranged ? (b.swing > 0 ? (b.aim || 0) : idle) : (p < 0 ? idle : (b.aim || 0) + (p - 0.5) * 2.2 * dir);
    ctx.save(); ctx.translate(dir * 14, 4 + cy);
    if (p >= 0 && !ranged) {                                                       // slash trail
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 0, 58, (b.aim || 0) - 1.1 * dir, ang, dir < 0); ctx.closePath(); ctx.fill();
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
      if (s.k === 1) {
        ctx.fillStyle = 'rgba(255,214,90,0.3)'; ctx.fillRect(-30, -2, 26, 4);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(-6, -3, 12, 6); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -2, 8, 4);
      } else {
        ctx.fillStyle = 'rgba(255,154,60,0.35)'; ctx.fillRect(-14, -2, 12, 4);
        ctx.fillStyle = '#ff9a3c'; ctx.fillRect(-4, -4, 8, 8); ctx.fillStyle = '#fff3b0'; ctx.fillRect(-2, -2, 4, 4);
      }
      ctx.restore();
    }
  }

  function drawLabel(ctx, b) {
    ctx.font = '700 12px "Jersey 10", system-ui, sans-serif'; ctx.textAlign = 'center';
    const ly = b.y - C.BLOB_R - 9 - (b.alman ? 11 : 0) - (b.style === 'santa' || b.style === 'cowboy' ? 12 : 0);   // sit above the hat
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
    const b = { x: 0, y: C.GROUND - C.BLOB_R - 2, vx: 0, vy: 0, id: 0, team: 0, label: '', color: spec.color, gender: spec.gender, style: spec.style, onGround: true, alman: false, aura: false, fight: false };
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

  function drawBackground(ctx, t) {
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

    // net post
    ctx.fillStyle = 'rgba(60,20,90,.28)'; ctx.beginPath(); ctx.ellipse(C.NET_X, C.GROUND + 6, 19, 4.5, 0, 0, TAU); ctx.fill();
    const x0 = C.NET_X - C.NET_HW, w = C.NET_HW * 2, h = C.GROUND - C.NET_TOP;
    const pg = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    pg.addColorStop(0, '#8fdde8'); pg.addColorStop(0.4, '#ffffff'); pg.addColorStop(1, '#4fa9c4');
    ctx.fillStyle = pg; ctx.fillRect(x0, C.NET_TOP, w, h);
    ctx.fillStyle = '#ee1a8c';
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

  root.Scene = { drawBackground, drawBlob, drawLabel, drawShots, preview, jelly, poke, drawPowerup, drawTowels, drawItemIcon };
})(typeof self !== 'undefined' ? self : this);
