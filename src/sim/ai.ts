// CPU skaters. The AI only produces an Input, exactly like a controller, so it plays by the
// same physics as a human. Skill sets how often it rethinks and how aggressive it is.
import { CPU, RINK, SKATER } from './constants.ts';
import { chance, range } from './rng.ts';
import { laneBlocked, topSpeed } from './skater.ts';
import { GOALIE_OWNER, attackSign, isHuman, onIce, type GameState, type Input, type Skater } from './state.ts';

function skill(s: GameState, team: number) {
  // A human's CPU teammates play at Pro level whatever the opponent's setting.
  return isHuman(s, team) ? CPU[1] : CPU[s.options.cpuSkill];
}

function clampTarget(x: number, y: number): [number, number] {
  return [
    Math.max(-RINK.halfW + 18, Math.min(RINK.halfW - 18, x)),
    Math.max(-RINK.halfH + 18, Math.min(RINK.halfH - 18, y)),
  ];
}

// Steering that arrives at the target instead of overshooting it.
function steer(s: GameState, k: Skater, tx: number, ty: number, urgency = 1): Input {
  [tx, ty] = clampTarget(tx, ty);
  const dx = tx - k.x;
  const dy = ty - k.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return { x: -k.vx, y: -k.vy, a: false, b: false };
  const want = Math.min(topSpeed(s, k) * urgency, d * 0.07);
  const ix = ((dx / d) * want - k.vx) * 2.5;
  const iy = ((dy / d) * want - k.vy) * 2.5;
  const m = Math.hypot(ix, iy);
  return m > 1 ? { x: ix / m, y: iy / m, a: false, b: false } : { x: ix, y: iy, a: false, b: false };
}

function opponents(s: GameState, k: Skater): Skater[] {
  return s.skaters.filter((o) => o.team !== k.team && onIce(o));
}

function mates(s: GameState, k: Skater): Skater[] {
  return s.skaters.filter((o) => o.team === k.team && o !== k && onIce(o));
}

function thinks(s: GameState, k: Skater): boolean {
  return (s.frame + k.id * 3) % skill(s, k.team).think === 0;
}

export function skaterAI(s: GameState, k: Skater): Input {
  if (k.down > 0) return { x: 0, y: 0, a: false, b: false };
  const p = s.puck;
  if (p.owner === k.id) return carrierAI(s, k);
  const ownerSkater = p.owner >= 0 && p.owner < 6 ? s.skaters[p.owner] : null;
  const goalieTeam = p.owner >= GOALIE_OWNER ? p.owner - GOALIE_OWNER : -1;
  if ((ownerSkater && ownerSkater.team === k.team) || goalieTeam === k.team) return supportAI(s, k, ownerSkater);
  if (ownerSkater) return defendAI(s, k, ownerSkater);
  if (goalieTeam >= 0) return retreatAI(s, k);
  return loosePuckAI(s, k);
}

