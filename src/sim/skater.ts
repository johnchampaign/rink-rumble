// Skater movement, collisions and puck actions (shoot, pass, check, poke).
import { CHECK, CPU, MOMENTUM, RINK, SHOT, SKATER } from './constants.ts';
import { boardContact, netBoxContact } from './rink.ts';
import { chance, gauss, range } from './rng.ts';
import { addMomentum, attackSign, isHuman, onIce, type GameState, type Input, type Skater } from './state.ts';

export function release(s: GameState, k: Skater | null, vx: number, vy: number, isShot: boolean) {
  const p = s.puck;
  p.owner = -1;
  p.vx = vx;
  p.vy = vy;
  p.touch++;
  p.isShot = isShot;
  p.deadFrames = 0;
  if (k) {
    k.cooldown = SKATER.releaseCooldown;
    k.charge = -1;
    p.lastSkater = k.id;
    p.shotTeam = k.team;
    p.shotFromX = p.x;
  }
}

export function topSpeed(s: GameState, k: Skater): number {
  const def = s.teams[k.team].def;
  let sp = SKATER.baseSpeed + SKATER.speedStep * def.speed;
  if (s.puck.owner === k.id) sp *= SKATER.carryFactor;
  if (k.charge >= 0) sp *= SKATER.chargeFactor;
  if (s.teams[k.team].surge > 0) sp *= MOMENTUM.surgeSpeed;
  return sp;
}

export function moveSkater(s: GameState, k: Skater, inp: Input) {
  if (k.down > 0) {
    k.vx *= 0.94;
    k.vy *= 0.94;
  } else {
    let ix = inp.x;
    let iy = inp.y;
    const im = Math.hypot(ix, iy);
    if (im > 1) {
      ix /= im;
      iy /= im;
    }
    const def = s.teams[k.team].def;
    const acc = SKATER.baseAccel + SKATER.accelStep * def.speed;
    k.vx += ix * acc;
    k.vy += iy * acc;
    if (im < 0.1) {
      k.vx *= SKATER.coast;
      k.vy *= SKATER.coast;
    }
    const limit = k.lunge > 0 ? CHECK.lungeMaxSpeed : topSpeed(s, k);
    const sp = Math.hypot(k.vx, k.vy);
    if (sp > limit) {
      const f = Math.max(limit / sp, SKATER.overspeedDecay);
      k.vx *= f;
      k.vy *= f;
    }
    if (im > 0.2) k.facing = Math.atan2(iy, ix);
    else if (sp > 0.4) k.facing = Math.atan2(k.vy, k.vx);
  }
  k.x += k.vx;
  k.y += k.vy;
  k.stride += Math.hypot(k.vx, k.vy) * 0.12;
  keepOut(k);
}

// Pushes a skater out of the boards and both nets.
export function keepOut(k: Skater) {
  const r = SKATER.radius;
  const c = boardContact(k.x, k.y, r);
  if (c) {
    k.x += c.nx * c.depth;
    k.y += c.ny * c.depth;
    const vn = k.vx * c.nx + k.vy * c.ny;
    if (vn < 0) {
      k.vx -= c.nx * vn * 1.25;
      k.vy -= c.ny * vn * 1.25;
    }
  }
  for (const side of [-1, 1]) {
    const n = netBoxContact(k.x, k.y, r, side);
    if (n) {
      k.x += n.nx * n.depth;
      k.y += n.ny * n.depth;
      const vn = k.vx * n.nx + k.vy * n.ny;
      if (vn < 0) {
        k.vx -= n.nx * vn;
        k.vy -= n.ny * vn;
      }
    }
  }
}

export function collideSkaters(s: GameState) {
  const ks = s.skaters.filter(onIce);
  const min = SKATER.radius * 2;
  for (let i = 0; i < ks.length; i++) {
    for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i];
      const b = ks[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= min || d === 0) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (min - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const imp = rel * 0.65;
        a.vx += nx * imp;
        a.vy += ny * imp;
        b.vx -= nx * imp;
        b.vy -= ny * imp;
      }
    }
  }
}

// One frame of a skater's buttons. aEdge/bEdge are press edges from whoever controls the skater.
export function skaterActions(s: GameState, k: Skater, inp: Input, aEdge: boolean, bEdge: boolean) {
  if (k.cooldown > 0) k.cooldown--;
  if (k.checkCooldown > 0) k.checkCooldown--;
  if (k.down > 0) {
    k.down--;
    k.charge = -1;
    k.lunge = 0;
    return;
  }
  if (s.puck.owner === k.id) {
    if (k.charge >= 0) {
      if (inp.b) k.charge = Math.min(SHOT.chargeMax, k.charge + 1);
      else shoot(s, k, inp);
    } else if (bEdge) k.charge = 0;
    else if (aEdge) pass(s, k, inp);
  } else {
    k.charge = -1;
    if (aEdge && k.lunge === 0 && k.checkCooldown === 0) startCheck(s, k, inp);
  }
  if (k.lunge > 0) {
    k.lunge--;
    checkContacts(s, k);
  }
}

