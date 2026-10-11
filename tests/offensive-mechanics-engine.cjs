const assert = require('node:assert/strict');
const Engine = require('../combat-engine');
const Data = require('../combat-data');
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function options() {
  return {stats:{force:20,agility:0,vigor:30,spirit:5,armor:20,critical:10,speed:0},seed:17,
    profile:{abilities:[{id:'test-hit',kind:'attack',coefficient:1,flatDamage:0,cooldown:0,tags:[],resourceGain:2,resourceGainOnHit:7}],
      defaultRules:[{abilityId:'test-hit',condition:{type:'always'}}],
      resource:{initial:10,max:100,regeneration:0,decay:0,events:{}},
      modifiers:{},abilityModifiers:{},effectModifiers:{},kitValid:true,
      effects:{
        shred:{id:'shred',duration:2,maxStacks:1,modifiers:{armorReduction:0.5}},
        rage:{id:'rage',duration:2,maxStacks:1,modifiers:{outgoingDamageBonus:0.5}},
        extra:{id:'extra',duration:3,maxStacks:10,modifiers:{outgoingDamageBonus:0.8,armorReduction:0.8}}
      }}};
}
const create = () => Engine.create(options());
const origin = {actorId:'player',abilityId:'test-hit'};
const apply = (e, actor, id) => e.applyEffect(actor,id,origin);
function hit(e) { e.playerAction(e.abilities[0]); return e.log.findLast(x=>x.type==='playerAction').damage; }
check('legacy gain before hit; opt-in gain only after actual damage', () => {
  const e=create(); let atDamage;
  const emit=e.emit.bind(e); e.emit=event=>{if(event.type==='playerAction')atDamage=e.player.resource.current;emit(event);};
  hit(e); assert.equal(atDamage,12);assert.equal(e.player.resource.current,19);
  const old=create();delete old.abilities[0].resourceGainOnHit;hit(old);assert.equal(old.player.resource.current,12);
});
check('zero actual damage, no on-hit gain; legacy minimum damage preserved', () => {
  const e=create();e.enemy.hp=0;assert.equal(hit(e),0);assert.equal(e.player.resource.current,12);
  const floor=create();floor.abilities[0].coefficient=0;assert.equal(hit(floor),1);assert.equal(floor.player.resource.current,19);
  const kill=create();kill.enemy.hp=1;hit(kill);assert.equal(kill.player.resource.current,19);
});
check('resource cap and invalid opt-in values', () => {
  const e=create();e.player.resource.current=99;hit(e);assert.equal(e.player.resource.current,100);
  for(const value of [NaN,Infinity,-5,'7',0]) {const e=create();e.abilities[0].resourceGainOnHit=value;hit(e);assert.equal(e.player.resource.current,12);}
  const buff=create();buff.abilities[0].kind='buff';buff.abilities[0].effectId='rage';buff.playerAction(buff.abilities[0]);assert.equal(buff.player.resource.current,12);
});
check('armor reduction, expiry, direct damage, immutable base armor', () => {
  const normal=create(), reduced=create();const armor=reduced.enemy.armor;
  apply(reduced,reduced.enemy,'shred');assert.equal(reduced.effectiveEnemyArmor(),armor/2);
  assert(hit(reduced)>hit(normal));assert.equal(reduced.enemy.armor,armor);
  reduced.time=2;assert.equal(reduced.effectiveEnemyArmor(),armor);reduced.tickEffects(reduced.enemy);assert.equal(reduced.enemy.effects.length,0);
});
check('offensive buff, critical/mitigation composition, no retroactive damage', () => {
  for(const rng of [()=>0,()=>1]) {
    const normal=create(),buff=create();normal.random=rng;buff.random=rng;
    apply(buff,buff.player,'rage');const before=JSON.stringify(buff.log);
    const expected=Math.round(Data.formulas.mitigated(buff.baseDamage(buff.player.stats)*1.5*(rng()===0?Data.formulas.criticalMultiplier:1),buff.enemy.armor));
    assert.equal(hit(buff),expected);assert(hit(normal)<expected);
    const historical=JSON.stringify(buff.log.filter(x=>x.type==='playerAction'));buff.time=2;
    assert.equal(buff.outgoingDamageMultiplier(),1);assert.equal(JSON.stringify(buff.log.filter(x=>x.type==='playerAction')),historical);assert(before);
  }
});
check('refresh and overlap capped independently, exact expiry boundary', () => {
  const e=create();apply(e,e.player,'rage');e.time=1;apply(e,e.player,'rage');
  assert.equal(e.player.effects[0].stacks,1);assert.equal(e.player.effects[0].expiresAt,3);
  apply(e,e.player,'extra');for(let i=0;i<20;i++)apply(e,e.player,'extra');assert.equal(e.outgoingDamageMultiplier(),2);
  apply(e,e.enemy,'shred');apply(e,e.enemy,'extra');assert.equal(e.effectiveEnemyArmor(),0);assert.equal(e.enemy.armor,Data.enemies.guardian.armor);
  e.time=4;assert.equal(e.outgoingDamageMultiplier(),1);assert.equal(e.effectiveEnemyArmor(),e.enemy.armor);
});
check('DoT uses effective armor; offensive buff scoped to direct attacks', () => {
  const normal=create(), reduced=create();
  for(const e of [normal,reduced]){e.enemy.effects.push({id:'test-dot',origin,stacks:1,tickDamage:20,tickInterval:1,nextTickAt:1,expiresAt:3});e.time=1;}
  apply(reduced,reduced.enemy,'shred');apply(reduced,reduced.player,'rage');
  normal.tickEffects(normal.enemy);reduced.tickEffects(reduced.enemy);assert(reduced.metrics.damage>normal.metrics.damage);
});
check('frozen activity preparation, JSON reload and seeded replay identical', () => {
  const saved=options();saved.profile.abilities[0].effectId='shred';
  saved.profile.abilities.unshift({id:'test-buff',kind:'buff',effectId:'rage',cost:0,cooldown:4,tags:[]});
  saved.profile.defaultRules.unshift({abilityId:'test-buff',condition:{type:'buffAbsent',effectId:'rage'}});
  const persisted=JSON.stringify(saved);const opened=Engine.create(saved);saved.profile.effects.shred.modifiers.armorReduction=1;
  opened.start();opened.advance(1);opened.pause();const paused=opened.snapshot();opened.advance(10);assert.deepEqual(opened.snapshot(),paused);opened.resume();opened.advance(2);
  const reopened=Engine.create(JSON.parse(persisted));reopened.start();reopened.advance(3);assert.deepEqual(reopened.snapshot(),opened.snapshot());
  const repeat=Engine.create(JSON.parse(persisted));repeat.start();repeat.advance(1);repeat.advance(2);assert.deepEqual(repeat.snapshot(),reopened.snapshot());
});
console.log(`${checks} offensive mechanics checks passed`);
