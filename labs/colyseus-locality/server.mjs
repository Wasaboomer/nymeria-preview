import {Server,Room,matchMaker,ServerError} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {randomUUID,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const LOCATION='localita-di-prova';
export async function startLab({port=8036,reconnectSeconds=8}={}) {
  const tickets=new Map();let sequence=0,activeRoom=null,roomId;
  class Locality extends Room {
    onCreate() {
      if(activeRoom)throw new ServerError(400,'Una sola località di laboratorio è consentita.');
      activeRoom=this;this.maxClients=2;this.autoDispose=false;this.people=new Map();this.history=[];
      this.onMessage('sync',client=>this.snapshot(client));
      this.onMessage('chat',(client,payload)=>{
        const person=this.people.get(client.sessionId);
        const error=code=>client.send('rejected',{code});
        if(!person?.online)return error('not-authorized');
        if(!payload || typeof payload!=='object' || Array.isArray(payload) || Object.keys(payload).some(k=>!['text','channel'].includes(k)))return error('invalid-payload');
        if(payload.channel!==LOCATION)return error('unauthorized-channel');
        if(typeof payload.text!=='string' || !payload.text.trim() || payload.text.length>200 || /[\u0000-\u001f\u007f]/u.test(payload.text))return error('invalid-text');
        const now=Date.now();person.attempts=person.attempts.filter(t=>now-t<2000);
        if(person.attempts.length>=3)return error('rate-limit');
        person.attempts.push(now);
        const message={id:randomUUID(),actorId:person.actorId,name:person.name,channel:LOCATION,text:payload.text.trim(),at:now};
        this.history.push(message);this.history=this.history.slice(-20);this.broadcast('chat',message);
      });
    }
    onAuth(_client,options={}) {
      if(!options || typeof options!=='object' || Array.isArray(options) || Object.keys(options).some(k=>k!=='ticket'))throw new ServerError(401,'Identità client non accettata.');
      const entry=tickets.get(options.ticket);tickets.delete(options.ticket);
      if(!entry || entry.expires<=Date.now())throw new ServerError(401,'Ticket ospite non valido o già usato.');
      return {actorId:entry.actorId,name:entry.name};
    }
    onJoin(client) {this.people.set(client.sessionId,{...client.auth,online:true,attempts:[]});this.publishPresence();}
    snapshot(client) {client.send('snapshot',{location:LOCATION,you:client.auth,people:this.roster(),history:this.history});}
    roster() {return [...this.people.values()].map(({actorId,name,online})=>({actorId,name,online}));}
    publishPresence() {this.broadcast('presence',{location:LOCATION,people:this.roster()});}
    onDrop(client) {
      const person=this.people.get(client.sessionId);if(person)person.online=false;this.publishPresence();
      // Colyseus expires the reservation and invokes onLeave on failed recovery.
      this.allowReconnection(client,reconnectSeconds).catch(()=>{});
    }
    onReconnect(client) {const person=this.people.get(client.sessionId);if(person)person.online=true;this.publishPresence();this.snapshot(client);}
    onLeave(client) {this.people.delete(client.sessionId);this.publishPresence();}
    onDispose() {if(activeRoom===this)activeRoom=null;tickets.clear();}
  }
  const root=fileURLToPath(new URL('.',import.meta.url));
  const transport=new WebSocketTransport();
  const game=new Server({transport,greet:false,gracefullyShutdown:false,express:app=>{
    app.get('/',(_req,res)=>res.sendFile(root+'public/index.html'));
    app.get('/client.js',(_req,res)=>res.sendFile(root+'.generated/client.js',{dotfiles:'allow'}));
    app.get('/api/ticket',(req,res)=>{
      res.set('Cache-Control','no-store');
      if(Object.keys(req.query).length)return res.status(400).json({error:'Nessuna identità selezionabile dal client.'});
      const now=Date.now();for(const [key,v]of tickets)if(v.expires<now)tickets.delete(key);
      if(tickets.size>=32)return res.status(429).json({error:'Troppi ticket pendenti.'});
      const ticket=randomBytes(24).toString('hex');
      tickets.set(ticket,{actorId:'lab-'+randomUUID(),name:`Ospite di prova ${++sequence}`,expires:now+60000});
      res.json({ticket,roomId,location:LOCATION});
    });
  }});
  game.define('lab-locality',Locality);
  await game.listen(port,'127.0.0.1');
  const created=await matchMaker.createRoom('lab-locality',{});roomId=created.roomId;
  const address=transport.server.address();
  return {url:`http://127.0.0.1:${address.port}`,close:()=>game.gracefullyShutdown(false)};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const lab=await startLab({port:Number(process.env.LAB_PORT||8036)});
  console.log(`Laboratorio locale: ${lab.url} — aprire due schede. Nessun account o salvataggio NYMERIA.`);
  const stop=()=>lab.close().then(()=>process.exit(0));process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
