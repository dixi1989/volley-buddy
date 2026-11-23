/* Beach Volley Hero – online play (1 vs 1).
 * Host-authoritative: the host runs the Sim, the guest only sends its keys and renders the snapshots it receives.
 * Transport: WebRTC data channel via PeerJS (peer-to-peer, no own server; PeerJS cloud is only the matchmaker).
 * snapshot()/applySnapshot() are plain functions so they can be tested in Node without a browser.
 */
(function (root) {
  'use strict';

  const r2 = v => Math.round(v * 100) / 100;

  /* Host: full game state as a small JSON object (~300 bytes). cfg is only attached now and then (names, colors, target). */
  function snapshot(sim, seq, gid, cfg) {
    const b = sim.ball;
    const s = {
      t: 's', g: gid, q: seq,
      b: [r2(b.x), r2(b.y), r2(b.vx), r2(b.vy), r2(b.spin)],
      bl: sim.blobs.map(o => [r2(o.x), r2(o.y), r2(o.vx), r2(o.vy), o.alman ? 1 : 0, o.aura ? 1 : 0, o.swing, o.cd, r2(o.aim), o.aimHold]),
      sc: sim.score, sv: sim.serving, tc: sim.touches, lt: sim.lastTouchTeam, rh: sim.rallyHits, lr: sim.longestRally,
      st: sim.state, tm: sim.timer, w: sim.winner, ms: sim.message, mt: sim.messageTimer,
      it: sim.items.map(p => [p.id, p.type, r2(p.x), r2(p.y), p.age]),
      sh: sim.shots.map(p => [r2(p.x), r2(p.y), r2(p.vx), r2(p.vy), p.team, p.k]),
      inv: sim.inv, tw: sim.towels, am: sim.alman, au: sim.aura,
      ev: sim.events.slice()
    };
    if (cfg) s.cfg = cfg;
    return s;
  }

  /* Guest: copy a received snapshot into a locally built Sim (which is never stepped on the guest). */
  function applySnapshot(sim, s) {
    const b = sim.ball;
    b.x = s.b[0]; b.y = s.b[1]; b.vx = s.b[2]; b.vy = s.b[3]; b.spin = s.b[4];
    s.bl.forEach((a, i) => {
      const o = sim.blobs[i]; if (!o) return;
      o.x = a[0]; o.y = a[1]; o.vx = a[2]; o.vy = a[3]; o.alman = !!a[4]; o.aura = !!a[5]; o.swing = a[6] | 0; o.cd = a[7] | 0; o.aim = a[8] || 0; o.aimHold = a[9] | 0;
    });
    sim.score = s.sc; sim.serving = s.sv; sim.touches = s.tc; sim.lastTouchTeam = s.lt;
    sim.rallyHits = s.rh; sim.longestRally = s.lr;
    sim.state = s.st; sim.timer = s.tm; sim.winner = s.w; sim.message = s.ms; sim.messageTimer = s.mt;
    sim.items = s.it.map(a => ({ id: a[0], type: a[1], x: a[2], y: a[3], by: a[3], age: a[4] }));
    sim.shots = (s.sh || []).map(a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3], team: a[4], k: a[5] | 0, vol: 0 }));
    sim.inv = s.inv; sim.towels = s.tw; sim.alman = s.am; sim.aura = s.au;
    sim.events = s.ev || [];
  }

  /* Input of the guest: bit mask (1 left, 2 right, 4 jump, 8 special) plus counters of jump/special key presses.
   * The counters make sure a very short tap is not lost when a (unreliable) packet drops. */
  function packInput(inp, jc, sc, rematch) {
    return { t: 'i', m: (inp.left ? 1 : 0) | (inp.right ? 2 : 0) | (inp.jump ? 4 : 0) | (inp.special ? 8 : 0), jc, sc, rm: rematch ? 1 : 0 };
  }
  function cleanInput(m) {
    const n = v => (typeof v === 'number' && isFinite(v) ? v | 0 : 0);
    return { m: n(m.m) & 15, jc: n(m.jc), sc: n(m.sc), rm: m.rm ? 1 : 0 };
  }

  /* ----------------------------------------------------- transport (browser only) */
  const PREFIX = 'vbuddy-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';          // no I / O
  const randCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

  const Net = {
    peer: null, conn: null, lastRx: 0, cb: null, closed: true,

    available() { return typeof root.Peer === 'function'; },

    /* Opens a room: cb.onCode(code), cb.onOpen(), cb.onData(msg), cb.onClose(), cb.onError(text) */
    host(cb) {
      this.close(); this.cb = cb; this.closed = false; this.code = null;
      const giveUp = setTimeout(() => { if (!this.code) this._fail({ type: 'network' }); }, 15000);   // matchmaking server did not answer
      const attempt = n => {
        const code = randCode();
        const peer = new root.Peer(PREFIX + code);
        this.peer = peer;
        peer.on('open', () => { this.code = code; clearTimeout(giveUp); cb.onCode(code); });
        peer.on('connection', conn => {
          if (this.conn) { conn.close(); return; }       // room is full
          this._wire(conn);
        });
        peer.on('error', err => {
          if (err.type === 'unavailable-id' && n < 6) { peer.destroy(); attempt(n + 1); return; }
          this._fail(err);
        });
      };
      attempt(0);
    },

    join(code, cb) {
      this.close(); this.cb = cb; this.closed = false;
      const peer = new root.Peer();
      this.peer = peer;
      let timer = setTimeout(() => { if (!this.conn || !this.conn.open) this._fail({ type: 'timeout' }); }, 15000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: false, serialization: 'json' });
        this._wire(conn, () => clearTimeout(timer));
      });
      peer.on('error', err => { clearTimeout(timer); this._fail(err); });
    },

    _wire(conn, onOpen) {
      this.conn = conn;
      conn.on('open', () => { this.lastRx = Date.now(); if (onOpen) onOpen(); this.cb.onOpen(); });
      conn.on('data', d => { this.lastRx = Date.now(); if (d && typeof d === 'object') this.cb.onData(d); });
      conn.on('close', () => { if (!this.closed && this.conn === conn) this.cb.onClose(); });
      conn.on('error', () => { if (!this.closed && this.conn === conn) this.cb.onClose(); });
    },

    _fail(err) {
      if (this.closed) return;
      const t = err && err.type;
      const text = t === 'peer-unavailable' ? 'Room not found – check the code.'
        : t === 'timeout' ? 'Could not connect. Different network? Try again.'
        : t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed' || t === 'disconnected'
          ? 'Cannot reach the matchmaking server. Are you online?'
        : 'Connection problem' + (t ? ' (' + t + ')' : '') + '.';
      this.cb.onError(text);
    },

    send(obj) {
      const c = this.conn;
      if (c && c.open) { try { c.send(obj); } catch (e) { /* ignore */ } }
    },

    close() {
      this.closed = true;
      try { if (this.conn) this.conn.close(); } catch (e) { /* ignore */ }
      try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
      this.conn = this.peer = null;
    }
  };

  const api = { snapshot, applySnapshot, packInput, cleanInput, Net };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VBNet = api;
})(typeof self !== 'undefined' ? self : this);
