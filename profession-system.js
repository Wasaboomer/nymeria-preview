/* Isolated profession ledger. All costs, outputs, XP and discoveries commit together. */
const ProfessionEngine = (() => {
  const data = typeof module !== "undefined" && module.exports ? require("./profession-data.js") : ProfessionData;
  const safety = typeof module !== "undefined" && module.exports ? require("./save-record-safety.js") : SaveRecordSafety;
  const KEY = "nymeria.professions.v1", MAX_MATERIAL = 1e6;
  const copy = v => JSON.parse(JSON.stringify(v));
  const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const canonical = value => JSON.stringify(value, (_key, v) => object(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  const threshold = level => 50 + (level - 1) * 35;
  const capXP = p => Array.from({ length: p.maxLevel - 1 }, (_, i) => threshold(i + 1)).reduce((s, n) => s + n, 0);
  function growth(p, total) {
    const totalXP = Math.min(capXP(p), Math.max(0, Number.isFinite(total) ? Math.floor(total) : 0));
    let level = 1, xp = totalXP;
    while (level < p.maxLevel && xp >= threshold(level)) { xp -= threshold(level); level++; }
    return { level, xp: level === p.maxLevel ? 0 : xp, totalXP };
  }
  const empty = () => ({ version: data.schemaVersion, professions: Object.fromEntries(data.professions.map(p => [p.id, growth(p, 0)])), materials: {}, discoveries: [], deliveries: {} });
  function normalize(raw) {
    const s = empty();
    if (!object(raw) || (raw.version !== undefined && ![1, data.schemaVersion].includes(raw.version))) return s;
    for (const p of data.professions) {
      const row = object(raw.professions) ? raw.professions[p.id] : null;
      if (!object(row)) continue;
      let total = row.totalXP;
      if (!Number.isFinite(total)) {
        const level = Number.isInteger(row.level) ? Math.max(1, Math.min(p.maxLevel, row.level)) : 1;
        total = Array.from({ length: level - 1 }, (_, i) => threshold(i + 1)).reduce((s, n) => s + n, 0) + (Number.isFinite(row.xp) ? Math.max(0, row.xp) : 0);
      }
      s.professions[p.id] = growth(p, total);
    }
    for (const m of data.materials) {
      const value = object(raw.materials) ? raw.materials[m.id] : null;
      if (Number.isSafeInteger(value) && value >= 0) s.materials[m.id] = Math.min(MAX_MATERIAL, value);
    }
    const known = new Set(data.recipes.map(r => r.discovery).filter(Boolean));
    if (Array.isArray(raw.discoveries)) s.discoveries = [...new Set(raw.discoveries.filter(id => known.has(id)))];
    for (const delivery of data.deliveries || []) {
      const receipt = raw.deliveries?.[delivery.questId];
      if (receipt?.material === delivery.material && receipt.amount === delivery.amount)
        s.deliveries[delivery.questId] = {material:delivery.material, amount:delivery.amount};
    }
    return s;
  }
  function create({ storage = { getItem: k => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) }, context = () => null, exclusive = run => run(), materialAdmission = null } = {}) {
    let state = empty(), storageIssue = false, recovered = false, pending = Promise.resolve(), recordStatus = "absent";
    const listeners = new Set();
    function emit() { for (const fn of listeners) { try { fn(copy(state)); } catch {} } }
    function read() {
      try {
        const source = storage.getItem(KEY);
        const inspected = safety.classify(source, {versions:[undefined,1,data.schemaVersion], normalize, quantityPaths:[['materials']]});
        recordStatus=inspected.kind;
        if(!inspected.ok)return {ok:false,message:inspected.message};
        return {ok:true,state:inspected.state,recovered:false};
      } catch { recordStatus="storage-unavailable"; return { ok: false, message: "Profession storage unavailable. No changes applied." }; }
    }
    function load() {
      const r = read(); storageIssue = !r.ok;
      if (r.ok) { state = r.state; recovered = r.recovered; }
      emit(); return copy(state);
    }
    function transact(change) {
      const operation = pending.then(() => exclusive(() => {
        const r = read();
        if (!r.ok) { storageIssue = true; emit(); return r; }
        state = r.state; recovered = r.recovered;
        const place = context();
        if (place?.traveling) return {ok:false, message:'Concludi il viaggio prima di raccogliere o creare.'};
        if (!place || !place.accessible || place.activeEncounter) return { ok: false, message: "Reach an accessible gathering site and finish the encounter first." };
        const next = copy(state), result = change(next, place);
        if (!result.ok) return result;
        // A durable delivery receipt needs no second profession write on recovery.
        // Do not bypass admission or persistence if a mutator actually changed data.
        if (result.unchanged && canonical(next) === canonical(state)) {
          storageIssue = false; emit(); return result;
        }
        if (materialAdmission !== null) {
          let admission;
          try { admission = materialAdmission(copy(state), copy(next)); } catch { admission={ok:false}; }
          if (admission && typeof admission.then === "function") { Promise.resolve(admission).catch(()=>{}); admission={ok:false}; }
          if (admission?.ok !== true || typeof admission?.then === "function") return {ok:false,code:admission?.code || "capacity-check-unavailable",message:admission?.message || "Controllo Borsa non disponibile: nessuna modifica applicata."};
        }
        try { storage.setItem(KEY, JSON.stringify(next)); }
        catch { storageIssue = true; emit(); return { ok: false, message: "Profession save unavailable. No changes applied." }; }
        state = next; storageIssue = false; recovered = false; emit(); return result;
      })).catch(() => ({ ok: false, message: "Profession operation unavailable. No changes applied." }));
      pending = operation.then(() => undefined); return operation;
    }
    const award = (next, id, amount) => { next.professions[id] = growth(data.profession(id), next.professions[id].totalXP + amount); };
    function gather(nodeId) {
      return transact((next, place) => {
        const n = data.node(nodeId);
        if (!n) return { ok: false, message: "Unknown gathering node." };
        if (n.location !== place.location) return { ok: false, message: "Travel to the gathering site first." };
        const value = (next.materials[n.material] || 0) + n.amount;
        if (value > MAX_MATERIAL) return { ok: false, message: "Material storage limit reached." };
        next.materials[n.material] = value; award(next, n.profession, n.xp);
        return { ok: true, material: n.material, amount: n.amount };
      });
    }
    function craft(recipeId) {
      return transact(next => {
        const r = data.recipe(recipeId);
        if (!r) return { ok: false, message: "Unknown recipe." };
        if (r.discovery && next.discoveries.includes(r.discovery)) return { ok: false, message: "This chart has already been assembled." };
        if (next.professions[r.profession].level < r.level) return { ok: false, message: "Profession level too low." };
        for (const [k, v] of Object.entries(r.costs)) if ((next.materials[k] || 0) < v) return { ok: false, message: "Missing materials." };
        for (const [k, v] of Object.entries(r.costs)) next.materials[k] -= v;
        for (const [k, v] of Object.entries(r.outputs || {})) {
          if ((next.materials[k] || 0) + v > MAX_MATERIAL) return { ok: false, message: "Material storage limit reached." };
          next.materials[k] = (next.materials[k] || 0) + v;
        }
        if (r.discovery) next.discoveries.push(r.discovery);
        award(next, r.profession, r.xp); return { ok: true, recipe: r.id, discovery: r.discovery || null };
      });
    }
    function handover(questId) {
      return transact((next, place) => {
        const delivery = (data.deliveries || []).find(d => d.questId === questId);
        if (!delivery || place.location !== delivery.location || place.quests?.[questId] !== 'active')
          return {ok:false, message:'Accetta la missione e raggiungi Bram prima della consegna.'};
        if (next.deliveries[questId]) return {ok:true, unchanged:true};
        if ((next.materials[delivery.material] || 0) < delivery.amount)
          return {ok:false, message:'Crea prima un Rinforzo della Frontiera nelle Professioni.'};
        next.materials[delivery.material] -= delivery.amount;
        next.deliveries[questId] = {material:delivery.material, amount:delivery.amount};
        return {ok:true};
      });
    }
    function deliveryReceipt(questId) {
      const result = read();
      return result.ok ? copy(result.state.deliveries[questId] || null) : null;
    }
    load();
    return { readSnapshot() { const r=read(); return r.ok ? {ok:true,state:copy(r.state)} : r; }, KEY, threshold, load, gather, craft, handover, deliveryReceipt, get state() { return copy(state); }, get recordStatus() { return recordStatus; }, get storageIssue() { return storageIssue; }, get recovered() { return recovered; }, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  }
  return { KEY, MAX_MATERIAL, empty, normalize, growth, threshold, create };
})();
/* Lifetime lease avoids stale localStorage caches between separate renderer processes. */
const ProfessionTabWriter = (() => {
  let owned = false, release = null;
  function suspend() { owned = false; if (release) release(); }
  if (typeof window !== "undefined") window.addEventListener("pagehide", suspend);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") suspend();
  });
  function exclusive(run) {
    if (!navigator.locks) return Promise.resolve({ok:false,message:"Sincronizzazione sicura non disponibile: scritture bloccate."});
    if (owned) return run();
    return new Promise(resolve => {
      navigator.locks.request("nymeria-profession-writer", { ifAvailable: true }, async lock => {
        if (!lock) { resolve({ ok: false, message: "Professioni gestite in un’altra scheda: chiudila o mettila in background e riprova." }); return; }
        owned = true; const lifetime = new Promise(done => release = done);
        try {
          await new Promise(done => setTimeout(done, 0));
          if (!owned) { resolve({ ok: false, message: "Scheda sospesa: nessuna modifica applicata." }); return; }
          resolve(await run()); await lifetime;
        } finally { owned = false; release = null; }
      }).catch(() => resolve({ ok: false, message: "Accesso esclusivo alle professioni non disponibile." }));
    });
  }
  return { exclusive };
})();
if (typeof module !== "undefined" && module.exports) module.exports = ProfessionEngine;
