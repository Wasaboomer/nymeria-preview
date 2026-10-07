/* M7.3 profession catalogue. English content, stable IDs. */
const ProfessionData = (() => {
  const schemaVersion = 1;
  const professions = [
    { id:"blacksmithing", name:"Blacksmithing", kind:"crafting", maxLevel:20 },
    { id:"herbalism", name:"Herbalism", kind:"gathering", maxLevel:20 },
    { id:"cartography", name:"Cartography", kind:"discovery", maxLevel:20 },
  ];
  const materials = [
    { id:"raw-iron", name:"Raw Iron" }, { id:"forged-iron", name:"Forged Iron" },
    { id:"wild-herbs", name:"Wild Herbs" }, { id:"weathered-map-fragment", name:"Weathered Map Fragment" },
    { id:"frontier-brace", name:"Frontier Brace", collective:true },
  ];
  const recipes = [
    { id:"forge-iron", profession:"blacksmithing", level:1, costs:{"raw-iron":3}, outputs:{"forged-iron":1}, xp:18 },
    { id:"frontier-brace", profession:"blacksmithing", level:2, costs:{"forged-iron":2}, outputs:{"frontier-brace":1}, xp:30,
      purpose:"A reinforced component prepared for future guild construction." },
    { id:"chart-vesper-fragment", profession:"cartography", level:1, costs:{"weathered-map-fragment":3}, outputs:{}, xp:35,
      discovery:"vesper-fragment-chart", purpose:"Assemble three fragments into a readable frontier chart." },
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