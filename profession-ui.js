/* M7.3 mobile profession vertical slice. Presentation only; engine owns durable changes. */
const ProfessionUI = (() => {
  const context=()=>{const s=ProgressionStore.state, location=s.frontier.location, place=WorldData.location(location);return {location,activeEncounter:!!s.frontier.activeEncounter,accessible:!ProgressionStore.error&&!!place&&(place.discoveryType?WorldDiscovery.accessible(location):s.unlockedContent.includes('world:'+location))}};
  const exclusive=run=>ProfessionTabWriter.exclusive(()=>{
    const refreshAndRun=()=>{ProgressionStore.refresh();return ProgressionStore.error?{ok:false,message:"World context unavailable. No profession changes applied."}:run()};
    return navigator.locks?navigator.locks.request("nymeria-progression",refreshAndRun):refreshAndRun();
  });
  const engine=ProfessionEngine.create({context,exclusive}), root=document.getElementById("profession-root"), status=document.getElementById("profession-status");
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const matName=id=>ProfessionData.materials.find(x=>x.id===id)?.name||id;
  let busy=false;
  const recipeName=id=>({"forge-iron":"Forgia ferro","frontier-brace":"Crea rinforzo della Frontiera","chart-vesper-fragment":"Componi carta del Vespro"}[id]||id);
  const accessible=location=>location.discoveryType?WorldDiscovery.accessible(location.id):ProgressionStore.state.unlockedContent.includes('world:'+location.id);
  function render(){
    if(!root)return;
    const s=engine.state,current=ProgressionStore.state.frontier.location,place=context();
    const blocked=engine.storageIssue?'Salvataggio non disponibile: riprova dopo aver riaperto la schermata.':place.activeEncounter?'Concludi l’incontro in corso prima di raccogliere o creare.':!place.accessible?'Raggiungi un luogo accessibile nel Mondo.':busy?'Operazione in corso.':'';
    root.innerHTML=`<header class="profession-head"><span class="world-eyebrow">FRONTIERA DEL VESPRO</span><h1>Professioni</h1><p class="hint">Raggiungi il luogo → Raccogli → Ottieni materiali → Crea</p><p class="hint">Raccogliere e creare fanno salire la professione indicata. Questi materiali sono conservati separatamente dalle risorse delle Spedizioni.</p></header>
    ${blocked?`<p class="profession-requirement" role="status">${esc(blocked)}</p>`:''}
    <div class="profession-list">${ProfessionData.professions.map(p=>{const r=s.professions[p.id],need=engine.threshold(r.level);return `<article class="profession-card"><div><strong>${esc(p.name)}</strong><small>Livello ${r.level} · ${r.level===p.maxLevel?'MAX':r.xp+'/'+need+' XP'}</small></div><div class="xp-bar"><span style="width:${r.level===p.maxLevel?100:Math.min(100,r.xp/need*100)}%"></span></div></article>`}).join('')}</div>
    <h3>Dove raccogliere</h3><p class="hint">Ti trovi a: ${esc(WorldData.location(current)?.name||current)}</p><div class="profession-actions">${ProfessionData.gathering.map(n=>{
      const location=WorldData.location(n.location),unlocked=accessible(location),here=n.location===current;
      const reason=blocked||(!unlocked?(location.discoveryType?'Completa il progetto di gilda Faro del Vespro per sbloccare questo luogo.':location.unlockHint+'. Riscuoti le ricompense della missione per sbloccarlo.'):!here?'Raggiungi questo luogo prima di raccogliere.':'');
      return `<article class="profession-action-card"><strong>${esc(matName(n.material))}</strong><p>${esc(location.name)} · ${esc(ProfessionData.profession(n.profession).name)}</p><small>Ottieni ${n.amount} ${esc(matName(n.material))} e ${n.xp} XP professione per raccolta.</small>${reason?`<p class="profession-requirement" id="prof-requirement-${n.id}">${esc(reason)}</p>`:''}
      ${!here?`<button data-prof-travel="${n.location}" ${!unlocked||!!blocked?'disabled':''}>Vai a ${esc(location.name)} →</button>`:''}
      <button data-prof-gather="${n.id}" ${reason?'disabled aria-describedby="prof-requirement-'+n.id+'"':''}>Raccogli ${esc(matName(n.material))}</button></article>`;
    }).join('')}</div>
    <h3>Cosa puoi creare</h3><div class="profession-actions">${ProfessionData.recipes.map(r=>{
      const profession=ProfessionData.profession(r.profession),level=s.professions[r.profession].level;
      const missing=Object.entries(r.costs).filter(([k,v])=>(s.materials[k]||0)<v).map(([k,v])=>(v-(s.materials[k]||0))+' '+matName(k));
      const done=r.discovery&&s.discoveries.includes(r.discovery);
      const requirements=[level<r.level?`Richiede ${profession.name} livello ${r.level}; sei al livello ${level}.`:'',missing.length?'Ti mancano: '+missing.join(' + ')+'.':''].filter(Boolean);
      const reason=blocked||(done?'Carta già composta: questa scoperta si registra una sola volta.':requirements.join(' '));
      const output=r.discovery?'Registra la scoperta Carta del Vespro':Object.entries(r.outputs).map(([k,v])=>v+' '+matName(k)).join(' + ');
      const purpose=r.purpose||(r.id==='forge-iron'?'Serve per creare il Rinforzo della Frontiera.':'');
      return `<article class="profession-action-card"><strong>${esc(recipeName(r.id))}</strong><p>${esc(profession.name)} · livello richiesto ${r.level}</p><small>Costo: ${Object.entries(r.costs).map(([k,v])=>`${v} ${esc(matName(k))} (possiedi ${s.materials[k]||0})`).join(' + ')}</small><p><strong>Risultato:</strong> ${esc(output)} · +${r.xp} XP professione</p><small>${esc(purpose)}</small>${reason?`<p class="profession-requirement" id="prof-recipe-${r.id}">${esc(reason)}</p>`:''}<button data-prof-craft="${r.id}" ${reason?'disabled aria-describedby="prof-recipe-'+r.id+'"':''}>${esc(recipeName(r.id))}</button></article>`;
    }).join('')}</div>
    <h3>Materiali delle Professioni</h3><div class="profession-materials">${ProfessionData.materials.map(m=>`<span><strong>${s.materials[m.id]||0}</strong><small>${esc(m.name)}</small></span>`).join('')}</div>
    ${s.discoveries.includes('vesper-fragment-chart')?'<p class="profession-discovery"><strong>Carta del Vespro composta</strong><br><small>Scoperta registrata. In questa versione non apre nuovi luoghi.</small></p>':''}`;
    root.setAttribute('aria-busy',String(busy));
    if(engine.storageIssue)status.textContent='Salvataggio delle Professioni non disponibile. Nessuna modifica applicata.';
    else if(engine.recovered)status.textContent='Salvataggio delle Professioni recuperato; dati disponibili conservati.';
  }
  root?.addEventListener("click",async e=>{
    const b=e.target.closest("button");if(!b||busy||b.disabled)return;
    const gather=b.dataset.profGather,craft=b.dataset.profCraft,travel=b.dataset.profTravel;
    if(travel){
      busy=true;render();
      try {const result=await WorldSystem.enter(travel);if(result.ok)NymeriaNavigation.root('world');else status.textContent='Spostamento non disponibile: concludi l’incontro in corso e verifica lo sblocco del luogo.';}
      catch {status.textContent='Spostamento non disponibile. Riprova dal Mondo.';}
      finally{busy=false;render();} return;
    }
    if(!gather&&!craft)return;
    busy=true;render();
    try { const r=await (gather?engine.gather(gather):engine.craft(craft));render();status.textContent=r.ok?(r.material?`Raccolti ${r.amount} ${matName(r.material)}.`:"Creazione completata."):"Operazione non applicata: verifica i requisiti indicati e riprova."; }
    catch {status.textContent="Operazione non disponibile. Nessuna modifica applicata.";}
    finally{busy=false;render();}
  });
  engine.subscribe(render);ProgressionStore.subscribe(render);WorldDiscovery.subscribe(render);
  window.addEventListener("storage",e=>{if(e.key===ProgressionStorage.KEY||e.key===null)ProgressionStore.refresh();if(e.key===engine.KEY||e.key===null)engine.load()});
  window.addEventListener("pageshow",()=>{ProgressionStore.refresh();engine.load();render()}); document.addEventListener("nymeria:navigation",e=>{if(e.detail.screen==="professions"){engine.load();render()}});
  render(); return {engine,render};
})();