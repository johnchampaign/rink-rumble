// Synthesised sound effects (no sample files). Driven by the simulation's per-frame events.
import type { GameEvent } from '../sim/state.ts';

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let crowd: { gain: GainNode } | null = null;
let muted = false;

export function unlockAudio() {
  if (ac) {
    if (ac.state === 'suspended') void ac.resume();
    return;
  }
  ac = new AudioContext();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ac.destination);
  startCrowd();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

function noiseBuffer(seconds: number): AudioBuffer {
  const b = ac!.createBuffer(1, Math.floor(ac!.sampleRate * seconds), ac!.sampleRate);
  const d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < d.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return b;
}

let noise: AudioBuffer | null = null;

function burst(freq: number, q: number, dur: number, vol: number, type: BiquadFilterType = 'bandpass') {
  if (!ac || !master) return;
  noise ??= noiseBuffer(1);
  const src = ac.createBufferSource();
  src.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  const t = ac.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'square', slideTo = 0, delay = 0) {
  if (!ac || !master) return;
  const o = ac.createOscillator();
  o.type = type;
  const t = ac.currentTime + delay;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function startCrowd() {
  if (!ac || !master) return;
  noise ??= noiseBuffer(1);
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(2);
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 900;
  f.Q.value = 0.6;
  const g = ac.createGain();
  g.gain.value = 0.02;
  src.connect(f).connect(g).connect(master);
  src.start();
  crowd = { gain: g };
}

function roar(level: number, seconds: number) {
  if (!ac || !crowd) return;
  const t = ac.currentTime;
  crowd.gain.gain.cancelScheduledValues(t);
  crowd.gain.gain.setValueAtTime(level, t);
  crowd.gain.gain.linearRampToValueAtTime(0.02, t + seconds);
}

function whistle() {
  if (!ac || !master) return;
  const o = ac.createOscillator();
  o.type = 'sine';
  const lfo = ac.createOscillator();
  lfo.frequency.value = 38;
  const lg = ac.createGain();
  lg.gain.value = 120;
  lfo.connect(lg).connect(o.frequency);
  o.frequency.value = 2900;
  const g = ac.createGain();
  const t = ac.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.02);
  g.gain.setValueAtTime(0.12, t + 0.32);
  g.gain.linearRampToValueAtTime(0.0001, t + 0.38);
  o.connect(g).connect(master);
  o.start(t);
  lfo.start(t);
  o.stop(t + 0.4);
  lfo.stop(t + 0.4);
}

function horn() {
  for (const f of [233, 294, 349]) tone(f, 1.6, 0.06, 'sawtooth');
}

export function playEvents(events: GameEvent[]) {
  if (!ac) return;
  for (const e of events) {
    switch (e.type) {
      case 'whistle':
        whistle();
        break;
      case 'drop':
        burst(2500, 4, 0.05, 0.25);
        break;
      case 'pass':
        burst(1800, 3, 0.06, 0.35);
        break;
      case 'shot':
        burst(1400, 2, 0.09, 0.4 + Math.min(0.4, (e.power - 5) * 0.12));
        tone(180, 0.06, 0.08, 'triangle');
        break;
      case 'board':
        burst(220, 1.5, 0.18, Math.min(0.5, 0.1 + e.speed * 0.08), 'lowpass');
        break;
      case 'post':
        tone(1320, 0.3, 0.1, 'triangle');
        tone(1980, 0.25, 0.05, 'sine');
        break;
      case 'save':
        burst(e.caught ? 600 : 1100, 2, 0.1, 0.4);
        roar(0.06, 1.2);
        break;
      case 'goal':
        horn();
        roar(0.16, 3.5);
        break;
      case 'hit':
        burst(140, 1, e.knockdown ? 0.3 : 0.15, e.knockdown ? 0.7 : 0.35, 'lowpass');
        if (e.knockdown) roar(0.08, 1.5);
        break;
      case 'poke':
        burst(2200, 5, 0.04, 0.3);
        break;
      case 'fightStart':
        roar(0.14, 5);
        tone(330, 0.12, 0.07, 'square', 220);
        break;
      case 'punch':
        burst(e.landed ? 260 : 900, 1.2, e.heavy ? 0.2 : 0.1, e.landed ? 0.6 : 0.25, e.landed ? 'lowpass' : 'bandpass');
        break;
      case 'fightEnd':
        roar(0.12, 2);
        break;
      case 'surge':
        tone(440, 0.1, 0.06, 'square');
        tone(660, 0.1, 0.06, 'square', 0, 0.1);
        tone(880, 0.18, 0.06, 'square', 0, 0.2);
        break;
      case 'periodEnd':
        horn();
        break;
      case 'shootoutResult':
        if (!e.scored) tone(300, 0.3, 0.06, 'triangle', 150);
        break;
      case 'final':
        horn();
        roar(0.12, 4);
        break;
    }
  }
}

export function menuBlip(up = true) {
  tone(up ? 880 : 660, 0.05, 0.05, 'square');
}
