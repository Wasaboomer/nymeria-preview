const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const C = require('../classes-data'), D = require('../combat-data'), R = require('../elemental-resonance');
const fixtures = require('./fixtures/mage-selection-v2.json');
const key = 'nymeria.classes.v2';
function model(memory = new Map(), { denyRead = false, denyWrite = false, absent = false } = {}) {
  let writes = 0;
  const storage = { getItem(k) { if (denyRead) throw Error('denied'); return memory.get(k) ?? null; },
    setItem(k, v) { if (denyWrite) throw Error('quota'); writes++; memory.set(k, v); } };
  const context = vm.createContext(absent ? {} : { localStorage: storage });
  for (const name of ['combat-data','classes-data','armor-rules','build-system','class-system'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', name + '.js'), 'utf8'), context);
  return { memory, storage, run: s => vm.runInContext(s, context),
    read: s => JSON.parse(vm.runInContext('JSON.stringify(' + s + ')', context)), get writes() { return writes; } };
}
assert.equal(C.classes.mage.playable, false);
assert.equal(C.specializations.elementalist.playable, false);
assert.equal(C.resolve('mage','elementalist').specialization.requirements, null);
assert.equal(C.resolve('mage','elementalist').specialization.resource, null);
assert.deepEqual(C.resolve('mage','elementalist').specialization.abilities, []);
assert.equal(C.classes.mage.statGrowthPerLevel, null);
assert.throws(() => C.resolve('unknown','elementalist'), /Unknown class/);
assert.throws(() => C.resolve('constructor','elementalist'), /Unknown class/);
const fresh = model();
assert.deepEqual(fresh.read("ClassSystem.combatProfile('warden','avenger')"), fixtures.avengerProfile);
assert.equal(fresh.run("ClassSystem.selectClass('mage')"), false);
assert.equal(fresh.run("ClassSystem.selectSpecialization('elementalist')"), false);
assert.throws(() => fresh.run("ClassSystem.combatProfile('mage','elementalist')"), /not playable/);
assert.throws(() => fresh.run("BuildSystem.getBuild('unknown','elementalist')"), /Unknown class/);
assert.equal(fresh.run("BuildSystem.compatible({slot:'weapon',weaponType:'staff',handedness:'2H'},'mage','elementalist')"), false);
console.log('PASS registered non-playable Mage, no invented kit/resource/stats, selection and combat rejected');

for (const saved of [...fixtures.saves, { version:2, classId:'warden', builds:{ warden:'retaliation', hunter:'lacerator' }, marker:{ keep:'exact' } }]) {
  const original = JSON.stringify(saved), other = JSON.stringify({ mode:'custom', rules:[{ abilityId:'slash', condition:{type:'always'} }] });
  const memory = new Map([[key,original],['nymeria.combat.v3',other],['nymeria.progression.v1','opaque'],['nymeria.equipment.v2','opaque']]);
  const before = new Map(memory), m = model(memory), next = JSON.parse(memory.get(key));
  assert.equal(next.classId, saved.classId);
  assert.deepEqual(next.builds, {...saved.builds, mage:'elementalist'});
  assert.deepEqual(Object.keys(next).sort(), Object.keys(saved).sort());
  for (const field of Object.keys(saved)) if (field !== 'builds') assert.deepEqual(next[field], saved[field]);
  assert.equal(m.writes, 1);
  const after = memory.get(key), again = model(memory);
  assert.equal(again.writes, 0); assert.equal(memory.get(key), after);
  for (const [k,v] of before) if (k !== key) assert.equal(memory.get(k), v);
  const denyMemory = new Map([[key,original]]), denied = model(denyMemory,{denyWrite:true});
  assert.equal(denyMemory.get(key), original);
  assert.equal(denied.read('ClassSystem.state').classId, saved.classId);
  assert.equal(denied.read('ClassSystem.state').builds.mage, 'elementalist');
  assert(denied.run('ClassSystem.storageError'));
  assert.equal(denied.run("ClassSystem.selectClass('hunter')"), false);
}
for (const raw of ['broken', JSON.stringify({version:99,classId:'warden',builds:{warden:'command',hunter:'predator'}}),
  JSON.stringify({version:2,classId:'future',builds:{}}), JSON.stringify({version:2,classId:'mage',builds:{}}),
  JSON.stringify({version:2,classId:'warden',builds:{warden:'command'}}),
  JSON.stringify({version:2,classId:'hunter',builds:{hunter:'bad',warden:'bulwark'}}),
  JSON.stringify({version:2,classId:'hunter',builds:{hunter:'predator',warden:'bulwark',future:'unknown'}})]) {
  const memory = new Map([[key,raw]]), m = model(memory);
  assert(m.run('ClassSystem.storageError')); assert.equal(m.writes,0);
  assert.equal(m.run("ClassSystem.selectClass('warden')"),false); assert.equal(memory.get(key),raw);
}
for (const options of [{denyRead:true},{absent:true}]) assert(model(new Map(),options).run('ClassSystem.storageError'));
const unknownLegacy = new Map([['nymeria.classes.v1',JSON.stringify({classId:'future',builds:{}})]]);
assert(model(unknownLegacy).run('ClassSystem.storageError')); assert(!unknownLegacy.has(key));
// Read the older v2 class without ClassSystem initialization / migration first.
const saved = fixtures.saves.find(s => s.classId === 'warden');
const memory = new Map([[key,JSON.stringify(saved)]]);
const store = require('../progression-store').create({storage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}});
const events=[]; store.subscribeEvents(e => events.push(e));
console.log('PASS additive/idempotent actual v2 fixtures and partial saves; strategies/unrelated saves unchanged; denied/corrupt/future data protected');

function frozen(state) { Object.freeze(state.traces.map(Object.freeze)); Object.freeze(state.traces); return Object.freeze(state); }
for (let a=0; a<4; a++) for (let b=a+1; b<4; b++) {
  let s=R.apply(R.create(),R.elements[a],{now:0,duration:10});
  s=R.apply(s,R.elements[b],{now:0,duration:10}); const original=JSON.stringify(s);
  const result=R.consume(frozen(s),1);
  assert(result.ok); assert.deepEqual(result.pair.map(t=>t.element),[R.elements[a],R.elements[b]]);
  assert.equal(result.state.traces.length,0); assert.equal(JSON.stringify(s),original);
}
let s=R.create(); for(const element of ['air','earth','water','fire'])s=R.apply(s,element,{now:0,duration:10});
assert.deepEqual(R.select(s,1).map(t=>t.element),['fire','water']);
assert.deepEqual(R.select(JSON.parse(JSON.stringify(s)),1),R.select(s,1));
assert.deepEqual(R.consume(s,1).state.traces.map(t=>t.element),['air','earth']);
s=R.apply(s,'fire',{now:2,duration:20}); assert.equal(s.traces.length,4);
assert.equal(s.traces.find(t=>t.element==='fire').expiresAt,22);
assert.equal(s.traces.find(t=>t.element==='fire').order,5);
assert.deepEqual(R.select(s,3).map(t=>t.element),['water','earth']);
assert.equal(R.active(s,10).length,1); assert.equal(R.select(s,10),null);
const before=JSON.stringify(s), failed=R.consume(frozen(s),10);
assert.equal(failed.ok,false); assert.equal(JSON.stringify(s),before); assert.deepEqual(failed.state,s);
assert.equal(R.active(s,22).length,0);
let three=R.create();for(const [element,duration]of [['fire',9],['water',5],['air',7]])three=R.apply(three,element,{now:0,duration});
assert.deepEqual(R.select(three,0).map(t=>t.element),['water','air']);
for(const duration of [0,-1,NaN,Infinity])assert.throws(()=>R.apply(R.create(),'fire',{now:0,duration}));
assert.throws(()=>R.apply(R.create(),'unknown',{now:0,duration:1}));
assert.throws(()=>R.select({...R.create(),version:99},0));
assert.throws(()=>R.select(R.create(),NaN));
const duplicate={version:1,nextOrder:3,traces:[{element:'fire',expiresAt:10,order:1},{element:'fire',expiresAt:20,order:2}]};
assert.throws(()=>R.consume(duplicate,0));
assert.equal(Object.hasOwn(require('../classes-data').specializations.avenger,'resonance'),false);
console.log('PASS four traces, six pairs, immutable all-or-nothing consumption, refresh/order, exact expiry, configurable duration and invalid state protection');

(async()=>{
  const before = store.state.totalXP;
  await store.transact(state=>{state.totalXP=before+100;return {ok:true};});
  const level = events.find(e=>e.type==='levelUp');
  assert(level, 'level-up event generated with old v2 save');
  // See the central event payload: Warden gains must not silently use Hunter.
  assert.equal(level.payload.statGains.force, 2, 'old v2 retains Warden stat growth');
  console.log('PASS ProgressionStore reads pre-migration v2 class through shared normalization');
})().catch(e=>{console.error(e);process.exitCode=1;});
