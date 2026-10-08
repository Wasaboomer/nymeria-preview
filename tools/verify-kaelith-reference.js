#!/usr/bin/env node
// Verifies the exact frozen Kaelith source binary before asset extraction or review.
const fs=require('node:fs');
const crypto=require('node:crypto');
const expected='b437db548022dc40e86ba2050bebff4c935467bc9ae2bfb43e1810bfa4b447cb';
const path=process.argv[2];
if(!path){console.error('Usage: node tools/verify-kaelith-reference.js <original-image.png>');process.exit(2)}
try{
 const digest=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
 if(digest!==expected){console.error('FAIL: file does not match the locked FIRST Kaelith concept.');console.error('Observed SHA-256: '+digest);process.exit(1)}
 console.log('PASS: exact original Kaelith reference verified.'); 
}catch(err){console.error('FAIL: '+err.message);process.exit(1)}
