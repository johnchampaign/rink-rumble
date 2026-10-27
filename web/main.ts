// Browser shell: fixed-step loop, keyboard and gamepad input, menus.
import { isMuted, menuBlip, playEvents, setMuted, unlockAudio } from '../src/audio/sfx.ts';
import { drawText } from '../src/render/font.ts';
import { P_COLORS, VIEW_H, VIEW_W, absorbEvents, createView, kitFor, render, type View } from '../src/render/view.ts';
import { drawSkater } from '../src/render/sprites.ts';
import { step } from '../src/sim/game.ts';
import { NO_INPUT, newGame, type GameState, type Input } from '../src/sim/state.ts';
import { TEAMS } from '../src/sim/teams.ts';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = VIEW_W;
canvas.height = VIEW_H;
ctx.imageSmoothingEnabled = false;

function fit() {
  const s = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
  const scale = s >= 1 ? Math.floor(s) : s;
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
}
addEventListener('resize', fit);
fit();

// ---- Input ---------------------------------------------------------------------------

const down = new Set<string>();
const pressed = new Set<string>(); // keys pressed since the last frame, for menus
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!e.repeat) pressed.add(e.code);
  down.add(e.code);
  unlockAudio();
});
addEventListener('keyup', (e) => down.delete(e.code));
addEventListener('blur', () => down.clear());
canvas.addEventListener('pointerdown', () => {
  unlockAudio();
  canvas.focus();
});

interface KeyMap {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  a: string[];
  b: string[];
}

const SOLO: KeyMap = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  a: ['KeyJ', 'KeyZ', 'Space'], b: ['KeyK', 'KeyX'],
};
const DUO: KeyMap[] = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], a: ['KeyF'], b: ['KeyG'] },
  {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    a: ['Period', 'Numpad1', 'ControlRight'], b: ['Slash', 'Numpad2', 'ShiftRight'],
  },
];

const any = (codes: string[]) => codes.some((c) => down.has(c));

function padInput(index: number): Input | null {
  const pads = navigator.getGamepads ? navigator.getGamepads().filter((p) => p) : [];
  const p = pads[index];
  if (!p) return null;
  let x = p.axes[0] ?? 0;
  let y = p.axes[1] ?? 0;
  if (Math.hypot(x, y) < 0.25) x = y = 0;
  const b = (i: number) => !!p.buttons[i]?.pressed;
  if (b(14)) x = -1;
  if (b(15)) x = 1;
  if (b(12)) y = -1;
  if (b(13)) y = 1;
  return { x, y, a: b(0), b: b(1) || b(2) };
}

function keyInput(m: KeyMap): Input {
  let x = (any(m.right) ? 1 : 0) - (any(m.left) ? 1 : 0);
  let y = (any(m.down) ? 1 : 0) - (any(m.up) ? 1 : 0);
  if (x && y) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y, a: any(m.a), b: any(m.b) };
}

function merge(a: Input, b: Input | null): Input {
  if (!b) return a;
  return {
    x: Math.abs(b.x) > Math.abs(a.x) ? b.x : a.x,
    y: Math.abs(b.y) > Math.abs(a.y) ? b.y : a.y,
    a: a.a || b.a,
    b: a.b || b.b,
  };
}

function playerInput(player: number, players: number): Input {
  if (players === 1) return merge(keyInput(SOLO), padInput(0));
  return merge(keyInput(DUO[player]), padInput(player));
}

