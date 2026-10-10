/* Provisional Gear Advisor. Score components can grow to include sets/synergies. */
const BuildSystem = (() => {
  const data =
    typeof module !== "undefined" && module.exports
      ? require("./classes-data.js")
      : ClassesData;
  const armor =
    typeof module !== "undefined" && module.exports
      ? require("./armor-rules.js")
      : ArmorRules;
  function getBuild(classId, buildId) {
    const cls = data.classes[classId] || data.classes.hunter;
    const selection = data.specializations[buildId]?.classId === cls.id ? buildId : cls.defaultBuild;
    return data.builds[selection] || data.resolve(cls.id, selection).specialization;
  }
  function compatible(item, classId, selectionId) {
    const cls = data.classes[classId];
    if (!item || !cls || !armor.compatible(item, cls)) return false;
    const requirements = data.resolve(classId, selectionId).specialization.requirements;
    if (item.slot === "weapon") return data.weaponCompatible(item, requirements);
    if (item.slot === "support") return data.supportCompatible(item, requirements);
    return true;
  }
  const scoreHooks = [];
  function scoreBreakdown(item, classId, buildId) {
    if (!compatible(item, classId, buildId)) return null;
    const build = getBuild(classId, buildId);
    const stats = Object.entries(item.stats).reduce(
      (sum, [key, value]) => sum + value * (build.weights[key] || 0),
      0,
    );
    const effects = (item.effects || []).reduce(
      (sum, effect) => sum + (build.effectWeights?.[effect.id] || 0),
      0,
    );
    const synergy = scoreHooks.reduce(
      (sum, hook) => sum + hook(item, data.classes[classId], build),
      0,
    );
    return { stats, effects, synergy, total: stats + effects + synergy };
  }
  function scoreItemForBuild(item, classId, buildId) {
    return scoreBreakdown(item, classId, buildId)?.total ?? null;
  }
  function advise(
    item,
    slot,
    classId,
    buildId,
    equipment,
    { includeCandidate = false } = {},
  ) {
    const score = scoreItemForBuild(item, classId, buildId);
    if (score === null || item.requiredLevel > equipment.state.character.level)
      return null;
    const candidates = equipment.state.inventory.filter(
      (candidate) =>
        equipment.compatibleSlots(candidate).includes(slot) &&
        candidate.requiredLevel <= equipment.state.character.level &&
        compatible(candidate, classId, buildId),
    );
    if (
      includeCandidate &&
      !candidates.some((candidate) => candidate.id === item.id)
    )
      candidates.push(item);
    const bestScore = Math.max(
      ...candidates.map((candidate) =>
        scoreItemForBuild(candidate, classId, buildId),
      ),
    );
    const current = equipment.equipped(slot);
    const currentScore = scoreItemForBuild(current, classId, buildId) || 0;
    return {
      score,
      currentScore,
      delta: score - currentScore,
      bestOwned: Math.abs(score - bestScore) < 1e-8,
      improvement:
        !item.equipped &&
        item.id !== current?.id &&
        !(includeCandidate
          ? equipment.canEquipCandidate(item, slot)
          : equipment.canEquip(item.id, slot)) &&
        score - currentScore > Math.max(2, Math.abs(currentScore) * 0.05),
    };
  }
  return {
    getBuild,
    compatible,
    scoreBreakdown,
    scoreItemForBuild,
    advise,
    registerScoreHook: (hook) => scoreHooks.push(hook),
  };
})();
if (typeof module !== "undefined" && module.exports)
  module.exports = BuildSystem;
