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
  assert.match(await page.locator(`[data-item-id="${id}"] .item-availability`).innerText(),/EQUIPAGGIABILE/);
 }
 assert.match(await page.locator('[data-item-id="sword"] .item-availability').innerText(),/NON EQUIPAGGIABILE[\s\S]*Arma incompatibile con Vendicatore/);
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
 // The same renderer must label the owned item and legacy weapon/support lists.
 for(const [cls,build,main,support] of [['warden','bulwark','sword','shield'],['hunter','predator','bow','quiver']]) {
  await page.evaluate(([cls,build,main,support])=>{ClassSystem.selectClass(cls);ClassSystem.selectBuild(build);Equipment.equip(main,'mainHand');Equipment.equip(support,'support');InventoryUI.openSlot('mainHand');},[cls,build,main,support]);
  assert.match(await page.locator(`[data-item-id="${main}"] .item-availability`).innerText(),/^EQUIPAGGIATO$/);
  await page.evaluate(()=>InventoryUI.openSlot('support'));
  assert.match(await page.locator(`[data-item-id="${support}"] .item-availability`).innerText(),/^EQUIPAGGIATO$/);
 }
 await page.evaluate(()=>{ClassSystem.selectClass('warden');ClassSystem.selectBuild('bulwark');Equipment.equip('sword','mainHand');ClassSystem.selectSpecialization('avenger');const item=Equipment.state.inventory.find(i=>i.id==='sword');item.requiredLevel=99;item.name='Lama cerimoniale della frontiera dalle iscrizioni antichissime';InventoryUI.openSlot('mainHand');});
 const blocked=page.locator('[data-item-id="sword"]');
 assert.match(await blocked.locator('.item-availability').innerText(),/NON EQUIPAGGIABILE[\s\S]*Richiede livello 99[\s\S]*Arma incompatibile con Vendicatore/);
 assert.equal(await blocked.locator('.availability-icon').count(),2); // Worn but invalid: both statuses remain explicit.
 assert(await page.evaluate(()=>[...document.querySelectorAll('#inventory-grid .inventory-item')].every(card=>card.scrollWidth<=card.clientWidth+1)));
 // WCAG contrast for actual badge text colours, not assumed theme tokens.
 assert(await page.evaluate(()=>{
  const luminance=color=>{const values=color.match(/\d+/g).slice(0,3).map(v=>{const n=Number(v)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
  return [...document.querySelectorAll('.availability-badge')].every(node=>{const s=getComputedStyle(node),a=luminance(s.color),b=luminance(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;});
 }));
 assert.deepEqual(errors,[]);
 await context.close();console.log('PASS inventory compatibility touch',width);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
