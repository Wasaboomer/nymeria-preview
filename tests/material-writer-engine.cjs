const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../material-writer-coordinator'),'utf8');
function context(locks){const listeners={};const c=vm.createContext({navigator:{locks},window:{addEventListener:(k,f)=>listeners[k]=f},setTimeout,clearTimeout,AbortController});vm.runInContext(source+';globalThis.run=MaterialWriterCoordinator.run;globalThis.progression=MaterialWriterCoordinator.progression',c);return {c,listeners};}
(async()=>{
 let holder=false,requests=0;const locks={async request(name,opts,fn){requests++;if(holder)return fn(null);holder=true;try{return await fn({name})}finally{holder=false}}};
 const a=context(locks),b=context(locks),order=[];
 await Promise.all([a.c.run(async()=>{order.push(1);await new Promise(r=>setTimeout(r,5));order.push(2);return {ok:true}}),a.c.run(()=>{order.push(3);return {ok:true}})]);
 assert.deepEqual(order,[1,2,3]);assert.equal(requests,1);
 let applied=false;assert.equal((await b.c.run(()=>{applied=true;return {ok:true}})).ok,false);assert.equal(applied,false);
 a.listeners.pagehide();await new Promise(r=>setTimeout(r,5));assert.equal((await b.c.run(()=>({ok:true}))).ok,true);
 b.listeners.pagehide();await new Promise(r=>setTimeout(r,5));
 const no=context(undefined);assert.equal((await no.c.run(()=>assert.fail())).ok,false);
 const broken=context({request:()=>Promise.reject(Error('lock'))});assert.equal((await broken.c.run(()=>assert.fail())).ok,false);
 const failing=context(locks);let executions=0;assert.equal((await failing.c.run(()=>{executions++;throw Error('after write')})).ok,false);assert.equal(executions,1,'No internal retry');
 assert.equal((await failing.c.run(()=>({ok:true}))).ok,true);failing.listeners.pagehide();await new Promise(r=>setTimeout(r,5));
 const queued=context(locks);let finishSlow;const slow=queued.c.run(()=>new Promise(resolve=>finishSlow=resolve));await new Promise(r=>setTimeout(r,5));let lateWrites=0;assert.equal((await queued.c.run(()=>{lateWrites++;return {ok:true}},10)).ok,false);finishSlow({ok:true});await slow;await new Promise(r=>setTimeout(r,5));assert.equal(lateWrites,0,'Expired queue task never writes later');queued.listeners.pagehide();await new Promise(r=>setTimeout(r,5));
 const lifecycle=context(locks);assert.equal((await lifecycle.c.run(()=>({ok:true}))).ok,true);lifecycle.listeners.pagehide();assert.equal((await lifecycle.c.run(()=>assert.fail('Suspended operation'))).ok,false);lifecycle.listeners.pageshow();await new Promise(r=>setTimeout(r,5));assert.equal((await lifecycle.c.run(()=>({ok:true}))).ok,true);lifecycle.listeners.pagehide();await new Promise(r=>setTimeout(r,5));
 const waiting=context({request:(name,options,fn)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout'))))});
 assert.equal((await waiting.c.progression(()=>assert.fail('Timed out callback must not run'),10)).ok,false);
 const suspendedWait=context({request:(name,options,fn)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('suspended'))))});const cancelled=suspendedWait.c.progression(()=>assert.fail('No write after suspension'));await new Promise(r=>setTimeout(r,1));suspendedWait.listeners.pagehide();assert.equal((await cancelled).ok,false);
 console.log('PASS common writer: lease contention/handoff, serial queue, rejected/missing locks, failure recovery and no retry');
})().catch(e=>{console.error(e);process.exitCode=1});
