const assert=require('node:assert/strict'),B=require('../material-bag-contract'),A=require('../material-capacity-admission');
const entries=Array.from({length:60},(_,i)=>({owner:'profession',id:'test-'+i,key:'profession:test-'+i}));
const state=n=>({progression:{materials:{}},profession:{materials:Object.fromEntries(entries.slice(0,n).map(e=>[e.id,2]))}});
let cases=0;
for(const n of [39,40,41,55]){
 const ledgers=state(n),bytes=JSON.stringify(ledgers),plan=(operation,expansions=0)=>B.plan(ledgers,operation,{entries,expansions});
 for(const operation of [{consumes:[{key:'profession:test-0',quantity:1}]},{consumes:[{key:'profession:test-0',quantity:2}]},{produces:[{key:'profession:test-0',quantity:3}]}]){assert.equal(plan(operation).ok,true);assert(plan(operation).available>=0);cases++}
 assert.equal(plan({produces:[{key:'profession:test-'+n,quantity:1}]}).ok,n<40);cases++;
 const swap={consumes:[{key:'profession:test-0',quantity:2}],produces:[{key:'profession:test-'+n,quantity:1}]};assert.equal(plan(swap).ok,n<=40);cases++;
 const extra={consumes:[{key:'profession:test-0',quantity:1}],produces:[{key:'profession:test-'+n,quantity:1}]};assert.equal(plan(extra).ok,n<40);cases++;
 assert.equal(plan({produces:[{key:'profession:test-'+n,quantity:1}]},6).ok,true);cases++;
 assert.equal(JSON.stringify(ledgers),bytes);
}
// At 41 a recipe cannot introduce a new identity even after enough consumes to
// fall below capacity. A separate reduction enables a subsequent production.
const s=state(41);assert.equal(B.plan(s,{consumes:entries.slice(0,3).map(e=>({key:e.key,quantity:2})),produces:[{key:entries[41].key,quantity:1}]},{entries}).ok,false);
const reduced=state(39);assert.equal(B.plan(reduced,{produces:[{key:entries[41].key,quantity:1}]},{entries}).ok,true);
const ledgers=state(41);ledgers.progression.materials={iron:2};
const admission=A.createTestSession({purpose:'capacity-simulation',isCoordinated:()=>true,readMetadata:()=>({ok:true,state:{version:1,baseCapacity:40,expansionIds:[]}}),readers:{profession:()=>({ok:true,state:ledgers.profession})},entries:[...B.catalog,...entries]});
assert.equal(admission.reward(ledgers.progression,{produces:[{key:'progression:iron',quantity:2}]}).ok,true);
assert.equal(admission.reward(ledgers.progression,{produces:[{key:'progression:iron',quantity:2},{key:'progression:fiber',quantity:1}]}).code,'capacity-exceeded');
console.log(`PASS overcapacity: ${cases+4} scenarios, 39/40/41/55 types, consume/stacks/crafting/multiple products/rewards/100 slots, no data mutation`);
