const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {press}=require('./fixed-navigation-fixture.cjs');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430]){
  const p=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8000');await p.evaluate(()=>NymeriaNavigation.root('character'));await p.waitForTimeout(100);
  assert.equal(await p.evaluate(()=>Equipment.state.characterCreated),false);
  await press(p,'[data-key="hair"][data-id="crest"]');await press(p,'[data-key="hairColor"][data-id="copper"]');await press(p,'#save');
  const appearance=await p.evaluate(()=>JSON.stringify(Equipment.state.character));await p.reload();assert.equal(await p.evaluate(()=>Equipment.state.characterCreated),true);assert.equal(await p.evaluate(()=>JSON.stringify(Equipment.state.character)),appearance);
  assert.ok(await p.locator('#character-creator').isHidden());assert.ok(await p.locator('#creator-debug').isHidden());
  await p.evaluate(()=>NymeriaNavigation.open('inventory'));await p.waitForTimeout(100);
  const saved=await p.evaluate(()=>JSON.stringify({...localStorage}));
  for(const filter of ['weapons','armor','accessories','all']){await press(p,'[data-filter="'+filter+'"]');assert.equal(await p.locator('[data-filter="'+filter+'"]').getAttribute('aria-pressed'),'true');}
  assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),saved);
  for(const height of [508,568,667,844,375]){
   await p.setViewportSize({width,height});await p.waitForTimeout(100);
   await p.evaluate(()=>{while(Notifications.current)Notifications.dismiss();Notifications.notify('levelUp',{previousLevel:3,resultingLevel:5,levelCap:20,statGains:{agility:6,vigor:2,crit:1}});});
   const result=await p.locator('#global-notifications').evaluate(n=>{const r=n.getBoundingClientRect();return {client:n.clientHeight,scroll:n.scrollHeight,top:r.top,bottom:r.bottom};});
   assert.ok(result.scroll<=result.client+1,JSON.stringify({width,height,...result}));assert.ok(result.top>=0&&result.bottom<=height,JSON.stringify(result));
   await p.locator('[data-dismiss-notification]').tap();
  }
  assert.deepEqual(errors,[]);console.log('PASS '+width+': creator confirmation/reload, inventory filters without save writes, level feedback at 375/508/568/667/844, touch/no JS errors');await p.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
