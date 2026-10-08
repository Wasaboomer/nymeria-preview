/* M6 integration against real M2–M5 modules; no mocked combat outcomes. */
const assert = require('node:assert/strict');
const fixture = require('./world-fixture.cjs');
const World = require('../world-data.js'), Quests = require('../quest-data.js');
const Events = require('../quest-events.js'), QuestEngine = require('../quest-system.js');
const WorldEngine = require('../world-system.js'), Progression = require('../progression-data.js');
const Storage = require('../progression-store.js'), Gear = require('../equipment-data.js');
let checks=0;
async function check(name, run) { await run(); console.log('PASS '+name); checks++; }
const ok = async work => { const result=await work; assert.ok(result.ok, result.message); return result; };
const status=(f,id)=>f.store.state.frontier.quests[id].status;
async function claim(f,id) {
  assert.equal(status(f,id),'completed',id);
  const before=f.store.state;
  const result=await ok(f.quests.claim(id));
  assert.equal(status(f,id),'claimed');
  assert.equal(f.store.state.totalXP-before.totalXP, Quests.get(id).rewards.xp);
  assert.equal(f.store.state.crowns-before.crowns,Quests.get(id).rewards.crowns);
  assert.equal((await f.quests.claim(id)).ok,false);
  return result.receipt;
}
async function fight(f,id,count=1) {
  for(let i=0;i<count;i++) {
    const result=await ok(f.fight(id));
    assert.equal(result.receipt.outcome,'victory',id);
  }
}
async function storyline(f) {
  await ok(f.quests.accept('mq01')); await ok(f.world.talk('serah')); await ok(f.world.enter('broken-path')); await claim(f,'mq01');
  await ok(f.quests.accept('mq02')); await fight(f,'vesper-raider',3); await claim(f,'mq02');
  await ok(f.world.enter('veyra')); await ok(f.quests.accept('mq03')); await ok(f.world.enter('lantern-wood'));
  await fight(f,'corrupt-hound',2); await ok(f.world.explore('cold-lantern')); await fight(f,'twilight-stag'); await claim(f,'mq03');
  await ok(f.world.enter('elar-ruins')); await ok(f.quests.accept('mq04')); await ok(f.world.explore('tablet_of_elar'));
  await fight(f,'elar-sentinel',3); await claim(f,'mq04');
  // Equip the personal weapon awarded by MQ04; MQ05 will award a stronger torso.
  const weapon=f.store.state.ownedLootIds.find(id=>['vesper-blade','trail-bow'].includes(id));
  assert.ok(f.equipment.equip(weapon,'mainHand').ok);
  await ok(f.world.enter('veyra')); await ok(f.quests.accept('mq05')); await ok(f.world.enter('vesper-ford'));
  assert.equal((await f.world.explore('far-bank')).ok,false);
  await fight(f,'ford-reaver',3); await fight(f,'ford-commander'); await ok(f.world.explore('far-bank')); await claim(f,'mq05');
  const torso=f.store.state.ownedLootIds.find(id=>['frontier-mail','frontier-chain'].includes(id));
  assert.ok(f.equipment.equip(torso,'torso').ok);
  await ok(f.world.enter('veyra')); await ok(f.quests.accept('mq06')); await ok(f.world.enter('silent-tower'));
  // M6 boss asks for preparation: train within the existing XP system if needed.
  while(f.store.state.level < 7) await fight(f, "silent-shade");
  await fight(f,'silent-shade'); await fight(f,'silence-keeper');
  return claim(f,'mq06');
}
(async()=>{
 await check('data: six base places plus guild discovery, five NPCs, six normal enemies, two minibosses, final boss; seven objective kinds',()=>{
  assert.equal(World.locations.length,7); assert.equal(World.locations.filter(l=>!l.discoveryType).length,6); assert.equal(World.npcs.length,5);
  assert.equal(World.enemies.filter(e=>e.kind==='normal').length,6);
  assert.equal(World.enemies.filter(e=>e.kind==='miniboss').length,2);
  assert.equal(World.enemies.filter(e=>e.kind==='boss').length,1);
  for(const key of ['maxHp','armor','speed']) assert.ok(new Set(World.enemies.map(e=>e[key])).size>3);
  assert.equal(Quests.quests.filter(q=>q.type==='main').length,6); assert.equal(Quests.quests.filter(q=>q.type==='side').length,5);
  assert.equal(new Set(Quests.quests.flatMap(q=>q.objectives.map(o=>o.type))).size,7);
 });
 await check('M5 additive migration preserves level/XP/class/build/appearance/gear/inventory/materials/crowns and active expedition',async()=>{
  const f=fixture();f.kit('warden','retaliation');await f.level(5);await f.system.start('patrol',{seed:7});
  await f.store.transact(s=>{s.crowns=123;s.materials.iron=19;return {ok:true}});
  f.equipment.createCharacter();
  const raw=JSON.parse(f.memory.get(Storage.KEY));delete raw.frontier;f.memory.set(Storage.KEY,JSON.stringify(raw));
  const beforeGear=f.read('Equipment.state'), copy=fixture({memory:f.memory,clock:f.clock});
  for(const key of ['totalXP','level','crowns','materials','activeExpedition','ownedLootIds']) assert.deepEqual(copy.store.state[key],raw[key]);
  assert.deepEqual(copy.read('Equipment.state'),beforeGear);assert.equal(copy.classes.state.builds.warden,'retaliation');
  assert.equal(status(copy,'mq01'),'available'); assert.ok(copy.store.state.unlockedContent.includes('world:veyra'));
 });
 await check('old M5 pending/claimed expedition and manual receipt survive additive migration unchanged',async()=>{
  const f=fixture({testMode:true});f.kit('hunter');await f.finish();
  let raw=JSON.parse(f.memory.get(Storage.KEY));delete raw.frontier;f.memory.set(Storage.KEY,JSON.stringify(raw));
  const restored=fixture({memory:f.memory});assert.deepEqual(restored.store.state.pendingExpeditionResult,raw.pendingExpeditionResult);
  await restored.system.claim(raw.pendingExpeditionResult.id);
  const ticket=(await restored.system.beginManualCombat('guardian')).ticket;await restored.system.awardManualCombat(ticket.id,'victory');
  raw=JSON.parse(f.memory.get(Storage.KEY));delete raw.frontier;f.memory.set(Storage.KEY,JSON.stringify(raw));
  const closed=fixture({memory:f.memory});assert.deepEqual(closed.store.state.lastClaim,raw.lastClaim);assert.deepEqual(closed.store.state.lastCombatReward,raw.lastCombatReward);
  assert.equal(closed.store.state.totalXP,raw.totalXP);assert.equal((await closed.system.awardManualCombat(ticket.id,'victory')).ok,false);
 });
 await check('initial MQ01 available, guarded acceptance/location/minimum level/prerequisites',async()=>{
  const f=fixture();assert.equal(status(f,'mq01'),'available');assert.equal(status(f,'mq02'),'locked');
  assert.equal((await f.quests.accept('mq02')).ok,false); await ok(f.world.enter('broken-path'));
  assert.equal((await f.quests.accept('mq01')).ok,false);assert.equal((await f.world.enter('silent-tower')).ok,false);
  await ok(f.world.enter('veyra'));await ok(f.quests.accept('mq01'));assert.equal((await f.quests.accept('mq01')).ok,false);
 });
 await check('talk and visit dispatch only to active matching objectives; tracking survives refresh',async()=>{
  const f=fixture();await f.world.talk('serah');await f.quests.accept('mq01');
  assert.deepEqual(f.store.state.frontier.quests.mq01.progress,[0,0]);await f.world.talk('mira');
  assert.deepEqual(f.store.state.frontier.quests.mq01.progress,[0,0]);await f.world.talk('serah');await f.world.enter('broken-path');
  assert.equal(status(f,'mq01'),'completed');assert.equal(f.store.state.frontier.trackedQuest,'mq01');
  const reload=fixture({memory:f.memory});assert.equal(status(reload,'mq01'),'completed');await claim(reload,'mq01');
  assert.equal(reload.store.state.frontier.trackedQuest,null);assert.equal(status(reload,'mq02'),'available');
 });
 await check('generic dispatcher supports future profession/guild/faction quests without combat branches',()=>{
  const synthetic={id:'future',objectives:[{type:'collect',target:'mist-herb',count:2}],minimumLevel:1,prerequisites:[],contentUnlocks:[]};
  Quests.quests.push(synthetic);
  try { const state=Storage.normalize(null);state.frontier.quests.future.status='active';Events.dispatch(state,{type:'collect',target:'mist-herb',quantity:99});
    assert.equal(state.frontier.quests.future.status,'completed');assert.deepEqual(state.frontier.quests.future.progress,[2]);
  } finally {Quests.quests.pop();}
 });
 for(const cls of ['warden','hunter']) {
  await check(`${cls}: full main chain, real kills/drops/minibosses/boss, unlocks, discovery, XP/materials, Personal Loot/Advisor/title/epilogue`,async()=>{
   const f=fixture(); f.kit(cls); const receipt=await storyline(f);
   assert.ok(Quests.quests.filter(q=>q.type==='main').every(q=>status(f,q.id)==='claimed'));
   assert.ok(World.locations.filter(l=>!l.discoveryType).every(l=>f.store.state.unlockedContent.includes('world:'+l.id)));
   assert.deepEqual(f.store.state.frontier.discoveries,['tablet_of_elar']);assert.equal(World.discoveries[0].requirement,'Richiede Archeologia 10');
   assert.ok(f.store.state.frontier.achievements.includes('frontier-conqueror'));
   const item=Gear.items.find(i=>i.id===receipt.loot[0].itemId);
   assert.equal(item.armorType,cls==='warden'?'plate':'mail');assert.equal(item.rarity,'Epico');
   assert.ok(f.equipment.state.inventory.some(i=>i.id===item.id));
   const advisor=f.read(`BuildSystem.advise(Equipment.state.inventory.find(i=>i.id==='${item.id}'), 'torso', ClassSystem.state.classId, ClassSystem.build().id, Equipment)`);assert.ok(advisor.improvement);assert.ok(advisor.bestOwned);assert.equal(f.equipment.canEquip(item.id,'torso'),null);
   assert.ok(f.equipment.equip(item.id,'torso').ok);
   const restored=fixture({memory:f.memory});assert.ok(restored.store.state.frontier.achievements.includes('frontier-conqueror'));
   assert.equal((await restored.quests.claim('mq06')).ok,false);
   assert.ok((await restored.world.talk('serah')).ok===false);await restored.world.enter('veyra');
   assert.match((await restored.world.talk('serah')).message,/segnale non si è spento/);
  });
  await check(`${cls}: four side quests, collection/exploration/noncombat, expedition claim bridge and universal ring`,async()=>{
   const f=fixture({testMode:true});f.kit(cls);
   await ok(f.quests.accept('sq-debt'));await ok(f.world.enter('broken-path'));await ok(f.quests.accept('sq-merchant'));
   await ok(f.world.explore('lost-cart'));await fight(f,'vesper-raider',2);await claim(f,'sq-debt');
   assert.equal(status(f,'sq-merchant'),'active');
   await f.finish();const report=f.store.state.pendingExpeditionResult;assert.ok(report.success);
   const before=f.store.state.frontier.quests['sq-merchant'].progress;
   assert.equal(before[2],0);await ok(f.system.claim(report.id));assert.equal(status(f,'sq-merchant'),'completed');
   assert.equal((await f.system.claim(report.id)).ok,false);await claim(f,'sq-merchant');assert.ok(f.equipment.equip('frontier-ring','ringLeft').ok);
   // Unlock prerequisites using the explicit development tool; side objectives remain real.
   await ok(f.world.enter('veyra'));for(const id of ['mq01','mq02','mq03']) {
    const q=Quests.get(id);await ok(f.world.enter(q.location));if(id==='mq03')await f.level(3);
    await ok(f.quests.accept(id));await ok(f.quests.debug(id,'complete'));await claim(f,id);
   }
   await ok(f.world.enter('veyra'));await ok(f.quests.accept('sq-herbs'));await ok(f.world.enter('lantern-wood'));
   for(let i=0;i<3;i++)await ok(f.world.explore('mist-herbs'));await ok(f.world.enter('veyra'));await ok(f.world.talk('mira'));await claim(f,'sq-herbs');
   await ok(f.world.enter('elar-ruins'));await ok(f.quests.accept('sq-window'));await ok(f.world.explore('lit-window'));await ok(f.world.talk('ilyen'));await claim(f,'sq-window');
   assert.ok(Quests.quests.filter(q=>q.type==='side' && !q.objectives.some(o=>o.type==='professionDelivery')).every(q=>status(f,q.id)==='claimed'));
  });
 }
 await check('encounter snapshot survives refresh/class change; replay deterministic and payout exactly once',async()=>{
  const f=fixture();f.kit('hunter');await f.world.enter('broken-path');await f.quests.accept('sq-merchant');
  const start=await ok(f.world.startEncounter('vesper-raider',{seed:7}));
  const reload=fixture({memory:f.memory});assert.deepEqual(reload.store.state.frontier.activeEncounter,start.ticket);
  const expected=WorldEngine.simulate(start.ticket).result;reload.classes.selectClass('warden');
  const result=await ok(reload.world.finishEncounter(start.ticket.id));assert.deepEqual(result.receipt.result,expected);
  const after=reload.store.state;await reload.world.finishEncounter(start.ticket.id);assert.deepEqual(reload.store.state,after);
  assert.equal((await reload.world.enter('not-real')).ok,false);
 });
 await check('defeat returns to Veyra: zero XP/crowns/kill/drop progress, no gear/level loss',async()=>{
  const f=fixture({testMode:true});f.kit('hunter');await f.world.debug('unlock','silent-tower');await f.world.enter('silent-tower');
  const gear=f.read('Equipment.state.equipment'),xp=f.store.state.totalXP,crowns=f.store.state.crowns;
  const result=await ok(f.fight('silence-keeper'));assert.equal(result.receipt.outcome,'defeat');
  assert.equal(f.store.state.totalXP,xp);assert.equal(f.store.state.crowns,crowns);assert.equal(f.store.state.frontier.location,'veyra');
  assert.deepEqual(f.read('Equipment.state.equipment'),gear);assert.deepEqual(result.receipt.drops,[]);
 });
 await check('travel/interaction blocked during encounter; abandon persists with zero reward',async()=>{
  const f=fixture();f.kit();await f.world.enter('broken-path');await f.world.startEncounter('vesper-raider');
  assert.equal((await f.world.enter('veyra')).ok,false);assert.equal((await f.world.explore('lost-cart')).ok,false);
  assert.equal((await f.world.startEncounter('vesper-raider')).ok,false);await ok(f.world.abandonEncounter());
  assert.equal(f.store.state.totalXP,0);assert.equal(f.store.state.frontier.activeEncounter,null);
 });
 await check('quest personal preparation survives acceptance/reload/class change; foreign item remains owned but unusable',async()=>{
  const f=fixture({testMode:true});f.kit('warden');await f.level(8);
  for(const id of ['mq01','mq02','mq03','mq04','mq05']) {await f.world.enter(Quests.get(id).location);await f.quests.accept(id);await f.quests.debug(id,'complete');await claim(f,id);}
  await f.world.enter('veyra');await f.quests.accept('mq06');
  const restored=fixture({memory:f.memory,testMode:true});restored.classes.selectClass('hunter');await restored.quests.debug('mq06','complete');
  const receipt=await claim(restored,'mq06');assert.equal(receipt.loot[0].itemId,'silence-plate');
  assert.equal(!!restored.equipment.canEquip('silence-plate','torso'),true);
  assert.ok(restored.equipment.state.inventory.some(i=>i.id==='silence-plate'));
 });
 await check('storage failure never applies quest/world rewards or consumes claim; retry safe',async()=>{
  const f=fixture({testMode:true});await f.quests.accept('mq01');await f.quests.debug('mq01','complete');
  const failed=fixture({memory:f.memory,testMode:true,denyWrite:true});assert.equal((await failed.quests.claim('mq01')).ok,false);
  assert.equal(failed.store.state.totalXP,0);assert.equal(status(failed,'mq01'),'completed');await claim(f,'mq01');
  f.kit();await f.world.enter('broken-path');const start=await f.world.startEncounter('vesper-raider');
  const blocked=fixture({memory:f.memory,denyWrite:true});assert.equal((await blocked.world.finishEncounter(start.ticket.id)).ok,false);
  assert.ok(blocked.store.state.frontier.activeEncounter);await ok(f.world.finishEncounter(start.ticket.id));
 });
 await check('simultaneous quest/world claims commit only once',async()=>{
  const f=fixture({testMode:true});f.kit();await f.quests.accept('mq01');await f.quests.debug('mq01','complete');
  const results=await Promise.all([f.quests.claim('mq01'),f.quests.claim('mq01')]);assert.equal(results.filter(r=>r.ok).length,1);
  assert.equal(f.store.state.totalXP,40);await f.world.enter('broken-path');const ticket=(await f.world.startEncounter('vesper-raider')).ticket;
  await Promise.all([f.world.finishEncounter(ticket.id),f.world.finishEncounter(ticket.id)]);assert.equal(f.store.state.totalXP,56);
 });
 await check('DEBUG commands unavailable normally; reset never permits repeated payment; future save versions protected',async()=>{
  const f=fixture();assert.equal((await f.quests.debug('mq01','complete')).ok,false);assert.equal((await f.world.debug('unlock','silent-tower')).ok,false);
  const debug=fixture({memory:f.memory,testMode:true});await debug.quests.accept('mq01');await debug.quests.debug('mq01','complete');await claim(debug,'mq01');
  assert.equal((await debug.quests.debug('mq01','reset')).ok,false);
  const raw=JSON.parse(debug.memory.get(Storage.KEY));raw.frontier.questVersion=99;debug.memory.set(Storage.KEY,JSON.stringify(raw));
  const future=fixture({memory:debug.memory});assert.equal((await future.world.enter('veyra')).ok,false);
  assert.equal(JSON.parse(debug.memory.get(Storage.KEY)).frontier.questVersion,99);
 });
 await check('quest multi-level/cap uses shared M5 formula; class growth and HP remain derived',async()=>{
  const f=fixture({testMode:true});f.kit('hunter');await f.level(20);await f.quests.accept('mq01');await f.quests.debug('mq01','complete');
  const before=f.store.state.totalXP;await claim(f,'mq01');assert.equal(f.store.state.level,20);assert.equal(f.store.state.totalXP,before+40);
  assert.equal(f.store.state.overflowXP,40);
  const g=fixture({testMode:true});g.kit('warden');
  for(const id of ['mq01','mq02','mq03','mq04','mq05']) {await g.world.enter(Quests.get(id).location);await g.level(8);await g.quests.accept(id);await g.quests.debug(id,'complete');await claim(g,id);}
  await g.world.enter('veyra');await g.quests.accept('mq06');await g.quests.debug('mq06','complete');
  await g.level(1);const receipt=await claim(g,'mq06');assert.deepEqual(receipt.levelUps,[2,3,4]);
  assert.deepEqual(receipt.statGains,{force:6,vigor:9,spirit:3});
 });
 console.log(`${checks} M6 world/quest integration checks passed.`);
})().catch(error=>{console.error(error);process.exit(1)});
