/* Immutable admission wiring. Ordinary gameplay has no capacity enforcement. */
const MaterialBagRuntimeFactory = (() => {
  const names = ['progression', 'profession', 'reward'];
  const denied = () => ({ok:false,code:'capacity-check-unavailable',message:'Controllo Borsa non disponibile: nessuna modifica applicata.'});
  function create({admission = null} = {}) {
    // Only construction-time dependencies can enforce capacity. No setter, URL,
    // persisted switch or mutable global activation state exists.
    const checks = Object.fromEntries(names.map(name => [name, admission?.[name]]));
    const invoke = name => (...args) => {
      if (admission === null) return {ok:true};
      try {
        if (typeof checks[name] !== 'function') return denied();
        const result = checks[name](...args);
        if (result && typeof result.then === 'function') {
          Promise.resolve(result).catch(()=>{}); return denied();
        }
        return result?.ok === true || result?.ok === false ? result : denied();
      } catch { return denied(); }
    };
    return Object.freeze({enforced:admission !== null,...Object.fromEntries(names.map(name=>[name,invoke(name)]))});
  }
  return Object.freeze({create});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MaterialBagRuntimeFactory;
// Tests may inject explicit dependencies at this construction point in an isolated
// browser fixture. The shipped singleton always uses the inactive default.
const MaterialBagRuntime = typeof window !== 'undefined' ? MaterialBagRuntimeFactory.create() : null;
