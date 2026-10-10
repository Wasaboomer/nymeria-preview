const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {press,reach}=require('./fixed-navigation-fixture.cjs'),{audit}=require('./contextual-scroll-fixture.cjs');
const Storage=require('../progression-store.js'),Data=require('../progression-data.js');
const fixture=Storage.initial();Object.assign(fixture,Data.fromTotal(140));
fixture.unlockedContent.push('world:veyra','world:broken-path','world:lantern-wood');
fixture.frontier.location='lantern-wood';fixture.frontier.trackedQuest='mq03';
fixture.frontier.quests.mq01.status='claimed';fixture.frontier.quests.mq02.status='claimed';
fixture.frontier.quests.mq03.status='active';fixture.frontier.quests.mq03.progress=[2,3,1,0];
fixture.frontier.supplies['corrupt-sample']=3;fixture.frontier.defeatedEnemies.push('corrupt-hound');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026';
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
  // Exact reported save fixture, isolated to this browser; no user saves or Debug commands.
  await context.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));window.rejects=[];addEventListener('unhandledrejection',e=>rejects.push(String(e.reason)));Math.random=()=>1/4294967296;},{key:Storage.KEY,state:fixture});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.url());});await p.goto(url);
  await p.evaluate(()=>{ClassSystem.selectClass('warden');for(const [slot,id]of Object.entries({mainHand:'sword',support:'shield',torso:'torso-warden',legs:'legs-sentinel',boots:'boots-plate'}))Equipment.equip(id,slot);NymeriaNavigation.open('world',{view:'quest',questId:'mq03'});});
  assert.deepEqual(await p.evaluate(()=>ProgressionStore.state.frontier.quests.mq03.progress),[2,3,1,0]);
  const save=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));
  assert.match(await p.locator('#quest-detail .quest-next-step').innerText(),/Combatti Cervo del Crepuscolo/);
  await press(p,'#quest-detail [data-world-fight="twilight-stag"]');
  assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');assert.ok(await p.locator('#world-stag-preparation').isVisible());
  assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),save,'Opening preparation never starts/finishes/rewards combat');
  await p.locator('#navigation-back').tap();assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'quest');
  await p.evaluate(()=>NymeriaNavigation.root('world'));
  assert.equal(await p.locator('#world-stag-preparation').isVisible(),false,'Returning to a place does not restore stale preparation');
  await press(p,'#world-tracked [data-world-fight="twilight-stag"]');
  assert.ok(await p.locator('#world-stag-preparation').isVisible(),'Tracker in locality also reveals preparation');
  for(const height of [568,667,844]){await p.setViewportSize({width,height});await p.waitForTimeout(100);await reach(p,p.locator('[data-world-stag-start]'));assert.ok((await p.locator('[data-world-stag-start]').boundingBox()).height>=44);await audit(p);}
  await p.setViewportSize({width,height:844});await p.evaluate(()=>Equipment.unequip('mainHand'));
  await press(p,'[data-world-stag-start]');assert.ok(await p.locator('#world-stag-feedback').isVisible(),'Rejected start automatically presents its reason');
  assert.match(await p.locator('#world-stag-feedback').innerText(),/Prepara il kit della tua classe in Equipaggiamento/);
  assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter),null);
  assert.deepEqual(await p.evaluate(()=>ProgressionStore.state.frontier.quests.mq03.progress),[2,3,1,0]);
  await p.evaluate(()=>{Equipment.equip('sword','mainHand');Equipment.equip('shield','support');});await press(p,'[data-world-stag-start]');
  await p.waitForFunction(()=>ProgressionStore.state.frontier.activeEncounter?.enemyId==='twilight-stag');
  assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'battle');const id=await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id);
  await p.evaluate(async()=>{WorldUI.engine.advance(180);await WorldUI.settle();});
  assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.lastEncounter.outcome),'victory');
  assert.deepEqual(await p.evaluate(()=>ProgressionStore.state.frontier.quests.mq03.progress),[2,3,1,1]);
  assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.supplies['corrupt-sample']),4,'Existing three samples remain and the real stag drop is added');
  const awarded=await p.evaluate(()=>JSON.stringify({xp:ProgressionStore.state.totalXP,crowns:ProgressionStore.state.crowns,receipt:ProgressionStore.state.frontier.lastEncounter}));
  assert.equal((await p.evaluate(id=>WorldSystem.finishEncounter(id),id)).unchanged,true);
  await p.reload();assert.equal(await p.evaluate(()=>JSON.stringify({xp:ProgressionStore.state.totalXP,crowns:ProgressionStore.state.crowns,receipt:ProgressionStore.state.frontier.lastEncounter})),awarded);
  assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejects),[]);await context.close();
  console.log('PASS stag quest '+width+': exact 2/2,3/3,1/1,0/1 fixture, detail→visible preparation→battle, Back, kit rejection visible, 3 heights/touch/overflow, real victory/reload/no double reward/errors');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
