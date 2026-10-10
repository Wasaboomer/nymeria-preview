/* Reach controls by actual paging clicks, never reveal hidden DOM through styles. */
async function press(page,selector){
 const target=page.locator(selector);
 if(await target.count()!==1)throw Error('Expected one control: '+selector);
 const closed=target.locator('xpath=ancestor::details[not(@open)][1]');
 if(await closed.count()) {
  const summary=closed.locator(':scope > summary');
  await reach(page,summary);await summary.tap();await page.waitForTimeout(70);
 }
 try { await reach(page,target); } catch(error) { throw Error(selector+': '+error.message); } await target.tap();await page.waitForTimeout(70);
}
async function reach(page,target){
 // Navigation and durable actions schedule layout on RAF; await its frame before paging.
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const section=target.locator('xpath=ancestor::*[@data-locality-section][1]');
 if(await section.count()) {
  const id=await section.getAttribute('data-locality-section');
  const tab=page.locator('[data-locality-tab="'+id+'"]');
  if(await tab.isVisible() && await tab.getAttribute('aria-pressed')!=='true'){await tab.tap();await page.waitForTimeout(70);}
 }
 if(await target.isVisible())return;
 const modal=await page.locator('#item-dialog').evaluate(d=>d.open);
 const pager=page.locator(modal?'#item-dialog > .fixed-pager':'.app > .fixed-pager');
 if(!await pager.count())throw Error('Missing pager');
 while(!await pager.locator('[data-fixed-prev]').isDisabled()){await pager.locator('[data-fixed-prev]').tap();await page.waitForTimeout(50);}
 for(let i=0;i<150;i++){
  if(await target.isVisible())return;
  if(await pager.locator('[data-fixed-next]').isDisabled())break;
  await pager.locator('[data-fixed-next]').tap();await page.waitForTimeout(50);
 }
 throw Error('Control not reachable through pages: '+await target.getAttribute('id'));
}
module.exports={press,reach};
module.exports.textThroughPages=async function(page,selector){
 const target=page.locator(selector),pager=page.locator('.app > .fixed-pager');let text=[];
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 if(!await pager.isVisible()){await reach(page,target);return target.innerText();}
 while(!await pager.locator('[data-fixed-prev]').isDisabled()){await pager.locator('[data-fixed-prev]').tap();await page.waitForTimeout(50);}
 for(let i=0;i<150;i++){
  if(await target.isVisible())text.push(await target.innerText());
  if(await pager.locator('[data-fixed-next]').isDisabled())break;
  await pager.locator('[data-fixed-next]').tap();await page.waitForTimeout(50);
 }
 return text.join('\n');
};