function carrierAI(s: GameState, k: Skater): Input {
  const sgn = attackSign(s, k.team);
  const netX = sgn * RINK.goalX;
  const ahead = (netX - k.x) * sgn; // distance in front of the goal line
  const d = Math.hypot(netX - k.x, k.y);
  const opps = opponents(s, k).filter((o) => o.down === 0);
  let pressure = Infinity;
  for (const o of opps) pressure = Math.min(pressure, Math.hypot(o.x - k.x, o.y - k.y));

  // Winding up a slap shot: hold until the chosen charge, aiming at a corner.
  if (k.charge >= 0) {
    const inp = steer(s, k, netX - sgn * 60, k.y * 0.5, 0.6);
    inp.y = k.aiAim;
    inp.x = sgn * 0.2;
    inp.b = k.charge < k.aiChargeTo;
    return inp;
  }

  if (thinks(s, k)) {
    const corner = range(s.rng, 0, 1) < 0.5 ? -1 : 1;
    // Shot from close in with a decent angle.
    if (ahead > 14 && d < 115 && Math.abs(k.y) < 85 && chance(s.rng, d < 70 ? 0.35 : 0.14)) {
      k.aiChargeTo = 0;
      k.aiAim = chance(s.rng, 0.7) ? corner : 0;
      return { x: sgn * 0.2, y: k.aiAim, a: false, b: true };
    }
    // Room to wind up from the point.
    if (ahead > 90 && d < 240 && pressure > 55 && Math.abs(k.y) < 100 && chance(s.rng, 0.12)) {
      k.aiChargeTo = Math.round(range(s.rng, 18, 40));
      k.aiAim = chance(s.rng, 0.6) ? corner : 0;
      return { x: sgn * 0.2, y: k.aiAim, a: false, b: true };
    }
    // Pass out of pressure to someone open and useful.
    if (pressure < 34 && chance(s.rng, 0.4)) {
      let best: Skater | null = null;
      let bestScore = 0;
      for (const m of mates(s, k)) {
        if (m.down > 0) continue;
        if (laneBlocked(s, k.team, k.x, k.y, m.x, m.y, 12)) continue;
        let space = Infinity;
        for (const o of opps) space = Math.min(space, Math.hypot(o.x - m.x, o.y - m.y));
        const forward = ((m.x - k.x) * sgn) / 100;
        const score = Math.min(space, 90) / 30 + forward;
        if (space > 28 && score > bestScore) {
          bestScore = score;
          best = m;
        }
      }
      if (best) {
        const dx = best.x - k.x;
        const dy = best.y - k.y;
        const dl = Math.hypot(dx, dy) || 1;
        return { x: dx / dl, y: dy / dl, a: !k.prevA, b: false };
      }
    }
    // Pick a lane: drive at the slot, swerving around whoever is in the way.
    let tx = netX - sgn * 55;
    let ty = k.y > 0 ? 22 : -22;
    if (ahead < 12) {
      // Behind the net: come out front on the same side.
      tx = netX - sgn * 50;
      ty = k.y > 0 ? 55 : -55;
    }
    for (const o of opps) {
      const ox = (o.x - k.x) * sgn;
      if (ox > 0 && ox < 45 && Math.abs(o.y - k.y) < 22) {
        ty = k.y + (o.y > k.y ? -55 : 55);
        tx = k.x + sgn * 40;
      }
    }
    k.aiTx = tx;
    k.aiTy = ty;
  }
  if (k.aiTy === 0 && k.aiTx === 0) {
    k.aiTx = netX - sgn * 55;
    k.aiTy = 0;
  }
  return steer(s, k, k.aiTx, k.aiTy);
}

function supportAI(s: GameState, k: Skater, carrier: Skater | null): Input {
  const sgn = attackSign(s, k.team);
  const netX = sgn * RINK.goalX;
  const cx = carrier ? carrier.x : s.puck.x;
  const cy = carrier ? carrier.y : s.puck.y;
  const others = mates(s, k).filter((m) => m !== carrier).sort((a, b) => a.id - b.id);
  const order = others.filter((m) => m.id < k.id).length; // 0 = first support skater
  let tx: number;
  let ty: number;
  if (order === 0) {
    // Wing: ahead of the play on the far side, settling into the slot near the net.
    tx = Math.min(cx * sgn + 70, RINK.goalX - 60) * sgn;
    ty = cy > 0 ? -45 : 45;
  } else {
    // Trailer: behind the carrier toward the middle, an outlet if things go wrong.
    tx = Math.max(cx * sgn - 80, -RINK.goalX + 80) * sgn;
    ty = cy * -0.3;
  }
  if (Math.abs(tx - netX) < 30) tx = netX - sgn * 40;
  return steer(s, k, tx, ty, 0.9);
}

