// The match: phases, clock, faceoffs, goals, scraps, the penalty box and the shootout.
// `step` is the only entry point that advances time.
import { CHECK, CPU, FPS, GOALIE, MOMENTUM, PENALTY, PHASE, RINK } from './constants.ts';
import { fightAI, newFight, stepFight } from './fight.ts';
import { skaterAI } from './ai.ts';
import { stepGoalie } from './goalie.ts';
import { settleInNet, stepPuck } from './puck.ts';
import { chance, range } from './rng.ts';
import { newShootout, recordAttempt, shootoutWinner } from './shootout.ts';
import { coastSkater, collideSkaters, keepOut, moveSkater, skaterActions } from './skater.ts';
import {
  NO_INPUT, addMomentum, attackSign, isHuman, onIce, type GameState, type Input, type Skater,
} from './state.ts';

export function step(s: GameState, inputs: (Input | null)[]) {
  s.events = [];
  if (s.frame === 0) setupFaceoff(s); // opening faceoff
  s.frame++;
  const ins = [inputs[0] ?? NO_INPUT, inputs[1] ?? NO_INPUT];
  switch (s.phase) {
    case 'faceoff':
      if (--s.phaseTimer <= 0) dropPuck(s);
      break;
    case 'play':
      stepPlay(s, ins);
      break;
    case 'goal':
      for (const k of s.skaters) if (onIce(k)) coastSkater(k);
      settleInNet(s, s.puck.x > 0 ? 1 : -1);
      if (--s.phaseTimer <= 0) setupFaceoff(s);
      break;
    case 'fight':
      stepFightPhase(s, ins);
      break;
    case 'intermission':
      if (--s.phaseTimer <= 0) nextPeriod(s);
      break;
    case 'shootout':
      stepShootout(s, ins);
      break;
    case 'final':
      for (const k of s.skaters) if (onIce(k)) coastSkater(k);
      break;
  }
  s.prevInput = ins;
}

// ---- Faceoffs and restarts ------------------------------------------------------------

const FACEOFF_SPOTS = [
  [14, 0],
  [45, -55],
  [95, 45],
];

export function setupFaceoff(s: GameState) {
  for (const k of s.skaters) {
    k.vx = k.vy = 0;
    k.down = k.lunge = k.cooldown = 0;
    k.charge = -1;
    if (!onIce(k)) continue;
    const sgn = attackSign(s, k.team);
    const [fx, fy] = FACEOFF_SPOTS[k.slot];
    k.x = -sgn * fx;
    k.y = k.team === 0 ? fy : -fy;
    k.facing = sgn > 0 ? 0 : Math.PI;
    k.aiTx = k.aiTy = 0;
  }
  // Whoever is nearest the dot takes the draw (the centre may be in the box).
  for (const t of [0, 1]) {
    const team = s.skaters.filter((k) => k.team === t && onIce(k));
    if (team.length && !team.some((k) => k.slot === 0)) {
      team[0].x = -attackSign(s, t) * FACEOFF_SPOTS[0][0];
      team[0].y = 0;
    }
  }
  for (const g of s.goalies) {
    const side = s.teams[g.team].side;
    g.x = side * (RINK.goalX - GOALIE.depthNear);
    g.y = 0;
    g.holding = g.dive = g.diveCooldown = 0;
    g.lastTouch = -1;
  }
  const p = s.puck;
  Object.assign(p, { x: 0, y: 0, vx: 0, vy: 0, owner: -1, isShot: false, deadFrames: 0, lastSkater: -1 });
  s.phase = 'faceoff';
  s.phaseTimer = PHASE.faceoffHold;
  s.events.push({ type: 'whistle' });
  for (const t of [0, 1]) if (isHuman(s, t)) s.active[t] = nearestToPuck(s, t, -1);
}

function dropPuck(s: GameState) {
  const p = s.puck;
  p.vx = range(s.rng, -0.9, 0.9);
  p.vy = range(s.rng, -0.7, 0.7);
  p.touch++;
  s.phase = 'play';
  s.events.push({ type: 'drop' });
}

