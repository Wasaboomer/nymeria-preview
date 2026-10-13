const assert=require('node:assert/strict'),S=require('../save-record-safety'),P=require('../profession-system'),G=require('../progression-store');
const memory=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}};
(async()=>{
for(const [Engine,key,initial,invoke] of [[P,P.KEY,P.empty, e=>e.gather('vesper-iron-vein')],[G,G.KEY,G.initial,e=>e.transact(s=>{s.crowns++;return {ok:true}})]]){
 for(const raw of ['{bad','null','[]',JSON.stringify({...initial(),version:99}),JSON.stringify({...initial(),extension:{important:1}}),JSON.stringify({...initial(),materials:{unknown:9}})]){
  const m=memory();m.map.set(key,raw);const e=Engine.create({storage:m,context:()=>({accessible:true,location:'broken-path'})});
  assert.equal((await invoke(e)).ok,false);assert.equal(m.getItem(key),raw);
  const reopened=Engine.create({storage:m,context:()=>({accessible:true,location:'broken-path'})});assert.equal((await invoke(reopened)).ok,false);assert.equal(m.getItem(key),raw);
 }
 const m=memory(),e=Engine.create({storage:m,context:()=>({accessible:true,location:'broken-path'})});assert.equal((await invoke(e)).ok,true);
 const saved=m.getItem(key);m.setItem=()=>{throw Error('quota');};assert.equal((await invoke(e)).ok,false);assert.equal(m.getItem(key),saved);
 m.getItem=()=>{throw Error('denied');};assert.equal((await invoke(e)).ok,false);
}
const opts={versions:[1,2,undefined],normalize:P.normalize,quantityPaths:[['materials']]};
assert.equal(S.classify(null,opts).kind,'absent');assert.equal(S.classify('{',opts).kind,'corrupt');assert.equal(S.classify('{"version":9}',opts).kind,'unsupported');
assert.equal(S.classify('{"version":1,"materials":{"raw-iron":3},"professions":{"blacksmithing":{"level":2,"xp":4}}}',opts).kind,'valid');
assert.equal(S.classify('{"version":1,"materials":{"unknown":0}}',opts).kind,'unrecognized');
const m=memory();m.map.set(G.KEY,JSON.stringify({...G.initial(),materials:{iron:7}}));const g=G.create({storage:m});assert.equal(g.error,'');assert.equal(g.state.materials.iron,7);
assert.equal((await g.transact(s=>{s.crowns++;return {ok:true}})).ok,true);
g.subscribe(()=>{throw Error('feedback');});assert.equal((await g.transact(s=>{s.crowns++;return {ok:true}})).ok,true,'Feedback cannot hide successful commit');
const copy=JSON.stringify(g.state);m.map.set(G.KEY,JSON.stringify({...G.initial(),ownedLootIds:['unknown-item']}));assert.equal((await g.transact(()=>({ok:true}))).ok,false);assert.equal(JSON.stringify(g.state),copy);
const nested=G.initial();nested.lastCombatReward={id:'combat-1',enemyId:'ruin-warden',enemyLevel:1,difficulty:1,startedAt:1,rewards:{xp:1,crowns:1,materials:{unknown:1}},outcome:'victory',levelUps:[],resultingLevel:1};m.map.set(G.KEY,JSON.stringify(nested));assert.equal((await g.transact(()=>({ok:true}))).ok,false);assert.equal(m.getItem(G.KEY),JSON.stringify(nested));
console.log('PASS material safety: absence/valid/legacy/corrupt/future/unknown, original bytes, reload, denied/quota, partial defaults and post-commit feedback');
})().catch(e=>{console.error(e);process.exitCode=1});
