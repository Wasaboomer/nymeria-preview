/* Single-ledger reward preflight. Capacity admission is injected and inactive by default. */
const RewardDelivery = (() => {
  const node = typeof module !== 'undefined' && module.exports;
  const data = node ? require('./progression-data.js') : ProgressionData;
  const gear = node ? require('./equipment-data.js') : GearData;
  const classes = node ? require('./classes-data.js') : ClassesData;
  const world = node ? require('./world-data.js') : WorldData;
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const quantity = value => Number.isSafeInteger(value) && value >= 0 && value <= 1e9;
  const allowed = ['xp','crowns','materials','lootIds','items','personalLoot','achievements'];
  function validReward(reward) {
    return object(reward) && Object.keys(reward).every(key => allowed.includes(key)) &&
      ['xp','crowns'].every(key => reward[key] === undefined || quantity(reward[key])) &&
      (reward.materials === undefined || (object(reward.materials) && Object.entries(reward.materials)
        .every(([id,amount]) => Object.hasOwn(data.materialNames,id) && quantity(amount)))) &&
      ['lootIds','items','personalLoot'].every(key => reward[key] === undefined ||
        (Array.isArray(reward[key]) && reward[key].every(id => gear.items.some(item => item.id === id)))) &&
      (reward.achievements === undefined || (Array.isArray(reward.achievements) && reward.achievements.every(id => world.achievements.some(entry => entry.id === id))));
  }
  function plan(state, reward, catalogue = gear.items) {
    if (!validReward(reward)) return {ok:false,code:'invalid-reward',message:'Ricompensa non riconosciuta: nessun accredito applicato.'};
    if (state.crowns + (reward.crowns || 0) > 1e9)
      return {ok:false,code:'currency-overflow',pending:true,message:'Corone al limite: ricompensa conservata, riprova dopo averle utilizzate.'};
    const materials = {...state.materials}, owned = new Set(state.ownedLootIds), produces = [], loot = [];
    for (const [id,amount] of Object.entries(reward.materials || {})) materials[id] += amount;
    for (const itemId of reward.lootIds || []) {
      const item = catalogue.find(item => item.id === itemId && item.expeditionOnly);
      if (!item) return {ok:false,code:'unsupported-loot',message:'Oggetto della ricompensa non accreditabile: premio conservato.'};
      const duplicate = owned.has(itemId);
      if (duplicate) materials.iron += 2; else owned.add(itemId);
      loot.push({itemId,duplicate});
    }
    for (const [id,amount] of Object.entries(materials)) {
      if (!quantity(amount)) return {ok:false,code:'material-overflow',pending:true,message:'Materiali al limite: ricompensa conservata, libera spazio e riprova.'};
      const added = amount - state.materials[id];
      if (added) produces.push({key:`progression:${id}`,quantity:added});
    }
    return {ok:true,produces,loot,materials};
  }
  function validQuestPending(value, id) {
    return object(value) && value.version === 1 && value.id === `quest:${id}` &&
      Object.keys(value).every(key => ['version','id','rewards','lootPolicy','createdAt','contentUnlocks','title'].includes(key)) &&
      typeof value.title === 'string' && value.title.length > 0 &&
      Array.isArray(value.contentUnlocks) && value.contentUnlocks.every(id => !!world.location(id)) &&
      Number.isSafeInteger(value.createdAt) && value.createdAt >= 0 && validReward(value.rewards) &&
      value.lootPolicy?.version === 1 && value.lootPolicy.kind === 'personalLoot' &&
      Object.keys(value.lootPolicy).every(key => ['version','kind','classId','armorProficiency','weaponTypes','supportTypes','handedness','supportPolicy'].includes(key)) &&
      !!classes.classes[value.lootPolicy.classId] &&
      value.lootPolicy.armorProficiency === classes.classes[value.lootPolicy.classId].armorProficiency &&
      ['1H','2H'].includes(value.lootPolicy.handedness) &&
      ['weaponTypes','supportTypes'].every(key => Array.isArray(value.lootPolicy[key]) && value.lootPolicy[key].every(x => typeof x === 'string')) &&
      (value.lootPolicy.supportPolicy === undefined || classes.supportPolicies.includes(value.lootPolicy.supportPolicy));
  }
  function validWorldReceipt(receipt) {
    if (receipt.deliveryVersion === undefined && receipt.rewardStatus === undefined) return true;
    return receipt.deliveryVersion === 1 && ['pending','delivered'].includes(receipt.rewardStatus) &&
      Object.keys(receipt).every(key => ['id','enemyId','enemyName','location','outcome','rewards','drops','result','className','awardedAt',
        'previousLevel','resultingLevel','levelUps','growthClassId','statGains','loot','deliveryVersion','rewardStatus','completedAt'].includes(key)) &&
      /^world-\d+$/.test(receipt.id) && !!world.enemy(receipt.enemyId) && !!world.location(receipt.location) &&
      ['victory','defeat'].includes(receipt.outcome) && receipt.result?.outcome === receipt.outcome &&
      Number.isSafeInteger(receipt.completedAt) && receipt.completedAt >= 0 && validReward(receipt.rewards) &&
      Array.isArray(receipt.drops) && receipt.drops.every(id => Object.hasOwn(world.supplyNames,id)) &&
      (receipt.rewardStatus !== 'delivered' || (Number.isSafeInteger(receipt.awardedAt) && receipt.awardedAt >= 0 && Array.isArray(receipt.levelUps)));
  }
  function pending(id, reason) {
    return {ok:true,pending:true,rewardStatus:'pending',id,reason,
      message:'Ricompensa conservata e non accreditata. Libera spazio o riprova quando il salvataggio è disponibile.'};
  }
  return {validReward,plan,validQuestPending,validWorldReceipt,pending};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = RewardDelivery;
