/* Volley-Buddy – Spiel-Engine (ohne DOM, damit sie headless testbar ist).
 * Physik, Regeln (Aufschlagwertung wie im Original, max. 3 Berührungen),
 * Smash-Spezial (Strg) und KI. Einheiten: Pixel und Frames bei 60 Hz.
 */
(function (root) {
  'use strict';

  const C = {
    W: 800, H: 450, GROUND: 400,
    NET_X: 400, NET_HW: 5, NET_TOP: 255,
    BLOB_R: 30, BALL_R: 18,
    BLOB_SPEED: 5.2, JUMP_V: -15, BLOB_G: 0.62,
    BALL_G: 0.30, BALL_MAXV: 13, BALL_MAX_UP: 10.5, HIT_MIN: 7.5,
    MAX_TOUCHES: 3,
    SMASH_WINDOW: 14, SMASH_COOLDOWN: 80, SMASH_BOOST: 1.38,
    SERVE_DELAY: 80, POINT_DELAY: 100,
    HIT_Y: 280 // Höhe, auf der die KI den Ball annehmen möchte
  };

  const LEVELS = {
    leicht: { delay: 14, err: 46, move: 0.72, jump: 0.55, smash: 0.00, mult: 1.0 },
    mittel: { delay: 7,  err: 24, move: 0.90, jump: 0.85, smash: 0.25, mult: 1.5 },
    schwer: { delay: 2,  err: 8,  move: 1.00, jump: 1.00, smash: 0.55, mult: 2.0 }
  };

  // deterministischer Zufall (für Tests), im Browser mit Zufallsseed
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* Ball gegen Netz (Rechteck). Gibt true zurück, wenn kollidiert wurde. */
  function collideNet(ball, rng) {
    const r = C.BALL_R;
    const x0 = C.NET_X - C.NET_HW, x1 = C.NET_X + C.NET_HW;
    const cx = clamp(ball.x, x0, x1), cy = clamp(ball.y, C.NET_TOP, C.GROUND);
    let dx = ball.x - cx, dy = ball.y - cy;
    let d = Math.hypot(dx, dy);
    if (d >= r) return false;
    let nx, ny;
    if (d === 0) { // Mittelpunkt im Netz: seitlich herausdrücken
      nx = ball.x < C.NET_X ? -1 : 1; ny = 0; d = 0;
    } else { nx = dx / d; ny = dy / d; }
    ball.x = cx + nx * r; ball.y = cy + ny * r;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= 1.6 * vn * nx;
      ball.vy -= 1.6 * vn * ny;
    }
    // Ball liegt auf der Netzkante: leicht anstupsen, damit er nicht klebt
    if (ny < -0.7 && Math.abs(ball.vx) < 1) {
      ball.vx += (rng() < 0.5 ? -1 : 1) * 1.6;
    }
    return true;
  }

  function stepBallFree(ball, rng) {
    ball.vy += C.BALL_G;
    ball.x += ball.vx; ball.y += ball.vy;
    const r = C.BALL_R;
    if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx) * 0.85; }
    if (ball.x > C.W - r) { ball.x = C.W - r; ball.vx = -Math.abs(ball.vx) * 0.85; }
    if (ball.y < r) { ball.y = r; ball.vy = Math.abs(ball.vy) * 0.4; }   // Decke: Ball bleibt im Bild
    return collideNet(ball, rng);
  }

  /* ---------------------------------------------------------------- Blob */
  class Blob {
    constructor(id, team, homeX, controller, color, label) {
      this.id = id; this.team = team; this.homeX = homeX;
      this.controller = controller; // 'human' | 'ai'
      this.color = color; this.label = label;
      this.x = homeX; this.y = C.GROUND - C.BLOB_R;
      this.vx = 0; this.vy = 0;
      this.input = { left: false, right: false, jump: false, special: false };
      this.prevSpecial = false;
      this.smash = 0;       // verbleibende Frames des aktiven Smash-Fensters
      this.smashCd = 0;     // Cooldown
      this.touchCd = 0;
      this.squash = 0;      // Optik: Landestauchung
      this.ai = null;
    }
    reset() {
      this.x = this.homeX; this.y = C.GROUND - C.BLOB_R;
      this.vx = this.vy = 0; this.smash = 0; this.touchCd = 0;
    }
    get onGround() { return this.y >= C.GROUND - C.BLOB_R - 0.001; }
  }

  /* ------------------------------------------------------------------ KI */
  class AI {
    constructor(blob, sim, levelName) {
      this.b = blob; this.sim = sim; this.p = LEVELS[levelName] || LEVELS.mittel;
      this.err = 0; this.errTimer = 0; this.lag = null; this.lagTimer = 0;
    }
    update() {
      const sim = this.sim, b = this.b, p = this.p, ball = sim.ball, rng = sim.rng;
      const dir = b.team === 0 ? 1 : -1;
      const inp = b.input;
      inp.left = inp.right = inp.jump = inp.special = false;

      // Reaktionsverzögerung: Vorhersage nur alle p.delay Frames aktualisieren
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
        // wer nimmt den Ball? (mit Hysterese, damit sie nicht hin- und herpendeln)
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

      // Bewegen
      if (rng() < p.move) {
        if (b.x < tx - 5) inp.right = true; else if (b.x > tx + 5) inp.left = true;
      }

      // Springen / Smash
      if (isHitter && sim.state === 'play') {
        const bx = (ball.x - b.x) * dir;        // >0: Ball liegt vor dem Blob
        const by = b.y - ball.y;                // >0: Ball über dem Blob
        const near = bx > -6 && bx < 56 && by > 35 && by < 205 && ball.vy > -3;
        if (near && b.onGround && rng() < p.jump) inp.jump = true;
        if (b.smashCd === 0 && Math.hypot(ball.x - b.x, ball.y - b.y) < 110 && !b.onGround
            && rng() < p.smash * 0.25) inp.special = true;
      }
    }
  }

  /* ----------------------------------------------------------------- Sim */
  class Sim {
    /* opts: { teams: [[{controller,color,label}...],[...]], level, target, seed } */
    constructor(opts) {
      this.rng = mulberry32(opts.seed != null ? opts.seed : (Math.random() * 2 ** 31) | 0);
      this.level = opts.level || 'mittel';
      this.target = opts.target || 11;
      this.blobs = [];
      const homes = n => (n === 1 ? [0.5] : [0.28, 0.72]);
      opts.teams.forEach((team, t) => {
        const hs = homes(team.length);
        team.forEach((spec, i) => {
          const half = C.NET_X;
          const hx = t === 0 ? half * hs[i] : C.NET_X + half * hs[i];
          const b = new Blob(this.blobs.length, t, hx, spec.controller, spec.color, spec.label);
          if (spec.controller === 'ai') b.ai = new AI(b, this, this.level);
          this.blobs.push(b);
        });
      });
      this.ball = { x: 200, y: 150, vx: 0, vy: 0, spin: 0 };
      this.score = [0, 0];
      this.serving = 0;
      this.touches = [0, 0];
      this.lastTouchTeam = -1;
      this.rallyHits = 0; this.longestRally = 0;
      this.frames = 0;
      this.events = [];
      this.state = 'serve'; this.timer = C.SERVE_DELAY;
      this.winner = -1; this.message = ''; this.messageTimer = 0;
      this.pred = { x: 200, y: 280, t: 99 };
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

    /* Vorhersage, wo der Ball auf Annahmehöhe ankommt (ohne Blobs) */
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
        this.say(reason === 'fault' ? 'Drei Berührungen überschritten!' : 'Punkt!', 90);
      } else {
        this.serving = winnerTeam;
        this.emit('point', { team: winnerTeam, scored: false, reason });
        this.say(reason === 'fault' ? 'Drei Berührungen überschritten – Aufschlag!' : 'Aufschlagwechsel', 90);
      }
      this.state = 'point'; this.timer = C.POINT_DELAY;
      if (this.score[winnerTeam] >= this.target) {
        this.winner = winnerTeam;
        this.state = 'over'; this.emit('win', { team: winnerTeam });
      }
    }

    updateBlob(b) {
      const inp = b.input;
      if (b.touchCd > 0) b.touchCd--;
      if (b.smash > 0) b.smash--;
      if (b.smashCd > 0) b.smashCd--;
      if (inp.special && !b.prevSpecial && b.smashCd === 0) {
        b.smash = C.SMASH_WINDOW; b.smashCd = C.SMASH_COOLDOWN;
        this.emit('smashStart', { blob: b.id });
      }
      b.prevSpecial = inp.special;

      b.vx = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * C.BLOB_SPEED;
      b.x += b.vx;
      const r = C.BLOB_R;
      if (b.team === 0) b.x = clamp(b.x, r, C.NET_X - C.NET_HW - r);
      else b.x = clamp(b.x, C.NET_X + C.NET_HW + r, C.W - r);

      if (inp.jump && b.onGround) { b.vy = C.JUMP_V; this.emit('jump', { blob: b.id }); }
      b.vy += C.BLOB_G; b.y += b.vy;
      const rest = C.GROUND - r;
      if (b.y >= rest) {
        if (b.vy > 4) b.squash = Math.min(1, b.vy / 14);
        b.y = rest; b.vy = 0;
      }
      if (b.squash > 0) b.squash = Math.max(0, b.squash - 0.08);
    }

    collideBlob(b) {
      const ball = this.ball, r = C.BALL_R, R = C.BLOB_R;
      const dx = ball.x - b.x, dy = ball.y - b.y;
      let d = Math.hypot(dx, dy);
      const minD = R + r;
      if (d >= minD) return;
      if (d < 0.001) { d = 0.001; }
      const nx = dx / d, ny = dy / d;
      ball.x = b.x + nx * minD; ball.y = b.y + ny * minD;
      let rvx = ball.vx - b.vx, rvy = ball.vy - b.vy;
      const vn = rvx * nx + rvy * ny;
      if (vn >= 0 && b.touchCd > 0) return;
      if (vn < 0) { rvx -= 2 * vn * nx; rvy -= 2 * vn * ny; }
      let vx = rvx * 0.88 + b.vx, vy = rvy * 0.88 + b.vy;
      let sp = Math.hypot(vx, vy);
      if (sp < C.HIT_MIN) { const k = C.HIT_MIN / Math.max(sp, 0.001); vx *= k; vy *= k; sp = C.HIT_MIN; }
      const smashed = b.smash > 0;
      if (smashed) { vx *= C.SMASH_BOOST; vy = vy * C.SMASH_BOOST + 2.5; b.smash = 0; }
      sp = Math.hypot(vx, vy);
      const cap = smashed ? 18 : C.BALL_MAXV;
      if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
      if (vy < -C.BALL_MAX_UP) vy = -C.BALL_MAX_UP;          // nicht zu hoch hinausschießen
      ball.vx = vx; ball.vy = vy;
      ball.spin = clamp((ball.vx) * 0.04, -0.5, 0.5);

      if (b.touchCd === 0) {
        b.touchCd = 8;
        this.emit('hit', { blob: b.id, smash: smashed, power: Math.min(1, sp / 16) });
        // Berührungszählung
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
        if (this.state === 'over') { b.input.left = b.input.right = b.input.jump = false; }
        this.updateBlob(b);
      }

      if (this.state === 'serve') {
        if (--this.timer <= 0) { this.state = 'play'; this.say('', 0); }
        return;
      }
      if (this.state === 'over') { this.stepBallDead(); return; }

      // Ball bewegen
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
        if (this.state === 'play' && ball.y + r >= C.GROUND) {
          ball.y = C.GROUND - r;
          const side = ball.x < C.NET_X ? 0 : 1;
          this.endRally(1 - side, 'ground');
          if (this.state !== 'play') { ball.vy = -Math.abs(ball.vy) * 0.3; ball.vx *= 0.6; }
        }
      } else { // 'point': Ball darf noch ausrollen
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

  const api = { C, LEVELS, Sim, Blob, AI, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VB = api;
})(typeof self !== 'undefined' ? self : this);
