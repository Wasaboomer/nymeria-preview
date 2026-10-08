const assert=require('node:assert/strict'),{chromium}=require('playwright');
const navigate=require('./mobile-navigation-fixture.cjs'),dismiss=require('./notifications-fixture.cjs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});try{for(const width of [390])for(const cls of ['hunter','warden']){
 const p=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true}),errors=[],fights=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{Math.random=()=>1/4294967296;});await p.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8018');
 await p.evaluate(cls=>{ClassSystem.selectClass(cls);for(const [slot,id]of Object.entries(cls==='hunter'?{mainHand:'bow',support:'quiver',torso:'torso-chain',legs:'legs-chain',boots:'boots-chain'}:{mainHand:'sword',support:'shield',torso:'torso-warden',legs:'legs-sentinel',boots:'boots-plate'}))Equipment.equip(id,slot);},cls);
 await navigate(p,'character');await p.locator('#save').tap();await navigate(p,'world');
 const tap=async selector=>{await dismiss(p);await p.locator(selector).tap();await p.waitForFunction(()=>document.querySelector('#panel-world').getAttribute('aria-busy')==='false');};
 const fight=async enemy=>{await tap('#world-location-detail [data-world-fight="'+enemy+'"]');if(enemy==='twilight-stag'){assert.ok(await p.locator('#world-stag-preparation').isVisible());await tap('[data-world-stag-start]');}assert.ok(await p.locator('#world-battle').isVisible());await p.evaluate(async()=>{WorldUI.engine.advance(180);await WorldUI.settle();});const result=await p.evaluate(()=>ProgressionStore.state.frontier.lastEncounter);console.log('FIGHT '+cls+' '+enemy+' '+JSON.stringify({outcome:result.outcome,duration:result.result.duration,level:await p.evaluate(()=>ProgressionStore.state.level)}));if(enemy!=='silence-keeper')assert.equal(result.outcome,'victory');fights.push({enemy,seconds:result.result.duration});await tap('[data-world-continue]');};
 await tap('#world-location-detail [data-quest-accept="sq-bram-preparation"]');await tap('#world-tracked [data-quest-professions]');await p.locator('[data-prof-travel="broken-path"]').tap();await p.waitForFunction(()=>ProgressionStore.state.frontier.location==='broken-path');await tap('[data-world-profession]');
 for(let i=0;i<3;i++){await p.locator('[data-prof-gather="vesper-iron-vein"]').tap();await p.waitForFunction(n=>ProfessionUI.engine.state.materials['raw-iron']===n,2*(i+1));}
 for(let i=0;i<2;i++){await p.locator('[data-prof-craft="forge-iron"]').tap();await p.waitForFunction(n=>ProfessionUI.engine.state.materials['forged-iron']===n,i+1);}
 await p.locator('[data-prof-craft="frontier-brace"]').tap();await p.waitForFunction(()=>ProfessionUI.engine.state.materials['frontier-brace']===1);await p.locator('[data-prof-bram]').tap();
 await tap('#quest-detail [data-quest-deliver="sq-bram-preparation"]');await tap('#quest-detail [data-quest-claim="sq-bram-preparation"]');await tap('#quest-detail [data-quest-inventory]');await dismiss(p);await p.locator('[data-item-id="frontier-ring"]').tap();await p.locator('#equip-item').tap();await dismiss(p);await p.locator('#close-detail').tap();assert.equal(await p.evaluate(()=>Equipment.equipped('ringLeft').id),'frontier-ring');
 await navigate(p,'world');await tap('#world-tracked [data-quest-accept="mq01"]');await tap('#world-tracked [data-world-talk="serah"]');await tap('#world-tracked [data-quest-destination="broken-path"]');await tap('#world-tracked [data-quest-claim="mq01"]');await tap('#world-tracked [data-quest-accept="mq02"]');
 for(let i=0;i<3;i++)await fight('vesper-raider');await tap('#world-tracked [data-quest-claim="mq02"]');assert.equal(await p.evaluate(()=>ProgressionStore.state.level),2);await tap('#world-tracked [data-quest-giver="mq03"]');await tap('#world-tracked [data-quest-accept="mq03"]');await tap('#world-tracked [data-quest-destination="lantern-wood"]');
 for(let i=0;i<3;i++)await fight('corrupt-hound');assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.quests.mq03.progress[1]),3);await tap('#world-tracked [data-world-explore="cold-lantern"]');assert.equal(await p.evaluate(()=>ProgressionStore.state.level),2);await fight('twilight-stag');
 assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.quests.mq03.status),'completed');await tap('#world-tracked [data-quest-claim="mq03"]');
 const state=await p.evaluate(()=>ProgressionStore.state);assert.ok(state.unlockedContent.includes('world:elar-ruins'));assert.equal(state.frontier.quests['sq-bram-preparation'].status,'claimed');assert.equal(state.ownedLootIds.filter(x=>x==='frontier-ring').length,1);
 
 const compareReward=async(id,expected)=>{
 const before=await p.evaluate(()=>JSON.stringify(Equipment.state.equipment)),loot=await p.evaluate(()=>JSON.stringify(ProgressionStore.state.ownedLootIds));
 for(const mobileWidth of [320,390,430]) {
  await p.setViewportSize({width:mobileWidth,height:844});
  await tap('#world-tracked [data-quest-compare="'+expected+'"]');
  assert.ok(await p.locator('#item-dialog').isVisible());
  assert.equal(await p.locator('#detail-heading').innerText(),await p.evaluate(item=>GearData.items.find(x=>x.id===item).name,expected));
  assert.ok(await p.locator('#detail-body .comparison').isVisible());
  assert.equal(await p.evaluate(()=>JSON.stringify(Equipment.state.equipment)),before);
  await p.locator('#close-detail').tap();await p.locator('#navigation-back').tap();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await p.reload();await navigate(p,'world');
 assert.equal(await p.locator('#world-tracked [data-quest-compare="'+expected+'"]').count(),1);
 await p.evaluate(id=>NymeriaNavigation.open('world',{view:'quest',questId:id}),id);
 assert.equal(await p.locator('#quest-detail [data-quest-compare="'+expected+'"]').count(),1);
 await tap('#quest-detail [data-quest-compare="'+expected+'"]');
 assert.equal(await p.evaluate(()=>JSON.stringify(Equipment.state.equipment)),before);
 assert.equal(await p.evaluate(()=>JSON.stringify(ProgressionStore.state.ownedLootIds)),loot);
 await p.locator('#close-detail').tap();await p.locator('#navigation-back').tap();await navigate(p,'world');
 };
 await tap('#world-tracked [data-quest-giver="mq04"]');await tap('#world-tracked [data-quest-accept="mq04"]');
 for(let i=0;i<3;i++)await fight('elar-sentinel');await tap('#world-tracked [data-quest-claim="mq04"]');await compareReward('mq04',cls==='hunter'?'trail-bow':'vesper-blade');
 await tap('#world-tracked [data-quest-giver="mq05"]');await tap('#world-tracked [data-quest-accept="mq05"]');await tap('#world-tracked [data-quest-destination="vesper-ford"]');
 for(let i=0;i<3;i++)await fight('ford-reaver');await fight('ford-commander');await tap('#world-tracked [data-world-explore="far-bank"]');await tap('#world-tracked [data-quest-claim="mq05"]');await compareReward('mq05',cls==='hunter'?'frontier-chain':'frontier-mail');
 await p.evaluate(()=>NymeriaNavigation.open('world',{view:'quest',questId:'mq04'}));
 const weapon=cls==='hunter'?'trail-bow':'vesper-blade';
 await tap('#quest-detail [data-quest-compare="'+weapon+'"]');
 assert.equal(await p.locator('#detail-heading').innerText(),await p.evaluate(id=>GearData.items.find(x=>x.id===id).name,weapon));
 await p.locator('#equip-item').tap();
 assert.equal(await p.evaluate(()=>Equipment.equipped('mainHand').id),weapon);
 await p.locator('#close-detail').tap();

await p.reload();await navigate(p,'world');assert.equal(await p.evaluate(()=>ProgressionStore.state.frontier.quests.mq03.status),'claimed');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS '+width+'px '+cls+': Elar/Ford reward comparisons at 320/390/430px; gear and loot unchanged; reload and quest detail links passed; '+JSON.stringify(fights));await p.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
