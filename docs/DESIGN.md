# Rink Rumble: design

An original arcade ice hockey game in the spirit of the 8-bit hockey games of the late 1980s:
fast skating, hard checks, the occasional scrap, and a shootout when regulation ends tied.
Nothing here is taken from any existing game: the name, rules variant, fight system, art, sound
and numbers are all our own. The team names come from a real junior league (see Teams). Every constant lives in `src/sim/constants.ts` and is
tuned with the headless simulator (`npm run sim`), not guessed.

## Pillars

1. **Pick up and play.** Two buttons. One handles the puck (pass when you have it, check when
   you don't), the other handles shooting (tap for a wrist shot, hold for a slap shot, and
   switch skater when you don't have the puck).
2. **Small teams, big ice.** Three skaters and a goalie per side. Fewer bodies means open ice,
   breakaways and end-to-end rushes, and keeps the AI readable.
3. **Contact matters.** A good check knocks a skater flat and spills the puck. Every hard hit
   can start a fight, and repeated hard hits between the same two players build up *heat* that
   makes the next one far more likely to boil over.
4. **Every game ends with a winner.** A tie after three periods goes straight to a shootout.

## Rules variant

- 3 periods, length selectable (2, 3 or 5 minutes of game clock). Teams swap ends each period.
- No offside and no icing; the boards enclose the whole rink so the puck never leaves play.
- Every restart is a centre-ice puck drop: game start, each period, after a goal, after a fight,
  and when the puck sits dead for five seconds (a "frozen puck" whistle).
- A goalie who catches the puck holds it briefly and then outlets it to a teammate
  (no whistle), which keeps the game flowing.

## Scoring

The first build tuned goals from CPU-vs-CPU games only, where most goals came from rebounds and
scrambles. A person playing it saw clean shots stopped again and again with no clue why, and
finished 0-0. Scoring now rests on one idea the player can see and learn: **goalies stop what
hits them, so make them move.**

- A goalie stops a shot that comes straight into the body almost every time. The further the
  puck's path passes from the goalie's centre, the better its chance, steeply (squared) toward the
  edge of reach; outside reach it goes in.
- A goalie needs a moment to read a shot (10 frames minus the goalie rating) and then slides onto
  its line, so long shots give time to get set and close ones do not.
- A goalie still sliding across when the shot arrives is easier to beat, as is one screened by
  bodies in front, one facing a rebound, or one facing a **one-timer**.
- **One-timer:** press shoot as a teammate's pass arrives (up to 8 frames early, or within 10
  frames of taking it). The shot leaves at once and harder than a wrist shot.
- A hard shot only stops on a skater it hits square on; sticks don't catch it. Before this,
  defenders marking in the shooting lane caught more than half of all one-timers.
- Every goal is called out by type (one-timer, rebound, slap shot, wrist shot, scramble), a human's
  one-timer gets a callout even when it is saved, and intermissions show a scoring tip.

## Fights ("scraps")

A scrap can start when a hard body check lands; the odds grow with the square of the heat between
those two players, plus a little for each team's grit, and there is at least a minute of play
between scraps. The rink
freezes and both players square off in a side view.

| Input | Move |
|---|---|
| Pass/check button (tap) | Jab: quick, light damage |
| Shoot button (hold, release) | Haymaker: wind up, then swing; damage grows with the wind-up |
| Down | Cover up: cuts damage, drains stamina, a haymaker breaks it and staggers you |
| Up | Lean back: dodges anything thrown at you; a dodged haymaker leaves the thrower staggered |

Each fighter has **balance** (lose it all and you go down) and **stamina** (spent by attacks,
dodges and covering; low stamina weakens your punches). If nobody goes down within 15 seconds
the linesmen break it up and the player with more balance left wins on points.

Both players go to the box, unlike a one-sided penalty: the loser sits 40 seconds of game clock,
the winner 15. A draw puts both in for 25. The loser's sentence ends early if the other team
scores while they are in the box. The winner's team gains a large chunk of momentum.

## Momentum and surge (opt-out)

Each team has a momentum meter that fills from landed checks, shots on goal, saves and won
scraps. When it fills, the team **surges** for eight seconds: skaters are a little faster and
shoot and hit a little harder. The meter then empties. Turn it off in Options for a plain game.

## Teams

