/* Durable discovery feedback, derived from the isolated Guild Projects ledger.
   Never modifies projects or the player's economy. Writes share the M7 guild lease. */
const WorldDiscoveryEngine = (() => {
  const KEY = "nymeria.world-discovery.v1", VERSION = 1;
  const RULES = { "vesper-outpost": { scope: "guild", type: "GUILD_PROJECT", projectId: "vesper-watchtower" } };
  const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const copy = v => JSON.parse(JSON.stringify(v));
  const empty = () => ({ version: VERSION, discovered: {}, acknowledged: {} });
  function normalize(raw) {
    const state = empty();
    if (!object(raw) || raw.version !== VERSION) return state;
    for (const [id, rule] of Object.entries(RULES)) {
      const row = object(raw.discovered) ? raw.discovered[id] : null;
      if (!object(row) || row.scope !== rule.scope || row.source !== rule.projectId || !Number.isSafeInteger(row.discoveredAt) || row.discoveredAt <= 0) continue;
      state.discovered[id] = { scope: rule.scope, source: rule.projectId, discoveredAt: row.discoveredAt };
      if (object(raw.acknowledged) && raw.acknowledged[id] === true) state.acknowledged[id] = true;
    }
    return state;
  }
  function create({ storage = {
    getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value),
  }, projects, exclusive = run => run(), now = Date.now } = {}) {
    let state = empty(), storageIssue = false, pending = Promise.resolve();
    const listeners = new Set();
    const eligible = id => !!RULES[id] && projects()?.projects?.[RULES[id].projectId]?.completed === true;
    function emit() { for (const fn of listeners) { try { fn(copy(state)); } catch {} } }
    function read() {
      try {
        const source = storage.getItem(KEY);
        let raw = null;
        try { raw = JSON.parse(source || "null"); } catch { /* Recover only this ledger, retaining the completed source project. */ }
        if (object(raw) && raw.version !== undefined && raw.version !== VERSION) return { ok: false, message: "Versione discovery non supportata." };
        return { ok: true, state: normalize(raw) };
      } catch { return { ok: false, message: "Salvataggio discovery non disponibile." }; }
    }
    function load() {
      const latest = read(); storageIssue = !latest.ok;
      if (latest.ok) state = latest.state;
      emit(); return copy(state);
    }
    function transact(change) {
      const operation = pending.then(() => exclusive(() => {
        const latest = read();
        if (!latest.ok) { storageIssue = true; emit(); return latest; }
        state = latest.state;
        const next = copy(state), result = change(next);
        if (!result.ok || result.unchanged) { storageIssue = false; emit(); return result; }
        try { storage.setItem(KEY, JSON.stringify(next)); }
        catch { storageIssue = true; emit(); return { ok: false, message: "Salvataggio discovery non riuscito. Puoi riprovare." }; }
        state = next; storageIssue = false; emit(); return result;
      })).catch(() => ({ ok: false, message: "Discovery modificabile soltanto dalla scheda attiva della gilda." }));
      pending = operation.then(() => undefined);
      return operation;
    }
    function reconcile() {
      // Pure read/no-op reconciliation must not claim the guild writer lease.
      const latest = read(); storageIssue = !latest.ok;
      if (!latest.ok) { emit(); return Promise.resolve(latest); }
      state = latest.state; emit();
      if (!Object.keys(RULES).some(id => eligible(id) && !state.discovered[id])) return Promise.resolve({ ok: true, unchanged: true });
      return transact(next => {
        let changed = false;
        for (const [id, rule] of Object.entries(RULES)) {
          if (eligible(id) && !next.discovered[id]) {
            next.discovered[id] = { scope: rule.scope, source: rule.projectId, discoveredAt: now() };
            changed = true;
          }
        }
        return { ok: true, unchanged: !changed };
      });
    }
    function acknowledge(id) {
      return transact(next => {
        if (!eligible(id) || !next.discovered[id]) return { ok: false };
        if (next.acknowledged[id]) return { ok: true, unchanged: true, claimed: false };
        next.acknowledged[id] = true;
        return { ok: true, claimed: true };
      });
    }
    load();
    return { KEY, RULES, normalize, load, reconcile, acknowledge,
      get state() { return copy(state); }, get storageIssue() { return storageIssue; },
      discovered: id => !!state.discovered[id] && eligible(id),
      accessible: id => !!state.discovered[id] && eligible(id),
      pending: () => Object.keys(state.discovered).filter(id => eligible(id) && !state.acknowledged[id]),
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  }
  return { KEY, RULES, empty, normalize, create };
})();
const WorldDiscovery = typeof window !== "undefined" ? WorldDiscoveryEngine.create({
  projects: () => typeof GuildProjectSystem !== "undefined" && GuildProjectSystem ? GuildProjectSystem.state : null,
  exclusive: run => typeof GuildTabWriter !== "undefined" ? GuildTabWriter.exclusive(run) : run(),
}) : null;
if (typeof window !== "undefined") {
  function sync() { WorldDiscovery.load(); return WorldDiscovery.reconcile(); }
  function init() {
    if (typeof GuildProjectSystem !== "undefined" && GuildProjectSystem) GuildProjectSystem.subscribe(() => WorldDiscovery.reconcile());
    sync();
    window.addEventListener("storage", event => { if (event.key === WorldDiscovery.KEY || event.key === null) sync(); });
    window.addEventListener("pageshow", () => sync());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
}
if (typeof module !== "undefined" && module.exports) module.exports = WorldDiscoveryEngine;
