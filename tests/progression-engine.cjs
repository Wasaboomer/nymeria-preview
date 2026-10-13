/* M5 integration: timestamp lifecycle + real Equipment/Class/Combat modules. */
const assert = require("node:assert/strict");
const Data = require("../progression-data"),
  Storage = require("../progression-store"),
  Expeditions = require("../expedition-engine"),
  Activities = require("../expedition-data"),
  Combat = require("../combat-engine");
const fixture = require("./character-fixture.cjs");
let checks = 0;
async function check(name, test) {
  await test();
  checks++;
  console.log("PASS " + name);
}
(async () => {
  await check(
    "central XP curve, exact boundaries, multiple levels, cap and excess",
    () => {
      assert.equal(Data.requiredXP(1), 80);
      assert.equal(Data.requiredXP(4), 520);
      assert.equal(Data.fromTotal(79).level, 1);
      assert.equal(Data.fromTotal(80).level, 2);
      assert.equal(Data.fromTotal(637).level, 4);
      assert.equal(Data.fromTotal(637 + 340).currentXP, 340);
      const capped = Data.fromTotal(Data.thresholds[19] + 999);
      assert.equal(capped.level, 20);
      assert.equal(capped.currentXP, 0);
      assert.equal(capped.requiredXP, 0);
      assert.equal(capped.overflowXP, 999);
      assert.equal(capped.totalXP, Data.thresholds[19] + 999);
      assert.equal(Data.fromTotal(-999).totalXP, 0);
    },
  );
  await check(
    "level-10 real base stats, HP and combat improve with identical gear",
    async () => {
      const f = fixture();
      f.kit();
      const before = f.system.snapshot();
      await f.level(10);
      const after = f.system.snapshot();
      assert.deepEqual(after.gearIds, before.gearIds);
      for (const key of ["agility", "vigor", "critical"])
        assert.ok(after.stats[key] > before.stats[key]);
      const low = Combat.create({ ...before, seed: 1 }),
        high = Combat.create({ ...after, seed: 1 });
      assert.ok(high.player.maxHp > low.player.maxHp);
      low.start();
      high.start();
      low.advance(180);
      high.advance(180);
      assert.ok(high.result.duration < low.result.duration);
      assert.ok(high.result.dps > low.result.dps);
      assert.equal(after.stats.force - before.stats.force, 0);
      assert.equal(after.stats.agility - before.stats.agility, 27);
      assert.equal(after.stats.vigor - before.stats.vigor, 9);
      assert.equal(after.stats.spirit - before.stats.spirit, 0);
    },
  );
  await check(
    "start requires real kit/level; only one active expedition or unclaimed result",
    async () => {
      const f = fixture();
      assert.equal((await f.system.start("patrol")).ok, false);
      f.kit();
      assert.equal((await f.system.start("broken-trail")).ok, false);
      assert.ok((await f.system.start("patrol", { seed: 1 })).ok);
      const saved = f.store.state.activeExpedition;
      assert.equal(saved.endsAt - saved.startedAt, 60000);
      assert.equal(saved.snapshot.level, 1);
      assert.ok(saved.snapshot.profile.kitValid);
      assert.equal((await f.system.start("patrol")).ok, false);
      f.clock.value = saved.endsAt;
      await f.system.refresh();
      assert.equal((await f.system.start("patrol")).ok, false);
    },
  );
  await check(
    "timestamps survive full close/reopen; offline completion deterministic, rewards await claim",
    async () => {
      const f = fixture();
      f.kit();
      await f.system.start("patrol", { seed: 1 });
      const active = f.store.state.activeExpedition;
      f.clock.value += 30000;
      const halfway = fixture({ memory: f.memory, clock: f.clock });
      assert.deepEqual(halfway.store.state.activeExpedition, active);
      assert.equal(halfway.store.state.pendingExpeditionResult, null);
      f.clock.value += 1200000;
      const returned = fixture({ memory: f.memory, clock: f.clock });
      await returned.system.refresh();
      const result = returned.store.state.pendingExpeditionResult;
      assert.deepEqual(
        { ...result, completedAt: undefined },
        { ...Expeditions.resolve(active), completedAt: undefined },
      );
      assert.equal(returned.store.state.totalXP, 0);
      assert.equal(returned.store.state.crowns, 0);
      const second = fixture({ memory: f.memory, clock: f.clock });
      await second.system.refresh();
      assert.deepEqual(second.store.state.pendingExpeditionResult, result);
    },
  );
  await check(
    "success awards XP, level-up, Corone and all materials exactly once; loot not auto-equipped",
    async () => {
      const f = fixture();
      f.kit();
      const gear = f.read("Equipment.state.equipment"),
        report = await f.finish();
      assert.ok(report.success);
      assert.ok(report.rewards.lootIds.length);
      assert.ok((await f.system.claim(report.id)).ok);
      const state = f.store.state;
      assert.equal(state.level, 2);
      assert.equal(state.totalXP, report.rewards.xp);
      assert.equal(state.crowns, report.rewards.crowns);
      for (const key of ["iron", "fiber", "ether"])
        assert.ok(state.materials[key] > 0);
      assert.equal(f.equipment.state.character.level, 2);
      assert.deepEqual(f.read("Equipment.state.equipment"), gear);
      assert.ok(
        f.equipment.state.inventory.some(
          (i) => i.id === report.rewards.lootIds[0],
        ),
      );
      const repeated = await Promise.all([
        f.system.claim(report.id),
        f.system.claim(report.id),
      ]);
      assert.ok(repeated.every((r) => !r.ok));
      assert.deepEqual(f.store.state, state);
      const reload = fixture({ memory: f.memory, clock: f.clock });
      assert.equal((await reload.system.claim(report.id)).ok, false);
      assert.deepEqual(reload.store.state, state);
      assert.equal(reload.equipment.state.character.level, 2);
    },
  );
  await check(
    "multi-level claim and level cap retain excess total XP",
    async () => {
      const f = fixture();
      f.kit();
      const report = await f.finish();
      await f.store.transact((s) => {
        s.pendingExpeditionResult.rewards.xp = Data.thresholds[9] + 10;
        return { ok: true };
      });
      const claimed = await f.system.claim(report.id);
      assert.deepEqual(claimed.levelUps, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
      assert.equal(f.store.state.currentXP, 10);
      assert.equal(f.equipment.state.character.level, 10);
      const next = await f.finish();
      await f.store.transact((s) => {
        s.pendingExpeditionResult.rewards.xp = Data.thresholds[19] + 999;
        return { ok: true };
      });
      await f.system.claim(next.id);
      assert.equal(f.store.state.level, 20);
      assert.ok(f.store.state.overflowXP > 999);
      assert.equal(f.store.state.currentXP, 0);
    },
  );
  await check(
    "failure returns actual partial XP, no completion bonus and no lost equipment",
    async () => {
      const f = fixture();
      f.kit();
      await f.level(5);
      const gear = f.read("Equipment.state.equipment"),
        before = f.store.state.totalXP,
        report = await f.finish("recon", 1);
      assert.equal(report.success, false);
      assert.ok(report.completed > 0 && report.completed < report.total);
      assert.equal(report.rewards.xp, report.completed * 45);
      assert.ok(report.encounters.at(-1).outcome === "defeat");
      await f.system.claim(report.id);
      assert.equal(f.store.state.totalXP, before + report.rewards.xp);
      assert.deepEqual(f.read("Equipment.state.equipment"), gear);
    },
  );
  await check(
    "poor custom strategy times out with no free XP; manual combat remains separate",
    async () => {
      const f = fixture();
      f.kit();
      const profile = f.system.snapshot().profile;
      f.setSettings({
        mode: "custom",
        rules: profile.abilities.map((a) => ({
          abilityId: a.id,
          condition: { type: "playerHpBelow", threshold: 1 },
        })),
      });
      const report = await f.finish();
      assert.equal(report.success, false);
      assert.equal(report.completed, 0);
      assert.equal(report.rewards.xp, 0);
      const manual = Combat.create({
        ...f.system.snapshot(),
        rules: profile.defaultRules,
        seed: 1,
      });
      manual.start();
      manual.advance(2);
      assert.equal(manual.status, "running");
      assert.ok(manual.metrics.damage > 0);
    },
  );
  await check(
    "cancellation before deadline grants nothing and preserves gear; completed expedition cannot be cancelled",
    async () => {
      const f = fixture();
      f.kit();
      const before = f.store.state,
        gear = f.read("Equipment.state.equipment");
      await f.system.start("patrol", { seed: 1 });
      f.clock.value += 30000;
      assert.ok((await f.system.cancel()).ok);
      assert.equal(f.store.state.totalXP, before.totalXP);
      assert.equal(f.store.state.crowns, 0);
      assert.equal(f.store.state.pendingExpeditionResult, null);
      assert.deepEqual(f.read("Equipment.state.equipment"), gear);
      await f.system.start("patrol");
      f.clock.value = f.store.state.activeExpedition.endsAt;
      assert.equal((await f.system.cancel()).ok, false);
      await f.system.refresh();
      assert.ok(f.store.state.pendingExpeditionResult);
    },
  );
  await check(
    "snapshot fixes class/build/stats/gear/strategy for the whole expedition",
    async () => {
      const f = fixture();
      f.kit("hunter", "lacerator");
      await f.system.start("patrol", { seed: 1 });
      const active = f.store.state.activeExpedition,
        expected = Expeditions.resolve(active);
      f.kit("warden", "retaliation");
      f.equipment.equip("ring-sun", "ringLeft");
      assert.deepEqual(f.store.state.activeExpedition, active);
      f.clock.value = active.endsAt;
      await f.system.refresh();
      const result = f.store.state.pendingExpeditionResult;
      assert.equal(result.className, "Cacciatore");
      assert.equal(result.buildName, "Laceratore");
      assert.deepEqual(result.rewards, expected.rewards);
      assert.deepEqual(result.encounters, expected.encounters);
    },
  );
  await check(
    "class/build and gear influence outcomes, not just descriptive difficulty",
    async () => {
      const f = fixture();
      await f.level(5);
      f.kit("hunter", "predator");
      const a = Expeditions.resolve({
        id: "a",
        activity: Activities.activity("recon"),
        snapshot: f.system.snapshot(),
        seed: 1,
        startedAt: 0,
        endsAt: 900000,
      });
      f.kit("warden", "bulwark");
      const b = Expeditions.resolve({
        id: "b",
        activity: Activities.activity("recon"),
        snapshot: f.system.snapshot(),
        seed: 1,
        startedAt: 0,
        endsAt: 900000,
      });
      assert.equal(a.success, false);
      assert.equal(b.success, true);
      f.kit("hunter", "lacerator");
      const c = Expeditions.resolve({
        id: "c",
        activity: Activities.activity("recon"),
        snapshot: f.system.snapshot(),
        seed: 1,
        startedAt: 0,
        endsAt: 900000,
      });
      assert.notDeepEqual(a.encounters, c.encounters);
      const original = f.system.snapshot();
      for (const slot of ["torso", "legs", "boots", "cloak"])
        f.equipment.unequip(slot);
      const poor = Expeditions.resolve({
        id: "p",
        activity: Activities.activity("recon"),
        snapshot: f.system.snapshot(),
        seed: 1,
        startedAt: 0,
        endsAt: 900000,
      });
      assert.ok(poor.completed < a.completed);
      const strong = Combat.create({ ...original, seed: 1 }),
        weak = Combat.create({ ...f.system.snapshot(), seed: 1 });
      assert.ok(strong.player.maxHp > weak.player.maxHp);
    },
  );
  await check(
    "six data-driven events produce XP/currency/materials/extra encounter/difficulty/loot changes",
    async () => {
      const f = fixture();
      f.kit();
      await f.level(20);
      const snapshot = f.system.snapshot();
      const activity = {
        ...Activities.activity("patrol"),
        encounters: 1,
        eventChance: 1,
        lootChance: 0,
        finalLootChance: 0,
      };
      const outputs = {};
      for (const event of Activities.events) {
        outputs[event.id] = Expeditions.resolve({
          id: "event",
          activity,
          snapshot,
          seed: 1,
          eventDefinitions: [event],
          startedAt: 0,
          endsAt: 60000,
        });
        assert.equal(outputs[event.id].events[0].name, event.name);
        assert.ok(outputs[event.id].success);
      }
      assert.equal(
        outputs.merchant.rewards.crowns,
        activity.crownsPerEncounter + activity.completionCrowns + 7,
      );
      assert.equal(outputs.altar.rewards.xp, Math.round(18 * 1.2) + 36);
      assert.equal(outputs["hidden-path"].rewards.materials.fiber, 2);
      assert.equal(outputs["ancient-ruin"].rewards.materials.ether, 2);
      assert.equal(outputs["wounded-creature"].rewards.materials.iron, 3);
      assert.equal(outputs.ambush.total, 2);
      assert.ok(
        outputs["wounded-creature"].encounters[0].damage <
          outputs.altar.encounters[0].damage,
      );
      let found = false;
      for (let seed = 1; seed <= 60; seed++) {
        const r = Expeditions.resolve({
          id: "loot",
          activity,
          snapshot,
          seed,
          eventDefinitions: [
            Activities.events.find((e) => e.id === "hidden-path"),
          ],
          startedAt: 0,
          endsAt: 60000,
        });
        if (r.rewards.lootIds.length) {
          found = true;
          break;
        }
      }
      assert.ok(found);
    },
  );
  await check(
    "unlock thresholds derive from persistent XP: levels 1/3/5/8",
    async () => {
      const f = fixture();
      for (const [lvl, expected] of [
        [1, ["patrol"]],
        [3, ["patrol", "broken-trail"]],
        [5, ["patrol", "broken-trail", "recon"]],
        [8, ["patrol", "broken-trail", "recon", "vigil"]],
      ]) {
        await f.level(lvl);
        assert.deepEqual(f.store.state.unlockedContent.filter(id => !id.startsWith("world:")), expected);
        assert.equal(f.equipment.state.character.level, lvl);
      }
    },
  );
  await check(
    "loot advisor, required level, equip/render metadata, persistence and duplicate conversion",
    async () => {
      const f = fixture();
      f.kit();
      const report = await f.finish();
      await f.system.claim(report.id);
      const id = report.rewards.lootIds[0];
      assert.equal(id, "moon-boots");
      assert.equal(f.equipment.equip(id, "boots").ok, true);
      assert.equal(f.equipment.appearance("boots").appearance.asset, "soft");
      const reloaded = fixture({ memory: f.memory, clock: f.clock });
      assert.equal(reloaded.equipment.equipped("boots").id, id);
      assert.ok(reloaded.equipment.state.inventory.some((i) => i.id === id));
      const next = await f.finish("patrol", 1);
      await f.store.transact((s) => {
        s.pendingExpeditionResult.rewards.lootIds = [id];
        return { ok: true };
      });
      const iron = f.store.state.materials.iron;
      const result = await f.system.claim(next.id);
      assert.equal(result.loot[0].duplicate, true);
      assert.equal(
        f.store.state.materials.iron,
        iron + next.rewards.materials.iron + 2,
      );
      assert.equal(
        f.equipment.state.inventory.filter((i) => i.id === id).length,
        1,
      );
      const candidate = f.catalogue.find((i) => i.id === "frontier-ring");
      const advice = f.run(
        `BuildSystem.advise(GearData.items.find(i=>i.id==='frontier-ring'),'ringLeft','hunter','predator',Equipment,{includeCandidate:true})`,
      );
      assert.equal(advice.improvement, true);
      assert.equal(advice.bestOwned, true);
      assert.match(
        f.equipment.canEquipCandidate(
          f.catalogue.find((i) => i.id === "lunar-bow"),
          "mainHand",
        ),
        /livello 5/,
      );
      const xp = f.store.state.totalXP;
      f.equipment.reset();
      assert.equal(f.store.state.totalXP, xp);
      assert.ok(f.equipment.state.inventory.some((i) => i.id === id));
      assert.equal(f.equipment.state.character.level, f.store.state.level);
    },
  );
  await check(
    "canonical progression recovers loot/level if secondary equipment save was interrupted",
    async () => {
      const f = fixture();
      f.kit();
      const oldEquipment = f.memory.get("nymeria.equipment.v1");
      const report = await f.finish();
      await f.system.claim(report.id);
      f.memory.set("nymeria.equipment.v1", oldEquipment);
      const restored = fixture({ memory: f.memory, clock: f.clock });
      assert.equal(restored.equipment.state.character.level, 2);
      assert.ok(
        restored.equipment.state.inventory.some(
          (i) => i.id === report.rewards.lootIds[0],
        ),
      );
      assert.equal((await restored.system.claim(report.id)).ok, false);
    },
  );
  await check(
    "failed persistence never applies start/claim rewards; retry is safe",
    async () => {
      const f = fixture();
      f.kit();
      const report = await f.finish();
      const blocked = fixture({
        memory: f.memory,
        clock: f.clock,
        denyWrite: true,
      });
      assert.equal((await blocked.system.claim(report.id)).ok, false);
      assert.equal(blocked.store.state.totalXP, 0);
      assert.ok(blocked.store.state.pendingExpeditionResult);
      const restored = fixture({ memory: f.memory, clock: f.clock });
      assert.ok((await restored.system.claim(report.id)).ok);
      assert.equal(restored.store.state.totalXP, report.rewards.xp);
      const startBlocked = fixture({ denyWrite: true });
      startBlocked.kit();
      assert.equal((await startBlocked.system.start("patrol")).ok, false);
      assert.equal(startBlocked.store.state.activeExpedition, null);
    },
  );
  await check(
    "M4 saves remain compatible; malformed progression blocks writes without overwriting data",
    async () => {
      const f = fixture();
      f.kit("warden", "command");
      f.equipment.equip("ring-sun", "ringRight");
      const gear = f.read("Equipment.state.equipment");
      f.memory.delete(Storage.KEY);
      const restored = fixture({ memory: f.memory });
      assert.equal(restored.store.state.level, 1);
      assert.equal(restored.classes.selected().id, "warden");
      assert.equal(restored.classes.build().id, "command");
      assert.deepEqual(restored.read("Equipment.state.equipment"), gear);
      assert.equal(restored.equipment.state.inventory.length, 56);
      const raw = {
        ...Storage.initial(),
        totalXP: 637 + 340,
        materials: { iron: -1, fiber: "bad", ether: 3 },
        unlockedContent: ["vigil"],
        activeExpedition: { id: "broken" },
        pendingExpeditionResult: {
          id: "bad",
          activityId: "patrol",
          rewards: {},
        },
        lastClaim: { id: "bad" },
      };
      f.memory.set(Storage.KEY, JSON.stringify(raw));
      const recovered = fixture({ memory: f.memory });
      assert.ok(recovered.store.error);
      const originalBytes = f.memory.get(Storage.KEY);
      const rejected = await recovered.store.transact(state => {state.crowns++;return {ok:true};});
      assert.equal(rejected.ok,false);
      assert.equal(f.memory.get(Storage.KEY),originalBytes);

    },
  );
  await check(
    "Test Mode early completion is explicit; normal runs cannot be accelerated",
    async () => {
      const normal = fixture();
      normal.kit();
      await normal.system.start("patrol", { seed: 1 });
      assert.equal((await normal.system.debugComplete()).ok, false);
      assert.ok(normal.store.state.activeExpedition);
      assert.equal(normal.store.state.pendingExpeditionResult, null);
      const test = fixture({ testMode: true });
      test.kit();
      await test.system.start("patrol", { seed: 1 });
      const active = test.store.state.activeExpedition;
      assert.ok(active.testMode);
      assert.equal(active.endsAt - active.startedAt, 60000);
      assert.ok((await test.system.debugComplete()).ok);
      assert.ok(test.store.state.pendingExpeditionResult.testMode);
      const returned = fixture({
        memory: normal.memory,
        clock: normal.clock,
        testMode: true,
      });
      assert.equal((await returned.system.debugComplete()).ok, false);
    },
  );
  await check(
    "clock rollback grants nothing; days offline still resolve only bounded encounters",
    async () => {
      const f = fixture();
      f.kit();
      await f.system.start("patrol", { seed: 1 });
      f.clock.value -= 50000;
      await f.system.refresh();
      assert.ok(f.store.state.activeExpedition);
      assert.equal(f.store.state.totalXP, 0);
      f.clock.value += 86400000 * 30;
      await f.system.refresh();
      const report = f.store.state.pendingExpeditionResult;
      assert.equal(report.encounters.length, 4);
      assert.equal(report.durationMs, 60000);
    },
  );
  console.log(`${checks} M5 progression/expedition integration checks passed.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