// Menu edges from keyboard or the first gamepad.
let padPrev = { up: false, down: false, left: false, right: false, ok: false, back: false, start: false };
function menuKeys() {
  const p = navigator.getGamepads ? navigator.getGamepads().find((g) => g) : null;
  const now = {
    up: !!p && ((p.axes[1] ?? 0) < -0.6 || !!p.buttons[12]?.pressed),
    down: !!p && ((p.axes[1] ?? 0) > 0.6 || !!p.buttons[13]?.pressed),
    left: !!p && ((p.axes[0] ?? 0) < -0.6 || !!p.buttons[14]?.pressed),
    right: !!p && ((p.axes[0] ?? 0) > 0.6 || !!p.buttons[15]?.pressed),
    ok: !!p && !!p.buttons[0]?.pressed,
    back: !!p && !!p.buttons[1]?.pressed,
    start: !!p && !!p.buttons[9]?.pressed,
  };
  const edge = (k: keyof typeof now) => now[k] && !padPrev[k];
  const has = (...codes: string[]) => codes.some((c) => pressed.has(c));
  const out = {
    up: has('ArrowUp', 'KeyW') || edge('up'),
    down: has('ArrowDown', 'KeyS') || edge('down'),
    left: has('ArrowLeft', 'KeyA') || edge('left'),
    right: has('ArrowRight', 'KeyD') || edge('right'),
    ok: has('Enter', 'Space', 'KeyJ', 'KeyF', 'NumpadEnter') || edge('ok') || edge('start'),
    back: has('Escape', 'Backspace') || edge('back'),
    pause: has('Escape', 'KeyP') || edge('start'),
  };
  padPrev = now;
  return out;
}

// ---- Settings ------------------------------------------------------------------------

interface Setup {
  mode: number; // 0 one player, 1 two players, 2 CPU vs CPU
  home: number;
  away: number;
  cpu: number;
  period: number; // index into PERIODS
  scraps: boolean;
  surge: boolean;
}

const PERIODS = [2, 3, 5];
const MODES = ['1 PLAYER VS CPU', '2 PLAYERS', 'CPU VS CPU'];
const LEVELS = ['ROOKIE', 'PRO', 'ALL-STAR'];

let setup: Setup = { mode: 0, home: 0, away: 1, cpu: 1, period: 1, scraps: true, surge: true };
try {
  const saved = localStorage.getItem('rinkrumble.setup');
  if (saved) setup = { ...setup, ...JSON.parse(saved) };
} catch {}
function saveSetup() {
  try {
    localStorage.setItem('rinkrumble.setup', JSON.stringify(setup));
  } catch {}
}

// ---- Screens -------------------------------------------------------------------------

type Screen = 'title' | 'setup' | 'game' | 'paused';
let screen: Screen = 'title';
let menuRow = 0;
let pauseRow = 0;
let game: GameState = demoGame();
let view: View = createView();
let tick = 0;
let demoOver = 0;

function demoGame(): GameState {
  const a = Math.floor(Math.random() * TEAMS.length);
  const b = (a + 1 + Math.floor(Math.random() * (TEAMS.length - 1))) % TEAMS.length;
  return newGame({ humans: [false, false], teams: [a, b], seed: (Math.random() * 1e9) | 0, periodSeconds: 120 });
}

function startGame() {
  saveSetup();
  game = newGame({
    humans: setup.mode === 0 ? [true, false] : setup.mode === 1 ? [true, true] : [false, false],
    teams: [setup.home, setup.away],
    cpuSkill: setup.cpu,
    periodSeconds: PERIODS[setup.period] * 60,
    fights: setup.scraps,
    surge: setup.surge,
    seed: (Math.random() * 1e9) | 0,
  });
  view = createView();
  screen = 'game';
}

function simFrame() {
  const players = game.options.humans[1] ? 2 : 1;
  const inputs: (Input | null)[] = [
    game.options.humans[0] ? playerInput(0, players) : null,
    game.options.humans[1] ? playerInput(1, players) : null,
  ];
  step(game, inputs);
  absorbEvents(view, game);
  if (screen === 'game') playEvents(game.events);
}

function updateTitle(keys: ReturnType<typeof menuKeys>) {
  simFrame();
  if (game.phase === 'final' && ++demoOver > 300) {
    demoOver = 0;
    game = demoGame();
    view = createView();
  }
  if (keys.ok) {
    menuBlip();
    screen = 'setup';
    menuRow = 0;
  }
}

