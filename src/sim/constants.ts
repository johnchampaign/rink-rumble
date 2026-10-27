// Every tunable number in the simulation. Units are world pixels and 60 Hz frames.
// Tune against `npm run sim`, whose targets are listed in docs/DESIGN.md.

export const FPS = 60;

// Rink: origin at centre ice, +x to the right, +y down.
export const RINK = {
  halfW: 320,
  halfH: 136,
  corner: 60, // corner radius of the boards
  goalX: 280, // goal lines at x = ±goalX
  netHalfW: 17, // half the width of the net mouth
  netDepth: 14,
  creaseR: 28,
  blueX: 92,
  circleR: 30,
} as const;

export const SKATER = {
  radius: 7,
  baseSpeed: 1.85, // + speedStep × speed rating
  speedStep: 0.12,
  baseAccel: 0.11,
  accelStep: 0.01,
  carryFactor: 0.92, // top speed while carrying the puck
  chargeFactor: 0.55, // top speed while winding up a slap shot
  coast: 0.982, // velocity kept per frame with no input
  overspeedDecay: 0.94, // how fast a lunge boost bleeds off
  stickReach: 9, // puck sits this far in front of the skater
  pickupRadius: 7,
  releaseCooldown: 14, // frames before the shooter or passer can touch the puck again
  downFrames: 60, // time on the ice after being knocked flat
};

export const SHOT = {
  wrist: 5.6,
  slap: 8.8,
  chargeMax: 40,
  wristUnder: 8, // a hold shorter than this is a wrist shot
  pass: 4.8,
  passLead: 14, // frames of receiver motion to lead a pass by
  aimNoiseBase: 0.11, // radians, minus aimNoiseStep × shooting rating
  aimNoiseStep: 0.018,
  slapNoiseFactor: 1.4,
};

export const PUCK = {
  radius: 2,
  friction: 0.988,
  boardBounce: 0.62,
  netBounce: 0.35,
  hardToCatch: 5.5, // above this speed a pickup can fail
  deadFrames: 300, // a puck nobody touches for this long draws a whistle
};

export const CHECK = {
  lungeFrames: 12,
  lungeBoost: 1.3,
  lungeMaxSpeed: 3.4,
  cooldown: 32,
  pokeChance: 0.32, // + pokeStep × checking rating
  pokeStep: 0.04,
  pokeRange: 15,
  hitPower: 1.0, // + hitStep × checking rating
  hitStep: 0.12,
  standBase: 3.2, // + standStep × checking rating of the player being hit
  standStep: 0.15,
  carrierPenalty: 0.4, // carriers are easier to knock over
  hardHit: 2.5, // check power that counts toward heat and momentum
  heatPerHit: 32, // + heatGrit × grit rating
  heatGrit: 4,
  heatDecay: 0.015,
  heatToFight: 50, // heat at which the base fight chance applies in full
  fightChance: 0.16, // × (heat / heatToFight)², + fightGrit × combined grit
  fightGrit: 0.008,
  fightGap: 60 * 60, // minimum frames of play between scraps
};

export const GOALIE = {
  radius: 9,
  reach: 11,
  diveReach: 18,
  diveFrames: 18,
  diveCooldown: 40,
  baseSpeed: 0.95, // + speedStep × goalie rating
  speedStep: 0.14,
  depthNear: 9, // how far off the goal line the goalie plays
  depthFar: 16,
  holdFrames: 50,
  saveBase: 0.88, // + saveStep × goalie rating
  saveStep: 0.03,
  saveSpeedCost: 0.03, // per unit of puck speed above 5
  saveOffCentreCost: 0.2, // at the post compared with right at the goalie
  saveFarBonus: 0.14, // shots from beyond farShot
  farShot: 170,
  reboundWindow: 40, // frames after a save in which a shot counts as a rebound
  reboundCost: 0.12,
  shootoutCost: 0.42, // one-on-one with nobody to clear rebounds or block the view
  catchSpeed: 5.4,
  catchChance: 0.6,
};

export const MOMENTUM = {
  hit: 8,
  shot: 5,
  save: 5,
  scrapWin: 35,
  surgeFrames: 8 * 60,
  surgeSpeed: 1.12,
  surgeShot: 1.08,
  surgeHit: 1.1,
};

export const PENALTY = {
  loser: 40 * 60,
  winner: 15 * 60,
  draw: 25 * 60,
};

export const PHASE = {
  faceoffHold: 60,
  goalCelebration: 150,
  intermission: 180,
  fightOutro: 120,
  shootoutAttempt: 8 * 60,
  shootoutResult: 70,
};

// CPU skill levels: Rookie, Pro, All-Star.
export const CPU = [
  { think: 14, aimExtra: 0.06, aggression: 0.35, goalieBonus: -0.04, fightRead: 0.25 },
  { think: 8, aimExtra: 0.02, aggression: 0.55, goalieBonus: 0, fightRead: 0.5 },
  { think: 4, aimExtra: 0, aggression: 0.75, goalieBonus: 0.03, fightRead: 0.75 },
];
