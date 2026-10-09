/* Sprint 2 behavior/payload guard; no screenshots or generated files in the checkout. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const {audit}=require('./contextual-scroll-fixture.cjs'),{press}=require('./fixed-navigation-fixture.cjs');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8000';
const scenes=fs.readdirSync(path.join(__dirname,'../assets/environments')).filter(f=>f.endsWith('.svg'));
assert.equal(scenes.length,7);let bytes=0;
for(const file of scenes){const svg=fs.readFileSync(path.join(__dirname,'../assets/environments',file),'utf8');bytes+=Buffer.byteLength(svg);assert.ok(!/<(?:script|filter|image|foreignObject)\b/i.test(svg),'Lightweight local vector art');}
assert.ok(bytes<30000,'Environmental artwork payload budget');
const luminance=hex=>{const values=hex.trim().replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
(async()=>{const b=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430]){
  const p=await b.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true}),errors=[],failedRequests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().startsWith(url)&&r.status()>=400)failedRequests.push(r.status()+' '+r.url());});
  await p.addInitScript(()=>{window.rejections=[];addEventListener('unhandledrejection',e=>rejections.push(String(e.reason)));});await p.goto(url);await p.waitForTimeout(120);
  assert.ok(await p.locator('body').evaluate(n=>n.classList.contains('nymeria-theme')));
  const colors=await p.evaluate(()=>{const c=getComputedStyle(document.documentElement);return ['--ny-stone','--ny-parchment','--ny-muted','--ny-gold','--ny-danger'].map(key=>c.getPropertyValue(key));});
  for(const color of colors.slice(1)){const contrast=(luminance(color)+.05)/(luminance(colors[0])+.05);assert.ok(contrast>=4.5,'Text token contrast '+contrast);}
  const saved=await p.evaluate(()=>JSON.stringify({...localStorage}));
  const gameData=await p.evaluate(()=>JSON.stringify([WorldData,QuestData.quests,ProfessionData.recipes,Equipment.state]));
  await p.evaluate(()=>{WorldUI.render();WorldUI.render();InventoryUI.render();ProfessionUI.render();});await p.waitForTimeout(100);
  assert.equal(await p.locator('.ny-profession-seal').count(),await p.locator('.profession-card').count(),'Emblems survive direct/asynchronous row replacement');
  assert.equal(await p.evaluate(()=>JSON.stringify({...localStorage})),saved,'Decoration cannot save');
  assert.equal(await p.evaluate(()=>JSON.stringify([WorldData,QuestData.quests,ProfessionData.recipes,Equipment.state])),gameData,'Decoration cannot mutate game data');
  for(const height of [375,568,844]){
   await p.setViewportSize({width,height});
   for(const screen of ['character','inventory','equipment','class','professions','journal','menu','world']){
    await p.evaluate(screen=>{if(['character','inventory','menu','world'].includes(screen))NymeriaNavigation.root(screen);else if(screen==='journal')NymeriaNavigation.open('world',{view:'journal'});else NymeriaNavigation.open(screen);},screen);await p.waitForTimeout(90);await audit(p);
    const controls=await p.locator('.bottom-nav').boundingBox();assert.ok(controls.y+controls.height<=height);
   }
  }
  await p.setViewportSize({width,height:844});await p.evaluate(()=>NymeriaNavigation.root('world'));await p.waitForTimeout(100);
  assert.equal(await p.locator('.ny-place-banner').getAttribute('data-ny-place'),'veyra');
  const backgrounds=await p.evaluate(async()=>{const files=['veyra','broken-path','lantern-wood','elar-ruins','vesper-ford','silent-tower','vesper-outpost'];return Promise.all(files.map(async id=>{const r=await fetch('assets/environments/'+id+'.svg');const text=await r.text();return {id,ok:r.ok,xml:!new DOMParser().parseFromString(text,'image/svg+xml').querySelector('parsererror')};}));});assert.ok(backgrounds.every(x=>x.ok&&x.xml));
  await press(p,'#world-location-detail [data-world-talk="bram"]');
  assert.ok(await p.locator('[data-ny-npc="bram"] .ny-dialogue').isVisible(),'Talking must reveal the dialogue page immediately');
  assert.equal(await p.locator('[data-ny-npc="bram"] .ny-dialogue-name').innerText(),'Bram');
  assert.match(await p.locator('[data-ny-npc="bram"] .ny-dialogue').innerText(),/Il mio carro è sul Sentiero/);
  assert.equal(await p.locator('[data-world-talk="bram"]').getAttribute('aria-pressed'),'true');assert.ok(await p.locator('[data-ny-npc="bram"] .npc-seal svg').count());
  await p.locator('#tab-inventory').tap();await press(p,'[data-filter="weapons"]');
  const categories=await p.locator('.inventory-item').evaluateAll(nodes=>nodes.map(n=>n.dataset.nyItem));assert.ok(categories.length>0&&categories.every(x=>x==='weapons'));
  await p.evaluate(async()=>{ClassSystem.selectClass('hunter');Equipment.equip('bow','mainHand');Equipment.equip('quiver','support');await WorldSystem.enter('broken-path');await WorldSystem.startEncounter('vesper-raider');NymeriaNavigation.open('world',{view:'battle'});WorldUI.resume();WorldUI.engine.advance(2);});await p.locator('#world-battle-pause').tap();await p.waitForTimeout(100);
  assert.equal(await p.locator('.ny-battle-vignette').getAttribute('data-ny-place'),'broken-path');assert.ok(await p.locator('.ny-battle-vignette').isVisible());
  assert.match(await p.locator('.ny-battle-vignette .visual-enemy').getAttribute('src'),/assets\/enemies\/raider\.svg/);
  const damage=await p.evaluate(()=>WorldUI.engine.metrics.damage);assert.equal(await p.locator('#world-damage-dealt').innerText(),String(damage));
  for(const height of [375,508,844]){
   await p.setViewportSize({width,height});await p.waitForTimeout(100);await audit(p);
   if(height<520)assert.ok(await p.locator('.ny-battle-vignette').isHidden());
   for(const id of ['world-player-hp','world-enemy-hp','world-resource-value','world-recent-player','world-recent-enemy','world-battle-pause','world-battle-resume','world-battle-abandon','world-history-toggle']){const r=await p.locator('#'+id).boundingBox();assert.ok(r&&r.y>=0&&r.y+r.height<=height,id+' reachable');}
  }
  await p.locator('#world-history-toggle').tap();await p.waitForTimeout(100);assert.ok(await p.locator('.ny-battle-vignette').isHidden());await audit(p);
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.visual-enemy').evaluate(n=>getComputedStyle(n).animationName),'none');
  const ticket=await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id);await p.reload();await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id),ticket);await audit(p);
  assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(await p.evaluate(()=>rejections),[]);
  await p.close();console.log(`PASS identity ${width}: contrast, SVG payload/local paths, immutable saves/data, all sections/3 heights, NPC speech/emblems, item categories, existing battle assets/adaptive HUD/reload/reduced-motion`);
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