function nearestToPuck(s: GameState, team: number, exclude: number): number {
  let best = -1;
  let bd = Infinity;
  for (const k of s.skaters) {
    if (k.team !== team || !onIce(k) || k.id === exclude) continue;
    const d = Math.hypot(k.x - s.puck.x, k.y - s.puck.y) + (k.down > 0 ? 200 : 0);
    if (d < bd) {
      bd = d;
      best = k.id;
    }
  }
  return best;
}

// ---- Regular play -----------------------------------------------------------------

// Which skater a human controls: always the puck carrier on offence; on defence the B button
// switches to whoever is nearest the puck, and losing the puck switches automatically.
function updateActive(s: GameState, t: number, inp: Input) {
  const owner = s.puck.owner;
  const cur = s.active[t];
  const ownerTeam = owner >= 0 && owner < 6 ? s.skaters[owner].team : -1;
  if (ownerTeam === t) {
    s.active[t] = owner;
    return;
  }
  const curOk = cur >= 0 && onIce(s.skaters[cur]);
  const bEdge = inp.b && !s.prevInput[t].b;
  const prev = s.prevOwner;
  const lost = prev >= 0 && prev < 6 && s.skaters[prev].team === t && owner !== prev;
  const stolen = ownerTeam === 1 - t && owner !== prev;
  let n = -1;
  if (!curOk || lost || stolen) n = nearestToPuck(s, t, -1);
  else if (bEdge) n = nearestToPuck(s, t, cur);
  if (n >= 0) s.active[t] = n;
}

function returnFromBox(s: GameState, k: Skater) {
  k.x = (k.team === 0 ? -1 : 1) * 40;
  k.y = -RINK.halfH + 12;
  k.vx = 0;
  k.vy = 1;
  k.releasable = false;
}

function stepPlay(s: GameState, ins: Input[]) {
  s.clock--;
  s.framesSinceFight++;
  for (let i = 0; i < 9; i++) s.heat[i] = Math.max(0, s.heat[i] - CHECK.heatDecay);
  for (const k of s.skaters) {
    if (k.penalty > 0 && --k.penalty === 0) returnFromBox(s, k);
  }
  for (const t of [0, 1]) {
    const tm = s.teams[t];
    if (tm.surge > 0) tm.surge--;
    else if (s.options.surge && tm.momentum >= 100) {
      tm.surge = MOMENTUM.surgeFrames;
      tm.momentum = 0;
      s.events.push({ type: 'surge', team: t });
    }
    if (isHuman(s, t)) updateActive(s, t, ins[t]);
  }

  for (const k of s.skaters) {
    if (!onIce(k)) continue;
    const human = isHuman(s, k.team) && s.active[k.team] === k.id;
    const inp = human ? ins[k.team] : skaterAI(s, k);
    const aEdge = human ? inp.a && !s.prevInput[k.team].a : inp.a && !k.prevA;
    const bEdge = human ? inp.b && !s.prevInput[k.team].b : inp.b && !k.prevB;
    skaterActions(s, k, inp, aEdge, bEdge);
    moveSkater(s, k, inp);
    k.prevA = inp.a;
    k.prevB = inp.b;
  }
  collideSkaters(s);
  for (const k of s.skaters) if (onIce(k)) collideGoalies(s, k);
  for (const g of s.goalies) stepGoalie(s, g, null);

  const r = stepPuck(s);
  s.prevOwner = s.puck.owner;
  if (r.goalSide !== 0) goal(s, r.goalSide);
  else if (r.dead) {
    s.stats.whistles++;
    setupFaceoff(s);
  } else if (s.pendingFight) startFight(s);
  else if (s.clock <= 0) endPeriod(s);
}

function collideGoalies(s: GameState, k: Skater) {
  for (const g of s.goalies) {
    const dx = k.x - g.x;
    const dy = k.y - g.y;
    const d = Math.hypot(dx, dy);
    const min = GOALIE.radius + 7;
    if (d < min && d > 0) {
      k.x = g.x + (dx / d) * min;
      k.y = g.y + (dy / d) * min;
      const vn = (k.vx * dx + k.vy * dy) / d;
      if (vn < 0) {
        k.vx -= (dx / d) * vn;
        k.vy -= (dy / d) * vn;
      }
      keepOut(k);
    }
  }
}

