/* Beach Volley Hero – game engine (no DOM, so it can be tested headless).
 * Physics, rules (serve scoring, max. 3 touches), power-ups and AI.
 * Units: pixels and frames at 60 Hz.
 */
(function (root) {
  'use strict';

  const C = {
    W: 800, H: 450, GROUND: 400,
    NET_X: 400, NET_HW: 5, NET_TOP: 225,
    BLOB_R: 30, BALL_R: 24,           // ball radius (was 18)
    BLOB_SPEED: 6.4, JUMP_V: -15, BLOB_G: 0.62,
    // ball physics: speeds x0.8 and gravity x0.64 versus vb-v28 -> same trajectories, 20 % slower
    BALL_G: 0.192, BALL_MAXV: 10.4, BALL_MAX_UP: 8.4, HIT_MIN: 6, BALL_CAP: 14.4,
    MAX_TOUCHES: 3,
    SERVE_DELAY: 80, POINT_DELAY: 100,
    HIT_Y: 280,                       // height at which the AI wants to meet the ball
    // power-ups
    PU_INTERVAL: 1800,                // every 30 s one power-up per player falls from the sky
    PU_FALL: 2.6, PU_R: 18,           // fall speed px/frame (~3 s from top to below the ground), pickup radius
    PU_MAX_INV: 3,
    TOWEL_FRAMES: 1500, TOWEL_H: 5,   // 25 s
    ALMAN_FRAMES: 600, ALMAN_MULT: 0.8, // 10 s, speed and jump height at 80 %
    AURA_FRAMES: 600, AURA_MULT: 1.3,   // 10 s, hit box 30 % larger
    // Volley Fight: weapons
    WEAPON_CD: 72, WEAPON_SWING: 14,    // cooldown 1.2 s, swing lasts 14 frames
    DIP_G: 0.128,                        // extra gravity on a ball hit by the birch rod
    LEVEL_FRAMES: 600,                  // Faulty Level: 10 s
    LEVEL_BASE: 45, LEVEL_TOP: 95,      // the net moves this far toward the activating team at the ground / at its top (it leans)
    SHOT_R: 7,                          // ranged weapons: projectile radius (speed, cooldown ... see RANGED)
    SHOT_BOOST: 1.38, SHOT_SLOW: 0.55   // ball speed factor: bolt hits a ball flying to the opponents (boost) / toward the shooter's side (slow)
  };

  const POWERUPS = {
    towel: { name: 'Fluffy Towel' },
    alman: { name: 'Alman Mode' },
    aura: { name: 'Aura+10' },
    level: { name: 'Faulty Level' }
  };
  const TYPES = Object.keys(POWERUPS);

  /* Figures a player can pick (looks only, same hit box). `weapon` is reserved for a later feature:
   * a per-figure ability that can act on the ball. */
  const FIGURES = {
    pixel: { name: 'Pixel Hero', weapon: 'sword' },
    cyborg: { name: 'Cyborg', weapon: 'shotgun' },
    cowboy: { name: 'Cowboy', weapon: 'revolver' },
    ninja: { name: 'Ninja', weapon: 'katana' },
    kebabi: { name: 'Kebabi', weapon: 'kebabknife' },
    adventurer: { name: 'Adventurer', weapon: 'lasso' },
    santa: { name: 'Santa', weapon: 'rod' },
    mcrib: { name: 'McRib', weapon: 'pickle' },
    transformer: { name: 'Transformer', weapon: 'kick' },
    cloudy: { name: 'Cloudy', weapon: 'bolt' },
    gagari: { name: 'Gagari', weapon: 'hole' },
    kindi: { name: 'Kindi', weapon: 'bat' }
  };
  const DEFAULT_FIGURE = 'pixel';
  /* Weapon categories: 'melee' (swing, smashes the ball faster) and 'ranged' (fires a bolt over the net that speeds up / slows down the ball). */
  const WEAPON_KIND = { katana: 'melee', kebabknife: 'melee', sword: 'melee', lasso: 'melee', rod: 'melee', kick: 'melee', bat: 'melee', shotgun: 'ranged', revolver: 'ranged', pickle: 'ranged', bolt: 'ranged', hole: 'ranged' };
  /* Ranged weapons (no auto-aim): n projectiles per shot spread by `spread` rad, speed v px/frame, flight time `life` frames, cooldown `cd` frames. */
  const RANGED = {
    shotgun:  { n: 3, spread: 0.14, v: 15, life: 50, cd: 76 },      // 3 pellets, short range, slow to reload
    revolver: { n: 1, spread: 0,    v: 18, life: 90, cd: 32 },       // one bullet, quick to fire again
    /* effect: 'speed' (default: faster / slower ball), 'deflect' (the ball is bent toward the shot's direction), 'hole' (the ball vanishes
     * and drops from the sky on the opponents' side). k = look of the projectile (0 pellet, 1 bullet, 2 pickle slice, 3 lightning, 4 black hole).
     * ring: fires n shots in all directions at once on a key press (no aiming). */
    pickle:   { n: 1, spread: 0,    v: 13, life: 85, cd: 40, k: 2, r: 13, effect: 'deflect' },          // McRib: gherkin slices
    bolt:     { n: 8, spread: 0,    v: 11, life: 34, cd: 84, k: 3, effect: 'deflect', ring: true },   // Cloudy: lightning in every direction
    hole:     { n: 1, spread: 0,    v: 9,  life: 110, cd: 110, k: 4, effect: 'hole' }            // Gagari: black hole cannon
  };
  const weaponOf = style => (FIGURES[style] || FIGURES[DEFAULT_FIGURE]).weapon;
  const kindOf = style => WEAPON_KIND[weaponOf(style)];
  /* Melee weapons: reach beyond the body, ball speed after the hit, direction (fwd = toward the opponents, up < 0 = upward, aimW = how much the
   * direction of the hit relative to the body counts), cooldown in frames, optional dip = frames of extra gravity. */
  const MELEE = {
    sword:  { reach: 62,  v: 13.2, fwd: 0.85, up: -0.25, aimW: 0.6,  cd: 72 },               // all-rounder
    katana: { reach: 58,  v: 14.4,  fwd: 1.0,  up: -0.06, aimW: 0.15, cd: 58 },               // fastest, flat, recharges quickly
    kebabknife: { reach: 58, v: 14.4, fwd: 1.0, up: -0.06, aimW: 0.15, cd: 58 },              // Kebabi's doner knife: same values as the katana
    lasso:  { reach: 112, v: 10.8, fwd: 0.7,  up: -0.95, aimW: 0.1,  cd: 94 },              // long reach, high lob, slow recharge
    rod:    { reach: 52,  v: 12,   fwd: 0.9,  up: -0.4,  aimW: 0.3,  cd: 76, dip: 55 },     // the ball dips steeply behind the net
    bat:    { reach: 58,  v: 14.4, fwd: 1.0,  up: -0.06, aimW: 0.15, cd: 58 },                // Kindi's baseball bat: same values as the katana
    kick:   { reach: 56,  v: 14,   fwd: 0.8,  up: -0.55, aimW: 0.1,  cd: 62, rev: true }      // Transformer: kick from below, the ball flies up and forward (rev = the swing goes upward)
  };
  const cdMax = style => (kindOf(style) === 'ranged' ? RANGED[weaponOf(style)].cd : MELEE[weaponOf(style)].cd);
  /* Direction of a ranged shot (no auto-aim): the player HOLDS the special key and the aim sweeps up and down; releasing fires.
   * A quick tap fires forward and a little upward. aimHold = frames the key has been held. */
  const AIM_PERIOD = 80;
  function aimAt(hold) { return -0.3 - 0.6 * Math.sin(2 * Math.PI * hold / AIM_PERIOD); }       // -0.9 (steep up) ... +0.3 (down)
  function shotAngle(b) {
    const a = aimAt(b.aimHold || 0);
    return b.team === 0 ? a : Math.PI - a;
  }

  const LEVELS = {
    easy:   { delay: 14, err: 46, move: 0.72, jump: 0.55, grab: 0.25, use: 0.010, wpn: 0.06, mult: 1.0 },
    normal: { delay: 7,  err: 24, move: 0.90, jump: 0.85, grab: 0.50, use: 0.020, wpn: 0.14, mult: 1.5 },
    hard:   { delay: 2,  err: 8,  move: 1.00, jump: 1.00, grab: 0.85, use: 0.040, wpn: 0.35, mult: 2.0 }
  };

  // deterministic random numbers (for tests)
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* The two towel areas on a team's half of the court: [x0, x1] pairs. */
  function towelRects(team) {
    const c = team === 0 ? 200 : C.W - 200;          // one towel in the middle of the team's half
    return [[c - 80, c + 80]];
  }

  /* Ball vs. net: a pole from the foot (bx, ground) to the top (tx, net top) with the net's thickness; both are NET_X when it stands upright
   * (Faulty Level moves them). Returns true on collision. */
  function collideNet(ball, rng, bx = C.NET_X, tx = C.NET_X) {
    const r = C.BALL_R + C.NET_HW;
    const sx = tx - bx, sy = C.NET_TOP - C.GROUND;
    const u = clamp(((ball.x - bx) * sx + (ball.y - C.GROUND) * sy) / (sx * sx + sy * sy), 0, 1);
    const cx = bx + sx * u, cy = C.GROUND + sy * u;
    const dx = ball.x - cx, dy = ball.y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= r) return false;
    let nx, ny;
    if (d === 0) { nx = ball.x < cx ? -1 : 1; ny = 0; }   // centre inside the net: push out sideways
    else { nx = dx / d; ny = dy / d; }
    ball.x = cx + nx * r; ball.y = cy + ny * r;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) { ball.vx -= 1.6 * vn * nx; ball.vy -= 1.6 * vn * ny; }
    // resting on the net top: nudge so it does not stick
    if (ny < -0.7 && Math.abs(ball.vx) < 1) ball.vx += (rng() < 0.5 ? -1 : 1) * 1.6;
    return true;
  }

  function stepBallFree(ball, rng, bx, tx) {
    ball.vy += C.BALL_G + (ball.dip > 0 ? C.DIP_G : 0);
    if (ball.dip > 0) ball.dip--;
    ball.x += ball.vx; ball.y += ball.vy;
    const r = C.BALL_R;
    if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx) * 0.85; }
    if (ball.x > C.W - r) { ball.x = C.W - r; ball.vx = -Math.abs(ball.vx) * 0.85; }
    if (ball.y < r) { ball.y = r; ball.vy = Math.abs(ball.vy) * 0.4; }   // ceiling keeps the ball on screen
    return collideNet(ball, rng, bx, tx);
  }

  /* ---------------------------------------------------------------- Blob */
  class Blob {
    constructor(id, team, homeX, controller, color, label, style) {
      this.id = id; this.team = team; this.homeX = homeX;
      this.controller = controller; // 'human' | 'ai'
      this.color = color; this.label = label;
      this.style = FIGURES[style] ? style : DEFAULT_FIGURE;   // looks only: see FIGURES
      this.aura = false;
      this.x = homeX; this.y = C.GROUND - C.BLOB_R;
      this.vx = 0; this.vy = 0;
      this.input = { left: false, right: false, jump: false, special: false };
      this.prevSpecial = false;
      this.touchCd = 0;
      this.fight = false;            // Volley Fight: has a weapon (melee or ranged, see kindOf)
      this.swing = 0; this.cd = 0; this.swung = false; this.aimHold = 0;   // weapon swing frames left / cooldown frames left
      this.aim = 0;                  // weapon angle (radians), auto-aimed at the ball
      this.ai = null;
    }
    reset() {
      this.x = this.homeX; this.y = C.GROUND - C.BLOB_R;
      this.vx = this.vy = 0; this.touchCd = 0; this.swing = 0; this.aimHold = 0;
    }
    get onGround() { return this.y >= C.GROUND - C.BLOB_R - 0.001; }
  }

  /* ------------------------------------------------------------------ AI */
  class AI {
    constructor(blob, sim, levelName) {
      this.b = blob; this.sim = sim; this.p = LEVELS[levelName] || LEVELS.normal;
      this.err = 0; this.errTimer = 0; this.lag = null; this.lagTimer = 0;
      this.wantMap = {};
    }
    wants(pu) {
      if (!(pu.id in this.wantMap)) this.wantMap[pu.id] = this.sim.rng() < this.p.grab;   // decided once per item
      return this.wantMap[pu.id];
    }
    update() {
      const sim = this.sim, b = this.b, p = this.p, ball = sim.ball, rng = sim.rng;
      const dir = b.team === 0 ? 1 : -1;
      const inp = b.input;
      inp.left = inp.right = inp.jump = inp.special = false;

      // reaction delay: refresh the prediction only every p.delay frames
      if (--this.lagTimer <= 0 || !this.lag) { this.lag = sim.pred; this.lagTimer = p.delay; }
      if (--this.errTimer <= 0) { this.err = (rng() * 2 - 1) * p.err; this.errTimer = 25; }
      const pred = this.lag || sim.pred;

      const nb = sim.netBase(), mine = b.team === 0 ? pred.x < nb - 4 : pred.x > nb + 4;
      const mates = sim.blobs.filter(o => o.team === b.team && o.ai);
      const touches = sim.touches[b.team];
      const lastHit = (sim.lastTouchTeam === b.team && touches >= C.MAX_TOUCHES - 1);
      const off = lastHit ? 36 : 26;

      let tx = b.homeX;
      let isHitter = false;
      if (mine && sim.state !== 'point') {
        // who takes the ball? (with hysteresis so they don't swap back and forth)
        const key = 'hit' + b.team;
        let cur = sim[key];
        const cost = o => Math.abs(o.x - (pred.x - dir * off));
        let best = mates[0];
        for (const m of mates) if (cost(m) < cost(best)) best = m;
        if (!cur || !mates.includes(cur) || cost(best) + 30 < cost(cur)) cur = best;
        sim[key] = cur;
        isHitter = (cur === b);
        if (isHitter) tx = pred.x - dir * off + this.err;
      }

      // go for a falling power-up on our half
      let grab = false;
      if (sim.state === 'play' && sim.inv[b.team].length < C.PU_MAX_INV) {
        let target = null;
        for (const pu of sim.items) {
          if (!this.wants(pu) || (pu.x < C.NET_X) !== (b.team === 0)) continue;
          if (isHitter && !(pred.t > 100 && Math.abs(pu.x - b.x) < 120)) continue;
          // the closest team mate goes for it
          const pool = mates.filter(m => !isHitter ? m !== sim['hit' + b.team] || mates.length === 1 : true);
          let best = null;
          for (const m of pool) if (!best || Math.abs(m.x - pu.x) < Math.abs(best.x - pu.x)) best = m;
          if (best === b && (!target || Math.abs(pu.x - b.x) < Math.abs(target.x - b.x))) target = pu;
        }
        if (target) { grab = true; tx = target.x; }
      }

      if (rng() < p.move) {
        if (b.x < tx - 5) inp.right = true; else if (b.x > tx + 5) inp.left = true;
      }

      if (isHitter && (sim.state === 'play' || (sim.state === 'serve' && sim.timer <= 45))) {   // CPU serves in the last 0.75 s
        const bx = (ball.x - b.x) * dir;        // > 0: ball is in front of the blob
        const by = b.y - ball.y;                // > 0: ball is above the blob
        const near = bx > -6 && bx < 56 && by > 35 && by < 205 && ball.vy > -3;
        if (near && b.onGround && rng() < p.jump) inp.jump = true;
      }

      // Volley Fight, ranged weapon: hold the key until the sweeping aim points at the ball, then release
      if (sim.fight && kindOf(b.style) === 'ranged' && RANGED[weaponOf(b.style)].ring) {
        // ring weapon (Cloudy): fire when the ball is close enough for a bolt to reach it
        if (b.cd === 0 && sim.state === 'play' && Math.hypot(ball.x - b.x, ball.y - b.y) < 190 && rng() < p.wpn * 1.5) inp.special = true;
      }
      else if (sim.fight && kindOf(b.style) === 'ranged') {
        // auto-aimed: press when the ball is in front of us and within range of the shot
        const W = RANGED[weaponOf(b.style)];
        if (b.cd === 0 && b.swing === 0 && sim.state === 'play') {
          const dist = Math.hypot(ball.x - b.x, ball.y - b.y), dxf = (ball.x - b.x) * dir;
          if (dxf > 40 && dist < W.v * W.life * 0.9 && rng() < p.wpn * 1.5) inp.special = true;
        }
      }
      // Volley Fight, melee weapon: swing when the ball is in reach
      else if (sim.fight && kindOf(b.style) === 'melee' && b.cd === 0 && b.swing === 0 && (sim.state === 'play' || sim.state === 'serve') &&
          !(sim.lastTouchTeam === b.team && sim.touches[b.team] >= C.MAX_TOUCHES) &&
          Math.hypot(ball.x - b.x, ball.y - b.y) < C.BLOB_R + C.BALL_R + MELEE[weaponOf(b.style)].reach - 8 &&
          (sim.state === 'play' || sim.timer <= 45) && rng() < p.wpn) inp.special = true;

      // use a stored power-up
      const held = sim.inv[b.team][0];
      if (sim.state === 'play' && held && rng() < p.use &&
          ((held === 'towel' && sim.towels[b.team] === 0) || (held === 'alman' && sim.alman[1 - b.team] === 0) ||
         (held === 'aura' && sim.aura[b.team] === 0) || (held === 'level' && sim.faulty[b.team] === 0))) inp.special = true;
    }
  }

  /* ----------------------------------------------------------------- Sim */
  class Sim {
    /* opts: { teams: [[{controller,color,label}...],[...]], level, target, seed } */
    constructor(opts) {
      this.rng = mulberry32(opts.seed != null ? opts.seed : (Math.random() * 2 ** 31) | 0);
      this.level = opts.level || 'normal';
      this.target = opts.target || 11;
      this.fight = !!opts.fight;       // Volley Fight mode: special key swings a weapon, no power-ups
      this.blobs = [];
      const homes = n => (n === 1 ? [0.5] : [0.28, 0.72]);
      opts.teams.forEach((team, t) => {
        const hs = homes(team.length);
        team.forEach((spec, i) => {
          const hx = t === 0 ? C.NET_X * hs[i] : C.NET_X + C.NET_X * hs[i];
          const b = new Blob(this.blobs.length, t, hx, spec.controller, spec.color, spec.label, spec.style);
          b.fight = this.fight;
          if (spec.controller === 'ai') b.ai = new AI(b, this, this.level);
          this.blobs.push(b);
        });
      });
      this.ball = { x: 200, y: 190, vx: 0, vy: 0, spin: 0, dip: 0 };
      this.score = [0, 0];
      this.serving = 0;
      this.touches = [0, 0];
      this.lastTouchTeam = -1;
      this.rallyHits = 0; this.longestRally = 0;
      this.frames = 0;
      this.events = [];
      this.winner = -1; this.message = ''; this.messageTimer = 0;
      this.pred = { x: 200, y: 280, t: 99 };
      // power-ups
      this.items = []; this.puId = 0;
      this.volley = 0; this.ballVol = 0;
      this.shots = [];              // Volley Fight: bolts of ranged weapons in flight [{x, y, vx, vy, team, life}]
      this.puTimer = C.PU_INTERVAL;
      this.inv = [[], []];          // collected, not yet used (per team)
      this.towels = [0, 0];         // remaining frames of active Fluffy Towels (per team)
      this.alman = [0, 0];          // remaining frames of Alman Mode on each team (the team that is slowed down)
      this.aura = [0, 0];           // remaining frames of Aura+10 on each team (bigger hit box)
      this.faulty = [0, 0];          // remaining frames of Faulty Level per activating team (the net leans toward that team)
      this.tilt = 0;                // current net position: -1 = fully toward team 0, +1 = fully toward team 1 (eases toward the target)
      this.state = 'serve'; this.timer = C.SERVE_DELAY;
      this.startServe();
    }

    emit(type, data) { this.events.push(Object.assign({ type }, data)); }
    say(msg, frames) { this.message = msg; this.messageTimer = frames || 90; }

    startServe() {
      const b = this.ball;
      b.x = this.serving === 0 ? 200 : 600; b.y = 190; b.vx = 0; b.vy = 0; b.dip = 0;
      this.touches = [0, 0]; this.lastTouchTeam = -1; this.rallyHits = 0;
      this.blobs.forEach(o => o.reset());
      this.hit0 = this.hit1 = null;
      this.state = 'serve'; this.timer = C.SERVE_DELAY;
      this.shots.length = 0;
    }

    /* Predict where the ball arrives at hit height (ignores blobs). */
    predict() {
      const s = { x: this.ball.x, y: this.ball.y, vx: this.ball.vx, vy: this.ball.vy, dip: this.ball.dip || 0 };
      const r = () => 0.5, nb = this.netBase(), nt = this.netTopX();
      for (let t = 0; t < 400; t++) {
        stepBallFree(s, r, nb, nt);
        if (s.vy > 0 && s.y >= C.HIT_Y) return { x: s.x, y: s.y, t };
      }
      return { x: s.x, y: s.y, t: 400 };
    }

    endRally(winnerTeam, reason) {
      if (this.state !== 'play') return;
      this.longestRally = Math.max(this.longestRally, this.rallyHits);
      if (winnerTeam === this.serving) {
        this.score[winnerTeam]++;
        this.emit('point', { team: winnerTeam, scored: true, reason });
        this.say(reason === 'fault' ? 'Too many touches!' : 'Point!', 90);
      } else {
        this.serving = winnerTeam;
        this.emit('point', { team: winnerTeam, scored: false, reason });
        this.say(reason === 'fault' ? 'Too many touches – side out!' : 'Side out', 90);
      }
      this.state = 'point'; this.timer = C.POINT_DELAY;
      if (this.score[winnerTeam] >= this.target) {
        this.winner = winnerTeam;
        this.state = 'over'; this.emit('win', { team: winnerTeam });
      }
    }

    /* ---- power-ups ---- */
    /* One power-up per player, all at the same moment, each with its own random type and position on the player's half. */
    spawnPowerups() {
      const placed = [];
      for (const bl of this.blobs) {
        const lo = bl.team === 0 ? 50 : C.NET_X + 50, hi = bl.team === 0 ? C.NET_X - 50 : C.W - 50;
        let x = lo + this.rng() * (hi - lo);
        for (let k = 0; k < 12 && placed.some(px => Math.abs(px - x) < 80); k++) x = lo + this.rng() * (hi - lo);
        placed.push(x);
        this.items.push({ id: ++this.puId, type: TYPES[Math.floor(this.rng() * TYPES.length)], x, y: -30, by: -30, age: 0, owner: bl.id });
      }
      this.puTimer = C.PU_INTERVAL;
      this.emit('spawn', {});
    }
    updatePowerups() {
      if (this.fight) return;
      if (this.state === 'over') return;      // timers keep running in every phase of the match (serve, between points)
      for (let t = 0; t < 2; t++) {
        if (this.towels[t] > 0 && --this.towels[t] === 0) this.emit('towelEnd', { team: t });
        if (this.alman[t] > 0 && --this.alman[t] === 0) this.emit('almanEnd', { team: t });
        if (this.aura[t] > 0 && --this.aura[t] === 0) this.emit('auraEnd', { team: t });
        if (this.faulty[t] > 0 && --this.faulty[t] === 0) this.emit('levelEnd', { team: t });
      }
      const want = (this.faulty[1] > 0 ? 1 : 0) - (this.faulty[0] > 0 ? 1 : 0);   // both active: they cancel out
      this.tilt += clamp(want - this.tilt, -0.04, 0.04);                          // takes ~25 frames to lean over / straighten up
      if (--this.puTimer <= 0) this.spawnPowerups();
      for (let i = this.items.length - 1; i >= 0; i--) {
        const pu = this.items[i];
        pu.age++;
        pu.y += C.PU_FALL;                       // falls straight through; gone once it has sunk below the ground
        if (pu.y > C.H + 40) { this.items.splice(i, 1); this.emit('expire', {}); continue; }
        pu.by = pu.y;
        for (const b of this.blobs) {
          if (this.inv[b.team].length >= C.PU_MAX_INV) continue;
          if (Math.hypot(b.x - pu.x, b.y - pu.by) < C.BLOB_R + C.PU_R) {
            this.inv[b.team].push(pu.type);
            this.emit('collect', { team: b.team, blob: b.id, item: pu.type });
            this.say(POWERUPS[pu.type].name + ' collected!', 70);
            this.items.splice(i, 1);
            break;
          }
        }
      }
    }
    activate(team) {
      if (this.state === 'over') return;
      const type = this.inv[team].shift();
      if (!type) return;
      if (type === 'towel') {
        this.towels[team] = C.TOWEL_FRAMES;       // pressing again while active simply refreshes the timer
        this.emit('activate', { team, item: type });
        this.say(POWERUPS[type].name + '!', 70);
      } else if (type === 'aura') {
        this.aura[team] = C.AURA_FRAMES;           // own team: bigger hit box
        this.emit('activate', { team, item: type });
        this.say(POWERUPS[type].name + '!', 70);
      } else if (type === 'level') {
        this.faulty[team] = C.LEVEL_FRAMES;         // the net leans toward the activating team: their half shrinks, the other one grows
        this.emit('activate', { team, item: type });
        this.say(POWERUPS[type].name + '!', 70);
      } else if (type === 'alman') {
        const foe = 1 - team;                     // the opponents get the hat, sandals and socks
        this.alman[foe] = C.ALMAN_FRAMES;
        this.emit('activate', { team, item: type, target: foe });
        this.say(POWERUPS[type].name + '!', 70);
      }
    }
    /* Net position (Faulty Level): x of the pole at height y, of its foot (the boundary between the two halves) and of its top. */
    netXAt(y) { const f = (C.GROUND - clamp(y, C.NET_TOP, C.GROUND)) / (C.GROUND - C.NET_TOP); return C.NET_X + this.tilt * (C.LEVEL_BASE + (C.LEVEL_TOP - C.LEVEL_BASE) * f); }
    netBase() { return C.NET_X + this.tilt * C.LEVEL_BASE; }
    netTopX() { return C.NET_X + this.tilt * C.LEVEL_TOP; }
    onTowel(x) {
      for (let t = 0; t < 2; t++) {
        if (this.towels[t] <= 0) continue;
        for (const [a, b] of towelRects(t)) if (x >= a - 6 && x <= b + 6) return true;
      }
      return false;
    }

    updateBlob(b) {
      const inp = b.input;
      if (b.touchCd > 0) b.touchCd--;
      const pressed = inp.special && !b.prevSpecial;
      b.prevSpecial = inp.special;
      if (this.fight) { this.weaponStep(b, pressed); }
      else if (pressed) this.activate(b.team);

      b.alman = this.alman[b.team] > 0;
      b.aura = this.aura[b.team] > 0;
      const slow = b.alman ? C.ALMAN_MULT : 1;
      b.vx = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * C.BLOB_SPEED * slow;
      b.x += b.vx;
      const r = C.BLOB_R;
      if (b.team === 0) b.x = clamp(b.x, r, Math.min(this.netXAt(b.y - r), this.netXAt(b.y + r)) - C.NET_HW - r);
      else b.x = clamp(b.x, Math.max(this.netXAt(b.y - r), this.netXAt(b.y + r)) + C.NET_HW + r, C.W - r);

      // Alman Mode: 80 % of the jump height needs sqrt(0.8) of the launch speed
      if (inp.jump && b.onGround) { b.vy = C.JUMP_V * (b.alman ? Math.sqrt(C.ALMAN_MULT) : 1); this.emit('jump', { blob: b.id }); }
      b.vy += C.BLOB_G; b.y += b.vy;
      const rest = C.GROUND - r;
      if (b.y >= rest) { b.y = rest; b.vy = 0; }
    }

    collideBlob(b) {
      const ball = this.ball, r = C.BALL_R, R = C.BLOB_R * (b.aura ? C.AURA_MULT : 1);   // Aura+10: 30 % bigger hit box
      const dx = ball.x - b.x, dy = ball.y - b.y;
      let d = Math.hypot(dx, dy);
      const minD = R + r;
      if (d >= minD) return;
      if (d < 0.001) d = 0.001;
      const nx = dx / d, ny = dy / d;
      ball.x = b.x + nx * minD; ball.y = b.y + ny * minD;
      let rvx = ball.vx - b.vx, rvy = ball.vy - b.vy;
      const vn = rvx * nx + rvy * ny;
      if (vn >= 0 && b.touchCd > 0) return;
      if (vn < 0) { rvx -= 2 * vn * nx; rvy -= 2 * vn * ny; }
      let vx = rvx * 0.88 + b.vx, vy = rvy * 0.88 + b.vy;
      let sp = Math.hypot(vx, vy);
      if (sp < C.HIT_MIN) { const k = C.HIT_MIN / Math.max(sp, 0.001); vx *= k; vy *= k; sp = C.HIT_MIN; }
      if (sp > C.BALL_MAXV) { vx *= C.BALL_MAXV / sp; vy *= C.BALL_MAXV / sp; sp = C.BALL_MAXV; }
      if (vy < -C.BALL_MAX_UP) vy = -C.BALL_MAX_UP;            // don't shoot out of the top
      ball.vx = vx; ball.vy = vy;
      ball.spin = clamp(ball.vx * 0.04, -0.5, 0.5);

      if (b.touchCd === 0) this.registerTouch(b, 'hit', Math.min(1, sp / C.BALL_MAXV));
    }

    /* Counts a touch of the ball (classic hit or weapon hit): max. 3 per side. */
    registerTouch(b, type, power) {
      b.touchCd = 8;
      this.emit(type, { blob: b.id, power });
      this.ball.dip = 0;
      if (this.lastTouchTeam !== b.team) { this.touches[b.team] = 0; this.touches[1 - b.team] = 0; }
      this.lastTouchTeam = b.team;
      this.touches[b.team]++;
      this.rallyHits++;
      if (this.touches[b.team] > C.MAX_TOUCHES) this.endRally(1 - b.team, 'fault');
    }

    /* Auto-aim of ranged weapons: angle toward the ball, led by its flight time, always at least a little forward. */
    autoAngle(b, W) {
      const ball = this.ball, dir = b.team === 0 ? 1 : -1, y0 = b.y - 4;
      const t = Math.min(40, Math.hypot(ball.x - b.x, ball.y - y0) / W.v);
      const tx = ball.x + ball.vx * t, ty = ball.y + ball.vy * t;
      const a = clamp(Math.atan2(ty - y0, Math.max((tx - b.x) * dir, 30)), -1.3, 0.8);
      return dir === 1 ? a : Math.PI - a;
    }
    /* Ranged weapon: fires projectiles toward the (auto-aimed) ball – over the net if the ball is flying there.
     * Ring weapons (Cloudy) send their shots in all directions at once. */
    fire(b) {
      const W = RANGED[weaponOf(b.style)], a0 = W.ring ? 0 : this.autoAngle(b, W);
      b.aim = a0; b.swing = 10; b.cd = W.cd;
      this.volley = (this.volley || 0) + 1;
      for (let i = 0; i < W.n; i++) {
        const a = W.ring ? (i / W.n) * Math.PI * 2 : a0 + (i - (W.n - 1) / 2) * W.spread;
        this.shots.push({ x: b.x + Math.cos(a) * (C.BLOB_R + 8), y: b.y - 4 + Math.sin(a) * (C.BLOB_R + 8), vx: Math.cos(a) * W.v, vy: Math.sin(a) * W.v, team: b.team, life: W.life, r: W.r || C.SHOT_R,
          k: W.k !== undefined ? W.k : (W.n > 1 ? 0 : 1), fx: W.effect || 'speed', vol: this.volley });
      }
      this.emit('shot', { blob: b.id, heavy: W.n > 1 && !W.ring, kind: W.k || 0 });
      b.aimHold = 0;
    }
    /* Bolts: a hit on a ball flying toward the opponents speeds it up, on a ball flying toward the shooter's own side it slows it down. */
    stepShots() {
      const ball = this.ball;
      for (let i = this.shots.length - 1; i >= 0; i--) {
        const s = this.shots[i];
        s.x += s.vx; s.y += s.vy;
        let dead = --s.life <= 0 || s.x < -20 || s.x > C.W + 20 || s.y < -20 || s.y > C.GROUND + 10 || this.state === 'over';
        if (!dead && this.state === 'play' && s.vol !== this.ballVol && Math.hypot(ball.x - s.x, ball.y - s.y) < C.BALL_R + (s.r || C.SHOT_R)) {
          this.ballVol = s.vol;                       // one effect per volley, even if several pellets hit
          const toOpp = s.team === 0 ? 1 : -1;
          const sp = Math.hypot(ball.vx, ball.vy);
          let boost = true;
          if (s.fx === 'hole') {
            // black hole: the ball vanishes and drops from the sky at a random spot on the opponents' side
            const lo = s.team === 0 ? C.NET_X + 60 : 60, hi = s.team === 0 ? C.W - 60 : C.NET_X - 60;
            this.emit('hole', { x0: ball.x, y0: ball.y });
            ball.x = lo + this.rng() * (hi - lo); ball.y = C.BALL_R + 6; ball.vx = 0; ball.vy = 0.5; ball.spin = 0; ball.dip = 0;
            this.emit('hole', { x0: ball.x, y0: ball.y, arrive: true });
          } else if (s.fx === 'deflect') {
            // the ball is bent toward the direction of the shot
            ball.vx = ball.vx * 0.45 + s.vx * 0.85; ball.vy = ball.vy * 0.45 + s.vy * 0.85;
            const n = Math.hypot(ball.vx, ball.vy);
            if (n > C.BALL_CAP) { ball.vx *= C.BALL_CAP / n; ball.vy *= C.BALL_CAP / n; }
            if (n < 6) { ball.vx *= 6 / Math.max(n, 0.1); ball.vy *= 6 / Math.max(n, 0.1); }
            ball.dip = 0;
          } else if (sp < 3) { ball.vx = s.vx * 0.5; ball.vy = s.vy * 0.5; boost = true; }
          else {
            boost = ball.vx * toOpp > 0;
            const f = boost ? C.SHOT_BOOST : C.SHOT_SLOW;
            ball.vx *= f; ball.vy *= f;
            if (boost) { const n = Math.hypot(ball.vx, ball.vy); if (n > C.BALL_CAP) { ball.vx *= C.BALL_CAP / n; ball.vy *= C.BALL_CAP / n; } }
          }
          if (s.fx !== 'hole') this.emit('shotHit', { boost, x: ball.x, y: ball.y, fx: s.fx });
          dead = s.k !== 0;                            // pellets fly on; bullets, slices, bolts and black holes are used up
        }
        if (dead) this.shots.splice(i, 1);
      }
    }

    /* Volley Fight: the special key swings the figure's weapon. The weapon auto-aims at the ball; if the ball is in reach during the
     * swing it is shot toward the opponents' side, faster than a normal hit. Cooldown prevents spamming. */
    weaponStep(b, pressed) {
      const ball = this.ball;
      if (b.cd > 0) b.cd--;
      if (b.swing > 0) b.swing--;
      const live = this.state === 'serve' || this.state === 'play';
      const dir = b.team === 0 ? 1 : -1;
      if (kindOf(b.style) === 'ranged') {
        const W = RANGED[weaponOf(b.style)];
        if (!W.ring && b.swing === 0) b.aim = this.autoAngle(b, W);      // the weapon follows the ball
        if (pressed && live && b.cd === 0 && b.swing === 0) this.fire(b);   // a key press fires (ring weapons: in all directions)
        return;
      }
      const M = MELEE[weaponOf(b.style)];
      if (pressed && live && b.cd === 0 && b.swing === 0) {
        b.swing = C.WEAPON_SWING; b.cd = M.cd; b.swung = false;
        this.emit('swing', { blob: b.id });
      }
      // auto-aim: while idle the weapon rests forward-up, while swinging it points at the ball
      const dx = ball.x - b.x, dy = ball.y - b.y, dist = Math.hypot(dx, dy);
      if (b.swing > 0 && dist < 260) b.aim = Math.atan2(dy, dx);
      else if (b.swing > 0) b.aim = dir === 1 ? -0.5 : Math.PI + 0.5;
      if (b.swing > 0 && !b.swung && live && dist <= C.BLOB_R + C.BALL_R + M.reach) {
        b.swung = true;
        const ux = dx / Math.max(dist, 0.001), uy = dy / Math.max(dist, 0.001);
        let vx = dir * M.fwd + ux * 0.25, vy = uy * M.aimW + M.up;
        const n = Math.hypot(vx, vy);
        vx = vx / n * M.v; vy = vy / n * M.v;
        if (vy < -C.BALL_MAX_UP) vy = -C.BALL_MAX_UP;
        ball.vx = vx; ball.vy = vy; ball.spin = clamp(vx * 0.05, -0.6, 0.6);
        if (this.state === 'serve') { this.state = 'play'; this.say('', 0); }
        this.registerTouch(b, 'weapon', 1);
        ball.dip = M.dip || 0;                        // (registerTouch cleared it)
      }
    }

    step() {
      this.frames++;
      this.events.length = 0;
      if (this.messageTimer > 0) this.messageTimer--;
      const ball = this.ball;

      this.pred = this.predict();
      for (const b of this.blobs) {
        if (b.ai) b.ai.update();
        if (this.state === 'over') { b.input.left = b.input.right = b.input.jump = b.input.special = false; }
        this.updateBlob(b);
      }
      this.updatePowerups();
      if (this.fight) this.stepShots();

      if (this.state === 'serve') {
        // the hanging ball can be played right away; otherwise it is released when the timer runs out
        const hitsBefore = this.rallyHits;
        for (const b of this.blobs) this.collideBlob(b);
        if (this.rallyHits > hitsBefore) { this.state = 'play'; this.say('', 0); return; }
        if (--this.timer <= 0) { this.state = 'play'; this.say('', 0); }
        return;
      }
      if (this.state === 'over') { this.stepBallDead(); return; }

      // move the ball
      ball.vy += C.BALL_G + (ball.dip > 0 ? C.DIP_G : 0);
      if (ball.dip > 0) ball.dip--;
      const sp0 = Math.hypot(ball.vx, ball.vy);
      if (sp0 > C.BALL_CAP) { ball.vx *= C.BALL_CAP / sp0; ball.vy *= C.BALL_CAP / sp0; }
      ball.x += ball.vx; ball.y += ball.vy;
      const r = C.BALL_R;
      if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx) * 0.85; this.emit('wall', {}); }
      if (ball.x > C.W - r) { ball.x = C.W - r; ball.vx = -Math.abs(ball.vx) * 0.85; this.emit('wall', {}); }
      if (ball.y < r) { ball.y = r; ball.vy = Math.abs(ball.vy) * 0.4; this.emit('wall', {}); }
      if (collideNet(ball, this.rng, this.netBase(), this.netTopX())) this.emit('net', {});
      ball.spin *= 0.995;

      if (this.state === 'play') {
        for (const b of this.blobs) { if (this.state === 'play') this.collideBlob(b); }
        // floor: a Fluffy Towel makes the ball bounce instead of ending the rally
        const towel = this.onTowel(ball.x);
        const gy = towel ? C.GROUND - C.TOWEL_H : C.GROUND;
        if (this.state === 'play' && ball.y + r >= gy) {
          if (towel) {
            ball.y = gy - r;
            ball.vy = -Math.min(C.BALL_MAX_UP, Math.max(Math.abs(ball.vy) * 0.95, 9.8));   // springy towel: high bounce so the rally can go on
            ball.vx *= 0.92;
            this.emit('towel', {});
          } else {
            ball.y = C.GROUND - r;
            const side = ball.x < this.netBase() ? 0 : 1;
            this.endRally(1 - side, 'ground');
            if (this.state !== 'play') { ball.vy = -Math.abs(ball.vy) * 0.3; ball.vx *= 0.6; }
          }
        }
      } else { // 'point': let the ball roll out
        if (ball.y + r >= C.GROUND) {
          ball.y = C.GROUND - r; ball.vy = -Math.abs(ball.vy) * 0.35; ball.vx *= 0.8;
          if (Math.abs(ball.vy) < 1.2) ball.vy = 0;
        }
        if (--this.timer <= 0) this.startServe();
      }
    }

    stepBallDead() {
      const ball = this.ball, r = C.BALL_R;
      ball.vy += C.BALL_G; ball.x += ball.vx; ball.y += ball.vy;
      if (ball.y + r >= C.GROUND) { ball.y = C.GROUND - r; ball.vy = -Math.abs(ball.vy) * 0.5; ball.vx *= 0.8; }
      if (ball.x < r || ball.x > C.W - r) ball.vx *= -1;
    }
  }

  const api = { C, LEVELS, POWERUPS, FIGURES, DEFAULT_FIGURE, WEAPON_KIND, RANGED, kindOf, cdMax, shotAngle, aimAt, AIM_PERIOD, MELEE, Sim, Blob, AI, mulberry32, towelRects };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VB = api;
})(typeof self !== 'undefined' ? self : this);
