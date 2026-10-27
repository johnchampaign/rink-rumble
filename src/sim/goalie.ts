// Goalies: positioning, saves, holding and outlet passes, poke checks and dives.
import { CPU, GOALIE, MOMENTUM, PUCK, RINK, SHOT } from './constants.ts';
import { chance, range } from './rng.ts';
import { laneBlocked, release } from './skater.ts';
import { GOALIE_OWNER, addMomentum, isHuman, onIce, type GameState, type Goalie, type Input } from './state.ts';

function goalieRating(s: GameState, team: number): number {
  return s.teams[team].def.goalie;
}

// Moves the goalie. `inp` is given when a human is in net (shootouts only).
export function stepGoalie(s: GameState, g: Goalie, inp: Input | null) {
  const side = s.teams[g.team].side;
  const netX = side * RINK.goalX;
  const p = s.puck;
  if (g.dive > 0) g.dive--;
  if (g.diveCooldown > 0) g.diveCooldown--;

  if (g.holding > 0) {
    p.x = g.x - side * 7;
    p.y = g.y;
    p.vx = 0;
    p.vy = 0;
    if (--g.holding === 0) outlet(s, g);
    return;
  }

  const speed = GOALIE.baseSpeed + GOALIE.speedStep * goalieRating(s, g.team);
  let tx: number;
  let ty: number;
  if (inp) {
    ty = Math.max(-RINK.netHalfW - 3, Math.min(RINK.netHalfW + 3, g.y + inp.y * speed * 1.6));
    tx = netX - side * (GOALIE.depthNear + 3 - Math.abs(ty) * 0.15);
    if (inp.a && !g.prevA && g.diveCooldown === 0) dive(g);
    g.prevA = inp.a;
  } else {
    const dx = p.x - netX;
    const dy = p.y;
    if (dx * side > -2) {
      // Puck behind the goal line: hug the near post.
      tx = netX - side * 4;
      ty = Math.sign(dy || 1) * (RINK.netHalfW - 3);
    } else {
      const d = Math.hypot(dx, dy) || 1;
      const depth = GOALIE.depthNear + (GOALIE.depthFar - GOALIE.depthNear) * Math.max(0, Math.min(1, (d - 40) / 150));
      tx = netX + (dx / d) * depth;
      ty = Math.max(-RINK.netHalfW - 2, Math.min(RINK.netHalfW + 2, (dy / d) * depth * 1.4));
    }
    maybeDive(s, g, netX, side);
  }
  const mx = tx - g.x;
  const my = ty - g.y;
  const md = Math.hypot(mx, my);
  if (md > 0) {
    const step = Math.min(md, speed);
    g.x += (mx / md) * step;
    g.y += (my / md) * step;
  }
  pokeCarrier(s, g);
}

function dive(g: Goalie) {
  g.dive = GOALIE.diveFrames;
  g.diveCooldown = GOALIE.diveCooldown;
}

function maybeDive(s: GameState, g: Goalie, netX: number, side: number) {
  const p = s.puck;
  if (g.diveCooldown > 0 || p.owner !== -1 || !p.isShot || p.shotTeam === g.team) return;
  if (p.vx * side <= 0) return;
  const d = Math.hypot(p.x - g.x, p.y - g.y);
  if (d > 50) return;
  const t = (netX - p.x) / p.vx;
  const yAt = p.y + p.vy * t;
  if (Math.abs(yAt - g.y) > 6 && Math.abs(yAt) < RINK.netHalfW + 2 && chance(s.rng, 0.25)) dive(g);
}

// A carrier who skates right up to the goalie can get the puck knocked off their stick.
function pokeCarrier(s: GameState, g: Goalie) {
  const p = s.puck;
  if (p.owner < 0 || p.owner >= 6) return;
  const c = s.skaters[p.owner];
  if (c.team === g.team) return;
  if (Math.hypot(p.x - g.x, p.y - g.y) > GOALIE.reach + 3) return;
  if (!chance(s.rng, 0.05)) return;
  const side = s.teams[g.team].side;
  release(s, null, -side * range(s.rng, 1.5, 2.5), range(s.rng, -2, 2), false);
  g.lastTouch = p.touch;
  c.cooldown = 20;
  s.events.push({ type: 'poke', team: g.team });
}

