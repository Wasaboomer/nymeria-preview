/* A real feedback timeout crosses a physical touch gesture: never force click/retry. */
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {press}=require('./fixed-navigation-fixture.cjs'),{audit}=require('./contextual-scroll-fixture.cjs');
const dismiss=require('./notifications-fixture.cjs'),Storage=require('../progression-store.js'),Data=require('../progression-data.js');
const fixture=Storage.initial();Object.assign(fixture,Data.fromTotal(140));
fixture.unlockedContent.push('world:veyra','world:broken-path','world:lantern-wood');
fixture.frontier.location='lantern-wood';fixture.frontier.trackedQuest='mq03';
fixture.frontier.quests.mq01.status=fixture.frontier.quests.mq02.status='claimed';fixture.frontier.quests.mq03.status='active';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430])for(const source of ['locality','quest']){
  const context=await b.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
  await context.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));Math.random=()=>1/4294967296;window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));},{key:Storage.KEY,state:fixture});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await p.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026');
  await p.evaluate(()=>{ClassSystem.selectClass('hunter');for(const [slot,id]of Object.entries({mainHand:'bow',support:'quiver',torso:'torso-chain',legs:'legs-chain',boots:'boots-chain'}))Equipment.equip(id,slot);
   window.touchTrace=[];['touchstart','click'].forEach(type=>document.addEventListener(type,e=>touchTrace.push({type,enemy:e.target.closest('[data-world-fight]')?.dataset.worldFight}),true));
   const message=document.getElementById('world-message');window.feedbackAt=0;
   new MutationObserver(()=>{if(message.textContent)feedbackAt=performance.now();}).observe(message,{childList:true,characterData:true,subtree:true});
  });
  await press(p,'#world-location-detail [data-world-explore="cold-lantern"]');
  if(source==='quest')await press(p,'#world-tracked [data-quest-open="mq03"]');else await press(p,'[data-locality-tab="encounters"]');
  const target=p.locator((source==='quest'?'#quest-detail':'#world-location-detail')+' [data-world-fight="corrupt-hound"]');
  await target.scrollIntoViewIfNeeded();
  await p.waitForFunction(()=>feedbackAt>0&&performance.now()>=feedbackAt+3250);
  const rect=await target.boundingBox(),point={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
  const before=await p.evaluate(point=>({route:NymeriaNavigation.route,hit:document.elementFromPoint(point.x,point.y)?.closest('[data-world-fight]')?.dataset.worldFight,message:document.getElementById('world-message').textContent}),point);
  assert.equal(before.hit,'corrupt-hound');assert.ok(before.message,'Touch must begin before the real 3500ms expiry');
  const cd=await context.newCDPSession(p);await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await p.waitForFunction(()=>!document.getElementById('world-message').textContent);
  const expired=await target.boundingBox();assert.deepEqual(expired,rect,'Feedback expiry must not move the pressed control');
  assert.equal(await p.evaluate(point=>document.elementFromPoint(point.x,point.y)?.closest('[data-world-fight]')?.dataset.worldFight,point),'corrupt-hound');
  await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cd.detach();
  await p.waitForFunction(()=>NymeriaNavigation.route.view==='battle'&&ProgressionStore.state.frontier.activeEncounter?.enemyId==='corrupt-hound');
  assert.deepEqual(await p.evaluate(()=>touchTrace.filter(e=>e.enemy==='corrupt-hound').map(e=>e.type)),['touchstart','click']);
  assert.ok(await p.locator('#world-battle').isVisible());
  await p.waitForFunction(()=>document.getElementById('panel-world').dataset.fixedMode==='combat');
  assert.ok(await p.locator('#world-battle-pause').isVisible(),'Combat is usable, not merely present in the DOM');
  await press(p,'#world-battle-pause');assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.clock.running),false);
  await press(p,'#world-battle-resume');assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.clock.running),true);await audit(p);
  const ticket=await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id);
  await p.evaluate(async()=>{WorldUI.engine.advance(180);await WorldUI.settle();});assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.lastEncounter.outcome),'victory');
  const paid=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));assert.equal((await p.evaluate(id=>WorldSystem.finishEncounter(id),ticket)).unchanged,true);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),paid);
  await dismiss(p);await press(p,'[data-world-continue]');assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.location),'lantern-wood');assert.ok(await p.locator('#world-result').isHidden());
  await p.reload();assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),paid);assert.equal(await p.evaluate(()=>NymeriaNavigation.route.view),'places');assert.ok(await p.locator('#world-battle').isHidden());
  assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejections),[]);await context.close();console.log('PASS entry '+width+' '+source+': real expiry across touch, unchanged geometry/click target, visible usable battle, victory/return/reload/once-only');
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
