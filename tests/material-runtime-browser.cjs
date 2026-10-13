const assert=require('node:assert/strict'),{chromium}=require('playwright');
const install=require('./material-runtime-fixture.cjs'),P=require('../profession-system'),G=require('../progression-store');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8018',bram='sq-bram-preparation';
(async()=>{
 const b=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [320,375,390,430]){
   const c=await b.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});await install(c);
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await c.addInitScript(({key,ledger})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(ledger));window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)))},{key:P.KEY,ledger:{...P.empty(),materials:{'raw-iron':3}}});
   await p.goto(url);assert.equal(await p.evaluate(()=>MaterialBagRuntime.enforced),true);
   assert.equal((await p.evaluate(()=>WorldSystem.enter('broken-path'))).ok,true);
   // 39, 40 and 41 occupied types: projection-only extra identities, never saved.
   await p.evaluate(()=>bagFixture.padding=38);const simultaneous=await p.evaluate(()=>Promise.all([ProgressionStore.transact(s=>{s.materials.ether=1;return {ok:true}}),ProgressionStore.transact(s=>{s.materials.iron=1;return {ok:true}})]));assert.equal(simultaneous.filter(r=>r.ok).length,1);
   const bytes=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));assert.equal((await p.evaluate(()=>ProgressionStore.transact(s=>{s.materials.iron++;return {ok:true}}))).code,'capacity-exceeded');assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),bytes);
   assert.equal((await p.evaluate(()=>ProfessionUI.engine.gather('vesper-iron-vein'))).ok,true);
   assert.equal((await p.evaluate(()=>ProfessionUI.engine.craft('forge-iron'))).code,'capacity-exceeded');
   await p.evaluate(()=>{const s=ProfessionUI.engine.state;s.materials['raw-iron']=3;localStorage.setItem(ProfessionEngine.KEY,JSON.stringify(s));ProfessionUI.engine.load()});
   assert.equal((await p.evaluate(()=>ProfessionUI.engine.craft('forge-iron'))).ok,true);
   await p.evaluate(()=>bagFixture.padding=39);const over=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));assert.equal((await p.evaluate(()=>ProgressionStore.transact(s=>{s.materials.iron++;return {ok:true}}))).ok,false);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),over);
   assert.equal((await p.evaluate(()=>ProgressionStore.transact(s=>{s.materials.ether++;return {ok:true}}))).ok,true,'Existing stack grows at 41');
   assert.equal((await p.evaluate(()=>ProgressionStore.transact(s=>{s.materials.ether--;return {ok:true}}))).ok,true,'Partial consume at 41');
   const profOriginal=await p.evaluate(()=>localStorage.getItem(ProfessionEngine.KEY));await p.evaluate(()=>{const s=ProfessionUI.engine.state;s.materials['raw-iron']=3;s.materials['forged-iron']=0;localStorage.setItem(ProfessionEngine.KEY,JSON.stringify(s));ProfessionUI.engine.load()});
   const fullRecipe=await p.evaluate(()=>localStorage.getItem(ProfessionEngine.KEY));assert.equal((await p.evaluate(()=>ProfessionUI.engine.craft('forge-iron'))).code,'capacity-exceeded','Overfull crafting cannot swap a new identity');assert.equal(await p.evaluate(()=>localStorage.getItem(ProfessionEngine.KEY)),fullRecipe);
   assert.equal((await p.evaluate(()=>ProfessionUI.engine.gather('vesper-iron-vein'))).ok,true,'Existing material gathering at 41');await p.evaluate(raw=>{localStorage.setItem(ProfessionEngine.KEY,raw);ProfessionUI.engine.load()},profOriginal);
   // Real quest singleton, duplicate conversion, persisted original reward and retry.
   await p.evaluate(async()=>{bagFixture.padding=39;await ProgressionStore.transact(s=>{for(const id of ['mq01','mq02','mq03'])s.frontier.quests[id].status='claimed';s.frontier.quests.mq04={status:'completed',progress:QuestData.get('mq04').objectives.map(o=>o.count),lootPolicy:ProgressionSystem.personalPreparation()};s.ownedLootIds.push(...ProgressionSystem.personalItems(['vesper-blade'],ProgressionSystem.personalPreparation()));return {ok:true}})});
   assert.equal((await p.evaluate(()=>QuestSystem.claim('mq04'))).pending,true);const bundle=await p.evaluate(()=>ProgressionStore.state.frontier.quests.mq04.pendingReward);assert.ok(bundle);
   await p.reload();assert.deepEqual(await p.evaluate(()=>ProgressionStore.state.frontier.quests.mq04.pendingReward),bundle);
   await p.evaluate(()=>bagFixture.padding=30);assert.equal((await p.evaluate(()=>QuestSystem.claim('mq04'))).ok,true);assert.equal(await p.evaluate(()=>ProgressionStore.state.materials.iron),2);const paid=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));assert.equal((await p.evaluate(()=>QuestSystem.claim('mq04'))).ok,false);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),paid);
   // Bram uses the same gates and its durable two-ledger receipt.
   await p.evaluate(async()=>{bagFixture.padding=30;await WorldSystem.enter('veyra');await QuestSystem.accept('sq-bram-preparation');const s=ProfessionUI.engine.state;s.materials['frontier-brace']=1;localStorage.setItem(ProfessionEngine.KEY,JSON.stringify(s));ProfessionUI.engine.load();bagFixture.padding=40-[...Object.values(s.materials),...Object.values(ProgressionStore.state.materials)].filter(v=>v>0).length});
   const both=await p.evaluate(id=>Promise.all([QuestSystem.deliver(id),QuestSystem.deliver(id)]),bram);assert.equal(both.filter(r=>r.ok).length,1);assert.equal(await p.evaluate(()=>ProfessionUI.engine.state.materials['frontier-brace']),0);
   // Corrupt foreign metadata/ledger is fail-closed; no native writer bypass.
   for(const key of ['nymeria.material-bag.v1',P.KEY,G.KEY])for(const raw of ['{corrupt','{"version":999}']){
    const original=await p.evaluate(k=>localStorage.getItem(k),key);await p.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});
    const before=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));assert.equal((await p.evaluate(()=>ProgressionStore.transact(s=>{s.materials.iron++;return {ok:true}}))).ok,false);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),before);
    await p.evaluate(({key,original})=>original===null?localStorage.removeItem(key):localStorage.setItem(key,original),{key,original});
   }
   await p.evaluate(()=>WorldSystem.enter('broken-path'));
   const profBytes=await p.evaluate(()=>localStorage.getItem(ProfessionEngine.KEY));
   await p.evaluate(()=>{window.originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===ProfessionEngine.KEY)throw Error('quota');return originalWrite.call(this,k,v)}});
   assert.equal((await p.evaluate(()=>ProfessionUI.engine.gather('vesper-iron-vein'))).ok,false);assert.equal(await p.evaluate(()=>localStorage.getItem(ProfessionEngine.KEY)),profBytes);await p.evaluate(()=>Storage.prototype.setItem=originalWrite);
   const gBytes=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));await p.evaluate(()=>{window.originalRead=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===MaterialBagStore.KEY)throw Error('denied');return originalRead.call(this,k)}});
   assert.equal((await p.evaluate(()=>ProgressionStore.transact(s=>{s.materials.iron++;return {ok:true}}))).ok,false);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),gBytes);await p.evaluate(()=>Storage.prototype.getItem=originalRead);
   assert.equal((await p.evaluate(()=>MaterialBagStore.create({storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)}}).grantExpansion('test:runtime-expansion'))).ok,true);await p.evaluate(()=>bagFixture.padding=40);
   assert.equal((await p.evaluate(()=>ProgressionStore.transact(s=>{s.materials.fiber=1;return {ok:true}}))).ok,true,'Fresh metadata must observe the new capacity');
   assert.deepEqual(await p.evaluate(()=>rejections),[]);const other=await c.newPage();other.on('pageerror',e=>errors.push(e.message));await other.goto(url);assert.equal((await other.evaluate(()=>ProgressionStore.transact(s=>{s.materials.iron++;return {ok:true}}))).ok,false);await p.close();await other.evaluate(()=>bagFixture.padding=30);assert.equal((await other.evaluate(()=>ProgressionStore.transact(s=>{s.materials.iron++;return {ok:true}}))).ok,true);assert.deepEqual(await other.evaluate(()=>rejections),[]);await other.close();
   assert.deepEqual(errors,[]);await c.close();console.log(`PASS singleton runtime ${width}: 39/40/41, gather/craft, generic writer, quest pending/reload/retry, Bram concurrency, unsafe records and real two-tab ownership`);
  }
  for(const kind of ['world','expedition']){
   const c=await b.newContext(),deps={padding:40};await install(c,deps);const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   const initial=G.initial();Object.assign(initial,require('../progression-data').fromTotal(1000));
   await c.addInitScript(({key,initial})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(initial))},{key:G.KEY,initial});
   await p.goto(url);await p.evaluate(()=>{ClassSystem.selectClass('warden');for(const [slot,id] of Object.entries({mainHand:'sword',support:'shield',torso:'torso-warden',legs:'legs-sentinel',boots:'boots-plate'}))Equipment.equip(id,slot)});
   const wallet=await p.evaluate(()=>({xp:ProgressionStore.state.totalXP,crowns:ProgressionStore.state.crowns,materials:ProgressionStore.state.materials}));
   if(kind==='world'){
    assert.equal((await p.evaluate(()=>WorldSystem.enter('broken-path'))).ok,true);
    assert.equal((await p.evaluate(()=>WorldSystem.startEncounter('vesper-raider',{seed:7}))).ok,true);
    await p.evaluate(()=>ProgressionStore.transact(s=>{s.frontier.activeEncounter.template.rewards.materials={iron:1,fiber:2};return {ok:true}}));
    assert.equal((await p.evaluate(()=>WorldSystem.finishEncounter(ProgressionStore.state.frontier.activeEncounter.id))).pending,true);
   }else{
    assert.equal((await p.evaluate(()=>ProgressionSystem.start('patrol',{seed:7}))).ok,true);
    // Fixture-only timestamp shift: preserve the real ticket duration/snapshot,
    // then let the unmodified singleton reconstruct the elapsed activity.
    await p.evaluate(()=>ProgressionStore.transact(s=>{const a=s.activeExpedition;a.startedAt=Date.now()-a.activity.durationMs-1000;a.endsAt=a.startedAt+a.activity.durationMs;return {ok:true}}));
    assert.equal((await p.evaluate(()=>ProgressionSystem.refresh())).ok,true);
    assert.equal((await p.evaluate(()=>ProgressionSystem.claim(ProgressionStore.state.pendingExpeditionResult.id))).pending,true);
   }
   assert.deepEqual(await p.evaluate(()=>({xp:ProgressionStore.state.totalXP,crowns:ProgressionStore.state.crowns,materials:ProgressionStore.state.materials})),wallet);
   const original=await p.evaluate(kind=>kind==='world'?ProgressionStore.state.frontier.lastEncounter:ProgressionStore.state.pendingExpeditionResult,kind);
   await p.reload();assert.deepEqual(await p.evaluate(kind=>kind==='world'?ProgressionStore.state.frontier.lastEncounter:ProgressionStore.state.pendingExpeditionResult,kind),original);
   await p.evaluate(()=>bagFixture.padding=30);const result=await p.evaluate(kind=>kind==='world'?WorldSystem.claimEncounter(ProgressionStore.state.frontier.lastEncounter.id):ProgressionSystem.claim(ProgressionStore.state.pendingExpeditionResult.id),kind);assert.equal(result.ok,true);
   const paid=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));const duplicate=await p.evaluate(({kind,id})=>kind==='world'?WorldSystem.claimEncounter(id):ProgressionSystem.claim(id),{kind,id:original.id});if(kind==='world')assert.equal(duplicate.unchanged,true);else assert.equal(duplicate.ok,false);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),paid);
   assert.deepEqual(errors,[]);await c.close();console.log('PASS real '+kind+' singleton: full capacity, original result preserved, pending/reload/retry and unique reward');
  }
  const c=await b.newContext(),p=await c.newPage();await p.goto(url+'?test=1&bagCapacity=1');assert.equal(await p.evaluate(()=>MaterialBagRuntime.enforced),false);assert.equal(await p.evaluate(()=>localStorage.getItem(MaterialBagStore.KEY)),null);await c.close();console.log('PASS ordinary singleton remains inactive, including TEST URL; no metadata writes');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
