const assert = require('node:assert/strict');
const D = require('../world-discovery'), P = require('../guild-project-system'), World = require('../world-system');
const fixture = require('./world-fixture.cjs');
const memory = () => {const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}};
(async()=>{
 const storage=memory(),p=P.create({storage}),d=D.create({storage,projects:()=>p.state,now:()=>123});
 let writes=0;const setter=storage.setItem;storage.setItem=(...args)=>{writes++;setter(...args)};
 assert.equal((await d.reconcile()).unchanged,true);assert.equal(writes,0);assert.equal(d.accessible('vesper-outpost'),false);assert.deepEqual(d.pending(),[]);
 for(const [key,n] of Object.entries(require('../guild-project-data').projects[0].requirements))await p.contribute('vesper-watchtower',key,n);
 const projectBefore=storage.getItem(P.KEY);await d.reconcile();assert.equal(d.accessible('vesper-outpost'),true);assert.deepEqual(d.pending(),['vesper-outpost']);assert.equal(storage.getItem(P.KEY),projectBefore);
 const before=d.state;await Promise.all(Array.from({length:10},()=>d.reconcile()));assert.deepEqual(d.state,before);
 const results=await Promise.all(Array.from({length:10},()=>d.acknowledge('vesper-outpost')));assert.equal(results.filter(r=>r.claimed).length,1);assert.deepEqual(d.pending(),[]);
 const restored=D.create({storage,projects:()=>p.state});assert.equal(restored.accessible('vesper-outpost'),true);assert.deepEqual(restored.pending(),[]);
 assert.equal((await p.contribute('vesper-watchtower','crowns',1)).ok,false);assert.equal(storage.getItem(P.KEY),projectBefore);
 for(const raw of [null,[],{version:1,discovered:null},{version:1,discovered:{'vesper-outpost':true},acknowledged:{'vesper-outpost':true}},{version:1,discovered:{'vesper-outpost':{scope:'guild',source:'vesper-watchtower',discoveredAt:Infinity}}}]) assert.deepEqual(D.normalize(raw),D.empty());
 const denied=memory();denied.setItem(D.KEY,JSON.stringify(before));const noSource=D.create({storage:denied,projects:()=>P.empty()});assert.equal(noSource.accessible('vesper-outpost'),false);assert.deepEqual(noSource.pending(),[]);
 for(const corrupt of ['{bad',JSON.stringify({version:1,discovered:[],acknowledged:null})]) { storage.setItem(D.KEY,corrupt);const t=D.create({storage,projects:()=>p.state});await t.reconcile();assert.equal(t.accessible('vesper-outpost'),true);assert.equal(storage.getItem(P.KEY),projectBefore); }
 storage.setItem(D.KEY,JSON.stringify({version:99}));const future=D.create({storage,projects:()=>p.state});assert.equal((await future.reconcile()).ok,false);assert.equal(JSON.parse(storage.getItem(D.KEY)).version,99);
 for(const broken of [{getItem(){throw Error('read')},setItem(){throw Error('must not write')}},{getItem:()=>null,setItem(){throw Error('quota')}}]) {const t=D.create({storage:broken,projects:()=>p.state});assert.equal((await t.reconcile()).ok,false);assert.equal(t.accessible('vesper-outpost'),false);assert.equal(t.storageIssue,true);assert.equal((await t.acknowledge('vesper-outpost')).ok,false);}
 const failAck=memory();failAck.setItem(D.KEY,JSON.stringify(before));const a=D.create({storage:failAck,projects:()=>p.state});failAck.setItem=()=>{throw Error('quota')};assert.equal((await a.acknowledge('vesper-outpost')).ok,false);assert.deepEqual(a.pending(),['vesper-outpost']);
 const f=fixture();let unlocked=false;const world=World.create({store:f.store,progression:f.system,discovery:{accessible:()=>unlocked}});
 assert.equal((await world.enter('vesper-outpost')).ok,false);const economy=()=>JSON.stringify([f.store.state.totalXP,f.store.state.crowns,f.store.state.materials]);const oldEconomy=economy();unlocked=true;assert.equal((await world.enter('vesper-outpost')).ok,true);assert.equal(f.store.state.frontier.location,'vesper-outpost');assert.equal((await world.explore('outpost-board')).ok,true);assert.equal(economy(),oldEconomy);
 f.store.refresh();assert.equal(f.store.state.frontier.location,'vesper-outpost');unlocked=false;assert.equal((await world.explore('outpost-board')).ok,false);assert.equal((await world.enter('vesper-outpost')).ok,false);
 const vm=require('node:vm'),fs=require('node:fs'),context=vm.createContext({window:{addEventListener(){}},document:{readyState:'loading',addEventListener(){}},GuildProjectSystem:{state:P.empty()},GuildTabWriter:{exclusive:fn=>fn()}});Object.defineProperty(context,'localStorage',{get(){throw Error('denied')}});vm.runInContext(fs.readFileSync(require.resolve('../world-discovery'),'utf8')+'\nglobalThis.issue=WorldDiscovery.storageIssue',context);assert.equal(context.issue,true);
 console.log('PASS M7.2: locked/unlocked access, separate durable discovery/ack, idempotence, migration, corruption/denial/quota/future schema, project and economy preservation, board visit and reload');
})().catch(e=>{console.error(e);process.exitCode=1});
