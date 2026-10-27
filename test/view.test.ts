// The goal call-outs that teach players how goals are scored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absorbEvents, createView } from '../src/render/view.ts';
import { newGame } from '../src/sim/state.ts';

test('goal banners name the kind of shot that scored', () => {
  const s = newGame({ humans: [true, false] });
  s.phase = 'goal';
  const v = createView();
  s.events = [{ type: 'goal', team: 0, scorer: 1, kind: 'oneTimer' }];
  absorbEvents(v, s);
  assert.equal(v.banner?.text, 'GOAL!');
  assert.match(v.banner!.sub, /^#19 HBR +ONE-TIMER!$/);
  s.events = [{ type: 'goal', team: 1, scorer: 4, kind: 'rebound' }];
  absorbEvents(v, s);
  assert.match(v.banner!.sub, /ON THE REBOUND!/);
});

test("a human's one-timer gets a callout even when it is saved", () => {
  const s = newGame({ humans: [true, false] });
  const v = createView();
  s.events = [{ type: 'shot', team: 0, power: 7, kind: 'oneTimer', shooter: 2 }];
  absorbEvents(v, s);
  assert.equal(v.toasts[0]?.text, 'ONE-TIMER');
  s.events = [{ type: 'shot', team: 1, power: 7, kind: 'oneTimer', shooter: 4 }];
  absorbEvents(v, s);
  assert.equal(v.toasts.length, 1, 'no callout for the CPU');
});
