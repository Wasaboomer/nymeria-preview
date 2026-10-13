const navigate = require('./mobile-navigation-fixture.cjs');
/* Mobile touch regression for proficiency, Advisor, class switches and personal loot. */
const assert = require("node:assert/strict");
const dismissNotifications = require("./notifications-fixture.cjs");
const { chromium } = require("playwright");
const base = process.env.NYMERIA_TEST_URL || "http://127.0.0.1:8000";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.NYMERIA_CHROMIUM || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [320, 390, 430]) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        Math.random = () => 1 / 4294967296;
      });
      await page.clock.install({ time: new Date("2026-10-06T12:00:00Z") });
      await page.clock.pauseAt(new Date("2026-10-06T12:00:01Z"));
      assert.equal((await page.goto(base + "/?test=1")).status(), 200);
      const overflow = async () =>
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${width}px overflow`,
        );
      const tab = async (id) => {
        await navigate(page, id);
        assert.ok(await page.locator("#panel-" + id).isVisible());
        await overflow();
      };
      const equip = async (id) => {
        await tab("inventory");
        await require('./fixed-navigation-fixture.cjs').press(page,'[data-filter="all"]');
        await page.locator(`[data-item-id="${id}"]`).tap();
        await overflow();
        assert.ok(
          await page
            .locator("#item-dialog")
            .evaluate((d) => d.scrollWidth <= d.clientWidth),
        );
        if (!(await page.locator("#equip-item").isDisabled()))
          await page.locator("#equip-item").tap();
        await dismissNotifications(page);
        await page.locator("#close-detail").tap();
      };
      const choose = async (id) => {
        await tab("class");
        await page.locator(`[data-class-id="${id}"]`).tap();
      };
      const settle = () =>
        page.evaluate(async () => {
          if (navigator.locks)
            await navigator.locks.request("nymeria-progression", () => {});
        });
      for (const [cls, allowed, kit, armor, denied] of [
        [
          "hunter",
          "Mail",
          ["bow", "quiver"],
          [
            "head-chain",
            "torso-chain",
            "legs-chain",
            "gloves-chain",
            "boots-chain",
          ],
          ["torso-warden", "torso-oracle", "legs-ranger"],
        ],
        [
          "warden",
          "Plate",
          ["sword", "shield"],
          [
            "head-helm",
            "torso-warden",
            "legs-sentinel",
            "gloves-iron",
            "boots-plate",
          ],
          ["torso-chain", "torso-oracle", "legs-ranger"],
        ],
      ]) {
        await choose(cls);
        assert.match(
          await page.locator("#class-info").innerText(),
          new RegExp("Competenza armature.*" + allowed, "s"),
        );
        for (const id of armor) {
          await equip(id);
          assert.equal(
            await page.evaluate(
              (id) =>
                Equipment.state.inventory.find((i) => i.id === id).equipped,
              id,
            ),
            true,
          );
        }
        for (const id of denied) {
          await tab("inventory");
          await require('./fixed-navigation-fixture.cjs').press(page,'[data-filter="all"]');
          const card = page.locator(`[data-item-id="${id}"]`);
          assert.match(await card.innerText(), /Non utilizzabile/);
          assert.doesNotMatch(
            await card.innerText(),
            /Miglioramento|Migliore posseduto/,
          );
          await card.tap();
          assert.doesNotMatch(
            await page.locator("#detail-body .armor-incompatible").innerText(),
            /Miglioramento|Migliore posseduto/,
          );
          const before = await page.evaluate(() =>
            JSON.stringify(Equipment.state),
          );
          await page.locator("#equip-item").tap();
          assert.match(
            await page.locator("#notice").innerText(),
            new RegExp("solamente armature " + allowed),
          );
          assert.equal(
            await page.evaluate(() => JSON.stringify(Equipment.state)),
            before,
          );
          await dismissNotifications(page);
        await page.locator("#close-detail").tap();
          await overflow();
        }
        for (const id of kit) await equip(id);
        await tab("expeditions");
        await page.locator('[data-start-expedition="patrol"]').tap();
        await settle();
        const active = await page.evaluate(
          () => ProgressionStore.state.activeExpedition,
        );
        assert.equal(active.lootPolicy.classId, cls);
        await choose(cls === "hunter" ? "warden" : "hunter");
        assert.ok(
          await page.evaluate(() =>
            Object.values(Equipment.state.equipment).every((e) => {
              const i = Equipment.state.inventory.find(
                (i) => i.id === e.equippedItem,
              );
              return !i || ArmorRules.compatible(i, ClassSystem.selected());
            }),
          ),
        );
        await page.reload();
        await tab("expeditions");
        assert.deepEqual(
          await page.evaluate(() => ProgressionStore.state.activeExpedition),
          active,
        );
        await navigate(page, "debug");
        await page.locator("#expedition-debug-complete").tap();
        await navigate(page, "expeditions");
        await settle();
        const report = await page.evaluate(
          () => ProgressionStore.state.pendingExpeditionResult,
        );
        assert.equal(report.lootPolicy.armorProficiency, allowed.toLowerCase());
        assert.equal(
          report.rewards.lootIds[0],
          cls === "hunter" ? "moon-boots" : "moon-sabatons",
        );
        assert.match(
          await page.locator(".expedition-loot").innerText(),
          new RegExp("Non utilizzabile · " + allowed),
        );
        assert.doesNotMatch(
          await page.locator(".expedition-loot").innerText(),
          /Miglioramento|Migliore posseduto/,
        );
        await page.locator("#expedition-claim").tap();
        await settle();
        await equip(report.rewards.lootIds[0]);
        assert.equal(
          await page.evaluate(
            (id) => Equipment.state.inventory.find((i) => i.id === id).equipped,
            report.rewards.lootIds[0],
          ),
          false,
        );
        await choose(cls);
        await equip(report.rewards.lootIds[0]);
        assert.equal(
          await page.evaluate(() => Equipment.equipped("boots").armorType),
          allowed.toLowerCase(),
        );
        await equip("ring-sun");
        assert.equal(
          await page.evaluate(
            () =>
              Equipment.state.inventory.find((i) => i.id === "ring-sun")
                .equipped,
          ),
          true,
        );
      }
      await tab("character");
      await overflow();
      const bounds = await page.locator("#character").boundingBox();
      assert.ok(bounds.width >= 200 && bounds.height >= 300);
      if (width === 390) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: "/tmp/nymeria-armor-character-390.png",
          fullPage: true,
        });
        await tab("inventory");
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: "/tmp/nymeria-armor-inventory-390.png",
          fullPage: true,
        });
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        `PASS Armor/Smart Loot ${width}px: real touch, all wearable slots, six rejections, no false Advisor badges, class switch/reload, frozen personal loot/claim, jewelry, character readability, no JS errors/overflow`,
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
