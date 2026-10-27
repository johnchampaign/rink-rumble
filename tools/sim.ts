// Headless CPU-vs-CPU games for tuning: node tools/sim.ts [games] [skill] [periodSeconds]
// Prints the averages that docs/DESIGN.md sets targets for.
import { step } from '../src/sim/game.ts';
import { newGame } from '../src/sim/state.ts';
import { TEAMS } from '../src/sim/teams.ts';

const games = Number(process.argv[2] || 200);
const skill = Number(process.argv[3] ?? 1);
const periodSeconds = Number(process.argv[4] || 180);

let goals = 0, shots = 0, saves = 0, scraps = 0, whistles = 0, hits = 0, knockdowns = 0, shootouts = 0, frames = 0;
const wins = new Array(TEAMS.length).fill(0);
const played = new Array(TEAMS.length).fill(0);
const t0 = Date.now();
for (let g = 0; g < games; g++) {
  const a = g % TEAMS.length;
  const b = (a + 1 + Math.floor(g / TEAMS.length) % (TEAMS.length - 1)) % TEAMS.length;
  const s = newGame({ seed: 1000 + g, humans: [false, false], cpuSkill: skill, periodSeconds, teams: [a, b] });
  let n = 0;
  while (s.phase !== 'final' && n < 60 * 60 * 60) {
    step(s, [null, null]);
    n++;
    if (s.phase === 'shootout' && !s.shootout!.results[0].length && !s.shootout!.results[1].length && s.shootout!.stage === 'attempt' && s.shootout!.timer === 479) shootouts++;
  }
  if (s.phase !== 'final') console.log(`game ${g} did not finish`);
  frames += n;
  const reg = s.shootout ? s.teams[0].score + s.teams[1].score - 1 : s.teams[0].score + s.teams[1].score;
  goals += reg;
  shots += s.teams[0].shots + s.teams[1].shots;
  saves += s.stats.saves;
  scraps += s.stats.scraps;
  whistles += s.stats.whistles;
  hits += s.stats.hits;
  knockdowns += s.stats.knockdowns;
  played[a]++;
  played[b]++;
  wins[s.teams[s.winner].def === TEAMS[a] ? a : b]++;
}
const f = (x: number) => (x / games).toFixed(2);
console.log(`${games} games, skill ${skill}, ${periodSeconds}s periods, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`goals/game ${f(goals)}  shots/team ${(shots / games / 2).toFixed(1)}  save% ${(saves / Math.max(1, shots)).toFixed(3)}`);
console.log(`hits/game ${f(hits)}  knockdowns ${f(knockdowns)}  scraps ${f(scraps)}  whistles ${f(whistles)}  shootouts ${(100 * shootouts / games).toFixed(0)}%`);
console.log('win% ' + TEAMS.map((t, i) => `${t.abbr} ${(100 * wins[i] / Math.max(1, played[i])).toFixed(0)}`).join('  '));
