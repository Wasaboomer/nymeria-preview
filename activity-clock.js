/* Local absolute-time replay clock. No timers, rewards or combat rules here. */
const ActivityClock = (() => {
  const LIMIT_MS = 180000; // Existing World encounter simulation ceiling.
  const validTime = value => Number.isSafeInteger(value) && value >= 0 && value <= 1e15;
  const speed = value => [1, 2, 4].includes(value) ? value : 1;
  function normalize(raw) {
    if (!raw || raw.version !== 1 || !validTime(raw.anchorAt) ||
        !Number.isFinite(raw.elapsedMs) || raw.elapsedMs < 0 || raw.elapsedMs > LIMIT_MS ||
        typeof raw.running !== 'boolean' || ![1, 2, 4].includes(raw.speed)) return null;
    return {version: 1, elapsedMs: raw.elapsedMs, anchorAt: raw.anchorAt, running: raw.running, speed: raw.speed};
  }
  function create(at, rate = 1, running = true) {
    if (!validTime(at)) return null;
    return {version: 1, elapsedMs: 0, anchorAt: at, running, speed: speed(rate)};
  }
  function elapsed(raw, at) {
    const clock = normalize(raw);
    if (!clock) return 0; // Legacy/malformed clocks require explicit resume.
    const delta = clock.running && validTime(at) ? Math.max(0, at - clock.anchorAt) * clock.speed : 0;
    return Math.min(LIMIT_MS, clock.elapsedMs + delta);
  }
  function transition(raw, at, running, rate) {
    if (!validTime(at)) return null;
    const clock = normalize(raw);
    return {version: 1, elapsedMs: elapsed(clock, at),
      // A backwards clock does not earn time again when it catches up.
      anchorAt: Math.max(at, clock?.anchorAt || 0), running,
      speed: speed(rate ?? clock?.speed)};
  }
  return {LIMIT_MS, validTime, normalize, create, elapsed, transition};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ActivityClock;
