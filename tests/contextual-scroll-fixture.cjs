const assert=require('node:assert/strict');
async function audit(page){
 const result=await page.evaluate(()=>{
  const route=NymeriaNavigation.route;
  const authorized=n=>n.id==='world-battle-history'||n.id==='combat-exit-confirm'||n.classList.contains('combat-abilities')||(n.classList.contains('fixed-scroll-panel')&&(['panel-character','panel-inventory','panel-equipment','panel-professions','panel-menu','panel-class','panel-expeditions','panel-guild'].includes(n.id)||(n.id==='panel-world'&&(['overview','journal','quest'].includes(route.view)||(route.view==='places'&&!route.activity)))));
  const violations=[];
  for(const n of document.querySelectorAll('*')){
   if(!(n instanceof HTMLElement)||!n.getClientRects().length||!n.checkVisibility()||n.matches('input,textarea,select'))continue;
   const c=getComputedStyle(n),dx=n.scrollWidth-n.clientWidth,dy=n.scrollHeight-n.clientHeight;
   if(dx>1&&/auto|scroll|hidden/.test(c.overflowX))violations.push({id:n.id,axis:'x',dx});
   if(dy>1&&/auto|scroll|hidden/.test(c.overflowY)&&!authorized(n))violations.push({id:n.id,axis:'y',dy});
  }
  const app=document.querySelector('.app');app.scrollTop=100;app.scrollLeft=100;window.scrollTo(100,100);
  return {violations,app:[app.scrollLeft,app.scrollTop],document:[scrollX,scrollY],wide:document.documentElement.scrollWidth>innerWidth+1};
 });
 assert.deepEqual(result.violations,[],JSON.stringify(result));assert.deepEqual(result.app,[0,0]);assert.deepEqual(result.document,[0,0]);assert.equal(result.wide,false);
}
async function swipe(page,locator,axis='y'){
 const r=await locator.boundingBox(),x=r.x+r.width*.5,y=r.y+r.height*.7;
 const session=await page.context().newCDPSession(page);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=10;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-(axis==='x'?r.width*.3*i/10:0),y:y-(axis==='y'?Math.min(150,r.height*.4)*i/10:0)}]});await page.waitForTimeout(20);}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);await session.detach();
}
module.exports={audit,swipe};
