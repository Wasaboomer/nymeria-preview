const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');const root=path.resolve(__dirname,'..');
const dir=process.env.NYMERIA_SCREENSHOT_DIR;if(dir)fs.mkdirSync(dir,{recursive:true});
const server=spawn('python3',['-m','http.server','8017','--bind','127.0.0.1','--directory',root]);process.on('exit',()=>server.kill());
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
(async()=>{
 await new Promise((resolve,reject)=>{const check=async()=>{try{if((await fetch('http://127.0.0.1:8017')).ok)return resolve()}catch{}setTimeout(check,100)};check();setTimeout(()=>reject(Error('server timeout')),5000).unref()});
 const browser=await chromium.launch({headless:true,executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
 const results=[];
 for(const width of [320,390,430]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const errors=[],downloads=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('.glb'))downloads.push(r.url())});
  await page.goto('http://127.0.0.1:8017/index.html?kaelith=1');await page.locator('#tab-character').tap();
  const stored=await page.evaluate(()=>({...localStorage}));await page.locator('[data-proof-mode="modular"]').tap();
  await page.locator('.stage').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('#modular-proof-viewer')?.loaded&&document.querySelector('.proof-status').textContent.startsWith('Anteprima aggiornata'),null,{timeout:60000});
  const snapshot=()=>page.locator('#modular-proof-viewer').evaluate(v=>Object.fromEntries(v.model.materials.map(m=>[m.name,[...m.pbrMetallicRoughness.baseColorFactor]])));
  const identity=Object.fromEntries(Object.entries(await snapshot()).filter(([name])=>!name.startsWith('slot:')));
  const screenshot=async label=>{if(dir&&width===390){await page.evaluate(()=>scrollBy(0,document.querySelector('.stage').getBoundingClientRect().top-80));await page.waitForTimeout(350);await page.locator('.stage').screenshot({path:path.join(dir,`Kaelith_DEV_slot_${label}.png`)});}};
  await screenshot('ranger');
  const state={torso:'ranger',arms:'ranger',legs:'ranger',boots:'ranger',shoulders:'ranger',weapon:'sword'};
  for(const [slot,value] of [['torso','peasant'],['arms','peasant'],['legs','peasant'],['boots','peasant'],['shoulders','none'],['weapon','staff']]){
   const before=await snapshot();state[slot]=value;
   await page.locator(`[data-proof-slot="${slot}"]`).selectOption(value);
   const after=await snapshot();let changed=0;
   for(const [name,color] of Object.entries(after)){
    if(!name.startsWith(`slot:${slot}:`)){assert.deepEqual(color,before[name],`${slot} changed another slot`);continue;}
    const variant=name.split(':')[2];assert.equal(color[3],value===variant?1:0);if(color[3]!==before[name][3])changed++;
   }
   assert(changed>0,`${slot}: no visible component change`);
   for(const [name,color] of Object.entries(identity))assert.deepEqual(after[name],color,'Identity changed');
   assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
   assert.equal(await page.locator(`[data-proof-slot="${slot}"]`).inputValue(),value);
   if(slot==='legs')await screenshot('misto');
  }
  await screenshot('peasant_bastone');
  await page.locator('[data-proof-armor="ranger"]').tap();
  for(const slot of ['torso','arms','legs','boots','shoulders'])assert.equal(await page.locator(`[data-proof-slot="${slot}"]`).inputValue(),'ranger');
  assert.equal(await page.locator('[data-proof-slot="weapon"]').inputValue(),'staff','Outfit preset changed weapon');
  await page.locator('[data-kaelith-view="public"]').tap();assert(await page.locator('.kaelith-original-figure').isVisible());assert(!(await page.locator('#modular-proof-viewer').isVisible()));
  await page.locator('[data-kaelith-view="character"]').tap();assert(await page.locator('#modular-proof-viewer').isVisible());assert.equal(await page.locator('[data-proof-slot="weapon"]').inputValue(),'staff');
  await page.locator('[data-proof-mode="reference"]').tap();assert(await page.locator('.kaelith-original-figure').isVisible());
  assert.deepEqual(await page.evaluate(()=>({...localStorage})),stored);assert.equal(downloads.length,1,'Slot change downloaded another model');assert.equal(errors.length,0,errors.join('\n'));
  results.push({width,independentSlots:6,identity:'unchanged',modelDownloads:1,storage:'unchanged',overflow:false,errors});await page.close();
 }
 const plain=await browser.newPage();await plain.goto('http://127.0.0.1:8017/index.html');assert.equal(await plain.locator('.modular-proof').count(),0);await plain.close();
 await browser.close();server.kill();console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
