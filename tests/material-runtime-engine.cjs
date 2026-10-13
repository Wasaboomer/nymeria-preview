const assert=require('node:assert/strict'),R=require('../material-bag-runtime');
const inactive=R.create();assert.equal(inactive.enforced,false);assert(Object.isFrozen(inactive));
for(const name of ['progression','profession','reward'])assert.equal(inactive[name]().ok,true);
for(const admission of [{},{profession:()=>{throw Error('denied')}},{profession:()=>Promise.reject(Error('async'))},{profession:()=>({})}])assert.equal(R.create({admission}).profession().ok,false);
let value=7;const admission={profession:x=>({ok:true,value:x+value})},r=R.create({admission});admission.profession=()=>({ok:true,value:999});assert.equal(r.profession(3).value,10);
const fs=require('node:fs'),html=fs.readFileSync('index.html','utf8');
for(const f of ['material-bag-contract','material-bag-store','material-capacity-admission','material-bag-runtime'])assert(html.indexOf(f+'.js')<html.indexOf('progression-store.js'));
assert.match(fs.readFileSync('material-bag-runtime.js','utf8'),/MaterialBagRuntimeFactory.create\(\) : null/);
console.log('PASS immutable runtime gates: inactive default, explicit dependency, missing/throwing/async checks denied, no mutable activation, load order');
