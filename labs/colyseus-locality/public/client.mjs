import {Client} from '@colyseus/sdk';
const api=new Client(location.origin),node=id=>document.getElementById(id);
let room=null,reconnectionToken=null;
function status(text){node('status').textContent=text;}
function roster(people){node('people').replaceChildren(...people.map(p=>{const li=document.createElement('li');li.textContent=`${p.name} · ${p.online?'online':'disconnesso, posto riservato'}`;return li;}));}
function chat(m){const li=document.createElement('li');li.textContent=`${m.name}: ${m.text}`;li.dataset.messageId=m.id;node('chat').append(li);while(node('chat').children.length>20)node('chat').firstChild.remove();}
function controls(connected){for(const id of ['leave','drop','submit'])node(id).disabled=!connected;node('join').disabled=connected||!!reconnectionToken;node('reconnect').disabled=connected||!reconnectionToken;}
function wire(r){
 let dropped=false;
 room=r;room.reconnection.enabled=false;reconnectionToken=r.reconnectionToken;
 r.onMessage('snapshot',s=>{status(`${s.you.name} · ${s.location}`);roster(s.people);node('chat').replaceChildren();s.history.forEach(chat);});
 r.onMessage('presence',s=>roster(s.people));r.onMessage('chat',chat);r.onMessage('rejected',e=>status('Messaggio rifiutato: '+e.code));
 r.onDrop(()=>{dropped=true;controls(false);status('Disconnesso. Riconnetti entro 8 secondi; identità e limite chat restano quelli del server.');});
 r.onLeave(()=>{if(dropped && reconnectionToken){controls(false);return;}room=null;reconnectionToken=null;controls(false);roster([]);status('Uscita completata o riconnessione scaduta.');});
 r.onError((_code,message)=>status('Errore: '+message));controls(true);r.send('sync');
}
node('join').onclick=async()=>{node('join').disabled=true;try{const response=await fetch('/api/ticket');if(!response.ok)throw Error('Ticket non disponibile');const entry=await response.json();wire(await api.joinById(entry.roomId,{ticket:entry.ticket}));}catch(e){status(e.message);controls(false);}};
node('leave').onclick=async()=>{const r=room;reconnectionToken=null;await r?.leave();};
node('drop').onclick=()=>room?.connection.close();
node('reconnect').onclick=async()=>{const token=reconnectionToken;node('reconnect').disabled=true;try{wire(await api.reconnect(token));}catch(e){room=null;reconnectionToken=null;controls(false);roster([]);status('Riconnessione rifiutata/scaduta: '+e.message);}};
node('send').onsubmit=e=>{e.preventDefault();if(room&&!node('submit').disabled){room.send('chat',{channel:'localita-di-prova',text:node('text').value});node('text').value='';}};
