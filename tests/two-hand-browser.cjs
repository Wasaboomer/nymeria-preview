const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {press}=require('./fixed-navigation-fixture.cjs');
const {audit}=require('./contextual-scroll-fixture.cjs');
const classFixture=require('./two-hand-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try { for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:667},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Inject only a test kit into the real data module before ClassSystem loads.
  await page.route('**/classes-data.js?*',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\n'+classFixture});});
  await page.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026');
  await page.evaluate(()=>{
   ClassSystem.selectClass('warden');Equipment.equip('sword','mainHand');Equipment.equip('shield','support');
   const state=Equipment.state;
   for(const id of ['greataxe','warhammer'])state.inventory.push(GearData.items.find(i=>i.id===id));
   localStorage.setItem(Equipment.SAVE_KEY,JSON.stringify(state));
  });
  await page.reload();
  const before=await page.evaluate(()=>JSON.stringify(Equipment.state));
  await page.evaluate(()=>ClassSystem.selectSpecialization('fixture-2h'));
  assert.equal(await page.evaluate(()=>JSON.stringify(Equipment.state)),before);
  assert.equal(await page.evaluate(()=>ProgressionSystem.snapshot().profile.kitValid),false);
  for(const id of ['greatsword','spear','greataxe','warhammer']){
   await page.evaluate(id=>{NymeriaNavigation.open('inventory');InventoryUI.openItem(id,'mainHand');},id);
   assert(await page.locator('#equip-item').isEnabled());
   if(['greataxe','warhammer'].includes(id)) {
    assert.equal(await page.evaluate(id=>VisualManifest.forItem(GearData.items.find(i=>i.id===id),'mainHand').length,id),0);
    await page.locator('.item-secondary > summary').scrollIntoViewIfNeeded();
    await page.locator('.item-secondary > summary').tap();
    assert.match(await page.locator('#detail-body').innerText(),/Aspetto non ancora disponibile/i);
   }
   if(id==='spear')assert.deepEqual(await page.evaluate(()=>VisualManifest.forItem(GearData.items.find(i=>i.id==='spear'),'mainHand')),['staff']);
   for(const height of [568,667,844]){await page.setViewportSize({width,height});await page.waitForTimeout(100);await audit(page);}
   await press(page,'#equip-item');
   assert.equal(await page.evaluate(()=>Equipment.equipped('mainHand').id),id);
   assert.equal(await page.evaluate(()=>Equipment.equipped('support')),null);
   assert(await page.evaluate(()=>Equipment.state.inventory.some(i=>i.id==='shield')));
   assert(await page.evaluate(()=>ProgressionSystem.snapshot().profile.kitValid));
   await press(page,'#close-detail');
  }
  await page.evaluate(()=>InventoryUI.openItem('shield','support'));
  assert(await page.locator('#equip-item').isDisabled());
  await press(page,'#close-detail');
  const saved=await page.evaluate(()=>JSON.stringify(Equipment.state));
  await page.reload();
  assert.equal(await page.evaluate(()=>ClassSystem.build().id),'fixture-2h');
  assert.equal(await page.evaluate(()=>JSON.stringify(Equipment.state)),saved);
  await page.evaluate(()=>ClassSystem.selectBuild('bulwark'));
  assert.equal(await page.evaluate(()=>JSON.stringify(Equipment.state)),saved);
  assert.equal(await page.evaluate(()=>ProgressionSystem.snapshot().profile.kitValid),false);
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>rejections),[]);
  await context.close();console.log(`PASS 2H ${width}: 4 weapons, 3 heights, actual touch equip, shield retained, invalid support disabled, no auto-equip, reload/no JS errors`);
 }
 // Production registers Vendicatore, but never the test-only kit.
 const context=await browser.newContext(),page=await context.newPage();
 await page.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8026');
 assert.equal(await page.evaluate(()=>Object.keys(ClassesData.specializations).length),8);
 assert.equal(await page.evaluate(()=>Object.values(ClassesData.specializations).filter(spec=>spec.playable!==false).length),7);
 assert.equal(await page.locator('[data-class-id="mage"]').count(),0);
 assert.equal(await page.evaluate(()=>Equipment.state.inventory.some(i=>['greataxe','warhammer'].includes(i.id))),false);
 await context.close();console.log('PASS normal game: six legacy selections plus Vendicatore, no test kit or catalog-only items automatically granted');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
