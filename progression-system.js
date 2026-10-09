/* Lifecycle orchestration. All durable reward changes happen in one store transaction. */
const ProgressionLifecycle = (() => {
  const data =
    typeof module !== "undefined" && module.exports
      ? require("./progression-data.js")
      : ProgressionData;
  const expeditions =
    typeof module !== "undefined" && module.exports
      ? require("./expedition-data.js")
      : ExpeditionData;
  const resolver =
    typeof module !== "undefined" && module.exports
      ? require("./expedition-engine.js")
      : ExpeditionEngine;
  const personal =
    typeof module !== "undefined" && module.exports
      ? require("./personal-loot.js")
      : PersonalLoot;
  const combat =
    typeof module !== "undefined" && module.exports
      ? require("./combat-data.js")
      : CombatData;
  const questEvents = typeof module !== "undefined" && module.exports
    ? require("./quest-events.js") : QuestEvents;
  const clock = typeof module !== "undefined" && module.exports ? require("./activity-clock.js") : ActivityClock;
  const copy = (value) => JSON.parse(JSON.stringify(value));
  function create({
    store,
    equipment,
    classes,
    combatSettings = () => null,
    now = () => Date.now(),
    random = Math.random,
    testMode = false,
    catalogue,
  }) {
    function snapshot() {
      const gear = {
        main: equipment.equipped("mainHand"),
        support: equipment.equipped("support"),
      };
      const profile = classes.combatProfile(undefined, undefined, gear);
      const settings = combatSettings();
      return copy({
        level: store.state.level,
        stats: equipment.state.resultingStats,
        profile,
        rules:
          settings?.mode === "custom" ? settings.rules : profile.defaultRules,
        effects: equipment.state.inventory
          .filter((i) => i.equipped)
          .flatMap((i) =>
            i.effects.map((effect) => ({ ...effect, itemId: i.id })),
          ),
        gearIds: Object.values(equipment.state.equipment).map(
          (entry) => entry.equippedItem,
        ),
        // Presentation metadata only; the combat engine still uses actual stats/gear.
        visualSnapshot: {
          character: { ...equipment.state.character },
          dye: equipment.state.equipmentAppearance?.dye || "sea",
          appearanceIds: Object.values(equipment.state.equipment).map(
            (entry) => entry.appearanceItem,
          ),
        },
      });
    }
    function start(activityId, options = {}) {
      return store.transact((state) => {
        if (state.activeExpedition || state.pendingExpeditionResult)
          return {
            ok: false,
            message:
              "Termina la spedizione o riscuoti il report prima di partire.",
          };
        const activity = expeditions.activity(activityId);
        if (!activity || state.level < activity.requiredLevel)
          return {
            ok: false,
            message: activity
              ? `Si sblocca al livello ${activity.requiredLevel}.`
              : "Attività non disponibile.",
          };
        const character = snapshot();
        if (!character.profile.kitValid)
          return {
            ok: false,
            message: `Equipaggia ${classes.selected().requirement} prima di partire.`,
          };
        const startedAt = now(),
          seed =
            (options.seed === undefined
              ? Math.floor(random() * 4294967296)
              : options.seed) >>> 0;
        if (!clock.validTime(startedAt) || !clock.validTime(startedAt + activity.durationMs))
          return {ok:false, message:"Orologio locale non valido: riprova."};
        state.sequence++;
        state.activeExpedition = {
          id: `exp-${state.sequence}-${startedAt}-${seed}`,
          activityId,
          activity: copy(activity),
          eventDefinitions: copy(expeditions.events),
          startedAt,
          endsAt: startedAt + activity.durationMs,
          seed,
          snapshot: character,
          lootPolicy: personal.create(activity, character.profile),
          rulesVersion: 1,
          testMode,
        };
        state.lastClaim = null;
        return {
          ok: true,
          message: `${activity.name} iniziata. Preparazione salvata per l’intera spedizione.`,
        };
      });
    }
    function finish(at, debug = false) {
      return store.transact((state) => {
        const active = state.activeExpedition;
        if (!active) return { ok: true, unchanged: true };
        if (debug && (!testMode || !active.testMode))
          return {
            ok: false,
            message:
              "Completamento di sviluppo disponibile solo per una spedizione TEST.",
          };
        if (!debug && at < active.endsAt) return { ok: true, unchanged: true };
        try {
          state.pendingExpeditionResult = resolver.resolve(active);
        } catch {
          return {
            ok: false,
            message:
              "Configurazione spedizione non valida; puoi interromperla senza perdere equipaggiamento.",
          };
        }
        state.pendingExpeditionResult.completedAt = debug
          ? now()
          : active.endsAt;
        state.activeExpedition = null;
        return { ok: true, message: "Report pronto. Riscuoti le ricompense." };
      });
    }
    function refresh() {
      const active = store.state.activeExpedition, at = now();
      if (!clock.validTime(at)) return Promise.resolve({ok:false, message:"Orologio locale non valido: riprova."});
      return active && at >= active.endsAt
        ? finish(at)
        : Promise.resolve({ ok: true, unchanged: true });
    }
    function cancel() {
      return store.transact((state) => {
        if (!state.activeExpedition)
          return { ok: false, message: "Nessuna spedizione in corso." };
        if (now() >= state.activeExpedition.endsAt)
          return {
            ok: false,
            message: "Spedizione già terminata: apri il report e riscuoti.",
          };
        state.activeExpedition = null;
        return {
          ok: true,
          message:
            "Spedizione interrotta: nessuna ricompensa, equipaggiamento conservato.",
        };
      });
    }
    // Shared reward application: expedition claims and manual combat use one XP/level path.
    function applyRewards(state, reward) {
      const previousLevel = state.level;
      state.totalXP = data.amount(state.totalXP + data.amount(reward.xp));
      state.crowns = data.amount(state.crowns + data.amount(reward.crowns));
      for (const key of Object.keys(state.materials))
        state.materials[key] = data.amount(
          state.materials[key] + data.amount(reward.materials?.[key]),
        );
      const after = data.fromTotal(state.totalXP);
      const levelUps = [];
      for (let level = previousLevel + 1; level <= after.level; level++)
        levelUps.push(level);
      return {
        previousLevel,
        resultingLevel: after.level,
        levelUps,
        growthClassId: classes.state.classId,
        statGains: data.statGains(
          classes.selected().statGrowthPerLevel, levelUps.length,
        ),
      };
    }
    function beginManualCombat(enemyId) {
      return store.transact((state) => {
        if (state.travel?.active || state.travel?.recoveryRequired) return {ok:false,message:"Concludi il viaggio prima del combattimento."};
        const enemy = combat.enemies[enemyId];
        if (!enemy) return { ok: false, message: "Nemico non disponibile." };
        state.sequence++;
        const ticket = {
          id: `combat-${state.sequence}`,
          enemyId,
          enemyLevel: enemy.level,
          difficulty: enemy.difficulty,
          rewards: combat.enemyRewards(enemy),
          startedAt: now(),
        };
        // Bounded abandoned-fight metadata; not a gameplay/farming limit.
        state.manualCombatTickets = [
          ...state.manualCombatTickets.slice(-63),
          ticket,
        ];
        return { ok: true, ticket: copy(ticket) };
      });
    }
    function awardManualCombat(id, outcome) {
      return store.transact((state) => {
        const ticket = state.manualCombatTickets.find(
          (ticket) => ticket.id === id,
        );
        if (!ticket || !["victory", "defeat"].includes(outcome))
          return {
            ok: false,
            message:
              "Ricompensa già assegnata o combattimento non disponibile.",
          };
        const rewards =
          outcome === "victory" ? ticket.rewards : { xp: 0, crowns: 0 };
        const progress = applyRewards(state, rewards);
        const receipt = {
          ...ticket,
          rewards,
          outcome,
          ...progress,
          awardedAt: now(),
        };
        state.manualCombatTickets = state.manualCombatTickets.filter(
          (ticket) => ticket.id !== id,
        );
        state.lastCombatReward = receipt;
        if (outcome === "victory") questEvents.dispatch(state, { type: "kill", target: ticket.enemyId });
        return { ok: true, receipt: copy(receipt), ...progress };
      });
    }
    function grantLoot(state, reward) {
      const loot = [];
      for (const itemId of reward.lootIds || []) {
        const item = catalogue.find(
          (item) => item.id === itemId && item.expeditionOnly,
        );
        if (!item) continue;
        const duplicate = state.ownedLootIds.includes(itemId);
        if (duplicate)
          state.materials.iron = data.amount(state.materials.iron + 2);
        else state.ownedLootIds.push(itemId);
        loot.push({ itemId, duplicate });
      }
      return loot;
    }
    // Shared transactional reward API; callers must enforce their own once-only claim.
    function grantRewards(state, reward) {
      return { ...applyRewards(state, reward), loot: grantLoot(state, reward) };
    }
    function claim(id) {
      return store.transact((state) => {
        const report = state.pendingExpeditionResult;
        if (!report || report.id !== id || state.lastClaim?.id === id)
          return {
            ok: false,
            message: "Ricompense già riscosse o report non disponibile.",
          };
        const reward = report.rewards;
        const progress = applyRewards(state, reward);
        const loot = grantLoot(state, reward);
        if (report.success) questEvents.dispatch(state, { type: "completeExpedition", target: report.activityId });
        const { previousLevel, resultingLevel, levelUps } = progress;
        state.lastClaim = {
          ...report,
          ...progress,
          loot,
          levelUps,
          previousLevel,
          resultingLevel,
          claimedAt: now(),
        };
        state.pendingExpeditionResult = null;
        return {
          ok: true,
          message: levelUps.length
            ? `LIVELLO ${resultingLevel} RAGGIUNTO · Ricompense riscosse`
            : "Ricompense riscosse",
          levelUps,
          loot,
        };
      });
    }
    return {
      snapshot,
      grantRewards,
      personalPreparation: () => personal.preparation(classes.combatProfile()),
      personalItems: (ids, policy) => ids.map(id => personal.counterpart(id, policy)).filter(Boolean),
      beginManualCombat,
      awardManualCombat,
      start,
      refresh,
      cancel,
      claim,
      testMode,
      debugComplete: () => finish(now(), true),
    };
  }
  return { create };
})();
if (typeof module !== "undefined" && module.exports)
  module.exports = ProgressionLifecycle;
const ProgressionSystem =
  typeof window !== "undefined"
    ? ProgressionLifecycle.create({
        store: ProgressionStore,
        equipment: Equipment,
        classes: ClassSystem,
        combatSettings: () => CombatUI.settings,
        catalogue: GearData.items,
        testMode: new URLSearchParams(location.search).get("test") === "1",
      })
    : null;
if (typeof window !== "undefined") {
  let gearKey = "";
  const reconcile = () => {
    const state = ProgressionStore.state,
      key = JSON.stringify([state.level, state.ownedLootIds]);
    if (key !== gearKey) {
      gearKey = key;
      Equipment.reconcileProgression();
    }
  };
  ProgressionStore.subscribe(reconcile);
  reconcile();
  window.addEventListener("storage", (event) => {
    if (event.key === ProgressionStorage.KEY || event.key === null)
      ProgressionStore.refresh();
  });
}
