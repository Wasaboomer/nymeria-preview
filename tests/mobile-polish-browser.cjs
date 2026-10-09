const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {press,reach}=require('./fixed-navigation-fixture.cjs'),{audit,swipe}=require('./contextual-scroll-fixture.cjs');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026';
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{window.polishNow=1700000000000;Date.now=()=>polishNow;window.rejects=[];addEventListener('unhandledrejection',e=>rejects.push(String(e.reason)));});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
  await p.goto(url+'/?test=1');await p.waitForTimeout(150);
  const initial=await p.evaluate(()=>JSON.stringify({...localStorage}));
  await p.locator('#tab-world').tap();assert.match(await p.locator('#map-current-context').innerText(),/Ti trovi a Avamposto di Veyra/);
  await press(p,'#map-travel-open');assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'travel');
  assert.equal(await p.locator('#regional-travel').getAttribute('data-travel-state'),'ready');
  await p.locator('#navigation-back').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'overview');
  await press(p,'#map-current-context [data-world-enter="veyra"]');assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');
  await press(p,'#travel-open');await p.locator('#navigation-back').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');
  assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),initial,'Navigation/presentation never writes game state');
  await press(p,'#world-tracked [data-quest-accept="mq01"]');
  assert.match(await p.locator('#world-tracked').textContent(),/Oltre il confine/);
  assert.match(await p.locator('#world-tracked').textContent(),/Parla con Serah.*0\/1/s);
  await press(p,'#world-tracked [data-world-talk="serah"]');
  assert.match(await p.locator('#world-tracked').textContent(),/Visita il Sentiero Spezzato/);
  assert.match(await p.locator('#world-tracked').textContent(),/Destinazione: Sentiero Spezzato/);
  await press(p,'#world-tracked [data-quest-open="mq01"]');
  assert.match(await p.locator('#quest-detail').textContent(),/Destinazione: Sentiero Spezzato/);
  const questSave=await p.evaluate(()=>JSON.stringify({...localStorage}));
  await p.locator('#navigation-back').tap();assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),questSave);
  await press(p,'#world-tracked [data-quest-open="mq01"]');
  await press(p,'#quest-detail [data-quest-destination="broken-path"]');
  assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');
  await p.locator('#navigation-back').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'quest');
  assert.match(await p.locator('#quest-detail').textContent(),/Obiettivi completati/);
  await p.locator('#tab-missions').tap();await press(p,'#quest-journal [data-quest-open="mq03"]');
  assert.match(await p.locator('#quest-detail').textContent(),/Richiede livello 2 e Nessuno è tornato/);
  assert.equal(await p.locator('#quest-detail [data-quest-destination]').count(),0);
  // Presentation-only long-copy fixture: no quest definitions or save changes.
  const lockedSave=await p.evaluate(()=>JSON.stringify({...localStorage}));
  await p.locator('#quest-detail summary strong').evaluate(n=>n.textContent+=' · Una descrizione molto lunga per verificare la leggibilità su schermi verticali');
  for(const height of [568,667,844,932]){await p.setViewportSize({width,height});await p.waitForTimeout(100);await audit(p);await swipe(p,p.locator('#panel-world'));await audit(p);}
  assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),lockedSave);
  await p.setViewportSize({width,height:844});
  await p.locator('#tab-world').tap();await press(p,'#world-locations [data-world-enter="veyra"]');
  await p.locator('#tab-character').tap();await p.locator('#identity-race').selectOption('thalassi');await press(p,'#identity-confirm');
  await p.waitForFunction(()=>CharacterIdentitySystem.state.raceId==='thalassi');
  assert.match(await p.locator('#character-identity').textContent(),/Razza attuale: Thalassi/);
  assert.equal(await p.locator('#identity-race option').count(),8);
  for(const height of [568,667,844,932]){
   await p.setViewportSize({width,height});await p.waitForTimeout(100);await audit(p);
   await p.locator('#identity-race').scrollIntoViewIfNeeded();
   const field=await p.locator('#identity-race').boundingBox(),label=await p.locator('[for="identity-race"]').boundingBox();
   assert.ok(field.y>=label.y+label.height,'Label and select on separate rows');assert.ok(field.height>=48);
   await swipe(p,p.locator('#panel-character'));await audit(p);
  }
  await p.setViewportSize({width,height:844});
  await p.locator('#tab-world').tap();await press(p,'#map-travel-open');
  await reach(p,p.locator('#travel-route'));await p.locator('#travel-route').selectOption('test-veyra-path');
  assert.match(await p.locator('#regional-travel').textContent(),/Partenza: Avamposto di Veyra.*Terrestre.*Durata: 90 s/s);
  assert.equal(await p.locator('#travel-confirm').isDisabled(),false);
  await press(p,'#travel-confirm');await p.waitForFunction(()=>!!TravelSystem.state.active);
  const ticket=await p.evaluate(()=>TravelSystem.state.active),appearance=await p.evaluate(()=>JSON.stringify(Equipment.state));
  assert.equal(await p.locator('#regional-travel').getAttribute('data-travel-state'),'active');
  assert.match(await p.locator('#travel-active-summary').textContent(),/Avamposto di Veyra.*Sentiero Spezzato/s);
  assert.equal(await p.locator('#travel-route').count(),0);assert.equal(await p.locator('#travel-arrival-summary').count(),0);
  await p.evaluate(()=>{polishNow+=30000;TravelUI.render();});assert.match(await p.locator('#travel-countdown').textContent(),/60 s/);
  for(const height of [568,667,844,932]){await p.setViewportSize({width,height});await p.waitForTimeout(100);await reach(p,p.locator('#travel-countdown'));await audit(p);assert.match(await p.locator('#travel-countdown').textContent(),/60 s/);}
  await p.reload();assert.equal(await p.evaluate(()=>CharacterIdentitySystem.state.raceId),'thalassi');assert.equal(await p.evaluate(()=>TravelSystem.state.active.id),ticket.id);
  await p.evaluate(async()=>{polishNow=TravelSystem.state.active.endsAt+1;await TravelUI.recover();NymeriaNavigation.open('world',{view:'travel'});});await p.waitForTimeout(100);
  assert.equal(await p.locator('#regional-travel').getAttribute('data-travel-state'),'arrived');
  assert.match(await p.locator('#travel-arrival-summary').textContent(),/Hai raggiunto Sentiero Spezzato/);
  assert.equal(await p.locator('#travel-countdown').count(),0);assert.equal(await p.locator('#travel-route').count(),0);
  const receipt=await p.evaluate(()=>TravelSystem.state.lastArrival);
  await p.evaluate(async()=>{await TravelUI.recover();await TravelUI.recover();});assert.deepEqual(await p.evaluate(()=>TravelSystem.state.lastArrival),receipt);
  assert.equal(await p.evaluate(()=>JSON.stringify(Equipment.state)),appearance);
  await press(p,'#travel-new');await reach(p,p.locator('#travel-route'));await p.locator('#travel-route').selectOption('test-path-veyra');
  assert.equal(await p.locator('#regional-travel').getAttribute('data-travel-state'),'ready');assert.match(await p.locator('#regional-travel').textContent(),/Ultimo arrivo.*Costiero.*120 s/s);
  await press(p,'#regional-travel [data-world-view="places"]');assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');
  assert.match(await p.locator('#world-current').textContent(),/Sentiero Spezzato/);
  await p.locator('#tab-world').tap();assert.match(await p.locator('#map-current-context').textContent(),/Ti trovi a Sentiero Spezzato/);
  const saved=await p.evaluate(()=>JSON.stringify({...localStorage}));await p.reload();assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),saved);
  assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejects),[]);await context.close();
  console.log('PASS polish '+width+': map/place/travel/back, real quest objective/actions, race rows/48px touch/scroll, ready/active/countdown/arrival/new trip, reload/idempotency/unchanged saves, four heights/no overflow/errors');
 }
 const normal=await browser.newPage();await normal.goto(url);await normal.locator('#tab-world').click();assert.equal(await normal.locator('#map-travel-open').count(),0);assert.ok(await normal.locator('#travel-open').isHidden());await normal.close();
 console.log('PASS normal mode: no TEST travel shortcut exposed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
