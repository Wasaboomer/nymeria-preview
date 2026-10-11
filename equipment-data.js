/* Equipment catalogue: gameplay metadata is independent of SVG appearance assets. */
const GearData = (() => {
  const slots = [
    ["mainHand", "Arma principale", "weapon"],
    ["support", "Supporto / seconda mano", "support"],
    ["head", "Copricapo", "head"],
    ["cloak", "Mantello", "cloak"],
    ["torso", "Armatura superiore", "torso"],
    ["legs", "Gambali", "legs"],
    ["boots", "Stivali", "boots"],
    ["gloves", "Guanti", "gloves"],
    ["belt", "Cintura", "belt"],
    ["necklace", "Collana", "necklace"],
    ["earLeft", "Orecchino SX", "earring"],
    ["earRight", "Orecchino DX", "earring"],
    ["braceletLeft", "Bracciale SX", "bracelet"],
    ["braceletRight", "Bracciale DX", "bracelet"],
    ["ringLeft", "Anello SX", "ring"],
    ["ringRight", "Anello DX", "ring"],
  ].map(([id, label, type]) => ({ id, label, type }));
  const rarities = ["Comune", "Non comune", "Raro", "Epico", "Leggendario"];
  const statLabels = {
    force: "Forza",
    agility: "Agilità",
    vigor: "Vigor",
    spirit: "Spirito",
    critical: "Critico",
    speed: "Velocità",
    armor: "Armatura",
  };
  const items = [];
  function item(
    id,
    name,
    slot,
    type,
    rarity,
    itemLevel,
    stats,
    description,
    extra = {},
  ) {
    items.push({
      id,
      name,
      slot,
      type,
      rarity,
      itemLevel,
      requiredLevel: 1,
      stats,
      description,
      equipped: false,
      effects: [],
      appearance: null,
      ...extra,
    });
  }
  function weapon(
    id,
    name,
    weaponType,
    handedness,
    allowedSupports,
    stats,
    rarity = 2,
    itemLevel = 6,
  ) {
    item(
      id,
      name,
      "weapon",
      weaponType,
      rarities[rarity],
      itemLevel,
      stats,
      `${name}: forgiata per chi custodisce le soglie.`,
      {
        handedness,
        weaponType,
        allowedSupports,
        appearance: { layer: "weapon", asset: weaponType },
      },
    );
  }
  weapon(
    "sword",
    "Lama della soglia",
    "sword",
    "1H",
    ["shield", "dagger", "offhandBlade"],
    { force: 6, agility: 2 },
  );
  weapon(
    "sword-dawn",
    "Lama dell’alba spenta",
    "sword",
    "1H",
    ["shield", "dagger", "offhandBlade"],
    { force: 9, agility: 1 },
    3,
    9,
  );
  weapon(
    "dagger",
    "Pugnale del silenzio",
    "dagger",
    "1H",
    ["dagger"],
    { agility: 7, critical: 2 },
    1,
    5,
  );
  weapon(
    "wand",
    "Ramo delle maree",
    "wand",
    "1H",
    ["book", "orb", "focus"],
    { spirit: 8 },
    2,
    7,
  );
  weapon(
    "bow",
    "Arco di salice nero",
    "bow",
    "1H",
    ["quiver"],
    { agility: 8, speed: 2 },
    1,
    6,
  );
  weapon(
    "crossbow",
    "Balestra delle faglie",
    "crossbow",
    "1H",
    ["quiver", "bolts"],
    { force: 5, agility: 5 },
    2,
    7,
  );
  weapon(
    "staff",
    "Scheggia delle maree",
    "staff",
    "2H",
    [],
    { spirit: 13, vigor: 2 },
    3,
    10,
  );
  weapon(
    "greatsword",
    "Spadone del giuramento",
    "greatsword",
    "2H",
    [],
    { force: 14, vigor: 3 },
    3,
    11,
  );
  weapon(
    "spear",
    "Lancia del confine",
    "spear",
    "2H",
    [],
    { force: 9, agility: 9 },
    2,
    10,
  );
  const supports = [
    ["shield", "Scudo del custode", "shield", { vigor: 4, armor: 8 }, 2, 6],
    [
      "offhand-blade",
      "Lama gemella",
      "offhandBlade",
      { force: 3, agility: 3 },
      1,
      4,
    ],
    [
      "offhand-dagger",
      "Pugnale da parata",
      "dagger",
      { agility: 4, critical: 1 },
      1,
      5,
    ],
    ["quiver", "Faretra del viaggio", "quiver", { agility: 3 }, 0, 3],
    [
      "thorn-quiver",
      "Faretra delle Spine",
      "quiver",
      { agility: 5, critical: 1 },
      3,
      8,
    ],
    ["bolts", "Dardi di ferro lunare", "bolts", { force: 3, agility: 2 }, 1, 5],
    ["book", "Tomo delle Maree", "book", { spirit: 5 }, 2, 7],
    ["orb", "Orb della penombra", "orb", { spirit: 4, critical: 2 }, 3, 8],
    ["focus", "Reliquia dei sussurri", "focus", { spirit: 6 }, 4, 12],
  ];
  for (const [id, name, type, stats, r, il] of supports)
    item(
      id,
      name,
      "support",
      type,
      rarities[r],
      il,
      stats,
      "Un compagno di viaggio per l’arma principale.",
      {
        appearance: { layer: "support", asset: type },
        ...(type === "dagger" || type === "offhandBlade"
          ? { handedness: "1H", weaponType: type }
          : {}),
      },
    );
  const armor = [
    [
      "head-veil",
      "Fascia rituale del vespro",
      "head",
      "Fascia di tessuto",
      { spirit: 2, armor: 2 },
      1,
      4,
      "crown",
    ],
    [
      "head-helm",
      "Elmo delle faglie",
      "head",
      "Elmo",
      { vigor: 3, armor: 6 },
      2,
      6,
      "helm",
    ],
    [
      "cloak-dusk",
      "Ala del vespro",
      "cloak",
      "Mantello corto",
      { agility: 2 },
      0,
      3,
      "dusk",
    ],
    [
      "cloak-pilgrim",
      "Mantello delle soglie",
      "cloak",
      "Mantello lungo",
      { spirit: 3, vigor: 1 },
      2,
      6,
      "pilgrim",
    ],
    [
      "torso-warden",
      "Custode lunare",
      "torso",
      "Corazza a piastre",
      { force: 4, vigor: 5, armor: 10 },
      2,
      7,
      "warden",
    ],
    [
      "torso-oracle",
      "Oracolo delle brume",
      "torso",
      "Tunica rituale",
      { spirit: 7, agility: 3, armor: 4 },
      3,
      9,
      "oracle",
    ],
    [
      "legs-ranger",
      "Passo silente",
      "legs",
      "Pantaloni",
      { agility: 3, armor: 2 },
      0,
      3,
      "ranger",
    ],
    [
      "legs-sentinel",
      "Guardia delle faglie",
      "legs",
      "Gambali a piastre",
      { vigor: 4, armor: 7 },
      2,
      6,
      "sentinel",
    ],
    [
      "boots-soft",
      "Strade perdute",
      "boots",
      "Stivali di cuoio",
      { agility: 2, speed: 1 },
      1,
      4,
      "soft",
    ],
    [
      "boots-plate",
      "Ancoraggio astrale",
      "boots",
      "Stivali di acciaio",
      { vigor: 2, armor: 4 },
      2,
      5,
      "plate",
    ],
    [
      "gloves-thread",
      "Guanti del filo",
      "gloves",
      "Guanti di tessuto",
      { spirit: 2, agility: 1 },
      0,
      3,
      "thread",
    ],
    [
      "gloves-iron",
      "Presa di ferro",
      "gloves",
      "Guanti a piastre",
      { force: 3, armor: 3 },
      2,
      5,
      "iron",
    ],
    [
      "belt-rope",
      "Nodo del pellegrino",
      "belt",
      "Cintura intrecciata",
      { vigor: 2 },
      0,
      2,
      "rope",
    ],
    [
      "belt-gold",
      "Cintura del patto",
      "belt",
      "Cintura incisa",
      { force: 2, spirit: 2 },
      3,
      7,
      "gold",
    ],
  ];
  for (const [id, name, slot, type, stats, r, il, asset] of armor)
    item(
      id,
      name,
      slot,
      type,
      rarities[r],
      il,
      stats,
      "Materiali del vespro, lavorati per durare oltre il viaggio.",
      { appearance: { layer: slot, asset } },
    );
  // Material identity is explicit, never inferred from stats or random rolls.
  const armorTypes = {
    "head-veil": "cloth",
    "head-helm": "plate",
    "torso-warden": "plate",
    "torso-oracle": "cloth",
    "legs-ranger": "leather",
    "legs-sentinel": "plate",
    "boots-soft": "leather",
    "boots-plate": "plate",
    "gloves-thread": "cloth",
    "gloves-iron": "plate",
  };
  for (const gear of items)
    if (armorTypes[gear.id]) gear.armorType = armorTypes[gear.id];
  const mailKit = [
    [
      "head-chain",
      "Cappuccio delle maglie quiete",
      "head",
      { agility: 2, armor: 4 },
      "helm",
    ],
    [
      "torso-chain",
      "Usbergo del confine",
      "torso",
      { force: 4, vigor: 5, armor: 10 },
      "warden",
    ],
    [
      "legs-chain",
      "Gambali delle maglie quiete",
      "legs",
      { agility: 3, armor: 2 },
      "ranger",
    ],
    [
      "gloves-chain",
      "Presa delle maglie quiete",
      "gloves",
      { agility: 3, armor: 3 },
      "thread",
    ],
    [
      "boots-chain",
      "Passo delle maglie quiete",
      "boots",
      { vigor: 2, armor: 4 },
      "soft",
    ],
  ];
  for (const [id, name, slot, stats, asset] of mailKit)
    item(
      id,
      name,
      slot,
      "Armatura di maglia",
      "Raro",
      6,
      stats,
      "Maglia flessibile su imbottitura scura. Asset provvisorio condiviso.",
      {
        armorType: "mail",
        demoMigration: true,
        appearance: { layer: slot, asset },
      },
    );
  const accessories = [
    [
      "neck-moon",
      "Collana del novilunio",
      "necklace",
      { spirit: 3 },
      2,
      5,
      "moon",
    ],
    [
      "neck-oath",
      "Sigillo del giuramento",
      "necklace",
      { vigor: 3, force: 2 },
      3,
      8,
      "sigil",
    ],
    ["ear-star", "Orecchino stella", "earring", { agility: 2 }, 1, 3, "star"],
    ["ear-tear", "Orecchino lacrima", "earring", { spirit: 3 }, 2, 5, "tear"],
    [
      "ear-ember",
      "Orecchino brace",
      "earring",
      { critical: 1, force: 2 },
      3,
      7,
      "ember",
    ],
    [
      "brace-mist",
      "Bracciale della bruma",
      "bracelet",
      { spirit: 2 },
      1,
      3,
      "mist",
    ],
    [
      "brace-iron",
      "Bracciale di ferro",
      "bracelet",
      { force: 3 },
      2,
      5,
      "iron",
    ],
    [
      "brace-leaf",
      "Bracciale foglia",
      "bracelet",
      { agility: 3 },
      0,
      2,
      "leaf",
    ],
    [
      "ring-dusk",
      "Anello del Crepuscolo",
      "ring",
      { agility: 2, critical: 2 },
      3,
      8,
      "dusk",
    ],
    ["ring-tide", "Anello della marea", "ring", { spirit: 3 }, 2, 5, "tide"],
    ["ring-oath", "Anello del giuramento", "ring", { vigor: 3 }, 1, 4, "oath"],
    [
      "ring-sun",
      "Anello del sole spento",
      "ring",
      { force: 4, critical: 2 },
      4,
      12,
      "sun",
    ],
  ];
  for (const [id, name, slot, stats, r, il, asset] of accessories)
    item(
      id,
      name,
      slot,
      slot,
      rarities[r],
      il,
      stats,
      "Un piccolo segno di una storia ancora da raccontare.",
      { appearance: { layer: slot, asset } },
    );
  items.find((x) => x.id === "ring-dusk").effects = [
    {
      id: "dusk-after-dodge",
      trigger: "afterDodge",
      modifier: { stat: "criticalChance", operation: "add", value: 0.04 },
      description: "+4% probabilità di critico dopo una schivata.",
    },
  ];
  items.find((x) => x.id === "thorn-quiver").effects = [
    {
      id: "thorn-bleed",
      trigger: "rangedHit",
      status: "bleeding",
      description: "Gli attacchi a distanza possono applicare Sanguinamento.",
    },
  ];
  items.find((x) => x.id === "book").effects = [
    {
      id: "tide-barrier",
      trigger: "barrierCast",
      modifier: { stat: "barrierDurationSeconds", operation: "add", value: 1 },
      description: "Le abilità di barriera durano +1 secondo.",
    },
  ];
  // M6.5 visual alternatives inherit existing gameplay data without new balance.
  for (const [source, id, name] of [
    ["torso-warden", "torso-vesper", "Corazza del Vespro"],
    ["legs-sentinel", "legs-vesper", "Gambali del Vespro"],
    ["boots-plate", "boots-vesper", "Stivali del Vespro"],
    ["gloves-iron", "gloves-vesper", "Guanti del Vespro"],
    ["head-helm", "head-vesper", "Elmo chiuso del Vespro"],
    ["sword", "vesper-sword", "Lama delle faglie"],
    ["shield", "vesper-shield", "Scudo ottagonale del Vespro"],
  ]) {
    const original = items.find((i) => i.id === source);
    items.push({
      ...original,
      id,
      name,
      stats: { ...original.stats },
      appearance: { ...original.appearance },
      demoMigration: true,
      description:
        "Alternativa visiva del vertical slice. Stesse statistiche del modello originale.",
    });
  }
  const icons = {
    weapon: "M7 25L25 5 28 7 10 27M8 20L15 27M7 27L4 30",
    support: "M7 6L17 3 27 6 25 21 17 29 9 21Z",
    head: "M5 23L7 10 13 15 17 5 21 15 27 10 29 23Z",
    cloak: "M12 5L22 5 29 29 17 25 5 29Z",
    torso: "M11 5L5 10 8 18 12 16 10 29 24 29 22 16 26 18 29 10 23 5 17 10Z",
    legs: "M10 5H24L25 29H19L17 15 15 29H9Z",
    boots: "M10 5H22L21 21 28 25V29H9V24L12 20Z",
    gloves: "M10 16V7H13V15 5H16V15 4H19V15 7H22V18L26 14 29 16 23 29H12L7 20Z",
    belt: "M4 13H30V23H4ZM13 11H21V25H13Z",
    necklace: "M7 5Q3 24 17 25Q31 24 27 5M17 21L22 27 17 32 12 27Z",
    earring: "M17 3C5 3 7 18 17 18C27 18 29 3 17 3ZM17 18L22 26 17 31 12 26Z",
    bracelet:
      "M17 6C2 6 2 28 17 28C32 28 32 6 17 6ZM17 11C7 11 7 23 17 23C27 23 27 11 17 11Z",
    ring: "M17 12C3 12 3 30 17 30C31 30 31 12 17 12ZM17 3L23 9 17 15 11 9Z",
    bow: "M11 4Q33 17 11 30L15 17Z",
    crossbow: "M3 10Q17 2 31 10M17 7V30M9 22H25",
    book: "M5 5L16 8 29 5V27L16 30 5 27ZM16 8V30",
    orb: "M17 4C1 4 1 27 17 27C33 27 33 4 17 4ZM8 29H26",
    quiver: "M10 10L25 13 21 31 6 28ZM12 11L16 2M17 12L21 3M22 13L26 4",
    staff: "M15 30L18 12M18 3L24 9 18 15 12 9Z",
    spear: "M10 31L21 13M25 2L26 13 17 15Z",
    greatsword: "M14 24L19 4 26 3 27 10 18 25M8 21L22 27M13 24L10 31",
    dagger: "M12 23L24 7 26 16 17 26M9 22L20 29M12 26L8 31",
    wand: "M7 30L20 13M24 3L26 9 32 11 26 14 24 20 21 14 15 11 21 9Z",
    focus: "M17 3L28 17 17 31 6 17ZM17 10L22 17 17 24 12 17Z",
  };
  function icon(value) {
    const type =
      typeof value === "string"
        ? value
        : icons[value.type]
          ? value.type
          : value.slot;
    return `<svg viewBox="0 0 34 34" aria-hidden="true"><path d="${icons[type] || icons.support}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  const typeLabels = {
    sword: "Spada",
    dagger: "Pugnale",
    wand: "Arma magica",
    bow: "Arco",
    crossbow: "Balestra",
    staff: "Bastone",
    greatsword: "Spadone",
    spear: "Lancia",
    shield: "Scudo",
    offhandBlade: "Seconda lama",
    quiver: "Faretra",
    bolts: "Dardi",
    book: "Libro",
    orb: "Orb",
    focus: "Reliquia / focus",
    ring: "Anello",
    earring: "Orecchino",
    bracelet: "Bracciale",
    necklace: "Collana",
  };
  // Fixed personal-loot catalogue, excluded from starter/demo ownership.
  const expeditionLoot = [
    [
      "frontier-ring",
      "Anello della Frontiera",
      "ring",
      "ring",
      "Raro",
      8,
      { agility: 5, critical: 2, vigor: 2 },
      { layer: "ring", asset: "sun" },
      1,
    ],
    [
      "moon-boots",
      "Stivali del guado lunare",
      "boots",
      "boots",
      "Raro",
      8,
      { agility: 5, vigor: 3, armor: 5 },
      { layer: "boots", asset: "soft" },
      1,
    ],
    [
      "vesper-blade",
      "Lama della frontiera",
      "weapon",
      "sword",
      "Epico",
      12,
      { force: 12, vigor: 3 },
      { layer: "weapon", asset: "sword" },
      3,
    ],
    [
      "lunar-bow",
      "Arco della ricognizione",
      "weapon",
      "bow",
      "Epico",
      14,
      { agility: 13, critical: 3, speed: 3 },
      { layer: "weapon", asset: "bow" },
      5,
    ],
    [
      "frontier-mail",
      "Corazza della veglia",
      "torso",
      "torso",
      "Epico",
      14,
      { vigor: 8, force: 4, armor: 18 },
      { layer: "torso", asset: "warden" },
      5,
    ],
    [
      "ether-quiver",
      "Faretra del vespro stellato",
      "support",
      "quiver",
      "Leggendario",
      18,
      { agility: 10, critical: 3, speed: 3 },
      { layer: "support", asset: "quiver" },
      8,
    ],
  ];
  for (const [
    id,
    name,
    slot,
    type,
    rarity,
    itemLevel,
    stats,
    appearance,
    requiredLevel,
  ] of expeditionLoot) {
    item(
      id,
      name,
      slot,
      type,
      rarity,
      itemLevel,
      stats,
      "Ritrovamento della Frontiera del Vespro. Asset provvisorio condiviso.",
      {
        expeditionOnly: true,
        appearance,
        requiredLevel,
        ...(slot === "weapon"
          ? {
              weaponType: type,
              handedness: "1H",
              allowedSupports:
                type === "bow"
                  ? ["quiver"]
                  : ["shield", "dagger", "offhandBlade"],
            }
          : {}),
      },
    );
  }
  items.find((i) => i.id === "moon-boots").armorType = "mail";
  items.find((i) => i.id === "moon-boots").type = "Stivali di maglia";
  items.find((i) => i.id === "frontier-mail").armorType = "plate";
  items.find((i) => i.id === "frontier-mail").type = "Corazza a piastre";
  const counterparts = [
    [
      "moon-boots",
      "moon-sabatons",
      "Sabatons del guado lunare",
      {
        armorType: "plate",
        type: "Stivali a piastre",
        appearance: { layer: "boots", asset: "plate" },
        stats: { force: 3, vigor: 5, armor: 7 },
      },
    ],
    [
      "vesper-blade",
      "trail-bow",
      "Arco del sentiero spezzato",
      {
        weaponType: "bow",
        type: "bow",
        allowedSupports: ["quiver"],
        appearance: { layer: "weapon", asset: "bow" },
        stats: { agility: 12, speed: 3 },
      },
    ],
    [
      "lunar-bow",
      "vigil-blade",
      "Lama della veglia",
      {
        weaponType: "sword",
        type: "sword",
        allowedSupports: ["shield", "dagger", "offhandBlade"],
        appearance: { layer: "weapon", asset: "sword" },
        stats: { force: 13, vigor: 5, armor: 3 },
      },
    ],
    [
      "frontier-mail",
      "frontier-chain",
      "Usbergo della veglia",
      {
        armorType: "mail",
        type: "Usbergo di maglia",
        stats: { agility: 8, vigor: 4, armor: 12 },
      },
    ],
    [
      "ether-quiver",
      "ether-shield",
      "Scudo del vespro stellato",
      {
        type: "shield",
        appearance: { layer: "support", asset: "shield" },
        stats: { force: 5, vigor: 10, armor: 12 },
      },
    ],
  ];
  // M6 superior personal quest rewards reuse modular torso assets.
  for (const [id, name, armorType, stats, asset] of [
    ["silence-plate", "Corazza del Silenzio", "plate", { force: 8, vigor: 15, armor: 26 }, "warden"],
    ["silence-mail", "Maglia del Silenzio", "mail", { agility: 15, vigor: 8, critical: 4, armor: 18 }, "chain"],
  ]) item(id, name, "torso", armorType === "plate" ? "Corazza a piastre" : "Usbergo di maglia", "Epico", 20, stats,
    "Ricordo della Torre Silente. Asset modulare provvisorio.",
    { armorType, requiredLevel: 5, expeditionOnly: true, appearance: { layer: "torso", asset: asset === "chain" ? "warden" : asset } });
  const personalLootVariants = { "silence-plate": ["silence-plate", "silence-mail"] };
  for (const [source, id, name, changes] of counterparts) {
    items.push({
      ...JSON.parse(JSON.stringify(items.find((i) => i.id === source))),
      id,
      name,
      ...changes,
    });
    personalLootVariants[source] = [source, id];
  }
  // Catalog foundation only: no playable specialization or free legacy inventory additions.
  typeLabels.greataxe = "Ascia";
  typeLabels.warhammer = "Martello";
  for (const [id, name, stats] of [
    ["greataxe", "Ascia del giuramento", { force: 15, vigor: 1 }],
    ["warhammer", "Martello del giuramento", { force: 13, vigor: 5 }],
  ]) item(id, name, "weapon", id, "Epico", 11, stats,
    "Famiglia a due mani. Aspetto non ancora disponibile.",
    { requiredLevel: 1, futureKitOnly: true, handedness: "2H", weaponType: id,
      allowedSupports: [], appearance: { layer: "weapon", unavailable: true } });

  // Ordered additions preserve the first compatible legacy counterpart exactly.
  // The support reward becomes a 2H weapon at its own tier for forbidden-support kits.
  for (const [sourceId, prefix, force, vigor] of [
    ["vesper-blade", "frontier", 15, 3],
    ["lunar-bow", "vigil", 17, 4],
    ["ether-quiver", "stellar", 20, 5],
  ]) {
    const source = items.find(i => i.id === sourceId);
    for (const family of ["greatsword", "spear", "greataxe", "warhammer"]) {
      const id = `${prefix}-${family}`;
      const stats = family === "greataxe" ? { force: force + 1, vigor: Math.max(0, vigor - 2) }
        : family === "warhammer" ? { force: force - 1, vigor: vigor + 2 }
        : family === "spear" ? { force: force - 1, vigor, agility: 2 } : { force, vigor };
      const unavailable = ["greataxe", "warhammer"].includes(family);
      item(id, `${typeLabels[family]} · ${prefix === "frontier" ? "Frontiera" : prefix === "vigil" ? "Veglia" : "Vespro stellato"}`,
        "weapon", family, source.rarity, source.itemLevel, stats,
        unavailable ? "Arma a due mani. Aspetto non ancora disponibile."
          : family === "spear" ? "Arma a due mani. Rappresentazione condivisa con il bastone." : "Arma a due mani della Frontiera.",
        { expeditionOnly: true, requiredLevel: source.requiredLevel, weaponType: family,
          handedness: "2H", allowedSupports: [],
          appearance: unavailable ? { layer: "weapon", unavailable: true } : { layer: "weapon", asset: family } });
      personalLootVariants[sourceId].push(id);
    }
  }
  return {
    slots,
    rarities,
    statLabels,
    typeLabels,
    items,
    icon,
    personalLootVariants,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = GearData;
