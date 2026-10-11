/* Isolated presentation model: no Equipment instance, persistence or gameplay mutation. */
const VisualEquipmentProof = (() => {
  const slots = ["head", "torso", "legs", "boots", "gloves", "cloak", "mainHand", "support"];
  const state = {character: {hair: "veil", face: "calm", skin: PALETTES.skin[0].id, hairColor: "ink", eyes: "amber"}, dye: "sea", items: {}, twoHanded: false};
  const renderer = VisualRenderer.create(document.querySelector("#visual-proof"), () => state);
  const controls = document.querySelector("#visual-controls");
  function assetInfo(item, slot) {
    const ids = VisualManifest.forItem(item, slot);
    if (!ids.length) return "Asset assente · nessuna rappresentazione";
    const exact = Boolean(VisualManifest.itemVisuals[item.id]);
    return ids.map(id => `${id} (${exact ? VisualManifest.assets[id].quality : "rappresentazione condivisa / fallback"})`).join(", ");
  }
  async function render() {
    state.twoHanded = state.items.mainHand?.handedness === "2H";
    await renderer.render();
    const audit = document.querySelector("#visual-audit");
    audit.replaceChildren();
    for (const slot of slots) {
      const item = state.items[slot];
      if (!item) continue;
      const li = document.createElement("li");
      li.textContent = `${item.name}: ${assetInfo(item, slot)}${slot === "support" && state.twoHanded ? " · nascosto: arma a due mani" : ""}`;
      audit.append(li);
    }
    const errors = renderer.diagnostics();
    document.querySelector("#visual-status").textContent = errors.length ? errors.map(x => `Asset non caricato: ${x.missing}`).join(" · ") : "Moduli aggiornati. Nessuna modifica allo stato del gioco.";
  }
  for (const id of slots) {
    const slot = GearData.slots.find(x => x.id === id);
    const label = document.createElement("label");
    label.textContent = slot.label;
    const select = document.createElement("select");
    select.dataset.slot = id;
    select.append(new Option("Nessun modulo equipaggiamento", ""));
    for (const item of GearData.items.filter(x => x.slot === slot.type)) {
      const unavailable = !VisualManifest.forItem(item, id).length;
      select.append(new Option(`${item.name}${unavailable ? " · asset assente" : ""}`, item.id));
    }
    select.addEventListener("change", () => {
      state.items[id] = GearData.items.find(x => x.id === select.value);
      render();
    });
    label.append(select);
    controls.append(label);
  }
  render();
  return {ready: () => renderer.ready(), diagnostics: renderer.diagnostics};
})();
