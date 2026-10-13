/* Shared capacity admission factory. No persisted or user-accessible enable flag. */
const MaterialCapacityAdmission = (() => {
  const node = typeof module !== 'undefined' && module.exports;
  const bag = node ? require('./material-bag-contract.js') : MaterialBagContract;
  const progression = node ? require('./progression-data.js') : ProgressionData;
  const professions = node ? require('./profession-system.js') : ProfessionEngine;
  const copy = value => JSON.parse(JSON.stringify(value));
  const blocked = code => ({ok:false,code,message:code === 'capacity-exceeded'
    ? 'Borsa piena: nessun materiale, costo o ricompensa accreditato. Libera spazio e riprova.'
    : 'Controllo Borsa non disponibile: dati conservati, riprova dopo aver verificato il salvataggio.'});
  function createTestSession({purpose,readers,readMetadata,isCoordinated,entries=bag.catalog,project=copy}={}) {
    if (purpose !== 'capacity-simulation' || !readers || typeof readMetadata !== 'function' || typeof isCoordinated !== 'function')
      throw new TypeError('Explicit, coordinated test dependencies required');
    function check(owner,before,operation) {
      try {
        if (isCoordinated() !== true) return blocked('coordination-required');
        const other = owner === 'progression' ? 'profession' : 'progression';
        // The mutating engine has just re-read its own ledger under the common writer.
        // Read the other owner and metadata NOW, not at session construction.
        const foreign=readers[other](), metadata=readMetadata();
        if (foreign?.ok !== true || metadata?.ok !== true || metadata.state?.version !== 1 || metadata.state?.baseCapacity !== 40) return blocked('unsafe-capacity-state');
        const ledgers=project({[owner]:copy(before),[other]:copy(foreign.state)});
        const result=bag.plan(ledgers,operation,{entries,expansions:metadata.state.expansionIds.length});
        return result.ok ? result : blocked(result.code);
      } catch { return blocked('capacity-check-unavailable'); }
    }
    function mutation(owner,before,after) {
      const consumes=[],produces=[];
      for (const id of new Set([...Object.keys(before.materials||{}),...Object.keys(after.materials||{})])) {
        const previous=before.materials[id] ?? 0, next=after.materials[id] ?? 0;
        if (!Number.isSafeInteger(previous) || !Number.isSafeInteger(next) || previous<0 || next<0 || (owner === 'profession' ? next > professions.MAX_MATERIAL : next !== progression.amount(next))) return blocked('invalid-quantity');
        const delta=next-previous;
        if(delta) (delta>0?produces:consumes).push({key:`${owner}:${id}`,quantity:Math.abs(delta)});
      }
      return consumes.length || produces.length ? check(owner,before,{consumes,produces}) : {ok:true};
    }
    return Object.freeze({
      progression:(before,after)=>mutation('progression',before,after),
      profession:(before,after)=>mutation('profession',before,after),
      reward:(before,planned)=>check('progression',before,{produces:planned.produces}),
    });
  }
  return Object.freeze({createTestSession});
})();
if (typeof module !== 'undefined' && module.exports) module.exports=MaterialCapacityAdmission;
