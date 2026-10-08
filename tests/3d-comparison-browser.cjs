const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const url = process.env.NYMERIA_COMPARISON_URL || 'http://127.0.0.1:8012/nymeria-preview-pilot/3d-comparison.html';
(async () => {
 const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try {
  for(const width of [320,375,390,430]) {
   const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
   const errors=[],failed=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
   page.on('request',r=>requests.push(r.url()));
   page.on('requestfailed',r=>{if(!r.failure().errorText.includes('ERR_ABORTED'))failed.push(r.url());});
   await page.addInitScript(()=>{localStorage.setItem('comparison-sentinel','unchanged');window.addEventListener('unhandledrejection',e=>{throw e.reason;});});
   await page.goto(url);
   for(const id of ['base','peasant','ranger','base']) {
    if(id!=='base'||await page.locator('[data-model="base"]').getAttribute('aria-pressed')!=='true')await page.locator('[data-model="'+id+'"]').tap();
    await page.waitForFunction(id=>{const v=document.querySelector('#viewer');return v.loaded&&v.getAttribute('src')==='assets/3d-comparison/'+id+'.glb'&&document.querySelector('#comparison-status').textContent==='Modello caricato: '+id[0].toUpperCase()+id.slice(1);},id,{timeout:60000});
    const dimensions=await page.evaluate(()=>{const d=document.querySelector('#viewer').getDimensions();return [d.x,d.y,d.z];});
    assert.ok(dimensions.every(n=>n>0),'Model has real rendered geometry');
    assert.equal(await page.locator('[data-model="'+id+'"]').getAttribute('aria-pressed'),'true');
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const button of await page.locator('[data-model]').all())assert.ok((await button.boundingBox()).height>=44);
   assert.deepEqual(await page.evaluate(()=>({...localStorage})),{'comparison-sentinel':'unchanged'});
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   assert.ok(requests.filter(u=>!u.startsWith('data:')).every(u=>new URL(u).origin===new URL(url).origin),'No CDN or remote asset requests');
   for(const id of ['base','peasant','ranger'])assert.ok(requests.some(u=>u.endsWith('/'+id+'.glb')));
   await page.locator('[data-model="peasant"]').tap();await page.locator('[data-model="ranger"]').tap();
   await page.waitForFunction(()=>document.querySelector('#viewer').loaded&&document.querySelector('#comparison-status').textContent==='Modello caricato: Ranger');
   assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
   console.log('PASS '+width+': three real GLBs, touch selectors/rapid changes, geometry, isolated storage, same-origin assets, no errors/404/overflow');
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
