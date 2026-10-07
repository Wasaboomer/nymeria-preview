/* M7.1 isolated collective-project ledger. Never debits player resources. */
const GuildProjectEngine = (() => {
  const data = typeof module !== "undefined" && module.exports ? require("./guild-project-data.js") : GuildProjectData;
  const KEY = "nymeria.guild-projects.v1";
  const copy = (v) => JSON.parse(JSON.stringify(v));
  const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const blankProgress = (project) => Object.fromEntries(Object.keys(project.requirements).map((k) => [k, 0]));
  const empty = () => ({ version: data.schemaVersion, projects: {} });
  function normalize(raw) {
    const state = empty();
    if (!object(raw) || raw.version !== data.schemaVersion || !object(raw.projects)) return state;
    for (const project of data.projects) {
      const row = raw.projects[project.id];
      if (!object(row)) continue;
      const progress = blankProgress(project);
      for (const key of Object.keys(progress)) {
        const value = object(row.progress) ? row.progress[key] : 0;
        const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
        progress[key] = Math.max(0, Math.min(project.requirements[key], n));
      }
      const completed = Object.keys(progress).every((k) => progress[k] >= project.requirements[k]);
      state.projects[project.id] = { progress, completed, completedAt: completed && Number.isSafeInteger(row.completedAt) && row.completedAt > 0 ? row.completedAt : 0 };
    }
    return state;
  }
  function create({ storage = {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  }, exclusive = (run) => run(), now = Date.now } = {}) {
    let state = empty(), storageIssue = false, pending = Promise.resolve();
    const listeners = new Set();
    function emit() { for (const fn of listeners) { try { fn(copy(state)); } catch {} } }
    function read() {
      try {
        const source = storage.getItem(KEY);
        let raw = null;
        try { raw = JSON.parse(source || "null"); } catch { /* Recover malformed JSON to an empty prototype ledger. */ }
        if (object(raw) && raw.version !== undefined && raw.version !== data.schemaVersion)
          return { ok: false, message: "Versione del salvataggio progetti non supportata. Nessun dato sovrascritto." };
        return { ok: true, state: normalize(raw) };
      } catch { return { ok: false, message: "Salvataggio progetto non disponibile. Nessuna modifica applicata." }; }
    }
    function load() {
      const result = read();
      storageIssue = !result.ok;
      if (result.ok) state = result.state;
      emit();
      return copy(state);
    }
    function contribute(projectId, kind, value) {
      const operation = pending.then(() => exclusive(() => {
        const project = data.byId(projectId);
        const validValue = typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value.trim()));
        const amount = validValue ? Number(value) : NaN;
        if (!project || !Object.prototype.hasOwnProperty.call(project.requirements, kind) || !Number.isInteger(amount) || amount < 1 || amount > 9999)
          return { ok: false, message: "Contributo non valido." };
        const latest = read();
        if (!latest.ok) { storageIssue = true; emit(); return latest; }
        state = latest.state;
        const current = state.projects[projectId] || { progress: blankProgress(project), completed: false, completedAt: 0 };
        if (current.completed) return { ok: false, message: "Progetto già completato." };
        const remaining = project.requirements[kind] - current.progress[kind];
        if (remaining <= 0) return { ok: false, message: "Questa risorsa è già completa." };
        const applied = Math.min(amount, remaining);
        const next = copy(state);
        next.projects[projectId] = copy(current);
        next.projects[projectId].progress[kind] += applied;
        const completed = Object.keys(project.requirements).every((k) => next.projects[projectId].progress[k] >= project.requirements[k]);
        next.projects[projectId].completed = completed;
        if (completed) next.projects[projectId].completedAt = now();
        try { storage.setItem(KEY, JSON.stringify(next)); }
        catch { storageIssue = true; emit(); return { ok: false, message: "Salvataggio progetto non disponibile. Nessuna modifica applicata." }; }
        state = next; storageIssue = false; emit();
        return { ok: true, applied, completed, message: completed ? project.name + " completato! " + project.reward : applied + " unità aggiunte al progetto." };
      })).catch(() => ({ ok: false, message: "Operazione progetto non disponibile. Nessuna modifica applicata." }));
      pending = operation.then(() => undefined);
      return operation;
    }
    load();
    return { KEY, get state(){ return copy(state); }, get storageIssue(){ return storageIssue; }, load, contribute, subscribe(fn){ listeners.add(fn); return () => listeners.delete(fn); } };
  }
  return { KEY, empty, normalize, create };
})();
const GuildProjectSystem = typeof window !== "undefined" ? GuildProjectEngine.create({ exclusive: GuildTabWriter.exclusive }) : null;
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => { if (event.key === GuildProjectEngine.KEY || event.key === null) GuildProjectSystem.load(); });
  window.addEventListener("pageshow", (event) => { if (event.persisted) GuildProjectSystem.load(); });
}
if (typeof module !== "undefined" && module.exports) module.exports = GuildProjectEngine;
