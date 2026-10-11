const assert = require('node:assert/strict');
const E = require('../combat-engine'), D = require('../combat-data'), C = require('../classes-data');
const W = require('../world-data'), P = require('../personal-loot'), G = require('../equipment-data');
const fixture = require('./world-fixture.cjs');
const families = ['greatsword','spear','greataxe','warhammer'];
const spec = C.resolve('warden','avenger').specialization;
const profile = (()=>{const f=fixture();f.kit('warden');f.classes.selectSpecialization('avenger');f.equipment.equip('greatsword','mainHand');return f.system.snapshot().profile;})();
const stats = { force:40, agility:0, vigor:40, spirit:10, critical:0, speed:0, armor:30 };
const fight = (opts={}) => E.create({stats,profile,seed:7,...opts});
const skill = id => profile.abilities.find(a=>a.id==='avenger-'+id);
function act(e,id){e.player.cooldowns['avenger-'+id]=0;e.playerAction(e.abilities.find(a=>a.id==='avenger-'+id));}
(async()=>{
 assert.equal(spec.role,'DPS da mischia');assert.equal(profile.armorProficiency,'plate');assert.equal(profile.resource.initial,0);assert.equal(profile.resource.max,100);
 assert.equal(profile.resource.regeneration,0);assert.deepEqual(profile.resource.events,{});
 for(const key of ['hpMultiplier','armorMultiplier','blockChance','mitigation','damageMultiplier'])assert.equal(profile.modifiers[key],undefined);
 assert.equal(profile.abilities.length,5);assert.equal(spec.legacyBuildId,undefined);
 console.log('PASS independent melee DPS, Plate, zero initial/passive/incoming resolve, no tank modifiers');
 const gain=fight();gain.enemyAction();assert.equal(gain.player.resource.current,0);act(gain,'slash');assert.equal(gain.player.resource.current,10);
 gain.player.resource.current=98;act(gain,'slash');assert.equal(gain.player.resource.current,100);
 for(const [id,cost,coefficient,flat,cooldown] of [['assault',15,1.5,10,5],['shatter',20,1,8,8],['execution',35,1.3,12,7]]){
  const e=fight();e.random=()=>1;e.player.resource.current=100;act(e,id);assert.equal(e.player.resource.current,100-cost);
  assert.equal(e.metrics.damage,Math.round(D.formulas.mitigated(e.baseDamage(stats)*coefficient+flat,e.enemy.armor)));
  assert.equal(e.player.cooldowns[skill(id).id],cooldown);const before=e.snapshot();assert.equal(e.playerAction(skill(id)),false);assert.deepEqual(e.snapshot(),before);
 }
 const poor=fight();assert.equal(poor.playerAction(skill('assault')),false);assert.equal(poor.metrics.damage,0);
 console.log('PASS Fendente hit-only generation/cap, costs, coefficients, cooldowns and insufficient resource');
 const effect=fight();effect.player.resource.current=100;act(effect,'shatter');const armor=effect.enemy.armor;assert.equal(effect.effectiveEnemyArmor(),armor*0.85);
 act(effect,'wrath');assert.equal(effect.metrics.resourceUsed,45);assert.equal(effect.outgoingDamageMultiplier(),1.15);
 const damage=effect.metrics.damage;assert.equal(effect.enemy.lastAbility,null);assert.equal(effect.player.cooldowns['avenger-wrath'],18);
 effect.time=1;act(effect,'wrath');assert.equal(effect.player.effects.length,1);assert.equal(effect.player.effects[0].stacks,1);assert.equal(effect.player.effects[0].expiresAt,7);assert.equal(effect.metrics.damage,damage);
 effect.time=6;assert.equal(effect.effectiveEnemyArmor(),armor);effect.time=7;assert.equal(effect.outgoingDamageMultiplier(),1);assert.equal(effect.enemy.armor,armor);
 for(const ratio of [0.26,0.25,0.24]){const e=fight();e.enemy.maxHp=100000;e.enemy.hp=100000*ratio;e.player.resource.current=100;e.random=()=>1;act(e,'execution');assert.equal(e.metrics.damage,Math.round(D.formulas.mitigated((e.baseDamage(stats)*1.3+12)*(ratio<0.25?1.75:1),e.enemy.armor)));}
 console.log('PASS 15% buff/debuff, refresh/expiry, no activation hit, execution strictly below 25%');
 const healthy=fight();healthy.player.resource.current=25;assert.equal(healthy.chooseAbility().id,'avenger-wrath');
 healthy.enemy.hp=healthy.enemy.maxHp*0.2;assert.equal(healthy.chooseAbility().id,'avenger-slash');healthy.player.resource.current=35;assert.equal(healthy.chooseAbility().id,'avenger-execution');
 const sustained=fight({enemyTemplate:{...W.enemy('silence-keeper'),maxHp:100000,baseDamage:0}});sustained.player.maxHp=sustained.player.hp=100000;sustained.start();sustained.advance(90);
 for(const id of ['slash','wrath','shatter','assault'])assert(sustained.metrics.uses['avenger-'+id]>0,id);
 assert(sustained.metrics.uses['avenger-slash']>sustained.metrics.uses['avenger-assault']);
 assert(sustained.log.filter(x=>x.effectId==='avenger-wrath'&&x.type==='effectApply').length>0);
 console.log('PASS AUTO affordability fallback, buff/debuff funded, low-HP execution priority, no spend starvation');
 const f=fixture();f.kit('warden');const gear=JSON.stringify(f.equipment.state);assert(f.classes.selectSpecialization('avenger'));assert.equal(JSON.stringify(f.equipment.state),gear);assert(!f.system.snapshot().profile.kitValid);
 assert((await f.world.enter('broken-path')).ok);const blocked=await f.world.startEncounter('vesper-raider');assert(!blocked.ok);assert.match(blocked.message,/kit/);
 await f.level(5);await f.store.transact(s=>{for(const family of families)s.ownedLootIds.push('frontier-'+family);return {ok:true};});
 for(const family of families){assert(f.equipment.equip('frontier-'+family,'mainHand').ok);const p=f.system.snapshot().profile;assert(p.kitValid);assert.equal(f.equipment.equipped('support'),null);assert(f.equipment.state.inventory.some(i=>i.id==='shield'));assert(f.run(`BuildSystem.compatible(GearData.items.find(i=>i.id==='frontier-${family}'),'warden','avenger')`));assert(!f.run("BuildSystem.compatible(GearData.items.find(i=>i.id==='shield'),'warden','avenger')"));assert(!C.validKit(f.equipment.equipped('mainHand'),G.items.find(i=>i.id==='shield'),spec.requirements));}
 const reload=fixture({memory:f.memory,clock:f.clock});assert.equal(reload.classes.build().id,'avenger');assert.equal(JSON.stringify(reload.equipment.state),JSON.stringify(f.equipment.state));
 console.log('PASS four 2H families, invalid shield kit, explicit equip/shield retained, Advisor consistency, selection/reload');
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};const prefs=D.preferenceStore(storage);
 const custom=D.normalizeSettings({mode:'custom',speed:4,rules:[{abilityId:'avenger-assault',enabled:false,condition:{type:'resourceAbove',threshold:999}},{abilityId:'bad',condition:{}},{abilityId:'avenger-slash',condition:{type:'garbage'}}]},profile);
 assert.equal(custom.rules.length,5);assert.equal(custom.rules[0].enabled,false);assert.equal(custom.rules[0].condition.threshold,100);assert.equal(custom.rules[1].condition.type,'always');assert(prefs.write('warden',spec,custom));
 const reread=D.preferenceStore(storage).read('warden',spec,profile);assert.deepEqual(reread,custom);assert.equal(prefs.read('warden',C.specializations.bulwark,C.specializations.bulwark).mode,'auto');
 const disabled=fight({rules:profile.defaultRules.map(r=>({...r,enabled:false}))});disabled.start();disabled.advance(2);assert.deepEqual(disabled.metrics.uses,{});
 const invalid=D.normalizeSettings({mode:'bad',speed:88,rules:[]},profile);assert.equal(invalid.mode,'auto');assert.equal(invalid.speed,1);assert.deepEqual(invalid.rules,profile.defaultRules);
 const legacy=fixture();legacy.kit('warden');const oldProfile=legacy.system.snapshot().profile;
 const baseline=E.create({...legacy.system.snapshot(),seed:7});const oldFlag=E.create({...legacy.system.snapshot(),seed:7,rules:oldProfile.defaultRules.map(r=>({...r,enabled:false}))});
 baseline.start();oldFlag.start();baseline.advance(3);oldFlag.advance(3);assert.deepEqual(oldFlag.snapshot(),baseline.snapshot());
 console.log('PASS shared CUSTOM editor normalization, disable/enable contract, isolated preferences/reload, invalid settings');
 await reload.world.enter('broken-path');const start=await reload.world.startEncounter('vesper-raider',{seed:7});assert(start.ok);const ticket=reload.store.state.frontier.activeEncounter;reload.classes.selectBuild('bulwark');assert.deepEqual(reload.store.state.frontier.activeEncounter,ticket);
 const again=fixture({memory:reload.memory,clock:reload.clock});const done=await again.world.finishEncounter(ticket.id);assert(done.ok);assert.equal(done.receipt.result.buildId,'avenger');const xp=again.store.state.totalXP;assert((await again.world.finishEncounter(ticket.id)).unchanged);assert.equal(again.store.state.totalXP,xp);
 again.classes.selectSpecialization('avenger');assert((await again.system.start('patrol',{seed:7})).ok);const active=again.store.state.activeExpedition;assert.equal(active.lootPolicy.supportPolicy,'forbidden');assert(active.lootPolicy.lootIds.every(id=>P.compatible(G.items.find(i=>i.id===id),active.lootPolicy)));
 again.classes.selectBuild('command');again.clock.value=active.endsAt;assert((await again.system.refresh()).ok);assert.equal(again.store.state.pendingExpeditionResult.buildName,'Vendicatore');
 console.log('PASS frozen World/Expedition preparation across selection/reload, Smart Loot and unique reward');
 // Prior history fixture only: no debug API, no 2H ownership, then real MQ04 encounters.
 let n=fixture();n.kit('warden');await n.level(5);await n.store.transact(s=>{for(const id of ['mq01','mq02','mq03'])s.frontier.quests[id].status='claimed';return {ok:true};});
 n.run("localStorage.setItem(Equipment.SAVE_KEY,JSON.stringify({...Equipment.state, inventory:Equipment.state.inventory.filter(i=>i.handedness!=='2H')}))");
 n=fixture({memory:n.memory,clock:n.clock});assert(!n.equipment.state.inventory.some(i=>i.handedness==='2H'));assert(n.classes.selectSpecialization('avenger'));assert((await n.world.enter('elar-ruins')).ok);assert((await n.quests.accept('mq04')).ok);
 n.classes.selectBuild('bulwark');n.equipment.equip('sword','mainHand');n.equipment.equip('shield','support');for(let i=0;i<3;i++){const result=await n.fight('elar-sentinel');assert.equal(result.receipt.result.outcome,'victory');}
 assert.equal(n.store.state.frontier.quests.mq04.status,'completed');const claim=await n.quests.claim('mq04');assert(claim.ok);assert.deepEqual(claim.receipt.rewards.lootIds,['frontier-greatsword']);assert(n.equipment.state.inventory.some(i=>i.id==='frontier-greatsword'));assert(!(await n.quests.claim('mq04')).ok);
 n.classes.selectSpecialization('avenger');assert(n.equipment.equip('frontier-greatsword','mainHand').ok);assert(n.system.snapshot().profile.kitValid);
 console.log('PASS narrative 2H acquisition without demo weapon/debug: accept MQ04 as Vendicatore, normal Baluardo encounters, frozen reward, explicit equip');
 for(const family of families){f.equipment.equip('frontier-'+family,'mainHand');for(const enemy of ['vesper-raider','corrupt-hound','elar-sentinel']){const e=E.create({...f.system.snapshot(),seed:7,enemyTemplate:W.enemy(enemy)});e.start();e.advance(180);assert.equal(e.result.outcome,'victory');console.log(`SMOKE ${family}/${enemy}: ${e.time.toFixed(1)}s, HP ${e.player.hp}/${e.player.maxHp}`);}}
 const initial=fixture();initial.kit('warden');initial.classes.selectSpecialization('avenger');initial.equipment.equip('greatsword','mainHand');
 for(const enemy of ['vesper-raider','corrupt-hound','elar-sentinel']){const e=E.create({...initial.system.snapshot(),seed:7,enemyTemplate:W.enemy(enemy)});e.start();e.advance(180);assert.equal(e.result.outcome,'victory');console.log(`SMOKE L1 greatsword/${enemy}: ${e.time.toFixed(2)}s, HP ${e.player.hp}/${e.player.maxHp}`);}
 console.log('PASS Vendicatore early-enemy deterministic smoke (level 1 initial kit / level 5 frontier gear, seed 7); not a narrative balance validation');
})().catch(e=>{console.error(e);process.exitCode=1;});
