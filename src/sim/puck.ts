// The puck: riding a stick, or loose with boards, nets, goals, saves and pickups.
import { PUCK, RINK, SHOT, SKATER } from './constants.ts';
import { trySave } from './goalie.ts';
import { boardContact, crossedGoalLine, netBoxContact, netWalls, segmentContact, type Contact } from './rink.ts';
import { chance, range } from './rng.ts';
import { onIce, type GameState, type Skater } from './state.ts';

function bounce(s: GameState, c: Contact, restitution: number, board: boolean) {
  const p = s.puck;
  p.x += c.nx * c.depth;
  p.y += c.ny * c.depth;
  const vn = p.vx * c.nx + p.vy * c.ny;
  if (vn >= 0) return;
  p.vx -= (1 + restitution) * vn * c.nx;
  p.vy -= (1 + restitution) * vn * c.ny;
  p.vx *= 0.96;
  p.vy *= 0.96;
  if (-vn > 1.5) s.events.push(board ? { type: 'board', speed: -vn } : { type: 'post' });
}

function attachToStick(s: GameState, k: Skater) {
  const p = s.puck;
  p.x = k.x + Math.cos(k.facing) * SKATER.stickReach;
  p.y = k.y + Math.sin(k.facing) * SKATER.stickReach;
  p.vx = k.vx;
  p.vy = k.vy;
  const c = boardContact(p.x, p.y, PUCK.radius);
  if (c) {
    p.x += c.nx * c.depth;
    p.y += c.ny * c.depth;
  }
  // The puck can't be carried into the cage: it has to be shot in.
  for (const side of [-1, 1]) {
    const n = netBoxContact(p.x, p.y, PUCK.radius, side);
    if (n) {
      p.x += n.nx * n.depth;
      p.y += n.ny * n.depth;
    }
  }
  p.deadFrames = 0;
}

// Loose puck meets sticks. Returns true when someone took possession.
function tryPickup(s: GameState): boolean {
  const p = s.puck;
  const speed = Math.hypot(p.vx, p.vy);
  let best: Skater | null = null;
  let bestD = Infinity;
  for (const k of s.skaters) {
    if (!onIce(k) || k.down > 0 || k.cooldown > 0) continue;
    if (p.isShot && k.team === p.shotTeam) continue; // nobody blocks a teammate's shot
    const sx = k.x + Math.cos(k.facing) * SKATER.stickReach * 0.8;
    const sy = k.y + Math.sin(k.facing) * SKATER.stickReach * 0.8;
    const body = Math.hypot(p.x - k.x, p.y - k.y);
    const d = Math.min(Math.hypot(p.x - sx, p.y - sy), body);
    // A hard shot beats sticks; it only stops if it hits a body square on.
    if (p.isShot && speed > PUCK.hardToCatch && body > PUCK.blockRadius) continue;
    const reach = SKATER.pickupRadius + (speed < 2 ? 3 : 0);
    if (d < reach && d < bestD) {
      bestD = d;
      best = k;
    }
  }
  if (!best) return false;
  if (speed > PUCK.hardToCatch) {
    const keep = Math.max(0.1, 1 - (speed - PUCK.hardToCatch) * (p.isShot ? PUCK.catchHardShot : 0.25));
    if (!chance(s.rng, keep)) {
      // Blocked: the puck caroms off skates or shin pads.
      const a = Math.atan2(p.vy, p.vx) + range(s.rng, -1.2, 1.2);
      const v = speed * range(s.rng, 0.35, 0.6);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.isShot = false;
      p.touch++;
      best.cooldown = 8;
      return false;
    }
  }
  // Taking a teammate's pass opens a moment for a one-timer.
  const passer = p.passFrom >= 0 ? s.skaters[p.passFrom] : null;
  if (passer && passer !== best && passer.team === best.team && s.frame - p.releaseFrame >= SHOT.oneTimerMinFlight) {
    best.oneTimer = SHOT.oneTimerWindow;
  }
  p.owner = best.id;
  p.isShot = false;
  p.lastSkater = best.id;
  p.deadFrames = 0;
  best.charge = -1;
  return true;
}

export interface PuckResult {
  goalSide: number; // the net the puck went into (−1 or +1), 0 for none
  dead: boolean; // frozen puck: nobody has touched it for too long
}

export function stepPuck(s: GameState): PuckResult {
  const p = s.puck;
  const out: PuckResult = { goalSide: 0, dead: false };
  if (p.owner >= 0 && p.owner < 6) {
    attachToStick(s, s.skaters[p.owner]);
    return out;
  }
  if (p.owner !== -1) return out; // a goalie is holding it

  const speed = Math.hypot(p.vx, p.vy);
  const n = Math.max(1, Math.ceil(speed / 3));
  for (let i = 0; i < n; i++) {
    const x0 = p.x;
    p.x += p.vx / n;
    p.y += p.vy / n;
    for (const side of [-1, 1]) {
      if (crossedGoalLine(side, x0, p.x, p.y, PUCK.radius)) {
        out.goalSide = side;
        return out;
      }
    }
    for (const side of [-1, 1]) {
      for (const w of netWalls(side)) {
        const c = segmentContact(p.x, p.y, PUCK.radius + 1, w);
        if (c) bounce(s, c, PUCK.boardBounce * 0.6, false);
      }
    }
    const c = boardContact(p.x, p.y, PUCK.radius);
    if (c) bounce(s, c, PUCK.boardBounce, true);
    if (trySave(s, s.goalies[0]) || trySave(s, s.goalies[1])) break;
    if (tryPickup(s)) {
      attachToStick(s, s.skaters[p.owner]);
      return out;
    }
  }
  p.vx *= PUCK.friction;
  p.vy *= PUCK.friction;
  if (p.owner === -1 && Math.hypot(p.vx, p.vy) < 0.3) {
    if (++p.deadFrames > PUCK.deadFrames) out.dead = true;
  } else p.deadFrames = 0;
  return out;
}

// After a goal the puck settles in the back of the net.
export function settleInNet(s: GameState, side: number) {
  const p = s.puck;
  p.vx *= 0.8;
  p.vy *= 0.8;
  p.x += p.vx;
  p.y += p.vy;
  const lo = Math.min(side * RINK.goalX, side * (RINK.goalX + RINK.netDepth)) + PUCK.radius;
  const hi = Math.max(side * RINK.goalX, side * (RINK.goalX + RINK.netDepth)) - PUCK.radius;
  p.x = Math.max(lo, Math.min(hi, p.x));
  p.y = Math.max(-RINK.netHalfW + 2, Math.min(RINK.netHalfW - 2, p.y));
}
