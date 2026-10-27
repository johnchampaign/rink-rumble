// Game state types and a fresh-game constructor. Everything the simulation needs is here,
// including the RNG seed, so a state can be cloned, hashed and replayed.
import { PHASE, FPS } from './constants.ts';
import type { RngState } from './rng.ts';
import { TEAMS, type TeamDef } from './teams.ts';
import type { FightState } from './fight.ts';
import type { ShootoutState } from './shootout.ts';

export interface Input {
  x: number; // −1..1
  y: number;
  a: boolean; // pass / check (dive for a shootout goalie)
  b: boolean; // shoot / switch skater
}

export const NO_INPUT: Input = { x: 0, y: 0, a: false, b: false };

export interface Skater {
  id: number; // 0–2 home, 3–5 away
  team: number;
  slot: number;
  number: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number; // radians
  down: number; // frames left lying on the ice
  cooldown: number; // frames before this skater may touch the puck
  charge: number; // slap-shot wind-up frames, −1 when not winding up
  lunge: number; // frames left in a check lunge
  checkCooldown: number;
  penalty: number; // frames left in the box; 0 means on the ice
  releasable: boolean; // the penalty ends early if the other team scores
  benched: boolean; // off the ice for a shootout attempt
  stride: number; // animation phase
  prevA: boolean;
  prevB: boolean;
  // CPU memory
  aiTimer: number;
  aiTx: number;
  aiTy: number;
  aiChargeTo: number;
  aiAim: number; // −1, 0 or 1: which part of the net the CPU is shooting for
}

export interface Goalie {
  team: number;
  x: number;
  y: number;
  holding: number; // frames left holding the puck
  dive: number;
  diveCooldown: number;
  lastTouch: number; // puck touch id this goalie already tried to stop
  prevA: boolean;
}

// Puck owner codes: −1 loose, 0–5 a skater, GOALIE_OWNER + team a goalie.
export const GOALIE_OWNER = 10;

export interface Puck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number;
  touch: number; // increments every time the puck leaves a stick
  isShot: boolean;
  shotFromX: number;
  shotTeam: number;
  lastSkater: number; // last skater who touched it, for goal credit
  deadFrames: number;
  lastSaveFrame: number;
}

export interface TeamState {
  def: TeamDef;
  score: number;
  shots: number;
  momentum: number;
  surge: number;
  side: number; // which net this team defends: −1 left, +1 right
}

export interface MatchOptions {
  periodSeconds: number;
  fights: boolean;
  surge: boolean;
  cpuSkill: number; // 0 Rookie, 1 Pro, 2 All-Star
  humans: [boolean, boolean];
  teams: [number, number];
  seed: number;
}

export type Phase = 'faceoff' | 'play' | 'goal' | 'fight' | 'intermission' | 'shootout' | 'final';

export type GameEvent =
  | { type: 'whistle' }
  | { type: 'drop' }
  | { type: 'pass'; team: number }
  | { type: 'shot'; team: number; power: number }
  | { type: 'board'; speed: number }
  | { type: 'post' }
  | { type: 'save'; team: number; caught: boolean }
  | { type: 'goal'; team: number; scorer: number }
  | { type: 'hit'; team: number; knockdown: boolean }
  | { type: 'poke'; team: number }
  | { type: 'fightStart' }
  | { type: 'punch'; landed: boolean; heavy: boolean }
  | { type: 'fightEnd'; winner: number }
  | { type: 'surge'; team: number }
  | { type: 'periodEnd'; period: number }
  | { type: 'shootoutResult'; team: number; scored: boolean }
  | { type: 'final'; winner: number };

export interface GameState {
  frame: number;
  rng: RngState;
  options: MatchOptions;
  phase: Phase;
  phaseTimer: number;
  period: number;
  clock: number; // frames left in the period
  skaters: Skater[];
  goalies: Goalie[];
  puck: Puck;
  teams: TeamState[];
  active: number[]; // controlled skater id for each team, −1 for a CPU team
  prevInput: Input[]; // last frame's controller input per team, for button edges
  prevOwner: number;
  pendingFight: number[] | null; // [checker, victim] set by a check, started by game.ts
  heat: number[]; // 3×3 grid: home slot × away slot
  framesSinceFight: number;
  fight: FightState | null;
  shootout: ShootoutState | null;
  events: GameEvent[];
  lastScorer: number;
  winner: number;
  stats: { whistles: number; hits: number; knockdowns: number; scraps: number; saves: number };
}

export const DEFAULT_OPTIONS: MatchOptions = {
  periodSeconds: 180,
  fights: true,
  surge: true,
  cpuSkill: 1,
  humans: [true, false],
  teams: [0, 1],
  seed: 1,
};

export function newGame(opts: Partial<MatchOptions> = {}): GameState {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const skaters: Skater[] = [];
  for (let id = 0; id < 6; id++) {
    const team = id < 3 ? 0 : 1;
    const slot = id % 3;
    skaters.push({
      id, team, slot, number: TEAMS[options.teams[team]].numbers[slot],
      x: 0, y: 0, vx: 0, vy: 0, facing: 0, down: 0, cooldown: 0, charge: -1, lunge: 0,
      checkCooldown: 0, penalty: 0, releasable: false, benched: false, stride: 0, prevA: false,
      prevB: false, aiTimer: 0, aiTx: 0, aiTy: 0, aiChargeTo: 0, aiAim: 0,
    });
  }
  const goalies: Goalie[] = [0, 1].map((team) => ({
    team, x: 0, y: 0, holding: 0, dive: 0, diveCooldown: 0, lastTouch: -1, prevA: false,
  }));
  const teams: TeamState[] = [0, 1].map((t) => ({
    def: TEAMS[options.teams[t]], score: 0, shots: 0, momentum: 0, surge: 0, side: t === 0 ? -1 : 1,
  }));
  return {
    frame: 0,
    rng: { seed: options.seed | 0 },
    options,
    phase: 'faceoff',
    phaseTimer: PHASE.faceoffHold,
    period: 1,
    clock: options.periodSeconds * FPS,
    skaters,
    goalies,
    puck: {
      x: 0, y: 0, vx: 0, vy: 0, owner: -1, touch: 0, isShot: false, shotFromX: 0, shotTeam: -1,
      lastSkater: -1, deadFrames: 0, lastSaveFrame: -1000,
    },
    teams,
    active: [options.humans[0] ? 0 : -1, options.humans[1] ? 3 : -1],
    prevInput: [NO_INPUT, NO_INPUT],
    prevOwner: -1,
    pendingFight: null,
    heat: new Array(9).fill(0),
    framesSinceFight: 0,
    fight: null,
    shootout: null,
    events: [],
    lastScorer: -1,
    winner: -1,
    stats: { whistles: 0, hits: 0, knockdowns: 0, scraps: 0, saves: 0 },
  };
}

// Direction a team shoots toward: the opposite of the net it defends.
export function attackSign(s: GameState, team: number): number {
  return -s.teams[team].side;
}

export function onIce(k: Skater): boolean {
  return k.penalty === 0 && !k.benched;
}

export function isHuman(s: GameState, team: number): boolean {
  return s.options.humans[team];
}

export function addMomentum(s: GameState, team: number, amount: number) {
  const t = s.teams[team];
  if (t.surge === 0) t.momentum = Math.min(100, t.momentum + amount);
}
