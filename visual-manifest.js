/* Art metadata only. Equipment owns inventory, compatibility, stats and glamour. */
const VisualManifest = (() => {
  const rig = {
    id: "human-adult-v1",
    canvas: [360, 640],
    anchors: {
      head: [180, 80],
      neck: [180, 135],
      waist: [180, 285],
      leftHand: [109, 330],
      rightHand: [259, 320],
      feet: [180, 602],
    },
  };
  const layers = [
    "cloak",
    "hair-back",
    "body / skin",
    "ears",
    "underclothes",
    "legs",
    "boots",
    "torso",
    "arms/gloves",
    "gloves",
    "belt",
    "shoulders",
    "face",
    "eyes",
    "hair-front",
    "head",
    "necklace",
    "earLeft",
    "earRight",
    "braceletLeft",
    "braceletRight",
    "ringLeft",
    "ringRight",
    "support",
    "weapon",
    "FX",
  ];
  const assets = {},
    itemVisuals = {};
  function asset(id, layer, options = {}) {
    assets[id] = {
      id,
      layer,
      file: `assets/character/${id}.svg`,
      compatibleRig: rig.id,
      compatibleBody: "human-adult",
      classCompatibility: [],
      equipmentItems: [],
      hideRules: [],
      zOrder: layers.indexOf(layer),
      quality: "vertical-slice",
      ...options,
    };
    return id;
  }
  const base = {
    underclothes: asset("underclothes", "underclothes"),
    "body / skin": asset("body", "body / skin"),
    ears: asset("ears", "ears"),
    "arms/gloves": asset("arms", "arms/gloves"),
    legs: asset("base-legs", "legs"),
    boots: asset("base-boots", "boots"),
    torso: asset("base-torso", "torso"),
    eyes: asset("eyes", "eyes"),
  };
  const creator =
    typeof module !== "undefined" && module.exports
      ? require("./items.js").ITEMS
      : ITEMS;
  const faces = creator.face;
  for (const face of faces) asset(`face-${face.id}`, "face");
  const hairstyles = creator.hair.map(({ id, name, detail }) => ({
    id,
    name,
    detail,
  }));
  for (const hair of hairstyles)
    for (const part of ["back", "front"])
      asset(`hair-${hair.id}-${part}`, `hair-${part}`);
  function link(item, ids) {
    itemVisuals[item] = ids;
    for (const id of ids) assets[id].equipmentItems.push(item);
  }
  for (const [set, cls, items] of [
    [
      "plate-a",
      "warden",
      {
        torso: "torso-warden",
        legs: "legs-sentinel",
        boots: "boots-plate",
        gloves: "gloves-iron",
        helmet: "head-helm",
      },
    ],
    [
      "plate-b",
      "warden",
      {
        torso: "torso-vesper",
        legs: "legs-vesper",
        boots: "boots-vesper",
        gloves: "gloves-vesper",
        helmet: "head-vesper",
      },
    ],
    [
      "mail-a",
      "hunter",
      {
        torso: "torso-chain",
        legs: "legs-chain",
        boots: "boots-chain",
        gloves: "gloves-chain",
        helmet: "head-chain",
      },
    ],
  ]) {
    for (const [part, item] of Object.entries(items)) {
      const layer = part === "helmet" ? "head" : part;
      asset(`${set}-${part}`, layer, {
        classCompatibility: [cls],
        quality: set.startsWith("plate-") ? "proxy" : "vertical-slice",
        hideRules:
          set.startsWith("plate-") && part === "helmet"
            ? ["hair-front", "hair-back", "face", "eyes", "ears"]
            : [],
      });
      const ids = [`${set}-${part}`];
      if (part === "torso")
        ids.push(
          asset(`${set}-shoulders`, "shoulders", {
            classCompatibility: [cls],
            quality: set.startsWith("plate-") ? "proxy" : "vertical-slice",
          }),
        );
      link(item, ids);
    }
  }
  for (const [id, layer, item] of [
    ["belt-a", "belt", "belt-gold"],
    ["belt-b", "belt", "belt-rope"],
    ["cloak-a", "cloak", "cloak-dusk"],
    ["cloak-b", "cloak", "cloak-pilgrim"],
    ["sword-a", "weapon", "sword"],
    ["sword-b", "weapon", "vesper-sword"],
    ["shield-a", "support", "shield"],
    ["shield-b", "support", "vesper-shield"],
    ["bow-a", "weapon", "bow"],
    ["quiver-a", "support", "quiver"],
  ]) {
    asset(id, layer, {
      quality: /^(belt|sword|shield)-/.test(id) ? "proxy" : "vertical-slice",
    });
    link(item, [id]);
  }
  for (const [id, layer] of [
    ["body-fallback", "body / skin"],
    ["staff", "weapon"],
    ["greatsword", "weapon"],
    ["head-fallback", "head"],
    ["support-fallback", "support"],
    ["necklace", "necklace"],
    ["ear-left", "earLeft"],
    ["ear-right", "earRight"],
    ["bracelet-left", "braceletLeft"],
    ["bracelet-right", "braceletRight"],
    ["ring-left", "ringLeft"],
    ["ring-right", "ringRight"],
  ])
    asset(id, layer, { quality: "placeholder" });
  const slotLayers = { mainHand: "weapon", head: "head", support: "support" };
  const fallback = {
    ...base,
    "hair-front": "hair-veil-front",
    "hair-back": "hair-veil-back",
    face: "face-calm",
    "body / skin": "body-fallback",
    head: "head-fallback",
    weapon: "staff",
    support: "support-fallback",
    gloves: "mail-a-gloves",
    belt: "belt-b",
    cloak: "cloak-b",
    necklace: "necklace",
    earLeft: "ear-left",
    earRight: "ear-right",
    braceletLeft: "bracelet-left",
    braceletRight: "bracelet-right",
    ringLeft: "ring-left",
    ringRight: "ring-right",
    shoulders: "mail-a-shoulders",
  };
  function forItem(item, slot) {
    if (!item || item.appearance?.unavailable) return [];
    if (itemVisuals[item.id]) return itemVisuals[item.id];
    const layer = slotLayers[slot] || slot;
    // Material fallback is deliberately labelled prototype art, never changes stats.
    if (["torso", "legs", "boots", "gloves", "head"].includes(layer))
      return [
        `${item.armorType === "plate" ? "plate-a" : "mail-a"}-${layer === "head" ? "helmet" : layer}`,
        ...(layer === "torso"
          ? [`${item.armorType === "plate" ? "plate-a" : "mail-a"}-shoulders`]
          : []),
      ];
    if (layer === "weapon")
      return [
        {
          sword: "sword-a",
          bow: "bow-a",
          greatsword: "greatsword",
          spear: "staff",
          staff: "staff",
        }[item.weaponType] || "staff",
      ];
    if (layer === "support")
      return [
        (item.supportType || item.type) === "shield"
          ? "shield-a"
          : (item.supportType || item.type) === "quiver"
            ? "quiver-a"
            : "support-fallback",
      ];
    return fallback[layer] ? [fallback[layer]] : [];
  }
  function resolve(model) {
    const result = {
      ...base,
      face: `face-${model.character.face || "calm"}`,
      "hair-back": `hair-${model.character.hair || "veil"}-back`,
      "hair-front": `hair-${model.character.hair || "veil"}-front`,
    };
    const mapped = [];
    for (const [slot, item] of Object.entries(model.items))
      for (const id of forItem(item, slot)) {
        const entry = assets[id];
        result[entry.layer] = id;
        mapped.push(entry);
      }
    for (const entry of mapped)
      for (const layer of entry.hideRules) delete result[layer];
    // Actual handedness, not a glamour asset, determines support occupancy.
    if (model.twoHanded) delete result.support;
    return result;
  }
  const enemies = {
    "vesper-raider": "raider",
    "corrupt-hound": "hound",
    "elar-sentinel": "sentinel",
    "twilight-stag": "stag",
  };
  const mapNodes = {
    veyra: [24, 88],
    "broken-path": [71, 73],
    "lantern-wood": [27, 57],
    "elar-ruins": [73, 42],
    "vesper-ford": [30, 25],
    "silent-tower": [73, 10],
  };
  return {
    rig,
    layers,
    assets,
    base,
    fallback,
    itemVisuals,
    hairstyles,
    faces,
    forItem,
    resolve,
    enemies,
    mapNodes,
  };
})();
if (typeof module !== "undefined" && module.exports)
  module.exports = VisualManifest;
