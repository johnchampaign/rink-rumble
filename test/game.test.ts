// Whole-match behaviour: controls, rules, determinism and complete CPU games.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FPS, PENALTY, RINK } from '../src/sim/constants.ts';
import { setupFaceoff, step } from '../src/sim/game.ts';
import { NO_INPUT, newGame, type GameEvent, type GameState, type Input } from '../src/sim/state.ts';

function inPlay(opts = {}): GameState {
  const s = newGame({ seed: 5, ...opts });
  while (s.phase !== 'play') step(s, [NO_INPUT, null]);
  return s;
}

function run(s: GameState, frames: number, inp: (f: number) => Input | null, inp2: (f: number) => Input | null = () => null) {
  const events: GameEvent[] = [];
  for (let f = 0; f < frames; f++) {
    step(s, [inp(f), inp2(f)]);
    events.push(...s.events);
  }
  return events;
}

// Hands the puck to a skater standing alone somewhere.
function givePuck(s: GameState, id: number, x: number, y: number) {
  const k = s.skaters[id];
  Object.assign(k, { x, y, vx: 0, vy: 0, facing: 0, cooldown: 0, down: 0 });
  s.puck.owner = id;
  s.puck.x = x + 9;
  s.puck.y = y;
}

test('the controlled skater follows the stick', () => {
  const s = inPlay();
  const id = s.active[0];
  for (const k of s.skaters) if (k.id !== id) k.benched = true; // nobody to take the puck away
  const x0 = s.skaters[id].x;
  run(s, 60, () => ({ x: 0, y: 1, a: false, b: false }));
  const k = s.skaters[s.active[0]];
  assert.equal(k.id, id);
  assert.ok(k.y > 30, `moved down to ${k.y}`);
  assert.ok(Math.abs(k.x - x0) < 40);
});

test('tap shoot is a wrister, a held shoot is a harder slapper', () => {
  const powers: number[] = [];
  for (const hold of [1, 30]) {
    const s = inPlay();
    for (const k of s.skaters) if (k.team === 1) k.benched = true;
    givePuck(s, 0, 100, 0);
    s.active[0] = 0;
    const ev = run(s, hold + 2, (f) => ({ x: 0, y: 0, a: false, b: f < hold }));
    const shot = ev.find((e) => e.type === 'shot');
    assert.ok(shot && shot.type === 'shot', `shot after holding ${hold}`);
    powers.push(shot.power);
  }
  assert.ok(powers[1] > powers[0] + 1, `wrist ${powers[0]} slap ${powers[1]}`);
});

test('pass goes to the teammate the stick points at', () => {
  const s = inPlay();
  for (const k of s.skaters) if (k.team === 1) k.benched = true;
  givePuck(s, 0, 0, 0);
  Object.assign(s.skaters[1], { x: 0, y: -80, vx: 0, vy: 0 });
  Object.assign(s.skaters[2], { x: 0, y: 80, vx: 0, vy: 0 });
  s.active[0] = 0;
  run(s, 1, () => ({ x: 0, y: 1, a: true, b: false }));
  let got = -1;
  for (let f = 0; f < 90 && got < 0; f++) {
    step(s, [NO_INPUT, null]);
    if (s.puck.owner >= 0 && s.puck.owner !== 0) got = s.puck.owner;
  }
  assert.equal(got, 2);
  step(s, [NO_INPUT, null]);
  assert.equal(s.active[0], 2, 'control follows the puck');
});

test('a hard check knocks a standing carrier over and spills the puck', () => {
  const s = inPlay({ humans: [true, true] });
  for (const k of s.skaters) if (k.id !== 0 && k.id !== 3) k.benched = true;
  givePuck(s, 3, 0, 0);
  Object.assign(s.skaters[0], { x: -40, y: 0, vx: 2.2, vy: 0, facing: 0 });
  s.active = [0, 3];
  const ev = run(s, 25, (f) => ({ x: 1, y: 0, a: f === 10, b: false }), () => NO_INPUT);
  assert.ok(ev.some((e) => e.type === 'hit' && e.knockdown), 'knockdown');
  assert.ok(s.skaters[3].down > 0);
  assert.notEqual(s.puck.owner, 3);
});

test('a goal releases the scrap loser from the box', () => {
  const s = inPlay({ humans: [false, false] });
  const loser = s.skaters[4];
  loser.penalty = PENALTY.loser;
  loser.releasable = true;
  const winner = s.skaters[1];
  winner.penalty = PENALTY.winner;
  // Team 0 attacks the net on side −teams[0].side.
  const side = -s.teams[0].side;
  for (const g of s.goalies) g.y = 100;
  Object.assign(s.puck, { owner: -1, x: side * (RINK.goalX - 30), y: 0, vx: side * 6, vy: 0, isShot: true, shotTeam: 0 });
  for (const k of s.skaters) k.benched = true;
  let goal = false;
  for (let f = 0; f < 30 && !goal; f++) {
    step(s, [null, null]);
    goal = s.events.some((e) => e.type === 'goal');
  }
  assert.ok(goal);
  assert.equal(s.teams[0].score, 1);
  assert.ok(loser.penalty <= 1, 'loser freed');
  assert.ok(winner.penalty > 0, 'the scrap winner on the scoring team still sits');
});

test('the same seed and inputs replay identically', () => {
  const play = () => {
    const s = newGame({ seed: 1234, humans: [true, false] });
    for (let f = 0; f < 6000; f++) {
      const t = f % 240;
      step(s, [{ x: Math.sin(f / 50), y: Math.cos(f / 70), a: t === 30, b: t > 100 && t < 120 }, null]);
    }
    return JSON.stringify(s);
  };
  assert.equal(play(), play());
});

test('a tie after regulation goes to a shootout that produces a winner', () => {
  const s = newGame({ seed: 9, humans: [false, false] });
  s.period = 3;
  s.clock = 2;
  setupFaceoff(s);
  s.teams[0].score = s.teams[1].score = 2;
  let sawShootout = false;
  for (let f = 0; f < 60 * FPS && s.phase !== 'final'; f++) {
    // Keep it tied until the horn.
    if (s.phase === 'goal') s.teams[0].score = s.teams[1].score = 2;
    step(s, [null, null]);
    if (s.phase === 'shootout') sawShootout = true;
  }
  assert.ok(sawShootout);
  assert.equal(s.phase, 'final');
  assert.ok(s.teams[s.winner].score === 3 && s.teams[1 - s.winner].score === 2);
});

test('complete CPU games finish with sane numbers', () => {
  for (const seed of [1, 2, 3, 4]) {
    const s = newGame({ seed, humans: [false, false], periodSeconds: 120, teams: [seed % 6, (seed + 3) % 6] });
    let f = 0;
    while (s.phase !== 'final' && f < 40 * 60 * FPS) {
      step(s, [null, null]);
      f++;
      if (f % 97 === 0) {
        for (const k of s.skaters) assert.ok(Number.isFinite(k.x + k.y + k.vx + k.vy), `skater ${k.id} NaN`);
        assert.ok(Number.isFinite(s.puck.x + s.puck.y), 'puck NaN');
      }
    }
    assert.equal(s.phase, 'final', `seed ${seed} finished`);
    assert.ok(s.winner === 0 || s.winner === 1);
    assert.notEqual(s.teams[0].score, s.teams[1].score);
    const total = s.teams[0].score + s.teams[1].score;
    assert.ok(total < 25, `${total} goals`);
  }
});
