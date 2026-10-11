/* UI adapter: one animation-frame clock, immutable equipment snapshot per fight. */
const CombatUI = (() => {
  const profile = () => ClassSystem.combatProfile();
  // Resolve browser storage inside the store's guarded operations: some contexts
  // deny even access to the localStorage property.
  const preferences = CombatData.preferenceStore({
    getItem: key => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  });
  let storageError = preferences.storageError,
    activeClass = ClassSystem.state.classId,
    activeSpec = ClassSystem.resolved().specialization;
  let settings = preferences.read(activeClass, activeSpec, profile());
  let engine = null,
    frameId = null,
    lastWallTime = null,
    lastLogVersion = -1,
    lastRenderAt = -1;
  let rewardState = null;
  let configurationKey = "";
  let gearKey = "",
    lookKey = "";
  const node = (id) => document.getElementById(id);
  const ability = (id) => profile().abilities.find((a) => a.id === id);
  const formatTime = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const text = (id, value) => {
    const element = node(id);
    if (element.textContent !== value) element.textContent = value;
  };
  function equippedEffects() {
    return GearData.slots.reduce((result, slot) => {
      const item = Equipment.equipped(slot.id);
      return result.concat(
        item
          ? item.effects.map((effect) => ({ ...effect, itemId: item.id }))
          : [],
      );
    }, []);
  }
  const rules = () =>
    settings.mode === "auto" ? profile().defaultRules : settings.rules;
  const kitReady = () =>
    ClassSystem.kitRequirement(
      Equipment.equipped("mainHand"),
      Equipment.equipped("support"),
    );
  function saveSettings() {
    preferences.write(activeClass, activeSpec, settings);
    storageError = preferences.storageError;
    renderStrategyHint();
  }
  function renderStrategyHint() {
    text(
      "combat-strategy-hint",
      (settings.mode === "auto"
        ? "Priorità predefinite: viene usata la prima abilità valida e disponibile."
        : "Il personaggio segue l’ordine dall’alto. Le modifiche valgono dalla prossima azione.") +
        (storageError ? " Salvataggio preferenze non disponibile." : ""),
    );
  }
  function renderSettings() {
    document
      .querySelectorAll("[data-combat-mode]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.combatMode === settings.mode),
        ),
      );
    document
      .querySelectorAll("[data-combat-speed]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(Number(b.dataset.combatSpeed) === settings.speed),
        ),
      );
    renderStrategyHint();
    const list = rules(),
      custom = settings.mode === "custom";
    node("combat-priorities").innerHTML = list
      .map((rule, index) => {
        const condition = rule.condition,
          skill = ability(rule.abilityId);
        return `<article class="priority-row" data-priority-id="${rule.abilityId}"><div class="priority-heading"><span class="priority-number">${index + 1}</span><div><strong>${skill.name}</strong><small>${skill.description} · Costo ${skill.cost} · CD ${skill.cooldown}s</small></div><div class="priority-order"><button data-move="-1" data-rule="${rule.abilityId}" aria-label="Sposta ${skill.name} in alto" ${!custom || index === 0 ? "disabled" : ""}>↑</button><button data-move="1" data-rule="${rule.abilityId}" aria-label="Sposta ${skill.name} in basso" ${!custom || index === list.length - 1 ? "disabled" : ""}>↓</button></div></div><label>Condizione<select data-condition="${rule.abilityId}" ${!custom ? "disabled" : ""}>${CombatData.conditions.map((c) => `<option value="${c.id}" ${c.id === condition.type ? "selected" : ""}>${c.label}</option>`).join("")}</select></label>${
          [
            "enemyHpBelow",
            "playerHpBelow",
            "resourceAbove",
            "resourceBelow",
          ].includes(condition.type)
            ? `<label class="threshold">Soglia ${condition.type.startsWith("resource") ? "risorsa" : "HP"} <input type="number" min="${condition.type.startsWith("resource") ? 0 : 1}" max="${condition.type.startsWith("resource") ? 100 : 99}" inputmode="numeric" data-threshold="${rule.abilityId}" value="${condition.threshold}" ${!custom ? "disabled" : ""}> ${condition.type.startsWith("resource") ? "punti" : "%"}</label>`
            : condition.type === "debuffAbsent" ||
                condition.type === "buffAbsent"
              ? `<label>Effetto assente<select data-effect="${rule.abilityId}" ${!custom ? "disabled" : ""}>${profile()
                  .abilities.filter(
                    (a) =>
                      a.effectId &&
                      (condition.type === "buffAbsent"
                        ? a.kind === "buff"
                        : a.kind !== "buff"),
                  )
                  .map(
                    (a) =>
                      `<option value="${a.effectId}" ${a.effectId === condition.effectId ? "selected" : ""}>${profile().effects[a.effectId].name}</option>`,
                  )
                  .join("")}</select></label>`
              : ""
        }</article>`;
      })
      .join("");
    if (engine) engine.setRules(rules());
  }
  function updateConfiguration() {
    settings = CombatData.normalizeSettings(settings, profile());
    saveSettings();
    renderSettings();
  }
  let visualPlayer;
  function clonePlayer() {
    if (!visualPlayer) {
      const svg = VisualRenderer.svg("Iria · equipaggiamento attuale");
      svg.id = "combat-player-figure";
      node("combat-player-avatar").replaceChildren(svg);
      visualPlayer = VisualRenderer.create(svg);
      svg.querySelector(".visual-rig").id = "combat-rig";
    }
    visualPlayer.render();
  }
  function makeEngine(seed) {
    return CombatEngine.create({
      profile: ClassSystem.combatProfile(undefined, undefined, {
        main: Equipment.equipped("mainHand"),
        support: Equipment.equipped("support"),
      }),
      stats: { ...Equipment.state.resultingStats },
      effects: equippedEffects(),
      rules: rules(),
      seed,
      playerName: node("combat-player-name").textContent,
    });
  }
  function stopClock() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    lastWallTime = null;
  }
  function frame(now) {
    frameId = null;
    if (!engine || engine.status !== "running") return;
    if (lastWallTime !== null)
      engine.advance(
        Math.min(0.25, Math.max(0, (now - lastWallTime) / 1000)) *
          settings.speed,
      );
    lastWallTime = now;
    if (engine.time - lastRenderAt >= 0.1 || engine.status === "finished") {
      renderBattle();
      lastRenderAt = engine.time;
    }
    if (engine.status === "running") frameId = requestAnimationFrame(frame);
    else stopClock();
  }
  function startClock() {
    stopClock();
    lastRenderAt = -1;
    frameId = requestAnimationFrame(frame);
  }
  function renderRewards() {
    const record = rewardState;
    if (!record || record.engine !== engine || !engine.result) return;
    const receipt = record.receipt;
    text(
      "combat-reward-values",
      receipt
        ? `+${receipt.rewards.xp} XP · +${receipt.rewards.crowns} Corone`
        : engine.result.outcome === "defeat"
          ? "+0 XP · +0 Corone"
          : "Ricompense in salvataggio…",
    );
    text(
      "combat-reward-level",
      receipt?.levelUps.length ? ProgressionData.levelUpSummary(receipt) : "",
    );
    text(
      "combat-reward-status",
      record.status === "failed"
        ? record.message
        : record.status === "paid"
          ? "Ricompensa salvata."
          : "Salvataggio in corso…",
    );
    node("combat-reward-retry").hidden = record.status !== "failed";
  }
  function settleRewards() {
    const record = rewardState;
    if (!record || !record.engine.result || record.status === "paid")
      return Promise.resolve(record?.receipt);
    if (record.status === "saving") return record.work;
    record.status = "saving";
    record.work = (async () => {
      try {
        let registration = await record.registration;
        if (!registration.ok) {
          record.registration = ProgressionSystem.beginManualCombat("guardian");
          registration = await record.registration;
        }
        if (!registration.ok) throw new Error(registration.message);
        const result = await ProgressionSystem.awardManualCombat(
          registration.ticket.id,
          record.engine.result.outcome,
        );
        if (!result.ok) throw new Error(result.message);
        record.receipt = result.receipt;
        record.status = "paid";
      } catch (error) {
        record.status = "failed";
        record.message = `Ricompensa non salvata: ${error.message} Riprova prima di iniziare un nuovo scontro.`;
      }
      if (record.engine === engine) renderBattle();
      return record.receipt;
    })();
    renderRewards();
    return record.work;
  }
  function start(options = {}) {
    if (rewardState?.status === "saving") return false;
    if (!kitReady()) {
      text(
        "combat-status",
        `Equipaggia ${ClassSystem.kitRequirements().label} per iniziare`,
      );
      return false;
    }
    stopClock();
    engine = makeEngine(options.seed);
    rewardState = {
      engine,
      status: "ready",
      receipt: null,
      registration: ProgressionSystem.beginManualCombat("guardian"),
    };
    engine.start();
    lastLogVersion = -1;
    renderBattle();
    startClock();
    return true;
  }
  function pauseToggle() {
    if (!engine) return;
    if (engine.status === "running") {
      engine.pause();
      stopClock();
    } else if (engine.status === "paused") {
      engine.resume();
      startClock();
    }
    renderBattle();
  }
  function reset() {
    stopClock();
    rewardState = null;
    engine = makeEngine();
    lastLogVersion = -1;
    renderBattle();
  }
  function logText(event) {
    const playerName = node("combat-player-name").textContent,
      enemyName = CombatData.enemies.guardian.name;
    if (event.type === "playerAction")
      return `${event.critical ? "CRITICO! " : ""}${playerName} usa ${ability(event.abilityId).name} — ${event.damage} danni`;
    if (event.type === "enemyAction")
      return `${enemyName} usa ${CombatData.enemies.guardian.attacks.find((a) => a.id === event.abilityId).name} — ${event.damage} danni${event.blocked ? " · BLOCCO" : ""}`;
    if (event.type === "dodge")
      return `${playerName} schiva il colpo del Guardiano`;
    if (event.type === "dot")
      return `${profile().effects[event.effectId].name} — ${event.damage} danni`;
    if (event.type === "itemProc")
      return `${Equipment.state.inventory.find((i) => i.id === event.itemId)?.name || "Oggetto"} attiva Sanguinamento potenziato`;
    if (event.type === "effectApply" || event.type === "effectRefresh")
      return `${profile().effects[event.effectId].name} ${event.type === "effectRefresh" ? "rinnovato" : "applicato"}${event.origin?.abilityId ? ` · ${ability(event.origin.abilityId).name}` : ""}`;
    if (event.type === "effectExpire")
      return `${profile().effects[event.effectId].name} terminato`;
    if (event.type === "result")
      return event.outcome === "victory" ? "VITTORIA" : "SCONFITTA";
    return "";
  }
  function effectSource(effect) {
    if (effect.origin.itemId)
      return (
        Equipment.state.inventory.find(
          (item) => item.id === effect.origin.itemId,
        )?.name || "Oggetto equipaggiato"
      );
    return (
      ability(effect.origin.abilityId)?.name ||
      node("combat-player-name").textContent
    );
  }
  function renderEffects(id, effects, time) {
    node(id).innerHTML = effects.length
      ? effects
          .map(
            (effect) =>
              `<span class="effect-chip ${effect.kind}" title="Origine: ${effectSource(effect)} · ${effect.stacks}/${effect.maxStacks} stack">${effect.name} · ${Math.max(0, effect.expiresAt - time).toFixed(1)}s${effect.stacks > 1 ? ` ×${effect.stacks}` : ""}</span>`,
          )
          .join("")
      : '<span class="no-effect">Nessun effetto</span>';
  }
  function renderBattle() {
    const snapshot = engine.snapshot();
    const resource = snapshot.player.resource;
    if (resource) {
      text(
        "combat-resource-value",
        `${resource.name}: ${resource.current.toFixed(1)} / ${resource.max}`,
      );
      const bar = node("combat-resource-bar");
      bar.setAttribute("aria-valuemax", resource.max);
      bar.setAttribute("aria-valuenow", resource.current.toFixed(1));
      bar.setAttribute("aria-label", resource.name);
      bar.firstElementChild.style.width = `${(100 * resource.current) / resource.max}%`;
    }
    for (const side of ["player", "enemy"]) {
      const actor = snapshot[side];
      text(`combat-${side}-hp`, `${actor.hp} / ${actor.maxHp} HP`);
      const bar = node(`combat-${side}-bar`);
      bar.setAttribute("aria-valuemax", actor.maxHp);
      bar.setAttribute("aria-valuenow", actor.hp);
      bar.firstElementChild.style.width = `${(100 * actor.hp) / actor.maxHp}%`;
      renderEffects(`combat-${side}-effects`, actor.effects, snapshot.time);
      const current =
        side === "player"
          ? ability(actor.lastAbility)
          : CombatData.enemies.guardian.attacks.find(
              (a) => a.id === actor.lastAbility,
            );
      text(`combat-${side}-action`, current ? current.name : "In attesa");
    }
    const special = snapshot.enemy.attacks.find(
      (attack) => attack.cooldown > 0,
    );
    text(
      "combat-enemy-special",
      `Speciale ${Math.max(0, (snapshot.enemy.cooldowns[special.id] || 0) - snapshot.time).toFixed(1)}s`,
    );
    text("combat-time", formatTime(snapshot.time));
    text(
      "combat-status",
      {
        idle: "Pronto",
        running: "In combattimento",
        paused: "In pausa",
        finished:
          snapshot.result?.outcome === "victory" ? "Vittoria" : "Sconfitta",
      }[snapshot.status],
    );
    text(
      "combat-gcd",
      `GCD ${Math.max(0, snapshot.player.nextActionAt - snapshot.time).toFixed(1)}s`,
    );
    node("combat-start").disabled =
      !kitReady() ||
      snapshot.status === "running" ||
      snapshot.status === "paused" ||
      rewardState?.status === "saving";
    node("combat-start").textContent =
      snapshot.status === "finished"
        ? "Nuovo combattimento"
        : "Inizia combattimento";
    node("combat-pause").disabled = !["running", "paused"].includes(
      snapshot.status,
    );
    node("combat-pause").textContent =
      snapshot.status === "paused" ? "Riprendi" : "Pausa";
    node("combat-cooldowns").innerHTML = profile()
      .abilities.map((skill) => {
        const remaining = Math.max(
          0,
          (snapshot.player.cooldowns[skill.id] || 0) - snapshot.time,
        );
        return `<div data-cooldown="${skill.id}"><span>${skill.name}</span><strong>${remaining > 0 ? `${remaining.toFixed(1)}s` : engine.canAfford(skill.id) ? "Pronta" : "Risorsa insufficiente"}</strong></div>`;
      })
      .join("");
    if (lastLogVersion !== snapshot.logVersion) {
      node("combat-log").innerHTML =
        [...snapshot.log]
          .reverse()
          .map(
            (event) =>
              `<li><time>${formatTime(event.time)}</time><span>${logText(event)}</span></li>`,
          )
          .join("") ||
        '<li class="hint">Lo scontro non è ancora iniziato.</li>';
      lastLogVersion = snapshot.logVersion;
    }
    node("combat-reset").disabled = rewardState?.status === "saving";
    node("combat-again").disabled = rewardState?.status === "saving";
    node("combat-result").hidden = !snapshot.result;
    if (snapshot.result) {
      text(
        "combat-result-heading",
        snapshot.result.outcome === "victory" ? "VITTORIA" : "SCONFITTA",
      );
      const result = snapshot.result;
      node("combat-result-stats").innerHTML = [
        ["Classe", result.className],
        ["Tendenza", result.buildName],
        ["Durata", `${result.duration.toFixed(1)}s`],
        ["Danno totale", result.damage],
        ["DPS medio", result.dps.toFixed(1)],
        ["Danno subito", result.damageTaken],
        ["Critici", result.criticals],
        [
          "Abilità più usata",
          result.mostUsed
            ? `${ability(result.mostUsed.abilityId).name} ×${result.mostUsed.count}`
            : "Nessuna",
        ],
        ...engine.profile.resultMetrics.map((field) => [
          field.label,
          Math.round(result[field.key]),
        ]),
        [`${resource.name} generata`, result.resourceGenerated.toFixed(1)],
        [`${resource.name} usata`, result.resourceUsed.toFixed(1)],
      ]
        .map(
          ([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`,
        )
        .join("");
      renderRewards();
      if (rewardState?.status === "ready") settleRewards();
    }
  }
  function equipmentChanged() {
    text(
      "combat-kit-label",
      `${ClassSystem.selected().name.toUpperCase()} · ${ClassSystem.build().name.toUpperCase()} · 1 VS 1`,
    );
    text(
      "combat-kit-hint",
      `Per ${ClassSystem.selected().name} serve ${ClassSystem.kitRequirements().label}. Arma: ${Equipment.equipped("mainHand")?.name || "mancante"}; supporto: ${Equipment.equipped("support")?.name || "mancante"}.`,
    );
    const fingerprint = JSON.stringify({
      selection: ClassSystem.state,
      stats: Equipment.state.resultingStats,
      equipment: Object.values(Equipment.state.equipment).map(
        (entry) => entry.equippedItem,
      ),
    });
    const appearance = JSON.stringify({
      character: Equipment.state.character,
      equipmentAppearance: Equipment.state.equipmentAppearance,
      items: Object.values(Equipment.state.equipment).map(
        (entry) => entry.appearanceItem,
      ),
    });
    if (appearance !== lookKey) {
      lookKey = appearance;
      clonePlayer();
    }
    if (fingerprint === gearKey) return;
    const nextConfiguration = JSON.stringify({
      selection: ClassSystem.state,
      equipment: Object.values(Equipment.state.equipment).map(
        (entry) => entry.equippedItem,
      ),
    });
    const onlyStatsChanged = nextConfiguration === configurationKey;
    configurationKey = nextConfiguration;
    const hadFight = engine && engine.status !== "idle";
    gearKey = fingerprint;
    // Our reward level-up refreshes Equipment synchronously. Keep this completed report.
    if (
      onlyStatsChanged &&
      engine?.status === "finished" &&
      rewardState?.status === "saving"
    )
      return;
    reset();
    node("combat-requirement").hidden = kitReady();
    if (hadFight)
      text(
        "combat-status",
        "Configurazione aggiornata: avvia un nuovo scontro",
      );
  }
  node("combat-reward-retry").addEventListener("click", () => settleRewards());
  node("combat-start").addEventListener("click", () => start());
  node("combat-again").addEventListener("click", () => start());
  node("combat-pause").addEventListener("click", pauseToggle);
  node("combat-reset").addEventListener("click", reset);
  node("combat-go-equipment").addEventListener("click", () =>
    window.NymeriaNavigation.showScreen("equipment"),
  );
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.combatMode) {
      settings.mode = button.dataset.combatMode;
      updateConfiguration();
    }
    if (button.dataset.combatSpeed) {
      settings.speed = Number(button.dataset.combatSpeed);
      lastWallTime = null;
      updateConfiguration();
    }
    if (button.dataset.move && settings.mode === "custom") {
      const index = settings.rules.findIndex(
          (rule) => rule.abilityId === button.dataset.rule,
        ),
        other = index + Number(button.dataset.move);
      if (other >= 0 && other < settings.rules.length) {
        [settings.rules[index], settings.rules[other]] = [
          settings.rules[other],
          settings.rules[index],
        ];
        updateConfiguration();
      }
    }
  });
  node("combat-priorities").addEventListener("change", (event) => {
    if (settings.mode !== "custom") return;
    const element = event.target;
    const row = settings.rules.find(
      (rule) =>
        rule.abilityId ===
        (element.dataset.condition ||
          element.dataset.threshold ||
          element.dataset.effect),
    );
    if (!row) return;
    if (element.dataset.condition)
      row.condition = { type: element.value, threshold: 25 };
    if (element.dataset.effect) row.condition.effectId = element.value;
    if (element.dataset.threshold)
      row.condition.threshold = Number(element.value);
    updateConfiguration();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && engine?.status === "running") {
      engine.pause();
      stopClock();
      renderBattle();
    }
  });
  ClassSystem.subscribe(() => {
    const nextClass = ClassSystem.state.classId, nextSpec = ClassSystem.resolved().specialization;
    if (preferences.key(activeClass, activeSpec) !== preferences.key(nextClass, nextSpec)) {
      preferences.write(activeClass, activeSpec, settings);
      activeClass = nextClass; activeSpec = nextSpec;
      settings = preferences.read(activeClass, activeSpec, profile());
    } else { activeClass = nextClass; activeSpec = nextSpec; }
    equipmentChanged();
    renderSettings();
    saveSettings();
  });
  Equipment.subscribe(equipmentChanged);
  equipmentChanged();
  renderSettings();
  saveSettings();
  return {
    start,
    reset,
    settleRewards,
    get engine() {
      return engine;
    },
    get settings() {
      return CombatData.copy(settings);
    },
    STORAGE_KEY: preferences.STORAGE_KEY,
  };
})();
