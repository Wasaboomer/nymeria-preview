/* Inactive metadata infrastructure. Browser mutations use the common material writer. */
const MaterialBagStore = (() => {
  const contract = typeof module !== 'undefined' && module.exports
    ? require('./material-bag-contract.js') : MaterialBagContract;
  const KEY = 'nymeria.material-bag.v1';
  const LOCK = 'nymeria-material-bag-coordinator';
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$/.test(value);
  const initial = () => ({ version: 1, baseCapacity: 40, expansionIds: [] });
  // A shared queue covers participating stores in this JS realm. Web Locks, if supplied,
  // extend exclusion to participating contexts. Neither mechanism is a multi-record transaction.
  function createCoordinator({ locks = null } = {}) {
    let pending = Promise.resolve();
    return Object.freeze({
      scope: locks ? 'participating-web-lock-contexts' : 'participating-instances-only',
      run(operation) {
        if (typeof operation !== 'function') return Promise.resolve({ ok: false, code: 'invalid-operation' });
        const result = pending.then(async () => {
          try {
            return locks ? await locks.request(LOCK, operation) : await operation();
          } catch { return { ok: false, code: 'coordination-or-operation-failed' }; }
        });
        pending = result.then(() => undefined);
        return result;
      }
    });
  }
  const sharedCoordinator = createCoordinator();
  // No second metadata lock. Read/update/write takes place under the same lease
  // and progression lock used by material operations. Loading remains inactive.
  function withMaterialWriter(common) {
    return Object.freeze({
      scope: 'common-material-writer',
      run(operation) {
        if (!common) return Promise.resolve({ok:false,code:'common-coordinator-unavailable'});
        // Reject recursive acquisition; unrelated requests during an asynchronous
        // callback also fail conservatively and can be retried explicitly.
        if (common.isCoordinated()) return Promise.resolve({ok:false,code:'nested-coordination-rejected'});
        return common.run(() => common.progression(operation));
      }
    });
  }
  const browserCoordinator = Object.freeze({
    scope: 'common-material-writer',
    run: operation => withMaterialWriter(typeof MaterialWriterCoordinator === 'undefined' ? null : MaterialWriterCoordinator).run(operation)
  });
  function decode(source) {
    if (source === null) return { ok: true, state: initial(), missing: true, migrate: false };
    let raw;
    try { raw = JSON.parse(source); } catch { return { ok: false, code: 'corrupt-record' }; }
    if (!object(raw)) return { ok: false, code: 'invalid-record' };
    if (raw.version !== undefined && raw.version !== 1) return { ok: false, code: 'unsupported-version' };
    // Only missing v1 metadata can be supplied. Unknown fields are preserved by refusing
    // a rewrite; quantities or a capacity without receipts are never guessed or migrated.
    if (Object.keys(raw).some(key => !['version', 'baseCapacity', 'expansionIds'].includes(key)) ||
        (raw.baseCapacity !== undefined && raw.baseCapacity !== 40) ||
        (raw.expansionIds !== undefined && !Array.isArray(raw.expansionIds)))
      return { ok: false, code: 'invalid-record' };
    const ids = raw.expansionIds === undefined ? [] : raw.expansionIds;
    if (ids.length > 6 || ids.some(id => !validId(id)) || new Set(ids).size !== ids.length)
      return { ok: false, code: 'invalid-expansion-receipts' };
    const state = { version: 1, baseCapacity: 40, expansionIds: [...ids] };
    return { ok: true, state, missing: false,
      migrate: raw.version === undefined || raw.baseCapacity === undefined || raw.expansionIds === undefined };
  }
  function create({ storage, coordinator = typeof window === 'undefined' ? sharedCoordinator : browserCoordinator } = {}) {
    // Access is explicit, including initialization. No localStorage getter at module load.
    function read() {
      try {
        const result = decode(storage.getItem(KEY));
        return result.ok ? { ...result, capacity: contract.capacityFor(result.state.expansionIds.length) } : result;
      } catch { return { ok: false, code: 'storage-unavailable' }; }
    }
    function persist(state) {
      try { storage.setItem(KEY, JSON.stringify(state)); }
      catch { return { ok: false, code: 'write-rejected' }; }
      return { ok: true, state: copy(state), capacity: contract.capacityFor(state.expansionIds.length) };
    }
    function initialize() {
      return coordinator.run(() => {
        const result = read();
        if (!result.ok) return result;
        if (!result.missing && !result.migrate) return { ...result, unchanged: true };
        return persist(result.state);
      });
    }
    // Reserved for future authorized award sources; not connected to missions/UI.
    function grantExpansion(id) {
      if (!validId(id)) return Promise.resolve({ ok: false, code: 'invalid-expansion-id' });
      return coordinator.run(() => {
        const result = read();
        if (!result.ok) return result;
        if (result.state.expansionIds.includes(id)) return { ...result, unchanged: true };
        if (result.state.expansionIds.length === 6) return { ok: false, code: 'capacity-maximum' };
        const next = copy(result.state);
        next.expansionIds.push(id);
        return persist(next);
      });
    }
    return Object.freeze({ read, initialize, grantExpansion, coordinationScope: coordinator.scope });
  }
  return Object.freeze({ KEY, LOCK, initial, decode, createCoordinator, withMaterialWriter, create });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MaterialBagStore;
