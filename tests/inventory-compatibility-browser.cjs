const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try {for(const width of [320,375,390,430]){
 const context=await browser.newContext({viewport:{width,height:667},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026');
 await page.evaluate(()=>{ClassSystem.selectClass('warden');ClassSystem.selectSpecialization('avenger');
 // Owned catalog fixture, isolated browser storage: no grant or compensation in application code.
 for(const id of ['greataxe','warhammer']) Equipment.state.inventory.push(structuredClone(GearData.items.find(i=>i.id===id)));
 InventoryUI.openSlot('mainHand');});
 for(const id of ['greatsword','spear','greataxe','warhammer']) {
  assert.equal(await page.locator(`[data-item-id="${id}"]`).count(),1);
  assert.match(await page.locator(`[data-item-id="${id}"] .item-availability`).innerText(),/Equipaggiabile/);
 }
 assert.match(await page.locator('[data-item-id="sword"] .item-availability').innerText(),/Kit incompatibile/);
 assert.equal(await page.locator('[data-item-id="shield"]').count(),0);
 assert(await page.evaluate(()=>{const cards=[...document.querySelectorAll('#inventory-grid .inventory-item')];const blocked=cards.findIndex(c=>c.classList.contains('item-blocked'));return blocked<0||cards.slice(blocked).every(c=>c.classList.contains('item-blocked'));}));
 assert.equal(await page.evaluate(()=>ProgressionSystem.snapshot().profile.kitValid),false);
 const before=await page.evaluate(()=>JSON.stringify(Equipment.state));
 const blockedId=await page.evaluate(()=>Equipment.state.inventory.find(i=>i.type==='sword'&&!i.equipped).id);
 await page.locator(`[data-item-id="${blockedId}"]`).scrollIntoViewIfNeeded();await page.locator(`[data-item-id="${blockedId}"]`).tap();
 assert(await page.locator('.hypothetical-comparison').count());assert.equal(await page.locator('.hypothetical-comparison').getAttribute('open'),null);
 assert(await page.locator('#equip-item').isDisabled());
 assert.equal(await page.evaluate(()=>JSON.stringify(Equipment.state)),before);
 await page.locator('#close-detail').tap();
 await page.evaluate(()=>InventoryUI.openItem('greatsword','mainHand'));
 await page.locator('#equip-item').scrollIntoViewIfNeeded();await page.locator('#equip-item').tap();
 assert.equal(await page.evaluate(()=>Equipment.equipped('mainHand').id),'greatsword');assert.equal(await page.evaluate(()=>Equipment.equipped('support')),null);
 const ownedIds=await page.evaluate(()=>Equipment.state.inventory.map(i=>i.id).sort());
 assert(ownedIds.includes('shield'));
 await page.reload();assert.equal(await page.evaluate(()=>Equipment.equipped('mainHand').id),'greatsword');
 assert.deepEqual(await page.evaluate(()=>Equipment.state.inventory.map(i=>i.id).sort()),ownedIds);
 const reasons=await page.evaluate(()=>{const item={...GearData.items.find(i=>i.id==='sword'),requiredLevel:99};return Equipment.equipValidation(item,'mainHand').reasons.map(r=>r.code);});
 assert.deepEqual(reasons,['level','kit']);
 for(const height of [568,667,844]) {
  await page.setViewportSize({width,height});
  await page.evaluate(()=>InventoryUI.openItem('sword','mainHand'));
  assert(await page.locator('.item-verdict').isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#close-detail').tap();
 }
 assert.deepEqual(errors,[]);
 await context.close();console.log('PASS inventory compatibility touch',width);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
