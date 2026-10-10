const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {press}=require('./fixed-navigation-fixture.cjs'),{audit,swipe}=require('./contextual-scroll-fixture.cjs');
const dismiss=require('./notifications-fixture.cjs'),Storage=require('../progression-store.js'),Data=require('../progression-data.js');
const fixture=Storage.initial();Object.assign(fixture,Data.fromTotal(140));
fixture.unlockedContent.push('world:veyra','world:broken-path','world:lantern-wood');fixture.frontier.location='lantern-wood';fixture.frontier.trackedQuest='mq03';
fixture.frontier.quests.mq01.status=fixture.frontier.quests.mq02.status='claimed';Object.assign(fixture.frontier.quests.mq03,{status:'active',progress:[2,3,1,0]});fixture.frontier.supplies['corrupt-sample']=3;
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const width of [320,375,390,430]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));Math.random=()=>1/4294967296;window.rejects=[];addEventListener('unhandledrejection',e=>rejects.push(String(e.reason)));},{key:Storage.KEY,state:fixture});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.url());});await p.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026');
 await p.evaluate(()=>{ClassSystem.selectClass('warden');for(const [slot,id]of Object.entries({mainHand:'sword',support:'shield',torso:'torso-warden',legs:'legs-sentinel',boots:'boots-plate'}))Equipment.equip(id,slot);});
 const initial=await p.evaluate(()=>JSON.stringify({...localStorage}));
 for(const height of [568,667,844,932]){
  await p.setViewportSize({width,height});
  for(const id of ['overview','missions','encounters','gathering','services']){
   const tab=p.locator('[data-locality-tab="'+id+'"]');if(!await tab.count())continue;
   await tab.tap();await p.waitForTimeout(100);assert.equal(await tab.getAttribute('aria-pressed'),'true');
   const box=await tab.boundingBox();assert.ok(box.height>=44);await swipe(p,p.locator('#panel-world'));await audit(p);
   const panel=await p.locator('#panel-world').boundingBox(),nav=await p.locator('.bottom-nav').boundingBox();assert.ok(panel.y+panel.height<=nav.y+1,'Locality content cannot cover bottom navigation');
   const tabs=await p.locator('#locality-tabs').boundingBox();assert.ok(tabs.y>=panel.y&&tabs.y+tabs.height<=panel.y+panel.height,'Section controls remain in view after swiping');
  }
 }
 assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),initial,'Section selection/scroll never writes game saves');await p.setViewportSize({width,height:844});
 await press(p,'#world-tracked [data-world-fight="twilight-stag"]');assert.equal(await p.evaluate(()=>NymeriaNavigation.route.activity),'preparation');
 await press(p,'[data-world-stag-equipment]');await p.locator('#navigation-back').tap();assert.ok(await p.locator('#world-stag-preparation').isVisible(),'Equipment Back restores live preparation');
 await press(p,'[data-world-stag-start]');const ticket=await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id);
 assert.ok(await p.locator('#navigation-back').isDisabled());
 await p.evaluate(async()=>{WorldUI.engine.advance(180);await WorldUI.settle();});assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.lastEncounter.outcome),'victory');
 await dismiss(p);await press(p,'#world-result [data-quest-open="mq03"]');await press(p,'#quest-detail [data-quest-claim="mq03"]');await dismiss(p);
 assert.ok(await p.evaluate(()=>ProgressionStore.state.unlockedContent.includes('world:elar-ruins')));
 await press(p,'#world-quest-reward [data-quest-open="mq04"]');await press(p,'#quest-detail [data-quest-giver="mq04"]');
 assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.location),'elar-ruins');assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.quests.mq03.status),'claimed');
 for(let n=0;n<10&&await p.evaluate(()=>NymeriaNavigation.depth);n++){await p.locator('#navigation-back').tap();assert.notEqual(await p.evaluate(()=>NymeriaNavigation.route.view),'battle');assert.notEqual(await p.evaluate(()=>NymeriaNavigation.route.activity),'preparation');assert.ok(await p.locator('#world-result').isHidden());}
 // Tabs and consultations preserve the durable locality and offer a direct return.
 for(const tab of ['missions','inventory','character','menu']){
  await p.locator('#tab-'+tab).tap();await press(p,'#navigation-locality');assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.location),'elar-ruins');
 }
 await press(p,'#world-location-detail [data-world-talk="ilyen"]');await press(p,'#world-location-detail [data-quest-accept="mq04"]');
 await press(p,'#world-location-detail [data-world-fight="elar-sentinel"]');assert.ok(await p.locator('#world-battle').isVisible());
 await p.evaluate(async()=>{WorldUI.engine.advance(180);await WorldUI.settle();});await dismiss(p);await press(p,'[data-world-continue]');assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');assert.ok(await p.locator('#world-result').isHidden());
 const saved=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));assert.equal((await p.evaluate(id=>WorldSystem.finishEncounter(id),ticket)).ok,false,'An older receipt cannot be rewarded again after a new encounter');
 assert.equal((await p.evaluate(()=>QuestSystem.claim('mq03'))).ok,false);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),saved);
 await p.reload();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.location),'elar-ruins');assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),saved);assert.ok(await p.locator('#world-result').isHidden());await audit(p);
 assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejects),[]);await context.close();console.log('PASS locality '+width+': five live sections/four heights/touch/fixed shell, Cervo→claim→Elar→Back, prep/equipment, tab context, new encounter, refresh/no duplicate/no errors');
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
