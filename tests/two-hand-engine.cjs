const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const C = require('../classes-data'), G = require('../equipment-data');
const P = require('../personal-loot'), X = require('../expedition-data'), Q = require('../quest-data');
const worldFixture = require('./world-fixture.cjs'), classFixture = require('./two-hand-fixture.cjs');
const families = ['greatsword','spear','greataxe','warhammer'];
const req = {weaponTypes:families, handedness:'2H', supportTypes:[], supportPolicy:'forbidden'};
const profile = {classId:'warden', armorProficiency:'plate', ...req, requirements:req};
(async () => {
  const newIds=new Set(['greataxe','warhammer',...['frontier','vigil','stellar'].flatMap(prefix=>families.map(family=>`${prefix}-${family}`))]);
  assert.equal(new Set(G.items.map(item=>item.id)).size,G.items.length);
  const legacyItems=G.items.filter(item=>!newIds.has(item.id));
  assert.equal(legacyItems.length,69);
  // Original full catalogue at 9ec9d4b, including stats and appearance metadata.
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(legacyItems)).digest('hex'),
    '835fd95b93544d5dde06493b00f88482bb289588e664ae719cba9dff7240a78a');
  const policy = P.preparation(profile);
  assert.equal(policy.supportPolicy, 'forbidden');
  for (const family of families) {
    const item = G.items.find(i => i.id === family);
    assert.equal(item.handedness, '2H');
    assert(C.validKit(item, null, req));
    assert(!C.validKit(item, G.items.find(i=>i.id==='shield'), req));
    assert(!C.validKit({...item, slot:'support'},null,req));
    const single = P.preparation({...profile, weaponTypes:[family]});
    for (const activity of X.activities) {
      const loot = P.create(activity, {...profile, weaponTypes:[family]});
      assert.equal(loot.lootIds.length, activity.lootTable.length);
      assert.equal(new Set(loot.lootIds).size,loot.lootIds.length);
      assert(loot.lootIds.every(id=>P.compatible(G.items.find(i=>i.id===id), single)));
      assert.deepEqual(P.forActive({activity, snapshot:{profile}, lootPolicy:loot}),loot);
    }
    for (const quest of Q.quests) for (const source of quest.rewards.personalLoot || []) {
      const id=P.counterpart(source,single); assert(id, `${quest.id}/${family}`);
      assert(P.compatible(G.items.find(i=>i.id===id),single));
    }
  }
  assert.throws(()=>P.preparation({...profile,requirements:{supportPolicy:'invalid'}}));
  assert(!P.compatible(G.items.find(i=>i.id==='shield'),policy));
  const one = G.items.find(i=>i.id==='sword'), shield=G.items.find(i=>i.id==='shield');
  const optional={weaponTypes:['sword'],handedness:'1H',supportTypes:['shield'],supportPolicy:'optional'};
  assert(C.validKit(one,null,optional)); assert(C.validKit(one,shield,optional));
  assert(!C.validKit(one,G.items.find(i=>i.id==='quiver'),optional));
  const optionalTwo={...req,supportPolicy:'optional',supportTypes:['shield']};
  assert(C.validKit(G.items.find(i=>i.id==='greatsword'),null,optionalTwo));
  assert(!C.supportCompatible(shield,optionalTwo));
  assert(!C.validKit(G.items.find(i=>i.id==='greatsword'),shield,optionalTwo));
  const required={...optional,supportPolicy:'required'};
  assert(!C.validKit(one,null,required)); assert(C.validKit(one,shield,required));
  console.log('PASS four 2H families, slot guards, all personal/narrative tables nonempty, three support policies');

  let f=worldFixture({testMode:true,classFixture}); f.kit('warden');
  const raw=f.equipment.state;
  for(const id of ['greataxe','warhammer'])raw.inventory.push(G.items.find(i=>i.id===id));
  f.memory.set(f.equipment.SAVE_KEY,JSON.stringify(raw));
  f=worldFixture({testMode:true,classFixture,memory:f.memory,clock:f.clock});
  await f.level(8);
  const equipment=JSON.stringify(f.equipment.state);
  assert(f.classes.selectSpecialization('fixture-2h'));
  assert.equal(JSON.stringify(f.equipment.state),equipment);
  assert(!f.system.snapshot().profile.kitValid);
  assert(!(await f.system.start('patrol')).ok);
  assert(f.equipment.canEquip('sword','mainHand'));
  for(const id of families){
    assert(f.equipment.equip(id,'mainHand').ok);
    assert.equal(f.equipment.equipped('support'),null);
    assert(f.equipment.state.inventory.some(i=>i.id==='shield'));
    assert(f.equipment.canEquip('shield','support'));
    assert(f.system.snapshot().profile.kitValid);
    assert(f.run(`BuildSystem.compatible(GearData.items.find(i=>i.id==='${id}'),'warden','fixture-2h')`));
    assert(!f.run("BuildSystem.compatible(GearData.items.find(i=>i.id==='shield'),'warden','fixture-2h')"));
  }
  const saved=f.equipment.state;
  const reopened=worldFixture({testMode:true,classFixture,memory:f.memory,clock:f.clock});
  assert.equal(reopened.classes.build().id,'fixture-2h');
  assert.equal(JSON.stringify(reopened.equipment.state),JSON.stringify(saved));
  assert(reopened.system.snapshot().profile.kitValid);
  assert((await reopened.world.enter('broken-path')).ok);
  const encounter=await reopened.world.startEncounter('vesper-raider',{seed:7}); assert(encounter.ok);
  const ticket=reopened.store.state.frontier.activeEncounter;
  const beforeWorld=JSON.stringify(reopened.equipment.state);
  assert(reopened.classes.selectBuild('bulwark'));
  assert.equal(JSON.stringify(reopened.equipment.state),beforeWorld);
  assert.deepEqual(reopened.store.state.frontier.activeEncounter,ticket);
  const resumed=worldFixture({testMode:true,classFixture,memory:f.memory,clock:f.clock});
  assert.deepEqual(resumed.store.state.frontier.activeEncounter,ticket);
  const ended=await resumed.world.finishEncounter(ticket.id); assert(ended.ok);
  assert.equal(ended.receipt.result.buildId,'fixture-2h');
  const worldXP=resumed.store.state.totalXP;
  assert((await resumed.world.finishEncounter(ticket.id)).unchanged);
  assert.equal(resumed.store.state.totalXP,worldXP);
  reopened.store.refresh();
  assert(reopened.classes.selectSpecialization('fixture-2h'));
  const start=await reopened.system.start('recon',{seed:7}); assert(start.ok);
  const activity=reopened.store.state.activeExpedition;
  const unchanged=JSON.stringify(reopened.equipment.state);
  assert(reopened.classes.selectBuild('bulwark'));
  assert.equal(JSON.stringify(reopened.equipment.state),unchanged);
  assert.deepEqual(reopened.store.state.activeExpedition,activity);
  const again=worldFixture({testMode:true,classFixture,memory:f.memory,clock:f.clock});
  assert.deepEqual(again.store.state.activeExpedition,activity);
  again.clock.value=activity.endsAt; assert((await again.system.refresh()).ok);
  const report=again.store.state.pendingExpeditionResult;
  assert.equal(report.buildName,'Kit 2H TEST');
  assert(report.rewards.lootIds.every(id=>P.compatible(G.items.find(i=>i.id===id),policy)));
  assert((await again.system.claim(report.id)).ok);
  const xp=again.store.state.totalXP,owned=[...again.store.state.ownedLootIds];
  assert(!(await again.system.claim(report.id)).ok);
  assert.equal(again.store.state.totalXP,xp); assert.deepEqual(again.store.state.ownedLootIds,owned);
  console.log('PASS explicit equip/shield ownership, Advisor/preparation agreement, selection no side effects, reload/frozen expedition/unique claim');

  const n=worldFixture({testMode:true,classFixture}); n.kit('warden'); await n.level(8);
  n.equipment.equip('greatsword','mainHand'); n.classes.selectSpecialization('fixture-2h');
  for(const id of ['mq01','mq02','mq03']){
    const q=Q.get(id); assert((await n.world.enter(q.location)).ok);
    assert((await n.quests.accept(id)).ok); assert((await n.quests.debug(id,'complete')).ok);
    assert((await n.quests.claim(id)).ok);
  }
  assert((await n.world.enter('elar-ruins')).ok); assert((await n.quests.accept('mq04')).ok);
  const accepted=n.store.state.frontier.quests.mq04.lootPolicy;
  assert.equal(accepted.supportPolicy,'forbidden');
  n.classes.selectBuild('bulwark'); assert((await n.quests.debug('mq04','complete')).ok);
  const result=await n.quests.claim('mq04'); assert(result.ok);
  const receipt=n.store.state.frontier.lastQuestClaim;
  assert.deepEqual(receipt.rewards.lootIds,['frontier-greatsword']);
  assert(n.equipment.state.inventory.some(i=>i.id==='frontier-greatsword'));
  const after=JSON.stringify(n.store.state); assert(!(await n.quests.claim('mq04')).ok);
  assert.equal(JSON.stringify(n.store.state),after);
  console.log('PASS narrative acceptance preparation frozen, 2H reward owned after build change, no second claim');
  for(const cls of ['warden','hunter']){
    const legacy=C.resolve(cls,C.classes[cls].defaultBuild);
    const p={classId:cls,armorProficiency:legacy.identity.armorProficiency,...legacy.specialization.requirements};
    const old=P.preparation(p); assert(!('supportPolicy' in old));
    assert.equal(P.counterpart('vesper-blade',old),cls==='warden'?'vesper-blade':'trail-bow');
    assert.equal(P.counterpart('lunar-bow',old),cls==='warden'?'vigil-blade':'lunar-bow');
    assert.equal(P.counterpart('ether-quiver',old),cls==='warden'?'ether-shield':'ether-quiver');
    const active={activity:X.activities[1],snapshot:{profile:p},lootPolicy:P.create(X.activities[1],p)};
    assert.deepEqual(P.forActive(active),active.lootPolicy);
  }
  assert.deepEqual(Object.values(C.specializations).filter(spec => spec.playable !== false).map(spec => spec.id).sort(),['avenger','bulwark','command','explorer','lacerator','predator','retaliation']);
  console.log('PASS old preparation shape and counterpart order unchanged, saved policies retained, six legacy production selections plus Vendicatore');
})().catch(e=>{console.error(e);process.exitCode=1;});
