/* Pure access policy. External equipment/assistance has no implementation in 2.6. */
const TravelAccess=(()=>{
  const data=typeof module!=='undefined'&&module.exports?require('./character-identity-data.js'):CharacterIdentityData;
  const environments=['land','coastal','underwater'];
  const capabilityNames={'breathe-land':'respirazione terrestre','breathe-underwater':'respirazione subacquea'};
  const sources=['natural','external','unmet']; // External is reserved, never granted by caller assertions.
  function evaluateRouteAccess(character,route,context={}){
    const environment=route?.environment||'land',race=data.get(character?.raceId);
    const result={accessible:false,environment,raceId:race?.id||null,baseDurationMs:route?.baseDurationMs??route?.durationMs,
      satisfiedRequirements:[],missingRequirements:[],reason:'',environmentalModifiers:[],externalSupportImplemented:false};
    const miss=(id,reason,extra={})=>result.missingRequirements.push({id,source:'unmet',reason,...extra});
    const requirements=route?.environmentRequirements||{capabilities:[],tools:[],assistance:[]};
    if(!route||!environments.includes(environment)||!Number.isSafeInteger(result.baseDurationMs)||result.baseDurationMs<=0||
      result.baseDurationMs>604800000||!Number.isInteger(route.requirements?.minimumLevel)||route.requirements.minimumLevel<1||
      !['capabilities','tools','assistance'].every(k=>Array.isArray(requirements[k])))
      miss('definition','Definizione della rotta non valida.');
    else {
      if(context.available===false)miss('context',context.reason||'Rotta non disponibile.');
      if(route.available===false)miss('availability',route.unavailableReason||'Rotta non disponibile.');
      if(!Number.isInteger(context.level)||context.level<route.requirements.minimumLevel)miss('level','Livello insufficiente.');
      else result.satisfiedRequirements.push({id:'level',source:'context',level:context.level});
      const capabilities=[...new Set([...requirements.capabilities,...(environment==='underwater'?['breathe-underwater']:[])])];
      for(const id of capabilities){
        if(!capabilityNames[id])miss(id,'Capacità richiesta non supportata.');
        else if(race?.capabilities.includes(id))result.satisfiedRequirements.push({id,source:'natural',raceId:race.id});
        else miss(id,!race?'Identità razziale non assegnata: capacità richiesta non verificabile.':`Richiede ${capabilityNames[id]}. Strumenti respiratori e guide non sono ancora disponibili.`,
          {externalAlternatives:environment==='underwater'?['breathing-device','guide']:[],externalImplemented:false});
      }
      for(const kind of ['tools','assistance'])for(const id of requirements[kind])
        miss(kind+':'+String(id),'Strumento o assistenza richiesti non ancora implementati.',{externalImplemented:false});
    }
    result.accessible=result.missingRequirements.length===0;
    result.reason=result.missingRequirements.map(x=>x.reason).join(' ');
    return result;
  }
  return {environments,sources,evaluateRouteAccess};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=TravelAccess;
