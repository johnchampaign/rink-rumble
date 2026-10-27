// Rink geometry: the boards (a rounded rectangle) and the two nets.
import { RINK } from './constants.ts';

export interface Contact {
  nx: number; // unit normal pointing back into play
  ny: number;
  depth: number;
}

// Keeps a circle of radius r inside the boards. Returns the push-out contact, or null.
// The playable region for the circle's centre is the rink shrunk by r, which is again a
// rounded rectangle, so the nearest point is found by clamping to its inner core.
export function boardContact(x: number, y: number, r: number): Contact | null {
  const R = RINK.corner;
  const cx = Math.max(-(RINK.halfW - R), Math.min(RINK.halfW - R, x));
  const cy = Math.max(-(RINK.halfH - R), Math.min(RINK.halfH - R, y));
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  const limit = R - r;
  if (d <= limit || d === 0) return null;
  return { nx: -dx / d, ny: -dy / d, depth: d - limit };
}

// Net of the side `side` (−1 left, +1 right): the mouth is on the goal line, the cage goes
// toward the end boards.
export function netBox(side: number) {
  const x0 = side * RINK.goalX;
  const x1 = side * (RINK.goalX + RINK.netDepth);
  return { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minY: -RINK.netHalfW, maxY: RINK.netHalfW };
}

// The three solid walls of a net as segments [x1, y1, x2, y2].
export function netWalls(side: number): number[][] {
  const g = side * RINK.goalX;
  const b = side * (RINK.goalX + RINK.netDepth);
  const h = RINK.netHalfW;
  return [
    [b, -h, b, h], // back
    [g, -h, b, -h], // top side
    [g, h, b, h], // bottom side
  ];
}

// Contact between a circle and a segment, or null.
export function segmentContact(x: number, y: number, r: number, s: number[]): Contact | null {
  const [x1, y1, x2, y2] = s;
  const ex = x2 - x1;
  const ey = y2 - y1;
  const len2 = ex * ex + ey * ey;
  const t = Math.max(0, Math.min(1, ((x - x1) * ex + (y - y1) * ey) / len2));
  const px = x1 + ex * t;
  const py = y1 + ey * t;
  const dx = x - px;
  const dy = y - py;
  const d = Math.hypot(dx, dy);
  if (d >= r) return null;
  if (d === 0) return { nx: 0, ny: y < 0 ? -1 : 1, depth: r };
  return { nx: dx / d, ny: dy / d, depth: r - d };
}

// Contact between a circle and the whole net as a solid box (for skaters, who can't enter it).
export function netBoxContact(x: number, y: number, r: number, side: number): Contact | null {
  const b = netBox(side);
  const px = Math.max(b.minX, Math.min(b.maxX, x));
  const py = Math.max(b.minY, Math.min(b.maxY, y));
  const dx = x - px;
  const dy = y - py;
  const d = Math.hypot(dx, dy);
  if (d >= r) return null;
  if (d === 0) {
    // Centre inside the box: push out through the mouth.
    return { nx: -side, ny: 0, depth: r + Math.abs(x - side * RINK.goalX) };
  }
  return { nx: dx / d, ny: dy / d, depth: r - d };
}

// True when a puck moving from (x0) to (x1) has crossed the goal line of `side` inside the mouth.
export function crossedGoalLine(side: number, x0: number, x1: number, y: number, r: number): boolean {
  const g = side * RINK.goalX;
  const crossed = side > 0 ? x0 < g && x1 >= g : x0 > g && x1 <= g;
  return crossed && Math.abs(y) < RINK.netHalfW - r;
}
