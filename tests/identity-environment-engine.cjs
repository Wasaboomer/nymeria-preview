const assert=require('node:assert/strict'),D=require('../character-identity-data'),I=require('../character-identity-system'),A=require('../travel-access'),T=require('../travel-system'),Storage=require('../progression-store'),fixture=require('./world-fixture.cjs');
let n=0;const check=async(name,fn)=>{await fn();n++;console.log('PASS '+name)};
const route=(environment='land')=>({id:'fixture-only',environment,baseDurationMs:90000,requirements:{minimumLevel:1},environmentRequirements:{capabilities:[],tools:[],assistance:[]},available:true});
(async()=>{
 await check('seven stable unique identities; no automatic race or appearance inference',()=>{
  assert.deepEqual(D.races.map(r=>r.id),['human','velhiri','kharun','sylani','thalassi','draeth','orlani']);assert.equal(new Set(D.races.map(r=>r.id)).size,7);
  for(const id of [undefined,null,'','elf','HUMAN','<script>',{},1])assert.equal(D.get(id),null);
  for(const raw of [null,{},[],{version:1,raceId:'elf',skin:'warm'},{version:1,face:'thalassi'},{version:2,raceId:'human'}])assert.equal(D.normalize(raw).raceId,null);
 });
 await check('all races and unassigned: land/coastal open without racial penalty or duration modifier',()=>{
  for(const raceId of [null,...D.races.map(r=>r.id)])for(const environment of ['land','coastal']){
   const r=A.evaluateRouteAccess({raceId},route(environment),{level:1});assert.equal(r.accessible,true);assert.deepEqual(r.environmentalModifiers,[]);assert.equal(r.baseDurationMs,90000);
  }
 });
 await check('Thalassi natural land/underwater breathing; all others blocked underwater, no fake external access',()=>{
  assert.ok(D.get('thalassi').capabilities.includes('breathe-land'));
  for(const raceId of [null,...D.races.map(r=>r.id)]){
   const r=A.evaluateRouteAccess({raceId},route('underwater'),{level:1,capabilities:['breathe-underwater'],tools:['breathing-device'],guide:true,externalSatisfied:true});
   assert.equal(r.accessible,raceId==='thalassi');assert.equal(r.externalSupportImplemented,false);
   if(r.accessible)assert.ok(r.satisfiedRequirements.some(x=>x.id==='breathe-underwater'&&x.source==='natural'));
   else{assert.ok(r.reason);assert.ok(r.missingRequirements.some(x=>x.id==='breathe-underwater'&&x.source==='unmet'));}
  }
 });
 await check('declarative availability, level, capabilities, tools/assistance and malformed definitions fail closed',()=>{
  for(const patch of [{available:false,unavailableReason:'Fixture chiusa'},{environment:'lava'},{baseDurationMs:-1},{environmentRequirements:{capabilities:['unknown'],tools:[],assistance:[]}},{environmentRequirements:{capabilities:[],tools:['breathing-device'],assistance:[]}},{environmentRequirements:{capabilities:[],tools:[],assistance:['guide']}},{environmentRequirements:[]}]){
   const r=A.evaluateRouteAccess({raceId:'thalassi'},{...route('underwater'),...patch},{level:1});assert.equal(r.accessible,false);assert.ok(r.reason);
  }
  assert.equal(A.evaluateRouteAccess({raceId:null},route(),{level:0}).accessible,false);
 });
 await check('explicit assignment, persistence, once-only normal choice, TEST change/reset and unchanged other state',async()=>{
  const f=fixture(),i=I.create({store:f.store});const before=f.store.state,gear=f.read('Equipment.state');
  assert.equal((await i.assign('elf')).ok,false);assert.equal(f.store.state.characterIdentity.raceId,null);
  assert.equal((await i.assign('thalassi')).ok,true);assert.equal((await i.assign('thalassi')).unchanged,true);
  assert.equal((await i.assign('human')).ok,false);assert.equal((await i.reset()).ok,false);
  const reload=fixture({memory:f.memory,clock:f.clock});assert.equal(reload.store.state.characterIdentity.raceId,'thalassi');
  for(const key of Object.keys(before).filter(x=>x!=='characterIdentity'))assert.deepEqual(f.store.state[key],before[key]);assert.deepEqual(f.read('Equipment.state'),gear);
  const test=I.create({store:f.store,testMode:true});assert.equal((await test.assign('human')).ok,true);assert.equal((await test.reset()).ok,true);assert.equal(f.store.state.characterIdentity.raceId,null);
 });
 await check('identity write failure / unavailable storage preserve existing state',async()=>{
  const f=fixture(),denied=fixture({memory:f.memory,clock:f.clock,denyWrite:true});
  assert.equal((await I.create({store:denied.store}).assign('human')).ok,false);assert.equal(denied.store.state.characterIdentity.raceId,null);
  const store=Storage.create({storage:{getItem(){throw Error('denied')},setItem(){throw Error('denied')}}});assert.equal((await I.create({store}).assign('human')).ok,false);
 });
 await check('legacy saves/tickets migrate additively and version-1 departure snapshots survive',async()=>{
  const f=fixture(),t=T.create({store:f.store,now:()=>f.clock.value,testMode:true});await t.start('test-veyra-path');
  const raw=f.store.state;delete raw.characterIdentity;raw.travel.active.requirementsSnapshot={version:1,satisfied:true,level:1,originUnlocked:true,destinationUnlocked:true};
  f.memory.set(Storage.KEY,JSON.stringify(raw));const old=fixture({memory:f.memory,clock:f.clock});assert.equal(old.store.state.characterIdentity.raceId,null);
  assert.deepEqual(old.store.state.travel.active,raw.travel.active);f.clock.value=raw.travel.active.endsAt;
  await T.create({store:old.store,now:()=>f.clock.value}).refresh();assert.equal(old.store.state.frontier.location,'broken-path');
 });
 await check('version-2 environment snapshot persists; no retroactive policy evaluation; arrival exactly once',async()=>{
  const f=fixture(),i=I.create({store:f.store,testMode:true});await i.assign('thalassi');
  const t=T.create({store:f.store,now:()=>f.clock.value,testMode:true});const start=await t.start('test-veyra-path');assert.ok(start.ok);
  const snap=start.ticket.requirementsSnapshot;assert.equal(snap.version,2);assert.equal(snap.raceId,'thalassi');assert.equal(snap.environment,'land');
  assert.equal((await i.assign('human')).ok,false);assert.equal((await i.reset()).ok,false);
  const raw=f.store.state;raw.characterIdentity={version:1,raceId:'human'};f.memory.set(Storage.KEY,JSON.stringify(raw));
  const reopen=fixture({memory:f.memory,clock:f.clock});assert.deepEqual(reopen.store.state.travel.active.requirementsSnapshot,snap);
  const catalog=require('../travel-data'),r=catalog.get('test-veyra-path'),previous=r.environment;r.environment='underwater';
  try{f.clock.value=start.ticket.endsAt+100000000;const e=T.create({store:reopen.store,now:()=>f.clock.value});await e.refresh();assert.equal(reopen.store.state.frontier.location,'broken-path');const after=reopen.store.state;await e.refresh();assert.deepEqual(reopen.store.state,after);}finally{r.environment=previous;}
 });
 await check('unknown future snapshot schema blocks writes without overwriting',async()=>{
  const f=fixture(),t=T.create({store:f.store,now:()=>f.clock.value,testMode:true});await t.start('test-veyra-path');const raw=f.store.state;raw.travel.active.requirementsSnapshot.version=3;f.memory.set(Storage.KEY,JSON.stringify(raw));
  const reopen=fixture({memory:f.memory,clock:f.clock});assert.equal((await I.create({store:reopen.store}).assign('human')).ok,false);assert.equal(f.memory.get(Storage.KEY),JSON.stringify(raw));
 });
 console.log(n+' identity/environment checks passed; underwater fixtures never added to playable catalogue');
})().catch(e=>{console.error(e);process.exitCode=1});
