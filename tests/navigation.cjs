/* Cold-load tab regression, independent of the inventory test helpers.
   Also verify asset versioning and isolate navigation from module failures. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const baseURL = process.env.NYMERIA_TEST_URL || "http://127.0.0.1:8000";
const modules = [
  "profession-data.js",
  "profession-system.js",
  "profession-ui.js",
  "guild-data.js",
  "guild-system.js",
  "guild-ui.js",
  "guild-project-data.js",
  "guild-project-system.js",
  "guild-project-ui.js",
  "world-discovery.js",
  "world-discovery-ui.js",
  "equipment-data.js",
  "equipment.js",
  "character.js",
  "inventory.js",
  "app.js",
  "combat-data.js",
  "combat-engine.js",
  "combat-ui.js",
  "classes-data.js",
  "build-system.js",
  "class-system.js",
  "class-ui.js",
  "armor-rules.js",
  "personal-loot.js",
  "progression-data.js",
  "progression-store.js",
  "progression-system.js",
  "expedition-data.js",
  "expedition-engine.js",
  "expedition-ui.js",
  "world-data.js",
  "quest-data.js",
  "quest-events.js",
  "quest-system.js",
  "world-system.js",
  "quest-ui.js",
  "world-ui.js",
  "progression-events.js",
  "notification-system.js",
  "notification-ui.js",
  "mobile-ui.js",
];

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.NYMERIA_CHROMIUM || "/usr/bin/chromium",
    args: ["--no-sandbox"],
    headless: true,
  });
  try {
    async function scenario(name, configure, touch) {
      // New context = no previous storage, cookies, HTTP cache or warmed application.
      const context = await browser.newContext(
        touch
          ? {
              viewport: { width: touch, height: 844 },
              isMobile: true,
              hasTouch: true,
            }
          : { viewport: { width: 1280, height: 900 } },
      );
      const page = await context.newPage();
      const errors = [],
        requests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => requests.push(new URL(request.url())));
      if (configure) await configure(page);
      assert.equal((await page.goto(baseURL)).status(), 200);
      async function activate(screen) {
        const root = ["character", "world", "expeditions", "menu"].includes(screen);
        if (root) await page.locator("#tab-" + screen).click();
        else { await page.locator("#tab-character").click(); await page.locator(`[data-nav="${screen}"]`).click(); }
        for(const other of ["character","equipment","inventory","class","expeditions","world","menu"]){
          const panel=page.locator("#panel-"+other);
          assert.equal(await panel.isVisible(),other===screen,`${name}: ${other}`);
          assert.equal(await panel.evaluate(e=>e.hidden),other!==screen);
        }
        const activeRoot=root?screen:"character";
        for(const other of ["character","world","expeditions","menu"]) assert.equal(await page.locator("#tab-"+other).getAttribute("aria-selected"),String(other===activeRoot));
      }
      assert.ok(await page.locator("#panel-world").isVisible());
      for(const id of ["inventory","equipment","class","expeditions","world","menu","character"])await activate(id);
      if (!configure) {
        assert.deepEqual(errors, []);
        assert.equal(
          await page.locator("#equipment-grid .slot-card").count(),
          16,
        );
        assert.equal(
          await page.locator("#inventory-grid .inventory-item").count(),
          56,
        );
      }
      const assets = requests.filter((url) => /\.(js|css)$/.test(url.pathname));
      assert.equal(assets.length, 52);
      const devAssets = new Set(["kaelith-dev.css", "kaelith-dev.js", "modular-proof.js"]);
      assert.equal(assets.filter((url) => devAssets.has(url.pathname.split("/").pop())).length, 3);
      assert.ok(
        assets.every((url) =>
          url.searchParams.get("v") ===
          (devAssets.has(url.pathname.split("/").pop()) ? "1" : "mobile-quest-ux-1")
        ),
      );
      console.log(
        `PASS ${name}: panel visibility + hidden + aria-selected; versioned assets`,
      );
      await context.close();
    }
    await scenario("desktop cold load", null, false);
    for (const width of [320, 390, 430])
      await scenario(`mobile ${width}px cold load`, null, width);
    // A failed module must never prevent tab events from being connected.
    for (const file of modules) {
      await scenario(
        `${file} startup exception`,
        (page) =>
          page.route(`**/${file}?*`, (route) =>
            route.fulfill({
              contentType: "application/javascript",
              body: `throw new Error('Injected startup failure: ${file}');`,
            }),
          ),
        false,
      );
    }
    // Syntax errors and failed network loads occur before module initialization.
    await scenario(
      "equipment.js parse failure",
      (page) =>
        page.route("**/equipment.js?*", (route) =>
          route.fulfill({
            contentType: "application/javascript",
            body: "const Equipment = ;",
          }),
        ),
      false,
    );
    await scenario(
      "app.js network failure",
      (page) => page.route("**/app.js?*", (route) => route.abort()),
      false,
    );
    // Simulate the old unversioned cache entry: new HTML must never request it.
    let staleHits = 0;
    await scenario(
      "unversioned previous app.js cached",
      (page) =>
        page.route("**/app.js*", (route) => {
          const url = new URL(route.request().url());
          if (!url.search) {
            staleHits++;
            return route.fulfill({
              contentType: "application/javascript",
              body: "/* Previous app: no screen-tab listeners. */",
            });
          }
          return route.continue();
        }),
      false,
    );
    assert.equal(staleHits, 0);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
