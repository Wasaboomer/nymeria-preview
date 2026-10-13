import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@colyseus/sdk';
import {chromium} from 'playwright';
import {startLab,LOCATION} from '../server.mjs';
const wait=async fn=>{const end=Date.now()+5000;while(!fn()){if(Date.now()>end)throw Error('Expected lab event not received');await new Promise(r=>setTimeout(r,20));}};
async function connect(lab){const entry=await (await fetch(lab.url+'/api/ticket')).json();const api=new Client(lab.url);const room=await api.joinById(entry.roomId,{ticket:entry.ticket});room.reconnection.enabled=false;const data={presence:[],chat:[],errors:[],snapshot:null};room.onMessage('presence',s=>data.presence=s.people);room.onMessage('snapshot',s=>{data.snapshot=s;data.presence=s.people});room.onMessage('chat',m=>data.chat.push(m));room.onMessage('rejected',e=>data.errors.push(e.code));room.onError(()=>{});room.send('sync');await wait(()=>data.snapshot);return {api,room,data,entry};}
test('server-owned guest identities, single locality, validation/rate limit and reconnect expiry',async()=>{
 const lab=await startLab({port:0,reconnectSeconds:1});let a,b,recovered;
 try{
  a=await connect(lab);const identity=a.data.snapshot.you;
  await assert.rejects(()=>a.api.joinById(a.entry.roomId,{ticket:'invented'}));
  await assert.rejects(()=>a.api.joinById(a.entry.roomId,{ticket:a.entry.ticket}),'single-use ticket');
  const fake=await (await fetch(lab.url+'/api/ticket')).json();await assert.rejects(()=>a.api.joinById(fake.roomId,{ticket:fake.ticket,name:'Administrator',actorId:'player'}));
  assert.equal((await fetch(lab.url+'/api/ticket?name=Administrator')).status,400);
  await assert.rejects(()=>a.api.create('lab-locality',{}),'no second locality');
  b=await connect(lab);await assert.rejects(()=>connect(lab),'max two guests');await wait(()=>a.data.presence.filter(p=>p.online).length===2);assert.notEqual(identity.actorId,b.data.snapshot.you.actorId);
  a.room.send('chat',{channel:LOCATION,text:'Ciao'});await wait(()=>b.data.chat.length===1);assert.equal(b.data.chat[0].actorId,identity.actorId);assert.equal(b.data.chat[0].name,identity.name);b.room.send('chat',{channel:LOCATION,text:'Risposta'});await wait(()=>a.data.chat.length===2);assert.equal(a.data.chat[1].actorId,b.data.snapshot.you.actorId);
  for(const payload of [null,[],{channel:LOCATION,text:4},{channel:LOCATION,text:' '},{channel:LOCATION,text:'x'.repeat(201)},{channel:LOCATION,text:'x\ny'},{channel:'other',text:'x'},{channel:LOCATION,text:'x',actorId:'administrator'}])a.room.send('chat',payload);
  await wait(()=>a.data.errors.length===8);assert.equal(b.data.chat.length,2);assert.ok(a.data.errors.includes('unauthorized-channel'));
  for(let i=0;i<5;i++)a.room.send('chat',{channel:LOCATION,text:'burst'+i});await wait(()=>a.data.errors.includes('rate-limit'));assert.equal(b.data.chat.length,4);
  const token=a.room.reconnectionToken;a.room.connection.close();await wait(()=>b.data.presence.some(p=>p.actorId===identity.actorId&&!p.online));
  recovered=await a.api.reconnect(token);recovered.reconnection.enabled=false;let snapshot;recovered.onMessage('snapshot',s=>snapshot=s);recovered.onMessage('presence',()=>{});recovered.onMessage('chat',()=>{});let recoveryError;recovered.onMessage('rejected',e=>recoveryError=e.code);recovered.send('sync');await wait(()=>snapshot);assert.deepEqual(snapshot.you,identity);recovered.send('chat',{channel:LOCATION,text:'retry burst'});await wait(()=>recoveryError==='rate-limit');assert.equal(b.data.chat.length,4);await wait(()=>b.data.presence.filter(p=>p.online).length===2);
  await recovered.leave();recovered=null;await wait(()=>b.data.presence.length===1);
  const expired=b.room.reconnectionToken;b.room.connection.close();await new Promise(r=>setTimeout(r,1200));await assert.rejects(()=>b.api.reconnect(expired));
 }finally{for(const room of [a?.room,b?.room,recovered])if(room?.connection.isOpen)await room.leave().catch(()=>{});await lab.close();}
});
test('two real browser clients: controls, literal HTML chat, leave and reconnect; no storage access',async()=>{
 const lab=await startLab({port:0}),browser=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||undefined,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});const errors=[];
  await context.addInitScript(()=>{window.storageReads=0;window.labRejections=[];for(const method of ['getItem','setItem','removeItem','clear'])Storage.prototype[method]=()=>{storageReads++;throw Error('Lab must not access storage')};addEventListener('unhandledrejection',e=>labRejections.push(String(e.reason)));});
  const a=await context.newPage(),b=await context.newPage();for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));await a.goto(lab.url);await b.goto(lab.url);
  await a.locator('#join').click();await b.locator('#join').click();await a.waitForFunction(()=>document.querySelectorAll('#people li').length===2);await b.waitForFunction(()=>document.querySelectorAll('#people li').length===2);
  const name=await a.locator('#status').innerText();await a.locator('#text').fill('<img src=x onerror="window.bad=true">');await a.locator('#submit').click();await b.waitForFunction(()=>document.querySelectorAll('#chat li').length===1);assert.equal(await b.locator('#chat img').count(),0);assert.equal(await b.evaluate(()=>window.bad),undefined);
  await a.locator('#drop').click();await b.waitForFunction(()=>document.querySelector('#people').textContent.includes('disconnesso'));await a.locator('#reconnect').click();await a.waitForFunction(()=>!document.getElementById('submit').disabled);await a.waitForFunction(name=>document.getElementById('status').textContent===name,name);
  await a.locator('#leave').click();await b.waitForFunction(()=>document.querySelectorAll('#people li').length===1);assert.equal(await a.evaluate(()=>storageReads),0);assert.equal(await b.evaluate(()=>storageReads),0);assert.deepEqual(await a.evaluate(()=>labRejections),[]);assert.deepEqual(await b.evaluate(()=>labRejections),[]);assert.deepEqual(errors,[]);assert.ok(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await b.locator('#leave').click();await context.close();
 }finally{await browser.close();await lab.close();}
});
