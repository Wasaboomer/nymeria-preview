const assert=require('node:assert/strict'),{chromium}=require('playwright');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8018';
async function install(p){await p.evaluate(()=>{window.reentryBag=MaterialBagStore.create({storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)}})})}
(async()=>{const b=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430]){
  const c=await b.newContext({viewport:{width,height:844}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await install(p);
  const busy=p.evaluate(()=>MaterialWriterCoordinator.run(async()=>{await new Promise(r=>window.releaseOperation=r);return {ok:true}}));await p.waitForFunction(()=>typeof releaseOperation==='function');
  const independent=p.evaluate(()=>reentryBag.initialize());await p.evaluate(()=>releaseOperation());assert.equal((await busy).ok,true);assert.equal((await independent).capacity,40);
  const before=await p.evaluate(()=>localStorage.getItem(MaterialBagStore.KEY));assert.equal((await p.evaluate(()=>MaterialWriterCoordinator.run(()=>reentryBag.grantExpansion('recursive')))).code,'nested-coordination-rejected');assert.equal(await p.evaluate(()=>localStorage.getItem(MaterialBagStore.KEY)),before);
  assert.equal((await p.evaluate(()=>MaterialWriterCoordinator.run(()=>MaterialWriterCoordinator.progression(()=>reentryBag.grantExpansion('nested-progress'))))).code,'nested-coordination-rejected');
  await p.reload();await install(p);const refused=await p.evaluate(async()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===MaterialBagStore.KEY)throw Error('quota');return write.call(this,k,v)};try{return await reentryBag.grantExpansion('quota')}finally{Storage.prototype.setItem=write}});assert.equal(refused.code,'write-rejected');assert.equal(await p.evaluate(()=>localStorage.getItem(MaterialBagStore.KEY)),before);
  assert.equal((await p.evaluate(()=>reentryBag.grantExpansion('normal'))).capacity,50);
  const other=await c.newPage();await other.goto(url);await install(other);assert.equal((await other.evaluate(()=>reentryBag.grantExpansion('other'))).ok,false);await p.close();assert.equal((await other.evaluate(()=>reentryBag.grantExpansion('other'))).capacity,60);await other.reload();await install(other);assert.equal((await other.evaluate(()=>reentryBag.grantExpansion('other'))).unchanged,true);assert.deepEqual(errors,[]);await c.close();console.log(`PASS reentry ${width}: queued independent operation, genuine recursion rejected, reload/quota retry, two-tab ownership, no deadlock`);
 }
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
