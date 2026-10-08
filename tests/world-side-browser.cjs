const navigate = require('./mobile-navigation-fixture.cjs');
/* Side quest UI integration, particularly M5 expedition → M6 dispatcher. */
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const dismissNotifications = require('./notifications-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const width of [320,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8000')+'/?test=1');
  await page.evaluate(async()=>{
   const cls=innerWidth===390?'warden':'hunter';ClassSystem.selectClass(cls);
   for(const [slot,id] of Object.entries(cls==='warden'?{mainHand:'sword',support:'shield',torso:'torso-warden',legs:'legs-sentinel',boots:'boots-plate'}:{mainHand:'bow',support:'quiver',torso:'torso-chain',legs:'legs-chain',boots:'boots-chain'}))Equipment.equip(id,slot);
   await ProgressionStore.transact(s=>{s.totalXP=ProgressionData.thresholds[4];return {ok:true};});
   for(const id of ['mq01','mq02','mq03']) {const q=QuestData.get(id);await WorldSystem.enter(q.location);await QuestSystem.accept(id);await QuestSystem.debug(id,'complete');await QuestSystem.claim(id);}
   await WorldSystem.enter('veyra');
  });
  await dismissNotifications(page);
  await page.locator('#tab-world').tap();
  const tap=async selector=>{await dismissNotifications(page);await page.locator(selector+':visible').tap();await page.waitForFunction(()=>document.getElementById('panel-world').getAttribute('aria-busy')==='false');};
  const accept=id=>tap(`#world-location-detail [data-quest-accept="${id}"]`);
  const enter=async id=>{await tap('[data-world-view="overview"]');await tap(`[data-world-enter="${id}"]`);};
  const claim=async id=>{
   await tap('[data-world-view="journal"]');await tap(`.journal-entry[data-quest-open="${id}"]`);
   await tap(`#quest-detail [data-quest-claim="${id}"]`);
   assert.equal(await page.evaluate(id=>ProgressionStore.state.frontier.quests[id].status,id),'claimed');
   await tap('#navigation-back');await tap('#navigation-back');
  };
  await accept('sq-debt');await accept('sq-herbs');await enter('broken-path');await accept('sq-merchant');await tap('#world-location-detail [data-world-explore="lost-cart"]');
  for(let i=0;i<2;i++){
   await tap('#world-location-detail [data-world-fight="vesper-raider"]');
   await page.evaluate(async()=>{WorldUI.engine.advance(180);await WorldUI.settle();});await tap('[data-world-continue]');
  }
  await claim('sq-debt');
  await page.locator('#tab-expeditions').tap();await page.locator('[data-start-expedition="patrol"]').tap();await page.locator('#expedition-running').waitFor({state:'visible'});
  await navigate(page,'debug');await page.locator('#expedition-debug-complete').tap();await navigate(page,'expeditions');await page.locator('#expedition-report').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.quests['sq-merchant'].progress[2]),0);
  await page.locator('#expedition-claim').tap();await page.locator('#expedition-claimed').waitFor({state:'visible'});
  await page.locator('#tab-world').tap();await claim('sq-merchant');
  await enter('lantern-wood');for(let i=0;i<3;i++)await tap('#world-location-detail [data-world-explore="mist-herbs"]');
  await enter('veyra');await tap('#world-location-detail [data-world-talk="mira"]');await claim('sq-herbs');
  await enter('elar-ruins');await accept('sq-window');await tap('#world-location-detail [data-world-explore="lit-window"]');await tap('#world-location-detail [data-world-talk="ilyen"]');await claim('sq-window');
  await page.reload();await page.locator('#tab-world').tap();
  assert.ok(await page.evaluate(()=>['sq-debt','sq-herbs','sq-merchant','sq-window'].every(id=>ProgressionStore.state.frontier.quests[id].status==='claimed')));
  assert.ok(await page.evaluate(()=>Equipment.state.inventory.some(i=>i.id==='frontier-ring')));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: four side quest UI, herbs, narrative without combat, real M5 expedition claim dispatcher, universal ring, persistence/touch/no errors/overflow`);
  await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
