/* Sprint 2.1: UI structure and a separate onboarding preference. No game-state writes. */
(function () {
  'use strict';
  const key='nymeria.ui.journeyGuide.dismissed.v1';
  const panel=document.getElementById('panel-character');
  const guide=document.getElementById('journey-guide');
  function readPreference() {
    try { guide.hidden=localStorage.getItem(key)==='true'; } catch { /* The guide remains accessible. */ }
  }
  document.getElementById('journey-dismiss').addEventListener('click',function () {
    try { localStorage.setItem(key,'true'); guide.hidden=true; }
    catch { document.getElementById('journey-preference-status').textContent='Preferenza non salvata: riprova. Il suggerimento resta disponibile.'; }
  });
  window.addEventListener('storage',e=>{if(e.key===key||e.key===null)readPreference();});
  window.addEventListener('pageshow',readPreference);
  readPreference();
  for (const [destination,icon] of [['professions','loot'],['guild','activities']]) {
    const slot=document.querySelector('#panel-menu [data-nav="'+destination+'"] > span[aria-hidden]');
    if (slot) slot.innerHTML=VisualIcons.svg(icon);
  }
  const vitals=document.createElement('section');vitals.id='hero-vitals';vitals.className='ny-surface';vitals.setAttribute('aria-label','Preparazione allo scontro');
  const secondary=document.createElement('details');secondary.id='hero-secondary';secondary.innerHTML='<summary>Statistiche secondarie e build</summary>';
  const stats=document.createElement('dl');stats.id='hero-secondary-stats';secondary.append(stats);
  secondary.append(document.getElementById('character-build'));
  // Move existing renderer nodes unchanged. Creator/actions keep their original state and handlers.
  panel.append(panel.querySelector('.kaelith-hero') || panel.querySelector('.identity'),panel.querySelector('.xp-summary'),panel.querySelector('.stage'),vitals,panel.querySelector('.stats'),panel.querySelector('.character-links'),secondary,guide,document.getElementById('character-creator'));
  function render() {
    const state=Equipment.state;
    const profile=ClassSystem.combatProfile(undefined,undefined,{main:Equipment.equipped('mainHand'),support:Equipment.equipped('support')});
    // Pure engine preview, deterministic seed; no ticking, callbacks, rewards or persistence.
    const preview=CombatEngine.create({stats:state.resultingStats,profile,seed:1,captureLog:false});
    vitals.replaceChildren();
    const heading=document.createElement('strong');heading.textContent='Preparazione allo scontro';
    const hp=document.createElement('p');hp.textContent='HP iniziali: '+preview.player.hp+' / '+preview.player.maxHp;
    const resource=document.createElement('p');resource.textContent=profile.resource.name+' iniziale: '+profile.resource.initial+' / '+profile.resource.max;
    const hint=document.createElement('small');hint.textContent='Durante lo scontro, HP e risorse correnti sono mostrati nel Combattimento.';
    vitals.append(heading,hp,resource,hint);
    stats.replaceChildren();
    Object.entries(state.resultingStats).slice(4).forEach(([id,value])=>{
      const row=document.createElement('div'),label=document.createElement('dt'),amount=document.createElement('dd');
      label.textContent=GearData.statLabels[id]||id;amount.textContent=value+(['critical','speed'].includes(id)?'%':'');row.append(label,amount);stats.append(row);
    });
  }
  Equipment.subscribe(render);ClassSystem.subscribe(render);render();
})();
