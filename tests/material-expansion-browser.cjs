const assert=require('node:assert/strict'),{chromium}=require('playwright'),G=require('../progression-store'),P=require('../profession-system');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8018';
async function install(p){
 for(const file of ['material-bag-contract','material-bag-store','material-capacity-admission'])await p.addScriptTag({url:`${url}/${file}.js`});
 await p.evaluate(()=>{
  const storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)};
  window.expansionBag=MaterialBagStore.create({storage});
  const extras=Array.from({length:39},(_,i)=>({owner:'profession',id:`fixture-${i}`,key:`profession:fixture-${i}`}));
  const admission=MaterialCapacityAdmission.createTestSession({purpose:'capacity-simulation',isCoordinated:MaterialWriterCoordinator.isCoordinated,
   readers:{progression:()=>expansionG.readSnapshot(),profession:()=>expansionP.readSnapshot()},readMetadata:expansionBag.read,
   entries:[...MaterialBagContract.catalog,...extras],project:s=>{for(const row of extras)s.profession.materials[row.id]=1;return s;}});
  const exclusive=run=>MaterialWriterCoordinator.run(()=>MaterialWriterCoordinator.progression(run));
  window.expansionG=ProgressionStorage.create({storage,exclusive,materialAdmission:admission.progression});
  window.expansionP=ProfessionEngine.create({storage,exclusive,materialAdmission:admission.profession,context:()=>({accessible:true,location:'broken-path'})});
 });
}
(async()=>{const browser=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({g,prof,gkey,pkey})=>{if(!localStorage.getItem(gkey))localStorage.setItem(gkey,JSON.stringify(g));if(!localStorage.getItem(pkey))localStorage.setItem(pkey,JSON.stringify(prof));window.expansionRejections=[];addEventListener('unhandledrejection',e=>expansionRejections.push(String(e.reason)));},{g:G.initial(),prof:{...P.empty(),materials:{'raw-iron':4}},gkey:G.KEY,pkey:P.KEY});
  await p.goto(url);await install(p);
  const before=await p.evaluate(()=>[localStorage.getItem(ProgressionStorage.KEY),localStorage.getItem(ProfessionEngine.KEY)]);
  assert.equal((await p.evaluate(()=>expansionBag.initialize())).capacity,40);assert.deepEqual(await p.evaluate(()=>[localStorage.getItem(ProgressionStorage.KEY),localStorage.getItem(ProfessionEngine.KEY)]),before);
  assert.equal((await p.evaluate(()=>expansionP.craft('forge-iron'))).code,'capacity-exceeded');
  const pair=await p.evaluate(()=>Promise.all([expansionBag.grantExpansion('test:one'),expansionBag.grantExpansion('test:one'),expansionG.transact(s=>{s.materials.iron++;return {ok:true}}),expansionP.craft('forge-iron')]));assert.ok(pair.every(x=>x.ok));assert.equal(pair.filter(x=>x.unchanged).length,1);assert.equal(await p.evaluate(()=>expansionBag.read().capacity),50);
  const nested=await p.evaluate(()=>MaterialWriterCoordinator.run(()=>expansionBag.grantExpansion('nested')));assert.equal(nested.code,'nested-coordination-rejected');
  const second=await context.newPage();second.on('pageerror',e=>errors.push(e.message));await second.goto(url);await install(second);assert.equal((await second.evaluate(()=>expansionBag.grantExpansion('second'))).ok,false);
  await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal((await second.evaluate(()=>expansionBag.grantExpansion('test:one'))).unchanged,true);assert.equal((await second.evaluate(()=>expansionBag.grantExpansion('second'))).capacity,60);
  const saved=await second.evaluate(()=>localStorage.getItem(MaterialBagStore.KEY));await second.reload();await install(second);assert.equal(await second.evaluate(()=>localStorage.getItem(MaterialBagStore.KEY)),saved);
  const refused=await second.evaluate(async()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===MaterialBagStore.KEY)throw Error('quota');return write.call(this,k,v)};try{return await expansionBag.grantExpansion('three')}finally{Storage.prototype.setItem=write}});assert.equal(refused.code,'write-rejected');assert.equal(await second.evaluate(()=>localStorage.getItem(MaterialBagStore.KEY)),saved);
  const left=await second.evaluate(()=>Promise.all(['three','four','five','six'].map(id=>expansionBag.grantExpansion(id))));assert.ok(left.every(x=>x.ok));assert.equal(await second.evaluate(()=>expansionBag.read().capacity),100);assert.equal((await second.evaluate(()=>expansionBag.grantExpansion('seven'))).code,'capacity-maximum');
  const future=await second.evaluate(async()=>{const raw=JSON.stringify({version:99});localStorage.setItem(MaterialBagStore.KEY,raw);const r=await expansionBag.grantExpansion('future');return {r,raw,after:localStorage.getItem(MaterialBagStore.KEY)}});assert.equal(future.r.code,'unsupported-version');assert.equal(future.after,future.raw);assert.deepEqual(await second.evaluate(()=>expansionRejections),[]);
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS expansions ${width}: shared default writer, no material writes at initialization, duplicate/max, concurrent craft/credit, nested refusal, two-tab handoff and reload`);
 }
 const denied=await browser.newContext();await denied.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined,configurable:true}));const p=await denied.newPage();await p.goto(url);await install(p);assert.equal((await p.evaluate(()=>expansionBag.grantExpansion('no-locks'))).ok,false);assert.equal(await p.evaluate(()=>localStorage.getItem(MaterialBagStore.KEY)),null);await denied.close();console.log('PASS missing Web Locks: metadata mutation refused, no record written');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
