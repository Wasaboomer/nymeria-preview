/* Presentation only: deadlines and once-only arrival belong to the progression ledger. */
const TravelSystem=TravelEngine.create({store:ProgressionStore,
  testMode:new URLSearchParams(location.search).get('test')==='1',
  interactiveCombat:()=>typeof CombatUI!=='undefined'&&['running','paused'].includes(CombatUI.engine?.status),
  accessible:id=>typeof WorldDiscovery!=='undefined'&&WorldDiscovery?.accessible(id)});
const TravelUI=(()=>{
  const root=document.getElementById('regional-travel'),escape=QuestUI.escape;
  let selected=null,busy=false,recovering=false,signature='',message='',planning=false,arrivalId=null,mapSignature='';
  const link=document.createElement('button');link.id='travel-open';link.dataset.worldView='travel';
  document.querySelector('.world-shortcuts').append(link);
  const mapContext=document.createElement('section');mapContext.id='map-current-context';mapContext.className='quest-card';
  document.getElementById('world-locations').before(mapContext);
  const duration=ms=>Number.isFinite(ms)?Math.ceil(ms/1000)+' s':'Tempo non disponibile';
  const place=id=>escape(WorldData.location(id)?.name||'Luogo non disponibile');
  function render(){
    const s=ProgressionStore.state,t=s.travel,active=t.active;
    const routes=TravelSystem.routes().filter(r=>r.originId===s.frontier.location);
    const visible=routes.length>0||!!active||!!t.lastArrival||t.recoveryRequired;
    link.hidden=!visible;
    link.textContent=active?'Viaggio in corso':'Viaggio regionale'+(TravelSystem.testMode?' · TEST':'');
    root.hidden=NymeriaNavigation.route.screen!=='world'||NymeriaNavigation.route.view!=='travel';
    mapContext.hidden=NymeriaNavigation.route.screen!=='world'||NymeriaNavigation.route.view!=='overview';
    const mapMarkup=`<p>Ti trovi a <strong>${place(s.frontier.location)}</strong></p><button data-world-enter="${escape(s.frontier.location)}" ${active||t.recoveryRequired||s.frontier.activeEncounter?'disabled':''}>Apri località · attività disponibili →</button>${visible?`<button id="map-travel-open" data-world-view="travel">${active?'Segui il viaggio in corso':'Viaggio regionale'+(TravelSystem.testMode?' · TEST':'')} →</button>`:''}`;
    const mapKey=JSON.stringify([s.frontier.location,visible,!!active,t.recoveryRequired,!!s.frontier.activeEncounter]);
    if(mapSignature!==mapKey){mapSignature=mapKey;mapContext.innerHTML=mapMarkup;}
    if(!routes.some(r=>r.id===selected))selected=null;
    if(t.lastArrival?.id!==arrivalId){arrivalId=t.lastArrival?.id;planning=false;}
    const key=JSON.stringify([t,s.frontier.location,s.level,s.unlockedContent,s.characterIdentity,selected,busy,message,planning,ProgressionStore.error]);
    if(key!==signature){
      signature=key;
      const route=TravelData.get(selected),evaluation=route?TravelSystem.evaluate(route,s):null;
      const ready= !active&&!t.recoveryRequired&&(!t.lastArrival||planning);
      root.dataset.travelState=active?'active':t.recoveryRequired?'recovery':ready?'ready':'arrived';
      root.innerHTML=(active?`<section id="travel-active-summary"><h3>In viaggio</h3><p>Da <strong>${place(active.originId)}</strong><br>A <strong>${place(active.destinationId)}</strong></p><p class="travel-clock">Tempo residuo: <strong id="travel-countdown" role="timer" aria-live="off"></strong></p><p class="hint">Il viaggio prosegue anche chiudendo il browser.</p></section>`:
        t.recoveryRequired?'<h3>Viaggio da recuperare</h3><p role="alert">Dati di viaggio incoerenti. Nessun arrivo applicato; è necessario un recupero esplicito.</p>':
        ready?`<h3>Pronto alla partenza</h3>${TravelSystem.testMode?'<p class="hint">TEST · rotte tecniche, nessuna ricompensa.</p>':''}${t.lastArrival?`<p class="hint">Ultimo arrivo: ${place(t.lastArrival.destinationId)} · viaggio concluso.</p>`:''}
        <p>Partenza: <strong>${place(s.frontier.location)}</strong></p>
        <label class="polish-field" for="travel-route">Destinazione</label><select id="travel-route"><option value="">Scegli la rotta</option>${routes.map(r=>`<option value="${r.id}" ${selected===r.id?'selected':''}>${place(r.destinationId)} · ${duration(r.baseDurationMs)}</option>`).join('')}</select>
        ${route?`<p>Destinazione: <strong>${place(route.destinationId)}</strong><br>Ambiente: ${escape({land:'Terrestre',coastal:'Costiero',underwater:'Subacqueo'}[evaluation.environment])}<br>Durata: ${duration(evaluation.baseDurationMs)}</p><p id="travel-requirements">${escape(evaluation.accessible?'Rotta disponibile · requisiti soddisfatti.':evaluation.reason)}</p>`:`<p>${routes.length?'Scegli una destinazione per vedere durata e requisiti.':'Nessuna rotta disponibile da questo luogo.'}</p>`}
        <button id="travel-confirm" class="quest-primary" ${busy||!route||!evaluation?.accessible?'disabled':''}>Parti</button>`:
        `<section id="travel-arrival-summary"><h3>Arrivo completato</h3><p role="status">Hai raggiunto <strong>${place(t.lastArrival.destinationId)}</strong>.</p><p class="hint">Il viaggio è concluso. Questa è la ricevuta dell’ultimo arrivo.</p></section>${routes.length?'<button id="travel-new" class="quest-primary">Prepara un nuovo viaggio →</button>':''}`)+
        `<p id="travel-feedback" role="status" aria-live="polite">${escape(ProgressionStore.error||message)}</p><button data-world-view="places">Torna al luogo · ${place(s.frontier.location)} →</button>`;

    }
    const countdown=document.getElementById('travel-countdown');
    if(countdown)countdown.textContent=Date.now()<active.startedAt?'Orologio arretrato · in attesa':duration(TravelSystem.remaining())+' rimanenti';
  }
  root.addEventListener('change',e=>{if(e.target.id==='travel-route'){selected=e.target.value;message='';render();}});
  root.addEventListener('click',async e=>{
    if(e.target.closest('#travel-new')){planning=true;message='';render();return;}
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
