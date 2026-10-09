const assert=require('node:assert/strict'),{chromium}=require('playwright');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8025';
async function tap(page,selector){for(let i=0;i<25;i++){if(await page.locator(selector).isVisible()){if(selector==='#travel-confirm')assert.ok((await page.locator(selector).boundingBox()).height>=44);await page.locator(selector).tap();return;}const next=page.locator('.app > .fixed-pager [data-fixed-next]');if(await next.isVisible()&&!await next.isDisabled()){await next.tap();await page.waitForTimeout(40);}else break;}throw Error('Unreachable '+selector);}
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
  await context.addInitScript(()=>{window.travelNow=1700000000000;Date.now=()=>travelNow;window.rejects=[];addEventListener('unhandledrejection',e=>rejects.push(String(e.reason)));});
  let p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
  await p.goto(url+'/?test=1');await p.waitForTimeout(200);await tap(p,'#travel-open');
  assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'travel');
  for(const height of [667,780,932]){await p.setViewportSize({width,height});await p.waitForTimeout(100);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.equal(await p.locator('#travel-confirm').isDisabled(),true);
   assert.equal(await p.evaluate(()=>TravelSystem.state.active),null);
  }
  await p.setViewportSize({width,height:844});await p.waitForTimeout(100);
  const select=p.locator('#travel-route');if(!await select.isVisible())await p.locator('.fixed-pager [data-fixed-prev]').first().tap();
  await select.selectOption('test-veyra-path');await p.waitForTimeout(100);await tap(p,'#travel-confirm');
  await p.waitForFunction(()=>TravelSystem.state.active);const ticket=await p.evaluate(()=>TravelSystem.state.active);
  assert.equal(ticket.durationMs,90000);
  assert.equal((await p.evaluate(()=>TravelSystem.start('test-veyra-path'))).ok,false);
  await p.reload();await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>TravelSystem.state.active.id),ticket.id);
  await p.evaluate(()=>{NymeriaNavigation.open('world',{view:'travel'});travelNow+=30000;});
  await p.evaluate(()=>TravelUI.recover());assert.ok(await p.evaluate(()=>TravelSystem.state.active));
  assert.equal((await p.evaluate(()=>WorldSystem.enter('broken-path'))).ok,false);
  assert.equal((await p.evaluate(()=>ProfessionUI.engine.gather('vesper-iron-vein'))).ok,false);
  await p.evaluate(()=>NymeriaNavigation.destination('inventory'));assert.equal(await p.evaluate(()=>NymeriaNavigation.route.screen),'inventory');
  await p.close();p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/?test=1');
  await p.evaluate(async()=>{travelNow=TravelSystem.state.active.endsAt+1000000;await TravelUI.recover();});
  await p.waitForFunction(()=>ProgressionStore.state.frontier.location==='broken-path');
  assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.location),'broken-path');
  const receipt=await p.evaluate(()=>TravelSystem.state.lastArrival);await p.reload();await p.evaluate(()=>TravelUI.recover());
  assert.deepEqual(await p.evaluate(()=>TravelSystem.state.lastArrival),receipt);
  assert.equal(await p.evaluate(()=>ProgressionStore.state.totalXP),0);assert.equal(await p.evaluate(()=>ProgressionStore.state.crowns),0);
  assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejects),[]);
  await context.close();console.log('PASS travel mobile '+width+'px / heights 667,780,844,932: touch, pagination, explicit route, reload/close-reopen, guarded actions, inventory, offline arrival once');
 }
 const p=await browser.newPage();await p.goto(url);assert.equal(await p.locator('#travel-open').isVisible(),false);assert.equal((await p.evaluate(()=>TravelSystem.start('test-veyra-path'))).ok,false);await p.close();
 console.log('PASS normal mode: no test routes or debug entry');
 const denied=await browser.newContext({hasTouch:true});await denied.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='nymeria.progression.v1')throw Error('quota');return set.call(this,k,v);};});
 const d=await denied.newPage();await d.goto(url+'/?test=1');await d.evaluate(()=>NymeriaNavigation.open('world',{view:'travel'}));
 await d.locator('#travel-route').selectOption('test-veyra-path');await tap(d,'#travel-confirm');
 await d.waitForFunction(()=>!!ProgressionStore.error);assert.equal(await d.evaluate(()=>TravelSystem.state.active),null);
 assert.match(await d.locator('#travel-feedback').textContent(),/Salvataggio non riuscito/);await denied.close();
 console.log('PASS failed persistence: visible feedback, no departure applied');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
