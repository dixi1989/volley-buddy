/* Headless test of ranged hits on players (v61): stun, push, immunity, one effect per volley, teleport for the black hole cannon. */
const assert = require('assert');
const VB = require('../engine.js');
const { Sim } = VB;
const mk = (a, b) => new Sim({ teams: [[{ controller: 'human', color: '#3aa0ff', label: 'A', style: a }], [{ controller: 'human', color: '#ff5a55', label: 'B', style: b }]], level: 'normal', target: 11, seed: 3, fight: true });

for (const [w, style] of [['revolver', 'cowboy'], ['bouquet', 'bruiser'], ['pickle', 'mcrib'], ['hole', 'gagari']]) {
  const sim = mk(style, 'ninja'), foe = sim.blobs[1];
  sim.state = 'play'; sim.ball.x = 400; sim.ball.y = 60; sim.ball.vx = sim.ball.vy = 0;
  sim.volley = 5;
  sim.shots.push({ x: foe.x - 20, y: foe.y, vx: 10, vy: 0, team: 0, life: 40, r: 10, k: w === 'hole' ? 4 : 1, fx: 'speed', vol: 5, w });
  const x0 = foe.x; foe.input.left = true;
  sim.step();
  assert(foe.stun > 0, w + ': opponent is stunned');
  assert(sim.events.some(e => e.type === 'stun'), w + ': stun event');
  assert(sim.shots.length === 0, w + ': shot is used up');
  const imm = foe.imm; assert(imm > foe.stun, w + ': immunity longer than the stun');
  for (let i = 0; i < 5; i++) sim.step();
  if (w === 'hole') assert(foe.x !== x0, 'black hole teleports the hero');
  else assert(foe.x > x0, w + ': pushed away from the shooter (and holding left did nothing)');
  // immune: a second shot of another volley does not stun again
  const st = foe.stun; sim.shots.push({ x: foe.x - 20, y: foe.y, vx: 10, vy: 0, team: 0, life: 40, r: 10, k: 1, fx: 'speed', vol: 6, w }); sim.step();
  assert(foe.stun <= st, w + ': no chain stun');
  for (let i = 0; i < 80; i++) sim.step();
  assert(foe.stun === 0, w + ': stun ends');
}
// own team and the shooter are never hit
const sim = mk('cowboy', 'ninja'); sim.state = 'play'; sim.ball.x = 400; sim.ball.y = 60; sim.ball.vx = sim.ball.vy = 0;
sim.shots.push({ x: sim.blobs[0].x + 5, y: sim.blobs[0].y, vx: 10, vy: 0, team: 0, life: 40, r: 10, k: 1, fx: 'speed', vol: 9, w: 'revolver' }); sim.step();
assert(sim.blobs[0].stun === 0, 'shooter is not hit');
console.log('OK – ranged hits on players: stun, push, immunity, teleport');
