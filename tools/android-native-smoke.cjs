/* Actual debug APK/WebView smoke on an ephemeral CI emulator, never a user's phone. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFile,spawn} = require('node:child_process');
const execAsync=require('node:util').promisify(execFile);
const {_android} = require('playwright');
const {audit,swipe} = require('../tests/contextual-scroll-fixture.cjs');
const id = 'com.nymeria.game';
const adb = async(...args) => (await execAsync('adb',['-e',...args],{encoding:'utf8',timeout:120000})).stdout.trim();
const delay = ms => new Promise(r=>setTimeout(r,ms));
function startLogcat() {
  const path='test-results/android/logcat.txt',output=fs.openSync(path,'w');
  const child=spawn('adb',['-e','logcat','-v','threadtime'],{stdio:['ignore',output,'pipe']});
  let stderr='',finished=false;
  child.stderr?.on('data',chunk=>{stderr=(stderr+chunk).slice(-2000);});
  const closed=new Promise(resolve=>{child.on('error',error=>{stderr+=error.message;resolve();});child.on('close',resolve);});
  return {async finish() {
    if(!finished) {
      if(child.exitCode===null && !child.killed) child.kill();
      let timer;
      await Promise.race([closed,new Promise(resolve=>{timer=setTimeout(resolve,3000);})]).finally(()=>clearTimeout(timer));
      fs.closeSync(output);finished=true;
    }
    return {text:fs.readFileSync(path,'utf8'),stderr};
  }};
}

(async () => {
  assert.equal(process.env.CI,'true','Only run against an isolated CI emulator');
  assert.equal(await adb('shell','getprop','ro.kernel.qemu'),'1','Physical devices are forbidden');
  fs.mkdirSync('test-results/android',{recursive:true});
  await adb('install','-r','android/app/build/outputs/apk/debug/app-debug.apk');
  await adb('logcat','-c');
  await adb('shell','svc','wifi','disable'); await adb('shell','svc','data','disable');
  const report = {sourceCommit:process.env.GITHUB_SHA,platform:'Android emulator, real debug APK/WebView',version:await adb('shell','getprop','ro.build.version.release'),checks:[],metrics:{}};
  const logCapture=startLogcat();
  let device, lastPage, completed=false;
  const check = name => {report.checks.push(name);console.log('PASS native Android '+name);};
  // Background WebViews may stop RAF delivery; poll from the test host instead.
  async function waitNative(page,predicate,label,evaluationTimeout=5000) {
    const deadline=Date.now()+30000;
    while(Date.now()<deadline) {
      let timer;
      const result=await Promise.race([page.evaluate(predicate),new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(Error('WebView evaluation stalled: '+label)),evaluationTimeout);
      })]).finally(()=>clearTimeout(timer));
      if(result) return;
      await delay(100);
    }
    throw Error('Native lifecycle timeout: '+label);
  }
  async function waitBackground() {
    const deadline=Date.now()+30000;
    while(Date.now()<deadline) {
      const activity=await adb('shell','dumpsys','activity','activities');
      const resumed=activity.split('\n').filter(line=>/mResumedActivity|topResumedActivity/.test(line));
      if(resumed.length && resumed.every(line=>!line.includes(id)))return;
      await delay(200);
    }
    throw Error('Native activity did not leave foreground');
  }
  async function attach() {
    await adb('shell','am','start','-W','-n',id+'/.MainActivity');
    device = (await _android.devices())[0]; assert.ok(device,'Emulator visible to Playwright');
    const view = await device.webView({pkg:id});
    const page = await view.page();lastPage=page;
    await page.waitForFunction(()=>typeof Equipment!=='undefined' && typeof Character!=='undefined');
    await page.evaluate(()=>Character.ready());
    await page.waitForFunction(()=>typeof window.NymeriaNativeReady?.then==='function');
    await waitNative(page,async()=>{await window.NymeriaNativeReady;return true;},'native adapter ready',30000);
    await waitNative(page,async()=>(await Capacitor.Plugins.App.getState()).isActive,'initial foreground');
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
    assert.ok(await page.locator('.bottom-nav').isVisible());check('offline packaged launch');check('native listeners acknowledged and activity foreground');
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await touch(page,'#tab-character');await touch(page,'#save');
    await page.waitForFunction(()=>Equipment.state.characterCreated);check('touch creation and save');
    await touch(page,'[data-nav="equipment"]');
    assert.equal(await page.evaluate(()=>NymeriaNavigation.route.screen),'equipment');
    await adb('shell','input','keyevent','4');
    await page.waitForFunction(()=>NymeriaNavigation.route.screen==='character');check('native Back restores context');
    for(const name of ['inventory','missions','menu','character','world']) {
      const t=performance.now();await touch(page,'#tab-'+name);await audit(page);
      report.metrics[name+'TouchMs']=performance.now()-t;
    }
    await touch(page,'#tab-inventory');await touch(page,'[data-filter="all"]');
    const panel=page.locator('#panel-inventory');
    await panel.evaluate(n=>n.scrollTop=0);
    assert.ok(await panel.evaluate(n=>n.scrollHeight>n.clientHeight));
    const frameSample=page.evaluate(()=>new Promise(resolve=>{const intervals=[];let last;function tick(t){if(last!==undefined)intervals.push(t-last);last=t;if(intervals.length===60)resolve(intervals);else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));
    await swipe(page,panel);assert.ok(await panel.evaluate(n=>n.scrollTop)>0);
    report.metrics.scrollFrameIntervalsMs=await frameSample;
    await audit(page);check('touch internal inventory scroll keeps shell fixed');
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
    await adb('shell','input','keyevent','4');
    await page.waitForFunction(()=>NymeriaNavigation.route.screen==='character');
    assert.ok(await page.locator('#character').isVisible());
    await page.waitForFunction(old=>document.querySelector('#character').innerHTML!==old,avatarBefore);
    assert.equal(await page.evaluate(slot=>Equipment.equipped(slot)?.id,alternative.slot),alternative.id);
    await page.evaluate(()=>Character.ready());
    assert.deepEqual(await page.evaluate(()=>Character.diagnostics()),[]);
    check('real UI equip changes modular avatar');
    let saved=await page.evaluate(()=>localStorage.getItem(Equipment.SAVE_KEY));
    await touch(page,'#tab-inventory');
    const item=page.locator('[data-item-id]').first();await item.scrollIntoViewIfNeeded();
    await touch(page,'[data-item-id="'+await item.getAttribute('data-item-id')+'"]');
    assert.equal(await page.locator('#item-dialog').evaluate(n=>n.open),true);
    await adb('shell','input','keyevent','4');await page.waitForFunction(()=>!document.querySelector('#item-dialog').open);
    check('native Back closes comparison dialog');
    await touch(page,'#tab-menu');await touch(page,'[data-nav="guild"]');
    await touch(page,'#guild-create input[name="name"]');
    await delay(1000);
    assert.match(await adb('shell','dumpsys','input_method'),/mInputShown=true/,'Android keyboard is actually shown');
    assert.ok(await page.evaluate(()=>document.activeElement?.name==='name'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    report.metrics.keyboardViewport=await page.evaluate(()=>({height:visualViewport.height,innerHeight,navBottom:document.querySelector('.bottom-nav').getBoundingClientRect().bottom}));
    assert.ok(report.metrics.keyboardViewport.navBottom<=report.metrics.keyboardViewport.height+1,'Navigation remains visible with IME');
    await adb('shell','input','keyevent','4');
    for(let i=0;i<20 && /mInputShown=true/.test(await adb('shell','dumpsys','input_method'));i++)await delay(100);
    assert.ok(!/mInputShown=true/.test(await adb('shell','dumpsys','input_method')),'Back dismisses IME');
    check('text focus/keyboard viewport and navigation');
    await touch(page,'#tab-character');
    while(await page.evaluate(()=>NymeriaNavigation.depth)>0) {
      const depth=await page.evaluate(()=>NymeriaNavigation.depth);
      await adb('shell','input','keyevent','4');
      await page.waitForFunction(old=>NymeriaNavigation.depth<old,depth);
    }
    assert.equal(await page.evaluate(()=>NymeriaNavigation.route.screen),'character');
    await adb('shell','input','keyevent','4');
    await waitBackground();
    check('native Back minimizes at the root');
    await adb('shell','am','start','-W','-n',id+'/.MainActivity');
    await waitNative(page,async()=>(await Capacitor.Plugins.App.getState()).isActive,'foreground');
    // Isolated native lifecycle fixture uses existing class/equipment/world APIs,
    // not Debug UI or altered combat values. Normal story journey is browser-tested.
    await page.evaluate(async()=>{
      ClassSystem.selectClass('warden');Equipment.equip('sword','mainHand');Equipment.equip('shield','support');
      await Character.ready();
      if(Character.diagnostics().length)throw Error('Fixture character assets not ready');
      const entered=await WorldSystem.enter('broken-path');if(!entered.ok)throw Error(entered.message);
      const started=await WorldSystem.startEncounter('vesper-raider',{seed:23});if(!started.ok)throw Error(started.message);
      NymeriaNavigation.open('world',{view:'battle'});WorldUI.resume();
    });
    await page.waitForFunction(()=>WorldUI.engine?.status==='running');
    saved=await page.evaluate(()=>localStorage.getItem(Equipment.SAVE_KEY));
    const encounter=await page.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id);
    await page.evaluate(async()=>{
      window.nativeLifecycleEvidence=[];
      await Capacitor.Plugins.App.addListener('appStateChange',({isActive})=>{
        nativeLifecycleEvidence.push({isActive,status:WorldUI.engine?.status,time:WorldUI.engine?.time,at:Date.now()});
      });
      await Capacitor.Plugins.App.getState();
    });
    const beforeHome=await page.evaluate(()=>Date.now());
    await adb('shell','input','keyevent','3');
    await waitBackground();await delay(1500);
    await adb('shell','am','start','-W','-n',id+'/.MainActivity');
    await waitNative(page,async()=>(await Capacitor.Plugins.App.getState()).isActive,'foreground');
    const evidence=await page.evaluate(()=>nativeLifecycleEvidence);
    report.metrics.lifecycleEvents=evidence;
    const background=evidence.find(event=>event.isActive===false && event.at>=beforeHome);
    assert.ok(background,'The actual native background event was delivered');
    assert.equal(background.status,'paused','Existing pause handler runs before lifecycle observer');
    assert.equal(await page.evaluate(()=>WorldUI.engine.status),'paused');
    assert.equal(await page.evaluate(()=>WorldUI.engine.time),background.time,'Combat clock did not advance after native pause');
    check('native background pauses the existing world combat clock');
    assert.equal(await page.evaluate(()=>localStorage.getItem(Equipment.SAVE_KEY)),saved);
    assert.equal(await page.evaluate(()=>WorldUI.engine.status),'paused');
    assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id),encounter);
    await audit(page);
    assert.ok(await page.locator('#world-enemy-hp').innerText());
    assert.ok(await page.locator('#world-player-hp').innerText());
    assert.ok(await page.locator('#world-battle-resume').isVisible());
    check('background/foreground persistence, real combat HUD and no automatic resume');
    await adb('shell','settings','put','system','accelerometer_rotation','0');
    await adb('shell','settings','put','system','user_rotation','1');await delay(300);
    assert.ok(await page.evaluate(()=>innerHeight>innerWidth));check('portrait despite requested landscape');
    await adb('shell','settings','put','system','user_rotation','0');
    await page.screenshot({path:'test-results/android/battle-paused.png'});
    assert.deepEqual(errors,[]);await device.close();device=null;
    await adb('shell','am','force-stop',id);page=await attach();
    assert.equal(await page.evaluate(()=>localStorage.getItem(Equipment.SAVE_KEY)),saved);
    assert.equal(await page.evaluate(()=>Equipment.state.characterCreated),true);
    assert.equal(await page.evaluate(()=>ProgressionStore.state.frontier.activeEncounter.id),encounter);
    assert.ok(!await page.evaluate(()=>WorldUI.engine?.status==='running'));
    check('process kill and offline relaunch restore save and pending encounter');
    const logs=(await logCapture.finish()).text;
    assert.ok(!/FATAL EXCEPTION[\s\S]{0,300}com\.nymeria\.game/.test(logs),'No native app crash');
    assert.ok(!/Capacitor\/Console.*(?:Uncaught|Unhandled|native navigation adapter could not load)/i.test(logs),'No uncaught startup/bridge error');
    report.metrics.webView=await page.evaluate(()=>({userAgent:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
    report.metrics.memory=await adb('shell','dumpsys','meminfo',id);
    check('no observed app crash or uncaught JS error');completed=true;
    if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Native Android smoke\n\n'+report.checks.map(n=>'- PASS '+n).join('\n')+'\n\nAndroid '+report.version+'; launch + attach + renderer ready: '+report.metrics.launchAndAttachMs.toFixed(0)+' ms (CI emulator, not physical performance).\n');
  } finally {
    if(lastPage) {
      try {
        let endTimer;
        const state=await Promise.race([lastPage.evaluate(()=>({url:location.href,title:document.title,ready:document.readyState,characterCreated:typeof Equipment==='undefined'?null:Equipment.state.characterCreated,route:window.NymeriaNavigation?.route,depth:window.NymeriaNavigation?.depth,hidden:document.hidden,dialog:document.querySelector('#item-dialog')?.open})),new Promise((_,reject)=>{endTimer=setTimeout(()=>reject(Error('End-state unavailable')),2000);})]).finally(()=>clearTimeout(endTimer));
        console.log('::notice::Native smoke end-state '+JSON.stringify(state));
      } catch {}
    }
    fs.writeFileSync('test-results/android/report.json',JSON.stringify(report,null,2));
    if(device) await device.close();
    try {
      const captured=await logCapture.finish(),log=captured.text;
      report.logcatTransport=captured.stderr;
      if(captured.stderr)console.log('::notice::Logcat transport '+captured.stderr.replace(/[\r\n]/g,' ').slice(-1000));
      if(!completed) {
        const lines=log.split('\n').filter(line=>/RenderProcess|Fatal signal|lmkd|lowmemorykiller|AndroidRuntime|Killing.*nymeria|(?:chromium|cr_).*?(?:ERROR|FATAL)/i.test(line)).slice(-12);
        report.failureDiagnostics=lines;
        const bridge=log.split('\n').filter(line=>/pluginId: App|App\.(?:getState|addListener)|Native adapter|native navigation adapter|Serious error executing plugin|Unable to execute plugin method/.test(line)).slice(-10);
        console.log('::notice::Native bridge trace '+bridge.join(' | ').slice(-3000));
        console.log('::notice::Native failure log '+lines.join(' | ').slice(-2000));
        try {console.log('::notice::Native app PID '+(await execAsync('adb',['-e','shell','pidof',id],{encoding:'utf8',timeout:5000})).stdout.trim());}catch{console.log('::notice::Native app process absent');}
        fs.writeFileSync('test-results/android/report.json',JSON.stringify(report,null,2));
      }
    } catch (error) {
      console.log('::notice::Native log capture failed '+error.message);
      // A timed-out collector may still have saved the decisive crash lines.
      try {
        const lines=fs.readFileSync('test-results/android/logcat.txt','utf8').split('\n').filter(line=>/RenderProcess|Fatal signal|lmkd|lowmemorykiller|AndroidRuntime|Killing.*nymeria|(?:chromium|cr_).*?(?:ERROR|FATAL)/i.test(line)).slice(-12);
        report.failureDiagnostics=lines;
        console.log('::notice::Partial native failure log '+lines.join(' | ').slice(-2000));
        fs.writeFileSync('test-results/android/report.json',JSON.stringify(report,null,2));
      }catch{}
    }
    if(!completed) {
      try {console.log('::notice::ADB device state '+(await execAsync('adb',['devices','-l'],{encoding:'utf8',timeout:5000})).stdout.replace(/[\r\n]/g,' '));}catch(error){console.log('::notice::ADB device state unavailable '+error.code);}
      try {console.log('::notice::Runner memory '+fs.readFileSync('/proc/meminfo','utf8').split('\n').filter(line=>/^Mem(Total|Available):/.test(line)).join(' '));}catch{}
    }
  }
})().catch(e=>{console.error(e);console.error('::error::Native Android smoke: '+String(e.stack || e.message).replace(/[\r\n]/g,' ').slice(0,1600));process.exitCode=1;});