function defendAI(s: GameState, k: Skater, carrier: Skater): Input {
  const sk = skill(s, k.team);
  const sgn = attackSign(s, k.team);
  const ownNetX = -sgn * RINK.goalX;
  const defenders = mates(s, k).concat(k).filter((m) => m.down === 0);
  // Closest defender pressures the carrier, the others mark attackers.
  let presser = k;
  let best = Infinity;
  for (const m of defenders) {
    const d = Math.hypot(m.x - carrier.x, m.y - carrier.y);
    if (d < best - 0.001 || (Math.abs(d - best) < 0.001 && m.id < presser.id)) {
      best = d;
      presser = m;
    }
  }
  if (presser === k) {
    const toNetX = ownNetX - carrier.x;
    const toNetY = -carrier.y;
    const tl = Math.hypot(toNetX, toNetY) || 1;
    const lead = Math.min(12, best / 4);
    const tx = carrier.x + carrier.vx * lead + (toNetX / tl) * 6;
    const ty = carrier.y + carrier.vy * lead + (toNetY / tl) * 6;
    const inp = steer(s, k, tx, ty, 1.1);
    const closing = ((carrier.x - k.x) * (k.vx - carrier.vx) + (carrier.y - k.y) * (k.vy - carrier.vy)) / (best || 1);
    // Physical teams look for the hit more often.
    const style = 0.6 + 0.15 * s.teams[k.team].def.checking;
    const hitChance = sk.aggression * style * (closing > 1 ? 0.5 : 0.12);
    if (best < 18 && k.lunge === 0 && k.checkCooldown === 0 && thinks(s, k) && chance(s.rng, hitChance)) {
      const dl = best || 1;
      inp.x = (carrier.x - k.x) / dl;
      inp.y = (carrier.y - k.y) / dl;
      inp.a = !k.prevA;
    }
    return inp;
  }
  // Mark: pick the attacker nearest my net among those not already covered by a lower id.
  const attackers = opponents(s, k).filter((o) => o !== carrier);
  const markers = defenders.filter((m) => m !== presser).sort((a, b) => a.id - b.id);
  const taken = new Set<Skater>();
  for (const m of markers) {
    let pick: Skater | null = null;
    let pd = Infinity;
    for (const o of attackers) {
      if (taken.has(o)) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y) + Math.abs(o.x - ownNetX) * 0.3;
      if (d < pd) {
        pd = d;
        pick = o;
      }
    }
    if (m === k) {
      if (!pick) return steer(s, k, ownNetX + sgn * 45, carrier.y * 0.3);
      const dx = ownNetX - pick.x;
      const dy = -pick.y;
      const dl = Math.hypot(dx, dy) || 1;
      return steer(s, k, pick.x + (dx / dl) * 20, pick.y + (dy / dl) * 20);
    }
    if (pick) taken.add(pick);
  }
  return steer(s, k, ownNetX + sgn * 45, 0);
}

function retreatAI(s: GameState, k: Skater): Input {
  const sgn = attackSign(s, k.team);
  const ty = k.slot === 0 ? 0 : k.slot === 1 ? -50 : 50;
  return steer(s, k, sgn * 30, ty, 0.7);
}

function loosePuckAI(s: GameState, k: Skater): Input {
  const p = s.puck;
  const team = mates(s, k).concat(k).filter((m) => m.down === 0);
  // The skater who can get there first goes; everyone estimates the same way.
  const eta = (m: Skater) => Math.hypot(p.x - m.x, p.y - m.y) / (SKATER.baseSpeed + 0.4) + m.cooldown;
  let chaser = k;
  for (const m of team) if (eta(m) < eta(chaser) - 0.001 || (Math.abs(eta(m) - eta(chaser)) < 0.001 && m.id < chaser.id)) chaser = m;
  if (chaser === k) {
    const t = Math.min(25, eta(k) * 0.6);
    return steer(s, k, p.x + p.vx * t, p.y + p.vy * t, 1.2);
  }
  const sgn = attackSign(s, k.team);
  if (p.x * sgn > 0) return supportAI(s, k, null);
  const ownNetX = -sgn * RINK.goalX;
  const tx = (p.x + ownNetX) / 2;
  const ty = k.slot === 1 ? p.y * 0.5 - 30 : p.y * 0.5 + 30;
  return steer(s, k, tx, ty);
}
