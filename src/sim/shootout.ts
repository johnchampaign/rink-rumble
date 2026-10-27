// Shootout bookkeeping: whose turn it is and when it is decided. The on-ice part of each
// attempt is run by game.ts with everyone but the shooter and one goalie benched.

export interface ShootoutState {
  round: number; // 0-based
  first: number; // team that shoots first in every round
  shooter: number; // team shooting now
  results: boolean[][]; // per team, one entry per attempt taken
  stage: 'attempt' | 'result';
  timer: number;
  lastScored: boolean;
}

export const SHOOTOUT_ROUNDS = 3;

export function newShootout(firstTeam: number): ShootoutState {
  return { round: 0, first: firstTeam, shooter: firstTeam, results: [[], []], stage: 'attempt', timer: 0, lastScored: false };
}

export function goals(so: ShootoutState, team: number): number {
  return so.results[team].filter(Boolean).length;
}

// The winning team, or −1 while undecided. In the first three rounds the shootout ends as soon
// as one side can no longer be caught; after that it is sudden death round by round.
export function shootoutWinner(so: ShootoutState): number {
  const [a, b] = [so.results[0].length, so.results[1].length];
  const [ga, gb] = [goals(so, 0), goals(so, 1)];
  if (a <= SHOOTOUT_ROUNDS && b <= SHOOTOUT_ROUNDS) {
    const leftA = SHOOTOUT_ROUNDS - a;
    const leftB = SHOOTOUT_ROUNDS - b;
    if (ga > gb + leftB) return 0;
    if (gb > ga + leftA) return 1;
    if (a < SHOOTOUT_ROUNDS || b < SHOOTOUT_ROUNDS) return -1;
  }
  if (a !== b) return -1;
  return ga === gb ? -1 : ga > gb ? 0 : 1;
}

// Records an attempt and advances the turn.
export function recordAttempt(so: ShootoutState, scored: boolean) {
  so.results[so.shooter].push(scored);
  so.lastScored = scored;
  if (so.results[0].length === so.results[1].length) {
    so.round++;
    so.shooter = so.first;
  } else so.shooter = 1 - so.shooter;
}
