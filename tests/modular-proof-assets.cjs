/* Verify actual geometry changes and stable identity across the four proof assets. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const results=[];
for(const armor of ['ranger','peasant'])for(const weapon of ['sword','staff']){
 const bytes=fs.readFileSync(path.join(__dirname,'../assets/modular-proof',`${armor}-${weapon}.glb`));
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const length=bytes.readUInt32LE(12),d=JSON.parse(bytes.subarray(20,20+length).toString()),bin=bytes.subarray(28+length);
 const names=d.meshes.map(m=>m.name);assert(names.includes('Female_'+(armor==='ranger'?'Ranger':'Peasant')+'_Body'));
 assert(names.includes(weapon==='sword'?'weapon_blade':'weapon_crystal'));assert(!names.includes(weapon==='sword'?'weapon_crystal':'weapon_blade'));
 assert(!d.skins,'The static proof does not expose a second mismatched rig');
 const geometry=name=>{
  const m=d.meshes.find(x=>x.name===name),p=m.primitives[0];
  for(const attr of ['POSITION','NORMAL'])assert.equal(d.accessors[p.attributes[attr]].componentType,5126);
  const a=d.accessors[p.attributes.POSITION],v=d.bufferViews[a.bufferView];assert(a.min.every(Number.isFinite)&&a.max.every(Number.isFinite));
  return hash(bin.subarray(v.byteOffset,v.byteOffset+v.byteLength));
 };
 results.push({armor,weapon,head:geometry('Superhero_Female'),hair:geometry('Hair_Long'),weaponGeometry:geometry(weapon==='sword'?'weapon_blade':'weapon_staff')});
}
assert.equal(new Set(results.map(r=>r.head)).size,1);assert.equal(new Set(results.map(r=>r.hair)).size,1);
assert.notEqual(results[0].weaponGeometry,results[1].weaponGeometry);
console.log('PASS four valid GLBs; two outfits; two visible weapon geometries; identical head and hair across all combinations.');
const combined=fs.readFileSync(path.join(__dirname,'../assets/modular-proof/slots-combined.glb'));
assert.equal(combined.readUInt32LE(8),combined.length);
const model=JSON.parse(combined.subarray(20,20+combined.readUInt32LE(12)).toString());
for(const [slot,variants] of Object.entries({torso:['ranger','peasant'],arms:['ranger','peasant'],legs:['ranger','peasant'],boots:['ranger','peasant'],shoulders:['ranger'],weapon:['sword','staff']})){
 for(const variant of variants){
  const materials=model.materials.filter(m=>m.name?.startsWith(`slot:${slot}:${variant}:`));assert(materials.length>0,`Missing ${slot}/${variant}`);
  for(const m of materials){assert.equal(m.alphaMode,'BLEND');assert.equal(m.pbrMetallicRoughness.baseColorFactor[3],variant==='peasant'||variant==='staff'?0:1);}
 }
}
for(const mesh of model.meshes)for(const p of mesh.primitives){assert.equal(model.accessors[p.attributes.NORMAL].componentType,5126);}
console.log('PASS single combined scene contains individually selectable components for all six slots.');
