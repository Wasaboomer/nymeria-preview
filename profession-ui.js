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
  function render(){
    if(!root)return; const s=engine.state, current=ProgressionStore.state.frontier.location, place=context();
    root.innerHTML=`<header class="profession-head"><span class="world-eyebrow">VESPER FRONTIER</span><h1>Professions</h1><p class="hint">Gather, learn and turn frontier knowledge into useful materials.</p></header>
    <div class="profession-list">${ProfessionData.professions.map(p=>{const r=s.professions[p.id],need=engine.threshold(r.level);return `<article class="profession-card"><div><strong>${esc(p.name)}</strong><small>${r.level===p.maxLevel?"Level "+r.level+" · MAX":"Level "+r.level+" · "+r.xp+"/"+need+" XP"}</small></div><div class="xp-bar"><span style="width:${r.level===p.maxLevel?100:Math.min(100,r.xp/need*100)}%"></span></div></article>`}).join("")}</div>
    <h3>Gathering sites</h3><p class="hint">Current location: ${esc(WorldData.location(current)?.name||current)}</p><div class="profession-actions">${ProfessionData.gathering.map(n=>`<button data-prof-gather="${n.id}" ${n.location!==current||!place.accessible||place.activeEncounter||busy||engine.storageIssue?"disabled":""}><strong>${esc(matName(n.material))}</strong><small>${esc(WorldData.location(n.location)?.name||n.location)} · +${n.amount} · ${n.xp} XP</small></button>`).join("")}</div>
    <h3>Recipes</h3><div class="profession-actions">${ProfessionData.recipes.map(r=>`<button data-prof-craft="${r.id}" ${busy||engine.storageIssue||!place.accessible||place.activeEncounter||s.professions[r.profession].level<r.level||Object.entries(r.costs).some(([k,v])=>(s.materials[k]||0)<v)||r.discovery&&s.discoveries.includes(r.discovery)?"disabled":""}><strong>${esc(r.id==="forge-iron"?"Forge Iron":r.id==="frontier-brace"?"Frontier Brace":"Chart Vesper Fragment")}</strong><small>Lv. ${r.level} · ${Object.entries(r.costs).map(([k,v])=>v+" "+esc(matName(k))).join(" + ")}</small></button>`).join("")}</div>
    <h3>Materials</h3><div class="profession-materials">${ProfessionData.materials.map(m=>`<span><strong>${s.materials[m.id]||0}</strong><small>${esc(m.name)}</small></span>`).join("")}</div>
    ${s.discoveries.includes("vesper-fragment-chart")?'<p class="profession-discovery"><strong>Chart assembled</strong><br><small>The fragments reveal a coherent frontier route. Future world integration will use this knowledge.</small></p>':""}`;
    root.setAttribute("aria-busy",String(busy));
    if(engine.storageIssue)status.textContent="Profession save unavailable. Changes are disabled until storage returns.";
    else if(engine.recovered)status.textContent="Profession save migrated or normalized. Available data retained.";
  }
  root?.addEventListener("click",async e=>{
    const b=e.target.closest("button");if(!b||busy||b.disabled)return;
    const gather=b.dataset.profGather,craft=b.dataset.profCraft;if(!gather&&!craft)return;
    busy=true;render();
    try { const r=await (gather?engine.gather(gather):engine.craft(craft));render();status.textContent=r.ok?(r.material?`Gathered ${r.amount} ${matName(r.material)}.`:"Crafting complete."):r.message; }
    catch {status.textContent="Profession operation unavailable. No changes applied.";}
    finally{busy=false;render();}
  });
  engine.subscribe(render);ProgressionStore.subscribe(render);WorldDiscovery.subscribe(render);
  window.addEventListener("storage",e=>{if(e.key===ProgressionStorage.KEY||e.key===null)ProgressionStore.refresh();if(e.key===engine.KEY||e.key===null)engine.load()});
  window.addEventListener("pageshow",()=>{ProgressionStore.refresh();engine.load();render()}); document.addEventListener("nymeria:navigation",e=>{if(e.detail.screen==="professions"){engine.load();render()}});
  render(); return {engine,render};
})();