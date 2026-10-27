// Headless games for tuning: node tools/sim.ts [games] [skill] [periodSeconds] [--human bot] [--division n]
// CPU vs CPU by default; with --human, team 0 is played by a scripted bot from tools/bots.ts
// through the human controls. Prints the averages that docs/DESIGN.md sets targets for.
import { BOTS } from './bots.ts';
import { step } from '../src/sim/game.ts';
import { newGame } from '../src/sim/state.ts';
import { DIVISIONS, teamIndex } from '../src/sim/teams.ts';

const args = process.argv.slice(2);
const hi = args.indexOf('--human');
const botName = hi >= 0 ? args.splice(hi, 2)[1] : '';
const bot = botName ? BOTS[botName] : null;
const di = args.indexOf('--division');
const division = di >= 0 ? Number(args.splice(di, 2)[1]) : 0;
const TEAMS = DIVISIONS[division].teams;
if (botName && !bot) throw new Error(`no bot ${botName}; have ${Object.keys(BOTS).join(', ')}`);
const games = Number(args[0] || 200);
const skill = Number(args[1] ?? 1);
const periodSeconds = Number(args[2] || 180);
const kinds: Record<string, number> = {};
const shotKinds: Record<string, number> = {};
const teamGoals = [0, 0];
let zeroZero = 0;

let goals = 0, shots = 0, saves = 0, scraps = 0, whistles = 0, hits = 0, knockdowns = 0, shootouts = 0, frames = 0;
const wins = new Array(TEAMS.length).fill(0);
const played = new Array(TEAMS.length).fill(0);
const t0 = Date.now();
for (let g = 0; g < games; g++) {
  const a = g % TEAMS.length;
  const b = (a + 1 + Math.floor(g / TEAMS.length) % (TEAMS.length - 1)) % TEAMS.length;
  const s = newGame({ seed: 1000 + g, humans: [!!bot, false], cpuSkill: skill, periodSeconds, teams: [teamIndex(division, a), teamIndex(division, b)] });
  let n = 0;
  while (s.phase !== 'final' && n < 60 * 60 * 60) {
    step(s, [bot ? bot(s, n) : null, null]);
    n++;
    for (const e of s.events) {
      if (e.type === 'shot') shotKinds[s.puck.kind] = (shotKinds[s.puck.kind] || 0) + 1;
      if (e.type === 'goal' && s.phase === 'goal') {
        kinds[e.kind] = (kinds[e.kind] || 0) + 1;
        teamGoals[e.team]++;
      }
    }
    if (s.phase === 'shootout' && !s.shootout!.results[0].length && !s.shootout!.results[1].length && s.shootout!.stage === 'attempt' && s.shootout!.timer === 479) shootouts++;
  }
  if (s.phase !== 'final') console.log(`game ${g} did not finish`);
  frames += n;
  const reg = s.shootout ? s.teams[0].score + s.teams[1].score - 1 : s.teams[0].score + s.teams[1].score;
  goals += reg;
  if (reg === 0) zeroZero++;
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
console.log(`${DIVISIONS[division].full}: ${games} games, skill ${skill}, ${periodSeconds}s periods${bot ? `, team 0 played by bot '${botName}'` : ''}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`goals by team ${f(teamGoals[0])} - ${f(teamGoals[1])}  0-0 games ${zeroZero}  kinds ${Object.entries(kinds).map(([k, v]) => `${k} ${f(v)}`).join('  ')}`);
console.log('goals per shot ' + Object.entries(shotKinds).map(([k, v]) => `${k} ${((kinds[k] || 0) / v).toFixed(2)} of ${f(v)}`).join('  '));
console.log(`goals/game ${f(goals)}  shots/team ${(shots / games / 2).toFixed(1)}  save% ${(saves / Math.max(1, shots)).toFixed(3)}`);
console.log(`hits/game ${f(hits)}  knockdowns ${f(knockdowns)}  scraps ${f(scraps)}  whistles ${f(whistles)}  shootouts ${(100 * shootouts / games).toFixed(0)}%`);
console.log('win% ' + TEAMS.map((t, i) => `${t.abbr} ${(100 * wins[i] / Math.max(1, played[i])).toFixed(0)}`).join('  '));
