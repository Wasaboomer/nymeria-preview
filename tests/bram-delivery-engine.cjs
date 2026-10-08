const assert=require('node:assert/strict');
const fixture=require('./world-fixture.cjs'),Professions=require('../profession-system'),Quests=require('../quest-system'),Storage=require('../progression-store');
const id='sq-bram-preparation';
function setup(){
 const memory=new Map(),f=fixture({memory});let deny=null;const write=memory.set.bind(memory);memory.set=(key,value)=>{if(key===deny)throw Error('quota');return write(key,value);};
 const p=Professions.create({storage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},context:()=>({location:f.store.state.frontier.location,accessible:true,activeEncounter:!!f.store.state.frontier.activeEncounter,quests:Object.fromEntries(Object.entries(f.store.state.frontier.quests).map(([k,q])=>[k,q.status]))})});
 const q=Quests.create({store:f.store,progression:f.system,professions:()=>p});
 return {...f,p,q,deny:key=>{deny=key;}};
}
async function prepare(f){await f.q.accept(id);await f.world.enter('broken-path');for(let i=0;i<3;i++)assert.equal((await f.p.gather('vesper-iron-vein')).ok,true);for(let i=0;i<2;i++)assert.equal((await f.p.craft('forge-iron')).ok,true);assert.equal(f.p.state.professions.blacksmithing.level,2);assert.equal((await f.p.craft('frontier-brace')).ok,true);}
(async()=>{
 const f=setup();assert.equal((await f.p.handover(id)).ok,false);await prepare(f);assert.equal((await f.q.deliver(id)).ok,false);assert.equal(f.p.state.materials['frontier-brace'],1);await f.world.enter('veyra');
 f.deny(Professions.KEY);assert.equal((await f.q.deliver(id)).ok,false);assert.equal(f.p.state.materials['frontier-brace'],1);assert.equal(f.store.state.frontier.quests[id].status,'active');
 f.deny(Storage.KEY);assert.equal((await f.q.deliver(id)).ok,false);assert.equal(f.p.state.materials['frontier-brace'],0);assert.ok(f.p.deliveryReceipt(id));assert.equal(f.store.state.frontier.quests[id].status,'active');
 f.deny(null);f.p.load();const delivered=await Promise.all([f.q.deliver(id),f.q.deliver(id)]);assert.equal(delivered.filter(r=>r.ok).length,1);assert.equal(f.p.state.materials['frontier-brace'],0);assert.equal(f.store.state.frontier.quests[id].status,'completed');
 const claims=await Promise.all([f.q.claim(id),f.q.claim(id)]);assert.equal(claims.filter(r=>r.ok).length,1);assert.equal(f.store.state.ownedLootIds.filter(x=>x==='frontier-ring').length,1);assert.equal((await f.q.deliver(id)).ok,false);assert.equal((await f.q.accept(id)).ok,false);
 const legacyProfession={...f.p.state,version:1};assert.deepEqual(Professions.normalize(legacyProfession),f.p.state);assert.ok(Professions.normalize(legacyProfession).deliveries[id]);const legacyQuest={...f.store.state.frontier,questVersion:1};assert.equal(Quests.normalize(legacyQuest).quests[id].status,'claimed');assert.equal(Quests.normalize(legacyQuest).questVersion,2);
 const reloaded=fixture({memory:f.memory});assert.equal(reloaded.store.state.frontier.quests[id].status,'claimed');assert.equal(reloaded.store.state.ownedLootIds.filter(x=>x==='frontier-ring').length,1);
 const g=setup();await prepare(g);await g.world.enter('veyra');await g.q.deliver(id);g.deny(Storage.KEY);assert.equal((await g.q.claim(id)).ok,false);assert.equal(g.store.state.frontier.quests[id].status,'completed');assert.equal(g.store.state.ownedLootIds.includes('frontier-ring'),false);g.deny(null);assert.equal((await g.q.claim(id)).ok,true);
 const owned=setup();await prepare(owned);await owned.store.transact(s=>{s.ownedLootIds.push('frontier-ring');return {ok:true};});await owned.world.enter('veyra');await owned.q.deliver(id);await owned.q.claim(id);assert.equal(owned.store.state.ownedLootIds.filter(x=>x==='frontier-ring').length,1);assert.equal(owned.store.state.materials.iron,2);assert.equal((await owned.q.claim(id)).ok,false);assert.equal(owned.store.state.materials.iron,2);
 console.log('PASS Bram: optional acceptance, recipe progression, geography, durable once-only handover/claim, reload, concurrent retries and both-ledger/claim write failures');
})().catch(e=>{console.error(e);process.exitCode=1;});
