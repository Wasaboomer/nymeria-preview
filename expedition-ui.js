/* Presentation timer only. Completion is always reconstructed from durable timestamps. */
const ExpeditionUI = (() => {
  const node = (id) => document.getElementById(id);
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const duration = (ms) => `${Math.ceil(ms / 60000)} min`;
  const countdown = (ms) => {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };
  let estimateKey = "",
    estimates = {},
    busy = false,
    tickBusy = false;
  let welcome =
    !!ProgressionStore.state.pendingExpeditionResult ||
    !!(
      ProgressionStore.state.activeExpedition &&
      Date.now() >= ProgressionStore.state.activeExpedition.endsAt
    );
  let wasHidden = false, cancelTicket = null;
  function renderXP() {
    const state = ProgressionStore.state;
    node("identity-level").textContent = state.level;
    node("identity-level-badge").textContent = String(state.level).padStart(
      2,
      "0",
    );
    node("identity-level-badge").setAttribute(
      "aria-label",
      `Livello ${state.level}`,
    );
    for (const prefix of ["character", "expedition"]) {
      node(`${prefix}-xp-label`).textContent = `Livello ${state.level}`;
      node(`${prefix}-xp-value`).textContent = state.requiredXP
        ? `${state.currentXP} / ${state.requiredXP} XP`
        : `MAX · ${state.totalXP} XP totali`;
      const bar = node(`${prefix}-xp-bar`);
      bar.setAttribute("aria-valuemax", state.requiredXP || 1);
      bar.setAttribute("aria-valuenow", state.requiredXP ? state.currentXP : 1);
      bar.firstElementChild.style.width = `${state.requiredXP ? (state.currentXP / state.requiredXP) * 100 : 100}%`;
    }
    node("progression-level-up").textContent = ProgressionData.levelUpSummary(
      ProgressionData.latestLevelUp(state),
    );
    const wealth = `<span><strong>${state.crowns}</strong> Corone</span>${Object.entries(
      ProgressionData.materialNames,
    )
      .map(
        ([key, name]) =>
          `<span><strong>${state.materials[key]}</strong> ${name}</span>`,
      )
      .join("")}`;
    node("expedition-wealth").innerHTML = wealth;
    node("inventory-resources").innerHTML = wealth;
  }
  function lootMarkup(report) {
    if (!report.rewards.lootIds.length)
      return '<p class="hint">Nessun oggetto trovato.</p>';
    return report.rewards.lootIds
      .map((id, index) => {
        const item =
          Equipment.state.inventory.find((item) => item.id === id) ||
          GearData.items.find((item) => item.id === id);
        if (!item) return "";
        const duplicate = report.loot?.[index]?.duplicate;
        const advice = BuildSystem.advise(
          item,
          Equipment.compatibleSlots(item)[0],
          ClassSystem.state.classId,
          ClassSystem.build().id,
          Equipment,
          { includeCandidate: true },
        );
        return `<article class="expedition-loot"><strong>Oggetto trovato · ${escape(item.name)}</strong><small>${item.rarity} · iLv ${item.itemLevel} · richiede Lv ${item.requiredLevel}</small>${ArmorRules.unavailableLabel(item, ClassSystem.selected()) ? `<small>${ArmorRules.unavailableLabel(item, ClassSystem.selected())}</small>` : ""}${duplicate ? "<p>Già posseduto → +2 Ferro del Vespro.</p>" : `<p class="gear-advice">${advice?.improvement ? "↑ Miglioramento " : ""}${advice?.bestOwned ? "★ Migliore posseduto" : ""}</p>`}<small>${report.claimedAt ? "Disponibile in Inventario; non equipaggiato automaticamente." : "Il consiglio considera il ritrovamento dopo riscossione."}</small></article>`;
      })
      .join("");
  }
  function renderReport() {
    const state = ProgressionStore.state,
      pending = state.pendingExpeditionResult,
      report = pending || state.lastClaim;
    node("expedition-report").hidden = !report;
    node("expedition-welcome").hidden = !(welcome && pending);
    if (welcome && pending)
      node("expedition-welcome").textContent =
        `Bentornato. Durante la tua assenza Iria ha ${pending.success ? "completato" : "affrontato senza completare"} ${pending.activityName}. Le ricompense attendono la riscossione.`;
    if (!report) return;
    const futureLevel = ProgressionData.fromTotal(
      state.totalXP + report.rewards.xp,
    ).level;
    node("expedition-report-body").innerHTML =
      `<h3>${report.success ? "SPEDIZIONE COMPLETATA" : "SPEDIZIONE FALLITA"}${report.testMode ? " · TEST" : ""}</h3><p>${escape(report.activityName)} · ${escape(report.className)} / ${escape(report.buildName)} · Lv ${report.level}</p><dl class="expedition-result-stats"><div><dt>Durata</dt><dd>${duration(report.durationMs)}</dd></div><div><dt>Incontri completati</dt><dd>${report.completed} / ${report.total}</dd></div><div><dt>XP</dt><dd>+${report.rewards.xp}</dd></div><div><dt>Corone</dt><dd>+${report.rewards.crowns}</dd></div>${Object.entries(
        ProgressionData.materialNames,
      )
        .map(
          ([key, name]) =>
            `<div><dt>${name}</dt><dd>+${report.rewards.materials[key]}</dd></div>`,
        )
        .join(
          "",
        )}</dl>${!report.success ? '<p class="hint">Ricompense parziali dai soli incontri vinti. Nessun equipaggiamento perso.</p>' : ""}<h3>Ritrovamenti</h3>${lootMarkup(report)}<h3>Eventi avvenuti</h3>${report.events.length ? `<ul>${report.events.map((event) => `<li><strong>${escape(event.name)}</strong> — ${escape(event.description)}</li>`).join("")}</ul>` : '<p class="hint">Nessun evento particolare.</p>'}${report.levelUps?.length ? `<p class="level-up-feedback">${escape(ProgressionData.levelUpSummary(report))}</p>` : pending && futureLevel > state.level ? `<p class="hint">Con la riscossione raggiungerai il livello ${futureLevel}.</p>` : ""}`;
    node("expedition-claim").hidden = !pending;
    node("expedition-claim").disabled = busy;
    node("expedition-claimed").hidden = !!pending;
  }
  function renderActivities() {
    const state = ProgressionStore.state,
      snapshot = ProgressionSystem.snapshot();
    const key = JSON.stringify(snapshot);
    if (key !== estimateKey) {
      estimateKey = key;
      estimates = Object.fromEntries(
        ExpeditionData.activities.map((activity) => [
          activity.id,
          snapshot.profile.kitValid
            ? ExpeditionEngine.estimate(activity, snapshot)
            : "Pericolosa",
        ]),
      );
    }
    node("expedition-kit").textContent = snapshot.profile.kitValid
      ? `Preparazione: ${snapshot.profile.className} / ${snapshot.profile.buildName}. Alla partenza vengono salvati classe, build ed equipaggiamento usati per questa spedizione.`
      : `Per partire prepara ${ClassSystem.selected().requirement} in Equipaggiamento.`;
    node("expedition-activities").innerHTML = ExpeditionData.activities
      .map((activity) => {
        const locked = state.level < activity.requiredLevel;
        const reason = locked ? `Richiede livello ${activity.requiredLevel}; il tuo livello è ${state.level}.`
          : state.activeExpedition ? 'Hai già una spedizione in corso. Attendi il termine oppure annullala.'
          : state.pendingExpeditionResult ? 'Riscuoti il risultato della spedizione precedente prima di partire.'
          : !snapshot.profile.kitValid ? `Equipaggiamento incompleto: ${ClassSystem.selected().requirement}. Usa “Prepara equipaggiamento”.`
          : busy ? 'Operazione in corso.' : '';
        return `<article class="expedition-card" data-activity="${activity.id}"><h3>${activity.name}</h3><p>${duration(activity.durationMs)} · ${activity.encounters} incontri + eventuali eventi</p><p>Rischio: <strong>${estimates[activity.id]}</strong> · grado ${activity.difficulty}</p><small>XP ${activity.encounters * activity.xpPerEncounter + activity.completionXP} base se completata · Corone, materiali, possibilità di loot</small>${reason ? `<p class="expedition-requirement" id="expedition-requirement-${activity.id}">${escape(reason)}</p>` : ""}<button ${reason ? `aria-describedby="expedition-requirement-${activity.id}"` : ""} data-start-expedition="${activity.id}" ${locked || !snapshot.profile.kitValid || state.activeExpedition || state.pendingExpeditionResult || busy ? "disabled" : ""}>${locked ? `Si sblocca al livello ${activity.requiredLevel}` : state.activeExpedition ? "Spedizione in corso" : state.pendingExpeditionResult ? "Riscuoti prima di partire" : !snapshot.profile.kitValid ? "Prepara equipaggiamento" : ProgressionSystem.testMode ? "Avvia spedizione · TEST" : "Avvia spedizione"}</button></article>`;
      })
      .join("");
  }
  function renderClock() {
    const active = ProgressionStore.state.activeExpedition;
    node("expedition-running").hidden = !active;
    if (!active || cancelTicket !== active.id || busy || Date.now() >= active.endsAt) cancelTicket = null;
    node("expedition-cancel-confirm").hidden = !cancelTicket;
    node("expedition-cancel").setAttribute("aria-expanded", String(!!cancelTicket));
    node("expedition-cancel-apply").disabled = busy;
    if (!active) return;
    const remaining = Math.min(
      active.endsAt - active.startedAt,
      Math.max(0, active.endsAt - Date.now()),
    );
    const progress = Math.max(
      0,
      Math.min(
        100,
        ((Date.now() - active.startedAt) / (active.endsAt - active.startedAt)) *
          100,
      ),
    );
    node("expedition-active-name").textContent =
      `${active.activity.name}${active.testMode ? " · TEST" : ""}`;
    node("expedition-countdown").textContent =
      `Tempo rimanente ${countdown(remaining)}`;
    node("expedition-active-info").textContent =
      `Grado ${active.activity.difficulty} · ${active.activity.encounters} incontri previsti + eventi · ${active.snapshot.profile.className} / ${active.snapshot.profile.buildName} · Lv ${active.snapshot.level}`;
    node("expedition-time-bar").setAttribute(
      "aria-valuenow",
      progress.toFixed(1),
    );
    node("expedition-time-bar").firstElementChild.style.width = `${progress}%`;
    node("expedition-cancel").disabled = busy || remaining === 0;
    node("expedition-debug-complete").disabled = busy || !active.testMode;
  }
  function render() {
    renderXP();
    renderActivities();
    renderClock();
    renderReport();
    node("expedition-storage").textContent = ProgressionStore.error;
  }
  async function action(operation) {
    if (busy) return;
    busy = true;
    render();
    try {
      const result = await operation();
      node("expedition-message").textContent = result.message || "";
      if (result.levelUps?.length)
        document.dispatchEvent(
          new CustomEvent("nymeria:notice", { detail: result.message }),
        );
      if (!result.ok && ProgressionStore.error)
        node("expedition-storage").textContent = ProgressionStore.error;
    } catch {
      node("expedition-message").textContent =
        "Operazione non riuscita. Nessuna ricompensa duplicata; ricarica per riprovare.";
    } finally {
      busy = false;
      render();
    }
  }
  node("expedition-activities").addEventListener("click", (event) => {
    const button = event.target.closest("[data-start-expedition]");
    if (button) {
      welcome = false;
      action(() => ProgressionSystem.start(button.dataset.startExpedition));
    }
  });
  node("expedition-claim").addEventListener("click", () => {
    const id = ProgressionStore.state.pendingExpeditionResult?.id;
    action(() => ProgressionSystem.claim(id));
  });
  node("expedition-cancel").addEventListener("click", () => {
    cancelTicket = ProgressionStore.state.activeExpedition?.id || null;
    renderClock();
    node("expedition-cancel-keep").focus();
  });
  node("expedition-cancel-keep").addEventListener("click", () => {
    cancelTicket = null; renderClock(); node("expedition-cancel").focus();
  });
  node("expedition-cancel-apply").addEventListener("click", () => {
    if (!cancelTicket || cancelTicket !== ProgressionStore.state.activeExpedition?.id) return;
    cancelTicket = null;
    action(() => ProgressionSystem.cancel());
  });
  node("expedition-debug-complete").addEventListener("click", () =>
    action(() => ProgressionSystem.debugComplete()),
  );
  node("expedition-go-equipment").addEventListener("click", () =>
    window.NymeriaNavigation.showScreen("equipment"),
  );
  node("expedition-debug").hidden = !ProgressionSystem.testMode;
  async function tick() {
    if (document.hidden || tickBusy) return;
    tickBusy = true;
    try {
      await ProgressionSystem.refresh();
      renderClock();
    } finally {
      tickBusy = false;
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) wasHidden = true;
    else {
      if (
        wasHidden &&
        (ProgressionStore.state.pendingExpeditionResult ||
          ProgressionStore.state.activeExpedition?.endsAt <= Date.now())
      )
        welcome = true;
      wasHidden = false;
      tick();
      renderReport();
    }
  });
  ProgressionStore.subscribe(render);
  Equipment.subscribe(render);
  ClassSystem.subscribe(render);
  render();
  tick();
  setInterval(tick, 1000);
  return { render };
})();
