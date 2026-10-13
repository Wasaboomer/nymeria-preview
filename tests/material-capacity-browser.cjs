const assert=require('node:assert/strict'),{chromium}=require('playwright'),G=require('../progression-store'),P=require('../profession-system');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8018';
async function install(page) {
 for(const file of ['material-bag-contract','material-bag-store','material-capacity-admission'])await page.addScriptTag({url:`${url}/${file}.js`});
 await page.evaluate(()=>{
  window.capacityPadding=39;
  const storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)};
  const extras=Array.from({length:40},(_,i)=>({owner:'profession',id:`fixture-${i}`,key:`profession:fixture-${i}`}));
  const session=MaterialCapacityAdmission.createTestSession({purpose:'capacity-simulation',isCoordinated:MaterialWriterCoordinator.isCoordinated,
   readers:{progression:()=>capacityStore.readSnapshot(),profession:()=>capacityProfession.readSnapshot()},readMetadata:MaterialBagStore.create({storage}).read,
   entries:[...MaterialBagContract.catalog,...extras],project:ledgers=>{for(const row of extras.slice(0,capacityPadding))ledgers.profession.materials[row.id]=1;return ledgers;}});
  const exclusive=run=>MaterialWriterCoordinator.run(()=>MaterialWriterCoordinator.progression(run));
  window.capacityStore=ProgressionStorage.create({storage,exclusive,materialAdmission:session.progression});
  window.capacityProfession=ProfessionEngine.create({storage,exclusive,materialAdmission:session.profession,context:()=>({accessible:true,location:'broken-path'})});
  window.capacityLife=ProgressionLifecycle.create({store:capacityStore,equipment:Equipment,classes:ClassSystem,catalogue:GearData.items,rewardAdmission:session.reward});
  window.capacityQuest=QuestEngine.create({store:capacityStore,progression:capacityLife});
 });
}
(async()=>{const browser=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),p=await context.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(({g,prof,gkey,pkey})=>{if(!localStorage.getItem(gkey))localStorage.setItem(gkey,JSON.stringify(g));if(!localStorage.getItem(pkey))localStorage.setItem(pkey,JSON.stringify(prof));window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));},{g:G.initial(),prof:{...P.empty(),materials:{'raw-iron':3}},gkey:G.KEY,pkey:P.KEY});
  await p.goto(url);await install(p);
  assert.equal((await p.evaluate(()=>capacityProfession.gather('vesper-iron-vein'))).ok,true);
  const before=await p.evaluate(()=>localStorage.getItem(ProfessionEngine.KEY));assert.equal((await p.evaluate(()=>capacityProfession.craft('forge-iron'))).code,'capacity-exceeded');assert.equal(await p.evaluate(()=>localStorage.getItem(ProfessionEngine.KEY)),before);
  // Controlled fixture edit only, never a gameplay bypass or persisted capacity switch.
  await p.evaluate(()=>{const raw=JSON.parse(localStorage.getItem(ProfessionEngine.KEY));raw.materials['raw-iron']=3;localStorage.setItem(ProfessionEngine.KEY,JSON.stringify(raw));});
  assert.equal((await p.evaluate(()=>capacityProfession.craft('forge-iron'))).ok,true);
  const blocked=await p.evaluate(()=>capacityStore.transact(s=>{s.materials.iron++;return {ok:true}}));assert.equal(blocked.code,'capacity-exceeded');
  await p.evaluate(()=>capacityStore.transact(s=>{for(const id of ['mq01','mq02','mq03'])s.frontier.quests[id].status='claimed';s.frontier.quests.mq04={status:'completed',progress:QuestData.get('mq04').objectives.map(o=>o.count),lootPolicy:capacityLife.personalPreparation()};return {ok:true}}));
  assert.equal((await p.evaluate(()=>capacityQuest.claim('mq04'))).pending,true);const saved=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));
  await p.reload();await install(p);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),saved);
  await p.evaluate(()=>window.capacityPadding=35);assert.equal((await p.evaluate(()=>capacityQuest.claim('mq04'))).ok,true);const paid=await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY));assert.equal((await p.evaluate(()=>capacityQuest.claim('mq04'))).ok,false);assert.equal(await p.evaluate(()=>localStorage.getItem(ProgressionStorage.KEY)),paid);
  const second=await context.newPage();await second.goto(url);await install(second);
  assert.equal((await second.evaluate(()=>capacityProfession.gather('vesper-iron-vein'))).ok,false,'Second tab must not bypass common ownership');
  await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await second.evaluate(()=>window.capacityPadding=30);assert.equal((await second.evaluate(()=>capacityProfession.gather('vesper-iron-vein'))).ok,true);
  assert.equal(await p.evaluate(()=>localStorage.getItem(MaterialBagStore.KEY)),null);
  assert.deepEqual(errors,[]);assert.deepEqual(await p.evaluate(()=>rejections),[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await context.close();console.log(`PASS capacity ${width}: real engine/shared locks, gather/craft/final state, pending reload/retry, two-tab handoff, no activation/errors/overflow`);
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