Teams come in divisions, chosen on the setup screen; a game is always between two teams of the
same division. Both are named after real Northern Ontario leagues. Only the names are theirs;
colours, numbers and ratings (1 to 5 in speed, shooting, checking, grit and goaltending) are the
game's own, set so each team has a personality and the simulator keeps win rates roughly even.

- **Great North U18:** the Great North U18 League, the league the North Bay Trappers U18 play
  in, as listed for 2023-24 on gnml.org: North Bay Trappers, Soo Jr. Greyhounds, Sudbury Wolves,
  Timmins Majors, Kapuskasing Flyers and New Liskeard Cubs.
- **Nickel District U11 A:** the U11 A division of the Nickel District Minor Hockey League (NOHA),
  where the East Nipissing Vipers' U11 rep team plays in 2026-27. The league had not yet published
  its 2026-27 divisions, so the nine teams are those on its 2025-26 U11 A schedule: East
  Nipissing Vipers, Copper Cliff Reds, North Bay Trappers, Northshore Thundercats (Elliot Lake),
  Nickel City Cubs, Sudbury Wolves, Sudbury Lady Wolves, Manitoulin Panthers and West Nipissing
  Sting.

## Modes

- **1 player vs CPU** (three CPU levels: Rookie, Pro, All-Star)
- **2 players** head to head on one keyboard, or with gamepads
- **CPU vs CPU** demo, which also doubles as the attract mode

In the shootout, a human player shoots for their own team and controls the goalie when the other
team shoots: up/down to slide, the pass button to dive.

## Touch play

Phones and tablets show a floating stick for the left thumb (it appears wherever the thumb lands
on the left half), PASS and SHOOT buttons for the right, and a pause button. Menus are tapped.
Phones must be held sideways; a tablet held upright shows the rink at the top with room for thumbs
below. Device detection uses the user agent first (iPadOS is told apart from a Mac by its touch
points), then a coarse pointer plus the screen's short side (under 600 CSS pixels is a phone).

## Architecture

The same split the remake projects use, minus the oracle:

- `src/sim/` is a pure, deterministic simulation. Fixed 60 Hz step, seeded RNG kept in the state,
  no DOM, no clock, no `Math.random`. `step(state, inputs)` is the only way time moves. The CPU
  produces the same `Input` structure a human does, so it gets no secret powers.
- `src/render/` and `src/audio/` only read state and the per-frame `events` list.
- `web/main.ts` owns the loop, the keyboard/gamepad and the menus.
- `tools/sim.ts` plays thousands of CPU games headless and prints the scoring, shot, save, check
  and fight rates the constants are tuned against.
- `test/` checks the physics, the rules, the fight system, the shootout and determinism.

## Tuning targets (Pro level, 3-minute periods)

`npm run sim -- <games>` plays CPU against CPU. `npm run sim -- <games> 1 180 --human <bot>` puts a
scripted player from `tools/bots.ts` on team 0 through the human controls: `rusher` carries the puck
to the slot and shoots, `playmaker` passes across and one-times. The bots handle the puck far better
than a person, so their totals run high; what matters is that the playmaker beats the rusher.

| Measure | Target |
|---|---|
| Goals per game, CPU vs CPU (both teams) | 6 to 10 |
| Shots per team per game | 15 to 30 |
| Save percentage | 0.75 to 0.85 |
| Goals per shot: wrist / one-timer / rebound | about 0.1 / 0.15 to 0.25 / 0.2 to 0.35 |
| `playmaker` goals compared with `rusher` | clearly more |
| Scraps per game | 0.5 to 1.5 |
| Frozen-puck whistles per game | under 2 |
| Games reaching a shootout | 10 to 25 percent |
| CPU shootout attempts scored | 20 to 35 percent |

Measured on 2026-10-27. CPU vs CPU over 120 games: 9.5 goals per game (5.8 wrist, 2.0 rebound,
1.4 one-timer), 25.9 shots per team, save percentage 0.794, goals per shot 0.09 wrist, 0.17
one-timer, 0.20 rebound; 1.1 scraps, 0.03 whistles, 12 percent shootouts; every club's win rate
between 38 and 65 percent. Bots over 40 games: `rusher` 9.8 goals a game to the CPU's 2.4,
`playmaker` 14.4 to 2.8 (8.2 of them one-timers). CPU shootout attempts score 29 percent.
