/* Headless test of the 3-2-1 before a match: nothing can be played while it runs, then the normal serve follows. */
const assert = require('assert');
const VB = require('../engine.js');
const NET = require('../net.js');
const { Sim, C } = VB;

const spec = (color, label) => ({ controller: 'human', color, label });
const mk = o => new Sim(Object.assign({ teams: [[spec('#3aa0ff', 'A')], [spec('#ff5a55', 'B')]], level: 'normal', target: 5, seed: 3 }, o));

// without the option nothing changes (menu demo, old behaviour: the hanging ball can be played right away)
const plain = mk();
assert.strictEqual(plain.countdown, 0);

// with the countdown: held keys, jumping and special do nothing, the ball hangs, the score and state stay put
const g = mk({ countdown: C.COUNTDOWN });
const x0 = g.blobs.map(b => b.x), by = g.ball.y, counts = [];
let goFrame = -1;
for (let f = 0; f < C.COUNTDOWN; f++) {
  g.blobs.forEach(b => { b.input.left = true; b.input.jump = true; b.input.special = true; });
  g.step();
  for (const e of g.events) { if (e.type === 'count') counts.push(e.n); if (e.type === 'go') goFrame = f; }
  assert.strictEqual(g.state, 'serve', 'still serving at frame ' + f);
  assert.strictEqual(g.ball.y, by, 'ball hangs');
  assert.strictEqual(g.rallyHits, 0);
  assert.strictEqual(g.timer, C.SERVE_DELAY, 'serve timer waits');
  g.blobs.forEach((b, i) => { assert.strictEqual(b.x, x0[i], 'figure ' + i + ' stands still'); assert.ok(b.onGround, 'figure on the ground'); });
}
assert.deepStrictEqual(counts, [3, 2, 1]);
assert.strictEqual(goFrame, C.COUNTDOWN - 1);
assert.strictEqual(g.countdown, 0);
assert.strictEqual(g.message, 'Go!');

// afterwards the normal serve phase: now a jump is possible and the serve timer runs
g.blobs[0].input.jump = true; g.step();
assert.ok(!g.blobs[0].onGround, 'can jump after Go');
assert.ok(g.timer < C.SERVE_DELAY);

// an intro message (Throne) stays visible for the whole countdown
const t = mk({ countdown: C.COUNTDOWN }); t.say('Round 1/6', 150);
for (let f = 0; f < C.COUNTDOWN - 1; f++) t.step();
assert.strictEqual(t.message, 'Round 1/6'); assert.ok(t.messageTimer >= 140);

// online: the guest sees the countdown through the snapshot
const host = mk({ countdown: C.COUNTDOWN }), guest = mk();
for (let f = 0; f < 61; f++) host.step();   // the 61st step emits the "2"
NET.applySnapshot(guest, JSON.parse(JSON.stringify(NET.snapshot(host, 1, 1, null))));
assert.strictEqual(guest.countdown, host.countdown); assert.ok(guest.countdown > 0);
assert.ok(guest.events.some(e => e.type === 'count'));
console.log('countdown test ok');
