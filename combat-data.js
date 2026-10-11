/* Tunable prototype rules. No equipment stats are duplicated here. */
const CombatData = (() => {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const formulas = {
    maxHp: (stats) => Math.round(160 + stats.vigor * 9),
    damage: (stats) =>
      8 + stats.force * 0.75 + stats.agility * 1.3 + stats.spirit * 0.3,
    mitigated: (damage, armor) => (damage * 100) / (100 + Math.max(0, armor)),
    criticalChance: (stats) =>
      clamp(0.05 + stats.agility * 0.0015 + stats.critical / 100, 0, 0.6),
    criticalMultiplier: 1.75,
    gcd: (stats) =>
      Math.max(0.55, 1.6 / (1 + stats.speed / 100 + stats.agility / 200)),
    dodgeChance: (stats, bonus = 0) =>
      clamp(stats.agility * 0.001 + bonus, 0, 0.35),
  };
  const effects = {
    bleeding: {
      id: "bleeding",
      name: "Sanguinamento",
      kind: "debuff",
      duration: 6,
      tickInterval: 1,
      maxStacks: 1,
      damageCoefficient: 0.12,
    },
    wind: {
      id: "wind",
      name: "Passo del Vento",
      kind: "buff",
      duration: 6,
      maxStacks: 1,
      modifiers: { agility: 8, speed: 20, dodge: 0.12 },
    },
  };
  const abilities = [
    {
      id: "rapid",
      name: "Tiro Rapido",
      description: "Attacco base affidabile, senza cooldown proprio.",
      cooldown: 0,
      kind: "attack",
      coefficient: 0.65,
      flatDamage: 8,
      tags: ["rangedHit"],
    },
    {
      id: "lacerating",
      name: "Freccia Lacerante",
      description: "Applica Sanguinamento per 6 s, con un tick ogni secondo.",
      cooldown: 4,
      kind: "attack",
      coefficient: 0.55,
      flatDamage: 4,
      effectId: "bleeding",
      tags: ["rangedHit"],
    },
    {
      id: "power",
      name: "Tiro Potente",
      description: "Danno elevato. Cooldown di 6 s.",
      cooldown: 6,
      kind: "attack",
      coefficient: 1.8,
      flatDamage: 12,
      tags: ["rangedHit"],
    },
    {
      id: "final",
      name: "Colpo Finale",
      description: "Danno ×2,3 quando il nemico è sotto il 25% HP.",
      cooldown: 5,
      kind: "attack",
      coefficient: 0.85,
      flatDamage: 8,
      executeBelow: 0.25,
      executeMultiplier: 2.3,
      tags: ["rangedHit"],
    },
    {
      id: "wind",
      name: "Passo del Vento",
      description: "Per 6 s: Agilità +8, Velocità +20%, Schivata +12%.",
      cooldown: 12,
      kind: "buff",
      effectId: "wind",
      tags: [],
    },
  ];
  const conditions = [
    { id: "resourceAbove", label: "Risorsa > X" },
    { id: "resourceBelow", label: "Risorsa < X" },
    { id: "always", label: "Sempre" },
    { id: "debuffAbsent", label: "Se debuff assente" },
    { id: "buffAbsent", label: "Se buff assente" },
    { id: "enemyHpBelow", label: "Se HP nemico < X%" },
    { id: "playerHpBelow", label: "Se HP giocatore < X%" },
    { id: "ready", label: "Se abilità pronta" },
  ];
  const defaultRules = [
    {
      abilityId: "lacerating",
      condition: { type: "debuffAbsent", effectId: "bleeding" },
    },
    { abilityId: "final", condition: { type: "enemyHpBelow", threshold: 25 } },
    { abilityId: "power", condition: { type: "always" } },
    { abilityId: "wind", condition: { type: "buffAbsent", effectId: "wind" } },
    { abilityId: "rapid", condition: { type: "always" } },
  ];
  const enemies = {
    guardian: {
      id: "guardian",
      name: "Guardiano delle Rovine",
      level: 1,
      difficulty: 1,
      rewards: { xpPerLevel: 35, crownsPerLevel: 4 },
      maxHp: 1050,
      armor: 35,
      attackInterval: 2.4,
      attacks: [
        {
          id: "ruin-crush",
          name: "Frattura delle Rovine",
          damage: 72,
          cooldown: 8,
          initialDelay: 4,
        },
        {
          id: "guardian-strike",
          name: "Colpo del Guardiano",
          damage: 44,
          cooldown: 0,
          initialDelay: 0,
        },
      ],
    },
  };
  function enemyRewards(enemy) {
    const factor =
      Math.max(1, enemy.level || 1) * Math.max(1, enemy.difficulty || 1);
    return {
      xp: Math.round((enemy.rewards?.xpPerLevel || 0) * factor),
      crowns: Math.round((enemy.rewards?.crownsPerLevel || 0) * factor),
    };
  }
  // Resolve equipped effect IDs, never displayed item names. Other hooks remain unimplemented.
  const itemHooks = {
    "thorn-bleed": {
      trigger: "rangedHit",
      chance: 0.3,
      effectId: "bleeding",
      tickMultiplier: 1.35,
      extraDuration: 2,
    },
  };
  const copy = (value) => JSON.parse(JSON.stringify(value));
  function normalizeRules(raw, kit = { abilities, defaultRules }) {
    const result = [],
      used = new Set();
    if (Array.isArray(raw))
      for (const row of raw) {
        if (
          !row ||
          !kit.abilities.some((a) => a.id === row.abilityId) ||
          used.has(row.abilityId)
        )
          continue;
        used.add(row.abilityId);
        function normalizeCondition(condition, depth = 0) {
          if (kit.strategyControls?.allowCompound && depth < 3) {
            if (condition.type === "all" && Array.isArray(condition.conditions) && condition.conditions.length > 0)
              return { type: "all", conditions: condition.conditions.slice(0, 8).map(c => normalizeCondition(c || {}, depth + 1)) };
            if (condition.type === "not" && condition.condition && typeof condition.condition === "object")
              return { type: "not", condition: normalizeCondition(condition.condition, depth + 1) };
          }

          const type = conditions.some((c) => c.id === condition.type)
            ? condition.type
            : "always";
          const normalized = { type };
          if (
            [
              "enemyHpBelow",
              "playerHpBelow",
              "resourceAbove",
              "resourceBelow",
            ].includes(type)
          )
            normalized.threshold = Number.isFinite(Number(condition.threshold))
              ? clamp(
                  Number(condition.threshold),
                  type.startsWith("resource") ? 0 : 1,
                  type.startsWith("resource") ? 100 : 99,
                )
              : 25;
          const skill = kit.abilities.find((a) => a.id === row.abilityId);
          if (type === "debuffAbsent" || type === "buffAbsent") {
            const effectsForCondition = kit.abilities
              .filter(
                (a) =>
                  a.effectId &&
                  (type === "buffAbsent" ? a.kind === "buff" : a.kind !== "buff"),
              )
              .map((a) => a.effectId);
            normalized.effectId = effectsForCondition.includes(condition.effectId)
              ? condition.effectId
              : skill.effectId && effectsForCondition.includes(skill.effectId)
                ? skill.effectId
                : effectsForCondition[0];
            if (!normalized.effectId) normalized.type = "always";
          }
          return normalized;
        }
        const normalized = normalizeCondition(row.condition || {});
        result.push({ abilityId: row.abilityId, condition: normalized,
          ...(kit.strategyControls?.allowDisable && row.enabled === false ? { enabled: false } : {}) });
      }
    for (const rule of kit.defaultRules)
      if (!used.has(rule.abilityId)) result.push(copy(rule));
    return result;
  }
  function normalizeSettings(raw, kit) {
    return {
      mode: raw?.mode === "custom" ? "custom" : "auto",
      speed: [1, 2, 4].includes(raw?.speed) ? raw.speed : 1,
      rules: normalizeRules(raw?.rules, kit),
    };
  }
  // v3 preferences keep the class-wide legacy strategy; future specs get independent entries.
  function preferenceStore(storage) {
    const KEY = "nymeria.combat.v3";
    let value = { version: 3, entries: {}, legacyClasses: {} }, blocked = false, error = false;
    const object = v => v && typeof v === "object" && !Array.isArray(v);
    try {
      const text = storage.getItem(KEY);
      if (text !== null) {
        const raw = JSON.parse(text);
        if (raw?.version !== 3 || !object(raw.entries) || !object(raw.legacyClasses)) { blocked = true; error = true; }
        else value = raw;
      } else {
        const old = JSON.parse(storage.getItem("nymeria.combat.v2"));
        if (object(old?.classes)) value.legacyClasses = copy(old.classes);
        if (!value.legacyClasses.hunter) {
          const first = JSON.parse(storage.getItem("nymeria.combat.v1"));
          if (first) value.legacyClasses.hunter = copy(first);
        }
      }
    } catch { error = true; blocked = true; }
    function key(classId, spec) { return spec.legacyBuildId ? `legacy:${classId}` : `specialization:${classId}:${spec.id}`; }
    return {
      STORAGE_KEY: KEY,
      key,
      read(classId, spec, profile) {
        const saved = value.entries[key(classId, spec)] || (spec.legacyBuildId ? value.legacyClasses[classId] : null);
        return normalizeSettings(saved, profile);
      },
      write(classId, spec, settings) {
        if (blocked) { error = true; return false; }
        const next = copy(value); next.entries[key(classId, spec)] = copy(settings);
        try { storage.setItem(KEY, JSON.stringify(next)); value = next; error = false; return true; }
        catch { error = true; return false; }
      },
      get storageError() { return error; },
      get readOnly() { return blocked; },
    };
  }
  function kitRequirement(main, support) {
    return main?.weaponType === "bow" && support?.type === "quiver";
  }
  return {
    preferenceStore,
    formulas,
    effects,
    abilities,
    conditions,
    defaultRules,
    enemies,
    enemyRewards,
    itemHooks,
    normalizeRules,
    normalizeSettings,
    kitRequirement,
    copy,
    step: 0.05,
    logLimit: 60,
  };
})();
if (typeof module !== "undefined" && module.exports)
  module.exports = CombatData;
