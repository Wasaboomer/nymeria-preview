const assert=require('node:assert/strict'),M=require('../material-bag-store'),G=require('../progression-store'),P=require('../profession-system');
const A=require('../material-capacity-admission'),B=require('../material-bag-contract');
function setup(){
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 let queue=Promise.resolve(),inside=false;
 const common={isCoordinated:()=>inside,run(run){const result=queue.then(async()=>{inside=true;try{return await run()}finally{inside=false}});queue=result.catch(()=>{});return result},progression:run=>run()};
 const bag=M.create({storage,coordinator:M.withMaterialWriter(common)});let g,p;
 const extras=Array.from({length:39},(_,i)=>({owner:'profession',id:`fixture-${i}`,key:`profession:fixture-${i}`}));
 const session=A.createTestSession({purpose:'capacity-simulation',isCoordinated:common.isCoordinated,readMetadata:bag.read,
  readers:{progression:()=>g.readSnapshot(),profession:()=>p.readSnapshot()},entries:[...B.catalog,...extras],project:ledgers=>{for(const row of extras)ledgers.profession.materials[row.id]=1;return ledgers}});
 g=G.create({storage,exclusive:run=>common.run(()=>common.progression(run)),materialAdmission:session.progression});
 p=P.create({storage,exclusive:run=>common.run(()=>common.progression(run)),context:()=>({accessible:true,location:'broken-path'}),materialAdmission:session.profession});
 return {map,storage,common,bag,g,p};
}
(async()=>{
 const a=setup();await a.bag.initialize();const bytes=a.map.get(M.KEY);
 const r=await Promise.all([a.bag.grantExpansion('award:one'),a.bag.grantExpansion('award:one'),a.bag.grantExpansion('award:two')]);assert.ok(r.every(x=>x.ok));assert.equal(a.bag.read().capacity,60);assert.equal(r.filter(x=>x.unchanged).length,1);
 for(let i=3;i<=6;i++)assert.equal((await a.bag.grantExpansion('award:'+i)).capacity,40+i*10);assert.equal((await a.bag.grantExpansion('award:seven')).code,'capacity-maximum');assert.equal((await a.bag.grantExpansion('award:one')).unchanged,true);
 const reload=M.create({storage:a.storage,coordinator:M.withMaterialWriter(a.common)});assert.deepEqual(reload.read(),a.bag.read());assert.equal((await reload.initialize()).unchanged,true);
 console.log('PASS common grants: unique IDs, concurrent/reload, initial 40/+10/max100');
 const b=setup();await b.g.transact(s=>{s.materials.iron=1;return {ok:true}});
 assert.equal((await b.p.gather('vesper-iron-vein')).code,'capacity-exceeded');
 const pair=await Promise.all([b.bag.grantExpansion('award:gather'),b.p.gather('vesper-iron-vein')]);assert.ok(pair.every(x=>x.ok));assert.equal(b.p.state.materials['raw-iron'],2);
 const c=setup();c.map.set(P.KEY,JSON.stringify({...P.empty(),materials:{'raw-iron':4}}));assert.equal((await c.p.craft('forge-iron')).ok,false);
 assert.ok((await Promise.all([c.bag.grantExpansion('award:craft'),c.p.craft('forge-iron')])).every(x=>x.ok));assert.equal(c.p.state.materials['raw-iron'],1);assert.equal(c.p.state.materials['forged-iron'],1);
 console.log('PASS gather/craft read new capacity inside the same common queue');
 const d=setup(),before=new Map(d.map);const nested=await d.common.run(()=>d.bag.grantExpansion('nested'));assert.equal(nested.code,'nested-coordination-rejected');assert.deepEqual(d.map,before);assert.equal((await d.bag.grantExpansion('retry')).capacity,50);
 assert.equal((await M.withMaterialWriter(null).run(()=>assert.fail())).ok,false);
 const save=d.map.get(M.KEY),write=d.storage.setItem;d.storage.setItem=()=>{throw Error('quota')};assert.equal((await d.bag.grantExpansion('quota')).code,'write-rejected');assert.equal(d.map.get(M.KEY),save);d.storage.setItem=write;assert.equal((await d.bag.grantExpansion('quota')).capacity,60);
 for(const raw of ['{bad',JSON.stringify({version:99})]){d.map.set(M.KEY,raw);assert.equal((await d.bag.grantExpansion('blocked')).ok,false);assert.equal(d.map.get(M.KEY),raw)}
 d.storage.getItem=()=>{throw Error('denied')};assert.equal((await d.bag.grantExpansion('denied')).code,'storage-unavailable');
 assert.equal(a.map.get(G.KEY),undefined);assert.equal(a.map.get(P.KEY),undefined);assert.notEqual(bytes,a.map.get(M.KEY));
 console.log('PASS no recursive deadlock, refused/unsafe storage intact, no material or legacy writes');
})().catch(e=>{console.error(e);process.exitCode=1});
