// The static rink picture (ice, markings, boards, nets, crowd), drawn once to an offscreen canvas.
import { RINK } from '../sim/constants.ts';
import { drawText } from './font.ts';

export const MARGIN_X = 10;
export const CROWD_TOP = 48; // world pixels of stands above the top boards
export const CROWD_BOTTOM = 30;
export const ART_W = RINK.halfW * 2 + MARGIN_X * 2;
export const ART_H = RINK.halfH * 2 + CROWD_TOP + CROWD_BOTTOM;
export const ORIGIN_X = RINK.halfW + MARGIN_X;
export const ORIGIN_Y = RINK.halfH + CROWD_TOP;

const ICE = '#e9f3fb';
const ICE_SHADE = '#dcebf6';
const RED = '#cc3333';
const BLUE = '#3355cc';
const CREASE = '#a7cff2';
const BOARD = '#f4efe2';
const KICK = '#d9a520';
const STANDS = '#232336';

type Ctx = CanvasRenderingContext2D;

function plot(ctx: Ctx, x: number, y: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x + ORIGIN_X), Math.round(y + ORIGIN_Y), 1, 1);
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x + ORIGIN_X), Math.round(y + ORIGIN_Y), w, h);
}

// Is (x, y) on the ice, inside the boards' rounded rectangle shrunk by `inset`?
function onIce(x: number, y: number, inset = 0): boolean {
  const R = RINK.corner - inset;
  const hw = RINK.halfW - inset;
  const hh = RINK.halfH - inset;
  const cx = Math.max(-(hw - R), Math.min(hw - R, x));
  const cy = Math.max(-(hh - R), Math.min(hh - R, y));
  return Math.hypot(x - cx, y - cy) <= R;
}

function circle(ctx: Ctx, cx: number, cy: number, rad: number, c: string, fill = false) {
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      const d = Math.hypot(x, y);
      if (fill ? d <= rad + 0.3 : Math.abs(d - rad) < 0.55) {
        if (onIce(cx + x, cy + y)) plot(ctx, cx + x, cy + y, c);
      }
    }
  }
}

function crease(ctx: Ctx, side: number) {
  const gx = side * RINK.goalX;
  for (let y = -RINK.creaseR; y <= RINK.creaseR; y++) {
    for (let x = 0; x <= RINK.creaseR; x++) {
      const d = Math.hypot(x, y);
      if (d > RINK.creaseR + 0.3) continue;
      const px = gx - side * x;
      plot(ctx, px, y, Math.abs(d - RINK.creaseR) < 0.6 ? RED : CREASE);
    }
  }
}

function net(ctx: Ctx, side: number) {
  const x0 = Math.min(side * RINK.goalX, side * (RINK.goalX + RINK.netDepth));
  const h = RINK.netHalfW;
  for (let y = -h; y <= h; y++) {
    for (let x = 0; x <= RINK.netDepth; x++) {
      const edge = y === -h || y === h || (side > 0 ? x === RINK.netDepth : x === 0);
      if (edge) plot(ctx, x0 + x, y, RED);
      else if ((x + y) % 2 === 0) plot(ctx, x0 + x, y, '#c4ccd6');
    }
  }
}

export function drawCrowd(ctx: Ctx, y0: number, rows: number, seed: number) {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const shirts = ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#8e44ad', '#ecf0f1', '#e67e22', '#16a085', '#7f8c8d'];
  const skins = ['#f0c8a0', '#d9a07a', '#b07850', '#8a5a3a', '#f5d6b8'];
  for (let row = 0; row < rows; row++) {
    for (let x = 2; x < ART_W - 2; x += 5) {
      if (rand() < 0.08) continue;
      const px = x + Math.floor(rand() * 2);
      const py = y0 + row * 8;
      ctx.fillStyle = shirts[Math.floor(rand() * shirts.length)];
      ctx.fillRect(px, py + 3, 4, 4);
      ctx.fillStyle = skins[Math.floor(rand() * skins.length)];
      ctx.fillRect(px + 1, py, 2, 3);
    }
  }
}

export function buildRinkArt(homeAbbr: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = ART_W;
  c.height = ART_H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = STANDS;
  ctx.fillRect(0, 0, ART_W, ART_H);
  drawCrowd(ctx, 4, 5, 7);
  drawCrowd(ctx, ART_H - CROWD_BOTTOM + 8, 3, 99);

  // Boards and ice.
  for (let y = -RINK.halfH - 5; y <= RINK.halfH + 5; y++) {
    for (let x = -RINK.halfW - 5; x <= RINK.halfW + 5; x++) {
      if (onIce(x, y)) plot(ctx, x, y, (x * 7 + y * 13) % 29 === 0 ? ICE_SHADE : ICE);
      else if (onIce(x, y, -2)) plot(ctx, x, y, KICK);
      else if (onIce(x, y, -5)) plot(ctx, x, y, BOARD);
    }
  }

  // Lines.
  for (let y = -RINK.halfH; y <= RINK.halfH; y++) {
    for (let w = -1; w <= 1; w++) if (onIce(w, y)) plot(ctx, w, y, (y & 3) === 0 ? '#e9a0a0' : RED);
    for (const side of [-1, 1]) {
      for (let w = 0; w < 4; w++) if (onIce(side * RINK.blueX + w - 2, y)) plot(ctx, side * RINK.blueX + w - 2, y, BLUE);
      if (onIce(side * RINK.goalX, y)) plot(ctx, side * RINK.goalX, y, RED);
    }
  }

  circle(ctx, 0, 0, RINK.circleR, BLUE);
  circle(ctx, 0, 0, 2, BLUE, true);
  for (const side of [-1, 1]) {
    crease(ctx, side);
    for (const sy of [-1, 1]) {
      const fx = side * (RINK.goalX - 62);
      const fy = sy * 58;
      circle(ctx, fx, fy, 24, RED);
      circle(ctx, fx, fy, 2, RED, true);
      circle(ctx, side * (RINK.blueX + 18), fy, 2, RED, true);
    }
    net(ctx, side);
  }
  drawText(ctx, homeAbbr, ORIGIN_X, ORIGIN_Y - 3, '#b9cbe0', 1, 'center');
  return c;
}
