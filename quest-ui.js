/* Shared journal, NPC offers and compact tracked quest presentation. */
const QuestUI = (() => {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const statusNames = { locked: "Bloccata", available: "Disponibile", active: "Attiva", completed: "Da riscuotere", claimed: "Riscossa" };
  function rewards(reward) {
    const parts = [`${reward.xp || 0} XP`, `${reward.crowns || 0} Corone`];
    for (const [id, count] of Object.entries(reward.materials || {})) parts.push(`${count} ${ProgressionData.materialNames[id]}`);
    for (const id of reward.items || []) parts.push(GearData.items.find(x => x.id === id)?.name || id);
    if (reward.personalLoot?.length) parts.push("Equipaggiamento personale · compatibile con la classe all'accettazione");
    if (reward.achievements?.length) parts.push("Titolo: Conquistatore della Frontiera");
    return parts.map(escape).join(" · ");
  }
  function actions(quest, entry, state) {
    if (entry.status === "available") return state.frontier.location === quest.location
      ? `<button data-quest-accept="${quest.id}">Accetta e segui missione</button>`
      : `<button data-quest-giver="${quest.id}">Incontra ${escape(WorldData.npcs.find(n => n.id === quest.giver).name)}</button>`;
    if (entry.status === "completed") return `<button data-quest-claim="${quest.id}" class="quest-primary">Riscuoti ricompense</button>`;
    if (entry.status === "active") return `<button data-quest-track="${quest.id}" aria-pressed="${state.frontier.trackedQuest === quest.id}">${state.frontier.trackedQuest === quest.id ? "Stai seguendo questa missione" : "Segui questa missione"}</button>`;
    return "";
  }
  function guidance(quest, state) {
    const entry = state.frontier.quests[quest.id];
    if (entry.status === "available") return `<section class="quest-next-step"><strong>Prima di iniziare</strong><p>Accetta la missione: da quel momento le azioni conteranno per gli obiettivi.</p></section>`;
    if (entry.status === "completed") return '<section class="quest-next-step"><strong>Obiettivi completati</strong><p>Riscuoti le ricompense per concludere la missione e ottenere gli eventuali sblocchi.</p></section>';
    if (entry.status !== "active") return "";
    const index = quest.objectives.findIndex((o, i) => entry.progress[i] < o.count);
    if (index < 0) return "";
    const objective = quest.objectives[index], destination = objectiveLocation(objective);
    let label = "", attribute = "", target = objective.target, hint = "";
    if (destination === "activities") {
      attribute = 'data-quest-expedition'; label = 'Apri Attività · Spedizioni';
      hint = 'Avvia la spedizione indicata e riscuoti il risultato: partire soltanto non completa questo obiettivo.';
    } else if (destination && destination !== state.frontier.location) {
      const location = WorldData.location(destination);
      attribute = `data-quest-destination="${destination}"`; label = `Vai a ${location.name}`;
      hint = `Qui puoi proseguire: ${objective.label.toLowerCase()}.`;
      if (!state.unlockedContent.includes(`world:${destination}`)) return `<section class="quest-next-step"><strong>Prossimo passo</strong><p>${escape(objective.label)}</p><small>${escape(location.name)} è bloccato. ${escape(location.unlockHint || 'Completa le missioni precedenti e riscuoti le ricompense.')}</small></section>`;
    } else if (objective.type === "talk") {
      attribute = `data-world-talk="${target}"`; label = `Parla con ${WorldData.npcs.find(n => n.id === target)?.name || target}`;
      hint = 'Il dialogo conta per questa missione.';
    } else if (["kill", "defeatBoss"].includes(objective.type)) {
      attribute = `data-world-fight="${target}"`; label = `Combatti ${WorldData.enemy(target)?.name || target}`;
      hint = 'Devi vincere l’incontro per far avanzare l’obiettivo.';
    } else {
      const location = WorldData.location(destination || state.frontier.location);
      const point = location?.points.find(p => p.id === target || p.collect === target);
      const enemy = location?.enemies.map(WorldData.enemy).find(e => e.drops.includes(target));
      if (point) {
        attribute = `data-world-explore="${point.id}"`; label = point.collect ? `Raccogli ${WorldData.supplyNames[target] || point.name}` : `Esamina ${point.name}`;
        hint = point.collect ? 'Ripeti la raccolta finché raggiungi la quantità richiesta.' : 'Esaminare questo punto fa avanzare la missione.';
        if (point.requiresDefeat && !state.frontier.defeatedEnemies.includes(point.requiresDefeat)) {
          attribute = `data-world-fight="${point.requiresDefeat}"`; label = `Combatti ${WorldData.enemy(point.requiresDefeat).name}`; hint = 'Il passaggio si apre dopo aver sconfitto questo nemico.';
        }
      } else if (enemy) {
        attribute = `data-world-fight="${enemy.id}"`; label = `Combatti ${enemy.name}`;
        hint = `Ottieni ${WorldData.supplyNames[target] || objective.label} vincendo questo incontro. Non devi cercare un oggetto a terra.`;
      } else if (WorldData.location(target)) {
        attribute = `data-quest-destination="${target}"`; label = `Visita ${WorldData.location(target).name}`;
      }
    }
    return `<section class="quest-next-step"><strong>Prossimo passo</strong><p>${escape(objective.label)} <b>${entry.progress[index]} / ${objective.count}</b></p>${hint ? `<small>${escape(hint)}</small>` : ""}${attribute ? `<button ${attribute} class="quest-primary">${escape(label)} →</button>` : ""}</section>`;
  }
  function card(quest, state) {
    const entry = state.frontier.quests[quest.id];
    const npc = WorldData.npcs.find(x => x.id === quest.giver);
    const unlocks = quest.contentUnlocks.map(id => WorldData.location(id).name);
    return `<details class="quest-card quest-${entry.status}" data-quest-card="${quest.id}" ${["available", "active", "completed"].includes(entry.status) ? "open" : ""}><summary><span><small>${quest.type === "main" ? "MISSIONE PRINCIPALE" : "MISSIONE SECONDARIA"} · LIV. ${quest.minimumLevel}</small><strong>${escape(quest.title)}</strong></span><b>${statusNames[entry.status]}</b></summary><p>${escape(quest.description)}</p><small>${escape(npc.name)} · ${escape(WorldData.location(quest.location).name)}</small>${guidance(quest, state)}<h4>Obiettivi</h4><ul class="quest-objectives">${quest.objectives.map((o, i) => `<li class="${entry.progress[i] >= o.count ? "objective-done" : ""}"><span>${escape(o.label)}</span><b>${entry.progress[i]} / ${o.count}</b></li>`).join("")}</ul><p class="quest-rewards"><strong>Ricompensa</strong><br>${rewards(quest.rewards)}</p>${unlocks.length ? `<small>Sblocca: ${unlocks.map(escape).join(", ")}</small>` : ""}${entry.status === "locked" ? `<p class="hint">Richiede livello ${quest.minimumLevel}${quest.prerequisites.length ? ` e ${quest.prerequisites.map(id => escape(QuestData.get(id).title)).join(", ")}` : ""}.</p>` : ""}<div class="quest-actions">${actions(quest, entry, state)}</div></details>`;
  }
  function journal(state) {
    return [["main", "Principale"], ["side", "Secondarie"]].map(([type, title]) =>
      `<section class="journal-group"><h4>${title}</h4>${QuestData.quests.filter(q => q.type === type).sort((a,b) => ["completed","active","available","locked","claimed"].indexOf(state.frontier.quests[a.id].status) - ["completed","active","available","locked","claimed"].indexOf(state.frontier.quests[b.id].status)).map(q => `<button class="journal-entry" data-quest-open="${q.id}"><span><strong>${escape(q.title)}</strong><small>${statusNames[state.frontier.quests[q.id].status]}</small></span><b aria-hidden="true">→</b></button>`).join("")}</section>`).join("");
  }
  function offers(npcId, state) {
    return QuestData.quests.filter(q => q.giver === npcId && ["available", "active", "completed"].includes(state.frontier.quests[q.id].status) && !(state.frontier.trackedQuest === q.id && state.frontier.quests[q.id].status === "active"))
      .map(q => `<div class="npc-offer"><strong>${escape(q.title)}</strong><small>${statusNames[state.frontier.quests[q.id].status]}</small>${actions(q, state.frontier.quests[q.id], state)}</div>`).join("");
  }
  function objectiveLocation(objective) {
    if (objective.type === "talk") return WorldData.npcs.find(n => n.id === objective.target)?.location;
    if (objective.type === "completeExpedition") return "activities";
    return WorldData.locations.find(location => location.id === objective.target || location.enemies.includes(objective.target) || location.points.some(p => p.id === objective.target || p.collect === objective.target) || location.enemies.some(id => WorldData.enemy(id).drops.includes(objective.target)))?.id;
  }
  function tracker(state) {
    const quest = QuestData.get(state.frontier.trackedQuest) || QuestData.quests.find(q => state.frontier.quests[q.id].status === "completed") || QuestData.quests.find(q => state.frontier.quests[q.id].status === "active");
    if (!quest) {
      const next = QuestData.quests.find(q => q.type === "main" && state.frontier.quests[q.id].status === "available");
      return next ? `<span class="world-eyebrow">PROSSIMA MISSIONE</span><strong>${escape(next.title)}</strong><small>Incontra ${escape(WorldData.npcs.find(n => n.id === next.giver).name)} · ${escape(WorldData.location(next.location).name)}</small>${actions(next, state.frontier.quests[next.id], state)}` : '<span class="world-eyebrow">LA FRONTIERA TI ATTENDE</span><small>Esplora il luogo o consulta il Diario.</small>';
    }
    const entry = state.frontier.quests[quest.id];
    const pending = quest.objectives.map((o, i) => ({o, i})).filter(({o, i}) => entry.progress[i] < o.count);
    return `<span class="world-eyebrow">MISSIONE DA SEGUIRE · ${statusNames[entry.status]}</span><button class="tracker-title" data-quest-open="${quest.id}">${escape(quest.title)} →</button>${guidance(quest, state)}<ul>${pending.map(({o, i}) => {
      const destination = objectiveLocation(o);
      return `<li><span>${escape(o.label)}${destination && destination !== state.frontier.location ? `<small>${destination === "activities" ? "Attività → Spedizioni" : escape(WorldData.location(destination).name)}</small>` : ""}</span><b>${entry.progress[i]}/${o.count}</b></li>`;
    }).join("")}</ul>${entry.status === "completed" ? actions(quest, entry, state) : ""}`;
  }
  return { escape, rewards, journal, offers, tracker, card, objectiveLocation, guidance };
})();
