/* Menu-only proof: real routes, coordinate touch, context and immutable game state. */
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {press}=require('./fixed-navigation-fixture.cjs');
const Store=require('../progression-store.js');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8018';
const routes={character:['character',undefined],equipment:['equipment',undefined],class:['class',undefined],professions:['professions',undefined],expeditions:['expeditions',undefined],discoveries:['world','discoveries'],guild:['guild',undefined]};
(async()=>{const b=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const width of [320,375,390,430]){
 const c=await b.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true}),p=await c.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`)});
 const initial=Store.initial();initial.frontier.location='broken-path';initial.unlockedContent.push('world:broken-path');
 await p.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)))},{key:Store.KEY,state:initial});
 await p.goto(url);await p.waitForFunction(()=>typeof Equipment!=='undefined');
 const save=await p.evaluate(()=>JSON.stringify({...localStorage}));
 await p.locator('#tab-menu').tap();
 assert.deepEqual(await p.locator('#panel-menu .menu-group h2').allTextContents(),['Personaggio','Attività','Conoscenze e Comunità']);
 assert.equal(await p.locator('#panel-menu .menu-group [data-nav]').count(),7);
 assert.ok(await p.locator('#menu-debug-link').isHidden());
 for(const height of [568,667,844]){
  await p.setViewportSize({width,height});await p.waitForTimeout(100);
  for(const [dest,[screen,view]] of Object.entries(routes)){
   const control=p.locator(`#panel-menu [data-nav="${dest}"]`);
   await control.scrollIntoViewIfNeeded();
   const rect=await control.boundingBox();assert.ok(rect.height>=48);assert.equal(await control.locator('svg').count(),1);
   const scrolled=await p.locator('#panel-menu').evaluate(e=>e.scrollTop);
   await p.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height/2);
   assert.equal(await p.evaluate(()=>NymeriaNavigation.route.screen),screen);
   if(view)assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),view);
   await p.locator('#navigation-back').tap();await p.waitForTimeout(100);
   assert.equal(await p.evaluate(()=>NymeriaNavigation.route.screen),'menu');
   assert.equal(await p.locator('#panel-menu').evaluate(e=>e.scrollTop),scrolled);
   assert.equal(await p.evaluate(()=>document.activeElement.dataset.nav),dest);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await p.locator('#panel-menu').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  }
  assert.ok(await p.locator('#tab-world').isVisible());
 }
 assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),save,'Menu navigation must not mutate saves');
 if(width===390){await p.locator('#panel-menu').evaluate(e=>e.scrollTop=0);await p.screenshot({path:'/tmp/nymeria-menu-phase1-390.png'});}
 await p.reload();assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),save);
 // An active encounter retains the same bottom-navigation guard.
 await p.evaluate(async()=>{ClassSystem.selectClass('hunter');Equipment.equip('bow','mainHand');Equipment.equip('quiver','support');});
 await press(p,'#panel-world [data-world-fight="vesper-raider"]');
 await p.waitForFunction(()=>ProgressionStore.state.frontier.activeEncounter);
 assert.ok(await p.locator('#tab-menu').isDisabled());
 assert.ok(await p.locator('#navigation-back').isDisabled());
 assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejections),[]);
 await c.close();console.log(`PASS menu ${width}: 7 routes/3 heights, coordinate touch, 48px targets, scroll/focus/Back, storage/reload, combat guard, no errors/overflow`);
}
const c=await b.newContext(),p=await c.newPage();await p.goto(url+'/?test=1');await p.locator('#tab-menu').click();assert.ok(await p.locator('#menu-debug-link').isVisible());await c.close();
console.log('PASS debug remains Test Mode only');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
