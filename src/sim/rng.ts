// Seeded RNG (mulberry32). The seed lives in GameState so a game is a pure function of
// its seed and inputs.

export interface RngState {
  seed: number;
}

export function next(r: RngState): number {
  let t = (r.seed = (r.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(r: RngState, lo: number, hi: number): number {
  return lo + (hi - lo) * next(r);
}

export function chance(r: RngState, p: number): boolean {
  return next(r) < p;
}

// Roughly normal, mean 0, sd 1.
export function gauss(r: RngState): number {
  return (next(r) + next(r) + next(r) - 1.5) * 2;
}
