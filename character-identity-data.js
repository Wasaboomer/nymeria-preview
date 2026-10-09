/* Gameplay identity catalogue; never inferred from visual assets or class. */
const CharacterIdentityData=(()=>{
  const races=[['human','Umani'],['velhiri','Velhiri'],['kharun','Kharun'],['sylani','Sylani'],
    ['thalassi','Thalassi'],['draeth','Draeth'],['orlani','Orlani']].map(([id,name])=>
      ({id,name,capabilities:id==='thalassi'?['breathe-land','breathe-underwater']:['breathe-land']}));
  const get=id=>races.find(r=>r.id===id)||null;
  const normalize=raw=>({version:1,raceId:raw?.version===1&&get(raw.raceId)?raw.raceId:null});
  return {version:1,races,get,normalize};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=CharacterIdentityData;
