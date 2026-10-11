/* Selection persistence is separate from appearance, inventory and combat preferences. */
const ClassSystem = (() => {
  const STORAGE_KEY = "nymeria.classes.v2", LEGACY_KEY = "nymeria.classes.v1";
  const initial = () => ({ classId: "hunter", builds: { hunter: "predator", warden: "bulwark" } });
  let state = initial(), storageError = false, readOnly = false, legacy = null;
  const listeners = new Set();
  function validSelection(raw) {
    return raw && ClassesData.classes[raw.classId] && Object.values(ClassesData.classes).every(cls => ClassesData.specializations[raw.builds?.[cls.id]]?.classId === cls.id);
  }
  function save(candidate) {
    if (readOnly) { storageError = true; return false; }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, ...candidate, legacy }));
      storageError = false; return true;
    } catch { storageError = true; return false; }
  }
  try {
    const oldText = localStorage.getItem(LEGACY_KEY);
    try { legacy = oldText ? JSON.parse(oldText) : null; } catch { storageError = true; }
    if (legacy && ClassesData.classes[legacy.classId]) state.classId = legacy.classId;
    for (const cls of Object.values(ClassesData.classes))
      if (cls.buildIds.includes(legacy?.builds?.[cls.id])) state.builds[cls.id] = legacy.builds[cls.id];
    const text = localStorage.getItem(STORAGE_KEY);
    if (text !== null) {
      const raw = JSON.parse(text);
      if (raw?.version !== 2 || !validSelection(raw)) { readOnly = true; storageError = true; }
      else { state = { classId: raw.classId, builds: CombatData.copy(raw.builds) }; legacy = raw.legacy ?? legacy; }
    } else save(state); // Additive migration: legacy key is never rewritten or removed.
  } catch { storageError = true; readOnly = true; }
  const selected = () => ClassesData.classes[state.classId];
  const build = () =>
    BuildSystem.getBuild(state.classId, state.builds[state.classId]);
  function publish() { listeners.forEach(fn => fn()); }
  function selectClass(id) {
    if (!ClassesData.classes[id]) return false;
    const next = { ...state, classId: id };
    if (!save(next)) { publish(); return false; }
    state = next;
    // Existing class armor reconciliation is unchanged. This is not a cross-store transaction.
    if (typeof Equipment !== "undefined") Equipment.reconcileProgression();
    publish(); return true;
  }
  function selectSpecialization(id) {
    const cls = selected();
    if (!(cls.specializationIds || cls.buildIds).includes(id) || ClassesData.specializations[id]?.classId !== cls.id) return false;
    const next = { ...state, builds: { ...state.builds, [state.classId]: id } };
    if (!save(next)) { publish(); return false; }
    state = next;
    publish(); return true;
  }
  const selectBuild = id => selected().buildIds.includes(id) && selectSpecialization(id);
  const resolved = (classId = state.classId, selectionId = state.builds[classId]) => ClassesData.resolve(classId, selectionId);
  function kitRequirement(main, support, classId = state.classId, selectionId = state.builds[classId]) {
    if (!ClassesData.classes[classId]) return false;
    return ClassesData.validKit(main, support, resolved(classId, selectionId).specialization.requirements);
  }
  function combatProfile(classId = state.classId, buildId = state.builds[classId], gear) {
    const { identity, specialization: spec } = resolved(classId, buildId);
    const kitValid = gear ? ClassesData.validKit(gear.main, gear.support, spec.requirements) : true;
    // Keep the existing snapshot schema and fields byte-for-byte for legacy profiles.
    return CombatData.copy({
      classId: identity.id, className: identity.name, armorProficiency: identity.armorProficiency,
      weaponTypes: spec.requirements.weaponTypes, supportTypes: spec.requirements.supportTypes,
      handedness: spec.requirements.handedness, buildId: spec.id, buildName: spec.name,
      ...(spec.legacyBuildId ? {} : { specializationId: spec.id, requirements: spec.requirements, role: spec.role, strategyControls: spec.strategyControls }),
      abilities: spec.abilities, resource: spec.resource, modifiers: kitValid ? spec.modifiers : {},
      abilityModifiers: spec.abilityModifiers, effectModifiers: spec.effectModifiers,
      resultMetrics: spec.resultMetrics, effects: spec.effects, defaultRules: spec.defaultRules, kitValid,
    });
  }

  return {
    STORAGE_KEY,
    get state() {
      return CombatData.copy(state);
    },
    get storageError() {
      return storageError;
    },
    resolved,
    kitRequirements: (classId, selectionId) => resolved(classId, selectionId).specialization.requirements,
    selected,
    build,
    selectClass,
    selectBuild,
    selectSpecialization,
    kitRequirement,
    combatProfile,
    subscribe: (fn) => listeners.add(fn),
  };
})();
