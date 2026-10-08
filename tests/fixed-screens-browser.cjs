const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {press,reach}=require('./fixed-navigation-fixture.cjs');
const url=process.env.NYMERIA_TEST_URL||'http://127.0.0.1:8000';
async function settle(p){await p.waitForTimeout(70);}
async function visitAll(p){
 const modal=await p.locator('#item-dialog').evaluate(d=>d.open);
 const pager=p.locator(modal?'#item-dialog > .fixed-pager':'.app > .fixed-pager');
 while(!await pager.locator('[data-fixed-prev]').isDisabled()){await pager.locator('[data-fixed-prev]').tap();await settle(p);}
 let visited=0;
 do {
  const violations=await p.evaluate(()=>{
   const r=document.querySelector('#item-dialog[open] #detail-body')||document.querySelector('.app > [id^="panel-"]:not([hidden])');
   const b=r.getBoundingClientRect();
   const controls=Array.from(r.querySelectorAll('button,input,select,summary,p,h1,h2,h3,h4,li,small')).filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&n.checkVisibility()&&n.getBoundingClientRect().width>2&&n.getBoundingClientRect().height>2&&!n.closest('svg'));
   return {root:r.id,page:FixedScreens.page,height:r.clientHeight,scroll:r.scrollHeight,viewport:[innerWidth,innerHeight],overflow:r.dataset.fixedOverflow,wide:document.documentElement.scrollWidth>innerWidth,tall:document.documentElement.scrollHeight>innerHeight+1,
    shell:Array.from(document.querySelectorAll('.app > .mobile-topbar button,.app > .context-bar button,.app > .bottom-nav button,.app > #creator-actions button,.app > .fixed-pager button')).filter(n=>n.checkVisibility()&&n.getClientRects().length).filter(n=>{const x=n.getBoundingClientRect();return x.left<0||x.right>innerWidth+1||x.top<0||x.bottom>innerHeight+1||x.height<44;}).map(n=>n.id||n.textContent),
    cut:controls.filter(n=>{const x=n.getBoundingClientRect();return x.top<b.top-1||x.bottom>b.bottom+1||x.left<0||x.right>innerWidth+1;}).map(n=>n.id||n.textContent.trim().slice(0,40))};
  });
  assert.equal(violations.overflow,'false',JSON.stringify(violations));assert.equal(violations.wide,false);assert.equal(violations.tall,false);assert.deepEqual(violations.cut,[]);assert.deepEqual(violations.shell,[],JSON.stringify(violations));
  visited++;
  if(await pager.locator('[data-fixed-next]').isDisabled())break;
  await pager.locator('[data-fixed-next]').tap();await settle(p);
  assert.ok(visited<150,'Pagination must terminate');
 }while(true);
 return visited;
}
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [320,375,390,430])for(const height of [568,667,844]){
  const p=await b.newPage({viewport:{width,height},hasTouch:true,isMobile:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&m.location().url!==new URL('/favicon.ico',url).href)errors.push(m.text());});p.on('response',r=>{if(r.url().startsWith(url)&&r.status()>=400)errors.push(r.status()+' '+r.url());});await p.goto(url);await settle(p);
  let total=0;
  for(const screen of ['world','character','inventory','equipment','class','professions','expeditions','guild','menu']){
   await p.evaluate(s=>{if(['world','character','menu','expeditions'].includes(s))NymeriaNavigation.root(s);else NymeriaNavigation.open(s);},screen);await settle(p);total+=await visitAll(p);
   if(screen==='world'){await p.evaluate(()=>NymeriaNavigation.open('world',{view:'journal'}));await settle(p);for(const category of ['main','side','profession']){await press(p,'[data-fixed-category="'+category+'"]');total+=await visitAll(p);}await p.evaluate(()=>NymeriaNavigation.root('world'));await settle(p);}
   if(screen==='class'&&await p.locator('#panel-class .strategy-settings > summary').count()){await press(p,'#panel-class .strategy-settings > summary');total+=await visitAll(p);}
   if(screen!=='character')assert.ok(await p.locator('#creator-actions').isHidden());
   if(screen==='guild'){await press(p,'#guild-create button[type=submit]');assert.equal(await p.evaluate(()=>document.activeElement.name),'name');await reach(p,p.locator('#guild-create input[name=name]'));await p.locator('#guild-create input[name=name]').fill('Custodi di prova');await p.setViewportSize({width,height:375});await settle(p);await visitAll(p);await p.setViewportSize({width,height});await settle(p);await press(p,'#guild-create button[type=submit]');await p.waitForFunction(()=>!!document.querySelector('#guild-contribute'));total+=await visitAll(p);}
  }
  await p.evaluate(()=>{NymeriaNavigation.root('character');InventoryUI.openItem('sword');});await settle(p);total+=await visitAll(p);
  await p.locator('#close-detail').tap();await p.evaluate(()=>NymeriaNavigation.root('world'));await settle(p);
  await p.setViewportSize({width,height:height-60});await settle(p);await visitAll(p);
  await p.setViewportSize({width,height});await settle(p);await visitAll(p);
  assert.deepEqual(errors,[]);console.log('PASS fixed '+width+'×'+height+': '+total+' pages, screens/modal, no scroll/cut controls, viewport contraction/expansion');await p.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
