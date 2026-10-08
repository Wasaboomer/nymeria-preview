/* Initial journey and semantic UI regression, normal mode only. */
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const navigate = require('./mobile-navigation-fixture.cjs');
const dismiss = require('./notifications-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try {for(const width of [320,390,430]) {
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>window.addEventListener('unhandledrejection',e=>{throw e.reason;}));
  await page.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8012/nymeria-preview-pilot');
  await navigate(page,'world');
  const tap=async selector=>{await dismiss(page);await page.locator(selector).tap();await page.waitForFunction(()=>document.querySelector('#panel-world').getAttribute('aria-busy')==='false');};
  assert.equal(await page.locator('#menu-debug-link').isVisible(),false);
  await tap('#world-tracked [data-quest-accept="mq01"]');
  assert.ok(await page.locator('#world-tracked .quest-active').isVisible());
  assert.equal(await page.locator('#world-tracked .main-quest-progress').count(),1);
  assert.equal(await page.locator('#world-tracked .quest-next-step p').count(),0,'Compact tracker does not duplicate objective');
  await tap('#world-tracked [data-world-talk="serah"]');
  await tap('#world-tracked [data-quest-destination="broken-path"]');
  assert.match(await page.locator('#world-tracked .quest-completed').innerText(),/✓ Da riscuotere/);
  await tap('#world-tracked [data-quest-claim="mq01"]');
  assert.match(await page.locator('#world-quest-reward').innerText(),/RICOMPENSE RISCOSSE/);
  await tap('#world-tracked [data-quest-accept="mq02"]');
  // Following a side quest must not hide the active main story targets.
  await page.evaluate(async()=>{await QuestSystem.accept('sq-merchant');await QuestSystem.track('sq-merchant');});
  assert.match(await page.locator('#world-location-detail .world-enemy .quest-target-progress').innerText(),/Predoni del Vespro/);
  assert.ok(await page.locator('#world-location-detail [data-world-fight="vesper-raider"].quest-relevant').isVisible());
  const isolated=await page.evaluate(()=>{
   const before=JSON.stringify({state:ProgressionStore.state,gear:Equipment.state,storage:{...localStorage}});
   const s=structuredClone(ProgressionStore.state);
   const html=QuestUI.card(QuestData.get('mq01'),s)+QuestUI.journal(s)+QuestUI.tracker(s);
   return {html,unchanged:before===JSON.stringify({state:ProgressionStore.state,gear:Equipment.state,storage:{...localStorage}})};
  });
  assert.ok(isolated.unchanged);assert.match(isolated.html,/quest-claimed/);assert.match(isolated.html,/Completata · Riscossa/);
  for(const button of await page.locator('#world-tracked .quest-primary').all())assert.ok((await button.boundingBox()).height>=48);
  await tap('[data-world-view="journal"]');
  assert.match(await page.locator('.journal-entry[data-quest-open="mq01"]').innerText(),/Completata · Riscossa/);
  assert.ok(await page.locator('.journal-entry.quest-active[data-quest-open="mq02"]').isVisible());
  await page.locator('#navigation-back').tap();assert.ok(await page.locator('#world-tracked').isVisible());
  await page.reload();await navigate(page,'world');
  assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.quests.mq01.status),'claimed');
  assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.quests.mq02.status),'active');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('PASS '+width+': initial accept/talk/travel/claim/next quest, states, side tracking retains main targets, touch, Back/reload, no mutation/debug/errors/overflow');
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
