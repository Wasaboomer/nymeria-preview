/* Mobile inventory, explicit comparison target and accessible item detail sheet. */
const InventoryUI = (() => {
  let filter = "all",
    order = "itemLevel",
    slotFilter = null,
    selectedId = null,
    target = null;
  const dialog = document.querySelector("#item-dialog");
  const rarityLabel = (item) =>
    `${["I", "II", "III", "IV", "V"][GearData.rarities.indexOf(item.rarity)]} · ${item.rarity}`;
  const rarityClass = (item) =>
    `rarity-${GearData.rarities.indexOf(item.rarity)}`;
  const slotLabel = (id) => Equipment.slotById[id].label;
  const equippedSlot = (id) =>
    GearData.slots.find(
      (s) => Equipment.state.equipment[s.id].equippedItem === id,
    )?.id;
  const group = (item) =>
    item.slot === "weapon" || item.slot === "support"
      ? "weapons"
      : ["necklace", "earring", "bracelet", "ring"].includes(item.slot)
        ? "accessories"
        : "armor";
  function renderSlots() {
    const locked = Equipment.equipped("mainHand")?.handedness === "2H";
    document.querySelector("#equipment-grid").innerHTML = GearData.slots
      .map((slot) => {
        const item = Equipment.equipped(slot.id);
        const occupied = slot.id === "support" && locked;
        return `<button class="slot-card ${item ? rarityClass(item) : ""} ${occupied ? "locked" : ""}" data-open-slot="${slot.id}" ${occupied ? "disabled" : ""}><span class="slot-icon">${GearData.icon(item || slot.type)}</span><span><small>${slot.label}</small><strong>${occupied ? "Occupato dall’arma 2H" : item?.name || "Vuoto"}</strong><em>${occupied ? "Bloccato · rimuovi l’arma principale" : item ? `${rarityLabel(item)} · iLv ${item.itemLevel}` : "Tocca per scegliere"}</em></span></button>`;
      })
      .join("");
  }
  function visibleItems() {
    return Equipment.state.inventory
      .filter(
        (i) =>
          (filter === "all" || group(i) === filter) &&
          (!slotFilter || (Equipment.compatibleSlots(i).includes(slotFilter) && !ArmorRules.unavailableLabel(i, ClassSystem.selected()) && BuildSystem.compatible(i, ClassSystem.state.classId))),
      )
      .sort((a, b) =>
        order === "rarity"
          ? GearData.rarities.indexOf(b.rarity) -
              GearData.rarities.indexOf(a.rarity) ||
            b.itemLevel - a.itemLevel ||
            a.id.localeCompare(b.id)
          : b.itemLevel - a.itemLevel ||
            GearData.rarities.indexOf(b.rarity) -
              GearData.rarities.indexOf(a.rarity) ||
            a.id.localeCompare(b.id),
      );
  }
  function advisorMarkup(item, slot) {
    const cls = ClassSystem.selected(),
      build = ClassSystem.build();
    const unavailable = ArmorRules.unavailableLabel(item, cls);
    if (unavailable)
      return `<span class="hint armor-incompatible">${unavailable}</span>`;
    const advice = BuildSystem.advise(item, slot, cls.id, build.id, Equipment);
    return advice
      ? `<span class="gear-advice">${advice.improvement ? "<span>↑ Miglioramento</span>" : ""}${advice.bestOwned ? "<span>★ Migliore posseduto</span>" : ""}</span>`
      : "";
  }
  function renderInventory() {
    const rows = visibleItems(),
      owned = Equipment.state.inventory;
    document.querySelector("#inventory-count").textContent =
      `${owned.filter((i) => !i.equipped).length} in sacca · ${owned.filter((i) => i.equipped).length} equipaggiati`;
    document.querySelector("#slot-filter").innerHTML = slotFilter
      ? `<span>Slot: ${slotLabel(slotFilter)}</span><button id="clear-slot-filter">Mostra tutto</button>`
      : "";
    document
      .querySelectorAll("[data-filter]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.filter === filter)),
      );
    document.querySelector("#inventory-grid").innerHTML = rows.length
      ? rows
          .map(
            (item) =>
              `<button class="inventory-item ${rarityClass(item)}" data-item-id="${item.id}"><span class="inventory-icon">${GearData.icon(item)}</span><span class="inventory-name">${item.name}</span>${advisorMarkup(item, slotFilter || Equipment.compatibleSlots(item)[0])}<small class="item-category">${GearData.typeLabels[item.type] || item.type}</small><small class="item-preview">${Object.entries(item.stats).slice(0,2).map(([key,value])=>`${GearData.statLabels[key]} +${value}${["critical","speed"].includes(key)?"%":""}`).join(" · ")}</small><span class="rarity-text">${rarityLabel(item)}</span><small>iLv ${item.itemLevel} · Lv ${item.requiredLevel}</small><span class="item-location">${item.equipped ? `● ${slotLabel(equippedSlot(item.id))}` : "In sacca"}</span></button>`,
          )
          .join("")
      : '<p class="hint">Nessun oggetto per questo filtro.</p>';
    document.querySelector("#visible-count").textContent =
      `${rows.length} oggetti`;
  }
  function renderDetail() {
    const item = Equipment.state.inventory.find((i) => i.id === selectedId);
    if (!item) return;
    const slots = Equipment.compatibleSlots(item);
    if (!slots.includes(target)) target = slots[0];
    const advice = BuildSystem.advise(
      item,
      target,
      ClassSystem.state.classId,
      ClassSystem.build().id,
      Equipment,
    );
    const comparison = Equipment.comparison(item.id, target),
      error = Equipment.canEquip(item.id, target),
      ownSlot = equippedSlot(item.id);
    const verdict = error ? "Requisiti non soddisfatti: consulta il motivo sotto."
      : ownSlot === target ? "Questo oggetto è già equipaggiato."
      : advice ? `${advice.delta > 0 ? "↑ Migliore" : advice.delta < 0 ? "↓ Meno adatto" : "= Equivalente"} per ${ClassSystem.selected().name} / ${ClassSystem.build().name}. Verifica anche le singole statistiche.`
      : "Confronta le statistiche prima di equipaggiare.";
    document.querySelector("#detail-heading").textContent = item.name;
    document.querySelector("#detail-body").innerHTML =
      `<div class="detail-meta ${rarityClass(item)}">${GearData.icon(item)}<div><strong>${rarityLabel(item)}</strong><p>Item Level ${item.itemLevel} · Richiede Lv ${item.requiredLevel}</p><p>${GearData.typeLabels[item.type] || item.type}${item.handedness ? ` · ${item.handedness}` : ""}${item.armorType ? ` · ${ArmorRules.labels[item.armorType]}` : ""}</p></div></div><p class="description">${item.description}</p>${item.allowedSupports ? `<p class="hint">${item.handedness === "2H" ? "Occupa arma principale e supporto." : `Supporti: ${item.allowedSupports.map((x) => ({ shield: "scudo", dagger: "pugnale", offhandBlade: "seconda lama", quiver: "faretra", bolts: "dardi", book: "libro", orb: "orb", focus: "reliquia / focus" })[x]).join(", ")}.`}</p>` : ""}<dl class="detail-stats">${Object.entries(
        item.stats,
      )
        .map(
          ([k, v]) =>
            `<div><dt>${GearData.statLabels[k]}</dt><dd>+${v}${["critical", "speed"].includes(k) ? "%" : ""}</dd></div>`,
        )
        .join(
          "",
        )}</dl>${item.effects.length ? `<div class="effect"><span>${typeof CombatData !== "undefined" && item.effects.some((effect) => CombatData.itemHooks[effect.id]) ? "EFFETTO SPECIALE · ATTIVO NEL KIT CACCIATORE" : "EFFETTO SPECIALE · NON ATTIVO IN COMBATTIMENTO"}</span>${item.effects.map((e) => `<p>${e.description}</p>`).join("")}</div>` : ""}${slots.length > 1 ? `<fieldset class="target-picker"><legend>Destinazione e confronto</legend>${slots.map((s) => `<button data-target="${s}" aria-pressed="${s === target}">${slotLabel(s)}<small>${Equipment.equipped(s)?.name || "Vuoto"}</small></button>`).join("")}</fieldset>` : `<p class="option-label">${slotLabel(target)}</p>`}${advisorMarkup(item, target)}<p class="item-verdict" role="status">${verdict}</p><details class="advisor-explanation"><summary>Dettagli del consiglio</summary><p class="hint advisor-score">${advice ? `Score provvisorio ${ClassSystem.selected().name} / ${ClassSystem.build().name}: ${advice.score.toFixed(1)} · equipaggiato ${advice.currentScore.toFixed(1)} · Δ ${advice.delta > 0 ? "+" : ""}${advice.delta.toFixed(1)}. Pesi statistici ed effetti supportati; non è una graduatoria globale.` : "Nessun consiglio per il kit della classe selezionata."}</p></details><div class="comparison"><h3>Rispetto a: ${comparison.current?.name || "slot vuoto"}</h3><p class="hint">Variazione totale dopo equipaggiamento${comparison.supportRemoved ? " · include la rimozione del supporto incompatibile" : ""}.</p><dl>${
        Object.entries(comparison.delta)
          .filter(([, v]) => v !== 0)
          .map(
            ([k, v]) =>
              `<div><dt>${GearData.statLabels[k]}</dt><dd>${v > 0 ? "+" : ""}${v}${["critical", "speed"].includes(k) ? "%" : ""} <span>${v > 0 ? "↑" : "↓"}</span></dd></div>`,
          )
          .join("") ||
        "<div><dt>Statistiche</dt><dd>Nessuna differenza</dd></div>"
      }<div class="power-delta"><dt>Potere</dt><dd>${comparison.power > 0 ? "+" : ""}${comparison.power}</dd></div></dl></div>${error ? `<p class="compatibility" role="status">${error}</p>` : ""}<div class="detail-actions"><button id="equip-item" ${ownSlot === target ? "disabled" : ""}>${ownSlot === target ? "Già equipaggiato" : "Equipaggia"}</button>${ownSlot ? `<button data-remove="${ownSlot}">Rimuovi da ${slotLabel(ownSlot)}</button>` : ""}<button id="browse-slot">Altri oggetti per questo slot</button></div>`;
  }
  function openItem(id, preferred) {
    selectedId = id;
    const item = Equipment.state.inventory.find((i) => i.id === id);
    if (!item) return;
    const slots = Equipment.compatibleSlots(item);
    target = slots.includes(preferred)
      ? preferred
      : equippedSlot(id) ||
        slots.find((s) => !Equipment.equipped(s)) ||
        slots[0];
    renderDetail();
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  function openSlot(slot) {
    filterForSlot(slot);
    NymeriaNavigation.open("inventory", { slot });
  }
  function filterForSlot(slot) {
    slotFilter = slot;
    filter = "all";
    renderInventory();
  }
  document
    .querySelector("#close-detail")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }
  });
  document.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b) return;
    if (b.dataset.openSlot) openSlot(b.dataset.openSlot);
    if (b.dataset.itemId) openItem(b.dataset.itemId, slotFilter);
    if (b.dataset.filter) {
      filter = b.dataset.filter;
      slotFilter = null;
      renderInventory();
    }
    if (b.id === "clear-slot-filter") {
      slotFilter = null;
      filter = "all";
      renderInventory();
    }
    if (b.dataset.target) {
      target = b.dataset.target;
      renderDetail();
    }
    if (b.id === "browse-slot") {
      dialog.close();
      filterForSlot(target);
      document.dispatchEvent(
        new CustomEvent("nymeria:screen", { detail: "inventory" }),
      );
    }
    if (b.id === "equip-item") {
      const result = Equipment.equip(selectedId, target);
      document.dispatchEvent(
        new CustomEvent("nymeria:notice", { detail: result.message }),
      );
      if (result.ok) {
        if (NymeriaNavigation.route.slot) { dialog.close(); NymeriaNavigation.back(); }
        else renderDetail();
      }
    }
    if (b.dataset.remove) {
      const result = Equipment.unequip(b.dataset.remove);
      document.dispatchEvent(
        new CustomEvent("nymeria:notice", { detail: result.message }),
      );
      renderDetail();
    }
  });
  document
    .querySelector("#inventory-sort")
    .addEventListener("change", (event) => {
      order = event.target.value;
      renderInventory();
    });
  function render() {
    renderSlots();
    renderInventory();
    if (dialog.open) renderDetail();
  }
  document.addEventListener("nymeria:navigation", event => {
    if (event.detail.screen !== "inventory") return;
    slotFilter = event.detail.slot || null; filter = "all"; renderInventory();
  });
  ClassSystem.subscribe(render);
  return {
    render,
    filterForSlot,
    openSlot,
    openItem,
    visibleItems,
    close() {
      dialog.close();
    },
  };
})();
