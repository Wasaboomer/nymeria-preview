const navigate = require('./mobile-navigation-fixture.cjs');
/* Real mobile browser controls, deterministic simulation clock and Equipment UI integration. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const baseURL = process.env.NYMERIA_TEST_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.NYMERIA_CHROMIUM || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [320, 390, 430]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.clock.install({ time: new Date("2026-10-06T12:00:00Z") });
      await page.clock.pauseAt(new Date("2026-10-06T12:01:00Z"));
      assert.equal((await page.goto(baseURL)).status(), 200);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const state = () => page.evaluate(() => CombatUI.engine.snapshot());
      const config = () => page.evaluate(() => CombatUI.settings);
      const combat = async () => {
        await navigate(page, "combat");
        assert.ok(await page.locator("#panel-combat").isVisible());
      };
      const overflow = async () =>
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
      async function equip(id) {
        await navigate(page, "inventory");
        await require('./fixed-navigation-fixture.cjs').press(page,'[data-filter="all"]');
        await page.locator(`[data-item-id="${id}"]`).tap();
        if (!(await page.locator("#equip-item").isDisabled()))
          await page.locator("#equip-item").tap();
        await page.locator("#close-detail").tap();
      }
      await combat();
      assert.ok(await page.locator("#combat-requirement").isVisible());
      assert.ok(await page.locator("#combat-start").isDisabled());
      assert.equal(
        await page.evaluate(() => Equipment.equipped("mainHand").id),
        "sword",
      );
      await page.locator("#combat-go-equipment").tap();
      assert.ok(await page.locator("#panel-equipment").isVisible());
      await equip("bow");
      await combat();
      assert.ok(await page.locator("#combat-start").isDisabled());
      await equip("quiver");
      await combat();
      assert.ok(!(await page.locator("#combat-requirement").isVisible()));
      assert.ok(!(await page.locator("#combat-start").isDisabled()));
      assert.deepEqual(
        await page.evaluate(() => CombatUI.engine.player.stats),
        await page.evaluate(() => Equipment.state.resultingStats),
      );
      assert.equal(
        (await state()).player.maxHp,
        await page.evaluate(
          () => 160 + 9 * Equipment.state.resultingStats.vigor,
        ),
      );
      assert.deepEqual(
        await page
          .locator(".priority-row")
          .evaluateAll((rows) => rows.map((r) => r.dataset.priorityId)),
        ["final", "power", "lacerating", "wind", "rapid"],
      );
      // Start via the actual UI button; then verify one clock and pause/resume.
      await page.locator("#combat-start").tap();
      assert.equal((await state()).status, "running");
      await page.clock.runFor(2100);
      const t1 = (await state()).time;
      assert.ok(t1 >= 2 && t1 <= 2.15);
      assert.ok((await state()).metrics.damage > 0);
      assert.ok(
        await page
          .locator("#combat-enemy-effects")
          .innerText()
          .then((t) => t.includes("Sanguinamento")),
      );
      assert.match(
        await page.locator('[data-cooldown="lacerating"]').innerText(),
        /s/,
      );
      await page.locator("#combat-pause").tap();
      const paused = await state();
      await page.clock.runFor(1500);
      assert.deepEqual(await state(), paused);
      assert.equal(await page.locator("#combat-pause").innerText(), "Riprendi");
      await page.locator("#combat-pause").tap();
      await page.clock.runFor(1100);
      const t2 = (await state()).time;
      assert.ok(t2 - paused.time >= 1 && t2 - paused.time <= 1.15);
      await page.locator('[data-combat-speed="2"]').tap();
      const before2 = (await state()).time;
      await page.clock.runFor(1100);
      const delta2 = (await state()).time - before2;
      assert.ok(delta2 >= 2 && delta2 <= 2.3);
      assert.match(
        await page.locator("#combat-player-effects").innerText(),
        /Passo del Vento/,
      );
      await page.locator('[data-combat-speed="4"]').tap();
      const before4 = (await state()).time;
      await page.clock.runFor(550);
      assert.ok((await state()).time - before4 >= 2);
      await page.locator("#combat-pause").tap();
      assert.ok((await state()).log.some((event) => event.type === "dot"));
      // Configure every condition family and reorder the actual priority UI.
      await page.locator('[data-combat-mode="custom"]').tap();
      for (let i = 0; i < 4; i++)
        await page.locator('[data-rule="rapid"][data-move="-1"]').tap();
      assert.equal((await config()).rules[0].abilityId, "rapid");
      assert.equal(
        await page.evaluate(() => CombatUI.engine.rules[0].abilityId),
        "rapid",
      );
      for (const type of [
        "resourceAbove",
        "resourceBelow",
        "ready",
        "debuffAbsent",
        "buffAbsent",
        "playerHpBelow",
        "enemyHpBelow",
        "always",
      ]) {
        await page.locator('[data-condition="rapid"]').selectOption(type);
        assert.equal((await config()).rules[0].condition.type, type);
        await overflow();
      }
      await page
        .locator('[data-condition="final"]')
        .selectOption("enemyHpBelow");
      await page.locator('[data-threshold="final"]').fill("25");
      await page.locator('[data-threshold="final"]').press("Tab");
      assert.equal(
        (await config()).rules.find((r) => r.abilityId === "final").condition
          .threshold,
        25,
      );
      const savedSettings = await config();
      assert.deepEqual(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem(CombatUI.STORAGE_KEY)).entries["legacy:hunter"],
        ),
        savedSettings,
      );
      await page.reload();
      await combat();
      assert.deepEqual(await config(), savedSettings);
      assert.equal((await state()).status, "idle");
      assert.equal((await state()).time, 0);
      // Seed is internal; normal UI still selects a new random seed each encounter.
      await page.locator('[data-combat-mode="auto"]').tap();
      await page.evaluate(() => CombatUI.start({ seed: 1 }));
      await page.clock.runFor(9000);
      assert.equal((await state()).result.outcome, "victory");
      assert.ok(await page.locator("#combat-result").isVisible());
      assert.equal(
        await page.locator("#combat-result-heading").innerText(),
        "VITTORIA",
      );
      assert.equal(await page.locator("#combat-result-stats div").count(), 11);
      assert.ok((await state()).result.criticals > 0);
      const finished = await state();
      await page.clock.runFor(1000);
      assert.deepEqual(await state(), finished);
      await page.locator("#combat-again").tap();
      assert.equal((await state()).status, "running");
      assert.equal((await state()).time, 0);
      await page.locator("#combat-reset").tap();
      assert.equal((await state()).status, "idle");
      assert.equal((await state()).time, 0);
      assert.equal((await state()).player.hp, (await state()).player.maxHp);
      assert.ok(!(await page.locator("#combat-result").isVisible()));
      await page.evaluate(() => CombatUI.start({ seed: 5 }));
      await page.clock.runFor(9000);
      assert.equal((await state()).result.outcome, "defeat");
      assert.equal(
        await page.locator("#combat-result-heading").innerText(),
        "SCONFITTA",
      );
      // Hook comes from the genuinely equipped item, not a visual name or hardcoded test stat.
      await equip("thorn-quiver");
      await combat();
      await page.evaluate(() => CombatUI.start({ seed: 1 }));
      await page.clock.runFor(1500);
      assert.ok((await state()).metrics.itemProcs > 0);
      assert.ok(
        (await state()).log.some(
          (event) =>
            event.type === "itemProc" && event.effectId === "thorn-bleed",
        ),
      );
      assert.match(await page.locator("#combat-log").innerText(), /potenziato/);
      if (width === 390) {
        await page.locator("#combat-pause").tap();
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: "/tmp/nymeria-combat-mobile.png",
          fullPage: true,
        });
      }
      // Gear changes end/reset the active snapshot and update stats; missing kit disables start.
      const previousForce = (await state()).player.stats.force;
      await equip("ring-sun");
      await combat();
      assert.equal((await state()).status, "idle");
      assert.ok((await state()).player.stats.force > previousForce);
      assert.deepEqual(
        (await state()).player.stats,
        await page.evaluate(() => Equipment.state.resultingStats),
      );
      await equip("sword");
      await combat();
      assert.ok(await page.locator("#combat-requirement").isVisible());
      assert.ok(await page.locator("#combat-start").isDisabled());
      assert.equal(
        await page.evaluate(() => Equipment.equipped("support")),
        null,
      );
      await overflow();
      assert.ok((await page.locator("#combat-log li").count()) <= 60);
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${width}px: kit requirement/link, real gear stats, start, AUTO/custom/order/all conditions, cooldown/DoT/buff, pause/resume, 1×/2×/4× clock, victory/defeat/results, replay/reset, thorn hook, persistence, equipment reset, touch and no JS errors/overflow`,
      );
      await page.close();
    }
    // Smoke-test the normal requestAnimationFrame adapter using real wall time too.
    const live = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const liveErrors = [];
    live.on("pageerror", (error) => liveErrors.push(error.message));
    await live.goto(baseURL);
    await live.evaluate(() => {
      Equipment.equip("bow", "mainHand");
      Equipment.equip("quiver", "support");
    });
    await navigate(live, "combat");
    await live.locator("#combat-start").tap();
    await live.waitForTimeout(1150);
    const firstTime = await live.evaluate(() => CombatUI.engine.time);
    assert.ok(firstTime >= 0.8 && firstTime <= 1.5);
    await live.locator('[data-combat-speed="2"]').tap();
    const beforeDouble = await live.evaluate(() => CombatUI.engine.time);
    await live.waitForTimeout(1150);
    const doubleDelta =
      (await live.evaluate(() => CombatUI.engine.time)) - beforeDouble;
    assert.ok(doubleDelta >= 1.7 && doubleDelta <= 2.8);
    await live.locator("#combat-pause").tap();
    const stopped = await live.evaluate(() => CombatUI.engine.snapshot());
    await live.waitForTimeout(400);
    assert.deepEqual(
      await live.evaluate(() => CombatUI.engine.snapshot()),
      stopped,
    );
    await live.evaluate(() => Equipment.setCharacter("hair", "crest"));
    assert.deepEqual(
      await live.evaluate(() => CombatUI.engine.snapshot()),
      stopped,
    );
    assert.equal(
      await live
        .locator('#combat-rig [data-layer="hair-front"]')
        .getAttribute("data-item"),
      "crest",
    );
    assert.deepEqual(liveErrors, []);
    await live.close();
    console.log(
      "PASS normal wall-time RAF clock: 1×/2×, pause, cosmetic changes preserve fight state",
    );
    const denied = await browser.newPage();
    const errors = [];
    denied.on("pageerror", (e) => errors.push(e.message));
    await denied.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Denied", "SecurityError");
        },
      }),
    );
    await denied.goto(baseURL);
    await navigate(denied, "combat");
    assert.match(
      await denied.locator("#combat-strategy-hint").innerText(),
      /non disponibile/,
    );
    assert.deepEqual(errors, []);
    await denied.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
