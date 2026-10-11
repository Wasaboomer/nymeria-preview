const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {press}=require('./fixed-navigation-fixture.cjs'),{audit}=require('./contextual-scroll-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try {for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:667},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026');
  await page.evaluate(()=>{ClassSystem.selectClass('warden');Equipment.equip('sword','mainHand');Equipment.equip('shield','support');NymeriaNavigation.open('class');});
  const before=await page.evaluate(()=>JSON.stringify({gear:Equipment.state,progression:ProgressionStore.state}));
  await press(page,'[data-build-id="avenger"]');
  assert.equal(await page.evaluate(()=>ClassSystem.build().id),'avenger');
  assert.equal(await page.evaluate(()=>JSON.stringify({gear:Equipment.state,progression:ProgressionStore.state})),before);
  assert.match(await page.locator('#class-info').textContent(),/DPS da mischia/);assert.match(await page.locator('#class-info').textContent(),/supporto vuoto/);
  assert.equal(await page.evaluate(()=>ProgressionSystem.snapshot().profile.kitValid),false);
  // Actual inventory action: no gear changed by selecting the specialization.
  await page.evaluate(()=>{NymeriaNavigation.open('inventory');InventoryUI.openItem('greatsword','mainHand');});
  await press(page,'#equip-item');assert.equal(await page.evaluate(()=>Equipment.equipped('support')),null);await press(page,'#close-detail');
  await page.evaluate(()=>NymeriaNavigation.open('class'));await press(page,'[data-combat-mode="custom"]');
  assert.equal(await page.locator('[data-enabled]').count(),5);
  await press(page,'label:has([data-enabled="avenger-assault"])');
  assert.equal(await page.evaluate(()=>CombatUI.settings.rules.find(r=>r.abilityId==='avenger-assault').enabled),false);
  await press(page,'label:has([data-enabled="avenger-assault"])');
  assert.notEqual(await page.evaluate(()=>CombatUI.settings.rules.find(r=>r.abilityId==='avenger-assault').enabled),false);
  await press(page,'[data-move="-1"][data-rule="avenger-slash"]');
  assert.equal(await page.evaluate(()=>CombatUI.settings.rules[3].abilityId),'avenger-slash');
  const selected=page.locator('[data-condition="avenger-slash"]');await selected.scrollIntoViewIfNeeded();await selected.selectOption('resourceBelow');
  await page.locator('[data-threshold="avenger-slash"]').fill('80');await page.locator('[data-threshold="avenger-slash"]').dispatchEvent('change');
  const custom=await page.evaluate(()=>JSON.stringify(CombatUI.settings));const inventory=await page.evaluate(()=>JSON.stringify(Equipment.state));
  await page.reload();assert.equal(await page.evaluate(()=>ClassSystem.build().id),'avenger');assert.equal(await page.evaluate(()=>JSON.stringify(CombatUI.settings)),custom);assert.equal(await page.evaluate(()=>JSON.stringify(Equipment.state)),inventory);
  await page.evaluate(()=>ClassSystem.selectBuild('bulwark'));assert.equal(await page.evaluate(()=>CombatUI.settings.mode),'auto');
  await page.evaluate(()=>ClassSystem.selectSpecialization('avenger'));assert.equal(await page.evaluate(()=>JSON.stringify(CombatUI.settings)),custom);
  await page.evaluate(()=>NymeriaNavigation.open('class'));await press(page,'[data-combat-mode="auto"]');
  for(const height of [568,667,844]){await page.setViewportSize({width,height});await page.waitForTimeout(100);await audit(page);}
  await page.evaluate(async()=>{await WorldSystem.enter('broken-path');const result=await WorldSystem.startEncounter('vesper-raider',{seed:7});if(!result.ok)throw Error(result.message);NymeriaNavigation.open('world',{view:'battle'});});
  await page.waitForFunction(()=>WorldUI.engine && WorldUI.engine.metrics.uses['avenger-slash']>0);
  assert.equal(await page.evaluate(()=>WorldUI.engine.profile.buildId),'avenger');
  await press(page,'#world-battle-pause');
  assert.equal(await page.evaluate(()=>WorldUI.engine.status),'paused');
  await press(page,'#world-battle-resume');
  assert(await page.locator('#world-resource-value').isVisible());
  assert.match(await page.locator('#world-resource-name').innerText(),/Risolutezza/);
  await page.waitForTimeout(1000);assert(await page.evaluate(()=>WorldUI.engine.metrics.damage>0));
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>rejections),[]);
  await context.close();console.log(`PASS Vendicatore ${width}: real touch selection/equip/strategy, 3 heights, isolated custom reload, AUTO combat, no JS errors`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