function aimNoise(s: GameState, k: Skater): number {
  const def = s.teams[k.team].def;
  let n = SHOT.aimNoiseBase - SHOT.aimNoiseStep * def.shooting;
  if (!isHuman(s, k.team)) n += CPU[s.options.cpuSkill].aimExtra;
  return Math.max(0.01, n);
}

export function shoot(s: GameState, k: Skater, inp: Input) {
  const p = s.puck;
  const def = s.teams[k.team].def;
  const charge = k.charge;
  const slap = charge >= SHOT.wristUnder;
  let power = slap
    ? SHOT.wrist + (SHOT.slap - SHOT.wrist) * ((charge - SHOT.wristUnder) / (SHOT.chargeMax - SHOT.wristUnder))
    : SHOT.wrist;
  power *= 0.94 + def.shooting * 0.03;
  if (s.teams[k.team].surge > 0) power *= MOMENTUM.surgeShot;

  const sgn = attackSign(s, k.team);
  const netX = sgn * RINK.goalX;
  const tx = netX - p.x;
  const ty = -p.y;
  const tl = Math.hypot(tx, ty) || 1;
  const im = Math.hypot(inp.x, inp.y);
  let aim: number;
  let atNet = true;
  if (im > 0.3 && (inp.x * tx + inp.y * ty) / (im * tl) < -0.3) {
    // Stick pointed away from the net: a clearing shot in that direction.
    aim = Math.atan2(inp.y, inp.x);
    atNet = false;
  } else {
    const edge = RINK.netHalfW - 4;
    let aimY: number;
    if (Math.abs(inp.y) > 0.3) aimY = Math.sign(inp.y) * edge;
    else {
      // No aim given: go for the side the goalie is leaving open.
      const g = s.goalies[1 - k.team];
      aimY = g.y > 1 ? -edge : g.y < -1 ? edge : range(s.rng, -edge, edge);
    }
    aim = Math.atan2(aimY - p.y, netX - p.x);
  }
  aim += gauss(s.rng) * aimNoise(s, k) * (slap ? SHOT.slapNoiseFactor : 1);
  release(s, k, Math.cos(aim) * power + k.vx * 0.25, Math.sin(aim) * power + k.vy * 0.25, atNet);
  s.events.push({ type: 'shot', team: k.team, power });
}

// Is any opponent of `team` within `w` of the segment a→b?
export function laneBlocked(s: GameState, team: number, ax: number, ay: number, bx: number, by: number, w: number) {
  const ex = bx - ax;
  const ey = by - ay;
  const len2 = ex * ex + ey * ey || 1;
  for (const o of s.skaters) {
    if (o.team === team || !onIce(o) || o.down > 0) continue;
    const t = Math.max(0, Math.min(1, ((o.x - ax) * ex + (o.y - ay) * ey) / len2));
    if (Math.hypot(o.x - (ax + ex * t), o.y - (ay + ey * t)) < w) return true;
  }
  return false;
}

