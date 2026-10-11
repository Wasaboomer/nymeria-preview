/* Single source of truth for compatibility, stats and equipped/appearance separation. */
const Equipment = (() => {
  const SAVE_KEY = "nymeria.equipment.v1";
  const baseStats = {
    force: 12,
    agility: 15,
    vigor: 14,
    spirit: 11,
    critical: 0,
    speed: 0,
    armor: 0,
  };
  const defaultCharacter = {
    hair: "veil",
    skin: "warm",
    face: "calm",
    hairColor: "ink",
    eyes: "amber",
    level: 1,
  };
  const slotById = Object.fromEntries(GearData.slots.map((s) => [s.id, s]));
  const itemById = Object.fromEntries(GearData.items.map((i) => [i.id, i]));
  const appearanceAllowed = {
    hair: ITEMS.hair.map((x) => x.id),
    skin: PALETTES.skin.map((x) => x.id),
    face: ITEMS.face.map((x) => x.id),
    hairColor: PALETTES.hair.map((x) => x.id),
    eyes: PALETTES.eyes.map((x) => x.id),
  };
  const equipmentDyes = PALETTES.dye.map((x) => x.id);
  const isTestMode = () =>
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).get("test") === "1";
  let debugCreatorOpen = false;
  const listeners = new Set();
  let storageIssue = false;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  function calculateStats(model) {
    const totals =
      typeof ProgressionData !== "undefined"
        ? ProgressionData.baseStats(
            model.character.level,
            baseStats,
            currentClass()?.statGrowthPerLevel,
          )
        : { ...baseStats };
    for (const entry of Object.values(model.equipment)) {
      const item = model.inventory.find((i) => i.id === entry.equippedItem);
      if (item) for (const [k, v] of Object.entries(item.stats)) totals[k] += v;
    }
    return totals;
  }
  // Prototype power weights; all call sites use this formula.
  function calculatePower(s) {
    return Math.round(
      s.force * 2 +
        s.agility * 2 +
        s.vigor +
        s.spirit * 2 +
        s.critical * 3 +
        s.speed * 2 +
        s.armor,
    );
  }
  function progressionState() {
    return typeof ProgressionStore !== "undefined" && ProgressionStore
      ? ProgressionStore.state
      : { level: 1, ownedLootIds: [] };
  }
  function currentClass() {
    return typeof ClassSystem !== "undefined" ? ClassSystem.selected() : null;
  }
  function armorError(item) {
    const cls = currentClass();
    return cls ? ArmorRules.reason(item, cls) : null;
  }
  function sync(model) {
    const progression = progressionState();
    model.character.level = progression.level;
    const owned = new Set(progression.ownedLootIds);
    model.inventory = model.inventory.filter(
      (item) => !item.expeditionOnly || owned.has(item.id),
    );
    for (const id of owned)
      if (
        !model.inventory.some((item) => item.id === id) &&
        itemById[id]?.expeditionOnly
      )
        model.inventory.push(clone(itemById[id]));
    for (const entry of Object.values(model.equipment)) {
      const item = model.inventory.find((i) => i.id === entry.equippedItem);
      if (item && armorError(item)) {
        entry.equippedItem = null;
        entry.appearanceItem = null;
      }
    }
    const ids = new Set(
      Object.values(model.equipment).map((x) => x.equippedItem),
    );
    model.inventory.forEach((i) => (i.equipped = ids.has(i.id)));
    model.resultingStats = calculateStats(model);
    model.power = calculatePower(model.resultingStats);
    return model;
  }
  function initial() {
    const equipment = Object.fromEntries(
      GearData.slots.map((s) => [
        s.id,
        { equippedItem: null, appearanceItem: null },
      ]),
    );
    const initialIds = {
      mainHand: "sword",
      torso: "torso-warden",
      legs: "legs-ranger",
      boots: "boots-plate",
      cloak: "cloak-dusk",
    };
    if (currentClass()?.armorProficiency === "mail") {
      initialIds.torso = "torso-chain";
      initialIds.legs = "legs-chain";
      initialIds.boots = "boots-chain";
    } else if (currentClass()?.armorProficiency === "plate")
      initialIds.legs = "legs-sentinel";
    for (const [slot, id] of Object.entries(initialIds))
      equipment[slot] = { equippedItem: id, appearanceItem: id };
    return sync({
      version: 1,
      characterCreated: false,
      equipmentAppearance: { dye: "sea" },
      inventory: clone(GearData.items.filter((item) => !item.expeditionOnly && !item.futureKitOnly)),
      equipment,
      character: { ...defaultCharacter },
    });
  }
  function compatibleSlots(item) {
    return GearData.slots.filter((s) => s.type === item.slot).map((s) => s.id);
  }
  function supportRule(main, support) {
    return ClassesData.supportReason(main, support);
  }
  function normalize(raw) {
    const fresh = initial();
    if (!raw || raw.version !== 1 || !Array.isArray(raw.inventory))
      return fresh;
    // Missing marker means an existing prototype character; explicit false is a new draft.
    fresh.characterCreated = raw.characterCreated !== false;
    const dye = raw.equipmentAppearance?.dye ?? raw.character?.dye;
    if (equipmentDyes.includes(dye)) fresh.equipmentAppearance.dye = dye;
    const owned = new Set(
      raw.inventory.map((x) => x?.id).filter((id) => itemById[id]),
    );
    // Add the coherent Mail demo kit to older M2–M5 inventories; retain every owned item.
    for (const item of GearData.items)
      if (item.demoMigration) owned.add(item.id);
    fresh.inventory = clone(GearData.items.filter((i) => owned.has(i.id)));
    for (const [key, values] of Object.entries(appearanceAllowed))
      if (values.includes(raw.character?.[key]))
        fresh.character[key] = raw.character[key];
    const used = new Set();
    for (const slot of GearData.slots) {
      const entry = raw.equipment?.[slot.id];
      const id = entry?.equippedItem;
      const item = fresh.inventory.find((i) => i.id === id);
      if (
        !item ||
        used.has(id) ||
        !compatibleSlots(item).includes(slot.id) ||
        item.requiredLevel > fresh.character.level
      ) {
        fresh.equipment[slot.id] = { equippedItem: null, appearanceItem: null };
        continue;
      }
      used.add(id);
      const appearanceId = entry.appearanceItem;
      const appearance = fresh.inventory.find((i) => i.id === appearanceId);
      fresh.equipment[slot.id] = {
        equippedItem: id,
        appearanceItem:
          appearance && compatibleSlots(appearance).includes(slot.id)
            ? appearanceId
            : id,
      };
    }
    const main = fresh.inventory.find(
        (i) => i.id === fresh.equipment.mainHand.equippedItem,
      ),
      support = fresh.inventory.find(
        (i) => i.id === fresh.equipment.support.equippedItem,
      );
    if (support && supportRule(main, support))
      fresh.equipment.support = { equippedItem: null, appearanceItem: null };
    return sync(fresh);
  }
  let state = initial();
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) state = normalize(JSON.parse(saved));
    else {
      const old = JSON.parse(localStorage.getItem("nymeria.character.v1"));
      if (old && typeof old === "object" && !Array.isArray(old)) {
        state.characterCreated = true;
        if (equipmentDyes.includes(old.dye))
          state.equipmentAppearance.dye = old.dye;
      }
      for (const [key, values] of Object.entries(appearanceAllowed))
        if (values.includes(old?.[key])) state.character[key] = old[key];
      for (const [slot, legacy] of Object.entries({
        mainHand: "weapon",
        torso: "torso",
        legs: "legs",
        boots: "boots",
        cloak: "cloak",
      })) {
        const item = state.inventory.find(
          (i) =>
            compatibleSlots(i).includes(slot) &&
            i.appearance?.asset === old?.[legacy],
        );
        if (item)
          state.equipment[slot] = {
            equippedItem: item.id,
            appearanceItem: item.id,
          };
      }
      sync(state);
    }
  } catch {
    storageIssue = true;
  }
  function reconcileCreatedAppearance(model) {
    // A stale draft in another tab must not undo creation or overwrite the saved identity.
    let raw;
    try {
      raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch {
      return;
    }
    if (
      !raw ||
      raw.version !== 1 ||
      !Array.isArray(raw.inventory) ||
      raw.characterCreated === false
    )
      return;
    model.characterCreated = true;
    if (isTestMode() && debugCreatorOpen) return;
    for (const [key, values] of Object.entries(appearanceAllowed))
      if (values.includes(raw.character?.[key]))
        model.character[key] = raw.character[key];
  }
  function persist(model) {
    try {
      reconcileCreatedAppearance(model);
      localStorage.setItem(SAVE_KEY, JSON.stringify(model));
      return true;
    } catch {
      storageIssue = true;
      return false;
    }
  }
  const save = () => persist(state);
  function publish() {
    sync(state);
    const persisted = save();
    listeners.forEach((fn) => fn(state));
    return persisted;
  }
  function equipped(slot) {
    return (
      state.inventory.find(
        (i) => i.id === state.equipment[slot]?.equippedItem,
      ) || null
    );
  }
  function appearance(slot) {
    return (
      state.inventory.find(
        (i) => i.id === state.equipment[slot]?.appearanceItem,
      ) || null
    );
  }
  function canEquip(id, slot) {
    const item = state.inventory.find((i) => i.id === id);
    if (!item) return "Oggetto non disponibile.";
    return canEquipCandidate(item, slot);
  }
  function canEquipCandidate(item, slot) {
    if (!compatibleSlots(item).includes(slot))
      return "Questo oggetto non appartiene allo slot.";
    const proficiencyError = armorError(item);
    if (proficiencyError) return proficiencyError;
    if (item.requiredLevel > state.character.level)
      return `Richiede livello ${item.requiredLevel}.`;
    const spec = typeof ClassSystem !== "undefined" ? ClassSystem.resolved().specialization : null;
    return ClassesData.wearableReason(item, slotById[slot].type,
      equipped("mainHand"), spec?.requirements, !spec || !!spec.legacyBuildId);
  }
  function equip(id, slot) {
    const error = canEquip(id, slot);
    if (error) return { ok: false, message: error };
    let displaced = null;
    const item = state.inventory.find((i) => i.id === id);
    for (const entry of Object.values(state.equipment))
      if (entry.equippedItem === id) {
        entry.equippedItem = null;
        entry.appearanceItem = null;
      }
    state.equipment[slot] = { equippedItem: id, appearanceItem: id };
    if (slot === "mainHand") {
      const support = equipped("support");
      if (support && supportRule(item, support)) {
        displaced = support.name;
        state.equipment.support = { equippedItem: null, appearanceItem: null };
      }
    }
    const persisted = publish();
    return {
      ok: true,
      message: `${item.name} equipaggiato.${displaced ? ` ${displaced} torna nell’inventario.` : ""}${persisted ? "" : " Salvataggio locale non disponibile."}`,
    };
  }
  function unequip(slot) {
    if (!slotById[slot]) return { ok: false, message: "Slot non valido." };
    const item = equipped(slot);
    if (!item)
      return {
        ok: false,
        message:
          slot === "support" && equipped("mainHand")?.handedness === "2H"
            ? "Rimuovi l’arma principale a due mani."
            : "Lo slot è già vuoto.",
      };
    state.equipment[slot] = { equippedItem: null, appearanceItem: null };
    let extra = "";
    if (slot === "mainHand" && equipped("support")) {
      extra = ` ${equipped("support").name} torna nell’inventario.`;
      state.equipment.support = { equippedItem: null, appearanceItem: null };
    }
    const persisted = publish();
    return {
      ok: true,
      message: `${item.name} rimosso.${extra}${persisted ? "" : " Salvataggio locale non disponibile."}`,
    };
  }
  function comparison(id, slot) {
    const item = state.inventory.find((i) => i.id === id);
    if (!item) return null;
    const projected = clone(state);
    for (const entry of Object.values(projected.equipment))
      if (entry.equippedItem === id) {
        entry.equippedItem = null;
        entry.appearanceItem = null;
      }
    projected.equipment[slot] = { equippedItem: id, appearanceItem: id };
    if (slot === "mainHand") {
      const support = projected.inventory.find(
        (i) => i.id === projected.equipment.support.equippedItem,
      );
      if (support && supportRule(item, support))
        projected.equipment.support = {
          equippedItem: null,
          appearanceItem: null,
        };
    }
    const totals = calculateStats(projected);
    return {
      current: equipped(slot),
      delta: Object.fromEntries(
        Object.keys(baseStats).map((k) => [
          k,
          totals[k] - state.resultingStats[k],
        ]),
      ),
      power: calculatePower(totals) - state.power,
      supportRemoved: !!(
        equipped("support") && !projected.equipment.support.equippedItem
      ),
    };
  }
  const creatorAvailable = () => {
    reconcileCreatedAppearance(state);
    return !state.characterCreated || (isTestMode() && debugCreatorOpen);
  };
  function setCharacter(key, value) {
    if (!creatorAvailable() || !appearanceAllowed[key]?.includes(value))
      return false;
    state.character[key] = value;
    publish();
    return true;
  }
  function randomizeCharacter() {
    if (!creatorAvailable()) return false;
    for (const [key, values] of Object.entries(appearanceAllowed))
      state.character[key] = values[Math.floor(Math.random() * values.length)];
    publish();
    return true;
  }
  function setEquipmentDye(value) {
    if (!equipmentDyes.includes(value)) return false;
    state.equipmentAppearance.dye = value;
    publish();
    return true;
  }
  function createCharacter() {
    if (!creatorAvailable())
      return { ok: false, message: "Personaggio già creato." };
    const next = clone(state);
    next.characterCreated = true;
    if (!persist(next))
      return {
        ok: false,
        message:
          "Salvataggio non disponibile: personaggio non confermato. Riprova.",
      };
    state = next;
    debugCreatorOpen = false;
    listeners.forEach((fn) => fn(state));
    return {
      ok: true,
      message: "Personaggio e aspetto salvati. Character Creator bloccato.",
    };
  }
  function debugReopenCreator() {
    if (!isTestMode()) return false;
    debugCreatorOpen = true;
    listeners.forEach((fn) => fn(state));
    return true;
  }
  function reset() {
    const previous = state;
    state = initial();
    if (previous.characterCreated) {
      state.characterCreated = true;
      state.character = { ...previous.character };
    }
    publish();
  }
  return {
    get state() {
      return state;
    },
    get storageIssue() {
      return storageIssue;
    },
    SAVE_KEY,
    baseStats,
    appearanceAllowed,
    slotById,
    compatibleSlots,
    calculateStats,
    calculatePower,
    supportRule,
    canEquip,
    canEquipCandidate,
    equipped,
    appearance,
    equip,
    unequip,
    comparison,
    get creatorAvailable() {
      return creatorAvailable();
    },
    get testMode() {
      return isTestMode();
    },
    createCharacter,
    debugReopenCreator,
    setCharacter,
    setEquipmentDye,
    randomizeCharacter,
    reset,
    reconcileProgression: publish,
    save,
    subscribe(fn) {
      listeners.add(fn);
    },
    reconcileCreator: () => reconcileCreatedAppearance(state),
    normalize,
  };
})();
