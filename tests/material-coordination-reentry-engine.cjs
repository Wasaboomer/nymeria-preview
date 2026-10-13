const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),Bag=require('../material-bag-store');
const listeners={},locks={request:async(name,options,callback)=>callback({name})};
const c=vm.createContext({navigator:{locks},window:{addEventListener:(name,fn)=>listeners[name]=fn},setTimeout,clearTimeout,AbortController});
vm.runInContext(fs.readFileSync(require.resolve('../material-writer-coordinator'),'utf8')+';globalThis.common=MaterialWriterCoordinator',c);
const common=c.common,records=new Map(),bag=Bag.create({storage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)},coordinator:Bag.withMaterialWriter(common)});
(async()=>{
 let finish,entered;const ready=new Promise(r=>entered=r),slow=common.run(async()=>{entered();await new Promise(r=>finish=r);return {ok:true}});await ready;
 assert.equal(common.isCoordinated(),true);assert.equal(common.isInvoking(),false);
 const independent=bag.initialize();finish();assert.equal((await slow).ok,true);assert.equal((await independent).capacity,40);
 const before=JSON.stringify([...records]);assert.equal((await common.run(()=>bag.grantExpansion('recursive'))).code,'nested-coordination-rejected');assert.equal(JSON.stringify([...records]),before);
 assert.equal((await common.run(()=>common.progression(()=>bag.grantExpansion('recursive-progression')))).code,'nested-coordination-rejected');assert.equal(JSON.stringify([...records]),before);
 assert.equal((await bag.grantExpansion('normal')).capacity,50);
 let writes=0;const deferred=await common.run(async()=>{await Promise.resolve();return common.run(()=>{writes++;return {ok:true}},20)});assert.equal(deferred.ok,false);await new Promise(r=>setTimeout(r,5));assert.equal(writes,0,'Unscoped recursion across await times out without a late write');
 assert.equal((await bag.grantExpansion('after-timeout')).capacity,60);listeners.pagehide();
 console.log('PASS reentry: independent pending callback queues; synchronous recursion in run/progression rejected; async unscoped reentry bounded/no late write; queue remains usable');
})().catch(e=>{console.error(e);process.exitCode=1});
