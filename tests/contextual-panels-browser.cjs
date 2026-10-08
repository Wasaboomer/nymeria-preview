const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {audit,swipe}=require('./contextual-scroll-fixture.cjs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{for(const width of [320,375,390,430]){
 const p=await browser.newPage({viewport:{width,height:508},isMobile:true,hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8000');await p.waitForTimeout(100);
 const saved=await p.evaluate(()=>JSON.stringify({...localStorage}));
 for(const screen of ['inventory','equipment','professions','journal']){
  await p.evaluate(screen=>{if(screen==='journal')NymeriaNavigation.open('world',{view:'journal'});else NymeriaNavigation.open(screen);},screen);await p.waitForTimeout(100);
  const panel=p.locator('.app > [id^="panel-"]:not([hidden])');assert.equal(await panel.getAttribute('data-fixed-mode'),'scroll');if(screen==='inventory')assert.ok(await p.locator('.inventory-item').count()>20);
  const max=await panel.evaluate(n=>n.scrollHeight-n.clientHeight);assert.ok(max>0,screen+' has test content');await panel.evaluate(n=>n.scrollTop=0);
  const nav=await p.locator('.bottom-nav').boundingBox();await swipe(p,panel);assert.ok(await panel.evaluate(n=>n.scrollTop)>0,screen+' internal touch pan must work');await audit(p);assert.deepEqual(await p.locator('.bottom-nav').boundingBox(),nav);
  await swipe(p,panel,'x');await audit(p);await panel.evaluate(n=>n.scrollTop=99999);await swipe(p,panel);await audit(p);
  await p.locator('#tab-world').tap();await p.waitForTimeout(100);assert.ok(await p.locator('#panel-world').isVisible());
 }
 assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),saved);await p.reload();assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),saved);await audit(p);assert.deepEqual(errors,[]);console.log('PASS panels '+width+': many items/quests, internal touch scroll works, fixed nav/root, no horizontal/chaining, save/reload unchanged');await p.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
