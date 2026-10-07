/* Presentation adapters for M6.2. No rewards, inventory or combat calculations. */
const VisualUI = (() => {
  const node = (id) => document.getElementById(id),
    escape = QuestUI.escape;
  const equipmentSVG = VisualRenderer.svg(
    "Iria · aspetto dell’equipaggiamento",
  );
  equipmentSVG.id = "equipment-character";
  const equipmentStage = document.createElement("div");
  equipmentStage.className = "equipment-stage";
  equipmentStage.append(equipmentSVG);
  node("equipment-grid").before(equipmentStage);
  equipmentStage.append(node("equipment-grid"));
  const equipped = VisualRenderer.create(equipmentSVG);
  const battleStage = document.createElement("div");
  battleStage.className = "visual-battle-arena";
  const battlePlayerSVG = VisualRenderer.svg(
    "Personaggio · preparazione dell’incontro",
  );
  const enemyImage = document.createElement("img");
  enemyImage.className = "visual-enemy";
  enemyImage.width = 360;
  enemyImage.height = 640;
  enemyImage.alt = "";
  const feedback = document.createElement("p");
  feedback.className = "visual-skill-feedback";
  feedback.textContent = "Preparazione salvata";
  battleStage.append(battlePlayerSVG, enemyImage, feedback);
  node("world-battle-profile").after(battleStage);
  let battlePlayer = null,
    battleTicket = null,
    prepared = null,
    lastAction = null;
  function icons() {
    for (const [id, type] of [
      ["tab-character", "character"],
      ["tab-world", "world"],
      ["tab-expeditions", "activities"],
      ["tab-menu", "menu"],
    ])
      node(id).querySelector("span:first-child").innerHTML =
        VisualIcons.svg(type);
    for (const button of document.querySelectorAll("[data-nav]")) {
      const type = {
        equipment: "equipment",
        inventory: "inventory",
        class: "class",
        discoveries: "discoveries",
        debug: "menu",
      }[button.dataset.nav];
      if (type && !button.querySelector(".nymeria-icon"))
        button.insertAdjacentHTML("afterbegin", VisualIcons.svg(type));
    }
    for (const button of document.querySelectorAll(
      ".world-shortcuts [data-world-view]",
    )) {
      const type = { journal: "journal", overview: "map", battle: "combat" }[
        button.dataset.worldView
      ];
      if (type && !button.querySelector(".nymeria-icon"))
        button.insertAdjacentHTML("afterbegin", VisualIcons.svg(type));
    }
    for (const [selector, type] of [
      ["#expedition-wealth > span:first-child", "crowns"],
      ["#inventory-resources > span:first-child", "crowns"],
      [".xp-summary > strong", "xp"],
      ["#expedition-wealth > span:not(:first-child)", "loot"],
      ["#inventory-resources > span:not(:first-child)", "loot"],
    ])
      for (const element of document.querySelectorAll(selector))
        if (!element.querySelector(".nymeria-icon"))
          element.insertAdjacentHTML("afterbegin", VisualIcons.svg(type));
  }
  function map() {
    const state = ProgressionStore.state,
      frontier = state.frontier,
      container = node("world-locations");
    const currentLocation = WorldData.location(frontier.location)?.discoveryType && !(typeof WorldDiscovery !== "undefined" && WorldDiscovery?.accessible(frontier.location)) ? "veyra" : frontier.location;
    const quest = QuestData.get(frontier.trackedQuest),
      entry = quest && frontier.quests[quest.id];
    const objectives = new Set(
      quest && entry.status === "active"
        ? quest.objectives
            .filter((o, i) => entry.progress[i] < o.count)
            .map(QuestUI.objectiveLocation)
        : [],
    );
    if (quest && entry.status === "completed") objectives.add(quest.location);
    container.classList.add("visual-world-map");
    container.innerHTML =
      '<p class="map-title">FRONTIERA DEL VESPRO</p>' +
      WorldData.locations.filter(location => VisualManifest.mapNodes[location.id])
        .map((location) => {
          const [x, y] = VisualManifest.mapNodes[location.id],
            unlocked = state.unlockedContent.includes("world:" + location.id),
            current = currentLocation === location.id,
            target = objectives.has(location.id);
          const available = QuestData.quests.some(
            (q) =>
              q.location === location.id &&
              ["available", "completed"].includes(
                frontier.quests[q.id]?.status,
              ),
          );
          return `<button class="world-node map-node ${current ? "world-node-current" : ""} ${target ? "map-objective" : ""}" style="--map-x:${x}%;--map-y:${y}%" data-world-enter="${location.id}" data-map-state="${current ? "current" : unlocked ? "available" : "locked"}" ${!unlocked || frontier.activeEncounter || node("panel-world").getAttribute("aria-busy") === "true" ? "disabled" : ""} title="${escape(!unlocked ? location.unlockHint : location.name)}" aria-pressed="${current}" aria-label="${escape(location.name)} · ${current ? "Ti trovi qui" : unlocked ? "Disponibile" : "Bloccato"}${target ? " · Obiettivo missione" : ""}"><span class="map-node-sigil">${WorldUI.mark(location.mark)}</span><span class="map-node-label"><strong>${escape(location.name)}</strong><small>${current ? "● Ti trovi qui" : !unlocked ? "Bloccato" : target ? "◆ Obiettivo" : available ? "! Missione disponibile" : "Disponibile"}</small></span></button>`;
        })
        .join("") +
      '<p class="map-legend">● Luogo corrente · ◆ Obiettivo · ! Missione</p>';
    // Guild discoveries have no approved geographic coordinates: keep the six-node
    // map unchanged and offer their real travel action alongside it.
    let discovered = node("world-discovered-locations");
    if (!discovered) {
      discovered = document.createElement("div");
      discovered.id = "world-discovered-locations"; discovered.className = "world-locations";
      container.insertAdjacentElement("afterend", discovered);
    }
    const locations = WorldData.locations.filter(location => location.discoveryType && typeof WorldDiscovery !== "undefined" && WorldDiscovery?.accessible(location.id));
    discovered.hidden = container.hidden || !locations.length;
    discovered.innerHTML = locations.map(location => `<button class="world-node ${frontier.location === location.id ? "world-node-current" : ""}" data-world-enter="${location.id}" ${frontier.activeEncounter || node("panel-world").getAttribute("aria-busy") === "true" ? "disabled" : ""} aria-pressed="${frontier.location === location.id}">${WorldUI.mark(location.mark)}<span><strong>${escape(location.name)}</strong><small>${frontier.location === location.id ? "Ti trovi qui" : "Scoperto · Esplora →"}</small></span></button>`).join("");
  }
  function battle() {
    const ticket = ProgressionStore.state.frontier.activeEncounter;
    if (!ticket) return;
    if (battleTicket !== ticket.id) {
      battleTicket = ticket.id;
      prepared = VisualRenderer.snapshot(ticket.snapshot);
      if (!battlePlayer)
        battlePlayer = VisualRenderer.create(battlePlayerSVG, () => prepared);
      else battlePlayer.render(prepared);
      const enemy =
        VisualManifest.enemies[ticket.enemyId] ||
        VisualManifest.enemies[ticket.template.id];
      enemyImage.src = `assets/enemies/${enemy || "fallback"}.svg?v=m65-1`;
      enemyImage.alt = ticket.template.name;
      enemyImage.dataset.quality = enemy ? "vertical-slice" : "placeholder";
      lastAction = null;
      feedback.textContent = "Preparazione salvata";
    }
    const action = WorldUI.engine?.log
      .slice()
      .reverse()
      .find((e) => ["playerAction", "enemyAction", "dodge"].includes(e.type));
    if (action && action !== lastAction) {
      lastAction = action;
      const player = action.type === "playerAction",
        skill = player
          ? ticket.snapshot.profile.abilities.find(
              (a) => a.id === action.abilityId,
            )?.name
          : ticket.template.attacks.find((a) => a.id === action.abilityId)
              ?.name;
      feedback.textContent =
        action.type === "dodge"
          ? "Schivata"
          : `${skill || "Attacco"}${action.damage !== undefined ? " · " + action.damage + " danni" : ""}${action.critical ? " · Critico" : ""}`;
      const actor = player ? battlePlayerSVG : enemyImage;
      actor.classList.remove("visual-attack");
      void actor.getBoundingClientRect();
      actor.classList.add("visual-attack");
    }
  }
  const diagnostics = document.createElement("details");
  diagnostics.id = "visual-diagnostics";
  diagnostics.hidden = !Equipment.testMode;
  diagnostics.innerHTML =
    "<summary>DEBUG · Rig / asset diagnostics</summary><p></p>";
  node("debug-tools").append(diagnostics);
  function updateDiagnostics() {
    diagnostics.querySelector("p").textContent =
      VisualRenderer.diagnostics()
        .map((row) => `${row.actor} · ${row.layer}: ${row.missing}`)
        .join(" | ") || "Tutti gli asset richiesti sono disponibili.";
  }
  function refresh() {
    equipped.render().then(updateDiagnostics);
    icons();
  }
  document.addEventListener("nymeria:world-render", () => {
    map();
    battle();
    icons();
  });
  document.addEventListener("nymeria:world-battle-render", battle);
  document.addEventListener("nymeria:navigation", () => {
    refresh();
    map();
    battle();
  });
  Equipment.subscribe(refresh);
  ProgressionStore.subscribe(() => {
    icons();
  });
  enemyImage.addEventListener("error", () => {
    if (!enemyImage.src.includes("/fallback.svg"))
      enemyImage.src = "assets/enemies/fallback.svg?v=m65-1";
  });
  refresh();
  map();
  battle();
  return { map, battle, ready: VisualRenderer.ready };
})();

