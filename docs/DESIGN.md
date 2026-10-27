# Rink Rumble: design

An original arcade ice hockey game in the spirit of the 8-bit hockey games of the late 1980s:
fast skating, hard checks, the occasional scrap, and a shootout when regulation ends tied.
Nothing here is taken from any existing game: the name, teams, rules variant, fight system,
art, sound and numbers are all our own. Every constant lives in `src/sim/constants.ts` and is
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

Six fictional clubs, each with ratings from 1 to 5 in speed, shooting, checking, grit (fighting)
and goaltending. Total rating points are close, so each team has its own personality instead of a
strict ladder.

## Modes

- **1 player vs CPU** (three CPU levels: Rookie, Pro, All-Star)
- **2 players** head to head on one keyboard, or with gamepads
- **CPU vs CPU** demo, which also doubles as the attract mode

In the shootout, a human player shoots for their own team and controls the goalie when the other
team shoots: up/down to slide, the pass button to dive.

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

## Tuning targets (CPU vs CPU, Pro level, 3-minute periods)

| Measure | Target |
|---|---|
| Goals per game (both teams) | 5 to 9 |
| Shots per team per game | 15 to 30 |
| Save percentage | 0.75 to 0.88 |
| Scraps per game | 0.5 to 1.5 |
| Frozen-puck whistles per game | under 2 |
| Games reaching a shootout | 10 to 25 percent |
| CPU shootout attempts scored | 20 to 35 percent |

Measured on 2026-10-27 over 120 games (`npm run sim 120`): 7.3 goals per game, 25.7 shots per
team, save percentage 0.842, 1.0 scraps per game, 0.03 frozen-puck whistles, 13 percent
shootouts; every club's win rate between 35 and 60 percent. CPU shootout attempts score about
23 percent of the time.
