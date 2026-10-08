const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.NYMERIA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{const p=await b.newPage();await p.goto(process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8000');
 const result=await p.evaluate(()=>{
  const before=JSON.stringify({state:ProgressionStore.state,gear:Equipment.state,storage:{...localStorage}});
  const s=structuredClone(ProgressionStore.state);s.frontier.quests.mq04.status='claimed';
  const check=item=>{s.frontier.lastQuestClaim={id:'mq04',loot:[{itemId:item.id}]};return QuestUI.rewardComparison('mq04',s);};
  const equipped=Equipment.equipped('mainHand');
  const a=check(equipped);
  const unequipped=Equipment.state.inventory.filter(i=>!Object.values(Equipment.state.equipment).some(slot=>slot.equippedItem===i.id));
  const wrong=unequipped.find(i=>Equipment.canEquip(i.id,Equipment.compatibleSlots(i)[0]));
  const unusable=wrong?check(wrong):null;
  const upgrade=unequipped.find(i=>{const slot=Equipment.compatibleSlots(i)[0];return !Equipment.canEquip(i.id,slot)&&BuildSystem.advise(i,slot,ClassSystem.state.classId,ClassSystem.build().id,Equipment)?.improvement;});
  const available=upgrade?check(upgrade):null;
  return {a,unusable,available,unchanged:before===JSON.stringify({state:ProgressionStore.state,gear:Equipment.state,storage:{...localStorage}})};
 });assert.equal(result.a,'');assert.equal(result.unusable,'');assert.ok(result.available&&result.available.includes('data-quest-compare'));assert.ok(result.unchanged);
 console.log('PASS prompts: equipped/incompatible hidden, usable improvement shown, no save/gear mutation');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
