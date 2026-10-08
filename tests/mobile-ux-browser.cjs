/* M6.2 actual touch routes, context stacks, state preservation and responsive feedback. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const dismiss = require('./notifications-fixture.cjs');
const base = process.env.NYMERIA_TEST_URL || 'http://127.0.0.1:8004';
const shot = async (p, name, width, cls) => { if (width === 390 && cls === 'hunter') await p.screenshot({path:`/tmp/nymeria-m62-${name}-390.png`,fullPage:true,animations:'disabled'}); };
(async()=>{
 const browser = await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM || '/usr/bin/chromium',args:['--no-sandbox']});
 try {
  for (const width of [320,390,430]) for (const cls of ['hunter','warden']) {
   const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
   const page=await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-10-06T12:00:00Z')}); await page.clock.pauseAt(new Date('2026-10-06T12:00:01Z'));
   await page.goto(base); await page.emulateMedia({reducedMotion:'reduce'});
   const tap=async selector=>{await dismiss(page);await page.locator(selector+':visible').tap();await page.evaluate(async()=>{if(navigator.locks)await navigator.locks.request("nymeria-progression",()=>{});});await page.waitForFunction(()=>document.getElementById('panel-world').getAttribute('aria-busy')==='false');};
   const overflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px overflow`);
   assert.equal(await page.evaluate(()=>document.body.dataset.screen),'world');
   assert.equal(await page.locator('.bottom-nav [data-screen]').count(),4);
   assert.ok(await page.locator('#world-current').isVisible());
   assert.match(await page.locator('#world-current').innerText(),/Avamposto di Veyra/);
   assert.ok(await page.locator('#world-locations').isHidden());
   assert.ok(await page.locator('#menu-debug-link').isHidden());
   assert.ok(await page.locator('#world-debug').isHidden());
   await page.evaluate(cls=>{ClassSystem.selectClass(cls);},cls);
   await shot(page,'veyra',width,cls);
   // Create through the actual character hub. No creator elsewhere; lock survives refresh.
   await tap('#tab-character'); assert.ok(await page.locator('#character-creator').isVisible());
   await tap('[data-key="hair"][data-id="crest"]'); await tap('#save');
   assert.ok(await page.locator('#character-creator').isHidden());
   await page.reload(); assert.equal(await page.evaluate(()=>NymeriaNavigation.route.screen),'world');
   await tap('#tab-character'); assert.ok(await page.locator('#character-creator').isHidden());
   assert.equal(await page.evaluate(()=>Equipment.state.character.hair),'crest');
   await shot(page,'character',width,cls);
   await tap('[data-nav="class"]'); assert.ok(await page.locator('#panel-class').isVisible());
   await tap(cls==='hunter'?'[data-build-id="lacerator"]':'[data-build-id="bulwark"]');
   if(!(await page.locator('.strategy-settings').evaluate(e=>e.open))) await tap('.strategy-settings > summary'); await tap('[data-combat-mode="custom"]');
   assert.equal(await page.evaluate(()=>CombatUI.settings.mode),'custom');
   await tap('[data-combat-mode="auto"]'); await tap('#navigation-back');
   assert.equal(await page.evaluate(()=>NymeriaNavigation.route.screen),'character');
   await tap('[data-nav="equipment"]'); assert.equal(await page.locator('#equipment-grid [data-open-slot]').count(),16);
   await shot(page,'equipment',width,cls);
   await tap('[data-open-slot="mainHand"]');
   assert.equal(await page.evaluate(()=>NymeriaNavigation.route.slot),'mainHand');
   assert.ok((await page.evaluate(()=>InventoryUI.visibleItems().every(i=>BuildSystem.compatible(i,ClassSystem.state.classId)&&Equipment.compatibleSlots(i).includes('mainHand')))));
   await tap(`[data-item-id="${cls==='hunter'?'bow':'sword'}"]`);
   if(await page.locator('#equip-item').isDisabled()) { await tap('#close-detail');await tap('#navigation-back'); }
   else {await tap('#equip-item');assert.ok(await page.locator('#panel-equipment').isVisible());assert.ok(await page.locator('#item-dialog').isHidden());}
   await tap('[data-open-slot="support"]');await tap(`[data-item-id="${cls==='hunter'?'quiver':'shield'}"]`);await tap('#equip-item');
   assert.ok(await page.locator('#panel-equipment').isVisible());
   for(const [slot,id] of Object.entries(cls==='hunter'?{torso:'torso-chain',legs:'legs-chain',boots:'boots-chain'}:{torso:'torso-warden',legs:'legs-sentinel',boots:'boots-plate'})) {
    await tap(`[data-open-slot="${slot}"]`);
    assert.ok(await page.evaluate(()=>InventoryUI.visibleItems().every(i=>!ArmorRules.unavailableLabel(i,ClassSystem.selected()))));
    await tap(`[data-item-id="${id}"]`);if(await page.locator('#equip-item').isDisabled()){await tap('#close-detail');await tap('#navigation-back');}else await tap('#equip-item');
   }
   await tap('#navigation-back');assert.equal(await page.evaluate(()=>NymeriaNavigation.route.screen),'character');
   await tap('[data-nav="inventory"]');assert.equal(await page.locator('.inventory-item').count(),56);
   // Unfiltered inventory retains foreign-class items and feedback.
   await tap(`[data-item-id="${cls==='hunter'?'torso-warden':'torso-chain'}"]`);
   assert.match(await page.locator('#detail-body').innerText(),/solamente armature|Non utilizzabile/);
   await tap('#close-detail');await tap('#navigation-back');
   await tap('#tab-world'); await tap('#world-tracked [data-quest-accept="mq01"]');await tap('#world-location-detail [data-world-talk="serah"]');
   assert.match(await page.locator('#world-location-detail').innerText(),/Non chiedo promesse/);
   assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.quests.mq01.progress[0]),1);
   await tap('[data-world-enter="broken-path"]');
   assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.location),'broken-path');
   assert.ok(await page.locator('#world-location-detail [data-world-enter="lantern-wood"]').isDisabled());
   assert.match(await page.locator('#world-location-detail [data-world-enter="lantern-wood"]').innerText(),/Nessuno è tornato/);
   assert.ok(await page.locator('#badge-world').isVisible());
   await tap('#world-tracked [data-quest-claim="mq01"]');await tap('#world-tracked [data-quest-accept="mq02"]');
   assert.match(await page.locator('#world-tracked').innerText(),/Nessuno è tornato/);
   assert.ok(await page.locator('#world-location-detail [data-world-fight="vesper-raider"]').evaluate(e=>e.classList.contains('quest-relevant')));
   assert.ok(await page.evaluate(()=>document.querySelector('.world-enemies').getBoundingClientRect().top < document.querySelector('.world-point').getBoundingClientRect().top));
   await shot(page,'sentiero',width,cls);
   const loc=await page.evaluate(()=>ProgressionStore.state.frontier.location);
   await tap('[data-world-view="journal"]');await shot(page,'journal',width,cls);
   assert.equal(await page.locator('.journal-entry').count(),await page.evaluate(()=>QuestData.quests.length));
   await tap('.journal-entry[data-quest-open="mq02"]');assert.ok(await page.locator('#quest-detail').isVisible());
   assert.match(await page.locator('#quest-detail').innerText(),/XP.*Corone/s);
   await tap('#navigation-back');assert.ok(await page.locator('#quest-journal').isVisible());assert.equal(await page.evaluate(()=>document.activeElement.dataset.questOpen),'mq02');assert.equal(await page.evaluate(()=>document.activeElement.tabIndex),0);
   await tap('#navigation-back');assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.location),loc);
   assert.ok(await page.locator('#world-current').isVisible());
   // Battle is a secondary world route, snapshots retain custom strategy.
   await tap('#tab-character');await tap('[data-nav="class"]');if(!(await page.locator('.strategy-settings').evaluate(e=>e.open))) await tap('.strategy-settings > summary');await tap('[data-combat-mode="custom"]');await tap('#tab-world');
   await tap('#world-location-detail [data-world-fight="vesper-raider"]');assert.ok(await page.locator('#world-battle').isVisible());assert.ok(await page.locator('#world-location-detail').isHidden());
   assert.deepEqual(await page.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.snapshot.rules),await page.evaluate(()=>CombatUI.settings.rules));
   await shot(page,'combat',width,cls);
   const ticket=await page.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id);
   await tap('#world-battle-pause');await tap('#navigation-back');assert.ok(await page.locator('#world-active-link').isVisible());await tap('#world-active-link');await page.reload();assert.ok(await page.locator('#world-battle').isVisible());
   assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id),ticket);
   await tap('#world-battle-resume');await page.evaluate(async()=>{WorldUI.engine.advance(180);await WorldUI.settle();});
   assert.ok(await page.locator('#world-result').isVisible());
   assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.lastEncounter.outcome),'victory');
   const xp=await page.evaluate(()=>ProgressionStore.state.totalXP);await tap('[data-world-continue]');
   assert.ok(await page.locator('#world-current').isVisible());assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.location),loc);
   assert.equal(await page.evaluate(()=>ProgressionStore.state.totalXP),xp);
   // Feedback on all four roots; central XP calls use class data.
   for(const id of ['character','world','expeditions','menu']) {
    await tap('#tab-'+id);
    await page.evaluate(async()=>{await ProgressionStore.transact(s=>{s.totalXP+=s.requiredXP-s.currentXP;return {ok:true};});});
    assert.ok(await page.locator('#global-notifications').isVisible());
    assert.match(await page.locator('#global-notifications').innerText(),/LIVELLO AUMENTATO/);
    const expected=cls==='hunter'?/\+3 Agilità[\s\S]*\+1 Vigor[\s\S]*\+0,5% Critico/:/\+2 Forza[\s\S]*\+3 Vigor[\s\S]*\+1 Spirito/;
    assert.match(await page.locator('#global-notifications').innerText(),expected);
    assert.equal(await page.locator('.notification-card').evaluate(e=>getComputedStyle(e).animationName),'none');await dismiss(page);await overflow();
   }
   await tap('#tab-expeditions');await shot(page,'activities',width,cls);
   await tap('[data-start-expedition="patrol"]');assert.ok(await page.locator('#expedition-running').isVisible());
   const ends=await page.evaluate(()=>ProgressionStore.state.activeExpedition.endsAt);
   await tap('#tab-menu');await page.clock.fastForward(ends-await page.evaluate(()=>Date.now())+1000);
   await page.evaluate(()=>ProgressionSystem.refresh());assert.ok(await page.locator('#badge-activities').isVisible());
   await tap('#tab-expeditions');assert.ok(await page.locator('#expedition-claim').isVisible());await tap('#expedition-claim');
   assert.ok(await page.locator('#badge-activities').isHidden());await dismiss(page);
   await tap('#tab-menu');await shot(page,'menu',width,cls);await tap('[data-nav="discoveries"]');assert.ok(await page.locator('#world-discoveries').isVisible());await tap('#navigation-back');assert.ok(await page.locator('#panel-menu').isVisible());
   // Additive M6 save continuity: every game domain survives cold boot exactly.
   await page.evaluate(async()=>{await ProgressionStore.transact(s=>{s.frontier.discoveries.push('tablet_of_elar');s.frontier.achievements.push('frontier-conqueror');return {ok:true};});});
   await dismiss(page);const before=await page.evaluate(()=>({p:ProgressionStore.state,e:Equipment.state,c:ClassSystem.state}));
   await page.reload();await page.evaluate(()=>ProgressionSystem.refresh());
   const after=await page.evaluate(()=>({p:ProgressionStore.state,e:Equipment.state,c:ClassSystem.state}));
   // Ownership is a collection; normalization may restore catalogue order after a loot insert.
   before.e.inventory.sort((a,b)=>a.id.localeCompare(b.id));after.e.inventory.sort((a,b)=>a.id.localeCompare(b.id));
   assert.deepEqual(after,before);assert.ok(await page.locator('#global-notifications').isHidden());
   await tap('#tab-menu');await tap('[data-nav="discoveries"]');assert.match(await page.locator('#world-discovery-list').innerText(),/Tavoletta di Elar.*Archeologia 10/s);assert.match(await page.locator('#world-achievements').innerText(),/Conquistatore della Frontiera/);
   await tap('#navigation-back');await overflow();
   assert.ok(await page.locator('.bottom-nav').evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom===innerHeight&&r.height<100&&getComputedStyle(e).paddingBottom!=='0px';}));
   assert.ok(await page.locator('.bottom-nav button').evaluateAll(rows=>rows.every(e=>e.getBoundingClientRect().height>=44&&e.getBoundingClientRect().width>=44)));
   await page.locator('#tab-world').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-expeditions').getAttribute('aria-selected'),'true');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'tab-expeditions');
   assert.deepEqual(errors,[]);console.log(`PASS M6.2 ${width}px ${cls}: roots/hubs, slot flow, world/quest/NPC, contextual combat, activities/badges, feedback, persistence, touch/focus/reduced motion`);
   await context.close();
  }
  for(const cls of ['hunter','warden']) {
   const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
   await p.evaluate(async cls=>{ClassSystem.selectClass(cls);for(const slot of GearData.slots)Equipment.unequip(slot.id);Equipment.equip(cls==='hunter'?'bow':'sword','mainHand');Equipment.equip(cls==='hunter'?'quiver':'shield','support');await ProgressionStore.transact(s=>{s.unlockedContent.push('world:silent-tower');return{ok:true};});await WorldSystem.enter('silent-tower');},cls);
   const before=await p.evaluate(()=>({xp:ProgressionStore.state.totalXP,crowns:ProgressionStore.state.crowns}));
   await p.locator('[data-world-fight="silence-keeper"]:visible').tap();await p.waitForFunction(()=>!!ProgressionStore.state.frontier.activeEncounter);
   await p.evaluate(async()=>{WorldUI.engine.advance(180);await WorldUI.settle();});assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.lastEncounter.outcome),'defeat');
   assert.deepEqual(await p.evaluate(()=>({xp:ProgressionStore.state.totalXP,crowns:ProgressionStore.state.crowns})),before);assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.location),'veyra');
   await p.locator('[data-world-continue]').tap();await p.waitForFunction(()=>ProgressionStore.state.frontier.location==='silent-tower');assert.ok(await p.locator('#world-current').isVisible());assert.deepEqual(errors,[]);await p.close();
   console.log('PASS '+cls+' contextual defeat: zero rewards, Veyra rule retained, Continue returns to encounter origin');
  }
  const debug=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await debug.goto(base+'/?test=1');await debug.locator('#tab-menu').tap();assert.ok(await debug.locator('#menu-debug-link').isVisible());await debug.locator('#menu-debug-link').tap();assert.ok(await debug.locator('#world-debug').isVisible());assert.ok(await debug.locator('#expedition-debug').isVisible());await debug.locator('[data-nav="combat"]').tap();assert.ok(await debug.locator('#panel-combat').isVisible());await debug.close();console.log('PASS DEBUG only via Menu in ?test=1');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
