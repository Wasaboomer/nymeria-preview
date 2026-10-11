/* M5 integration: timestamp lifecycle + real Equipment/Class/Combat modules. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const Data = require("../progression-data"),
  Storage = require("../progression-store"),
  Lifecycle = require("../progression-system");
function fixture({
  memory = new Map(),
  clock = { value: 100000 },
  testMode = false,
  denyWrite = false,
  classFixture = null,
} = {}) {
  const storage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => {
      if (denyWrite) throw new Error("full storage");
      memory.set(key, value);
    },
  };
  const store = Storage.create({ storage });
  const context = vm.createContext({
    localStorage: storage,
    ProgressionStore: store,
    ProgressionData: Data,
    URLSearchParams,
    location: { search: testMode ? "?test=1" : "" },
  });
  for (const file of [
    "combat-data",
    "classes-data",
    "armor-rules",
    "build-system",
    "class-system",
    "items",
    "equipment-data",
    "equipment",
  ]) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "..", file + ".js"), "utf8"),
      context,
    );
    if (file === "classes-data" && classFixture) vm.runInContext(classFixture, context);
  }
  const equipment = vm.runInContext("Equipment", context),
    classes = vm.runInContext("ClassSystem", context),
    catalogue = JSON.parse(
      vm.runInContext("JSON.stringify(GearData.items)", context),
    );
  let settings = null;
  const system = Lifecycle.create({
    store,
    equipment,
    classes,
    catalogue,
    now: () => clock.value,
    random: () => 0.42,
    combatSettings: () => settings,
    testMode,
  });
  store.subscribe(() => equipment.reconcileProgression());
  const kit = (cls = "hunter", build) => {
    classes.selectClass(cls);
    if (build) classes.selectBuild(build);
    for (const [slot, id] of Object.entries(
      cls === "hunter"
        ? { torso: "torso-chain", legs: "legs-chain", boots: "boots-chain" }
        : {
            torso: "torso-warden",
            legs: "legs-sentinel",
            boots: "boots-plate",
          },
    ))
      equipment.equip(id, slot);
    equipment.equip(cls === "hunter" ? "bow" : "sword", "mainHand");
    equipment.equip(cls === "hunter" ? "quiver" : "shield", "support");
  };
  const level = async (value) => {
    await store.transact((s) => {
      s.totalXP = Data.thresholds[value - 1];
      return { ok: true };
    });
  };
  const finish = async (id = "patrol", seed = 1) => {
    assert.ok((await system.start(id, { seed })).ok);
    clock.value = store.state.activeExpedition.endsAt;
    assert.ok((await system.refresh()).ok);
    return store.state.pendingExpeditionResult;
  };
  return {
    memory,
    clock,
    store,
    system,
    equipment,
    classes,
    catalogue,
    kit,
    level,
    finish,
    run: (code) => vm.runInContext(code, context),
    read: (expression) =>
      JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context)),
    setSettings: (value) => (settings = value),
  };
}
module.exports = fixture;
