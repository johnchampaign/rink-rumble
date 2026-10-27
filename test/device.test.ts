// Phone, tablet or desktop, from what real browsers report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectDevice } from '../web/device.ts';

interface Browser {
  ua: string;
  platform: string;
  touchPoints: number;
  coarse: boolean;
  screen: [number, number];
  search?: string;
}

function detectAs(b: Browser) {
  const set = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { value, configurable: true });
  set('navigator', { userAgent: b.ua, platform: b.platform, maxTouchPoints: b.touchPoints });
  set('location', { search: b.search ?? '' });
  set('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)' && b.coarse }));
  set('screen', { width: b.screen[0], height: b.screen[1] });
  set('document', b.touchPoints > 0 ? { ontouchend: null } : {});
  return detectDevice();
}

const IPAD_SAFARI: Browser = {
  // iPadOS Safari asks for desktop sites, so it looks exactly like a Mac apart from touch.
  ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  platform: 'MacIntel', touchPoints: 5, coarse: true, screen: [820, 1180],
};

test('an iPad is a tablet even when Safari says it is a Mac', () => {
  assert.equal(detectAs(IPAD_SAFARI), 'tablet');
  assert.equal(detectAs({ ...IPAD_SAFARI, coarse: false }), 'tablet', 'with a trackpad attached');
  assert.equal(detectAs({
    ...IPAD_SAFARI,
    ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
    platform: 'iPad',
  }), 'tablet', 'Chrome on iPad');
});

test('an iPhone is a phone, not an iPad, though it also says "like Mac OS X"', () => {
  assert.equal(detectAs({
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    platform: 'iPhone', touchPoints: 5, coarse: true, screen: [390, 844],
  }), 'phone');
});

test('Android phones and tablets', () => {
  const base = { platform: 'Linux armv8l', touchPoints: 5, coarse: true };
  assert.equal(detectAs({ ...base, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', screen: [412, 915] }), 'phone');
  assert.equal(detectAs({ ...base, ua: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', screen: [800, 1280] }), 'tablet');
});

test('a Mac and a touchscreen laptop with a mouse are desktops', () => {
  assert.equal(detectAs({ ...IPAD_SAFARI, touchPoints: 0, coarse: false, screen: [1512, 982] }), 'desktop');
  assert.equal(detectAs({
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    platform: 'Win32', touchPoints: 10, coarse: false, screen: [1920, 1080],
  }), 'desktop');
});

test('?device= overrides detection', () => {
  assert.equal(detectAs({ ...IPAD_SAFARI, search: '?device=desktop' }), 'desktop');
});
