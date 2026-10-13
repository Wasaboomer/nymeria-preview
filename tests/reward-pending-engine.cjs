const assert=require('node:assert/strict');
const base=require('./character-fixture.cjs'),Storage=require('../progression-store'),Life=require('../progression-system');
const Quest=require('../quest-system'),World=require('../world-system'),Quests=require('../quest-data'),Combat=require('../combat-engine');
const Bag=require('../material-bag-contract'),Delivery=require('../reward-delivery');
let count=0;
const check=async(name,run)=>{await run();count++;console.log('PASS '+name)};
function simulation() {
 let holdings=40;
 const extras=Array.from({length:40},(_,i)=>({owner:'profession',id:`fixture-${i}`,key:`profession:fixture-${i}`}));
 const admit=(state,plan)=>Bag.plan({progression:state,profession:{materials:Object.fromEntries(extras.slice(0,holdings).map(row=>[row.id,1]))}},
   {produces:plan.produces},{entries:[...Bag.catalog,...extras]});
 return {admit,space:()=>holdings=35,full:()=>holdings=40};
}
function systems(f,admit=()=>({ok:true})) {
 const progression=Life.create({store:f.store,equipment:f.equipment,classes:f.classes,catalogue:f.catalogue,now:()=>f.clock.value,rewardAdmission:admit});
 return {progression,quest:Quest.create({store:f.store,progression,now:()=>f.clock.value}),
   world:World.create({store:f.store,progression,now:()=>f.clock.value})};
}
const wallet=state=>({xp:state.totalXP,crowns:state.crowns,materials:state.materials,loot:state.ownedLootIds});
const bytes=f=>f.memory.get(Storage.KEY);
async function completed(f,id='mq04') {
 f.kit('warden');
 await f.store.transact(s=>{for(const previous of ['mq01','mq02','mq03'])s.frontier.quests[previous].status='claimed';
  s.frontier.quests[id]={status:'completed',progress:Quests.get(id).objectives.map(x=>x.count),lootPolicy:f.system.personalPreparation()};return {ok:true}});
}
(async()=>{
 await check('Quest: full bag stores stable original bundle; reload/class change/retry; no partial reward or duplicate',async()=>{
  const f=base(),sim=simulation();await completed(f);const system=systems(f,sim.admit),before=wallet(f.store.state),equipped=JSON.stringify(f.equipment.state.equipment);
  const pending=await system.quest.claim('mq04');assert.equal(pending.pending,true);assert.equal(pending.rewardStatus,'pending');assert.deepEqual(wallet(f.store.state),before);
  assert.equal(f.store.state.frontier.quests.mq04.status,'completed');assert.ok(!f.store.state.unlockedContent.includes('world:vesper-ford'));
  const bundle=f.store.state.frontier.quests.mq04.pendingReward,saved=bytes(f);
  assert.equal((await system.quest.claim('mq04')).pending,true);assert.equal(bytes(f),saved);
  const reopened=base({memory:f.memory,clock:f.clock}),retry=systems(reopened,sim.admit);assert.deepEqual(reopened.store.state.frontier.quests.mq04.pendingReward,bundle);
  reopened.classes.selectClass('hunter');const oldXP=Quests.get('mq04').rewards.xp;
  try {Quests.get('mq04').rewards.xp=oldXP+123;sim.space();const claimed=await retry.quest.claim('mq04');assert.equal(claimed.ok,true);assert.equal(claimed.receipt.rewards.xp,bundle.rewards.xp);assert.deepEqual(claimed.receipt.rewards,bundle.rewards);assert.ok(reopened.store.state.ownedLootIds.includes('vesper-blade'));}
  finally {Quests.get('mq04').rewards.xp=oldXP;}
  assert.equal(reopened.store.state.frontier.quests.mq04.status,'claimed');assert.equal(reopened.store.state.frontier.quests.mq04.pendingReward,undefined);
  const paid=bytes(reopened);assert.equal((await retry.quest.claim('mq04')).ok,false);assert.equal(bytes(reopened),paid);
  assert.equal(JSON.stringify(f.equipment.state.equipment),equipped,'Rejected claim does not equip');
 });
 await check('Expedition: multiple materials, frozen report/result, blocked claim/reload/retry; concurrent claims once',async()=>{
  const f=base();f.kit('warden');const report=await f.finish('patrol',7);
  await f.store.transact(s=>{Object.assign(s.pendingExpeditionResult.rewards.materials,{iron:2,fiber:3,ether:1});return {ok:true}});
  const original=f.store.state.pendingExpeditionResult,sim=simulation(),s=systems(f,sim.admit),before=wallet(f.store.state),saved=bytes(f);
  assert.equal((await s.progression.claim(report.id)).pending,true);assert.equal(bytes(f),saved);assert.deepEqual(wallet(f.store.state),before);assert.deepEqual(f.store.state.pendingExpeditionResult,original);
  assert.equal((await s.progression.start('patrol')).ok,false);
  const reopened=base({memory:f.memory,clock:f.clock});sim.space();const retry=systems(reopened,sim.admit);
  const outcomes=await Promise.all([retry.progression.claim(report.id),retry.progression.claim(report.id)]);assert.equal(outcomes.filter(x=>x.ok&&!x.pending).length,1);
  assert.equal(reopened.store.state.pendingExpeditionResult,null);assert.deepEqual(reopened.store.state.lastClaim.rewards,original.rewards);
  for(const key of ['fiber','ether'])assert.equal(reopened.store.state.materials[key],before.materials[key]+original.rewards.materials[key]);
  assert.equal((await retry.progression.claim(report.id)).ok,false);
 });
 await check('Duplicate conversion included in preflight: iron cannot be silently added to a full bag',async()=>{
  const f=base();f.kit('warden');const report=await f.finish('patrol',7),id=report.rewards.lootIds[0];assert.ok(id);
  await f.store.transact(s=>{s.ownedLootIds.push(id);s.pendingExpeditionResult.rewards.lootIds=[id,id];s.pendingExpeditionResult.rewards.materials={iron:0,fiber:0,ether:0};return {ok:true}});
  const sim=simulation(),s=systems(f,sim.admit),saved=bytes(f);assert.equal((await s.progression.claim(report.id)).pending,true);assert.equal(bytes(f),saved);assert.equal(f.store.state.materials.iron,0);
  sim.space();const result=await s.progression.claim(report.id);assert.equal(result.ok,true);assert.equal(f.store.state.materials.iron,4);assert.deepEqual(result.loot,[{itemId:id,duplicate:true},{itemId:id,duplicate:true}]);assert.equal(f.store.state.ownedLootIds.filter(x=>x===id).length,1);
 });
 await check('Full bag can receive already-owned material types; currencies and unique equipment occupy no material slot',async()=>{
  const f=base();f.kit('warden');const report=await f.finish('patrol',7);
  await f.store.transact(s=>{s.materials.iron=1;s.pendingExpeditionResult.rewards.materials={iron:2,fiber:0,ether:0};return {ok:true}});
  const extras=Array.from({length:39},(_,i)=>({owner:'profession',id:`fixture-${i}`,key:`profession:fixture-${i}`}));
  const s=systems(f,(state,plan)=>Bag.plan({progression:state,profession:{materials:Object.fromEntries(extras.map(row=>[row.id,1]))}},{produces:plan.produces},{entries:[...Bag.catalog,...extras]}));
  assert.equal((await s.progression.claim(report.id)).ok,true);assert.equal(f.store.state.materials.iron,3);
 });
 await check('World: save original completed result while reward is blocked; retry/reload without simulation, kill or supply duplication',async()=>{
  const f=base();f.kit('warden');const sim=simulation(),s=systems(f,sim.admit);assert.equal((await s.world.enter('broken-path')).ok,true);assert.equal((await s.world.startEncounter('vesper-raider',{seed:7})).ok,true);
  await f.store.transact(state=>{state.frontier.activeEncounter.template.rewards.materials={iron:1,fiber:2};return {ok:true}});
  const before=wallet(f.store.state),ticket=f.store.state.frontier.activeEncounter.id,pending=await s.world.finishEncounter(ticket);
  assert.equal(pending.pending,true);assert.equal(pending.receipt.outcome,'victory');assert.deepEqual(wallet(f.store.state),before);assert.equal(f.store.state.frontier.activeEncounter,null);
  assert.equal((await s.world.startEncounter('vesper-raider')).ok,false);assert.equal(f.store.state.frontier.supplies['patrol-badge'],1);
  const result=JSON.stringify(pending.receipt.result),reward=JSON.stringify(pending.receipt.rewards),saved=bytes(f);
  assert.equal((await s.world.finishEncounter(ticket)).pending,true);assert.equal(bytes(f),saved);
  const reopened=base({memory:f.memory,clock:f.clock}),retry=systems(reopened,sim.admit);sim.space();const create=Combat.create;
  try {Combat.create=()=>assert.fail('Reward retry must not replay combat');assert.equal((await retry.world.claimEncounter(ticket)).ok,true);assert.equal((await retry.world.finishEncounter(ticket)).unchanged,true);}
  finally {Combat.create=create;}
  assert.equal(JSON.stringify(reopened.store.state.frontier.lastEncounter.result),result);assert.equal(JSON.stringify(reopened.store.state.frontier.lastEncounter.rewards),reward);
  assert.equal(reopened.store.state.frontier.supplies['patrol-badge'],1);assert.equal(reopened.store.state.materials.iron,1);assert.equal(reopened.store.state.materials.fiber,2);
 });
 await check('Storage rejection: first pending write and later payment roll back; original quest remains collectible',async()=>{
  const f=base();await completed(f);const sim=simulation(),s=systems(f,sim.admit),set=f.memory.set.bind(f.memory),before=wallet(f.store.state),saved=bytes(f);
  f.memory.set=(key,value)=>{if(key===Storage.KEY)throw Error('quota');return set(key,value)};
  assert.equal((await s.quest.claim('mq04')).ok,false);assert.equal(bytes(f),saved);assert.deepEqual(wallet(f.store.state),before);
  f.memory.set=set;assert.equal((await s.quest.claim('mq04')).pending,true);const pending=bytes(f);sim.space();
  f.memory.set=(key,value)=>{if(key===Storage.KEY)throw Error('quota');return set(key,value)};
  assert.equal((await s.quest.claim('mq04')).ok,false);assert.equal(bytes(f),pending);assert.deepEqual(wallet(f.store.state),before);
  f.memory.set=set;assert.equal((await s.quest.claim('mq04')).ok,true);
 });
 await check('Pending future/corrupt/unknown quest bundles block writes and preserve bytes',async()=>{
  const f=base();await completed(f);const sim=simulation(),s=systems(f,sim.admit);await s.quest.claim('mq04');const original=bytes(f);
  for(const mutate of [raw=>raw.frontier.quests.mq04.pendingReward.version=99,raw=>raw.frontier.quests.mq04.pendingReward.rewards.materials.unknown=1,raw=>raw.frontier.quests.mq04.pendingReward.id='quest:mq06',raw=>raw.frontier.quests.mq04.pendingReward.rewards.materials.ether=-3]) {
   const raw=JSON.parse(original);mutate(raw);const corrupt=JSON.stringify(raw);f.memory.set(Storage.KEY,corrupt);const reopened=base({memory:f.memory,clock:f.clock});assert.ok(reopened.store.error);assert.equal((await systems(reopened).quest.claim('mq04')).ok,false);assert.equal(bytes(reopened),corrupt);
  }
  f.memory.set(Storage.KEY,'{bad');const corrupt=base({memory:f.memory});assert.equal((await systems(corrupt).progression.claim('invalid')).ok,false);assert.equal(bytes(corrupt),'{bad');
 });
 await check('Admission exception or async checker fails closed; numeric overflow preserves the whole reward',async()=>{
  const f=base();await completed(f);const before=wallet(f.store.state);assert.equal((await systems(f,()=>{throw Error('unavailable')}).quest.claim('mq04')).pending,true);assert.deepEqual(wallet(f.store.state),before);
  assert.equal((await systems(f,()=>Promise.resolve({ok:true})).quest.claim('mq04')).pending,true);assert.deepEqual(wallet(f.store.state),before);
  assert.equal((await systems(f,()=>Promise.reject(Error('async unavailable'))).quest.claim('mq04')).pending,true);
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(wallet(f.store.state),before);
  const state=f.store.state;state.materials.iron=1e9;assert.equal(Delivery.plan(state,{lootIds:['moon-sabatons','moon-sabatons']}).pending,true);
  state.crowns=1e9;assert.equal(Delivery.plan(state,{xp:35,crowns:4}).pending,true);
 });
 await check('World rejected completion/payment, reload and malformed/future pending receipts preserve all data',async()=>{
  const f=base();f.kit('warden');const sim=simulation(),s=systems(f,sim.admit);await s.world.enter('broken-path');await s.world.startEncounter('vesper-raider',{seed:7});
  await f.store.transact(state=>{state.frontier.activeEncounter.template.rewards.materials={ether:1};return {ok:true}});
  const ticket=f.store.state.frontier.activeEncounter.id,saved=bytes(f),before=wallet(f.store.state),set=f.memory.set.bind(f.memory);
  f.memory.set=(key,value)=>{if(key===Storage.KEY)throw Error('quota');return set(key,value)};
  assert.equal((await s.world.finishEncounter(ticket)).ok,false);assert.equal(bytes(f),saved);assert.deepEqual(wallet(f.store.state),before);assert.equal(f.store.state.frontier.activeEncounter.id,ticket);
  f.memory.set=set;assert.equal((await s.world.finishEncounter(ticket)).pending,true);const pending=bytes(f);sim.space();
  f.memory.set=(key,value)=>{if(key===Storage.KEY)throw Error('quota');return set(key,value)};
  assert.equal((await s.world.claimEncounter(ticket)).ok,false);assert.equal(bytes(f),pending);assert.deepEqual(wallet(f.store.state),before);
  f.memory.set=set;
  for(const mutate of [r=>r.deliveryVersion=99,r=>delete r.completedAt,r=>r.rewardStatus='future',r=>r.rewards.materials.unknown=1]) {
   const raw=JSON.parse(pending);mutate(raw.frontier.lastEncounter);const corrupt=JSON.stringify(raw);f.memory.set(Storage.KEY,corrupt);
   const reopened=base({memory:f.memory,clock:f.clock});assert.ok(reopened.store.error);assert.equal((await systems(reopened).world.claimEncounter(ticket)).ok,false);assert.equal(bytes(reopened),corrupt);
  }
  f.memory.set(Storage.KEY,pending);const reopened=base({memory:f.memory,clock:f.clock});assert.equal((await systems(reopened).world.claimEncounter(ticket)).ok,true);
  const paid=bytes(reopened),again=base({memory:f.memory,clock:f.clock});assert.equal((await systems(again).world.claimEncounter(ticket)).unchanged,true);assert.equal(bytes(again),paid);
 });
 await check('Expedition refused payment after pending report preserves original outcome through reload and retry',async()=>{
  const f=base();f.kit('warden');const report=await f.finish('patrol',7),saved=bytes(f),before=wallet(f.store.state),set=f.memory.set.bind(f.memory);
  f.memory.set=(key,value)=>{if(key===Storage.KEY)throw Error('quota');return set(key,value)};
  assert.equal((await systems(f).progression.claim(report.id)).ok,false);assert.equal(bytes(f),saved);assert.deepEqual(wallet(f.store.state),before);
  f.memory.set=set;const reopened=base({memory:f.memory,clock:f.clock});assert.equal((await systems(reopened).progression.claim(report.id)).ok,true);
  assert.deepEqual(reopened.store.state.lastClaim.encounters,report.encounters);assert.equal(reopened.store.state.lastClaim.success,report.success);
 });
 await check('Default runtime has no capacity limit; a unique equipment reward does not need a material slot',async()=>{
  const f=base();await completed(f);assert.equal((await systems(f).quest.claim('mq04')).ok,true);
  const g=base();g.kit('warden');const report=await g.finish('patrol',7);
  await g.store.transact(state=>{state.pendingExpeditionResult.rewards.materials={iron:0,fiber:0,ether:0};state.pendingExpeditionResult.rewards.lootIds=[report.rewards.lootIds[0]];return {ok:true}});
  assert.equal((await systems(g,()=>assert.fail('Unique equipment is outside the material bag')).progression.claim(report.id)).ok,true);
 });
 await check('Future expedition reward preparation is not silently interpreted or consumed',async()=>{
  const f=base();f.kit('warden');const report=await f.finish('patrol',7),raw=JSON.parse(bytes(f));raw.pendingExpeditionResult.lootPolicy.version=99;
  const original=JSON.stringify(raw);f.memory.set(Storage.KEY,original);const reopened=base({memory:f.memory,clock:f.clock});
  assert.equal((await systems(reopened).progression.claim(report.id)).ok,false);assert.equal(bytes(reopened),original);
 });
 await check('Invalid world timestamps cannot save an unreadable pending receipt or partially pay it',async()=>{
  const f=base();f.kit('warden');const sim=simulation(),s=systems(f,sim.admit);await s.world.enter('broken-path');await s.world.startEncounter('vesper-raider',{seed:7});
  await f.store.transact(state=>{state.frontier.activeEncounter.template.rewards.materials={iron:1};return {ok:true}});
  const id=f.store.state.frontier.activeEncounter.id,original=bytes(f),at=f.clock.value;f.clock.value=NaN;
  assert.equal((await s.world.finishEncounter(id)).ok,false);assert.equal(bytes(f),original);
  f.clock.value=at;assert.equal((await s.world.finishEncounter(id)).pending,true);const pending=bytes(f);sim.space();f.clock.value=-1;
  assert.equal((await s.world.claimEncounter(id)).ok,false);assert.equal(bytes(f),pending);f.clock.value=at;assert.equal((await s.world.claimEncounter(id)).ok,true);
 });
 await check('Equipment projection write failure cannot lose canonical loot or trigger another reward',async()=>{
  const f=base();f.kit('warden');const report=await f.finish('patrol',7),set=f.memory.set.bind(f.memory),gearKey=f.run('Equipment.SAVE_KEY');
  f.memory.set=(key,value)=>{if(key===gearKey)throw Error('projection quota');return set(key,value)};
  assert.equal((await systems(f).progression.claim(report.id)).ok,true);const saved=bytes(f);assert.ok(report.rewards.lootIds.every(id=>f.store.state.ownedLootIds.includes(id)));
  f.memory.set=set;const reopened=base({memory:f.memory,clock:f.clock});assert.ok(report.rewards.lootIds.every(id=>reopened.equipment.state.inventory.some(item=>item.id===id)));
  assert.equal((await systems(reopened).progression.claim(report.id)).ok,false);assert.equal(bytes(reopened),saved);
 });
 console.log(`${count} reward-pending integration checks passed; real capacity remains inactive.`);
})().catch(error=>{console.error(error);process.exitCode=1});
