const assert=require('node:assert/strict'),{chromium}=require('playwright');
const S=require('../progression-store.js'),D=require('../progression-data.js');const {press}=require('./fixed-navigation-fixture.cjs'),dismiss=require('./notifications-fixture.cjs');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{await settlementOverlap(b);for(const width of [320,375,390,430]){
 const c=await b.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});const state=S.initial();Object.assign(state,D.fromTotal(1000));state.frontier.location='elar-ruins';state.unlockedContent.push('world:veyra','world:broken-path','world:lantern-wood','world:elar-ruins');for(const id of ['mq01','mq02','mq03'])state.frontier.quests[id].status='claimed';Object.assign(state.frontier.quests.mq04,{status:'completed',progress:[1,3,3]});
 await c.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));Math.random=()=>1/4294967296;window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));},{key:S.KEY,state});const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026');await p.evaluate(()=>{ClassSystem.selectClass('warden');for(const [slot,id]of Object.entries({mainHand:'sword',support:'shield',torso:'torso-warden',legs:'legs-sentinel',boots:'boots-plate'}))Equipment.equip(id,slot);NymeriaNavigation.open('world',{view:'quest',questId:'mq04'});});await press(p,'#quest-detail [data-quest-claim="mq04"]');await dismiss(p);await press(p,'#world-quest-reward [data-quest-open="mq05"]');await press(p,'#quest-detail [data-quest-giver="mq05"]');await press(p,'#panel-world [data-quest-accept="mq05"]');await p.evaluate(()=>NymeriaNavigation.open('world',{view:'quest',questId:'mq05'}));await press(p,'#quest-detail [data-quest-destination="vesper-ford"]');
 assert.equal(await p.locator('[data-locality-tab]').count(),0);assert.equal(await p.locator('#navigation-locality').isVisible(),false);assert.doesNotMatch(await p.locator('#navigation-back').innerText(),/Torna a Località/);
 const equipment=await p.evaluate(()=>JSON.stringify(Equipment.state.equipment));
 async function fight(enemy,count){await press(p,'#panel-world [data-world-fight="'+enemy+'"]');const ticket=await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id);await p.evaluate(async()=>{WorldUI.engine.advance(180);await WorldUI.settle();});await dismiss(p);assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.lastEncounter?.id),ticket,'The receipt must belong to this encounter');assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.lastEncounter.outcome),'victory');assert.match(await p.locator('#world-result').innerText(),count);for(const pager of await p.locator('.fixed-pager').all()){if(await pager.isVisible())assert.doesNotMatch(await pager.innerText(),/Pagina 1 \/ 1/);}await press(p,'[data-world-continue]');assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');const before=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));assert.equal((await p.evaluate(id=>WorldSystem.finishEncounter(id),ticket)).unchanged,true);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),before);}
 for(let i=1;i<=3;i++)await fight('ford-reaver',new RegExp('Sconfiggi i Razziatori: '+i+'/3'));await fight('ford-commander',/Elimina il Comandante: 1\/1/);await press(p,'#panel-world [data-world-explore="far-bank"]');await p.evaluate(()=>NymeriaNavigation.open('world',{view:'quest',questId:'mq05'}));await press(p,'#quest-detail [data-quest-claim="mq05"]');await dismiss(p);assert.ok(await p.evaluate(()=>ProgressionStore.state.unlockedContent.includes('world:silent-tower')));assert.equal(await p.evaluate(()=>JSON.stringify(Equipment.state.equipment)),equipment);assert.ok(await p.locator('#world-quest-reward [data-quest-compare]').count());await press(p,'#world-quest-reward [data-quest-compare]');assert.ok(await p.locator('#item-dialog').evaluate(e=>e.open));await p.evaluate(()=>document.getElementById('item-dialog').close());await press(p,'#navigation-back');
 const saved=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));assert.equal((await p.evaluate(()=>QuestSystem.claim('mq05'))).ok,false);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),saved);await p.reload();assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.quests.mq05.status),'claimed');assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),saved);
 // Simulated iOS/Android system insets and keyboard/browser-height changes; not physical Safari.
 for(const height of [568,667,844]){await p.setViewportSize({width,height});await p.evaluate(()=>{document.querySelector('.app').style.paddingTop='44px';document.querySelector('.bottom-nav').style.paddingBottom='34px';});for(const type of ['areaUnlocked','levelUp']){await p.evaluate(type=>Notifications.notify(type,type==='levelUp'?{previousLevel:4,resultingLevel:5,levelCap:20,statGains:{force:2,vigor:3,spirit:1}}:{name:'Torre Silente'}),type);await p.waitForTimeout(160);const host=await p.locator('#global-notifications').boundingBox(),nav=await p.locator('.bottom-nav').boundingBox();assert.ok(host&&nav&&host.y>=44&&host.y+host.height<=nav.y);const t=p.locator('[data-dismiss-notification]'),r=await t.boundingBox();assert.ok(r.width>=43.999&&r.height>=43.999,JSON.stringify({width,height,type,r}));assert.equal(await t.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true);await t.tap();assert.ok(await p.locator('#global-notifications').isHidden());assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}}
 assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejections),[]);await c.close();console.log('PASS UX '+width+': mq04→mq05→Tower, real quest progress, single-page pager, context/back, compare without auto-equip, unique claim/reload, notification touch and simulated insets/heights');
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

