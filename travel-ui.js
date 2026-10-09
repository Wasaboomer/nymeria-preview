/* Presentation only: deadlines and once-only arrival belong to the progression ledger. */
const TravelSystem=TravelEngine.create({store:ProgressionStore,
  testMode:new URLSearchParams(location.search).get('test')==='1',
  interactiveCombat:()=>typeof CombatUI!=='undefined'&&['running','paused'].includes(CombatUI.engine?.status),
  accessible:id=>typeof WorldDiscovery!=='undefined'&&WorldDiscovery?.accessible(id)});
const TravelUI=(()=>{
  const root=document.getElementById('regional-travel'),escape=QuestUI.escape;
  let selected=null,busy=false,recovering=false,signature='',message='';
  const link=document.createElement('button');link.id='travel-open';link.dataset.worldView='travel';
  document.querySelector('.world-shortcuts').append(link);
  const duration=ms=>Number.isFinite(ms)?Math.ceil(ms/1000)+' s':'Tempo non disponibile';
  function render(){
    const s=ProgressionStore.state,t=s.travel,active=t.active;
    link.hidden=!TravelSystem.testMode&&!active&&!t.lastArrival&&!t.recoveryRequired;
    link.textContent=active?'Viaggio in corso':'Viaggio regionale · TEST';
    // Existing navigation can still open inventory, equipment and expeditions.
    root.hidden=NymeriaNavigation.route.screen!=='world'||NymeriaNavigation.route.view!=='travel';
    const routes=TravelSystem.routes().filter(r=>r.originId===s.frontier.location);
    if(!routes.some(r=>r.id===selected))selected=null;
    const key=JSON.stringify([t,s.frontier.location,s.level,s.unlockedContent,selected,busy,message,ProgressionStore.error]);
    if(key!==signature){
      signature=key;
      const route=TravelData.get(selected);
      root.innerHTML='<h3>Viaggio regionale</h3>'+(TravelSystem.testMode?'<p class="hint">TEST · rotte tecniche tra luoghi esistenti. Nessuna ricompensa.</p>':'')+
        (active?`<p><strong>In viaggio verso ${escape(WorldData.location(active.destinationId).name)}</strong></p><p>Durata: ${duration(active.durationMs)} · <span id="travel-countdown"></span></p><p class="hint">Il viaggio prosegue anche a gioco chiuso. Non puoi cambiare rotta.</p>`:
        t.recoveryRequired?'<p role="alert">Dati di viaggio incoerenti. Nessun arrivo applicato; è necessario un recupero esplicito.</p>':
        `${t.lastArrival?`<p role="status"><strong>ARRIVO COMPLETATO · ${escape(WorldData.location(t.lastArrival.destinationId).name)}</strong></p>`:''}
        <label>Seleziona una rotta<select id="travel-route"><option value="">Scegli la rotta</option>${routes.map(r=>`<option value="${r.id}" ${selected===r.id?'selected':''}>${escape(WorldData.location(r.destinationId).name)} · ${duration(r.durationMs)}</option>`).join('')}</select></label>
        ${route?`<p>${escape(route.description)}</p><p>Destinazione: ${escape(WorldData.location(route.destinationId).name)}<br>Durata: ${duration(route.durationMs)}<br>Requisiti: livello ${route.requirements.minimumLevel}, partenza e destinazione accessibili.</p><p>${escape(TravelSystem.eligibility(route,s))}</p>`:'<p>Scegli una rotta prima di confermare.</p>'}
        <button id="travel-confirm" class="quest-primary" ${busy||!route||TravelSystem.eligibility(route,s)?'disabled':''}>Conferma partenza</button>`)+
        `<p id="travel-feedback" role="status" aria-live="polite">${escape(ProgressionStore.error||message)}</p><button data-world-view="places">Torna al luogo</button>`;
    }
    const countdown=document.getElementById('travel-countdown');
    if(countdown)countdown.textContent=Date.now()<active.startedAt?'Orologio arretrato · in attesa':duration(TravelSystem.remaining())+' rimanenti';
  }
  root.addEventListener('change',e=>{if(e.target.id==='travel-route'){selected=e.target.value;message='';render();}});
  root.addEventListener('click',async e=>{
    if(!e.target.closest('#travel-confirm')||busy)return;
    busy=true;render();
    try{const result=await TravelSystem.start(selected);message=result.message;}
    catch{message='Partenza non applicata. Riprova.';}
    finally{busy=false;render();}
  });
  async function recover(reload=true){
    if(recovering||document.hidden)return;recovering=true;
    try{if(reload)ProgressionStore.refresh();const result=await TravelSystem.refresh();if(!result.ok)message=result.message;render();}
    catch{message='Ripristino non riuscito: nessun arrivo applicato.';render();}
    finally{recovering=false;}
  }
  ProgressionStore.subscribe(render);
  document.addEventListener('nymeria:world-render',render);
  document.addEventListener('nymeria:navigation',render);
  window.addEventListener('pageshow',recover);
  window.addEventListener('storage',e=>{if(e.key===ProgressionStorage.KEY||e.key===null)recover();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)recover();});
  document.addEventListener('nymeria:app-active',recover);
  setInterval(()=>{if(!document.hidden){if(TravelSystem.state.active)recover(false);else render();}},1000);
  render();recover();
  return {render,recover};
})();
