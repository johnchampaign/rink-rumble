// Works out whether the game is running on a phone, a tablet or a desktop.
// `?device=phone|tablet|desktop` in the URL overrides it, for testing.

export type DeviceKind = 'phone' | 'tablet' | 'desktop';

export function detectDevice(): DeviceKind {
  const forced = new URLSearchParams(location.search).get('device');
  if (forced === 'phone' || forced === 'tablet' || forced === 'desktop') return forced;

  const ua = navigator.userAgent;
  const touchPoints = navigator.maxTouchPoints || 0;
  const coarse = matchMedia('(pointer: coarse)').matches;
  // iPhones also say "like Mac OS X", so they are sorted out first.
  if (/iPhone|iPod/.test(ua)) return 'phone';
  // iPadOS asks for desktop sites by default and claims to be a Mac; only touch support gives it
  // away (no Mac has a touch screen).
  const macLike = /Macintosh|Mac OS X/.test(ua) || navigator.platform === 'MacIntel';
  if (/iPad/.test(ua) || (macLike && (touchPoints > 1 || 'ontouchend' in document))) return 'tablet';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'phone' : 'tablet';
  // Anything else: a coarse main pointer means a finger is the main way in; the screen's short
  // side tells a phone from a tablet. A touchscreen laptop still has a mouse, so it stays desktop.
  if (coarse && touchPoints > 0) return Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet';
  return 'desktop';
}
