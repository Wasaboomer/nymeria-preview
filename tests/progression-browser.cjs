const navigate = require('./mobile-navigation-fixture.cjs');
/* Cold loads, full browser close/return, real touch and same-origin concurrent claims. */
const assert = require("node:assert/strict");
const dismissNotifications = require("./notifications-fixture.cjs");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { chromium } = require("playwright");
const base = process.env.NYMERIA_TEST_URL || "http://127.0.0.1:8000";
const frozen = new Date("2026-10-06T12:00:00Z");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.NYMERIA_CHROMIUM || "/usr/bin/chromium",
    args: ["--no-sandbox"],
    headless: true,
  });
  try {
    for (const width of [320, 390, 430]) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      let page = await context.newPage();
      const errors = [];
      async function prepare(p, time = frozen) {
        p.on("pageerror", (e) => errors.push(e.message));
        await p.addInitScript(() => {
          Math.random = () => 1 / 4294967296;
        });
        await p.clock.install({ time });
        await p.clock.pauseAt(new Date(time.getTime() + 1000));
      }
      await prepare(page);
      assert.equal((await page.goto(base)).status(), 200);
      const settle = () =>
        page.evaluate(async () => {
          if (navigator.locks)
            await navigator.locks.request("nymeria-progression", () => {});
        });
      const state = () => page.evaluate(() => ProgressionStore.state);
      const overflow = async () =>
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${width}px overflow`,
        );
      async function tab(id) {
        await dismissNotifications(page);
        await navigate(page, id);
        await overflow();
      }
      async function equip(id) {
        await tab("inventory");
        await page.locator('[data-filter="all"]').tap();
        await page.locator(`[data-item-id="${id}"]`).tap();
        await overflow();
        if (!(await page.locator("#equip-item").isDisabled()))
          await page.locator("#equip-item").tap();
        await dismissNotifications(page);
        await page.locator("#close-detail").tap();
      }
      const initialGear = await page.evaluate(() => Equipment.state.equipment);
      assert.equal(
        await page.locator("#character-xp-value").innerText(),
        "0 / 80 XP",
      );
      assert.equal(await page.locator("#identity-level").innerText(), "1");
      await tab("expeditions");
      assert.equal(await page.locator("#expedition-debug").isVisible(), false);
      assert.ok(
        await page.locator('[data-start-expedition="patrol"]').isDisabled(),
      );
      assert.match(
        await page.locator('[data-start-expedition="recon"]').innerText(),
        /livello 5/,
      );
      await page.locator("#expedition-go-equipment").tap();
      assert.ok(await page.locator("#panel-equipment").isVisible());
      await equip("bow");
      await equip("quiver");
      await tab("expeditions");
      assert.equal(
        await page.locator('[data-start-expedition="patrol"]').isDisabled(),
        false,
      );
      assert.match(
        await page.locator('[data-activity="patrol"]').innerText(),
        /Facile/,
      );
      await page.locator('[data-start-expedition="patrol"]').tap();
      await settle();
      const active = (await state()).activeExpedition;
      assert.ok(active);
      assert.equal(active.endsAt - active.startedAt, 60000);
      assert.equal(active.testMode, false);
      assert.equal(
        (await page.evaluate(() => ProgressionSystem.start("patrol"))).ok,
        false,
      );
      assert.equal(
        (await page.evaluate(() => ProgressionSystem.debugComplete())).ok,
        false,
      );
      await page.clock.runFor(30000);
      assert.match(
        await page.locator("#expedition-countdown").innerText(),
        /0:30/,
      );
      assert.equal(
        await page
          .locator("#expedition-time-bar")
          .getAttribute("aria-valuenow"),
        "50.0",
      );
      await page.reload();
      await tab("expeditions");
      assert.deepEqual((await state()).activeExpedition, active);
      assert.match(
        await page.locator("#expedition-countdown").innerText(),
        /0:30/,
      );
      await tab("combat");
      await page.locator("#combat-start").tap();
      await page.clock.runFor(1000);
      assert.equal(
        await page.evaluate(() => CombatUI.engine.status),
        "running",
      );
      assert.ok(await page.evaluate(() => CombatUI.engine.metrics.damage > 0));
      assert.equal((await state()).totalXP, 0);
      assert.equal((await state()).activeExpedition.id, active.id);
      await page.close();
      page = await context.newPage();
      await prepare(page, new Date(active.endsAt + 20 * 60000));
      await page.goto(base);
      await page.evaluate(() => ProgressionSystem.refresh());
      await settle();
      await tab("expeditions");
      const report = (await state()).pendingExpeditionResult;
      assert.ok(report.success);
      assert.equal(report.id, active.id);
      assert.equal((await state()).totalXP, 0);
      assert.equal((await state()).crowns, 0);
      assert.ok(await page.locator("#expedition-welcome").isVisible());
      assert.match(
        await page.locator("#expedition-welcome").innerText(),
        /Bentornato.*Durante la tua assenza.*Pattuglia/,
      );
      assert.match(
        await page.locator("#expedition-report").innerText(),
        /SPEDIZIONE COMPLETATA/,
      );
      assert.match(
        await page.locator(".expedition-loot").innerText(),
        /Oggetto trovato/,
      );
      assert.match(
        await page.locator(".expedition-loot .gear-advice").innerText(),
        /Miglioramento|Migliore posseduto/,
      );
      if (width === 390) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: "/tmp/nymeria-m5-offline-report.png",
          fullPage: true,
        });
      }
      // Two immediate DOM click events exercise the UI guard before async persistence finishes.
      await page.evaluate(() => {
        document.getElementById("expedition-claim").click();
        document.getElementById("expedition-claim").click();
      });
      await settle();
      const claimed = await state();
      assert.equal(claimed.totalXP, report.rewards.xp);
      assert.equal(claimed.level, 2);
      assert.equal(claimed.currentXP, report.rewards.xp - 80);
      assert.equal(claimed.crowns, report.rewards.crowns);
      for (const key of ["iron", "fiber", "ether"])
        assert.ok(claimed.materials[key] > 0);
      assert.equal(
        await page.evaluate(() => Equipment.state.character.level),
        2,
      );
      assert.equal(
        await page.evaluate(() => Equipment.equipped("boots").id),
        "boots-chain",
      );
      assert.equal(
        await page.evaluate(() => Equipment.state.inventory.length),
        57,
      );
      assert.ok(await page.locator("#expedition-claim").isHidden());
      assert.ok(await page.locator("#expedition-claimed").isVisible());
      await tab("character");
      assert.match(
        await page.locator("#progression-level-up").innerText(),
        /LIVELLO 2 RAGGIUNTO/,
      );
      assert.equal(
        await page.locator("#character-xp-bar").getAttribute("aria-valuenow"),
        String(claimed.currentXP),
      );
      assert.equal(
        await page.locator("#character-xp-bar").getAttribute("aria-valuemax"),
        "204",
      );
      if (width === 390) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: "/tmp/nymeria-m5-character.png",
          fullPage: true,
        });
      }
      await tab("inventory");
      assert.match(
        await page.locator("#inventory-resources").innerText(),
        /Corone.*Ferro del Vespro.*Fibra Lunare.*Polvere d’Etere/s,
      );
      await equip("moon-boots");
      assert.equal(
        await page.evaluate(
          () =>
            document.querySelector('#rig [data-layer="boots"]')
              .childElementCount > 0,
        ),
        true,
      );
      assert.equal(
        await page.evaluate(() => Equipment.equipped("boots").id),
        "moon-boots",
      );
      await page.reload();
      await tab("expeditions");
      assert.equal((await state()).totalXP, claimed.totalXP);
      assert.equal(
        (await page.evaluate((id) => ProgressionSystem.claim(id), report.id))
          .ok,
        false,
      );
      assert.equal(
        await page.evaluate(() => Equipment.equipped("boots").id),
        "moon-boots",
      );
      await page.locator('[data-start-expedition="patrol"]').tap();
      await settle();
      await page.clock.runFor(3000);
      await page.locator("#expedition-cancel").tap();
      await page.locator("#expedition-cancel-apply").tap();
      await settle();
      assert.equal((await state()).activeExpedition, null);
      assert.equal((await state()).pendingExpeditionResult, null);
      assert.equal((await state()).totalXP, claimed.totalXP);
      assert.match(
        await page.locator("#expedition-message").innerText(),
        /nessuna ricompensa/,
      );
      // Test Mode keeps normal timestamps but explicitly permits an early TEST-only resolution.
      await page.goto(base + "/?test=1");
      await tab("expeditions");
      await navigate(page, "debug");
      assert.ok(await page.locator("#expedition-debug").isVisible());
      await navigate(page, "expeditions");
      await page.locator('[data-start-expedition="patrol"]').tap();
      await settle();
      assert.ok((await state()).activeExpedition.testMode);
      await navigate(page, "debug");
        await page.locator("#expedition-debug-complete").tap();
        await navigate(page, "expeditions");
      await settle();
      assert.ok((await state()).pendingExpeditionResult.testMode);
      await page.locator("#expedition-claim").tap();
      await settle();
      assert.equal((await state()).lastClaim.loot[0].duplicate, true);
      assert.match(
        await page.locator(".expedition-loot").innerText(),
        /Già posseduto/,
      );
      // Fixtures put XP at real curve thresholds to inspect all unlocks and long activities without a 30min wait.
      await page.evaluate(() =>
        ProgressionStore.transact((s) => {
          s.totalXP = ProgressionData.thresholds[19];
          return { ok: true };
        }),
      );
      await settle();
      for (const id of ["broken-trail", "recon", "vigil"]) {
        assert.equal(
          await page.locator(`[data-start-expedition="${id}"]`).isDisabled(),
          false,
        );
        await page.locator(`[data-start-expedition="${id}"]`).tap();
        await settle();
        const run = (await state()).activeExpedition;
        assert.equal(run.snapshot.level, 20);
        assert.equal(
          run.endsAt - run.startedAt,
          { "broken-trail": 300000, recon: 900000, vigil: 1800000 }[id],
        );
        await navigate(page, "debug");
        await page.locator("#expedition-debug-complete").tap();
        await navigate(page, "expeditions");
        await settle();
        assert.ok((await state()).pendingExpeditionResult.total > 0);
        await page.locator("#expedition-claim").tap();
        await settle();
        await overflow();
      }
      await tab("character");
      assert.match(
        await page.locator("#character-xp-value").innerText(),
        /MAX/,
      );
      assert.equal(
        await page.locator("#character-xp-bar").getAttribute("aria-valuenow"),
        "1",
      );
      assert.equal((await state()).level, 20);
      assert.ok((await state()).overflowXP > 0);
      if (width === 390) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: "/tmp/nymeria-m5-level-cap.png",
          fullPage: true,
        });
      }
      // A poor strategy gives a visible failure report with no free rewards.
      await page.evaluate(async () => {
        await ProgressionStore.transact((s) => {
          s.totalXP = ProgressionData.thresholds[4];
          return { ok: true };
        });
        const snapshot = ProgressionSystem.snapshot();
        const active = {
          id: "failure-ui",
          activityId: "patrol",
          activity: ExpeditionData.activity("patrol"),
          eventDefinitions: ExpeditionData.events,
          startedAt: Date.now() - 60000,
          endsAt: Date.now(),
          seed: 1,
          rulesVersion: 1,
          testMode: true,
          snapshot: {
            ...snapshot,
            rules: snapshot.profile.abilities.map((a) => ({
              abilityId: a.id,
              condition: { type: "playerHpBelow", threshold: 1 },
            })),
          },
        };
        await ProgressionStore.transact((s) => {
          s.activeExpedition = active;
          s.lastClaim = null;
          return { ok: true };
        });
        await ProgressionSystem.refresh();
      });
      await settle();
      await tab("expeditions");
      assert.equal((await state()).pendingExpeditionResult.success, false);
      assert.match(
        await page.locator("#expedition-report").innerText(),
        /SPEDIZIONE FALLITA/,
      );
      assert.match(
        await page.locator("#expedition-report").innerText(),
        /Ricompense parziali/,
      );
      await overflow();
      assert.deepEqual(errors, []);
      console.log(
        `PASS M5 ${width}px: XP/bar/level/cap/growth, kit+unlocks, four activities, timestamps/countdown/refresh, close+20min offline return, welcome, claim/double-click, loot/advisor/equip/duplicates, materials/crowns, cancellation, independent combat, Test Mode, failure, touch, no JS errors/overflow`,
      );
      await context.close();
    }
    // Native Web Locks serialize operations across two independent pages on the same origin.
    const shared = await browser.newContext();
    const a = await shared.newPage(),
      b = await shared.newPage();
    await a.goto(base + "/?test=1");
    await b.goto(base + "/?test=1");
    for (const p of [a, b])
      await p.evaluate(() => {
        Equipment.equip("bow", "mainHand");
        Equipment.equip("quiver", "support");
      });
    const starts = await Promise.all([
      a.evaluate(() => ProgressionSystem.start("patrol", { seed: 1 })),
      b.evaluate(() => ProgressionSystem.start("patrol", { seed: 1 })),
    ]);
    assert.equal(starts.filter((s) => s.ok).length, 1);
    await a.evaluate(() => ProgressionStore.refresh());
    await a.evaluate(() => ProgressionSystem.debugComplete());
    await b.evaluate(() => ProgressionStore.refresh());
    const id = await a.evaluate(
      () => ProgressionStore.state.pendingExpeditionResult.id,
    );
    const claims = await Promise.all([
      a.evaluate((id) => ProgressionSystem.claim(id), id),
      b.evaluate((id) => ProgressionSystem.claim(id), id),
    ]);
    assert.equal(claims.filter((c) => c.ok).length, 1);
    await a.evaluate(() => ProgressionStore.refresh());
    await b.evaluate(() => ProgressionStore.refresh());
    assert.equal(await a.evaluate(() => ProgressionStore.state.totalXP), 108);
    assert.equal(await b.evaluate(() => ProgressionStore.state.totalXP), 108);
    assert.equal(await a.evaluate(() => Equipment.state.inventory.length), 57);
    assert.equal(await b.evaluate(() => Equipment.state.inventory.length), 57);
    console.log(
      "PASS concurrent tabs: one expedition, one claim, synchronized level/resources/loot",
    );
    await shared.close();
    // Close the Chromium process itself, preserving its profile directory, then reopen offline.
    const profileDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "nymeria-m5-profile-"),
    );
    const launchProfile = () =>
      chromium.launchPersistentContext(profileDir, {
        executablePath: process.env.NYMERIA_CHROMIUM || "/usr/bin/chromium",
        args: ["--no-sandbox"],
        headless: true,
      });
    let persistent = null;
    try {
      persistent = await launchProfile();
      let persistedPage = persistent.pages()[0];
      await persistedPage.clock.install({ time: frozen });
      await persistedPage.clock.pauseAt(new Date(frozen.getTime() + 1000));
      await persistedPage.goto(base);
      await persistedPage.evaluate(() => {
        Equipment.equip("bow", "mainHand");
        Equipment.equip("quiver", "support");
      });
      assert.ok(
        (
          await persistedPage.evaluate(() =>
            ProgressionSystem.start("patrol", { seed: 1 }),
          )
        ).ok,
      );
      const deadline = await persistedPage.evaluate(
        () => ProgressionStore.state.activeExpedition.endsAt,
      );
      await persistent.close();
      persistent = null;
      persistent = await launchProfile();
      persistedPage = persistent.pages()[0];
      await persistedPage.clock.install({ time: new Date(deadline + 1200000) });
      await persistedPage.clock.pauseAt(new Date(deadline + 1201000));
      await persistedPage.goto(base);
      await persistedPage.evaluate(() => ProgressionSystem.refresh());
      const offlineReport = await persistedPage.evaluate(
        () => ProgressionStore.state.pendingExpeditionResult,
      );
      assert.ok(offlineReport.success);
      assert.equal(offlineReport.rewards.xp, 108);
      assert.ok(
        (
          await persistedPage.evaluate(
            (id) => ProgressionSystem.claim(id),
            offlineReport.id,
          )
        ).ok,
      );
      await persistent.close();
      persistent = null;
      persistent = await launchProfile();
      persistedPage = persistent.pages()[0];
      await persistedPage.goto(base);
      assert.equal(
        await persistedPage.evaluate(() => ProgressionStore.state.totalXP),
        108,
      );
      assert.equal(
        await persistedPage.evaluate(() => Equipment.state.inventory.length),
        57,
      );
      assert.equal(
        (
          await persistedPage.evaluate(
            (id) => ProgressionSystem.claim(id),
            offlineReport.id,
          )
        ).ok,
        false,
      );
      console.log(
        "PASS full Chromium process restart: persistent profile, offline completion, claim survives second restart",
      );
    } finally {
      if (persistent) await persistent.close();
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
    // Storage-denied startup must not break other game panels or enable a nonpersistent expedition.
    const denied = await browser.newContext();
    await denied.addInitScript(() => {
      Storage.prototype.getItem = function () {
        throw new Error("denied");
      };
      Storage.prototype.setItem = function () {
        throw new Error("denied");
      };
    });
    const p = await denied.newPage();
    const deniedErrors = [];
    p.on("pageerror", (e) => deniedErrors.push(e.message));
    await p.goto(base);
    await p.evaluate(() => {
      Equipment.equip("bow", "mainHand");
      Equipment.equip("quiver", "support");
    });
    assert.equal(
      (await p.evaluate(() => ProgressionSystem.start("patrol"))).ok,
      false,
    );
    await navigate(p, "expeditions");
    assert.match(
      await p.locator("#expedition-storage").innerText(),
      /Salvataggio locale non disponibile/,
    );
    await navigate(p, "combat");
    await p.evaluate(() => {Equipment.equip("bow", "mainHand");Equipment.equip("quiver", "support");});
    assert.equal(await p.evaluate(() => CombatUI.start({ seed: 1 })), true);
    assert.deepEqual(deniedErrors, []);
    await denied.close();
    console.log(
      "PASS storage denied: no unpersisted expedition/rewards, manual combat usable",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
