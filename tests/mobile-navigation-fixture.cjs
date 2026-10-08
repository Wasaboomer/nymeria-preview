/* Real UI paths for legacy system regressions after the M6.2 navigation rework. */
const dismiss = require('./notifications-fixture.cjs');
module.exports = async function navigate(page, screen) {
 const touch=await page.evaluate(()=>navigator.maxTouchPoints>0);
 const press=locator=>touch?locator.tap():locator.click();
 await dismiss(page);
 const dialog=page.locator('#item-dialog');if(await dialog.evaluate(d=>d.open))await press(page.locator('#close-detail'));
 if(screen==='world'){await press(page.locator('#tab-world'));return require('./fixed-navigation-fixture.cjs').press(page,'#world-return-place');}
 if(screen==='expeditions'){await press(page.locator('#tab-menu'));return press(page.locator('#tab-expeditions'));}
 if(['character','inventory','menu'].includes(screen))return press(page.locator('#tab-'+screen));
 if(['combat','debug'].includes(screen)) {
  // Demonstration combat is intentionally a Test Mode route now.
  const url=new URL(page.url());
  if(url.searchParams.get('test')!=='1'){url.searchParams.set('test','1');await page.goto(url.toString());}
  await press(page.locator('#tab-menu'));await press(page.locator('#menu-debug-link'));
  if(screen==='combat')await press(page.locator('[data-nav="combat"]'));return;
 }
 await press(page.locator('#tab-character'));await press(page.locator(`[data-nav="${screen}"]`));
};
