/* Shared journal, NPC offers and compact tracked quest presentation. */
const QuestUI = (() => {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const statusNames = { locked: "Bloccata", available: "Disponibile", active: "Attiva", completed: "✓ Da riscuotere", claimed: "✓ Completata · Riscossa" };
  function category(quest) {
    return quest.type === "main" ? {id: "main", label: "MISSIONE PRINCIPALE"}
      : quest.objectives.some(o => o.type === "professionDelivery") ? {id: "profession", label: "ATTIVITÀ PROFESSIONALE"}
      : {id: "side", label: "MISSIONE SECONDARIA"};
  }
  function rewards(reward) {
    const parts = [`${reward.xp || 0} XP`, `${reward.crowns || 0} Corone`];
    for (const [id, count] of Object.entries(reward.materials || {})) parts.push(`${count} ${ProgressionData.materialNames[id]}`);
    for (const id of reward.items || []) parts.push(GearData.items.find(x => x.id === id)?.name || id);
    if (reward.personalLoot?.length) parts.push("Equipaggiamento personale · compatibile con la classe all'accettazione");
    if (reward.achievements?.length) parts.push("Titolo: Conquistatore della Frontiera");
    return parts.map(escape).join(" · ");
  }
  function rewardComparison(id, state) {
    if (!["mq04", "mq05"].includes(id)) return "";
    const quest = QuestData.get(id), entry = state.frontier.quests[id];
    if (entry?.status !== "claimed") return "";
    const receipt = state.frontier.lastQuestClaim;
    const ids = receipt?.id === id ? receipt.loot.map(row => row.itemId)
      : entry.lootPolicy ? ProgressionSystem.personalItems(quest.rewards.personalLoot, entry.lootPolicy) : [];
    const item = ids.map(id => Equipment.state.inventory.find(item => item.id === id)).find(Boolean);
    if (!item || Object.values(Equipment.state.equipment).some(slot => slot.equippedItem === item.id)) return "";
    const slot = Equipment.compatibleSlots(item)[0];
    if (!slot || Equipment.canEquip(item.id, slot)) return "";
    const advice = BuildSystem.advise(item, slot, ClassSystem.state.classId, ClassSystem.build().id, Equipment);
    if (!advice?.improvement) return "";
    return `<section class="quest-next-step"><strong>Ricompensa · ${escape(item.name)}</strong><small>Confrontala con l’equipaggiamento attuale. Decidi tu se equipaggiarla.</small><button data-quest-compare="${escape(item.id)}" class="quest-primary">${id === "mq04" ? "Confronta la nuova arma" : "Confronta la nuova corazza"} →</button></section>`;
  }
  function actions(quest, entry, state) {
    if (entry.status === "available") return state.frontier.location === quest.location
      ? `<button data-quest-accept="${quest.id}" class="quest-primary">Accetta e segui missione</button>`
      : `<button data-quest-giver="${quest.id}" class="quest-primary">Incontra ${escape(WorldData.npcs.find(n => n.id === quest.giver).name)}</button>`;
    if (entry.status === "completed") return `<button data-quest-claim="${quest.id}" class="quest-primary">Riscuoti ricompense</button>`;
    if (entry.status === "active") return `<button data-quest-track="${quest.id}" aria-pressed="${state.frontier.trackedQuest === quest.id}">${state.frontier.trackedQuest === quest.id ? "Stai seguendo questa missione" : "Segui questa missione"}</button>`;
    if (entry.status === "claimed" && quest.objectives.some(o => o.type === 'professionDelivery')) return '<button data-quest-inventory>Apri Inventario · confronta l’anello →</button>';
    return "";
  }
  // Shared projection of existing quest data/state; never advances objectives.
  function nextStep(quest, state) {
    const entry=state.frontier.quests[quest.id];
    const index=entry?.status==='active'?quest.objectives.findIndex((o,i)=>entry.progress[i]<o.count):-1;
    const objective=index>=0?quest.objectives[index]:null;
    const destination=objective?objectiveLocation(objective):quest.location;
    const location=WorldData.location(destination);
    const reachable=destination==='activities'||!!location&&(location.discoveryType
      ?typeof WorldDiscovery!=='undefined'&&!!WorldDiscovery?.accessible(location.id)
      :state.unlockedContent.includes('world:'+location.id));
    return {status:entry?.status,objective,index,progress:objective?entry.progress[index]:null,
      destination,destinationName:destination==='activities'?'Attività · Spedizioni':location?.name||null,
      reachable,blockedReason:location&&!reachable?location.unlockHint||'Completa le missioni precedenti e riscuoti le ricompense.':null};
  }
  function guidance(quest, state, compact = false) {
    const entry = state.frontier.quests[quest.id];
    if (entry.status === "available") return `<section class="quest-next-step"><strong>Missione disponibile</strong><p>Accetta da ${escape(WorldData.npcs.find(n => n.id === quest.giver)?.name || quest.giver)} · ${escape(WorldData.location(quest.location)?.name || quest.location)}. Solo le azioni successive contano.</p></section>`;
    if (entry.status === "completed") return '<section class="quest-next-step"><strong>Obiettivi completati</strong><p>Riscuoti le ricompense per concludere la missione e ottenere gli eventuali sblocchi.</p></section>';
    if (entry.status !== "active") return "";
    const step=nextStep(quest,state), {index,objective,destination}=step;
    if (!objective) return "";
    const heading=`<strong>Prossimo passo</strong>${compact?'':`<p>${escape(objective.label)} <b>${step.progress} / ${objective.count}</b></p><small>Destinazione: ${escape(step.destinationName||'Non indicata nei dati della missione')}</small>`}`;
    if(step.blockedReason)return `<section class="quest-next-step">${heading}<p>${escape(step.destinationName)} è bloccato. ${escape(step.blockedReason)}</p></section>`;
    if (objective.type === 'professionDelivery') {
      const profession = typeof ProfessionUI !== 'undefined' ? ProfessionUI.engine.state : null;
      const registered = !!profession?.deliveries[quest.id];
      const ready = (profession?.materials[objective.target] || 0) >= objective.count || registered;
      const attribute = !ready ? 'data-quest-professions' : state.frontier.location !== quest.location ? `data-quest-destination="${quest.location}"` : `data-quest-deliver="${quest.id}"`;
      const label = !ready ? 'Apri Professioni · prepara il rinforzo' : state.frontier.location !== quest.location ? 'Vai da Bram · Avamposto di Veyra' : registered ? 'Completa la consegna registrata' : 'Consegna 1 Rinforzo della Frontiera';
      return `<section class="quest-next-step"><strong>Prossimo passo · facoltativo</strong><p>${registered ? 'Il rinforzo è già stato consegnato. Completa la registrazione: non ne consumerai un altro.' : ready ? 'Rinforzo pronto per la consegna a Bram.' : 'Raccogli 6 Ferro grezzo al Sentiero Spezzato → forgia due Ferro forgiato → crea un Rinforzo della Frontiera.'}</p><small>La consegna consuma un rinforzo una sola volta. Poi riscuoti l’anello e confrontalo in Inventario.</small><button ${attribute} class="quest-primary">${label} →</button></section>`;
    }
    if(!destination)return `<section class="quest-next-step">${heading}<p>Consulta l’obiettivo della missione; i dati non indicano una destinazione.</p></section>`;
    let label = "", attribute = "", target = objective.target, hint = "";
    if (destination === "activities") {
      attribute = 'data-quest-expedition'; label = 'Apri Attività · Spedizioni';
      hint = 'Avvia la spedizione indicata e riscuoti il risultato: partire soltanto non completa questo obiettivo.';
    } else if (destination && destination !== state.frontier.location) {
      const location = WorldData.location(destination);
      attribute = `data-quest-destination="${destination}"`; label = `Vai a ${location.name}`;
      hint = `Qui puoi proseguire: ${objective.label.toLowerCase()}.`;
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
    return `<section class="quest-next-step">${heading}${hint ? `<small>${escape(hint)}</small>` : ""}${attribute ? `<button ${attribute} class="quest-primary">${escape(label)} →</button>` : ""}</section>`;
  }
  function card(quest, state) {
    const entry = state.frontier.quests[quest.id];
    const npc = WorldData.npcs.find(x => x.id === quest.giver);
    const unlocks = quest.contentUnlocks.map(id => WorldData.location(id).name);
    return `<details class="quest-card quest-${entry.status}" data-quest-card="${quest.id}" ${["available", "active", "completed"].includes(entry.status) || (entry.status === "claimed" && (quest.objectives.some(o => o.type === "professionDelivery") || rewardComparison(quest.id, state))) ? "open" : ""}><summary><span><small>${category(quest).label} · LIV. ${quest.minimumLevel}</small><strong>${escape(quest.title)}</strong></span><b class="quest-state-label">${statusNames[entry.status]}</b></summary><p>${escape(quest.description)}</p><small>${escape(npc.name)} · ${escape(WorldData.location(quest.location).name)}</small>${guidance(quest, state)}${entry.status === "available" ? `<div class="quest-actions">${actions(quest, entry, state)}</div>` : ""}${rewardComparison(quest.id, state)}<h4>Obiettivi</h4><ul class="quest-objectives">${quest.objectives.map((o, i) => `<li class="${entry.progress[i] >= o.count ? "objective-done" : ""}"><span>${escape(o.label)}</span><b>${entry.progress[i]} / ${o.count}</b></li>`).join("")}</ul><p class="quest-rewards"><strong>Ricompensa</strong><br>${rewards(quest.rewards)}</p>${unlocks.length ? `<small>Sblocca: ${unlocks.map(escape).join(", ")}</small>` : ""}${entry.status === "locked" ? `<p class="hint">Richiede livello ${quest.minimumLevel}${quest.prerequisites.length ? ` e ${quest.prerequisites.map(id => escape(QuestData.get(id).title)).join(", ")}` : ""}.</p>` : ""}${entry.status !== "available" ? `<div class="quest-actions">${actions(quest, entry, state)}</div>` : ""}</details>`;
  }
  function journalObjective(quest, state) {
    const entry = state.frontier.quests[quest.id];
    const {index,objective,destination}=nextStep(quest,state);
    const place = destination === "activities" ? "Spedizioni" : WorldData.location(destination)?.name;
    const giver = WorldData.npcs.find(n => n.id === quest.giver)?.name;
    const instruction = objective ? `${objective.label} · ${entry.progress[index]}/${objective.count}`
      : entry.status === "available" ? `Accetta da ${giver}`
      : entry.status === "completed" ? "Obiettivi completi · riscuoti ricompense"
      : entry.status === "claimed" ? "Ricompense già riscosse"
      : `Richiede Lv. ${quest.minimumLevel}${quest.prerequisites.length ? " e le missioni precedenti" : ""}`;
    return `<small class="journal-objective">${escape(instruction)}</small>${place && entry.status !== "claimed" ? `<small class="journal-destination">${escape(place)}</small>` : ""}`;
  }
  function journal(state) {
    return [["main", "Storia principale"], ["side", "Missioni secondarie"], ["profession", "Attività professionali"]].map(([type, title]) =>
      `<section class="journal-group"><h4>${title}</h4>${QuestData.quests.filter(q => category(q).id === type).sort((a,b) => ["completed","active","available","locked","claimed"].indexOf(state.frontier.quests[a.id].status) - ["completed","active","available","locked","claimed"].indexOf(state.frontier.quests[b.id].status)).map(q => `<button class="journal-entry quest-${state.frontier.quests[q.id].status}" data-quest-open="${q.id}"><span><strong>${escape(q.title)}</strong><small class="quest-state-label">${statusNames[state.frontier.quests[q.id].status]}</small>${journalObjective(q,state)}</span><b aria-hidden="true">→</b></button>`).join("")}</section>`).join("");
  }
  function offers(npcId, state) {
    return QuestData.quests.filter(q => q.giver === npcId && ["available", "active", "completed"].includes(state.frontier.quests[q.id].status) && !(state.frontier.trackedQuest === q.id && state.frontier.quests[q.id].status === "active"))
      .map(q => `<div class="npc-offer"><strong>${escape(q.title)}</strong><small class="quest-state-label">${statusNames[state.frontier.quests[q.id].status]}</small>${actions(q, state.frontier.quests[q.id], state)}</div>`).join("");
  }
  function relevantQuests(state) {
    const main = QuestData.quests.find(q => q.type === "main" && state.frontier.quests[q.id]?.status === "active");
    const tracked = QuestData.get(state.frontier.trackedQuest);
    return [main, tracked].filter((q, i, rows) => q && state.frontier.quests[q.id]?.status === "active" && rows.indexOf(q) === i);
  }
  function objectiveLocation(objective) {
    if (objective.type === "professionDelivery") return "veyra";
    if (objective.type === "talk") return WorldData.npcs.find(n => n.id === objective.target)?.location;
    if (objective.type === "completeExpedition") return "activities";
    return WorldData.locations.find(location => location.id === objective.target || location.enemies.includes(objective.target) || location.points.some(p => p.id === objective.target || p.collect === objective.target) || location.enemies.some(id => WorldData.enemy(id).drops.includes(objective.target)))?.id;
  }
  function tracker(state) {
    const main = QuestData.quests.find(q => q.type === "main" && ["completed", "active", "available"].includes(state.frontier.quests[q.id]?.status));
    const side = QuestData.quests.filter(q => q.type === "side" && ["active", "completed"].includes(state.frontier.quests[q.id]?.status));
    const mainPanel = main ? (() => {
      const entry = state.frontier.quests[main.id];
      const step=nextStep(main,state),{index,objective}=step;
      const locationName=step.destinationName||'Non indicata nei dati della missione';
      const count = objective ? `<div class="main-quest-progress"><span>${escape(objective.label)}</span><b>${entry.progress[index]}/${objective.count}</b></div><progress max="${objective.count}" value="${entry.progress[index]}" aria-label="Progresso obiettivo"></progress>` : "";
      const next = entry.status === "available" ? actions(main, entry, state) : entry.status === "completed" ? actions(main, entry, state) : guidance(main, state, true);
      return `<section class="main-quest-panel quest-${entry.status}" aria-label="Missione principale"><span class="world-eyebrow">STORIA PRINCIPALE · ${statusNames[entry.status]}</span><button class="tracker-title" data-quest-open="${main.id}">${escape(main.title)} →</button>${count}<p class="main-quest-destination">Destinazione: <strong>${escape(locationName)}</strong></p>${next}</section>`;
    })() : '<section class="main-quest-panel"><span class="world-eyebrow">STORIA PRINCIPALE</span><strong>Storia della Frontiera completata</strong><p>Esplora il mondo o consulta il Diario.</p></section>';
    const sidePanel = side.length ? `<details class="side-quest-panel" ${side.some(q => state.frontier.trackedQuest === q.id) ? "open" : ""}><summary>Missioni secondarie · ${side.length} (facoltative)</summary>${side.map(q => {
      const entry = state.frontier.quests[q.id];
      const index = q.objectives.findIndex((o, i) => entry.progress[i] < o.count);
      const progress = index >= 0 ? `${entry.progress[index]}/${q.objectives[index].count}` : statusNames[entry.status];
      return `<div class="side-quest-row"><button data-quest-open="${q.id}">${escape(q.title)} →</button><small>${category(q).id === "profession" ? "Professioni · " : ""}${escape(progress)}</small>${state.frontier.trackedQuest === q.id ? guidance(q, state) : ""}${entry.status === "completed" ? actions(q, entry, state) : ""}</div>`;
    }).join("")}</details>` : '<p class="side-quest-empty">Missioni secondarie: consulta il Diario per le attività facoltative.</p>';
    const recentReward = state.frontier.lastQuestClaim?.id;
    return (recentReward ? rewardComparison(recentReward, state) : "") + mainPanel + sidePanel;
  }
  return { escape, rewards, journal, offers, tracker, card, objectiveLocation, guidance, rewardComparison, relevantQuests, category, nextStep };
})();

if(typeof module!=="undefined"&&module.exports)module.exports=QuestUI;
