/* Actual debug APK/WebView smoke on an ephemeral CI emulator, never a user's phone. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {_android} = require('playwright');
const {audit} = require('../tests/contextual-scroll-fixture.cjs');
const id = 'com.nymeria.game';
const adb = (...args) => execFileSync('adb',['-e',...args],{encoding:'utf8'}).trim();
const delay = ms => new Promise(r=>setTimeout(r,ms));

(async () => {
  assert.equal(process.env.CI,'true','Only run against an isolated CI emulator');
  assert.equal(adb('shell','getprop','ro.kernel.qemu'),'1','Physical devices are forbidden');
  fs.mkdirSync('test-results/android',{recursive:true});
  adb('install','-r','android/app/build/outputs/apk/debug/app-debug.apk');
  adb('logcat','-c');
  adb('shell','svc','wifi','disable'); adb('shell','svc','data','disable');
  const report = {sourceCommit:process.env.GITHUB_SHA,platform:'Android emulator, real debug APK/WebView',version:adb('shell','getprop','ro.build.version.release'),checks:[],metrics:{}};
  let device;
  const check = name => {report.checks.push(name);console.log('PASS native Android '+name);};
  async function attach() {
    adb('shell','am','start','-W','-n',id+'/.MainActivity');
    device = (await _android.devices())[0]; assert.ok(device,'Emulator visible to Playwright');
    const view = await device.webView({pkg:id});
    const page = await view.page();
    await page.waitForFunction(()=>typeof Equipment!=='undefined' && typeof Character!=='undefined');
    await page.evaluate(()=>Character.ready());
    return page;
  }
  async function touch(page,selector) {
    const target = page.locator(selector);
    if (!await target.isVisible()) {
      const inDialog=await page.locator('#item-dialog').evaluate(n=>n.open);
      const pager = page.locator(inDialog?'#item-dialog > .fixed-pager':'.app > .fixed-pager');
      for(let i=0;i<100 && !await target.isVisible();i++) {
        const next=pager.locator('[data-fixed-next]'); assert.ok(!await next.isDisabled(),'Control is reachable: '+selector);
        await touch(page,(inDialog?'#item-dialog > .fixed-pager':'.app > .fixed-pager')+' [data-fixed-next]');
      }
    }
    await target.scrollIntoViewIfNeeded();
    const r = await target.boundingBox();assert.ok(r && r.width>0 && r.height>0,selector);
    const session=await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await session.detach();await delay(100);
  }
  try {
    const start=performance.now();let page=await attach();
    report.metrics.launchAndAttachMs=performance.now()-start;
    assert.deepEqual(await page.evaluate(()=>Character.diagnostics()),[]);
    assert.equal(await page.evaluate(()=>Capacitor.isNativePlatform()),true);
    assert.equal(await page.evaluate(()=>Capacitor.getPlatform()),'android');
    assert.ok(await page.locator('.bottom-nav').isVisible());check('offline packaged launch');
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await touch(page,'#tab-character');await touch(page,'#save');
    await page.waitForFunction(()=>Equipment.state.characterCreated);check('touch creation and save');
    await touch(page,'[data-nav="equipment"]');
    assert.equal(await page.evaluate(()=>NymeriaNavigation.route.screen),'equipment');
    adb('shell','input','keyevent','4');
    await page.waitForFunction(()=>NymeriaNavigation.route.screen==='character');check('native Back restores context');
    for(const name of ['inventory','missions','menu','character','world']) {
      const t=performance.now();await touch(page,'#tab-'+name);await audit(page);
      report.metrics[name+'TouchMs']=performance.now()-t;
    }
    check('five screens, fixed shell and no horizontal overflow');
    await touch(page,'#tab-character');
    const avatarBefore=await page.locator('#character').innerHTML();
    const alternative=await page.evaluate(()=>{
      for(const slot of ['torso','legs','boots','mainHand']) {
        const item=Equipment.state.inventory.find(i=>i.id!==Equipment.equipped(slot)?.id && !Equipment.canEquip(i.id,slot) && BuildSystem.compatible(i,ClassSystem.state.classId));
        if(item)return {slot,id:item.id};
      }
    });
    assert.ok(alternative);
    await touch(page,'[data-nav="equipment"]');
    await touch(page,'[data-open-slot="'+alternative.slot+'"]');
    await touch(page,'[data-item-id="'+alternative.id+'"]');
    await touch(page,'#equip-item');
    await touch(page,'#tab-character');
    await page.waitForFunction(old=>document.querySelector('#character').innerHTML!==old,avatarBefore);
    assert.equal(await page.evaluate(slot=>Equipment.equipped(slot)?.id,alternative.slot),alternative.id);
    await page.evaluate(()=>Character.ready());
    assert.deepEqual(await page.evaluate(()=>Character.diagnostics()),[]);
    check('real UI equip changes modular avatar');
    const saved=await page.evaluate(()=>localStorage.getItem(Equipment.SAVE_KEY));
    await touch(page,'#tab-inventory');
    const item=page.locator('[data-item-id]').first();await item.scrollIntoViewIfNeeded();
    await touch(page,'[data-item-id="'+await item.getAttribute('data-item-id')+'"]');
    assert.equal(await page.locator('#item-dialog').evaluate(n=>n.open),true);
    adb('shell','input','keyevent','4');await page.waitForFunction(()=>!document.querySelector('#item-dialog').open);
    check('native Back closes comparison dialog');
    await touch(page,'#tab-menu');await touch(page,'[data-nav="guild"]');
    await touch(page,'#guild-create input[name="name"]');
    await delay(1000);
    assert.match(adb('shell','dumpsys','input_method'),/mInputShown=true/,'Android keyboard is actually shown');
    assert.ok(await page.evaluate(()=>document.activeElement?.name==='name'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    report.metrics.keyboardViewport=await page.evaluate(()=>({height:visualViewport.height,innerHeight,navBottom:document.querySelector('.bottom-nav').getBoundingClientRect().bottom}));
    assert.ok(report.metrics.keyboardViewport.navBottom<=report.metrics.keyboardViewport.height+1,'Navigation remains visible with IME');
    adb('shell','input','keyevent','4');await delay(300);
    check('text focus/keyboard viewport and navigation');
    await touch(page,'#tab-character');
    adb('shell','input','keyevent','4');
    await page.waitForFunction(()=>document.hidden);
    check('native Back minimizes at the root');
    adb('shell','am','start','-W','-n',id+'/.MainActivity');
    await page.waitForFunction(()=>!document.hidden);
    adb('shell','input','keyevent','3');await delay(300);
    adb('shell','am','start','-W','-n',id+'/.MainActivity');
    await page.waitForFunction(()=>!document.hidden);
    assert.equal(await page.evaluate(()=>localStorage.getItem(Equipment.SAVE_KEY)),saved);check('background/foreground persistence');
    adb('shell','settings','put','system','accelerometer_rotation','0');
    adb('shell','settings','put','system','user_rotation','1');await delay(300);
    assert.ok(await page.evaluate(()=>innerHeight>innerWidth));check('portrait despite requested landscape');
    adb('shell','settings','put','system','user_rotation','0');
    await page.screenshot({path:'test-results/android/hero.png'});
    assert.deepEqual(errors,[]);await device.close();device=null;
    adb('shell','am','force-stop',id);page=await attach();
    assert.equal(await page.evaluate(()=>localStorage.getItem(Equipment.SAVE_KEY)),saved);
    assert.equal(await page.evaluate(()=>Equipment.state.characterCreated),true);check('process kill and offline relaunch restore save');
    const logs=adb('logcat','-d');
    fs.writeFileSync('test-results/android/logcat.txt',logs);
    assert.ok(!/FATAL EXCEPTION[\s\S]{0,300}com\.nymeria\.game/.test(logs),'No native app crash');
    assert.ok(!/Capacitor\/Console.*(?:Uncaught|Unhandled|native navigation adapter could not load)/i.test(logs),'No uncaught startup/bridge error');
    report.metrics.webView=await page.evaluate(()=>({userAgent:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
    report.metrics.memory=adb('shell','dumpsys','meminfo',id);
    check('no observed app crash or uncaught JS error');
    if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Native Android smoke\n\n'+report.checks.map(n=>'- PASS '+n).join('\n')+'\n\nAndroid '+report.version+'; launch + attach + renderer ready: '+report.metrics.launchAndAttachMs.toFixed(0)+' ms (CI emulator, not physical performance).\n');
  } finally {
    fs.writeFileSync('test-results/android/report.json',JSON.stringify(report,null,2));
    if(device) await device.close();
    try {fs.writeFileSync('test-results/android/logcat.txt',adb('logcat','-d'));} catch {}
  }
})().catch(e=>{console.error(e);console.error('::error::Native Android smoke: '+String(e.message).replace(/[\r\n]/g,' ').slice(0,1000));process.exitCode=1;});
