// Scraps and shootout bookkeeping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIGHT, fightAI, newFight, stepFight, type FightState } from '../src/sim/fight.ts';
import { newShootout, recordAttempt, shootoutWinner } from '../src/sim/shootout.ts';
import { NO_INPUT, type GameEvent, type Input } from '../src/sim/state.ts';

const IDLE: Input = NO_INPUT;
const JAB: Input = { x: 0, y: 0, a: true, b: false };
const HOLD_B: Input = { x: 0, y: 0, a: false, b: true };
const GUARD: Input = { x: 0, y: 1, a: false, b: false };
const LEAN: Input = { x: 0, y: -1, a: false, b: false };

function brawl(): FightState {
  const fs = newFight({ id: 0, grit: 3 }, { id: 3, grit: 3 });
  fs.phase = 'brawl';
  fs.timer = 0;
  return fs;
}

function run(fs: FightState, frames: number, a: (f: number) => Input, b: (f: number) => Input) {
  const ev: GameEvent[] = [];
  for (let f = 0; f < frames; f++) stepFight(fs, [a(f), b(f)], ev, 60);
  return ev;
}

test('a jab lands after its wind-up and costs balance', () => {
  const fs = brawl();
  run(fs, FIGHT.jabWindup + 2, (f) => (f === 0 ? JAB : IDLE), () => IDLE);
  assert.ok(fs.f[1].balance < 100 && fs.f[1].balance > 90, `balance ${fs.f[1].balance}`);
  assert.equal(fs.f[0].balance, 100);
});

test('covering up cuts jab damage', () => {
  const open = brawl();
  run(open, 20, (f) => (f === 0 ? JAB : IDLE), () => IDLE);
  const covered = brawl();
  run(covered, 20, (f) => (f === 0 ? JAB : IDLE), () => GUARD);
  assert.ok(100 - covered.f[1].balance < (100 - open.f[1].balance) / 2);
});

test('leaning back makes a haymaker miss and staggers the thrower', () => {
  const fs = brawl();
  // Wind up for 20 frames, release; the defender leans just before the swing lands.
  const atk = (f: number) => (f < 20 ? HOLD_B : IDLE);
  const def = (f: number) => (f === 22 ? LEAN : IDLE);
  const ev = run(fs, 20 + FIGHT.haySwing + 2, atk, def);
  assert.equal(fs.f[1].balance, 100);
  assert.equal(fs.f[0].action, 'stagger');
  assert.ok(ev.some((e) => e.type === 'punch' && !e.landed));
});

test('someone who runs out of balance goes down and loses', () => {
  const fs = brawl();
  run(fs, 3000, (f) => (f % 20 === 0 ? JAB : IDLE), () => IDLE);
  assert.equal(fs.phase, 'over');
  assert.equal(fs.winner, 0);
  assert.equal(fs.f[1].action, 'down');
});

test('a scrap nobody wins on balance is broken up at the time limit', () => {
  const fs = brawl();
  run(fs, FIGHT.maxFrames + 5, () => IDLE, () => IDLE);
  assert.equal(fs.phase, 'over');
  assert.equal(fs.winner, -1);
});

test('CPU scraps last a watchable length and either side can win', () => {
  const rng = { seed: 77 };
  let total = 0;
  const wins = [0, 0, 0];
  const n = 200;
  for (let i = 0; i < n; i++) {
    const fs = brawl();
    let f = 0;
    while (fs.phase === 'brawl') {
      stepFight(fs, [fightAI(fs, 0, rng, 0.5), fightAI(fs, 1, rng, 0.5)], [], 60);
      f++;
    }
    total += f;
    wins[fs.winner + 1]++;
  }
  const avg = total / n / 60;
  assert.ok(avg > 4 && avg < 14, `average scrap ${avg.toFixed(1)} s`);
  assert.ok(wins[1] > n * 0.3 && wins[2] > n * 0.3, `wins ${wins}`);
});

test('shootout: decided early once a side cannot catch up', () => {
  const so = newShootout(0);
  recordAttempt(so, true); // A 1
  recordAttempt(so, false); // B 0
  recordAttempt(so, true); // A 2
  recordAttempt(so, false); // B 0, one attempt left and down by two
  assert.equal(shootoutWinner(so), 0);
});

test('shootout: tied after three rounds goes to sudden death', () => {
  const so = newShootout(1);
  for (let i = 0; i < 6; i++) recordAttempt(so, i % 2 === 0);
  // Team 1 shot first and scored each time, team 0 missed: decided after round 2.
  assert.equal(shootoutWinner(so), 1);

  const tie = newShootout(0);
  for (let i = 0; i < 6; i++) recordAttempt(tie, true);
  assert.equal(shootoutWinner(tie), -1);
  recordAttempt(tie, true);
  assert.equal(shootoutWinner(tie), -1, 'second shooter still to come');
  recordAttempt(tie, false);
  assert.equal(shootoutWinner(tie), 0);
  assert.equal(tie.shooter, 0, 'first team leads off every round');
});
