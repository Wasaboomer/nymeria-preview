/* Read classification only: never repair or write a saved record. */
const SaveRecordSafety = (() => {
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const canonical = value => JSON.stringify(value, (_key,v) => object(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
  function classify(source, { versions, normalize, quantityPaths = [], allowChange = () => false, unsupported = () => false }) {
    if (source === null) return {ok:true, kind:'absent', state:normalize(null)};
    let raw;
    try { raw = JSON.parse(source); } catch { return {ok:false,kind:'corrupt',message:'Salvataggio JSON corrotto: dati originali conservati.'}; }
    if (!object(raw)) return {ok:false,kind:'corrupt',message:'Formato del salvataggio non valido: nessuna scrittura consentita.'};
    if (!versions.includes(raw.version) || unsupported(raw)) return {ok:false,kind:'unsupported',message:'Versione del salvataggio non supportata: dati conservati.'};
    let state;
    try { state=normalize(raw); } catch { return {ok:false,kind:'corrupt',message:'Salvataggio non leggibile: dati conservati.'}; }
    const issues=[];
    function walk(before, after, path) {
      if (allowChange(path,before,after)) return;
      if (object(before)) {
        if (!object(after)) { issues.push(path);return; }
        for (const [key,value] of Object.entries(before)) {
          if (!Object.prototype.hasOwnProperty.call(after,key)) issues.push(`${path}.${key}`);
          else walk(value,after[key],`${path}.${key}`);
        }
      } else if (Array.isArray(before)) {
        if (!Array.isArray(after)) {issues.push(path);return;}
        // Normalizers may reorder/deduplicate known lists. Any unrepresented entry blocks writes.
        for(const value of before) if(!after.some(candidate=>canonical(candidate)===canonical(value))) issues.push(path);
      } else if ((before !== null && after === null) || (typeof before === 'string' && before !== after && !allowChange(path,before,after))) issues.push(path);
    }
    walk(raw,state,'record');
    for(const path of quantityPaths) {
      const get=v=>path.reduce((s,k)=>s?.[k],v);
      const original=get(raw),next=get(state);
      if(original!==undefined) {
        if(object(original)&&object(next)) {
          for(const [key,value] of Object.entries(original)) if(canonical(value)!==canonical(next[key])) issues.push(path.concat(key).join('.'));
        } else if(canonical(original)!==canonical(next)) issues.push(path.join('.'));
      }
    }
    if(issues.length) return {ok:false,kind:'unrecognized',issues:[...new Set(issues)],message:'Salvataggio con dati non riconosciuti o non conservabili: scritture bloccate.'};
    return {ok:true,kind:'valid',state};
  }
  return {classify};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SaveRecordSafety;
