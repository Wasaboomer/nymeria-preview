const path=require('node:path');const root=path.resolve(__dirname,'..');const screenshotDir=process.env.NYMERIA_SCREENSHOT_DIR;if(screenshotDir)require('node:fs').mkdirSync(screenshotDir,{recursive:true});const {spawn}=require('node:child_process');const server=spawn('python3',['-m','http.server','8017','--bind','127.0.0.1','--directory',root]);process.on('exit',()=>server.kill());
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 await new Promise((resolve,reject)=>{const start=async()=>{try{if((await fetch('http://127.0.0.1:8017')).ok)return resolve()}catch{}setTimeout(start,100)};start();setTimeout(()=>reject(Error('server timeout')),5000).unref()});
 const browser=await chromium.launch({headless:true,executablePath:process.env.NYMERIA_CHROMIUM || '/usr/bin/chromium',args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});const results=[];
 for(const width of [320,390,430]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});let errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.text())});page.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url())});
  await page.goto('http://127.0.0.1:8017/index.html?kaelith=1');await page.locator('#tab-character').tap();
  const before=await page.evaluate(()=>({...localStorage}));
  await page.locator('[data-proof-mode="modular"]').tap();
  for(const [armor,weapon] of [['ranger','sword'],['peasant','sword'],['peasant','staff'],['ranger','staff']]){
   await page.locator(`[data-proof-armor="${armor}"]`).tap();await page.locator(`[data-proof-weapon="${weapon}"]`).tap();
   await page.locator('.stage').scrollIntoViewIfNeeded();
   await page.waitForFunction(({armor,weapon})=>{const v=document.querySelector('#modular-proof-viewer');return v?.loaded&&new URL(v.src,document.baseURI).pathname.endsWith(`/assets/modular-proof/${armor}-${weapon}.glb`)&&!document.querySelector('.proof-status').textContent.includes('Caricamento')},{armor,weapon},{timeout:30000}).catch(async e=>{console.log(await page.locator('.proof-status').textContent());if(screenshotDir)await page.screenshot({path:path.join(screenshotDir,'modular-error.png'),fullPage:true});throw e;});
   const dims=await page.locator('#modular-proof-viewer').evaluate(v=>v.getDimensions());assert(dims.y>1.5&&dims.x>.3);assert(!(await page.locator('.kaelith-original-figure').isVisible()));
   await page.locator('.stage').scrollIntoViewIfNeeded();await page.evaluate(()=>scrollBy(0,document.querySelector('.stage').getBoundingClientRect().top-80));await page.waitForTimeout(300);
   if(width===390&&screenshotDir)await page.locator('.stage').screenshot({path:path.join(screenshotDir,`Kaelith_DEV_modulare_${armor}_${weapon}.png`)});
   assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
  }
  await page.locator('[data-kaelith-view="public"]').tap();assert(await page.locator('.kaelith-original-figure').isVisible());assert(!(await page.locator('#modular-proof-viewer').isVisible()));
  await page.locator('[data-kaelith-view="character"]').tap();assert(await page.locator('#modular-proof-viewer').isVisible());
  await page.locator('[data-proof-mode="reference"]').tap();assert(await page.locator('.kaelith-original-figure').isVisible());assert(!(await page.locator('#modular-proof-viewer').isVisible()));
  assert.deepEqual(await page.evaluate(()=>({...localStorage})),before);assert.equal(errors.length,0,errors.join('\n'));results.push({width,combinations:4,publicProfile:'PASS',referenceRoundtrip:'PASS',storageUnchanged:true,errors});await page.close();
 }
 const plain=await browser.newPage();await plain.goto('http://127.0.0.1:8017/index.html');assert.equal(await plain.locator('.modular-proof').count(),0);await plain.close();
 await browser.close();server.kill();console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
