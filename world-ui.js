/* Mobile adapter: presentation clock only; durable actions remain in World/Quest engines. */
const WorldUI = (() => {
  const node = id => document.getElementById(id), escape = QuestUI.escape;
  let view = "places", talked = null, talkedLocation = null, busy = false, engine = null, ticketId = null;
  let messageTimer = null, frameId = null, lastTime = null, renderingAt = 0, settling = false;
  let estimateKey = "", estimates = {};
  // Presentation-only receipt for a successful claim in this session; never grants rewards.
  let visibleQuestReceipt = null;
  let stagPreparation = false;
  const marks = {
    haven: "M12 31 30 10 48 31M18 27V48H42V27M25 48V34H35V48M8 48H52",
    path: "M12 49 23 33 19 25 32 11M28 49 36 35 31 28 42 11M7 18H17M43 41H53",
    wood: "M14 49V19M7 30 14 20 23 29M14 20 22 10M32 49V12M23 24 32 13 43 24M46 49V25M38 36 46 26 54 35",
    ruins: "M10 49V24H21V49M36 49V17H48V49M6 24H25M32 17H52M21 32H36M28 12 32 4M6 49H54",
    ford: "M8 32Q19 18 30 32T52 32M7 43Q19 29 30 43T53 43M17 22V9M43 22V9M17 14H43",
    tower: "M18 49 20 17H40L42 49M17 17V8H24V13H28V8H35V13H42V17M27 49V35H34V49M28 23H33",
  };
  function mark(id) {
    return `<svg viewBox="0 0 60 60" aria-hidden="true" class="world-mark"><path d="${marks[id]}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function selectView(value) {
    if (!["places", "journal", "quest", "discoveries", "overview", "battle"].includes(value)) return;
    NymeriaNavigation.open("world", { view: value });
  }
  async function action(work) {
    if (busy) return;
    busy = true; render();
    try {
      const result = await work();
      node("world-message").textContent = result?.message || "";
      clearTimeout(messageTimer); messageTimer = setTimeout(() => { node("world-message").textContent = ""; }, 3500);
      return result;
    } catch (error) {
      node("world-message").textContent = `Operazione non applicata: ${error.message}`;
      return { ok: false };
    } finally { busy = false; render(); }
  }
  const discovery = id => typeof WorldDiscovery !== "undefined" && WorldDiscovery?.accessible(id);
  function render() {
    const state = ProgressionStore.state, frontier = state.frontier;
    node("panel-world").setAttribute("aria-busy", String(busy));
    node("world-zone-name").textContent = WorldData.zone.name;
    node("world-zone-story").textContent = WorldData.zone.description;
    const main = QuestData.quests.filter(q => q.type === "main");
    node("world-summary").innerHTML = `<span>Livello <b>${state.level}</b> · ${state.currentXP}/${state.requiredXP || "MAX"} XP</span><span><b>${state.crowns}</b> Corone</span><small>Storia ${main.filter(q => frontier.quests[q.id].status === "claimed").length}/${main.length}</small>`;
    node("world-storage").textContent = [ProgressionStore.error, typeof WorldDiscovery !== "undefined" && WorldDiscovery?.storageIssue ? "Salvataggio discovery non disponibile. Il progetto resta conservato; riprova riaprendo la pagina." : ""].filter(Boolean).join(" ");
    for (const b of document.querySelectorAll("[data-world-view]")) b.setAttribute("aria-pressed", String(b.dataset.worldView === view));
    for (const [id, value] of [["world-places", "places"], ["world-journal", "journal"], ["world-discoveries", "discoveries"]]) node(id).hidden = value === "places" ? !["places", "overview"].includes(view) : value === "journal" ? !["journal", "quest"].includes(view) : view !== value;
    node("world-tracked").innerHTML = QuestUI.tracker(state);
    node("world-tracked").hidden = view !== "places";
    node("world-locations").hidden = view !== "overview";
    node("world-location-detail").hidden = view !== "places";
    node("world-active-link").hidden = !frontier.activeEncounter;
    document.querySelector(".world-shortcuts").hidden = view !== "places";
    node("quest-journal").hidden = view !== "journal";
    node("quest-detail").hidden = view !== "quest";
    const selectedQuest = QuestData.get(NymeriaNavigation.route.questId);
    node("quest-detail").innerHTML = selectedQuest ? QuestUI.card(selectedQuest, state) : "";
    node("journal-badge").textContent = Object.values(frontier.quests).filter(q => q.status === "completed").length || "";
    node("world-locations").innerHTML = WorldData.locations.filter(location => !location.discoveryType || discovery(location.id)).map(location => {
      const unlocked = location.discoveryType ? discovery(location.id) : state.unlockedContent.includes(`world:${location.id}`), current = location.id === frontier.location;
      return `<button class="world-node ${current ? "world-node-current" : ""}" data-world-enter="${location.id}" aria-pressed="${current}" ${!unlocked || frontier.activeEncounter || busy ? "disabled" : ""}>${mark(location.mark)}<span><strong>${escape(location.name)}</strong><small>${unlocked ? current ? "Ti trovi qui" : `Esplora · Liv. indicativo ${location.level}` : escape(location.unlockHint)}</small></span><b aria-hidden="true">${unlocked ? '<svg viewBox="0 0 12 12" width="12" height="12"><path d="M3 9 9 3M3 3H9V9" fill="none" stroke="currentColor"/></svg>' : '<svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 1 11 6 6 11 1 6Z" fill="none" stroke="currentColor"/></svg>'}</b></button>`;
    }).join("");
    const savedLocation = WorldData.location(frontier.location);
    const location = savedLocation.discoveryType && !discovery(savedLocation.id) ? WorldData.location("veyra") : savedLocation;
    node("world-current").hidden = view !== "places";
    node("world-current").innerHTML = `<div class="world-place-heading">${mark(location.mark)}<h1>${escape(location.name)}</h1></div><p>${escape(location.description)}</p>`;
    if (talkedLocation !== location.id) { talked = null; talkedLocation = location.id; }
    const key = JSON.stringify([location.id, Equipment.state.resultingStats, ClassSystem.state, Object.values(Equipment.state.equipment).map(e => e.equippedItem)]);
    if (key !== estimateKey) {
      estimateKey = key;
      estimates = Object.fromEntries(location.enemies.map(id => [id, WorldSystem.estimate(id)]));
    }
    node("world-location-detail").innerHTML = `${WorldData.npcs.some(n => n.location === location.id) ? "<h4>Personaggi presenti</h4>" : ""}${WorldData.npcs.filter(n => n.location === location.id).map(npc => {
      const dialogue = npc.dialogues.filter(d => !d.after || frontier.quests[d.after]?.status === "claimed").pop();
      return `<article class="world-npc"><div class="npc-heading"><span class="npc-seal" aria-hidden="true">${npc.name.split(" ")[0][0]}</span><div><h4>${escape(npc.name)}</h4><small>${escape(npc.role)}</small></div><button data-world-talk="${npc.id}">Parla</button></div>${talked === npc.id ? `<p>«${escape(dialogue.text)}»</p>` : ""}${QuestUI.offers(npc.id, state)}</article>`;
    }).join("")}${location.points.length ? '<h4 data-world-section="explore">Da esplorare</h4>' : ""}${location.points.map(point => `<button class="world-point" data-world-explore="${point.id}" ${point.requiresDefeat && !frontier.defeatedEnemies.includes(point.requiresDefeat) ? "disabled" : ""}><strong>${escape(point.name)}</strong><small>${point.requiresDefeat && !frontier.defeatedEnemies.includes(point.requiresDefeat) ? "Passaggio controllato dal comandante" : point.discovery ? "Segreto professionale · esamina" : point.collect ? "Esplorazione · trova un campione" : "Esamina →"}</small></button>`).join("")}${location.enemies.length ? '<h4 data-world-section="encounters">Incontri</h4>' : ""}<div class="world-enemies">${location.enemies.map(id => {
      const enemy = WorldData.enemy(id);
      return `<article class="world-enemy enemy-${enemy.kind}"><div><small>${enemy.kind === "boss" ? "BOSS" : enemy.kind === "miniboss" ? "MINIBOSS" : "INCONTRO"} · LIV. ${enemy.level}</small><h4>${escape(enemy.name)}</h4><p>${estimates[id]} · ${enemy.rewards.xp} XP · ${enemy.rewards.crowns} Corone</p><small>${enemy.drops.map(id => escape(WorldData.supplyNames[id])).join(" · ") || "Nessun oggetto di missione"}</small></div><button data-world-fight="${id}" ${frontier.activeEncounter ? "disabled" : ""}>Combatti</button></article>`;
    }).join("")}</div>${location.enemies.length && !ClassSystem.kitRequirement(Equipment.equipped("mainHand"), Equipment.equipped("support")) ? '<p class="compatibility">Prepara il kit della classe prima degli incontri.</p><button data-world-equipment>Prepara equipaggiamento</button>' : ""}`;
    node("world-location-detail").innerHTML += `<section class="world-destinations"><h4>Destinazioni</h4>${(WorldData.connections[location.id] || []).concat(location.id === "veyra" && discovery("vesper-outpost") ? ["vesper-outpost"] : []).map(id => {
      const destination = WorldData.location(id), unlocked = destination.discoveryType ? discovery(id) : state.unlockedContent.includes(`world:${id}`);
      return `<button data-world-enter="${id}" ${!unlocked || frontier.activeEncounter || busy ? "disabled" : ""}><span><strong>${escape(destination.name)}</strong>${!unlocked ? `<small>Bloccato · ${escape(destination.unlockHint)}</small>` : ""}</span><b aria-hidden="true">${unlocked ? "→" : "🔒"}</b></button>`;
    }).join("")}</section>`;
    // Objective markers are semantic UI hints, never quest-engine branches.
    for (const tracked of QuestUI.relevantQuests(state)) {
      const entry = frontier.quests[tracked.id];
      tracked.objectives.forEach((objective, i) => {
        if (entry.progress[i] >= objective.count) return;
        for (const button of node("world-location-detail").querySelectorAll("[data-world-talk], [data-world-fight], [data-world-explore], [data-world-enter]")) {
          const target = button.dataset.worldTalk || button.dataset.worldFight || button.dataset.worldExplore || button.dataset.worldEnter;
          const enemy = WorldData.enemy(target);
          if (target === objective.target || enemy?.drops.includes(objective.target) || location.points.find(p => p.id === target)?.collect === objective.target) {
            button.classList.add("quest-relevant");
            if (!button.querySelector('.quest-target-label')) {
              const badge = document.createElement("small"); badge.className = "quest-target-label";
              badge.textContent = "OBIETTIVO DI MISSIONE"; button.append(badge);
            }
            button.setAttribute("aria-label", `${button.textContent.trim()} · ${tracked.title} · ${objective.label}`);
            const host = button.closest('.world-enemy') || button;
            let info = host.querySelector('.quest-target-progress');
            if (!info) { info = document.createElement('p'); info.className = 'quest-target-progress'; host.append(info); }
            const line = document.createElement('span'); line.textContent = `${objective.label} · ${entry.progress[i]} / ${objective.count}`; info.append(line);
            host.classList.add("quest-target-host");
          }
        }
      });
    }
    const detail = node("world-location-detail"), exploration = detail.querySelector('[data-world-section="explore"]'), encounters = detail.querySelector(".world-enemies");
    // Put the tracked action before optional exploration; keep exploration first when relevant.
    if (exploration && encounters.querySelector(".quest-relevant") && !detail.querySelector(".world-point.quest-relevant")) {
      detail.insertBefore(detail.querySelector('[data-world-section="encounters"]'), exploration);
      detail.insertBefore(encounters, exploration);
    }
    node("quest-journal").innerHTML = QuestUI.journal(state);
    node("world-discovery-list").innerHTML = frontier.discoveries.length ? frontier.discoveries.map(id => {
      const d = WorldData.discoveries.find(x => x.id === id);
      return `<article class="discovery-card"><span class="world-eyebrow">SEGRETO PROFESSIONALE</span><h4>${escape(d.name)}</h4><p>${escape(d.description)}</p><strong>${escape(d.status)}</strong><small>${escape(d.requirement)}</small></article>`;
    }).join("") : '<p class="hint">Nessuna scoperta ancora registrata. Elar conserva ricordi inesplorati.</p>';
    node("world-achievements").innerHTML = frontier.achievements.length ? frontier.achievements.map(id => `<article class="discovery-card"><span class="world-eyebrow">TITOLO OTTENUTO</span><h4>${escape(WorldData.achievements.find(x => x.id === id).name)}</h4><p>${escape(WorldData.zone.epilogue)}</p></article>`).join("") : '<p class="hint">La Frontiera deve ancora conoscere il tuo nome.</p>';
    node("world-debug").hidden = !WorldSystem.testMode;
    for (const button of node("world-debug").querySelectorAll("button")) button.disabled = busy;
    const stag = WorldData.enemy("twilight-stag");
    const showStagPrep = stagPreparation && view === "places" && !frontier.activeEncounter && frontier.location === "lantern-wood";
    node("world-stag-preparation").hidden = !showStagPrep;
    if (showStagPrep) {
      node("world-stag-prep-title").textContent = stag.name;
      node("world-stag-prep-stats").textContent = `Livello ${stag.level} · ${stag.maxHp} HP · Armatura ${stag.armor}`;
      node("world-stag-prep-special").textContent = `Attacco speciale: ${stag.attacks.find(a=>a.id.endsWith("-special")).name}`;
    }
    node("world-battle").hidden = view !== "battle" || !frontier.activeEncounter;
    const result = frontier.lastEncounter;
    node("world-result").hidden = view !== "battle" || !result || !!frontier.activeEncounter;
    if (result) node("world-result").innerHTML = `<span class="world-eyebrow">${escape(result.enemyName)}</span><h3>${result.outcome === "victory" ? "VITTORIA" : "SCONFITTA"}</h3><p>+${result.rewards.xp} XP · +${result.rewards.crowns} Corone</p><p class="level-up-feedback">${escape(ProgressionData.levelUpSummary(result))}</p>${result.drops.length ? `<small>${result.drops.map(id => escape(WorldData.supplyNames[id])).join(" · ")}</small>` : ""}${result.outcome === "defeat" ? '<p class="hint">Ritorno a Veyra. Nessuna perdita di livello o equipaggiamento. Nessuna penalità permanente.</p>' : ""}<button data-world-continue class="quest-primary">Continua →</button>${result.enemyId === "twilight-stag" && result.outcome === "victory" ? `<div class="stag-victory"><strong>MINIBOSS SCONFITTO · Cervo del Crepuscolo</strong><p>La creatura del Bosco è caduta. Verifica gli obiettivi di «Luci senza fiamma» e riscuoti la missione per sbloccare le Rovine di Elar.</p><p>Missione: ${escape(ProgressionStore.state.frontier.quests.mq03.status === "completed" ? "Pronta per la riscossione" : "Obiettivi ancora da completare")}</p><button data-quest-open="mq03">Apri «Luci senza fiamma» →</button></div>` : ""}${WorldData.enemy(result.enemyId)?.kind === "boss" && result.outcome === "victory" ? `<p>${escape(WorldData.zone.epilogue)}</p><button data-world-view="journal">Apri il Diario · riscuoti la missione</button>` : ""}`;
    const reward = frontier.lastQuestClaim;
    node("world-quest-reward").hidden = !reward || !visibleQuestReceipt || visibleQuestReceipt !== `${reward.id}:${reward.claimedAt}` || !["places", "quest", "journal"].includes(view);
    if (reward) {
      const quest = QuestData.get(reward.id);
      const earned = reward.rewards || {};
      const materials = Object.entries(earned.materials || {}).filter(([,amount])=>amount>0).map(([id,amount])=>`<span>+${amount} ${escape(ProgressionData.materialNames[id] || id)}</span>`);
      const unlocked = (quest?.contentUnlocks || []).filter(id=>state.unlockedContent.includes(`world:${id}`)).map(id=>WorldData.location(id)?.name).filter(Boolean);
      const next = quest?.nextQuest && QuestData.get(quest.nextQuest);
      const level = reward.levelUps?.length ? `<p class="level-up-feedback">${escape(ProgressionData.levelUpSummary(reward))}</p>` : "";
      const nextStep = next ? `<p class="hint">Prossimo passo: ${escape(next.title)}</p><button data-quest-open="${next.id}" class="quest-primary">Scopri la prossima missione →</button>` : '<p class="hint">Continua a esplorare la Frontiera.</p>';
      node("world-quest-reward").innerHTML = `<span class="world-eyebrow">MISSIONE COMPLETATA · RICOMPENSE RISCOSSE</span><h3>${escape(reward.title)}</h3><div class="quest-receipt-gains"><strong>+${earned.xp || 0} XP</strong><strong>+${earned.crowns || 0} Corone</strong>${materials.join("")}</div>${level}${unlocked.length ? `<p class="quest-receipt-unlock">Nuova area sbloccata: <strong>${unlocked.map(escape).join(", ")}</strong></p>` : ""}${reward.loot.map(row => `<small>${escape(GearData.items.find(x => x.id === row.itemId)?.name || row.itemId)}${row.duplicate ? " · duplicato convertito in 2 Ferro" : " · aggiunto all'inventario"}</small>`).join("")}${view === "places" ? "" : QuestUI.rewardComparison(reward.id, state)}${nextStep}`;
    }
    if (frontier.activeEncounter) {
      if (ticketId !== frontier.activeEncounter.id) {
        stopClock(); engine = null; ticketId = frontier.activeEncounter.id;
      }
      renderBattle();
    } else if (engine && !settling) { stopClock(); engine = null; ticketId = null; }
    node("world-battle-abandon").disabled = settling || busy;
    if (busy || frontier.activeEncounter) {
      for (const b of node("world-location-detail").querySelectorAll("button")) b.disabled = true;
    }
    if (busy) for (const b of node("panel-world").querySelectorAll("[data-quest-accept], [data-quest-claim], [data-quest-track]")) b.disabled = true;
    if (busy || frontier.activeEncounter) for (const b of node("panel-world").querySelectorAll('.quest-next-step button')) b.disabled = true;
    if(typeof ProfessionData!=="undefined"){
      const localNodes=ProfessionData.gathering.filter(n=>n.location===location.id);
      if(localNodes.length){
        const host=node("world-location-detail"), section=document.createElement("section");
        section.className="world-professions"; section.innerHTML=`<h4>Raccolte delle Professioni</h4>${localNodes.map(n=>`<button data-world-profession ${busy||frontier.activeEncounter?"disabled":""}><span><strong>${escape(ProfessionData.materials.find(m=>m.id===n.material)?.name||n.material)}</strong><small>${escape(ProfessionData.profession(n.profession)?.name||n.profession)} · raccogli qui</small></span><b aria-hidden="true">→</b></button>`).join("")}`;
        host.append(section);
      }
    }
    document.dispatchEvent(new Event("nymeria:world-render"));
  }
  function stopClock() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null; lastTime = null;
  }
  function resume() {
    const ticket = ProgressionStore.state.frontier.activeEncounter;
    if (!ticket || settling) return;
    if (!engine || ticketId !== ticket.id) {
      ticketId = ticket.id;
      engine = CombatEngine.create({ ...ticket.snapshot, enemyTemplate: ticket.template, seed: ticket.seed });
      engine.start();
    } else engine.resume();
    if (engine.result || engine.time >= 180) { settle(); return; }
    stopClock(); renderBattle(); frameId = requestAnimationFrame(frame);
  }
  function combatEventText(event, ticket) {
    const ability = ticket.snapshot.profile.abilities.find(a => a.id === event.abilityId)?.name;
    const attack = ticket.template.attacks?.find(a => a.id === event.abilityId)?.name;
    if (event.type === "playerAction") return { action: ability || "Attacco", detail: `${event.damage ?? 0} danni${event.critical ? " · COLPO CRITICO!" : ""}`, kind: event.critical ? "critical" : "attack" };
    if (event.type === "enemyAction") return { action: `${ticket.template.name}: ${attack || "Attacco"}`, detail: `${event.damage ?? 0} danni${event.blocked ? " · BLOCCO!" : ""}`, kind: event.blocked ? "blocked" : "enemy" };
    if (event.type === "dodge") return { action: "SCHIVATA!", detail: `Evitato ${attack || "un attacco nemico"}`, kind: "dodge" };
    if (event.type === "result") return { action: event.outcome === "victory" ? "VITTORIA" : "SCONFITTA", detail: "Incontro concluso", kind: "result" };
    if (event.type === "dot") return { action: "Danno persistente", detail: `${event.damage ?? 0} danni`, kind: "effect" };
    if (event.type === "effectApply" || event.type === "effectRefresh") return { action: "Effetto attivato", detail: event.effectId || "", kind: "effect" };
    if (event.type === "itemProc") return { action: "Effetto equipaggiamento", detail: "Attivato", kind: "effect" };
    return { action: "Effetto", detail: event.effectId || "", kind: "effect" };
  }
  function renderBattle() {
    const ticket = ProgressionStore.state.frontier.activeEncounter;
    if (!ticket) return;
    node("world-battle-name").textContent = ticket.template.kind === "miniboss" ? `MINIBOSS · ${ticket.template.name}` : ticket.template.name;
    node("world-battle").classList.toggle("world-battle-miniboss", ticket.template.kind === "miniboss");
    node("world-battle-profile").textContent = `${ticket.snapshot.profile.className} · ${ticket.snapshot.profile.buildName} · Livello ${ticket.snapshot.level}`;
    node("world-player-name").textContent = "Iria";
    node("world-enemy-name").textContent = ticket.template.name;
    const hp = engine?.player.hp ?? CombatData.formulas.maxHp(ticket.snapshot.stats) * (ticket.snapshot.profile.modifiers.hpMultiplier || 1);
    const max = engine?.player.maxHp ?? Math.round(hp);
    node("world-player-hp").textContent = `${Math.round(hp)} / ${max} HP`;
    node("world-player-bar").style.width = `${100 * hp / max}%`;
    node("world-enemy-hp").textContent = `${engine?.enemy.hp ?? ticket.template.maxHp} / ${ticket.template.maxHp} HP`;
    node("world-enemy-bar").style.width = `${100 * (engine?.enemy.hp ?? ticket.template.maxHp) / ticket.template.maxHp}%`;
    node("world-battle-clock").textContent = `${(engine?.time || 0).toFixed(1)}s`;
    node("world-battle-resume").hidden = engine?.status === "running";
    node("world-battle-resume").textContent = engine?.result || engine?.time >= 180 ? "Salva risultato · riprova" : "Riprendi incontro";
    node("world-battle-resume").disabled = settling;
    node("world-battle-pause").disabled = engine?.status !== "running" || settling;
    const resource = engine?.player.resource || { current: ticket.snapshot.profile.resource.initial, max: ticket.snapshot.profile.resource.max };
    const resourceName = ticket.snapshot.profile.resource.name;
    const resourceCurrent = Math.max(0, Math.min(resource.max, resource.current));
    node("world-resource-name").textContent = resourceName;
    node("world-resource-value").textContent = `${Math.round(resourceCurrent)} / ${resource.max}`;
    node("world-resource-fill").style.width = `${resource.max ? 100 * resourceCurrent / resource.max : 0}%`;
    node("world-resource-bar").setAttribute("aria-valuemax", String(resource.max));
    node("world-resource-bar").setAttribute("aria-valuenow", String(Math.round(resourceCurrent)));
    node("world-resource-bar").setAttribute("aria-label", resourceName);
    const events = engine?.log || [];
    const notable = [...events].reverse().find(e => ["playerAction", "enemyAction", "dodge", "result", "dot", "itemProc"].includes(e.type));
    const highlight = notable ? combatEventText(notable, ticket) : { action: "In attesa del primo colpo", detail: "Le azioni appariranno qui.", kind: "idle" };
    node("world-highlight-action").textContent = highlight.action;
    node("world-highlight-detail").textContent = highlight.detail;
    node("world-combat-highlight").dataset.kind = highlight.kind;
    const history = events.map(event => {
      const entry = combatEventText(event, ticket);
      return `<li><time>${event.time.toFixed(1)}s</time> · ${escape(entry.action)} · ${escape(entry.detail)}</li>`;
    }).reverse().join("");
    node("world-battle-history").innerHTML = history || '<li class="hint">Nessuna azione registrata.</li>';
    node("world-battle-log").innerHTML = events.slice(-5).reverse().map(event => {
      const entry = combatEventText(event, ticket);
      return `<li>${event.time.toFixed(1)}s · ${escape(entry.action)} · ${escape(entry.detail)}</li>`;
    }).join("") || '<li class="hint">Incontro salvato. Riprendi quando vuoi.</li>';
    document.dispatchEvent(new Event("nymeria:world-battle-render"));
  }
  async function settle() {
    if (settling || !ticketId) return;
    stopClock(); settling = true; renderBattle();
    await action(() => WorldSystem.finishEncounter(ticketId));
    settling = false;
    if (!ProgressionStore.state.frontier.activeEncounter) { engine = null; ticketId = null; }
    render();
  }
  function frame(time) {
    frameId = null;
    if (!engine || engine.status !== "running") return;
    if (lastTime !== null) engine.advance(Math.min(0.25, Math.max(0, (time - lastTime) / 1000)) * CombatUI.settings.speed);
    lastTime = time;
    if (time - renderingAt > 100) { renderingAt = time; renderBattle(); }
    if (engine.result || engine.time >= 180) settle();
    else frameId = requestAnimationFrame(frame);
  }
  document.addEventListener("click", async event => {
    const b = event.target.closest("button");
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-quest-professions')) { NymeriaNavigation.open('professions'); return; }
    if (b.dataset.questCompare) {
      if (!Equipment.state.inventory.some(item => item.id === b.dataset.questCompare)) return;
      NymeriaNavigation.open('inventory');
      InventoryUI.openItem(b.dataset.questCompare);
      return;
    }
    if (b.hasAttribute('data-quest-inventory')) { NymeriaNavigation.open('inventory'); return; }
    if (b.dataset.questDeliver) { await action(() => QuestSystem.deliver(b.dataset.questDeliver)); return; }
    if (b.hasAttribute("data-quest-expedition")) { NymeriaNavigation.root("expeditions"); return; }
    if (b.dataset.questDestination) {
      const result = await action(() => WorldSystem.enter(b.dataset.questDestination));
      if (result?.ok) NymeriaNavigation.root("world");
      return;
    }
    if (b.dataset.questOpen) { NymeriaNavigation.open("world", { view: "quest", questId: b.dataset.questOpen }); return; }
    if (b.hasAttribute("data-world-continue")) {
      const receipt = ProgressionStore.state.frontier.lastEncounter;
      if (receipt && ProgressionStore.state.frontier.location !== receipt.location) {
        const entered = await action(() => WorldSystem.enter(receipt.location));
        if (!entered?.ok) return;
      }
      if (NymeriaNavigation.depth) NymeriaNavigation.back(); else NymeriaNavigation.root("world");
      return;
    }
    if (b.dataset.worldView) { selectView(b.dataset.worldView); return; }
    if (b.hasAttribute("data-world-profession")) { NymeriaNavigation.open("professions"); return; }
    if (b.hasAttribute("data-world-equipment")) { NymeriaNavigation.showScreen("equipment"); return; }
    if (b.dataset.worldEnter) {
      const result = await action(() => WorldSystem.enter(b.dataset.worldEnter));
      if (result?.ok && view === "overview") NymeriaNavigation.back();
      if (result?.ok) { window.scrollTo(0, 0); node("world-current").focus({ preventScroll: true }); }
      return;
    }
    if (b.dataset.worldTalk) { talked = b.dataset.worldTalk; return action(() => WorldSystem.talk(b.dataset.worldTalk)); }
    if (b.dataset.worldExplore) return action(() => WorldSystem.explore(b.dataset.worldExplore));
    if (b.dataset.questAccept) return action(() => QuestSystem.accept(b.dataset.questAccept));
    if (b.dataset.questClaim) {
      const result = await action(() => QuestSystem.claim(b.dataset.questClaim));
      if (result?.ok && result.receipt) {
        visibleQuestReceipt = `${result.receipt.id}:${result.receipt.claimedAt}`;
        render();
      }
      return;
    }
    if (b.dataset.questTrack) return action(() => QuestSystem.track(b.dataset.questTrack));
    if (b.dataset.questGiver) {
      const result = await action(() => WorldSystem.enter(QuestData.get(b.dataset.questGiver).location));
      if (result?.ok) NymeriaNavigation.root("world"); return;
    }
    if (b.hasAttribute("data-world-stag-cancel")) { stagPreparation = false; render(); return; }
    if (b.hasAttribute("data-world-stag-equipment")) { NymeriaNavigation.showScreen("equipment"); return; }
    if (b.hasAttribute("data-world-stag-start")) {
      if (!stagPreparation || ProgressionStore.state.frontier.activeEncounter || ProgressionStore.state.frontier.location !== "lantern-wood") return;
      const result = await action(() => WorldSystem.startEncounter("twilight-stag"));
      if (result?.ok) { stagPreparation = false; selectView("battle"); resume(); }
      return;
    }
    if (b.dataset.worldFight) {
      if (b.dataset.worldFight === "twilight-stag") {
        stagPreparation = true;
        render();
        node("world-stag-preparation").scrollIntoView({block:"start",behavior:"auto"});
        return;
      }
      const result = await action(() => WorldSystem.startEncounter(b.dataset.worldFight));
      if (result?.ok) { selectView("battle"); resume(); }
      return;
    }
    if (b.dataset.questDebug) return action(() => QuestSystem.debug(node("world-debug-quest").value, b.dataset.questDebug));
  });
  node("world-battle-resume").addEventListener("click", resume);
  node("world-battle-pause").addEventListener("click", () => { engine?.pause(); stopClock(); renderBattle(); });
  node("world-battle-abandon").addEventListener("click", () => action(() => WorldSystem.abandonEncounter()));
  node("world-debug-quest").innerHTML = QuestData.quests.map(q => `<option value="${q.id}">${escape(q.title)}</option>`).join("");
  node("world-debug-location").innerHTML = WorldData.locations.map(x => `<option value="${x.id}">${escape(x.name)}</option>`).join("");
  node("world-debug-unlock").addEventListener("click", () => action(() => WorldSystem.debug("unlock", node("world-debug-location").value)));
  node("world-debug-xp").addEventListener("click", () => action(() => WorldSystem.debug("xp", 500)));
  node("world-debug-boss").addEventListener("click", async () => {
    const result = await action(async () => {
      const unlocked = await WorldSystem.debug("unlock", "silent-tower");
      if (!unlocked.ok) return unlocked;
      const entered = await WorldSystem.enter("silent-tower");
      return entered.ok ? WorldSystem.startEncounter("silence-keeper") : entered;
    });
    if (result?.ok) { selectView("battle"); resume(); }
  });
  document.addEventListener("nymeria:navigation", event => {
    if (event.detail.screen === "world") { view = event.detail.view || "places"; render(); }
  });
  if (typeof WorldDiscovery !== "undefined" && WorldDiscovery) WorldDiscovery.subscribe(render);
  ProgressionStore.subscribe(render); Equipment.subscribe(render); ClassSystem.subscribe(render);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && engine?.status === "running") { engine.pause(); stopClock(); renderBattle(); }
  });
  render();
  return { mark, selectView, render, resume, settle, get engine() { return engine; } };
})();
