const assert=require('node:assert/strict'),fixture=require('./world-fixture.cjs');
const Engine=require('../travel-system'),Storage=require('../progression-store'),Routes=require('../travel-data');
let checks=0;
const check=async(name,run)=>{await run();checks++;console.log('PASS '+name)};
const setup=(options={})=>{const f=fixture(options);f.travel=Engine.create({store:f.store,now:()=>f.clock.value,testMode:options.testMode!==false});return f;};
const start=async(f)=>{const r=await f.travel.start('test-veyra-path');assert.ok(r.ok,r.message);return r.ticket};
(async()=>{
 await check('old save additive migration / racial identity remains unassigned',()=>{
  const f=setup();const old=f.store.state;delete old.travel;delete old.characterIdentity;
  const n=Storage.normalize(old);assert.deepEqual(n.travel,Engine.empty());assert.equal(n.characterIdentity.raceId,null);
  for(const k of ['totalXP','crowns','materials','frontier'])assert.deepEqual(n[k],old[k]);
  old.characterIdentity={version:1,raceId:'thalassi'};assert.equal(Storage.normalize(old).characterIdentity.raceId,'thalassi');
 });
 await check('requirements, unknown routes, origin, locked destination and normal mode',async()=>{
  const f=setup();assert.equal((await f.travel.start('unknown')).ok,false);
  assert.equal((await f.travel.start('test-path-veyra')).ok,false);
  assert.equal((await setup({testMode:false}).travel.start('test-veyra-path')).ok,false);
  const raw=f.store.state;raw.unlockedContent=raw.unlockedContent.filter(x=>x!=='world:broken-path');
  // Pure eligibility bypasses reconciliation adding initial locations, exercising the requirement itself.
  assert.match(f.travel.eligibility(Routes.get('test-veyra-path'),raw),/accessibile/);
  assert.match(f.travel.eligibility({...Routes.get('test-veyra-path'),requirements:{minimumLevel:21}}),/Livello/);
 });
 await check('start snapshot, double confirmation, persisted route and unchanged resources',async()=>{
  const f=setup();const before=f.store.state;const r=await Promise.all([f.travel.start('test-veyra-path'),f.travel.start('test-veyra-path')]);
  assert.equal(r.filter(x=>x.ok).length,1);const ticket=f.travel.state.active;
  assert.equal(ticket.endsAt-ticket.startedAt,90000);assert.equal(ticket.requirementsSnapshot.satisfied,true);
  assert.deepEqual(setup({memory:f.memory,clock:f.clock}).travel.state.active,ticket);
  for(const k of ['totalXP','crowns','materials','frontier'])assert.deepEqual(f.store.state[k],before[k]);
 });
 await check('during travel world/quest/profession-context actions blocked, independent expedition allowed',async()=>{
  const f=setup();f.kit();await start(f);
  for(const action of [()=>f.world.enter('broken-path'),()=>f.world.talk('serah'),()=>f.quests.accept('mq01'),()=>f.world.startEncounter('vesper-raider'),()=>f.system.beginManualCombat('guardian')])assert.equal((await action()).ok,false);
  assert.equal((await f.system.start('patrol')).ok,true);assert.ok(f.store.state.activeExpedition);assert.ok(f.travel.state.active);
 });
 await check('profession engine transit guard and interactive combat departure guard',async()=>{
  const f=setup();const p=require('../profession-system').create({storage:{getItem:()=>null,setItem(){throw Error('must not write')}},context:()=>({accessible:true,location:'broken-path',traveling:true})});
  assert.equal((await p.gather('vesper-iron-vein')).ok,false);assert.equal((await p.craft('forge-iron')).ok,false);
  const t=Engine.create({store:f.store,testMode:true,interactiveCombat:()=>true});assert.equal((await t.start('test-veyra-path')).ok,false);
 });
 await check('encounter prevents start; abandoning is unchanged',async()=>{
  const f=setup();await f.world.enter('broken-path');f.kit();await f.world.startEncounter('vesper-raider');
  assert.equal((await f.travel.start('test-path-veyra')).ok,false);await f.world.abandonEncounter();assert.equal(f.store.state.frontier.location,'veyra');
 });
 await check('arrival emits once, visit objective only once, no rewards, independent expedition untouched',async()=>{
  const f=setup();f.kit();await f.quests.accept('mq01');await f.world.talk('serah');await f.system.start('patrol');
  const expedition=f.store.state.activeExpedition;const t=await start(f);const before=f.store.state,events=[];f.store.subscribeEvents(e=>events.push(e));
  f.clock.value=t.endsAt-1;assert.ok((await f.travel.refresh()).unchanged);f.clock.value=t.endsAt;
  await Promise.all([f.travel.refresh(),f.travel.refresh()]);assert.equal(f.store.state.frontier.location,'broken-path');
  assert.equal(f.travel.state.active,null);assert.equal(f.travel.state.lastArrival.completionId,t.completionId);
  assert.equal(events.filter(e=>e.type==='travelArrived').length,1);assert.equal(f.store.state.frontier.quests.mq01.status,'completed');
  for(const k of ['totalXP','crowns','materials'])assert.deepEqual(f.store.state[k],before[k]);assert.deepEqual(f.store.state.activeExpedition,expedition);
  await f.world.enter('veyra');await f.travel.refresh();assert.equal(f.store.state.frontier.location,'veyra','old receipt cannot move again');
 });
 for(const mode of ['open','background','terminated'])await check('absolute deadline / '+mode,async()=>{
  const f=setup(),t=await start(f);f.clock.value=t.endsAt+99999999;
  const resumed=mode==='open'?f:setup({memory:f.memory,clock:f.clock});await resumed.travel.refresh();
  assert.equal(resumed.store.state.frontier.location,'broken-path');const after=resumed.store.state;
  const reopen=setup({memory:f.memory,clock:f.clock});await reopen.travel.refresh();assert.deepEqual(reopen.store.state,after);
 });
 await check('explicit return route creates a distinct receipt with the recorded 120-second duration',async()=>{
  const f=setup(),first=await start(f);f.clock.value=first.endsAt;await f.travel.refresh();
  const second=await f.travel.start('test-path-veyra');assert.ok(second.ok);assert.equal(second.ticket.durationMs,120000);
  assert.notEqual(second.ticket.completionId,first.completionId);f.clock.value=second.ticket.endsAt;await f.travel.refresh();
  assert.equal(f.store.state.frontier.location,'veyra');assert.equal(f.travel.state.lastArrival.routeId,'test-path-veyra');
 });
 await check('early reopen, backwards/future wall clock and combat speeds cannot accelerate travel',async()=>{
  const f=setup(),t=await start(f);f.clock.value=t.startedAt-1;await f.travel.refresh();assert.ok(f.travel.state.active);
  f.setSettings({speed:4});f.clock.value=t.endsAt-1;await f.travel.refresh();assert.ok(f.travel.state.active);assert.equal(f.travel.remaining(),1);
  f.clock.value=NaN;assert.equal((await f.travel.refresh()).ok,false);f.clock.value=t.endsAt;await f.travel.refresh();assert.equal(f.travel.state.active,null);
 });
 await check('invalid tickets quarantine only travel; valid future anchors survive',async()=>{
  const f=setup(),t=await start(f),base=f.store.state;
  for(const patch of [{endsAt:undefined},{durationMs:-1},{endsAt:t.startedAt},{destinationId:'veyra'},{requirementsSnapshot:null}]){
   const raw=JSON.parse(JSON.stringify(base));raw.travel.active={...t,...patch};const n=Storage.normalize(raw);
   assert.equal(n.travel.active,null);assert.equal(n.travel.recoveryRequired,true);assert.deepEqual(n.frontier,base.frontier);assert.equal(n.totalXP,base.totalXP);
  }
  assert.deepEqual(Storage.normalize(base).travel.active,t);
  const misplaced=JSON.parse(JSON.stringify(base));misplaced.frontier.location='broken-path';
  assert.deepEqual(Storage.normalize(misplaced).travel.active,t);
  assert.equal(Storage.normalize(misplaced).travel.recoveryRequired,true);
  const raw=JSON.parse(JSON.stringify(base));raw.travel.lastArrival={...t,arrivedAt:t.endsAt};raw.frontier.location=t.destinationId;
  const n=Storage.normalize(raw);assert.equal(n.travel.active,null);assert.equal(n.travel.recoveryRequired,false);
 });
 await check('failed start / failed arrival are atomic and retry safe',async()=>{
  const f=setup(),denied=setup({memory:f.memory,clock:f.clock,denyWrite:true});
  assert.equal((await denied.travel.start('test-veyra-path')).ok,false);assert.equal(denied.travel.state.active,null);
  const t=await start(f);f.clock.value=t.endsAt;const failing=setup({memory:f.memory,clock:f.clock,denyWrite:true});
  const before=failing.store.state;assert.equal((await failing.travel.refresh()).ok,false);assert.deepEqual(failing.store.state,before);
  await f.travel.refresh();assert.equal(f.travel.state.active,null);await f.travel.refresh();
 });
 await check('unavailable storage and future travel/identity versions do not overwrite',async()=>{
  const storage={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
  const s=Storage.create({storage}),e=Engine.create({store:s,testMode:true});assert.equal((await e.start('test-veyra-path')).ok,false);
  for(const field of ['travel','characterIdentity']){const f=setup(),raw=f.store.state;raw[field].version=99;f.memory.set(Storage.KEY,JSON.stringify(raw));
   const next=setup({memory:f.memory,clock:f.clock});assert.equal((await next.travel.start('test-veyra-path')).ok,false);assert.equal(f.memory.get(Storage.KEY),JSON.stringify(raw));}
 });
 console.log(checks+' regional travel checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
