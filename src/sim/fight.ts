// Scraps: a side-on two-player brawl that freezes the rink. Pure: it reads inputs and an RNG
// and reports events; game.ts applies the outcome (penalties, momentum, restart).
import { chance, range, type RngState } from './rng.ts';
import type { GameEvent, Input } from './state.ts';

export type FightAction = 'ready' | 'jab' | 'charge' | 'hay' | 'guard' | 'lean' | 'stagger' | 'down';

export interface Fighter {
  skater: number;
  team: number;
  grit: number;
  balance: number;
  stamina: number;
  action: FightAction;
  t: number;
  charge: number;
  prevA: boolean;
  prevB: boolean;
  // CPU memory
  aiTimer: number;
  aiPlan: 'wait' | 'jab' | 'charge' | 'guard' | 'lean';
  aiHold: number;
}

export interface FightState {
  phase: 'intro' | 'brawl' | 'over';
  timer: number;
  f: [Fighter, Fighter]; // 0 stands on the left (home team)
  winner: number; // fighter index, −1 for a draw (valid once phase is 'over')
}

export const FIGHT = {
  intro: 70,
  maxFrames: 15 * 60,
  pointsMargin: 15,
  jabWindup: 6,
  jabTotal: 16,
  jabDamage: 7,
  jabCost: 5,
  hayMinCharge: 10,
  hayMaxCharge: 40,
  haySwing: 8,
  hayTotal: 22,
  hayDamage: 11,
  hayPerCharge: 0.35,
  hayCost: 12,
  guardDrain: 0.25,
  guardJab: 0.25,
  guardHay: 0.45,
  guardBreak: 18,
  leanCost: 8,
  leanFrom: 2,
  leanTo: 16,
  leanTotal: 22,
  whiffStagger: 24,
  chargeHitFactor: 1.5,
  tiredBelow: 20,
  tiredFactor: 0.6,
  staminaRegen: 0.3,
  balanceRegen: 0.03,
};

function fighter(skater: number, team: number, grit: number): Fighter {
  return {
    skater, team, grit, balance: 100, stamina: 100, action: 'ready', t: 0, charge: 0,
    prevA: false, prevB: false, aiTimer: 20, aiPlan: 'wait', aiHold: 0,
  };
}

export function newFight(home: { id: number; grit: number }, away: { id: number; grit: number }): FightState {
  return { phase: 'intro', timer: FIGHT.intro, f: [fighter(home.id, 0, home.grit), fighter(away.id, 1, away.grit)], winner: -1 };
}

export function fightAI(fs: FightState, i: number, rng: RngState, read: number): Input {
  const me = fs.f[i];
  const opp = fs.f[1 - i];
  const out: Input = { x: 0, y: 0, a: false, b: false };
  if (fs.phase !== 'brawl' || me.action === 'down') return out;

  // React to what the opponent is doing, as a human watching the screen would.
  if (me.action === 'ready' && me.aiPlan === 'wait') {
    if (opp.action === 'charge' && opp.charge > 6 && chance(rng, read * 0.12)) {
      me.aiPlan = me.stamina > FIGHT.leanCost + 5 ? 'lean' : 'jab';
    } else if (opp.action === 'jab' && opp.t < 3 && chance(rng, read * 0.5)) {
      me.aiPlan = 'guard';
      me.aiHold = 14;
    }
  }
  if (me.aiPlan === 'wait' && --me.aiTimer <= 0) {
    me.aiTimer = Math.round(range(rng, 10, 26));
    if (me.stamina < 25) {
      me.aiPlan = chance(rng, 0.5) ? 'guard' : 'wait';
      me.aiHold = 20;
    } else {
      const r = range(rng, 0, 1);
      if (r < 0.55) me.aiPlan = 'jab';
      else if (r < 0.85) {
        me.aiPlan = 'charge';
        me.aiHold = Math.round(range(rng, 14, 34));
      } else {
        me.aiPlan = 'guard';
        me.aiHold = 12;
      }
    }
  }

  switch (me.aiPlan) {
    case 'jab':
      if (me.action === 'ready') out.a = !me.prevA;
      if (me.action === 'jab') me.aiPlan = 'wait';
      break;
    case 'lean':
      out.y = -1;
      if (me.action === 'lean' || me.action !== 'ready') me.aiPlan = 'wait';
      break;
    case 'guard':
      out.y = 1;
      if (--me.aiHold <= 0) me.aiPlan = 'wait';
      break;
    case 'charge':
      out.b = me.action === 'ready' || (me.action === 'charge' && me.charge < me.aiHold);
      if (me.action === 'hay' || (me.action !== 'ready' && me.action !== 'charge')) me.aiPlan = 'wait';
      break;
  }
  return out;
}

