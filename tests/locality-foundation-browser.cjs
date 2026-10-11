const assert=require('node:assert/strict'),{chromium}=require('playwright');
const Storage=require('../progression-store.js');
const {press}=require('./fixed-navigation-fixture.cjs');
const {audit}=require('./contextual-scroll-fixture.cjs');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026';
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const width of [320,375,390,430]){
 const fixture=Storage.initial();fixture.frontier.location='broken-path';fixture.frontier.quests.mq01.status='claimed';fixture.frontier.quests.mq02={status:'active',progress:[0,0]};fixture.frontier.trackedQuest='mq02';
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
 await context.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));},{key:Storage.KEY,state:fixture});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.url());});await p.goto(url);
 const saved=await p.evaluate(()=>JSON.stringify({...localStorage}));
 assert.equal(await p.locator('.bottom-nav button').count(),4);assert.match(await p.locator('#tab-world').innerText(),/Località/);
 assert.ok(await p.locator('#world-tracked').isVisible());assert.match(await p.locator('#world-tracked').innerText(),/Nessuno è tornato/);
 assert.equal(await p.locator('#panel-world [data-world-fight="vesper-raider"]').count(),1,'Primary encounter action is not duplicated among activities');
 for(const height of [568,667,844]){await p.setViewportSize({width,height});await audit(p);await press(p,'[data-locality-tab="services"]');assert.ok(await p.locator('#world-tracked').isVisible());await press(p,'[data-locality-tab="overview"]');}
 await p.setViewportSize({width,height:568});
 await p.locator('#panel-world').evaluate(n=>n.scrollTop=80);await p.waitForTimeout(100);
 const localityScroll=await p.locator('#panel-world').evaluate(n=>n.scrollTop);
 await p.locator('#tab-inventory').tap();await p.locator('#tab-world').tap();await p.waitForTimeout(100);
 assert.equal(await p.locator('#panel-world').evaluate(n=>n.scrollTop),localityScroll,'Primary tabs restore locality scroll');
 await p.setViewportSize({width,height:844});await press(p,'.world-shortcuts [data-world-view="overview"]');
 assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'overview');assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.location),'broken-path','Atlas consultation never travels');
 const locked=p.locator('#world-locations [data-world-enter="lantern-wood"]');assert.ok(await locked.isDisabled());assert.match(await locked.innerText(),/Nessuno è tornato/);
 await p.locator('#navigation-back').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');
 assert.equal(await p.evaluate(()=>document.activeElement.dataset.worldView),'overview','Back restores origin focus');
 await p.locator('#tab-menu').tap();await press(p,'#tab-character');assert.equal(await p.evaluate(()=>NymeriaNavigation.route.screen),'character');await p.locator('#navigation-back').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.screen),'menu');
 await p.locator('#tab-world').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');
 assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),saved,'Navigation never changes inventory or progression');
 await p.reload();assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.location),'broken-path');assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),saved);
 assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejections),[]);
 await context.close();
 const journey=Storage.initial();journey.frontier.quests.mq01={status:'active',progress:[1,0]};journey.frontier.trackedQuest='mq01';
 const c=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
 await c.addInitScript(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:Storage.KEY,state:journey});
 const q=await c.newPage(),journeyErrors=[];q.on('pageerror',e=>journeyErrors.push(e.message));await q.goto(url);
 assert.equal(await q.locator('#world-location-detail [data-world-enter="broken-path"]').count(),0,'Travel action is not duplicated in nearby activities');
 await press(q,'#world-tracked [data-quest-destination="broken-path"]');
 assert.equal(await q.evaluate(()=>ProgressionStore.state.frontier.location),'broken-path');
 assert.match(await q.locator('#world-tracked .quest-completed').innerText(),/Da riscuotere/);
 await press(q,'#world-tracked [data-quest-claim="mq01"]');
 const claimed=await q.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));
 assert.equal((await q.evaluate(()=>QuestSystem.claim('mq01'))).ok,false);
 assert.equal(await q.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),claimed,'Completed quest cannot pay twice');
 assert.deepEqual(journeyErrors,[]);await c.close();
 console.log('PASS locality foundation '+width+': four destinations/tracker/deduplication/Atlas locks/Back focus/Menu hero/three heights/persistence');
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
