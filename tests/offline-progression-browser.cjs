const assert=require('node:assert/strict'),{chromium}=require('playwright');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8000';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  for(const width of [320,375,390,430]) {
   const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
   await context.addInitScript(()=>{window.testNow=1700000000000;Date.now=()=>testNow;window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));});
   let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
   await page.evaluate(async()=>{
    ClassSystem.selectClass('warden');Equipment.equip('sword','mainHand');Equipment.equip('shield','support');
    await WorldSystem.enter('broken-path');await WorldSystem.startEncounter('vesper-raider',{seed:7});
    NymeriaNavigation.open('world',{view:'battle'});await WorldUI.resume();
   });
   const first=await page.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id);
   await page.evaluate(()=>{testNow+=1000;WorldUI.suspend();});
   await page.locator('#world-battle-pause').tap();
   await page.waitForFunction(()=>ProgressionStore.state.frontier.activeEncounter.clock.running===false);
   const paused=await page.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.clock.elapsedMs);assert.equal(paused,1000);
   await page.evaluate(async()=>{testNow+=1000000;document.dispatchEvent(new Event('nymeria:app-active'));await WorldUI.recover();});
   assert.equal(await page.evaluate(()=>WorldUI.engine.status),'paused');
   assert.equal(await page.evaluate(()=>WorldUI.engine.time),1);
   await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await page.evaluate(()=>NymeriaNavigation.open('world',{view:'battle'}));
   await page.waitForFunction(()=>WorldUI.engine?.status==='paused');
   assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id),first);
   await page.evaluate(()=>{testNow+=2000000;});await page.locator('#world-battle-resume').tap();
   await page.waitForFunction(()=>ProgressionStore.state.frontier.activeEncounter.clock.running);
   await page.evaluate(()=>{WorldUI.suspend();testNow+=500;});
   await page.reload();await page.evaluate(()=>NymeriaNavigation.open('world',{view:'battle'}));
   // A backwards wall clock freezes elapsed growth rather than completing the encounter.
   assert.ok(await page.evaluate(()=>ProgressionStore.state.frontier.activeEncounter));
   await page.evaluate(async()=>{testNow+=4000000;await WorldUI.recover();});
   await page.waitForFunction(()=>!ProgressionStore.state.frontier.activeEncounter);
   const paid=await page.evaluate(()=>({xp:ProgressionStore.state.totalXP,crowns:ProgressionStore.state.crowns,id:ProgressionStore.state.frontier.lastEncounter.id}));
   assert.equal(paid.id,first);assert.ok(paid.xp>0);
   await page.reload();await page.evaluate(async()=>{testNow+=5000000;await WorldUI.recover();document.dispatchEvent(new Event('nymeria:app-active'));dispatchEvent(new Event('pageshow'));});
   assert.deepEqual(await page.evaluate(()=>({xp:ProgressionStore.state.totalXP,crowns:ProgressionStore.state.crowns,id:ProgressionStore.state.frontier.lastEncounter.id})),paid);
   await page.evaluate(async()=>{
    await ProgressionSystem.start('patrol',{seed:7});testNow=ProgressionStore.state.activeExpedition.endsAt;
    document.dispatchEvent(new Event('nymeria:app-active'));
   });
   await page.waitForFunction(()=>ProgressionStore.state.pendingExpeditionResult);
   const report=await page.evaluate(()=>ProgressionStore.state.pendingExpeditionResult.id);
   await page.evaluate(()=>NymeriaNavigation.open('expeditions'));
   await page.locator('#expedition-claim').tap();await page.waitForFunction(()=>!ProgressionStore.state.pendingExpeditionResult);
   const xp=await page.evaluate(()=>ProgressionStore.state.totalXP);
   await page.reload();await page.evaluate(async()=>{await ProgressionSystem.refresh();});
   assert.equal(await page.evaluate(()=>ProgressionStore.state.lastClaim.id),report);
   assert.equal(await page.evaluate(()=>ProgressionStore.state.totalXP),xp);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>rejections),[]);
   console.log(`PASS offline browser ${width}px: actual pause/resume controls, native foreground event, close/reopen, backwards clock, automatic result and once-only expedition claim`);
   await context.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
