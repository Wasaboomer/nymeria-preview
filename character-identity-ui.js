/* Separate identity card; never participates in Character Creator / appearance changes. */
const CharacterIdentitySystem=CharacterIdentityEngine.create({store:ProgressionStore,
  testMode:new URLSearchParams(location.search).get('test')==='1'});
const CharacterIdentityUI=(()=>{
  const root=document.createElement('section');root.id='character-identity';root.className='quest-card';
  document.getElementById('panel-character').append(root);
  const escape=QuestUI.escape;let chosen='',busy=false,message='',signature='';
  function render(){
    const s=ProgressionStore.state,id=s.characterIdentity.raceId,race=CharacterIdentityData.get(id);
    const blocked=!!s.travel.active||s.travel.recoveryRequired;
    const key=JSON.stringify([id,blocked,busy,chosen,message,ProgressionStore.error]);if(key===signature)return;signature=key;
    root.innerHTML='<h3>Identità del personaggio</h3>'+`<p>Razza attuale: <strong>${escape(race?.name||'Non assegnata')}</strong></p>`+
      '<p class="hint">Le differenze razziali ambientali sono ancora incomplete. La scelta non cambia avatar, classe o statistiche. Puoi continuare a giocare anche senza assegnarla.</p>'+
      ((!id||CharacterIdentitySystem.testMode)?`<label class="polish-field" for="identity-race">${id?'Cambia razza · solo TEST':'Scelta iniziale'}</label><select id="identity-race" ${blocked||busy?'disabled':''}><option value="">Scegli una razza</option>${CharacterIdentityData.races.map(r=>`<option value="${r.id}" ${chosen===r.id?'selected':''}>${escape(r.name)}</option>`).join('')}</select>
      <button id="identity-confirm" class="quest-primary" ${blocked||busy||!CharacterIdentityData.get(chosen)?'disabled':''}>${id?'Conferma cambio · TEST':'Conferma identità'}</button>`:'<p>Identità registrata. Il cambio non è disponibile nell’esperienza normale.</p>')+
      (CharacterIdentitySystem.testMode?`<p class="hint">TEST · scelta reversibile solo in questa modalità.</p><button id="identity-reset" ${blocked||busy?'disabled':''}>TEST · Reset identità</button>`:'')+
      (blocked?'<p>Viaggio in corso o da recuperare: scelta temporaneamente bloccata.</p>':'')+
      `<p id="identity-feedback" role="status" aria-live="polite">${escape(ProgressionStore.error||message)}</p>`;
  }
  root.addEventListener('change',e=>{if(e.target.id==='identity-race'){chosen=e.target.value;message='';render();}});
  root.addEventListener('click',async e=>{
    const button=e.target.closest('#identity-confirm,#identity-reset');if(!button||busy||button.disabled)return;
    busy=true;render();
    try{const r=await (button.id==='identity-reset'?CharacterIdentitySystem.reset():CharacterIdentitySystem.assign(chosen));message=r.message||'';if(r.ok)chosen='';}
    catch{message='Identità non salvata. Nessun altro dato modificato.';}
    finally{busy=false;render();}
  });
  ProgressionStore.subscribe(render);render();return {render};
})();