async function settlementOverlap(browser) {
 for (const overlap of ['start','finish','quota']) {
  const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await c.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));});
  await p.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8018');
  await p.evaluate(async overlap=>{
   ClassSystem.selectClass('warden');Equipment.equip('sword','mainHand');Equipment.equip('shield','support');
   const entered=await WorldSystem.enter('broken-path');if(!entered.ok)throw Error(entered.message);
   if(overlap==='start') {
    const start=WorldSystem.startEncounter;
    WorldSystem.startEncounter=async(...args)=>{const result=await start(...args);window.startCommitted=true;await new Promise(resolve=>window.releaseOperation=resolve);return result;};
    document.querySelector('[data-world-fight="vesper-raider"]').click();
   } else {
    const started=await WorldSystem.startEncounter('vesper-raider',{seed:7});if(!started.ok)throw Error(started.message);
    if(overlap==='finish') {
     const finish=WorldSystem.finishEncounter;
     WorldSystem.finishEncounter=async(...args)=>{window.finishEntered=true;await new Promise(resolve=>window.releaseOperation=resolve);WorldSystem.finishEncounter=finish;return finish(...args);};
    } else {
     const write=Storage.prototype.setItem;window.restoreWrite=()=>Storage.prototype.setItem=write;
     Storage.prototype.setItem=function(key,value){if(key===ProgressionStorage.KEY)throw Error('quota');return write.call(this,key,value);};
    }
   }
  },overlap);
  await p.waitForFunction(overlap=>WorldUI.engine&&(overlap!=='start'||window.startCommitted),overlap);
  const ticket=await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id);
  const before=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));
  await p.evaluate(()=>{WorldUI.engine.advance(180);window.settleResolved=false;window.settlement=WorldUI.settle();window.settleAgainResolved=false;window.settlementAgain=WorldUI.settle();window.settlement.then(()=>window.settleResolved=true);window.settlementAgain.then(()=>window.settleAgainResolved=true);});
  if(overlap!=='quota') {
   if(overlap==='finish')await p.waitForFunction(()=>window.finishEntered);
   await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await p.evaluate(()=>window.settleResolved),false,'Await must not complete before the durable operation');
   assert.equal(await p.evaluate(()=>window.settleAgainResolved),false,'A second caller must await the same durable completion');
   assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.lastEncounter),null);
   assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),before);
   await p.evaluate(()=>window.releaseOperation());
  }
  let result=await p.evaluate(()=>window.settlement);
  assert.deepEqual(await p.evaluate(()=>window.settlementAgain),result);
  if(overlap==='quota') {
   assert.equal(result.ok,false);assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.lastEncounter),null);
   assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id),ticket);
   assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),before);
   assert.match(await p.locator('#world-message').innerText(),/Salvataggio non riuscito/);
   result=await p.evaluate(async()=>{window.restoreWrite();return WorldUI.settle();});
  }
  assert.equal(result.ok,true);assert.equal(result.receipt.id,ticket);
  assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.lastEncounter.id),ticket);
  assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter),null);
  const saved=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));
  assert.equal((await p.evaluate(id=>WorldSystem.finishEncounter(id),ticket)).unchanged,true);
  assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),saved);
  await p.reload();assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.lastEncounter.id),ticket);
  assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),saved);
  assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejections),[]);await c.close();
  console.log('PASS settlement overlap '+overlap+': awaited receipt, coalescing, rejected-write integrity/retry, unique rewards/reload');
 }
}