/* Test-only, isolated art review. Never writes to Equipment or localStorage. */
(() => {
  if (!Equipment.testMode) return;
  const showcase = document.createElement("details");
  showcase.id = "visual-showcase";
  showcase.innerHTML = `<summary>Visual Showcase M6.5</summary>
    <p class="hint">DEBUG · Anteprima indipendente. Nessuna modifica al personaggio salvato. Custode M6.5.1: proxy asset, non artwork finale.</p>
    <div class="showcase-controls" role="group" aria-label="Configurazione"></div>
    <div class="showcase-comparison" role="group" aria-label="Confronto A/B">
      <button data-compare-toggle aria-pressed="false">Confronto A/B</button>
      <select aria-label="Elemento da confrontare" id="showcase-compare-part"><option value="armor">Plate A / B</option><option value="head">Helmet A / B</option><option value="mainHand">Sword A / B</option><option value="support">Shield A / B</option></select>
      <button data-compare-side="a" aria-pressed="true">A</button><button data-compare-side="b" aria-pressed="false">B</button>
      <button data-compare-silhouette aria-pressed="false">Silhouette nera</button>
    </div>
    <div class="showcase-stage"></div>
    <p class="showcase-status" role="status" aria-live="polite"></p>
    <div class="showcase-appearance"></div>
    <h4>Enemy visual M6.5</h4><div class="showcase-enemies" role="group" aria-label="Nemico"></div>
    <img class="showcase-enemy" width="360" height="640" alt="" hidden />`;
  document.getElementById("debug-tools").append(showcase);
  let renderer, comparisonRenderer;
  let compare = false,
    compareSide = "a",
    silhouette = false;
  const comparePart = showcase.querySelector("#showcase-compare-part");
  const armorSlots = ["torso", "legs", "boots", "gloves", "belt"];
  const alternatives = {
    head: ["head-helm", "head-vesper"],
    mainHand: ["sword", "vesper-sword"],
    support: ["shield", "vesper-shield"],
  };
  const preview = {
    character: { ...Equipment.state.character },
    dye: Equipment.state.equipmentAppearance.dye,
    items: {},
    twoHanded: false,
  };
  const presets = {
    plateA: {
      label: "Custode Plate A",
      set: "plate-a",
      weapon: "sword",
      support: "shield",
      belt: "belt-gold",
      cloak: "cloak-dusk",
    },
    plateB: {
      label: "Custode Plate B",
      set: "plate-b",
      weapon: "vesper-sword",
      support: "vesper-shield",
      belt: "belt-rope",
      cloak: "cloak-pilgrim",
    },
    mailA: {
      label: "Cacciatore Mail A",
      set: "mail-a",
      weapon: "bow",
      support: "quiver",
      belt: "belt-rope",
      cloak: "cloak-pilgrim",
    },
  };
  const item = (id) => GearData.items.find((row) => row.id === id);
  let selected = "plateA";
  const controls = showcase.querySelector(".showcase-controls");
  const itemButtons = (slot, ids, labels) =>
    ids
      .map(
        (id, i) =>
          `<button data-showcase-slot="${slot}" data-showcase-item="${id}" aria-pressed="false">${labels[i]}</button>`,
      )
      .join("");
  controls.innerHTML = `<fieldset><legend>ARMOR · set di protezioni</legend><button data-showcase-armor="plateA">Plate A</button><button data-showcase-armor="plateB">Plate B</button></fieldset>
    <fieldset><legend>HELMET</legend>${itemButtons("head", ["none", ...alternatives.head], ["Nessuno", "Helmet A", "Helmet B"])}</fieldset>
    <fieldset><legend>WEAPON</legend>${itemButtons("mainHand", alternatives.mainHand, ["Sword A", "Sword B"])}</fieldset>
    <fieldset><legend>SHIELD</legend>${itemButtons("support", alternatives.support, ["Shield A", "Shield B"])}</fieldset>
    <details class="showcase-extra"><summary>Preset e altri visual M6.5</summary>${Object.entries(
      presets,
    )
      .map(
        ([id, row]) =>
          `<button data-showcase-preset="${id}" aria-pressed="false">${row.label}</button>`,
      )
      .join(
        "",
      )}<button data-showcase-base>Body / base</button><button data-showcase-bow>Bow A + Quiver A</button><button data-showcase-helmet>Mostra / rimuovi elmo</button></details>`;
  function appearanceGroup(key, label, options) {
    return `<fieldset><legend>${label}</legend>${options.map((row) => `<button data-showcase-appearance="${key}" data-showcase-value="${row.id}" aria-pressed="false">${row.color ? `<span style="background:${row.color}" aria-hidden="true"></span>` : ""}${row.name}</button>`).join("")}</fieldset>`;
  }
  showcase.querySelector(".showcase-appearance").innerHTML =
    appearanceGroup("hair", "Acconciatura", VisualManifest.hairstyles) +
    appearanceGroup("skin", "Carnagione", PALETTES.skin) +
    appearanceGroup("hairColor", "Colore capelli", PALETTES.hair) +
    appearanceGroup("eyes", "Occhi", PALETTES.eyes) +
    appearanceGroup("face", "Volto / dettaglio", VisualManifest.faces) +
    appearanceGroup("dye", "Tintura corazza", PALETTES.dye);
  const enemies = showcase.querySelector(".showcase-enemies");
  enemies.innerHTML = Object.keys(VisualManifest.enemies)
    .map(
      (id) =>
        `<button data-showcase-enemy="${id}" aria-pressed="false">${WorldData.enemy(id).name}</button>`,
    )
    .join("");
  function choosePreset(id) {
    selected = id;
    const preset = presets[id];
    preview.items = {};
    // Resolve each real item through the existing art manifest; no copied renderer/assets.
    for (const [id, assets] of Object.entries(VisualManifest.itemVisuals)) {
      const asset = assets.find((id) => id.startsWith(preset.set + "-"));
      if (!asset) continue;
      const layer = VisualManifest.assets[asset].layer;
      if (["torso", "legs", "boots", "gloves", "head"].includes(layer))
        preview.items[layer] = item(id);
    }
    Object.assign(preview.items, {
      mainHand: item(preset.weapon),
      support: item(preset.support),
      belt: item(preset.belt),
      cloak: item(preset.cloak),
    });
    preview.twoHanded = false;
  }
  function changeArmor(model, presetId) {
    const preset = presets[presetId];
    for (const slot of armorSlots) {
      if (slot === "belt") {
        model.items.belt = item(preset.belt);
        continue;
      }
      const id = Object.keys(VisualManifest.itemVisuals).find((id) =>
        VisualManifest.itemVisuals[id].some(
          (asset) => asset === preset.set + "-" + slot,
        ),
      );
      model.items[slot] = item(id);
    }
  }
  function comparisonModel(side) {
    const model = {
      ...preview,
      character: { ...preview.character },
      items: { ...preview.items },
    };
    if (comparePart.value === "armor")
      changeArmor(model, side === "a" ? "plateA" : "plateB");
    else
      model.items[comparePart.value] = item(
        alternatives[comparePart.value][side === "a" ? 0 : 1],
      );
    return model;
  }
  comparePart.addEventListener("change", () => render());
  function render() {
    for (const button of showcase.querySelectorAll("[data-showcase-preset]"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.showcasePreset === selected),
      );
    for (const button of showcase.querySelectorAll(
      "[data-showcase-appearance]",
    ))
      button.setAttribute(
        "aria-pressed",
        String(
          (button.dataset.showcaseAppearance === "dye"
            ? preview.dye
            : preview.character[button.dataset.showcaseAppearance]) ===
            button.dataset.showcaseValue,
        ),
      );
    for (const button of showcase.querySelectorAll("[data-showcase-item]"))
      button.setAttribute(
        "aria-pressed",
        String(
          (preview.items[button.dataset.showcaseSlot]?.id || "none") ===
            button.dataset.showcaseItem,
        ),
      );
    showcase.querySelector(".showcase-status").textContent =
      `${presets[selected]?.label || "Body / base"} · ${preview.items.mainHand?.name || "Nessuna arma"} · ${preview.items.support?.name || "Nessun supporto"}`;
    for (const button of showcase.querySelectorAll("[data-showcase-armor]"))
      button.setAttribute(
        "aria-pressed",
        String(
          preview.items.torso?.id ===
            (button.dataset.showcaseArmor === "plateA"
              ? "torso-warden"
              : "torso-vesper"),
        ),
      );
    showcase
      .querySelector("[data-compare-toggle]")
      .setAttribute("aria-pressed", String(compare));
    showcase
      .querySelector("[data-compare-silhouette]")
      .setAttribute("aria-pressed", String(silhouette));
    for (const button of showcase.querySelectorAll("[data-compare-side]"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.compareSide === compareSide),
      );
    const stage = showcase.querySelector(".showcase-stage");
    stage.classList.toggle("is-comparing", compare);
    stage.classList.toggle("silhouette-review", silhouette);
    stage.dataset.side = compareSide;
    if (compare)
      showcase.querySelector(".showcase-status").textContent =
        `Confronto ${comparePart.selectedOptions[0].textContent} · ${compareSide.toUpperCase()} · stessa preparazione, varia soltanto l'elemento scelto`;
    return Promise.all([
      renderer?.render(compare ? comparisonModel("a") : preview),
      comparisonRenderer?.render(comparisonModel("b")),
    ]);
  }
  showcase.addEventListener("toggle", () => {
    if (!showcase.open || renderer) return;
    const svg = VisualRenderer.svg(
      "Visual Showcase M6.5 · personaggio modulare",
    );
    svg.id = "showcase-character";
    showcase.querySelector(".showcase-stage").append(svg);
    choosePreset("plateA");
    renderer = VisualRenderer.create(svg, () =>
      compare ? comparisonModel("a") : preview,
    );
    const other = VisualRenderer.svg("Confronto B · stessa preparazione");
    other.id = "showcase-character-b";
    showcase.querySelector(".showcase-stage").append(other);
    comparisonRenderer = VisualRenderer.create(other, () =>
      comparisonModel("b"),
    );
    render();
  });
  showcase.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || !renderer) return;
    if (button.hasAttribute("data-compare-toggle")) compare = !compare;
    if (button.dataset.compareSide) {
      compare = true;
      compareSide = button.dataset.compareSide;
    }
    if (button.hasAttribute("data-compare-silhouette"))
      silhouette = !silhouette;
    if (button.dataset.showcaseArmor) {
      changeArmor(preview, button.dataset.showcaseArmor);
      selected = button.dataset.showcaseArmor;
      compare = false;
    }
    if (button.dataset.showcasePreset) {
      choosePreset(button.dataset.showcasePreset);
      compare = false;
    }
    if (button.hasAttribute("data-showcase-base")) {
      compare = false;
      selected = null;
      preview.items = {};
    }
    if (button.dataset.showcaseItem) {
      compare = false;
      const slot = button.dataset.showcaseSlot;
      if (button.dataset.showcaseItem === "none") delete preview.items[slot];
      else preview.items[slot] = item(button.dataset.showcaseItem);
    }
    if (button.hasAttribute("data-showcase-bow")) {
      compare = false;
      preview.items.mainHand = item("bow");
      preview.items.support = item("quiver");
    }
    if (button.hasAttribute("data-showcase-helmet")) {
      compare = false;
      if (preview.items.head) delete preview.items.head;
      else
        preview.items.head = item(
          { plateA: "head-helm", plateB: "head-vesper", mailA: "head-chain" }[
            selected
          ] || "head-helm",
        );
    }
    if (button.dataset.showcaseAppearance) {
      compare = false;
      const key = button.dataset.showcaseAppearance;
      if (key === "dye") preview.dye = button.dataset.showcaseValue;
      else preview.character[key] = button.dataset.showcaseValue;
      // Appearance review must remain visible even with the closed Plate B helmet.
      if (["hair", "skin", "hairColor", "eyes", "face"].includes(key))
        delete preview.items.head;
    }
    if (button.dataset.showcaseEnemy) {
      const id = button.dataset.showcaseEnemy,
        image = showcase.querySelector(".showcase-enemy");
      image.src = `assets/enemies/${VisualManifest.enemies[id]}.svg?v=m65-1`;
      image.alt = WorldData.enemy(id).name;
      image.hidden = false;
      for (const b of enemies.querySelectorAll("button"))
        b.setAttribute("aria-pressed", String(b === button));
    }
    render();
  });
})();
