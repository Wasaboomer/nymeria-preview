const assert=require('node:assert/strict'),V=require('../material-bag-view'),B=require('../material-bag-store'),G=require('../progression-store'),P=require('../profession-system'),C=require('../material-bag-contract');
const input=(materials={},profession={},expansions=0)=>({progression:{ok:true,state:{materials}},profession:{ok:true,state:{materials:profession}},bag:{ok:true,state:{expansionIds:Array.from({length:expansions},(_,i)=>`award:${i}`)}}});
assert.equal(V.project(input()).occupied,0);
const mixed=V.project(input({iron:99,fiber:0},{'raw-iron':1000000}));assert.equal(mixed.occupied,2);assert.notEqual(mixed.groups[0].rows[0].name,mixed.groups[1].rows[0].name);
for(const n of [0,1,6])assert.equal(V.project(input({}, {}, n)).capacity,40+n*10);
// Occupancy boundaries require synthetic catalog entries: production contains eight types.
const entries=Array.from({length:45},(_,i)=>({owner:'profession',id:`test-${i}`,key:`profession:test-${i}`,name:`Test ${i}`}));
for(const n of [39,40,41,45]){const r=V.project(input({},Object.fromEntries(entries.slice(0,n).map(x=>[x.id,1]))),entries);assert.equal(r.occupied,n);assert.equal(r.overCapacity,n>40);}
assert.equal(V.project(input({unknown:1})).ok,false);
assert.equal(V.project(input({iron:-1})).ok,false);
for(const key of [G.KEY,P.KEY,B.KEY])for(const raw of ['{',JSON.stringify({version:999})]){
 const map=new Map([[key,raw]]);let writes=0;const storage={getItem:k=>map.get(k)??null,setItem:()=>writes++};
 const result=V.read({progression:G.create({storage}),profession:P.create({storage}),storage});assert.equal(result.ok,false);assert.equal(writes,0);assert.equal(map.get(key),raw);
}
let writes=0;const storage={getItem:()=>null,setItem:()=>writes++};assert.equal(V.read({progression:G.create({storage}),profession:P.create({storage}),storage}).occupied,0);assert.equal(writes,0);
assert.equal(V.read({progression:{readSnapshot(){throw Error('denied')}},profession:{},storage}).ok,false);
console.log('PASS Bag view: owners/distinct identities/positive quantities, 40/50/100, 39/40/41 boundaries, corrupt/future/absent storage and zero writes');
