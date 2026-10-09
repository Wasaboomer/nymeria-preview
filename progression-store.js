/* One authoritative local record: XP, money, materials, loot and claim state commit together. */
const ProgressionStorage = (() => {
  const data =
    typeof module !== "undefined" && module.exports
      ? require("./progression-data.js")
      : ProgressionData;
  const activities =
    typeof module !== "undefined" && module.exports
      ? require("./expedition-data.js")
      : ExpeditionData;
  const personal =
    typeof module !== "undefined" && module.exports
      ? require("./personal-loot.js")
      : PersonalLoot;
  const quests = typeof module !== "undefined" && module.exports
    ? require("./quest-system.js") : QuestEngine;
  let events = null;
  try {
    events = typeof module !== "undefined" && module.exports
      ? require("./progression-events.js") : ProgressionEvents;
  } catch { /* Optional feedback must not prevent the gameplay ledger from starting. */ }
  const classData = typeof module !== "undefined" && module.exports
    ? require("./classes-data.js") : ClassesData;
  const KEY = "nymeria.progression.v1";
  const copy = (value) => JSON.parse(JSON.stringify(value));
  function initial() {
    return {
      version: data.schemaVersion,
      ...data.fromTotal(0),
      crowns: 0,
      materials: { iron: 0, fiber: 0, ether: 0 },
      unlockedContent: ["patrol"],
      ownedLootIds: [],
      sequence: 0,
      manualCombatTickets: [],
      lastCombatReward: null,
      activeExpedition: null,
      pendingExpeditionResult: null,
      lastClaim: null,
      frontier: quests.normalize(),
    };
  }
  const isObject = (value) =>
    value && typeof value === "object" && !Array.isArray(value);
  const textValue = (value, limit = 160) =>
    typeof value === "string" && value.length > 0 && value.length <= limit;
  const numberValue = (value, max = 1e9) =>
    Number.isFinite(value) && value >= 0 && value <= max;
  function validReport(report) {
    const reward = report?.rewards;
    return (
      isObject(report) &&
      textValue(report.id) &&
      activities.activity(report.activityId) &&
      textValue(report.activityName) &&
      typeof report.success === "boolean" &&
      numberValue(report.durationMs, 604800000) &&
      Number.isInteger(report.completed) &&
      Number.isInteger(report.total) &&
      report.completed >= 0 &&
      report.completed <= report.total &&
      report.total <= 100 &&
      Array.isArray(report.encounters) &&
      report.encounters.length <= 100 &&
      Array.isArray(report.events) &&
      report.events.length <= 100 &&
      report.events.every(
        (event) =>
          isObject(event) &&
          textValue(event.id) &&
          textValue(event.name) &&
          textValue(event.description, 500),
      ) &&
      isObject(reward) &&
      numberValue(reward.xp) &&
      numberValue(reward.crowns) &&
      isObject(reward.materials) &&
      Object.keys(data.materialNames).every((key) =>
        numberValue(reward.materials[key]),
      ) &&
      Array.isArray(reward.lootIds) &&
      reward.lootIds.length <= 100 &&
      reward.lootIds.every((id) => textValue(id, 80)) &&
      textValue(report.className) &&
      textValue(report.buildName)
    );
  }
  function validRules(rules, profile) {
    return (
      Array.isArray(rules) &&
      rules.length <= 10 &&
      rules.every(
        (rule) =>
          isObject(rule) &&
          profile.abilities.some((ability) => ability?.id === rule.abilityId) &&
          isObject(rule.condition) &&
          textValue(rule.condition.type),
      )
    );
  }
  function validEffects(effects) {
    return (
      isObject(effects) &&
      Object.values(effects).every(
        (effect) =>
          isObject(effect) &&
          textValue(effect.id) &&
          textValue(effect.name) &&
          numberValue(effect.duration, 300) &&
          effect.duration > 0 &&
          Number.isInteger(effect.maxStacks) &&
          effect.maxStacks > 0 &&
          effect.maxStacks <= 10 &&
          (effect.tickInterval === undefined ||
            (numberValue(effect.tickInterval, 300) &&
              effect.tickInterval > 0)) &&
          (effect.damageCoefficient === undefined ||
            numberValue(effect.damageCoefficient, 10)) &&
          (effect.modifiers === undefined ||
            (isObject(effect.modifiers) &&
              Object.values(effect.modifiers).every((value) =>
                Number.isFinite(value),
              ))),
      )
    );
  }
  function validResource(resource) {
    return (
      !resource ||
      (isObject(resource) &&
        textValue(resource.id) &&
        textValue(resource.name) &&
        numberValue(resource.max, 1000) &&
        resource.max > 0 &&
        numberValue(resource.initial, resource.max) &&
        numberValue(resource.regeneration, 1000) &&
        numberValue(resource.decay, 1000) &&
        isObject(resource.events) &&
        Object.values(resource.events).every((value) =>
          numberValue(value, 1000),
        ))
    );
  }
  function validEvents(events) {
    return (
      Array.isArray(events) &&
      events.length > 0 &&
      events.length <= 20 &&
      events.every(
        (event) =>
          isObject(event) &&
          isObject(event) &&
          textValue(event.id) &&
          textValue(event.name) &&
          textValue(event.description, 500) &&
          ["crowns", "xpMultiplier", "lootBonus", "difficultyMultiplier"].every(
            (key) => event[key] === undefined || numberValue(event[key], 1000),
          ) &&
          (event.materials === undefined ||
            (isObject(event.materials) &&
              Object.entries(event.materials).every(
                ([key, value]) =>
                  key in data.materialNames && numberValue(value, 1000),
              ))),
      )
    );
  }
  function validActive(active) {
    const snapshot = active?.snapshot,
      profile = snapshot?.profile,
      activity = active?.activity;
    return (
      isObject(active) &&
      textValue(active.id) &&
      activities.activity(active.activityId) &&
      Number.isFinite(active.startedAt) &&
      active.startedAt >= 0 && active.startedAt <= 1e15 &&
      Number.isFinite(active.endsAt) &&
      active.endsAt > active.startedAt && active.endsAt <= 1e15 &&
      active.endsAt - active.startedAt <= 604800000 &&
      Number.isInteger(active.seed) &&
      active.seed >= 0 &&
      active.seed <= 4294967295 &&
      active.rulesVersion === 1 &&
      validEvents(active.eventDefinitions) &&
      isObject(activity) &&
      activity.id === active.activityId &&
      textValue(activity.name) &&
      Number.isInteger(activity.encounters) &&
      activity.encounters > 0 &&
      activity.encounters <= 50 &&
      isObject(activity.enemy) &&
      ["hp", "damage", "armor"].every(
        (key) =>
          numberValue(activity.enemy[key], 10) && activity.enemy[key] > 0,
      ) &&
      numberValue(activity.rest, 1) &&
      numberValue(activity.eventChance, 1) &&
      numberValue(activity.lootChance, 1) &&
      numberValue(activity.finalLootChance, 1) &&
      activity.durationMs === active.endsAt - active.startedAt &&
      [
        "xpPerEncounter",
        "completionXP",
        "crownsPerEncounter",
        "completionCrowns",
        "materialQuantity",
      ].every((key) => numberValue(activity[key])) &&
      Array.isArray(activity.lootTable) &&
      activity.lootTable.length > 0 &&
      activity.lootTable.every((id) => textValue(id, 80)) &&
      isObject(snapshot) &&
      Number.isInteger(snapshot.level) &&
      snapshot.level >= 1 &&
      snapshot.level <= data.levelCap &&
      isObject(snapshot.stats) &&
      data.statKeys.every((key) =>
        numberValue(snapshot.stats[key], 10000),
      ) &&
      Array.isArray(snapshot.effects) &&
      snapshot.effects.every((effect) => textValue(effect?.id)) &&
      Array.isArray(snapshot.rules) &&
      isObject(profile) &&
      isObject(profile.modifiers) &&
      isObject(profile.abilityModifiers) &&
      isObject(profile.effectModifiers) &&
      validEffects(profile.effects) &&
      validResource(profile.resource) &&
      Array.isArray(profile.defaultRules) &&
      textValue(profile.className) &&
      textValue(profile.buildName) &&
      profile.kitValid === true &&
      Array.isArray(profile.abilities) &&
      profile.abilities.length > 0 &&
      profile.abilities.length <= 10 &&
      validRules(profile.defaultRules, profile) &&
      validRules(snapshot.rules, profile) &&
      profile.abilities.every(
        (ability) =>
          isObject(ability) &&
          textValue(ability.id) &&
          ["attack", "buff"].includes(ability.kind) &&
          Array.isArray(ability.tags) &&
          numberValue(ability.cooldown, 300) &&
          numberValue(ability.cost || 0, 100) &&
          (ability.kind === "buff"
            ? isObject(profile.effects[ability.effectId])
            : numberValue(ability.coefficient, 10) &&
              numberValue(ability.flatDamage, 1000)),
      )
    );
  }
  function validCombatTicket(ticket) {
    return (
      isObject(ticket) &&
      /^combat-\d+$/.test(ticket.id) &&
      textValue(ticket.enemyId) &&
      numberValue(ticket.enemyLevel, 10000) &&
      numberValue(ticket.difficulty, 10000) &&
      numberValue(ticket.startedAt, 1e15) &&
      isObject(ticket.rewards) &&
      numberValue(ticket.rewards.xp) &&
      numberValue(ticket.rewards.crowns)
    );
  }
  function normalize(raw) {
    const state = initial();
    if (!raw || raw.version !== data.schemaVersion) { quests.reconcile(state); return state; }
    state.frontier = quests.normalize(raw.frontier);
    Object.assign(state, data.fromTotal(raw.totalXP));
    state.crowns = data.amount(raw.crowns);
    for (const key of Object.keys(state.materials))
      state.materials[key] = data.amount(raw.materials?.[key]);
    state.unlockedContent = activities.activities
      .filter((a) => a.requiredLevel <= state.level)
      .map((a) => a.id);
    if (Array.isArray(raw.unlockedContent))
      state.unlockedContent.push(...raw.unlockedContent.filter(id =>
        typeof id === "string" && id.startsWith("world:") && id.length < 80));
    state.ownedLootIds = Array.isArray(raw.ownedLootIds)
      ? [
          ...new Set(
            raw.ownedLootIds.filter(
              (id) => typeof id === "string" && id.length < 80,
            ),
          ),
        ]
      : [];
    state.sequence = data.amount(raw.sequence);
    const seenTickets = new Set();
    state.manualCombatTickets = Array.isArray(raw.manualCombatTickets)
      ? raw.manualCombatTickets
          .filter((ticket) => {
            if (
              !validCombatTicket(ticket) ||
              seenTickets.has(ticket.id) ||
              Number(ticket.id.slice(7)) > state.sequence
            )
              return false;
            seenTickets.add(ticket.id);
            return true;
          })
          .slice(-64)
          .map(copy)
      : [];
    if (
      validCombatTicket(raw.lastCombatReward) &&
      ["victory", "defeat"].includes(raw.lastCombatReward.outcome) &&
      Array.isArray(raw.lastCombatReward.levelUps) &&
      numberValue(raw.lastCombatReward.resultingLevel, data.levelCap)
    )
      state.lastCombatReward = copy(raw.lastCombatReward);
    const active = raw.activeExpedition;
    if (validActive(active)) {
      try {
        state.activeExpedition = personal.migrateActive(active);
      } catch {
        /* Unsupported preparation never awards incompatible personal loot. */
      }
    }
    const result = raw.pendingExpeditionResult;
    if (validReport(result)) {
      try {
        state.pendingExpeditionResult = personal.migrateReport(result);
        state.activeExpedition = null;
      } catch {
        /* Preserve other progression fields when an unknown report is corrupt. */
      }
    }
    if (
      validReport(raw.lastClaim) &&
      Array.isArray(raw.lastClaim.loot) &&
      Array.isArray(raw.lastClaim.levelUps)
    )
      state.lastClaim = copy(raw.lastClaim);
    if (state.pendingExpeditionResult?.id === state.lastClaim?.id)
      state.pendingExpeditionResult = null;
    quests.reconcile(state);
    return state;
  }
  function create({ storage, exclusive = (run) => run(), classDefinition = () => {
    try {
      const saved = JSON.parse(storage.getItem("nymeria.classes.v1"));
      return classData.classes[saved?.classId] || classData.classes.hunter;
    } catch { return classData.classes.hunter; }
  } }) {
    let state = initial(),
      error = "",
      unsupported = false;
    const listeners = new Set(), eventListeners = new Set();
    // UI failures must never turn a persisted operation into an apparent failed claim.
    function publishEvents(batch) {
      for (const event of batch)
        for (const listener of eventListeners) {
          try { listener(copy(event)); } catch { /* Feedback cannot alter game state. */ }
        }
    }
    function read() {
      unsupported = false;
      try {
        const saved = storage.getItem(KEY);
        let raw = null;
        try {
          raw = saved ? JSON.parse(saved) : null;
        } catch {
          /* Recover only this corrupt key, never touch other systems. */
        }
        if (raw?.version > data.schemaVersion || quests.unsupported(raw?.frontier)) {
          unsupported = true;
          error = "Versione del salvataggio progressione non supportata.";
          return false;
        }
        state = normalize(raw);
        error = "";
        return true;
      } catch {
        error =
          "Salvataggio locale non disponibile: le ricompense richiedono persistenza.";
        return false;
      }
    }
    read();
    function notify() {
      listeners.forEach((fn) => fn());
    }
    async function transact(mutator) {
      return exclusive(() => {
        const previous = JSON.stringify(state);
        if (!read() || unsupported) return { ok: false, message: error };
        if (JSON.stringify(state) !== previous) notify();
        const committedBefore = copy(state);
        const next = copy(state);
        const result = mutator(next);
        if (!result?.ok || result.unchanged) return result;
        Object.assign(next, data.fromTotal(next.totalXP));
        const worldUnlocks = next.unlockedContent.filter(id => id.startsWith("world:"));
        next.unlockedContent = activities.activities
          .filter((a) => a.requiredLevel <= next.level)
          .map((a) => a.id).concat(worldUnlocks);
        quests.reconcile(next);
        try {
          storage.setItem(KEY, JSON.stringify(next));
        } catch {
          error =
            "Salvataggio non riuscito: operazione non applicata. Riprova.";
          notify();
          return { ok: false, message: error };
        }
        state = next;
        error = "";
        let batch = [];
        try { batch = events.changes(committedBefore, next, classDefinition()); }
        catch { /* A feedback producer failure must not invalidate persisted rewards. */ }
        // Commit and semantic emission are independent of any presentation subscriber.
        publishEvents(batch);
        notify();
        return result;
      });
    }
    return {
      get state() {
        return copy(state);
      },
      get error() {
        return error;
      },
      transact,
      refresh() {
        read();
        notify();
      },
      subscribe: (fn) => listeners.add(fn),
      subscribeEvents(fn) {
        eventListeners.add(fn);
        return () => eventListeners.delete(fn);
      },
    };
  }
  return { KEY, initial, normalize, create };
})();
if (typeof module !== "undefined" && module.exports)
  module.exports = ProgressionStorage;
const ProgressionStore =
  typeof window !== "undefined"
    ? ProgressionStorage.create({
        storage: {
          getItem: (key) => localStorage.getItem(key),
          setItem: (key, value) => localStorage.setItem(key, value),
        },
        classDefinition: () => ClassSystem.selected(),
        exclusive: (run) =>
          navigator.locks
            ? navigator.locks.request("nymeria-progression", run)
            : run(),
      })
    : null;
