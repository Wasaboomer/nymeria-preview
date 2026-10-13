/* Inactive Material Bag v1. Pure projections and plans; never reads/writes storage. */
const MaterialBagContract = (() => {
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  const catalog = freeze([
    ['progression', 'iron', 'Ferro del Vespro'],
    ['progression', 'fiber', 'Fibra Lunare'],
    ['progression', 'ether', 'Polvere d’Etere'],
    ['profession', 'raw-iron', 'Ferro grezzo'],
    ['profession', 'forged-iron', 'Ferro forgiato'],
    ['profession', 'wild-herbs', 'Erbe selvatiche'],
    ['profession', 'weathered-map-fragment', 'Frammento di mappa consumato'],
    ['profession', 'frontier-brace', 'Rinforzo della Frontiera'],
  ].map(([owner, id, name]) => ({ key: `${owner}:${id}`, id, name, owner, quantityPath: ['materials', id] })));
  const limits = freeze({ initial: 40, increment: 10, maximum: 100 });
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const quantity = value => Number.isSafeInteger(value) && value >= 0;
  const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function capacityFor(expansions = 0) {
    if (!Number.isInteger(expansions) || expansions < 0 || expansions > 6) throw new RangeError('Invalid expansion count');
    return limits.initial + limits.increment * expansions;
  }
  function validateCatalog(entries) {
    if (!Array.isArray(entries)) throw new TypeError('Invalid material catalog');
    const keys = new Set();
    for (const row of entries) {
      if (!object(row) || !['progression', 'profession'].includes(row.owner) ||
          typeof row.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(row.id) ||
          row.key !== `${row.owner}:${row.id}` || keys.has(row.key)) throw new TypeError('Invalid material identity');
      keys.add(row.key);
    }
    return keys;
  }
  // Receives existing ledger snapshots. Currency, quest supplies and equipment are outside materials.
  function inspect(ledgers, { expansions = 0, entries = catalog } = {}) {
    const capacity = capacityFor(expansions), keys = validateCatalog(entries), issues = [], balances = {};
    if (!object(ledgers)) return { ok: false, issues: [{ code: 'invalid-ledgers' }] };
    for (const owner of ['progression', 'profession']) {
      const ledger = ledgers[owner];
      if (ledger === undefined) continue;
      if (!object(ledger) || (ledger.materials !== undefined && !object(ledger.materials))) {
        issues.push({ code: 'invalid-ledger', owner }); continue;
      }
      for (const [id, amount] of Object.entries(ledger.materials || {})) {
        const key = `${owner}:${id}`;
        if (!keys.has(key)) issues.push({ code: 'unknown-material', key });
        else if (!quantity(amount)) issues.push({ code: 'invalid-quantity', key });
        else balances[key] = amount;
      }
    }
    if (issues.length) return { ok: false, issues }; // Never silently drop unknown holdings.
    const occupied = Object.values(balances).filter(amount => amount > 0).length;
    return { ok: true, balances, occupied, capacity, available: Math.max(0, capacity - occupied), overCapacity: occupied > capacity };
  }
  function plan(ledgers, operation, options = {}) {
    const before = inspect(ledgers, options);
    if (!before.ok) return { ok: false, code: 'invalid-state', issues: before.issues, retryable: false };
    if (!object(operation)) return { ok: false, code: 'invalid-operation', retryable: false };
    const keys = validateCatalog(options.entries || catalog), totals = { consumes: {}, produces: {} };
    for (const kind of ['consumes', 'produces']) {
      const rows = operation[kind] === undefined ? [] : operation[kind];
      if (!Array.isArray(rows)) return { ok: false, code: 'invalid-operation', retryable: false };
      for (const row of rows) {
        if (!object(row) || !keys.has(row.key) || !quantity(row.quantity))
          return { ok: false, code: 'invalid-operation', retryable: false };
        const sum = (totals[kind][row.key] || 0) + row.quantity;
        if (!quantity(sum)) return { ok: false, code: 'quantity-overflow', retryable: false };
        totals[kind][row.key] = sum;
      }
    }
    const balances = { ...before.balances };
    for (const [key, amount] of Object.entries(totals.consumes)) {
      if ((balances[key] || 0) < amount) return { ok: false, code: 'insufficient-materials', key, retryable: false };
      balances[key] = (balances[key] || 0) - amount;
    }
    for (const [key, amount] of Object.entries(totals.produces)) {
      const sum = (balances[key] || 0) + amount;
      if (!quantity(sum)) return { ok: false, code: 'quantity-overflow', retryable: false };
      balances[key] = sum;
    }
    const occupied = Object.values(balances).filter(amount => amount > 0).length;
    if (occupied > before.capacity) return { ok: false, code: 'capacity-exceeded', retryable: true, capacity: before.capacity, required: occupied };
    return { ok: true, beforeOccupied: before.occupied, occupied, capacity: before.capacity,
      available: before.capacity - occupied, balances };
  }
  return freeze({ version: 1, catalog, limits, capacityFor, inspect, plan });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MaterialBagContract;
