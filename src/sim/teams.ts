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

// The U11 A division of the Nickel District Minor Hockey League (NOHA), where the East Nipissing
// Vipers' U11 rep team plays, as scheduled on nickeldistricthockey.ca for 2025-26 (the league had
// not published 2026-27 divisions yet). Names only; colours, numbers and ratings are the game's own.
const NICKEL_DISTRICT_U11: TeamDef[] = [
  { city: 'East Nipissing', name: 'Vipers', abbr: 'ENV', primary: '#1e7a3c', secondary: '#e8ece4', trim: '#0c2a16',
    speed: 4, shooting: 4, checking: 3, grit: 3, goalie: 3, numbers: [11, 8, 21] },
  { city: 'Copper Cliff', name: 'Reds', abbr: 'CCR', primary: '#c0282a', secondary: '#f4f0e8', trim: '#3a0d0e',
    speed: 3, shooting: 4, checking: 2, grit: 3, goalie: 3, numbers: [9, 17, 5] },
  { city: 'North Bay', name: 'Trappers', abbr: 'NBT', primary: '#d08a1e', secondary: '#f2e6c8', trim: '#1b2a4a',
    speed: 3, shooting: 3, checking: 3, grit: 3, goalie: 4, numbers: [16, 23, 7] },
  { city: 'Northshore', name: 'Thundercats', abbr: 'NST', primary: '#3a3f9a', secondary: '#f0d850', trim: '#141838',
    speed: 4, shooting: 4, checking: 2, grit: 2, goalie: 3, numbers: [12, 91, 4] },
  { city: 'Nickel City', name: 'Cubs', abbr: 'NCC', primary: '#2a5ab0', secondary: '#ffffff', trim: '#102040',
    speed: 3, shooting: 3, checking: 4, grit: 3, goalie: 3, numbers: [14, 2, 27] },
  { city: 'Sudbury', name: 'Wolves', abbr: 'SUW', primary: '#244a9a', secondary: '#cfd8e8', trim: '#0e1e44',
    speed: 3, shooting: 4, checking: 3, grit: 2, goalie: 3, numbers: [19, 10, 3] },
  { city: 'Sudbury', name: 'Lady Wolves', abbr: 'SLW', primary: '#7a2a8a', secondary: '#f0e8f4', trim: '#2a0c33',
    speed: 4, shooting: 3, checking: 2, grit: 2, goalie: 4, numbers: [22, 13, 6] },
  { city: 'Manitoulin', name: 'Panthers', abbr: 'MAN', primary: '#1a1a1a', secondary: '#e8b030', trim: '#3a3a3a',
    speed: 3, shooting: 3, checking: 4, grit: 4, goalie: 3, numbers: [15, 24, 8] },
  { city: 'West Nipissing', name: 'Sting', abbr: 'WNS', primary: '#e0c020', secondary: '#1a1a1a', trim: '#5a4a08',
    speed: 4, shooting: 3, checking: 3, grit: 3, goalie: 3, numbers: [18, 20, 33] },
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
  { name: 'NICKEL DIST U11 A', full: 'Nickel District Minor Hockey League U11 A (NOHA)', teams: NICKEL_DISTRICT_U11 },
];

export const TEAMS: TeamDef[] = DIVISIONS.flatMap((d) => d.teams);

// Index into TEAMS of team `i` of division `d`.
export function teamIndex(d: number, i: number): number {
  let n = 0;
  for (let k = 0; k < d; k++) n += DIVISIONS[k].teams.length;
  return n + i;
}