function teamDefending(s: GameState, side: number): number {
  return s.teams[0].side === side ? 0 : 1;
}

function goal(s: GameState, side: number) {
  const scorer = 1 - teamDefending(s, side);
  if (s.phase === 'shootout') {
    endAttempt(s, true);
    return;
  }
  const p = s.puck;
  const g = s.goalies[1 - scorer];
  if (g.lastTouch !== p.touch) s.teams[scorer].shots++;
  s.teams[scorer].score++;
  addMomentum(s, scorer, MOMENTUM.shot);
  s.lastScorer = p.lastSkater;
  s.events.push({ type: 'goal', team: scorer, scorer: p.lastSkater });
  // A scrap loser's time ends early when the other team scores on the power play.
  const boxed = s.skaters.filter((k) => k.team !== scorer && k.penalty > 0 && k.releasable);
  if (boxed.length) boxed.sort((a, b) => a.penalty - b.penalty)[0].penalty = 1;
  p.owner = -1;
  s.phase = 'goal';
  s.phaseTimer = PHASE.goalCelebration;
}

function endPeriod(s: GameState) {
  s.events.push({ type: 'periodEnd', period: s.period });
  s.phase = 'intermission';
  s.phaseTimer = PHASE.intermission;
}

function nextPeriod(s: GameState) {
  if (s.period < 3) {
    s.period++;
    s.clock = s.options.periodSeconds * FPS;
    for (const t of s.teams) t.side = -t.side;
    setupFaceoff(s);
  } else if (s.teams[0].score === s.teams[1].score) startShootout(s);
  else finish(s, s.teams[0].score > s.teams[1].score ? 0 : 1);
}

function finish(s: GameState, winner: number) {
  s.winner = winner;
  s.phase = 'final';
  s.events.push({ type: 'final', winner });
}

// ---- Scraps ----------------------------------------------------------------------

function startFight(s: GameState) {
  const [a, b] = s.pendingFight!.map((id) => s.skaters[id]);
  s.pendingFight = null;
  const home = a.team === 0 ? a : b;
  const away = a.team === 0 ? b : a;
  s.fight = newFight(
    { id: home.id, grit: s.teams[0].def.grit },
    { id: away.id, grit: s.teams[1].def.grit },
  );
  s.heat[home.slot * 3 + away.slot] = 0;
  s.framesSinceFight = 0;
  s.stats.scraps++;
  s.phase = 'fight';
  s.events.push({ type: 'fightStart' });
  // Drop the puck where it is; play restarts with a faceoff afterwards.
  if (s.puck.owner >= 0) s.puck.owner = -1;
  s.puck.vx = s.puck.vy = 0;
}

function stepFightPhase(s: GameState, ins: Input[]) {
  const fs = s.fight!;
  for (const k of s.skaters) if (onIce(k) && k.id !== fs.f[0].skater && k.id !== fs.f[1].skater) coastSkater(k);
  const fin = [0, 1].map((i) => {
    const t = fs.f[i].team;
    return isHuman(s, t) ? ins[t] : fightAI(fs, i, s.rng, CPU[s.options.cpuSkill].fightRead);
  }) as [Input, Input];
  const wasOver = fs.phase === 'over';
  const done = stepFight(fs, fin, s.events, PHASE.fightOutro);
  if (!wasOver && fs.phase === 'over') s.events.push({ type: 'fightEnd', winner: fs.winner });
  if (!done) return;

  const [k0, k1] = [s.skaters[fs.f[0].skater], s.skaters[fs.f[1].skater]];
  if (fs.winner < 0) {
    k0.penalty = k1.penalty = PENALTY.draw;
  } else {
    const w = fs.winner === 0 ? k0 : k1;
    const l = fs.winner === 0 ? k1 : k0;
    w.penalty = PENALTY.winner;
    l.penalty = PENALTY.loser;
    l.releasable = true;
    addMomentum(s, w.team, MOMENTUM.scrapWin);
  }
  s.fight = null;
  setupFaceoff(s);
}

