/* One progression ledger, absolute deadlines, atomic location/event/arrival receipt. */
const TravelEngine = (() => {
  const node=typeof module!=='undefined'&&module.exports;
  const data=node?require('./travel-data.js'):TravelData;
  const world=node?require('./world-data.js'):WorldData;
  const events=node?require('./quest-events.js'):QuestEvents;
  const access=node?require('./travel-access.js'):TravelAccess;
  const copy=x=>JSON.parse(JSON.stringify(x));
  const time=x=>Number.isSafeInteger(x)&&x>=0&&x<=1e15;
  const empty=()=>({version:1,active:null,lastArrival:null,recoveryRequired:false});
  function validSnapshot(s){
    if(s?.version===1)return true;
    return s?.version===2&&access.environments.includes(s.environment)&&
      (s.raceId===null||typeof s.raceId==='string')&&Array.isArray(s.satisfiedRequirements)&&
      s.satisfiedRequirements.every(r=>typeof r?.id==='string'&&['natural','context'].includes(r.source))&&
      Array.isArray(s.environmentalModifiers)&&s.environmentalModifiers.length===0;
  }
  function validTicket(t) {
    return t && /^travel-\d+$/.test(t.id) && t.completionId===t.id+':arrival' &&
      typeof t.routeId==='string' && !!data.get(t.routeId) &&
      t.originId===data.get(t.routeId).originId&&t.destinationId===data.get(t.routeId).destinationId&&
      world.location(t.originId) && world.location(t.destinationId) && t.originId!==t.destinationId &&
      time(t.startedAt)&&time(t.endsAt)&&Number.isSafeInteger(t.durationMs)&&
      t.durationMs>0&&t.durationMs<=data.maxDurationMs&&t.endsAt-t.startedAt===t.durationMs&&
      validSnapshot(t.requirementsSnapshot)&&t.requirementsSnapshot.satisfied===true&&
      Number.isInteger(t.requirementsSnapshot.level)&&t.requirementsSnapshot.level>=1&&
      t.requirementsSnapshot.originUnlocked===true&&t.requirementsSnapshot.destinationUnlocked===true;
  }
  function normalize(raw, location, sequence) {
    const next=empty();
    if (!raw) return next;
    next.recoveryRequired=raw.recoveryRequired===true;
    if (validTicket(raw.lastArrival)&&time(raw.lastArrival.arrivedAt)&&raw.lastArrival.arrivedAt>=raw.lastArrival.endsAt)
      next.lastArrival=copy(raw.lastArrival);
    if (raw.active && raw.active.completionId!==next.lastArrival?.completionId) {
      if (validTicket(raw.active)) {
        next.active=copy(raw.active);
        if(Number(raw.active.id.slice(7))>sequence||location!==raw.active.originId)next.recoveryRequired=true;
      } else next.recoveryRequired=true; // Never guess an arrival from damaged metadata.
    }
    return next;
  }
  const unsupported=raw=>raw?.version>1||raw?.active?.requirementsSnapshot?.version>2||raw?.lastArrival?.requirementsSnapshot?.version>2;
  function create({store,now=()=>Date.now(),testMode=false,accessible=null,interactiveCombat=()=>false}) {
    const unlocked=(state,id)=>world.location(id)?.discoveryType?!!accessible?.(id):state.unlockedContent.includes('world:'+id);
    function contextReason(route,state=store.state) {
      if(!route || (route.testOnly&&!testMode))return 'Rotta non disponibile.';
      if(state.travel.recoveryRequired)return 'Dati di viaggio incoerenti: serve un recupero esplicito. Nessun arrivo applicato.';
      if(state.travel.active)return 'Un viaggio è già in corso.';
      if(state.frontier.activeEncounter||interactiveCombat())return 'Concludi l’incontro prima di partire.';
      if(state.frontier.location!==route.originId)return 'Raggiungi il punto di partenza.';
      if(!unlocked(state,route.originId)||!unlocked(state,route.destinationId))return 'Luogo non ancora accessibile.';
      return '';
    }
    function evaluate(route,state=store.state){
      const reason=contextReason(route,state);
      return access.evaluateRouteAccess(state.characterIdentity,route,{level:state.level,available:!reason,reason});
    }
    const eligibility=(route,state=store.state)=>evaluate(route,state).reason;
    function start(routeId) {
      return store.transact(state=>{
        const route=data.get(routeId),evaluation=evaluate(route,state);
        if(!evaluation.accessible)return {ok:false,message:evaluation.reason};
        const startedAt=now(),durationMs=evaluation.baseDurationMs;
        if(!time(startedAt)||!time(startedAt+durationMs))return {ok:false,message:'Orologio locale non valido.'};
        state.sequence++;
        const id='travel-'+state.sequence;
        state.travel.active={id,routeId:route.id,originId:route.originId,destinationId:route.destinationId,
          startedAt,endsAt:startedAt+durationMs,durationMs,completionId:id+':arrival',
          requirementsSnapshot:{version:2,satisfied:true,level:state.level,originUnlocked:true,destinationUnlocked:true,
            raceId:state.characterIdentity.raceId,environment:evaluation.environment,
            satisfiedRequirements:copy(evaluation.satisfiedRequirements),environmentalModifiers:[]}};
        return {ok:true,message:'Partenza salvata. Il viaggio prosegue anche a gioco chiuso.',ticket:copy(state.travel.active)};
      });
    }
    function refresh() {
      return store.transact(state=>{
        if(state.travel.recoveryRequired)return {ok:false,message:'Dati di viaggio incoerenti: nessun arrivo applicato.'};
        const ticket=state.travel.active,at=now();
        if(!ticket)return {ok:true,unchanged:true};
        if(!time(at))return {ok:false,message:'Orologio locale non valido.'};
        if(at<ticket.endsAt)return {ok:true,unchanged:true};
        if(state.frontier.activeEncounter||state.frontier.location!==ticket.originId)
          return {ok:false,message:'Posizione o incontro incompatibili: arrivo non applicato.'};
        if(!state.unlockedContent.includes("world:"+ticket.destinationId))state.unlockedContent.push("world:"+ticket.destinationId);
        state.frontier.location=ticket.destinationId;
        events.dispatch(state,{type:'visit',target:ticket.destinationId});
        state.travel.lastArrival={...copy(ticket),arrivedAt:at};
        state.travel.active=null;
        return {ok:true,message:'Viaggio concluso · '+world.location(ticket.destinationId).name,receipt:copy(state.travel.lastArrival)};
      });
    }
    return {start,refresh,eligibility,evaluate,testMode,get state(){return store.state.travel;},
      remaining:()=>Math.max(0,(store.state.travel.active?.endsAt||0)-now()),
      routes:()=>data.routes.filter(r=>!r.testOnly||testMode)};
  }
  return {empty,normalize,unsupported,validTicket,create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=TravelEngine;