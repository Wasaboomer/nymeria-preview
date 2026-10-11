const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {press}=require('./fixed-navigation-fixture.cjs'),{audit}=require('./contextual-scroll-fixture.cjs');
async function tapSummary(page,selector){const target=page.locator(selector);await target.scrollIntoViewIfNeeded();await target.tap();await page.waitForTimeout(80);}
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{for(const width of [320,375,390,430]){
 const context=await browser.newContext({viewport:{width,height:667},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026');
 const simulate=()=>page.evaluate(()=>{const profile=ClassSystem.combatProfile(),rules=CombatUI.settings.mode==='auto'?profile.defaultRules:CombatUI.settings.rules;const e=CombatEngine.create({profile,stats:{...Equipment.state.resultingStats},rules,seed:7,captureLog:false});e.start();e.advance(180);return e.snapshot();});
 for(const [cls,build]of [['warden','bulwark'],['warden','retaliation'],['warden','command'],['hunter','predator'],['hunter','lacerator'],['hunter','explorer'],['warden','avenger']]){
  await page.evaluate(([cls,build])=>{ClassSystem.selectClass(cls);if(!ClassSystem.selectSpecialization(build))throw Error('Selection failed: '+build);NymeriaNavigation.open('class');},[cls,build]);
  if(await page.locator('.strategy-settings').evaluate(node=>node.open))await tapSummary(page,'.strategy-settings > summary');
  await tapSummary(page,'.strategy-settings > summary');
  assert(await page.locator('.combat-strategy h2').evaluate(title=>{const r=title.getBoundingClientRect(),p=title.closest('.fixed-scroll-panel').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom;}));
  assert.equal(await page.locator('.priority-row').count(),5);assert.equal(await page.locator('.priority-row[open]').count(),0);
  const saved=await page.evaluate(()=>JSON.stringify({settings:CombatUI.settings,storage:Object.fromEntries(Object.entries(localStorage)),gear:Equipment.state,progression:ProgressionStore.state}));
  const before=await simulate();
  const ids=await page.locator('.priority-row').evaluateAll(rows=>rows.map(r=>r.dataset.priorityId));
  for(const id of ids){await tapSummary(page,`[data-priority-id="${id}"] > summary`);assert.equal(await page.locator('.priority-row[open]').count(),1);assert(await page.locator(`[data-priority-id="${id}"] .priority-technical`).isVisible());}
  await tapSummary(page,`[data-priority-id="${ids.at(-1)}"] > summary`);assert.equal(await page.locator('.priority-row[open]').count(),0);
  assert.equal(await page.evaluate(()=>JSON.stringify({settings:CombatUI.settings,storage:Object.fromEntries(Object.entries(localStorage)),gear:Equipment.state,progression:ProgressionStore.state})),saved);
  assert.deepEqual(await simulate(),before,'Opening details must not change combat results');
 }
 assert.match(await page.locator('#combat-resource-hint').innerText(),/parte da 0[\s\S]*Fendente[\s\S]*10[\s\S]*infligge danno/);
 await tapSummary(page,'[data-priority-id="avenger-shatter"] > summary');
 assert.match(await page.locator('[data-priority-id="avenger-shatter"] .condition-exact').innerText(),/non ha già l’armatura ridotta e il nemico ha almeno il 25%/);
 assert.equal(await page.locator('[data-priority-id="avenger-shatter"] .priority-technical').innerText(),'1,00 × D + 8 danni; armatura nemica −15% per 6 s.');
 assert.match(await page.locator('[data-priority-id="avenger-shatter"] .priority-cost').innerText(),/^Costo 20 Risolutezza · Recupero 8s$/);
 assert.match(await page.locator('[data-priority-id="avenger-shatter"] .damage-definition').innerText(),/D è il danno base/);
 assert.deepEqual(await page.evaluate(()=>{const p=ClassSystem.combatProfile(),e=CombatEngine.create({profile:p,stats:Equipment.state.resultingStats,seed:7}),condition=p.defaultRules.find(r=>r.abilityId==='avenger-shatter').condition;return [24,25,26].map(percent=>{e.enemy.hp=e.enemy.maxHp*percent/100;return e.conditionMet(condition,'avenger-shatter');});}),[false,true,true]);
 assert.deepEqual(await page.evaluate(()=>{const p=ClassSystem.combatProfile(),e=CombatEngine.create({profile:p,stats:Equipment.state.resultingStats,seed:7}),c=p.defaultRules.find(r=>r.abilityId==='avenger-assault').condition;return [43,44,45].map(value=>{e.player.resource.current=value;return e.conditionMet(c,'avenger-assault');});}),[false,false,true]);

 await press(page,'[data-combat-mode="custom"]');
 await tapSummary(page,'[data-priority-id="avenger-wrath"] > summary');
 assert.match(await page.locator('[data-priority-id="avenger-wrath"] .condition-exact').innerText(),/non ha già l’effetto.*Ira del Vendicatore.* e .*almeno il 40%/);
 await press(page,'label:has([data-enabled="avenger-wrath"])');
 assert.match(await page.locator('[data-priority-id="avenger-wrath"] > summary').innerText(),/Disattivata/);
 await press(page,'[data-move="-1"][data-rule="avenger-slash"]');
 assert.equal(await page.locator('.priority-row[open]').getAttribute('data-priority-id'),'avenger-slash');
 await page.locator('[data-condition="avenger-slash"]').selectOption('resourceBelow');
 await page.locator('[data-threshold="avenger-slash"]').fill('80');await page.locator('[data-threshold="avenger-slash"]').dispatchEvent('change');
 assert.match(await page.locator('[data-priority-id="avenger-slash"] .condition-exact').innerText(),/meno di 80 punti/);
 assert.deepEqual(await page.evaluate(()=>{const p=ClassSystem.combatProfile(),e=CombatEngine.create({profile:p,stats:Equipment.state.resultingStats,seed:7}),c=CombatUI.settings.rules.find(r=>r.abilityId==='avenger-slash').condition;return [79,80,81].map(value=>{e.player.resource.current=value;return e.conditionMet(c,'avenger-slash');});}),[true,false,false]);
 const custom=await page.evaluate(()=>JSON.stringify(CombatUI.settings));const expected=await simulate();
 await press(page,'[data-combat-mode="auto"]');assert.equal(await page.locator('[data-combat-mode="auto"]').getAttribute('aria-pressed'),'true');
 await press(page,'[data-combat-mode="custom"]');assert.equal(await page.evaluate(()=>JSON.stringify(CombatUI.settings)),custom);
 await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(CombatUI.settings)),custom);assert.deepEqual(await simulate(),expected);
 await page.evaluate(()=>NymeriaNavigation.open('class'));await tapSummary(page,'.strategy-settings > summary');
 for(const height of [568,667,844]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);await audit(page);
  await tapSummary(page,'.strategy-settings > summary');await tapSummary(page,'.strategy-settings > summary');
  assert(await page.locator('.combat-strategy h2').evaluate(title=>{const r=title.getBoundingClientRect(),p=title.closest('.fixed-scroll-panel').getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect();return r.top>=p.top&&r.bottom<=Math.min(p.bottom,nav.top);}));
  assert(await page.locator('.priority-row').evaluateAll(rows=>rows.every(r=>r.getBoundingClientRect().height>=44&&r.scrollWidth<=r.clientWidth+1)));
  assert(await page.locator('#combat-priorities').evaluate(n=>n.getBoundingClientRect().height<450));
  await tapSummary(page,'[data-priority-id="avenger-assault"] > summary');await audit(page);
  for(const button of await page.locator('[data-priority-id="avenger-assault"] .priority-order button').all())assert((await button.boundingBox()).height>=44);
  await tapSummary(page,'[data-priority-id="avenger-assault"] > summary');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>rejections),[]);await context.close();
 console.log(`PASS strategy ${width}: seven profiles, exclusive touch accordion, no writes on expansion, exact conditions, reorder/disable/custom reload, deterministic results, three heights`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
