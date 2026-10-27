# Rink Rumble

An original 3-on-3 arcade ice hockey game for the browser: fast skating, hard checks, scraps
and shootouts. The game, rules, fight system, art and sound are original; see
[docs/DESIGN.md](docs/DESIGN.md). The six teams take their names from the clubs of the
[Great North U18 League](https://gnml.org/) in Northern Ontario. Their colours, numbers and
ratings are made up for the game, and the game has no connection with the league or its clubs.

**Play it online:** https://johnchampaign.github.io/rink-rumble/

## Run it

```bash
npm install
npm start
```

Then open http://127.0.0.1:8823/. The browser build is `web/build/main.js` (`npm run build`).
Every push to `main` is tested, built and published to GitHub Pages by
`.github/workflows/deploy.yml`.

## Controls

| | One player | Two players (P1 / P2) |
|---|---|---|
| Skate | Arrows or WASD | WASD / Arrows |
| Pass, or check without the puck | J, Z or Space | F / `.` (or Right Ctrl, Numpad 1) |
| Shoot (tap wrister, hold slapper), or switch skater | K or X | G / `/` (or Right Shift, Numpad 2) |
| Pause / mute | P or Esc / M | |

Gamepads work too: stick or d-pad to skate, A to pass, B or X to shoot, Start to pause. Hold the
stick up or down as you shoot to pick a side of the net.

**Phones and tablets** get on-screen controls automatically: put your left thumb anywhere on the
left half to skate (the stick appears where you touch), and use the PASS and SHOOT buttons on the
right; II pauses. Menus work by tapping, including the left or right side of a setting to change
it. Phones play sideways. Teams are picked within a division, chosen on the setup screen. The game decides between phone, tablet and desktop from the browser
(`web/device.ts`); add `?device=phone`, `?device=tablet` or `?device=desktop` to the address to
override it, or set CONTROLS on the setup screen to TOUCH or KEYS / PAD (AUTO follows the
detection). A touchscreen laptop switches to touch controls the first time the screen is touched.
The title screen's bottom corner shows the detected device, the controls in use and the build.
In two-player mode the touch controls belong to player 1.

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
- `web/main.ts` loop, input and menus; `web/touch.ts` on-screen controls; `web/device.ts` phone,
  tablet or desktop detection. `tools/serve.ts` static server.
- `tools/sim.ts` headless games for tuning: `npm run sim -- 120`, or with a scripted human
  player from `tools/bots.ts`: `npm run sim -- 40 1 180 --human playmaker`.
- `test/` physics, scraps, shootout rules, controls, determinism and complete games: `npm test`.

## License

MIT. See [LICENSE](LICENSE).
