/* Test-only construction injection; no parallel engines or shipped activation API. */
const fs=require('node:fs'),path=require('node:path');
module.exports=async(context,dependencies={padding:39})=>{
 await context.route('**/material-bag-runtime.js*',route=>{
  const source=fs.readFileSync(path.join(__dirname,'../material-bag-runtime.js'),'utf8');
  const injection=`MaterialBagRuntimeFactory.create({admission: MaterialCapacityAdmission.createTestSession({
   purpose:'capacity-simulation',isCoordinated:MaterialWriterCoordinator.isCoordinated,
   readers:{progression:()=>ProgressionStore.readSnapshot(),profession:()=>ProfessionUI.engine.readSnapshot()},
   readMetadata:MaterialBagStore.create({storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)}}).read,
   entries:[...MaterialBagContract.catalog,...Array.from({length:41},(_,i)=>({owner:'profession',id:'test-'+i,key:'profession:test-'+i}))],
   project:ledgers=>{for(let i=0;i<window.bagFixture.padding;i++)ledgers.profession.materials['test-'+i]=1;return ledgers}
  })})`;
  const marker='? MaterialBagRuntimeFactory.create() : null';
  if(!source.includes(marker))throw Error('Runtime construction point changed');
  return route.fulfill({contentType:'text/javascript',body:`window.bagFixture={padding:${dependencies.padding}};\n`+source.replace(marker,'? '+injection+' : null')});
 });
};
