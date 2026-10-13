const assert=require('node:assert/strict'),{chromium}=require('playwright');
const Storage=require('../progression-store'),Data=require('../progression-data');
const dismiss=require('./notifications-fixture.cjs'),{reach}=require('./fixed-navigation-fixture.cjs');
const base=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8018';
async function install(p) {
 await p.addScriptTag({url:base+'/material-bag-contract.js'});
 await p.evaluate(()=>{
  window.rewardSpace=false;window.rewardNow=Date.now();
  const extras=Array.from({length:40},(_,i)=>({owner:'profession',id:`fixture-${i}`,key:`profession:fixture-${i}`}));
  const rewardAdmission=(state,plan)=>{
   const occupied=Object.values(state.materials).filter(x=>x>0).length;
   const count=40-occupied-(window.rewardSpace?5:0);
   return MaterialBagContract.plan({progression:state,profession:{materials:Object.fromEntries(extras.slice(0,count).map(row=>[row.id,1]))}},
    {produces:plan.produces},{entries:[...MaterialBagContract.catalog,...extras]});
  };
  window.rewardLifecycle=ProgressionLifecycle.create({store:ProgressionStore,equipment:Equipment,classes:ClassSystem,catalogue:GearData.items,
   now:()=>window.rewardNow,rewardAdmission});
  ProgressionSystem.grantRewards=rewardLifecycle.grantRewards;ProgressionSystem.claim=rewardLifecycle.claim;
 });
}
(async()=>{const browser=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430])for(const kind of ['quest','world','expedition']) {
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),p=await context.newPage(),errors=[];
  const state=Storage.initial();Object.assign(state,Data.fromTotal(1000));
  await p.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));},{key:Storage.KEY,state});
  p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await install(p);
  await p.evaluate(()=>{ClassSystem.selectClass('warden');for(const [slot,id]of Object.entries({mainHand:'sword',support:'shield',torso:'torso-warden',legs:'legs-sentinel',boots:'boots-plate'}))Equipment.equip(id,slot);});
  const before=await p.evaluate(()=>({xp:ProgressionStore.state.totalXP,crowns:ProgressionStore.state.crowns,materials:ProgressionStore.state.materials,gear:Equipment.state.equipment}));
  if(kind==='quest') {
   await p.evaluate(async()=>{await ProgressionStore.transact(s=>{for(const id of ['mq01','mq02','mq03'])s.frontier.quests[id].status='claimed';s.frontier.quests.mq04={status:'completed',progress:QuestData.get('mq04').objectives.map(o=>o.count),lootPolicy:ProgressionSystem.personalPreparation()};return {ok:true}});NymeriaNavigation.open('world',{view:'quest',questId:'mq04'});});
   await p.locator('#quest-detail [data-quest-claim="mq04"]').tap();await p.waitForFunction(()=>!!ProgressionStore.state.frontier.quests.mq04.pendingReward);
   await p.waitForFunction(()=>document.getElementById('world-message').textContent.includes('non accreditata'));
  } else if(kind==='world') {
   await p.evaluate(async()=>{await WorldSystem.enter('broken-path');const started=await WorldSystem.startEncounter('vesper-raider',{seed:7});if(!started.ok)throw Error(started.message);
    await ProgressionStore.transact(s=>{s.frontier.activeEncounter.template.rewards.materials={iron:1,fiber:2};return {ok:true}});NymeriaNavigation.open('world',{view:'battle'});WorldUI.engine.advance(180);await WorldUI.settle();});
   assert.match(await p.locator('#world-result').innerText(),/VITTORIA[\s\S]*non accreditata/);
   assert.equal(await p.locator('[data-world-continue]').innerText(),'Riscuoti ricompensa');
  } else {
   await p.evaluate(async()=>{const started=await rewardLifecycle.start('patrol',{seed:7});if(!started.ok)throw Error(started.message);rewardNow=ProgressionStore.state.activeExpedition.endsAt;await rewardLifecycle.refresh();NymeriaNavigation.open('expeditions');});
   await p.locator('#expedition-claim').tap();await p.waitForFunction(()=>document.getElementById('expedition-message').textContent.includes('non accreditata'));
  }
  const economic=await p.evaluate(()=>({xp:ProgressionStore.state.totalXP,crowns:ProgressionStore.state.crowns,materials:ProgressionStore.state.materials,gear:Equipment.state.equipment}));assert.deepEqual(economic,before);
  const saved=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));await p.reload();await install(p);
  assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),saved,'Reload must not pay or lose pending rewards');
  if(kind==='world') {
   await p.evaluate(()=>NymeriaNavigation.locality());assert.ok(await p.locator('#world-active-link').isVisible());await p.locator('#world-active-link').tap();
   assert.match(await p.locator('#world-result').innerText(),/non accreditata/);
   await p.evaluate(()=>{const claim=WorldSystem.claimEncounter;WorldSystem.claimEncounter=(...args)=>(window.lastPendingClaim=claim(...args));});
   await p.locator('[data-world-continue]').tap();assert.equal((await p.evaluate(()=>window.lastPendingClaim)).pending,true);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),saved);
  } else if(kind==='quest')await p.evaluate(()=>NymeriaNavigation.open('world',{view:'quest',questId:'mq04'}));
  else await p.evaluate(()=>NymeriaNavigation.open('expeditions'));
  await p.evaluate(()=>window.rewardSpace=true);
  const selector=kind==='world'?'[data-world-continue]':kind==='quest'?'#quest-detail [data-quest-claim="mq04"]':'#expedition-claim';
  const button=p.locator(selector);await reach(p,button);const rect=await button.boundingBox();assert.ok(rect.width>=44&&rect.height>=44);await button.tap();
  await p.waitForFunction(kind=>kind==='world'?ProgressionStore.state.frontier.lastEncounter.rewardStatus==='delivered':kind==='quest'?ProgressionStore.state.frontier.quests.mq04.status==='claimed':!ProgressionStore.state.pendingExpeditionResult,kind);
  await dismiss(p);assert.deepEqual(await p.evaluate(()=>Equipment.state.equipment),before.gear,'No automatic equipment');
  const paid=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));
  await p.evaluate(async kind=>{if(kind==='world')await WorldSystem.claimEncounter(ProgressionStore.state.frontier.lastEncounter.id);else if(kind==='quest')await QuestSystem.claim('mq04');else await ProgressionSystem.claim(ProgressionStore.state.lastClaim.id);},kind);
  assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),paid);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejections),[]);
  await context.close();console.log(`PASS pending ${kind} ${width}: full-bag simulation, original reward/reload, real touch retry, unique credit, no auto-equip/errors/overflow`);
 }
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
