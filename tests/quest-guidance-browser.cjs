const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const navigate = require('./mobile-navigation-fixture.cjs');
const dismiss = require('./notifications-fixture.cjs');
(async () => {
 const browser = await chromium.launch({executablePath: process.env.NYMERIA_CHROMIUM, args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
 try { for (const width of (process.env.NYMERIA_TEST_WIDTH ? [Number(process.env.NYMERIA_TEST_WIDTH)] : [320,390,430])) {
  const context = await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const page = await context.newPage(), errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(process.env.NYMERIA_TEST_URL || 'http://127.0.0.1:8017');
  await page.evaluate(()=>{ClassSystem.selectClass('warden');for(const [slot,id] of Object.entries({mainHand:'sword',support:'shield',torso:'torso-warden',legs:'legs-sentinel',boots:'boots-plate'}))Equipment.equip(id,slot);});
  await navigate(page,'character'); await page.locator('#save').tap(); await navigate(page,'world');
  const tap=async selector=>{await dismiss(page);await page.locator(selector).tap();await page.waitForFunction(()=>document.querySelector('#panel-world').getAttribute('aria-busy')==='false');};
  await tap('#world-tracked [data-quest-accept="mq01"]');
  assert.match(await page.locator('#world-tracked').innerText(),/Prossimo passo.*Parla con/s);
  if(width===390) {await page.waitForTimeout(600);await dismiss(page);await page.screenshot({path:'/workspace/scratch/6b1ad74c09e7/deliverables/Nymeria_DEV_missione_prossimo_passo.png',fullPage:false});}
  await tap('#world-tracked [data-world-talk="serah"]');
  await tap('#world-tracked [data-quest-destination="broken-path"]');
  assert.match(await page.locator('#world-tracked').innerText(),/Da riscuotere/);
  await tap('#world-tracked [data-quest-claim="mq01"]');
  await tap('#world-tracked [data-quest-accept="mq02"]');
  assert.match(await page.locator('#world-location-detail .quest-target-progress').innerText(),/0 \/ 3/);
  assert.equal(await page.locator('#world-location-detail .quest-target-label').count(),1);
  if(width===390) {await page.waitForTimeout(600);await dismiss(page);await page.locator('.world-enemies').scrollIntoViewIfNeeded();await page.screenshot({path:'/workspace/scratch/6b1ad74c09e7/deliverables/Nymeria_DEV_missione_bersagli.png',fullPage:false});}
  await tap('#world-tracked [data-world-fight="vesper-raider"]');
  assert.ok(await page.locator('#world-battle').isVisible());
  await page.evaluate(()=>WorldSystem.abandonEncounter());
  await navigate(page,'world');
  const cases = await page.evaluate(()=>{
   const rows=[];
   for(const q of QuestData.quests) for(let i=0;i<q.objectives.length;i++) {
    const s=structuredClone(ProgressionStore.state);
    s.unlockedContent=WorldData.locations.map(l=>'world:'+l.id);
    s.frontier.location=QuestUI.objectiveLocation(q.objectives[i])==='activities'?'veyra':QuestUI.objectiveLocation(q.objectives[i]);
    s.frontier.quests[q.id]={status:'active',progress:q.objectives.map((o,j)=>j<i?o.count:0)};
    rows.push({id:q.id,type:q.objectives[i].type,html:QuestUI.guidance(q,s)});
   }
   return rows;
  });
  for(const row of cases)assert.match(row.html,/data-(world-(talk|fight|explore)|quest-(destination|expedition|professions|deliver))/,row.id+' '+row.type);
  await page.evaluate(async()=>{await ProgressionStore.transact(s=>{
   s.frontier.quests['sq-merchant'].status='active';s.frontier.quests['sq-merchant'].progress=[1,1,0];s.frontier.trackedQuest='sq-merchant';return {ok:true};
  });});
  await tap('#world-tracked [data-quest-expedition]');
  assert.ok(await page.locator('#panel-expeditions').isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]); console.log('PASS '+width+'px: accept, talk, travel, claim, target badges, battle, all objective actions, expedition routing');
  await context.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