// ---- Shootout --------------------------------------------------------------------

function startShootout(s: GameState) {
  s.shootout = newShootout(chance(s.rng, 0.5) ? 0 : 1);
  for (const k of s.skaters) {
    k.penalty = 0;
    k.releasable = false;
  }
  s.phase = 'shootout';
  startAttempt(s);
}

function shooterFor(s: GameState, team: number): Skater {
  const n = s.shootout!.results[team].length;
  return s.skaters[team * 3 + (n % 3)];
}

function startAttempt(s: GameState) {
  const so = s.shootout!;
  const t = so.shooter;
  s.teams[t].side = -1;
  s.teams[1 - t].side = 1;
  const shooter = shooterFor(s, t);
  for (const k of s.skaters) {
    k.benched = k !== shooter;
    k.vx = k.vy = 0;
    k.down = k.cooldown = k.lunge = 0;
    k.charge = -1;
  }
  shooter.x = -70;
  shooter.y = 0;
  shooter.facing = 0;
  shooter.aiTx = shooter.aiTy = 0;
  for (const g of s.goalies) {
    const side = s.teams[g.team].side;
    g.x = side * (RINK.goalX - GOALIE.depthNear);
    g.y = 0;
    g.holding = g.dive = g.diveCooldown = 0;
    g.lastTouch = -1;
  }
  const p = s.puck;
  Object.assign(p, { owner: shooter.id, vx: 0, vy: 0, isShot: false, deadFrames: 0, lastSkater: shooter.id });
  p.touch++;
  so.stage = 'attempt';
  so.timer = PHASE.shootoutAttempt;
  s.active[t] = isHuman(s, t) ? shooter.id : -1;
  s.events.push({ type: 'whistle' });
}

function endAttempt(s: GameState, scored: boolean) {
  const so = s.shootout!;
  s.events.push({ type: 'shootoutResult', team: so.shooter, scored });
  if (scored) s.events.push({ type: 'goal', team: so.shooter, scorer: s.puck.lastSkater });
  recordAttempt(so, scored);
  so.stage = 'result';
  so.timer = PHASE.shootoutResult;
  s.puck.owner = -1;
}

function stepShootout(s: GameState, ins: Input[]) {
  const so = s.shootout!;
  const p = s.puck;
  if (so.stage === 'result') {
    for (const k of s.skaters) if (onIce(k)) coastSkater(k);
    if (p.x > RINK.goalX && Math.abs(p.y) < RINK.netHalfW) settleInNet(s, 1);
    else {
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.x += p.vx;
      p.y += p.vy;
    }
    if (--so.timer <= 0) {
      const w = shootoutWinner(so);
      if (w >= 0) {
        s.teams[w].score++;
        finish(s, w);
      } else startAttempt(s);
    }
    return;
  }

  const t = so.shooter;
  const d = 1 - t;
  const shooter = s.skaters.find((k) => onIce(k))!;
  const human = isHuman(s, t);
  const inp = human ? ins[t] : skaterAI(s, shooter);
  const aEdge = human ? inp.a && !s.prevInput[t].a : inp.a && !shooter.prevA;
  const bEdge = human ? inp.b && !s.prevInput[t].b : inp.b && !shooter.prevB;
  skaterActions(s, shooter, inp, aEdge, bEdge);
  moveSkater(s, shooter, inp);
  shooter.prevA = inp.a;
  shooter.prevB = inp.b;
  collideGoalies(s, shooter);
  stepGoalie(s, s.goalies[d], isHuman(s, d) ? ins[d] : null);

  const savesBefore = p.lastSaveFrame;
  const r = stepPuck(s);
  if (r.goalSide === 1) {
    goal(s, 1);
    return;
  }
  const saved = p.lastSaveFrame !== savesBefore || s.goalies[d].holding > 0;
  const loose = p.owner === -1;
  const wide = loose && p.x > RINK.goalX + 2;
  const stalled = loose && Math.hypot(p.vx, p.vy) < 0.4 && p.isShot === false && shooter.cooldown === 0;
  if (saved || wide || stalled || --so.timer <= 0) endAttempt(s, false);
}
