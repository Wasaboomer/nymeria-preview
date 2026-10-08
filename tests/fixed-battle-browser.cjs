const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{for(const width of [320,375,390,430]){
 const p=await b.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8000');
 await p.evaluate(async()=>{ClassSystem.selectClass('warden');Equipment.equip('sword','mainHand');Equipment.equip('shield','support');await WorldSystem.enter('broken-path');const r=await WorldSystem.startEncounter('vesper-raider');if(!r.ok)throw Error(r.message);NymeriaNavigation.open('world',{view:'battle'});});
 await p.waitForTimeout(150);
 for(const height of [568,667,844,508,375]){
  await p.setViewportSize({width,height});await p.waitForTimeout(150);
  for(const selector of ['#world-player-hp','#world-enemy-hp','#world-resource-value','#world-battle-pause','#world-battle-resume','#world-battle-abandon']){
   assert.ok(await p.locator(selector).isVisible(),selector+' visible together');const box=await p.locator(selector).boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height,selector+' within viewport');
  }
  assert.equal(await p.locator('#panel-world').getAttribute('data-fixed-overflow'),'false',JSON.stringify(await p.evaluate(()=>({vh:innerHeight,height:document.querySelector('#panel-world').clientHeight,scroll:document.querySelector('#panel-world').scrollHeight}))));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual(errors,[]);console.log('PASS battle '+width+': player/enemy/resource/all existing controls simultaneous at 375/508/568/667/844, no scroll or JS errors');await p.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
