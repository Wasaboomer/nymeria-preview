const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../attribute-schema.js');let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS '+name)};
check('five approved primaries, no defaults or formulas',()=>{
 assert.deepEqual(S.primary.map(x=>x.code),['FOR','AGI','STA','INT','SPI']);assert.equal(S.active,false);
 for(const row of [...S.primary,...S.secondary]){assert(Object.isFrozen(row));assert(!('default' in row));assert(!('formula' in row));}
});
check('seven approved secondaries, unit decisions explicit',()=>{
 assert.deepEqual(S.secondary.map(x=>x.name),['Critico','Celerità','Precisione','Armatura','Parata','Blocco','Resistenza magica']);
 assert(S.secondary.every(x=>x.unit==='undecided'));
});
check('legacy semantic gaps documented, no fabricated conversion',()=>{
 assert.equal(S.legacyCorrespondence.vigor.candidate,'stamina');assert.equal(S.legacyCorrespondence.spirit.status,'incompatible-semantics');
 assert(S.absentInLegacy.includes('intellect'));assert(!('block' in S.legacyCorrespondence));
 assert(Object.values(S.legacyCorrespondence).every(x=>!('factor' in x)));
});
const draft=values=>({schemaId:S.schemaId,version:1,status:'unassigned',values});
check('empty/partial inactive drafts remain partial and idempotent',()=>{
 const raw=draft({}),out=S.validateEnvelope(raw);assert.deepEqual(out.values,{});assert.deepEqual(S.validateEnvelope(out),out);
 const input=draft({strength:12.5}),copy=S.validateEnvelope(input);input.values.strength=90;
 assert.equal(copy.values.strength,12.5);assert(!('intellect' in copy.values));assert(Object.isFrozen(copy.values));
});
check('invalid versions, status, types, unknown stats and bad values rejected without mutation',()=>{
 for(const raw of [null,draft(null),draft([]),{...draft({}),version:99},{...draft({}),status:'active'},draft({vigor:10}),draft({strength:NaN}),draft({strength:-1}),draft({strength:'10'})]){
 const bytes=JSON.stringify(raw);assert.throws(()=>S.validateEnvelope(raw));assert.equal(JSON.stringify(raw),bytes);}
});
check('legacy saves never reinterpreted or written; browser inert load',()=>{
 const original={version:2,stats:{force:12,vigor:14,spirit:11}},before=JSON.stringify(original);assert.throws(()=>S.validateEnvelope(original));assert.equal(JSON.stringify(original),before);
 const c=vm.createContext({localStorage:{getItem:()=>{throw Error('forbidden')},setItem:()=>{throw Error('forbidden')}}});
 vm.runInContext(fs.readFileSync(require.resolve('../attribute-schema.js'),'utf8'),c);assert.equal(vm.runInContext('AttributeSchema.active',c),false);
 assert(!fs.readFileSync(require.resolve('../index.html'),'utf8').includes('attribute-schema.js'));
});
console.log(`${checks} F1 attribute schema checks passed`);