// Holding goalie passes to the most open teammate, or rims it up the boards.
function outlet(s: GameState, g: Goalie) {
  const p = s.puck;
  const side = s.teams[g.team].side;
  let best = null;
  let bestScore = -Infinity;
  for (const m of s.skaters) {
    if (m.team !== g.team || !onIce(m) || m.down > 0) continue;
    let space = Infinity;
    for (const o of s.skaters) {
      if (o.team === g.team || !onIce(o)) continue;
      space = Math.min(space, Math.hypot(o.x - m.x, o.y - m.y));
    }
    let score = Math.min(space, 120) - Math.hypot(m.x - g.x, m.y - g.y) * 0.2;
    if (laneBlocked(s, g.team, p.x, p.y, m.x, m.y, 12)) score -= 80;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  let vx: number;
  let vy: number;
  if (best && bestScore > 0) {
    const d = Math.hypot(best.x - p.x, best.y - p.y) || 1;
    vx = ((best.x - p.x) / d) * SHOT.pass;
    vy = ((best.y - p.y) / d) * SHOT.pass;
  } else {
    const a = Math.atan2(range(s.rng, 0.6, 1) * (chance(s.rng, 0.5) ? 1 : -1), -side);
    vx = Math.cos(a) * SHOT.pass * 1.2;
    vy = Math.sin(a) * SHOT.pass * 1.2;
  }
  release(s, null, vx, vy, false);
  p.lastSkater = -1;
  g.lastTouch = p.touch;
  s.events.push({ type: 'pass', team: g.team });
}

// Called for every substep of a loose puck. Returns true when the goalie stopped it.
export function trySave(s: GameState, g: Goalie): boolean {
  const p = s.puck;
  if (g.holding > 0 || p.owner !== -1) return false;
  const reach = g.dive > 0 ? GOALIE.diveReach : GOALIE.reach;
  if (Math.hypot(p.x - g.x, p.y - g.y) > reach + PUCK.radius) return false;
  if (g.lastTouch === p.touch) return false;
  g.lastTouch = p.touch;

  const side = s.teams[g.team].side;
  const netX = side * RINK.goalX;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > 1 && p.vx * side <= 0) return false; // heading away from the net

  let pSave: number;
  let onTarget = false;
  const shot = p.isShot && p.shotTeam !== g.team && p.vx * side > 0;
  if (shot) {
    pSave = GOALIE.saveBase + GOALIE.saveStep * goalieRating(s, g.team);
    if (!isHuman(s, g.team)) pSave += CPU[s.options.cpuSkill].goalieBonus;
    pSave -= Math.max(0, speed - 5) * GOALIE.saveSpeedCost;
    const yAt = p.y + p.vy * ((netX - p.x) / p.vx);
    onTarget = Math.abs(yAt) < RINK.netHalfW;
    if (onTarget) s.teams[p.shotTeam].shots++;
    pSave -= Math.min(1.2, Math.abs(yAt - g.y) / RINK.netHalfW) * GOALIE.saveOffCentreCost;
    if (Math.abs(p.shotFromX - netX) > GOALIE.farShot) pSave += GOALIE.saveFarBonus;
    if (s.frame - p.lastSaveFrame < GOALIE.reboundWindow) pSave -= GOALIE.reboundCost;
    if (g.dive > 0) pSave += 0.05;
    if (s.phase === 'shootout') pSave -= GOALIE.shootoutCost;
    if (!onTarget) pSave = 0.97; // going wide anyway: the goalie lets it go or steers it away
  } else pSave = 0.96;

  if (!chance(s.rng, pSave)) return false;

  const caught = speed < 1.5 || (speed < GOALIE.catchSpeed && chance(s.rng, GOALIE.catchChance));
  if (caught) {
    p.owner = GOALIE_OWNER + g.team;
    p.vx = 0;
    p.vy = 0;
    p.isShot = false;
    g.holding = GOALIE.holdFrames;
  } else {
    p.vx = -side * Math.abs(p.vx) * 0.4 - side * 0.6;
    p.vy = p.vy * 0.3 + range(s.rng, -1.6, 1.6);
    p.touch++;
    p.isShot = false;
    g.lastTouch = p.touch;
  }
  p.lastSaveFrame = s.frame;
  p.deadFrames = 0;
  if (shot) {
    if (onTarget) s.stats.saves++;
    addMomentum(s, g.team, MOMENTUM.save);
    addMomentum(s, 1 - g.team, MOMENTUM.shot);
  }
  s.events.push({ type: 'save', team: g.team, caught });
  return true;
}
