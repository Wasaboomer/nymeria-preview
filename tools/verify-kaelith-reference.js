#!/usr/bin/env node
// Verifies the exact frozen Kaelith source binary before asset extraction or review.
const fs=require('node:fs');
const crypto=require('node:crypto');
const expected='4f10e9fdbedfcd2c3934e22852fe9745651a6324e9523cf5d7f96e3d39350348';
const path=process.argv[2];
if(!path){console.error('Usage: node tools/verify-kaelith-reference.js <IMG_1972.jpeg>');process.exit(2)}
try{
 const digest=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
 if(digest!==expected){console.error('FAIL: file does not match the locked FIRST Kaelith concept.');console.error('Observed SHA-256: '+digest);process.exit(1)}
 console.log('PASS: exact original Kaelith reference verified.'); 
}catch(err){console.error('FAIL: '+err.message);process.exit(1)}
