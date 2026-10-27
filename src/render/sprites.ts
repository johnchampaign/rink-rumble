// Procedural pixel sprites: skaters, goalies, the puck and the big scrap fighters.
// Coordinates are relative to a sprite's feet, with y growing downward like the screen.
import type { FightAction } from '../sim/fight.ts';

export interface Kit {
  jersey: string;
  stripe: string;
  pants: string;
  helmet: string;
}

const SKIN = '#e8b48a';
const SKATE = '#26262e';
const BLADE = '#d8dde6';
const STICK = '#9a6a35';
const TAPE = '#1a1a1a';
const PAD = '#f2f2f2';

type Ctx = CanvasRenderingContext2D;

function r(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

// Pixel line (Bresenham) for sticks.
function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = c;
  for (let i = 0; i < 64; i++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export function drawShadow(ctx: Ctx, x: number, y: number, w: number) {
  ctx.fillStyle = 'rgba(40,60,90,0.22)';
  ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
}

export function drawSkater(
  ctx: Ctx, x: number, y: number, facing: number, kit: Kit, stride: number, down: boolean, winding: boolean,
) {
  x = Math.round(x);
  y = Math.round(y);
  drawShadow(ctx, x, y - 1, down ? 14 : 9);
  const fx = Math.cos(facing);
  const fy = Math.sin(facing);
  if (down) {
    const flip = fx < 0 ? -1 : 1;
    const X = (dx: number, w: number) => (flip > 0 ? x + dx : x - dx - w);
    r(ctx, X(-8, 4), y - 3, 4, 2, kit.pants);
    r(ctx, X(-10, 2), y - 3, 2, 2, SKATE);
    r(ctx, X(-4, 8), y - 4, 8, 3, kit.jersey);
    r(ctx, X(-1, 1), y - 4, 1, 3, kit.stripe);
    r(ctx, X(4, 3), y - 5, 3, 3, kit.helmet);
    line(ctx, x - 2 * flip, y + 1, x + 8 * flip, y + 2, STICK);
    return;
  }
  const step = Math.floor(stride) % 2 === 0 ? 0 : 1;
  const bladeX = x + fx * 9;
  const bladeY = y + fy * 5 - 1;
  const handX = x + fx * 3;
  const handY = y - 8 + (winding ? -3 : 0);
  const stickFirst = fy < -0.3; // stick behind the body when skating away from the viewer
  if (stickFirst) drawStick(ctx, handX, handY, bladeX, bladeY, winding, fx);

  if (Math.abs(fx) >= 0.5) {
    // Side view.
    const flip = fx > 0 ? 1 : -1;
    const X = (dx: number, w: number) => (flip > 0 ? x + dx : x - dx - w);
    r(ctx, X(-3 + step, 3), y - 1, 3, 1, SKATE);
    r(ctx, X(1 - step, 3), y - 1, 3, 1, SKATE);
    r(ctx, X(-3 + step, 3), y, 3, 1, BLADE);
    r(ctx, X(1 - step, 3), y, 3, 1, BLADE);
    r(ctx, X(-2 + step, 2), y - 5, 2, 4, kit.pants);
    r(ctx, X(1 - step, 2), y - 5, 2, 4, kit.pants);
    r(ctx, X(-3, 6), y - 11, 6, 6, kit.jersey);
    r(ctx, X(-3, 6), y - 8, 6, 1, kit.stripe);
    r(ctx, X(0, 3), y - 10, 3, 2, kit.jersey);
    r(ctx, X(3, 1), y - 10, 1, 2, TAPE);
    r(ctx, X(-2, 4), y - 15, 4, 4, kit.helmet);
    r(ctx, X(1, 2), y - 13, 2, 2, SKIN);
  } else {
    // Front (facing the viewer, down the screen) or back.
    const front = fy > 0;
    r(ctx, x - 3, y - 1, 2, 1, SKATE);
    r(ctx, x + 1, y - 1, 2, 1, SKATE);
    r(ctx, x - 3, y - 5 - step, 2, 4, kit.pants);
    r(ctx, x + 1, y - 5 - (1 - step), 2, 4, kit.pants);
    r(ctx, x - 4, y - 11, 8, 6, kit.jersey);
    r(ctx, x - 4, y - 8, 8, 1, kit.stripe);
    r(ctx, x - 5, y - 10, 1, 4, kit.jersey);
    r(ctx, x + 4, y - 10, 1, 4, kit.jersey);
    r(ctx, x - 5, y - 6, 1, 1, TAPE);
    r(ctx, x + 4, y - 6, 1, 1, TAPE);
    r(ctx, x - 2, y - 15, 4, 4, kit.helmet);
    if (front) r(ctx, x - 2, y - 13, 4, 2, SKIN);
    else r(ctx, x - 1, y - 10, 2, 3, kit.stripe);
  }
  if (!stickFirst) drawStick(ctx, handX, handY, bladeX, bladeY, winding, fx);
}

function drawStick(ctx: Ctx, hx: number, hy: number, bx: number, by: number, winding: boolean, fx: number) {
  if (winding) {
    // Stick raised behind for a slap shot.
    line(ctx, hx, hy, hx - (fx >= 0 ? 7 : -7), hy - 6, STICK);
    return;
  }
  line(ctx, hx, hy, bx, by, STICK);
  r(ctx, Math.round(bx) - 1, Math.round(by), 3, 1, TAPE);
}

export function drawGoalie(ctx: Ctx, x: number, y: number, side: number, kit: Kit, diving: boolean) {
  x = Math.round(x);
  y = Math.round(y);
  const f = -side; // faces up ice
  const X = (dx: number, w: number) => (f > 0 ? x + dx : x - dx - w);
  drawShadow(ctx, x, y - 1, diving ? 18 : 12);
  if (diving) {
    r(ctx, X(-9, 7), y - 4, 7, 3, PAD);
    r(ctx, X(-9, 7), y - 3, 7, 1, kit.stripe);
    r(ctx, X(-2, 7), y - 6, 7, 5, kit.jersey);
    r(ctx, X(5, 4), y - 7, 4, 4, PAD);
    r(ctx, X(1, 3), y - 9, 3, 3, kit.stripe);
    line(ctx, X(4, 0), y, X(12, 0), y, STICK);
    return;
  }
  r(ctx, X(-4, 3), y - 6, 3, 6, PAD);
  r(ctx, X(0, 3), y - 6, 3, 6, PAD);
  r(ctx, X(-4, 3), y - 4, 3, 1, kit.stripe);
  r(ctx, X(0, 3), y - 4, 3, 1, kit.stripe);
  r(ctx, X(-4, 8), y - 13, 8, 7, kit.jersey);
  r(ctx, X(-4, 8), y - 9, 8, 1, kit.stripe);
  r(ctx, X(4, 3), y - 12, 3, 3, kit.stripe); // catching glove
  r(ctx, X(-6, 2), y - 10, 2, 3, PAD); // blocker
  r(ctx, X(-2, 5), y - 17, 5, 4, PAD); // mask
  r(ctx, X(2, 1), y - 16, 1, 2, '#7a7a86');
  line(ctx, X(3, 0), y - 6, X(3, 0), y - 1, STICK);
  line(ctx, X(3, 0), y, X(7, 0), y, STICK);
}

export function drawPuck(ctx: Ctx, x: number, y: number) {
  x = Math.round(x);
  y = Math.round(y);
  r(ctx, x - 1, y, 3, 1, 'rgba(40,60,90,0.3)');
  r(ctx, x - 1, y - 1, 3, 2, '#111');
}

// ---- Scrap fighters, drawn big ---------------------------------------------------------

export function drawFighter(
  ctx: Ctx, x: number, y: number, scale: number, dir: number, kit: Kit, action: FightAction, t: number, hurt: boolean,
) {
  const P = (dx: number, dy: number, w: number, h: number, c: string) => {
    const px = dir > 0 ? dx : -dx - w;
    ctx.fillStyle = hurt && c !== SKATE && c !== BLADE ? '#ffffff' : c;
    ctx.fillRect(Math.round(x + px * scale), Math.round(y + dy * scale), w * scale, h * scale);
  };
  if (action === 'down') {
    P(-14, -3, 6, 2, kit.pants);
    P(-16, -3, 2, 2, SKATE);
    P(-8, -5, 10, 4, kit.jersey);
    P(-8, -3, 10, 1, kit.stripe);
    P(2, -6, 5, 5, SKIN);
    P(2, -6, 5, 2, '#3a2a1a');
    P(-4, -1, 4, 1, SKIN);
    return;
  }
  // Upper-body lean for dodges, wind-ups and swings.
  const lean = action === 'lean' ? -4 : action === 'stagger' ? -2 : action === 'charge' ? -1 : action === 'hay' ? 2 : 0;
  P(-4, -1, 3, 1, SKATE);
  P(1, -1, 3, 1, SKATE);
  P(-4, 0, 3, 1, BLADE);
  P(1, 0, 3, 1, BLADE);
  P(-3, -6, 2, 5, kit.pants);
  P(1, -6, 2, 5, kit.pants);
  const U = (dx: number, dy: number, w: number, h: number, c: string) => P(dx + lean, dy, w, h, c);
  U(-4, -14, 8, 8, kit.jersey);
  U(-4, -10, 8, 1, kit.stripe);
  U(-2, -19, 5, 5, SKIN);
  U(-2, -19, 5, 2, '#3a2a1a');
  U(2, -17, 1, 1, '#1a1a1a');
  switch (action) {
    case 'jab':
      if (t < 10) {
        U(4, -15, 8, 2, kit.jersey);
        U(12, -16, 2, 3, SKIN);
      } else {
        U(3, -15, 3, 2, kit.jersey);
        U(6, -16, 2, 3, SKIN);
      }
      U(1, -17, 2, 2, SKIN);
      break;
    case 'charge':
      U(-7, -16, 4, 2, kit.jersey);
      U(-9, -17, 2, 3, SKIN);
      U(4, -15, 2, 2, SKIN);
      break;
    case 'hay':
      if (t < 12) {
        U(3, -17, 9, 2, kit.jersey);
        U(12, -18, 3, 3, SKIN);
      } else {
        U(3, -13, 4, 2, kit.jersey);
        U(7, -13, 2, 3, SKIN);
      }
      U(2, -15, 2, 2, SKIN);
      break;
    case 'guard':
      U(2, -20, 2, 3, SKIN);
      U(3, -16, 2, 3, SKIN);
      U(1, -14, 3, 2, kit.jersey);
      break;
    case 'stagger':
      U(-5, -12, 2, 4, kit.jersey);
      U(4, -12, 2, 4, kit.jersey);
      U(-5, -8, 2, 2, SKIN);
      U(4, -8, 2, 2, SKIN);
      break;
    default:
      U(4, -15, 2, 2, SKIN);
      U(2, -13, 2, 2, kit.jersey);
      U(1, -17, 2, 2, SKIN);
      break;
  }
}
