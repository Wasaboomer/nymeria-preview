const assert=require('node:assert/strict'),{chromium}=require('playwright'),{press}=require('./fixed-navigation-fixture.cjs');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026';
(async()=>{const browser=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
  await context.addInitScript(()=>{window.identityNow=1700000000000;Date.now=()=>identityNow;window.rejects=[];addEventListener('unhandledrejection',e=>rejects.push(String(e.reason)));});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
  await p.goto(url);await p.locator('#tab-character').tap();
  assert.equal(await p.evaluate(()=>CharacterIdentitySystem.state.raceId),null);
  const appearance=await p.evaluate(()=>JSON.stringify(Equipment.state));
  assert.match(await p.locator('#character-identity').textContent(),/ancora incomplete/);
  assert.equal(await p.locator('#identity-confirm').isDisabled(),true);
  await p.locator('#identity-race').selectOption('thalassi');await press(p,'#identity-confirm');
  await p.waitForFunction(()=>CharacterIdentitySystem.state.raceId==='thalassi');
  assert.equal(await p.evaluate(()=>JSON.stringify(Equipment.state)),appearance);
  assert.equal(await p.locator('#identity-reset').count(),0);assert.equal(await p.locator('#identity-race').count(),0);
  assert.equal((await p.evaluate(()=>CharacterIdentitySystem.assign('human'))).ok,false);
  await p.reload();assert.equal(await p.evaluate(()=>CharacterIdentitySystem.state.raceId),'thalassi');
  await p.goto(url+'/?test=1');await p.locator('#tab-character').tap();
  await p.locator('#identity-race').selectOption('human');await press(p,'#identity-confirm');await p.waitForFunction(()=>CharacterIdentitySystem.state.raceId==='human');
  await press(p,'#identity-reset');await p.waitForFunction(()=>CharacterIdentitySystem.state.raceId===null);
  await p.evaluate(()=>NymeriaNavigation.open('world',{view:'travel'}));await p.locator('#travel-route').selectOption('test-veyra-path');
  assert.match(await p.locator('#regional-travel').textContent(),/Terrestre/);assert.match(await p.locator('#regional-travel').textContent(),/requisiti soddisfatti/);
  await press(p,'#travel-confirm');await p.waitForFunction(()=>TravelSystem.state.active);
  const ticket=await p.evaluate(()=>TravelSystem.state.active);assert.equal(ticket.requirementsSnapshot.raceId,null);
  await p.locator('#tab-character').tap();assert.equal(await p.locator('#identity-race').isDisabled(),true);
  assert.equal((await p.evaluate(()=>CharacterIdentitySystem.assign('thalassi'))).ok,false);
  await p.reload();assert.deepEqual(await p.evaluate(()=>TravelSystem.state.active.requirementsSnapshot),ticket.requirementsSnapshot);
  await p.evaluate(()=>{identityNow=TravelSystem.state.active.endsAt+999999;document.dispatchEvent(new Event('nymeria:app-active'));});
  await p.waitForFunction(()=>TravelSystem.state.active===null);
  const receipt=await p.evaluate(()=>TravelSystem.state.lastArrival);await p.evaluate(()=>TravelUI.recover());assert.deepEqual(await p.evaluate(()=>TravelSystem.state.lastArrival),receipt);
  for(const height of [667,780,932]){await p.setViewportSize({width,height});await p.locator('#tab-character').tap();await p.waitForTimeout(100);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const box=await p.locator('#identity-confirm').boundingBox();assert.ok(box.height>=44);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejects),[]);await context.close();
  console.log('PASS identity/environment '+width+'px: explicit choice, normal lock, TEST change/reset, unchanged avatar, reload, no-race land route, snapshot/offline arrival, transit guard, heights/touch/no JS errors');
 }
 const c=await browser.newContext({hasTouch:true});await c.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='nymeria.progression.v1')throw Error('quota');return set.call(this,k,v);};});
 const p=await c.newPage();await p.goto(url);await p.locator('#tab-character').tap();await p.locator('#identity-race').selectOption('human');await press(p,'#identity-confirm');
 await p.waitForFunction(()=>!!ProgressionStore.error);assert.equal(await p.evaluate(()=>CharacterIdentitySystem.state.raceId),null);assert.match(await p.locator('#identity-feedback').textContent(),/Salvataggio non riuscito/);await c.close();
 console.log('PASS identity persistence failure: no assignment, visible feedback');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
