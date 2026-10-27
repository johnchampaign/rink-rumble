# Rink Rumble

An original 3-on-3 arcade ice hockey game for the browser: fast skating, hard checks, scraps
and shootouts. Everything here (name, teams, rules, fight system, art and sound) is original;
see [docs/DESIGN.md](docs/DESIGN.md).

## Run it

```bash
npm install
npm start
```

Then open http://127.0.0.1:8823/. The browser build is `web/build/main.js` (`npm run build`).

## Controls

| | One player | Two players (P1 / P2) |
|---|---|---|
| Skate | Arrows or WASD | WASD / Arrows |
| Pass, or check without the puck | J, Z or Space | F / `.` (or Right Ctrl, Numpad 1) |
| Shoot (tap wrister, hold slapper), or switch skater | K or X | G / `/` (or Right Shift, Numpad 2) |
| Pause / mute | P or Esc / M | |

Gamepads work too: stick or d-pad to skate, A to pass, B or X to shoot, Start to pause. Hold the
stick up or down as you shoot to pick a side of the net.

**How to score:** goalies stop shots that hit them, so make them move. Pass across the slot and
press shoot as the pass arrives for a one-timer, follow your shots for rebounds, and get bodies in
front of the goalie. Long slap shots at a goalie who is set rarely go in. In a scrap: pass jabs, hold-and-release shoot throws a
haymaker, down covers up, up leans back. In the shootout you shoot for your team and play goal
when the CPU shoots (up/down to slide, pass to dive).

## Layout

- `src/sim/` deterministic simulation: `game.ts` (phases, rules), `skater.ts`, `puck.ts`,
  `goalie.ts`, `ai.ts`, `fight.ts`, `shootout.ts`, `rink.ts`; all tunables in `constants.ts`,
  clubs in `teams.ts`.
- `src/render/` canvas drawing (pixel font, procedural sprites, rink art, HUD and overlays).
- `src/audio/sfx.ts` synthesised sound driven by simulation events.
- `web/main.ts` loop, input and menus. `tools/serve.ts` static server.
- `tools/sim.ts` headless games for tuning: `npm run sim -- 120`, or with a scripted human
  player from `tools/bots.ts`: `npm run sim -- 40 1 180 --human playmaker`.
- `test/` physics, scraps, shootout rules, controls, determinism and complete games: `npm test`.

## License

MIT. See [LICENSE](LICENSE).
