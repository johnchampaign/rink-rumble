// Scripted stand-ins for a human player, driven through the human input path (switching,
// button edges, the one-timer buffer). CPU-vs-CPU numbers alone hid how hard scoring was for
// people, so `npm run sim -- --human <bot>` measures these too.
import { RINK } from '../src/sim/constants.ts';
import { attackSign, onIce, type GameState, type Input } from '../src/sim/state.ts';

export type Bot = (s: GameState, f: number) => Input;

const idle: Bot = () => ({ x: 0, y: 0, a: false, b: false });

function toward(x: number, y: number, tx: number, ty: number): { x: number; y: number } {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

// Chases the puck, checks the carrier, and with the puck skates into the slot and shoots once.
function defend(s: GameState, f: number): Input {
  const k = s.skaters[s.active[0]];
  const p = s.puck;
  const d = Math.hypot(p.x - k.x, p.y - k.y);
  return { ...toward(k.x, k.y, p.x, p.y), a: d < 16 && f % 30 === 0, b: false };
}

// A beginner: carry it to the slot and shoot, with no aim.
const rusher: Bot = (s, f) => {
  const k = s.skaters[s.active[0]];
  if (!k || !onIce(k)) return idle(s, f);
  if (s.puck.owner !== k.id) return defend(s, f);
  const sgn = attackSign(s, 0);
  const netX = sgn * RINK.goalX;
  const close = Math.hypot(netX - k.x, k.y) < 80;
  return { ...toward(k.x, k.y, netX - sgn * 45, 0), a: false, b: close && f % 24 < 2 };
};

// Uses the lesson the game teaches: carry in on one side, pass across the slot, and press shoot
// as the pass arrives.
const playmaker: Bot = (s, f) => {
  const p = s.puck;
  // Control passes to whoever takes the puck, so think as the carrier when we have it.
  const k = p.owner >= 0 && p.owner < 6 && s.skaters[p.owner].team === 0 ? s.skaters[p.owner] : s.skaters[s.active[0]];
  if (!k || !onIce(k)) return idle(s, f);
  const sgn = attackSign(s, 0);
  const netX = sgn * RINK.goalX;
  const aim = s.goalies[1].y > 0 ? -1 : 1;
  // A pass from us is on its way to a teammate: press shoot just before it arrives.
  if (p.owner === -1 && p.passFrom >= 0 && s.skaters[p.passFrom].team === 0) {
    const target = s.skaters.filter((m) => m.team === 0 && m.id !== p.passFrom && onIce(m))
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    const near = target && Math.hypot(target.x - p.x, target.y - p.y) < 22;
    return { x: sgn * 0.3, y: aim, a: false, b: !!near && f % 2 === 0 };
  }
  if (p.owner !== k.id) return defend(s, f);
  if (k.oneTimer > 0) return { x: sgn * 0.3, y: aim, a: false, b: true };
  const ahead = (netX - k.x) * sgn;
  if (ahead < 150) {
    const mate = s.skaters.find((m) => m.team === 0 && m !== k && onIce(m) && m.down === 0 && Math.abs(m.y - k.y) > 35 &&
      (netX - m.x) * sgn > 25 && (netX - m.x) * sgn < 130);
    if (mate) return { ...toward(k.x, k.y, mate.x, mate.y), a: f % 6 === 0, b: false };
    if (ahead < 90) return { x: sgn * 0.2, y: k.y > 0 ? -1 : 1, a: false, b: f % 24 < 2 };
  }
  return { ...toward(k.x, k.y, netX - sgn * 90, k.y > 0 ? 50 : -50), a: false, b: false };
};

export const BOTS: Record<string, Bot> = { idle, rusher, playmaker };
