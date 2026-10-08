/* M7.3 profession catalogue. Italian labels, stable IDs. */
const ProfessionData = (() => {
  const schemaVersion = 1;
  const professions = [
    { id:"blacksmithing", name:"Forgiatura", kind:"crafting", maxLevel:20 },
    { id:"herbalism", name:"Erboristeria", kind:"gathering", maxLevel:20 },
    { id:"cartography", name:"Cartografia", kind:"discovery", maxLevel:20 },
  ];
  const materials = [
    { id:"raw-iron", name:"Ferro grezzo" }, { id:"forged-iron", name:"Ferro forgiato" },
    { id:"wild-herbs", name:"Erbe selvatiche" }, { id:"weathered-map-fragment", name:"Frammento di mappa consumato" },
    { id:"frontier-brace", name:"Rinforzo della Frontiera", collective:true },
  ];
  const recipes = [
    { id:"forge-iron", profession:"blacksmithing", level:1, costs:{"raw-iron":3}, outputs:{"forged-iron":1}, xp:18 },
    { id:"frontier-brace", profession:"blacksmithing", level:2, costs:{"forged-iron":2}, outputs:{"frontier-brace":1}, xp:30,
      purpose:"Componente rinforzato; in questa versione non è ancora utilizzabile nei progetti di gilda." },
    { id:"chart-vesper-fragment", profession:"cartography", level:1, costs:{"weathered-map-fragment":3}, outputs:{}, xp:35,
      discovery:"vesper-fragment-chart", purpose:"Unisci tre frammenti e registra una carta della Frontiera; non sblocca nuovi luoghi in questa versione." },
  ];
  const gathering = [
    { id:"vesper-iron-vein", location:"broken-path", profession:"blacksmithing", material:"raw-iron", amount:2, xp:10 },
    { id:"vesper-herbs", location:"lantern-wood", profession:"herbalism", material:"wild-herbs", amount:2, xp:12 },
    { id:"vesper-map-scrap", location:"vesper-outpost", profession:"cartography", material:"weathered-map-fragment", amount:1, xp:15 },
  ];
  const profession=(id)=>professions.find(x=>x.id===id)||null;
  const recipe=(id)=>recipes.find(x=>x.id===id)||null;
  const node=(id)=>gathering.find(x=>x.id===id)||null;
  const api={schemaVersion,professions,materials,recipes,gathering,profession,recipe,node};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  return api;
})();