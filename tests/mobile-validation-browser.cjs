/* Browser-only lifecycle/performance evidence; never label this a native test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { press } = require('./fixed-navigation-fixture.cjs');
const { audit, swipe } = require('./contextual-scroll-fixture.cjs');
const url = process.env.NYMERIA_TEST_URL || 'http://127.0.0.1:8018';

(async () => {
  const browser = await chromium.launch({executablePath: process.env.NYMERIA_CHROMIUM || '/usr/bin/chromium', args:['--no-sandbox']});
  const report = {environment:'headless Chromium on Linux/CI; simulated touch, not iPhone', browser:browser.version(), samples:[]};
  try {
    for (const width of [320,375,390,430]) {
      const context = await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        window.validationRejections = [];
        addEventListener('unhandledrejection', e => validationRejections.push(String(e.reason)));
        window.validationLongTasks = [];
        new PerformanceObserver(list => validationLongTasks.push(...list.getEntries().map(e => e.duration))).observe({type:'longtask',buffered:true});
      });
      const began = performance.now();
      await page.goto(url);
      await page.waitForFunction(() => typeof Character !== 'undefined' && typeof NymeriaNavigation !== 'undefined');
      await page.evaluate(() => Character.ready());
      assert.deepEqual(await page.evaluate(()=>Character.diagnostics()),[]);
      const startupMs = performance.now() - began;
      await press(page,'#tab-character');
      await press(page,'#save');
      await page.waitForFunction(() => Equipment.state.characterCreated);
      const routeMs = {};
      for (const route of ['inventory','missions','menu','character','world']) {
        const start = performance.now();
        await page.locator('#tab-'+route).tap();
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        routeMs[route] = performance.now()-start;
        await audit(page);
      }
      await press(page,'#tab-character');
      const beforeAvatar = await page.locator('#character').innerHTML();
      const candidate = await page.evaluate(() => {
        for (const slot of ['torso','legs','boots','mainHand']) {
          const item = Equipment.state.inventory.find(i => i.id !== Equipment.equipped(slot)?.id && !Equipment.canEquip(i.id,slot) && BuildSystem.compatible(i,ClassSystem.state.classId));
          if (item) return {slot,id:item.id};
        }
      });
      assert.ok(candidate,'A real compatible alternate piece exists');
      await press(page,'[data-nav="equipment"]');
      await press(page,'[data-open-slot="'+candidate.slot+'"]');
      await press(page,'[data-item-id="'+candidate.id+'"]');
      await press(page,'#equip-item');
      assert.equal(await page.evaluate(slot => Equipment.equipped(slot)?.id,candidate.slot),candidate.id);
      await press(page,'#tab-character');
      await page.waitForFunction(old => document.querySelector('#character').innerHTML !== old,beforeAvatar);
      await page.evaluate(()=>Character.ready());
      assert.deepEqual(await page.evaluate(()=>Character.diagnostics()),[]);
      await press(page,'#tab-inventory');
      await swipe(page,page.locator('#panel-inventory'));
      const saved = await page.evaluate(() => localStorage.getItem(Equipment.SAVE_KEY));
      for (const height of [568,667,844]) {
        await page.setViewportSize({width,height});
        await page.waitForTimeout(100);
        await audit(page);
        const boxes = await page.locator('.bottom-nav button').evaluateAll(ns => ns.map(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height,b:r.bottom};}));
        assert.ok(boxes.every(b=>b.w>=44 && b.h>=44 && b.b<=height+1));
      }
      // Context offline cannot load a fresh HTTP app; this tests already loaded UI/saves only.
      await context.setOffline(true);
      await press(page,'#tab-character');
      assert.equal(await page.evaluate(() => localStorage.getItem(Equipment.SAVE_KEY)),saved);
      await context.setOffline(false);
      // New page in the same browser storage context models reopening, not OS process death.
      assert.deepEqual(await page.evaluate(()=>validationRejections),[]);
      const longTasks = await page.evaluate(()=>validationLongTasks);
      await page.close();
      const reopened = await context.newPage();
      reopened.on('pageerror',e=>errors.push(e.message));
      await reopened.goto(url); await reopened.evaluate(()=>Character.ready());
      assert.equal(await reopened.evaluate(()=>localStorage.getItem(Equipment.SAVE_KEY)),saved);
      assert.equal(await reopened.evaluate(()=>Equipment.state.characterCreated),true);
      assert.equal(await reopened.evaluate(slot=>Equipment.equipped(slot)?.id,candidate.slot),candidate.id);
      assert.deepEqual(errors,[]);
      const session = await context.newCDPSession(reopened);
      await session.send('Performance.enable');
      const metrics = (await session.send('Performance.getMetrics')).metrics;
      report.samples.push({width,startupMs,routeMs,longTasksMs:longTasks,heapUsedBytes:metrics.find(m=>m.name==='JSHeapUsedSize')?.value});
      await context.close();
      console.log('PASS mobile validation '+width+': real UI equip/avatar, touch/internal scroll, viewport heights, offline loaded UI and reopen persistence');
    }
    for (const fault of ['read-denied','write-denied','corrupt']) {
      const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(mode=>{
        if(mode==='corrupt') localStorage.setItem('nymeria.equipment.v1','{invalid');
        else Storage.prototype[mode==='read-denied'?'getItem':'setItem']=()=>{throw new DOMException('Validation fault','QuotaExceededError');};
      },fault);
      await page.goto(url); await page.evaluate(()=>Character.ready());
      await press(page,'#tab-character'); await press(page,'#save');
      if (fault==='write-denied') {
        assert.equal(await page.evaluate(()=>Equipment.state.characterCreated),false);
        assert.match(await page.locator('#notice').innerText(),/Salvataggio non disponibile/);
      }
      await page.locator('#tab-inventory').tap(); assert.ok(await page.locator('#panel-inventory').isVisible());
      assert.deepEqual(errors,[]);await page.close();console.log('PASS mobile storage fault '+fault+': interactive UI, no blank screen');
    }
    fs.mkdirSync('test-results',{recursive:true});
    fs.writeFileSync('test-results/mobile-browser-performance.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
