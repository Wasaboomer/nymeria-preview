/* Generic quest state machine + additive Frontier save schema. No quest IDs in logic. */
const QuestEngine = (() => {
  const node = typeof module !== "undefined" && module.exports;
  const data = node ? require("./quest-data.js") : QuestData;
  const world = node ? require("./world-data.js") : WorldData;
  const events = node ? require("./quest-events.js") : QuestEvents;
  const clock = node ? require("./activity-clock.js") : ActivityClock;
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const statuses = ["locked", "available", "active", "completed", "claimed"];
  function normalize(raw = {}) {
    const frontier = {
      version: 1, zoneVersion: 1, questVersion: 2, discoveryVersion: 1, achievementVersion: 1,
      location: world.location(raw?.location) ? raw.location : "veyra",
      quests: {}, trackedQuest: null, discoveries: [], achievements: [],
      defeatedEnemies: [], supplies: {}, activeEncounter: null, lastEncounter: null, lastQuestClaim: null,
    };
    for (const quest of data.quests) {
      const old = raw?.quests?.[quest.id];
      frontier.quests[quest.id] = {
        ...(old?.lootPolicy?.kind === "personalLoot" ? { lootPolicy: copy(old.lootPolicy) } : {}),
        status: statuses.includes(old?.status) ? old.status : "locked",
        progress: quest.objectives.map((o, i) => Math.min(o.count,
          Math.max(0, Math.floor(Number(old?.progress?.[i]) || 0)))),
      };
    }
    for (const [key, definitions] of [["discoveries", world.discoveries], ["achievements", world.achievements], ["defeatedEnemies", world.enemies]])
      frontier[key] = Array.isArray(raw?.[key]) ? [...new Set(raw[key].filter(id => definitions.some(x => x.id === id)))] : [];
    for (const id of Object.keys(world.supplyNames))
      frontier.supplies[id] = Math.min(1e6, Math.max(0, Math.floor(Number(raw?.supplies?.[id]) || 0)));
    if (data.get(raw?.trackedQuest)) frontier.trackedQuest = raw.trackedQuest;
    const active = raw?.activeEncounter;
    if (active && typeof active.id === "string" && /^world-\d+$/.test(active.id) &&
        world.enemy(active.enemyId) && world.location(active.location) &&
        Number.isInteger(active.seed) && active.seed >= 0 && active.seed <= 4294967295 &&
        active.snapshot?.profile?.kitValid && Array.isArray(active.snapshot?.profile?.abilities) &&
        Array.isArray(active.snapshot?.rules) && Array.isArray(active.snapshot?.effects) &&
        Object.values(active.snapshot?.stats || {}).length === 7 &&
        Object.values(active.snapshot.stats).every(x => Number.isFinite(x) && x >= 0) &&
        Number.isFinite(active.template?.maxHp) && active.template.maxHp > 0 &&
        Array.isArray(active.template?.attacks) && active.template.attacks.length)
      { frontier.activeEncounter = copy(active);
        if (active.clock !== undefined) {
          const normalized = clock.normalize(active.clock);
          if (normalized) frontier.activeEncounter.clock = normalized;
          else delete frontier.activeEncounter.clock; // Safe legacy/manual resume, never invent offline time.
        }
      }
    for (const key of ["lastEncounter", "lastQuestClaim"])
      if (raw?.[key] && typeof raw[key].id === "string") frontier[key] = copy(raw[key]);
    return frontier;
  }
  function unsupported(raw) {
    return raw?.activeEncounter?.clock?.version > 1 || raw?.questVersion > 2 || ["version", "zoneVersion", "discoveryVersion", "achievementVersion"].some(key => raw?.[key] > 1);
  }
  function reconcile(state) {
    const frontier = state.frontier;
    const unlocks = new Set(state.unlockedContent);
    for (const location of world.locations.filter(x => x.initial)) unlocks.add(`world:${location.id}`);
    for (const quest of data.quests) {
      const entry = frontier.quests[quest.id];
      if (entry.status === "claimed")
        quest.contentUnlocks.forEach(id => unlocks.add(`world:${id}`));
      else if (["locked", "available"].includes(entry.status))
        entry.status = state.level >= quest.minimumLevel &&
          quest.prerequisites.every(id => frontier.quests[id]?.status === "claimed")
          ? "available" : "locked";
      else if (entry.status === "active" && quest.objectives.every((o, i) => entry.progress[i] >= o.count))
        entry.status = "completed";
    }
    state.unlockedContent = [...unlocks];
    if (!unlocks.has(`world:${frontier.location}`)) frontier.location = "veyra";
    if (frontier.quests[frontier.trackedQuest]?.status === "claimed") frontier.trackedQuest = null;
  }
  function create({ store, progression, now = () => Date.now(), testMode = false, professions = () => null }) {
    function accept(id) {
      return store.transact(state => {
        const quest = data.get(id), entry = state.frontier.quests[id];
        if (!quest || entry.status !== "available") return { ok: false, message: "Missione non disponibile." };
        if (state.travel?.active || state.travel?.recoveryRequired || state.frontier.location !== quest.location) return { ok: false, message: "Incontra prima il committente nel suo luogo." };
        entry.lootPolicy = progression.personalPreparation();
        entry.status = "active";
        state.frontier.trackedQuest = id;
        events.dispatch(state, { type: "visit", target: state.frontier.location });
        return { ok: true, message: `Missione accettata: ${quest.title}` };
      });
    }
    function track(id) {
      return store.transact(state => {
        if (id !== null && !["active", "completed"].includes(state.frontier.quests[id]?.status))
          return { ok: false, message: "Puoi tracciare una missione attiva." };
        state.frontier.trackedQuest = id;
        return { ok: true };
      });
    }
    function claim(id) {
      return store.transact(state => {
        const quest = data.get(id), entry = state.frontier.quests[id];
        if (!quest || entry.status !== "completed") return { ok: false, message: "Missione non completata o ricompensa già riscossa." };
        const rewards = copy(quest.rewards);
        // Preparation is fixed at acceptance, independent of later prototype class changes.
        const policy = entry.lootPolicy || progression.personalPreparation();
        rewards.lootIds = progression.personalItems(rewards.personalLoot || [], policy).concat(rewards.items || []);
        const result = progression.grantRewards(state, rewards);
        entry.status = "claimed";
        state.frontier.achievements = [...new Set([...state.frontier.achievements, ...(rewards.achievements || [])])];
        quest.contentUnlocks.forEach(location => state.unlockedContent.push(`world:${location}`));
        state.frontier.lastQuestClaim = { id, title: quest.title, rewards, ...result, lootPolicy: policy, claimedAt: now() };
        return { ok: true, message: `Ricompense riscosse · ${quest.title}`, receipt: copy(state.frontier.lastQuestClaim) };
      });
    }
    async function deliver(id) {
      const quest = data.get(id), profession = professions();
      const objective = quest?.objectives.find(o => o.type === 'professionDelivery');
      if (!objective || !profession || store.state.frontier.quests[id]?.status !== 'active')
        return {ok:false, message:'Consegna non disponibile o già effettuata.'};
      // Reserve the material with a durable receipt first; retries never consume it again.
      const reserved = await profession.handover(id);
      if (!reserved.ok) return reserved;
      return store.transact(state => {
        const entry = state.frontier.quests[id];
        const receipt = profession.deliveryReceipt(id);
        if (entry.status !== 'active' || state.travel?.active || state.travel?.recoveryRequired || state.frontier.location !== quest.location || state.frontier.activeEncounter)
          return {ok:false, message:'Consegna già registrata: torna da Bram per completarla.'};
        if (!receipt || receipt.material !== objective.target || receipt.amount !== objective.count)
          return {ok:false, message:'Consegna non verificabile. Il rinforzo registrato resta conservato; riprova.'};
        events.dispatch(state, {type:'professionDelivery',target:objective.target,quantity:receipt.amount});
        return {ok:true, message:'Rinforzo consegnato a Bram. Riscuoti la ricompensa della missione.'};
      });
    }
    function debug(id, action) {
      if (!testMode) return Promise.resolve({ ok: false, message: "Solo DEBUG · ?test=1" });
      return store.transact(state => {
        const quest = data.get(id), entry = state.frontier.quests[id];
        if (!quest || !["active", "completed"].includes(entry.status)) return { ok: false, message: "Accetta prima una missione. Le missioni riscosse non possono essere resettate." };
        entry.progress = quest.objectives.map(o => action === "complete" ? o.count : 0);
        entry.status = action === "complete" ? "completed" : "active";
        return { ok: true, message: `DEBUG · ${action === "complete" ? "obiettivi completati" : "progresso azzerato"}` };
      });
    }
    return { accept, track, claim, deliver, debug, testMode, get state() { return store.state.frontier; } };
  }
  return { normalize, unsupported, reconcile, create, statuses, dispatch: events.dispatch };
})();
if (typeof module !== "undefined" && module.exports) module.exports = QuestEngine;
