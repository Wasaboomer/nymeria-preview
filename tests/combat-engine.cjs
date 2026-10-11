/* Engine integration checks use the actual Equipment System as the stat source. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const Engine = require("../combat-engine.js");
const Data = require("../combat-data.js");
const checks = [];
function check(name, test) {
  test();
  checks.push(name);
  console.log("PASS " + name);
}
function equipmentBuild(thorn = false) {
  const context = vm.createContext({
    localStorage: { getItem: () => null, setItem() {} },
  });
  for (const file of ["combat-data.js", "classes-data.js", "items.js", "equipment-data.js", "equipment.js"])
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
      context,
    );
  vm.runInContext(
    `Equipment.equip('bow','mainHand');Equipment.equip('${thorn ? "thorn-quiver" : "quiver"}','support');`,
    context,
  );
  function read(expression) {
    return JSON.parse(
      vm.runInContext(`JSON.stringify(${expression})`, context),
    );
  }
  return {
    stats: read("Equipment.state.resultingStats"),
    effects: read(
      "Equipment.state.inventory.filter(i=>i.equipped).flatMap(i=>i.effects.map(e=>({...e,itemId:i.id})))",
    ),
    change(code) {
      vm.runInContext(code, context);
      return read("Equipment.state.resultingStats");
    },
  };
}
const build = equipmentBuild();
const fight = (options = {}) =>
  Engine.create({ stats: build.stats, seed: 1, ...options });
const run = (options) => {
  const engine = fight(options);
  engine.start();
  engine.advance(120);
  return engine;
};
check("actual equipment stats and centralized formulas", () => {
  const e = fight();
  assert.deepEqual(e.player.stats, build.stats);
  assert.equal(e.player.maxHp, 160 + 9 * build.stats.vigor);
  assert.equal(
    Data.formulas.damage(build.stats),
    8 +
      0.75 * build.stats.force +
      1.3 * build.stats.agility +
      0.3 * build.stats.spirit,
  );
  assert.equal(Data.formulas.mitigated(100, 100), 50);
  assert.ok(
    Data.formulas.gcd({ ...build.stats, speed: 30 }) <
      Data.formulas.gcd(build.stats),
  );
});
check(
  "victory and defeat with the same real build and different deterministic seeds",
  () => {
    const win = run({ seed: 1 }),
      lose = run({ seed: 2 });
    assert.equal(win.result.outcome, "victory");
    assert.equal(lose.result.outcome, "defeat");
    assert.equal(win.enemy.hp, 0);
    assert.equal(lose.player.hp, 0);
    assert.equal(win.result.damage, win.enemy.maxHp);
    assert.equal(win.result.damageTaken, win.player.maxHp - win.player.hp);
    assert.equal(win.result.dps, win.result.damage / win.result.duration);
    assert.ok(win.result.mostUsed.count > 0);
  },
);
check("fixed-step determinism independent of advance chunk sizes", () => {
  const a = fight(),
    b = fight();
  a.start();
  b.start();
  a.advance(40);
  for (let i = 0; i < 4000; i++) b.advance(0.01);
  assert.deepEqual(a.snapshot(), b.snapshot());
});
check("criticals, armor mitigation, cooldowns and AUTO rules", () => {
  const e = run();
  assert.ok(e.result.criticals > 0);
  assert.ok(e.log.some((x) => x.type === "playerAction" && x.critical));
  assert.equal(
    e.log.find((x) => x.type === "playerAction").abilityId,
    "lacerating",
  );
  for (const skill of Data.abilities) {
    const uses = e.log
      .filter((x) => x.abilityId === skill.id && x.type === "playerAction")
      .map((x) => x.time);
    for (let i = 1; i < uses.length; i++)
      assert.ok(uses[i] - uses[i - 1] + 1e-8 >= skill.cooldown);
  }
  const cast = fight();
  cast.start();
  cast.advance(0.05);
  assert.equal(cast.ready("lacerating"), false);
  assert.ok(cast.player.nextActionAt > 0.05);
});
check(
  "DoT ticks, refresh preserves cadence, expiration, max stack and origin",
  () => {
    const e = fight();
    e.start();
    e.advance(0.05);
    const first = e.enemy.effects.find((x) => x.id === "bleeding");
    assert.equal(first.origin.abilityId, "lacerating");
    assert.equal(first.stacks, 1);
    const tickAt = first.nextTickAt,
      expiry = first.expiresAt;
    e.applyEffect(e.enemy, "bleeding", {
      actorId: "player",
      abilityId: "lacerating",
    });
    assert.equal(first.nextTickAt, tickAt);
    assert.equal(first.stacks, 1);
    assert.ok(first.expiresAt >= expiry);
    e.advance(1);
    assert.ok(e.log.some((x) => x.type === "dot"));
    e.setRules(
      Data.abilities.map((a) => ({
        abilityId: a.id,
        condition: { type: "playerHpBelow", threshold: 1 },
      })),
    );
    e.advance(6);
    assert.ok(
      e.log.some((x) => x.type === "effectExpire" && x.effectId === "bleeding"),
    );
    assert.ok(!e.hasEffect(e.enemy, "bleeding"));
  },
);
check(
  "buff modifiers, duration and expiration affect frequency and dodge chance",
  () => {
    const e = fight();
    const before = e.effectiveStats(e.player);
    e.applyEffect(e.player, "wind", { actorId: "player", abilityId: "wind" });
    const after = e.effectiveStats(e.player);
    assert.equal(after.stats.agility, before.stats.agility + 8);
    assert.equal(after.stats.speed, before.stats.speed + 20);
    assert.ok(Data.formulas.gcd(after.stats) < Data.formulas.gcd(before.stats));
    assert.ok(
      Data.formulas.dodgeChance(after.stats, after.modifiers.dodge) >
        Data.formulas.dodgeChance(before.stats),
    );
    e.setRules(
      Data.abilities.map((a) => ({
        abilityId: a.id,
        condition: { type: "playerHpBelow", threshold: 1 },
      })),
    );
    e.start();
    e.advance(6.05);
    assert.ok(!e.hasEffect(e.player, "wind"));
    assert.deepEqual(e.effectiveStats(e.player).stats, before.stats);
  },
);
check(
  "custom order, all condition families, strict enemy HP threshold and execute bonus",
  () => {
    const e = fight();
    e.setRules([
      { abilityId: "rapid", condition: { type: "always" } },
      ...Data.defaultRules,
    ]);
    assert.equal(e.chooseAbility().id, "rapid");
    e.setRules(Data.defaultRules);
    assert.equal(
      e.conditionMet({ type: "enemyHpBelow", threshold: 25 }, "final"),
      false,
    );
    e.enemy.hp = e.enemy.maxHp * 0.25;
    assert.equal(
      e.conditionMet({ type: "enemyHpBelow", threshold: 25 }, "final"),
      false,
    );
    e.enemy.hp = e.enemy.maxHp * 0.24;
    assert.equal(
      e.conditionMet({ type: "enemyHpBelow", threshold: 25 }, "final"),
      true,
    );
    e.applyEffect(e.enemy, "bleeding", {
      actorId: "player",
      abilityId: "lacerating",
    });
    assert.equal(
      e.conditionMet(
        { type: "debuffAbsent", effectId: "bleeding" },
        "lacerating",
      ),
      false,
    );
    assert.equal(e.chooseAbility().id, "final");
    assert.equal(
      e.conditionMet({ type: "buffAbsent", effectId: "wind" }, "wind"),
      true,
    );
    e.applyEffect(e.player, "wind", { actorId: "player", abilityId: "wind" });
    assert.equal(
      e.conditionMet({ type: "buffAbsent", effectId: "wind" }, "wind"),
      false,
    );
    e.player.hp = e.player.maxHp * 0.2;
    assert.equal(
      e.conditionMet({ type: "playerHpBelow", threshold: 25 }, "wind"),
      true,
    );
    e.player.cooldowns.power = 10;
    assert.equal(e.conditionMet({ type: "ready" }, "power"), false);
    const low = fight(),
      high = fight();
    low.enemy.hp = low.enemy.maxHp * 0.24;
    high.enemy.hp = high.enemy.maxHp * 0.26;
    low.playerAction(Data.abilities.find((a) => a.id === "final"));
    high.playerAction(Data.abilities.find((a) => a.id === "final"));
    assert.ok(low.metrics.damage > high.metrics.damage * 2);
  },
);
check("pause/resume advances no time while paused", () => {
  const e = fight();
  e.start();
  e.advance(2);
  e.pause();
  const snapshot = e.snapshot();
  e.advance(10);
  assert.deepEqual(e.snapshot(), snapshot);
  e.resume();
  e.advance(1);
  assert.equal(e.time, 3);
});
check("equipment changes alter statistics and seeded results", () => {
  const upgraded = equipmentBuild();
  const changed = upgraded.change(
    "Equipment.equip('ring-sun','ringLeft');Equipment.equip('brace-iron','braceletLeft');Equipment.equip('ear-star','earLeft');",
  );
  const normal = run(),
    stronger = run({ stats: changed });
  assert.notDeepEqual(changed, build.stats);
  assert.ok(changed.force > build.stats.force);
  assert.ok(changed.critical > build.stats.critical);
  assert.notDeepEqual(normal.result, stronger.result);
});
check(
  "thorn-bleed ID hook genuinely applies stronger, longer DoT without item-name checks",
  () => {
    const thorn = equipmentBuild(true),
      e = run(thorn);
    assert.ok(e.metrics.itemProcs > 0);
    assert.ok(
      e.log.some((x) => x.type === "itemProc" && x.effectId === "thorn-bleed"),
    );
    const probe = fight({ effects: thorn.effects });
    probe.start();
    for (let i = 0; i < 300 && probe.metrics.itemProcs === 0; i++)
      probe.advance(0.05);
    const effect = probe.enemy.effects.find((x) => x.id === "bleeding");
    assert.ok(effect.origin.itemId === "thorn-quiver");
    assert.ok(effect.expiresAt - probe.time >= 7.9);
    assert.ok(effect.tickDamage > Data.formulas.damage(build.stats) * 0.12);
    const unknown = run({
      effects: [{ id: "unrecognized-effect", name: "Faretra delle Spine" }],
    });
    assert.equal(unknown.metrics.itemProcs, 0);
  },
);
check(
  "log cap under a long running combat, finished encounters stop changing",
  () => {
    const e = fight({ effects: equipmentBuild(true).effects });
    e.player.hp = e.player.maxHp = 100000;
    e.enemy.hp = e.enemy.maxHp = 100000;
    e.start();
    e.advance(180);
    assert.equal(e.log.length, 60);
    assert.ok(e.logVersion > 60);
    assert.ok(e.log[0].time > 0);
    const done = run(),
      saved = done.snapshot();
    done.advance(100);
    assert.deepEqual(done.snapshot(), saved);
  },
);
check(
  "settings validation, bow+quiver requirement and untouched main combat snapshot",
  () => {
    assert.equal(
      Data.kitRequirement({ weaponType: "bow" }, { type: "quiver" }),
      true,
    );
    assert.equal(
      Data.kitRequirement({ weaponType: "sword" }, { type: "shield" }),
      false,
    );
    assert.equal(Data.kitRequirement(null, null), false);
    const settings = Data.normalizeSettings({
      mode: "custom",
      speed: 4,
      rules: [
        {
          abilityId: "final",
          condition: { type: "enemyHpBelow", threshold: 200 },
        },
        { abilityId: "final" },
        { abilityId: "unknown" },
      ],
    });
    assert.equal(settings.rules.length, 5);
    assert.equal(settings.rules[0].condition.threshold, 99);
    assert.equal(new Set(settings.rules.map((r) => r.abilityId)).size, 5);
    const stats = { ...build.stats },
      e = fight({ stats });
    stats.force = 999;
    assert.notEqual(e.player.stats.force, 999);
  },
);
console.log(`${checks.length} engine integration checks passed.`);