function land(fs: FightState, ai: number, kind: 'jab' | 'hay', events: GameEvent[]) {
  const atk = fs.f[ai];
  const def = fs.f[1 - ai];
  let dmg = kind === 'jab' ? FIGHT.jabDamage : FIGHT.hayDamage + atk.charge * FIGHT.hayPerCharge;
  if (atk.stamina < FIGHT.tiredBelow) dmg *= FIGHT.tiredFactor;
  dmg *= (0.9 + atk.grit * 0.04) * (1.15 - def.grit * 0.05);
  const heavy = kind === 'hay';

  if (def.action === 'lean' && def.t >= FIGHT.leanFrom && def.t <= FIGHT.leanTo) {
    events.push({ type: 'punch', landed: false, heavy });
    if (kind === 'hay') {
      atk.action = 'stagger';
      atk.t = FIGHT.whiffStagger;
    }
    return;
  }
  if (def.action === 'guard') {
    dmg *= kind === 'jab' ? FIGHT.guardJab : FIGHT.guardHay;
    if (kind === 'hay') {
      def.action = 'stagger';
      def.t = FIGHT.guardBreak;
    }
    events.push({ type: 'punch', landed: false, heavy });
  } else {
    if (def.action === 'charge') {
      dmg *= FIGHT.chargeHitFactor;
      def.action = 'stagger';
      def.t = 10;
    } else if (kind === 'hay' || def.action === 'jab') {
      def.action = 'stagger';
      def.t = kind === 'hay' ? 14 : 8;
    }
    events.push({ type: 'punch', landed: true, heavy });
  }
  def.balance -= dmg;
  if (def.balance <= 0) {
    def.balance = 0;
    def.action = 'down';
    def.t = 0;
    fs.phase = 'over';
    fs.timer = 0;
    fs.winner = ai;
  }
}

function stepFighter(fs: FightState, i: number, inp: Input, events: GameEvent[]) {
  const f = fs.f[i];
  const aEdge = inp.a && !f.prevA;
  const bEdge = inp.b && !f.prevB;
  f.prevA = inp.a;
  f.prevB = inp.b;

  switch (f.action) {
    case 'ready':
      f.stamina = Math.min(100, f.stamina + FIGHT.staminaRegen);
      if (inp.y > 0.5 && f.stamina > 1) f.action = 'guard';
      else if (inp.y < -0.5 && f.stamina >= FIGHT.leanCost) {
        f.action = 'lean';
        f.t = 0;
        f.stamina -= FIGHT.leanCost;
      } else if (aEdge && f.stamina >= FIGHT.jabCost) {
        f.action = 'jab';
        f.t = 0;
        f.stamina -= FIGHT.jabCost;
      } else if (bEdge && f.stamina >= FIGHT.hayCost) {
        f.action = 'charge';
        f.charge = 0;
      }
      break;
    case 'guard':
      f.stamina -= FIGHT.guardDrain;
      if (inp.y <= 0.5 || f.stamina <= 0) {
        f.stamina = Math.max(0, f.stamina);
        f.action = 'ready';
      }
      break;
    case 'charge':
      f.charge = Math.min(FIGHT.hayMaxCharge, f.charge + 1);
      if (!inp.b) {
        if (f.charge >= FIGHT.hayMinCharge) {
          f.action = 'hay';
          f.t = 0;
          f.stamina -= FIGHT.hayCost;
        } else f.action = 'ready';
      }
      break;
    case 'jab':
      if (++f.t === FIGHT.jabWindup) land(fs, i, 'jab', events);
      if (f.action === 'jab' && f.t >= FIGHT.jabTotal) f.action = 'ready';
      break;
    case 'hay':
      if (++f.t === FIGHT.haySwing) land(fs, i, 'hay', events);
      if (f.action === 'hay' && f.t >= FIGHT.hayTotal) f.action = 'ready';
      break;
    case 'lean':
      if (++f.t >= FIGHT.leanTotal) f.action = 'ready';
      break;
    case 'stagger':
      if (--f.t <= 0) f.action = 'ready';
      break;
    case 'down':
      break;
  }
  if (f.action !== 'down') f.balance = Math.min(100, f.balance + FIGHT.balanceRegen);
}

// Advances one frame. Returns true once the fight has finished and its outro has played.
export function stepFight(fs: FightState, inputs: [Input, Input], events: GameEvent[], outro: number): boolean {
  if (fs.phase === 'intro') {
    if (--fs.timer <= 0) {
      fs.phase = 'brawl';
      fs.timer = 0;
    }
    return false;
  }
  if (fs.phase === 'over') return ++fs.timer >= outro;

  fs.timer++;
  // Both fighters act on the same frame; order alternates so neither side always lands first.
  const first = fs.timer & 1;
  stepFighter(fs, first, inputs[first], events);
  if (fs.phase === 'brawl') stepFighter(fs, 1 - first, inputs[1 - first], events);
  if (fs.phase === 'brawl' && fs.timer >= FIGHT.maxFrames) {
    const d = fs.f[0].balance - fs.f[1].balance;
    fs.winner = Math.abs(d) > FIGHT.pointsMargin ? (d > 0 ? 0 : 1) : -1;
    fs.phase = 'over';
    fs.timer = 0;
  }
  return false;
}
