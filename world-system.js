/* World actions orchestrate the existing fixed-step Combat Engine and M5 reward ledger. */
const WorldEngine = (() => {
  const node = typeof module !== "undefined" && module.exports;
  const data = node ? require("./world-data.js") : WorldData;
  const events = node ? require("./quest-events.js") : QuestEvents;
  const combat = node ? require("./combat-engine.js") : CombatEngine;
  const progressionData = node ? require("./progression-data.js") : ProgressionData;
  const clock = node ? require("./activity-clock.js") : ActivityClock;
  const copy = x => JSON.parse(JSON.stringify(x));
  function simulate(ticket, captureLog = false) {
    const engine = combat.create({ ...ticket.snapshot, enemyTemplate: ticket.template, seed: ticket.seed, captureLog });
    engine.start(); engine.advance(180);
    return engine;
  }
  function estimate(enemy, snapshot) {
    if (!snapshot.profile.kitValid) return "Pericoloso";
    const probes = [7, 31, 97].map(seed => simulate({ snapshot, template: enemy, seed }));
    const wins = probes.filter(e => e.result?.outcome === "victory").length;
    const health = probes.reduce((sum, e) => sum + e.player.hp / e.player.maxHp, 0) / probes.length;
    return wins === probes.length ? health >= 0.5 ? "Facile" : "Adeguato" : wins ? "Difficile" : "Pericoloso";
  }
  function create({ store, progression, now = () => Date.now(), random = Math.random, testMode = false, discovery = null }) {
    const unlocked = (state, id) => data.location(id)?.discoveryType ? !!discovery?.accessible(id) : state.unlockedContent.includes(`world:${id}`);
    const available = state => !state.frontier.activeEncounter && !state.travel?.active && !state.travel?.recoveryRequired;
    function enter(id) {
      return store.transact(state => {
        if (!data.location(id) || !unlocked(state, id)) return { ok: false, message: "Questo luogo non è ancora accessibile." };
        if (!available(state)) return { ok: false, message: state.travel?.active ? "Concludi il viaggio prima di spostarti." : state.travel?.recoveryRequired ? "Dati di viaggio da recuperare: spostamento non applicato." : "Termina l'incontro prima di viaggiare." };
        if (data.location(id).discoveryType && !state.unlockedContent.includes(`world:${id}`)) state.unlockedContent.push(`world:${id}`);
        state.frontier.location = id;
        events.dispatch(state, { type: "visit", target: id });
        return { ok: true, message: data.location(id).name };
      });
    }
    function talk(id) {
      return store.transact(state => {
        const npc = data.npcs.find(x => x.id === id);
        if (!unlocked(state, state.frontier.location) || !npc || npc.location !== state.frontier.location || !available(state)) return { ok: false, message: "Raggiungi il personaggio nel suo luogo." };
        events.dispatch(state, { type: "talk", target: id });
        const dialogue = npc.dialogues.filter(d => !d.after || state.frontier.quests[d.after]?.status === "claimed").pop();
        return { ok: true, message: `${npc.name}: ${dialogue.text}` };
      });
    }
    function explore(id) {
      return store.transact(state => {
        if (!unlocked(state, state.frontier.location)) return { ok: false, message: "Luogo non accessibile." };
        const point = data.location(state.frontier.location).points.find(x => x.id === id);
        if (!point || !available(state)) return { ok: false, message: "Punto d'interesse non accessibile." };
        if (point.requiresDefeat && !state.frontier.defeatedEnemies.includes(point.requiresDefeat))
          return { ok: false, message: "Il comandante controlla ancora il passaggio." };
        events.dispatch(state, { type: "visit", target: point.id });
        if (point.collect) collect(state, point.collect);
        if (point.discovery) state.frontier.discoveries = [...new Set([...state.frontier.discoveries, point.discovery])];
        return { ok: true, message: point.text + (point.discovery ? " Non decifrata · Richiede Archeologia 10." : point.collect ? ` +1 ${data.supplyNames[point.collect]}.` : "") };
      });
    }
    function collect(state, id) {
      state.frontier.supplies[id] = Math.min(1e6, (state.frontier.supplies[id] || 0) + 1);
      events.dispatch(state, { type: "collect", target: id });
    }
    function startEncounter(enemyId, options = {}) {
      return store.transact(state => {
        const location = data.location(state.frontier.location), enemy = data.enemy(enemyId);
        if (!enemy || !location.enemies.includes(enemyId) || !unlocked(state, location.id)) return { ok: false, message: "Incontro non disponibile in questo luogo." };
        if (!available(state)) return { ok: false, message: "Hai già un incontro in corso." };
        const snapshot = progression.snapshot();
        if (!snapshot.profile.kitValid) return { ok: false, message: "Prepara il kit della tua classe in Equipaggiamento." };
        const startedAt = now();
        if (!clock.validTime(startedAt)) return {ok:false, message:"Orologio locale non valido: riprova."};
        state.sequence++;
        const ticket = {
          id: `world-${state.sequence}`, enemyId, location: location.id,
          seed: (options.seed ?? Math.floor(random() * 4294967296)) >>> 0,
          startedAt, clock: clock.create(startedAt, options.speed), snapshot, template: copy(enemy),
          lootPolicy: progression.personalPreparation(),
        };
        state.frontier.activeEncounter = ticket;
        return { ok: true, ticket: copy(ticket), message: `${enemy.name} · incontro iniziato` };
      });
    }
    function changeClock(id, running, speed) {
      return store.transact(state => {
        const ticket = state.frontier.activeEncounter;
        if (!ticket || ticket.id !== id) return {ok:false, message:"Incontro non disponibile."};
        const at = now();
        if (!clock.validTime(at) || (speed !== undefined && ![1,2,4].includes(speed)))
          return {ok:false, message:"Orologio o velocità non validi: riprova."};
        // Completion and a late pause are ordered inside the same durable transaction.
        if (ticket.clock?.running && isComplete(ticket, at)) return settleTicket(state, ticket);
        if (ticket.clock?.running === running && (speed === undefined || ticket.clock.speed === speed))
          return {ok:true, unchanged:true};
        const next = clock.transition(ticket.clock, at, running, speed);
        if (!next) return {ok:false, message:"Orologio locale non valido: riprova."};
        ticket.clock = next;
        return {ok:true};
      });
    }
    function elapsed(ticket = store.state.frontier.activeEncounter) {
      return clock.elapsed(ticket?.clock, now()) / 1000;
    }
    function refresh() {
      return store.transact(state => {
        const at = now(), ticket = state.frontier.activeEncounter;
        if (!clock.validTime(at)) return {ok:false, message:"Orologio locale non valido: riprova."};
        if (!ticket?.clock?.running) return {ok:true, unchanged:true};
        try {
          return isComplete(ticket, at) ? settleTicket(state, ticket) : {ok:true, unchanged:true};
        } catch { return {ok:false, message:"Incontro non ricostruibile; nessuna ricompensa applicata."}; }
      });
    }
    function settleTicket(state, ticket) {
      const engine = simulate(ticket);
      const outcome = engine.result?.outcome || "defeat";
      const victory = outcome === "victory";
      const rewards = victory ? copy(ticket.template.rewards) : { xp: 0, crowns: 0 };
      const progress = progression.grantRewards(state, rewards);
      if (victory) {
        events.dispatch(state, { type: "kill", target: ticket.enemyId });
        if (ticket.template.kind !== "normal") events.dispatch(state, { type: "defeatBoss", target: ticket.enemyId });
        state.frontier.defeatedEnemies = [...new Set([...state.frontier.defeatedEnemies, ticket.enemyId])];
        ticket.template.drops.forEach(id => collect(state, id));
      } else state.frontier.location = "veyra";
      const receipt = {
        id: ticket.id, enemyId: ticket.enemyId, enemyName: ticket.template.name, location: ticket.location,
        outcome, rewards, drops: victory ? ticket.template.drops : [],
        result: engine.result, className: ticket.snapshot.profile.className,
        awardedAt: now(), ...progress,
      };
      state.frontier.lastEncounter = receipt;
      state.frontier.activeEncounter = null;
      return { ok: true, receipt: copy(receipt), message: victory ? "Vittoria · ricompense salvate" : "Sconfitta · ritorno a Veyra. Nessuna perdita, nessuna ricompensa." };
    }
    function isComplete(ticket, at) {
      const seconds = clock.elapsed(ticket.clock, at) / 1000;
      const replay = combat.create({...ticket.snapshot, enemyTemplate:ticket.template, seed:ticket.seed, captureLog:false});
      replay.start(); replay.advance(seconds);
      return !!replay.result || seconds >= 180;
    }
    function finishEncounter(id, {respectPause = false} = {}) {
      return store.transact(state => {
        if (state.frontier.lastEncounter?.id === id && !state.frontier.activeEncounter)
          return { ok: true, unchanged: true, receipt: copy(state.frontier.lastEncounter) };
        const ticket = state.frontier.activeEncounter;
        if (!ticket || ticket.id !== id) return { ok: false, message: "Incontro già concluso o non disponibile." };
        if (respectPause && ticket.clock?.running === false)
          return {ok:false, message:"Incontro in pausa: riprendi prima di proseguire."};
        return settleTicket(state, ticket);
      });
    }
    function abandonEncounter() {
      return store.transact(state => {
        if (!state.frontier.activeEncounter) return { ok: false, message: "Nessun incontro in corso." };
        state.frontier.activeEncounter = null;
        state.frontier.location = "veyra";
        return { ok: true, message: "Ritorno a Veyra. Nessuna ricompensa o penalità." };
      });
    }
    function debug(action, value) {
      if (!testMode) return Promise.resolve({ ok: false, message: "Solo DEBUG · ?test=1" });
      return store.transact(state => {
        if (action === "unlock" && data.location(value)) state.unlockedContent.push(`world:${value}`);
        else if (action === "xp") state.totalXP = progressionData.amount(state.totalXP + Number(value));
        else return { ok: false, message: "Comando DEBUG non valido." };
        return { ok: true, message: "DEBUG · salvataggio locale aggiornato" };
      });
    }
    return { enter, talk, explore, startEncounter, finishEncounter, refresh, elapsed,
      pauseEncounter: id => changeClock(id, false),
      resumeEncounter: (id, speed) => changeClock(id, true, speed), abandonEncounter, debug, testMode,
      get state() { return store.state.frontier; },
      estimate: enemyId => estimate(data.enemy(enemyId), progression.snapshot()) };
  }
  return { create, simulate, estimate };
})();
if (typeof module !== "undefined" && module.exports) module.exports = WorldEngine;
const WorldSystem = typeof window !== "undefined" ? WorldEngine.create({
  store: ProgressionStore, progression: ProgressionSystem,
  discovery: typeof WorldDiscovery !== "undefined" ? WorldDiscovery : null,
  testMode: new URLSearchParams(location.search).get("test") === "1",
}) : null;
const QuestSystem = typeof window !== "undefined" ? QuestEngine.create({
  store: ProgressionStore, progression: ProgressionSystem, classes: ClassSystem,
  professions: () => typeof ProfessionUI !== "undefined" ? ProfessionUI.engine : null,
  testMode: new URLSearchParams(location.search).get("test") === "1",
}) : null;
