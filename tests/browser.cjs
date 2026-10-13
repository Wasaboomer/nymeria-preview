const navigate = require('./mobile-navigation-fixture.cjs');
/* Real browser integration checks; no application dependencies or build step.
   Run a static server, then: node tests/browser.cjs
   Playwright is supplied by the development environment, not loaded by the app. */
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
        hasTouch: true,
        isMobile: true,
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      assert.equal((await page.goto(baseURL + "/?test=1")).status(), 200);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const model = () =>
        page.evaluate(() => JSON.parse(JSON.stringify(Equipment.state)));
      const noOverflow = async () =>
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "Horizontal overflow",
        );
      const screen = async (name) => {
        await navigate(page, name);
        await noOverflow();
      };
      const close = async () => {
        if (await page.locator("#item-dialog").evaluate((d) => d.open))
          await page.locator("#close-detail").tap();
      };
      const open = async (id) => {
        await close();
        await screen("inventory");
        await require('./fixed-navigation-fixture.cjs').press(page,'[data-filter="all"]');
        await page.locator(`[data-item-id="${id}"]`).tap();
        assert.ok(
          await page
            .locator("#item-dialog")
            .evaluate((d) => d.scrollWidth <= d.clientWidth),
          "Dialog overflow",
        );
      };
      async function equip(id, target) {
        await open(id);
        if (target) await page.locator(`[data-target="${target}"]`).tap();
        if (!(await page.locator("#equip-item").isDisabled()))
          await page.locator("#equip-item").tap();
        await close();
      }
      let state = await model();
      const initial = JSON.parse(JSON.stringify(state));
      assert.equal(state.inventory.length, 56);
      assert.equal(Object.keys(state.equipment).length, 16);
      for (const i of state.inventory) {
        for (const field of [
          "id",
          "name",
          "slot",
          "type",
          "rarity",
          "itemLevel",
          "requiredLevel",
          "stats",
          "description",
          "equipped",
        ])
          assert.ok(Object.hasOwn(i, field));
        if (i.slot === "weapon")
          for (const field of ["handedness", "weaponType", "allowedSupports"])
            assert.ok(Object.hasOwn(i, field));
      }
      await screen("equipment");
      assert.equal(await page.locator(".slot-card").count(), 16);
      // Required compatibility combinations, through touch UI.
      await equip("sword");
      await equip("shield");
      state = await model();
      assert.equal(state.equipment.mainHand.equippedItem, "sword");
      assert.equal(state.equipment.support.equippedItem, "shield");
      await equip("offhand-blade");
      assert.equal(
        (await model()).equipment.support.equippedItem,
        "offhand-blade",
      );
      await equip("dagger");
      await equip("offhand-dagger");
      assert.equal(
        (await model()).equipment.support.equippedItem,
        "offhand-dagger",
      );
      await equip("bow");
      assert.equal((await model()).equipment.support.equippedItem, null);
      await equip("quiver");
      assert.equal((await model()).equipment.support.equippedItem, "quiver");
      await open("shield");
      assert.match(
        await page.locator("#item-dialog .compatibility").innerText(),
        /non può usare/,
      );
      const beforeRejected = await model();
      await page.locator("#equip-item").tap();
      assert.deepEqual(await model(), beforeRejected);
      assert.match(await page.locator("#notice").innerText(), /non può usare/);
      await close();
      await equip("crossbow");
      await equip("bolts");
      assert.equal((await model()).equipment.support.equippedItem, "bolts");
      await equip("quiver");
      assert.equal((await model()).equipment.support.equippedItem, "quiver");
      await equip("wand");
      for (const id of ["book", "orb", "focus"]) {
        await equip(id);
        assert.equal((await model()).equipment.support.equippedItem, id);
      }
      await equip("bow");
      await equip("thorn-quiver");
      for (const id of ["staff", "greatsword", "spear"]) {
        await equip(id);
        state = await model();
        assert.equal(state.equipment.mainHand.equippedItem, id);
        assert.equal(state.equipment.support.equippedItem, null);
        assert.equal(
          state.inventory.find((i) => i.id === "thorn-quiver").equipped,
          false,
        );
        await screen("equipment");
        assert.ok(
          await page.locator('[data-open-slot="support"]').isDisabled(),
        );
        assert.match(
          await page.locator('[data-open-slot="support"]').innerText(),
          /Bloccato/,
        );
      }
      await equip("sword");
      await screen("equipment");
      assert.ok(
        !(await page.locator('[data-open-slot="support"]').isDisabled()),
      );
      await equip("shield");
      // Paired slots are independent; changing a destination does not clone an item.
      for (const [left, right, type, a, b] of [
        ["ringLeft", "ringRight", "ring", "ring-dusk", "ring-tide"],
        ["earLeft", "earRight", "earring", "ear-star", "ear-tear"],
        [
          "braceletLeft",
          "braceletRight",
          "bracelet",
          "brace-mist",
          "brace-iron",
        ],
      ]) {
        await equip(a, left);
        await equip(b, right);
        state = await model();
        assert.equal(state.equipment[left].equippedItem, a);
        assert.equal(state.equipment[right].equippedItem, b);
        await open(a);
        assert.equal(await page.locator(".target-picker button").count(), 2);
        await page.locator(`[data-target="${right}"]`).tap();
        assert.match(
          await page.locator(".comparison h3").innerText(),
          new RegExp(state.inventory.find((i) => i.id === b).name),
        );
        await close();
      }
      // Unequip/equip changes both real totals and mannequin without touching other layer DOM nodes.
      await screen("character");
      await page.evaluate(() => {
        window.originalWeapon = document.querySelector(
          '#rig [data-layer="weapon"]',
        ).firstElementChild;
      });
      const beforeArmor = await model();
      await open("torso-chain");
      await page.locator('[data-remove="torso"]').tap();
      state = await model();
      assert.equal(state.equipment.torso.equippedItem, null);
      assert.equal(
        state.inventory.find((i) => i.id === "torso-chain").equipped,
        false,
      );
      assert.notEqual(state.power, beforeArmor.power);
      assert.equal(
        state.resultingStats.force,
        beforeArmor.resultingStats.force - 4,
      );
      await close();
      await open("torso-chain");
      const predicted = await page.evaluate(() =>
        Equipment.comparison("torso-chain", "torso"),
      );
      assert.match(await page.locator(".comparison").innerText(), /Forza/);
      assert.match(await page.locator(".comparison").innerText(), /\+4/);
      await page.locator("#equip-item").tap();
      state = await model();
      assert.equal(state.power - (beforeArmor.power - 23), predicted.power);
      await close();
      assert.ok(
        await page.evaluate(
          () =>
            window.originalWeapon ===
            document.querySelector('#rig [data-layer="weapon"]')
              .firstElementChild,
        ),
        "Unrelated weapon DOM replaced",
      );
      assert.equal(
        await page
          .locator('#rig [data-layer="torso"]')
          .getAttribute("data-item"),
        "torso-chain",
      );
      // Independent recomputation of sums and power, equipped markers and unique IDs.
      const sums = {
        force: 12,
        agility: 15,
        vigor: 14,
        spirit: 11,
        critical: 0,
        speed: 0,
        armor: 0,
      };
      const equippedIds = Object.values(state.equipment)
        .map((x) => x.equippedItem)
        .filter(Boolean);
      assert.equal(new Set(equippedIds).size, equippedIds.length);
      for (const id of equippedIds)
        for (const [k, v] of Object.entries(
          state.inventory.find((i) => i.id === id).stats,
        ))
          sums[k] += v;
      assert.deepEqual(state.resultingStats, sums);
      assert.equal(
        state.power,
        Math.round(
          sums.force * 2 +
            sums.agility * 2 +
            sums.vigor +
            sums.spirit * 2 +
            sums.critical * 3 +
            sums.speed * 2 +
            sums.armor,
        ),
      );
      for (const i of state.inventory)
        assert.equal(i.equipped, equippedIds.includes(i.id));
      // Filter contents and order match the rendered cards, not just labels.
      await screen("inventory");
      for (const [filter, slots] of [
        ["weapons", ["weapon", "support"]],
        [
          "armor",
          ["head", "cloak", "torso", "legs", "boots", "gloves", "belt"],
        ],
        ["accessories", ["necklace", "earring", "bracelet", "ring"]],
      ]) {
        await require('./fixed-navigation-fixture.cjs').press(page,`[data-filter="${filter}"]`);
        const ids = await page
          .locator(".inventory-item")
          .evaluateAll((rows) => rows.map((x) => x.dataset.itemId));
        const expected = state.inventory
          .filter((i) => slots.includes(i.slot))
          .map((x) => x.id);
        assert.deepEqual([...ids].sort(), expected.sort());
      }
      await require('./fixed-navigation-fixture.cjs').press(page,'[data-filter="all"]');
      for (const order of ["rarity", "itemLevel"]) {
        await page.locator("#inventory-sort").selectOption(order);
        const ids = await page
          .locator(".inventory-item")
          .evaluateAll((rows) => rows.map((x) => x.dataset.itemId));
        const values = ids.map((id) => {
          const i = state.inventory.find((x) => x.id === id);
          return order === "itemLevel"
            ? i.itemLevel
            : ["Comune", "Non comune", "Raro", "Epico", "Leggendario"].indexOf(
                i.rarity,
              );
        });
        assert.deepEqual(
          values,
          [...values].sort((a, b) => b - a),
        );
      }
      for (const [id, text] of [
        ["ring-dusk", "schivata"],
        ["thorn-quiver", "Sanguinamento"],
        ["book", "barriera"],
      ]) {
        await open(id);
        assert.match(
          await page.locator(".effect").innerText(),
          new RegExp(text),
        );
        await close();
      }
      // Empty-slot browse + persistent appearance settings.
      await screen("equipment");
      await page.locator('#equipment-grid [data-open-slot="head"]').tap();
      assert.match(await page.locator("#slot-filter").innerText(), /Copricapo/);
      assert.equal(await page.locator(".inventory-item").count(), 1);
      await page.locator('[data-item-id="head-chain"]').tap();
      await page.locator("#equip-item").tap();
      await close();
      await screen("inventory");
      await screen("character");
      await page.locator('[data-key="hair"][data-id="crest"]').tap();
      await page.locator('[data-key="hairColor"][data-id="copper"]').tap();
      await page.locator('[data-key="eyes"][data-id="sage"]').tap();
      await screen("equipment");
      await page.locator('[data-equipment-dye="wine"]').tap();
      const persisted = await model();
      assert.equal(persisted.character.hair, "crest");
      assert.equal(persisted.equipmentAppearance.dye, "wine");
      assert.deepEqual(
        await page.evaluate(() =>
          JSON.parse(localStorage.getItem(Equipment.SAVE_KEY)),
        ),
        persisted,
      );
      await page.reload();
      assert.deepEqual(await model(), persisted);
      // Appearance and equipment identities may differ without changing stats (future glamour architecture).
      assert.ok(
        await page.evaluate(() => {
          const raw = JSON.parse(JSON.stringify(Equipment.state));
          raw.equipment.torso.appearanceItem = "torso-warden";
          const restored = Equipment.normalize(raw);
          return (
            restored.equipment.torso.equippedItem === "torso-chain" &&
            restored.equipment.torso.appearanceItem === "torso-warden" &&
            JSON.stringify(restored.resultingStats) ===
              JSON.stringify(Equipment.state.resultingStats)
          );
        }),
      );
      // Dye isolation and motion preference remain intact.
      assert.ok(
        await page.evaluate(() =>
          [...document.querySelectorAll('#rig [fill="var(--dye)"]')].every(
            (x) => x.closest("[data-layer]").dataset.layer === "torso",
          ),
        ),
      );
      assert.equal(
        await page
          .locator("#rig")
          .evaluate((x) => getComputedStyle(x).animationName),
        "none",
      );
      for (const name of ["character", "equipment", "inventory"])
        await screen(name);
      if (width === 390) {
        // Exercise every catalogue item and its available modular representation.
        const catalogue = (await model()).inventory;
        for (const item of catalogue) {
          if (["cloth", "leather"].includes(item.armorType)) {
            await open(item.id);
            assert.match(
              await page.locator("#item-dialog .compatibility").innerText(),
              /solamente armature/,
            );
            const before = await model();
            await page.locator("#equip-item").tap();
            assert.deepEqual(await model(), before);
            await close();
            continue;
          }
          if (item.armorType)
            await page.evaluate(
              (type) =>
                ClassSystem.selectClass(type === "plate" ? "warden" : "hunter"),
              item.armorType,
            );
          if (item.slot === "support") {
            const main = catalogue.find(
              (i) =>
                i.slot === "weapon" &&
                i.handedness === "1H" &&
                i.allowedSupports.includes(item.type),
            );
            await equip(main.id);
          }
          await equip(item.id);
          const after = await model();
          const slot = Object.keys(after.equipment).find(
            (s) => after.equipment[s].equippedItem === item.id,
          );
          assert.ok(slot, `${item.name} not equipped`);
          const layer = slot === "mainHand" ? "weapon" : slot;
          assert.equal(
            await page
              .locator(`#rig [data-layer="${layer}"]`)
              .getAttribute("data-item"),
            item.id,
          );
          assert.ok(
            await page
              .locator(`#rig [data-layer="${layer}"]`)
              .evaluate((g) => g.childElementCount > 0),
          );
        }
        await screen("character");
        const gearBeforeRandom = (await model()).equipment;
        await page.locator("#random").tap();
        assert.deepEqual((await model()).equipment, gearBeforeRandom);
        console.log(
          "PASS 390px: all 56 demo items tested by touch (usable equipped, Cloth/Leather rejected); all associated SVG layers present; random appearance preserves gear",
        );
      }
      await page.evaluate(() => ClassSystem.selectClass("hunter"));
      await navigate(page, "debug");await page.locator("#reset-demo").tap();
      assert.deepEqual(await model(), initial);
      await page.reload();
      assert.deepEqual(await model(), initial);
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${width}px: compatibility (all weapon/support families), 2H locks/returns, paired slots, armor equip/unequip, totals/power, comparison, filters/sorting, effects, persistence, reset, touch, overflow, modular DOM and motion`,
      );
      await page.close();
    }
    // Storage denial is handled; malformed state cannot create duplicate/invalid slot ownership.
    const p = await browser.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Denied", "SecurityError");
        },
      }),
    );
    await p.goto(baseURL);
    await navigate(p, "character");
    await p.locator("#save").click();
    assert.match(await p.locator("#notice").innerText(), /non disponibile/);
    assert.deepEqual(errors, []);
    await p.close();
    const recovery = await browser.newPage();
    await recovery.goto(baseURL);
    assert.ok(
      await recovery.evaluate(() => {
        const raw = JSON.parse(JSON.stringify(Equipment.state));
        raw.equipment.mainHand = {
          equippedItem: "staff",
          appearanceItem: "staff",
        };
        raw.equipment.support = {
          equippedItem: "shield",
          appearanceItem: "shield",
        };
        raw.equipment.ringLeft = {
          equippedItem: "ring-dusk",
          appearanceItem: "ring-dusk",
        };
        raw.equipment.ringRight = {
          equippedItem: "ring-dusk",
          appearanceItem: "ring-dusk",
        };
        raw.resultingStats.force = 999;
        const result = Equipment.normalize(raw);
        return (
          result.equipment.support.equippedItem === null &&
          result.equipment.ringRight.equippedItem === null &&
          result.resultingStats.force !== 999
        );
      }),
    );
    await recovery.close();
    console.log("PASS storage denied and invalid-state recovery");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
