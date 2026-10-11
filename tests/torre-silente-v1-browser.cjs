const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright');
const Store = require('../progression-store.js');
const Data = require('../progression-data.js');

(async () => {
  const browser = await chromium.launch({executablePath: process.env.NYMERIA_CHROMIUM || chromium.executablePath(), args:['--no-sandbox']});
  try {
    fs.mkdirSync('test-results/torre-silente-v1', {recursive:true});
    for (const width of [320,375,390,430]) {
      const state = Store.initial();
      Object.assign(state, Data.fromTotal(1000));
      state.frontier.location = 'silent-tower';
      for (const id of ['veyra','broken-path','lantern-wood','elar-ruins','vesper-ford','silent-tower']) {
        if (!state.unlockedContent.includes('world:'+id)) state.unlockedContent.push('world:'+id);
      }
      for (const id of ['mq01','mq02','mq03','mq04','mq05']) {
        if (state.frontier.quests[id]) state.frontier.quests[id].status = 'claimed';
      }
      const context = await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
      await context.addInitScript(({key,state}) => {
        localStorage.setItem(key,JSON.stringify(state));
      },{key:Store.KEY,state});
      const page = await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.status()>=400 && r.url().includes('torre-silente-v1'))errors.push(r.status()+' '+r.url());});
      await page.goto(process.env.NYMERIA_TEST_URL || 'http://127.0.0.1:8018');
      await page.evaluate(() => NymeriaNavigation.open('world',{view:'places'}));
      await page.locator('#world-location-detail[data-location-art="torre-silente"]').waitFor();
      for (const id of ['silent-shade','silence-keeper']) {
        const card=page.locator('.world-enemy[data-enemy-id="'+id+'"]');
        assert.equal(await card.count(),1,id+' card');
        assert.equal(await card.locator('[data-world-fight="'+id+'"]').count(),1,id+' action');
        assert.equal(await card.locator('.world-enemy-portrait').isVisible(),true,id+' portrait');
      }
      const guado=page.locator('[data-torre-v1-destination="guado-del-vespro"]');
      assert.equal(await guado.count(),1,'canonical destination');
      assert.equal(await guado.getAttribute('data-world-enter'),'vesper-ford');
      const art=await page.evaluate(()=>{
        const banner=document.querySelector('#world-current .ny-place-banner');
        const shade=document.querySelector('[data-enemy-id="silent-shade"] .world-enemy-portrait');
        const keeper=document.querySelector('[data-enemy-id="silence-keeper"] .world-enemy-portrait');
        const ford=document.querySelector('[data-torre-v1-destination="guado-del-vespro"]');
        return {bannerCount:document.querySelectorAll('#world-current > .ny-place-banner').length, bannerVisible:banner ? getComputedStyle(banner).display !== 'none' : false, bannerImage:banner ? getComputedStyle(banner).backgroundImage : '', title:banner?.querySelector('h1')?.textContent || '',shade:getComputedStyle(shade).backgroundImage,
          keeper:getComputedStyle(keeper).backgroundImage,ford:getComputedStyle(ford,'::before').backgroundImage,
          overflow:document.documentElement.scrollWidth-innerWidth};
      });
      for (const [key,name] of Object.entries({bannerImage:'torre-silente.webp',shade:'ombra-silente.webp',keeper:'custode-del-silenzio.webp',ford:'guado-del-vespro.webp'}))
        assert.ok(art[key].includes(name),width+' '+key+' image: '+art[key]);
      assert.equal(art.bannerCount,1,width+' exactly one Tower banner');
      assert.equal(art.bannerVisible,true,width+' Tower banner visible');
      assert.equal(art.title,'Torre Silente',width+' location title inside banner');
      assert.ok(art.overflow<=1,width+' horizontal overflow '+art.overflow);
      await page.screenshot({path:'test-results/torre-silente-v1/'+width+'.png',fullPage:true});
      assert.deepEqual(errors,[],width+' page errors');
      await context.close();
      console.log('PASS Torre Silente V1 '+width);
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