export function pass(s: GameState, k: Skater, inp: Input) {
  const p = s.puck;
  const sgn = attackSign(s, k.team);
  const im = Math.hypot(inp.x, inp.y);
  const dx = im > 0.3 ? inp.x / im : sgn;
  const dy = im > 0.3 ? inp.y / im : 0;
  let best: Skater | null = null;
  let bestScore = -Infinity;
  for (const m of s.skaters) {
    if (m === k || m.team !== k.team || !onIce(m) || m.down > 0) continue;
    const vx = m.x - k.x;
    const vy = m.y - k.y;
    const d = Math.hypot(vx, vy) || 1;
    let score = (vx * dx + vy * dy) / d - d / 400;
    if (laneBlocked(s, k.team, p.x, p.y, m.x, m.y, 11)) score -= 0.6;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  let vx: number;
  let vy: number;
  if (best && bestScore > -0.4) {
    const tx = Math.max(-RINK.halfW + 20, Math.min(RINK.halfW - 20, best.x + best.vx * SHOT.passLead));
    const ty = Math.max(-RINK.halfH + 20, Math.min(RINK.halfH - 20, best.y + best.vy * SHOT.passLead));
    const d = Math.hypot(tx - p.x, ty - p.y) || 1;
    const speed = d < 70 ? SHOT.pass * 0.8 : SHOT.pass;
    vx = ((tx - p.x) / d) * speed;
    vy = ((ty - p.y) / d) * speed;
  } else {
    vx = dx * SHOT.pass;
    vy = dy * SHOT.pass;
  }
  release(s, k, vx, vy, false);
  s.events.push({ type: 'pass', team: k.team });
}

function startCheck(s: GameState, k: Skater, inp: Input) {
  const im = Math.hypot(inp.x, inp.y);
  const dx = im > 0.3 ? inp.x / im : Math.cos(k.facing);
  const dy = im > 0.3 ? inp.y / im : Math.sin(k.facing);
  k.vx += dx * CHECK.lungeBoost;
  k.vy += dy * CHECK.lungeBoost;
  k.lunge = CHECK.lungeFrames;
  k.checkCooldown = CHECK.cooldown;

  // A stick near the puck carrier is a poke check.
  const p = s.puck;
  if (p.owner >= 0 && p.owner < 6) {
    const c = s.skaters[p.owner];
    if (c.team !== k.team && Math.hypot(p.x - k.x, p.y - k.y) < CHECK.pokeRange) {
      const def = s.teams[k.team].def;
      if (chance(s.rng, CHECK.pokeChance + CHECK.pokeStep * def.checking)) {
        const a = Math.atan2(p.y - k.y, p.x - k.x) + range(s.rng, -0.8, 0.8);
        release(s, null, Math.cos(a) * 2.2 + c.vx * 0.5, Math.sin(a) * 2.2 + c.vy * 0.5, false);
        c.cooldown = 20;
        p.lastSkater = k.id;
        s.events.push({ type: 'poke', team: k.team });
      }
    }
  }
}

function checkContacts(s: GameState, k: Skater) {
  for (const o of s.skaters) {
    if (o.team === k.team || !onIce(o) || o.down > 0) continue;
    const dx = o.x - k.x;
    const dy = o.y - k.y;
    const d = Math.hypot(dx, dy);
    if (d > SKATER.radius * 2 + 3 || d === 0) continue;
    const nx = dx / d;
    const ny = dy / d;
    const rel = (k.vx - o.vx) * nx + (k.vy - o.vy) * ny;
    const kd = s.teams[k.team].def;
    const od = s.teams[o.team].def;
    let power = Math.max(0, rel) * (CHECK.hitPower + CHECK.hitStep * kd.checking);
    if (s.teams[k.team].surge > 0) power *= MOMENTUM.surgeHit;
    const carrying = s.puck.owner === o.id;
    const stand = CHECK.standBase + CHECK.standStep * od.checking - (carrying ? CHECK.carrierPenalty : 0);
    const knock = power > stand * range(s.rng, 0.75, 1.25);
    o.vx += nx * power * 0.8;
    o.vy += ny * power * 0.8;
    k.vx *= 0.5;
    k.vy *= 0.5;
    k.lunge = 0;
    if (power > CHECK.hardHit) s.stats.hits++;
    if (knock) {
      o.down = SKATER.downFrames;
      o.charge = -1;
      s.stats.knockdowns++;
    }
    if (carrying && (knock || chance(s.rng, 0.35))) {
      release(s, null, o.vx + nx * 1.2 + range(s.rng, -0.6, 0.6), o.vy + ny * 1.2 + range(s.rng, -0.6, 0.6), false);
      o.cooldown = 24;
    }
    s.events.push({ type: 'hit', team: k.team, knockdown: knock });
    if (knock || power > CHECK.hardHit) addMomentum(s, k.team, MOMENTUM.hit);

    if (power > CHECK.hardHit) {
      const home = k.team === 0 ? k : o;
      const away = k.team === 0 ? o : k;
      const idx = home.slot * 3 + away.slot;
      s.heat[idx] += CHECK.heatPerHit + CHECK.heatGrit * od.grit;
      const grit = kd.grit + od.grit;
      const boil = Math.min(1.5, s.heat[idx] / CHECK.heatToFight) ** 2;
      if (
        s.options.fights && s.framesSinceFight > CHECK.fightGap &&
        chance(s.rng, CHECK.fightChance * boil + CHECK.fightGrit * grit)
      ) {
        s.pendingFight = [k.id, o.id];
      }
    }
    return;
  }
}

// Gliding to a stop while play is dead.
export function coastSkater(k: Skater) {
  k.vx *= 0.96;
  k.vy *= 0.96;
  k.x += k.vx;
  k.y += k.vy;
  keepOut(k);
}
