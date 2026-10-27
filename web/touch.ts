// On-screen controls for phones and tablets: a floating stick for the left thumb, PASS and SHOOT
// buttons for the right, a pause button, and taps on the canvas for the menus.
import type { Input } from '../src/sim/state.ts';

const STICK_DEADZONE = 0.18;

let root: HTMLDivElement;
let base: HTMLDivElement;
let knob: HTMLDivElement;
let stickId = -1;
let originX = 0;
let originY = 0;
let sx = 0;
let sy = 0;
let passHeld = false;
let shootHeld = false;
let pausePressed = false;
const taps: { x: number; y: number }[] = [];

function radius(): number {
  return base.offsetWidth / 2 || 50;
}

function placeBase(x: number, y: number) {
  base.style.left = `${x}px`;
  base.style.top = `${y}px`;
}

function restStick() {
  stickId = -1;
  sx = sy = 0;
  base.classList.remove('active');
  base.style.left = '';
  base.style.top = '';
  knob.style.transform = '';
}

function moveStick(x: number, y: number) {
  const r = radius();
  let dx = x - originX;
  let dy = y - originY;
  const d = Math.hypot(dx, dy);
  if (d > r) {
    dx = (dx / d) * r;
    dy = (dy / d) * r;
  }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  const m = Math.min(1, d / r);
  if (m < STICK_DEADZONE || d === 0) {
    sx = sy = 0;
    return;
  }
  // Rescale past the dead zone so small pushes still give fine control.
  const k = (m - STICK_DEADZONE) / (1 - STICK_DEADZONE) / m;
  sx = (dx / r) * k;
  sy = (dy / r) * k;
}

// Capture keeps a finger's moves and lifts coming to the control it started on, even after it
// slides off. It can fail for a pointer the browser no longer tracks; the control works without it.
function capture(el: HTMLElement, id: number) {
  try {
    el.setPointerCapture(id);
  } catch {}
}

function button(el: HTMLElement, set: (held: boolean) => void) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    capture(el, e.pointerId);
    el.classList.add('held');
    set(true);
  });
  const up = () => {
    el.classList.remove('held');
    set(false);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
}

export function setupTouch(canvas: HTMLCanvasElement, onAnyTouch: () => void) {
  root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `
    <div id="stick-zone"></div>
    <div id="stick-base"><div id="stick-knob"></div></div>
    <div id="btn-shoot" class="tbtn">SHOOT</div>
    <div id="btn-pass" class="tbtn">PASS</div>
    <div id="btn-pause">II</div>`;
  document.body.appendChild(root);
  base = root.querySelector('#stick-base')!;
  knob = root.querySelector('#stick-knob')!;
  const zone = root.querySelector<HTMLDivElement>('#stick-zone')!;

  // The stick appears wherever the left thumb lands, so nobody has to find it.
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (stickId !== -1) return;
    stickId = e.pointerId;
    capture(zone, e.pointerId);
    originX = e.clientX;
    originY = e.clientY;
    base.classList.add('active');
    placeBase(originX, originY);
    moveStick(e.clientX, e.clientY);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) moveStick(e.clientX, e.clientY);
  });
  const release = (e: PointerEvent) => {
    if (e.pointerId === stickId) restStick();
  };
  zone.addEventListener('pointerup', release);
  zone.addEventListener('pointercancel', release);
  zone.addEventListener('lostpointercapture', release);

  button(root.querySelector('#btn-pass')!, (h) => (passHeld = h));
  button(root.querySelector('#btn-shoot')!, (h) => (shootHeld = h));
  root.querySelector('#btn-pause')!.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pausePressed = true;
  });

  // Taps on the picture drive the menus.
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    taps.push({ x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height });
  });
  addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch') onAnyTouch();
    },
    { capture: true },
  );
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

// 'off' hides everything (desktop), 'menu' hides the controls so taps reach the menus on the
// canvas, 'play' shows the stick, buttons and pause button.
export function setTouchMode(mode: 'off' | 'menu' | 'play') {
  root.dataset.mode = mode;
  if (mode !== 'play') {
    restStick();
    passHeld = shootHeld = false;
  }
}

export function touchInput(): Input {
  return { x: sx, y: sy, a: passHeld, b: shootHeld };
}

export function takeTaps(): { x: number; y: number }[] {
  return taps.splice(0);
}

export function takePause(): boolean {
  const p = pausePressed;
  pausePressed = false;
  return p;
}
