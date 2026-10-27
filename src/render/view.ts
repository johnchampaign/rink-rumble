// Draws a GameState: camera, rink, players, HUD, banners and the scrap and shootout overlays.
// Reads state only; the little bit of presentation memory (camera, banners) lives in View.
import { FIGHT } from '../sim/fight.ts';
import { FPS, RINK } from '../sim/constants.ts';
import { goals } from '../sim/shootout.ts';
import { GOALIE_OWNER, onIce, type GameState } from '../sim/state.ts';
import { drawText } from './font.ts';
import { ART_H, ART_W, CROWD_TOP, ORIGIN_X, ORIGIN_Y, buildRinkArt } from './rinkart.ts';
import { drawFighter, drawGoalie, drawPuck, drawSkater, type Kit } from './sprites.ts';

export const VIEW_W = 384;
export const VIEW_H = 216;
export const HUD_H = 16;
const PLAY_H = VIEW_H - HUD_H;

export const P_COLORS = ['#ffe14a', '#4ae8ff'];

interface Banner {
  text: string;
  sub: string;
  color: string;
  timer: number;
}

export interface View {
  camX: number;
  camY: number;
  art: HTMLCanvasElement | null;
  artKey: string;
  banner: Banner | null;
  excited: number; // crowd bounce frames
}

export function createView(): View {
  return { camX: 0, camY: 0, art: null, artKey: '', banner: null, excited: 0 };
}

export function kitFor(s: GameState, team: number): Kit {
  const d = s.teams[team].def;
  // Home wears its colour, the visitors wear their light jerseys.
  return team === 0
    ? { jersey: d.primary, stripe: d.secondary, pants: d.trim, helmet: d.trim }
    : { jersey: d.secondary, stripe: d.primary, pants: d.trim, helmet: d.primary };
}

function ordinal(n: number): string {
  return n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : `${n}TH`;
}

