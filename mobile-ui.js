/* Mobile hubs adapt existing systems; persisted game state stays in the existing stores. */
const MobileUI = (() => {
  const node = id => document.getElementById(id), testMode = new URLSearchParams(location.search).get("test") === "1";
  // Keep all existing controls/listeners, but collect development tools in one secondary route.
  for (const id of ["world-debug", "expedition-debug", "reset-demo", "creator-debug"])
    node("debug-tools").append(node(id));
  node("menu-debug-link").hidden = !testMode;
  node("panel-equipment").append(node("equipment-customizer"));
  node("equipment-customizer").hidden = true;
  // Character quick slots now lead to real equipment navigation, not a second editor.
  const slots = { torso: "torso", legs: "legs", boots: "boots", cloak: "cloak", weapon: "mainHand" };
  for (const button of document.querySelectorAll(".stage [data-category]")) {
    button.dataset.hubSlot = slots[button.dataset.category];
    delete button.dataset.category;
  }
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-hub-slot]");
    if (!button) return;
    NymeriaNavigation.open("equipment"); InventoryUI.openSlot(button.dataset.hubSlot);
  });
  const strategy = document.createElement("details");
  strategy.className = "strategy-settings";
  strategy.innerHTML = '<summary>Strategia di combattimento · AUTO / PERSONALIZZATA</summary>';
  strategy.append(document.querySelector(".combat-strategy"));
  node("panel-class").append(strategy);
  // Preserve equipment appearance/dye controls, separately from the locked Character Creator.
  const customizer = document.createElement("section");
  customizer.className = "equipment-dye";
  customizer.innerHTML = '<h3>Tintura della corazza</h3><div id="mobile-dye" class="swatches"></div>';
  node("panel-equipment").append(customizer);
  function render() {
    const state = ProgressionStore.state;
    node("character-build").textContent = `${ClassSystem.build().name} · ${ClassSystem.selected().name}`;
    node("badge-activities").hidden = !state.pendingExpeditionResult;
    node("badge-activities").textContent = state.pendingExpeditionResult ? "Riscatta" : "";
    const completed = Object.values(state.frontier.quests).filter(q => q.status === "completed").length;
    node("badge-world").hidden = !completed;
    node("badge-world").textContent = completed ? String(completed) : "";
    node("tab-missions").setAttribute("aria-label", completed ? `Missioni · ${completed} da riscuotere` : "Missioni");
    node("tab-expeditions").setAttribute("aria-label", state.pendingExpeditionResult ? "Attività · ricompense da riscuotere" : "Attività");
    node("mobile-dye").innerHTML = PALETTES.dye.map(color => `<button class="swatch" data-equipment-dye="${color.id}" style="--swatch:${color.color}" aria-label="${color.name}" aria-pressed="${state && Equipment.state.equipmentAppearance.dye === color.id}"></button>`).join("");
  }
  document.addEventListener("nymeria:navigation", event => {
    if (event.detail.screen === "combat") node("panel-combat").append(strategy.querySelector(".combat-strategy") || document.querySelector(".combat-strategy"));
    else strategy.append(document.querySelector(".combat-strategy"));
  });
  ProgressionStore.subscribe(render); ClassSystem.subscribe(render); Equipment.subscribe(render);
  render();
  if (ProgressionStore.state.frontier.activeEncounter) NymeriaNavigation.open("world", { view: "battle" });
  return { render };
})();
