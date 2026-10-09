const assert = require('node:assert/strict');
const fixture = require('./world-fixture.cjs');
const Storage = require('../progression-store.js');
const World = require('../world-system.js');
const Clock = require('../activity-clock.js');
let checks = 0;
async function check(name, run) { await run(); checks++; console.log('PASS '+name); }
async function start(options) {
  const f = fixture(options); f.kit('warden');
  assert.ok((await f.world.enter('broken-path')).ok);
  const result = await f.world.startEncounter('vesper-raider', {seed:7});
  assert.ok(result.ok); return {f, ticket:result.ticket};
}
(async()=>{
  for (const kind of ['open','background','terminated']) await check('World deterministic completion: '+kind, async()=>{
    const {f,ticket} = await start();
    const expected = World.simulate(ticket).result;
    const equipment = f.read('Equipment.state');
    f.clock.value += 200000;
    const run = kind === 'terminated' ? fixture({memory:f.memory,clock:f.clock}) : f;
    const before = run.store.state.totalXP;
    assert.ok((await run.world.refresh()).ok);
    assert.equal(run.store.state.frontier.activeEncounter,null);
    assert.deepEqual(run.store.state.frontier.lastEncounter.result,expected);
    const paid = run.store.state;
    assert.equal(paid.totalXP-before,expected.outcome==='victory'?ticket.template.rewards.xp:0);
    for(let i=0;i<3;i++) {
      const reopen=fixture({memory:f.memory,clock:f.clock});
      await reopen.world.refresh(); await reopen.world.finishEncounter(ticket.id);
      assert.deepEqual(reopen.store.state,paid);
    }
    assert.deepEqual(f.read('Equipment.state').equipment,equipment.equipment,'Never auto-equip');
  });
  await check('reopen before completion, partial deterministic replay and manual pause across restart',async()=>{
    const {f,ticket}=await start(); f.clock.value+=500;
    let reopened=fixture({memory:f.memory,clock:f.clock});
    assert.ok((await reopened.world.refresh()).unchanged);
    assert.equal(reopened.world.elapsed(),0.5);
    await reopened.world.pauseEncounter(ticket.id);
    const paused=reopened.store.state.frontier.activeEncounter.clock;
    assert.equal(paused.running,false);assert.equal(paused.elapsedMs,500);
    f.clock.value+=1000000;
    reopened=fixture({memory:f.memory,clock:f.clock}); await reopened.world.refresh();
    assert.equal(reopened.world.elapsed(),0.5);assert.equal(reopened.store.state.frontier.lastEncounter,null);
    await reopened.world.resumeEncounter(ticket.id,2);await reopened.world.resumeEncounter(ticket.id,2);
    assert.equal(reopened.world.elapsed(),0.5);
    f.clock.value+=1000;assert.equal(reopened.world.elapsed(),2.5);
    await reopened.world.resumeEncounter(ticket.id,4);
    f.clock.value+=500;assert.equal(reopened.world.elapsed(),4.5);
  });
  await check('legacy encounter keeps preparation/progress and requires explicit resume',async()=>{
    const {f,ticket}=await start();
    let raw=JSON.parse(f.memory.get(Storage.KEY));delete raw.frontier.activeEncounter.clock;
    raw.crowns=123;raw.materials.iron=7;f.memory.set(Storage.KEY,JSON.stringify(raw));
    f.clock.value+=10000000;
    const old=fixture({memory:f.memory,clock:f.clock});await old.world.refresh();
    assert.deepEqual(old.store.state.frontier.activeEncounter.snapshot,ticket.snapshot);
    assert.equal(old.store.state.crowns,123);assert.equal(old.store.state.materials.iron,7);
    assert.equal(old.world.elapsed(),0);assert.ok(old.store.state.frontier.activeEncounter);
    await old.world.resumeEncounter(ticket.id,1);f.clock.value+=200000;await old.world.refresh();
    assert.equal(old.store.state.frontier.activeEncounter,null);
  });
  await check('invalid/future clock metadata, invalid wall time, backwards clock and capped replay',async()=>{
    const base=Clock.create(1000,4);assert.equal(Clock.elapsed(base,1e15),180000);
    assert.equal(Clock.elapsed(base,500),0);assert.equal(Clock.elapsed(base,NaN),0);
    assert.equal(Clock.create(Infinity),null);assert.equal(Clock.create(-1),null);
    for(const field of [{elapsedMs:-1},{elapsedMs:Infinity},{anchorAt:-1},{speed:999},{running:'yes'}])
      assert.equal(Clock.normalize({...base,...field}),null);
    const paused=Clock.transition(base,500,false);const resumed=Clock.transition(paused,600,true);
    assert.equal(resumed.anchorAt,1000);assert.equal(Clock.elapsed(resumed,1000),0);
    const {f,ticket}=await start();
    let raw=JSON.parse(f.memory.get(Storage.KEY));raw.frontier.activeEncounter.clock.speed=999;
    f.memory.set(Storage.KEY,JSON.stringify(raw));const corrupt=fixture({memory:f.memory,clock:f.clock});
    await corrupt.world.refresh();assert.ok(corrupt.store.state.frontier.activeEncounter);assert.equal(corrupt.world.elapsed(),0);
    raw.frontier.activeEncounter.clock.version=2;f.memory.set(Storage.KEY,JSON.stringify(raw));
    const future=fixture({memory:f.memory,clock:f.clock});
    assert.equal((await future.world.resumeEncounter(ticket.id)).ok,false);
    assert.equal(f.memory.get(Storage.KEY),JSON.stringify(raw),'Unknown clock versions are not overwritten');
  });
  await check('failed persistence never pays/completes or loses the active ticket; retry pays once',async()=>{
    const {f,ticket}=await start();f.clock.value+=200000;
    const denied=fixture({memory:f.memory,clock:f.clock,denyWrite:true});
    const before=denied.store.state;
    assert.equal((await denied.world.refresh()).ok,false);assert.deepEqual(denied.store.state,before);
    assert.equal((await denied.world.pauseEncounter(ticket.id)).ok,false);
    const retry=fixture({memory:f.memory,clock:f.clock});await retry.world.refresh();
    const paid=retry.store.state;await Promise.all([retry.world.refresh(),retry.world.refresh()]);assert.deepEqual(retry.store.state,paid);
  });
  for(const cls of ['warden','hunter']) for(const mode of ['auto','custom'])
    await check(cls+' / '+mode+': existing saved rules determine the offline outcome',async()=>{
      const f=fixture();f.kit(cls);
      if(mode==='custom') f.setSettings({mode:'custom',rules:[...f.classes.combatProfile().defaultRules].reverse()});
      await f.world.enter('broken-path');
      const {ticket}=await f.world.startEncounter('vesper-raider',{seed:31});
      const expected=World.simulate(ticket).result;
      f.classes.selectClass(cls==='warden'?'hunter':'warden');
      f.clock.value+=200000;
      const reopen=fixture({memory:f.memory,clock:f.clock});await reopen.world.refresh();
      assert.deepEqual(reopen.store.state.frontier.lastEncounter.result,expected);
      assert.equal(reopen.store.state.frontier.lastEncounter.className,ticket.snapshot.profile.className);
    });
  await check('completion at the same time as pause settles once; early pause defeats repeated refresh',async()=>{
    const {f,ticket}=await start();f.clock.value+=200000;
    await Promise.all([f.world.pauseEncounter(ticket.id),f.world.refresh(),f.world.refresh()]);
    assert.equal(f.store.state.frontier.activeEncounter,null);const paid=f.store.state;
    await f.world.refresh();assert.deepEqual(f.store.state,paid);
    const next=await f.world.startEncounter('vesper-raider',{seed:7});
    f.clock.value+=100;
    await Promise.all([f.world.pauseEncounter(next.ticket.id),f.world.refresh()]);
    f.clock.value+=200000;await f.world.refresh();
    assert.equal(f.store.state.frontier.activeEncounter.clock.running,false);
    assert.equal((await f.world.finishEncounter(next.ticket.id,{respectPause:true})).ok,false,'A stale UI callback cannot override a persisted pause');
    assert.equal(f.store.state.frontier.lastEncounter.id,ticket.id);
  });
  for(const kind of ['open','background','terminated']) await check('existing Expedition absolute deadline and once-only claim: '+kind,async()=>{
    const f=fixture();f.kit('hunter');await f.system.start('patrol',{seed:7});
    const active=f.store.state.activeExpedition;
    f.clock.value=active.endsAt-1;
    let run=fixture({memory:f.memory,clock:f.clock});await run.system.refresh();assert.ok(run.store.state.activeExpedition);
    f.clock.value=active.endsAt;
    run=kind==='terminated'?fixture({memory:f.memory,clock:f.clock}):run;
    await Promise.all([run.system.refresh(),run.system.refresh()]);
    const report=run.store.state.pendingExpeditionResult;assert.ok(report);assert.equal(report.id,active.id);
    const before=run.store.state.totalXP;
    assert.ok((await run.system.claim(report.id)).ok);assert.equal(run.store.state.totalXP-before,report.rewards.xp);
    const paid=run.store.state;
    const reopened=fixture({memory:f.memory,clock:f.clock});await reopened.system.refresh();
    assert.equal((await reopened.system.claim(report.id)).ok,false);assert.deepEqual(reopened.store.state,paid);
  });
  await check('Expedition invalid local time and future/corrupt timestamps cannot auto-complete',async()=>{
    const f=fixture();f.kit();f.clock.value=NaN;
    assert.equal((await f.system.start('patrol')).ok,false);
    f.clock.value=100000;await f.system.start('patrol');f.clock.value=Infinity;
    assert.equal((await f.system.refresh()).ok,false);assert.ok(f.store.state.activeExpedition);
    f.clock.value=0;assert.ok((await f.system.refresh()).unchanged);
    const raw=JSON.parse(f.memory.get(Storage.KEY));raw.activeExpedition.startedAt=1e16;raw.activeExpedition.endsAt=1e16+raw.activeExpedition.activity.durationMs;
    assert.equal(Storage.normalize(raw).activeExpedition,null);
  });
  console.log(checks+' offline progression checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
