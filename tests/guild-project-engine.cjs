const assert = require('node:assert/strict');
const E = require('../guild-project-system'), D = require('../guild-project-data');
const memory = () => { const map = new Map(); return {map, getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}; };
(async()=>{
 const store=memory(), s=E.create({storage:store,now:()=>123});
 for(const v of [0,-1,1.5,NaN,Infinity,10000,'no','1e2','',true,[],{},null]) assert.equal((await s.contribute(D.projects[0].id,'crowns',v)).ok,false);
 assert.equal(store.map.size,0);
 for(const p of D.projects){
  for(const [k,n] of Object.entries(p.requirements)) {
   const r=await s.contribute(p.id,k,9999); assert.equal(r.applied,n);
   assert.equal(r.completed,Object.keys(p.requirements).at(-1)===k);
   assert.equal((await s.contribute(p.id,k,1)).ok,false);
  }
  assert.equal(s.state.projects[p.id].completedAt,123);
 }
 assert.deepEqual(E.create({storage:store}).state,s.state);
 assert.equal(store.map.size,1);
 const snap=JSON.stringify(s.state); await s.contribute(D.projects[0].id,'crowns',1); assert.equal(JSON.stringify(s.state),snap);
 for(const raw of [null,[],{version:1,projects:null},{version:1,projects:[]},{version:1,projects:{'vesper-watchtower':{progress:{crowns:Infinity,iron:-3,fiber:NaN},completed:true,completedAt:-1}}}]) {
  const n=E.normalize(raw);assert.equal(n.projects['vesper-watchtower']?.completed||false,false);
 }
 const damaged=memory();damaged.setItem(E.KEY,'{bad');const recovered=E.create({storage:damaged});assert.deepEqual(recovered.state,E.empty());assert.equal((await recovered.contribute(D.projects[0].id,'crowns',1)).ok,true);
 damaged.setItem(E.KEY,JSON.stringify({version:99,projects:{}}));assert.equal((await recovered.contribute(D.projects[0].id,'crowns',1)).ok,false);assert.equal(JSON.parse(damaged.getItem(E.KEY)).version,99);
 for(const failing of [{getItem(){throw Error('read')},setItem(){throw Error('must not write')}},{getItem:()=>null,setItem(){throw Error('quota')}}]) {
  const t=E.create({storage:failing});assert.equal((await t.contribute(D.projects[0].id,'crowns',10)).ok,false);assert.deepEqual(t.state,E.empty());assert.equal(t.storageIssue,true);
 }
 const changing=memory(), t=E.create({storage:changing}); await t.contribute(D.projects[0].id,'crowns',10);const previous=t.state;changing.getItem=()=>{throw Error('read')};let wrote=false;changing.setItem=()=>wrote=true;assert.equal((await t.contribute(D.projects[0].id,'crowns',10)).ok,false);assert.equal(wrote,false);assert.deepEqual(t.state,previous);
 const parallel=E.create({storage:memory()});parallel.subscribe(()=>{throw Error('UI')}); const results=await Promise.all(Array.from({length:20},()=>parallel.contribute(D.projects[0].id,'crowns',10)));assert.equal(parallel.state.projects[D.projects[0].id].progress.crowns,120);assert.equal(results.filter(r=>r.ok).length,12);
 const blocked=E.create({storage:memory(),exclusive:()=>Promise.reject(Error('lock'))});assert.equal((await blocked.contribute(D.projects[0].id,'crowns',10)).ok,false);
 const vm=require('node:vm'),fs=require('node:fs'),context=vm.createContext({window:{addEventListener(){}},GuildTabWriter:{exclusive:run=>run()}});
 Object.defineProperty(context,'localStorage',{get(){throw Error('denied getter')}});
 vm.runInContext(fs.readFileSync(require.resolve('../guild-project-data.js'),'utf8')+'\n'+fs.readFileSync(require.resolve('../guild-project-system.js'),'utf8')+'\nglobalThis.issue=GuildProjectSystem.storageIssue;',context);assert.equal(context.issue,true);
 console.log('PASS Guild Projects: validation, separate requirements, caps, completion once, reload, normalization, corrupt/unavailable/write-failed storage, no stale write, queue, rejected lock, isolated ledger');
})().catch(e=>{console.error(e);process.exitCode=1});
