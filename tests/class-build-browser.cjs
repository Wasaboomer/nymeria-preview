const navigate = require('./mobile-navigation-fixture.cjs');
/* M4 real touch flows; preferences are persisted independently for each class. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const baseURL = process.env.NYMERIA_TEST_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.NYMERIA_CHROMIUM || "/usr/bin/chromium",
    args: ["--no-sandbox"],
    headless: true,
  });
  try {
    for (const width of [320, 390, 430]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.install({ time: new Date("2026-10-06T12:00:00Z") });
      await page.clock.pauseAt(new Date("2026-10-06T12:01:00Z"));
      await page.addInitScript(() => {
        Math.random = () => 1 / 4294967296;
      });
      assert.equal((await page.goto(baseURL)).status(), 200);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const tab = async (id) => {
        await navigate(page, id);
        assert.ok(await page.locator("#panel-" + id).isVisible());
        await overflow();
      };
      async function overflow() {
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${width}px horizontal overflow`,
        );
      }
      const state = () => page.evaluate(() => CombatUI.engine.snapshot());
      const config = () => page.evaluate(() => CombatUI.settings);
      async function choose(cls, build) {
        const previousClass = await page.evaluate(
          () => ClassSystem.selected().id,
        );
        await tab("class");
        await page.locator(`[data-class-id="${cls}"]`).tap();
        if (previousClass !== cls) {
          for (const id of cls === "hunter"
            ? ["torso-chain", "legs-chain", "boots-chain"]
            : ["torso-warden", "legs-sentinel", "boots-plate"])
            await equip(id);
          await tab("class");
        }
        if (build) await page.locator(`[data-build-id="${build}"]`).tap();
        await overflow();
      }
      async function equip(id) {
        await tab("inventory");
        await page.locator('[data-filter="all"]').tap();
        await page.locator(`[data-item-id="${id}"]`).tap();
        await overflow();
        if (!(await page.locator("#equip-item").isDisabled()))
          await page.locator("#equip-item").tap();
        await page.locator("#close-detail").tap();
      }
      await choose("warden", "bulwark");
      assert.match(
        await page.locator("#class-info").innerText(),
        /Risolutezza/,
      );
      assert.match(
        await page.locator("#identity-class").innerText(),
        /Custode/,
      );
      assert.equal(
        await page.evaluate(() => Equipment.state.inventory.length),
        56,
      );
      await tab("combat");
      assert.ok(await page.locator("#combat-start").isDisabled());
      assert.match(
        await page.locator("#combat-kit-hint").innerText(),
        /Spada 1H \+ Scudo/,
      );
      assert.equal((await state()).player.resource.current, 0);
      assert.equal(await page.evaluate(() => CombatUI.start()), false);
      await equip("shield");
      await tab("combat");
      assert.equal(await page.locator("#combat-start").isDisabled(), false);
      const rawStats = await page.evaluate(
        () => Equipment.state.resultingStats,
      );
      assert.deepEqual((await state()).player.stats, rawStats);
      const orders = {};
      for (const b of ["bulwark", "retaliation", "command"]) {
        await choose("warden", b);
        await tab("combat");
        orders[b] = await page
          .locator(".priority-row")
          .evaluateAll((rows) => rows.map((r) => r.dataset.priorityId).join());
        assert.equal((await state()).status, "idle");
      }
      assert.equal(new Set(Object.values(orders)).size, 3);
      await choose("warden", "retaliation");
      await tab("combat");
      await page.locator('[data-combat-mode="custom"]').tap();
      for (let i = 0; i < 4; i++)
        await page.locator('[data-rule="slash"][data-move="-1"]').tap();
      await page
        .locator('[data-condition="slash"]')
        .selectOption("resourceAbove");
      await page.locator('[data-threshold="slash"]').fill("60");
      await page.locator('[data-threshold="slash"]').press("Tab");
      await page
        .locator('[data-condition="iron-guard"]')
        .selectOption("buffAbsent");
      await page
        .locator('[data-effect="iron-guard"]')
        .selectOption("last-bastion");
      await page
        .locator('[data-condition="last-bastion"]')
        .selectOption("playerHpBelow");
      await page.locator('[data-threshold="last-bastion"]').fill("40");
      await page.locator('[data-threshold="last-bastion"]').press("Tab");
      const wardenCustom = await config();
      assert.equal(wardenCustom.rules[0].condition.threshold, 60);
      assert.equal(
        wardenCustom.rules.find((r) => r.abilityId === "iron-guard").condition
          .effectId,
        "last-bastion",
      );
      await choose("hunter", "predator");
      await tab("combat");
      assert.ok(await page.locator("#combat-start").isDisabled());
      assert.match(
        await page.locator("#combat-kit-hint").innerText(),
        /Arco \+ Faretra/,
      );
      assert.equal((await state()).player.resource.current, 100);
      assert.equal((await config()).mode, "auto");
      await page.locator('[data-combat-mode="custom"]').tap();
      await page
        .locator('[data-condition="power"]')
        .selectOption("resourceBelow");
      await page.locator('[data-threshold="power"]').fill("80");
      await page.locator('[data-threshold="power"]').press("Tab");
      const hunterCustom = await config();
      await choose("warden");
      await tab("combat");
      assert.deepEqual(await config(), wardenCustom);
      assert.equal(
        await page.evaluate(() => ClassSystem.build().id),
        "retaliation",
      );
      await page.reload();
      await tab("combat");
      assert.deepEqual(await config(), wardenCustom);
      assert.equal(
        await page.evaluate(() => ClassSystem.state.classId),
        "warden",
      );
      assert.equal((await state()).status, "idle");
      await choose("hunter");
      await tab("combat");
      assert.deepEqual(await config(), hunterCustom);
      await choose("warden", "bulwark");
      await tab("combat");
      await page.locator('[data-combat-mode="auto"]').tap();
      await page.locator("#combat-start").tap();
      await page.clock.runFor(1500);
      // Seed 1 dodges the first incoming hit: that must not generate Resolve.
      assert.equal((await state()).metrics.dodges, 1);
      assert.equal((await state()).metrics.resourceGenerated, 0);
      await page.clock.runFor(2500);
      assert.ok((await state()).metrics.resourceGenerated > 0);
      assert.match(
        await page.locator("#combat-resource-value").innerText(),
        /Risolutezza/,
      );
      await page.locator("#combat-pause").tap();
      const paused = await state();
      await page.clock.runFor(1000);
      assert.deepEqual(await state(), paused);
      await page.locator("#combat-pause").tap();
      await page.locator('[data-combat-speed="4"]').tap();
      await page.clock.runFor(12000);
      assert.equal((await state()).result.outcome, "victory");
      const wardenResult = await page
        .locator("#combat-result-stats")
        .innerText();
      assert.match(wardenResult, /Custode/);
      assert.match(wardenResult, /Danno mitigato/);
      assert.match(wardenResult, /Risolutezza usata/);
      await page.locator("#combat-reset").tap();
      assert.equal((await state()).status, "idle");
      assert.equal((await state()).player.resource.current, 0);
      await tab("inventory");
      const swordCard = page.locator('[data-item-id="sword-dawn"]');
      assert.match(await swordCard.innerText(), /↑ Miglioramento/);
      assert.match(await swordCard.innerText(), /★ Migliore posseduto/);
      await swordCard.tap();
      assert.match(
        await page.locator("#detail-body .comparison").innerText(),
        /Lama della soglia/,
      );
      await page.locator(".advisor-explanation summary").tap();
      assert.match(
        await page.locator(".advisor-score").innerText(),
        /Score provvisorio Custode/,
      );
      await overflow();
      await page.locator("#close-detail").tap();
      for (const b of ["predator", "lacerator", "explorer"]) {
        await choose("hunter", b);
        await tab("combat");
        await page.locator('[data-combat-mode="auto"]').tap();
        orders[b] = await page
          .locator(".priority-row")
          .evaluateAll((rows) => rows.map((r) => r.dataset.priorityId).join());
      }
      assert.equal(
        new Set(["predator", "lacerator", "explorer"].map((b) => orders[b]))
          .size,
        3,
      );
      await choose("hunter", "lacerator");
      await equip("bow");
      await tab("combat");
      assert.ok(await page.locator("#combat-start").isDisabled());
      await equip("quiver");
      await tab("combat");
      assert.equal(await page.locator("#combat-start").isDisabled(), false);
      await tab("inventory");
      const thornCard = page.locator('[data-item-id="thorn-quiver"]');
      assert.match(await thornCard.innerText(), /↑ Miglioramento/);
      assert.match(await thornCard.innerText(), /★ Migliore posseduto/);
      await thornCard.tap();
      assert.match(
        await page.locator("#detail-body .comparison").innerText(),
        /Faretra del viaggio/,
      );
      await page.locator(".advisor-explanation summary").tap();
      assert.match(
        await page.locator(".advisor-score").innerText(),
        /Laceratore/,
      );
      await page.locator("#equip-item").tap();
      await page.locator("#close-detail").tap();
      await tab("combat");
      await page.evaluate(() => CombatUI.start({ seed: 1 }));
      await page.clock.runFor(1600);
      assert.ok((await state()).metrics.itemProcs > 0);
      assert.ok((await state()).metrics.resourceUsed > 0);
      assert.match(
        await page.locator("#combat-resource-value").innerText(),
        /Concentrazione/,
      );
      await page.locator('[data-combat-speed="4"]').tap();
      await page.clock.runFor(12000);
      assert.equal((await state()).result.outcome, "victory");
      assert.match(
        await page.locator("#combat-result-stats").innerText(),
        /Danno da Sanguinamento/,
      );
      assert.match(
        await page.locator("#combat-result-stats").innerText(),
        /Concentrazione usata/,
      );
      const preference = await page.evaluate(() => ClassSystem.state);
      await page.reload();
      assert.deepEqual(
        await page.evaluate(() => ClassSystem.state),
        preference,
      );
      await tab("combat");
      assert.equal((await state()).time, 0);
      assert.equal((await config()).speed, 4);
      if (width === 390) {
        await choose("hunter", "lacerator");
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: "/tmp/nymeria-m4-class.png",
          fullPage: true,
        });
        await tab("combat");
        await page.evaluate(() => CombatUI.start({ seed: 1 }));
        await page.clock.runFor(1000);
        await page.locator("#combat-pause").tap();
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: "/tmp/nymeria-m4-combat.png",
          fullPage: true,
        });
      }
      await equip("greatsword");
      await tab("combat");
      assert.ok(await page.locator("#combat-start").isDisabled());
      assert.equal(await page.evaluate(() => CombatUI.start()), false);
      assert.equal(
        await page.evaluate(() => Equipment.state.inventory.length),
        56,
      );
      await overflow();
      assert.deepEqual(errors, []);
      console.log(
        `PASS M4 ${width}px: both classes, six builds, retained per-class custom priorities, effect/resource/HP conditions, kits/refusal, resources, results, gear advice/comparison, persistence, reset/pause/resume, touch, no JS errors/overflow`,
      );
      await page.close();
    }
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const old = {
        mode: "custom",
        speed: 2,
        rules: [{ abilityId: "rapid", condition: { type: "always" } }],
      };
      localStorage.setItem("nymeria.combat.v1", JSON.stringify(old));
    });
    const migration = await context.newPage();
    await migration.goto(baseURL);
    assert.equal(
      await migration.evaluate(() => CombatUI.settings.rules[0].abilityId),
      "rapid",
    );
    assert.equal(await migration.evaluate(() => CombatUI.settings.speed), 2);
    await context.close();
    console.log("PASS legacy combat custom-settings migration");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
