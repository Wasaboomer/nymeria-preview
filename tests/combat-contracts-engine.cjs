const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const C = require('../combat-contracts.js');
let checks = 0;
const check = (name, fn) => {fn();checks++;console.log('PASS '+name)};
const teams = [{id:'heroes'},{id:'enemies'}];
const actors = [{id:'tank',teamId:'heroes',lifeState:'alive',hp:10,maxHp:10},
 {id:'healer',teamId:'heroes',lifeState:'alive',hp:7,maxHp:10},
 {id:'boss',teamId:'enemies',lifeState:'alive',hp:8,maxHp:10}];
const roster = () => C.roster(teams,actors);
check('stable identities, deep immutable detached roster; no reassignment',()=>{
 const r=roster();assert(Object.isFrozen(r.actors[0]));const copy=JSON.stringify(actors);assert.equal(JSON.stringify(r.actors),copy);
 const input=JSON.parse(copy),out=C.roster(teams,input);input[0].hp=1;assert.equal(out.actors[0].hp,10);
 assert.deepEqual(C.roster(teams,actors),r);
});
check('invalid/duplicate IDs, teams and cross-references fail closed',()=>{
 for(const bad of ['', ' a','x/y',null,'a'.repeat(65)])assert.throws(()=>C.roster([{id:bad}],[]));
 assert.throws(()=>C.roster([...teams,teams[0]],actors));assert.throws(()=>C.roster(teams,[actors[0],actors[0]]));
 assert.throws(()=>C.roster([],actors));assert.throws(()=>C.roster(null,actors));
});
check('life and HP invariants; no hidden resurrection',()=>{
 for(const change of [{hp:-1},{hp:11},{hp:NaN},{hp:Infinity},{maxHp:0},{lifeState:'dead'},{lifeState:'unknown'},{hp:0}])
  assert.throws(()=>C.roster(teams,[{...actors[0],...change}]));
 assert.equal(C.roster(teams,[{...actors[0],hp:0,lifeState:'dead'}]).actors[0].lifeState,'dead');
});
const intent=(kind='damage',targetId='boss',relation='enemy')=>({id:'action:1',abilityId:'fixture:ability',kind,sourceId:'tank',targetId,relation});
check('four action categories; target relations only, no execution',()=>{
 const r=roster(),before=JSON.stringify(r);
 for(const kind of C.actionKinds){const out=C.actionIntent(intent(kind),r);assert.equal(out.kind,kind);assert(Object.isFrozen(out));}
 assert.equal(C.actionIntent(intent('heal','healer','ally'),r).targetId,'healer');
 assert.equal(C.actionIntent(intent('protection','tank','self'),r).relation,'self');assert.equal(JSON.stringify(r),before);
});
check('unknown/dead targets or sources and mismatched relations rejected',()=>{
 const r=roster();for(const change of [{sourceId:'absent'},{targetId:'absent'},{relation:'ally'},{kind:'taunt'},{abilityId:''}])
 assert.throws(()=>C.actionIntent({...intent(),...change},r));
 const dead=C.roster(teams,[{...actors[0],hp:0,lifeState:'dead'},...actors.slice(1)]);assert.throws(()=>C.actionIntent(intent(),dead));
 assert.throws(()=>C.actionIntent(intent('heal','tank','self'),dead));assert.throws(()=>C.actionIntent(intent(),{}));
});
const events=[{id:'event:2',tick:1,phase:'action',sourceId:'tank',sequence:2},
 {id:'event:1',tick:1,phase:'periodic',sourceId:'boss',sequence:1},
 {id:'event:3',tick:1,phase:'action',sourceId:'boss',sequence:1}];
check('future ordering deterministic for input permutations; input unchanged',()=>{
 const before=JSON.stringify(events),expected=['event:1','event:3','event:2'];
 for(const order of [events,[...events].reverse(),[events[1],events[0],events[2]]])
 assert.deepEqual(C.futureOrder.orderedEvents(order).map(e=>e.id),expected);
 assert.equal(JSON.stringify(events),before);assert(Object.isFrozen(C.futureOrder.orderedEvents(events)[0]));
});
check('event key validation and unambiguous ordering including same-source sequence',()=>{
 const event=events[0];for(const change of [{tick:-1},{tick:0.5},{tick:NaN},{phase:'unknown'},{sequence:Infinity}])
 assert.throws(()=>C.futureOrder.orderedEvents([{...event,...change}]));
 assert.throws(()=>C.futureOrder.orderedEvents([event,{...event,id:'different'}]));
 assert.throws(()=>C.futureOrder.orderedEvents([event,{...event,tick:2}]));
 assert.deepEqual(C.futureOrder.orderedEvents([{...event,id:'later',sequence:3},event]).map(e=>e.id),[event.id,'later']);
});
check('future declared RNG draw plan is deterministic, ordered and side-effect free',()=>{
 const requested=events.map(e=>({...e,draws:e.id==='event:1'?[]:['critical','itemProc']}));
 const before=JSON.stringify(requested),plan=C.futureOrder.plannedDraws(requested);
 assert.deepEqual(plan.map(x=>x.eventId),['event:3','event:3','event:2','event:2']);
 assert.deepEqual(plan.map(x=>x.label),['critical','itemProc','critical','itemProc']);
 assert.deepEqual(C.futureOrder.plannedDraws([...requested].reverse()),plan);assert.equal(JSON.stringify(requested),before);
 assert.throws(()=>C.futureOrder.orderedEvents([{...events[0],draws:['critical','critical']}]));
 assert.throws(()=>C.futureOrder.orderedEvents([{...events[0],draws:null}]));
});
check('legacy metadata phases and RNG contract do not instantiate randomness',()=>{
 assert.equal(C.legacy.stepSeconds,.05);assert.equal(C.legacy.phases.length,8);
 assert.deepEqual(C.legacy.rng.buff,[]);assert.match(C.legacy.rng.enemyAttack[1],/NotDodged/);
 const context=vm.createContext({Math:{random:()=>{throw Error('RNG must not run')}}});
 vm.runInContext(fs.readFileSync(require.resolve('../combat-contracts.js'),'utf8'),context);
 assert.equal(vm.runInContext('CombatContracts.legacy.version',context),1);
});
check('unversioned and explicit legacy replay recognized; activity version ignored',()=>{
 const replay={rulesVersion:999,snapshot:{marker:'keep'},seed:7},bytes=JSON.stringify(replay);
 assert.equal(C.rulesForReplay(replay),C.legacy);assert.equal(JSON.stringify(replay),bytes);
 assert.equal(C.rulesForReplay({...replay,simulationRules:{id:'legacy-1v1',version:1}}),C.legacy);
});
check('unknown/null/future engine version blocked, replay preserved',()=>{
 for(const simulationRules of [null,{id:'cooperative',version:1},{id:'legacy-1v1',version:2}]){
 const replay={simulationRules},before=JSON.stringify(replay);assert.throws(()=>C.rulesForReplay(replay));assert.equal(JSON.stringify(replay),before);}
 assert.throws(()=>C.rulesForReplay(null));
});
check('not loaded by normal game and no storage/browser/engine dependency',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');assert(!html.includes('combat-contracts.js'));
 const source=fs.readFileSync(require.resolve('../combat-contracts.js'),'utf8');assert(!/localStorage|document\.|require\(/.test(source));
});
console.log(`${checks} F1 combat contract checks passed`);
