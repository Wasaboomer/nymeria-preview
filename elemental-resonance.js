/* Inactive foundation. Pure, immutable encounter-time state; no storage or engine hooks.
 * Time is finite non-negative seconds on one logical encounter clock, not wall time.
 * Duration is supplied by the caller: this module defines no balance value.
 */
const ElementalResonance = (() => {
  const elements = Object.freeze(["fire", "water", "earth", "air"]);
  const labels = Object.freeze({ fire: "Fuoco", water: "Acqua", earth: "Terra", air: "Aria" });
  const create = () => ({ version: 1, nextOrder: 1, traces: [] });
  const timeValid = value => Number.isFinite(value) && value >= 0;
  function checked(state, now) {
    if (!timeValid(now) || state?.version !== 1 ||
        !Number.isSafeInteger(state.nextOrder) || state.nextOrder < 1 ||
        !Array.isArray(state.traces) || state.traces.length > elements.length)
      throw new Error("Invalid resonance state or time");
    const seen = new Set(), orders = new Set();
    for (const trace of state.traces) {
      if (!elements.includes(trace.element) || seen.has(trace.element) ||
          !timeValid(trace.expiresAt) || !Number.isSafeInteger(trace.order) ||
          trace.order < 1 || trace.order >= state.nextOrder || orders.has(trace.order))
        throw new Error("Invalid elemental trace");
      seen.add(trace.element); orders.add(trace.order);
    }
    return { version: 1, nextOrder: state.nextOrder, traces: state.traces.map(t => ({ ...t })) };
  }
  function active(state, now) {
    return checked(state, now).traces.filter(trace => trace.expiresAt > now);
  }
  function apply(state, element, { now, duration } = {}) {
    const next = checked(state, now);
    if (!elements.includes(element) || !Number.isFinite(duration) || duration <= 0 ||
        !Number.isFinite(now + duration) || now + duration <= now ||
        next.nextOrder >= Number.MAX_SAFE_INTEGER)
      throw new Error("Invalid element, duration or application order");
    next.traces = next.traces.filter(t => t.expiresAt > now && t.element !== element);
    next.traces.push({ element, expiresAt: now + duration, order: next.nextOrder++ });
    return next;
  }
  function select(state, now) {
    const traces = active(state, now).sort((a, b) =>
      a.expiresAt - b.expiresAt || elements.indexOf(a.element) - elements.indexOf(b.element));
    return traces.length >= 2 ? traces.slice(0, 2) : null;
  }
  function consume(state, now) {
    const next = checked(state, now), pair = select(next, now);
    if (!pair) return { ok: false, reason: "twoDistinctElementsRequired", pair: null, state: next };
    const consumed = new Set(pair.map(t => t.element));
    next.traces = next.traces.filter(t => !consumed.has(t.element));
    // Caller receives one complete replacement. No mutable intermediate state,
    // mana, cooldown, cross-store transaction or Convergence effect is implied.
    return { ok: true, pair, state: next };
  }
  return Object.freeze({ elements, labels, create, active, apply, select, consume });
})();
if (typeof module !== "undefined" && module.exports) module.exports = ElementalResonance;
