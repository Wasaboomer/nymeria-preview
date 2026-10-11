/* Personal expedition/quest rewards use this policy. World/shared/trade ownership is unrestricted. */
const PersonalLoot = (() => {
  const node = typeof module !== "undefined" && module.exports;
  const gear = node ? require("./equipment-data.js") : GearData;
  const classes = node ? require("./classes-data.js") : ClassesData;
  const armor = node ? require("./armor-rules.js") : ArmorRules;
  const copy = (value) => JSON.parse(JSON.stringify(value));
  function preparation(profile) {
    const cls =
      classes.classes[profile?.classId] ||
      Object.values(classes.classes).find((c) => c.name === profile?.className);
    if (!cls) throw new Error("Unknown saved personal-loot class");
    if (profile.requirements?.supportPolicy !== undefined &&
        !classes.supportPolicies.includes(profile.requirements.supportPolicy))
      throw new Error("Unknown personal-loot support policy");
    return {
      version: 1,
      kind: "personalLoot",
      classId: cls.id,
      armorProficiency: armor.types.includes(profile.armorProficiency)
        ? profile.armorProficiency
        : cls.armorProficiency,
      weaponTypes: copy(profile.weaponTypes || cls.weaponTypes),
      supportTypes: copy(profile.supportTypes || cls.supportTypes),
      handedness: profile.handedness || cls.handedness,
      // Additive field only for a new resolved kit; old preparation is untouched.
      ...(profile.requirements?.supportPolicy ? { supportPolicy: profile.requirements.supportPolicy } : {}),
    };
  }
  function compatible(item, policy) {
    if (!item || !armor.compatible(item, policy)) return false;
    const requirements = { ...policy, supportPolicy: policy.supportPolicy || "required" };
    if (item.slot === "weapon") return classes.weaponCompatible(item, requirements);
    if (item.slot === "support") return classes.supportCompatible(item, requirements);
    return true;
  }
  function counterpart(id, policy) {
    const variants = gear.personalLootVariants[id] ||
      Object.values(gear.personalLootVariants).find((ids) =>
        ids.includes(id),
      ) || [id];
    return (
      variants.find((candidate) =>
        compatible(
          gear.items.find((i) => i.id === candidate),
          policy,
        ),
      ) || null
    );
  }
  function create(activity, profile) {
    const policy = preparation(profile);
    policy.lootIds = activity.lootTable
      .map((id) => counterpart(id, policy))
      .filter(Boolean);
    if (!policy.lootIds.length) throw new Error("No compatible personal loot");
    return policy;
  }
  function forActive(active) {
    const policy =
      active.lootPolicy || create(active.activity, active.snapshot.profile);
    if (
      policy.kind !== "personalLoot" ||
      policy.version !== 1 ||
      (policy.supportPolicy !== undefined && !classes.supportPolicies.includes(policy.supportPolicy)) ||
      !Array.isArray(policy.lootIds) ||
      !policy.lootIds.length ||
      !policy.lootIds.every((id) =>
        compatible(
          gear.items.find((i) => i.id === id),
          policy,
        ),
      )
    )
      throw new Error("Invalid personal loot policy");
    return copy(policy);
  }
  function migrateActive(active) {
    const migrated = copy(active);
    migrated.lootPolicy = forActive(active);
    return migrated;
  }
  function migrateReport(report) {
    const migrated = copy(report);
    const policy = report.lootPolicy || preparation(report);
    if (policy.kind !== "personalLoot") throw new Error("Unknown loot source");
    // An old unclaimed report keeps its encounter outcomes and reward quantities.
    // Only gear IDs acquire coherent counterparts for the class saved in that report.
    if (!report.lootPolicy)
      migrated.rewards.lootIds = report.rewards.lootIds
        .map((id) => counterpart(id, policy))
        .filter(Boolean);
    migrated.lootPolicy = copy(policy);
    return migrated;
  }
  return {
    preparation,
    compatible,
    counterpart,
    create,
    forActive,
    migrateActive,
    migrateReport,
  };
})();
if (typeof module !== "undefined" && module.exports)
  module.exports = PersonalLoot;
