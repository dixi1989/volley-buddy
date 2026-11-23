/* Headless test of the online snapshot logic: a host Sim runs, a guest Sim only applies snapshots (with packet loss). */
const assert = require('assert');
const VB = require('../engine.js');
const NET = require('../net.js');
const { Sim } = VB;

const spec = (color, label) => ({ controller: 'human', color, gender: 'm', label });
const mk = () => new Sim({ teams: [[spec('#3aa0ff', 'A')], [spec('#ff5a55', 'B')]], level: 'normal', target: 11, seed: 7 });
const host = mk(), guest = mk();
const rnd = VB.mulberry32(42);
let seq = 0, applied = 0, goals = 0, maxDiff = 0, events = 0, lastQ = -1;

for (let f = 0; f < 20000; f++) {
  // random "players"; every 400 frames one of them holds still for a while
  for (const b of host.blobs) {
    if (f % 20 === 0) { b.input.left = rnd() < 0.4; b.input.right = rnd() < 0.4; b.input.jump = rnd() < 0.3; b.input.special = rnd() < 0.05; }
  }
  host.step();
  if (host.state === 'over') { goals++; Object.assign(host, mk()); host.events = []; continue; }   // new match
  const snap = JSON.parse(JSON.stringify(NET.snapshot(host, ++seq, 1, null)));
  if (rnd() < 0.15) continue;                               // 15 % packet loss
  if (snap.q <= lastQ) continue; lastQ = snap.q;
  NET.applySnapshot(guest, snap); applied++; events += guest.events.length;
  const d = Math.max(Math.abs(guest.ball.x - host.ball.x), Math.abs(guest.ball.y - host.ball.y),
    ...host.blobs.map((b, i) => Math.max(Math.abs(b.x - guest.blobs[i].x), Math.abs(b.y - guest.blobs[i].y))));
  maxDiff = Math.max(maxDiff, d);
  assert.deepStrictEqual(guest.score, host.score);
  assert.strictEqual(guest.state, host.state);
  assert.strictEqual(guest.serving, host.serving);
  assert.deepStrictEqual(guest.inv, host.inv);
  assert.deepStrictEqual(guest.towels, host.towels);
  assert.deepStrictEqual(guest.alman, host.alman);
  assert.deepStrictEqual(guest.aura, host.aura);
  assert.strictEqual(guest.items.length, host.items.length);
  guest.items.forEach((p, i) => { assert.strictEqual(p.type, host.items[i].type); assert.ok(Math.abs(p.y - host.items[i].y) < 0.01); });
  assert.strictEqual(guest.blobs[0].aura, !!host.blobs[0].aura);
}
assert.ok(maxDiff < 0.02, 'positions differ by ' + maxDiff);

// input packing
const pk = NET.packInput({ left: true, right: false, jump: true, special: true }, 5, 3, true);
assert.deepStrictEqual(NET.cleanInput(JSON.parse(JSON.stringify(pk))), { m: 13, jc: 5, sc: 3, rm: 1 });
assert.deepStrictEqual(NET.cleanInput({ m: 'x', jc: 1e99, sc: null }), { m: 0, jc: 0, sc: 0, rm: 0 });
const size = JSON.stringify(NET.snapshot(host, 1, 1, null)).length;
console.log(`OK – ${applied} snapshots applied, ${events} events, max position error ${maxDiff.toFixed(3)}px, snapshot ${size} bytes`);
