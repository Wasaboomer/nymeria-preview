const assert=require('node:assert/strict'),G=require('../progression-store'),P=require('../profession-system');
const A=require('../material-capacity-admission'),B=require('../material-bag-contract'),M=require('../material-bag-store');
const Life=require('../progression-system'),Q=require('../quest-system'),World=require('../world-system'),D=require('../profession-data'),base=require('./character-fixture.cjs');
function fixture({padding=39,materials={},progression={}}={}) {
 const f=base(),memory=f.memory,storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 memory.set(P.KEY,JSON.stringify({...P.empty(),materials}));const initial=G.initial();Object.assign(initial.materials,progression);memory.set(G.KEY,JSON.stringify(initial));
 let queue=Promise.resolve(),inside=false,pad=padding;
 const exclusive=run=>{const result=queue.then(async()=>{inside=true;try{return await run()}finally{inside=false}});queue=result.catch(()=>{});return result;};
 const extras=Array.from({length:40},(_,i)=>({owner:'profession',id:`fixture-${i}`,key:`profession:fixture-${i}`}));
 let store,profession;
 const session=A.createTestSession({purpose:'capacity-simulation',isCoordinated:()=>inside,readers:{progression:()=>store.readSnapshot(),profession:()=>profession.readSnapshot()},
  readMetadata:M.create({storage}).read,entries:[...B.catalog,...extras],project:ledgers=>{for(const row of extras.slice(0,pad))ledgers.profession.materials[row.id]=1;return ledgers;}});
 store=G.create({storage,exclusive,materialAdmission:session.progression});
 profession=P.create({storage,exclusive,context:()=>({accessible:true,location:'broken-path'}),materialAdmission:session.profession});
 const life=Life.create({store,equipment:f.equipment,classes:f.classes,catalogue:f.catalogue,now:()=>f.clock.value,rewardAdmission:session.reward});
 return {f,storage,store,profession,session,life,memory,space:n=>pad=n,exclusive};
}
let count=0;async function check(name,run){await run();count++;console.log('PASS '+name)}
(async()=>{
 await check('Full bag: existing material grows; new type blocked with unchanged XP/bytes',async()=>{
  const a=fixture({materials:{'raw-iron':1}});assert.equal((await a.profession.gather('vesper-iron-vein')).ok,true);assert.equal(a.profession.state.materials['raw-iron'],3);
  const b=fixture({progression:{iron:1}}),before=b.memory.get(P.KEY);assert.equal((await b.profession.gather('vesper-iron-vein')).code,'capacity-exceeded');assert.equal(b.memory.get(P.KEY),before);
 });
 await check('Craft final state: last ingredient frees slot; retained ingredient blocks new output',async()=>{
  const a=fixture({materials:{'raw-iron':3}});assert.equal((await a.profession.craft('forge-iron')).ok,true);assert.equal(a.profession.state.materials['raw-iron'],0);assert.equal(a.profession.state.materials['forged-iron'],1);
  const b=fixture({materials:{'raw-iron':4}}),before=b.memory.get(P.KEY);assert.equal((await b.profession.craft('forge-iron')).ok,false);assert.equal(b.memory.get(P.KEY),before);
 });
 await check('Multiple products all-or-nothing and legacy material overflow',async()=>{
  const recipe=D.recipe('forge-iron'),original=recipe.outputs;
  try{recipe.outputs={'forged-iron':1,'wild-herbs':1};const a=fixture({materials:{'raw-iron':3}}),before=a.memory.get(P.KEY);assert.equal((await a.profession.craft(recipe.id)).ok,false);assert.equal(a.memory.get(P.KEY),before);a.space(38);assert.equal((await a.profession.craft(recipe.id)).ok,true)}finally{recipe.outputs=original}
  const b=fixture({padding:0,materials:{'raw-iron':P.MAX_MATERIAL}}),before=b.memory.get(P.KEY);assert.equal((await b.profession.gather('vesper-iron-vein')).ok,false);assert.equal(b.memory.get(P.KEY),before);
  assert.equal((await b.store.transact(s=>{s.materials.iron=Number.MAX_SAFE_INTEGER+1;return {ok:true}})).ok,false);
 });
 await check('Fresh global reads under shared queue prevent overbooking concurrent writers',async()=>{
  const a=fixture();const results=await Promise.all([a.profession.gather('vesper-iron-vein'),a.store.transact(s=>{s.materials.iron++;return {ok:true}})]);assert.equal(results.filter(x=>x.ok).length,1);assert.equal(Number(a.store.readSnapshot().state.materials.iron>0)+Number((a.profession.readSnapshot().state.materials['raw-iron']||0)>0),1);
  const b=fixture();const other=P.create({storage:b.storage,exclusive:b.exclusive,context:()=>({accessible:true,location:'broken-path'}),materialAdmission:b.session.profession});const both=await Promise.all([b.profession.gather('vesper-iron-vein'),other.gather('vesper-iron-vein')]);assert.ok(both.every(x=>x.ok));assert.equal(other.state.materials['raw-iron'],4);
  assert.equal(b.session.reward(b.store.state,{produces:[]}).code,'coordination-required');
 });
 await check('Quest pending, duplicate iron conversion, reload and retry share global admission',async()=>{
  const a=fixture({materials:{'raw-iron':1}}),q=Q.create({store:a.store,progression:a.life,now:()=>a.f.clock.value});
  await a.store.transact(s=>{for(const id of ['mq01','mq02','mq03'])s.frontier.quests[id].status='claimed';s.frontier.quests.mq04={status:'completed',progress:[1,1],lootPolicy:a.life.personalPreparation()};return {ok:true}});
  assert.equal((await q.claim('mq04')).pending,true);const saved=a.memory.get(G.KEY);assert.equal(G.create({storage:a.storage}).state.frontier.quests.mq04.pendingReward.id,'quest:mq04');assert.equal(a.store.state.crowns,0);a.space(35);assert.equal((await q.claim('mq04')).ok,true);assert.notEqual(a.memory.get(G.KEY),saved);const paid=a.memory.get(G.KEY);assert.equal((await q.claim('mq04')).ok,false);assert.equal(a.memory.get(G.KEY),paid);
  const b=fixture({materials:{'raw-iron':1}}),item='vesper-blade';await b.store.transact(s=>{s.ownedLootIds.push(item);return {ok:true}});
  const result=await b.store.transact(s=>{const r=b.life.grantRewards(s,{xp:10,crowns:2,lootIds:[item]});return r.ok===false?{ok:false,...r}:{ok:true}});assert.equal(result.pending,true);assert.equal(b.store.state.materials.iron,0);assert.equal(b.store.state.crowns,0);
 });
 await check('World and expedition preserve original rewards with the global foreign-ledger check',async()=>{
  const a=fixture({materials:{'raw-iron':1}});a.f.kit('warden');
  const world=World.create({store:a.store,progression:a.life,now:()=>a.f.clock.value});assert.equal((await world.enter('broken-path')).ok,true);
  const started=await world.startEncounter('vesper-raider',{seed:7});assert.equal(started.ok,true);await a.store.transact(s=>{s.frontier.activeEncounter.template.rewards.materials={iron:1};return {ok:true}});
  const result=await world.finishEncounter(a.store.state.frontier.activeEncounter.id);assert.equal(result.pending,true);const original=JSON.stringify(result.receipt.result);a.space(35);assert.equal((await world.claimEncounter(result.receipt.id)).ok,true);assert.equal(JSON.stringify(a.store.state.frontier.lastEncounter.result),original);
  const b=fixture({materials:{'raw-iron':1}});b.f.kit('warden');assert.equal((await b.life.start('patrol',{seed:7})).ok,true);b.f.clock.value=b.store.state.activeExpedition.endsAt;await b.life.refresh();const report=b.store.state.pendingExpeditionResult;
  assert.equal((await b.life.claim(report.id)).pending,true);assert.deepEqual(b.store.state.pendingExpeditionResult,report);b.space(35);assert.equal((await b.life.claim(report.id)).ok,true);assert.deepEqual(b.store.state.lastClaim.rewards,report.rewards);
 });
 await check('Unsafe other ledger/metadata, storage denial/quota, reload preserve raw records',async()=>{
  for(const [key,raw] of [[P.KEY,'{bad'],[P.KEY,JSON.stringify({version:99})],[G.KEY,'{bad'],[M.KEY,JSON.stringify({version:99})]]){
   const a=fixture();a.memory.set(key,raw);const before=new Map(a.memory);const r=key===G.KEY?await a.profession.gather('vesper-iron-vein'):await a.store.transact(s=>{s.materials.iron++;return {ok:true}});assert.equal(r.ok,false);assert.deepEqual(a.memory,before);
  }
  const a=fixture(),before=a.memory.get(P.KEY);a.storage.setItem=()=>{throw Error('quota')};assert.equal((await a.profession.gather('vesper-iron-vein')).ok,false);assert.equal(a.memory.get(P.KEY),before);
  a.storage.getItem=()=>{throw Error('denied')};assert.equal((await a.profession.gather('vesper-iron-vein')).ok,false);
 });
 await check('No gameplay activation or metadata writes; legacy engines still permissive',async()=>{
  const a=fixture();assert.equal(a.memory.has(M.KEY),false);assert.equal((await a.profession.gather('vesper-iron-vein')).ok,true);assert.equal(a.memory.has(M.KEY),false);
  assert.equal((await P.create({storage:a.storage,context:()=>({accessible:true,location:'broken-path'})}).gather('vesper-iron-vein')).ok,true);
  assert.throws(()=>A.createTestSession({}),/Explicit/);
 });
 console.log(`${count} capacity integration scenarios passed; production capacity inactive`);
})().catch(e=>{console.error(e);process.exitCode=1});
