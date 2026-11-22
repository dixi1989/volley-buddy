/* Beach Volley Buddy – game engine (no DOM, so it can be tested headless).
 * Physics, rules (serve scoring, max. 3 touches), power-ups and AI.
 * Units: pixels and frames at 60 Hz.
 */
(function (root) {
  'use strict';

  const C = {
    W: 800, H: 450, GROUND: 400,
    NET_X: 400, NET_HW: 5, NET_TOP: 225,
    BLOB_R: 30, BALL_R: 18,
    BLOB_SPEED: 6.4, JUMP_V: -15, BLOB_G: 0.62,
    BALL_G: 0.30, BALL_MAXV: 13, BALL_MAX_UP: 10.5, HIT_MIN: 7.5,
    MAX_TOUCHES: 3,
    SERVE_DELAY: 80, POINT_DELAY: 100,
    HIT_Y: 280,                       // height at which the AI wants to meet the ball
    // power-ups
    PU_INTERVAL: 1800,                // every 30 s one power-up per player falls from the sky
    PU_FALL: 2.6, PU_R: 18,           // fall speed px/frame (~3 s from top to below the ground), pickup radius
    PU_MAX_INV: 3,
    TOWEL_FRAMES: 900, TOWEL_H: 5,    // 15 s
    ALMAN_FRAMES: 600, ALMAN_MULT: 0.8, // 10 s, speed and jump height at 80 %
    AURA_FRAMES: 600, AURA_MULT: 1.3    // 10 s, bear hit box 30 % larger
  };

  const POWERUPS = {
    towel: { name: 'Fluffy Towel' },
    alman: { name: 'Alman Mode' },
    aura: { name: 'Aura+10' }
  };
  const TYPES = Object.keys(POWERUPS);

  const LEVELS = {
    easy:   { delay: 14, err: 46, move: 0.72, jump: 0.55, grab: 0.25, use: 0.010, mult: 1.0 },
    normal: { delay: 7,  err: 24, move: 0.90, jump: 0.85, grab: 0.50, use: 0.020, mult: 1.5 },
    hard:   { delay: 2,  err: 8,  move: 1.00, jump: 1.00, grab: 0.85, use: 0.040, mult: 2.0 }
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

  /* Ball vs. net (rectangle). Returns true on collision. */
  function collideNet(ball, rng) {
    const r = C.BALL_R;
    const x0 = C.NET_X - C.NET_HW, x1 = C.NET_X + C.NET_HW;
    const cx = clamp(ball.x, x0, x1), cy = clamp(ball.y, C.NET_TOP, C.GROUND);
    const dx = ball.x - cx, dy = ball.y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= r) return false;
    let nx, ny;
    if (d === 0) { nx = ball.x < C.NET_X ? -1 : 1; ny = 0; }   // centre inside the net: push out sideways
    else { nx = dx / d; ny = dy / d; }
    ball.x = cx + nx * r; ball.y = cy + ny * r;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) { ball.vx -= 1.6 * vn * nx; ball.vy -= 1.6 * vn * ny; }
    // resting on the net top: nudge so it does not stick
    if (ny < -0.7 && Math.abs(ball.vx) < 1) ball.vx += (rng() < 0.5 ? -1 : 1) * 1.6;
    return true;
  }

  function stepBallFree(ball, rng) {
    ball.vy += C.BALL_G;
    ball.x += ball.vx; ball.y += ball.vy;
    const r = C.BALL_R;
    if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx) * 0.85; }
    if (ball.x > C.W - r) { ball.x = C.W - r; ball.vx = -Math.abs(ball.vx) * 0.85; }
    if (ball.y < r) { ball.y = r; ball.vy = Math.abs(ball.vy) * 0.4; }   // ceiling keeps the ball on screen
    return collideNet(ball, rng);
  }

  /* ---------------------------------------------------------------- Blob */
  class Blob {
    constructor(id, team, homeX, controller, color, label, gender) {
      this.id = id; this.team = team; this.homeX = homeX;
      this.controller = controller; // 'human' | 'ai'
      this.color = color; this.label = label;
      this.gender = gender === 'f' ? 'f' : 'm';   // looks only: swim trunks or bikini
      this.aura = false;
      this.x = homeX; this.y = C.GROUND - C.BLOB_R;
      this.vx = 0; this.vy = 0;
      this.input = { left: false, right: false, jump: false, special: false };
      this.prevSpecial = false;
      this.touchCd = 0;
      this.ai = null;
    }
    reset() {
      this.x = this.homeX; this.y = C.GROUND - C.BLOB_R;
      this.vx = this.vy = 0; this.touchCd = 0;
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

      const mine = b.team === 0 ? pred.x < C.NET_X - 4 : pred.x > C.NET_X + 4;
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

      // use a stored power-up
      const held = sim.inv[b.team][0];
      if (sim.state === 'play' && held && rng() < p.use &&
          ((held === 'towel' && sim.towels[b.team] === 0) || (held === 'alman' && sim.alman[1 - b.team] === 0) ||
         (held === 'aura' && sim.aura[b.team] === 0))) inp.special = true;
    }
  }

  /* ----------------------------------------------------------------- Sim */
  class Sim {
    /* opts: { teams: [[{controller,color,label}...],[...]], level, target, seed } */
    constructor(opts) {
      this.rng = mulberry32(opts.seed != null ? opts.seed : (Math.random() * 2 ** 31) | 0);
      this.level = opts.level || 'normal';
      this.target = opts.target || 11;
      this.blobs = [];
      const homes = n => (n === 1 ? [0.5] : [0.28, 0.72]);
      opts.teams.forEach((team, t) => {
        const hs = homes(team.length);
        team.forEach((spec, i) => {
          const hx = t === 0 ? C.NET_X * hs[i] : C.NET_X + C.NET_X * hs[i];
          const b = new Blob(this.blobs.length, t, hx, spec.controller, spec.color, spec.label, spec.gender);
          if (spec.controller === 'ai') b.ai = new AI(b, this, this.level);
          this.blobs.push(b);
        });
      });
      this.ball = { x: 200, y: 190, vx: 0, vy: 0, spin: 0 };
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
      this.puTimer = C.PU_INTERVAL;
      this.inv = [[], []];          // collected, not yet used (per team)
      this.towels = [0, 0];         // remaining frames of active Fluffy Towels (per team)
      this.alman = [0, 0];          // remaining frames of Alman Mode on each team (the team that is slowed down)
      this.aura = [0, 0];           // remaining frames of Aura+10 on each team (bigger hit box)
      this.state = 'serve'; this.timer = C.SERVE_DELAY;
      this.startServe();
    }

    emit(type, data) { this.events.push(Object.assign({ type }, data)); }
    say(msg, frames) { this.message = msg; this.messageTimer = frames || 90; }

    startServe() {
      const b = this.ball;
      b.x = this.serving === 0 ? 200 : 600; b.y = 190; b.vx = 0; b.vy = 0;
      this.touches = [0, 0]; this.lastTouchTeam = -1; this.rallyHits = 0;
      this.blobs.forEach(o => o.reset());
      this.hit0 = this.hit1 = null;
      this.state = 'serve'; this.timer = C.SERVE_DELAY;
    }

    /* Predict where the ball arrives at hit height (ignores blobs). */
    predict() {
      const s = { x: this.ball.x, y: this.ball.y, vx: this.ball.vx, vy: this.ball.vy };
      const r = () => 0.5;
      for (let t = 0; t < 400; t++) {
        stepBallFree(s, r);
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
      if (this.state === 'over') return;      // timers keep running in every phase of the match (serve, between points)
      for (let t = 0; t < 2; t++) {
        if (this.towels[t] > 0 && --this.towels[t] === 0) this.emit('towelEnd', { team: t });
        if (this.alman[t] > 0 && --this.alman[t] === 0) this.emit('almanEnd', { team: t });
        if (this.aura[t] > 0 && --this.aura[t] === 0) this.emit('auraEnd', { team: t });
      }
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
      } else if (type === 'alman') {
        const foe = 1 - team;                     // the opponents get the hat, sandals and socks
        this.alman[foe] = C.ALMAN_FRAMES;
        this.emit('activate', { team, item: type, target: foe });
        this.say(POWERUPS[type].name + '!', 70);
      }
    }
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
      if (inp.special && !b.prevSpecial) this.activate(b.team);
      b.prevSpecial = inp.special;

      b.alman = this.alman[b.team] > 0;
      b.aura = this.aura[b.team] > 0;
      const slow = b.alman ? C.ALMAN_MULT : 1;
      b.vx = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * C.BLOB_SPEED * slow;
      b.x += b.vx;
      const r = C.BLOB_R;
      if (b.team === 0) b.x = clamp(b.x, r, C.NET_X - C.NET_HW - r);
      else b.x = clamp(b.x, C.NET_X + C.NET_HW + r, C.W - r);

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

      if (b.touchCd === 0) {
        b.touchCd = 8;
        this.emit('hit', { blob: b.id, power: Math.min(1, sp / 13) });
        if (this.lastTouchTeam !== b.team) { this.touches[b.team] = 0; this.touches[1 - b.team] = 0; }
        this.lastTouchTeam = b.team;
        this.touches[b.team]++;
        this.rallyHits++;
        if (this.touches[b.team] > C.MAX_TOUCHES) this.endRally(1 - b.team, 'fault');
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
      ball.vy += C.BALL_G;
      const sp0 = Math.hypot(ball.vx, ball.vy);
      if (sp0 > 18) { ball.vx *= 18 / sp0; ball.vy *= 18 / sp0; }
      ball.x += ball.vx; ball.y += ball.vy;
      const r = C.BALL_R;
      if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx) * 0.85; this.emit('wall', {}); }
      if (ball.x > C.W - r) { ball.x = C.W - r; ball.vx = -Math.abs(ball.vx) * 0.85; this.emit('wall', {}); }
      if (ball.y < r) { ball.y = r; ball.vy = Math.abs(ball.vy) * 0.4; this.emit('wall', {}); }
      if (collideNet(ball, this.rng)) this.emit('net', {});
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
            const side = ball.x < C.NET_X ? 0 : 1;
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

  const api = { C, LEVELS, POWERUPS, Sim, Blob, AI, mulberry32, towelRects };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VB = api;
})(typeof self !== 'undefined' ? self : this);
