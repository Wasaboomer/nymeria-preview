/* Read-only Material Bag projection. Quantities remain in their authoritative ledgers. */
const MaterialBagView = (() => {
  const node = typeof module !== 'undefined' && module.exports;
  const contract = node ? require('./material-bag-contract') : MaterialBagContract;
  const metadata = node ? require('./material-bag-store') : MaterialBagStore;
  function project({progression, profession, bag}, entries = contract.catalog) {
    const failed = [['Progressione',progression],['Professioni',profession],['Capacità',bag]].find(([,result])=>!result?.ok);
    const reasons={'corrupt-record':'salvataggio JSON corrotto','unsupported-version':'versione del salvataggio non supportata','storage-unavailable':'accesso ai salvataggi non disponibile','invalid-record':'metadati non riconosciuti','invalid-expansion-receipts':'ampliamenti non leggibili'};
    if (failed) return {ok:false,message:`Borsa non consultabile · ${failed[0]}: ${failed[1]?.message || reasons[failed[1]?.code] || 'dati non leggibili'}. I dati sono conservati.`};
    const expansions = bag.state.expansionIds.length;
    const result = contract.inspect({progression:progression.state,profession:profession.state},{expansions,entries});
    if (!result.ok) return {ok:false,message:'Borsa non consultabile: materiali o quantità non riconosciuti. I dati sono conservati.'};
    return {...result,expansions,groups:['progression','profession'].map(owner=>({owner,rows:entries.filter(row=>row.owner===owner && result.balances[row.key]>0).map(row=>({...row,quantity:result.balances[row.key]}))})).filter(group=>group.rows.length)};
  }
  function read({progression,profession,storage}) {
    try { return project({progression:progression.readSnapshot(),profession:profession.readSnapshot(),bag:metadata.create({storage}).read()}); }
    catch { return {ok:false,message:'Borsa non consultabile: accesso ai salvataggi non disponibile. I dati sono conservati.'}; }
  }
  return Object.freeze({project,read});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=MaterialBagView;
