const assert=require('node:assert/strict'),{chromium}=require('playwright');
const id='sq-bram-preparation',base=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8018';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [320,375,390,430]){
   const c=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),p=await c.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
   assert.equal((await p.evaluate(id=>QuestSystem.accept(id),id)).ok,true);
   await p.evaluate(()=>{const ledger=ProfessionUI.engine.state;ledger.materials['frontier-brace']=1;localStorage.setItem(ProfessionEngine.KEY,JSON.stringify(ledger));ProfessionUI.engine.load();const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===ProgressionStorage.KEY)throw Error('quota');return write.call(this,k,v)}});
   assert.equal((await p.evaluate(id=>QuestSystem.deliver(id),id)).ok,false);
   assert.equal(await p.evaluate(()=>ProfessionUI.engine.state.materials['frontier-brace']),0);
   assert.ok(await p.evaluate(id=>ProfessionUI.engine.deliveryReceipt(id),id));
   await p.reload();await p.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===ProfessionEngine.KEY)throw Error('quota');return write.call(this,k,v)}});
   const results=await p.evaluate(id=>Promise.all([QuestSystem.deliver(id),QuestSystem.deliver(id)]),id);assert.equal(results.filter(r=>r.ok).length,1);
   assert.equal(await p.evaluate(id=>ProgressionStore.state.frontier.quests[id].status,id),'completed');
   const other=await c.newPage();await other.goto(base);
   const claims=await Promise.all([p.evaluate(id=>QuestSystem.claim(id),id),other.evaluate(id=>QuestSystem.claim(id),id)]);assert.equal(claims.filter(r=>r.ok).length,1);
   await p.close();assert.equal((await other.evaluate(()=>ProgressionStore.transact(s=>({ok:true,unchanged:true})))).ok,true);
   await other.reload();assert.equal(await other.evaluate(()=>ProgressionStore.state.ownedLootIds.filter(x=>x==='frontier-ring').length),1);
   assert.equal((await other.evaluate(id=>QuestSystem.claim(id),id)).ok,false);assert.deepEqual(errors,[]);await c.close();
   console.log(`PASS Bram ${width}px: second-write failure, reload, denied redundant write, double request, two tabs, ownership release and once-only reward`);
  }
  const c=await browser.newContext(),p=await c.newPage();await p.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));await p.goto(base);
  await p.evaluate(id=>{const s=ProgressionStore.state;s.frontier.quests[id].status='active';localStorage.setItem(ProgressionStorage.KEY,JSON.stringify(s));ProgressionStore.refresh();const ledger=ProfessionUI.engine.state;ledger.materials['frontier-brace']=1;localStorage.setItem(ProfessionEngine.KEY,JSON.stringify(ledger));ProfessionUI.engine.load()},id);
  const before=await p.evaluate(()=>[localStorage.getItem(ProgressionStorage.KEY),localStorage.getItem(ProfessionEngine.KEY)]);
  assert.equal((await p.evaluate(id=>QuestSystem.deliver(id),id)).ok,false);assert.deepEqual(await p.evaluate(()=>[localStorage.getItem(ProgressionStorage.KEY),localStorage.getItem(ProfessionEngine.KEY)]),before);await c.close();
  console.log('PASS no Web Locks: delivery refused without writes');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
