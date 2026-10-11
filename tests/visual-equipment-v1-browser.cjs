const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async () => {
 const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});
 let checks=0;
 for(const width of [320,375,390,430]) {
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  await page.addInitScript(()=>localStorage.setItem('nymeria-preservation-fixture','unchanged'));
  await page.goto('http://127.0.0.1:8026/visual-equipment-v1.html');
  await page.evaluate(()=>VisualEquipmentProof.ready());
  assert.equal(await page.evaluate(()=>typeof Equipment),'undefined');
  for(const [slot,a,b,layer] of [
   ['head','head-helm','head-vesper','head'],['torso','torso-warden','torso-vesper','torso'],
   ['legs','legs-sentinel','legs-vesper','legs'],['boots','boots-plate','boots-vesper','boots'],
   ['gloves','gloves-iron','gloves-vesper','gloves'],['cloak','cloak-dusk','cloak-pilgrim','cloak'],
   ['mainHand','sword','vesper-sword','weapon'],['support','shield','vesper-shield','support']]) {
   await page.selectOption(`[data-slot="${slot}"]`,a);await page.evaluate(()=>VisualEquipmentProof.ready());
   const before=await page.locator(`[data-layer="${layer}"]`).getAttribute('data-asset');
   await page.evaluate(()=>window.bodyNode=document.querySelector('[data-layer="body / skin"]').firstChild);
   await page.selectOption(`[data-slot="${slot}"]`,b);await page.evaluate(()=>VisualEquipmentProof.ready());
   assert.notEqual(await page.locator(`[data-layer="${layer}"]`).getAttribute('data-asset'),before);
   assert.equal(await page.evaluate(()=>bodyNode===document.querySelector('[data-layer="body / skin"]').firstChild),true);
   checks++;
  }
  if(width===390) {
   for(const control of await page.locator('select').all()) {
    const values=await control.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
    for(const value of values) {await control.selectOption(value);await page.evaluate(()=>VisualEquipmentProof.ready());assert.deepEqual(await page.evaluate(()=>VisualEquipmentProof.diagnostics()),[]);checks++;}
   }
   await page.selectOption('[data-slot="torso"]','torso-warden');
   await page.selectOption('[data-slot="torso"]','torso-vesper');
   await page.evaluate(()=>VisualEquipmentProof.ready());
   assert.equal(await page.locator('[data-layer="torso"]').getAttribute('data-asset'),'plate-b-torso');checks++;
  }
  await page.selectOption('[data-slot="mainHand"]','greataxe');await page.evaluate(()=>VisualEquipmentProof.ready());
  assert.equal(await page.locator('[data-layer="weapon"]').getAttribute('data-selection'),'empty');
  assert.match(await page.locator('#visual-audit').textContent(),/Asset assente/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const select of await page.locator('select').all()) {const box=await select.boundingBox();assert.ok(box.height>=44);}
  await page.locator('summary').tap();
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),{'nymeria-preservation-fixture':'unchanged'});
  await page.reload();await page.evaluate(()=>VisualEquipmentProof.ready());
  assert.equal(await page.locator('[data-slot="torso"]').inputValue(),'');
  assert.deepEqual(errors,[]);checks+=6;
  await context.close();
 }
 const page=await browser.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/sword-b.svg*',route=>route.fulfill({status:404,body:'missing'}));
 await page.goto('http://127.0.0.1:8026/visual-equipment-v1.html');await page.evaluate(()=>VisualEquipmentProof.ready());
 await page.selectOption('[data-slot="mainHand"]','vesper-sword');await page.evaluate(()=>VisualEquipmentProof.ready());
 assert.equal((await page.evaluate(()=>VisualEquipmentProof.diagnostics())).length,1);
 assert.match(await page.locator('#visual-status').innerText(),/Asset non caricato/);
 assert.deepEqual(errors,[]);checks++;
 await browser.close();console.log(`${checks} checks passed: independent swaps, mobile layout/touch, unavailable assets, failed fetch, storage isolation.`);
})().catch(e=>{console.error(e);process.exit(1)});
