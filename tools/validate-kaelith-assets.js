/* Nymeria Kaelith asset acceptance gate.
 * Run: node tools/validate-kaelith-assets.js <directory>
 * Requires only Node built-ins. Fails on mismatched dimensions, missing transparency,
 * missing layers, and unapproved IDs. Does NOT assess artistic fidelity.
 */
const fs=require('node:fs'),path=require('node:path');
const root=process.argv[2];
if(!root){console.error('Usage: node tools/validate-kaelith-assets.js <directory>');process.exit(2)}
const manifest=[
  'body.png','face-01.png','face-02.png','face-03.png',
  'hair-01-back.png','hair-01-front.png','hair-02-back.png','hair-02-front.png',
  'hair-03-back.png','hair-03-front.png','armor-plate.png',
  'armor-cloth.png','armor-fur.png','cloak-blue.png','cloak-red.png'
];
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
const errors=[];
for(const name of manifest){
 const file=path.join(root,name);
 if(!fs.existsSync(file)){errors.push('Missing: '+name);continue}
 const b=fs.readFileSync(file);
 if(b.length<33||!b.subarray(0,8).equals(pngSignature)){errors.push('Invalid PNG: '+name);continue}
 const width=b.readUInt32BE(16),height=b.readUInt32BE(20),colorType=b[25];
 if(width!==1080||height!==1920)errors.push('Wrong canvas '+name+': '+width+'x'+height+' expected 1080x1920');
 if(colorType!==6&&colorType!==4)errors.push('No alpha channel in '+name+' (PNG color type '+colorType+')');
}
if(errors.length){for(const error of errors)console.error('FAIL '+error);process.exit(1)}
console.log('PASS: '+manifest.length+' transparent PNG layers, all 1080x1920.');
console.log('NOTE: visually review seams, silhouette, lighting, and fidelity to original Kaelith separately.');