const SETUP_ROWS = 8;
function updateSetup(keys: ReturnType<typeof menuKeys>) {
  if (keys.up) menuRow = (menuRow + SETUP_ROWS - 1) % SETUP_ROWS;
  if (keys.down) menuRow = (menuRow + 1) % SETUP_ROWS;
  const d = keys.left ? -1 : keys.right ? 1 : 0;
  if (keys.up || keys.down || d) menuBlip(d >= 0);
  const wrap = (v: number, n: number) => (v + d + n) % n;
  if (d) {
    switch (menuRow) {
      case 0: setup.mode = wrap(setup.mode, 3); break;
      case 1: setup.home = wrap(setup.home, TEAMS.length); break;
      case 2: setup.away = wrap(setup.away, TEAMS.length); break;
      case 3: setup.cpu = wrap(setup.cpu, 3); break;
      case 4: setup.period = wrap(setup.period, PERIODS.length); break;
      case 5: setup.scraps = !setup.scraps; break;
      case 6: setup.surge = !setup.surge; break;
    }
  }
  if (keys.ok) {
    if (menuRow === 7 || menuRow === 0) startGame();
    else menuRow = 7;
    menuBlip();
  }
  if (keys.back) {
    screen = 'title';
    game = demoGame();
    view = createView();
  }
}

function updateGame(keys: ReturnType<typeof menuKeys>) {
  if (pressed.has('KeyM')) setMuted(!isMuted());
  if (game.phase === 'final') {
    simFrame();
    if (keys.ok) {
      screen = 'setup';
      menuRow = 7;
    }
    return;
  }
  if (keys.pause) {
    screen = 'paused';
    pauseRow = 0;
    return;
  }
  simFrame();
}

function updatePaused(keys: ReturnType<typeof menuKeys>) {
  if (pressed.has('KeyM')) setMuted(!isMuted());
  if (keys.up || keys.down) pauseRow = 1 - pauseRow;
  if (keys.pause) {
    screen = 'game';
    return;
  }
  if (keys.ok) {
    if (pauseRow === 0) screen = 'game';
    else {
      screen = 'setup';
      menuRow = 7;
    }
  }
}

// ---- Drawing the menus ---------------------------------------------------------------

function panel(x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(8,8,20,0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#3a3a5a';
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
}

function drawTitle() {
  render(ctx, game, view);
  ctx.fillStyle = 'rgba(4,4,16,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(ctx, 'RINK', VIEW_W / 2, 34, '#ffffff', 5, 'center', '#1a3a7a');
  drawText(ctx, 'RUMBLE', VIEW_W / 2, 76, '#ff6a3a', 5, 'center', '#5a1a0a');
  drawText(ctx, '3-ON-3 ARCADE HOCKEY', VIEW_W / 2, 124, '#cfe0ff', 1, 'center');
  if ((tick >> 5) & 1) drawText(ctx, 'PRESS ENTER', VIEW_W / 2, 156, '#ffe14a', 2, 'center', '#000');
  drawText(ctx, 'AN ORIGINAL GAME', VIEW_W / 2, 200, '#7a7a96', 1, 'center');
}

function ratingBars(x: number, y: number, team: number) {
  const d = TEAMS[team];
  const rows: [string, number][] = [['SPD', d.speed], ['SHT', d.shooting], ['CHK', d.checking], ['GRT', d.grit], ['GOL', d.goalie]];
  rows.forEach(([label, v], i) => {
    drawText(ctx, label, x, y + i * 9, '#9fb0c8');
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = j < v ? '#ffe14a' : '#33334a';
      ctx.fillRect(x + 22 + j * 7, y + i * 9 + 1, 5, 5);
    }
  });
}