function clockText(frames: number): string {
  const secs = Math.max(0, Math.ceil(frames / FPS));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

// Turns this frame's events into banners and crowd reactions.
export function absorbEvents(v: View, s: GameState) {
  for (const e of s.events) {
    switch (e.type) {
      case 'goal': {
        const k = e.scorer >= 0 ? s.skaters[e.scorer] : null;
        const who = k ? `#${k.number} ${s.teams[e.team].def.abbr}` : s.teams[e.team].def.name;
        v.banner = { text: 'GOAL!', sub: s.phase === 'shootout' ? `${who} SCORES` : who, color: '#ffe14a', timer: 140 };
        v.excited = 150;
        break;
      }
      case 'surge':
        v.banner = { text: 'SURGE!', sub: s.teams[e.team].def.name.toUpperCase(), color: '#ff8a3a', timer: 80 };
        v.excited = 60;
        break;
      case 'shootoutResult':
        if (!e.scored) v.banner = { text: 'NO GOAL', sub: '', color: '#e0e0e0', timer: 60 };
        break;
      case 'hit':
        if (e.knockdown) v.excited = Math.max(v.excited, 30);
        break;
      case 'fightStart':
        v.excited = 200;
        break;
    }
  }
}

function sortedSprites(s: GameState, ctx: CanvasRenderingContext2D, ox: number, oy: number) {
  const items: { y: number; draw: () => void }[] = [];
  for (const k of s.skaters) {
    if (!onIce(k)) continue;
    if (s.fight && (k.id === s.fight.f[0].skater || k.id === s.fight.f[1].skater)) continue;
    const kit = kitFor(s, k.team);
    items.push({ y: k.y, draw: () => drawSkater(ctx, k.x + ox, k.y + oy, k.facing, kit, k.stride, k.down > 0, k.charge >= 4) });
  }
  for (const g of s.goalies) {
    if (s.phase === 'shootout' && s.shootout && g.team === s.shootout.shooter) continue;
    const kit = kitFor(s, g.team);
    items.push({ y: g.y, draw: () => drawGoalie(ctx, g.x + ox, g.y + oy, s.teams[g.team].side, kit, g.dive > 0) });
  }
  const p = s.puck;
  const inNet = Math.abs(p.x) > RINK.goalX && Math.abs(p.y) < RINK.netHalfW;
  items.push({ y: p.y + (p.owner >= 0 && p.owner < GOALIE_OWNER ? 0.5 : 0) - (inNet ? 30 : 0), draw: () => drawPuck(ctx, p.x + ox, p.y + oy) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
}

export function render(ctx: CanvasRenderingContext2D, s: GameState, v: View) {
  const key = s.teams[0].def.abbr;
  if (!v.art || v.artKey !== key) {
    v.art = buildRinkArt(key);
    v.artKey = key;
  }
  if (v.excited > 0) v.excited--;
  if (v.banner && --v.banner.timer <= 0) v.banner = null;

  // Camera: follow the puck, a little ahead of it, clamped to the arena.
  const p = s.puck;
  const tx = p.x + p.vx * 12;
  const ty = p.y + p.vy * 8;
  v.camX += (tx - v.camX) * 0.1;
  v.camY += (ty - v.camY) * 0.1;
  const minX = -ORIGIN_X + VIEW_W / 2;
  const maxX = ART_W - ORIGIN_X - VIEW_W / 2;
  const minY = -ORIGIN_Y + PLAY_H / 2 + 6;
  const maxY = ART_H - ORIGIN_Y - PLAY_H / 2;
  v.camX = Math.max(minX, Math.min(maxX, v.camX));
  v.camY = Math.max(minY, Math.min(maxY, v.camY));
  const cx = Math.round(v.camX);
  const cy = Math.round(v.camY);
  const ox = VIEW_W / 2 - cx;
  const oy = HUD_H + PLAY_H / 2 - cy;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.drawImage(v.art, cx - VIEW_W / 2 + ORIGIN_X, cy - PLAY_H / 2 + ORIGIN_Y, VIEW_W, PLAY_H, 0, HUD_H, VIEW_W, PLAY_H);
  if (v.excited > 0 && (v.excited >> 3) & 1) {
    // The crowd jumps: redraw the stands one pixel higher.
    const sy = cy - PLAY_H / 2 + ORIGIN_Y;
    const h = Math.max(0, CROWD_TOP - 6 - sy);
    if (h > 0) ctx.drawImage(v.art, cx - VIEW_W / 2 + ORIGIN_X, sy, VIEW_W, h, 0, HUD_H - 1, VIEW_W, h);
  }

  sortedSprites(s, ctx, ox, oy);
  drawMarkers(ctx, s, ox, oy);
  drawHud(ctx, s);
  drawPenaltyBox(ctx, s);

  if (s.phase === 'fight' && s.fight) drawFight(ctx, s);
  if (s.phase === 'shootout' && s.shootout) drawShootoutBoard(ctx, s);
  if (s.phase === 'faceoff' && s.clock === s.options.periodSeconds * FPS && s.phaseTimer > 10) {
    bigBanner(ctx, `${ordinal(s.period)} PERIOD`, '', '#ffffff');
  }
  if (s.phase === 'shootout' && s.shootout && s.shootout.stage === 'attempt' && s.shootout.timer > 8 * FPS - 50) {
    bigBanner(ctx, 'SHOOTOUT', `${s.teams[s.shootout.shooter].def.abbr} SHOOTS`, '#ffffff');
  }
  if (v.banner && s.phase !== 'fight') bigBanner(ctx, v.banner.text, v.banner.sub, v.banner.color);
  if (s.phase === 'intermission') drawSummary(ctx, s, `END OF ${ordinal(s.period)}`);
  if (s.phase === 'final') drawSummary(ctx, s, 'FINAL');
}

function drawMarkers(ctx: CanvasRenderingContext2D, s: GameState, ox: number, oy: number) {
  for (const t of [0, 1]) {
    if (!s.options.humans[t] || s.phase === 'fight') continue;
    const id = s.active[t];
    if (id < 0 || !onIce(s.skaters[id])) continue;
    const k = s.skaters[id];
    const x = Math.round(k.x + ox);
    const y = Math.round(k.y + oy) - 20;
    ctx.fillStyle = P_COLORS[t];
    ctx.fillRect(x - 2, y, 5, 1);
    ctx.fillRect(x - 1, y + 1, 3, 1);
    ctx.fillRect(x, y + 2, 1, 1);
  }
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.fillStyle = '#0b0b14';
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = '#2a2a40';
  ctx.fillRect(0, HUD_H - 1, VIEW_W, 1);
  for (const t of [0, 1]) {
    const tm = s.teams[t];
    const kit = kitFor(s, t);
    const right = t === 1;
    const x = right ? VIEW_W - 4 : 4;
    ctx.fillStyle = kit.jersey;
    ctx.fillRect(right ? x - 6 : x, 2, 6, 7);
    ctx.fillStyle = kit.stripe;
    ctx.fillRect(right ? x - 6 : x, 5, 6, 1);
    drawText(ctx, tm.def.abbr, right ? x - 9 : x + 9, 2, '#ffffff', 1, right ? 'right' : 'left');
    drawText(ctx, String(tm.score), right ? x - 34 : x + 34, 2, '#ffe14a', 1, right ? 'right' : 'left');
    if (s.options.surge) {
      const bx = right ? x - 60 : x + 48;
      ctx.fillStyle = '#26263a';
      ctx.fillRect(right ? bx - 40 : bx, 4, 40, 3);
      const fill = tm.surge > 0 ? 40 * (tm.surge / (8 * FPS)) : (40 * tm.momentum) / 100;
      ctx.fillStyle = tm.surge > 0 ? ((s.frame >> 2) & 1 ? '#ff8a3a' : '#ffd23a') : '#ff8a3a';
      ctx.fillRect(right ? bx - fill : bx, 4, Math.round(fill), 3);
    }
  }
  const mid = VIEW_W / 2;
  const label = s.phase === 'shootout' || (s.phase === 'final' && s.shootout) ? 'SO' : ordinal(s.period);
  drawText(ctx, `${label} ${clockText(s.clock)}`, mid, 2, '#cfd8e8', 1, 'center');
}

function drawPenaltyBox(ctx: CanvasRenderingContext2D, s: GameState) {
  if (s.phase === 'shootout') return;
  for (const t of [0, 1]) {
    const boxed = s.skaters.filter((k) => k.team === t && k.penalty > 0);
    boxed.forEach((k, i) => {
      const text = `#${k.number} ${clockText(k.penalty)}`;
      const w = text.length * 6 + 4;
      const x = t === 0 ? 2 : VIEW_W - w - 2;
      const y = HUD_H + 2 + i * 10;
      ctx.fillStyle = 'rgba(10,10,20,0.75)';
      ctx.fillRect(x, y, w, 10);
      drawText(ctx, text, x + 2, y + 2, '#ff6a6a');
    });
  }
}

function bigBanner(ctx: CanvasRenderingContext2D, text: string, sub: string, color: string) {
  const y = HUD_H + 54;
  ctx.fillStyle = 'rgba(8,8,20,0.7)';
  ctx.fillRect(0, y - 6, VIEW_W, sub ? 40 : 30);
  drawText(ctx, text, VIEW_W / 2, y, color, 3, 'center', '#000');
  if (sub) drawText(ctx, sub, VIEW_W / 2, y + 25, '#ffffff', 1, 'center');
}

function drawSummary(ctx: CanvasRenderingContext2D, s: GameState, title: string) {
  const w = 220;
  const h = 96;
  const x = (VIEW_W - w) / 2;
  const y = HUD_H + 40;
  ctx.fillStyle = 'rgba(8,8,20,0.96)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#3a3a5a';
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  drawText(ctx, title, VIEW_W / 2, y + 8, '#ffffff', 2, 'center');
  const [a, b] = s.teams;
  drawText(ctx, `${a.def.city} ${a.def.name}`, x + 12, y + 34, '#ffffff');
  drawText(ctx, String(a.score), x + w - 12, y + 34, '#ffe14a', 1, 'right');
  drawText(ctx, `${b.def.city} ${b.def.name}`, x + 12, y + 46, '#ffffff');
  drawText(ctx, String(b.score), x + w - 12, y + 46, '#ffe14a', 1, 'right');
  drawText(ctx, `SHOTS ${a.shots} - ${b.shots}`, VIEW_W / 2, y + 62, '#9fb0c8', 1, 'center');
  if (s.phase === 'final') {
    const w2 = s.teams[s.winner].def;
    drawText(ctx, `${w2.name} WIN${s.shootout ? ' IN SHOOTOUT' : ''}`, VIEW_W / 2, y + 74, '#ffe14a', 1, 'center');
    drawText(ctx, 'PRESS ENTER', VIEW_W / 2, y + 86, (s.frame >> 4) & 1 ? '#ffffff' : '#7a7a90', 1, 'center');
  }
}

function drawShootoutBoard(ctx: CanvasRenderingContext2D, s: GameState) {
  const so = s.shootout!;
  const y = HUD_H + 3;
  ctx.fillStyle = 'rgba(8,8,20,0.75)';
  ctx.fillRect(VIEW_W / 2 - 70, y, 140, 24);
  for (const t of [0, 1]) {
    const ry = y + 3 + t * 10;
    drawText(ctx, s.teams[t].def.abbr, VIEW_W / 2 - 64, ry, so.shooter === t && so.stage === 'attempt' ? '#ffe14a' : '#ffffff');
    const n = Math.max(3, so.results[0].length, so.results[1].length);
    for (let i = 0; i < n; i++) {
      const r = so.results[t][i];
      const cx = VIEW_W / 2 - 38 + i * 9;
      ctx.fillStyle = r === undefined ? '#3a3a50' : r ? '#4ad66a' : '#d64a4a';
      ctx.fillRect(cx, ry, 7, 7);
    }
    drawText(ctx, String(goals(so, t)), VIEW_W / 2 + 64, ry, '#ffe14a', 1, 'right');
  }
}

function drawFight(ctx: CanvasRenderingContext2D, s: GameState) {
  const fs = s.fight!;
  ctx.fillStyle = 'rgba(0,0,10,0.6)';
  ctx.fillRect(0, HUD_H, VIEW_W, PLAY_H);
  const px = 32;
  const py = HUD_H + 16;
  const pw = VIEW_W - 64;
  const ph = PLAY_H - 30;
  ctx.fillStyle = '#16162a';
  ctx.fillRect(px, py, pw, ph);
  ctx.fillStyle = '#e9f3fb';
  ctx.fillRect(px, py + ph - 26, pw, 26);
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(px, py + ph - 40, pw, 14);
  ctx.fillStyle = '#d9a520';
  ctx.fillRect(px, py + ph - 28, pw, 2);

  const ground = py + ph - 10;
  const gap = fs.phase === 'intro' ? 24 + Math.max(0, fs.timer) * 0.6 : 24;
  for (const i of [0, 1]) {
    const f = fs.f[i];
    const k = s.skaters[f.skater];
    const kit = kitFor(s, k.team);
    const dir = i === 0 ? 1 : -1;
    const x = VIEW_W / 2 - dir * gap;
    const hurt = f.action === 'stagger' && ((s.frame >> 1) & 1) === 1 && f.t > 6;
    drawFighter(ctx, x, ground, 3, dir, kit, f.action, f.t, hurt);

    // Name, balance and stamina.
    const bx = i === 0 ? px + 8 : px + pw - 8 - 110;
    drawText(ctx, `#${k.number} ${s.teams[k.team].def.abbr}`, i === 0 ? bx : bx + 110, py + 6, '#ffffff', 1, i === 0 ? 'left' : 'right');
    ctx.fillStyle = '#33334a';
    ctx.fillRect(bx, py + 16, 110, 5);
    ctx.fillRect(bx, py + 23, 110, 3);
    const bal = Math.round((110 * f.balance) / 100);
    ctx.fillStyle = f.balance > 50 ? '#4ad66a' : f.balance > 25 ? '#e8c84a' : '#e05050';
    ctx.fillRect(i === 0 ? bx : bx + 110 - bal, py + 16, bal, 5);
    const sta = Math.round((110 * Math.max(0, f.stamina)) / 100);
    ctx.fillStyle = '#5aa0ff';
    ctx.fillRect(i === 0 ? bx : bx + 110 - sta, py + 23, sta, 3);
  }
  if (fs.phase === 'intro') drawText(ctx, 'SCRAP!', VIEW_W / 2, py + 40, '#ff6a3a', 3, 'center', '#000');
  else if (fs.phase === 'brawl') {
    const left = Math.ceil((FIGHT.maxFrames - fs.timer) / FPS);
    drawText(ctx, String(left), VIEW_W / 2, py + 8, '#9fb0c8', 1, 'center');
  } else {
    const text = fs.winner < 0 ? 'BROKEN UP' : fs.f[1 - fs.winner].action === 'down' ? 'DOWN!' : 'ON POINTS';
    drawText(ctx, text, VIEW_W / 2, py + 40, '#ffe14a', 3, 'center', '#000');
    if (fs.winner >= 0) {
      const wk = s.skaters[fs.f[fs.winner].skater];
      drawText(ctx, `#${wk.number} ${s.teams[wk.team].def.abbr} WINS THE SCRAP`, VIEW_W / 2, py + 66, '#ffffff', 1, 'center');
    }
  }
  if (fs.phase !== 'over' && (s.options.humans[0] || s.options.humans[1])) {
    drawText(ctx, 'PASS: JAB  HOLD SHOOT: HAYMAKER  DOWN: COVER  UP: LEAN', VIEW_W / 2, py + ph + 4, '#9fb0c8', 1, 'center');
  }
}
