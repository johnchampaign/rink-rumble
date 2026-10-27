// Rink geometry and puck physics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUCK, RINK, SKATER } from '../src/sim/constants.ts';
import { boardContact, crossedGoalLine } from '../src/sim/rink.ts';
import { stepPuck } from '../src/sim/puck.ts';
import { newGame, type GameState } from '../src/sim/state.ts';
import { next } from '../src/sim/rng.ts';

function emptyIce(seed = 3): GameState {
  const s = newGame({ seed, humans: [false, false] });
  for (const k of s.skaters) k.benched = true;
  for (const g of s.goalies) g.x = 1000; // out of the way
  s.phase = 'play';
  return s;
}

test('boards: no contact at centre ice, inward normals at the walls and corners', () => {
  assert.equal(boardContact(0, 0, 5), null);
  const right = boardContact(RINK.halfW, 0, 5)!;
  assert.ok(Math.abs(right.nx + 1) < 1e-9 && Math.abs(right.ny) < 1e-9);
  assert.ok(Math.abs(right.depth - 5) < 1e-9);
  const corner = boardContact(RINK.halfW, RINK.halfH, 5)!;
  assert.ok(corner.nx < -0.5 && corner.ny < -0.5, 'corner pushes back toward centre');
  // Just inside the straight part of the boards is fine.
  assert.equal(boardContact(0, RINK.halfH - 6, 5), null);
});

test('goal line: only a crossing into the mouth counts', () => {
  assert.ok(crossedGoalLine(1, RINK.goalX - 3, RINK.goalX + 1, 0, 2));
  assert.ok(!crossedGoalLine(1, RINK.goalX + 1, RINK.goalX - 3, 0, 2), 'coming out of the net');
  assert.ok(!crossedGoalLine(1, RINK.goalX - 3, RINK.goalX + 1, RINK.netHalfW + 1, 2), 'wide of the post');
  assert.ok(crossedGoalLine(-1, -RINK.goalX + 3, -RINK.goalX - 1, 5, 2));
});

test('a loose puck never leaves the rink, whatever it is hit with', () => {
  const s = emptyIce();
  const p = s.puck;
  for (let trial = 0; trial < 200; trial++) {
    p.x = (next(s.rng) - 0.5) * 400;
    p.y = (next(s.rng) - 0.5) * 200;
    const a = next(s.rng) * Math.PI * 2;
    const v = 2 + next(s.rng) * 8;
    p.vx = Math.cos(a) * v;
    p.vy = Math.sin(a) * v;
    p.owner = -1;
    for (let f = 0; f < 400; f++) {
      const r = stepPuck(s);
      if (r.goalSide) break;
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.equal(boardContact(p.x, p.y, PUCK.radius - 0.01), null, `escaped at ${p.x},${p.y}`);
    }
  }
});

test('a shot at an empty net goes in; one at the back of the net does not', () => {
  const s = emptyIce();
  const p = s.puck;
  Object.assign(p, { x: RINK.goalX - 80, y: 4, vx: 6, vy: 0, owner: -1 });
  let side = 0;
  for (let f = 0; f < 60 && !side; f++) side = stepPuck(s).goalSide;
  assert.equal(side, 1);

  Object.assign(p, { x: RINK.goalX + 40, y: 0, vx: -6, vy: 0, owner: -1 });
  side = 0;
  for (let f = 0; f < 60 && !side; f++) side = stepPuck(s).goalSide;
  assert.equal(side, 0, 'bounced off the back of the cage');
  assert.ok(p.x > RINK.goalX + RINK.netDepth, 'stayed behind the net');
});

test('a carried puck cannot be skated into the net', () => {
  const s = emptyIce();
  const k = s.skaters[0];
  k.benched = false;
  Object.assign(k, { x: RINK.goalX - SKATER.radius - 1, y: 0, facing: 0 });
  s.puck.owner = 0;
  stepPuck(s);
  assert.ok(s.puck.x <= RINK.goalX - PUCK.radius + 1e-6, `puck at ${s.puck.x}`);
});
