const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8009/nymeria';
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430]){
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/favicon.ico',route=>route.fulfill({status:204}));
 await page.addInitScript(()=>window.addEventListener('unhandledrejection',e=>{throw e.reason}));
 await page.goto(base+'/');const open=async()=>{await page.locator('#tab-menu').tap();await page.locator('[data-nav="guild"]').tap()};await open();
 assert.equal(await page.locator('#guild-projects-root').count(),0);
 await page.locator('#guild-create [name=name]').fill('Gilda <b>test</b>');await page.locator('#guild-create button').tap();await page.waitForSelector('.guild-project');
 assert.equal(await page.locator('.guild-project').count(),2);assert.equal(await page.locator('#guild-root b:has-text("test")').count(),0);
 await page.evaluate(()=>{const next=ProgressionStore.state;next.totalXP=80;localStorage.setItem('nymeria.progression.v1',JSON.stringify(next));ProgressionStore.refresh()});
 assert.equal(await page.evaluate(()=>ProgressionStore.state.level),2);assert.equal(await page.locator('.guild-project').count(),2);
 const economy=await page.evaluate(()=>JSON.stringify(ProgressionStore.state));
 const form=page.locator('[data-project-form="vesper-watchtower"]');await form.locator('[name=amount]').fill('10');await form.locator('button').tap();await page.waitForFunction(()=>GuildProjectSystem.state.projects['vesper-watchtower']?.progress.crowns===10);
 await page.evaluate(()=>ProgressionStore.refresh());assert.equal(await page.locator('.guild-project').count(),2);
 await page.locator('#guild-contribute [name=amount]').fill('1');await page.locator('#guild-contribute button').tap();await page.waitForFunction(()=>GuildSystem.state.guild.treasury.crowns===1);assert.equal(await page.locator('.guild-project').count(),2);
 await page.evaluate(async()=>{for(const p of GuildProjectData.projects)for(const k of Object.keys(p.requirements))await GuildProjectSystem.contribute(p.id,k,9999)});
 assert.equal(await page.locator('.guild-project.is-complete').count(),2);assert.equal(await page.locator('[data-project-form]').count(),0);
 assert.equal(await page.evaluate(()=>JSON.stringify(ProgressionStore.state)),economy);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.reload();await open();assert.equal(await page.locator('.guild-project.is-complete').count(),2);
 await page.locator('#navigation-back').tap();assert.ok(await page.locator('#panel-menu').isVisible());await page.locator('[data-nav="guild"]').tap();assert.equal(await page.locator('.guild-project.is-complete').count(),2);
 await page.evaluate(()=>{localStorage.setItem(GuildProjectEngine.KEY,'{broken');GuildProjectSystem.load()});assert.equal(await page.locator('.guild-project.is-complete').count(),0);
 const targets=await page.locator('.guild-project-form input,.guild-project-form select,.guild-project-form button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert.ok(targets.every(h=>h>=44));
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===GuildProjectEngine.KEY)throw Error('quota');return original.call(this,k,v)}});
 await form.locator('button').tap();await page.waitForFunction(()=>document.getElementById('guild-project-status').textContent.includes('non disponibile'));assert.equal(await page.evaluate(()=>Object.keys(GuildProjectSystem.state.projects).length),0);
 await page.evaluate(()=>{const old=GuildProjectSystem.contribute;GuildProjectSystem.contribute=()=>Promise.reject(Error('injected'));window.restoreProject=()=>GuildProjectSystem.contribute=old});
 await form.locator('button').tap();await page.waitForFunction(()=>document.getElementById('guild-project-status').textContent.startsWith('Operazione progetto'));await page.evaluate(()=>window.restoreProject());
 await page.evaluate(()=>{Storage.prototype.getItem=function(){throw Error('read')};GuildProjectSystem.load()});await form.locator('button').tap();await page.waitForFunction(()=>GuildProjectSystem.storageIssue);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS Guild Projects UI '+width+'px: new/existing guild mount, redraw, contribution, feedback, completion, persistence, navigation, corrupt/read/write failures, touch, economy isolation, no JS errors');
 }
 // A second tab cannot write the same simulated ledger or complete it twice.
 const c=await browser.newContext(),a=await c.newPage(),b=await c.newPage();await a.goto(base+'/');await b.goto(base+'/');
 assert.equal((await a.evaluate(()=>GuildProjectSystem.contribute('vesper-watchtower','crowns',10))).ok,true);
 assert.equal((await b.evaluate(()=>GuildProjectSystem.contribute('vesper-watchtower','crowns',10))).ok,false);
 await b.waitForFunction(()=>GuildProjectSystem.state.projects['vesper-watchtower']?.progress.crowns===10);await a.close();assert.equal((await b.evaluate(()=>GuildProjectSystem.contribute('vesper-watchtower','crowns',10))).ok,true);await c.close();console.log('PASS Guild Projects cross-tab single writer, synchronization and handoff');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
