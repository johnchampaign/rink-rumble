// The six clubs. Ratings run 1 to 5. Balance is checked with `npm run sim`, not by point totals:
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

export const TEAMS: TeamDef[] = [
  { city: 'Harbor', name: 'Gulls', abbr: 'HBR', primary: '#1f8a8a', secondary: '#f2f2e8', trim: '#0d3d4a',
    speed: 4, shooting: 4, checking: 2, grit: 2, goalie: 3, numbers: [7, 19, 4] },
  { city: 'Ironwood', name: 'Jacks', abbr: 'IRW', primary: '#b3261e', secondary: '#1a1a1a', trim: '#f2d16b',
    speed: 3, shooting: 4, checking: 5, grit: 4, goalie: 3, numbers: [22, 9, 55] },
  { city: 'Glacier Bay', name: 'Yetis', abbr: 'GLB', primary: '#8fd0f0', secondary: '#ffffff', trim: '#204a7a',
    speed: 3, shooting: 3, checking: 3, grit: 3, goalie: 5, numbers: [31, 12, 6] },
  { city: 'Redrock', name: 'Rams', abbr: 'RDR', primary: '#7a1f3d', secondary: '#e8b030', trim: '#2a0c16',
    speed: 3, shooting: 5, checking: 3, grit: 3, goalie: 2, numbers: [10, 88, 2] },
  { city: 'Pinecrest', name: 'Owls', abbr: 'PNC', primary: '#2f6b2f', secondary: '#f0d850', trim: '#13301a',
    speed: 5, shooting: 3, checking: 2, grit: 2, goalie: 4, numbers: [18, 27, 3] },
  { city: 'Neon City', name: 'Volts', abbr: 'NEO', primary: '#5b2a9a', secondary: '#9cf03a', trim: '#1c0c33',
    speed: 4, shooting: 4, checking: 3, grit: 3, goalie: 3, numbers: [99, 14, 44] },
];
