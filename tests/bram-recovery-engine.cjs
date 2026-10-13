const assert = require('node:assert/strict');
const fixture = require('./world-fixture.cjs');
const P = require('../profession-system'), G = require('../progression-store'), Q = require('../quest-system');
const A=require('../material-capacity-admission'), B=require('../material-bag-contract');
const id = 'sq-bram-preparation';
function open(memory = new Map()) {
  const f = fixture({memory});
  const p = P.create({storage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},context:()=>({accessible:true,location:f.store.state.frontier.location,quests:Object.fromEntries(Object.entries(f.store.state.frontier.quests).map(([k,v])=>[k,v.status]))})});
  return {...f,p,q:Q.create({store:f.store,progression:f.system,professions:()=>p})};
}
async function ready() {
  const f=open(); assert.equal((await f.q.accept(id)).ok,true);
  f.memory.set(P.KEY,JSON.stringify({...P.empty(),materials:{'frontier-brace':1}}));f.p.load();return f;
}
let count=0;
async function check(name,run){await run();count++;console.log('PASS '+name)}
(async()=>{
 await check('Reload before, between and after writes; durable receipt consumes exactly once',async()=>{
  let f=await ready();f=open(f.memory);assert.equal((await f.p.handover(id)).ok,true);
  f=open(f.memory);assert.equal(f.p.state.materials['frontier-brace'],0);assert.equal((await f.q.deliver(id)).ok,true);
  f=open(f.memory);assert.equal((await f.q.deliver(id)).ok,false);assert.equal((await f.q.claim(id)).ok,true);
  f=open(f.memory);const before=[...f.memory];assert.equal((await f.q.claim(id)).ok,false);assert.equal((await f.q.deliver(id)).ok,false);assert.deepEqual([...f.memory],before);
 });
 await check('Retry needs no profession write after a durable receipt, even when that write is denied',async()=>{
  const f=await ready();assert.equal((await f.p.handover(id)).ok,true);const bytes=f.memory.get(P.KEY),set=f.memory.set.bind(f.memory);
  f.memory.set=(k,v)=>{if(k===P.KEY)throw Error('quota');return set(k,v)};
  assert.equal((await f.q.deliver(id)).ok,true);assert.equal(f.memory.get(P.KEY),bytes);assert.equal(f.store.state.frontier.quests[id].status,'completed');
 });
 await check('First and second write failures preserve recoverable state across reload',async()=>{
  for(const key of [P.KEY,G.KEY]){
   let f=await ready();const memory=f.memory,set=memory.set.bind(memory),beforeP=memory.get(P.KEY),beforeG=memory.get(G.KEY);
   memory.set=(k,v)=>{if(k===key)throw Error('quota');return set(k,v)};
   assert.equal((await f.q.deliver(id)).ok,false);assert.equal(memory.get(G.KEY),beforeG);
   if(key===P.KEY)assert.equal(memory.get(P.KEY),beforeP);else assert.ok(f.p.deliveryReceipt(id));
   memory.set=set;f=open(memory);assert.equal((await f.q.deliver(id)).ok,true);assert.equal(f.p.state.materials['frontier-brace'],0);
  }
 });
 await check('Insufficient material, corrupt/future/unknown saves and denied reads remain untouched',async()=>{
  const empty=await ready();empty.memory.set(P.KEY,JSON.stringify(P.empty()));assert.equal((await empty.q.deliver(id)).ok,false);
  for(const key of [P.KEY,G.KEY])for(const raw of ['{broken',JSON.stringify({version:999}),JSON.stringify({version:1,materials:{unknown:1}})]){
   const f=await ready();f.memory.set(key,raw);f.store.refresh();f.p.load();const before=[...f.memory];assert.equal((await f.q.deliver(id)).ok,false);assert.deepEqual([...f.memory],before);
  }
  const f=await ready(),get=f.memory.get.bind(f.memory);f.memory.get=()=>{throw Error('denied')};assert.equal((await f.q.deliver(id)).ok,false);f.memory.get=get;assert.equal(f.p.readSnapshot().state.materials['frontier-brace'],1);
 });
 await check('Shared queue and full simulated bag: concurrent delivery and pending duplicate-loot retry',async()=>{
  const f=await ready();let queue=Promise.resolve(),inside=false,padding=39;
  const exclusive=run=>{const task=queue.then(async()=>{inside=true;try{return await run()}finally{inside=false}});queue=task.catch(()=>{});return task};
  const storage={getItem:k=>f.memory.get(k)??null,setItem:(k,v)=>f.memory.set(k,v)};
  let store,profession;
  const extras=Array.from({length:40},(_,i)=>({owner:'profession',id:`test-${i}`,key:`profession:test-${i}`}));
  const session=A.createTestSession({purpose:'capacity-simulation',isCoordinated:()=>inside,readers:{progression:()=>store.readSnapshot(),profession:()=>profession.readSnapshot()},readMetadata:()=>({ok:true,state:{version:1,baseCapacity:40,expansionIds:[]}}),entries:[...B.catalog,...extras],project:ledgers=>{for(const row of extras.slice(0,padding))ledgers.profession.materials[row.id]=1;return ledgers}});
  store=G.create({storage,exclusive,materialAdmission:session.progression});
  const context=()=>({accessible:true,location:store.state.frontier.location,quests:Object.fromEntries(Object.entries(store.state.frontier.quests).map(([k,v])=>[k,v.status]))});
  profession=P.create({storage,exclusive,context,materialAdmission:session.profession});
  const other=P.create({storage,exclusive,context,materialAdmission:session.profession});
  const q=Q.create({store,progression:f.system,professions:()=>profession}),q2=Q.create({store,progression:f.system,professions:()=>other});
  const results=await Promise.all([q.deliver(id),q2.deliver(id)]);assert.equal(results.filter(x=>x.ok).length,1);
  assert.equal(profession.readSnapshot().state.materials['frontier-brace'],0);assert.equal(store.state.frontier.quests[id].status,'completed');
  // A capacity gate in the reward lifecycle, not a gameplay flag or saved setting.
  const Life=require('../progression-system');
  const life=Life.create({store,equipment:f.equipment,classes:f.classes,catalogue:f.catalogue,rewardAdmission:session.reward});
  const rewards=Q.create({store,progression:life,professions:()=>profession});
  assert.equal((await store.transact(s=>{s.ownedLootIds.push('frontier-ring');return {ok:true}})).ok,true);
  padding=40;assert.equal((await rewards.claim(id)).pending,true);assert.equal(store.state.materials.iron,0);
  const pending=store.state.frontier.quests[id].pendingReward;assert.ok(pending);assert.deepEqual(G.create({storage}).state.frontier.quests[id].pendingReward,pending);
  padding=39;assert.equal((await rewards.claim(id)).ok,true);assert.equal(store.state.materials.iron,2);
  assert.equal((await rewards.claim(id)).ok,false);assert.equal(store.state.materials.iron,2);
 });
 console.log(`${count} Bram recovery cases passed`);
})().catch(e=>{console.error(e);process.exitCode=1});
