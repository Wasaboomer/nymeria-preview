const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const S = require('../material-bag-store');
const memory = () => {
 const map = new Map(); let writes = 0;
 return { map, get writes(){return writes;}, getItem:k=>map.get(k)??null,
 setItem(k,v){writes++;map.set(k,v);} };
};
(async()=>{
 const storage = memory();
 const legacy = { 'nymeria.progression.v1':'{"materials":{"iron":12},"totalXP":84}',
  'nymeria.professions.v1':'{"version":2,"materials":{"raw-iron":6}}',
  'nymeria.equipment.v1':'{"inventory":[{"id":"sword"}]}' };
 for(const [key,value] of Object.entries(legacy)) storage.map.set(key,value);
 const a = S.create({storage});assert.equal(storage.writes,0,'Construction is inactive');
 assert.equal(a.read().capacity,40);assert.equal(storage.writes,0);
 assert.equal((await a.initialize()).capacity,40);assert.equal(storage.writes,1);
 for(let i=0;i<4;i++) assert.equal((await S.create({storage}).initialize()).unchanged,true);
 assert.equal(storage.writes,1);
 for(const [key,value] of Object.entries(legacy)) assert.equal(storage.getItem(key),value);
 let r=await a.grantExpansion('quest:bag-upgrade-1');assert.equal(r.capacity,50);
 assert.equal((await S.create({storage}).grantExpansion('quest:bag-upgrade-1')).unchanged,true);
 assert.equal(storage.writes,2);
 for(let i=2;i<=6;i++)assert.equal((await a.grantExpansion('upgrade-'+i)).capacity,40+10*i);
 const capped=storage.getItem(S.KEY);assert.equal((await a.grantExpansion('upgrade-7')).code,'capacity-maximum');
 assert.equal(storage.getItem(S.KEY),capped);
 for(const id of ['',null,{},'bad id','x'.repeat(129)])assert.equal((await a.grantExpansion(id)).code,'invalid-expansion-id');
 const partial=memory();partial.map.set(S.KEY,JSON.stringify({version:1,expansionIds:['old-award']}));
 const p=S.create({storage:partial});assert.equal((await p.initialize()).capacity,50);
 assert.equal((await p.initialize()).unchanged,true);assert.equal(partial.writes,1);
 const versionless=memory();versionless.map.set(S.KEY,'{}');
 assert.equal((await S.create({storage:versionless}).initialize()).capacity,40);
 for(const raw of ['{broken','null','[]','{"version":99}', '{"version":0}',
  '{"version":1,"materials":{"iron":1}}','{"capacity":60}',
  '{"version":1,"expansionIds":["duplicate","duplicate"]}',
  '{"version":1,"expansionIds":["a","b","c","d","e","f","g"]}',
  '{"version":1,"baseCapacity":50}', '{"version":1,"expansionIds":[null]}']) {
  const s=memory();s.map.set(S.KEY,raw);const store=S.create({storage:s});
  assert.equal((await store.initialize()).ok,false);assert.equal((await store.grantExpansion('new')).ok,false);
  assert.equal(s.getItem(S.KEY),raw);assert.equal(s.writes,0,'Invalid bytes remain untouched');
 }
 const denied=S.create({storage:{getItem(){throw Error('denied')},setItem(){assert.fail('No write');}}});
 assert.equal((await denied.initialize()).code,'storage-unavailable');
 assert.equal((await S.create().initialize()).code,'storage-unavailable');
 const quota=memory(),write=quota.setItem.bind(quota);quota.setItem=()=>{throw Error('quota');};
 const q=S.create({storage:quota});assert.equal((await q.initialize()).code,'write-rejected');assert.equal(quota.getItem(S.KEY),null);
 quota.setItem=write;assert.equal((await q.initialize()).capacity,40);
 quota.setItem=()=>{throw Error('quota');};const old=quota.getItem(S.KEY);
 assert.equal((await q.grantExpansion('retry')).code,'write-rejected');assert.equal(quota.getItem(S.KEY),old);
 quota.setItem=write;assert.equal((await q.grantExpansion('retry')).capacity,50);
 const migrationQuota=memory();migrationQuota.map.set(S.KEY,'{"version":1}');
 migrationQuota.setItem=()=>{throw Error('quota');};
 assert.equal((await S.create({storage:migrationQuota}).initialize()).code,'write-rejected');
 assert.equal(migrationQuota.getItem(S.KEY),'{"version":1}','Rejected migration preserves original bytes');
 storage.map.set(S.KEY,JSON.stringify({version:1,baseCapacity:40,expansionIds:['external-update']}));
 assert.equal((await a.grantExpansion('after-external-update')).capacity,60,'Operations reread current receipts');
 const externalIds=a.read().state.expansionIds;assert.deepEqual(externalIds,['external-update','after-external-update']);
 externalIds.push('mutated-return');assert.equal(a.read().state.expansionIds.length,2);
 // Multiple instances share a queue and reread current metadata, not a cached grant list.
 const concurrent=memory(),x=S.create({storage:concurrent}),y=S.create({storage:concurrent});
 await Promise.all([x.initialize(),y.initialize()]);assert.equal(concurrent.writes,1);
 await Promise.all([x.grantExpansion('same'),y.grantExpansion('same'),x.grantExpansion('other')]);
 assert.equal(x.read().capacity,60);assert.equal(concurrent.writes,3);
 const order=[],coordinator=S.createCoordinator();
 await Promise.all([coordinator.run(async()=>{order.push(1);await Promise.resolve();order.push(2);}),coordinator.run(()=>order.push(3))]);
 assert.deepEqual(order,[1,2,3]);
 assert.equal((await coordinator.run(()=>{throw Error('operation');})).ok,false);
 assert.equal(await coordinator.run(()=>42),42,'Failed operation does not poison queue');
 let lockName;const locked=S.createCoordinator({locks:{request:async(name,fn)=>{lockName=name;return fn();}}});
 assert.equal(await locked.run(()=>7),7);assert.equal(lockName,S.LOCK);
 assert.equal(locked.scope,'participating-web-lock-contexts');
 assert.equal((await S.createCoordinator({locks:{request:()=>Promise.reject(Error('lock'))}}).run(()=>assert.fail())).ok,false);
 // Even evaluating the browser module must not touch denied storage.
 const sandbox=vm.createContext({MaterialBagContract:require('../material-bag-contract')});
 Object.defineProperty(sandbox,'localStorage',{get(){assert.fail('Inactive module accessed storage');}});
 vm.runInContext(fs.readFileSync(require.resolve('../material-bag-store'),'utf8'),sandbox);
 for(const [key,value] of Object.entries(legacy)) assert.equal(storage.getItem(key),value);
 console.log('PASS bag metadata: inactive load, initialization/restarts, additive migration, unique grants/cap, corrupt/future bytes retained, denied/quota/retry, queues/lock failures and legacy isolation');
})().catch(error=>{console.error(error);process.exitCode=1;});
