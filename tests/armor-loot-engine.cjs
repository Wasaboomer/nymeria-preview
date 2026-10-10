/* Armor rules use the real Equipment, Class, Advisor, persistence and expedition modules. */
const assert = require("node:assert/strict");
const fixture = require("./character-fixture.cjs");
const Gear = require("../equipment-data");
const Armor = require("../armor-rules");
const Personal = require("../personal-loot");
const Storage = require("../progression-store");
const Expeditions = require("../expedition-engine");
let checks = 0;
async function check(name, test) {
  await test();
  checks++;
  console.log("PASS " + name);
}
(async () => {
  await check(
    "all wearable slots explicitly declare one of four coherent armor materials",
    () => {
      for (const item of Gear.items)
        if (Armor.isArmor(item))
          assert.ok(Armor.types.includes(item.armorType), item.id);
      assert.equal(
        Gear.items.find((i) => i.id === "torso-oracle").armorType,
        "cloth",
      );
      assert.equal(
        Gear.items.find((i) => i.id === "legs-ranger").armorType,
        "leather",
      );
      for (const type of ["mail", "plate"])
        for (const slot of Armor.slots)
          assert.ok(
            Gear.items.some(
              (i) =>
                i.slot === slot && i.armorType === type && !i.expeditionOnly,
            ),
          );
      assert.ok(
        Gear.items
          .filter((i) =>
            ["bracelet", "ring", "cloak", "belt", "weapon", "support"].includes(
              i.slot,
            ),
          )
          .every((i) => !i.armorType),
      );
    },
  );
  for (const [cls, allowed] of [
    ["warden", "plate"],
    ["hunter", "mail"],
  ]) {
    for (const type of Armor.types)
      await check(
        `${cls} ${type}: enforce proficiency, rejected item retained`,
        () => {
          const f = fixture();
          f.kit(cls);
          assert.equal(f.classes.selected().armorProficiency, allowed);
          const item = f.catalogue.find(
            (i) => i.armorType === type && !i.expeditionOnly,
          );
          const before = f.read("Equipment.state");
          const result = f.equipment.equip(item.id, item.slot);
          assert.equal(result.ok, type === allowed);
          if (type !== allowed) {
            assert.match(
              result.message,
              new RegExp(
                `${cls === "warden" ? "Custode" : "Cacciatore"}.*solamente armature ${Armor.labels[allowed]}`,
              ),
            );
            assert.deepEqual(f.read("Equipment.state"), before);
          } else assert.equal(f.equipment.equipped(item.slot).id, item.id);
          assert.ok(f.equipment.state.inventory.some((i) => i.id === item.id));
        },
      );
    await check(
      `${cls} Advisor ignores unusable high-score armor; bestOwned counts only usable`,
      () => {
        const f = fixture();
        f.kit(cls);
        const other = allowed === "plate" ? "mail" : "plate";
        f.run(
          `for(const item of Equipment.state.inventory) if(item.slot==='torso' && item.armorType!=='${allowed}') item.stats={force:99999,agility:99999,vigor:99999,spirit:99999,armor:99999}`,
        );
        const invalid = f.run(
          `BuildSystem.advise(Equipment.state.inventory.find(i=>i.slot==='torso'&&i.armorType==='${other}'),'torso','${cls}',ClassSystem.build().id,Equipment)`,
        );
        assert.equal(invalid, null);
        const valid = f.run(
          `BuildSystem.advise(Equipment.state.inventory.find(i=>i.slot==='torso'&&i.armorType==='${allowed}'),'torso','${cls}',ClassSystem.build().id,Equipment)`,
        );
        assert.equal(valid.bestOwned, true);
        for (const type of Armor.types.filter((t) => t !== allowed))
          assert.equal(
            f.run(
              `BuildSystem.scoreItemForBuild({slot:'torso',armorType:'${type}',stats:{force:999999}},'${cls}',ClassSystem.build().id)`,
            ),
            null,
          );
      },
    );
    await check(
      `${cls} universal jewelry remains equippable and advised`,
      () => {
        const f = fixture();
        f.kit(cls);
        assert.equal(f.equipment.equip("ring-sun", "ringLeft").ok, true);
        assert.ok(
          f.run(
            `BuildSystem.advise(Equipment.equipped('ringLeft'),'ringLeft','${cls}',ClassSystem.build().id,Equipment)`,
          ),
        );
      },
    );
    await check(
      `${cls} personal armor frozen at start despite class change before claim`,
      async () => {
        const f = fixture();
        f.kit(cls);
        await f.system.start("patrol", { seed: 1 });
        const active = f.store.state.activeExpedition;
        assert.equal(active.lootPolicy.kind, "personalLoot");
        assert.equal(active.lootPolicy.armorProficiency, allowed);
        f.kit(cls === "hunter" ? "warden" : "hunter");
        f.clock.value = active.endsAt;
        await f.system.refresh();
        const report = f.store.state.pendingExpeditionResult;
        const armorIds = report.rewards.lootIds.filter((id) =>
          Armor.isArmor(Gear.items.find((i) => i.id === id)),
        );
        assert.ok(armorIds.length, "seed produces real armor");
        for (const id of armorIds)
          assert.equal(Gear.items.find((i) => i.id === id).armorType, allowed);
        assert.ok((await f.system.claim(report.id)).ok);
        for (const id of armorIds) {
          assert.ok(f.equipment.state.inventory.some((i) => i.id === id));
          assert.equal(f.equipment.equip(id, "boots").ok, false);
        }
      },
    );
    await check(
      `${cls} personal weapons/supports/armor match saved preparation for all M5 activities`,
      async () => {
        const f = fixture();
        f.kit(cls);
        await f.level(20);
        for (const activity of require("../expedition-data").activities) {
          assert.ok((await f.system.start(activity.id, { seed: 1 })).ok);
          const active = f.store.state.activeExpedition;
          f.kit(cls === "hunter" ? "warden" : "hunter");
          const found = new Set();
          for (let seed = 1; seed <= 24; seed++) {
            const result = Expeditions.resolve({
              ...active,
              seed,
              activity: {
                ...active.activity,
                lootChance: 1,
                finalLootChance: 1,
              },
            });
            assert.ok(result.rewards.lootIds.length);
            for (const id of result.rewards.lootIds) {
              const item = Gear.items.find((i) => i.id === id);
              found.add(item.slot);
              assert.ok(Personal.compatible(item, active.lootPolicy), id);
              assert.ok(item.requiredLevel <= activity.requiredLevel, id);
            }
          }
          if (activity.id === "vigil")
            for (const slot of ["weapon", "support", "torso"])
              assert.ok(found.has(slot));
          if (activity.id === "patrol") assert.ok(found.has("ring"));
          assert.ok((await f.system.cancel()).ok);
          f.kit(cls);
        }
      },
    );
  }
  await check(
    "future Cloth/Leather class definitions use the same wearable rule",
    () => {
      for (const type of ["cloth", "leather"])
        assert.ok(
          Armor.compatible(
            { slot: "torso", armorType: type },
            { armorProficiency: type },
          ),
        );
    },
  );
  await check(
    "class switch removes incompatible worn armor but preserves all ownership and jewelry",
    () => {
      const f = fixture();
      f.kit("warden");
      f.equipment.equip("ring-sun", "ringLeft");
      const ids = f.equipment.state.inventory.map((i) => i.id);
      f.classes.selectClass("hunter");
      for (const slot of ["torso", "legs", "boots"])
        assert.equal(f.equipment.equipped(slot), null);
      assert.equal(f.equipment.equipped("ringLeft").id, "ring-sun");
      assert.deepEqual(
        f.equipment.state.inventory.map((i) => i.id),
        ids,
      );
    },
  );
  await check(
    "older Equipment save canonically gains armorType/Mail kit without losing incompatible items or appearance",
    () => {
      const f = fixture();
      f.kit("warden");
      const raw = f.read("Equipment.state");
      raw.inventory = raw.inventory.filter((i) => !i.demoMigration);
      raw.inventory.forEach((i) => delete i.armorType);
      raw.character.hair = "crest";
      f.memory.set("nymeria.equipment.v1", JSON.stringify(raw));
      f.memory.set(
        "nymeria.classes.v1",
        JSON.stringify({
          classId: "hunter",
          builds: { hunter: "lacerator", warden: "bulwark" },
        }),
      );
      // This fixture represents a pre-v2 save, not a stale legacy record beside
      // a newer authoritative selection created by the setup above.
      f.memory.delete("nymeria.classes.v2");
      const restored = fixture({ memory: f.memory });
      assert.equal(restored.equipment.state.character.hair, "crest");
      assert.equal(restored.classes.build().id, "lacerator");
      for (const id of raw.inventory.map((i) => i.id))
        assert.ok(restored.equipment.state.inventory.some((i) => i.id === id));
      assert.equal(restored.equipment.state.inventory.length, 56);
      assert.equal(restored.equipment.equipped("torso"), null);
      assert.ok(
        restored.equipment.state.inventory
          .filter(Armor.isArmor)
          .every((i) => Armor.types.includes(i.armorType)),
      );
    },
  );
  for (const cls of ["warden", "hunter"])
    await check(
      `${cls} old active snapshot migrates using saved class, not current class`,
      async () => {
        const f = fixture();
        f.kit(cls);
        await f.system.start("patrol", { seed: 1 });
        const raw = f.store.state;
        delete raw.activeExpedition.lootPolicy;
        const profile = raw.activeExpedition.snapshot.profile;
        for (const key of [
          "armorProficiency",
          "weaponTypes",
          "supportTypes",
          "handedness",
        ])
          delete profile[key];
        f.memory.set(Storage.KEY, JSON.stringify(raw));
        f.kit(cls === "hunter" ? "warden" : "hunter");
        const restored = fixture({ memory: f.memory, clock: f.clock });
        assert.equal(
          restored.store.state.activeExpedition.lootPolicy.classId,
          cls,
        );
        restored.clock.value = raw.activeExpedition.endsAt;
        await restored.system.refresh();
        const report = restored.store.state.pendingExpeditionResult;
        for (const id of report.rewards.lootIds)
          assert.ok(
            Personal.compatible(
              Gear.items.find((i) => i.id === id),
              report.lootPolicy,
            ),
          );
      },
    );
  await check(
    "legacy unclaimed report maps gear to saved class; claimed ownership/receipt never rerolled",
    async () => {
      const f = fixture();
      f.kit("warden");
      const report = await f.finish();
      const raw = f.store.state;
      delete raw.pendingExpeditionResult.lootPolicy;
      delete raw.pendingExpeditionResult.classId;
      raw.pendingExpeditionResult.rewards.lootIds = [
        "moon-boots",
        "frontier-ring",
        "ether-quiver",
      ];
      f.memory.set(Storage.KEY, JSON.stringify(raw));
      f.kit("hunter");
      const restored = fixture({ memory: f.memory, clock: f.clock });
      assert.deepEqual(
        restored.store.state.pendingExpeditionResult.rewards.lootIds,
        ["moon-sabatons", "frontier-ring", "ether-shield"],
      );
      assert.equal(
        restored.store.state.pendingExpeditionResult.rewards.xp,
        report.rewards.xp,
      );
      assert.ok((await restored.system.claim(report.id)).ok);
      const after = restored.store.state;
      const reload = fixture({ memory: f.memory });
      assert.deepEqual(reload.store.state.lastClaim, after.lastClaim);
      assert.deepEqual(reload.store.state.ownedLootIds, after.ownedLootIds);
      assert.equal((await reload.system.claim(report.id)).ok, false);
    },
  );
  console.log(
    `${checks} Armor Proficiency & Smart Loot integration checks passed.`,
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