function drawSetup() {
  ctx.fillStyle = '#10101e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(ctx, 'GAME SETUP', VIEW_W / 2, 8, '#ffffff', 2, 'center');
  const rows: [string, string][] = [
    ['MODE', MODES[setup.mode]],
    [setup.mode === 1 ? 'P1 TEAM' : setup.mode === 0 ? 'YOUR TEAM' : 'HOME', `${TEAMS[setup.home].city} ${TEAMS[setup.home].name}`],
    [setup.mode === 1 ? 'P2 TEAM' : setup.mode === 0 ? 'CPU TEAM' : 'AWAY', `${TEAMS[setup.away].city} ${TEAMS[setup.away].name}`],
    ['CPU LEVEL', setup.mode === 1 ? '-' : LEVELS[setup.cpu]],
    ['PERIODS', `3 X ${PERIODS[setup.period]} MIN`],
    ['SCRAPS', setup.scraps ? 'ON' : 'OFF'],
    ['SURGE', setup.surge ? 'ON' : 'OFF'],
    ['', 'START GAME'],
  ];
  rows.forEach(([label, value], i) => {
    const y = 30 + i * 13;
    const sel = i === menuRow;
    if (sel) {
      ctx.fillStyle = '#26264a';
      ctx.fillRect(14, y - 3, 220, 13);
    }
    drawText(ctx, label, 20, y, sel ? '#ffe14a' : '#9fb0c8');
    drawText(ctx, i === 7 ? value : `< ${value} >`, i === 7 ? 124 : 82, y, sel ? '#ffffff' : '#cfd8e8', 1, i === 7 ? 'center' : 'left');
  });

  // Team previews with their kits and ratings.
  const fake = newGame({ teams: [setup.home, setup.away] });
  for (const t of [0, 1]) {
    const x = 250 + t * 66;
    const kit = kitFor(fake, t);
    ctx.fillStyle = '#1a1a30';
    ctx.fillRect(x - 4, 26, 62, 100);
    drawSkater(ctx, x + 27, 56, t === 0 ? 0.0 : Math.PI, kit, (tick >> 3) & 1, false, false);
    drawText(ctx, TEAMS[t === 0 ? setup.home : setup.away].abbr, x + 27, 62, '#ffffff', 1, 'center');
    ratingBars(x, 76, t === 0 ? setup.home : setup.away);
  }

  panel(8, 140, VIEW_W - 16, 70);
  if (setup.mode === 1) {
    drawText(ctx, 'P1: WASD MOVE  F PASS/CHECK  G SHOOT/SWITCH', 16, 148, P_COLORS[0]);
    drawText(ctx, 'P2: ARROWS  . PASS/CHECK  / SHOOT/SWITCH', 16, 160, P_COLORS[1]);
    drawText(ctx, '(OR RIGHT CTRL / RIGHT SHIFT, OR GAMEPADS)', 16, 172, '#7a7a96');
  } else {
    drawText(ctx, 'MOVE: ARROWS OR WASD     GAMEPAD WORKS TOO', 16, 148, '#cfd8e8');
    drawText(ctx, 'J / Z / SPACE: PASS, OR CHECK WITHOUT PUCK', 16, 160, '#cfd8e8');
    drawText(ctx, 'K / X: TAP WRISTER, HOLD SLAPPER, OR SWITCH', 16, 172, '#cfd8e8');
  }
  drawText(ctx, 'SCORE: PASS ACROSS, SHOOT AS IT ARRIVES (ONE-TIMER)', 16, 184, '#8fe08f');
  drawText(ctx, 'P / ESC: PAUSE    M: MUTE    ENTER: START', 16, 196, '#7a7a96');
}

function drawPaused() {
  render(ctx, game, view);
  panel(VIEW_W / 2 - 80, 70, 160, 70);
  drawText(ctx, 'PAUSED', VIEW_W / 2, 80, '#ffffff', 2, 'center');
  ['RESUME', 'QUIT TO MENU'].forEach((t, i) => {
    drawText(ctx, (i === pauseRow ? '> ' : '  ') + t, VIEW_W / 2 - 40, 104 + i * 12, i === pauseRow ? '#ffe14a' : '#cfd8e8');
  });
  drawText(ctx, isMuted() ? 'SOUND OFF (M)' : 'SOUND ON (M)', VIEW_W / 2, 130, '#7a7a96', 1, 'center');
}

// ---- Loop ----------------------------------------------------------------------------

const STEP = 1000 / 60;
let last = performance.now();
let acc = 0;

function frame(now: number) {
  acc += Math.min(250, now - last);
  last = now;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    acc -= STEP;
    steps++;
    tick++;
    const keys = menuKeys();
    switch (screen) {
      case 'title': updateTitle(keys); break;
      case 'setup': updateSetup(keys); break;
      case 'game': updateGame(keys); break;
      case 'paused': updatePaused(keys); break;
    }
    pressed.clear();
  }
  if (steps > 0) {
    switch (screen) {
      case 'title': drawTitle(); break;
      case 'setup': drawSetup(); break;
      case 'game': render(ctx, game, view); break;
      case 'paused': drawPaused(); break;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.getElementById('msg')?.remove();
canvas.focus();

// Debug handle for poking at the running game from the console.
(window as unknown as { rinkRumble: object }).rinkRumble = {
  get state() {
    return game;
  },
  get screen() {
    return screen;
  },
  NO_INPUT,
};
