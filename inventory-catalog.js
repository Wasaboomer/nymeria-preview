/* Read-only inventory projection. Preserve source identity: never merge independent ledgers. */
const InventoryCatalog = (() => {
  function category(row) {
    if (row.source === 'equipment') return 'equipment';
    if (row.source === 'progression' || row.source === 'profession') return 'materials';
    if (row.source === 'quest') return 'quest';
    // Unrecognized objects remain reachable in All / Other, without guessed properties.
    return 'other';
  }
  function collect({equipment = [], progression = {}, profession = {}, materialNames = {}, professionMaterials = [], supplyNames = {}} = {}) {
    const rows = equipment.map(item => ({key:'equipment:'+item.id, source:'equipment', item}));
    const append = (source, values, names) => {
      Object.entries(values || {}).forEach(([id, quantity]) => {
        if (!Number.isSafeInteger(quantity) || quantity <= 0) return;
        rows.push({key:source+':'+id, source, id, name:names[id] || id, quantity});
      });
    };
    append('progression', {crowns:progression.crowns, ...progression.materials}, {crowns:'Corone', ...materialNames});
    append('profession', profession.materials, Object.fromEntries(professionMaterials.map(m=>[m.id,m.name])));
    append('quest', progression.frontier?.supplies, supplyNames);
    return rows;
  }
  const api = {category, collect};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  return api;
})();
