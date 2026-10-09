/* Identity writes use the existing progression transaction; no renderer/storage bridge. */
const CharacterIdentityEngine=(()=>{
  const data=typeof module!=='undefined'&&module.exports?require('./character-identity-data.js'):CharacterIdentityData;
  function create({store,testMode=false}){
    function assign(raceId){return store.transact(state=>{
      if(!data.get(raceId))return {ok:false,message:'Razza non valida.'};
      if(state.travel.active||state.travel.recoveryRequired)return {ok:false,message:'Concludi o recupera il viaggio prima di scegliere la razza.'};
      if(state.characterIdentity.raceId===raceId)return {ok:true,unchanged:true,message:'Identità già registrata.'};
      if(state.characterIdentity.raceId&&!testMode)return {ok:false,message:'La razza è già assegnata. Il cambio è disponibile soltanto in TEST.'};
      state.characterIdentity={version:1,raceId};return {ok:true,message:'Identità razziale salvata. Aspetto e statistiche invariati.'};
    });}
    function reset(){if(!testMode)return Promise.resolve({ok:false,message:'Reset disponibile soltanto in TEST.'});
      return store.transact(state=>{
        if(state.travel.active||state.travel.recoveryRequired)return {ok:false,message:'Concludi o recupera il viaggio prima del reset.'};
        if(state.characterIdentity.raceId===null)return {ok:true,unchanged:true};
        state.characterIdentity={version:1,raceId:null};return {ok:true,message:'TEST · identità non assegnata. Altri progressi conservati.'};
      });}
    return {assign,reset,testMode,get state(){return store.state.characterIdentity;}};
  }
  return {create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=CharacterIdentityEngine;
