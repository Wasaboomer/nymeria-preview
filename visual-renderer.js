/* Shared SVG compositor: cached independent files, atomic per-layer swaps, no game logic. */
const VisualRenderer = (() => {
  const NS = "http://www.w3.org/2000/svg",
    cache = new Map(),
    instances = new Set();
  let serial = 0;
  function load(id) {
    if (!cache.has(id))
      cache.set(
        id,
        (async () => {
          const asset = VisualManifest.assets[id];
          if (!asset) throw Error(`Unknown visual ${id}`);
          if (asset.compatibleRig !== VisualManifest.rig.id)
            throw Error(`Incompatible rig ${id}`);
          const response = await fetch(asset.file + "?v=m651-1");
          if (!response.ok) throw Error(`Missing visual ${id}`);
          const source = new DOMParser().parseFromString(
            await response.text(),
            "image/svg+xml",
          );
          if (
            source.querySelector("parsererror") ||
            source.documentElement.getAttribute("viewBox") !== "0 0 360 640"
          )
            throw Error(`Invalid rig ${id}`);
          return source.documentElement;
        })(),
      );
    return cache.get(id);
  }
  function model() {
    return {
      character: { ...Equipment.state.character },
      dye: Equipment.state.equipmentAppearance.dye,
      items: Object.fromEntries(
        GearData.slots.map((s) => [s.id, Equipment.appearance(s.id)]),
      ),
      twoHanded: Equipment.equipped("mainHand")?.handedness === "2H",
    };
  }
  function snapshot(preparation) {
    const current = model();
    if (preparation?.gearIds) {
      const ids = preparation.gearIds;
      current.items = Object.fromEntries(
        GearData.slots.map((s, index) => [
          s.id,
          GearData.items.find(
            (i) => i.id === (Array.isArray(ids) ? ids[index] : ids[s.id]),
          ) || null,
        ]),
      );
      current.twoHanded = current.items.mainHand?.handedness === "2H";
      const visuals = preparation.visualSnapshot;
      if (visuals) {
        current.character = { ...current.character, ...visuals.character };
        current.dye = visuals.dye || current.dye;
        if (Array.isArray(visuals.appearanceIds))
          current.items = Object.fromEntries(
            GearData.slots.map((slot, index) => [
              slot.id,
              current.items[slot.id]
                ? GearData.items.find(
                    (item) =>
                      item.id === visuals.appearanceIds[index] &&
                      item.slot === current.items[slot.id].slot,
                  ) || current.items[slot.id]
                : null,
            ]),
          );
      }
    }
    return current;
  }
  function recolor(rig, state) {
    const color = (name, id) =>
      PALETTES[name].find((p) => p.id === id) || PALETTES[name][0];
    rig.style.setProperty(
      "--hair",
      color("hair", state.character.hairColor).color,
    );
    rig.style.setProperty("--eyes", color("eyes", state.character.eyes).color);
    const skin = color("skin", state.character.skin);
    for (const [key, value] of Object.entries({
      skin: skin.color,
      "skin-light": skin.light,
      "skin-shadow": skin.shadow,
    }))
      rig.style.setProperty("--" + key, value);
    const torso = rig.querySelector('[data-layer="torso"]');
    if (torso) torso.style.setProperty("--dye", color("dye", state.dye).color);
  }
  function copy(source, prefix) {
    const fragment = document.createDocumentFragment(),
      root = source.cloneNode(true),
      ids = new Map();
    root.querySelectorAll("[id]").forEach((node) => {
      ids.set(node.id, prefix + node.id);
      node.id = prefix + node.id;
    });
    root.querySelectorAll("*").forEach((node) => {
      for (const attr of [...node.attributes]) {
        let value = attr.value;
        for (const [old, id] of ids)
          value = value.split("url(#" + old + ")").join("url(#" + id + ")");
        if (value !== attr.value) node.setAttribute(attr.name, value);
      }
    });
    while (root.firstChild) fragment.append(root.firstChild);
    return fragment;
  }
  function create(svg, provider = model) {
    svg.setAttribute("viewBox", "0 0 360 640");
    svg.classList.add("visual-character");
    let rig = svg.querySelector("#rig") || document.createElementNS(NS, "g");
    if (!rig.parentNode) svg.append(rig);
    rig.textContent = "";
    rig.classList.add("visual-rig");
    const prefix = "visual-" + ++serial + "-",
      groups = {},
      revisions = {},
      diagnostics = new Map();
    let pending = Promise.resolve(),
      renderRevision = 0;
    for (const layer of VisualManifest.layers) {
      const group = document.createElementNS(NS, "g");
      group.dataset.layer = layer;
      group.classList.add("layer");
      groups[layer] = group;
      rig.append(group);
    }
    function updateDebugAttribute() {
      if (diagnostics.size && typeof Equipment !== "undefined" && Equipment.testMode)
        svg.setAttribute(
          "data-visual-debug",
          JSON.stringify([...diagnostics.values()]),
        );
      else svg.removeAttribute("data-visual-debug");
    }
    async function replace(layer, id) {
      const group = groups[layer],
        revision = (revisions[layer] || 0) + 1;
      revisions[layer] = revision;
      if (!id) {
        group.replaceChildren();
        group.dataset.selection = "empty";
        group.dataset.asset = "";
        diagnostics.delete(layer);
        group.dataset.fallback = "false";
        updateDebugAttribute();
        return;
      }
      let actual = id,
        source,
        failure;
      try {
        source = await load(id);
      } catch (error) {
        failure = { layer, missing: id, message: error.message };
        actual = VisualManifest.fallback[layer];
        if (actual && actual !== id)
          try {
            source = await load(actual);
          } catch (_) {}
      }
      if (revisions[layer] !== revision) return;
      if (failure) diagnostics.set(layer, failure);
      else diagnostics.delete(layer);
      if (source)
        group.replaceChildren(
          copy(source, prefix + layer.replace(/\W/g, "") + "-"),
        );
      else if (!group.childElementCount) group.replaceChildren();
      group.dataset.asset = actual || "";
      group.dataset.selection = id;
      group.dataset.fallback = String(actual !== id || !source);
      if (actual !== id || !source) group.dataset.quality = "placeholder";
      updateDebugAttribute();
    }
    function render(state = provider()) {
      const revision = ++renderRevision;
      const selected = VisualManifest.resolve(state),
        work = [];
      for (const layer of VisualManifest.layers) {
        const id = selected[layer],
          slot = layer === "weapon" ? "mainHand" : layer;
        groups[layer].dataset.item = id
          ? state.items[slot]?.id ||
            (layer.startsWith("hair-")
              ? state.character.hair
              : layer === "face"
                ? state.character.face
                : id)
          : "empty";
        groups[layer].dataset.quality =
          state.items[slot] && !VisualManifest.itemVisuals[state.items[slot].id]
            ? "placeholder"
            : VisualManifest.assets[id]?.quality || "empty";
        if (groups[layer].dataset.selection !== (id || "empty"))
          work.push(replace(layer, id));
      }
      recolor(rig, state);
      pending = Promise.all(work).then(() => {
        if (revision === renderRevision) recolor(rig, state);
      });
      return pending;
    }
    const instance = {
      svg,
      render,
      ready: () => pending,
      diagnostics: () => [...diagnostics.values()],
      destroy() {
        instances.delete(instance);
      },
    };
    instances.add(instance);
    render();
    return instance;
  }
  function svg(label) {
    const element = document.createElementNS(NS, "svg");
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", label || "Personaggio equipaggiato");
    return element;
  }
  return {
    create,
    svg,
    model,
    snapshot,
    ready: () => Promise.all([...instances].map((i) => i.ready())),
    cache,
    diagnostics: () =>
      [...instances].flatMap((instance) =>
        instance
          .diagnostics()
          .map((row) => ({ ...row, actor: instance.svg.id || "encounter" })),
      ),
  };
})();
