const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {audit}=require('./contextual-scroll-fixture.cjs');
const {press}=require('./fixed-navigation-fixture.cjs');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8000';
(async()=>{const b=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430]){
  const p=await b.newPage({viewport:{width,height:844},hasTouch:true,isMobile:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));});await p.goto(url);
  assert.equal(await p.locator('.bottom-nav button').count(),5);
  assert.deepEqual(await p.locator('.bottom-nav button').allTextContents(),['Mappa','◆Missioni','Eroe','▣Inventario','Menu']);
  const saved=await p.evaluate(()=>JSON.stringify({...localStorage}));
  await p.locator('#tab-missions').tap();await p.waitForTimeout(100);
  assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'journal');
  assert.match(await p.locator('.journal-entry').first().innerText(),/Accetta da.*Serah/);
  await press(p,'[data-fixed-category="profession"]');
  await press(p,'[data-quest-open="sq-bram-preparation"]');assert.equal(await p.evaluate(()=>NymeriaNavigation.route.questId),'sq-bram-preparation');
  await p.locator('#tab-inventory').tap();await press(p,'[data-filter="weapons"]');
  await p.locator('#panel-inventory').evaluate(n=>n.scrollTop=100);await p.waitForTimeout(100);
  const scroll=await p.locator('#panel-inventory').evaluate(n=>n.scrollTop);
  await p.locator('#tab-character').tap();await press(p,'[data-nav="equipment"]');
  await p.locator('#tab-menu').tap();await press(p,'#tab-expeditions');assert.equal(await p.locator('#tab-menu').getAttribute('aria-selected'),'true');await p.locator('#navigation-back').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.screen),'menu');await press(p,'[data-nav="professions"]');
  await p.locator('#tab-inventory').tap();await p.waitForTimeout(150);
  assert.equal(await p.locator('[data-filter="weapons"]').getAttribute('aria-pressed'),'true');
  assert.equal(await p.locator('#panel-inventory').evaluate(n=>n.scrollTop),scroll);
  await p.locator('#tab-character').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.screen),'equipment');
  await p.locator('#navigation-back').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.screen),'character');
  await p.locator('#tab-menu').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.screen),'professions');
  await p.locator('#navigation-back').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.screen),'menu');
  await p.locator('#tab-missions').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.questId),'sq-bram-preparation');
  await p.locator('#navigation-back').tap();await p.waitForTimeout(100);assert.equal(await p.locator('[data-fixed-category="profession"]').getAttribute('aria-pressed'),'true');
  await p.locator('#tab-world').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'overview');assert.equal(await p.evaluate(()=>NymeriaNavigation.depth),0);
  await press(p,'#world-return-place');assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');await p.locator('#navigation-back').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'overview');
  for(const height of [375,508,667,844]){
   await p.setViewportSize({width,height});
   for(const id of ['world','missions','character','inventory','menu']){await p.locator('#tab-'+id).tap();await p.waitForTimeout(80);await audit(p);const rect=await p.locator('.bottom-nav').boundingBox();assert.ok(rect.y+rect.height<=height);}
  }
  await p.setViewportSize({width,height:375});
  await p.evaluate(()=>InventoryUI.openItem('sword'));await p.waitForTimeout(100);await p.locator('#item-dialog [data-fixed-next]').tap();assert.ok(await p.evaluate(()=>FixedScreens.page)>0);await p.locator('#close-detail').tap();await p.evaluate(()=>InventoryUI.openItem('shield'));await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>FixedScreens.page),0,'Each new comparison opens at its first page');await p.locator('#close-detail').tap();await p.setViewportSize({width,height:844});
  assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),saved);
  await p.reload();assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),saved);assert.ok(await p.locator('#menu-debug-link').isHidden());
  await p.evaluate(async()=>{ClassSystem.selectClass('warden');Equipment.equip('sword','mainHand');Equipment.equip('shield','support');await WorldSystem.enter('broken-path');await WorldSystem.startEncounter('vesper-raider');NymeriaNavigation.open('world',{view:'battle'});});
  await p.reload();await p.waitForTimeout(100);assert.equal(await p.locator('#world-ability-status-list li').count(),await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.snapshot.profile.abilities.length),'Ability status is initialized before resuming a saved encounter');
  await p.evaluate(()=>{WorldUI.resume();WorldUI.engine.advance(3);});
  await p.locator('#world-battle-pause').tap();await p.waitForTimeout(100);
  assert.equal(await p.locator('.bottom-nav button:disabled').count(),5);
  assert.ok(await p.locator('#navigation-back').isDisabled());assert.ok(await p.locator('#current-quest-link').isDisabled());
  await p.evaluate(()=>{NymeriaNavigation.root('menu');NymeriaNavigation.open('inventory');NymeriaNavigation.back();});assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'battle');
  const actual=await p.evaluate(()=>({damage:WorldUI.engine.metrics.damage,taken:WorldUI.engine.metrics.damageTaken,enemyHit:document.getElementById('world-enemy-hp').dataset.hit}));assert.ok(actual.damage>0);assert.ok(Number(actual.enemyHit)>0);
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('#world-enemy-hp').evaluate(n=>getComputedStyle(n).animationName),'none');
  await p.locator('#world-history-toggle').tap();await p.waitForTimeout(100);await p.locator('.combat-abilities summary').tap();await p.waitForTimeout(100);
  const statuses=await p.evaluate(()=>WorldUI.engine.abilities.map(a=>({name:a.name,canAfford:WorldUI.engine.canAfford(a.id),ready:WorldUI.engine.ready(a.id)})));
  const text=await p.locator('#world-ability-status-list').innerText();for(const a of statuses){assert.ok(text.includes(a.name));if(!a.ready)assert.match(text,/Ricarica/);}
  for(const height of [375,508,844]){await p.setViewportSize({width,height});await p.waitForTimeout(100);await audit(p);assert.ok(await p.locator('#world-battle-history').evaluate(n=>n.clientHeight)>=44,'Readable log alongside skill states');assert.ok(await p.locator('#world-battle-resume').isVisible());}
  await p.locator('#world-battle-abandon').tap();assert.ok(await p.locator('#combat-exit-confirm').isVisible());
  const ticket=await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id);await p.locator('#combat-exit-cancel').tap();assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id),ticket);
  await p.locator('#world-battle-abandon').tap();await p.locator('#combat-exit-accept').tap();await p.waitForFunction(()=>!ProgressionStore.state.frontier.activeEncounter);
  assert.equal(await p.locator('.bottom-nav button:disabled').count(),0);assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.location),'veyra');
  assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejections),[]);await p.close();console.log(`PASS Sprint12 ${width}: five destinations, context/back/filter/scroll memory, no save changes, combat guard/real feedback/readiness/confirmed exit`);
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
