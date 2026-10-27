// The six clubs of the Great North U18 League (Northern Ontario U18 AAA), as listed for the
// 2023-24 season on gnml.org. Only the names are theirs: colours, numbers and ratings are the
// game's own. Ratings run 1 to 5. Balance is checked with `npm run sim`, not by point totals:
// speed is worth more than checking, so the bruisers get a little more in total.

export interface TeamDef {
  name: string;
  city: string;
  abbr: string;
  primary: string;
  secondary: string;
  trim: string;
  speed: number;
  shooting: number;
  checking: number;
  grit: number;
  goalie: number;
  numbers: [number, number, number];
}

const GREAT_NORTH_U18: TeamDef[] = [
  { city: 'North Bay', name: 'Trappers', abbr: 'NBY', primary: '#1f8a8a', secondary: '#f2f2e8', trim: '#0d3d4a',
    speed: 4, shooting: 4, checking: 2, grit: 2, goalie: 3, numbers: [7, 19, 4] },
  { city: 'Soo', name: 'Jr. Greyhounds', abbr: 'SSM', primary: '#b3261e', secondary: '#1a1a1a', trim: '#f2d16b',
    speed: 3, shooting: 4, checking: 5, grit: 4, goalie: 3, numbers: [22, 9, 55] },
  { city: 'Sudbury', name: 'Wolves', abbr: 'SUD', primary: '#8fd0f0', secondary: '#ffffff', trim: '#204a7a',
    speed: 3, shooting: 3, checking: 3, grit: 3, goalie: 5, numbers: [31, 12, 6] },
  { city: 'Timmins', name: 'Majors', abbr: 'TIM', primary: '#7a1f3d', secondary: '#e8b030', trim: '#2a0c16',
    speed: 3, shooting: 5, checking: 3, grit: 3, goalie: 2, numbers: [10, 88, 2] },
  { city: 'Kapuskasing', name: 'Flyers', abbr: 'KAP', primary: '#2f6b2f', secondary: '#f0d850', trim: '#13301a',
    speed: 5, shooting: 3, checking: 2, grit: 2, goalie: 4, numbers: [18, 27, 3] },
  { city: 'New Liskeard', name: 'Cubs', abbr: 'NLK', primary: '#5b2a9a', secondary: '#9cf03a', trim: '#1c0c33',
    speed: 4, shooting: 4, checking: 3, grit: 3, goalie: 3, numbers: [99, 14, 44] },
];

// Teams are picked within a division. Match options refer to teams by their index in TEAMS,
// the divisions laid end to end.
export interface Division {
  name: string; // short enough for the setup screen
  full: string;
  teams: TeamDef[];
}

export const DIVISIONS: Division[] = [
  { name: 'GREAT NORTH U18', full: 'Great North U18 League (Northern Ontario U18 AAA)', teams: GREAT_NORTH_U18 },
];

export const TEAMS: TeamDef[] = DIVISIONS.flatMap((d) => d.teams);

// Index into TEAMS of team `i` of division `d`.
export function teamIndex(d: number, i: number): number {
  let n = 0;
  for (let k = 0; k < d; k++) n += DIVISIONS[k].teams.length;
  return n + i;
}
