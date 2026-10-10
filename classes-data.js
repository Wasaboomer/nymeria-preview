/* Class identity, resource policies and combat hooks. No equipment totals live here. */
const ClassesData = (() => {
  const combat =
    typeof module !== "undefined" && module.exports
      ? require("./combat-data.js")
      : CombatData;
  const classes = {
    hunter: {
      id: "hunter",
      name: "Cacciatore",
      armorProficiency: "mail",
      statGrowthPerLevel: { force: 0, agility: 3, vigor: 1, spirit: 0, critical: 0.5 },
      role: "DPS fisico a distanza",
      description:
        "Pressione a distanza: alterna attacchi economici, critici e ferite persistenti.",
      preferredStats: ["agility", "critical", "speed"],
      weaponTypes: ["bow"],
      supportTypes: ["quiver"],
      handedness: "1H",
      requirement: "Arco + Faretra",
      resource: {
        id: "focus",
        name: "Concentrazione",
        max: 100,
        initial: 100,
        regeneration: 6,
        decay: 0,
        events: {},
      },
      passive: {
        id: "steady-aim",
        name: "Mira costante",
        description:
          "Tiro Rapido recupera 4 Concentrazione; la risorsa rigenera 6/s.",
      },
      resultMetrics: [
        { key: "bleedingDamage", label: "Danno da Sanguinamento" },
      ],
      modifiers: {},
      abilities: combat.abilities.map((a) => ({
        ...combat.copy(a),
        cost: { lacerating: 12, power: 28, final: 22, wind: 10 }[a.id] || 0,
        resourceGain: a.id === "rapid" ? 4 : 0,
      })),
      defaultRules: combat.copy(combat.defaultRules),
      buildIds: ["predator", "lacerator", "explorer"],
      defaultBuild: "predator",
    },
    warden: {
      id: "warden",
      name: "Custode",
      armorProficiency: "plate",
      statGrowthPerLevel: { force: 2, agility: 0, vigor: 3, spirit: 1, critical: 0 },
      role: "Tank",
      description:
        "Difesa attiva: trasforma i colpi ricevuti e bloccati in Risolutezza e contrattacchi.",
      preferredStats: ["vigor", "armor", "force"],
      weaponTypes: ["sword"],
      supportTypes: ["shield"],
      handedness: "1H",
      requirement: "Spada 1H + Scudo",
      resource: {
        id: "resolve",
        name: "Risolutezza",
        max: 100,
        initial: 0,
        regeneration: 0,
        decay: 0,
        events: { damageTaken: 10, block: 18 },
      },
      passive: {
        id: "bulwark",
        name: "Baluardo",
        description:
          "Con scudo: armatura ×1,6, mitigazione aggiuntiva 12%, blocco 23% (riduce il colpo del 50%) e HP ×1,15.",
      },
      resultMetrics: [
        { key: "mitigated", label: "Danno mitigato / bloccato" },
        { key: "blocked", label: "Blocchi" },
      ],
      modifiers: {
        armorMultiplier: 1.6,
        mitigation: 0.12,
        blockChance: 0.23,
        blockReduction: 0.5,
        hpMultiplier: 1.15,
        damageWeights: { force: 1.6, agility: 0.25, spirit: 0.2 },
        damageMultiplier: 0.95,
      },
      abilities: [
        {
          id: "slash",
          name: "Fendente",
          description: "Attacco base di spada, senza costo.",
          cooldown: 0,
          kind: "attack",
          coefficient: 0.65,
          flatDamage: 6,
          tags: ["meleeHit"],
          cost: 0,
        },
        {
          id: "iron-guard",
          name: "Guardia Ferrea",
          description:
            "Per 6 s: mitigazione +18%, blocco +25%. Costa 15 Risolutezza.",
          cooldown: 10,
          kind: "buff",
          effectId: "iron-guard",
          tags: [],
          cost: 15,
        },
        {
          id: "shield-strike",
          name: "Colpo di Scudo",
          description:
            "Colpo con riduzione del danno nemico del 15% per 4 s. Costa 10.",
          cooldown: 5,
          kind: "attack",
          coefficient: 0.9,
          flatDamage: 10,
          effectId: "shaken",
          tags: ["meleeHit"],
          cost: 10,
        },
        {
          id: "retaliation",
          name: "Ritorsione",
          description:
            "Consuma 30 Risolutezza: danno base più 1,6 danni per punto speso dopo i colpi ricevuti.",
          cooldown: 4,
          kind: "attack",
          coefficient: 1.15,
          flatDamage: 8,
          damagePerResource: 1.6,
          tags: ["meleeHit"],
          cost: 30,
        },
        {
          id: "last-bastion",
          name: "Ultimo Baluardo",
          description:
            "Per 7 s: mitigazione +35%, blocco +20%. AUTO sotto 35% HP; costa 20.",
          cooldown: 20,
          kind: "buff",
          effectId: "last-bastion",
          tags: [],
          cost: 20,
        },
      ],
      defaultRules: [
        {
          abilityId: "last-bastion",
          condition: { type: "playerHpBelow", threshold: 35 },
        },
        {
          abilityId: "iron-guard",
          condition: { type: "buffAbsent", effectId: "iron-guard" },
        },
        {
          abilityId: "retaliation",
          condition: { type: "resourceAbove", threshold: 45 },
        },
        {
          abilityId: "shield-strike",
          condition: { type: "debuffAbsent", effectId: "shaken" },
        },
        { abilityId: "slash", condition: { type: "always" } },
      ],
      buildIds: ["bulwark", "retaliation", "command"],
      defaultBuild: "bulwark",
    },
  };
  const builds = {
    bulwark: {
      id: "bulwark",
      classId: "warden",
      name: "Baluardo",
      description: "Blocchi più frequenti e Guardia Ferrea più duratura.",
      modifiers: { blockChance: 0.12 },
      effectModifiers: {
        "iron-guard": {
          extraDuration: 2,
          modifiers: { mitigation: 0.08, blockChance: 0.1 },
        },
      },
      weights: {
        vigor: 3.5,
        armor: 3.5,
        force: 1.2,
        agility: 0.4,
        critical: 0.5,
        speed: 0.8,
        spirit: 0.4,
      },
    },
    retaliation: {
      id: "retaliation",
      classId: "warden",
      name: "Ritorsione",
      description: "Risolutezza generata ×1,5 e contrattacco più incisivo.",
      modifiers: { resourceGainMultiplier: 1.5 },
      abilityModifiers: { retaliation: { damageMultiplier: 1.35 } },
      priority: [
        "last-bastion",
        "retaliation",
        "shield-strike",
        "iron-guard",
        "slash",
      ],
      conditions: { retaliation: { type: "resourceAbove", threshold: 29 } },
      weights: {
        vigor: 2.4,
        armor: 2.2,
        force: 3,
        agility: 0.6,
        critical: 1.4,
        speed: 1,
        spirit: 0.4,
      },
    },
    command: {
      id: "command",
      classId: "warden",
      name: "Comando",
      description:
        "Colpo di Scudo applica una riduzione del danno del 25% per 6 s. Fondamento della futura utilità di gruppo.",
      effectModifiers: {
        shaken: { extraDuration: 2, modifiers: { outgoingReduction: 0.1 } },
      },
      priority: [
        "last-bastion",
        "shield-strike",
        "iron-guard",
        "retaliation",
        "slash",
      ],
      weights: {
        vigor: 2.8,
        armor: 2.8,
        force: 1.5,
        agility: 0.5,
        critical: 0.6,
        speed: 2,
        spirit: 1,
      },
    },
    predator: {
      id: "predator",
      classId: "hunter",
      name: "Predatore",
      description: "Critico +5 punti e Tiro Potente infligge il 15% in più.",
      modifiers: { criticalBonus: 0.05 },
      abilityModifiers: { power: { damageMultiplier: 1.15 } },
      priority: ["final", "power", "lacerating", "wind", "rapid"],
      weights: {
        agility: 3,
        critical: 4,
        speed: 2,
        vigor: 1,
        force: 1,
        armor: 0.5,
        spirit: 0.3,
      },
    },
    lacerator: {
      id: "lacerator",
      classId: "hunter",
      name: "Laceratore",
      description:
        "Sanguinamento: tick ×1,45, durata +2 s (si combina con la Faretra delle Spine).",
      effectModifiers: { bleeding: { tickMultiplier: 1.45, extraDuration: 2 } },
      weights: {
        agility: 3.5,
        critical: 1.8,
        speed: 2.4,
        vigor: 1,
        force: 1.2,
        armor: 0.5,
        spirit: 0.4,
      },
      effectWeights: { "thorn-bleed": 18 },
    },
    explorer: {
      id: "explorer",
      classId: "hunter",
      name: "Esploratore",
      description:
        "Velocità +8%, rigenerazione ×1,25 e Passo del Vento dura 8 s.",
      modifiers: { speed: 8, resourceRegenMultiplier: 1.25 },
      effectModifiers: { wind: { extraDuration: 2 } },
      priority: ["wind", "lacerating", "final", "power", "rapid"],
      weights: {
        agility: 2.5,
        critical: 2,
        speed: 4,
        vigor: 1.2,
        force: 0.8,
        armor: 0.6,
        spirit: 0.4,
      },
    },
  };
  const effects = {
    "iron-guard": {
      id: "iron-guard",
      name: "Guardia Ferrea",
      kind: "buff",
      duration: 6,
      maxStacks: 1,
      modifiers: { mitigation: 0.18, blockChance: 0.25 },
    },
    shaken: {
      id: "shaken",
      name: "Sbilanciato",
      kind: "debuff",
      duration: 4,
      maxStacks: 1,
      modifiers: { outgoingReduction: 0.15 },
    },
    "last-bastion": {
      id: "last-bastion",
      name: "Ultimo Baluardo",
      kind: "buff",
      duration: 7,
      maxStacks: 1,
      modifiers: { mitigation: 0.35, blockChance: 0.2 },
    },
  };
  // v1 specialization contract. Existing builds retain their exact legacy tuning.
  const specializations = Object.fromEntries(Object.values(builds).map(build => {
    const cls = classes[build.classId];
    const modifiers = { ...cls.modifiers };
    for (const [key, value] of Object.entries(build.modifiers || {}))
      modifiers[key] = (modifiers[key] || 0) + value;
    const defaultRules = (build.priority || cls.defaultRules.map(row => row.abilityId)).map(id => {
      const row = combat.copy(cls.defaultRules.find(rule => rule.abilityId === id));
      if (build.conditions?.[id]) row.condition = combat.copy(build.conditions[id]);
      return row;
    });
    return [build.id, {
      version: 1, id: build.id, classId: cls.id, legacyBuildId: build.id,
      name: build.name, description: build.description, role: cls.role,
      requirements: { weaponTypes: cls.weaponTypes, handedness: cls.handedness,
        supportTypes: cls.supportTypes, supportPolicy: "required", label: cls.requirement },
      passive: cls.passive, abilities: cls.abilities, resource: cls.resource,
      defaultRules, modifiers, abilityModifiers: build.abilityModifiers || {},
      effectModifiers: build.effectModifiers || {}, resultMetrics: cls.resultMetrics,
      effects: { ...combat.effects, ...effects }, weights: build.weights,
      effectWeights: build.effectWeights || {},
    }];
  }));
  function resolve(classId, selectionId) {
    const cls = classes[classId] || classes.hunter;
    const spec = specializations[selectionId];
    const selected = spec?.classId === cls.id ? spec : specializations[cls.defaultBuild];
    return combat.copy({
      version: 1,
      identity: { id: cls.id, name: cls.name, armorProficiency: cls.armorProficiency,
        statGrowthPerLevel: cls.statGrowthPerLevel },
      specialization: selected,
    });
  }
  function weaponCompatible(item, requirements) {
    return !!item && requirements.weaponTypes.includes(item.weaponType) && item.handedness === requirements.handedness;
  }
  function supportCompatible(item, requirements) {
    return requirements.supportPolicy !== "forbidden" && !!item && requirements.supportTypes.includes(item.type);
  }
  function validKit(main, support, requirements) {
    if (!requirements || !["required", "optional", "forbidden"].includes(requirements.supportPolicy) || !weaponCompatible(main, requirements)) return false;
    if (requirements.supportPolicy === "forbidden") return !support;
    if (support && (main.handedness === "2H" || (Array.isArray(main.allowedSupports) && !main.allowedSupports.includes(support.type)))) return false;
    return support ? supportCompatible(support, requirements) : requirements.supportPolicy === "optional";
  }
  return { classes, builds, effects, specializations, resolve, weaponCompatible, supportCompatible, validKit };
})();
if (typeof module !== "undefined" && module.exports)
  module.exports = ClassesData;
